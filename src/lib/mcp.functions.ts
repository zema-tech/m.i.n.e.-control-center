/**
 * Server functions MCP HTTP — proxy verso remote (GitHub, Composio, Vercel, Netlify, custom).
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import { logAction, readSession, sessionCookieName } from "./auth.server";
import { assertPublicHttpsUrl } from "./ssrf-guard";

/**
 * VibeSec least-privilege, chiamata DIRETTA dagli handler (unico lettore del
 * cookie in questo modulo). Con token client basta una sessione valida (mai
 * secret env); senza token su server preset il fallback userebbe le chiavi
 * env → solo admin.
 */
async function assertMcpCaller(opts?: {
  adminOnly?: boolean;
  serverId?: string;
  bearerToken?: string;
}) {
  const session = await readSession(getCookie(sessionCookieName));
  if (!session) {
    throw new Error("Sessione scaduta: effettua di nuovo il login.");
  }
  if (session.mustSetPassword) {
    throw new Error("Completa il setup della password prima di continuare.");
  }
  if (session.role !== "admin") {
    if (opts?.adminOnly) {
      throw new Error("Solo l'amministratore può eseguire questa operazione.");
    }
    if (
      opts?.serverId &&
      ["github", "composio", "vercel", "netlify"].includes(opts.serverId) &&
      !(opts.bearerToken || "").trim()
    ) {
      throw new Error("Solo l'amministratore può usare le chiavi server. Aggiungi il tuo token.");
    }
  }
  return session;
}

// Tool di sola lettura: SOLO prefissi verbo noti. Tutto il resto richiede
// approved:true (fail-closed: "l'IA propone, tu confermi").
const READ_TOOL_PREFIXES = ["get_", "list_", "fetch_", "search_", "read_", "show_", "describe_"];

function isReadOnlyToolName(name: string): boolean {
  const lower = name.toLowerCase();
  return READ_TOOL_PREFIXES.some((p) => lower.startsWith(p));
}

const customUrlSchema = z
  .string()
  .url()
  .max(500)
  .refine(
    (u) => {
      try {
        assertPublicHttpsUrl(u, "customUrl");
        return true;
      } catch {
        return false;
      }
    },
    { message: "customUrl non consentito (solo https pubblico)." },
  )
  .optional();

const argsSchema = z
  .record(z.string().max(64), z.unknown())
  .default({})
  .refine((o) => JSON.stringify(o).length < 8000, {
    message: "arguments troppo grande (max 8KB).",
  });

export const mcpListServers = createServerFn({ method: "GET" }).handler(async () => {
  await assertMcpCaller();
  const { listHttpMcpServers, DEFAULT_MCP_SERVERS } = await import("./mcp-servers");
  const { mcpAuthConfigured } = await import("./mcp-http.server");
  const http = listHttpMcpServers();
  return {
    servers: DEFAULT_MCP_SERVERS.servers,
    http,
    authHints: Object.fromEntries(http.map((s) => [s.id, mcpAuthConfigured(s.id)])) as Record<
      string,
      boolean
    >,
  };
});

export const mcpListTools = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        serverId: z.string().min(1).max(80).default("github"),
        bearerToken: z.string().max(800).optional(),
        customUrl: customUrlSchema,
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await assertMcpCaller({ serverId: data.serverId, bearerToken: data.bearerToken });
    try {
      const { createMcpClient, mcpAuthConfigured } = await import("./mcp-http.server");
      const needsAuth = ["github", "composio", "vercel", "netlify"].includes(data.serverId);
      if (needsAuth && !mcpAuthConfigured(data.serverId, data.bearerToken)) {
        return {
          ok: false as const,
          tools: [] as { name: string; description: string }[],
          message: `Auth mancante per ${data.serverId}: token client o env server (GITHUB_*, COMPOSIO_API_KEY, VERCEL_TOKEN, NETLIFY_AUTH_TOKEN).`,
        };
      }
      const client = createMcpClient(data.serverId, {
        bearerToken: data.bearerToken,
        customUrl: data.customUrl,
      });
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
        serverId: z.string().min(1).max(80).default("github"),
        name: z.string().min(1).max(120),
        arguments: argsSchema,
        bearerToken: z.string().max(800).optional(),
        customUrl: customUrlSchema,
        approved: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await assertMcpCaller({ serverId: data.serverId, bearerToken: data.bearerToken });
    if (!isReadOnlyToolName(data.name) && !data.approved) {
      return {
        ok: false as const,
        text: `Tool MCP "${data.name}" non in sola lettura: conferma approvazione (approved: true).`,
      };
    }
    try {
      const { createMcpClient, mcpAuthConfigured } = await import("./mcp-http.server");
      const needsAuth = ["github", "composio", "vercel", "netlify"].includes(data.serverId);
      if (needsAuth && !mcpAuthConfigured(data.serverId, data.bearerToken)) {
        return {
          ok: false as const,
          text: `Auth mancante per ${data.serverId}.`,
        };
      }
      const client = createMcpClient(data.serverId, {
        bearerToken: data.bearerToken,
        customUrl: data.customUrl,
      });
      const res = await client.callTool(data.name, data.arguments);
      // Nei log solo metadati: il testo è output arbitrario del server remoto
      // e può contenere segreti/token.
      logAction(
        res.ok ? "info" : "warn",
        `MCP ${data.serverId} tools/call ${data.name}: ${res.ok ? "ok" : "errore"} (${res.text.length} char)`,
      );
      return { ok: res.ok, text: res.text.slice(0, 12000) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logAction("error", `MCP call ${data.name}: ${message}`);
      return { ok: false as const, text: message };
    }
  });
