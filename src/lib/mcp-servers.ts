/**
 * Config MCP servers per JARVIS — schema Cursor/VS Code.
 *
 * {
 *   "servers": {
 *     "github": { "type": "http", "url": "https://api.githubcopilot.com/mcp/" },
 *     "composio": { "type": "http", "url": "https://connect.composio.dev/mcp" },
 *     "vercel": { "type": "http", "url": "https://mcp.vercel.com" },
 *     "netlify": { "type": "http", "url": "https://netlify-mcp.netlify.app/mcp" },
 *     "mio-server": { "type": "http", "url": "https://example.com/mcp" }
 *   }
 * }
 */

export type McpServerTransport = "http" | "stdio";

export type McpServerConfig = {
  type: McpServerTransport;
  /** Endpoint streamable-http (solo type=http) */
  url?: string;
  /** Header statici (Authorization, x-api-key, …) */
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Etichetta UI */
  label?: string;
};

export type McpServersFile = {
  servers: Record<string, McpServerConfig>;
};

/** Preset HTTP usabili da browser/Vercel (streamable-http). */
export const DEFAULT_MCP_SERVERS: McpServersFile = {
  servers: {
    github: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      label: "GitHub MCP",
    },
    composio: {
      type: "http",
      url: "https://connect.composio.dev/mcp",
      label: "Composio MCP",
    },
    vercel: {
      type: "http",
      url: "https://mcp.vercel.com",
      label: "Vercel MCP",
    },
    netlify: {
      type: "http",
      url: "https://netlify-mcp.netlify.app/mcp",
      label: "Netlify MCP",
    },
  },
};

export function getMcpServer(id: string): McpServerConfig | undefined {
  return DEFAULT_MCP_SERVERS.servers[id];
}

export function listHttpMcpServers(): { id: string; url: string; label?: string }[] {
  return Object.entries(DEFAULT_MCP_SERVERS.servers)
    .filter(([, c]) => c.type === "http" && c.url)
    .map(([id, c]) => ({ id, url: c.url!, label: c.label }));
}

/** Valida URL MCP http(s). VibeSec: https + host pubblico di default;
 * http solo per loopback locale (dev). Mai host interni in chiaro. */
export function isValidMcpHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    const loopback =
      host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
    if (u.protocol === "http:") return loopback;
    if (u.protocol !== "https:") return false;
    if (loopback) return true;
    if (u.username || u.password) return false;
    // Stesse regole della guardia SSRF (no import: modulo condiviso client).
    if (
      /^(0\.0\.0\.0|169\.254\.\d+\.\d+|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(
        host,
      )
    )
      return false;
    if (/\.(local|internal|lan|home|corp|intranet)$/.test(host)) return false;
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Config ad-hoc da URL (custom server). */
export function configFromUrl(
  url: string,
  opts?: { label?: string; headers?: Record<string, string> },
): McpServerConfig {
  return {
    type: "http",
    url: url.trim(),
    label: opts?.label,
    headers: opts?.headers,
  };
}
