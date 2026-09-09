/**
 * Config MCP servers per JARVIS — stesso schema mentale di Cursor/VS Code.
 *
 * Esempio:
 * {
 *   "servers": {
 *     "github": {
 *       "type": "http",
 *       "url": "https://api.githubcopilot.com/mcp/"
 *     }
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
  /** Comando locale (solo type=stdio — non usato in web) */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpServersFile = {
  servers: Record<string, McpServerConfig>;
};

/** Preset ufficiali usati da JARVIS (v1: solo GitHub HTTP). */
export const DEFAULT_MCP_SERVERS: McpServersFile = {
  servers: {
    github: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
    },
  },
};

export function getMcpServer(id: string): McpServerConfig | undefined {
  return DEFAULT_MCP_SERVERS.servers[id];
}

export function listHttpMcpServers(): { id: string; url: string }[] {
  return Object.entries(DEFAULT_MCP_SERVERS.servers)
    .filter(([, c]) => c.type === "http" && c.url)
    .map(([id, c]) => ({ id, url: c.url! }));
}
