import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import { isValidToken, logAction, sessionCookieName } from "./auth.server";

async function requireAdmin() {
  if (!(await isValidToken(getCookie(sessionCookieName)))) {
    throw new Error("Sessione scaduta: effettua di nuovo il login.");
  }
}

export const getLogs = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { fetchServerLogs } = await import("./falix.server");
  try {
    return { ok: true as const, ...(await fetchServerLogs()) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAction("error", `Lettura log Falix fallita: ${message}`);
    return { ok: false as const, demo: false, lines: [], message };
  }
});

export const runCommand = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ command: z.string().min(1).max(300) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { sendServerCommand } = await import("./falix.server");
    try {
      return { ok: true as const, ...(await sendServerCommand(data.command)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Comando "${data.command}" fallito: ${message}`);
      return { ok: false as const, demo: false, output: message };
    }
  });

export const powerAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ signal: z.enum(["start", "stop", "restart"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { sendPowerAction } = await import("./falix.server");
    try {
      return { ok: true as const, ...(await sendPowerAction(data.signal)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Azione "${data.signal}" fallita: ${message}`);
      return { ok: false as const, demo: false, output: message };
    }
  });

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(2000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(4000),
            }),
          )
          .max(20)
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { fetchServerLogs } = await import("./falix.server");
    const { askGroq } = await import("./ai.server");

    let logContext = "";
    let logDemo = true;
    try {
      const logs = await fetchServerLogs();
      logDemo = logs.demo;
      logContext = logs.lines.map((l) => l.message).join("\n");
    } catch (error) {
      logContext = `Log non disponibili: ${error instanceof Error ? error.message : String(error)}`;
    }

    try {
      const reply = await askGroq(data.question, logContext, data.history);
      logAction("info", `IA consultata: ${data.question.slice(0, 80)}`);
      return { ok: true as const, ...reply, logDemo };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Richiesta IA fallita: ${message}`);
      return { ok: false as const, risposta: message, comandi: [], azioni: [], logDemo };
    }
  });

export const runFalixAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).max(80),
        params: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .default({}),
        approved: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getAction } = await import("./falix-actions");
    const def = getAction(data.id);
    if (!def) return { ok: false as const, demo: false, output: `Azione sconosciuta: ${data.id}` };
    if (def.risk !== "read" && !data.approved) {
      logAction("warn", `Azione "${data.id}" bloccata: approvazione mancante`);
      return {
        ok: false as const,
        demo: false,
        output: `Azione "${data.id}" richiede approvazione esplicita dell'amministratore.`,
      };
    }
    const { executeFalixAction } = await import("./falix.server");
    try {
      return { ok: true as const, ...(await executeFalixAction(data.id, data.params)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Azione "${data.id}" fallita: ${message}`);
      return { ok: false as const, demo: false, output: message };
    }
  });
