import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import { isValidToken, sessionCookieName } from "./auth.server";

async function requireAdmin() {
  if (!(await isValidToken(getCookie(sessionCookieName)))) {
    throw new Error("Sessione scaduta: effettua di nuovo il login.");
  }
}

/** Provider IA configurati + stato Composio (nessuna chiave esposta). */
export const getBrainStatus = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { availableProviders } = await import("./llm.server");
  const { composioConfigured } = await import("./composio.server");
  return {
    providers: availableProviders(),
    composio: composioConfigured(),
  };
});

export const getMemories = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { listMemories } = await import("./memory.server");
  try {
    return { ok: true as const, rows: await listMemories(120) };
  } catch (error) {
    return { ok: false as const, rows: [], message: error instanceof Error ? error.message : String(error) };
  }
});

export const saveMemory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.string().max(40).default("nota"),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(8000),
        tags: z.array(z.string().max(40)).max(10).default([]),
        importance: z.number().int().min(1).max(5).default(3),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { addMemory, recordEvent } = await import("./memory.server");
    const row = await addMemory({ ...data, source: "manuale" });
    await recordEvent({ kind: "memoria", summary: `Ricordo salvato: ${data.title}` });
    return { ok: true as const, row };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { removeMemory } = await import("./memory.server");
    await removeMemory(data.id);
    return { ok: true as const };
  });

export const getAgentEvents = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { listEvents } = await import("./memory.server");
  try {
    return { ok: true as const, rows: await listEvents(100) };
  } catch (error) {
    return { ok: false as const, rows: [], message: error instanceof Error ? error.message : String(error) };
  }
});

export const getComposioTools = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ toolkit: z.string().max(60).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { listToolkits, listTools, composioConfigured } = await import("./composio.server");
    if (!composioConfigured()) {
      return { ok: false as const, toolkits: [], tools: [], message: "COMPOSIO_API_KEY non configurata." };
    }
    try {
      const [toolkits, tools] = await Promise.all([
        listToolkits(),
        listTools(data.toolkit),
      ]);
      return { ok: true as const, toolkits, tools };
    } catch (error) {
      return {
        ok: false as const,
        toolkits: [],
        tools: [],
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

export const runComposioTool = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        args: z
          .record(z.string().max(64), z.unknown())
          .default({})
          .refine((o) => JSON.stringify(o).length < 8000, {
            message: "args troppo grande (max 8KB).",
          }),
        approved: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { executeTool } = await import("./composio.server");
    const { recordEvent } = await import("./memory.server");
    try {
      const res = await executeTool(data);
      await recordEvent({
        kind: "composio",
        summary: `${data.slug}: ${res.ok ? "eseguito" : "bloccato"}`,
        detail: { slug: data.slug, args: data.args },
        ok: res.ok,
      });
      return res;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordEvent({ kind: "composio", summary: `${data.slug} errore: ${message}`, ok: false });
      return { ok: false, output: message };
    }
  });
