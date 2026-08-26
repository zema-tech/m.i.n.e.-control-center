import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Brain, Cable, MessageSquare, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";
import { loadAgentProfile } from "@/lib/agent-profile";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [{ title: "JARVIS — Agente azzurro" }],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: JarvisSection,
});

const LINKS = [
  {
    to: "/assistant" as const,
    title: "Chat",
    blurb: "Parla con l'agente — ops, One MCP, ragionamento",
    icon: MessageSquare,
  },
  {
    to: "/agent" as const,
    title: "4 pilastri",
    blurb: "Carattere, memoria, mani, regole",
    icon: Brain,
  },
  {
    to: "/connectors" as const,
    title: "Connettori",
    blurb: "One MCP e integrazioni",
    icon: Cable,
  },
];

function JarvisSection() {
  const [name, setName] = useState("JARVIS");
  useEffect(() => {
    setName(loadAgentProfile().name || "JARVIS");
  }, []);

  return (
    <AppShell title="JARVIS" subtitle="Sezione principale · azzurro e nero">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <section className="panel-spacious relative overflow-hidden animate-fade-in-up">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl animate-aurora" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-blue-600/20 blur-3xl animate-aurora" style={{ animationDelay: "-3s" }} />
          <div className="relative">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              Sezione principale
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-sky-200 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                {name}
              </span>
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Il tuo Claude personale: identità, memoria, mani One MCP e regole. Tutto in palette
              azzurro su nero profondo.
            </p>
          </div>
        </section>

        <ul className="grid gap-4 sm:grid-cols-3">
          {LINKS.map((l, i) => (
            <li key={l.to} style={{ animationDelay: `${i * 70}ms` }} className="animate-fade-in-up">
              <Link
                to={l.to}
                className="card-interactive flex h-full flex-col rounded-2xl border border-sky-400/15 bg-sky-500/5 p-5 no-underline"
              >
                <l.icon className="mb-3 h-5 w-5 text-sky-300" />
                <span className="text-sm font-semibold text-foreground">{l.title}</span>
                <span className="mt-1 text-caption">{l.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
