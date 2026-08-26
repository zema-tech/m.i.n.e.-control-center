import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Check,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  Terminal,
  Trash2,
  Zap,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { LogViewer } from "@/components/LogViewer";
import {
  ACTIVE_ACCOUNT_EVENT,
  activeCredentials,
  getActiveFalixAccount,
  listStorageAccounts,
  type ApiAccount,
} from "@/lib/accounts";
import { buildBrainContextForPrompt } from "@/lib/agent-brain";
import { logAiActivity } from "@/lib/ai-activity";
import { getAuthState } from "@/lib/auth.functions";
import {
  askAssistant,
  getLogs,
  researchHost,
  runCommand,
  runFalixAction,
  runOneHand,
  runStorageAction,
} from "@/lib/panel.functions";
import { FALIX_ACTIONS, getAction, riskLabel, type ActionRisk } from "@/lib/falix-actions";
import {
  CONNECTOR_MCP_TOOLS,
  GDRIVE_MCP_TOOLS,
  MEGA_MCP_TOOLS,
  ONE_MCP_TOOLS,
  RESEARCH_MCP_TOOLS,
  type McpTool,
} from "@/lib/mcp";
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
  head: () => ({ meta: [{ title: "Chat JARVIS — M.I.N.E" }] }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: AssistantPage,
});

type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };
const MODEL_KEY = "mine.groq.model";

const STORAGE_TOOLS = [...MEGA_MCP_TOOLS, ...GDRIVE_MCP_TOOLS];
const STORAGE_BY_ID = new Map(STORAGE_TOOLS.map((t) => [t.name, t]));
const CONNECTOR_BY_ID = new Map(CONNECTOR_MCP_TOOLS.map((t) => [t.name, t]));
const ONE_BY_ID = new Map(ONE_MCP_TOOLS.map((t) => [t.name, t]));
const RESEARCH_BY_ID = new Map(RESEARCH_MCP_TOOLS.map((t) => [t.name, t]));

function isStorageTool(id: string) {
  return STORAGE_BY_ID.has(id);
}
function isConnectorTool(id: string) {
  return CONNECTOR_BY_ID.has(id);
}
function isOneTool(id: string) {
  return ONE_BY_ID.has(id);
}
function isResearchTool(id: string) {
  return RESEARCH_BY_ID.has(id);
}

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

function accountCtx() {
  const active = getActiveFalixAccount();
  return {
    accountId: active?.id ?? "unknown",
    accountLabel: active?.label ?? "server",
  };
}

function pickStorageAccount(toolId: string): ApiAccount | null {
  const tool = STORAGE_BY_ID.get(toolId);
  if (!tool) return null;
  const list = listStorageAccounts().filter((a) => a.provider === tool.provider && a.apiKey);
  return list[0] ?? null;
}

function runConnectorToolLocal(
  tool: McpTool,
  params: Record<string, string | number | boolean>,
  ctx: { accountLabel: string },
): string {
  switch (tool.name) {
    case "conn_discord_status":
      return `Discord status preparato per "${params.serverLabel ?? ctx.accountLabel}": ${params.status ?? "n/d"}.`;
    case "conn_discord_notify":
      return `Notifica Discord registrata [${params.level ?? "info"}]: ${String(params.message ?? "").slice(0, 200)}.`;
    case "conn_webhook_ping":
      return `Ping webhook registrato (${params.urlHint ?? "default"}).`;
    case "conn_skill_check": {
      const active = getActiveFalixAccount();
      return `Skill account "${active?.label ?? "?"}": ${active?.skills?.join(", ") || "nessuna"}.`;
    }
    case "conn_backup_pipeline":
      return `Pipeline backup → ${params.target ?? "?"} proposta (path ${params.sourcePath ?? "/world"}).`;
    default:
      return `Tool connettore ${tool.name} eseguito in locale.`;
  }
}

function AssistantPage() {
  const { threadId } = Route.useParams();
  const navigate = Route.useNavigate();
  const ask = useServerFn(askAssistant);
  const fetchLogs = useServerFn(getLogs);
  const exec = useServerFn(runCommand);
  const execAction = useServerFn(runFalixAction);
  const execStorage = useServerFn(runStorageAction);
  const execOne = useServerFn(runOneHand);
  const execResearch = useServerFn(researchHost);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logDemo, setLogDemo] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [actionId, setActionId] = useState("list_one_integrations");
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
    const ctx = accountCtx();
    const withUser: Msg[] = [...messages, { role: "user", content: question }];
    persist(withUser);
    try {
      const res = await ask({
        data: {
          question,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          model,
          brainContext: buildBrainContextForPrompt(),
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

      logAiActivity({
        ...ctx,
        kind: "chat",
        title: question.slice(0, 80),
        detail: res.risposta.slice(0, 400),
        status: res.ok === false ? "error" : "done",
      });
      for (const c of res.comandi ?? []) {
        logAiActivity({
          ...ctx,
          kind: "propose_command",
          title: `Proposta: ${c.comando}`,
          detail: c.motivo,
          status: "pending",
        });
      }
      for (const a of res.azioni ?? []) {
        logAiActivity({
          ...ctx,
          kind: "propose_action",
          title: `Proposta: ${a.id}`,
          detail: a.motivo,
          status: "pending",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      persist([...withUser, { role: "assistant", content: message }]);
      logAiActivity({
        ...ctx,
        kind: "chat",
        title: "Errore chat IA",
        detail: message,
        status: "error",
      });
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

  function resolveRisk(id: string): ActionRisk {
    if (isOneTool(id)) return ONE_BY_ID.get(id)?.risk ?? "write";
    if (isResearchTool(id)) return "read";
    if (isStorageTool(id)) return STORAGE_BY_ID.get(id)?.risk ?? "write";
    if (isConnectorTool(id)) return CONNECTOR_BY_ID.get(id)?.risk ?? "write";
    return getAction(id)?.risk ?? "critical";
  }

  async function runCatalogAction(
    id: string,
    params: Record<string, string | number | boolean>,
    risk: ActionRisk,
  ): Promise<string> {
    const ctx = accountCtx();

    if (isOneTool(id)) {
      const tool = ONE_BY_ID.get(id)!;
      if (tool.risk !== "read") {
        if (
          !window.confirm(
            `Mani One — "${tool.name}" su app esterne. Confermi? (MCP: mcp.withone.ai)`,
          )
        ) {
          logAiActivity({ ...ctx, kind: "reject", title: `Rifiutata: ${id}`, status: "rejected" });
          return "Azione One annullata.";
        }
      }
      const res = await execOne({
        data: {
          tool: id as
            | "list_one_integrations"
            | "search_one_platform_actions"
            | "get_one_action_knowledge"
            | "execute_one_action",
          params,
          approved: tool.risk !== "read",
        },
      });
      setConsoleOut((o) => [...o, `> one ${id}`, res.output]);
      logAiActivity({
        ...ctx,
        kind: "execute_action",
        title: `One: ${id}`,
        detail: res.output.slice(0, 400),
        status: res.ok === false ? "error" : "done",
      });
      return res.output;
    }

    if (isResearchTool(id)) {
      const q = String(params.query ?? "");
      if (!q) return "host_research richiede params.query";
      const res = await execResearch({ data: { query: q, model } });
      const output =
        res.ok && "report" in res
          ? JSON.stringify(res.report, null, 2).slice(0, 4000)
          : (res as { message?: string }).message ?? "Research fallita";
      setConsoleOut((o) => [...o, `> research ${q}`, output.slice(0, 500)]);
      logAiActivity({
        ...ctx,
        kind: "execute_action",
        title: `Research: ${q}`,
        detail: output.slice(0, 400),
        status: res.ok ? "done" : "error",
      });
      return output;
    }

    if (isConnectorTool(id)) {
      const tool = CONNECTOR_BY_ID.get(id)!;
      if (tool.risk !== "read") {
        if (!window.confirm(`Approvi il tool connettore "${tool.name}"?`)) {
          logAiActivity({ ...ctx, kind: "reject", title: `Rifiutata: ${id}`, status: "rejected" });
          return "Azione connettore annullata.";
        }
      }
      const output = runConnectorToolLocal(tool, params, ctx);
      setConsoleOut((o) => [...o, `> connector ${id}`, output]);
      logAiActivity({
        ...ctx,
        kind: "execute_action",
        title: `Connector: ${id}`,
        detail: output,
        status: "done",
      });
      return output;
    }

    if (isStorageTool(id)) {
      const tool = STORAGE_BY_ID.get(id)!;
      const acc = pickStorageAccount(id);
      if (!acc) {
        return `Nessun account ${tool.provider} in Competenze.`;
      }
      if (tool.risk !== "read") {
        if (!window.confirm(`Approvi storage "${tool.name}" (${acc.label})?`)) {
          return "Azione storage annullata.";
        }
      }
      const res = await execStorage({
        data: {
          tool: id as
            | "mega_status"
            | "mega_list"
            | "mega_upload_note"
            | "mega_share_link"
            | "gdrive_status"
            | "gdrive_list"
            | "gdrive_upload_note"
            | "gdrive_create_folder",
          params,
          approved: tool.risk !== "read",
          storage: {
            provider: tool.provider as "mega" | "gdrive",
            apiKey: acc.apiKey,
            serverId: acc.serverId || undefined,
            baseUrl: acc.baseUrl || undefined,
          },
        },
      });
      setConsoleOut((o) => [...o, `> storage ${id}`, res.output]);
      return res.output;
    }

    if (risk !== "read") {
      const def = getAction(id);
      if (
        !window.confirm(
          risk === "critical"
            ? `AZIONE CRITICA: "${def?.label ?? id}". Confermi?`
            : `Approvi "${def?.label ?? id}"?`,
        )
      ) {
        return "Azione annullata.";
      }
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
    const risk = resolveRisk(a.id);
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
    await runCatalogAction(actionId, params, resolveRisk(actionId));
  }

  async function confirmProposal(mi: number, pi: number, cmd: string) {
    const ctx = accountCtx();
    const credentials = activeCredentials();
    const res = await exec({
      data: { command: cmd, ...(credentials ? { credentials } : {}) },
    });
    updateProposal(mi, pi, { state: "done", output: res.output });
    setConsoleOut((o) => [...o, `> ${cmd}`, res.output]);
    logAiActivity({
      ...ctx,
      kind: "execute_command",
      title: `Comando: ${cmd}`,
      detail: res.output,
      status: res.ok === false ? "error" : "done",
    });
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

  const actionOptions = [
    ...ONE_MCP_TOOLS.map((t) => ({ id: t.name, label: `[one] ${t.name}` })),
    ...RESEARCH_MCP_TOOLS.map((t) => ({ id: t.name, label: `[research] ${t.name}` })),
    ...FALIX_ACTIONS.map((a) => ({ id: a.id, label: a.id })),
    ...STORAGE_TOOLS.map((t) => ({ id: t.name, label: `[${t.provider}] ${t.name}` })),
    ...CONNECTOR_MCP_TOOLS.map((t) => ({ id: t.name, label: `[conn] ${t.name}` })),
  ];

  return (
    <AppShell
      title="Chat ops"
      subtitle={
        accountLabel
          ? `JARVIS · ${accountLabel} · 4 pilastri + mani One`
          : "JARVIS — carattere · memoria · mani · regole"
      }
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[200px_1fr_1fr] lg:p-6">
        <aside className="panel flex max-h-[70vh] flex-col p-3">
          <button
            onClick={onNewChat}
            className="btn-matrix mb-3 flex items-center justify-center gap-2 rounded-md border border-primary px-3 py-2 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> nuova chat
          </button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {threads.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${
                  t.id === threadId ? "border-primary bg-primary/5" : "border-border"
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
                <button onClick={() => onDeleteChat(t.id)} className="btn-matrix text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel flex h-[70vh] flex-col p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-section text-primary">
              <Bot className="h-4 w-4" /> jarvis
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
                Configura i 4 pilastri in{" "}
                <span className="text-primary">/agent</span> poi chiedi pure.
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
                <p className="mb-1 text-caption uppercase tracking-widest text-muted-foreground">
                  {m.role === "user" ? "tu" : "jarvis"}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.proposals?.map((p, pi) => (
                  <div key={pi} className="mt-2 rounded border border-border p-2">
                    <p className="font-mono text-xs text-primary">/{p.comando}</p>
                    {p.state === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => void confirmProposal(mi, pi, p.comando)}
                          className="btn-matrix flex items-center gap-1 rounded border border-primary px-2 py-1 text-[11px] text-primary"
                        >
                          <Check className="h-3 w-3" /> conferma
                        </button>
                        <button
                          onClick={() => updateProposal(mi, pi, { state: "rejected" })}
                          className="btn-matrix flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground"
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
                  const risk = resolveRisk(a.id);
                  return (
                    <div key={ai} className="mt-2 rounded border border-border p-2">
                      <p className="font-mono text-xs text-primary">{a.id}</p>
                      {a.motivo ? (
                        <p className="text-[11px] text-muted-foreground">{a.motivo}</p>
                      ) : null}
                      {a.state === "pending" ? (
                        <button
                          onClick={() => void confirmAction(mi, ai, a)}
                          className="btn-matrix mt-2 flex items-center gap-1 rounded border border-primary px-2 py-1 text-[11px] text-primary"
                        >
                          <ShieldAlert className="h-3 w-3" /> approva mani
                        </button>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
                          {a.output ?? a.state}
                        </p>
                      )}
                      <span className="text-[9px] text-muted-foreground">{riskLabel(risk)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {busy ? <p className="text-xs text-primary">JARVIS sta ragionando…</p> : null}
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
              placeholder="Ops server, One/Gmail/Slack, host research…"
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => void onAsk()}
              disabled={busy}
              className="btn-matrix rounded-md border border-primary px-3 text-xs uppercase tracking-widest text-primary disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <LogViewer
            title={accountLabel ? `Log · ${accountLabel}` : "Log"}
            lines={logs}
            demo={logDemo}
            error={logError}
            onRefresh={() => void loadLogs()}
          />

          <section className="panel p-4">
            <h2 className="mb-2 flex items-center gap-2 text-section text-primary">
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
                className="btn-matrix rounded border border-primary px-2 text-[11px] text-primary"
              >
                invia
              </button>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="mb-2 flex items-center gap-2 text-section text-primary">
              <Zap className="h-4 w-4" /> mani (One + MCP)
            </h2>
            <p className="mb-2 text-caption text-muted-foreground">
              One: mcp.withone.ai · oppure ONE_API_KEY su Vercel
            </p>
            <select
              value={actionId}
              onChange={(e) => setActionId(e.target.value)}
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
            >
              {actionOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <textarea
              value={actionParams}
              onChange={(e) => setActionParams(e.target.value)}
              rows={2}
              placeholder='{"platform":"gmail","query":"send email"}'
              className="mb-2 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:border-primary"
            />
            <button
              onClick={() => void onRunManualAction()}
              className="btn-matrix rounded border border-primary px-3 py-1 text-[11px] uppercase text-primary"
            >
              esegui mani
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
