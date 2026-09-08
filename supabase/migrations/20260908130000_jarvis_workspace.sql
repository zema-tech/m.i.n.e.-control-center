create extension if not exists pgcrypto;

create table if not exists public.jarvis_projects (
  id text primary key,
  owner_key text not null,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_chats (
  id text primary key,
  owner_key text not null,
  project_id text references public.jarvis_projects(id) on delete set null,
  title text not null default 'Nuova chat',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_messages (
  id text primary key,
  owner_key text not null,
  chat_id text not null references public.jarvis_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jarvis_files (
  id text primary key,
  owner_key text not null,
  project_id text references public.jarvis_projects(id) on delete cascade,
  chat_id text references public.jarvis_chats(id) on delete cascade,
  name text not null,
  mime_type text not null,
  size integer not null check (size <= 10485760),
  storage_path text not null unique,
  extracted_text text not null,
  created_at timestamptz not null default now(),
  check (project_id is not null or chat_id is not null)
);

create table if not exists public.jarvis_file_chunks (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  file_id text not null references public.jarvis_files(id) on delete cascade,
  project_id text references public.jarvis_projects(id) on delete cascade,
  chat_id text references public.jarvis_chats(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  search_vector tsvector generated always as (to_tsvector('italian', content)) stored,
  created_at timestamptz not null default now(),
  unique (file_id, chunk_index)
);

create index if not exists jarvis_projects_owner_idx on public.jarvis_projects(owner_key, updated_at desc);
create index if not exists jarvis_chats_owner_idx on public.jarvis_chats(owner_key, updated_at desc);
create index if not exists jarvis_messages_chat_idx on public.jarvis_messages(owner_key, chat_id, created_at);
create index if not exists jarvis_chunks_search_idx on public.jarvis_file_chunks using gin(search_vector);

alter table public.jarvis_projects enable row level security;
alter table public.jarvis_chats enable row level security;
alter table public.jarvis_messages enable row level security;
alter table public.jarvis_files enable row level security;
alter table public.jarvis_file_chunks enable row level security;

revoke all on public.jarvis_projects, public.jarvis_chats, public.jarvis_messages, public.jarvis_files, public.jarvis_file_chunks from anon, authenticated;
grant all on public.jarvis_projects, public.jarvis_chats, public.jarvis_messages, public.jarvis_files, public.jarvis_file_chunks to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('jarvis-project-files', 'jarvis-project-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "jarvis service role only" on storage.objects;
create policy "jarvis service role only" on storage.objects
  for all to service_role
  using (bucket_id = 'jarvis-project-files')
  with check (bucket_id = 'jarvis-project-files');
