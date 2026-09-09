/**
 * Client MCP Streamable HTTP (JSON-RPC) — solo server-side.
 * Spec: POST + Accept application/json, text/event-stream
 *
 * Usato da JARVIS per il primo server remoto: GitHub MCP.
 */

import { getMcpServer, type McpServerConfig } from "./mcp-servers";

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
    this.url = cfg.url.replace(/\/?$/, "/");
    // GitHub endpoint is often without trailing path issues — keep as provided
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
    // notification (no id) — best effort
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

/** Crea client per un server noto (preset) + token opzionale. */
export function createMcpClient(
  serverId: string,
  opts?: { bearerToken?: string; extraHeaders?: Record<string, string> },
): McpHttpClient {
  const cfg = getMcpServer(serverId);
  if (!cfg) throw new Error(`MCP server sconosciuto: ${serverId}`);
  const auth: Record<string, string> = { ...(opts?.extraHeaders ?? {}) };
  const token =
    opts?.bearerToken?.trim() ||
    process.env["GITHUB_PERSONAL_ACCESS_TOKEN"]?.trim() ||
    process.env["GITHUB_MCP_TOKEN"]?.trim() ||
    "";
  if (token && serverId === "github") {
    auth["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  return new McpHttpClient(cfg, auth);
}

export function githubMcpTokenConfigured(clientToken?: string): boolean {
  return Boolean(
    clientToken?.trim() ||
      process.env["GITHUB_PERSONAL_ACCESS_TOKEN"]?.trim() ||
      process.env["GITHUB_MCP_TOKEN"]?.trim(),
  );
}
