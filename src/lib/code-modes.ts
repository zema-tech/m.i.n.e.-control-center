/**
 * Sezione Codice — ispirata a Kilo Code / Claude Code.
 * Modalità agente specializzate + sessioni locali.
 */

export type CodeModeId = "code" | "architect" | "ask" | "debug" | "review";

export type CodeMode = {
  id: CodeModeId;
  label: string;
  short: string;
  blurb: string;
  systemHint: string;
};

export const CODE_MODES: CodeMode[] = [
  {
    id: "code",
    label: "Code",
    short: "Implementa",
    blurb: "Scrivi, refactora e completa codice production-ready",
    systemHint:
      "MODE CODE: implementa. Produci codice completo e pronto all'uso. Preferisci file multipli se serve. Spiega scelte in breve dopo gli snippet.",
  },
  {
    id: "architect",
    label: "Architect",
    short: "Progetta",
    blurb: "Architettura e piano prima di scrivere codice",
    systemHint:
      "MODE ARCHITECT: NON scrivere codice completo finché non hai un piano. Elenca componenti, rischi, file coinvolti, ordine di implementazione. Snippet solo schematici.",
  },
  {
    id: "ask",
    label: "Ask",
    short: "Spiega",
    blurb: "Domande sul codice senza modificare nulla",
    systemHint:
      "MODE ASK: solo spiegazioni. Non proporre rewrite massivi. Rispondi alla domanda; codice minimo solo come esempio illustrativo.",
  },
  {
    id: "debug",
    label: "Debug",
    short: "Ripara",
    blurb: "Traccia errori, stack e ipotesi di fix",
    systemHint:
      "MODE DEBUG: diagnosi. Elenca ipotesi ordinate, evidenze dal contesto, patch minime. Chiedi log/stack se mancano.",
  },
  {
    id: "review",
    label: "Review",
    short: "Revisiona",
    blurb: "Review sicurezza, performance, stile e test",
    systemHint:
      "MODE REVIEW: code review. Severità (critical/major/minor), file, riga se possibile, fix suggerito. Niente riscritture totali non richieste.",
  },
];

export type CodeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: CodeModeId;
  createdAt: number;
};

export type CodeSession = {
  id: string;
  title: string;
  mode: CodeModeId;
  language: string;
  messages: CodeMessage[];
  updatedAt: number;
};

const KEY = "mine.code.sessions.v1";

function canUse() {
  return typeof window !== "undefined";
}

export function loadCodeSessions(): CodeSession[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CodeSession[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCodeSessions(list: CodeSession[]) {
  if (!canUse()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export function createCodeSession(mode: CodeModeId = "code"): CodeSession {
  const s: CodeSession = {
    id: `code:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: "Nuova sessione",
    mode,
    language: "typescript",
    messages: [],
    updatedAt: Date.now(),
  };
  saveCodeSessions([s, ...loadCodeSessions()]);
  return s;
}

export function updateCodeSession(id: string, patch: Partial<CodeSession>) {
  const list = loadCodeSessions().map((s) =>
    s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
  );
  saveCodeSessions(list);
  return list.find((s) => s.id === id);
}

export function appendCodeMessage(
  sessionId: string,
  msg: Omit<CodeMessage, "id" | "createdAt">,
) {
  const list = loadCodeSessions();
  const s = list.find((x) => x.id === sessionId);
  if (!s) return null;
  const full: CodeMessage = {
    ...msg,
    id: `m:${Date.now().toString(36)}`,
    createdAt: Date.now(),
  };
  s.messages = [...s.messages, full].slice(-40);
  if (s.title === "Nuova sessione" && msg.role === "user") {
    s.title = msg.content.slice(0, 48) || s.title;
  }
  s.updatedAt = Date.now();
  saveCodeSessions(list);
  return s;
}

export function deleteCodeSession(id: string) {
  saveCodeSessions(loadCodeSessions().filter((s) => s.id !== id));
}

export function getCodeMode(id: CodeModeId): CodeMode {
  return CODE_MODES.find((m) => m.id === id) ?? CODE_MODES[0]!;
}

export const CODE_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "java",
  "kotlin",
  "go",
  "rust",
  "bash",
  "sql",
  "yaml",
  "other",
] as const;
