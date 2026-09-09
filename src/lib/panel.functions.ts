import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  logAction,
  readSession,
  sessionCookieName,
  sessionHasPermission,
  type Permission,
  type SessionClaims,
} from "./auth.server";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS } from "./groq-models";

const credSchema = z
  .object({
    key: z.string().min(1).max(500),
    serverId: z.string().min(1).max(120),
    base: z.string().max(300).optional(),
  })
  .optional();

const storageCredSchema = z.object({
  provider: z.enum(["mega", "gdrive"]),
  apiKey: z.string().min(1).max(8000),
  serverId: z.string().max(500).optional(),
  baseUrl: z.string().max(500).optional(),
});

/**
 * Carica la sessione e verifica autenticazione + permessi.
 * - adminOnly: solo ruolo admin
 * - permissions: almeno uno dei permessi elencati (admin bypassa)
 */
async function requireSession(opts?: {
  adminOnly?: boolean;
  permissions?: Permission[];
}): Promise<SessionClaims> {
  const session = await readSession(getCookie(sessionCookieName));
  if (!session) {
    throw new Error("Sessione scaduta: effettua di nuovo il login.");
  }
  if (session.mustSetPassword) {
    throw new Error("Completa il setup della password prima di continuare.");
  }
  if (opts?.adminOnly && session.role !== "admin") {
    throw new Error("Solo l'amministratore può eseguire questa operazione.");
  }
  if (opts?.permissions?.length && !sessionHasPermission(session, opts.permissions)) {
    throw new Error("Permesso insufficiente per questa operazione.");
  }
  return session;
}

/** Stato env (senza rivelare secret). */
export const getSystemHealth = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession({ adminOnly: true });
  const { getSystemHealth: run } = await import("./system-health.server");
  return run();
});

export const getLogs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        credentials: credSchema,
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["console", "mine"] });
    const { fetchServerLogs } = await import("./falix.server");
    try {
      return { ok: true as const, ...(await fetchServerLogs(data.credentials ?? null)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Lettura log Falix fallita: ${message}`);
      return { ok: false as const, demo: false, lines: [], message };
    }
  });

export const runCommand = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        command: z.string().min(1).max(300),
        credentials: credSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["console"] });
    const { sendServerCommand } = await import("./falix.server");
    try {
      return { ok: true as const, ...(await sendServerCommand(data.command, data.credentials)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Comando "${data.command}" fallito: ${message}`);
      return { ok: false as const, demo: false, output: message };
    }
  });

export const powerAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        signal: z.enum(["start", "stop", "restart"]),
        credentials: credSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["power"] });
    const { sendPowerAction } = await import("./falix.server");
    try {
      return { ok: true as const, ...(await sendPowerAction(data.signal, data.credentials)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Azione "${data.signal}" fallita: ${message}`);
      return { ok: false as const, demo: false, output: message };
    }
  });

export const testAccountConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.string().min(1).max(8000),
        serverId: z.string().max(500).optional(),
        base: z.string().max(500).optional(),
        provider: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["hosts", "connectors"] });
    const provider = data.provider ?? "falix";

    if (provider === "mega" || provider === "gdrive") {
      const { storageStatus } = await import("./storage.server");
      const res = storageStatus({
        provider,
        apiKey: data.key,
        serverId: data.serverId,
        baseUrl: data.base,
      });
      logAction(res.ok ? "info" : "warn", `Test storage ${provider}: ${res.message}`);
      return { ok: res.ok, message: res.message };
    }

    if (provider !== "falix") {
      return {
        ok: true as const,
        message: `Provider "${provider}" registrato. Solo Falix + MEGA/Drive hanno test live.`,
      };
    }

    if (!data.serverId?.trim()) {
      return { ok: false as const, message: "Per Falix serve il Server ID." };
    }

    const { testFalixConnection } = await import("./falix.server");
    const res = await testFalixConnection({
      key: data.key,
      serverId: data.serverId,
      base: data.base,
    });
    logAction(res.ok ? "info" : "warn", `Test account: ${res.message}`);
    return res;
  });

const modelIds = GROQ_MODELS.map((m) => m.id) as [string, ...string[]];

export const analyzeNetwork = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        serverLabel: z.string().min(1).max(80),
        status: z.string().max(40),
        summary: z.string().min(1).max(8000),
        model: z.enum(modelIds as [typeof DEFAULT_GROQ_MODEL, ...string[]]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["network"] });
    const { analyzeNetworkWithGroq } = await import("./neural.server");
    const res = await analyzeNetworkWithGroq(data);
    logAction(res.ok ? "info" : "warn", `Analisi neurale: ${data.serverLabel}`);
    return res;
  });

export const researchHost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().min(1).max(200),
        model: z.enum(modelIds as [typeof DEFAULT_GROQ_MODEL, ...string[]]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["hosts"] });
    const { researchHostProvider } = await import("./host-research.server");
    try {
      const res = await researchHostProvider({
        query: data.query,
        model: data.model ?? DEFAULT_GROQ_MODEL,
      });
      if (!res.ok) {
        logAction("warn", `Host research: ${res.message}`);
        return { ok: false as const, message: res.message };
      }
      logAction("info", `Host research: ${data.query.slice(0, 60)} → ${res.report.label}`);
      return { ok: true as const, report: res.report };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Host research fallita: ${message}`);
      return { ok: false as const, message };
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
        model: z.enum(modelIds as [typeof DEFAULT_GROQ_MODEL, ...string[]]).optional(),
        credentials: credSchema,
        accountLabel: z.string().max(80).optional(),
        brainContext: z.string().max(12000).optional(),
        swarmMode: z.enum(["auto", "rapido", "swarm", "deep"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["assistant", "jarvis", "mine"] });
    const { fetchServerLogs } = await import("./falix.server");

    let logContext = "";
    let logDemo = true;
    const label = data.accountLabel?.trim() || "account attivo";
    try {
      const logs = await fetchServerLogs(data.credentials ?? null);
      logDemo = logs.demo;
      logContext = logs.lines.map((l) => l.message).join("\n");
      if (!logDemo) {
        logContext = `[Account Falix: ${label}]\n${logContext}`;
      }
    } catch (error) {
      logContext = `Log non disponibili (${label}): ${error instanceof Error ? error.message : String(error)}`;
    }

    try {
      const { askSwarm } = await import("./swarm.server");
      const { memoryContext, recordEvent } = await import("./memory.server");
      const memory = await memoryContext(25);

      const reply = await askSwarm({
        question: data.question,
        logContext,
        history: data.history,
        mode: data.swarmMode ?? "auto",
        brainContext: data.brainContext,
        memoryContext: memory,
      });

      const usati = reply.steps
        .filter((s) => s.ok)
        .map((s) => `${s.provider}:${s.model.split("/").pop()}`)
        .join(", ");
      logAction("info", `IA (${reply.mode}) su "${label}": ${data.question.slice(0, 70)}`);
      await recordEvent({
        kind: "chat",
        summary: `[${reply.mode}] ${data.question.slice(0, 200)}`,
        detail: { modelli: usati, azioni: reply.azioni.map((a) => a.id) },
      });

      return {
        ok: true as const,
        ...reply,
        steps: reply.steps.map((s) => ({
          fase: s.fase,
          provider: s.provider,
          model: s.model,
          ok: s.ok,
          ms: s.ms,
        })),
        logDemo,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Richiesta IA fallita: ${message}`);
      return {
        ok: false as const,
        risposta: message,
        comandi: [],
        azioni: [],
        mode: "rapido" as const,
        steps: [],
        logDemo,
      };
    }
  });

export const askCodeAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        prompt: z.string().min(1).max(8000),
        mode: z.enum(["code", "architect", "ask", "debug", "review"]),
        language: z.string().min(1).max(40),
        context: z.string().max(12000).optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(4000),
            }),
          )
          .max(16)
          .default([]),
        model: z.enum(modelIds as [typeof DEFAULT_GROQ_MODEL, ...string[]]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["code"] });
    const { askCodeAgent: run } = await import("./code.server");
    try {
      const reply = await run({
        prompt: data.prompt,
        mode: data.mode,
        language: data.language,
        context: data.context,
        history: data.history,
        model: data.model ?? DEFAULT_GROQ_MODEL,
      });
      logAction("info", `Code agent [${data.mode}]: ${data.prompt.slice(0, 60)}`);
      return { ok: true as const, ...reply };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Code agent fallito: ${message}`);
      return {
        ok: false as const,
        risposta: message,
        files: [] as { path: string; language: string; content: string }[],
        nextSteps: [] as string[],
      };
    }
  });

export const runOneHand = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        tool: z.enum([
          "list_one_integrations",
          "search_one_platform_actions",
          "get_one_action_knowledge",
          "execute_one_action",
        ]),
        params: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .default({}),
        approved: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["connectors", "jarvis"] });
    const { runOneHand: run } = await import("./one-hands.server");
    const res = await run(data.tool, data.params, data.approved);
    logAction(res.ok ? "info" : "warn", `One hand ${data.tool}: ${res.output.slice(0, 120)}`);
    return { ok: res.ok, output: res.output };
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
        credentials: credSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["power", "console", "mine"] });
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
      return {
        ok: true as const,
        ...(await executeFalixAction(data.id, data.params, data.credentials)),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logAction("error", `Azione "${data.id}" fallita: ${message}`);
      return { ok: false as const, demo: false, output: message };
    }
  });

export const runStorageAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        tool: z.enum([
          "mega_status",
          "mega_list",
          "mega_upload_note",
          "mega_share_link",
          "gdrive_status",
          "gdrive_list",
          "gdrive_upload_note",
          "gdrive_create_folder",
        ]),
        params: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .default({}),
        approved: z.boolean().default(false),
        storage: storageCredSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession({ permissions: ["connectors", "hosts"] });
    const { storageStatus, registerUploadNote } = await import("./storage.server");
    const writeTools = new Set([
      "mega_upload_note",
      "mega_share_link",
      "gdrive_upload_note",
      "gdrive_create_folder",
    ]);

    if (writeTools.has(data.tool) && !data.approved) {
      logAction("warn", `Storage "${data.tool}" bloccata: approvazione mancante`);
      return {
        ok: false as const,
        output: `Tool "${data.tool}" richiede approvazione esplicita.`,
      };
    }

    const creds = data.storage;

    if (data.tool === "mega_status" || data.tool === "gdrive_status") {
      const res = storageStatus(creds);
      logAction("info", `Storage status ${creds.provider}: ${res.message}`);
      return { ok: res.ok, output: res.message };
    }

    if (data.tool === "mega_list" || data.tool === "gdrive_list") {
      const res = storageStatus(creds);
      if (!res.configured) return { ok: false, output: res.message };
      const folder =
        String(data.params.folder ?? data.params.folderId ?? creds.serverId ?? "root");
      return {
        ok: true,
        output: `${creds.provider.toUpperCase()} list (simulato): cartella "${folder}". Collega SDK per elenco live. Stato: ${res.message}`,
      };
    }

    if (data.tool === "mega_upload_note" || data.tool === "gdrive_upload_note") {
      const res = registerUploadNote(creds, {
        filename: String(data.params.filename ?? ""),
        sourcePath: data.params.sourcePath != null ? String(data.params.sourcePath) : undefined,
        folderId: data.params.folderId != null ? String(data.params.folderId) : undefined,
      });
      logAction(res.ok ? "info" : "warn", `Upload note ${creds.provider}: ${res.jobId || "fail"}`);
      return { ok: res.ok, output: res.output };
    }

    if (data.tool === "mega_share_link") {
      const nodeId = String(data.params.nodeId ?? "");
      if (!nodeId) return { ok: false, output: "Serve nodeId MEGA." };
      return {
        ok: true,
        output: `Richiesta link pubblico MEGA per nodo ${nodeId} registrata (confermata). Generazione link nativa in arrivo.`,
      };
    }

    if (data.tool === "gdrive_create_folder") {
      const name = String(data.params.name ?? "").trim();
      if (!name) return { ok: false, output: "Serve name cartella." };
      return {
        ok: true,
        output: `Richiesta creazione cartella Drive "${name}"${data.params.parentId ? ` sotto ${data.params.parentId}` : ""} registrata.`,
      };
    }

    return { ok: false, output: `Tool storage sconosciuto: ${data.tool}` };
  });
