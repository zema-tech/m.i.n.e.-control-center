import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestIP, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ALL_PERMISSIONS,
  checkBotSignals,
  checkRateLimit,
  clearFailures,
  consumeTempPassword,
  createTempPassword,
  createToken,
  getActionLog,
  isTempPasswordAlive,
  isValidToken,
  listTempPasswords,
  logAction,
  matchPassword,
  pathAllowed,
  readSession,
  registerFailure,
  registerMemberFromGuest,
  revokeTempPassword,
  revokeToken,
  sessionCookieName,
  type Permission,
  type SessionClaims,
} from "./auth.server";
import { buildDemoStats } from "./server-stats.server";

const credSchema = z
  .object({
    key: z.string().min(1).max(500),
    serverId: z.string().min(1).max(120),
    base: z.string().max(300).optional(),
  })
  .optional();

const tempIconSchema = z.enum([
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
]);

const permissionSchema = z.enum(
  ALL_PERMISSIONS as unknown as [Permission, ...Permission[]],
);

/** Cookie di sessione: HttpOnly + Secure + SameSite=Lax (control center personale). */
function cookieOpts(maxAge = 60 * 60 * 24) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string().min(1).max(200),
        // Anti-bot: honeypot deve restare vuoto, startedAt = ms quando il form è apparso
        honeypot: z.string().max(100).optional().default(""),
        startedAt: z.number().int().positive().max(Date.now() + 60_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // IP dal socket, NON da X-Forwarded-For (header spoofabile dal client:
    // fidarsi dell'header permetteva di ruotare IP e bypassare lock/ban).
    const ip = getRequestIP() ?? "unknown";
    const limit = checkRateLimit(ip);
    if (limit.blocked) {
      return {
        ok: false as const,
        message: limit.banned
          ? `IP bannato per troppi tentativi. Riprova tra ${limit.retryInMin} min.`
          : `Accesso in pausa. Riprova tra ${limit.retryInMin} min.`,
        blocked: true as const,
        banned: limit.banned,
        retryInSec: limit.retryInSec,
        banInSec: limit.banInSec,
        remaining: 0,
        mustSetPassword: false as const,
      };
    }

    // Anti-bot silenzioso: conta come fallimento, messaggio generico per non dare indizi
    const bot = checkBotSignals({ honeypot: data.honeypot, startedAt: data.startedAt });
    if (!bot.ok) {
      const fail = registerFailure(ip);
      logAction("warn", `Blocco anti-bot (${bot.reason}) da ${ip}`);
      return {
        ok: false as const,
        message: "Richiesta non valida. Ricarica la pagina e riprova.",
        blocked: fail.blocked,
        banned: fail.banned,
        retryInSec: fail.retryInSec,
        banInSec: fail.banInSec,
        remaining: fail.remaining,
        mustSetPassword: false as const,
      };
    }

    let match;
    try {
      match = await matchPassword(data.password);
    } catch {
      return {
        ok: false as const,
        message: "Password non ancora configurata sul server.",
        blocked: false as const,
        banned: false as const,
        retryInSec: 0,
        banInSec: 0,
        remaining: null as number | null,
        mustSetPassword: false as const,
      };
    }

    if (!match) {
      const fail = registerFailure(ip);
      logAction("warn", `Tentativo di accesso fallito da ${ip}`);
      if (fail.blocked) {
        return {
          ok: false as const,
          message: fail.banned
            ? "Troppi tentativi. IP bannato per 24h."
            : `Troppi tentativi. Accesso in pausa (${Math.max(1, Math.round(fail.retryInSec / 60))} min).`,
          blocked: true as const,
          banned: fail.banned,
          retryInSec: fail.retryInSec,
          banInSec: fail.banInSec,
          remaining: 0,
          mustSetPassword: false as const,
        };
      }
      return {
        ok: false as const,
        message:
          fail.remaining === 1
            ? "Password non corretta. Ultimo tentativo prima del blocco."
            : `Password non corretta. Tentativi rimasti: ${fail.remaining}`,
        blocked: false as const,
        banned: false as const,
        retryInSec: 0,
        banInSec: 0,
        remaining: fail.remaining,
        mustSetPassword: false as const,
      };
    }

    clearFailures(ip);

    let claims: SessionClaims;
    if (match.kind === "admin") {
      claims = {
        role: "admin",
        permissions: [...ALL_PERMISSIONS],
        mustSetPassword: false,
        label: "Admin",
      };
    } else if (match.kind === "temp") {
      claims = {
        role: "guest",
        permissions: match.permissions,
        mustSetPassword: true,
        label: match.label,
        tempId: match.id,
      };
    } else {
      claims = {
        role: "member",
        permissions: match.permissions,
        mustSetPassword: false,
        label: match.label,
        userId: match.id,
      };
    }

    setCookie(sessionCookieName, await createToken(claims), cookieOpts());
    logAction(
      "info",
      `Accesso riuscito da ${ip} (${claims.role}${claims.mustSetPassword ? ", setup password" : ""})`,
    );

    return {
      ok: true as const,
      message: claims.mustSetPassword
        ? "Accesso ospite: crea la tua password"
        : "Accesso consentito",
      blocked: false as const,
      banned: false as const,
      retryInSec: 0,
      banInSec: 0,
      remaining: null as number | null,
      mustSetPassword: claims.mustSetPassword,
      role: claims.role,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  revokeToken(getCookie(sessionCookieName));
  deleteCookie(sessionCookieName, {
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "lax",
  });
  logAction("info", "Sessione terminata");
  return { ok: true as const };
});

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const session = await readSession(getCookie(sessionCookieName));
  if (!session) {
    return {
      authenticated: false as const,
      role: null as null,
      permissions: [] as Permission[],
      mustSetPassword: false as const,
      label: null as null,
    };
  }
  return {
    authenticated: true as const,
    role: session.role,
    permissions: session.permissions,
    mustSetPassword: session.mustSetPassword,
    label: session.label ?? null,
  };
});

export const setupOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string().min(10).max(200),
        confirm: z.string().min(10).max(200),
        displayName: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await readSession(getCookie(sessionCookieName));
    if (!session) {
      return { ok: false as const, message: "Sessione non valida" };
    }
    if (!session.mustSetPassword) {
      return { ok: false as const, message: "Password già impostata" };
    }
    if (data.password !== data.confirm) {
      return { ok: false as const, message: "Le password non coincidono" };
    }
    const { validateNewPassword } = await import("./password-policy");
    const check = validateNewPassword(data.password);
    if (!check.ok) {
      return { ok: false as const, message: check.message };
    }
    // L'invito deve esistere ancora: impedisce di riusare un JWT guest rubato
    // per creare N membri dopo revoca/scadenza/esaurimento dell'invito.
    if (!session.tempId || !isTempPasswordAlive(session.tempId)) {
      return { ok: false as const, message: "Invito scaduto o revocato. Chiedi un nuovo accesso." };
    }

    const label = (data.displayName?.trim() || session.label || "Membro").slice(0, 80);
    let registered: { id: string; label: string };
    try {
      registered = await registerMemberFromGuest({
        label,
        password: data.password,
        permissions: session.permissions,
        fromTempId: session.tempId,
      });
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : "Password non valida" };
    }
    // Single-use: l'invito si consuma alla prima registrazione.
    if (session.tempId) consumeTempPassword(session.tempId);

    const claims: SessionClaims = {
      role: "member",
      permissions: session.permissions.filter((p) => p !== "access"),
      mustSetPassword: false,
      label: registered.label,
      userId: registered.id,
    };
    setCookie(sessionCookieName, await createToken(claims), cookieOpts());
    logAction("info", `Password personale creata per ${registered.label}`);
    return { ok: true as const, message: "Password creata. Benvenuto nell'hub." };
  });

export const createGuestPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().max(80).default("Ospite"),
        durationHours: z.union([z.literal(1), z.literal(6), z.literal(24), z.literal(168)]),
        maxUses: z.number().int().min(1).max(100).nullable().optional(),
        icon: tempIconSchema.default("none"),
        permissions: z.array(permissionSchema).min(1).max(32).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await readSession(getCookie(sessionCookieName));
    if (!session || session.role !== "admin") {
      return { ok: false as const, message: "Solo admin può creare accessi" };
    }
    const created = await createTempPassword({
      label: data.label,
      durationMs: data.durationHours * 60 * 60 * 1000,
      maxUses: data.maxUses ?? null,
      icon: data.icon,
      permissions: data.permissions,
    });
    return {
      ok: true as const,
      id: created.id,
      password: created.password,
      label: created.label,
      icon: created.icon,
      expiresAt: created.expiresAt,
      maxUses: created.maxUses,
      permissions: created.permissions,
    };
  });

export const getGuestPasswords = createServerFn({ method: "GET" }).handler(async () => {
  const session = await readSession(getCookie(sessionCookieName));
  if (!session || session.role !== "admin") {
    return { ok: false as const, items: [] as ReturnType<typeof listTempPasswords> };
  }
  return { ok: true as const, items: listTempPasswords() };
});

export const revokeGuestPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const session = await readSession(getCookie(sessionCookieName));
    if (!session || session.role !== "admin") {
      return { ok: false as const };
    }
    return { ok: revokeTempPassword(data.id) };
  });

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isValidToken(getCookie(sessionCookieName)))) {
    return { authenticated: false as const, stats: null };
  }
  const { fetchLiveStatus } = await import("./falix.server");
  const { buildStats } = await import("./server-stats.server");
  try {
    const live = await fetchLiveStatus();
    return { authenticated: true as const, stats: buildStats(live, getActionLog()) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      authenticated: true as const,
      stats: buildDemoStats(getActionLog(), `Dati dimostrativi: ${message}.`),
    };
  }
});

export const getDashboardForAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        credentials: credSchema,
        accountLabel: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!(await isValidToken(getCookie(sessionCookieName)))) {
      return { authenticated: false as const, stats: null };
    }
    const { fetchLiveStatus } = await import("./falix.server");
    const { buildStats } = await import("./server-stats.server");
    const label = data.accountLabel?.trim() || "account";
    try {
      const live = await fetchLiveStatus(data.credentials ?? null);
      logAction("info", `Status live: ${label} (${live.source})`);
      return { authenticated: true as const, stats: buildStats(live, getActionLog()) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("warn", `Status ${label} fallito: ${message}`);
      return {
        authenticated: true as const,
        stats: buildDemoStats(
          getActionLog(),
          `Account "${label}": ${message}. Controlla API key / Server ID.`,
        ),
      };
    }
  });

/** Controllo path lato server (solo dentro handler / loader server) */
export const checkPathAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ pathname: z.string().max(200) }).parse(input))
  .handler(async ({ data }) => {
    const session = await readSession(getCookie(sessionCookieName));
    if (!session) return { ok: false as const, reason: "auth" as const };
    if (session.mustSetPassword && data.pathname !== "/setup-password") {
      return { ok: false as const, reason: "setup" as const };
    }
    if (!pathAllowed(data.pathname, session)) {
      return { ok: false as const, reason: "perm" as const };
    }
    return {
      ok: true as const,
      role: session.role,
      permissions: session.permissions,
    };
  });
