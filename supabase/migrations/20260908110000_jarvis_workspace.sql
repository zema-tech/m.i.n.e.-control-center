CREATE TABLE public.jarvis_projects (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, id)
);

CREATE TABLE public.jarvis_chats (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  project_id TEXT REFERENCES public.jarvis_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Nuova chat',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, id)
);

CREATE TABLE public.jarvis_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  chat_id TEXT NOT NULL REFERENCES public.jarvis_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, position)
);

CREATE TABLE public.jarvis_files (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  project_id TEXT REFERENCES public.jarvis_projects(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES public.jarvis_chats(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 0 AND 10485760),
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, id)
);

CREATE TABLE public.jarvis_file_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  file_id TEXT NOT NULL REFERENCES public.jarvis_files(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES public.jarvis_projects(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES public.jarvis_chats(id) ON DELETE SET NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  UNIQUE (file_id, chunk_index)
);

CREATE INDEX jarvis_projects_account_idx ON public.jarvis_projects (account_id, updated_at DESC);
CREATE INDEX jarvis_chats_account_idx ON public.jarvis_chats (account_id, pinned DESC, updated_at DESC);
CREATE INDEX jarvis_messages_chat_idx ON public.jarvis_messages (account_id, chat_id, position);
CREATE INDEX jarvis_files_scope_idx ON public.jarvis_files (account_id, project_id, chat_id);
CREATE INDEX jarvis_chunks_search_idx ON public.jarvis_file_chunks USING GIN (search_vector);

CREATE TRIGGER jarvis_projects_touch
BEFORE UPDATE ON public.jarvis_projects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER jarvis_chats_touch
BEFORE UPDATE ON public.jarvis_chats
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.jarvis_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_file_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.jarvis_projects, public.jarvis_chats, public.jarvis_messages,
  public.jarvis_files, public.jarvis_file_chunks FROM anon, authenticated;
GRANT ALL ON public.jarvis_projects, public.jarvis_chats, public.jarvis_messages,
  public.jarvis_files, public.jarvis_file_chunks TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('jarvis-private', 'jarvis-private', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

CREATE OR REPLACE FUNCTION public.search_jarvis_chunks(
  owner_account_id TEXT,
  selected_project_id TEXT,
  selected_chat_id TEXT,
  search_query TEXT,
  result_limit INTEGER DEFAULT 6
)
RETURNS TABLE (file_id TEXT, content TEXT, rank REAL)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.file_id, c.content,
    ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', search_query)) AS rank
  FROM public.jarvis_file_chunks c
  WHERE c.account_id = owner_account_id
    AND (
      (selected_project_id IS NOT NULL AND c.project_id = selected_project_id)
      OR (selected_project_id IS NULL AND c.chat_id = selected_chat_id)
    )
    AND c.search_vector @@ websearch_to_tsquery('simple', search_query)
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(result_limit, 1), 12);
$$;

REVOKE ALL ON FUNCTION public.search_jarvis_chunks(TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_jarvis_chunks(TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;
