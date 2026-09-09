/**
 * Client MCP Streamable HTTP (JSON-RPC) — solo server-side.
 */

import {
  configFromUrl,
  getMcpServer,
  isValidMcpHttpUrl,
  type McpServerConfig,
} from "./mcp-servers";

export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type McpCallResult = {
  ok: boolean;
  text: string;
  isError?: boolean;
  raw?: unknown;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const PROTOCOL = "2025-06-18";

function parseSseOrJson(body: string, contentType: string | null): JsonRpcSuccess | null {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("text/event-stream") || body.includes("data:")) {
    const lines = body.split("\n");
    let last: JsonRpcSuccess | null = null;
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as JsonRpcSuccess;
        if (j && (j.result !== undefined || j.error)) last = j;
      } catch {
        /* ignore partial */
      }
    }
    return last;
  }
  try {
    return JSON.parse(body) as JsonRpcSuccess;
  } catch {
    return null;
  }
}

function extractTextContent(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  const r = result as {
    content?: { type?: string; text?: string }[];
    isError?: boolean;
  };
  if (Array.isArray(r.content)) {
    return r.content
      .map((c) => (c.type === "text" ? c.text ?? "" : JSON.stringify(c)))
      .filter(Boolean)
      .join("\n");
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export class McpHttpClient {
  private url: string;
  private headers: Record<string, string>;
  private sessionId: string | null = null;
  private nextId = 1;
  private initialized = false;

  constructor(cfg: McpServerConfig, authHeaders?: Record<string, string>) {
    if (cfg.type !== "http" || !cfg.url) {
      throw new Error("McpHttpClient richiede type=http e url");
    }
    this.url = cfg.url;
    this.headers = {
      ...(cfg.headers ?? {}),
      ...(authHeaders ?? {}),
    };
  }

  private async post(method: string, params?: Record<string, unknown>): Promise<JsonRpcSuccess> {
    const id = this.nextId++;
    const body = {
      jsonrpc: "2.0" as const,
      id,
      method,
      params: params ?? {},
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL,
      ...this.headers,
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const sid = res.headers.get("mcp-session-id") || res.headers.get("Mcp-Session-Id");
    if (sid) this.sessionId = sid;

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 400)}`);
    }

    const parsed = parseSseOrJson(text, res.headers.get("content-type"));
    if (!parsed) {
      throw new Error(`Risposta MCP non JSON: ${text.slice(0, 300)}`);
    }
    if (parsed.error) {
      throw new Error(`MCP ${parsed.error.code}: ${parsed.error.message}`);
    }
    return parsed;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.post("initialize", {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: "mine-jarvis", version: "1.0.0" },
    });
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL,
        ...this.headers,
      };
      if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
      await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      });
    } catch {
      /* optional */
    }
    this.initialized = true;
  }

  async listTools(): Promise<McpToolDef[]> {
    await this.initialize();
    const res = await this.post("tools/list", {});
    const result = res.result as { tools?: McpToolDef[] } | undefined;
    return result?.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpCallResult> {
    await this.initialize();
    const res = await this.post("tools/call", { name, arguments: args });
    const result = res.result as { isError?: boolean; content?: unknown } | undefined;
    const text = extractTextContent(result);
    const isError = Boolean(result?.isError);
    return {
      ok: !isError,
      text: text || (isError ? "Tool error (no content)" : "(empty)"),
      isError,
      raw: result,
    };
  }
}

function resolveAuth(
  serverId: string,
  opts?: { bearerToken?: string; extraHeaders?: Record<string, string> },
): Record<string, string> {
  const auth: Record<string, string> = { ...(opts?.extraHeaders ?? {}) };
  const token = opts?.bearerToken?.trim() || "";

  if (token) {
    if (token.includes(":") && !token.startsWith("Bearer")) {
      const i = token.indexOf(":");
      auth[token.slice(0, i).trim()] = token.slice(i + 1).trim();
    } else {
      auth["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
    return auth;
  }

  if (serverId === "github") {
    const envTok =
      process.env["GITHUB_PERSONAL_ACCESS_TOKEN"]?.trim() ||
      process.env["GITHUB_MCP_TOKEN"]?.trim() ||
      "";
    if (envTok) auth["Authorization"] = envTok.startsWith("Bearer ") ? envTok : `Bearer ${envTok}`;
  }
  if (serverId === "composio") {
    const k = process.env["COMPOSIO_API_KEY"]?.trim();
    if (k) auth["x-api-key"] = k;
  }
  if (serverId === "vercel") {
    const k = process.env["VERCEL_TOKEN"]?.trim() || process.env["VERCEL_ACCESS_TOKEN"]?.trim();
    if (k) auth["Authorization"] = k.startsWith("Bearer ") ? k : `Bearer ${k}`;
  }
  if (serverId === "netlify") {
    const k = process.env["NETLIFY_AUTH_TOKEN"]?.trim();
    if (k) auth["Authorization"] = k.startsWith("Bearer ") ? k : `Bearer ${k}`;
  }
  return auth;
}

/** Crea client da preset id, oppure da url custom. */
export function createMcpClient(
  serverId: string,
  opts?: {
    bearerToken?: string;
    extraHeaders?: Record<string, string>;
    /** Override / custom URL (MCP creato dall'utente) */
    customUrl?: string;
  },
): McpHttpClient {
  let cfg = getMcpServer(serverId);
  if (!cfg && opts?.customUrl && isValidMcpHttpUrl(opts.customUrl)) {
    cfg = configFromUrl(opts.customUrl);
  }
  if (!cfg) throw new Error(`MCP server sconosciuto: ${serverId}`);
  if (opts?.customUrl && isValidMcpHttpUrl(opts.customUrl)) {
    cfg = { ...cfg, url: opts.customUrl.trim() };
  }
  return new McpHttpClient(cfg, resolveAuth(serverId, opts));
}

export function githubMcpTokenConfigured(clientToken?: string): boolean {
  return Boolean(
    clientToken?.trim() ||
      process.env["GITHUB_PERSONAL_ACCESS_TOKEN"]?.trim() ||
      process.env["GITHUB_MCP_TOKEN"]?.trim(),
  );
}

export function mcpAuthConfigured(
  serverId: string,
  clientToken?: string,
): boolean {
  if (clientToken?.trim()) return true;
  if (serverId === "github") return githubMcpTokenConfigured();
  if (serverId === "composio") return Boolean(process.env["COMPOSIO_API_KEY"]?.trim());
  if (serverId === "vercel")
    return Boolean(
      process.env["VERCEL_TOKEN"]?.trim() || process.env["VERCEL_ACCESS_TOKEN"]?.trim(),
    );
  if (serverId === "netlify") return Boolean(process.env["NETLIFY_AUTH_TOKEN"]?.trim());
  // custom: token opzionale
  if (serverId.startsWith("custom:")) return true;
  return true;
}
