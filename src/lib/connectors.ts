/** Connettori storage / MCP sulla rete neurale (MEGA, Google Drive). */

export type ConnectorKind = "storage" | "backup" | "mcp" | "service";

export type CustomConnector = {
  id: string;
  label: string;
  kind: ConnectorKind;
  detail: string;
  status: "online" | "offline" | "error";
  preset?: string;
  /** Credenziale opzionale (non mostrata in chiaro nella lista). */
  secretHint?: string;
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

export const CONNECTOR_KIND_OPTIONS: { id: ConnectorKind; label: string }[] = [
  { id: "mcp", label: "MCP tool pack" },
  { id: "storage", label: "Storage / cloud" },
  { id: "backup", label: "Backup" },
  { id: "service", label: "Servizio" },
];

export const CONNECTOR_PRESETS: {
  id: string;
  label: string;
  kind: ConnectorKind;
  detail: string;
}[] = [
  {
    id: "falix-mcp",
    label: "Falix MCP",
    kind: "mcp",
    detail: "Catalogo tool API Falix per l'IA (power, console, files, …)",
  },
  {
    id: "mega",
    label: "MEGA",
    kind: "storage",
    detail: "Cloud MEGA — configura anche in Competenze (provider MEGA)",
  },
  {
    id: "gdrive",
    label: "Google Drive",
    kind: "storage",
    detail: "Google Drive API — configura anche in Competenze",
  },
];
