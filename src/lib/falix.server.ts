import { logAction } from "./auth.server";

export type FalixConfig = { key: string; serverId: string; base: string };

export type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };

export type LiveStatus = {
  source: "falix" | "mcstatus" | "demo";
  note: string | null;
  status: "online" | "offline";
  players: { online: number | null; max: number | null; names: string[] };
  ram: { used: number | null; total: number | null };
  cpu: number | null;
  tps: number | null;
  uptime: string | null;
  version: string | null;
};

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
    throw new Error(`Falix ${res.status}: ${text.slice(0, 200)}`);
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

/* -------------------------------------------------------------------------- */
/* Stato live                                                                  */
/* -------------------------------------------------------------------------- */

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Prova l'API Falix (percorso configurabile con FALIX_API_BASE). */
async function statusFromFalix(cfg: FalixConfig): Promise<LiveStatus> {
  const data = (await falixFetch(cfg, `/servers/${cfg.serverId}`)) as Record<string, unknown>;
  const raw = (data["attributes"] ?? data["data"] ?? data) as Record<string, unknown>;
  const resources = (raw["resources"] ?? raw["stats"] ?? {}) as Record<string, unknown>;
  const players = (raw["players"] ?? {}) as Record<string, unknown>;
  const state = String(raw["status"] ?? raw["state"] ?? "").toLowerCase();

  const ramUsedMb = num(resources["memory_bytes"])
    ? Math.round((num(resources["memory_bytes"]) as number) / 1024 / 1024)
    : num(resources["memory"]);
  const ramTotalMb = num(resources["memory_limit_bytes"])
    ? Math.round((num(resources["memory_limit_bytes"]) as number) / 1024 / 1024)
    : num(resources["memory_limit"]);

  return {
    source: "falix",
    note: null,
    status: state.includes("running") || state.includes("online") ? "online" : "offline",
    players: {
      online: num(players["online"]) ?? num(raw["players_online"]),
      max: num(players["max"]) ?? num(raw["players_max"]),
      names: Array.isArray(players["list"]) ? (players["list"] as string[]).slice(0, 20) : [],
    },
    ram: {
      used: ramUsedMb === null ? null : Math.round((ramUsedMb / 1024) * 10) / 10,
      total: ramTotalMb === null ? null : Math.round((ramTotalMb / 1024) * 10) / 10,
    },
    cpu: num(resources["cpu_absolute"]) ?? num(resources["cpu"]),
    tps: num(raw["tps"]),
    uptime: typeof raw["uptime"] === "string" ? (raw["uptime"] as string) : null,
    version: typeof raw["version"] === "string" ? (raw["version"] as string) : null,
  };
}

/** Fallback pubblico: query diretta del server Minecraft (indirizzo pubblico). */
async function statusFromMcStatus(address: string): Promise<LiveStatus> {
  const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Query Minecraft ${res.status}`);
  const data = (await res.json()) as {
    online?: boolean;
    version?: { name_clean?: string };
    players?: { online?: number; max?: number; list?: { name_clean?: string }[] };
  };
  return {
    source: "mcstatus",
    note: "Stato reale via query pubblica del server. RAM, CPU e TPS richiedono l'API del pannello Falix.",
    status: data.online ? "online" : "offline",
    players: {
      online: num(data.players?.online),
      max: num(data.players?.max),
      names: (data.players?.list ?? []).map((p) => p.name_clean ?? "").filter(Boolean).slice(0, 20),
    },
    ram: { used: null, total: null },
    cpu: null,
    tps: null,
    uptime: null,
    version: data.version?.name_clean ?? null,
  };
}

export async function fetchLiveStatus(): Promise<LiveStatus> {
  const cfg = getFalixConfig();
  const address = process.env["MC_SERVER_ADDRESS"];
  const problems: string[] = [];

  if (cfg) {
    try {
      return await statusFromFalix(cfg);
    } catch (error) {
      problems.push(`API Falix non raggiungibile (${error instanceof Error ? error.message : "errore"})`);
    }
  } else {
    problems.push("chiave Falix mancante");
  }

  if (address) {
    try {
      const live = await statusFromMcStatus(address);
      return { ...live, note: `${problems.join("; ")}. ${live.note ?? ""}`.trim() };
    } catch (error) {
      problems.push(`query pubblica fallita (${error instanceof Error ? error.message : "errore"})`);
    }
  } else {
    problems.push("indirizzo pubblico del server non configurato (MC_SERVER_ADDRESS)");
  }

  throw new Error(problems.join("; "));
}
