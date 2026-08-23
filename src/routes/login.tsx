import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Lock, Terminal } from "lucide-react";

import { getAuthState, login } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accesso — M.I.N.E" },
      {
        name: "description",
        content: "Accesso al pannello M.I.N.E: rete neurale, chat IA, competenze e connettori.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { authenticated } = await getAuthState();
    if (authenticated) throw redirect({ to: "/network" });
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
      await router.navigate({ to: "/network" });
    } else {
      setError(res.message);
      setPassword("");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> secure shell
          </div>
          <h1 className="text-glow animate-flicker text-4xl font-bold text-primary sm:text-5xl">
            M.I.N.E
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Minecraft Intelligent Network Engine
          </p>
        </div>

        <form onSubmit={onSubmit} className="panel scanlines space-y-5 p-6 sm:p-8">
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"
            >
              <Lock className="h-3.5 w-3.5" /> password amministratore
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-md border border-input bg-background/70 px-3 py-2.5 font-mono text-primary outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:shadow-[var(--shadow-glow-soft)]"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="w-full rounded-md bg-primary px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-all hover:shadow-[var(--shadow-glow)] disabled:opacity-40"
          >
            {busy ? "verifica in corso…" : "accedi"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Dopo il login: rete pallini · chat IA · competenze · connettori. Sessione JWT 24h.
          </p>
        </form>
      </div>
    </main>
  );
}
