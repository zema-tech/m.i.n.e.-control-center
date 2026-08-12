import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Bot,
  Check,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Terminal,
  Trash2,
  Zap,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAuthState } from "@/lib/auth.functions";
import { askAssistant, getLogs, runCommand, runFalixAction } from "@/lib/panel.functions";
import { FALIX_ACTIONS, getAction, riskLabel, type ActionRisk } from "@/lib/falix-actions";
import {
  createThread,
  deleteThread as removeThread,
  ensureThread,
  loadThreads,
  updateThread,
  type ChatThread,
  type ActionProposal,
  type Msg,
  type Proposal,
} from "@/lib/chats";

export const Route = createFileRoute("/assistant/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat IA + Console — M.I.N.E" },
      {
        name: "description",
        content:
          "Chat IA dedicata: analizza i log del server Minecraft, conferma i comandi proposti e inviali su Falix dalla console.",
      },
      { property: "og:title", content: "Chat IA + Console — M.I.N.E" },
      {
        property: "og:description",
        content: "Conversazioni separate con l'IA che gestisce il tuo server Minecraft su Falix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: AssistantPage,
});

type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };

function AssistantPage() {
  const { threadId } = Route.useParams();
  const navigate = Route.useNavigate();
  const ask = useServerFn(askAssistant);
  const fetchLogs = useServerFn(getLogs);
  const exec = useServerFn(runCommand);
  const execAction = useServerFn(runFalixAction);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logDemo, setLogDemo] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [actionId, setActionId] = useState("server.status");
  const [actionParams, setActionParams] = useState("{}");
  const [consoleOut, setConsoleOut] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const current = ensureThread(threadId);
    setThreads(loadThreads());
    setMessages(current.messages);
    setConsoleOut([]);
  }, [threadId]);

  const persist = useCallback(
    (next: Msg[]) => {
      setMessages(next);
      setThreads(updateThread(threadId, next));
    },
    [threadId],
  );

  const loadLogs = useCallback(async () => {
    const res = await fetchLogs({});
    setLogs(res.lines as LogLine[]);
    setLogDemo(res.demo);
    setLogError(res.ok ? null : ((res as { message?: string }).message ?? "Errore log"));
  }, [fetchLogs]);

  useEffect(() => {
    void loadLogs();
    const id = setInterval(() => void loadLogs(), 15000);
    return () => clearInterval(id);
  }, [loadLogs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy, threadId]);

  function onNewChat() {
    const thread = createThread();
    setThreads(loadThreads());
    void navigate({ to: "/assistant/$threadId", params: { threadId: thread.id } });
  }

  function onDeleteChat(id: string) {
    const rest = removeThread(id);
    setThreads(rest);
    if (id === threadId) {
      const next = rest[0] ?? createThread();
      setThreads(loadThreads());
      void navigate({ to: "/assistant/$threadId", params: { threadId: next.id }, replace: true });
    }
  }

  async function onAsk() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const withUser: Msg[] = [...messages, { role: "user", content: question }];
    persist(withUser);
    try {
      const res = await ask({
        data: {
          question,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        },
      });
      persist([
        ...withUser,
        {
          role: "assistant",
          content: res.risposta,
          proposals: res.comandi.map((c) => ({ ...c, state: "pending" as const })),
          actions: (res.azioni ?? []).map((a) => ({ ...a, state: "pending" as const })),
        },
      ]);
    } catch (error) {
      persist([
        ...withUser,
        { role: "assistant", content: error instanceof Error ? error.message : String(error) },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function updateProposal(mi: number, pi: number, patch: Partial<Proposal>) {
    persist(
      messages.map((msg, i) => {
        if (i !== mi || !msg.proposals) return msg;
        return {
          ...msg,
          proposals: msg.proposals.map((p, j) => (j === pi ? { ...p, ...patch } : p)),
        };
      }),
    );
  }

  function updateAction(mi: number, ai: number, patch: Partial<ActionProposal>) {
    persist(
      messages.map((msg, i) => {
        if (i !== mi || !msg.actions) return msg;
        return {
          ...msg,
          actions: msg.actions.map((a, j) => (j === ai ? { ...a, ...patch } : a)),
        };
      }),
    );
  }

  async function runCatalogAction(
    id: string,
    params: Record<string, string | number | boolean>,
    risk: ActionRisk,
  ): Promise<string> {
    if (risk !== "read") {
      const def = getAction(id);
      const warn =
        risk === "critical"
          ? `AZIONE CRITICA IRREVERSIBILE: "${def?.label ?? id}".\nConfermi l'esecuzione sul server?`
          : `Approvi l'azione "${def?.label ?? id}" sul server?`;
      if (!window.confirm(warn)) return "Azione annullata dall'amministratore.";
    }
    const res = await execAction({ data: { id, params, approved: risk !== "read" } });
    setConsoleOut((o) => [...o, `> azione ${id}`, res.output]);
    void loadLogs();
    return res.output;
  }

  async function confirmAction(mi: number, ai: number, a: ActionProposal) {
    const risk = getAction(a.id)?.risk ?? "critical";
    const output = await runCatalogAction(a.id, a.params, risk);
    updateAction(mi, ai, { state: "done", output });
  }

  async function onRunManualAction() {
    let params: Record<string, string | number | boolean> = {};
    try {
      const parsed = JSON.parse(actionParams || "{}");
      if (parsed && typeof parsed === "object") params = parsed as typeof params;
    } catch {
      setConsoleOut((o) => [...o, "Parametri JSON non validi."]);
      return;
    }
    const risk = getAction(actionId)?.risk ?? "critical";
    await runCatalogAction(actionId, params, risk);
  }

  async function confirmProposal(mi: number, pi: number, cmd: string) {
    const res = await exec({ data: { command: cmd } });
    updateProposal(mi, pi, { state: "done", output: res.output });
    setConsoleOut((o) => [...o, `> ${cmd}`, res.output]);
    void loadLogs();
  }

  async function onSendCommand() {
    const cmd = command.trim();
    if (!cmd) return;
    setCommand("");
    const res = await exec({ data: { command: cmd } });
    setConsoleOut((o) => [...o, `> ${cmd}`, res.output]);
    void loadLogs();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="text-glow text-xl font-bold text-primary">M.I.N.E</h1>
          <nav className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <Link
              to="/"
              className="rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              dashboard
            </Link>
            <span className="rounded-md border border-primary px-3 py-1.5 text-primary">
              ia + console
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr_1fr]">
        <aside className="panel flex max-h-[70vh] flex-col p-3">
          <button
            onClick={onNewChat}
            className="mb-3 flex items-center justify-center gap-2 rounded-md border border-primary px-3 py-2 text-[11px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> nuova chat
          </button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nessuna chat.</p>
            ) : null}
            {threads.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${
                  t.id === threadId ? "border-primary" : "border-border"
                }`}
              >
                <button
                  onClick={() =>
                    void navigate({ to: "/assistant/$threadId", params: { threadId: t.id } })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] text-muted-foreground transition-colors hover:text-primary"
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  onClick={() => onDeleteChat(t.id)}
                  aria-label={`Elimina chat ${t.title}`}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel flex h-[70vh] flex-col p-4 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-primary">
            <Bot className="h-4 w-4" /> IA Assistant
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
            {messages.length === 0 ? (
              <p className="text-muted-foreground">
                Chiedi ad esempio:{" "}
                <span className="text-primary">&quot;perché il server lagga?&quot;</span> —
                l&apos;IA legge i log e propone comandi che devi confermare.
              </p>
            ) : null}
            {messages.map((m, mi) => (
              <div
                key={mi}
                className={
                  m.role === "user"
                    ? "rounded-md border border-border bg-muted/40 p-3"
                    : "rounded-md border border-primary/40 p-3"
                }
              >
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m.role === "user" ? "tu" : "m.i.n.e"}
                </p>
                <p className="whitespace-pre-wrap text-foreground">{m.content}</p>
                {m.proposals?.length ? (
                  <div className="mt-3 space-y-2">
                    {m.proposals.map((p, pi) => (
                      <div key={pi} className="rounded-md border border-border p-2">
                        <p className="font-mono text-xs text-primary">/{p.comando}</p>
                        {p.motivo ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">{p.motivo}</p>
                        ) : null}
                        {p.state === "pending" ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => void confirmProposal(mi, pi, p.comando)}
                              className="flex items-center gap-1 rounded border border-primary px-2 py-1 text-[11px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
                            >
                              <Check className="h-3 w-3" /> conferma
                            </button>
                            <button
                              onClick={() => updateProposal(mi, pi, { state: "rejected" })}
                              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                            >
                              <X className="h-3 w-3" /> rifiuta
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {p.state === "done" ? (p.output ?? "eseguito") : "rifiutato"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                {m.actions?.length ? (
                  <div className="mt-3 space-y-2">
                    {m.actions.map((a, ai) => {
                      const def = getAction(a.id);
                      const risk = def?.risk ?? "critical";
                      return (
                        <div
                          key={ai}
                          className={`rounded-md border p-2 ${
                            risk === "critical"
                              ? "border-destructive/70"
                              : risk === "write"
                                ? "border-warning/60"
                                : "border-border"
                          }`}
                        >
                          <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-primary">
                            <Zap className="h-3 w-3" /> {a.id}
                            <span
                              className={`rounded border px-1 text-[9px] uppercase tracking-widest ${
                                risk === "critical"
                                  ? "border-destructive text-destructive"
                                  : risk === "write"
                                    ? "border-warning text-warning"
                                    : "border-border text-muted-foreground"
                              }`}
                            >
                              {riskLabel(risk)}
                            </span>
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {def?.label ?? "azione"} — {a.motivo}
                          </p>
                          {Object.keys(a.params).length ? (
                            <pre className="mt-1 overflow-x-auto font-mono text-[10px] text-muted-foreground">
                              {JSON.stringify(a.params)}
                            </pre>
                          ) : null}
                          {a.state === "pending" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => void confirmAction(mi, ai, a)}
                                className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] uppercase tracking-widest transition-colors ${
                                  risk === "read"
                                    ? "border-primary text-primary hover:bg-primary/10"
                                    : "border-warning text-warning hover:bg-warning/10"
                                }`}
                              >
                                {risk === "read" ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <ShieldAlert className="h-3 w-3" />
                                )}
                                {risk === "read" ? "esegui" : "approva ed esegui"}
                              </button>
                              <button
                                onClick={() => updateAction(mi, ai, { state: "rejected" })}
                                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                              >
                                <X className="h-3 w-3" /> rifiuta
                              </button>
                            </div>
                          ) : (
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                              {a.state === "done" ? (a.output ?? "eseguito") : "rifiutato"}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <p className="text-xs text-primary">M.I.N.E sta analizzando i log…</p> : null}
          </div>
          <div className="mt-3 flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onAsk();
                }
              }}
              rows={2}
              placeholder="Chiedi qualcosa sul server…"
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              onClick={() => void onAsk()}
              disabled={busy}
              className="flex items-center gap-1 rounded-md border border-primary px-3 text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" /> invia
            </button>
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.25em] text-primary">Log server</h2>
              <button
                onClick={() => void loadLogs()}
                className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
              >
                <RefreshCw className="h-3 w-3" /> aggiorna
              </button>
            </div>
            {logDemo || logError ? (
              <p className="mb-2 flex items-start gap-2 text-[11px] text-warning">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {logError ?? "Log dimostrativi: API Falix non raggiungibile."}
              </p>
            ) : null}
            <div className="max-h-64 space-y-0.5 overflow-y-auto font-mono text-[11px]">
              {logs.map((l, i) => (
                <p
                  key={i}
                  className={
                    l.level === "error"
                      ? "text-destructive"
                      : l.level === "warn"
                        ? "text-warning"
                        : "text-muted-foreground"
                  }
                >
                  {l.message}
                </p>
              ))}
            </div>
          </section>

          <section className="panel p-4 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-primary">
              <Terminal className="h-4 w-4" /> Console
            </h2>
            <div className="mb-3 max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px] text-muted-foreground">
              {consoleOut.length === 0 ? (
                <p>Nessun comando inviato.</p>
              ) : (
                consoleOut.map((line, i) => (
                  <p key={i} className={line.startsWith(">") ? "text-primary" : undefined}>
                    {line}
                  </p>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onSendCommand();
                }}
                placeholder="say ciao"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
              />
              <button
                onClick={() => void onSendCommand()}
                className="rounded-md border border-primary px-3 text-[11px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
              >
                invia
              </button>
            </div>
          </section>

          <section className="panel p-4 sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-primary">
              <Zap className="h-4 w-4" /> Azioni Falix
            </h2>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Tutte le operazioni consentite dalla chiave API. Le azioni di scrittura e critiche
              richiedono approvazione.
            </p>
            <div className="space-y-2">
              <select
                value={actionId}
                onChange={(e) => setActionId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
              >
                {(["read", "write", "critical"] as ActionRisk[]).map((risk) => (
                  <optgroup key={risk} label={riskLabel(risk).toUpperCase()}>
                    {FALIX_ACTIONS.filter((a) => a.risk === risk).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} — {a.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <textarea
                value={actionParams}
                onChange={(e) => setActionParams(e.target.value)}
                rows={2}
                spellCheck={false}
                placeholder='{"path":"/logs/latest.log"}'
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground outline-none focus:border-primary"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                    (getAction(actionId)?.risk ?? "read") === "critical"
                      ? "border-destructive text-destructive"
                      : (getAction(actionId)?.risk ?? "read") === "write"
                        ? "border-warning text-warning"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {riskLabel(getAction(actionId)?.risk ?? "read")}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {getAction(actionId)?.scope}
                </span>
                <button
                  onClick={() => void onRunManualAction()}
                  className="ml-auto rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
                >
                  esegui azione
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
