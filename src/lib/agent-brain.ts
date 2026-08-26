/**
 * Un assistente vero ha quattro cose (modello da identity / memoria / mani / regole):
 * 1. Carattere  — chi è, come parla          → identity
 * 2. Memoria    — cosa sa di te e del contesto → memory notes
 * 3. Mani/Occhi — cosa può toccare e vedere    → connectors / MCP / skills
 * 4. Regole     — cosa non deve fare           → rules (CLAUDE.md-style)
 */

import { loadAgentProfile, saveAgentProfile, type AgentProfile } from "./agent-profile";

const KEY_IDENTITY = "mine.brain.identity.v1";
const KEY_MEMORY = "mine.brain.memory.v1";
const KEY_RULES = "mine.brain.rules.v1";

export type MemoryNote = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
};

export type AgentIdentityDoc = {
  character: string;
  updatedAt: number;
};

export type AgentRulesDoc = {
  rules: string;
  updatedAt: number;
};

/** Backup completo cervello (export/import). */
export type BrainBackup = {
  version: 1;
  exportedAt: number;
  profile: AgentProfile;
  identity: AgentIdentityDoc;
  rules: AgentRulesDoc;
  memory: MemoryNote[];
};

function canUse() {
  return typeof window !== "undefined";
}

export const DEFAULT_CHARACTER = `Sei JARVIS, assistente personale dell'utente.
Parli in italiano, tono competente e diretto (non servile, non prolisso).
Chiami l'utente in modo naturale; sei proattivo sulle ipotesi ma cauto sulle azioni.
Preferisci passi concreti a discorsi vaghi.
Quando agisci, usi le MANI (tool) e aspetti conferma su write/critical.`;

export const DEFAULT_RULES = `# Regole JARVIS (non negoziabili)

## Vietato
- Non inventare log, stacktrace o risultati di tool non eseguiti.
- Non eseguire (né fingere) azioni write/critical senza conferma umana.
- Non esporre o chiedere di ripetere secret/API key in chiaro nelle risposte.
- Non dare /op, wipe world, delete massivi, pagamenti reali senza rischio esplicito e conferma.
- Non aggirare le policy One MCP / access limitati.

## Obbligatorio
- Read prima di write quando possibile.
- Per SaaS: catena One list → search → knowledge → execute.
- Cita evidenze dal contesto; se manca dato, chiedilo o proponi tool di lettura.
- Risposte strutturate: problema → evidenza → piano → azioni proposte.

## Scope
- Host/server (Falix + cloud), codice, connettori One MCP, storage.
- Fuori scope: richieste illegali o dannose → rifiuta in modo chiaro.`;

export function loadIdentityDoc(): AgentIdentityDoc {
  if (!canUse()) return { character: DEFAULT_CHARACTER, updatedAt: 0 };
  try {
    const raw = window.localStorage.getItem(KEY_IDENTITY);
    if (!raw) return { character: DEFAULT_CHARACTER, updatedAt: 0 };
    const p = JSON.parse(raw) as Partial<AgentIdentityDoc>;
    return {
      character: (p.character ?? DEFAULT_CHARACTER).slice(0, 4000),
      updatedAt: p.updatedAt ?? 0,
    };
  } catch {
    return { character: DEFAULT_CHARACTER, updatedAt: 0 };
  }
}

export function saveIdentityDoc(character: string): AgentIdentityDoc {
  const next: AgentIdentityDoc = {
    character: character.slice(0, 4000),
    updatedAt: Date.now(),
  };
  if (canUse()) window.localStorage.setItem(KEY_IDENTITY, JSON.stringify(next));
  return next;
}

export function loadRulesDoc(): AgentRulesDoc {
  if (!canUse()) return { rules: DEFAULT_RULES, updatedAt: 0 };
  try {
    const raw = window.localStorage.getItem(KEY_RULES);
    if (!raw) return { rules: DEFAULT_RULES, updatedAt: 0 };
    const p = JSON.parse(raw) as Partial<AgentRulesDoc>;
    return {
      rules: (p.rules ?? DEFAULT_RULES).slice(0, 6000),
      updatedAt: p.updatedAt ?? 0,
    };
  } catch {
    return { rules: DEFAULT_RULES, updatedAt: 0 };
  }
}

export function saveRulesDoc(rules: string): AgentRulesDoc {
  const next: AgentRulesDoc = {
    rules: rules.slice(0, 6000),
    updatedAt: Date.now(),
  };
  if (canUse()) window.localStorage.setItem(KEY_RULES, JSON.stringify(next));
  return next;
}

export function loadMemoryNotes(): MemoryNote[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY_MEMORY);
    const parsed = raw ? (JSON.parse(raw) as MemoryNote[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 80) : [];
  } catch {
    return [];
  }
}

export function saveMemoryNotes(notes: MemoryNote[]) {
  if (!canUse()) return;
  window.localStorage.setItem(KEY_MEMORY, JSON.stringify(notes.slice(0, 80)));
}

export function addMemoryNote(title: string, body: string): MemoryNote {
  const note: MemoryNote = {
    id: `mem:${Date.now().toString(36)}`,
    title: title.trim().slice(0, 80) || "Nota",
    body: body.trim().slice(0, 2000),
    createdAt: Date.now(),
  };
  saveMemoryNotes([note, ...loadMemoryNotes()]);
  return note;
}

export function removeMemoryNote(id: string) {
  saveMemoryNotes(loadMemoryNotes().filter((n) => n.id !== id));
}

export function exportBrainBackup(): BrainBackup {
  return {
    version: 1,
    exportedAt: Date.now(),
    profile: loadAgentProfile(),
    identity: loadIdentityDoc(),
    rules: loadRulesDoc(),
    memory: loadMemoryNotes(),
  };
}

export function importBrainBackup(data: unknown): { ok: boolean; message: string } {
  try {
    const b = data as Partial<BrainBackup>;
    if (!b || b.version !== 1) {
      return { ok: false, message: "File non valido: serve version 1" };
    }
    if (b.profile) {
      saveAgentProfile({
        name: b.profile.name,
        tagline: b.profile.tagline,
        focus: b.profile.focus,
        language: b.profile.language,
      });
    }
    if (b.identity?.character) saveIdentityDoc(String(b.identity.character));
    if (b.rules?.rules) saveRulesDoc(String(b.rules.rules));
    if (Array.isArray(b.memory)) {
      saveMemoryNotes(
        b.memory
          .filter((n) => n && typeof n.body === "string")
          .map((n) => ({
            id: String(n.id ?? `mem:${Date.now().toString(36)}`),
            title: String(n.title ?? "Nota").slice(0, 80),
            body: String(n.body).slice(0, 2000),
            createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
          }))
          .slice(0, 80),
      );
    }
    return { ok: true, message: "Cervello importato (profilo, carattere, regole, memoria)" };
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
  a.download = `jarvis-brain-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Testo da iniettare nel prompt (cervello completo). */
export function buildBrainContextForPrompt(opts?: {
  profile?: AgentProfile;
  maxMemoryChars?: number;
}): string {
  const profile = opts?.profile ?? loadAgentProfile();
  const identity = loadIdentityDoc();
  const rules = loadRulesDoc();
  const memory = loadMemoryNotes();
  const maxMem = opts?.maxMemoryChars ?? 3500;

  const memBlock = memory
    .slice(0, 20)
    .map((n) => `- ${n.title}: ${n.body}`)
    .join("\n")
    .slice(0, maxMem);

  return [
    "### 1. CARATTERE (identity)",
    `Nome: ${profile.name}`,
    `Tagline: ${profile.tagline}`,
    `Focus: ${profile.focus}`,
    `Lingua: ${profile.language}`,
    identity.character,
    "",
    "### 2. MEMORIA (cosa sa di te / contesto)",
    memBlock || "(memoria vuota — l'utente può aggiungere note in /agent)",
    "",
    "### 3. MANI E OCCHI",
    "Vedere: log server, metriche, risultati tool read, contesto allegato dall'utente.",
    "Toccare: Falix (power/console/file), storage MEGA/Drive, connettori Discord/webhook,",
    "One MCP https://mcp.withone.ai/mcp (list/search/knowledge/execute), host_research, sezione Codice.",
    "Non hai filesystem locale né browser autonomo fuori da questi tool.",
    "",
    "### 4. REGOLE",
    rules.rules,
  ].join("\n");
}

export const PILLARS = [
  {
    id: "character" as const,
    title: "Un carattere",
    question: "chi è? come parla?",
    fileHint: "identity.md",
    color: "border-amber-500/40 bg-amber-500/5",
  },
  {
    id: "memory" as const,
    title: "Una memoria",
    question: "cosa sa di te e del contesto",
    fileHint: "memoria/ · context/",
    color: "border-violet-500/40 bg-violet-500/5",
  },
  {
    id: "hands" as const,
    title: "Mani e occhi",
    question: "cosa può toccare e vedere",
    fileHint: "connettori · MCP · skills",
    color: "border-sky-500/40 bg-sky-500/5",
  },
  {
    id: "rules" as const,
    title: "Delle regole",
    question: "cosa non deve fare",
    fileHint: "RULES.md",
    color: "border-rose-500/40 bg-rose-500/5",
  },
] as const;
