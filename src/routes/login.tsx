import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

import { getAuthState, login } from "@/lib/auth.functions";

/** Hero robot — Motionsites-grade login atmosphere */
const LOGIN_BG =
  "https://files.catbox.moe/1prie3.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi — Omnicore" },
      {
        name: "description",
        content: "Accesso al Control Center Omnicore · J.A.R.V.I.S e agenti specializzati.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { authenticated } = await getAuthState();
    if (authenticated) throw redirect({ to: "/home" });
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
      await router.navigate({ to: "/home" });
    } else {
      setError(res.message);
      setPassword("");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Full-bleed cinematic background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src={LOGIN_BG}
          alt=""
          className="h-full w-full object-cover object-[center_20%] scale-105"
          decoding="async"
        />
        {/* Depth + brand blue wash (Motionsites / agency AI look) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617]/85 via-[#0a1628]/72 to-[#020617]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_80%,rgba(99,102,241,0.12),transparent_50%)]" />
        {/* Fine grain */}
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E)",
          }}
        />
      </div>

      {/* Soft floating orbs */}
      <div
        className="pointer-events-none absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-sky-400/15 blur-[110px] animate-aurora"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-1/5 h-72 w-72 rounded-full bg-indigo-500/20 blur-[100px] animate-aurora"
        style={{ animationDelay: "-5s" }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[420px] animate-fade-in-up">
        <div className="mb-9 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium tracking-[0.12em] text-sky-100/80 backdrop-blur-xl uppercase">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            Omnicore
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl drop-shadow-[0_0_40px_rgba(56,189,248,0.25)]">
            <span className="bg-gradient-to-br from-white via-sky-100 to-sky-300/90 bg-clip-text text-transparent">
              JARVIS
            </span>
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-sky-100/55">
            J.A.R.V.I.S · E.D.I.T · M.I.N.E · P.R.O.M.P.T · A.R.T
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="relative space-y-6 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-8"
        >
          {/* Glass highlight edge */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
            aria-hidden
          />

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/60"
            >
              <Lock className="h-3.5 w-3.5 text-sky-300" />
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
              className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-sky-300 to-indigo-400 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-950 shadow-[0_8px_32px_rgba(56,189,248,0.35)] transition hover:shadow-[0_12px_40px_rgba(56,189,248,0.45)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              "Verifica…"
            ) : (
              <>
                Entra nell'hub
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-white/35">
            Control Center · accesso protetto
          </p>
        </form>
      </div>
    </main>
  );
}
