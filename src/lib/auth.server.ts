import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";

import {
  ALL_PERMISSIONS,
  DEFAULT_GUEST_PERMISSIONS,
  normalizePermissions,
  ROUTE_PERMISSION,
  type Permission,
  type SessionRole,
} from "./auth.permissions";
import {
  deleteBan,
  deleteBindings,
  deleteTemp,
  fetchAdminProfile,
  fetchBans,
  fetchBindings,
  fetchMembers,
  fetchRevokedJtis,
  fetchTemps,
  pruneAuthTables,
  saveAdminProfile,
  saveBan,
  saveBinding,
  saveMember,
  saveRevokedJti,
  saveTemp,
  storeAvailable,
} from "./auth.store";

export {
  ALL_PERMISSIONS,
  DEFAULT_GUEST_PERMISSIONS,
  normalizePermissions,
  PERMISSION_META,
  type Permission,
  type SessionRole,
} from "./auth.permissions";

const COOKIE_NAME = "mine_session";
const TOKEN_TTL = "24h";
/** Ban dopo troppi fallimenti in finestra breve. */
const BAN_THRESHOLD = 10;
const BAN_WINDOW_MS = 60 * 60 * 1000;
const BAN_MS = 24 * 60 * 60 * 1000;
/** Lock progressivo: fallimenti -> attesa. */
const LOCK_STEPS: { fails: number; ms: number }[] = [
  { fails: 3, ms: 60 * 1000 },
  { fails: 5, ms: 5 * 60 * 1000 },
  { fails: 7, ms: 15 * 60 * 1000 },
];
/** Cost factor for new password hashes (bcrypt). */
const BCRYPT_COST = 12;

type Attempt = {
  count: number;
  lockedUntil: number;
  firstSeen: number;
  totalFails: number;
  banUntil: number;
};
const attempts = new Map<string, Attempt>();

/**
 * Idratazione da Supabase (una tantum per processo): ripristina membri,
 * inviti, ban, binding IP, profilo admin e token revocati dopo un restart.
 * Senza Supabase configurato resta tutto in memoria (comportamento attuale).
 */
let authHydrated = false;
let authHydrating: Promise<void> | null = null;

async function hydrateAuthState(): Promise<void> {
  try {
    if (!(await storeAvailable())) return;
    persist(pruneAuthTables(IP_BIND_WINDOW_MS));
    const [members, temps, bindings, bans, profile, jtis] = await Promise.all([
      fetchMembers(),
      fetchTemps(),
      fetchBindings(),
      fetchBans(),
      fetchAdminProfile(),
      fetchRevokedJtis(),
    ]);
    const now = Date.now();
    if (members) {
      for (const m of members) {
        registeredUsers.set(m.id, {
          id: m.id,
          label: m.label,
          hash: m.hash,
          permissions: normalizePermissions(m.permissions),
          createdAt: m.createdAt,
          fromTempId: m.fromTempId,
        });
      }
    }
    if (temps) {
      for (const t of temps) {
        if (t.expiresAt <= now) continue;
        if (t.maxUses !== null && t.uses >= t.maxUses) continue;
        tempPasswords.set(t.id, {
          id: t.id,
          label: t.label,
          icon: (["none", "key", "user", "users", "star", "shield", "coffee", "gamepad", "sparkles", "heart"] as TempPasswordIcon[]).includes(
            t.icon as TempPasswordIcon,
          )
            ? (t.icon as TempPasswordIcon)
            : "none",
          hash: t.hash,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
          uses: t.uses,
          maxUses: t.maxUses,
          permissions: normalizePermissions(t.permissions),
        });
      }
    }
    if (bindings) {
      for (const b of bindings) {
        if (now - b.updatedAt > IP_BIND_WINDOW_MS) continue;
        let entry = credentialIps.get(b.key);
        if (!entry) {
          entry = { ips: new Map(), firstSeen: b.updatedAt };
          credentialIps.set(b.key, entry);
        }
        entry.ips.set(b.ip, b.updatedAt);
      }
    }
    if (bans) {
      for (const b of bans) {
        attempts.set(b.ip, {
          count: b.count,
          lockedUntil: b.lockedUntil,
          firstSeen: b.firstSeen,
          totalFails: b.totalFails,
          banUntil: b.banUntil,
        });
      }
    }
    if (profile) {
      adminProfile = {
        label: profile.label,
        avatar: (VALID_ICONS as string[]).includes(profile.avatar)
          ? (profile.avatar as TempPasswordIcon)
          : "none",
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      };
    }
    if (jtis) {
      for (const jti of jtis) revokedJtis.add(jti);
    }
  } catch {
    /* fallback in memoria */
  }
}

function ensureAuthHydrated(): Promise<void> {
  if (authHydrated) return Promise.resolve();
  if (!authHydrating) {
    authHydrating = hydrateAuthState().finally(() => {
      authHydrated = true;
    });
  }
  return authHydrating;
}

/** Scrittura best-effort su Supabase: mai un throw verso il chiamante. */
function persist(p: Promise<unknown>): void {
  void p.catch(() => {});
}

export type ActionLog = {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
};

const actionLog: ActionLog[] = [];

export function logAction(level: ActionLog["level"], message: string) {
  actionLog.unshift({ ts: new Date().toISOString(), level, message });
  if (actionLog.length > 200) actionLog.pop();
}

export function getActionLog(): ActionLog[] {
  return actionLog.slice(0, 50);
}

export const sessionCookieName = COOKIE_NAME;

export type SessionClaims = {
  role: SessionRole;
  permissions: Permission[];
  mustSetPassword: boolean;
  label?: string;
  avatar?: string;
  userId?: string;
  tempId?: string;
  /** IP al momento del login (verificato solo se SESSION_BIND_IP=1). */
  loginIp?: string;
};

function secret(): Uint8Array {
  const value = process.env["MINE_JWT_SECRET"];
  if (!value) throw new Error("MINE_JWT_SECRET non configurato");
  if (value.length < 32) {
    throw new Error("MINE_JWT_SECRET troppo corto (min 32 caratteri): sessioni disabilitate.");
  }
  return new TextEncoder().encode(value);
}

/**
 * Secchio globale anti-spoof: se l'attaccante ruota X-Forwarded-For, ogni IP
 * falso ha il suo bucket, ma il volume totale fa scattare questo blocco
 * breve per tutto il sito. Finestra corta: la perdita al restart è accettabile.
 */
const GLOBAL_FAIL_THRESHOLD = 30;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;
const GLOBAL_LOCK_MS = 5 * 60 * 1000;
let globalFails = 0;
let globalWindowStart = Date.now();
let globalLockedUntil = 0;

export function checkGlobalLock(): { blocked: boolean; retryInSec: number } {
  const now = Date.now();
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalFails = 0;
  }
  if (globalLockedUntil > now) {
    return { blocked: true, retryInSec: Math.max(1, Math.ceil((globalLockedUntil - now) / 1000)) };
  }
  return { blocked: false, retryInSec: 0 };
}

export function registerGlobalFailure(): void {
  const now = Date.now();
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalFails = 0;
  }
  globalFails += 1;
  if (globalFails >= GLOBAL_FAIL_THRESHOLD) {
    globalLockedUntil = now + GLOBAL_LOCK_MS;
    globalFails = 0;
    logAction("error", "Blocco globale login 5min per volume anomalo di tentativi");
  }
}

export type RateLimitStatus = {
  blocked: boolean;
  banned: boolean;
  retryInMin: number;
  retryInSec: number;
  banInSec: number;
  remaining: number;
};

function lockMsForFails(count: number): number {
  let ms = 0;
  for (const step of LOCK_STEPS) {
    if (count >= step.fails) ms = step.ms;
  }
  return ms;
}

export async function checkRateLimit(ip: string): Promise<RateLimitStatus> {
  await ensureAuthHydrated();
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry) {
    if (entry.banUntil > now) {
      const ms = entry.banUntil - now;
      return {
        blocked: true,
        banned: true,
        retryInMin: Math.ceil(ms / 60000),
        retryInSec: Math.max(1, Math.ceil(ms / 1000)),
        banInSec: Math.max(1, Math.ceil(ms / 1000)),
        remaining: 0,
      };
    }
    if (entry.lockedUntil > now) {
      const ms = entry.lockedUntil - now;
      return {
        blocked: true,
        banned: false,
        retryInMin: Math.ceil(ms / 60000),
        retryInSec: Math.max(1, Math.ceil(ms / 1000)),
        banInSec: 0,
        remaining: 0,
      };
    }
  }
  return { blocked: false, banned: false, retryInMin: 0, retryInSec: 0, banInSec: 0, remaining: 3 };
}

function persistBan(ip: string): void {
  if (ip === "unknown") return;
  const e = attempts.get(ip);
  if (!e) return;
  persist(
    saveBan({
      ip,
      count: e.count,
      lockedUntil: e.lockedUntil,
      firstSeen: e.firstSeen,
      totalFails: e.totalFails,
      banUntil: e.banUntil,
    }),
  );
}

export async function registerFailure(ip: string): Promise<RateLimitStatus> {
  await ensureAuthHydrated();
  const now = Date.now();
  const entry = attempts.get(ip) ?? {
    count: 0,
    lockedUntil: 0,
    firstSeen: now,
    totalFails: 0,
    banUntil: 0,
  };
  // Reset finestra se vecchia
  if (now - entry.firstSeen > BAN_WINDOW_MS) {
    entry.count = 0;
    entry.totalFails = 0;
    entry.firstSeen = now;
  }
  entry.count += 1;
  entry.totalFails += 1;

  // Ban: troppi fallimenti nella finestra.
  // Eccezione: IP sconosciuto — mai ban globale (evita collateral-DoS sul
  // bucket condiviso "unknown"), solo lock breve.
  if (ip === "unknown") {
    const lockMs = Math.min(lockMsForFails(entry.count) || 60_000, 60_000);
    entry.lockedUntil = now + lockMs;
    attempts.set(ip, entry);
    return {
      blocked: true,
      banned: false,
      retryInMin: Math.ceil(lockMs / 60000),
      retryInSec: Math.ceil(lockMs / 1000),
      banInSec: 0,
      remaining: 0,
    };
  }
  if (entry.totalFails >= BAN_THRESHOLD) {
    entry.banUntil = now + BAN_MS;
    entry.count = 0;
    entry.lockedUntil = 0;
    attempts.set(ip, entry);
    persistBan(ip);
    logAction("error", `IP bannato 24h per troppi tentativi: ${ip}`);
    return {
      blocked: true,
      banned: true,
      retryInMin: Math.ceil(BAN_MS / 60000),
      retryInSec: Math.ceil(BAN_MS / 1000),
      banInSec: Math.ceil(BAN_MS / 1000),
      remaining: 0,
    };
  }

  const lockMs = lockMsForFails(entry.count);
  if (lockMs > 0) {
    entry.lockedUntil = now + lockMs;
    attempts.set(ip, entry);
    persistBan(ip);
    logAction("warn", `Lock login ${Math.round(lockMs / 1000)}s per ${ip} (${entry.count} errori)`);
    return {
      blocked: true,
      banned: false,
      retryInMin: Math.ceil(lockMs / 60000),
      retryInSec: Math.ceil(lockMs / 1000),
      banInSec: 0,
      remaining: 0,
    };
  }
  attempts.set(ip, entry);
  persistBan(ip);
  const nextStep = LOCK_STEPS.find((s) => s.fails > entry.count);
  const remaining = nextStep ? nextStep.fails - entry.count : 1;
  return {
    blocked: false,
    banned: false,
    retryInMin: 0,
    retryInSec: 0,
    banInSec: 0,
    remaining,
  };
}

export async function clearFailures(ip: string) {
  await ensureAuthHydrated();
  attempts.delete(ip);
  if (ip !== "unknown") persist(deleteBan(ip));
}

/**
 * Flag Secure del cookie di sessione.
 * Default "1" (solo https). In LAN su http puro imposta COOKIE_SECURE=0,
 * altrimenti il browser scarta il cookie e il login non resta mai attivo.
 * Mai usare "0" su istanze esposte a internet.
 */
export function isCookieSecure(): boolean {
  return process.env["COOKIE_SECURE"] !== "0";
}

/** Sessione legata all'IP di login? Default no (IP mobili ruotano spesso). */
export function isSessionBoundToIp(): boolean {
  return process.env["SESSION_BIND_IP"] === "1";
}

/** Max IP distinti per credenziale (password). */
export const MAX_IPS_PER_CREDENTIAL = 3;
/** Finestra di validità dei binding IP (30 giorni, sliding). */
const IP_BIND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type IpBinding = { ips: Map<string, number>; firstSeen: number };
const credentialIps = new Map<string, IpBinding>();

/**
 * Vincola ogni password a max 3 IP distinti (dispositivi/reti).
 * Ritorna ok:false quando un 4° IP distinto prova la stessa password.
 * L'IP "unknown" non è vincolabile: passa senza contare (evita lock collettivi).
 */
export async function checkCredentialIp(
  key: string,
  ip: string,
): Promise<{ ok: boolean; message: string; count: number }> {
  await ensureAuthHydrated();
  if (ip === "unknown") return { ok: true, message: "", count: 0 };
  const now = Date.now();
  let b = credentialIps.get(key);
  if (!b || now - b.firstSeen > IP_BIND_WINDOW_MS) {
    b = { ips: new Map(), firstSeen: now };
    credentialIps.set(key, b);
  }
  for (const [seenIp, ts] of b.ips) {
    if (now - ts > IP_BIND_WINDOW_MS) {
      b.ips.delete(seenIp);
      persist(deleteBindings(key));
    }
  }
  if (b.ips.has(ip)) {
    b.ips.set(ip, now);
    persist(saveBinding(key, ip, now));
    return { ok: true, message: "", count: b.ips.size };
  }
  if (b.ips.size >= MAX_IPS_PER_CREDENTIAL) {
    logAction("warn", `Limite 3 IP superato per credenziale "${key}" (bloccato ${ip})`);
    return {
      ok: false,
      message:
        "Questa password è già usata dal numero massimo di dispositivi (3). Chiedi all'admin di sbloccarla.",
      count: b.ips.size,
    };
  }
  b.ips.set(ip, now);
  persist(saveBinding(key, ip, now));
  return { ok: true, message: "", count: b.ips.size };
}

export type CredentialIpBinding = { key: string; count: number; ips: string[] };

export async function listCredentialIpBindings(): Promise<CredentialIpBinding[]> {
  await ensureAuthHydrated();
  const now = Date.now();
  const out: CredentialIpBinding[] = [];
  for (const [key, b] of credentialIps) {
    const ips = [...b.ips.entries()]
      .filter(([, ts]) => now - ts <= IP_BIND_WINDOW_MS)
      .map(([seenIp]) => seenIp);
    if (ips.length > 0) out.push({ key, count: ips.length, ips });
  }
  return out.sort((a, b) => b.count - a.count);
}

export async function clearCredentialIps(key?: string): Promise<void> {
  await ensureAuthHydrated();
  if (key) {
    credentialIps.delete(key);
    logAction("info", `Binding IP azzerati per "${key}"`);
  } else {
    credentialIps.clear();
    logAction("info", "Tutti i binding IP azzerati");
  }
  persist(deleteBindings(key));
}

/** Profilo admin: anche l'admin crea nome profilo al primo accesso. */
export type AdminProfile = {
  label: string;
  avatar: TempPasswordIcon;
  createdAt: number;
  updatedAt: number;
};
let adminProfile: AdminProfile | null = null;

export async function getAdminProfile(): Promise<AdminProfile | null> {
  await ensureAuthHydrated();
  return adminProfile;
}

export async function setAdminProfile(label: string, avatar?: string): Promise<AdminProfile> {
  await ensureAuthHydrated();
  const clean = label.trim().slice(0, 40) || "Admin";
  const icon = normalizeIcon(avatar);
  const now = Date.now();
  adminProfile = adminProfile
    ? { ...adminProfile, label: clean, avatar: icon, updatedAt: now }
    : { label: clean, avatar: icon, createdAt: now, updatedAt: now };
  persist(
    saveAdminProfile({
      label: adminProfile.label,
      avatar: adminProfile.avatar,
      createdAt: adminProfile.createdAt,
      updatedAt: adminProfile.updatedAt,
    }),
  );
  logAction("info", `Profilo admin impostato: ${clean} (${icon})`);
  return adminProfile;
}

/**
 * Anti-bot: honeypot + tempo minimo di compilazione.
 * Il client invia `website` (deve restare vuoto) e `startedAt` (ms epoch
 * di quando il form è stato mostrato). I bot compilano in <1s o riempiono tutto.
 */
export function checkBotSignals(input: {
  honeypot?: string | null;
  startedAt?: number | null;
}): { ok: boolean; reason: string } {
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { ok: false, reason: "bot" };
  }
  // startedAt assente = client datato (cache pre-anti-bot): lascia passare,
  // la honeypot + rate limit restano attivi.
  if (input.startedAt === undefined || input.startedAt === null) {
    return { ok: true, reason: "" };
  }
  const started = typeof input.startedAt === "number" ? input.startedAt : NaN;
  if (!Number.isFinite(started)) return { ok: false, reason: "bot" };
  let elapsed = Date.now() - started;
  if (elapsed < 0) {
    // Orologio client avanti rispetto al server: tolleranza 30s, oltre è replay.
    if (elapsed < -30_000) return { ok: false, reason: "stale" };
    elapsed = 2000;
  }
  // Soglia 800ms: i bot inviano in decine di ms, anche il password manager
  // più veloce con autofill+Enter resta sopra. Max 30min (form lasciato aperto).
  if (elapsed < 800) return { ok: false, reason: "too-fast" };
  if (elapsed > 30 * 60 * 1000) return { ok: false, reason: "stale" };
  return { ok: true, reason: "" };
}

export type TempPasswordIcon =
  | "none"
  | "key"
  | "user"
  | "users"
  | "star"
  | "shield"
  | "coffee"
  | "gamepad"
  | "sparkles"
  | "heart";

export type TempPassword = {
  id: string;
  label: string;
  icon: TempPasswordIcon;
  hash: string;
  createdAt: number;
  expiresAt: number;
  uses: number;
  maxUses: number | null;
  permissions: Permission[];
};

const tempPasswords = new Map<string, TempPassword>();

function pruneExpired() {
  const now = Date.now();
  const removed: string[] = [];
  for (const [id, tp] of tempPasswords) {
    if (tp.expiresAt <= now) {
      tempPasswords.delete(id);
      removed.push(id);
    } else if (tp.maxUses !== null && tp.uses >= tp.maxUses) {
      tempPasswords.delete(id);
      removed.push(id);
    }
  }
  for (const id of removed) persist(deleteTemp(id));
}

const VALID_ICONS: TempPasswordIcon[] = [
  "none",
  "key",
  "user",
  "users",
  "star",
  "shield",
  "coffee",
  "gamepad",
  "sparkles",
  "heart",
];

function normalizeIcon(icon: string | undefined | null): TempPasswordIcon {
  if (icon && VALID_ICONS.includes(icon as TempPasswordIcon)) {
    return icon as TempPasswordIcon;
  }
  return "none";
}

export async function createTempPassword(opts: {
  label: string;
  durationMs: number;
  maxUses?: number | null;
  icon?: string | null;
  permissions?: string[] | null;
}): Promise<{
  id: string;
  password: string;
  label: string;
  icon: TempPasswordIcon;
  expiresAt: number;
  maxUses: number | null;
  permissions: Permission[];
}> {
  pruneExpired();
  const id = randomBytes(8).toString("hex");
  const password = randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const createdAt = Date.now();
  const expiresAt = createdAt + opts.durationMs;
  const maxUses = opts.maxUses ?? null;
  const icon = normalizeIcon(opts.icon);
  const permissions = normalizePermissions(opts.permissions);
  const row: TempPassword = {
    id,
    label: opts.label.trim() || "Ospite",
    icon,
    hash,
    createdAt,
    expiresAt,
    uses: 0,
    maxUses,
    permissions,
  };
  tempPasswords.set(id, row);
  persist(
    saveTemp({
      id: row.id,
      label: row.label,
      icon: row.icon,
      hash: row.hash,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      uses: row.uses,
      maxUses: row.maxUses,
      permissions: row.permissions,
    }),
  );
  logAction(
    "info",
    `Password temporanea creata: ${opts.label.trim() || "Ospite"} (${icon}, ${permissions.length} permessi)`,
  );
  return {
    id,
    password,
    label: opts.label.trim() || "Ospite",
    icon,
    expiresAt,
    maxUses,
    permissions,
  };
}

export async function listTempPasswords(): Promise<
  Array<{
    id: string;
    label: string;
    icon: TempPasswordIcon;
    createdAt: number;
    expiresAt: number;
    uses: number;
    maxUses: number | null;
    expired: boolean;
    permissions: Permission[];
  }>
> {
  await ensureAuthHydrated();
  pruneExpired();
  const now = Date.now();
  return Array.from(tempPasswords.values())
    .map((tp) => ({
      id: tp.id,
      label: tp.label,
      icon: tp.icon ?? "none",
      createdAt: tp.createdAt,
      expiresAt: tp.expiresAt,
      uses: tp.uses,
      maxUses: tp.maxUses,
      expired: tp.expiresAt <= now,
      permissions: tp.permissions ?? DEFAULT_GUEST_PERMISSIONS,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function revokeTempPassword(id: string): Promise<boolean> {
  await ensureAuthHydrated();
  const ok = tempPasswords.delete(id);
  if (ok) {
    persist(deleteTemp(id));
    logAction("info", `Password temporanea revocata: ${id}`);
  }
  return ok;
}

type RegisteredUser = {
  id: string;
  label: string;
  hash: string;
  permissions: Permission[];
  createdAt: number;
  fromTempId?: string;
};

const registeredUsers = new Map<string, RegisteredUser>();

export type AuthMatch =
  | { kind: "admin" }
  | { kind: "temp"; id: string; label: string; permissions: Permission[] }
  | { kind: "member"; id: string; label: string; permissions: Permission[] }
  | null;

/**
 * Verifica password admin (env), membri registrati e password temporanee.
 * MINE_PASSWORD_HASH deve essere un hash bcrypt ($2a$ / $2b$): valori in
 * chiaro sono rifiutati (fail-closed) in qualsiasi ambiente.
 *
 * I candidati sono valutati TUTTI (nessun return anticipato) per non esporre
 * un oracolo temporale su quale password ha matchato. A parità di match
 * vince admin > member > temp.
 */
export async function matchPassword(password: string): Promise<AuthMatch> {
  await ensureAuthHydrated();
  let adminMatch = false;
  const hash = process.env["MINE_PASSWORD_HASH"];
  if (hash) {
    try {
      if (hash.startsWith("$2")) {
        adminMatch = await bcrypt.compare(password, hash);
      } else {
        console.warn(
          "[auth] MINE_PASSWORD_HASH non è un hash bcrypt: login admin disabilitato. Genera un hash con bcrypt e aggiorna l'env.",
        );
      }
    } catch {
      /* fall through */
    }
  }

  let member: RegisteredUser | null = null;
  for (const u of registeredUsers.values()) {
    try {
      if (await bcrypt.compare(password, u.hash)) member ??= u;
    } catch {
      /* continua con gli altri candidati */
    }
  }

  pruneExpired();
  let temp: TempPassword | null = null;
  for (const tp of tempPasswords.values()) {
    if (tp.expiresAt <= Date.now()) continue;
    if (tp.maxUses !== null && tp.uses >= tp.maxUses) continue;
    try {
      if (await bcrypt.compare(password, tp.hash)) temp ??= tp;
    } catch {
      /* continua con gli altri candidati */
    }
  }

  if (adminMatch) return { kind: "admin" };
  if (member) {
    return {
      kind: "member",
      id: member.id,
      label: member.label,
      permissions: member.permissions,
    };
  }
  if (temp) {
    // Uso single-thread: riserva atomica del posto prima di restituire il match.
    // La catena di lock per id evita doppi usi concorrenti di inviti maxUses:1.
    const reserved = await reserveTempUse(temp.id);
    if (!reserved) return null;
    logAction("info", `Login con password temporanea "${temp.label}"`);
    return {
      kind: "temp",
      id: temp.id,
      label: temp.label,
      permissions: temp.permissions ?? DEFAULT_GUEST_PERMISSIONS,
    };
  }
  return null;
}

/** Catena di lock per id: serializza gli usi concorrenti dello stesso invito. */
const tempLocks = new Map<string, Promise<boolean>>();

function reserveTempUse(id: string): Promise<boolean> {
  const prev = tempLocks.get(id) ?? Promise.resolve(true);
  const next = prev.then(() => {
    const tp = tempPasswords.get(id);
    if (!tp) return false;
    if (tp.expiresAt <= Date.now()) {
      tempPasswords.delete(id);
      persist(deleteTemp(id));
      return false;
    }
    if (tp.maxUses !== null && tp.uses >= tp.maxUses) {
      tempPasswords.delete(id);
      persist(deleteTemp(id));
      return false;
    }
    tp.uses += 1;
    persist(
      saveTemp({
        id: tp.id,
        label: tp.label,
        icon: tp.icon,
        hash: tp.hash,
        createdAt: tp.createdAt,
        expiresAt: tp.expiresAt,
        uses: tp.uses,
        maxUses: tp.maxUses,
        permissions: tp.permissions,
      }),
    );
    if (tp.maxUses !== null && tp.uses >= tp.maxUses) {
      tempPasswords.delete(tp.id);
      persist(deleteTemp(tp.id));
    }
    return true;
  });
  tempLocks.set(id, next.catch(() => false));
  next.finally(() => {
    if (tempLocks.get(id) === next) tempLocks.delete(id);
  }).catch(() => {});
  return next;
}

/** Invito ancora valido (non scaduto/revocato/esaurito)? */
export async function isTempPasswordAlive(id: string): Promise<boolean> {
  await ensureAuthHydrated();
  pruneExpired();
  const tp = tempPasswords.get(id);
  if (!tp) return false;
  if (tp.expiresAt <= Date.now()) {
    tempPasswords.delete(id);
    return false;
  }
  if (tp.maxUses !== null && tp.uses >= tp.maxUses) {
    tempPasswords.delete(id);
    return false;
  }
  return true;
}

/** Consuma definitivamente l'invito dopo la registrazione del membro. */
export async function consumeTempPassword(id: string): Promise<void> {
  await ensureAuthHydrated();
  if (tempPasswords.delete(id)) {
    persist(deleteTemp(id));
    logAction("info", `Invito temporaneo consumato: ${id}`);
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  return (await matchPassword(password)) !== null;
}

export async function registerMemberFromGuest(opts: {
  label: string;
  password: string;
  permissions: Permission[];
  fromTempId?: string;
}): Promise<{ id: string; label: string }> {
  const { validateNewPassword, PASSWORD_MIN_LENGTH } = await import("./password-policy");
  const check = validateNewPassword(opts.password);
  if (!check.ok) {
    throw new Error(check.message);
  }
  if (opts.password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password troppo corta (min ${PASSWORD_MIN_LENGTH})`);
  }
  const id = randomBytes(8).toString("hex");
  const hash = await bcrypt.hash(opts.password, BCRYPT_COST);
  const permissions = normalizePermissions(opts.permissions).filter((p) => p !== "access");
  const createdAt = Date.now();
  registeredUsers.set(id, {
    id,
    label: opts.label.trim() || "Membro",
    hash,
    permissions,
    createdAt,
    fromTempId: opts.fromTempId,
  });
  persist(
    saveMember({
      id,
      label: opts.label.trim() || "Membro",
      hash,
      permissions,
      createdAt,
      fromTempId: opts.fromTempId,
    }),
  );
  logAction("info", `Membro registrato: ${opts.label.trim() || "Membro"}`);
  return { id, label: opts.label.trim() || "Membro" };
}

export async function createToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    role: claims.role,
    permissions: claims.permissions,
    mustSetPassword: claims.mustSetPassword,
    label: claims.label ?? "",
    avatar: claims.avatar ?? "",
    userId: claims.userId ?? "",
    tempId: claims.tempId ?? "",
    loginIp: claims.loginIp ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomBytes(16).toString("hex"))
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret());
}

/** Token revocati (logout): denylist in-memory consultata da readSession. */
const revokedJtis = new Set<string>();

export function revokeToken(token: string | undefined): void {
  if (!token) return;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { jti?: unknown; exp?: unknown };
    if (typeof payload.jti === "string" && payload.jti) {
      revokedJtis.add(payload.jti);
      persist(saveRevokedJti(payload.jti));
      if (revokedJtis.size > 5000) {
        const first = revokedJtis.values().next().value;
        if (first) revokedJtis.delete(first);
      }
    }
  } catch {
    /* token illeggibile: niente da revocare */
  }
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.jti === "string" && revokedJtis.has(payload.jti)) return null;
    // Default sicuro: guest, non admin, se il claim manca o è invalido.
    const rawRole = payload.role as string | undefined;
    const role: SessionRole =
      rawRole === "admin" || rawRole === "member" || rawRole === "guest" ? rawRole : "guest";
    const permissions =
      role === "admin"
        ? ([...ALL_PERMISSIONS] as Permission[])
        : normalizePermissions((payload.permissions as string[]) || []);
    return {
      role,
      permissions,
      mustSetPassword: Boolean(payload.mustSetPassword),
      label: (payload.label as string) || undefined,
      avatar: (payload.avatar as string) || undefined,
      userId: (payload.userId as string) || undefined,
      tempId: (payload.tempId as string) || undefined,
      loginIp: (payload.loginIp as string) || undefined,
    };
  } catch {
    return null;
  }
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  return (await readSession(token)) !== null;
}

/** True se la sessione ha almeno uno dei permessi richiesti (admin ha tutto). */
export function sessionHasPermission(
  session: SessionClaims,
  required: Permission | Permission[],
): boolean {
  if (session.role === "admin") return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((p) => session.permissions.includes(p));
}

export function pathAllowed(pathname: string, session: SessionClaims | null): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (session.mustSetPassword) {
    return pathname === "/setup-password" || pathname === "/login";
  }
  if (pathname.startsWith("/assistant")) {
    return session.permissions.includes("assistant");
  }
  if (pathname.startsWith("/code")) {
    return session.permissions.includes("code");
  }
  const perm = ROUTE_PERMISSION[pathname];
  if (!perm) return true;
  return session.permissions.includes(perm);
}
