-- Persistenza auth Omnicore (membri, inviti, binding IP, ban, profilo admin, token revocati).
-- Epoch in millisecondi (BIGINT) per restare allineati al codice (Date.now()).
-- Solo service_role: niente accesso anon/authenticated, come agent_memory/agent_events.

CREATE TABLE public.auth_members (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  hash TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  from_temp_id TEXT
);

CREATE TABLE public.auth_temp_passwords (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'none',
  hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  uses INT NOT NULL DEFAULT 0,
  max_uses INT,
  permissions TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX auth_temp_expires_idx ON public.auth_temp_passwords (expires_at);

CREATE TABLE public.auth_ip_bindings (
  credential_key TEXT NOT NULL,
  ip TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (credential_key, ip)
);

CREATE TABLE public.auth_ip_bans (
  ip TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,
  first_seen BIGINT NOT NULL,
  total_fails INT NOT NULL DEFAULT 0,
  ban_until BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE TABLE public.auth_admin_profile (
  id INT PRIMARY KEY CHECK (id = 1),
  label TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE public.auth_revoked_tokens (
  jti TEXT PRIMARY KEY,
  revoked_at BIGINT NOT NULL
);
CREATE INDEX auth_revoked_at_idx ON public.auth_revoked_tokens (revoked_at);

ALTER TABLE public.auth_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_temp_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_ip_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_ip_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_admin_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_revoked_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_members FROM anon, authenticated;
REVOKE ALL ON public.auth_temp_passwords FROM anon, authenticated;
REVOKE ALL ON public.auth_ip_bindings FROM anon, authenticated;
REVOKE ALL ON public.auth_ip_bans FROM anon, authenticated;
REVOKE ALL ON public.auth_admin_profile FROM anon, authenticated;
REVOKE ALL ON public.auth_revoked_tokens FROM anon, authenticated;

GRANT ALL ON public.auth_members TO service_role;
GRANT ALL ON public.auth_temp_passwords TO service_role;
GRANT ALL ON public.auth_ip_bindings TO service_role;
GRANT ALL ON public.auth_ip_bans TO service_role;
GRANT ALL ON public.auth_admin_profile TO service_role;
GRANT ALL ON public.auth_revoked_tokens TO service_role;

CREATE POLICY "auth_members backend only" ON public.auth_members FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "auth_temp_passwords backend only" ON public.auth_temp_passwords FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "auth_ip_bindings backend only" ON public.auth_ip_bindings FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "auth_ip_bans backend only" ON public.auth_ip_bans FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "auth_admin_profile backend only" ON public.auth_admin_profile FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "auth_revoked_tokens backend only" ON public.auth_revoked_tokens FOR ALL TO authenticated USING (false) WITH CHECK (false);
