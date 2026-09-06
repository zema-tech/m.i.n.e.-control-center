// Client Supabase — opzionale in produzione (Vercel senza Lovable Cloud).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";

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

function readEnv() {
  const SUPABASE_URL =
    (import.meta.env?.["VITE_SUPABASE_URL"] as string | undefined) ||
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    (import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
}

export function isSupabaseConfigured(): boolean {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = readEnv();
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

function createSupabaseClient(): SupabaseClient<Database> {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = readEnv();

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase environment variable(s). Imposta SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY su Vercel, oppure usa solo localStorage.",
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: brokeredPreviewStorage(),
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
            "[Supabase] Env assenti — modalità offline (localStorage). Aggiungi SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY su Vercel per la cloud memory.",
          );
        }
        _supabase = createDisabledStub();
      }
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
