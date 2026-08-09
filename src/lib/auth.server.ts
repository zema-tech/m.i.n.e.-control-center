import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

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

export function checkRateLimit(ip: string): { blocked: boolean; retryInMin: number } {
  const entry = attempts.get(ip);
  if (entry && entry.lockedUntil > Date.now()) {
    return { blocked: true, retryInMin: Math.ceil((entry.lockedUntil - Date.now()) / 60000) };
  }
  return { blocked: false, retryInMin: 0 };
}

export function registerFailure(ip: string): { blocked: boolean; remaining: number } {
  const entry = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
    attempts.set(ip, entry);
    return { blocked: true, remaining: 0 };
  }
  attempts.set(ip, entry);
  return { blocked: false, remaining: MAX_ATTEMPTS - entry.count };
}

export function clearFailures(ip: string) {
  attempts.delete(ip);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env["MINE_PASSWORD_HASH"];
  if (!hash) throw new Error("MINE_PASSWORD_HASH non configurato");
  if (hash.startsWith("$2")) return bcrypt.compare(password, hash);
  // Fallback: la variabile contiene la password in chiaro -> la si confronta dopo hashing.
  return bcrypt.compare(password, await bcrypt.hash(hash, 10));
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
