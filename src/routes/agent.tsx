import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Brain,
  Cable,
  KeyRound,
  MessageSquare,
  Network,
  Server,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";
import {
  AGENT_SECTIONS,
  loadAgentProfile,
  saveAgentProfile,
  type AgentProfile,
} from "@/lib/agent-profile";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "Agente M.I.N.E" },
      {
        name: "description",
        content: "Il tuo agente IA personale — chat, rete, host, connettori One.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: AgentHome,
});

const ICONS: Record<string, typeof Brain> = {
  chat: MessageSquare,
  network: Network,
  skills: KeyRound,
  hosts: Server,
  connectors: Cable,
};

function AgentHome() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [focus, setFocus] = useState("");

  useEffect(() => {
    const p = loadAgentProfile();
    setProfile(p);
    setName(p.name);
    setTagline(p.tagline);
    setFocus(p.focus);
  }, []);

  function save() {
    const next = saveAgentProfile({ name, tagline, focus });
    setProfile(next);
    setEditing(false);
  }

  const p = profile;

  return (
    <AppShell
      title="Agente"
      subtitle="Il tuo spazio — come Claude ha Claude, tu hai M.I.N.E"
    >
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
        {/* Hero identità agente */}
        <section className="panel-spacious relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
                <Brain className="h-6 w-6 text-primary animate-soft-float" />
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.25em] text-muted-foreground">
                  agente personale
                </p>
                <h2 className="text-glow font-display text-xl font-bold tracking-widest text-primary">
                  {p?.name ?? "M.I.N.E"}
                </h2>
                <p className="mt-1 text-sm text-foreground/90">{p?.tagline}</p>
                <p className="mt-2 max-w-md text-caption leading-relaxed text-muted-foreground">
                  {p?.focus}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-caption text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Motore: Groq · Lingua: {p?.language ?? "italiano"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="btn-matrix shrink-0 rounded-md border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
            >
              {editing ? "chiudi" : "personalizza"}
            </button>
          </div>

          {editing ? (
            <div className="mt-4 space-y-2 border-t border-border pt-4 animate-fade-in-up">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome agente"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Tagline"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Su cosa si concentra"
                rows={2}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={save}
                className="btn-matrix rounded-md border border-primary px-4 py-2 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10"
              >
                salva identità
              </button>
            </div>
          ) : null}
        </section>

        {/* CTA primaria */}
        <Link
          to="/assistant"
          className="card-interactive panel-spacious flex items-center justify-between gap-3 border-primary/30 no-underline"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Apri chat con l&apos;agente</p>
              <p className="text-caption text-muted-foreground">
                Diagnosi, comandi, tool Falix / One — sempre con conferma su azioni critiche
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-primary">vai →</span>
        </Link>

        {/* Sezioni */}
        <section className="space-y-3">
          <p className="text-label text-primary">Sezioni dell&apos;agente</p>
          <p className="text-caption text-muted-foreground">
            Come Claude organizza chat e strumenti, M.I.N.E organizza le capacità operative.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {AGENT_SECTIONS.map((s, i) => {
              const Icon = ICONS[s.id] ?? Brain;
              return (
                <li key={s.id} style={{ animationDelay: `${i * 40}ms` }}>
                  <Link
                    to={s.to}
                    className="card-interactive animate-fade-in-up flex h-full flex-col rounded-lg border border-border bg-background/40 p-4 no-underline"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{s.title}</span>
                    </div>
                    <p className="text-caption leading-relaxed text-muted-foreground">{s.blurb}</p>
                    <span className="mt-auto pt-3 text-[10px] uppercase tracking-widest text-primary">
                      apri
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-border/60 bg-background/30 p-4">
          <p className="text-label text-muted-foreground">Modello mentale</p>
          <ul className="mt-2 space-y-1.5 text-caption text-muted-foreground">
            <li>
              <span className="text-primary">Claude</span> → assistente conversazionale Anthropic
            </li>
            <li>
              <span className="text-primary">M.I.N.E</span> → il tuo agente che agisce su host, API e
              connettori (con human-in-the-loop)
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
