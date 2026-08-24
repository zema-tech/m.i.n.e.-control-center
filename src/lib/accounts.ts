/**
 * Account connettori con chiavi API proprie.
 * Multi-account Falix (es. Gino, Edo, il tuo): uno attivo alla volta guida status/power/console/IA.
 */

export type AccountProvider =
  | "falix"
  | "bloom"
  | "apex"
  | "bisect"
  | "shockbyte"
  | "akliz"
  | "flexynode"
  | "pterodactyl"
  | "pelican"
  | "mcsmanager"
  | "amp"
  | "exaroton"
  | "mega"
  | "discord"
  | "rcon"
  | "generic";

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
  apiKey: string;
  serverId: string;
  baseUrl: string;
  address: string;
  skills: SkillId[];
  active: boolean;
  createdAt: number;
};

const FALIX_LIKE_SKILLS: SkillId[] = [
  "power",
  "console",
  "metrics",
  "players",
  "files",
  "logs",
  "status",
];

const PTERO_FIELDS: {
  key: "apiKey" | "serverId" | "baseUrl" | "address";
  label: string;
  secret?: boolean;
}[] = [
  { key: "apiKey", label: "Client API Key", secret: true },
  { key: "serverId", label: "Server UUID / ID" },
  { key: "baseUrl", label: "Panel URL (es. https://panel.example.com)" },
];

export const ACCOUNT_PROVIDERS: {
  id: AccountProvider;
  label: string;
  defaultSkills: SkillId[];
  falixLike: boolean;
  fields: { key: "apiKey" | "serverId" | "baseUrl" | "address"; label: string; secret?: boolean }[];
}[] = [
  {
    id: "falix",
    label: "FalixNodes",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "serverId", label: "Server ID" },
      { key: "baseUrl", label: "API Base (opz.)" },
    ],
  },
  {
    id: "bloom",
    label: "Bloom Host",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "apex",
    label: "Apex Hosting",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "bisect",
    label: "BisectHosting",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "shockbyte",
    label: "Shockbyte",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "akliz",
    label: "Akliz",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "flexynode",
    label: "FlexyNode",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "pterodactyl",
    label: "Pterodactyl",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "pelican",
    label: "Pelican Panel",
    defaultSkills: FALIX_LIKE_SKILLS,
    falixLike: true,
    fields: PTERO_FIELDS,
  },
  {
    id: "mcsmanager",
    label: "MCSManager",
    defaultSkills: ["power", "console", "metrics", "files", "status"],
    falixLike: true,
    fields: [
      { key: "apiKey", label: "API Key / Token", secret: true },
      { key: "serverId", label: "Instance UUID" },
      { key: "baseUrl", label: "Panel URL" },
    ],
  },
  {
    id: "amp",
    label: "AMP (CubeCoders)",
    defaultSkills: ["power", "console", "metrics", "status"],
    falixLike: true,
    fields: [
      { key: "apiKey", label: "API / Session", secret: true },
      { key: "serverId", label: "Instance ID" },
      { key: "baseUrl", label: "AMP URL" },
    ],
  },
  {
    id: "exaroton",
    label: "Exaroton",
    defaultSkills: ["power", "status", "players", "console"],
    falixLike: true,
    fields: [
      { key: "apiKey", label: "API Token", secret: true },
      { key: "serverId", label: "Server ID" },
    ],
  },
  {
    id: "mega",
    label: "MEGA",
    defaultSkills: ["backup", "files"],
    falixLike: false,
    fields: [
      { key: "apiKey", label: "Email o session", secret: true },
      { key: "serverId", label: "Folder / handle (opz.)" },
    ],
  },
  {
    id: "discord",
    label: "Discord",
    defaultSkills: ["chat", "status"],
    falixLike: false,
    fields: [
      { key: "apiKey", label: "Bot token / webhook", secret: true },
      { key: "serverId", label: "Channel / Guild ID" },
    ],
  },
  {
    id: "rcon",
    label: "RCON",
    defaultSkills: ["console", "power"],
    falixLike: false,
    fields: [
      { key: "address", label: "Host:porta" },
      { key: "apiKey", label: "Password RCON", secret: true },
    ],
  },
  {
    id: "generic",
    label: "Generico / altro",
    defaultSkills: ["status"],
    falixLike: false,
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
export const ACTIVE_ACCOUNT_EVENT = "mine:active-account";

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

/** Notifica le pagine (Rete, Chat IA, …) che l'account attivo è cambiato. */
export function notifyActiveAccountChanged(accountId: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ACTIVE_ACCOUNT_EVENT, { detail: { accountId } }),
  );
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
  const makeActive =
    input.active === true ||
    list.length === 0 ||
    (input.provider === "falix" && !list.some((a) => a.provider === "falix" && a.active));

  const account: ApiAccount = {
    id: `acc:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: input.label.trim().slice(0, 48) || def?.label || "Account",
    provider: input.provider,
    apiKey: input.apiKey.trim(),
    serverId: (input.serverId ?? "").trim(),
    baseUrl: (input.baseUrl ?? "").trim(),
    address: (input.address ?? "").trim(),
    skills: input.skills?.length ? input.skills : (def?.defaultSkills ?? ["status"]),
    active: makeActive,
    createdAt: Date.now(),
  };

  if (account.active) {
    list = list.map((a) => ({ ...a, active: false }));
  }
  list = [account, ...list];
  saveAccounts(list);
  if (account.active) notifyActiveAccountChanged(account.id);
  return account;
}

export function updateAccount(id: string, patch: Partial<ApiAccount>): ApiAccount[] {
  let list = loadAccounts().map((a) => (a.id === id ? { ...a, ...patch, id: a.id } : a));
  if (patch.active) {
    list = list.map((a) => ({ ...a, active: a.id === id }));
  }
  saveAccounts(list);
  if (patch.active) notifyActiveAccountChanged(id);
  return list;
}

export function removeAccount(id: string): ApiAccount[] {
  const prev = loadAccounts();
  const wasActive = prev.find((a) => a.id === id)?.active;
  let next = prev.filter((a) => a.id !== id);
  if (wasActive && next.length > 0) {
    const falix = next.find((a) => a.provider === "falix");
    const pick = falix ?? next[0]!;
    next = next.map((a) => ({ ...a, active: a.id === pick.id }));
    notifyActiveAccountChanged(pick.id);
  } else if (wasActive) {
    notifyActiveAccountChanged(null);
  }
  saveAccounts(next);
  return next;
}

export function setActiveAccount(id: string): ApiAccount[] {
  const next = loadAccounts().map((a) => ({ ...a, active: a.id === id }));
  saveAccounts(next);
  notifyActiveAccountChanged(id);
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

/** Account attivo (qualsiasi provider). */
export function getActiveAccount(): ApiAccount | null {
  const list = loadAccounts();
  return list.find((a) => a.active) ?? list[0] ?? null;
}

/** Account Falix attivo (API key + server id). Preferito per power/console/log. */
export function getActiveFalixAccount(): ApiAccount | null {
  const list = loadAccounts();
  const active = list.find((a) => a.active && a.provider === "falix" && a.apiKey && a.serverId);
  if (active) return active;
  return list.find((a) => a.provider === "falix" && a.apiKey && a.serverId) ?? null;
}

/** Tutti gli account Falix configurati (per selettore Gino / Edo / …). */
export function listFalixAccounts(): ApiAccount[] {
  return loadAccounts().filter((a) => a.provider === "falix" && a.apiKey && a.serverId);
}

export function getAccountById(id: string): ApiAccount | null {
  return loadAccounts().find((a) => a.id === id) ?? null;
}

export function credentialsPayload(account: ApiAccount | null) {
  if (!account?.apiKey || !account.serverId) return undefined;
  return {
    key: account.apiKey,
    serverId: account.serverId,
    base: account.baseUrl || undefined,
  };
}

/** Credenziali dell'account Falix attivo (o undefined → fallback env server). */
export function activeCredentials() {
  return credentialsPayload(getActiveFalixAccount());
}

export function maskKey(key: string) {
  if (!key) return "—";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
