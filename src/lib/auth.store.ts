/**
 * Persistenza auth su Supabase (server only, service_role).
 * Ogni funzione ritorna null/false in caso di errore o se Supabase non è
 * configurato: il chiamante resta in memoria (comportamento attuale).
 */

export type StoredMember = {
  id: string;
  label: string;
  hash: string;
  permissions: string[];
  createdAt: number;
  fromTempId?: string;
};

export type StoredTemp = {
  id: string;
  label: string;
  icon: string;
  hash: string;
  createdAt: number;
  expiresAt: number;
  uses: number;
  maxUses: number | null;
  permissions: string[];
};

export type StoredBinding = { key: string; ip: string; updatedAt: number };

export type StoredBan = {
  ip: string;
  count: number;
  lockedUntil: number;
  firstSeen: number;
  totalFails: number;
  banUntil: number;
};

export type StoredAdminProfile = {
  label: string;
  avatar: string;
  createdAt: number;
  updatedAt: number;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function storeAvailable(): Promise<boolean> {
  try {
    const { isSupabaseAdminConfigured } = await import("@/integrations/supabase/client.server");
    return isSupabaseAdminConfigured();
  } catch {
    return false;
  }
}

// --- Membri ---

export async function fetchMembers(): Promise<StoredMember[] | null> {
  try {
    const { data, error } = await (await db()).from("auth_members").select("*");
    if (error) return null;
    return (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      hash: r.hash,
      permissions: r.permissions ?? [],
      createdAt: r.created_at,
      fromTempId: r.from_temp_id ?? undefined,
    }));
  } catch {
    return null;
  }
}

export async function saveMember(m: StoredMember): Promise<boolean> {
  try {
    const { error } = await (await db()).from("auth_members").upsert({
      id: m.id,
      label: m.label,
      hash: m.hash,
      permissions: m.permissions,
      created_at: m.createdAt,
      from_temp_id: m.fromTempId ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

// --- Inviti temporanei ---

export async function fetchTemps(): Promise<StoredTemp[] | null> {
  try {
    const { data, error } = await (await db()).from("auth_temp_passwords").select("*");
    if (error) return null;
    return (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      icon: r.icon,
      hash: r.hash,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      uses: r.uses,
      maxUses: r.max_uses,
      permissions: r.permissions ?? [],
    }));
  } catch {
    return null;
  }
}

export async function saveTemp(t: StoredTemp): Promise<boolean> {
  try {
    const { error } = await (await db()).from("auth_temp_passwords").upsert({
      id: t.id,
      label: t.label,
      icon: t.icon,
      hash: t.hash,
      created_at: t.createdAt,
      expires_at: t.expiresAt,
      uses: t.uses,
      max_uses: t.maxUses,
      permissions: t.permissions,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteTemp(id: string): Promise<boolean> {
  try {
    const { error } = await (await db()).from("auth_temp_passwords").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

// --- Binding IP ---

export async function fetchBindings(): Promise<StoredBinding[] | null> {
  try {
    const { data, error } = await (await db()).from("auth_ip_bindings").select("*");
    if (error) return null;
    return (data ?? []).map((r) => ({
      key: r.credential_key,
      ip: r.ip,
      updatedAt: r.updated_at,
    }));
  } catch {
    return null;
  }
}

export async function saveBinding(key: string, ip: string, updatedAt: number): Promise<boolean> {
  try {
    const { error } = await (await db())
      .from("auth_ip_bindings")
      .upsert({ credential_key: key, ip, updated_at: updatedAt });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteBindings(key?: string): Promise<boolean> {
  try {
    const q = (await db()).from("auth_ip_bindings").delete();
    const { error } = key ? await q.eq("credential_key", key) : await q.neq("credential_key", "");
    return !error;
  } catch {
    return false;
  }
}

// --- Ban / rate limit ---

export async function fetchBans(): Promise<StoredBan[] | null> {
  try {
    const { data, error } = await (await db()).from("auth_ip_bans").select("*");
    if (error) return null;
    return (data ?? []).map((r) => ({
      ip: r.ip,
      count: r.count,
      lockedUntil: r.locked_until,
      firstSeen: r.first_seen,
      totalFails: r.total_fails,
      banUntil: r.ban_until,
    }));
  } catch {
    return null;
  }
}

export async function saveBan(b: StoredBan): Promise<boolean> {
  try {
    const { error } = await (await db()).from("auth_ip_bans").upsert({
      ip: b.ip,
      count: b.count,
      locked_until: b.lockedUntil,
      first_seen: b.firstSeen,
      total_fails: b.totalFails,
      ban_until: b.banUntil,
      updated_at: Date.now(),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteBan(ip: string): Promise<boolean> {
  try {
    const { error } = await (await db()).from("auth_ip_bans").delete().eq("ip", ip);
    return !error;
  } catch {
    return false;
  }
}

// --- Profilo admin ---

export async function fetchAdminProfile(): Promise<StoredAdminProfile | null> {
  try {
    const { data, error } = await (await db())
      .from("auth_admin_profile")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      label: data.label,
      avatar: (data as { avatar?: string }).avatar ?? "none",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

export async function saveAdminProfile(p: StoredAdminProfile): Promise<boolean> {
  try {
    const { error } = await (await db()).from("auth_admin_profile").upsert({
      id: 1,
      label: p.label,
      avatar: p.avatar,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    });
    return !error;
  } catch {
    return false;
  }
}

// --- Token revocati ---

export async function fetchRevokedJtis(limit = 5000): Promise<string[] | null> {
  try {
    const { data, error } = await (await db())
      .from("auth_revoked_tokens")
      .select("jti")
      .order("revoked_at", { ascending: false })
      .limit(limit);
    if (error) return null;
    return (data ?? []).map((r) => r.jti);
  } catch {
    return null;
  }
}

export async function saveRevokedJti(jti: string): Promise<boolean> {
  try {
    const { error } = await (await db())
      .from("auth_revoked_tokens")
      .upsert({ jti, revoked_at: Date.now() });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Pulizia periodica tabelle auth (chiamata al boot): inviti scaduti, ban
 * scaduti, binding oltre la finestra, token revocati oltre 48h.
 */
export async function pruneAuthTables(bindingWindowMs: number): Promise<void> {
  try {
    const admin = await db();
    const now = Date.now();
    const results = await Promise.allSettled([
      admin.from("auth_temp_passwords").delete().lt("expires_at", now),
      admin
        .from("auth_ip_bans")
        .delete()
        .lt("ban_until", now)
        .lt("locked_until", now),
      admin.from("auth_ip_bindings").delete().lt("updated_at", now - bindingWindowMs),
      admin.from("auth_revoked_tokens").delete().lt("revoked_at", now - 48 * 60 * 60 * 1000),
    ]);
    for (const r of results) {
      if (r.status === "rejected") throw r.reason;
    }
  } catch {
    /* best-effort */
  }
}
