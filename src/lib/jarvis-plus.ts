/**
 * Jarvis Plus — funzioni stile Grok/Claude (client-safe, no Node deps).
 *
 * - Memorie locali per account (Claude-like memory, ma solo browser).
 * - Slash command (/aiuto, /memorizza, /ricorda, /dimentica, /skill, ...).
 * - Sintesi vocale per le risposte (Grok voice, solo TTS locale browser).
 *
 * VibeSec: tutto resta in localStorage dell'account; le memorie entrano nel
 * prompt con cap di caratteri; nessuno secret qui (PAT/MCP restano nei loro
 * moduli dedicati).
 */

export type JarvisMemoryItem = {
  id: string;
  text: string;
  createdAt: number;
};

const MEM_PREFIX = "omnicore.jarvis.memory.v1.";
const MEM_MAX_ITEMS = 50;
const MEM_MAX_CHARS = 300;
const MEM_PROMPT_BUDGET = 1500;

function memKey(accountKey: string): string {
  const safe = (accountKey || "local").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `${MEM_PREFIX}${safe}`;
}

function memId(): string {
  return `mem_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function loadJarvisMemories(accountKey: string): JarvisMemoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(memKey(accountKey));
    if (!raw) return [];
    const list = JSON.parse(raw) as JarvisMemoryItem[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((m) => m && typeof m.text === "string" && typeof m.id === "string")
      .map((m) => ({
        id: m.id.slice(0, 64),
        text: m.text.slice(0, MEM_MAX_CHARS),
        createdAt: typeof m.createdAt === "number" ? m.createdAt : 0,
      }))
      .slice(0, MEM_MAX_ITEMS);
  } catch {
    return [];
  }
}

function saveJarvisMemories(accountKey: string, list: JarvisMemoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(memKey(accountKey), JSON.stringify(list.slice(0, MEM_MAX_ITEMS)));
  } catch {
    /* quota piena: si perde la più vecchia al prossimo add */
  }
}

export function addJarvisMemory(accountKey: string, text: string): JarvisMemoryItem | null {
  const clean = text.trim().replace(/\s+/g, " ").slice(0, MEM_MAX_CHARS);
  if (clean.length < 2) return null;
  const list = loadJarvisMemories(accountKey);
  if (list.some((m) => m.text.toLowerCase() === clean.toLowerCase())) return null;
  const item: JarvisMemoryItem = { id: memId(), text: clean, createdAt: Date.now() };
  saveJarvisMemories(accountKey, [item, ...list].slice(0, MEM_MAX_ITEMS));
  return item;
}

export function removeJarvisMemory(accountKey: string, id: string): JarvisMemoryItem[] {
  const next = loadJarvisMemories(accountKey).filter((m) => m.id !== id);
  saveJarvisMemories(accountKey, next);
  return next;
}

/** Blocco compatto da iniettare nel brain context (budget 1500 char). */
export function formatJarvisMemoriesForPrompt(accountKey: string): string {
  const list = loadJarvisMemories(accountKey);
  if (list.length === 0) return "";
  const lines = list.map((m, i) => `${i + 1}. ${m.text}`);
  let out = lines.join("\n");
  if (out.length > MEM_PROMPT_BUDGET) out = out.slice(0, MEM_PROMPT_BUDGET) + "…";
  return `### Memorie Jarvis (preferenze/fatti salvati con /memorizza)\n${out}`;
}

/**
 * Export/import memorie (backup portabile).
 * VibeSec import: JSON validato — array di stringhe/oggetti, cap count/chars,
 * niente prototype pollution (__proto__/constructor rifiutati).
 */
export function exportJarvisMemories(accountKey: string): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), items: loadJarvisMemories(accountKey) },
    null,
    2,
  );
}

export function importJarvisMemories(
  accountKey: string,
  raw: string,
): { added: number; skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File non JSON.");
  }
  const arr = (
    Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : null
  ) as unknown[] | null;
  if (!arr) throw new Error("Formato non valido (serve array o {items}).");
  let added = 0;
  let skipped = 0;
  for (const entry of arr.slice(0, MEM_MAX_ITEMS * 2)) {
    if (added >= MEM_MAX_ITEMS) break;
    const text =
      typeof entry === "string"
        ? entry
        : typeof entry === "object" &&
            entry !== null &&
            typeof (entry as { text?: unknown }).text === "string"
          ? String((entry as { text: unknown }).text)
          : "";
    if (!text || /__proto__|constructor|prototype/i.test(text)) {
      skipped++;
      continue;
    }
    if (addJarvisMemory(accountKey, text)) added++;
    else skipped++;
  }
  return { added, skipped };
}

// ─── Slash command ────────────────────────────────────────────────────────────

export type SlashCmd =
  | "aiuto"
  | "memorizza"
  | "ricorda"
  | "dimentica"
  | "skill"
  | "skills"
  | "pulisci"
  | "esporta"
  | "riprova";

export const SLASH_LIST: { cmd: SlashCmd; hint: string }[] = [
  { cmd: "aiuto", hint: "/aiuto — mostra i comandi" },
  { cmd: "memorizza", hint: "/memorizza <testo> — salva un ricordo" },
  { cmd: "ricorda", hint: "/ricorda — elenca i ricordi" },
  { cmd: "dimentica", hint: "/dimentica <n> — elimina il ricordo n" },
  { cmd: "skill", hint: "/skill <nome> — attiva una skill per il prossimo messaggio" },
  { cmd: "skills", hint: "/skills — catalogo skill attive" },
  { cmd: "pulisci", hint: "/pulisci — svuota la chat corrente" },
  { cmd: "esporta", hint: "/esporta — scarica la chat in .md" },
  { cmd: "riprova", hint: "/riprova — rigenera l'ultima risposta" },
];

export function parseSlash(input: string): { cmd: SlashCmd; arg: string } | null {
  if (!input.startsWith("/")) return null;
  const space = input.indexOf(" ");
  const raw = (space < 0 ? input.slice(1) : input.slice(1, space)).toLowerCase();
  const arg = (space < 0 ? "" : input.slice(space + 1)).trim().slice(0, 2000);
  if ((SLASH_LIST as { cmd: string }[]).some((s) => s.cmd === raw)) {
    return { cmd: raw as SlashCmd, arg };
  }
  return null;
}

export function slashHelpText(): string {
  return `**Comandi Jarvis**\n${SLASH_LIST.map((s) => `• \`${s.hint}\``).join("\n")}`;
}

// ─── Sintesi vocale (TTS browser, niente rete nostra) ─────────────────────────

export function speakJarvis(text: string): boolean {
  if (typeof window === "undefined") return false;
  const synth = window.speechSynthesis;
  if (!synth) return false;
  try {
    synth.cancel();
    // VibeSec: niente codice nel parlato — solo testo, niente fence.
    const clean = text
      .replace(/```[\s\S]*?```/g, " [codice] ")
      .replace(/[#*_`>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
    if (!clean) return false;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "it-IT";
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopJarvisSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
