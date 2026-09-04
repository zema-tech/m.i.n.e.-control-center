import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Cpu, Play, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PROVIDERS, SWARM_MODES, SWARM_MODELS } from "@/lib/ai-providers";
import { getAuthState } from "@/lib/auth.functions";
import {
  deleteMemory,
  getAgentEvents,
  getBrainStatus,
  getComposioTools,
  getMemories,
  runComposioTool,
  saveMemory,
} from "@/lib/brain.functions";

export const Route = createFileRoute("/memory")({
  head: () => ({
    meta: [
      { title: "Memoria agente — M.I.N.E" },
      {
        name: "description",
        content:
          "Memoria persistente dello sciame IA di M.I.N.E: ricordi, diario delle azioni, provider attivi e mani Composio.",
      },
      { property: "og:title", content: "Memoria agente — M.I.N.E" },
      {
        property: "og:description",
        content: "Ricordi, eventi e strumenti esterni dell'agente IA che gestisce il server Minecraft.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: MemoryPage,
});

type MemoryRow = {
  id: string;
  kind: string;
  title: string;
  content: string;
  tags: string[];
  importance: number;
  source: string;
  created_at: string;
};

type EventRow = {
  id: string;
  kind: string;
  provider: string | null;
  model: string | null;
  summary: string;
  ok: boolean;
  created_at: string;
};

type ToolRow = { slug: string; name: string; toolkit: string; description: string; readOnly: boolean };

export default function MemoryPage() {
  const status = useServerFn(getBrainStatus);
  const fetchMemories = useServerFn(getMemories);
  const addMem = useServerFn(saveMemory);
  const delMem = useServerFn(deleteMemory);
  const fetchEvents = useServerFn(getAgentEvents);
  const fetchTools = useServerFn(getComposioTools);
  const execTool = useServerFn(runComposioTool);

  const [providers, setProviders] = useState<string[]>([]);
  const [composio, setComposio] = useState(false);
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [toolkits, setToolkits] = useState<{ slug: string; name: string }[]>([]);
  const [toolkit, setToolkit] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("nota");
  const [importance, setImportance] = useState(3);

  async function reload() {
    setBusy(true);
    try {
      const [st, mem, ev] = await Promise.all([status({}), fetchMemories({}), fetchEvents({})]);
      setProviders(st.providers);
      setComposio(st.composio);
      setRows(mem.rows as MemoryRow[]);
      setEvents(ev.rows as EventRow[]);
      if (!mem.ok && "message" in mem) setMsg(mem.message ?? null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function loadTools(slug?: string) {
    setBusy(true);
    try {
      const res = await fetchTools({ data: slug ? { toolkit: slug } : {} });
      setToolkits(res.toolkits);
      setTools(res.tools as ToolRow[]);
      if (!res.ok && "message" in res) setMsg(res.message ?? null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!title.trim() || !content.trim()) {
      setMsg("Titolo e contenuto sono obbligatori.");
      return;
    }
    try {
      await addMem({ data: { kind, title, content, tags: [], importance } });
      setTitle("");
      setContent("");
      setMsg("Ricordo salvato nella memoria dell'agente.");
      void reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function onRun(tool: ToolRow) {
    if (!tool.readOnly && !window.confirm(`"${tool.slug}" scrive su un servizio esterno. Confermi?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await execTool({ data: { slug: tool.slug, args: {}, approved: !tool.readOnly } });
      setMsg(`${tool.slug}: ${res.output.slice(0, 400)}`);
      void reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <header>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-primary">
            <Brain className="h-5 w-5" /> Memoria &amp; Sciame IA
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            L'agente ricorda qui tutto ciò che conta e attinge a questi ricordi in ogni chat. Lo sciame
            usa i modelli veloci per il brainstorming e quelli forti per la decisione finale.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
              <Cpu className="h-3 w-3" /> provider IA
            </h2>
            <div className="space-y-1.5">
              {PROVIDERS.map((p) => {
                const on = providers.includes(p.id);
                return (
                  <div key={p.id} className="flex items-start justify-between gap-2 text-[11px]">
                    <div>
                      <span className={on ? "text-primary" : "text-muted-foreground"}>{p.label}</span>
                      <p className="text-[10px] text-muted-foreground">{p.note}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] uppercase ${
                        on ? "border-primary/50 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {on ? "attivo" : p.secret}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-border/60 pt-1.5 text-[11px]">
                <span className={composio ? "text-primary" : "text-muted-foreground"}>
                  Composio (mani esterne)
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase ${
                    composio ? "border-primary/50 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {composio ? "attivo" : "COMPOSIO_API_KEY"}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {SWARM_MODELS.filter((m) => providers.includes(m.provider)).length} modelli utilizzabili su{" "}
              {SWARM_MODELS.length} in catalogo.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card/50 p-3">
            <h2 className="mb-2 text-[11px] uppercase tracking-[0.25em] text-primary">
              modalità dello sciame
            </h2>
            <ul className="space-y-1.5">
              {SWARM_MODES.map((m) => (
                <li key={m.id} className="text-[11px]">
                  <span className="text-foreground">{m.label}</span>
                  <span className="text-muted-foreground"> — {m.hint}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              La chat usa <span className="text-primary">Auto</span>: domande semplici → un modello
              veloce; problemi complessi o rischiosi → brainstorming, critica e sintesi.
            </p>
          </div>
        </section>

        {msg ? (
          <p className="rounded border border-border bg-background/60 p-2 font-mono text-[10px] text-muted-foreground">
            {msg}
          </p>
        ) : null}

        <section className="rounded-lg border border-border bg-card/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-primary">ricordi dell'agente</h2>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={busy}
              className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
            >
              <RefreshCw className="h-3 w-3" /> aggiorna
            </button>
          </div>

          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titolo (es. Plugin critici del server)"
              className="rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary md:col-span-2"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
            >
              <option value="nota">nota</option>
              <option value="regola">regola</option>
              <option value="config">config</option>
              <option value="incidente">incidente</option>
              <option value="preferenza">preferenza</option>
            </select>
            <select
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  priorità {n}
                </option>
              ))}
            </select>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cosa deve ricordare l'agente"
              rows={2}
              className="rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary md:col-span-3"
            />
            <button
              type="button"
              onClick={() => void onSave()}
              className="flex items-center justify-center gap-1 rounded border border-primary py-1 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              <Plus className="h-3 w-3" /> salva ricordo
            </button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nessun ricordo ancora. Aggiungi le regole del tuo server: l'IA le userà in ogni risposta.
              </p>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="rounded border border-border bg-background/40 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] text-foreground">
                        <span className="text-primary">[{r.kind}·p{r.importance}]</span> {r.title}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[10px] text-muted-foreground">
                        {r.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await delMem({ data: { id: r.id } });
                        void reload();
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
              <Wrench className="h-3 w-3" /> mani Composio
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={toolkit}
                onChange={(e) => {
                  setToolkit(e.target.value);
                  void loadTools(e.target.value || undefined);
                }}
                className="rounded border border-border bg-background px-2 py-0.5 text-[10px] outline-none focus:border-primary"
              >
                <option value="">tutti i servizi</option>
                {toolkits.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void loadTools(toolkit || undefined)}
                disabled={busy}
                className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
              >
                carica
              </button>
            </div>
          </div>
          {tools.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {composio
                ? "Premi «carica» per vedere gli strumenti disponibili."
                : "Aggiungi la chiave Composio per dare all'agente le mani sui servizi esterni."}
            </p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {tools.map((t) => (
                <div
                  key={t.slug}
                  className="flex items-start justify-between gap-2 rounded border border-border bg-background/40 p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] text-foreground">
                      {t.name}{" "}
                      <span
                        className={`ml-1 rounded-full border px-1 py-0.5 text-[9px] uppercase ${
                          t.readOnly
                            ? "border-primary/40 text-primary"
                            : "border-destructive/50 text-destructive"
                        }`}
                      >
                        {t.readOnly ? "lettura" : "scrittura"}
                      </span>
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">{t.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRun(t)}
                    disabled={busy}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    title="Esegui"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card/50 p-3">
          <h2 className="mb-2 text-[11px] uppercase tracking-[0.25em] text-primary">
            diario dell'agente
          </h2>
          <div className="max-h-72 space-y-1 overflow-y-auto font-mono text-[10px]">
            {events.length === 0 ? (
              <p className="text-muted-foreground">Nessun evento registrato.</p>
            ) : (
              events.map((e) => (
                <p key={e.id} className={e.ok ? "text-muted-foreground" : "text-destructive"}>
                  <span className="text-primary">
                    {new Date(e.created_at).toLocaleString("it-IT")}
                  </span>{" "}
                  [{e.kind}] {e.summary}
                </p>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
