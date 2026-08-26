import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { KeyRound, Network, Server, Terminal } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";

export const Route = createFileRoute("/mine")({
  head: () => ({
    meta: [{ title: "M.I.N.E — Host Minecraft" }],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
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
  return (
    <AppShell title="M.I.N.E" subtitle="Host Minecraft · nero e verde">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <section className="panel-spacious relative overflow-hidden animate-fade-in-up">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl animate-aurora" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-64 rounded-full bg-green-600/15 blur-3xl" />
          <div className="relative">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-400/90">
              <Terminal className="h-3.5 w-3.5" />
              Minecraft Intelligent Network Engine
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-emerald-200 via-green-400 to-lime-300 bg-clip-text text-transparent">
                M.I.N.E
              </span>
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Controllo server, rete neurale, log e power. Estetica matrix premium — verde su nero.
            </p>
          </div>
        </section>

        <ul className="grid gap-4 sm:grid-cols-3">
          {LINKS.map((l, i) => (
            <li key={l.to} style={{ animationDelay: `${i * 70}ms` }} className="animate-fade-in-up">
              <Link
                to={l.to}
                className="card-interactive flex h-full flex-col rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5 no-underline"
              >
                <l.icon className="mb-3 h-5 w-5 text-emerald-400" />
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
