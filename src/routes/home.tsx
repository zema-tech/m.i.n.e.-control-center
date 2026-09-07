import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
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

  return (
    <AppShell title="Hub" subtitle="Scegli il contesto">
      <div className="relative mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 sm:py-12">
        <header className="animate-fade-in-up">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="logo-gradient">{name}</span>
          </h2>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Control center multi-agente
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((s, i) => (
            <Link
              key={s.id}
              to={s.href}
              className={`section-card section-card-${s.id} group animate-fade-in-up no-underline`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="section-card-glow" />
              <div className="relative z-[1] flex h-full flex-col p-6 sm:p-7">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      {s.tagline}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                      {s.title}
                    </h3>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-white transition-transform duration-300 group-hover:scale-105">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
                <p className="flex-1 text-[13px] leading-relaxed text-white/60">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
