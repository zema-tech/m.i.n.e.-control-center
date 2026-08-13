import { logAction } from "./auth.server";

export type FalixConfig = { key: string; serverId: string; base: string };

export type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };

export type LiveStatus = {
  source: "falix" | "mcstatus" | "demo";
  note: string | null;
  status: "online" | "offline";
  /** Stato grezzo Falix: offline | starting | running | stopping | storage | ... */
  state: string | null;
  players: { online: number | null; max: number | null; names: string[] };
  ram: { used: number | null; total: number | null };
  cpu: number | null;
  tps: number | null;
  uptime: string | null;
  version: string | null;
  address: string | null;
};

export function getFalixConfig(): FalixConfig | null {
  const key = process.env["FALIX_API_KEY"];
  const serverId = process.env["FALIX_SERVER_ID"];
  if (!key || !serverId) return null;
  return {
    key,
    serverId,
    base: process.env["FALIX_API_BASE"] ?? "https://client.falixnodes.net/api/v2",
  };
}

/** Errore API Falix con codice normalizzato (vedi /profile/apidocs → error-codes). */
export class FalixError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ERROR_IT: Record<string, string> = {
  server_storage_mode:
    "Il server è in modalità storage (spento sul nodo): avvialo dalla console per usare questa funzione.",
  not_found: "Endpoint non disponibile nell'API Falix v2.",
  forbidden: "La chiave API non ha lo scope necessario per questa operazione.",
  unauthorized: "Chiave API Falix non valida o scaduta.",
  method_not_allowed: "Metodo HTTP non supportato da questo endpoint.",
  rate_limited: "Troppe richieste all'API Falix: riprova tra poco.",
  bad_request: "Richiesta non valida per l'API Falix.",
};

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
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* risposta non JSON */
  }

  if (!res.ok) {
    const err = (parsed as { error?: { code?: string; message?: string } })?.error;
    const code = err?.code ?? `http_${res.status}`;
    const detail = err?.message ?? text.slice(0, 200);
    const it = ERROR_IT[code];
    throw new FalixError(res.status, code, it ? `${it} (${detail})` : `Falix ${res.status}: ${detail}`);
  }

  // L'API v2 incapsula sempre il payload in "data".
  if (parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>)) {
    return parsed;
  }
  return parsed;
}

function unwrap(payload: unknown): Record<string, unknown> {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = root["data"];
  return (data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : root) as Record<string, unknown>;
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

/**
 * Log del server: l'API v2 non ha /logs, si legge il file
 * GET /servers/{id}/files/content?path=/logs/latest.log
 */
export async function fetchServerLogs(): Promise<{ demo: boolean; lines: LogLine[] }> {
  const cfg = getFalixConfig();
  if (!cfg) return { demo: true, lines: toLines(DEMO_LOG) };
  const payload = await falixFetch(
    cfg,
    `/servers/${cfg.serverId}/files/content?path=${encodeURIComponent("/logs/latest.log")}`,
  );
  const data = typeof payload === "string" ? payload : unwrap(payload);
  const raw =
    typeof data === "string"
      ? data
      : ((data["content"] ?? data["contents"] ?? data["text"]) as string | undefined) ??
        JSON.stringify(data, null, 2);
  return { demo: false, lines: toLines(raw) };
}

export async function sendServerCommand(command: string): Promise<{ demo: boolean; output: string }> {
  const cfg = getFalixConfig();
  if (!cfg) {
    logAction("warn", `Comando simulato (chiave Falix mancante): ${command}`);
    return { demo: true, output: `[demo] comando "${command}" non inviato: chiave Falix mancante.` };
  }
  await falixFetch(cfg, `/servers/${cfg.serverId}/commands`, {
    method: "POST",
    body: { command },
  });
  logAction("info", `Comando inviato al server: ${command}`);
  return { demo: false, output: `Comando inviato: ${command}` };
}

/* -------------------------------------------------------------------------- */
/* Accensione / spegnimento                                                    */
/* -------------------------------------------------------------------------- */

/** Segnali validi confermati dall'API: start, stop, restart, kill. */
export type PowerSignal = "start" | "stop" | "restart" | "kill";

const POWER_LABEL: Record<PowerSignal, string> = {
  start: "avvio",
  stop: "spegnimento",
  restart: "riavvio",
  kill: "arresto forzato",
};

export async function sendPowerAction(
  signal: PowerSignal,
): Promise<{ demo: boolean; output: string }> {
  const cfg = getFalixConfig();
  const label = POWER_LABEL[signal];
  if (!cfg) {
    logAction("warn", `Azione ${label} simulata (chiave Falix mancante)`);
    return { demo: true, output: `[demo] ${label} non inviato: chiave Falix mancante.` };
  }

  await falixFetch(cfg, `/servers/${cfg.serverId}/power`, {
    method: "POST",
    body: { signal },
  });
  logAction("info", `Richiesta di ${label} inviata al server`);
  return { demo: false, output: `Richiesta di ${label} inviata al server.` };
}

/* -------------------------------------------------------------------------- */
/* Stato live                                                                  */
/* -------------------------------------------------------------------------- */

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** GET /servers/{id}/players → { data: [...], online_players, world } */
async function playersFromFalix(cfg: FalixConfig) {
  try {
    const payload = (await falixFetch(cfg, `/servers/${cfg.serverId}/players`)) as Record<
      string,
      unknown
    >;
    const list = Array.isArray(payload["data"]) ? (payload["data"] as unknown[]) : [];
    const names = list
      .map((p) =>
        typeof p === "string" ? p : String((p as Record<string, unknown>)?.["name"] ?? (p as Record<string, unknown>)?.["username"] ?? ""),
      )
      .filter(Boolean)
      .slice(0, 20);
    const pagination = (payload["pagination"] ?? {}) as Record<string, unknown>;
    return {
      online: num(payload["online_players"]) ?? num(pagination["total"]) ?? names.length,
      max: num(payload["max_players"]),
      names,
    };
  } catch {
    return { online: null, max: null, names: [] as string[] };
  }
}

/** GET /servers/{id} → limiti, software/versione. */
async function infoFromFalix(cfg: FalixConfig) {
  try {
    const data = unwrap(await falixFetch(cfg, `/servers/${cfg.serverId}`));
    const limits = (data["limits"] ?? {}) as Record<string, unknown>;
    const software = (data["software"] ?? {}) as Record<string, unknown>;
    const allocation = (data["allocation"] ?? {}) as Record<string, unknown>;
    const host = String(allocation["hostname"] ?? allocation["ip"] ?? "");
    const port = num(allocation["port"]);
    const memoryMib = num(limits["memory_mib"]);
    return {
      ramTotal: memoryMib === null ? null : Math.round((memoryMib / 1024) * 10) / 10,
      cpuLimit: num(limits["cpu_percent"]),
      version:
        software["name"] || software["version"]
          ? `${String(software["name"] ?? "").replace(/_/g, " ")} ${String(software["version"] ?? "")}`.trim()
          : null,
      address: host && port ? `${host}:${port}` : null,
    };
  } catch {
    return { ramTotal: null, cpuLimit: null, version: null, address: null };
  }
}

/** GET /servers/{id}/subdomains → hostname pubblico (fallback per la query MC). */
async function addressFromFalix(cfg: FalixConfig): Promise<string | null> {
  try {
    const payload = (await falixFetch(cfg, `/servers/${cfg.serverId}/subdomains`)) as Record<
      string,
      unknown
    >;
    const list = Array.isArray(payload["data"]) ? (payload["data"] as Record<string, unknown>[]) : [];
    const primary = list.find((s) => s["is_primary"] === true) ?? list[0];
    const hostname = primary ? String(primary["hostname"] ?? "") : "";
    return hostname || null;
  } catch {
    return null;
  }
}

/** GET /servers/{id}/console/status → { status, message, is_storage_node, resources? } */
async function statusFromFalix(cfg: FalixConfig): Promise<LiveStatus> {
  const data = unwrap(await falixFetch(cfg, `/servers/${cfg.serverId}/console/status`));
  const resources = (data["resources"] ?? data["stats"] ?? {}) as Record<string, unknown>;
  const state = String(data["status"] ?? data["state"] ?? "").toLowerCase();

  const ramUsedMb = num(resources["memory_bytes"])
    ? Math.round((num(resources["memory_bytes"]) as number) / 1024 / 1024)
    : num(resources["memory"]);
  const ramTotalMb = num(resources["memory_limit_bytes"])
    ? Math.round((num(resources["memory_limit_bytes"]) as number) / 1024 / 1024)
    : num(resources["memory_limit"]);

  const [players, info, subdomain] = await Promise.all([
    playersFromFalix(cfg),
    infoFromFalix(cfg),
    addressFromFalix(cfg),
  ]);

  const online = state === "running" || state === "online";
  const notes: string[] = [];
  if (typeof data["message"] === "string" && data["message"]) notes.push(String(data["message"]));
  if (state === "storage") notes.push(ERROR_IT["server_storage_mode"] as string);
  if (!online) notes.push("RAM, CPU e TPS sono disponibili solo con il server avviato.");

  const uptimeMs = num(resources["uptime"]);

  return {
    source: "falix",
    note: notes.length ? notes.join(" ") : null,
    status: online ? "online" : "offline",
    state: state || null,
    players,
    ram: {
      used: ramUsedMb === null ? null : Math.round((ramUsedMb / 1024) * 10) / 10,
      total: ramTotalMb === null ? null : Math.round((ramTotalMb / 1024) * 10) / 10,
    },
    cpu: num(resources["cpu_absolute"]) ?? num(resources["cpu"]),
    tps: num(data["tps"]),
    uptime:
      typeof data["uptime"] === "string"
        ? (data["uptime"] as string)
        : uptimeMs !== null
          ? `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`
          : null,
    version: info.version,
    address: info.address ?? subdomain,
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
    state: data.online ? "running" : "offline",
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
    address,
  };
}

export async function fetchLiveStatus(): Promise<LiveStatus> {
  const cfg = getFalixConfig();
  const address = process.env["MC_SERVER_ADDRESS"];
  const problems: string[] = [];

  if (cfg) {
    try {
      const live = await statusFromFalix(cfg);
      // Se il pannello non espone RAM/CPU (server spento o storage), integra la query pubblica.
      if (live.status === "offline" && (address || live.address)) {
        try {
          const mc = await statusFromMcStatus((address ?? live.address) as string);
          if (mc.status === "online") {
            return {
              ...mc,
              state: live.state,
              note: `${live.note ?? ""} ${mc.note ?? ""}`.trim() || null,
            };
          }
        } catch {
          /* fallback silenzioso */
        }
      }
      return live;
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

/* -------------------------------------------------------------------------- */
/* Esecuzione generica di azioni Falix (catalogo scope)                        */
/* -------------------------------------------------------------------------- */

export async function executeFalixAction(
  id: string,
  params: Record<string, string | number | boolean>,
): Promise<{ demo: boolean; output: string }> {
  const { getAction } = await import("./falix-actions");
  const def = getAction(id);
  if (!def) throw new Error(`Azione sconosciuta: ${id}`);

  const cfg = getFalixConfig();
  if (!cfg) {
    logAction("warn", `Azione "${id}" simulata (chiave Falix mancante)`);
    return { demo: true, output: `[demo] azione "${id}" non inviata: chiave Falix mancante.` };
  }

  const used = new Set<string>();
  const path = def.path.replace(/\{(\w+)\}/g, (_m, key: string) => {
    if (key === "id") return encodeURIComponent(cfg.serverId);
    used.add(key);
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Parametro mancante per l'azione ${id}: ${key}`);
    }
    return encodeURIComponent(String(value));
  });

  let body: Record<string, string | number | boolean> | undefined;
  if (def.method !== "GET") {
    body = {};
    for (const key of def.body ?? []) {
      if (params[key] !== undefined) body[key] = params[key];
    }
    if (id.startsWith("power.")) body["signal"] = id.slice("power.".length);
    for (const [key, value] of Object.entries(params)) {
      if (!used.has(key) && body[key] === undefined) body[key] = value;
    }
  }

  const data = await falixFetch(cfg, path, {
    method: def.method,
    ...(body ? { body } : {}),
  });

  logAction(def.risk === "read" ? "info" : "warn", `Azione Falix "${id}" eseguita (${def.scope})`);
  const output = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { demo: false, output: output.slice(0, 4000) };
}
