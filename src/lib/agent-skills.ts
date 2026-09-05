/**
 * Skills agente — modello Hermes (progressive disclosure).
 *
 * Catalogo leggero nel system prompt (nome + una riga).
 * Corpo SKILL.md caricato on-demand quando l'agente invoca la skill.
 *
 * Self-creation: l'agente può *proporre* una skill; attivazione persistente
 * dopo conferma umana (o flag autoApprove se esplicito).
 */

export type AgentSkillStatus = "draft" | "active" | "archived";

export type AgentSkill = {
  id: string;
  name: string;
  /** Una riga per il catalogo nel prompt. */
  description: string;
  /** Corpo stile SKILL.md (markdown). */
  body: string;
  status: AgentSkillStatus;
  /** Chi l'ha creata. */
  source: "user" | "agent";
  /** Quante volte usata / invocata. */
  useCount: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  tags?: string[];
};

const KEY = "mine.agent.skills.v1";

function canUse() {
  return typeof window !== "undefined";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `skill-${Date.now()}`;
}

export function loadAgentSkills(): AgentSkill[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seedDefaults();
    const list = JSON.parse(raw) as AgentSkill[];
    if (!Array.isArray(list)) return seedDefaults();
    return list;
  } catch {
    return [];
  }
}

function persist(list: AgentSkill[]) {
  if (canUse()) window.localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

function seedDefaults(): AgentSkill[] {
  const now = Date.now();
  const defaults: AgentSkill[] = [
    {
      id: "host-health-check",
      name: "host-health-check",
      description: "Verifica stato host Falix (power, risorse) prima di interventi.",
      body: `# host-health-check

## Quando
Prima di restart, comandi console o upload file.

## Passi
1. Leggi stato power / risorse (tool read).
2. Riassumi all'utente in 3 bullet.
3. Solo dopo conferma: azioni write (restart, stop).
`,
      status: "active",
      source: "user",
      useCount: 0,
      createdAt: now,
      updatedAt: now,
      tags: ["falix", "ops"],
    },
    {
      id: "remember-preference",
      name: "remember-preference",
      description: "Salva una preferenza utente in USER.md via memory tool.",
      body: `# remember-preference

## Quando
L'utente esprime un'abitudine stabile ("preferisco X", "non fare mai Y").

## Passi
1. Formulare entry corta e atomica.
2. memoryTool add target=user.
3. Confermare all'utente cosa è stato salvato.
`,
      status: "active",
      source: "user",
      useCount: 0,
      createdAt: now,
      updatedAt: now,
      tags: ["memory"],
    },
  ];
  return persist(defaults);
}

export function getActiveSkills(): AgentSkill[] {
  return loadAgentSkills().filter((s) => s.status === "active");
}

export function getSkillByName(name: string): AgentSkill | undefined {
  const n = name.toLowerCase().trim();
  return loadAgentSkills().find(
    (s) => s.name.toLowerCase() === n || s.id === n,
  );
}

/** Catalogo leggero per system prompt (Hermes progressive disclosure). */
export function formatSkillsCatalogForPrompt(): string {
  const active = getActiveSkills();
  if (active.length === 0) {
    return "### Skills\n(nessuna skill attiva — puoi proporne di nuove)";
  }
  const lines = active.map((s) => `- **${s.name}**: ${s.description}`);
  return [
    "### Skills attive (invoca per nome quando serve il procedimento completo)",
    ...lines,
    "",
    "Per creare una skill nuova: proponi nome + description + body markdown; resta draft finché l'utente non attiva.",
  ].join("\n");
}

export function loadSkillBody(name: string): string | null {
  const s = getSkillByName(name);
  if (!s || s.status === "archived") return null;
  markSkillUsed(s.id);
  return s.body;
}

export function markSkillUsed(id: string) {
  const list = loadAgentSkills();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return;
  list[i] = {
    ...list[i],
    useCount: list[i].useCount + 1,
    lastUsedAt: Date.now(),
    updatedAt: Date.now(),
  };
  persist(list);
}

export type ProposeSkillInput = {
  name: string;
  description: string;
  body: string;
  tags?: string[];
  /** Se true, attiva subito (solo con esplicita volontà utente). */
  activate?: boolean;
  source?: "user" | "agent";
};

export function proposeOrCreateSkill(input: ProposeSkillInput): {
  ok: boolean;
  skill?: AgentSkill;
  message: string;
} {
  const name = input.name.trim();
  const description = input.description.trim();
  const body = input.body.trim();
  if (!name || !description || !body) {
    return { ok: false, message: "name, description e body obbligatori" };
  }
  if (body.length > 12000) {
    return { ok: false, message: "body troppo lungo (max 12k)" };
  }
  const list = loadAgentSkills();
  const id = slugify(name);
  const existing = list.find((s) => s.id === id || s.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return {
      ok: false,
      message: `Skill "${existing.name}" esiste già (status: ${existing.status}). Usa update o altro nome.`,
      skill: existing,
    };
  }
  const now = Date.now();
  const skill: AgentSkill = {
    id,
    name: id,
    description: description.slice(0, 200),
    body,
    status: input.activate ? "active" : "draft",
    source: input.source ?? "agent",
    useCount: 0,
    createdAt: now,
    updatedAt: now,
    tags: input.tags,
  };
  list.unshift(skill);
  persist(list);
  return {
    ok: true,
    skill,
    message: skill.status === "draft"
      ? `Skill draft "${skill.name}" creata — attiva da Competenze o conferma in chat.`
      : `Skill "${skill.name}" attiva.`,
  };
}

export function setSkillStatus(
  id: string,
  status: AgentSkillStatus,
): AgentSkill | null {
  const list = loadAgentSkills();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], status, updatedAt: Date.now() };
  persist(list);
  return list[i];
}

export function updateSkillBody(
  id: string,
  patch: Partial<Pick<AgentSkill, "description" | "body" | "tags">>,
): AgentSkill | null {
  const list = loadAgentSkills();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return null;
  list[i] = {
    ...list[i],
    ...patch,
    description: patch.description?.slice(0, 200) ?? list[i].description,
    body: patch.body ?? list[i].body,
    updatedAt: Date.now(),
  };
  persist(list);
  return list[i];
}

export function removeSkill(id: string): boolean {
  const list = loadAgentSkills().filter((s) => s.id !== id);
  persist(list);
  return true;
}
