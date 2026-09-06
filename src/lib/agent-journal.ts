/**
 * Diario agente — ispirato al notepad / session notes di Hermes.
 * Una pagina al giorno: lezioni, decisioni, follow-up.
 */

export type JournalEntry = {
  id: string;
  /** YYYY-MM-DD (locale) */
  day: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

const KEY = "mine.agent.journal.v1";

function canUse() {
  return typeof window !== "undefined";
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadJournal(): JournalEntry[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as JournalEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list: JournalEntry[]) {
  if (canUse()) window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 120)));
  return list;
}

export function getEntryForDay(day: string): JournalEntry | undefined {
  return loadJournal().find((e) => e.day === day);
}

export function upsertJournal(body: string, tags: string[] = [], day = todayKey()): JournalEntry {
  const list = loadJournal();
  const now = Date.now();
  const i = list.findIndex((e) => e.day === day);
  if (i >= 0) {
    list[i] = {
      ...list[i],
      body: body.slice(0, 8000),
      tags: tags.slice(0, 12),
      updatedAt: now,
    };
    persist(list);
    return list[i];
  }
  const entry: JournalEntry = {
    id: `j${now.toString(36)}`,
    day,
    body: body.slice(0, 8000),
    tags: tags.slice(0, 12),
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(entry);
  persist(list);
  return entry;
}

export function appendJournalLine(line: string, day = todayKey()): JournalEntry {
  const existing = getEntryForDay(day);
  const stamp = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const chunk = `[${stamp}] ${line.trim()}`;
  const body = existing?.body ? `${existing.body}\n${chunk}` : chunk;
  return upsertJournal(body, existing?.tags ?? [], day);
}

export function formatJournalForPrompt(limitDays = 3): string {
  const list = loadJournal().slice(0, limitDays);
  if (list.length === 0) return "### Diario\n(nessuna nota recente)";
  return [
    "### Diario recente (session notes)",
    ...list.map((e) => `— ${e.day}\n${e.body.slice(0, 600)}`),
  ].join("\n");
}
