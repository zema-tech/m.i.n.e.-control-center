/** Connettori custom aggiunti dall'utente sulla rete neurale. */

export type ConnectorKind = "service" | "plugin" | "world" | "metric";

export type CustomConnector = {
  id: string;
  label: string;
  kind: ConnectorKind;
  detail: string;
  status: "online" | "offline" | "error";
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
}): CustomConnector {
  const item: CustomConnector = {
    id: `conn:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: input.label.trim().slice(0, 40),
    kind: input.kind,
    detail: (input.detail ?? "Connettore personalizzato").slice(0, 120),
    status: input.status ?? "online",
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
  { id: "service", label: "Servizio" },
  { id: "plugin", label: "Plugin" },
  { id: "world", label: "Mondo" },
  { id: "metric", label: "Metrica" },
];
