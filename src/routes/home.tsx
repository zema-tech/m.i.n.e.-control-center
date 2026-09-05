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
      { title: "Home — Omnicore" },
      { name: "description", content: "Hub Omnicore: JARVIS, M.I.N.E, Design, Code." },
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
    <AppShell title="Hub" subtitle="Un agente · quattro mondi">
      <div className="relative mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        <header className="text-center animate-fade-in-up">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground backdrop-blur-xl uppercase">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Omnicore
          </div>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            <span className="logo-gradient">{name}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Control center premium. Scegli il contesto: agente, gaming, design o codice.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <Link
              key={s.id}
              to={s.href}
              className={`section-card section-card-${s.id} group animate-fade-in-up no-underline`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="section-card-glow" />
              <div className="relative z-[1] flex h-full flex-col p-6 sm:p-8">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                      {s.tagline}
                    </p>
                    <h3 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
                      {s.title}
                    </h3>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.08] text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-transform duration-400 group-hover:scale-105 group-hover:rotate-3">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
                <p className="flex-1 text-[13.5px] leading-relaxed text-white/65">{s.description}</p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                    {s.colors}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
                    Entra
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p
          className="text-center text-[12px] text-muted-foreground/80 animate-fade-in"
          style={{ animationDelay: "0.35s" }}
        >
          Ogni sezione ha palette e atmosfera dedicate. Naviga dalla sidebar o da qui.
        </p>
      </div>
    </AppShell>
  );
}
