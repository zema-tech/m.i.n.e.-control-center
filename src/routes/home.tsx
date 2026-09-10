import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Boxes, Cpu, Layers, Zap } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import { AppShell } from "@/components/AppShell";
import { Reveal, Stagger } from "@/components/ScrollReveal";
import { useCountUp, useParallax, useReveal } from "@/hooks/use-reveal";
import { getAuthState } from "@/lib/auth.functions";
import { loadAgentProfile } from "@/lib/agent-profile";
import { SECTIONS } from "@/lib/section-themes";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — Omnicore" },
      { name: "description", content: "Hub Omnicore: JARVIS, M.I.N.E, Design, Code." },
    ],
  }),
  loader: async () => {
    try {
      const state = await getAuthState();
      if (!state.authenticated) throw redirect({ to: "/login" });
      if (state.mustSetPassword) throw redirect({ to: "/setup-password" });
    } catch (e) {
      if (e instanceof Response) throw e;
      throw redirect({ to: "/login" });
    }
    return null;
  },
  component: HomeHub,
});

const MARQUEE = ["J.A.R.V.I.S", "M.I.N.E", "P.R.O.M.P.T", "A.R.T", "E.D.I.T", "OMNICORE"];

function StatCount({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const v = useCountUp(target, visible);
  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""}`}>
      <p className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {v}
        <span className="logo-gradient">{suffix}</span>
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function HomeHub() {
  const [name, setName] = useState("JARVIS");
  const heroParallax = useParallax<HTMLDivElement>(0.1);

  useEffect(() => {
    setName(loadAgentProfile().name || "JARVIS");
  }, []);

  const cards = SECTIONS;

  return (
    <AppShell title="Hub" subtitle="Scegli il contesto">
      <div className="relative mx-auto max-w-6xl space-y-16 px-4 pb-16 sm:px-6">
        {/* HERO scrollcraft — full viewport, clip reveal, parallax bg */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
          <div
            ref={heroParallax}
            className="parallax-bg pointer-events-none absolute inset-0"
            aria-hidden
          >
            <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-primary/20 blur-[110px]" />
            <div className="absolute bottom-0 right-10 h-56 w-56 rounded-full bg-violet-500/15 blur-[100px]" />
          </div>

          <div className="relative px-6 py-14 sm:px-12 sm:py-20">
            <Reveal variant="clip">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Zap className="h-3 w-3" />
                Omnicore · Control Center
              </p>
            </Reveal>
            <h2 className="text-hero hero-clip mt-5 max-w-3xl text-foreground">
              <span className="logo-gradient gradient-pan">{name}</span>
              <br />
              un nucleo,
              <br />
              cinque agenti.
            </h2>
            <Reveal delay={150}>
              <p className="text-lead mt-5 max-w-xl">
                Orchestra JARVIS, M.I.N.E, P.R.O.M.P.T e A.R.T da un unico hub scuro e cinematico.
                L&apos;IA propone, tu confermi.
              </p>
            </Reveal>
            <Reveal delay={250}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/jarvis"
                  className="btn-primary group inline-flex items-center gap-2 px-5 py-3 text-sm"
                >
                  Apri JARVIS
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/mine"
                  className="btn-matrix inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-foreground hover:border-primary/40"
                >
                  <Boxes className="h-4 w-4 text-primary" />
                  Vai a M.I.N.E
                </Link>
                <span className="ml-1 hidden items-center gap-3 sm:flex">
                  <span className="scroll-hint" aria-hidden>
                    <span />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Scorri
                  </span>
                </span>
              </div>
            </Reveal>

            {/* stats con count-up on scroll */}
            <div className="mt-12 grid grid-cols-2 gap-6 border-t border-white/[0.06] pt-8 sm:grid-cols-4">
              <StatCount target={5} suffix="" label="Agenti" />
              <StatCount target={12} suffix="+" label="Integrazioni" />
              <StatCount target={99} suffix="%" label="Dark-first" />
              <StatCount target={24} suffix="/7" label="Operativo" />
            </div>
          </div>

          {/* marquee brand */}
          <div className="marquee relative border-t border-white/[0.06] py-3">
            <div className="marquee-track font-display text-[12px] font-bold uppercase tracking-[0.3em] text-muted-foreground/70">
              {[...MARQUEE, ...MARQUEE].map((m, i) => (
                <span key={i} className="flex items-center gap-10">
                  {m} <Cpu className="h-3 w-3 text-primary/60" />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* MONDI — stagger reveal + shine */}
        <section>
          <Reveal>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-section flex items-center gap-2 text-primary">
                  <Layers className="h-3.5 w-3.5" /> I mondi
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Scegli dove operare
                </h3>
              </div>
              <p className="max-w-sm text-caption">
                Ogni sezione ha tema, orb e accento propri. Stesso nucleo, quattro personalità.
              </p>
            </div>
          </Reveal>

          <Stagger className="grid gap-4 sm:grid-cols-2">
            {cards.map((s, i) => (
              <Link
                key={s.id}
                to={s.href}
                style={{ "--stagger-i": i } as CSSProperties}
                className={`section-card section-card-${s.id} card-shine group no-underline`}
              >
                <div className="section-card-glow" />
                <div className="relative z-[1] flex h-full min-h-[220px] flex-col p-6 sm:p-7">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        {s.tagline}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                        {s.title}
                      </h3>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="flex-1 text-[13px] leading-relaxed text-white/60">
                    {s.description}
                  </p>
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                    {s.colors}
                  </p>
                </div>
              </Link>
            ))}
          </Stagger>
        </section>

        {/* HOW — timeline scroll-driven */}
        <section className="glass-strong grain relative overflow-hidden rounded-3xl p-6 sm:p-10">
          <Reveal>
            <p className="text-section text-primary">Come funziona</p>
            <h3 className="mt-2 max-w-lg font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Proposta → conferma → esecuzione. Mai azioni critiche senza di te.
            </h3>
          </Reveal>
          <Stagger className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Scegli l'agente",
                d: "JARVIS orchestra, gli altri eseguono nel loro dominio.",
              },
              {
                n: "02",
                t: "Conferma il piano",
                d: "Ogni azione write mostra step, diff e rischi prima del via.",
              },
              {
                n: "03",
                t: "Monitora e itera",
                d: "Log, memoria e connettori restano ispezionabili e reversibili.",
              },
            ].map((s, i) => (
              <div
                key={s.n}
                style={{ "--stagger-i": i } as CSSProperties}
                className="card-interactive rounded-2xl border border-white/[0.07] bg-black/30 p-5"
              >
                <p className="logo-gradient font-display text-4xl font-extrabold">{s.n}</p>
                <p className="mt-3 font-semibold">{s.t}</p>
                <p className="mt-1.5 text-caption">{s.d}</p>
              </div>
            ))}
          </Stagger>
        </section>
      </div>
    </AppShell>
  );
}
