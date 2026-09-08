/**
 * MCP operativi ufficiali (opzione A)
 * - Reference servers: github.com/modelcontextprotocol/servers
 * - GitHub MCP: remote streamable-http + locale Docker/binary
 *
 * Registry: https://registry.modelcontextprotocol.io
 * Docs: https://modelcontextprotocol.io/examples
 */

export type OfficialMcpTransport = "stdio" | "streamable-http" | "sse";

export type OfficialMcpServer = {
  id: string;
  label: string;
  description: string;
  /** transport principale consigliato */
  transport: OfficialMcpTransport;
  /** URL remote se disponibile */
  remoteUrl?: string;
  /** pacchetto npm / comando stdio */
  packageHint?: string;
  /** install / run one-liner */
  installHint: string;
  docsUrl: string;
  /** tool noti (hint per l'AI, non lista esaustiva runtime) */
  toolHints: string[];
  /** true = remoto usabile da browser/Vercel senza processo locale */
  browserReady: boolean;
};

/** GitHub MCP ufficiale (remote + local). */
export const GITHUB_MCP: OfficialMcpServer = {
  id: "github-mcp",
  label: "GitHub MCP",
  description:
    "Server ufficiale GitHub: issues, PR, repos, code search, actions. Remote streamable-http o Docker locale.",
  transport: "streamable-http",
  remoteUrl: "https://api.githubcopilot.com/mcp/",
  packageHint: "ghcr.io/github/github-mcp-server",
  installHint:
    "Remote: collega https://api.githubcopilot.com/mcp/ con Authorization: Bearer <GITHUB_PAT>. Locale: docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN=<token> ghcr.io/github/github-mcp-server",
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

/** Reference servers dal repo modelcontextprotocol/servers. */
export const REFERENCE_MCP_SERVERS: OfficialMcpServer[] = [
  {
    id: "mcp-filesystem",
    label: "Filesystem MCP",
    description:
      "Operazioni file sicure (read/write/list/search) con directory allowlist. Reference ufficiale.",
    transport: "stdio",
    packageHint: "@modelcontextprotocol/server-filesystem",
    installHint:
      'npx -y @modelcontextprotocol/server-filesystem /percorso/consentito — oppure Docker mcp/filesystem',
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

export const ALL_OFFICIAL_MCP: OfficialMcpServer[] = [
  GITHUB_MCP,
  ...REFERENCE_MCP_SERVERS,
];

export function officialMcpById(id: string): OfficialMcpServer | undefined {
  return ALL_OFFICIAL_MCP.find((s) => s.id === id);
}

/** Riepilogo per system prompt / agent brain. */
export function officialMcpSummaryForAi(): string {
  const lines = ALL_OFFICIAL_MCP.map((s) => {
    const mode = s.browserReady
      ? `REMOTE ${s.remoteUrl}`
      : `LOCAL stdio (${s.packageHint ?? "n/a"})`;
    return `- ${s.label} [${s.id}] ${mode}: ${s.description} tools≈ ${s.toolHints.slice(0, 5).join(", ")}`;
  });
  return [
    "MCP ufficiali (reference + GitHub):",
    ...lines,
    "Nota: i reference stdio richiedono processo locale o bridge; GitHub remote è usabile via HTTP con PAT.",
    "Registry: https://registry.modelcontextprotocol.io",
  ].join("\n");
}
