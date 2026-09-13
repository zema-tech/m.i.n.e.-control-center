/**
 * Risoluzione env Supabase compatibile con:
 * - integrazione Vercel Marketplace (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
 *   SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, …)
 * - template Next (NEXT_PUBLIC_SUPABASE_*)
 * - Vite (VITE_SUPABASE_*)
 *
 * Non esporre mai la secret/service_role al client.
 */

function fromProcess(key: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env?.[key]) {
      const v = process.env[key]?.trim();
      return v || undefined;
    }
  } catch {
    /* browser */
  }
  return undefined;
}

function fromImportMeta(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const v = env?.[key]?.trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

function first(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    if (v && v.length > 0) return v;
  }
  return undefined;
}

/** URL progetto (pubblico). */
export function resolveSupabaseUrl(): string | undefined {
  return first(
    fromImportMeta("VITE_SUPABASE_URL"),
    fromImportMeta("NEXT_PUBLIC_SUPABASE_URL"),
    fromProcess("VITE_SUPABASE_URL"),
    fromProcess("NEXT_PUBLIC_SUPABASE_URL"),
    fromProcess("SUPABASE_URL"),
  );
}

/**
 * Chiave pubblica (anon / publishable).
 * Vercel Marketplace: SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY.
 */
export function resolveSupabasePublishableKey(): string | undefined {
  return first(
    fromImportMeta("VITE_SUPABASE_PUBLISHABLE_KEY"),
    fromImportMeta("VITE_SUPABASE_ANON_KEY"),
    fromImportMeta("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    fromImportMeta("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    fromProcess("VITE_SUPABASE_PUBLISHABLE_KEY"),
    fromProcess("VITE_SUPABASE_ANON_KEY"),
    fromProcess("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    fromProcess("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    fromProcess("SUPABASE_PUBLISHABLE_KEY"),
    fromProcess("SUPABASE_ANON_KEY"),
  );
}

/**
 * Chiave server (service role / secret).
 * Marketplace nuovo: SUPABASE_SECRET_KEY; legacy: SUPABASE_SERVICE_ROLE_KEY.
 */
export function resolveSupabaseServiceKey(): string | undefined {
  return first(
    fromProcess("SUPABASE_SERVICE_ROLE_KEY"),
    fromProcess("SUPABASE_SECRET_KEY"),
    // mai da import.meta / VITE_ — non devono finire nel bundle client
  );
}

export function isSupabaseClientConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabasePublishableKey());
}

export function isSupabaseAdminEnvConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseServiceKey());
}

export function supabaseEnvDiagnostics(): {
  url: boolean;
  publishable: boolean;
  service: boolean;
  hints: string[];
} {
  const url = Boolean(resolveSupabaseUrl());
  const publishable = Boolean(resolveSupabasePublishableKey());
  const service = Boolean(resolveSupabaseServiceKey());
  const hints: string[] = [];
  if (!url) {
    hints.push(
      "Manca URL: imposta SUPABASE_URL (integrazione Vercel) o VITE_SUPABASE_URL.",
    );
  }
  if (!publishable) {
    hints.push(
      "Manca chiave pubblica: SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY / VITE_SUPABASE_*.",
    );
  }
  if (!service) {
    hints.push(
      "Manca chiave admin: SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY (solo server).",
    );
  }
  return { url, publishable, service, hints };
}
