import { logAction } from "./auth.server";

export type FalixConfig = { key: string; serverId: string; base: string };

export type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };

export function getFalixConfig(): FalixConfig | null {
  const key = process.env["FALIX_API_KEY"];
  const serverId = process.env["FALIX_SERVER_ID"];
  if (!key || !serverId) return null;
  return {
    key,
    serverId,
    base: process.env["FALIX_API_BASE"] ?? "https://api.falixnodes.net/api",
  };
}

async function falixFetch(
  cfg: FalixConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const res = await fetch(`${cfg.base}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Falix ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function classify(line: string): LogLine["level"] {
  const l = line.toLowerCase();
  if (/error|exception|severe|crash|failed/.test(l)) return "error";
  if (/warn|deprecat|lag|slow|can't keep up/.test(l)) return "warn";
  return "info";
}

function toLines(raw: string): LogLine[] {
  return raw
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(-300)
    .map((line) => ({
      ts: new Date().toISOString(),
      level: classify(line),
      message: line,
    }));
}

const DEMO_LOG = `[08:41:02] [Server thread/INFO]: Starting minecraft server version 1.21.4
[08:41:09] [Server thread/INFO]: Done (7.412s)! For help, type "help"
[08:44:18] [Server thread/INFO]: Steve joined the game
[08:52:03] [Server thread/WARN]: Can't keep up! Is the server overloaded? Running 3421ms behind
[08:52:44] [Server thread/WARN]: [EssentialsX] Config option 'teleport-safety' is deprecated
[08:55:10] [Server thread/ERROR]: Could not pass event PlayerInteractEvent to WorldGuard v7.0.9
[08:55:10] [Server thread/ERROR]: java.lang.NullPointerException: region manager not loaded
[08:56:01] [Server thread/INFO]: Alex joined the game`;

export async function fetchServerLogs(): Promise<{ demo: boolean; lines: LogLine[] }> {
  const cfg = getFalixConfig();
  if (!cfg) return { demo: true, lines: toLines(DEMO_LOG) };
  const data = (await falixFetch(cfg, `/servers/${cfg.serverId}/logs`)) as
    | string
    | { logs?: string; data?: string };
  const raw =
    typeof data === "string" ? data : (data.logs ?? data.data ?? JSON.stringify(data, null, 2));
  return { demo: false, lines: toLines(raw) };
}

export async function sendServerCommand(command: string): Promise<{ demo: boolean; output: string }> {
  const cfg = getFalixConfig();
  if (!cfg) {
    logAction("warn", `Comando simulato (chiave Falix mancante): ${command}`);
    return { demo: true, output: `[demo] comando "${command}" non inviato: chiave Falix mancante.` };
  }
  await falixFetch(cfg, `/servers/${cfg.serverId}/command`, {
    method: "POST",
    body: { command },
  });
  logAction("info", `Comando inviato al server: ${command}`);
  return { demo: false, output: `Comando inviato: ${command}` };
}
