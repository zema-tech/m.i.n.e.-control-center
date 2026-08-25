/**
 * MCP-style tool registry per M.I.N.E.
 * - Falix: tool mappati sulle API reali
 * - MEGA / Google Drive: storage backup
 * - Connettori: Discord webhook, status, skill hooks (human-in-the-loop)
 */

import { FALIX_ACTIONS, type ActionRisk } from "@/lib/falix-actions";

export type McpProvider = "falix" | "mega" | "gdrive" | "connector";

export type McpTool = {
  name: string;
  provider: McpProvider;
  description: string;
  risk: ActionRisk;
  params: { name: string; required: boolean; hint: string }[];
  falixActionId?: string;
  /** Skill M.I.N.E. correlata (power, logs, backup, …) */
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

/** Tool MCP legati ai connettori (Discord, webhook, skill hooks). */
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

export const ALL_MCP_TOOLS: McpTool[] = [
  ...FALIX_MCP_TOOLS,
  ...MEGA_MCP_TOOLS,
  ...GDRIVE_MCP_TOOLS,
  ...CONNECTOR_MCP_TOOLS,
];

export function mcpToolsByProvider(provider: McpProvider): McpTool[] {
  return ALL_MCP_TOOLS.filter((t) => t.provider === provider);
}

export function mcpToolSummaryForAi(
  providers: McpProvider[] = ["falix", "mega", "gdrive", "connector"],
): string {
  const tools = ALL_MCP_TOOLS.filter((t) => providers.includes(t.provider));
  const lines = tools.slice(0, 90).map(
    (t) =>
      `- ${t.name} [${t.provider}/${t.risk}${t.skill ? `/${t.skill}` : ""}]: ${t.description}` +
      (t.params.length
        ? ` params: ${t.params.map((p) => p.name + (p.required ? "*" : "")).join(", ")}`
        : ""),
  );
  return [
    "Catalogo tool MCP M.I.N.E (Falix + storage + connettori):",
    ...lines,
    tools.length > 90 ? `… e altri ${tools.length - 90} tool.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Id validi per proposte IA (Falix action id + storage + connector tool name). */
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
};
