/** Connettori custom + preset (MEGA, Discord, RCON, …) sulla rete neurale. */

export type ConnectorKind =
  | "service"
  | "plugin"
  | "world"
  | "metric"
  | "storage"
  | "chat"
  | "backup"
  | "rcon";

export type CustomConnector = {
  id: string;
  label: string;
  kind: ConnectorKind;
  detail: string;
  status: "online" | "offline" | "error";
  /** Preset conosciuto (mega, discord, …) per icona/hint. */
  preset?: string;
  createdAt: number;
};

const KEY = "mine.connectors.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

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

export function addConnector(input: {
  label: string;
  kind: ConnectorKind;
  detail?: string;
  status?: CustomConnector["status"];
  preset?: string;
}): CustomConnector {
  const item: CustomConnector = {
    id: `conn:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: input.label.trim().slice(0, 40),
    kind: input.kind,
    detail: (input.detail ?? "Connettore personalizzato").slice(0, 160),
    status: input.status ?? "online",
    preset: input.preset,
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

export const CONNECTOR_KIND_OPTIONS: { id: ConnectorKind; label: string }[] = [
  { id: "storage", label: "Storage / cloud" },
  { id: "backup", label: "Backup" },
  { id: "chat", label: "Chat / bot" },
  { id: "rcon", label: "RCON / console" },
  { id: "service", label: "Servizio" },
  { id: "plugin", label: "Plugin" },
  { id: "world", label: "Mondo" },
  { id: "metric", label: "Metrica" },
];

/** Scorciatoie per connettori comuni. */
export const CONNECTOR_PRESETS: {
  id: string;
  label: string;
  kind: ConnectorKind;
  detail: string;
}[] = [
  {
    id: "mega",
    label: "MEGA",
    kind: "storage",
    detail: "Cloud MEGA per backup mondi / file server",
  },
  {
    id: "gdrive",
    label: "Google Drive",
    kind: "backup",
    detail: "Backup automatici su Drive",
  },
  {
    id: "discord",
    label: "Discord bot",
    kind: "chat",
    detail: "Webhook / bot per status e comandi",
  },
  {
    id: "rcon",
    label: "RCON",
    kind: "rcon",
    detail: "Console remota (password + porta)",
  },
  {
    id: "webhook",
    label: "Webhook HTTP",
    kind: "service",
    detail: "Notifiche eventi server",
  },
  {
    id: "s3",
    label: "S3 / MinIO",
    kind: "storage",
    detail: "Object storage per backup",
  },
];
