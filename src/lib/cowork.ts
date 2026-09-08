/**
 * Cowork — JARVIS lavora verso un obiettivo senza micro-comandi.
 * Il consenso definisce cosa può eseguire da solo vs cosa resta in coda.
 */

import type { ActionRisk } from "./falix-actions";

export type ConsentLevel = {
  /** Sempre consigliato true: log, list, status. */
  autoRead: boolean;
  /** Comandi console, restart, write file, One write. */
  autoWrite: boolean;
  /**
   * delete / reinstall / wipe — default false.
   * Anche se true, serve `criticalAck` firmato in sessione.
   */
  autoCritical: boolean;
  /** Utente ha letto il warning critical in questa sessione browser. */
  criticalAck: boolean;
  /** Tool residenti (memoria/skill) sempre on se true. */
  autoResident: boolean;
};

export type CoworkGoal = {
  id: string;
  title: string;
  brief: string;
  status: "idle" | "running" | "paused" | "done" | "error";
  createdAt: number;
  updatedAt: number;
  maxSteps: number;
  stepsDone: number;
};

export type CoworkLogEntry = {
  id: string;
  ts: number;
  kind: "think" | "resident" | "auto" | "queued" | "skip" | "error" | "info";
  title: string;
  detail?: string;
};

const KEY_CONSENT = "mine.cowork.consent.v1";
const KEY_GOAL = "mine.cowork.goal.v1";
const KEY_LOG = "mine.cowork.log.v1";
const KEY_AUTOSTART = "mine.cowork.autostart.v1";

const DEFAULT_CONSENT: ConsentLevel = {
  autoRead: true,
  autoWrite: false,
  autoCritical: false,
  criticalAck: false,
  autoResident: true,
};

function canUse() {
  return typeof window !== "undefined";
}

export function loadConsent(): ConsentLevel {
  if (!canUse()) return { ...DEFAULT_CONSENT };
  try {
    const raw = window.localStorage.getItem(KEY_CONSENT);
    if (!raw) return { ...DEFAULT_CONSENT };
    const p = JSON.parse(raw) as Partial<ConsentLevel>;
    return {
      autoRead: p.autoRead !== false,
      autoWrite: Boolean(p.autoWrite),
      autoCritical: Boolean(p.autoCritical),
      criticalAck: Boolean(p.criticalAck),
      autoResident: p.autoResident !== false,
    };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

export function saveConsent(next: ConsentLevel): ConsentLevel {
  if (canUse()) window.localStorage.setItem(KEY_CONSENT, JSON.stringify(next));
  return next;
}

/** Policy unica usata da chat e cowork. */
export function canAutoApprove(risk: ActionRisk, consent = loadConsent()): boolean {
  if (risk === "read") return consent.autoRead;
  if (risk === "write") return consent.autoWrite;
  // critical
  return consent.autoCritical && consent.criticalAck;
}

export function loadGoal(): CoworkGoal | null {
  if (!canUse()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_GOAL);
    if (!raw) return null;
    return JSON.parse(raw) as CoworkGoal;
  } catch {
    return null;
  }
}

export function saveGoal(goal: CoworkGoal | null) {
  if (!canUse()) return;
  if (!goal) window.localStorage.removeItem(KEY_GOAL);
  else window.localStorage.setItem(KEY_GOAL, JSON.stringify(goal));
}

export function createGoal(title: string, brief: string, maxSteps = 6): CoworkGoal {
  const now = Date.now();
  const goal: CoworkGoal = {
    id: `g${now.toString(36)}`,
    title: title.trim().slice(0, 120) || "Obiettivo",
    brief: brief.trim().slice(0, 2000),
    status: "idle",
    createdAt: now,
    updatedAt: now,
    maxSteps: Math.min(12, Math.max(1, maxSteps)),
    stepsDone: 0,
  };
  saveGoal(goal);
  return goal;
}

export function patchGoal(patch: Partial<CoworkGoal>): CoworkGoal | null {
  const g = loadGoal();
  if (!g) return null;
  const next = { ...g, ...patch, updatedAt: Date.now() };
  saveGoal(next);
  return next;
}

export function loadLog(): CoworkLogEntry[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY_LOG);
    if (!raw) return [];
    const list = JSON.parse(raw) as CoworkLogEntry[];
    return Array.isArray(list) ? list.slice(0, 80) : [];
  } catch {
    return [];
  }
}

export function appendLog(
  kind: CoworkLogEntry["kind"],
  title: string,
  detail?: string,
): CoworkLogEntry[] {
  const entry: CoworkLogEntry = {
    id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    ts: Date.now(),
    kind,
    title: title.slice(0, 160),
    detail: detail?.slice(0, 1200),
  };
  const list = [entry, ...loadLog()].slice(0, 80);
  if (canUse()) window.localStorage.setItem(KEY_LOG, JSON.stringify(list));
  return list;
}

export function clearLog() {
  if (canUse()) window.localStorage.setItem(KEY_LOG, "[]");
}

/** Segnala alla pagina Cowork di avviare subito l'obiettivo creato dal composer JARVIS. */
export function requestCoworkAutoStart() {
  if (canUse()) window.sessionStorage.setItem(KEY_AUTOSTART, "1");
}

/** Consuma il segnale una sola volta, anche con Strict Mode attivo. */
export function consumeCoworkAutoStart(): boolean {
  if (!canUse()) return false;
  const pending = window.sessionStorage.getItem(KEY_AUTOSTART) === "1";
  window.sessionStorage.removeItem(KEY_AUTOSTART);
  return pending;
}

/** Prompt utente costruito per un passo autonomo. */
export function buildCoworkStepPrompt(goal: CoworkGoal, stepIndex: number): string {
  return [
    "[MODALITÀ COWORK — lavora in autonomia verso l'obiettivo]",
    `Obiettivo: ${goal.title}`,
    goal.brief ? `Brief: ${goal.brief}` : "",
    `Passo ${stepIndex}/${goal.maxSteps}.`,
    "",
    "Istruzioni:",
    "- Decidi il prossimo passo utile senza chiedere micro-conferme su ogni dettaglio.",
    "- Usa resident[] per memoria/skill/pattern se serve apprendere.",
    "- Proponi in azioni[] solo tool necessari (read prima di write).",
    "- Se l'obiettivo è raggiunto, dillo chiaramente in risposta e non proporre altre azioni.",
    "- Non inventare output di tool non eseguiti.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function consentSummary(c: ConsentLevel): string {
  const parts = [
    c.autoRead ? "read✓" : "read✗",
    c.autoWrite ? "write✓" : "write✗",
    c.autoCritical && c.criticalAck ? "critical✓" : "critical✗",
    c.autoResident ? "resident✓" : "resident✗",
  ];
  return parts.join(" · ");
}
