// Attacca Bearer Supabase alle serverFn solo se configurato.
import { createMiddleware } from "@tanstack/react-start";
import { isSupabaseConfigured, supabase } from "./client";

// Registrato come global functionMiddleware in src/start.ts
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (!isSupabaseConfigured()) {
      return next({ headers: {} });
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      return next({
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      return next({ headers: {} });
    }
  },
);
