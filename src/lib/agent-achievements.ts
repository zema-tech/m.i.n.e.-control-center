/**
 * Achievement JARVIS — ispirati a hermes-achievements (uso reale, non vanity).
 * Stato: locked | discovered | unlocked. Tier opzionale.
 */

export type AchievementTier = "copper" | "silver" | "gold";

export type AchievementDef = {
  id: string;
  title: string;
  description: string;
  /** Metric key in progress store */
  metric: string;
  thresholds: { copper: number; silver: number; gold: number };
  secret?: boolean;
};

export type AchievementProgress = {
  metrics: Record<string, number>;
  unlocked: Record<string, AchievementTier>;
  discovered: string[];
};

const KEY = "mine.agent.achievements.v1";

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first-chat",
    title: "Primo contatto",
    description: "Hai parlato con JARVIS in chat.",
    metric: "chats",
    thresholds: { copper: 1, silver: 10, gold: 50 },
  },
  {
    id: "skillsmith",
    title: "Skillsmith",
    description: "Skill create o attivate (anche draft proposti).",
    metric: "skills_created",
    thresholds: { copper: 1, silver: 3, gold: 8 },
  },
  {
    id: "memory-keeper",
    title: "Memory Keeper",
    description: "Entry aggiunte a USER o MEMORY.",
    metric: "memory_writes",
    thresholds: { copper: 3, silver: 15, gold: 40 },
  },
  {
    id: "pattern-seer",
    title: "Pattern Seer",
    description: "Pattern osservati dall'agente residente.",
    metric: "patterns",
    thresholds: { copper: 2, silver: 10, gold: 25 },
  },
  {
    id: "cowork-pilot",
    title: "Cowork Pilot",
    description: "Passi autonomi completati in Cowork.",
    metric: "cowork_steps",
    thresholds: { copper: 1, silver: 10, gold: 40 },
  },
  {
    id: "host-ops",
    title: "Host Ops",
    description: "Azioni Falix eseguite (read o write approvate).",
    metric: "falix_actions",
    thresholds: { copper: 5, silver: 25, gold: 100 },
  },
  {
    id: "night-owl",
    title: "Night Owl",
    description: "Sessioni tra le 00:00 e le 05:00.",
    metric: "night_sessions",
    thresholds: { copper: 1, silver: 5, gold: 15 },
    secret: true,
  },
  {
    id: "journal-habit",
    title: "Chronographer",
    description: "Giorni distinti con nota nel diario.",
    metric: "journal_days",
    thresholds: { copper: 1, silver: 7, gold: 30 },
  },
];

function canUse() {
  return typeof window !== "undefined";
}

function empty(): AchievementProgress {
  return { metrics: {}, unlocked: {}, discovered: [] };
}

export function loadProgress(): AchievementProgress {
  if (!canUse()) return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as AchievementProgress;
    return {
      metrics: p.metrics ?? {},
      unlocked: p.unlocked ?? {},
      discovered: Array.isArray(p.discovered) ? p.discovered : [],
    };
  } catch {
    return empty();
  }
}

function save(p: AchievementProgress) {
  if (canUse()) window.localStorage.setItem(KEY, JSON.stringify(p));
  return p;
}

function tierFor(def: AchievementDef, value: number): AchievementTier | null {
  if (value >= def.thresholds.gold) return "gold";
  if (value >= def.thresholds.silver) return "silver";
  if (value >= def.thresholds.copper) return "copper";
  return null;
}

const TIER_RANK: Record<AchievementTier, number> = {
  copper: 1,
  silver: 2,
  gold: 3,
};

/** Incrementa metrica e ricalcola unlock. */
export function bumpMetric(metric: string, by = 1): AchievementProgress {
  const p = loadProgress();
  p.metrics[metric] = (p.metrics[metric] ?? 0) + by;

  // night owl auto
  if (metric === "chats" || metric === "cowork_steps") {
    const h = new Date().getHours();
    if (h >= 0 && h < 5) {
      p.metrics.night_sessions = (p.metrics.night_sessions ?? 0) + 1;
    }
  }

  for (const def of ACHIEVEMENTS) {
    const v = p.metrics[def.metric] ?? 0;
    if (v > 0 && !p.discovered.includes(def.id)) {
      p.discovered.push(def.id);
    }
    const t = tierFor(def, v);
    if (!t) continue;
    const prev = p.unlocked[def.id];
    if (!prev || TIER_RANK[t] > TIER_RANK[prev]) {
      p.unlocked[def.id] = t;
    }
  }
  return save(p);
}

export function achievementViews() {
  const p = loadProgress();
  return ACHIEVEMENTS.map((def) => {
    const value = p.metrics[def.metric] ?? 0;
    const unlocked = p.unlocked[def.id] ?? null;
    const discovered = p.discovered.includes(def.id) || Boolean(unlocked);
    const hidden = def.secret && !discovered;
    return {
      ...def,
      value,
      unlocked,
      discovered,
      hidden,
      next:
        unlocked === "gold"
          ? null
          : unlocked === "silver"
            ? def.thresholds.gold
            : unlocked === "copper"
              ? def.thresholds.silver
              : def.thresholds.copper,
    };
  });
}
