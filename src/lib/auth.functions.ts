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
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    logAction("info", `Accesso admin riuscito da ${ip}`);
    return { ok: true as const, message: "Accesso consentito" };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(sessionCookieName, { path: "/" });
  logAction("info", "Sessione admin terminata");
  return { ok: true as const };
});

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  return { authenticated: await isValidToken(getCookie(sessionCookieName)) };
});

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isValidToken(getCookie(sessionCookieName)))) {
    return { authenticated: false as const, stats: null };
  }
  return { authenticated: true as const, stats: buildDemoStats(getActionLog()) };
});
