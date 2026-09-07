import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles } from "lucide-react";

import { getAuthState, setupOwnPassword } from "@/lib/auth.functions";

const LOGIN_BG = "https://files.catbox.moe/1prie3.jpg";

export const Route = createFileRoute("/setup-password")({
  head: () => ({
    meta: [
      { title: "Crea password — Omnicore Hub" },
      {
        name: "description",
        content: "Imposta la tua password personale per accedere all'hub Omnicore.",
      },
    ],
  }),
  beforeLoad: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    if (!state.mustSetPassword) throw redirect({ to: "/home" });
  },
  component: SetupPasswordPage,
});

function SetupPasswordPage() {
  const router = useRouter();
  const doSetup = useServerFn(setupOwnPassword);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await doSetup({
      data: {
        password,
        confirm,
        displayName: displayName.trim() || undefined,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    await router.invalidate();
    await router.navigate({ to: "/home" });
  }

  const canSubmit =
    password.length >= 8 && confirm.length >= 8 && password === confirm && !busy;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src={LOGIN_BG}
          alt=""
          className="h-full w-full scale-105 object-cover object-[center_20%]"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617]/88 via-[#0a1628]/75 to-[#020617]/92" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgba(56,189,248,0.16),transparent_55%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] animate-fade-in-up">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sky-100/80 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            Primo accesso
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Crea la tua password
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-sky-100/55">
            Hai usato un accesso temporaneo. Scegli una password personale: la userai da ora in poi
            per entrare nell&apos;hub.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="relative space-y-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-8"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
            aria-hidden
          />

          <div className="space-y-2">
            <label
              htmlFor="displayName"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/60"
            >
              Nome visualizzato (opzionale)
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Es. Alex"
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="new-password"
              className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/60"
            >
              <KeyRound className="h-3.5 w-3.5 text-sky-300" />
              Nuova password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 8 caratteri"
                minLength={8}
                className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 pr-12 font-mono text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-sky-100/45 hover:bg-white/5 hover:text-sky-100/80"
                aria-label={show ? "Nascondi" : "Mostra"}
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirm-password"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/60"
            >
              Conferma password
            </label>
            <input
              id="confirm-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ripeti la password"
              minLength={8}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-400/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-sky-300 to-indigo-400 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-950 shadow-[0_8px_32px_rgba(56,189,248,0.35)] transition hover:shadow-[0_12px_40px_rgba(56,189,248,0.45)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              "Salvataggio…"
            ) : (
              <>
                Salva e entra nell&apos;hub
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <div className="flex items-start gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300/70" />
            <p className="text-[11px] leading-relaxed text-white/40">
              I permessi (sezioni e azioni) restano quelli assegnati all&apos;invito. Non potrai
              gestire altri accessi: solo l&apos;admin lo fa.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
