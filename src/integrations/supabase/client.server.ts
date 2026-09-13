// Server-side Supabase (service role / secret). Opzionale se non usi cloud memory.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  isSupabaseAdminEnvConfigured,
  resolveSupabaseServiceKey,
  resolveSupabaseUrl,
} from "./env";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseAdminEnvConfigured();
}

function createSupabaseAdminClient(): SupabaseClient<Database> {
  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_SERVICE_ROLE_KEY = resolveSupabaseServiceKey();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL / (SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY). Cloud memory disabilitata.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: SupabaseClient<Database> | undefined;

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) {
      if (!isSupabaseAdminConfigured()) {
        throw new Error(
          "Supabase admin non configurato (SUPABASE_URL + SERVICE_ROLE/SECRET_KEY).",
        );
      }
      _supabaseAdmin = createSupabaseAdminClient();
    }
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
