import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestIP, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ALL_PERMISSIONS,
  checkRateLimit,
  clearFailures,
  createTempPassword,
  createToken,
  getActionLog,
  isValidToken,
  listTempPasswords,
  logAction,
  matchPassword,
  pathAllowed,
  readSession,
  registerFailure,
  registerMemberFromGuest,
  revokeTempPassword,
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

function cookieOpts(maxAge = 60 * 60 * 24) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    partitioned: true,
    path: "/",
    maxAge,
  };
}

async function requireSession(): Promise<SessionClaims | null> {
  return readSession(getCookie(sessionCookieName));
}

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    const limit = checkRateLimit(ip);
    if (limit.blocked) {
      return {
        ok: false as const,
        message: `Accesso in pausa. Riprova tra ${limit.retryInMin} min.`,
        blocked: true as const,
        retryInSec: limit.retryInSec,
        remaining: 0,
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
        retryInSec: 0,
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
          message: "Troppi tentativi. Accesso in pausa per 15 minuti.",
          blocked: true as const,
          retryInSec: fail.retryInSec,
          remaining: 0,
          mustSetPassword: false as const,
        };
      }
      return {
        ok: false as const,
        message:
          fail.remaining === 1
            ? "Password non corretta. Ultimo tentativo disponibile."
            : `Password non corretta. Tentativi rimasti: ${fail.remaining}`,
        blocked: false as const,
        retryInSec: 0,
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
      retryInSec: 0,
      remaining: null as number | null,
      mustSetPassword: claims.mustSetPassword,
      role: claims.role,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(sessionCookieName, {
    path: "/",
    secure: true,
    sameSite: "none",
    partitioned: true,
  });
  logAction("info", "Sessione terminata");
  return { ok: true as const };
});

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
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
        password: z.string().min(8).max(200),
        confirm: z.string().min(8).max(200),
        displayName: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session) {
      return { ok: false as const, message: "Sessione non valida" };
    }
    if (!session.mustSetPassword) {
      return { ok: false as const, message: "Password già impostata" };
    }
    if (data.password !== data.confirm) {
      return { ok: false as const, message: "Le password non coincidono" };
    }
    if (data.password.length < 8) {
      return { ok: false as const, message: "Minimo 8 caratteri" };
    }

    const label = (data.displayName?.trim() || session.label || "Membro").slice(0, 80);
    const registered = await registerMemberFromGuest({
      label,
      password: data.password,
      permissions: session.permissions,
      fromTempId: session.tempId,
    });

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
    const session = await requireSession();
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
  const session = await requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false as const, items: [] as ReturnType<typeof listTempPasswords> };
  }
  return { ok: true as const, items: listTempPasswords() };
});

export const revokeGuestPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireSession();
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

/** Helper per route loader: redirect se path non permesso */
export async function assertPathAccess(pathname: string) {
  const session = await requireSession();
  if (!session) return { ok: false as const, reason: "auth" as const };
  if (session.mustSetPassword && pathname !== "/setup-password") {
    return { ok: false as const, reason: "setup" as const };
  }
  if (!pathAllowed(pathname, session)) {
    return { ok: false as const, reason: "perm" as const };
  }
  return { ok: true as const, session };
}
