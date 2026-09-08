/**
 * Connettori storage / MCP / cloud / One (withoneai) + MCP ufficiali.
 */

import {
  ALL_OFFICIAL_MCP,
  type OfficialMcpServer,
} from "@/lib/official-mcp";
import {
  ONE_CLI_REPO,
  ONE_DOCS_URL,
  ONE_MCP_TOOL_NAMES,
  ONE_MCP_URL,
  ONE_PLATFORMS,
  type OnePlatform,
} from "@/lib/one-platforms";

export type ConnectorKind = "storage" | "backup" | "mcp" | "service" | "cloud" | "one";

export type ConnectMode = "mcp" | "api" | "webhook" | "skills";

export type CustomConnector = {
  id: string;
  label: string;
  kind: ConnectorKind;
  detail: string;
  status: "online" | "offline" | "error";
  preset?: string;
  secretHint?: string;
  createdAt: number;
};

export type DefaultConnectorDef = {
  id: string;
  label: string;
  kind: ConnectorKind;
  detail: string;
  connectMode: ConnectMode;
  connectHint: string;
  docsUrl?: string;
  skillsPath?: "/skills" | "/hosts" | "/connectors";
  mcpTools?: string[];
  /** true se proviene dal catalogo One */
  onePlatform?: boolean;
  /** true se MCP ufficiale (reference / GitHub) */
  officialMcp?: boolean;
  /** remote usabile da browser senza processo locale */
  browserReady?: boolean;
};

const KEY = "mine.connectors.v1";
const SEEDED_KEY = "mine.connectors.seeded.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

function officialToDef(s: OfficialMcpServer): DefaultConnectorDef {
  const modeHint = s.browserReady
    ? `REMOTE streamable-http: ${s.remoteUrl}`
    : `LOCAL stdio — ${s.packageHint ?? "n/a"}`;
  return {
    id: s.id,
    label: s.label,
    kind: "mcp",
    detail: s.description,
    connectMode: "mcp",
    connectHint: `${modeHint}. ${s.installHint}`,
    docsUrl: s.docsUrl,
    skillsPath: "/connectors",
    mcpTools: s.toolHints,
    officialMcp: true,
    browserReady: s.browserReady,
  };
}

const NATIVE_CATALOG: DefaultConnectorDef[] = [
  {
    id: "one-mcp",
    label: "One MCP (withoneai)",
    kind: "one",
    detail: "Gateway unico → 700+ app (Gmail, Slack, Stripe, Notion…). 4 tool MCP.",
    connectMode: "mcp",
    connectHint: `Collega il remote MCP ${ONE_MCP_URL} (OAuth) oppure CLI: npm i -g @withone/cli && one init. Repo: ${ONE_CLI_REPO}. Dopo il collegamento usa list_one_integrations per tutte le piattaforme live.`,
    docsUrl: ONE_DOCS_URL,
    skillsPath: "/connectors",
    mcpTools: [...ONE_MCP_TOOL_NAMES],
  },
  // MCP ufficiali (GitHub remote + reference) — prima dei nativi per visibilità
  ...ALL_OFFICIAL_MCP.map(officialToDef),
  {
    id: "mega",
    label: "MEGA",
    kind: "storage",
    detail: "Cloud MEGA per backup mondi, archivi e dump app",
    connectMode: "api",
    connectHint:
      "MEGA non offre un server MCP pubblico ufficiale. Collega credenziali in Competenze (provider MEGA). Tool interni mega_*.",
    docsUrl: "https://mega.io/developers",
    skillsPath: "/skills",
    mcpTools: ["mega_status", "mega_list", "mega_upload_note", "mega_share_link"],
  },
  {
    id: "gdrive",
    label: "Google Drive (nativo)",
    kind: "storage",
    detail: "Google Drive API nativa M.I.N.E — oppure via One MCP",
    connectMode: "api",
    connectHint:
      "Usa API key in Competenze oppure collega Google Drive tramite One MCP per OAuth gestito.",
    docsUrl: "https://developers.google.com/drive/api",
    skillsPath: "/skills",
    mcpTools: ["gdrive_status", "gdrive_list", "gdrive_upload_note", "gdrive_create_folder"],
  },
  {
    id: "falix-mcp",
    label: "Falix MCP",
    kind: "mcp",
    detail: "Catalogo tool API Falix (power, console, files, backup…)",
    connectMode: "mcp",
    connectHint:
      "MCP interno M.I.N.E sulle API Falix. Aggiungi API Key + Server ID in Competenze o Host.",
    docsUrl: "https://falixnodes.net",
    skillsPath: "/skills",
    mcpTools: ["falix_* (catalogo completo)"],
  },
  {
    id: "koyeb",
    label: "Koyeb",
    kind: "cloud",
    detail: "Deploy container e API su edge Koyeb",
    connectMode: "api",
    connectHint:
      "API token Koyeb in Host (provider Koyeb). Profilo + research attivi; azioni live in roadmap.",
    docsUrl: "https://www.koyeb.com/docs/api",
    skillsPath: "/hosts",
  },
  {
    id: "railway",
    label: "Railway",
    kind: "cloud",
    detail: "Progetti, servizi e variabili via API Railway",
    connectMode: "api",
    connectHint: "Token Railway + Project/Service ID in Host.",
    docsUrl: "https://docs.railway.com/guides/public-api",
    skillsPath: "/hosts",
  },
  {
    id: "render",
    label: "Render",
    kind: "cloud",
    detail: "Web services e background workers",
    connectMode: "api",
    connectHint: "API Key Render in Host (provider Render).",
    docsUrl: "https://api-docs.render.com",
    skillsPath: "/hosts",
  },
  {
    id: "fly",
    label: "Fly.io",
    kind: "cloud",
    detail: "Machines API — app globali",
    connectMode: "api",
    connectHint: "Fly API token + app name in Host.",
    docsUrl: "https://fly.io/docs/machines/api/",
    skillsPath: "/hosts",
  },
  {
    id: "connector-mcp",
    label: "Connettori MCP",
    kind: "mcp",
    detail: "Tool conn_*: Discord, webhook, skill check, pipeline backup",
    connectMode: "mcp",
    connectHint:
      "Pack MCP interno: conn_discord_status, conn_discord_notify, conn_webhook_ping, conn_skill_check, conn_backup_pipeline.",
    skillsPath: "/connectors",
    mcpTools: [
      "conn_discord_status",
      "conn_discord_notify",
      "conn_webhook_ping",
      "conn_skill_check",
      "conn_backup_pipeline",
    ],
  },
  {
    id: "discord-native",
    label: "Discord (webhook nativo)",
    kind: "service",
    detail: "Stato servizi e notifiche via webhook M.I.N.E",
    connectMode: "webhook",
    connectHint: "Incoming Webhook; oppure Discord via One MCP per bot/API complete.",
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
    skillsPath: "/connectors",
    mcpTools: ["conn_discord_status", "conn_discord_notify"],
  },
  {
    id: "webhook-generic",
    label: "Webhook generico",
    kind: "service",
    detail: "Ping HTTP verso automazioni (n8n, Make, custom)",
    connectMode: "webhook",
    connectHint: "Registra un connettore; tool conn_webhook_ping in chat IA.",
    skillsPath: "/connectors",
    mcpTools: ["conn_webhook_ping"],
  },
  {
    id: "host-research",
    label: "Host Research",
    kind: "mcp",
    detail: "Studia provider MC e cloud (API, prezzi, bozza profilo)",
    connectMode: "mcp",
    connectHint: "Tool host_research — disponibile in Host e come proposta IA.",
    skillsPath: "/hosts",
    mcpTools: ["host_research"],
  },
  {
    id: "groq",
    label: "Groq (IA)",
    kind: "service",
    detail: "Motore chat e analisi neurale — chiave lato server",
    connectMode: "api",
    connectHint:
      "Configura GROQ_API_KEY sulle variabili d'ambiente del deploy (Vercel).",
    docsUrl: "https://console.groq.com/keys",
  },
];

function onePlatformToDef(p: OnePlatform): DefaultConnectorDef {
  return {
    id: `one:${p.id}`,
    label: p.label,
    kind: "one",
    detail: `${p.detail} — via One MCP`,
    connectMode: "mcp",
    connectHint: `Piattaforma One (slug: ${p.id}). Attiva il gateway «One MCP», poi autorizza ${p.label} su app.withone.ai o con CLI: one add ${p.id}. Tool: ${ONE_MCP_TOOL_NAMES.join(", ")}.`,
    docsUrl: ONE_DOCS_URL,
    skillsPath: "/connectors",
    mcpTools: [...ONE_MCP_TOOL_NAMES],
    onePlatform: true,
  };
}

/** Catalogo completo: nativi + ufficiali MCP + piattaforme One. */
export const DEFAULT_CONNECTOR_CATALOG: DefaultConnectorDef[] = [
  ...NATIVE_CATALOG,
  ...ONE_PLATFORMS.map(onePlatformToDef),
];

export function loadConnectors(): CustomConnector[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CustomConnector[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConnectors(list: CustomConnector[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function ensureDefaultConnectors(): CustomConnector[] {
  if (!canUseStorage()) return [];
  const existing = loadConnectors();
  try {
    if (window.localStorage.getItem(SEEDED_KEY) === "1" && existing.length > 0) {
      return existing;
    }
  } catch {
    /* ignore */
  }
  if (existing.length > 0) {
    try {
      window.localStorage.setItem(SEEDED_KEY, "1");
    } catch {
      /* ignore */
    }
    return existing;
  }
  const seedIds = ["one-mcp", "github-mcp", "falix-mcp", "mega", "gdrive", "koyeb", "connector-mcp"];
  const seeded: CustomConnector[] = seedIds
    .map((id, i) => {
      const def = NATIVE_CATALOG.find((d) => d.id === id);
      if (!def) return null;
      return {
        id: `conn:default:${id}`,
        label: def.label,
        kind: def.kind,
        detail: def.detail,
        status: "online" as const,
        preset: id,
        createdAt: Date.now() - i,
      };
    })
    .filter(Boolean) as CustomConnector[];
  saveConnectors(seeded);
  try {
    window.localStorage.setItem(SEEDED_KEY, "1");
  } catch {
    /* ignore */
  }
  return seeded;
}

export function addConnector(input: {
  label: string;
  kind: ConnectorKind;
  detail?: string;
  status?: CustomConnector["status"];
  preset?: string;
  secretHint?: string;
}): CustomConnector {
  const item: CustomConnector = {
    id: `conn:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: input.label.trim().slice(0, 48),
    kind: input.kind,
    detail: (input.detail ?? "Connettore").slice(0, 160),
    status: input.status ?? "online",
    preset: input.preset,
    secretHint: input.secretHint,
    createdAt: Date.now(),
  };
  saveConnectors([item, ...loadConnectors()]);
  return item;
}

export function removeConnector(id: string): CustomConnector[] {
  const next = loadConnectors().filter((c) => c.id !== id);
  saveConnectors(next);
  return next;
}

export function isPresetActive(presetId: string): boolean {
  return loadConnectors().some((c) => c.preset === presetId);
}

export const CONNECTOR_KIND_OPTIONS: { id: ConnectorKind; label: string }[] = [
  { id: "one", label: "One / SaaS (withoneai)" },
  { id: "mcp", label: "MCP tool pack" },
  { id: "cloud", label: "Cloud / PaaS" },
  { id: "storage", label: "Storage / cloud" },
  { id: "backup", label: "Backup" },
  { id: "service", label: "Servizio" },
];

export const CONNECTOR_PRESETS = DEFAULT_CONNECTOR_CATALOG.map((d) => ({
  id: d.id,
  label: d.label,
  kind: d.kind,
  detail: d.detail,
}));

export function connectModeLabel(mode: ConnectMode): string {
  switch (mode) {
    case "mcp":
      return "MCP";
    case "api":
      return "API";
    case "webhook":
      return "Webhook";
    case "skills":
      return "Competenze";
  }
}

export { ONE_MCP_URL, ONE_DOCS_URL, ONE_CLI_REPO, ALL_OFFICIAL_MCP };
