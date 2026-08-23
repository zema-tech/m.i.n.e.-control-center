/**
 * Account connettori con chiavi API proprie.
 * Esempio: due account Falix diversi, ognuno con la sua API key + server id.
 * Salvati solo in localStorage del browser (non inviati a terzi oltre le chiamate API dell'host).
 */

export type AccountProvider =
  | "falix"
  | "pterodactyl"
  | "mega"
  | "discord"
  | "rcon"
  | "generic";

/** Competenze = azioni che questo account può eseguire. */
export type SkillId =
  | "power"
  | "console"
  | "metrics"
  | "players"
  | "files"
  | "logs"
  | "backup"
  | "chat"
  | "status";

export type ApiAccount = {
  id: string;
  label: string;
  provider: AccountProvider;
  /** API key / token / password RCON */
  apiKey: string;
  /** Server / instance id (Falix, Ptero, …) */
  serverId: string;
  /** Base URL opzionale */
  baseUrl: string;
  /** Indirizzo pubblico IP:porta */
  address: string;
  skills: SkillId[];
  /** Account attivo per le azioni dashboard */
  active: boolean;
  createdAt: number;
};

export const ACCOUNT_PROVIDERS: {
  id: AccountProvider;
  label: string;
  defaultSkills: SkillId[];
  fields: { key: "apiKey" | "serverId" | "baseUrl" | "address"; label: string; secret?: boolean }[];
}[] = [
  {
    id: "falix",
    label: "FalixNodes",
    defaultSkills: ["power", "console", "metrics", "players", "files", "logs", "status"],
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "serverId", label: "Server ID" },
      { key: "baseUrl", label: "API Base (opz.)" },
    ],
  },
  {
    id: "pterodactyl",
    label: "Pterodactyl / Pelican",
    defaultSkills: ["power", "console", "metrics", "files", "status"],
    fields: [
      { key: "apiKey", label: "Client API Key", secret: true },
      { key: "serverId", label: "Server UUID" },
      { key: "baseUrl", label: "Panel URL" },
    ],
  },
  {
    id: "mega",
    label: "MEGA",
    defaultSkills: ["backup", "files"],
    fields: [
      { key: "apiKey", label: "Email o session", secret: true },
      { key: "serverId", label: "Folder / handle (opz.)" },
    ],
  },
  {
    id: "discord",
    label: "Discord",
    defaultSkills: ["chat", "status"],
    fields: [
      { key: "apiKey", label: "Bot token / webhook", secret: true },
      { key: "serverId", label: "Channel / Guild ID" },
    ],
  },
  {
    id: "rcon",
    label: "RCON",
    defaultSkills: ["console", "power"],
    fields: [
      { key: "address", label: "Host:porta" },
      { key: "apiKey", label: "Password RCON", secret: true },
    ],
  },
  {
    id: "generic",
    label: "Generico",
    defaultSkills: ["status"],
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "baseUrl", label: "Base URL" },
      { key: "serverId", label: "Resource ID" },
    ],
  },
];

export const SKILL_META: Record<SkillId, { label: string; hint: string }> = {
  power: { label: "Power", hint: "Avvio / stop / restart" },
  console: { label: "Console", hint: "Comandi in-game" },
  metrics: { label: "Metriche", hint: "CPU RAM TPS" },
  players: { label: "Giocatori", hint: "Lista online" },
  files: { label: "File", hint: "Gestione file server" },
  logs: { label: "Log", hint: "latest.log / console" },
  backup: { label: "Backup", hint: "Snapshot mondi" },
  chat: { label: "Chat", hint: "Notifiche / bot" },
  status: { label: "Status", hint: "Online / offline" },
};

const KEY = "mine.accounts.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadAccounts(): ApiAccount[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ApiAccount[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAccounts(list: ApiAccount[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function addAccount(input: {
  label: string;
  provider: AccountProvider;
  apiKey: string;
  serverId?: string;
  baseUrl?: string;
  address?: string;
  skills?: SkillId[];
  active?: boolean;
}): ApiAccount {
  const def = ACCOUNT_PROVIDERS.find((p) => p.id === input.provider);
  let list = loadAccounts();
  const account: ApiAccount = {
    id: `acc:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: input.label.trim().slice(0, 48) || def?.label || "Account",
    provider: input.provider,
    apiKey: input.apiKey.trim(),
    serverId: (input.serverId ?? "").trim(),
    baseUrl: (input.baseUrl ?? "").trim(),
    address: (input.address ?? "").trim(),
    skills: input.skills?.length ? input.skills : (def?.defaultSkills ?? ["status"]),
    active: Boolean(input.active),
    createdAt: Date.now(),
  };
  if (account.active) {
    list = list.map((a) => ({ ...a, active: false }));
  }
  // se è il primo account falix, attivarlo
  if (!account.active && list.filter((a) => a.provider === "falix").length === 0 && account.provider === "falix") {
    account.active = true;
  }
  list = [account, ...list];
  saveAccounts(list);
  return account;
}

export function updateAccount(id: string, patch: Partial<ApiAccount>): ApiAccount[] {
  let list = loadAccounts().map((a) => (a.id === id ? { ...a, ...patch, id: a.id } : a));
  if (patch.active) {
    list = list.map((a) => ({ ...a, active: a.id === id }));
  }
  saveAccounts(list);
  return list;
}

export function removeAccount(id: string): ApiAccount[] {
  const next = loadAccounts().filter((a) => a.id !== id);
  saveAccounts(next);
  return next;
}

export function setActiveAccount(id: string): ApiAccount[] {
  const next = loadAccounts().map((a) => ({ ...a, active: a.id === id }));
  saveAccounts(next);
  return next;
}

export function toggleSkill(id: string, skill: SkillId): ApiAccount[] {
  const next = loadAccounts().map((a) => {
    if (a.id !== id) return a;
    const has = a.skills.includes(skill);
    return {
      ...a,
      skills: has ? a.skills.filter((s) => s !== skill) : [...a.skills, skill],
    };
  });
  saveAccounts(next);
  return next;
}

export function getActiveFalixAccount(): ApiAccount | null {
  const list = loadAccounts();
  return list.find((a) => a.active && a.provider === "falix" && a.apiKey && a.serverId)
    ?? list.find((a) => a.provider === "falix" && a.apiKey && a.serverId)
    ?? null;
}

/** Credenziali da passare alle server fn (senza esporre in log). */
export function credentialsPayload(account: ApiAccount | null) {
  if (!account) return undefined;
  return {
    key: account.apiKey,
    serverId: account.serverId,
    base: account.baseUrl || undefined,
  };
}

export function maskKey(key: string) {
  if (!key) return "—";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
