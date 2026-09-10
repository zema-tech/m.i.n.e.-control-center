import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Activity, KeyRound, Network, Server, Terminal, Zap } from "lucide-react";
import type { CSSProperties } from "react";

import { AppShell } from "@/components/AppShell";
import { CreeperMascot } from "@/components/CreeperMascot";
import { Reveal, Stagger } from "@/components/ScrollReveal";
import { useParallax } from "@/hooks/use-reveal";
import { getAuthState } from "@/lib/auth.functions";

export const Route = createFileRoute("/mine")({
  head: () => ({
    meta: [{ title: "M.I.N.E — Host Minecraft" }],
  }),
  loader: async () => {
    try {
      const state = await getAuthState();
      if (!state.authenticated) throw redirect({ to: "/login" });
    } catch (e) {
      if (e instanceof Response) throw e;
      throw redirect({ to: "/login" });
    }
    return null;
  },
  component: MineSection,
});

const LINKS = [
  {
    to: "/network" as const,
    title: "Rete neurale",
    blurb: "Come l'IA legge stati e log del server",
    icon: Network,
  },
  {
    to: "/hosts" as const,
    title: "Host",
    blurb: "Falix, Koyeb e provider — cambia host e API",
    icon: Server,
  },
  {
    to: "/skills" as const,
    title: "Competenze",
    blurb: "Account Falix, chiavi, storage",
    icon: KeyRound,
  },
];

function MineSection() {
  const heroParallax = useParallax<HTMLDivElement>(0.12);

  return (
    <AppShell title="M.I.N.E" subtitle="Host Minecraft · nero e verde · mascotte Creeper">
      <CreeperMascot />
      <div className="mx-auto max-w-5xl space-y-10 px-4 pb-14 pt-6 sm:px-6">
        {/* HERO cinematico */}
        <section className="glass-strong grain relative overflow-hidden rounded-3xl">
          <div className="hero-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <div
            ref={heroParallax}
            className="parallax-bg pointer-events-none absolute inset-0"
            aria-hidden
          >
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-400/25 blur-[110px]" />
            <div className="absolute bottom-0 left-1/4 h-40 w-72 rounded-full bg-green-600/20 blur-[100px]" />
          </div>

          <div className="relative p-6 sm:p-10">
            <Reveal variant="clip">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-400/90">
                <Terminal className="h-3.5 w-3.5" />
                Minecraft Intelligent Network Engine
              </p>
            </Reveal>
            <h2 className="text-hero hero-clip mt-3">
              <span className="bg-gradient-to-r from-emerald-200 via-green-400 to-lime-300 bg-clip-text text-transparent">
                M.I.N.E
              </span>
            </h2>
            <Reveal delay={140}>
              <p className="text-lead mt-4 max-w-xl">
                Controllo server, rete neurale, log e power. Il Creeper verde è la mascotte: toccalo
                o trascinalo — attento…
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Server monitorato
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground">
                  <Activity className="h-3 w-3 text-emerald-300" /> Log · Power · Rete
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-muted-foreground">
                  <Zap className="h-3 w-3 text-lime-300" /> Falix live
                </span>
              </div>
            </Reveal>
          </div>

          <div className="marquee relative border-t border-white/[0.06] py-2.5">
            <div className="marquee-track font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-200/50">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i}>M.I.N.E · HOST · RETE · POWER · LOG ·</span>
              ))}
            </div>
          </div>
        </section>

        {/* LINKS con stagger */}
        <Stagger className="grid gap-4 sm:grid-cols-3">
          {LINKS.map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              style={{ "--stagger-i": i } as CSSProperties}
              className="card-shine card-interactive group flex h-full flex-col rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 no-underline backdrop-blur-md"
            >
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 transition-transform duration-300 group-hover:scale-110">
                <l.icon className="h-5 w-5 text-emerald-300" />
              </span>
              <span className="font-display text-base font-bold tracking-tight text-foreground">
                {l.title}
              </span>
              <span className="mt-1.5 text-caption">{l.blurb}</span>
              <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/80 transition group-hover:text-emerald-200">
                Apri →
              </span>
            </Link>
          ))}
        </Stagger>

        {/* TIMELINE operativa */}
        <Reveal>
          <section className="panel-spacious">
            <p className="text-label">Pipeline operativa</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                ["01", "Stato live", "Query Falix + fallback demo"],
                ["02", "Log neurale", "Lettura IA di crash e lag"],
                ["03", "Power", "Restart e power sicuri"],
                ["04", "Host", "Cambia provider senza down"],
              ].map(([n, t, d]) => (
                <div key={n} className="rounded-xl border border-white/[0.06] bg-black/25 p-4">
                  <p className="font-mono text-[11px] text-emerald-300">{n}</p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">{t}</p>
                  <p className="mt-1 text-caption">{d}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      </div>
    </AppShell>
  );
}
