import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";

const COOKIE_NAME = "mine_session";
const TOKEN_TTL = "24h";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

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

/* ── Temporary passwords (in-memory, cleared on restart) ── */

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
}): Promise<{
  id: string;
  password: string;
  label: string;
  icon: TempPasswordIcon;
  expiresAt: number;
  maxUses: number | null;
}> {
  pruneExpired();
  const id = randomBytes(8).toString("hex");
  const password = randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(password, 10);
  const createdAt = Date.now();
  const expiresAt = createdAt + opts.durationMs;
  const maxUses = opts.maxUses ?? null;
  const icon = normalizeIcon(opts.icon);
  tempPasswords.set(id, {
    id,
    label: opts.label.trim() || "Ospite",
    icon,
    hash,
    createdAt,
    expiresAt,
    uses: 0,
    maxUses,
  });
  logAction("info", `Password temporanea creata: ${opts.label.trim() || "Ospite"} (${icon})`);
  return {
    id,
    password,
    label: opts.label.trim() || "Ospite",
    icon,
    expiresAt,
    maxUses,
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
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function revokeTempPassword(id: string): boolean {
  const ok = tempPasswords.delete(id);
  if (ok) logAction("info", `Password temporanea revocata: ${id}`);
  return ok;
}

async function verifyTempPassword(password: string): Promise<boolean> {
  pruneExpired();
  for (const tp of tempPasswords.values()) {
    if (tp.expiresAt <= Date.now()) continue;
    if (tp.maxUses !== null && tp.uses >= tp.maxUses) continue;
    const match = await bcrypt.compare(password, tp.hash);
    if (match) {
      tp.uses += 1;
      logAction("info", `Login con password temporanea "${tp.label}"`);
      if (tp.maxUses !== null && tp.uses >= tp.maxUses) tempPasswords.delete(tp.id);
      return true;
    }
  }
  return false;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env["MINE_PASSWORD_HASH"];
  if (hash) {
    try {
      if (hash.startsWith("$2")) {
        if (await bcrypt.compare(password, hash)) return true;
      } else {
        if (await bcrypt.compare(password, await bcrypt.hash(hash, 10))) return true;
      }
    } catch {
      /* fall through */
    }
  }
  return verifyTempPassword(password);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret());
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
