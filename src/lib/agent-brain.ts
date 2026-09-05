/**
 * Cervello agente — modello Hermes (file-based).
 *
 * SOUL.md   → identità / tono (scritto dall'utente)
 * USER.md   → profilo utente (preferenze) — gestito da tool memory target=user
 * MEMORY.md → note agente (ambiente, lezioni) — gestito da tool memory target=memory
 *
 * Storage locale (localStorage). Limiti di caratteri come Hermes.
 * Snapshot congelato a inizio sessione nel system prompt.
 */

import { loadAgentProfile, saveAgentProfile, type AgentProfile } from "./agent-profile";

const KEY_SOUL = "mine.brain.soul.v2";
const KEY_USER = "mine.brain.user.v2";
const KEY_MEMORY = "mine.brain.memory.v2";

/** Limiti stile Hermes (~token budget nel system prompt). */
export const MEMORY_CHAR_LIMIT = 2200;
export const USER_CHAR_LIMIT = 1375;
export const SOUL_CHAR_LIMIT = 6000;

const ENTRY_SEP = "\n§\n";

export type MemoryTarget = "memory" | "user";

export type SoulDoc = {
  content: string;
  updatedAt: number;
};

/** Entry list serializzate come testo separato da § (come Hermes). */
export type MemoryStore = {
  entries: string[];
  updatedAt: number;
};

export type BrainBackup = {
  version: 2;
  exportedAt: number;
  profile: AgentProfile;
  soul: SoulDoc;
  user: MemoryStore;
  memory: MemoryStore;
};

function canUse() {
  return typeof window !== "undefined";
}

export const DEFAULT_SOUL = `Sei JARVIS, assistente personale dell'utente nel Control Center M.I.N.E. / Omnicore.

Stile:
- Diretto: la lunghezza della risposta segue il peso della richiesta.
- Niente filler ("Ottima domanda", "Certamente").
- Italiano nativo, tono competente; un filo ironico solo se aiuta.
- Preferisci passi concreti a discorsi vaghi.

Comportamento:
- L'IA propone, l'umano conferma sulle azioni write/critical.
- Non inventare log, output tool o risultati di azioni non eseguite.
- Se manca contesto, chiedi o proponi uno strumento di lettura.
- Read prima di write quando possibile.

Evita:
- Esporre o chiedere secret/API key in chiaro.
- Fingere esecuzioni desktop/host non disponibili.
- Azioni distruttive senza rischio esplicito e conferma.`;

function loadStore(key: string): MemoryStore {
  if (!canUse()) return { entries: [], updatedAt: 0 };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { entries: [], updatedAt: 0 };
    const p = JSON.parse(raw) as Partial<MemoryStore>;
    const entries = Array.isArray(p.entries)
      ? p.entries.filter((e) => typeof e === "string" && e.trim().length > 0).map((e) => e.trim())
      : [];
    return { entries, updatedAt: p.updatedAt ?? 0 };
  } catch {
    return { entries: [], updatedAt: 0 };
  }
}

function saveStore(key: string, entries: string[]): MemoryStore {
  const next: MemoryStore = {
    entries: entries.map((e) => e.trim()).filter(Boolean),
    updatedAt: Date.now(),
  };
  if (canUse()) window.localStorage.setItem(key, JSON.stringify(next));
  return next;
}

function charCount(entries: string[]): number {
  if (entries.length === 0) return 0;
  return entries.join(ENTRY_SEP).length;
}

function limitFor(target: MemoryTarget): number {
  return target === "user" ? USER_CHAR_LIMIT : MEMORY_CHAR_LIMIT;
}

function keyFor(target: MemoryTarget): string {
  return target === "user" ? KEY_USER : KEY_MEMORY;
}

// ─── SOUL ───────────────────────────────────────────────────────────────────

export function loadSoul(): SoulDoc {
  if (!canUse()) return { content: DEFAULT_SOUL, updatedAt: 0 };
  try {
    const raw = window.localStorage.getItem(KEY_SOUL);
    if (!raw) {
      // migrazione soft da identity.v1 se presente
      const legacy = window.localStorage.getItem("mine.brain.identity.v1");
      if (legacy) {
        try {
          const p = JSON.parse(legacy) as { character?: string };
          if (p.character?.trim()) {
            const doc = { content: p.character.slice(0, SOUL_CHAR_LIMIT), updatedAt: Date.now() };
            window.localStorage.setItem(KEY_SOUL, JSON.stringify(doc));
            return doc;
          }
        } catch {
          /* ignore */
        }
      }
      return { content: DEFAULT_SOUL, updatedAt: 0 };
    }
    const p = JSON.parse(raw) as Partial<SoulDoc>;
    return {
      content: (p.content ?? DEFAULT_SOUL).slice(0, SOUL_CHAR_LIMIT),
      updatedAt: p.updatedAt ?? 0,
    };
  } catch {
    return { content: DEFAULT_SOUL, updatedAt: 0 };
  }
}

export function saveSoul(content: string): SoulDoc {
  const next: SoulDoc = {
    content: content.slice(0, SOUL_CHAR_LIMIT),
    updatedAt: Date.now(),
  };
  if (canUse()) window.localStorage.setItem(KEY_SOUL, JSON.stringify(next));
  return next;
}

// ─── USER / MEMORY stores ───────────────────────────────────────────────────

export function loadUserStore(): MemoryStore {
  return loadStore(KEY_USER);
}

export function loadMemoryStore(): MemoryStore {
  // migrazione soft da note v1
  const current = loadStore(KEY_MEMORY);
  if (current.entries.length > 0 || !canUse()) return current;
  try {
    const legacy = window.localStorage.getItem("mine.brain.memory.v1");
    if (!legacy) return current;
    const notes = JSON.parse(legacy) as { title?: string; body?: string }[];
    if (!Array.isArray(notes) || notes.length === 0) return current;
    const entries = notes
      .map((n) => {
        const t = (n.title ?? "").trim();
        const b = (n.body ?? "").trim();
        if (!b) return "";
        return t ? `${t}: ${b}` : b;
      })
      .filter(Boolean);
    return saveStore(KEY_MEMORY, entries);
  } catch {
    return current;
  }
}

export type MemoryToolResult =
  | { ok: true; target: MemoryTarget; entries: string[]; usage: string }
  | {
      ok: false;
      error: string;
      current_entries: string[];
      usage: string;
    };

function usageStr(entries: string[], limit: number): string {
  const n = charCount(entries);
  const pct = limit === 0 ? 0 : Math.round((n / limit) * 100);
  return `${pct}% — ${n}/${limit} chars`;
}

/** Tool memory stile Hermes: add | replace | remove. */
export function memoryTool(opts: {
  action: "add" | "replace" | "remove";
  target: MemoryTarget;
  content?: string;
  /** Substring unica per replace/remove. */
  old_text?: string;
}): MemoryToolResult {
  const limit = limitFor(opts.target);
  const key = keyFor(opts.target);
  const store = opts.target === "user" ? loadUserStore() : loadMemoryStore();
  let entries = [...store.entries];

  if (opts.action === "add") {
    const content = (opts.content ?? "").trim();
    if (!content) {
      return {
        ok: false,
        error: "content obbligatorio per add",
        current_entries: entries,
        usage: usageStr(entries, limit),
      };
    }
    if (entries.some((e) => e === content)) {
      return { ok: true, target: opts.target, entries, usage: usageStr(entries, limit) };
    }
    const next = [...entries, content];
    if (charCount(next) > limit) {
      return {
        ok: false,
        error: `Memory at ${charCount(entries)}/${limit} chars. Adding this entry (${content.length} chars) would exceed the limit. Consolidate: use replace/remove, then retry add.`,
        current_entries: entries,
        usage: usageStr(entries, limit),
      };
    }
    entries = next;
    saveStore(key, entries);
    return { ok: true, target: opts.target, entries, usage: usageStr(entries, limit) };
  }

  const needle = (opts.old_text ?? "").trim();
  if (!needle) {
    return {
      ok: false,
      error: "old_text obbligatorio per replace/remove",
      current_entries: entries,
      usage: usageStr(entries, limit),
    };
  }
  const matches = entries.filter((e) => e.includes(needle));
  if (matches.length === 0) {
    return {
      ok: false,
      error: `Nessuna entry contiene "${needle.slice(0, 40)}"`,
      current_entries: entries,
      usage: usageStr(entries, limit),
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: `old_text ambigua: match ${matches.length} entry. Sii più specifico.`,
      current_entries: entries,
      usage: usageStr(entries, limit),
    };
  }
  const idx = entries.findIndex((e) => e.includes(needle));

  if (opts.action === "remove") {
    entries = entries.filter((_, i) => i !== idx);
    saveStore(key, entries);
    return { ok: true, target: opts.target, entries, usage: usageStr(entries, limit) };
  }

  // replace
  const content = (opts.content ?? "").trim();
  if (!content) {
    return {
      ok: false,
      error: "content obbligatorio per replace",
      current_entries: entries,
      usage: usageStr(entries, limit),
    };
  }
  const trial = entries.map((e, i) => (i === idx ? content : e));
  if (charCount(trial) > limit) {
    return {
      ok: false,
      error: `Replace would exceed ${limit} chars (${charCount(trial)}). Accorcia content o rimuovi altre entry.`,
      current_entries: entries,
      usage: usageStr(entries, limit),
    };
  }
  entries = trial;
  saveStore(key, entries);
  return { ok: true, target: opts.target, entries, usage: usageStr(entries, limit) };
}

/** Render blocco MEMORY / USER per system prompt (snapshot). */
export function formatMemoryBlock(
  label: string,
  entries: string[],
  limit: number,
): string {
  const usage = usageStr(entries, limit);
  const body = entries.length === 0 ? "(vuoto)" : entries.join(ENTRY_SEP);
  return [
    "══════════════════════════════════════════════",
    `${label} [${usage}]`,
    "══════════════════════════════════════════════",
    body,
  ].join("\n");
}

/** Testo da iniettare nel prompt — ordine Hermes: SOUL → MEMORY → USER. */
export function buildBrainContextForPrompt(opts?: {
  profile?: AgentProfile;
}): string {
  const profile = opts?.profile ?? loadAgentProfile();
  const soul = loadSoul();
  const memory = loadMemoryStore();
  const user = loadUserStore();

  return [
    "### SOUL (identità agente)",
    `Nome UI: ${profile.name} · ${profile.tagline}`,
    soul.content.trim() || DEFAULT_SOUL,
    "",
    formatMemoryBlock("MEMORY (note agente)", memory.entries, MEMORY_CHAR_LIMIT),
    "",
    formatMemoryBlock("USER (profilo utente)", user.entries, USER_CHAR_LIMIT),
    "",
    "### Tools / mani disponibili",
    "Falix host (power/console/file), storage MEGA/Drive, One MCP, host_research, sezione Codice.",
    "Write/critical solo dopo conferma umana. Non fingere tool non eseguiti.",
  ].join("\n");
}

// ─── Backup ─────────────────────────────────────────────────────────────────

export function exportBrainBackup(): BrainBackup {
  return {
    version: 2,
    exportedAt: Date.now(),
    profile: loadAgentProfile(),
    soul: loadSoul(),
    user: loadUserStore(),
    memory: loadMemoryStore(),
  };
}

export function importBrainBackup(data: unknown): { ok: boolean; message: string } {
  try {
    const b = data as Partial<BrainBackup> & {
      version?: number;
      identity?: { character?: string };
      rules?: { rules?: string };
      memory?: unknown;
    };
    if (!b || (b.version !== 2 && b.version !== 1)) {
      return { ok: false, message: "File non valido: serve version 1 o 2" };
    }
    if (b.profile) {
      saveAgentProfile({
        name: b.profile.name,
        tagline: b.profile.tagline,
        focus: b.profile.focus,
        language: b.profile.language,
      });
    }
    if (b.version === 2) {
      if (b.soul?.content) saveSoul(String(b.soul.content));
      if (b.user && Array.isArray(b.user.entries)) {
        saveStore(KEY_USER, b.user.entries.map(String));
      }
      if (b.memory && Array.isArray((b.memory as MemoryStore).entries)) {
        saveStore(KEY_MEMORY, (b.memory as MemoryStore).entries.map(String));
      }
      return { ok: true, message: "Import SOUL / USER / MEMORY (v2)" };
    }
    // v1 legacy
    if (b.identity?.character) saveSoul(String(b.identity.character));
    if (Array.isArray(b.memory)) {
      const notes = b.memory as { title?: string; body?: string }[];
      const entries = notes
        .map((n) => {
          const t = (n.title ?? "").trim();
          const body = (n.body ?? "").trim();
          if (!body) return "";
          return t ? `${t}: ${body}` : body;
        })
        .filter(Boolean);
      saveStore(KEY_MEMORY, entries);
    }
    return { ok: true, message: "Import legacy v1 → SOUL + MEMORY" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Import fallito",
    };
  }
}

export function downloadBrainBackup() {
  if (!canUse()) return;
  const blob = new Blob([JSON.stringify(exportBrainBackup(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `omnicore-brain-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Compat leggera (evita crash import residui) ─────────────────────────────

/** @deprecated usa loadSoul */
export function loadIdentityDoc() {
  const s = loadSoul();
  return { character: s.content, updatedAt: s.updatedAt };
}

/** @deprecated usa saveSoul */
export function saveIdentityDoc(character: string) {
  return saveSoul(character);
}

/** @deprecated regole fuse in SOUL; stub vuoto */
export function loadRulesDoc() {
  return { rules: "", updatedAt: 0 };
}

/** @deprecated */
export function saveRulesDoc(_rules: string) {
  return { rules: "", updatedAt: Date.now() };
}

/** @deprecated usa loadMemoryStore */
export function loadMemoryNotes(): { id: string; title: string; body: string; createdAt: number }[] {
  return loadMemoryStore().entries.map((e, i) => ({
    id: `mem:${i}`,
    title: e.slice(0, 40),
    body: e,
    createdAt: 0,
  }));
}

/** @deprecated */
export function addMemoryNote(title: string, body: string) {
  const content = title.trim() ? `${title.trim()}: ${body.trim()}` : body.trim();
  memoryTool({ action: "add", target: "memory", content });
  return { id: `mem:${Date.now()}`, title, body, createdAt: Date.now() };
}

/** @deprecated */
export function removeMemoryNote(_id: string) {
  /* no-op: usare memoryTool remove */
}

export const DEFAULT_CHARACTER = DEFAULT_SOUL;
export const DEFAULT_RULES = "";
