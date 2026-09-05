import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Brain,
  Cable,
  Code2,
  FileText,
  KeyRound,
  MessageSquare,
  Network,
  Plus,
  Server,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";
import {
  DEFAULT_SOUL,
  MEMORY_CHAR_LIMIT,
  USER_CHAR_LIMIT,
  loadMemoryStore,
  loadSoul,
  loadUserStore,
  memoryTool,
  saveSoul,
  type MemoryStore,
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
        content: "SOUL.md, USER.md, MEMORY.md — modello Hermes.",
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

type Tab = "soul" | "user" | "memory";

function usageLabel(store: MemoryStore, limit: number) {
  const n =
    store.entries.length === 0
      ? 0
      : store.entries.join("\n§\n").length;
  const pct = limit === 0 ? 0 : Math.round((n / limit) * 100);
  return `${pct}% · ${n}/${limit}`;
}

function AgentHome() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [soul, setSoul] = useState(DEFAULT_SOUL);
  const [userStore, setUserStore] = useState<MemoryStore>({ entries: [], updatedAt: 0 });
  const [memStore, setMemStore] = useState<MemoryStore>({ entries: [], updatedAt: 0 });
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [tab, setTab] = useState<Tab>("soul");
  const [newEntry, setNewEntry] = useState("");
  const [toolMsg, setToolMsg] = useState<string | null>(null);

  function reloadStores() {
    setUserStore(loadUserStore());
    setMemStore(loadMemoryStore());
  }

  useEffect(() => {
    const p = loadAgentProfile();
    setProfile(p);
    setName(p.name);
    setTagline(p.tagline);
    setSoul(loadSoul().content);
    reloadStores();
  }, []);

  function saveSoulTab() {
    saveSoul(soul);
    const next = saveAgentProfile({ name, tagline });
    setProfile(next);
    setToolMsg("SOUL salvato");
  }

  function addEntry(target: "user" | "memory") {
    const content = newEntry.trim();
    if (!content) return;
    const res = memoryTool({ action: "add", target, content });
    if (!res.ok) {
      setToolMsg(res.error);
    } else {
      setToolMsg(`OK · ${res.usage}`);
      setNewEntry("");
      reloadStores();
    }
  }

  function removeEntry(target: "user" | "memory", entry: string) {
    const needle = entry.slice(0, Math.min(48, entry.length));
    const res = memoryTool({ action: "remove", target, old_text: needle });
    if (!res.ok) setToolMsg(res.error);
    else {
      setToolMsg(`rimossa · ${res.usage}`);
      reloadStores();
    }
  }

  const p = profile;
  const activeStore = tab === "user" ? userStore : memStore;
  const activeLimit = tab === "user" ? USER_CHAR_LIMIT : MEMORY_CHAR_LIMIT;

  return (
    <AppShell title="JARVIS" subtitle="SOUL · USER · MEMORY (Hermes)">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <section className="panel-spacious">
          <p className="font-display text-lg tracking-wide text-primary sm:text-xl">
            {p?.name ?? "JARVIS"}
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            File-based come Hermes. Niente metafore: tre store nel prompt.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {(
              [
                { id: "soul" as const, title: "SOUL.md", hint: "chi è l'agente" },
                { id: "user" as const, title: "USER.md", hint: "preferenze tue" },
                { id: "memory" as const, title: "MEMORY.md", hint: "note agente" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  tab === t.id
                    ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                    : "border-border bg-background/40"
                }`}
              >
                <p className="font-mono text-xs font-semibold text-foreground">{t.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.hint}</p>
                {t.id !== "soul" ? (
                  <p className="mt-2 font-mono text-[9px] text-primary/80">
                    {usageLabel(t.id === "user" ? userStore : memStore, t.id === "user" ? USER_CHAR_LIMIT : MEMORY_CHAR_LIMIT)}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        {toolMsg ? (
          <p className="rounded border border-border bg-background/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {toolMsg}
          </p>
        ) : null}

        {tab === "soul" ? (
          <section className="panel-spacious space-y-3">
            <p className="flex items-center gap-2 text-label text-primary">
              <FileText className="h-3.5 w-3.5" /> SOUL.md — identità
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome UI"
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
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              rows={12}
              className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={saveSoulTab}
              className="btn-matrix rounded-md border border-primary px-4 py-2 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              salva SOUL
            </button>
          </section>
        ) : null}

        {tab === "user" || tab === "memory" ? (
          <section className="panel-spacious space-y-3">
            <p className="flex items-center gap-2 text-label text-primary">
              {tab === "user" ? (
                <>
                  <User className="h-3.5 w-3.5" /> USER.md — profilo utente
                </>
              ) : (
                <>
                  <Brain className="h-3.5 w-3.5" /> MEMORY.md — note agente
                </>
              )}
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                {usageLabel(activeStore, activeLimit)}
              </span>
            </p>
            <p className="text-caption text-muted-foreground">
              {tab === "user"
                ? "Preferenze, tono, abitudini. Entry dense, non romanzi."
                : "Fatti ambiente, convenzioni, lezioni. L'agente le mantiene via tool memory."}
            </p>
            <textarea
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              rows={3}
              placeholder={
                tab === "user"
                  ? "Es. Preferisce risposte brevi in italiano. Timezone Europe/Rome."
                  : "Es. Server Falix main id=xyz porta 25565. Non usare sudo docker."
              }
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => addEntry(tab)}
              className="btn-matrix flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-widest text-primary"
            >
              <Plus className="h-3 w-3" /> add entry
            </button>
            <ul className="space-y-2">
              {activeStore.entries.length === 0 ? (
                <p className="text-caption text-muted-foreground">Vuoto.</p>
              ) : (
                activeStore.entries.map((e) => (
                  <li
                    key={e.slice(0, 64)}
                    className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-[12px] text-foreground">{e}</p>
                    <button
                      type="button"
                      onClick={() => removeEntry(tab, e)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Rimuovi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        <Link
          to="/assistant"
          className="card-interactive panel-spacious flex items-center justify-between gap-3 border-primary/30 no-underline"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Chat</p>
              <p className="text-caption text-muted-foreground">
                SOUL + MEMORY + USER iniettati a inizio sessione
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-primary">apri →</span>
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
