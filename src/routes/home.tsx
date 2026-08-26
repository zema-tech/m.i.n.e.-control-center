import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";
import { loadAgentProfile } from "@/lib/agent-profile";
import { SECTIONS } from "@/lib/section-themes";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — JARVIS · M.I.N.E" },
      { name: "description", content: "Scegli il mondo: JARVIS, M.I.N.E, Design, Code." },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: HomeHub,
});

function HomeHub() {
  const [name, setName] = useState("JARVIS");

  useEffect(() => {
    setName(loadAgentProfile().name || "JARVIS");
  }, []);

  return (
    <AppShell title="Mondi" subtitle="Quattro sezioni · un solo agente">
      <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
        <header className="text-center animate-fade-in-up">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Hub premium
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            <span className="logo-gradient">{name}</span>
            <span className="text-muted-foreground"> · ecosistemi</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Entra nel mondo giusto: agente azzurro, Minecraft verde, design, o coding blu scuro.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <Link
              key={s.id}
              to={s.href}
              className={`section-card section-card-${s.id} group animate-fade-in-up no-underline`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="section-card-glow" />
              <div className="relative z-[1] flex h-full flex-col p-6 sm:p-7">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                      {s.tagline}
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {s.title}
                    </h3>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-white/70">{s.description}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                    {s.colors}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-white/90">
                    Apri →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-caption animate-fade-in" style={{ animationDelay: "0.4s" }}>
          Ogni sezione attiva gradienti, orb e accenti dedicati. Naviga dalla sidebar o da qui.
        </p>
      </div>
    </AppShell>
  );
}
