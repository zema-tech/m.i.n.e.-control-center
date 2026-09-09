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
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
/** Cost factor for new password hashes (bcrypt). */
const BCRYPT_COST = 12;

type Attempt = { count: number; lockedUntil: number };
const attempts = new Map<string, Attempt>();

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
  userId?: string;
  tempId?: string;
};

function secret(): Uint8Array {
  const value = process.env["MINE_JWT_SECRET"];
  if (!value) throw new Error("MINE_JWT_SECRET non configurato");
  return new TextEncoder().encode(value);
}

export function checkRateLimit(ip: string): {
  blocked: boolean;
  retryInMin: number;
  retryInSec: number;
} {
  const entry = attempts.get(ip);
  if (entry && entry.lockedUntil > Date.now()) {
    const ms = entry.lockedUntil - Date.now();
    return {
      blocked: true,
      retryInMin: Math.ceil(ms / 60000),
      retryInSec: Math.max(1, Math.ceil(ms / 1000)),
    };
  }
  return { blocked: false, retryInMin: 0, retryInSec: 0 };
}

export function registerFailure(ip: string): {
  blocked: boolean;
  remaining: number;
  retryInSec: number;
} {
  const entry = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
    attempts.set(ip, entry);
    return { blocked: true, remaining: 0, retryInSec: Math.ceil(LOCK_MS / 1000) };
  }
  attempts.set(ip, entry);
  return { blocked: false, remaining: MAX_ATTEMPTS - entry.count, retryInSec: 0 };
}

export function clearFailures(ip: string) {
  attempts.delete(ip);
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
  for (const [id, tp] of tempPasswords) {
    if (tp.expiresAt <= now) tempPasswords.delete(id);
    else if (tp.maxUses !== null && tp.uses >= tp.maxUses) tempPasswords.delete(id);
  }
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
  tempPasswords.set(id, {
    id,
    label: opts.label.trim() || "Ospite",
    icon,
    hash,
    createdAt,
    expiresAt,
    uses: 0,
    maxUses,
    permissions,
  });
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

export function listTempPasswords(): Array<{
  id: string;
  label: string;
  icon: TempPasswordIcon;
  createdAt: number;
  expiresAt: number;
  uses: number;
  maxUses: number | null;
  expired: boolean;
  permissions: Permission[];
}> {
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

export function revokeTempPassword(id: string): boolean {
  const ok = tempPasswords.delete(id);
  if (ok) logAction("info", `Password temporanea revocata: ${id}`);
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
 * MINE_PASSWORD_HASH deve essere un hash bcrypt ($2a$ / $2b$).
 * In non-produzione è tollerato un confronto plaintext solo se il valore non è bcrypt (legacy).
 */
export async function matchPassword(password: string): Promise<AuthMatch> {
  const hash = process.env["MINE_PASSWORD_HASH"];
  if (hash) {
    try {
      if (hash.startsWith("$2")) {
        if (await bcrypt.compare(password, hash)) return { kind: "admin" };
      } else if (process.env.NODE_ENV !== "production") {
        // Legacy plaintext — solo fuori produzione; genera sempre un hash bcrypt in prod.
        if (password === hash) {
          console.warn(
            "[auth] MINE_PASSWORD_HASH è in chiaro. Genera un hash bcrypt e aggiorna l'env.",
          );
          return { kind: "admin" };
        }
      }
    } catch {
      /* fall through */
    }
  }

  for (const u of registeredUsers.values()) {
    if (await bcrypt.compare(password, u.hash)) {
      return {
        kind: "member",
        id: u.id,
        label: u.label,
        permissions: u.permissions,
      };
    }
  }

  pruneExpired();
  for (const tp of tempPasswords.values()) {
    if (tp.expiresAt <= Date.now()) continue;
    if (tp.maxUses !== null && tp.uses >= tp.maxUses) continue;
    const match = await bcrypt.compare(password, tp.hash);
    if (match) {
      tp.uses += 1;
      logAction("info", `Login con password temporanea "${tp.label}"`);
      if (tp.maxUses !== null && tp.uses >= tp.maxUses) tempPasswords.delete(tp.id);
      return {
        kind: "temp",
        id: tp.id,
        label: tp.label,
        permissions: tp.permissions ?? DEFAULT_GUEST_PERMISSIONS,
      };
    }
  }
  return null;
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
  if (opts.password.length < 8) {
    throw new Error("Password troppo corta (min 8)");
  }
  const id = randomBytes(8).toString("hex");
  const hash = await bcrypt.hash(opts.password, BCRYPT_COST);
  const permissions = normalizePermissions(opts.permissions).filter((p) => p !== "access");
  registeredUsers.set(id, {
    id,
    label: opts.label.trim() || "Membro",
    hash,
    permissions,
    createdAt: Date.now(),
    fromTempId: opts.fromTempId,
  });
  logAction("info", `Membro registrato: ${opts.label.trim() || "Membro"}`);
  return { id, label: opts.label.trim() || "Membro" };
}

export async function createToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    role: claims.role,
    permissions: claims.permissions,
    mustSetPassword: claims.mustSetPassword,
    label: claims.label ?? "",
    userId: claims.userId ?? "",
    tempId: claims.tempId ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
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
      userId: (payload.userId as string) || undefined,
      tempId: (payload.tempId as string) || undefined,
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
