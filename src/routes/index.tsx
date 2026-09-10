import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  KeyRound,
  Lock,
  Network,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CSSProperties } from "react";

import { Reveal, Stagger } from "@/components/ScrollReveal";
import { getAuthState } from "@/lib/auth.functions";

/**
 * Landing pubblica — stile Grok: nero puro, bianco, bordi sottili,
 * hero centrato con barra d'ingresso, un solo accento azzurro.
 * Nessun redirect: gli autenticati vedono "Apri l'hub".
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Omnicore — Un nucleo, cinque agenti" },
      {
        name: "description",
        content:
          "Omnicore Control Center: orchestra J.A.R.V.I.S, M.I.N.E, P.R.O.M.P.T e A.R.T da un unico hub. L'IA propone, tu confermi.",
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
    desc: "Orchestratore: chat, memoria, regole e connettori. Il cervello del nucleo.",
  },
  {
    icon: Network,
    name: "M.I.N.E",
    role: "Gaming & host",
    desc: "Server Minecraft e Falix: rete, log, power e stato live dell'host.",
  },
  {
    icon: Code2,
    name: "P.R.O.M.P.T",
    role: "Coding agent",
    desc: "Workspace codice: architect, debug e review in stile agentic coding.",
  },
  {
    icon: Palette,
    name: "A.R.T",
    role: "Design & identità",
    desc: "Palette, tipografia, motion e componenti del design system.",
  },
];

const STATS = [
  { v: "5", l: "Agenti specializzati" },
  { v: "4", l: "Mondi operativi" },
  { v: "12+", l: "Integrazioni" },
  { v: "24/7", l: "Sempre operativo" },
];

function PublicLanding() {
  const { authenticated } = Route.useLoaderData();
  const entry = authenticated ? "/home" : "/login";
  const entryLabel = authenticated ? "Apri l'hub" : "Accedi";

  return (
    <div className="grok-page relative overflow-x-clip">
      {/* sfondo: nero puro + glow azzurro tenue in alto + griglia faint */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="grok-glow-top absolute inset-x-0 top-0 h-[560px]" />
        <div className="grok-grid-bg absolute inset-x-0 top-0 h-[720px]" />
      </div>

      {/* nav Grok: wordmark + ancore + CTA */}
      <header className="grok-nav">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2.5 no-underline">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
              <Sparkles className="h-3.5 w-3.5 text-sky-300" />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-white">
              OMNICORE
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-neutral-400 md:flex">
            <a href="#agenti" className="transition hover:text-white">
              Agenti
            </a>
            <a href="#metodo" className="transition hover:text-white">
              Metodo
            </a>
            <a href="#sicurezza" className="transition hover:text-white">
              Sicurezza
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full px-4 py-2 text-[13px] font-medium text-neutral-300 transition hover:text-white sm:inline-flex"
            >
              Accedi
            </Link>
            <Link
              to={entry}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-neutral-200"
            >
              {entryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main id="top" className="relative">
        {/* HERO */}
        <section className="mx-auto max-w-3xl px-5 pb-14 pt-20 text-center sm:pt-28">
          <Reveal variant="clip">
            <p className="grok-badge">
              <span className="dot" />
              Omnicore · Control Center
            </p>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="grok-hero-title mt-6">
              Un nucleo,
              <br />
              <span className="text-neutral-500">cinque agenti.</span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="grok-sub mx-auto mt-6 max-w-xl">
              Orchestra J.A.R.V.I.S, M.I.N.E, P.R.O.M.P.T e A.R.T da un unico hub scuro e
              professionale. L&apos;IA propone, tu confermi.
            </p>
          </Reveal>

          {/* barra d'ingresso stile Grok */}
          <Reveal delay={260}>
            <Link
              to={entry}
              className="grok-bar group mx-auto mt-10 flex max-w-xl items-center gap-3 p-2.5 pl-5 text-left no-underline"
            >
              <Lock className="h-4 w-4 shrink-0 text-neutral-500 transition group-hover:text-sky-300" />
              <span className="flex-1 truncate text-[15px] text-neutral-500">
                {authenticated ? "Torna al tuo hub…" : "Inserisci la password per entrare…"}
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition group-hover:bg-sky-300">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {["J.A.R.V.I.S", "M.I.N.E", "P.R.O.M.P.T", "A.R.T", "E.D.I.T"].map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-white/[0.07] px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-neutral-500"
                >
                  {a}
                </span>
              ))}
            </div>
          </Reveal>
        </section>

        {/* stats minimal con divisori */}
        <section className="mx-auto max-w-5xl px-5">
          <Reveal>
            <dl className="grid grid-cols-2 gap-y-8 border-y border-white/[0.07] py-8 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.l} className="text-center">
                  <dt className="sr-only">{s.l}</dt>
                  <dd className="font-display text-3xl font-bold tracking-tight text-white">
                    {s.v}
                  </dd>
                  <dd className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                    {s.l}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* AGENTI */}
        <section id="agenti" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-20 sm:py-24">
          <Reveal>
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/90">
              Gli agenti
            </p>
            <h2 className="mx-auto mt-3 max-w-xl text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Quattro mondi, un solo nucleo.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[15px] leading-relaxed text-neutral-400">
              Ogni agente ha il suo dominio. E.D.I.T per social e content è in arrivo.
            </p>
          </Reveal>
          <Stagger className="mt-10 grid gap-3 sm:grid-cols-2">
            {AGENTS.map((a, i) => (
              <Link
                key={a.name}
                to={entry}
                style={{ "--stagger-i": i } as CSSProperties}
                className="grok-card group block p-6 no-underline sm:p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grok-icon">
                    <a.icon className="h-4.5 w-4.5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                </div>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {a.role}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white">
                  {a.name}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-neutral-400">{a.desc}</p>
              </Link>
            ))}
          </Stagger>
        </section>

        <div className="grok-divider mx-auto max-w-5xl" />

        {/* METODO */}
        <section id="metodo" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-20 sm:py-24">
          <Reveal>
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/90">
              Metodo
            </p>
            <h2 className="mx-auto mt-3 max-w-xl text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Proposta, conferma, esecuzione.
            </h2>
          </Reveal>
          <Stagger className="mt-10 grid gap-3 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Scegli l'agente",
                d: "J.A.R.V.I.S orchestra, gli altri eseguono nel loro dominio specializzato.",
              },
              {
                n: "02",
                t: "Conferma il piano",
                d: "Ogni azione write mostra step e rischi prima del via. Mai nulla di critico senza di te.",
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
                className="grok-card p-6"
              >
                <p className="font-display text-sm font-bold tracking-[0.2em] text-neutral-600">
                  {s.n}
                </p>
                <p className="mt-3 font-display text-[17px] font-bold tracking-tight text-white">
                  {s.t}
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-neutral-400">{s.d}</p>
              </div>
            ))}
          </Stagger>
        </section>

        <div className="grok-divider mx-auto max-w-5xl" />

        {/* SICUREZZA */}
        <section id="sicurezza" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-20 sm:py-24">
          <Reveal>
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/90">
              Sicurezza
            </p>
            <h2 className="mx-auto mt-3 text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Personale, per davvero.
            </h2>
          </Reveal>
          <Stagger className="mt-10 space-y-3">
            {[
              {
                icon: ShieldCheck,
                t: "L'IA propone, tu confermi",
                d: "Nessuna azione write o critica senza approvazione umana esplicita.",
              },
              {
                icon: KeyRound,
                t: "BYOK — le chiavi restano tue",
                d: "Groq, Falix e altri servizi si configurano nelle impostazioni. Mai hardcodate.",
              },
              {
                icon: Lock,
                t: "Sessioni protette",
                d: "Password con hash bcrypt, JWT firmati, rate-limit e binding IP opzionale.",
              },
            ].map((r, i) => (
              <div
                key={r.t}
                style={{ "--stagger-i": i } as CSSProperties}
                className="grok-card flex items-start gap-4 p-5 sm:p-6"
              >
                <span className="grok-icon shrink-0">
                  <r.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-display text-[16px] font-bold tracking-tight text-white">
                    {r.t}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-neutral-400">{r.d}</p>
                </div>
              </div>
            ))}
          </Stagger>

          {/* CTA */}
          <Reveal className="mt-14 text-center">
            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Entra nel tuo Control Center.
            </h3>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to={entry} className="btn-grok-primary">
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

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6">
          <p className="font-display text-[13px] font-bold tracking-tight text-white">
            OMNICORE <span className="font-normal text-neutral-600">© 2026</span>
          </p>
          <p className="font-mono text-[11px] tracking-[0.14em] text-neutral-600">
            REPO PERSONALE · DARK-FIRST · IT
          </p>
          <Link to="/login" className="text-[13px] font-medium text-neutral-400 hover:text-white">
            Accedi →
          </Link>
        </div>
      </footer>
    </div>
  );
}
