/**
 * Traccia le azioni dell'IA per account/server (Gino, Edo, …).
 * Persistenza locale: in Rete si vede come l'IA ha agito sul server scelto.
 */

export type AiActivityKind =
  | "analysis"
  | "chat"
  | "propose_command"
  | "propose_action"
  | "execute_command"
  | "execute_action"
  | "reject";

export type AiActivity = {
  id: string;
  accountId: string;
  accountLabel: string;
  kind: AiActivityKind;
  title: string;
  detail: string;
  status: "info" | "pending" | "done" | "rejected" | "error";
  ts: number;
};

const KEY = "mine.ai.activity.v1";
const MAX = 80;
export const AI_ACTIVITY_EVENT = "mine:ai-activity";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadAiActivity(): AiActivity[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as AiActivity[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: AiActivity[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  window.dispatchEvent(new CustomEvent(AI_ACTIVITY_EVENT));
}

export function logAiActivity(input: {
  accountId: string;
  accountLabel: string;
  kind: AiActivityKind;
  title: string;
  detail?: string;
  status?: AiActivity["status"];
}): AiActivity {
  const entry: AiActivity = {
    id: `ai:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    accountId: input.accountId || "unknown",
    accountLabel: input.accountLabel || "server",
    kind: input.kind,
    title: input.title.slice(0, 120),
    detail: (input.detail ?? "").slice(0, 500),
    status: input.status ?? "info",
    ts: Date.now(),
  };
  const list = [entry, ...loadAiActivity()].slice(0, MAX);
  save(list);
  return entry;
}

export function activityForAccount(accountId: string, limit = 30): AiActivity[] {
  if (!accountId) return loadAiActivity().slice(0, limit);
  return loadAiActivity()
    .filter((a) => a.accountId === accountId)
    .slice(0, limit);
}

export function kindLabel(kind: AiActivityKind): string {
  switch (kind) {
    case "analysis":
      return "Analisi neurale";
    case "chat":
      return "Chat IA";
    case "propose_command":
      return "Proposta comando";
    case "propose_action":
      return "Proposta azione";
    case "execute_command":
      return "Comando eseguito";
    case "execute_action":
      return "Azione eseguita";
    case "reject":
      return "Rifiutato";
    default:
      return kind;
  }
}

export function statusColor(status: AiActivity["status"]): string {
  switch (status) {
    case "done":
      return "text-primary";
    case "pending":
      return "text-yellow-400";
    case "rejected":
      return "text-muted-foreground";
    case "error":
      return "text-destructive";
    default:
      return "text-foreground/80";
  }
}
