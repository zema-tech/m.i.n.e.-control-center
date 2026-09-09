-- Avatar profilo admin (icona tra quelle degli inviti).
ALTER TABLE public.auth_admin_profile
  ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT 'none';
