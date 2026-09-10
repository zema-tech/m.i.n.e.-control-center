import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Code2, Network, Palette, Sparkles } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import { AppShell } from "@/components/AppShell";
import { Reveal, Stagger } from "@/components/ScrollReveal";
import { useCountUp, useReveal } from "@/hooks/use-reveal";
import { getAuthState } from "@/lib/auth.functions";
import { loadAgentProfile } from "@/lib/agent-profile";
import { SECTIONS, type SectionId } from "@/lib/section-themes";

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

const SECTION_ICON: Record<SectionId, typeof Sparkles> = {
  jarvis: Sparkles,
  mine: Network,
  design: Palette,
  code: Code2,
};

function StatCount({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const v = useCountUp(target, visible);
  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} text-center`}>
      <p className="font-display text-3xl font-bold tracking-tight text-white">
        {v}
        <span className="text-sky-300">{suffix}</span>
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
    </div>
  );
}

function HomeHub() {
  const [name, setName] = useState("JARVIS");

  useEffect(() => {
    setName(loadAgentProfile().name || "JARVIS");
  }, []);

  return (
    <AppShell title="Hub" subtitle="Scegli il contesto">
      <div className="relative mx-auto max-w-5xl space-y-14 px-5 pb-16 pt-10 sm:pt-14">
        {/* HERO Grok: centrato, barra comando, quick chips */}
        <section className="text-center">
          <Reveal variant="clip">
            <p className="grok-badge">
              <span className="dot" />
              Hub · {name}
            </p>
          </Reveal>
          <Reveal delay={90}>
            <h2 className="mx-auto mt-6 max-w-2xl font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Dove operiamo oggi?
            </h2>
          </Reveal>
          <Reveal delay={170}>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-400">
              Un nucleo, cinque agenti. Scegli un mondo: ognuno ha strumenti e contesto propri.
              L&apos;IA propone, tu confermi.
            </p>
          </Reveal>
          <Reveal delay={250}>
            <Link
              to="/jarvis"
              className="grok-bar group mx-auto mt-9 flex max-w-xl items-center gap-3 p-2.5 pl-5 text-left no-underline"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-neutral-500 transition group-hover:text-sky-300" />
              <span className="flex-1 truncate text-[15px] text-neutral-500">Chiedi a {name}…</span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition group-hover:bg-sky-300">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>
          <Reveal delay={310}>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link to="/mine" className="grok-chip">
                <Network className="h-3.5 w-3.5" />
                Vai a M.I.N.E
              </Link>
              <Link to="/code" className="grok-chip">
                <Code2 className="h-3.5 w-3.5" />
                Apri P.R.O.M.P.T
              </Link>
              <Link to="/design" className="grok-chip">
                <Palette className="h-3.5 w-3.5" />
                Studio A.R.T
              </Link>
            </div>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-y-8 border-y border-white/[0.07] py-7 sm:grid-cols-4">
            <StatCount target={5} suffix="" label="Agenti" />
            <StatCount target={12} suffix="+" label="Integrazioni" />
            <StatCount target={99} suffix="%" label="Dark-first" />
            <StatCount target={24} suffix="/7" label="Operativo" />
          </div>
        </section>

        {/* MONDI */}
        <section>
          <Reveal>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/90">
                  I mondi
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Scegli dove operare
                </h3>
              </div>
              <p className="max-w-sm text-[13px] leading-relaxed text-neutral-500">
                Stesso nucleo, quattro personalità. E.D.I.T per social e content è in arrivo.
              </p>
            </div>
          </Reveal>

          <Stagger className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((s, i) => {
              const Icon = SECTION_ICON[s.id];
              return (
                <Link
                  key={s.id}
                  to={s.href}
                  style={{ "--stagger-i": i } as CSSProperties}
                  className="grok-card group block p-6 no-underline sm:p-7"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grok-icon">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                  </div>
                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    {s.tagline}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-neutral-400">
                    {s.description}
                  </p>
                </Link>
              );
            })}
          </Stagger>
        </section>

        {/* COME FUNZIONA */}
        <section className="grok-surface p-6 sm:p-9">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/90">
              Come funziona
            </p>
            <h3 className="mt-2 max-w-lg font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Proposta → conferma → esecuzione.
            </h3>
            <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-neutral-400">
              Mai azioni critiche senza di te. Tutto resta ispezionabile e reversibile.
            </p>
          </Reveal>
          <Stagger className="mt-7 grid gap-3 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Scegli l'agente",
                d: "JARVIS orchestra, gli altri eseguono nel loro dominio.",
              },
              {
                n: "02",
                t: "Conferma il piano",
                d: "Ogni azione write mostra step e rischi prima del via.",
              },
              {
                n: "03",
                t: "Monitora e itera",
                d: "Log, memoria e connettori restano tracciati e reversibili.",
              },
            ].map((s, i) => (
              <div
                key={s.n}
                style={{ "--stagger-i": i } as CSSProperties}
                className="rounded-2xl border border-white/[0.07] bg-black/40 p-5"
              >
                <p className="font-display text-sm font-bold tracking-[0.2em] text-neutral-600">
                  {s.n}
                </p>
                <p className="mt-3 font-display text-[16px] font-bold tracking-tight text-white">
                  {s.t}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">{s.d}</p>
              </div>
            ))}
          </Stagger>
        </section>
      </div>
    </AppShell>
  );
}
