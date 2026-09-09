/**
 * MCP custom definiti dall'utente (URL streamable-http).
 * Persistenza: localStorage per account browser.
 */

import { isValidMcpHttpUrl, type McpServerConfig } from "./mcp-servers";

export type CustomMcpServer = {
  id: string;
  label: string;
  url: string;
  /** Header Authorization o x-api-key (opzionale, salvato in chiaro lato client) */
  authHeader?: string;
  createdAt: number;
};

const KEY = "mine.mcp.custom.v1";

function canUse() {
  return typeof window !== "undefined";
}

export function loadCustomMcpServers(): CustomMcpServer[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CustomMcpServer[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomMcpServers(list: CustomMcpServer[]) {
  if (!canUse()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function addCustomMcpServer(input: {
  label: string;
  url: string;
  authHeader?: string;
}): CustomMcpServer {
  const url = input.url.trim();
  if (!isValidMcpHttpUrl(url)) {
    throw new Error("URL MCP non valido (serve http/https).");
  }
  const item: CustomMcpServer = {
    id: `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    label: (input.label.trim() || "MCP custom").slice(0, 48),
    url,
    authHeader: input.authHeader?.trim() || undefined,
    createdAt: Date.now(),
  };
  saveCustomMcpServers([item, ...loadCustomMcpServers()]);
  return item;
}

export function removeCustomMcpServer(id: string): CustomMcpServer[] {
  const next = loadCustomMcpServers().filter((s) => s.id !== id);
  saveCustomMcpServers(next);
  return next;
}

export function customToConfig(s: CustomMcpServer): McpServerConfig {
  const headers: Record<string, string> = {};
  if (s.authHeader) {
    if (/^Bearer\s/i.test(s.authHeader) || s.authHeader.includes(":")) {
      // "Authorization: Bearer x" oppure solo token
      if (s.authHeader.includes(":")) {
        const i = s.authHeader.indexOf(":");
        headers[s.authHeader.slice(0, i).trim()] = s.authHeader.slice(i + 1).trim();
      } else {
        headers["Authorization"] = s.authHeader;
      }
    } else {
      headers["Authorization"] = `Bearer ${s.authHeader}`;
    }
  }
  return {
    type: "http",
    url: s.url,
    label: s.label,
    headers: Object.keys(headers).length ? headers : undefined,
  };
}

/** Id usable in mcp_call (server=custom:xxx o solo id). */
export function findCustomMcp(serverId: string): CustomMcpServer | undefined {
  const list = loadCustomMcpServers();
  return list.find((s) => s.id === serverId || s.id === `custom:${serverId}`);
}
