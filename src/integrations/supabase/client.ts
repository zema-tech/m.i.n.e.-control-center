// Client Supabase — opzionale in produzione (env assenti = modalità offline).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  isSupabaseClientConfigured,
  resolveSupabasePublishableKey,
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

export function isSupabaseConfigured(): boolean {
  return isSupabaseClientConfigured();
}

function createSupabaseClient(): SupabaseClient<Database> {
  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_PUBLISHABLE_KEY = resolveSupabasePublishableKey();

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase env. Vercel integration: SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (o ANON_KEY). Vite: VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/** Stub minimo: auth.getSession senza sessione; il resto avvisa in console. */
function createDisabledStub(): SupabaseClient<Database> {
  const stubAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  };
  return new Proxy({} as SupabaseClient<Database>, {
    get(_t, prop) {
      if (prop === "auth") return stubAuth;
      if (prop === "from") {
        return () => ({
          select: async () => ({ data: [], error: { message: "Supabase non configurato" } }),
          insert: async () => ({ data: null, error: { message: "Supabase non configurato" } }),
          update: async () => ({ data: null, error: { message: "Supabase non configurato" } }),
          delete: async () => ({ data: null, error: { message: "Supabase non configurato" } }),
        });
      }
      return undefined;
    },
  });
}

let _supabase: SupabaseClient<Database> | undefined;
let _warned = false;

// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!_supabase) {
      if (isSupabaseConfigured()) {
        _supabase = createSupabaseClient();
      } else {
        if (!_warned) {
          _warned = true;
          console.warn(
            "[Supabase] Env assenti — offline. Integrazione Vercel fornisce SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY/ANON_KEY (non serve obbligatoriamente VITE_*).",
          );
        }
        _supabase = createDisabledStub();
      }
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
