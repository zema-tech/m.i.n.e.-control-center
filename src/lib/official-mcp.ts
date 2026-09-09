/**
 * MCP operativi
 * - Composio, GitHub, Vercel, Netlify (streamable-http)
 * - Reference servers: github.com/modelcontextprotocol/servers
 *
 * Registry: https://registry.modelcontextprotocol.io
 */

export type OfficialMcpTransport = "stdio" | "streamable-http" | "sse";

export type OfficialMcpServer = {
  id: string;
  label: string;
  description: string;
  transport: OfficialMcpTransport;
  remoteUrl?: string;
  packageHint?: string;
  installHint: string;
  docsUrl: string;
  toolHints: string[];
  browserReady: boolean;
};

export const COMPOSIO_MCP_URL = "https://connect.composio.dev/mcp";
export const COMPOSIO_DOCS_URL = "https://docs.composio.dev/docs/mcp";
export const COMPOSIO_SESSIONS_DOCS =
  "https://docs.composio.dev/docs/sessions-via-mcp";

export const VERCEL_MCP_URL = "https://mcp.vercel.com";
export const NETLIFY_MCP_URL = "https://netlify-mcp.netlify.app/mcp";

export const COMPOSIO_MCP: OfficialMcpServer = {
  id: "composio-mcp",
  label: "Composio MCP",
  description:
    "Gateway primario: 500–1000+ app (Gmail, Slack, GitHub, Notion, Discord…). OAuth gestito, meta-tools search/connect/execute.",
  transport: "streamable-http",
  remoteUrl: COMPOSIO_MCP_URL,
  installHint: `REMOTE: ${COMPOSIO_MCP_URL} (COMPOSIO_API_KEY / x-api-key). Docs: ${COMPOSIO_SESSIONS_DOCS}`,
  docsUrl: COMPOSIO_DOCS_URL,
  toolHints: [
    "COMPOSIO_SEARCH_TOOLS",
    "COMPOSIO_MANAGE_CONNECTIONS",
    "COMPOSIO_MULTI_EXECUTE_TOOL",
    "COMPOSIO_GET_TOOL_SCHEMAS",
    "COMPOSIO_WAIT_FOR_CONNECTIONS",
  ],
  browserReady: true,
};

export const GITHUB_MCP: OfficialMcpServer = {
  id: "github-mcp",
  label: "GitHub MCP",
  description:
    "Server ufficiale GitHub: issues, PR, repos, code search, actions. Remote streamable-http o Docker locale.",
  transport: "streamable-http",
  remoteUrl: "https://api.githubcopilot.com/mcp/",
  packageHint: "ghcr.io/github/github-mcp-server",
  installHint:
    "Remote: https://api.githubcopilot.com/mcp/ + Authorization Bearer <GITHUB_PAT>.",
  docsUrl: "https://github.com/github/github-mcp-server",
  toolHints: [
    "get_me",
    "list_issues",
    "create_issue",
    "get_pull_request",
    "create_pull_request",
    "search_code",
    "get_file_contents",
    "list_commits",
  ],
  browserReady: true,
};

export const VERCEL_MCP: OfficialMcpServer = {
  id: "vercel-mcp",
  label: "Vercel MCP",
  description:
    "MCP ufficiale Vercel: progetti, deploy, log, docs. OAuth o VERCEL_TOKEN.",
  transport: "streamable-http",
  remoteUrl: VERCEL_MCP_URL,
  installHint: `REMOTE: ${VERCEL_MCP_URL} — OAuth client oppure Bearer VERCEL_TOKEN. Docs: https://vercel.com/docs/agent-resources/vercel-mcp`,
  docsUrl: "https://vercel.com/docs/agent-resources/vercel-mcp",
  toolHints: [
    "search_docs",
    "list_projects",
    "list_deployments",
    "get_deployment",
    "get_deployment_build_logs",
  ],
  browserReady: true,
};

export const NETLIFY_MCP: OfficialMcpServer = {
  id: "netlify-mcp",
  label: "Netlify MCP",
  description:
    "MCP ufficiale Netlify: siti, deploy, build. Remote HTTP o CLI @netlify/mcp.",
  transport: "streamable-http",
  remoteUrl: NETLIFY_MCP_URL,
  packageHint: "@netlify/mcp",
  installHint: `REMOTE: ${NETLIFY_MCP_URL} (OAuth / NETLIFY_AUTH_TOKEN). Locale: npx -y @netlify/mcp`,
  docsUrl: "https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/",
  toolHints: ["create_site", "deploy_site", "list_sites", "get_deploy", "netlify_cli"],
  browserReady: true,
};

export const REFERENCE_MCP_SERVERS: OfficialMcpServer[] = [
  {
    id: "mcp-filesystem",
    label: "Filesystem MCP",
    description:
      "Operazioni file sicure (read/write/list/search) con directory allowlist. Reference ufficiale.",
    transport: "stdio",
    packageHint: "@modelcontextprotocol/server-filesystem",
    installHint:
      "npx -y @modelcontextprotocol/server-filesystem /percorso/consentito — oppure Docker mcp/filesystem",
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    toolHints: [
      "read_file",
      "write_file",
      "list_directory",
      "create_directory",
      "search_files",
      "get_file_info",
    ],
    browserReady: false,
  },
  {
    id: "mcp-fetch",
    label: "Fetch MCP",
    description:
      "Fetch URL e conversione HTML → markdown per LLM. Reference ufficiale (Python).",
    transport: "stdio",
    packageHint: "mcp-server-fetch",
    installHint: "uvx mcp-server-fetch  oppure  pip install mcp-server-fetch && python -m mcp_server_fetch",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    toolHints: ["fetch"],
    browserReady: false,
  },
  {
    id: "mcp-git",
    label: "Git MCP",
    description: "Status, diff, log, commit su repository Git locali. Reference ufficiale.",
    transport: "stdio",
    packageHint: "mcp-server-git",
    installHint: "uvx mcp-server-git --repository /path/to/repo",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
    toolHints: [
      "git_status",
      "git_diff_unstaged",
      "git_diff_staged",
      "git_commit",
      "git_log",
      "git_show",
    ],
    browserReady: false,
  },
  {
    id: "mcp-memory",
    label: "Memory MCP",
    description:
      "Knowledge graph persistente cross-session (entità, relazioni). Reference ufficiale.",
    transport: "stdio",
    packageHint: "@modelcontextprotocol/server-memory",
    installHint: "npx -y @modelcontextprotocol/server-memory",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    toolHints: [
      "create_entities",
      "create_relations",
      "add_observations",
      "search_nodes",
      "open_nodes",
      "read_graph",
    ],
    browserReady: false,
  },
  {
    id: "mcp-sequential-thinking",
    label: "Sequential Thinking MCP",
    description:
      "Ragionamento multi-step riflessivo (thought sequences). Reference ufficiale.",
    transport: "stdio",
    packageHint: "@modelcontextprotocol/server-sequential-thinking",
    installHint: "npx -y @modelcontextprotocol/server-sequential-thinking",
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    toolHints: ["sequentialthinking"],
    browserReady: false,
  },
  {
    id: "mcp-time",
    label: "Time MCP",
    description: "Ora corrente e conversioni timezone. Reference ufficiale.",
    transport: "stdio",
    packageHint: "mcp-server-time",
    installHint: "uvx mcp-server-time",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    toolHints: ["get_current_time", "convert_time"],
    browserReady: false,
  },
  {
    id: "mcp-everything",
    label: "Everything MCP (test)",
    description:
      "Server di test che esercita tools, resources, prompts, sampling. Solo per sviluppo client MCP.",
    transport: "stdio",
    packageHint: "@modelcontextprotocol/server-everything",
    installHint:
      "npx -y @modelcontextprotocol/server-everything  (stdio | sse | streamableHttp)",
    docsUrl:
      "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
    toolHints: ["echo", "add", "longRunningOperation", "sampleLLM"],
    browserReady: false,
  },
];

/** Catalogo: gateway + cloud MCP + reference. */
export const ALL_OFFICIAL_MCP: OfficialMcpServer[] = [
  COMPOSIO_MCP,
  GITHUB_MCP,
  VERCEL_MCP,
  NETLIFY_MCP,
  ...REFERENCE_MCP_SERVERS,
];

export function officialMcpById(id: string): OfficialMcpServer | undefined {
  return ALL_OFFICIAL_MCP.find((s) => s.id === id);
}

export function officialMcpSummaryForAi(): string {
  const lines = ALL_OFFICIAL_MCP.map((s) => {
    const mode = s.browserReady
      ? `REMOTE ${s.remoteUrl}`
      : `LOCAL stdio (${s.packageHint ?? "n/a"})`;
    return `- ${s.label} [${s.id}] ${mode}: ${s.description} tools≈ ${s.toolHints.slice(0, 5).join(", ")}`;
  });
  return [
    "MCP HTTP: Composio, GitHub, Vercel, Netlify + custom URL:",
    ...lines,
    `Composio: ${COMPOSIO_MCP_URL}`,
    `Vercel: ${VERCEL_MCP_URL}`,
    `Netlify: ${NETLIFY_MCP_URL}`,
    "Registry: https://registry.modelcontextprotocol.io",
  ].join("\n");
}
