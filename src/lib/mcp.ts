/**
 * MCP-style tool registry per M.I.N.E.
 * - Falix: tool mappati sulle API reali (power, console, files, …)
 * - MEGA / Google Drive: tool storage per backup e file cloud
 *
 * Non è un server MCP esterno (stdio/SSE): è il catalogo tool che l'IA e la UI
 * usano dentro l'app, con human-in-the-loop sulle azioni write/critical.
 */

import { FALIX_ACTIONS, type ActionRisk } from "@/lib/falix-actions";

export type McpProvider = "falix" | "mega" | "gdrive";

export type McpTool = {
  name: string;
  provider: McpProvider;
  description: string;
  risk: ActionRisk;
  /** Parametri documentati per l'IA */
  params: { name: string; required: boolean; hint: string }[];
  /** ID azione Falix se collegata al catalogo API */
  falixActionId?: string;
};

/** Tool Falix derivati dal catalogo API (MCP Falix). */
export const FALIX_MCP_TOOLS: McpTool[] = FALIX_ACTIONS.map((a) => ({
  name: `falix_${a.id.replace(/\./g, "_")}`,
  provider: "falix" as const,
  description: `${a.label} (${a.scope})`,
  risk: a.risk,
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

/** Tool MEGA (storage / backup). Credenziali in account provider=mega. */
export const MEGA_MCP_TOOLS: McpTool[] = [
  {
    name: "mega_list",
    provider: "mega",
    description: "Elenca file/cartelle nella root o in una cartella MEGA",
    risk: "read",
    params: [
      { name: "folder", required: false, hint: "Handle cartella (opz., default root)" },
    ],
  },
  {
    name: "mega_status",
    provider: "mega",
    description: "Verifica che le credenziali MEGA siano configurate",
    risk: "read",
    params: [],
  },
  {
    name: "mega_upload_note",
    provider: "mega",
    description:
      "Registra un job di upload backup (mondo/plugin) verso MEGA — richiede conferma",
    risk: "write",
    params: [
      { name: "filename", required: true, hint: "Nome file backup es. world-2026-08-24.zip" },
      { name: "sourcePath", required: false, hint: "Percorso sul server Falix da includere" },
    ],
  },
  {
    name: "mega_share_link",
    provider: "mega",
    description: "Prepara richiesta link pubblico MEGA per un file (conferma richiesta)",
    risk: "write",
    params: [{ name: "nodeId", required: true, hint: "Handle nodo MEGA" }],
  },
];

/** Tool Google Drive (storage / backup). */
export const GDRIVE_MCP_TOOLS: McpTool[] = [
  {
    name: "gdrive_list",
    provider: "gdrive",
    description: "Elenca file in una cartella Google Drive",
    risk: "read",
    params: [
      { name: "folderId", required: false, hint: "ID cartella (default: root o configurata)" },
    ],
  },
  {
    name: "gdrive_status",
    provider: "gdrive",
    description: "Verifica configurazione Google Drive (API key / service account)",
    risk: "read",
    params: [],
  },
  {
    name: "gdrive_upload_note",
    provider: "gdrive",
    description: "Registra job di upload backup su Google Drive — richiede conferma",
    risk: "write",
    params: [
      { name: "filename", required: true, hint: "Nome file destinazione" },
      { name: "folderId", required: false, hint: "Cartella destinazione Drive" },
      { name: "sourcePath", required: false, hint: "Percorso file sul server Falix" },
    ],
  },
  {
    name: "gdrive_create_folder",
    provider: "gdrive",
    description: "Crea cartella su Drive per organizzare i backup",
    risk: "write",
    params: [
      { name: "name", required: true, hint: "Nome cartella" },
      { name: "parentId", required: false, hint: "Cartella padre" },
    ],
  },
];

export const ALL_MCP_TOOLS: McpTool[] = [
  ...FALIX_MCP_TOOLS,
  ...MEGA_MCP_TOOLS,
  ...GDRIVE_MCP_TOOLS,
];

export function mcpToolsByProvider(provider: McpProvider): McpTool[] {
  return ALL_MCP_TOOLS.filter((t) => t.provider === provider);
}

export function mcpToolSummaryForAi(providers: McpProvider[] = ["falix", "mega", "gdrive"]): string {
  const tools = ALL_MCP_TOOLS.filter((t) => providers.includes(t.provider));
  const lines = tools.slice(0, 80).map(
    (t) =>
      `- ${t.name} [${t.provider}/${t.risk}]: ${t.description}` +
      (t.params.length
        ? ` params: ${t.params.map((p) => p.name + (p.required ? "*" : "")).join(", ")}`
        : ""),
  );
  return [
    "Catalogo tool MCP disponibili in M.I.N.E (solo Falix + storage MEGA/Drive):",
    ...lines,
    tools.length > 80 ? `… e altri ${tools.length - 80} tool Falix.` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
};
