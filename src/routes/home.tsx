import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Code2,
  Network,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
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
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    if (state.mustSetPassword) throw redirect({ to: "/setup-password" });
    return null;
  },
  component: HomeHub,
});

function HomeHub() {
  const [name, setName] = useState("JARVIS");

  useEffect(() => {
    setName(loadAgentProfile().name || "JARVIS");
  }, []);

  const cards = SECTIONS.filter((s) => s.href !== "/edit");
  const sectionIcons: Record<SectionId, typeof Sparkles> = {
    jarvis: BrainCircuit,
    edit: Sparkles,
    mine: Network,
    prompt: Code2,
    art: Palette,
  };

  return (
    <AppShell title="Control center" subtitle="Panoramica operativa">
      <div className="relative mx-auto max-w-6xl space-y-9 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <section className="hub-hero animate-fade-in-up">
          <div className="relative z-[1] max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Omnicore intelligence
              </span>
              <span className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Sistemi operativi
              </span>
            </div>

            <h2 className="max-w-2xl font-display text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-foreground sm:text-5xl">
              Tutto il tuo ecosistema,
              <span className="logo-gradient block">un solo centro di comando.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-[14px] leading-7 text-muted-foreground sm:text-[15px]">
              Coordina agenti, infrastruttura e strumenti da uno spazio progettato per lavorare con
              chiarezza. <span className="font-medium text-foreground/80">{name}</span> è pronto a
              orchestrare il prossimo obiettivo.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/assistant"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm no-underline"
              >
                Avvia una conversazione
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pulse"
                className="btn-matrix inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-sm text-foreground no-underline hover:border-primary/25 hover:bg-primary/[0.06]"
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                Stato del sistema
              </Link>
            </div>
          </div>

          <div className="hub-hero-orbit" aria-hidden>
            <div className="hub-orbit hub-orbit-outer" />
            <div className="hub-orbit hub-orbit-inner" />
            <div className="hub-orbit-core">
              <BrainCircuit className="h-8 w-8" />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] shadow-card sm:grid-cols-4">
          {[
            ["04", "ambienti attivi"],
            ["01", "nucleo centrale"],
            ["24/7", "disponibilità"],
            ["Sicuro", "conferma umana"],
          ].map(([value, label]) => (
            <div key={label} className="bg-card/90 px-4 py-4 sm:px-5">
              <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                {value}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-section text-primary">Ambienti specializzati</p>
              <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                Scegli il contesto di lavoro
              </h2>
            </div>
            <p className="hidden max-w-xs text-right text-xs leading-relaxed text-muted-foreground sm:block">
              Ogni ambiente mantiene strumenti e identità dedicati.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((s, i) => {
              const Icon = sectionIcons[s.id];
              return (
                <Link
                  key={s.id}
                  to={s.href}
                  className={`section-card section-card-${s.id} group animate-fade-in-up no-underline`}
                  style={{ animationDelay: `${80 + i * 60}ms` }}
                >
                  <div className="section-card-glow" />
                  <div className="section-card-grid" />
                  <div className="relative z-[1] flex h-full flex-col p-5 sm:p-6">
                    <div className="mb-7 flex items-start justify-between gap-3">
                      <span className="section-card-icon">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.15em] text-white/30">
                        0{i + 1}
                      </span>
                    </div>

                    <div className="mt-auto">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/45">
                        {s.tagline}
                      </p>
                      <h3 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {s.title}
                      </h3>
                      <p className="mt-2 max-w-md text-[12px] leading-relaxed text-white/55 sm:text-[13px]">
                        {s.description}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
                        <span className="text-[10px] font-medium uppercase tracking-[0.11em] text-white/35">
                          {s.colors}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-white/75 transition-colors group-hover:text-white">
                          Apri
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
