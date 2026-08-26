import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Brain,
  Cable,
  Code2,
  Eye,
  Hand,
  KeyRound,
  MessageSquare,
  Network,
  Plus,
  Scale,
  Server,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";
import {
  addMemoryNote,
  DEFAULT_CHARACTER,
  DEFAULT_RULES,
  loadIdentityDoc,
  loadMemoryNotes,
  loadRulesDoc,
  PILLARS,
  removeMemoryNote,
  saveIdentityDoc,
  saveRulesDoc,
  type MemoryNote,
} from "@/lib/agent-brain";
import {
  AGENT_SECTIONS,
  loadAgentProfile,
  saveAgentProfile,
  type AgentProfile,
} from "@/lib/agent-profile";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "JARVIS — Agente" },
      {
        name: "description",
        content: "Un assistente vero: carattere, memoria, mani e regole.",
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
  code: Code2,
  network: Network,
  skills: KeyRound,
  hosts: Server,
  connectors: Cable,
};

function AgentHome() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [memory, setMemory] = useState<MemoryNote[]>([]);
  const [memTitle, setMemTitle] = useState("");
  const [memBody, setMemBody] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [tab, setTab] = useState<"character" | "memory" | "hands" | "rules">("character");

  useEffect(() => {
    const p = loadAgentProfile();
    setProfile(p);
    setName(p.name);
    setTagline(p.tagline);
    setCharacter(loadIdentityDoc().character);
    setRules(loadRulesDoc().rules);
    setMemory(loadMemoryNotes());
  }, []);

  function saveCharacter() {
    saveIdentityDoc(character);
    const next = saveAgentProfile({ name, tagline });
    setProfile(next);
  }

  function saveRules() {
    saveRulesDoc(rules);
  }

  function addMem() {
    if (!memBody.trim()) return;
    addMemoryNote(memTitle || "Nota", memBody);
    setMemory(loadMemoryNotes());
    setMemTitle("");
    setMemBody("");
  }

  const p = profile;

  return (
    <AppShell
      title="JARVIS"
      subtitle="Un assistente vero ha quattro cose"
    >
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
        <section className="panel-spacious text-center">
          <p className="font-display text-lg tracking-wide text-primary sm:text-xl">
            UN ASSISTENTE VERO HA QUATTRO COSE
          </p>
          <p className="mt-2 text-caption text-muted-foreground">
            {p?.name ?? "JARVIS"} — il tuo assistente
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <button
                key={pillar.id}
                type="button"
                onClick={() => setTab(pillar.id)}
                className={`card-interactive rounded-lg border p-3 text-left transition-all ${
                  tab === pillar.id
                    ? `${pillar.color} ring-1 ring-primary/40`
                    : "border-border bg-background/40"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {pillar.title}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{pillar.question}</p>
                <p className="mt-2 font-mono text-[9px] text-primary/80">{pillar.fileHint}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Editor pilastro attivo */}
        {tab === "character" ? (
          <section className="panel-spacious space-y-3 border-amber-500/30">
            <p className="flex items-center gap-2 text-label text-primary">
              <User className="h-3.5 w-3.5" /> Carattere — identity.md
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
                className="rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Tagline"
                className="rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <textarea
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              rows={10}
              className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={saveCharacter}
              className="btn-matrix rounded-md border border-primary px-4 py-2 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              salva carattere
            </button>
          </section>
        ) : null}

        {tab === "memory" ? (
          <section className="panel-spacious space-y-3 border-violet-500/30">
            <p className="flex items-center gap-2 text-label text-primary">
              <Brain className="h-3.5 w-3.5" /> Memoria — cosa sa di te
            </p>
            <input
              value={memTitle}
              onChange={(e) => setMemTitle(e.target.value)}
              placeholder="Titolo nota"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={memBody}
              onChange={(e) => setMemBody(e.target.value)}
              rows={3}
              placeholder="Es. Preferisco risposte brevi. Server principale: Survival Gino."
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={addMem}
              className="btn-matrix flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-widest text-primary"
            >
              <Plus className="h-3 w-3" /> aggiungi memoria
            </button>
            <ul className="space-y-2">
              {memory.length === 0 ? (
                <p className="text-caption text-muted-foreground">Memoria vuota.</p>
              ) : (
                memory.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-foreground">{n.title}</p>
                      <p className="text-caption text-muted-foreground">{n.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeMemoryNote(n.id);
                        setMemory(loadMemoryNotes());
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {tab === "hands" ? (
          <section className="panel-spacious space-y-3 border-sky-500/30">
            <p className="flex items-center gap-2 text-label text-primary">
              <Hand className="h-3.5 w-3.5" /> <Eye className="h-3.5 w-3.5" /> Mani e occhi
            </p>
            <p className="text-caption text-muted-foreground">
              Cosa può vedere e toccare — collega qui le capacità.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              <li className="rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">One MCP</p>
                <p className="text-caption text-muted-foreground">700+ app — mani SaaS</p>
                <Link to="/connectors" className="mt-2 inline-block text-[10px] uppercase text-primary">
                  connettori →
                </Link>
              </li>
              <li className="rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">Host / Falix</p>
                <p className="text-caption text-muted-foreground">Server, log, power</p>
                <Link to="/hosts" className="mt-2 inline-block text-[10px] uppercase text-primary">
                  host →
                </Link>
              </li>
              <li className="rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">Competenze</p>
                <p className="text-caption text-muted-foreground">API key e account</p>
                <Link to="/skills" className="mt-2 inline-block text-[10px] uppercase text-primary">
                  skills →
                </Link>
              </li>
              <li className="rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">Codice</p>
                <p className="text-caption text-muted-foreground">Agent Kilo/Claude Code</p>
                <Link to="/code" className="mt-2 inline-block text-[10px] uppercase text-primary">
                  code →
                </Link>
              </li>
            </ul>
          </section>
        ) : null}

        {tab === "rules" ? (
          <section className="panel-spacious space-y-3 border-rose-500/30">
            <p className="flex items-center gap-2 text-label text-primary">
              <Scale className="h-3.5 w-3.5" /> Regole — cosa non deve fare
            </p>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={14}
              className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={saveRules}
              className="btn-matrix rounded-md border border-primary px-4 py-2 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              salva regole
            </button>
          </section>
        ) : null}

        <Link
          to="/assistant"
          className="card-interactive panel-spacious flex items-center justify-between gap-3 border-primary/30 no-underline"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Parla con JARVIS</p>
              <p className="text-caption text-muted-foreground">
                Usa carattere + memoria + regole + mani in ogni risposta
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-primary">chat →</span>
        </Link>

        <section className="space-y-3">
          <p className="text-label text-muted-foreground">Altre sezioni</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {AGENT_SECTIONS.map((s) => {
              const Icon = ICONS[s.id] ?? Sparkles;
              return (
                <li key={s.id}>
                  <Link
                    to={s.to}
                    className="card-interactive flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 no-underline"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm text-foreground">{s.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
