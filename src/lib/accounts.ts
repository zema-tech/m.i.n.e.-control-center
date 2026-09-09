/**
 * Account: solo Falix (multi) + storage MEGA / Google Drive.
 * L'account Falix attivo guida status, power, console, log e IA.
 */

export type AccountProvider = "falix" | "mega" | "gdrive";

export type SkillId =
  | "power"
  | "console"
  | "metrics"
  | "players"
  | "files"
  | "logs"
  | "backup"
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

const FALIX_SKILLS: SkillId[] = [
  "power",
  "console",
  "metrics",
  "players",
  "files",
  "logs",
  "status",
];

export const ACCOUNT_PROVIDERS: {
  id: AccountProvider;
  label: string;
  defaultSkills: SkillId[];
  falixLike: boolean;
  fields: { key: "apiKey" | "serverId" | "baseUrl" | "address"; label: string; secret?: boolean }[];
  hint: string;
}[] = [
  {
    id: "falix",
    label: "FalixNodes (API + MCP)",
    defaultSkills: FALIX_SKILLS,
    falixLike: true,
    hint: "API key + Server ID dal pannello Falix. Multi-account: Gino, Edo, il tuo…",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      { key: "serverId", label: "Server ID" },
      { key: "baseUrl", label: "API Base (opz.)" },
    ],
  },
  {
    id: "mega",
    label: "MEGA (storage)",
    defaultSkills: ["backup", "files"],
    falixLike: false,
    hint: "Email account MEGA nella chiave; password/session nel campo extra. Per backup cloud.",
    fields: [
      { key: "apiKey", label: "Email MEGA", secret: true },
      { key: "serverId", label: "Password o session token", secret: true },
      { key: "baseUrl", label: "Folder handle (opz.)" },
    ],
  },
  {
    id: "gdrive",
    label: "Google Drive (storage)",
    defaultSkills: ["backup", "files"],
    falixLike: false,
    hint: "API key o JSON service account (incolla nel campo chiave). Folder ID opzionale.",
    fields: [
      { key: "apiKey", label: "API Key o Service Account JSON", secret: true },
      { key: "serverId", label: "Folder ID destinazione (opz.)" },
      { key: "baseUrl", label: "Client ID OAuth (opz.)" },
    ],
  },
];

export const SKILL_META: Record<SkillId, { label: string; hint: string }> = {
  power: { label: "Power", hint: "Avvio / stop / restart" },
  console: { label: "Console", hint: "Comandi in-game" },
  metrics: { label: "Metriche", hint: "CPU RAM TPS" },
  players: { label: "Giocatori", hint: "Lista online" },
  files: { label: "File", hint: "Gestione file server / cloud" },
  logs: { label: "Log", hint: "latest.log / console" },
  backup: { label: "Backup", hint: "Snapshot e cloud MEGA/Drive" },
  status: { label: "Status", hint: "Online / offline" },
};

const KEY = "mine.accounts.v1";
export const ACTIVE_ACCOUNT_EVENT = "mine:active-account";

function canUseStorage() {
  return typeof window !== "undefined";
}

/** Migra provider vecchi non più supportati → generico rimosso; restano solo falix/mega/gdrive. */
function normalizeProvider(p: string): AccountProvider {
  if (p === "falix" || p === "mega" || p === "gdrive") return p;
  return "falix";
}

export function loadAccounts(): ApiAccount[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ApiAccount[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a) => ({
      ...a,
      provider: normalizeProvider(String(a.provider)),
      skills: Array.isArray(a.skills) ? a.skills : [],
    }));
  } catch {
    return [];
  }
}

export function saveAccounts(list: ApiAccount[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore — quota privata / storage pieno */
  }
}

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
    active: makeActive && input.provider === "falix",
    createdAt: Date.now(),
  };

  // Solo Falix può essere "attivo" per power/console
  if (account.provider !== "falix") {
    account.active = false;
  } else if (account.active) {
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
    list = list.map((a) => ({
      ...a,
      active: a.id === id && a.provider === "falix",
    }));
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
    if (falix) {
      next = next.map((a) => ({ ...a, active: a.id === falix.id }));
      notifyActiveAccountChanged(falix.id);
    } else {
      notifyActiveAccountChanged(null);
    }
  } else if (wasActive) {
    notifyActiveAccountChanged(null);
  }
  saveAccounts(next);
  return next;
}

export function setActiveAccount(id: string): ApiAccount[] {
  const target = loadAccounts().find((a) => a.id === id);
  if (!target || target.provider !== "falix") return loadAccounts();
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

export function getActiveAccount(): ApiAccount | null {
  const list = loadAccounts();
  return list.find((a) => a.active && a.provider === "falix") ?? list.find((a) => a.provider === "falix") ?? null;
}

export function getActiveFalixAccount(): ApiAccount | null {
  const list = loadAccounts();
  const active = list.find((a) => a.active && a.provider === "falix" && a.apiKey && a.serverId);
  if (active) return active;
  return list.find((a) => a.provider === "falix" && a.apiKey && a.serverId) ?? null;
}

export function listFalixAccounts(): ApiAccount[] {
  return loadAccounts().filter((a) => a.provider === "falix" && a.apiKey && a.serverId);
}

export function listStorageAccounts(): ApiAccount[] {
  return loadAccounts().filter((a) => a.provider === "mega" || a.provider === "gdrive");
}

export function getAccountById(id: string): ApiAccount | null {
  return loadAccounts().find((a) => a.id === id) ?? null;
}

export function credentialsPayload(account: ApiAccount | null) {
  if (!account?.apiKey || !account.serverId) return undefined;
  if (account.provider !== "falix") return undefined;
  return {
    key: account.apiKey,
    serverId: account.serverId,
    base: account.baseUrl || undefined,
  };
}

export function activeCredentials() {
  return credentialsPayload(getActiveFalixAccount());
}

export function maskKey(key: string) {
  if (!key) return "—";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
