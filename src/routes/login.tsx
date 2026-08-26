import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

import { getAuthState, login } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi — JARVIS" },
      {
        name: "description",
        content: "Accesso al tuo agente IA personale.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { authenticated } = await getAuthState();
    if (authenticated) throw redirect({ to: "/agent" });
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const doLogin = useServerFn(login);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await doLogin({ data: { password } });
    setBusy(false);
    if (res.ok) {
      await router.invalidate();
      await router.navigate({ to: "/agent" });
    } else {
      setError(res.message);
      setPassword("");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient orbs */}
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary/15 blur-[100px] animate-aurora"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-violet-500/10 blur-[90px] animate-aurora"
        style={{ animationDelay: "-4s" }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[420px] animate-fade-in-up">
        <div className="mb-10 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Agente personale
          </div>
          <h1 className="logo-gradient font-display text-5xl font-bold tracking-tight sm:text-6xl">
            JARVIS
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Il tuo Claude personale —
            <br className="hidden sm:block" />
            carattere, memoria, mani e regole.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="panel space-y-6 p-7 sm:p-8"
        >
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="flex items-center gap-2 text-label"
            >
              <Lock className="h-3.5 w-3.5 text-primary" />
              Password amministratore
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Inserisci la password"
              className="input-field font-mono text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm tracking-wide"
          >
            {busy ? (
              "Verifica…"
            ) : (
              <>
                Entra nell&apos;agente
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
            Sessione sicura · 4 pilastri · One MCP · codice
          </p>
        </form>
      </div>
    </main>
  );
}
