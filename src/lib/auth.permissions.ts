/** Tipi e meta permessi — safe per client e server (no Node deps) */

export const ALL_PERMISSIONS = [
  "home",
  "jarvis",
  "mine",
  "design",
  "code",
  "assistant",
  "cowork",
  "pulse",
  "agent",
  "gateway",
  "memory",
  "network",
  "skills",
  "hosts",
  "connectors",
  "access",
  "power",
  "console",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_META: Record<
  Permission,
  { label: string; group: "mondi" | "strumenti" | "azioni" }
> = {
  home: { label: "Hub", group: "mondi" },
  jarvis: { label: "JARVIS", group: "mondi" },
  mine: { label: "M.I.N.E", group: "mondi" },
  design: { label: "Design", group: "mondi" },
  code: { label: "Code", group: "mondi" },
  assistant: { label: "Chat", group: "strumenti" },
  cowork: { label: "Cowork", group: "strumenti" },
  pulse: { label: "Pulse", group: "strumenti" },
  agent: { label: "Brain", group: "strumenti" },
  gateway: { label: "Gateway", group: "strumenti" },
  memory: { label: "Memoria", group: "strumenti" },
  network: { label: "Rete", group: "strumenti" },
  skills: { label: "Competenze", group: "strumenti" },
  hosts: { label: "Host", group: "strumenti" },
  connectors: { label: "Connettori", group: "strumenti" },
  access: { label: "Gestione accessi", group: "strumenti" },
  power: { label: "Power server", group: "azioni" },
  console: { label: "Console", group: "azioni" },
};

export const DEFAULT_GUEST_PERMISSIONS: Permission[] = ["home", "mine", "pulse"];

export type SessionRole = "admin" | "guest" | "member";

/** Mappa route → permesso richiesto */
export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/home": "home",
  "/jarvis": "jarvis",
  "/customize": "jarvis",
  "/mine": "mine",
  "/design": "design",
  "/code": "code",
  "/assistant": "assistant",
  "/cowork": "cowork",
  "/pulse": "pulse",
  "/agent": "agent",
  "/gateway": "gateway",
  "/memory": "memory",
  "/network": "network",
  "/skills": "skills",
  "/hosts": "hosts",
  "/connectors": "connectors",
  "/access": "access",
};

export function normalizePermissions(list: string[] | undefined | null): Permission[] {
  if (!list || list.length === 0) return [...DEFAULT_GUEST_PERMISSIONS];
  const set = new Set<Permission>();
  for (const p of list) {
    if ((ALL_PERMISSIONS as readonly string[]).includes(p)) {
      set.add(p as Permission);
    }
  }
  if (!set.has("home")) set.add("home");
  return Array.from(set);
}
