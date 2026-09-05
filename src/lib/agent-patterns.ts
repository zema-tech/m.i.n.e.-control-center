/**
 * Pattern learning — JARVIS osserva abitudini e le consolida.
 *
 * Non è ML: contatori + testo libero. Quando un pattern supera una soglia,
 * può essere promosso a entry USER/MEMORY o a skill draft.
 */

export type ObservedPattern = {
  id: string;
  /** Chiave corta stabilizzata (es. "restart-sera", "check-log-dopo-crash"). */
  key: string;
  label: string;
  detail: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Se già suggerita skill / memoria. */
  promoted?: "memory" | "user" | "skill" | null;
};

const KEY = "mine.agent.patterns.v1";
const MAX_PATTERNS = 40;

function canUse() {
  return typeof window !== "undefined";
}

function slug(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function loadPatterns(): ObservedPattern[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ObservedPattern[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list: ObservedPattern[]) {
  if (canUse()) window.localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

/** Registra o rinforza un pattern osservato. */
export function observePattern(input: {
  key: string;
  label: string;
  detail?: string;
}): ObservedPattern {
  const key = slug(input.key);
  const list = loadPatterns();
  const now = Date.now();
  const i = list.findIndex((p) => p.key === key);
  if (i >= 0) {
    list[i] = {
      ...list[i],
      count: list[i].count + 1,
      lastSeenAt: now,
      label: input.label.trim() || list[i].label,
      detail: (input.detail ?? list[i].detail).slice(0, 400),
    };
    // bounce to front
    const [row] = list.splice(i, 1);
    list.unshift(row);
    persist(list.slice(0, MAX_PATTERNS));
    return row;
  }
  const row: ObservedPattern = {
    id: `pat:${key}`,
    key,
    label: input.label.trim().slice(0, 120),
    detail: (input.detail ?? "").slice(0, 400),
    count: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    promoted: null,
  };
  list.unshift(row);
  persist(list.slice(0, MAX_PATTERNS));
  return row;
}

export function markPatternPromoted(
  key: string,
  to: "memory" | "user" | "skill",
) {
  const list = loadPatterns();
  const i = list.findIndex((p) => p.key === slug(key) || p.key === key);
  if (i < 0) return;
  list[i] = { ...list[i], promoted: to };
  persist(list);
}

/** Pattern candidati a diventare skill o memoria (count >= soglia). */
export function patternsReadyToPromote(minCount = 3): ObservedPattern[] {
  return loadPatterns().filter((p) => p.count >= minCount && !p.promoted);
}

export function formatPatternsForPrompt(limit = 8): string {
  const top = [...loadPatterns()]
    .sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt)
    .slice(0, limit);
  if (top.length === 0) {
    return "### Pattern utente\n(ancora nessuno — osserva e registra con observe_pattern)";
  }
  const lines = top.map(
    (p) =>
      `- **${p.label}** (×${p.count}${p.promoted ? `, →${p.promoted}` : ""}): ${p.detail || p.key}`,
  );
  return [
    "### Pattern utente (abitudini osservate)",
    ...lines,
    "",
    "Se un pattern ricorre (≥3) e non è promosso: proponi entry USER/MEMORY o skill draft.",
  ].join("\n");
}

export function clearPatterns() {
  persist([]);
}
