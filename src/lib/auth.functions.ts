import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestIP, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  checkRateLimit,
  clearFailures,
  createToken,
  getActionLog,
  isValidToken,
  logAction,
  registerFailure,
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
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    logAction("info", `Accesso admin riuscito da ${ip}`);
    return { ok: true as const, message: "Accesso consentito" };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(sessionCookieName, { path: "/", secure: true, sameSite: "none" });
  logAction("info", "Sessione admin terminata");
  return { ok: true as const };
});

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  return { authenticated: await isValidToken(getCookie(sessionCookieName)) };
});

/** Dashboard senza credenziali account (fallback env / demo). Usato dal loader. */
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

/** Dashboard legata all'account Falix selezionato (Gino / Edo / …). */
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
