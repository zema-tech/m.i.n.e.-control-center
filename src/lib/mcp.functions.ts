/**
 * Server functions MCP HTTP — proxy sicuro verso remote (GitHub MCP).
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import { isValidToken, logAction, sessionCookieName } from "./auth.server";

async function requireAdmin() {
  if (!(await isValidToken(getCookie(sessionCookieName)))) {
    throw new Error("Sessione scaduta: effettua di nuovo il login.");
  }
}

export const mcpListServers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { listHttpMcpServers, DEFAULT_MCP_SERVERS } = await import("./mcp-servers");
  const { githubMcpTokenConfigured } = await import("./mcp-http.server");
  return {
    servers: DEFAULT_MCP_SERVERS.servers,
    http: listHttpMcpServers(),
    githubTokenOnServer: githubMcpTokenConfigured(),
  };
});

export const mcpListTools = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        serverId: z.string().min(1).max(64).default("github"),
        /** PAT opzionale dal client (localStorage); altrimenti env server */
        bearerToken: z.string().max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    try {
      const { createMcpClient, githubMcpTokenConfigured } = await import("./mcp-http.server");
      if (data.serverId === "github" && !githubMcpTokenConfigured(data.bearerToken)) {
        return {
          ok: false as const,
          tools: [] as { name: string; description: string }[],
          message:
            "Serve un GitHub PAT: imposta GITHUB_PERSONAL_ACCESS_TOKEN su Vercel oppure salva il token in JARVIS (localStorage).",
        };
      }
      const client = createMcpClient(data.serverId, { bearerToken: data.bearerToken });
      const tools = await client.listTools();
      logAction("info", `MCP ${data.serverId} tools/list: ${tools.length}`);
      return {
        ok: true as const,
        tools: tools.map((t) => ({
          name: t.name,
          description: (t.description ?? "").slice(0, 300),
        })),
        message: `${tools.length} tool da ${data.serverId}`,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logAction("error", `MCP tools/list fallita: ${message}`);
      return { ok: false as const, tools: [], message };
    }
  });

export const mcpCallTool = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        serverId: z.string().min(1).max(64).default("github"),
        name: z.string().min(1).max(120),
        arguments: z.record(z.string(), z.unknown()).default({}),
        bearerToken: z.string().max(500).optional(),
        /** Scritture (create issue, PR…) richiedono approved */
        approved: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const writeHints = ["create", "update", "delete", "merge", "push", "comment", "close", "open"];
    const lower = data.name.toLowerCase();
    const maybeWrite = writeHints.some((w) => lower.includes(w));
    if (maybeWrite && !data.approved) {
      return {
        ok: false as const,
        text: `Tool MCP "${data.name}" potrebbe modificare dati: conferma approvazione (approved: true).`,
      };
    }
    try {
      const { createMcpClient, githubMcpTokenConfigured } = await import("./mcp-http.server");
      if (data.serverId === "github" && !githubMcpTokenConfigured(data.bearerToken)) {
        return {
          ok: false as const,
          text: "GitHub PAT mancante (env o bearerToken).",
        };
      }
      const client = createMcpClient(data.serverId, { bearerToken: data.bearerToken });
      const res = await client.callTool(data.name, data.arguments);
      logAction(
        res.ok ? "info" : "warn",
        `MCP ${data.serverId} tools/call ${data.name}: ${res.text.slice(0, 80)}`,
      );
      return { ok: res.ok, text: res.text.slice(0, 12000) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logAction("error", `MCP call ${data.name}: ${message}`);
      return { ok: false as const, text: message };
    }
  });
