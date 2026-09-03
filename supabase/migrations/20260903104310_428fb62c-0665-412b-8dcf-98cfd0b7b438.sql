CREATE TABLE public.agent_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'nota',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  importance INT NOT NULL DEFAULT 3,
  source TEXT NOT NULL DEFAULT 'manuale',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  summary TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  ok BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agent_memory_created_idx ON public.agent_memory (created_at DESC);
CREATE INDEX agent_memory_kind_idx ON public.agent_memory (kind);
CREATE INDEX agent_events_created_idx ON public.agent_events (created_at DESC);

GRANT ALL ON public.agent_memory TO service_role;
GRANT ALL ON public.agent_events TO service_role;

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER agent_memory_touch
BEFORE UPDATE ON public.agent_memory
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();