/**
 * Profilo JARVIS / M.I.N.E — identità locale dell'agente personale.
 */

export type AgentProfile = {
  name: string;
  tagline: string;
  focus: string;
  language: string;
  updatedAt: number;
};

const KEY = "mine.agent.profile.v1";

export const DEFAULT_AGENT_PROFILE: AgentProfile = {
  name: "JARVIS",
  tagline: "Il tuo agente personale",
  focus:
    "Operazioni host, connettori, e coding agent (stile Kilo / Claude Code) — sempre con conferma sulle azioni critiche",
  language: "italiano",
  updatedAt: 0,
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadAgentProfile(): AgentProfile {
  if (!canUseStorage()) return { ...DEFAULT_AGENT_PROFILE };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_AGENT_PROFILE };
    const p = JSON.parse(raw) as Partial<AgentProfile>;
    return {
      name: (p.name ?? DEFAULT_AGENT_PROFILE.name).slice(0, 40),
      tagline: (p.tagline ?? DEFAULT_AGENT_PROFILE.tagline).slice(0, 80),
      focus: (p.focus ?? DEFAULT_AGENT_PROFILE.focus).slice(0, 200),
      language: (p.language ?? DEFAULT_AGENT_PROFILE.language).slice(0, 40),
      updatedAt: p.updatedAt ?? 0,
    };
  } catch {
    return { ...DEFAULT_AGENT_PROFILE };
  }
}

export function saveAgentProfile(patch: Partial<AgentProfile>): AgentProfile {
  const next: AgentProfile = {
    ...loadAgentProfile(),
    ...patch,
    updatedAt: Date.now(),
  };
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return next;
}

/** Sezioni prodotto agente — Jarvis hub. */
export const AGENT_SECTIONS = [
  {
    id: "chat",
    to: "/assistant" as const,
    title: "Chat ops",
    blurb: "Diagnosi server, log, azioni Falix / host",
    group: "core" as const,
  },
  {
    id: "code",
    to: "/code" as const,
    title: "Codice",
    blurb: "Coding agent — Code, Architect, Debug, Review",
    group: "core" as const,
  },
  {
    id: "network",
    to: "/network" as const,
    title: "Rete neurale",
    blurb: "Come l'agente agisce su server e stati",
    group: "core" as const,
  },
  {
    id: "skills",
    to: "/skills" as const,
    title: "Competenze",
    blurb: "Account Falix, storage, chiavi operative",
    group: "capabilities" as const,
  },
  {
    id: "hosts",
    to: "/hosts" as const,
    title: "Host",
    blurb: "MC + cloud e research provider",
    group: "capabilities" as const,
  },
  {
    id: "connectors",
    to: "/connectors" as const,
    title: "Connettori",
    blurb: "One MCP, MEGA, Discord, webhook",
    group: "capabilities" as const,
  },
] as const;
