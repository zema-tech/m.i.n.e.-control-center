/**
 * MCP-style tool registry per M.I.N.E.
 * - Falix / storage / connector / research nativi
 * - One (withoneai): 4 tool universali → 700+ app
 */

import { FALIX_ACTIONS, type ActionRisk } from "@/lib/falix-actions";
import { ONE_MCP_TOOL_NAMES } from "@/lib/one-platforms";

export type McpProvider = "falix" | "mega" | "gdrive" | "connector" | "research" | "one";

export type McpTool = {
  name: string;
  provider: McpProvider;
  description: string;
  risk: ActionRisk;
  params: { name: string; required: boolean; hint: string }[];
  falixActionId?: string;
  skill?: string;
};

export const FALIX_MCP_TOOLS: McpTool[] = FALIX_ACTIONS.map((a) => ({
  name: `falix_${a.id.replace(/\./g, "_")}`,
  provider: "falix" as const,
  description: `${a.label} (${a.scope})`,
  risk: a.risk,
  skill: a.id.startsWith("power")
    ? "power"
    : a.id.includes("console") || a.id.includes("command")
      ? "console"
      : a.id.includes("log")
        ? "logs"
        : a.id.includes("file")
          ? "files"
          : a.id.includes("backup")
            ? "backup"
            : a.id.includes("player")
              ? "players"
              : a.id.includes("monitor") || a.id.includes("status")
                ? "metrics"
                : "status",
  params: [
    { name: "serverId", required: true, hint: "ID server Falix dell'account attivo" },
    ...(a.body ?? []).map((p) => ({
      name: p,
      required: true,
      hint: `Parametro body: ${p}`,
    })),
    ...(a.path.includes("{path}")
      ? [{ name: "path", required: true, hint: "Percorso file sul server" }]
      : []),
    ...(a.path.includes("{backup}")
      ? [{ name: "backup", required: true, hint: "ID backup" }]
      : []),
    ...(a.path.includes("{address}")
      ? [{ name: "address", required: true, hint: "Indirizzo MC query" }]
      : []),
  ],
  falixActionId: a.id,
}));

export const MEGA_MCP_TOOLS: McpTool[] = [
  {
    name: "mega_list",
    provider: "mega",
    description: "Elenca file/cartelle nella root o in una cartella MEGA",
    risk: "read",
    skill: "files",
    params: [{ name: "folder", required: false, hint: "Handle cartella (opz.)" }],
  },
  {
    name: "mega_status",
    provider: "mega",
    description: "Verifica che le credenziali MEGA siano configurate",
    risk: "read",
    skill: "status",
    params: [],
  },
  {
    name: "mega_upload_note",
    provider: "mega",
    description: "Registra job upload backup verso MEGA — richiede conferma",
    risk: "write",
    skill: "backup",
    params: [
      { name: "filename", required: true, hint: "Nome file es. world-2026-08-24.zip" },
      { name: "sourcePath", required: false, hint: "Percorso sul server Falix" },
    ],
  },
  {
    name: "mega_share_link",
    provider: "mega",
    description: "Prepara link pubblico MEGA (conferma richiesta)",
    risk: "write",
    skill: "files",
    params: [{ name: "nodeId", required: true, hint: "Handle nodo MEGA" }],
  },
];

export const GDRIVE_MCP_TOOLS: McpTool[] = [
  {
    name: "gdrive_list",
    provider: "gdrive",
    description: "Elenca file in una cartella Google Drive",
    risk: "read",
    skill: "files",
    params: [{ name: "folderId", required: false, hint: "ID cartella" }],
  },
  {
    name: "gdrive_status",
    provider: "gdrive",
    description: "Verifica configurazione Google Drive",
    risk: "read",
    skill: "status",
    params: [],
  },
  {
    name: "gdrive_upload_note",
    provider: "gdrive",
    description: "Registra job upload backup su Drive — richiede conferma",
    risk: "write",
    skill: "backup",
    params: [
      { name: "filename", required: true, hint: "Nome file destinazione" },
      { name: "folderId", required: false, hint: "Cartella Drive" },
      { name: "sourcePath", required: false, hint: "Percorso su Falix" },
    ],
  },
  {
    name: "gdrive_create_folder",
    provider: "gdrive",
    description: "Crea cartella su Drive per i backup",
    risk: "write",
    skill: "files",
    params: [
      { name: "name", required: true, hint: "Nome cartella" },
      { name: "parentId", required: false, hint: "Cartella padre" },
    ],
  },
];

export const CONNECTOR_MCP_TOOLS: McpTool[] = [
  {
    name: "conn_discord_status",
    provider: "connector",
    description:
      "Prepara messaggio di stato server (online/offline/TPS) per bot Discord — non invia da solo",
    risk: "read",
    skill: "status",
    params: [
      { name: "serverLabel", required: false, hint: "Nome server da includere" },
      { name: "status", required: false, hint: "online | offline" },
    ],
  },
  {
    name: "conn_discord_notify",
    provider: "connector",
    description: "Registra notifica Discord (webhook) da approvare — es. crash o restart",
    risk: "write",
    skill: "status",
    params: [
      { name: "message", required: true, hint: "Testo notifica" },
      { name: "level", required: false, hint: "info | warn | critical" },
    ],
  },
  {
    name: "conn_webhook_ping",
    provider: "connector",
    description: "Registra ping verso webhook generico configurato nei connettori",
    risk: "write",
    skill: "status",
    params: [
      { name: "urlHint", required: false, hint: "Etichetta connettore, non URL segreta" },
      { name: "payload", required: false, hint: "JSON riassunto evento" },
    ],
  },
  {
    name: "conn_skill_check",
    provider: "connector",
    description: "Verifica quali skill (power, logs, backup…) sono attive sull'account Falix corrente",
    risk: "read",
    skill: "status",
    params: [{ name: "skill", required: false, hint: "Skill da controllare" }],
  },
  {
    name: "conn_backup_pipeline",
    provider: "connector",
    description:
      "Proposta pipeline: backup Falix → upload MEGA/Drive — richiede conferma multipla",
    risk: "write",
    skill: "backup",
    params: [
      { name: "target", required: true, hint: "mega | gdrive" },
      { name: "sourcePath", required: false, hint: "Es. /world" },
    ],
  },
];

export const RESEARCH_MCP_TOOLS: McpTool[] = [
  {
    name: "host_research",
    provider: "research",
    description:
      "Studia un host o sito panel Minecraft/cloud (nome o URL): API, MCP, prezzi e bozza profilo host",
    risk: "read",
    skill: "status",
    params: [
      {
        name: "query",
        required: true,
        hint: "Es. falix, koyeb, pterodactyl, aternos.org",
      },
    ],
  },
];

/** Gateway One — 4 tool per 700+ app (https://github.com/withoneai/cli). */
export const ONE_MCP_TOOLS: McpTool[] = [
  {
    name: ONE_MCP_TOOL_NAMES[0],
    provider: "one",
    description:
      "Lista piattaforme One disponibili e connessioni attive (access policy inclusa)",
    risk: "read",
    skill: "status",
    params: [],
  },
  {
    name: ONE_MCP_TOOL_NAMES[1],
    provider: "one",
    description: "Cerca azioni API su una piattaforma One (es. gmail, slack, stripe)",
    risk: "read",
    skill: "status",
    params: [
      { name: "platform", required: true, hint: "Slug piattaforma es. gmail" },
      { name: "query", required: true, hint: "Linguaggio naturale es. send email" },
    ],
  },
  {
    name: ONE_MCP_TOOL_NAMES[2],
    provider: "one",
    description: "Documentazione completa di un'azione One (schema, params, esempi)",
    risk: "read",
    skill: "status",
    params: [
      { name: "platform", required: true, hint: "Slug piattaforma" },
      { name: "actionId", required: true, hint: "ID azione da search" },
    ],
  },
  {
    name: ONE_MCP_TOOL_NAMES[3],
    provider: "one",
    description:
      "Esegue un'azione API su piattaforma One collegata — richiede conferma human-in-the-loop",
    risk: "write",
    skill: "status",
    params: [
      { name: "platform", required: true, hint: "Slug piattaforma" },
      { name: "actionId", required: true, hint: "ID azione" },
      { name: "connectionKey", required: false, hint: "Chiave connessione One" },
      { name: "data", required: false, hint: "JSON body" },
    ],
  },
];

export const ALL_MCP_TOOLS: McpTool[] = [
  ...FALIX_MCP_TOOLS,
  ...MEGA_MCP_TOOLS,
  ...GDRIVE_MCP_TOOLS,
  ...CONNECTOR_MCP_TOOLS,
  ...RESEARCH_MCP_TOOLS,
  ...ONE_MCP_TOOLS,
];

export function mcpToolsByProvider(provider: McpProvider): McpTool[] {
  return ALL_MCP_TOOLS.filter((t) => t.provider === provider);
}

export function mcpToolSummaryForAi(
  providers: McpProvider[] = ["falix", "mega", "gdrive", "connector", "research", "one"],
): string {
  const tools = ALL_MCP_TOOLS.filter((t) => providers.includes(t.provider));
  const lines = tools.slice(0, 100).map(
    (t) =>
      `- ${t.name} [${t.provider}/${t.risk}${t.skill ? `/${t.skill}` : ""}]: ${t.description}` +
      (t.params.length
        ? ` params: ${t.params.map((p) => p.name + (p.required ? "*" : "")).join(", ")}`
        : ""),
  );
  return [
    "Catalogo tool MCP M.I.N.E (Falix + storage + connettori + research + One gateway):",
    ...lines,
    tools.length > 100 ? `… e altri ${tools.length - 100} tool.` : "",
    "One: 700+ app via 4 tool — collega https://mcp.withone.ai/mcp (OAuth).",
  ]
    .filter(Boolean)
    .join("\n");
}

export function isKnownActionId(id: string): boolean {
  if (FALIX_ACTIONS.some((a) => a.id === id)) return true;
  return ALL_MCP_TOOLS.some((t) => t.name === id || t.falixActionId === id);
}

export const MCP_PROVIDER_META: Record<
  McpProvider,
  { label: string; blurb: string }
> = {
  falix: {
    label: "Falix MCP",
    blurb: "Tool API Falix: power, console, file, backup, giocatori, metriche",
  },
  mega: {
    label: "MEGA",
    blurb: "Cloud MEGA per backup mondi e archivi server",
  },
  gdrive: {
    label: "Google Drive",
    blurb: "Google Drive API per backup e cartelle condivise",
  },
  connector: {
    label: "Connettori MCP",
    blurb: "Discord status/notify, webhook, skill check, pipeline backup",
  },
  research: {
    label: "Host Research",
    blurb: "Studia provider MC e cloud: API, MCP, prezzi, bozza profilo",
  },
  one: {
    label: "One (withoneai)",
    blurb: "Gateway MCP 700+ app — Gmail, Slack, Stripe, Notion… via 4 tool",
  },
};
