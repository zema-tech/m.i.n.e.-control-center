import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles, User } from "lucide-react";

import { getAuthState, setupAdminProfile, setupOwnPassword } from "@/lib/auth.functions";
import {
  getPasswordChecks,
  passwordScore,
  passwordScoreLabel,
  validateNewPassword,
} from "@/lib/password-policy";
import { PROFILE_ICONS } from "@/components/ProfileAvatar";

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
  const doAdminSetup = useServerFn(setupAdminProfile);
  const doState = useServerFn(getAuthState);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatar, setAvatar] = useState("user");

  useEffect(() => {
    void doState({})
      .then((s) => {
        if (s.authenticated && s.role === "admin") setIsAdmin(true);
      })
      .catch(() => {});
  }, [doState]);

  const checks = useMemo(() => getPasswordChecks(password), [password]);
  const score = useMemo(() => passwordScore(password), [password]);
  const validation = useMemo(() => validateNewPassword(password), [password]);
  const match = password.length > 0 && password === confirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono");
      return;
    }
    setBusy(true);
    setError(null);
    try {
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
    } catch {
      setBusy(false);
      setError("Errore di rete. Riprova.");
    }
  }

  const canSubmit = validation.ok && match && !busy;

  const canAdminSubmit = displayName.trim().length >= 2 && !busy;

  async function onAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdminSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await doAdminSetup({
        data: { displayName: displayName.trim(), avatar },
      });
      setBusy(false);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await router.invalidate();
      await router.navigate({ to: "/home" });
    } catch {
      setBusy(false);
      setError("Errore di rete. Riprova.");
    }
  }

  const scoreColor =
    score <= 1 ? "bg-red-400" : score === 2 ? "bg-amber-300" : score === 3 ? "bg-lime-300" : "bg-emerald-300";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src={LOGIN_BG}
          alt=""
          className="h-full w-full scale-105 object-cover object-[center_20%]"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
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
            {isAdmin ? "Crea il tuo profilo admin" : "Crea la tua password"}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-sky-100/55">
            {isAdmin ? (
              <>
                Hai usato la password admin. Scegli il nome profilo: la password di accesso resta
                quella configurata sul server.
              </>
            ) : (
              <>
                Hai usato un accesso temporaneo. Scegli una password personale: la userai da ora in
                poi per entrare nell&apos;hub.
              </>
            )}
          </p>
        </div>

        {isAdmin ? (
          <form
            onSubmit={onAdminSubmit}
            className="relative space-y-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-8"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
              aria-hidden
            />
            <div className="space-y-2">
              <label
                htmlFor="admin-displayName"
                className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/60"
              >
                <User className="h-3.5 w-3.5 text-sky-300" />
                Nome profilo admin
              </label>
              <input
                id="admin-displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Es. Zema"
                autoFocus
                minLength={2}
                maxLength={40}
                className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/60">
                Avatar
              </p>
              <div className="flex flex-wrap gap-2">
                {PROFILE_ICONS.map((opt) => {
                  const selected = avatar === opt.id;
                  const I = opt.Icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      onClick={() => setAvatar(opt.id)}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                        selected
                          ? "border-sky-300/60 bg-sky-400/15 text-sky-200"
                          : "border-white/10 text-sky-100/45 hover:border-white/20 hover:text-sky-100/80"
                      }`}
                    >
                      {I ? (
                        <I className="h-5 w-5" />
                      ) : (
                        <span className="text-[11px]">
                          {(displayName.trim().charAt(0).toUpperCase() || "?")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
              disabled={!canAdminSubmit}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-sky-300 to-indigo-400 px-4 py-3.5 text-sm font-semibold tracking-wide text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? (
                "Salvataggio…"
              ) : (
                <>
                  Salva profilo ed entra
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        ) : (
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
                placeholder="Minimo 10 caratteri, 3 tra maiuscole/minuscole/numeri/simboli"
                minLength={10}
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
            {password.length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition ${
                        i < score ? scoreColor : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
                <p
                  className={`text-[12px] font-medium ${
                    score <= 1
                      ? "text-red-300"
                      : score === 2
                        ? "text-amber-200"
                        : "text-emerald-200"
                  }`}
                >
                  {passwordScoreLabel(score)}
                </p>
                <ul className="grid grid-cols-2 gap-1 text-[11px]">
                  <li className={checks.length ? "text-emerald-200" : "text-white/35"}>
                    {checks.length ? "✓" : "○"} 10+ caratteri
                  </li>
                  <li className={checks.upper ? "text-emerald-200" : "text-white/35"}>
                    {checks.upper ? "✓" : "○"} Maiuscola
                  </li>
                  <li className={checks.lower ? "text-emerald-200" : "text-white/35"}>
                    {checks.lower ? "✓" : "○"} Minuscola
                  </li>
                  <li className={checks.digit ? "text-emerald-200" : "text-white/35"}>
                    {checks.digit ? "✓" : "○"} Numero
                  </li>
                  <li className={checks.symbol ? "text-emerald-200" : "text-white/35"}>
                    {checks.symbol ? "✓" : "○"} Simbolo
                  </li>
                </ul>
              </div>
            ) : null}
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
              minLength={10}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
            />
            {confirm.length > 0 ? (
              <p className={`text-[12px] ${match ? "text-emerald-200" : "text-red-300"}`}>
                {match ? "✓ Le password coincidono" : "Le password non coincidono"}
              </p>
            ) : null}
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
        )}
      </div>
    </main>
  );
}
