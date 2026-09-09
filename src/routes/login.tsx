import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { getAuthState, login } from "@/lib/auth.functions";

const LOGIN_BG = "https://files.catbox.moe/1prie3.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi — Omnicore Hub" },
      {
        name: "description",
        content: "Accesso al Control Center Omnicore · J.A.R.V.I.S e agenti specializzati.",
      },
    ],
  }),
  beforeLoad: async () => {
    const state = await getAuthState();
    if (state.authenticated) {
      if (state.mustSetPassword) throw redirect({ to: "/setup-password" });
      throw redirect({ to: "/home" });
    }
  },
  component: LoginPage,
});

function formatCountdown(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LoginPage() {
  const router = useRouter();
  const doLogin = useServerFn(login);
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockSec, setLockSec] = useState(0);
  const [banSec, setBanSec] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Anti-bot: honeypot invisibile + timestamp di apertura form
  const [honeypot, setHoneypot] = useState("");
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (lockSec <= 0) return;
    const t = window.setInterval(() => {
      setLockSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [lockSec]);

  useEffect(() => {
    if (banSec <= 0) return;
    const t = window.setInterval(() => {
      setBanSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [banSec]);

  useEffect(() => {
    if (lockSec === 0 && banSec === 0) setError(null);
  }, [lockSec, banSec]);

  function triggerShake() {
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lockSec > 0 || banSec > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await doLogin({
        data: { password, honeypot, startedAt: startedAtRef.current },
      });
      setBusy(false);
      if (res.ok) {
        await router.invalidate();
        if (res.mustSetPassword) {
          await router.navigate({ to: "/setup-password" });
        } else {
          await router.navigate({ to: "/home" });
        }
        return;
      }
      triggerShake();
      setError(res.message);
      setPassword("");
      const banned = "banned" in res && res.banned;
      if (banned && "banInSec" in res && res.banInSec > 0) {
        setBanSec(res.banInSec);
      } else if (res.blocked && res.retryInSec > 0) {
        setLockSec(res.retryInSec);
      }
      if ("remaining" in res && typeof res.remaining === "number") {
        setRemaining(res.remaining);
      }
    } catch {
      setBusy(false);
      setError("Errore di rete. Riprova.");
    }
  }

  const locked = lockSec > 0;
  const banned = banSec > 0;
  const blocked = locked || banned;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src={LOGIN_BG}
          alt=""
          className="h-full w-full scale-105 object-cover object-[center_20%]"
          decoding="async"
          onError={(e) => {
            // Fallback se catbox è down: nascondi bg esterno, resta il gradiente.
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617]/85 via-[#0a1628]/72 to-[#020617]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_80%,rgba(99,102,241,0.12),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E)",
          }}
        />
      </div>

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
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sky-100/80 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            Omnicore Hub
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight text-white drop-shadow-[0_0_40px_rgba(56,189,248,0.25)] sm:text-6xl">
            <span className="bg-gradient-to-br from-white via-sky-100 to-sky-300/90 bg-clip-text text-transparent">
              Omnicore
            </span>
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-sky-100/55">
            Control Center · un nucleo, cinque agenti
          </p>
          <p className="mt-1 text-[12px] tracking-wide text-sky-100/40">
            J.A.R.V.I.S · E.D.I.T · M.I.N.E · P.R.O.M.P.T · A.R.T
          </p>
        </div>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className={`relative space-y-6 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-8 ${
            shake ? "animate-form-shake" : ""
          }`}
        >
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
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Inserisci la password"
                disabled={blocked || busy}
                className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 pr-12 font-mono text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-sky-100/45 transition hover:bg-white/5 hover:text-sky-100/80"
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Honeypot anti-bot: invisibile agli umani */}
          <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
            <label htmlFor="website">Sito web</label>
            <input
              id="website"
              type="text"
              name="website"
              autoComplete="off"
              tabIndex={-1}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {error || blocked ? (
            <div
              role="alert"
              className={`rounded-xl border px-3.5 py-2.5 text-sm ${
                banned
                  ? "border-red-500/40 bg-red-600/15 text-red-100"
                  : "border-red-400/25 bg-red-500/10 text-red-200"
              }`}
            >
              {banned ? (
                <>
                  ⛔ IP bannato per troppi tentativi. Riprova tra{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCountdown(banSec)}
                  </span>
                </>
              ) : locked ? (
                <>
                  Accesso in pausa. Riprova tra{" "}
                  <span className="font-mono font-semibold tabular-nums text-red-100">
                    {formatCountdown(lockSec)}
                  </span>
                </>
              ) : (
                error
              )}
              {!blocked && remaining !== null && remaining <= 2 && remaining > 0 ? (
                <span className="mt-1 block text-[12px] opacity-80">
                  Attenzione: {remaining} tentativi rimasti prima del blocco.
                </span>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || password.length === 0 || blocked}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-sky-300 to-indigo-400 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-950 shadow-[0_8px_32px_rgba(56,189,248,0.35)] transition hover:shadow-[0_12px_40px_rgba(56,189,248,0.45)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              "Verifica…"
            ) : banned ? (
              `Bannato ${formatCountdown(banSec)}`
            ) : locked ? (
              `Attendi ${formatCountdown(lockSec)}`
            ) : (
              <>
                Entra nell&apos;hub
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <div className="flex items-start gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300/70" />
            <p className="text-[11px] leading-relaxed text-white/40">
              Password admin, personale o temporanea. Con un invito temporaneo ti chiederemo di
              creare la tua password al primo ingresso.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
