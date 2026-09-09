export type Proposal = {
  comando: string;
  motivo: string;
  state: "pending" | "done" | "rejected";
  output?: string;
};

export type ActionProposal = {
  id: string;
  params: Record<string, string | number | boolean>;
  motivo: string;
  state: "pending" | "done" | "rejected";
  output?: string;
};

export type ResidentResultMsg = {
  tool: string;
  ok: boolean;
  output: string;
};

export type Msg = {
  role: "user" | "assistant";
  content: string;
  proposals?: Proposal[];
  actions?: ActionProposal[];
  /** Esito tool memoria/skill/pattern eseguiti in sessione. */
  residentResults?: ResidentResultMsg[];
};

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Msg[];
};

const KEY = "mine.chats.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function newId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function loadThreads(): ChatThread[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatThread[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: ChatThread[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(threads));
  } catch {
    /* ignore — quota privata / storage pieno */
  }
}

export function createThread(): ChatThread {
  const thread: ChatThread = {
    id: newId(),
    title: "Nuova chat",
    updatedAt: Date.now(),
    messages: [],
  };
  saveThreads([thread, ...loadThreads()]);
  return thread;
}

export function ensureThread(id: string): ChatThread {
  const threads = loadThreads();
  const found = threads.find((t) => t.id === id);
  if (found) return found;
  const thread: ChatThread = { id, title: "Nuova chat", updatedAt: Date.now(), messages: [] };
  saveThreads([thread, ...threads]);
  return thread;
}

export function updateThread(id: string, messages: Msg[]): ChatThread[] {
  const threads = loadThreads().map((t) =>
    t.id === id
      ? {
          ...t,
          messages,
          updatedAt: Date.now(),
          title:
            t.title === "Nuova chat" && messages[0]
              ? messages[0].content.slice(0, 40)
              : t.title,
        }
      : t,
  );
  saveThreads(threads);
  return threads.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteThread(id: string): ChatThread[] {
  const threads = loadThreads().filter((t) => t.id !== id);
  saveThreads(threads);
  return threads;
}
