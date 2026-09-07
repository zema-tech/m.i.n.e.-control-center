import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestIP, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  checkRateLimit,
  clearFailures,
  createTempPassword,
  createToken,
  getActionLog,
  isValidToken,
  listTempPasswords,
  logAction,
  registerFailure,
  revokeTempPassword,
  sessionCookieName,
  verifyPassword,
} from "./auth.server";
import { buildDemoStats } from "./server-stats.server";

const credSchema = z
  .object({
    key: z.string().min(1).max(500),
    serverId: z.string().min(1).max(120),
    base: z.string().max(300).optional(),
  })
  .optional();

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
        message: `Troppi tentativi. Accesso bloccato per ${limit.retryInMin} minuti.`,
      };
    }

    let valid = false;
    try {
      valid = await verifyPassword(data.password);
    } catch {
      return {
        ok: false as const,
        message: "Password admin non ancora configurata sul server.",
      };
    }

    if (!valid) {
      const fail = registerFailure(ip);
      logAction("warn", `Tentativo di accesso fallito da ${ip}`);
      return {
        ok: false as const,
        message: fail.blocked
          ? "5 tentativi falliti. Accesso bloccato per 15 minuti."
          : `Password errata. Tentativi rimanenti: ${fail.remaining}`,
      };
    }

    clearFailures(ip);
    setCookie(sessionCookieName, await createToken(), {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    logAction("info", `Accesso riuscito da ${ip}`);
    return { ok: true as const, message: "Accesso consentito" };
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
  return { authenticated: await isValidToken(getCookie(sessionCookieName)) };
});

export const createGuestPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().max(80).default("Ospite"),
        durationHours: z.union([z.literal(1), z.literal(6), z.literal(24), z.literal(168)]),
        maxUses: z.number().int().min(1).max(100).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!(await isValidToken(getCookie(sessionCookieName)))) {
      return { ok: false as const, message: "Non autenticato" };
    }
    const created = await createTempPassword({
      label: data.label,
      durationMs: data.durationHours * 60 * 60 * 1000,
      maxUses: data.maxUses ?? null,
    });
    return {
      ok: true as const,
      id: created.id,
      password: created.password,
      label: created.label,
      expiresAt: created.expiresAt,
      maxUses: created.maxUses,
    };
  });

export const getGuestPasswords = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isValidToken(getCookie(sessionCookieName)))) {
    return { ok: false as const, items: [] as ReturnType<typeof listTempPasswords> };
  }
  return { ok: true as const, items: listTempPasswords() };
});

export const revokeGuestPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    if (!(await isValidToken(getCookie(sessionCookieName)))) {
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
