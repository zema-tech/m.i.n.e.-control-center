import { createFileRoute, redirect } from "@tanstack/react-router";
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

import { AppShell } from "@/components/AppShell";
import {
  ACTIVE_ACCOUNT_EVENT,
  activeCredentials,
  getActiveFalixAccount,
} from "@/lib/accounts";
import { getAuthState } from "@/lib/auth.functions";
import { askAssistant, getLogs, runCommand, runFalixAction } from "@/lib/panel.functions";
import { FALIX_ACTIONS, getAction, riskLabel, type ActionRisk } from "@/lib/falix-actions";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";
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
  head: () => ({ meta: [{ title: "Chat IA + Console — M.I.N.E" }] }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: AssistantPage,
});

type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };
const MODEL_KEY = "mine.groq.model";

function loadModel(): GroqModelId {
  if (typeof window === "undefined") return DEFAULT_GROQ_MODEL;
  try {
    const v = window.localStorage.getItem(MODEL_KEY);
    if (v && GROQ_MODELS.some((m) => m.id === v)) return v as GroqModelId;
  } catch {
    /* ignore */
  }
  return DEFAULT_GROQ_MODEL;
}

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
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const [accountLabel, setAccountLabel] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setModel(loadModel());
  }, []);

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
    const active = getActiveFalixAccount();
    setAccountLabel(active?.label ?? "");
    const credentials = activeCredentials();
    const res = await fetchLogs({
      data: credentials ? { credentials } : {},
    });
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
    const onAccount = () => void loadLogs();
    window.addEventListener(ACTIVE_ACCOUNT_EVENT, onAccount);
    return () => window.removeEventListener(ACTIVE_ACCOUNT_EVENT, onAccount);
  }, [loadLogs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy, threadId]);

  function onModelChange(id: string) {
    const next = (GROQ_MODELS.some((m) => m.id === id) ? id : DEFAULT_GROQ_MODEL) as GroqModelId;
    setModel(next);
    try {
      window.localStorage.setItem(MODEL_KEY, next);
    } catch {
      /* ignore */
    }
  }

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

  function credPayload() {
    const credentials = activeCredentials();
    const active = getActiveFalixAccount();
    return {
      ...(credentials ? { credentials } : {}),
      accountLabel: active?.label,
    };
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
          model,
          ...credPayload(),
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
      const label = getActiveFalixAccount()?.label ?? "account";
      const warn =
        risk === "critical"
          ? `AZIONE CRITICA su "${label}": "${def?.label ?? id}". Confermi?`
          : `Approvi l'azione "${def?.label ?? id}" su "${label}"?`;
      if (!window.confirm(warn)) return "Azione annullata.";
    }
    const credentials = activeCredentials();
    const res = await execAction({
      data: {
        id,
        params,
        approved: risk !== "read",
        ...(credentials ? { credentials } : {}),
      },
    });
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
    const credentials = activeCredentials();
    const res = await exec({
      data: { command: cmd, ...(credentials ? { credentials } : {}) },
    });
    updateProposal(mi, pi, { state: "done", output: res.output });
    setConsoleOut((o) => [...o, `> ${cmd}`, res.output]);
    void loadLogs();
  }

  async function onSendCommand() {
    const cmd = command.trim();
    if (!cmd) return;
    setCommand("");
    const credentials = activeCredentials();
    const res = await exec({
      data: { command: cmd, ...(credentials ? { credentials } : {}) },
    });
    setConsoleOut((o) => [...o, `> ${cmd}`, res.output]);
    void loadLogs();
  }

  return (
    <AppShell
      title="Chat IA"
      subtitle={
        accountLabel
          ? `Operazioni su account Falix: ${accountLabel}`
          : "Crea account Falix in Competenze · Groq legge i log dell'account attivo"
      }
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[200px_1fr_1fr] lg:p-6">
        <aside className="panel flex max-h-[70vh] flex-col p-3">
          <button
            onClick={onNewChat}
            className="mb-3 flex items-center justify-center gap-2 rounded-md border border-primary px-3 py-2 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> nuova chat
          </button>
          <div className="flex-1 space-y-1 overflow-y-auto">
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
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] text-muted-foreground hover:text-primary"
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  onClick={() => onDeleteChat(t.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel flex h-[70vh] flex-col p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-primary">
              <Bot className="h-4 w-4" /> assistente
            </h2>
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:border-primary"
            >
              {GROQ_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto text-sm">
            {messages.length === 0 ? (
              <p className="text-muted-foreground">
                Es. <span className="text-primary">"perché il server lagga?"</span>
                {accountLabel ? (
                  <span className="mt-1 block text-[11px]">
                    Contesto log: <span className="text-primary">{accountLabel}</span>
                  </span>
                ) : null}
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
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.proposals?.map((p, pi) => (
                  <div key={pi} className="mt-2 rounded border border-border p-2">
                    <p className="font-mono text-xs text-primary">/{p.comando}</p>
                    {p.state === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => void confirmProposal(mi, pi, p.comando)}
                          className="flex items-center gap-1 rounded border border-primary px-2 py-1 text-[11px] text-primary"
                        >
                          <Check className="h-3 w-3" /> conferma
                        </button>
                        <button
                          onClick={() => updateProposal(mi, pi, { state: "rejected" })}
                          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          <X className="h-3 w-3" /> rifiuta
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {p.state === "done" ? p.output ?? "ok" : "rifiutato"}
                      </p>
                    )}
                  </div>
                ))}
                {m.actions?.map((a, ai) => {
                  const risk = getAction(a.id)?.risk ?? "critical";
                  return (
                    <div key={ai} className="mt-2 rounded border border-border p-2">
                      <p className="font-mono text-xs text-primary">{a.id}</p>
                      {a.state === "pending" ? (
                        <button
                          onClick={() => void confirmAction(mi, ai, a)}
                          className="mt-2 flex items-center gap-1 rounded border border-primary px-2 py-1 text-[11px] text-primary"
                        >
                          <ShieldAlert className="h-3 w-3" /> approva
                        </button>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">{a.output ?? a.state}</p>
                      )}
                      <span className="text-[9px] text-muted-foreground">{riskLabel(risk)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {busy ? <p className="text-xs text-primary">Analisi log…</p> : null}
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
              placeholder="Chiedi sul server…"
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => void onAsk()}
              disabled={busy}
              className="rounded-md border border-primary px-3 text-xs uppercase tracking-widest text-primary disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-2 flex justify-between">
              <h2 className="text-sm uppercase tracking-widest text-primary">
                Log{accountLabel ? ` · ${accountLabel}` : ""}
              </h2>
              <button onClick={() => void loadLogs()} className="text-muted-foreground hover:text-primary">
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
            {(logDemo || logError) && (
              <p className="mb-2 flex gap-1 text-[11px] text-warning">
                <AlertTriangle className="h-3 w-3" /> {logError ?? "Log demo"}
              </p>
            )}
            <div className="max-h-40 overflow-y-auto font-mono text-[11px] text-muted-foreground">
              {logs.map((l, i) => (
                <p key={i} className={l.level === "error" ? "text-destructive" : undefined}>
                  {l.message}
                </p>
              ))}
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm uppercase tracking-widest text-primary">
              <Terminal className="h-4 w-4" /> console
            </h2>
            <div className="mb-2 max-h-28 overflow-y-auto font-mono text-[11px] text-muted-foreground">
              {consoleOut.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onSendCommand();
                }}
                placeholder="say ciao"
                className="flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
              />
              <button
                onClick={() => void onSendCommand()}
                className="rounded border border-primary px-2 text-[11px] text-primary"
              >
                invia
              </button>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm uppercase tracking-widest text-primary">
              <Zap className="h-4 w-4" /> azioni
            </h2>
            <select
              value={actionId}
              onChange={(e) => setActionId(e.target.value)}
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
            >
              {FALIX_ACTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id}
                </option>
              ))}
            </select>
            <textarea
              value={actionParams}
              onChange={(e) => setActionParams(e.target.value)}
              rows={2}
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]"
            />
            <button
              onClick={() => void onRunManualAction()}
              className="rounded border border-primary px-3 py-1 text-[11px] uppercase text-primary"
            >
              esegui
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
