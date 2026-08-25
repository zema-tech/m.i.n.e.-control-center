/**
 * Connettori storage / MCP sulla rete neurale.
 * Catalogo di default sempre visibile (MEGA, Drive, Falix MCP, Discord…)
 * con link MCP oppure API se il servizio non espone MCP.
 */

export type ConnectorKind = "storage" | "backup" | "mcp" | "service";

/** Come collegare l'account al sito */
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
  /** mcp | api | webhook | skills */
  connectMode: ConnectMode;
  /** Testo guida sotto il bottone */
  connectHint: string;
  /** Link esterno (docs API / MCP) se disponibile */
  docsUrl?: string;
  /** Dove inserire le credenziali in M.I.N.E */
  skillsPath?: "/skills" | "/hosts" | "/connectors";
  /** Tool MCP interni esposti all'IA */
  mcpTools?: string[];
};

const KEY = "mine.connectors.v1";
const SEEDED_KEY = "mine.connectors.seeded.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

/** Catalogo fisso mostrato in sezione Connettori (anche a lista vuota). */
export const DEFAULT_CONNECTOR_CATALOG: DefaultConnectorDef[] = [
  {
    id: "mega",
    label: "MEGA",
    kind: "storage",
    detail: "Cloud MEGA per backup mondi e archivi server",
    connectMode: "api",
    connectHint:
      "MEGA non offre un server MCP pubblico ufficiale. Collega email + password/session in Competenze (provider MEGA). I tool MCP interni mega_* restano disponibili all'IA.",
    docsUrl: "https://mega.io/developers",
    skillsPath: "/skills",
    mcpTools: ["mega_status", "mega_list", "mega_upload_note", "mega_share_link"],
  },
  {
    id: "gdrive",
    label: "Google Drive",
    kind: "storage",
    detail: "Google Drive API — backup e cartelle condivise",
    connectMode: "api",
    connectHint:
      "Nessun MCP ufficiale richiesto: usa API key o Service Account JSON in Competenze (provider Google Drive). Tool gdrive_* per l'IA.",
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
      "MCP interno M.I.N.E mappato sulle API Falix. Aggiungi API Key + Server ID in Competenze o in Host. Nessun server MCP esterno da installare.",
    docsUrl: "https://falixnodes.net",
    skillsPath: "/skills",
    mcpTools: ["falix_* (catalogo completo)"],
  },
  {
    id: "connector-mcp",
    label: "Connettori MCP",
    kind: "mcp",
    detail: "Tool conn_*: Discord, webhook, skill check, pipeline backup",
    connectMode: "mcp",
    connectHint:
      "Pack MCP interno: conn_discord_status, conn_discord_notify, conn_webhook_ping, conn_skill_check, conn_backup_pipeline. Attivalo sulla rete con un click.",
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
    id: "discord",
    label: "Discord",
    kind: "service",
    detail: "Stato server on/off e notifiche via webhook",
    connectMode: "webhook",
    connectHint:
      "Discord non usa MCP per i webhook classici. Crea un Incoming Webhook nel canale e registra il connettore; l'IA propone conn_discord_*.",
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
    skillsPath: "/connectors",
    mcpTools: ["conn_discord_status", "conn_discord_notify"],
  },
  {
    id: "groq",
    label: "Groq (IA)",
    kind: "service",
    detail: "Motore chat e analisi neurale — chiave lato server",
    connectMode: "api",
    connectHint:
      "Configura GROQ_API_KEY sulle variabili d'ambiente del deploy (Vercel). Non si inserisce nel browser.",
    docsUrl: "https://console.groq.com/keys",
  },
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

/** Prima visita: attiva i preset principali sulla rete neurale. */
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
  const seedIds = ["falix-mcp", "mega", "gdrive", "connector-mcp", "discord"];
  const seeded: CustomConnector[] = seedIds.map((id, i) => {
    const def = DEFAULT_CONNECTOR_CATALOG.find((d) => d.id === id)!;
    return {
      id: `conn:default:${id}`,
      label: def.label,
      kind: def.kind,
      detail: def.detail,
      status: "online" as const,
      preset: id,
      createdAt: Date.now() - i,
    };
  });
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
    label: input.label.trim().slice(0, 40),
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
  { id: "mcp", label: "MCP tool pack" },
  { id: "storage", label: "Storage / cloud" },
  { id: "backup", label: "Backup" },
  { id: "service", label: "Servizio" },
];

/** Alias compatibile con UI precedente */
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
