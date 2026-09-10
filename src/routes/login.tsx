import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Mic,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { getAuthState, getTurnstileSiteKey, login } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi — Omnicore Hermes" },
      {
        name: "description",
        content: "Accesso Hermes al Control Center Omnicore · J.A.R.V.I.S e agenti specializzati.",
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

const JARVIS_TEASER = [
  {
    icon: Brain,
    t: "Piani confermati",
    d: "Cerca file, genera CSV, chiama GitHub MCP — tu premi Esegui.",
  },
  {
    icon: Mic,
    t: "Voce it-IT",
    d: "Detta in Jarvis, trascrizione diretta nel box di chat.",
  },
  {
    icon: Fingerprint,
    t: "Workspace isolato",
    d: "Solo localStorage per account. Niente disco OS, niente fughe.",
  },
];

function LoginPage() {
  const router = useRouter();
  const doLogin = useServerFn(login);
  const doSiteKey = useServerFn(getTurnstileSiteKey);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockSec, setLockSec] = useState(0);
  const [banSec, setBanSec] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  // VibeSec: token captcha solo in memoria, mai in URL/localStorage; monouso.
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<TurnstileHandle | null>(null);

  useEffect(() => {
    void doSiteKey({})
      .then((r) => {
        if (r.siteKey) setSiteKey(r.siteKey);
      })
      .catch(() => {});
  }, [doSiteKey]);

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
    // VibeSec: niente trim sulla password (gli spazi contano), limite 200 già lato server.
    if (!password || password.length > 200) return;
    setBusy(true);
    setError(null);
    try {
      const res = await doLogin({
        data: { password, turnstileToken: captchaToken },
      });
      setBusy(false);
      if (res.ok) {
        // VibeSec: pulizia immediata del segreto dalla memoria client.
        setPassword("");
        setCaptchaToken("");
        await router.invalidate();
        if (res.mustSetPassword) {
          await router.navigate({ to: "/setup-password" });
        } else {
          await router.navigate({ to: "/home" });
        }
        return;
      }
      triggerShake();
      // VibeSec: messaggio server già generico, mai eco della password.
      setError(res.message);
      setPassword("");
      captchaRef.current?.reset();
      setCaptchaToken("");
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
  const submitDisabled =
    busy || password.length === 0 || blocked || Boolean(siteKey && !captchaToken);

  const statusText = busy
    ? "Verifica sicura in corso…"
    : banned
      ? `IP bannato — riprova tra ${formatCountdown(banSec)}`
      : locked
        ? `Accesso in pausa — riprova tra ${formatCountdown(lockSec)}`
        : siteKey && !captchaToken
          ? "Completa la verifica umana per entrare"
          : "Premi Invio per entrare nell'hub";

  return (
    <div className="hermes-page relative flex min-h-screen flex-col overflow-x-clip">
      {/* Sfondo: azzurro chiaro → nero */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="hermes-sky absolute inset-0" />
        <div className="hermes-grid absolute inset-x-0 top-0 h-[640px] opacity-80" />
        <div className="hermes-orb left-[12%] top-[90px] h-[280px] w-[280px] bg-sky-100/50" />
        <div className="hermes-orb right-[10%] top-[200px] h-[220px] w-[220px] bg-sky-400/25 [animation-delay:-6s]" />
        <div className="hermes-night-fade absolute inset-x-0 top-[380px] bottom-0" />
        <div className="grain absolute inset-0" />
      </div>

      <header className="grok-nav relative">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-hermes text-[16px] tracking-[0.22em]">OMNICORE</span>
          </Link>
          <p className="font-mono text-[11px] tracking-[0.24em] text-sky-100/70">
            ACCESSO PRIVATO · HERMES
          </p>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-12 sm:py-16">
        <div className="grid w-full max-w-5xl items-stretch gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Card login */}
          <div className={`hermes-login-card p-7 sm:p-10 ${shake ? "animate-form-shake" : ""}`}>
            <p className="hermes-badge">
              <span className="dot" />
              Control Center
            </p>
            <h1 className="hermes-title mt-5 text-[clamp(2.6rem,5vw,3.8rem)] text-white">
              Accedi<span className="hermes-gradient-text italic">.</span>
            </h1>
            <p className="hermes-eyebrow mt-3 !text-[11px]">Un nucleo · Cinque agenti</p>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-300/80">
              J.A.R.V.I.S · M.I.N.E · P.R.O.M.P.T · A.R.T — dietro questa porta.
            </p>

            <form onSubmit={onSubmit} className="mt-8" noValidate={false}>
              <label
                htmlFor="password"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100/70"
              >
                Password
              </label>
              <div className="hermes-input-bar flex items-center gap-2 p-2 pl-4">
                <Lock className="h-4 w-4 shrink-0 text-sky-200/70" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => {
                    try {
                      setCapsOn(
                        (e as unknown as KeyboardEvent).getModifierState?.("CapsLock") ?? false,
                      );
                    } catch {
                      /* ignore */
                    }
                  }}
                  placeholder="Inserisci la password…"
                  disabled={blocked || busy}
                  aria-describedby="login-status"
                  className="w-full bg-transparent py-2 font-mono text-[15px] text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="submit"
                  disabled={submitDisabled}
                  aria-label="Entra nell'hub"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-sky-100 to-sky-300 text-black transition hover:from-white hover:to-sky-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {capsOn && !blocked ? (
                <p className="mt-2 text-[12px] font-medium text-amber-200/90" role="status">
                  Attenzione: BLOC MAIUSC attivo.
                </p>
              ) : null}

              {siteKey ? (
                <div className="mt-5 flex justify-center">
                  <Turnstile
                    siteKey={siteKey}
                    onToken={setCaptchaToken}
                    onExpire={() => setCaptchaToken("")}
                    handleRef={captchaRef}
                  />
                </div>
              ) : null}

              <p
                id="login-status"
                className="mt-4 min-h-5 text-[13px] text-slate-300/70"
                role="status"
                aria-live="polite"
              >
                {statusText}
              </p>

              {error || blocked ? (
                <div
                  role="alert"
                  className={`mt-2 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed ${
                    banned
                      ? "border-red-400/40 bg-red-950/60 text-red-100"
                      : "border-red-300/25 bg-red-950/40 text-red-100/90"
                  }`}
                >
                  {banned ? (
                    <>
                      IP bannato per troppi tentativi. Riprova tra{" "}
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCountdown(banSec)}
                      </span>
                    </>
                  ) : locked ? (
                    <>
                      Accesso in pausa. Riprova tra{" "}
                      <span className="font-mono font-semibold tabular-nums">
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
            </form>

            {/* Nuove mini-sezioni VibeSec */}
            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
              {[
                { icon: Timer, t: "Rate-limit", d: "Pausa + ban 24h" },
                { icon: ShieldCheck, t: "HttpOnly", d: "Cookie Lax+Secure" },
                { icon: Fingerprint, t: "Max 3 IP", d: "Binding credenziale" },
              ].map((c) => (
                <div
                  key={c.t}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur"
                >
                  <c.icon className="h-4 w-4 text-sky-200/80" />
                  <p className="mt-2 text-[13px] font-semibold text-white">{c.t}</p>
                  <p className="text-[12px] text-slate-400">{c.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-200/70" />
              <p className="text-[12px] leading-relaxed text-slate-400">
                Admin, personale o temporanea single-use. Con un invito ti chiederemo di creare la
                tua password (10+ caratteri) al primo ingresso. Mai password via URL o log.
              </p>
            </div>
          </div>

          {/* Pannello Jarvis */}
          <div className="hermes-login-card relative flex flex-col overflow-hidden p-7 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-2 font-hermes text-[20px] tracking-[0.18em] text-white">
                <Sparkles className="h-4 w-4 text-sky-200" />
                JARVIS
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />
                In attesa dietro la porta
              </span>
            </div>
            <p className="mt-3 font-hermes text-[26px] italic leading-snug text-sky-50">
              “La porta è blindata. Dentro, io lavoro per te.”
            </p>

            <div className="mt-5 space-y-2.5">
              <div className="flex justify-end">
                <p className="max-w-[90%] rounded-2xl bg-sky-200/90 px-4 py-2.5 text-[13px] text-black">
                  Prepara il report CSV delle fatture di gennaio
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-[13px] leading-relaxed text-slate-200">
                Piano pronto · 2 step · <span className="text-sky-200">in attesa di conferma</span>
                <span className="hermes-typing ml-2 inline-flex gap-1 align-middle" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>

            <div className="hermes-jarvis-line my-5" />

            <div className="space-y-2.5">
              {JARVIS_TEASER.map((f) => (
                <div
                  key={f.t}
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5"
                >
                  <span className="grok-icon shrink-0">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-white">{f.t}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-400">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6">
              <Link
                to="/"
                className="hermes-chip w-full justify-center !py-3 text-center no-underline"
              >
                Scopri cosa fa Jarvis →
              </Link>
              <p className="mt-3 text-center font-mono text-[10px] tracking-[0.2em] text-slate-500">
                VOCE · FILE · PROGETTI · MCP CON CONFERMA
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <p className="font-mono text-[11px] tracking-[0.2em] text-slate-300/70">
            OMNICORE © 2026 · HERMES
          </p>
          <Link to="/" className="text-[13px] font-medium text-slate-300 hover:text-white">
            ← Presentazione
          </Link>
        </div>
      </footer>
    </div>
  );
}
