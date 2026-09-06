/**
 * Catalogo suggestion automazioni — ispirato a Hermes cron suggestion_catalog.
 * Non auto-esegue: l'utente accetta → diventa obiettivo Cowork o nota diario.
 */

export type AutomationSuggestion = {
  key: string;
  title: string;
  description: string;
  /** Prompt/brief pronto per Cowork o chat */
  brief: string;
  /** Hint schedule (solo UI, non scheduler server) */
  scheduleHint: string;
  tags: string[];
};

const DISMISS_KEY = "mine.agent.suggestions.dismissed.v1";

export const SUGGESTION_CATALOG: AutomationSuggestion[] = [
  {
    key: "daily-briefing",
    title: "Briefing mattutino",
    description: "Riassunto corto: host, task aperti, note di ieri.",
    brief:
      "Prepara un briefing mattutino conciso: stato host se disponibile, punti aperti dal diario, 3 priorità suggerite. Niente filler.",
    scheduleHint: "ogni giorno ~08:00",
    tags: ["routine", "ops"],
  },
  {
    key: "host-health",
    title: "Check salute host",
    description: "Power, risorse, ultimi log sospetti — solo lettura.",
    brief:
      "Esegui un health-check host in sola lettura: power/status, risorse, segnali di lag o errori recenti. 5 bullet max + se serve un'azione write proponila senza eseguirla.",
    scheduleHint: "ogni 6 ore",
    tags: ["falix", "ops"],
  },
  {
    key: "memory-curator",
    title: "Cura MEMORY",
    description: "Consolida entry lunghe o duplicate sotto il budget caratteri.",
    brief:
      "Sei il curator di MEMORY.md: elenca entry ridondanti o troppo lunghe, proponi replace/remove concreti per restare sotto budget. Non cancellare senza elencare prima.",
    scheduleHint: "settimanale",
    tags: ["memory", "hermes"],
  },
  {
    key: "skill-harvest",
    title: "Raccolto skill",
    description: "Dai pattern ricorrenti proponi 1 skill draft.",
    brief:
      "Guarda i pattern osservati e le chat recenti. Se una procedura si ripete, proponi UNA skill draft (nome, description, body SKILL.md) senza attivarla.",
    scheduleHint: "settimanale",
    tags: ["skills", "resident"],
  },
  {
    key: "weekly-review",
    title: "Weekly review",
    description: "Cosa ha funzionato, cosa no, 3 focus prossima settimana.",
    brief:
      "Weekly review stile produttività: 3 win, 2 friction, 3 focus per i prossimi 7 giorni. Usa diario e memoria se presenti.",
    scheduleHint: "domenica",
    tags: ["productivity"],
  },
];

function canUse() {
  return typeof window !== "undefined";
}

export function loadDismissed(): string[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function dismissSuggestion(key: string) {
  const list = [...new Set([...loadDismissed(), key])];
  if (canUse()) window.localStorage.setItem(DISMISS_KEY, JSON.stringify(list));
}

export function restoreSuggestion(key: string) {
  const list = loadDismissed().filter((k) => k !== key);
  if (canUse()) window.localStorage.setItem(DISMISS_KEY, JSON.stringify(list));
}

export function activeSuggestions(): AutomationSuggestion[] {
  const dismissed = new Set(loadDismissed());
  return SUGGESTION_CATALOG.filter((s) => !dismissed.has(s.key));
}
