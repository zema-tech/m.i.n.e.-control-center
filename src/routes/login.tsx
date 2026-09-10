import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { getAuthState, getTurnstileSiteKey, login } from "@/lib/auth.functions";

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
  const doSiteKey = useServerFn(getTurnstileSiteKey);
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockSec, setLockSec] = useState(0);
  const [banSec, setBanSec] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Captcha Turnstile: token dal widget, siteKey dal server (null = non configurato)
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
    setBusy(true);
    setError(null);
    try {
      const res = await doLogin({
        data: { password, turnstileToken: captchaToken },
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
      // Il token captcha è monouso: si rigenera il widget a ogni fallimento
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
    ? "Verifica…"
    : banned
      ? `IP bannato — riprova tra ${formatCountdown(banSec)}`
      : locked
        ? `Accesso in pausa — riprova tra ${formatCountdown(lockSec)}`
        : siteKey && !captchaToken
          ? "Completa la verifica umana per entrare"
          : "Premi Invio per entrare nell'hub";

  return (
    <div className="grok-page relative flex min-h-screen flex-col overflow-x-clip">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="grok-glow-top absolute inset-x-0 top-0 h-[480px]" />
        <div className="grok-grid-bg absolute inset-x-0 top-0 h-[620px]" />
      </div>

      <header className="grok-nav">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Omnicore
          </Link>
          <p className="font-mono text-[11px] tracking-[0.18em] text-neutral-600">
            ACCESSO PRIVATO
          </p>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-[480px] text-center">
          <p className="grok-badge">
            <span className="dot" />
            Control Center
          </p>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Accedi.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-400">
            Un nucleo, cinque agenti: J.A.R.V.I.S · M.I.N.E · P.R.O.M.P.T · A.R.T
          </p>

          <form
            ref={formRef}
            onSubmit={onSubmit}
            className={shake ? "animate-form-shake" : undefined}
          >
            <div className="grok-bar mx-auto mt-10 flex items-center gap-3 p-2.5 pl-5">
              <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Inserisci la password…"
                disabled={blocked || busy}
                className="grok-input flex-1 font-mono text-[15px] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-full p-2 text-neutral-500 transition hover:bg-white/5 hover:text-white"
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                aria-label="Entra nell'hub"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

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

            <p className="mt-4 min-h-5 text-[13px] text-neutral-500" role="status">
              {statusText}
            </p>

            {error || blocked ? (
              <div
                role="alert"
                className={`mx-auto mt-2 max-w-[440px] rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed ${
                  banned
                    ? "border-red-500/40 bg-red-950/60 text-red-100"
                    : "border-red-400/25 bg-red-950/40 text-red-200"
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

          <div className="mx-auto mt-8 flex max-w-[440px] items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/70" />
            <p className="text-[12px] leading-relaxed text-neutral-500">
              Password admin, personale o temporanea. Con un invito temporaneo ti chiederemo di
              creare la tua password al primo ingresso.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <p className="font-mono text-[11px] tracking-[0.18em] text-neutral-600">
            OMNICORE © 2026
          </p>
          <Link to="/" className="text-[13px] font-medium text-neutral-400 hover:text-white">
            ← Presentazione
          </Link>
        </div>
      </footer>
    </div>
  );
}
