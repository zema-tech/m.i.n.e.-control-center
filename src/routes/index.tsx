import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Code2,
  EyeOff,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Lock,
  Mic,
  Network,
  Palette,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCheck,
  Zap,
} from "lucide-react";
import type { CSSProperties } from "react";

import { Reveal, Stagger } from "@/components/ScrollReveal";
import { useCountUp, useParallax, useReveal } from "@/hooks/use-reveal";
import { getAuthState } from "@/lib/auth.functions";

/**
 * Landing Hermes Agent — ScrollCraft + ui-ux-pro-max.
 * Cielo azzurro chiaro → nero, serif Cormorant + Sora/Manrope,
 * reveal/parallax/marquee, sezioni sicurezza secondo VibeSec.
 * Nessun input utente riflesso: nessun rischio XSS. Solo Link interni.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Omnicore — Un nucleo, cinque agenti" },
      {
        name: "description",
        content:
          "Omnicore Control Center in stile Hermes Agent: orchestra J.A.R.V.I.S, M.I.N.E, P.R.O.M.P.T e A.R.T da un unico hub. L'IA propone, tu confermi.",
      },
    ],
  }),
  loader: async () => {
    try {
      const s = await getAuthState();
      return { authenticated: s.authenticated };
    } catch {
      return { authenticated: false };
    }
  },
  component: PublicLanding,
});

const AGENTS = [
  {
    icon: Sparkles,
    name: "J.A.R.V.I.S",
    role: "IA principale",
    desc: "Orchestratore con voce, memoria e piani confermati. Chat, file, progetti e tool MCP in un workspace.",
    tag: "Chat · Voce · Piani",
  },
  {
    icon: Network,
    name: "M.I.N.E",
    role: "Gaming & host",
    desc: "Server Minecraft e Falix: rete, log, power e stato live dell'host, sempre sotto controllo.",
    tag: "Host · Rete · Live",
  },
  {
    icon: Code2,
    name: "P.R.O.M.P.T",
    role: "Coding agent",
    desc: "Workspace codice agentic: architect, debug e review con contesto profondo sul tuo repo.",
    tag: "Code · Review · Debug",
  },
  {
    icon: Palette,
    name: "A.R.T",
    role: "Design & identità",
    desc: "Palette, tipografia Hermes, motion e componenti. Il design system del Control Center.",
    tag: "Token · Type · Motion",
  },
];

const SECURITY = [
  {
    icon: ShieldCheck,
    t: "L'IA propone, tu confermi",
    d: "Nessuna azione write o critica senza approvazione esplicita. I piani MCP restano in attesa finché non premi Esegui.",
  },
  {
    icon: KeyRound,
    t: "BYOK — chiavi mai hardcodate",
    d: "Groq, Falix e GitHub via env o vault personale. Niente segreti nel bundle client, niente log di token.",
  },
  {
    icon: Lock,
    t: "Password e sessioni blindate",
    d: "Hash bcrypt, JWT brevi firmati, cookie HttpOnly + SameSite=Lax (+Secure su https) e binding IP opzionale.",
  },
  {
    icon: Timer,
    t: "Rate-limit e ban progressivi",
    d: "Secchi per IP + secchio globale, pausa dopo i fallimenti e ban 24h contro brute-force. Tentativi residui sempre visibili.",
  },
  {
    icon: Fingerprint,
    t: "Max 3 IP per credenziale",
    d: "Ogni password si lega ai primi 3 IP che la usano. Furto di password da altra rete = accesso rifiutato e audit.",
  },
  {
    icon: FileCheck2,
    t: "Audit trail ispezionabile",
    d: "Login, tentativi, ban e azioni critiche registrati in memoria eventi. Tutto tracciato, niente scatole nere.",
  },
];

const ACCESS = [
  {
    icon: UserCheck,
    t: "Admin",
    d: "Profilo + tutti i permessi, inviti temporanei, binding IP e log. Crea membri in un tap.",
  },
  {
    icon: EyeOff,
    t: "Membro",
    d: "Password personale da 10+ caratteri con policy forte. Vede solo i mondi assegnati dai permessi.",
  },
  {
    icon: Zap,
    t: "Ospite temporaneo",
    d: "Invito single-use da 1h a 7 giorni, max usi configurabile. Al primo ingresso crea la sua password.",
  },
];

const JARVIS_POINTS = [
  {
    icon: Mic,
    t: "Dettatura vocale it-IT",
    d: "Parla, Jarvis trascrive nel box. Stato live e stop sicuro allo smontaggio.",
  },
  {
    icon: Brain,
    t: "Memoria e contesto file",
    d: "Progetti, istruzioni e snippet rilevanti iniettati nel prompt. Niente disco OS, solo workspace isolato.",
  },
  {
    icon: FileCheck2,
    t: "Piani con conferma umana",
    d: "Multi-step con tool list_files, search, create_file e report CSV. mcp_call sempre con conferma.",
  },
];

function StatCount({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const v = useCountUp(target, visible);
  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} text-center`}>
      <p className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {v}
        <span className="hermes-gradient-text">{suffix}</span>
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300/70">
        {label}
      </p>
    </div>
  );
}

function PublicLanding() {
  const { authenticated } = Route.useLoaderData();
  const entry = authenticated ? "/home" : "/login";
  const entryLabel = authenticated ? "Apri l'hub" : "Accedi";
  const parallax = useParallax<HTMLDivElement>(0.08);

  return (
    <div className="hermes-page relative overflow-x-clip">
      {/* Cielo: azzurro chiaro → azzurro → notte → nero */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="hermes-sky absolute inset-x-0 top-0 h-[980px]" />
        <div ref={parallax} className="parallax-bg absolute inset-x-0 top-0 h-[980px]">
          <div className="hermes-grid absolute inset-0" />
        </div>
        <div className="hermes-orb left-[8%] top-[120px] h-[300px] w-[300px] bg-sky-200/40" />
        <div className="hermes-orb right-[6%] top-[260px] h-[240px] w-[240px] bg-sky-400/25 [animation-delay:-6s]" />
        <div className="hermes-orb left-[42%] top-[420px] h-[200px] w-[200px] bg-cyan-100/20 [animation-delay:-11s]" />
        <div className="hermes-night-fade absolute inset-x-0 top-[480px] h-[520px]" />
        <div className="grain absolute inset-0" />
      </div>

      {/* Nav Hermes */}
      <header className="grok-nav">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-3 no-underline">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur">
              <Sparkles className="h-4 w-4 text-sky-200" />
            </span>
            <span className="leading-none">
              <span className="font-hermes block text-[19px] font-medium tracking-[0.22em] text-white">
                OMNICORE
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.32em] text-sky-200/70">
                Hermes Agent
              </span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-300/80 md:flex">
            <a href="#agenti" className="transition hover:text-white">
              Agenti
            </a>
            <a href="#jarvis" className="transition hover:text-white">
              Jarvis
            </a>
            <a href="#metodo" className="transition hover:text-white">
              Metodo
            </a>
            <a href="#sicurezza" className="transition hover:text-white">
              Sicurezza
            </a>
            <a href="#accessi" className="transition hover:text-white">
              Accessi
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full px-4 py-2 text-[13px] font-medium text-slate-300 transition hover:text-white sm:inline-flex"
            >
              Accedi
            </Link>
            <Link to={entry} className="btn-grok-primary">
              {entryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main id="top" className="relative">
        {/* HERO ScrollCraft */}
        <section className="mx-auto max-w-4xl px-5 pb-12 pt-16 text-center sm:pt-24">
          <Reveal variant="clip">
            <p className="hermes-badge">
              <span className="dot" />
              Omnicore · Hermes Agent Edition
            </p>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="hermes-title mt-7 text-[clamp(3rem,8vw,5.8rem)] text-white">
              Un nucleo,
              <br />
              <span className="hermes-gradient-text italic">cinque agenti.</span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="hermes-eyebrow mt-6">Atelier · Controllo · Intelligenza</p>
            <p className="grok-sub mx-auto mt-4 max-w-xl !text-slate-200/85">
              Orchestra J.A.R.V.I.S, M.I.N.E, P.R.O.M.P.T e A.R.T da un unico hub scuro e
              sartoriale. L&apos;IA propone, tu confermi — sempre.
            </p>
          </Reveal>

          <Reveal delay={260}>
            <Link
              to={entry}
              className="hermes-input-bar group mx-auto mt-10 flex max-w-xl items-center gap-3 p-2.5 pl-5 text-left no-underline"
            >
              <Lock className="h-4 w-4 shrink-0 text-sky-200/70 transition group-hover:text-sky-100" />
              <span className="flex-1 truncate text-[15px] text-slate-300">
                {authenticated ? "Torna al tuo hub…" : "Inserisci la password per entrare…"}
              </span>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-sky-100 to-sky-300 text-black transition group-hover:from-white group-hover:to-sky-200">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-7 flex items-center justify-center gap-3">
              <div className="scroll-hint" aria-hidden>
                <span />
              </div>
              <p className="font-mono text-[11px] tracking-[0.22em] text-slate-300/60">
                SCORRI — IL CIELO DIVENTA NOTTE
              </p>
            </div>
          </Reveal>
        </section>

        {/* Marquee agenti */}
        <div className="marquee relative py-4" aria-hidden>
          <div className="marquee-track">
            {[
              ...["J.A.R.V.I.S", "M.I.N.E", "P.R.O.M.P.T", "A.R.T", "E.D.I.T"],
              ...["J.A.R.V.I.S", "M.I.N.E", "P.R.O.M.P.T", "A.R.T", "E.D.I.T"],
            ].map((a, i) => (
              <span
                key={`${a}-${i}`}
                className="font-hermes text-[22px] tracking-[0.28em] text-white/25"
              >
                {a} <span className="ml-8 text-sky-300/50">·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Stats animate */}
        <section className="mx-auto max-w-6xl px-5">
          <Reveal>
            <dl className="grid grid-cols-2 gap-y-8 border-y border-white/10 py-8 sm:grid-cols-4">
              <StatCount target={5} suffix="" label="Agenti specializzati" />
              <StatCount target={4} suffix="" label="Mondi operativi" />
              <StatCount target={12} suffix="+" label="Integrazioni" />
              <StatCount target={24} suffix="/7" label="Sempre operativo" />
            </dl>
          </Reveal>
        </section>

        {/* AGENTI */}
        <section id="agenti" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-24">
          <Reveal>
            <p className="hermes-eyebrow text-center">Gli agenti</p>
            <h2 className="hermes-title mx-auto mt-4 max-w-2xl text-center text-4xl text-white sm:text-5xl">
              Quattro mondi, <span className="hermes-gradient-text italic">un solo nucleo.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-center text-[15px] leading-relaxed text-slate-300/75">
              Ogni agente ha il suo dominio. E.D.I.T per social e content è in arrivo nel sarto.
            </p>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2">
            {AGENTS.map((a, i) => (
              <Link
                key={a.name}
                to={entry}
                style={{ "--stagger-i": i } as CSSProperties}
                className="hermes-card group block p-6 no-underline sm:p-8"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grok-icon !h-11 !w-11">
                    <a.icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                </div>
                <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-sky-200/70">
                  {a.tag}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {a.role}
                </p>
                <h3 className="font-hermes mt-1 text-[28px] font-medium tracking-wide text-white">
                  {a.name}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-300/80">{a.desc}</p>
              </Link>
            ))}
          </Stagger>
        </section>

        <div className="hermes-divider mx-auto max-w-6xl" />

        {/* JARVIS IN AZIONE — nuova sezione */}
        <section id="jarvis" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal variant="left">
              <p className="hermes-eyebrow">Jarvis dal vivo</p>
              <h2 className="hermes-title mt-4 text-4xl text-white sm:text-5xl">
                Parla. <span className="hermes-gradient-text italic">Lui prepara il piano.</span>
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-300/80">
                Dettatura vocale, file di contesto e tool locali. Se serve GitHub via MCP, il piano
                resta in attesa della tua conferma. Mai esecuzioni a sorpresa.
              </p>
              <div className="mt-7 space-y-3">
                {JARVIS_POINTS.map((f) => (
                  <div key={f.t} className="flex items-start gap-3.5">
                    <span className="grok-icon shrink-0">
                      <f.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold tracking-tight text-white">{f.t}</p>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-400">{f.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={entry} className="btn-grok-primary">
                  Apri Jarvis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#sicurezza" className="btn-grok-ghost no-underline">
                  Perché è sicuro
                </a>
              </div>
            </Reveal>
            <Reveal variant="right" delay={120}>
              <div className="hermes-login-card overflow-hidden p-2">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-sky-200/70">
                    J.A.R.V.I.S · LIVE
                  </p>
                  <span className="hermes-typing flex gap-1" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
                <div className="hermes-jarvis-line mx-4" />
                <div className="space-y-3 p-4">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl bg-sky-400/80 px-4 py-3 text-[13.5px] leading-relaxed text-black">
                      Riordina le fatture di gennaio e prepara un report CSV
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-[13.5px] leading-relaxed text-slate-100">
                    <span className="font-hermes text-[16px] italic text-sky-100">
                      Piano: Report fatture gennaio
                    </span>
                    <br />
                    <span className="text-slate-300">
                      ○ [search_files] Cerca riferimenti fatture
                      <br />○ [generate_csv_report] Report mensile
                    </span>
                    <br />
                    <span className="mt-1 inline-block rounded-full border border-sky-300/30 bg-sky-300/10 px-2.5 py-1 text-[11px] text-sky-100">
                      In attesa di conferma — premi Esegui in Jarvis
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <Mic className="h-4 w-4 text-sky-200/70" />
                    <p className="flex-1 text-[13px] text-slate-500">
                      Scrivi o detta… (Agente: piano + tool)
                    </p>
                    <span className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black">
                      Invia
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <div className="hermes-divider mx-auto max-w-6xl" />

        {/* METODO */}
        <section id="metodo" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-24">
          <Reveal>
            <p className="hermes-eyebrow text-center">Metodo Hermes</p>
            <h2 className="hermes-title mx-auto mt-4 max-w-xl text-center text-4xl text-white sm:text-5xl">
              Proposta, conferma, <span className="hermes-gradient-text italic">esecuzione.</span>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Scegli l'agente",
                d: "J.A.R.V.I.S orchestra, gli altri eseguono nel loro dominio specializzato.",
              },
              {
                n: "02",
                t: "Conferma il piano",
                d: "Ogni azione write mostra step, file toccati e rischi prima del via.",
              },
              {
                n: "03",
                t: "Monitora e itera",
                d: "Log, memoria e connettori restano ispezionabili, tracciati e reversibili.",
              },
            ].map((s, i) => (
              <div
                key={s.n}
                style={{ "--stagger-i": i } as CSSProperties}
                className="hermes-card p-6 sm:p-7"
              >
                <p className="font-hermes text-[26px] italic text-sky-200/60">{s.n}</p>
                <p className="mt-3 font-display text-[17px] font-bold tracking-tight text-white">
                  {s.t}
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-300/75">{s.d}</p>
              </div>
            ))}
          </Stagger>
        </section>

        <div className="hermes-divider mx-auto max-w-6xl" />

        {/* SICUREZZA — VibeSec */}
        <section id="sicurezza" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-24">
          <Reveal>
            <p className="hermes-eyebrow text-center">Sicurezza · VibeSec</p>
            <h2 className="hermes-title mx-auto mt-4 max-w-2xl text-center text-4xl text-white sm:text-5xl">
              Personale, <span className="hermes-gradient-text italic">per davvero.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-slate-300/75">
              Difesa in profondità: validazione server, output codificato, segreti mai nel client,
              redirect solo interni.
            </p>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((r, i) => (
              <div
                key={r.t}
                style={{ "--stagger-i": i } as CSSProperties}
                className="hermes-card p-6"
              >
                <span className="grok-icon">
                  <r.icon className="h-4 w-4" />
                </span>
                <p className="mt-5 font-display text-[16px] font-bold tracking-tight text-white">
                  {r.t}
                </p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-300/75">{r.d}</p>
              </div>
            ))}
          </Stagger>
        </section>

        <div className="hermes-divider mx-auto max-w-6xl" />

        {/* ACCESSI — nuova sezione */}
        <section id="accessi" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-24">
          <Reveal>
            <p className="hermes-eyebrow text-center">Accessi e ruoli</p>
            <h2 className="hermes-title mx-auto mt-4 max-w-xl text-center text-4xl text-white sm:text-5xl">
              Tre chiavi, <span className="hermes-gradient-text italic">una serratura.</span>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
            {ACCESS.map((a, i) => (
              <div
                key={a.t}
                style={{ "--stagger-i": i } as CSSProperties}
                className="hermes-card p-6 sm:p-7"
              >
                <span className="grok-icon">
                  <a.icon className="h-4 w-4" />
                </span>
                <p className="font-hermes mt-5 text-[24px] font-medium tracking-wide text-white">
                  {a.t}
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-300/75">{a.d}</p>
              </div>
            ))}
          </Stagger>

          <Reveal className="mt-16 text-center">
            <h3 className="hermes-title text-3xl text-white sm:text-4xl">
              Entra nel tuo <span className="hermes-gradient-text italic">Control Center.</span>
            </h3>
            <p className="mx-auto mt-3 max-w-md text-[14px] text-slate-400">
              Password, Turnstile umano e Jarvis che ti aspetta dietro la porta.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to={entry} className="btn-grok-primary !px-7 !py-3.5">
                {entryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#agenti" className="btn-grok-ghost no-underline">
                Scopri gli agenti
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
          <p className="font-hermes text-[16px] tracking-[0.22em] text-white">
            OMNICORE{" "}
            <span className="font-sans text-[12px] font-normal tracking-normal text-slate-500">
              © 2026 · Hermes Agent
            </span>
          </p>
          <p className="font-mono text-[11px] tracking-[0.18em] text-slate-500">
            AZZURRO → NERO · DARK-FIRST · IT
          </p>
          <Link to="/login" className="text-[13px] font-medium text-slate-300 hover:text-white">
            Accedi →
          </Link>
        </div>
      </footer>
    </div>
  );
}
