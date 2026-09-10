import { assertPublicHttpsUrl } from "./ssrf-guard";
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

/** Credenziali opzionali da account utente (multi-account). Fallback su env. */
export type FalixCredentials = {
  key: string;
  serverId: string;
  base?: string;
};

export function getFalixConfig(override?: FalixCredentials | null): FalixConfig | null {
  const envBase = process.env["FALIX_API_BASE"] || "https://client.falixnodes.net/api/v2";
  // VibeSec: Server ID solo in path URL → charset stretto (niente / ? # &).
  const sidOk = (s: string) => /^[A-Za-z0-9._~-]{1,120}$/.test(s);
  if (override?.key && override?.serverId) {
    // base da input utente: solo https pubblico (anti-SSRF verso metadata/LAN).
    // La base da env resta configurazione trusted dell'admin.
    let base = envBase;
    if (override.base?.trim()) {
      base = assertPublicHttpsUrl(override.base.trim(), "Base URL");
    }
    if (!sidOk(override.serverId.trim())) {
      throw new Error("Server ID non valido.");
    }
    return {
      key: override.key,
      serverId: override.serverId.trim(),
      base,
    };
  }
  const key = process.env["FALIX_API_KEY"];
  const serverId = process.env["FALIX_SERVER_ID"];
  if (!key || !serverId) return null;
  if (!sidOk(serverId.trim())) {
    throw new Error("FALIX_SERVER_ID non valido.");
  }
  return {
    key,
    serverId: serverId.trim(),
    base: envBase,
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
    signal: AbortSignal.timeout(15_000),
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    // Dettagli upstream solo nei log server: al client torna solo lo status.
    console.error(`[falix] ${res.status} su ${path}: ${text.slice(0, 300)}`);
    throw new Error(`Falix ${res.status}`);
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

export async function fetchServerLogs(
  override?: FalixCredentials | null,
): Promise<{ demo: boolean; lines: LogLine[] }> {
  const cfg = getFalixConfig(override);
  if (!cfg) return { demo: true, lines: toLines(DEMO_LOG) };
  const data = (await falixFetch(
    cfg,
    `/servers/${cfg.serverId}/files/content?path=${encodeURIComponent("/logs/latest.log")}`,
  )) as string | { content?: string; logs?: string; data?: string };
  const raw =
    typeof data === "string"
      ? data
      : (data.content ?? data.logs ?? data.data ?? JSON.stringify(data, null, 2));
  return { demo: false, lines: toLines(raw) };
}

export async function sendServerCommand(
  command: string,
  override?: FalixCredentials | null,
): Promise<{ demo: boolean; output: string }> {
  const cfg = getFalixConfig(override);
  if (!cfg) {
    logAction("warn", "Comando simulato (chiave Falix mancante)");
    return {
      demo: true,
      output: `[demo] comando "${command}" non inviato: chiave Falix mancante.`,
    };
  }
  await falixFetch(cfg, `/servers/${cfg.serverId}/commands`, {
    method: "POST",
    body: { command },
  });
  // Il comando può contenere segreti (es. "login <password>"): nei log solo metadati.
  logAction("info", `Comando inviato al server (${command.length} char)`);
  return { demo: false, output: `Comando inviato: ${command}` };
}

export type PowerSignal = "start" | "stop" | "restart";

export async function sendPowerAction(
  signal: PowerSignal,
  override?: FalixCredentials | null,
): Promise<{ demo: boolean; output: string }> {
  const cfg = getFalixConfig(override);
  const label = signal === "start" ? "avvio" : signal === "stop" ? "spegnimento" : "riavvio";
  if (!cfg) {
    logAction("warn", `Azione ${label} simulata (chiave Falix mancante)`);
    return { demo: true, output: `[demo] ${label} non inviato: chiave Falix mancante.` };
  }

  const attempts: { path: string; body: unknown }[] = [
    { path: `/servers/${cfg.serverId}/console/power`, body: { action: signal } },
    { path: `/servers/${cfg.serverId}/power`, body: { signal } },
    { path: `/servers/${cfg.serverId}/console/actions`, body: { action: signal } },
    { path: `/servers/${cfg.serverId}/power`, body: { action: signal } },
    { path: `/servers/${cfg.serverId}/${signal}`, body: {} },
  ];

  let lastError = "";
  for (const attempt of attempts) {
    try {
      await falixFetch(cfg, attempt.path, { method: "POST", body: attempt.body });
      logAction("info", `Richiesta di ${label} inviata (${attempt.path})`);
      return { demo: false, output: `Richiesta di ${label} inviata al server.` };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || `Impossibile inviare la richiesta di ${label}.`);
}

/** Path file Falix sanificato: niente traversal (anche encoded), null byte, o percorsi vuoti. */
function safeFalixPath(p: string, actionId: string): string {
  if (p.includes("\0")) throw new Error(`Parametro non consentito per l'azione ${actionId}`);
  // VibeSec: decodifica prima di validare (blocca %2e%2e, %2f, doppi encoding).
  let decoded = p;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  const normalized = decoded.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((s) => s === ".." || s === ".")) {
    throw new Error(`Path non consentito per l'azione ${actionId}`);
  }
  const clean = p.trim().slice(0, 300);
  if (!clean) throw new Error(`Parametro mancante per l'azione ${actionId}`);
  return clean;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function playersFromFalix(cfg: FalixConfig) {
  try {
    const data = (await falixFetch(cfg, `/servers/${cfg.serverId}/players`)) as
      Record<string, unknown> | unknown[];
    const raw = (Array.isArray(data) ? { list: data } : data) as Record<string, unknown>;
    const list = (raw["list"] ?? raw["players"] ?? raw["online_players"] ?? []) as unknown[];
    const names = Array.isArray(list)
      ? list
          .map((p) =>
            typeof p === "string" ? p : String((p as Record<string, unknown>)?.["name"] ?? ""),
          )
          .filter(Boolean)
          .slice(0, 20)
      : [];
    return {
      online: num(raw["online"]) ?? (names.length > 0 ? names.length : null),
      max: num(raw["max"]) ?? num(raw["max_players"]),
      names,
    };
  } catch {
    return { online: null, max: null, names: [] as string[] };
  }
}

async function statusFromFalix(cfg: FalixConfig): Promise<LiveStatus> {
  const data = (await falixFetch(cfg, `/servers/${cfg.serverId}/console/status`)) as Record<
    string,
    unknown
  >;
  const raw = (data["attributes"] ?? data["data"] ?? data) as Record<string, unknown>;
  const resources = (raw["resources"] ?? raw["stats"] ?? {}) as Record<string, unknown>;
  const state = String(raw["state"] ?? raw["status"] ?? "").toLowerCase();

  const ramUsedMb = num(resources["memory_bytes"])
    ? Math.round((num(resources["memory_bytes"]) as number) / 1024 / 1024)
    : num(resources["memory"]);
  const ramTotalMb = num(resources["memory_limit_bytes"])
    ? Math.round((num(resources["memory_limit_bytes"]) as number) / 1024 / 1024)
    : num(resources["memory_limit"]);

  const players = await playersFromFalix(cfg);

  return {
    source: "falix",
    note: null,
    status: state.includes("running") || state.includes("online") ? "online" : "offline",
    players,
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

async function statusFromMcStatus(address: string): Promise<LiveStatus> {
  const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Query Minecraft ${res.status}`);
  const data = (await res.json()) as {
    online?: boolean;
    version?: { name_clean?: string };
    players?: { online?: number; max?: number; list?: { name_clean?: string }[] };
  };
  return {
    source: "mcstatus",
    note: "Stato reale via query pubblica del server. RAM, CPU e TPS richiedono l'API del pannello.",
    status: data.online ? "online" : "offline",
    players: {
      online: num(data.players?.online),
      max: num(data.players?.max),
      names: (data.players?.list ?? [])
        .map((p) => p.name_clean ?? "")
        .filter(Boolean)
        .slice(0, 20),
    },
    ram: { used: null, total: null },
    cpu: null,
    tps: null,
    uptime: null,
    version: data.version?.name_clean ?? null,
  };
}

export async function fetchLiveStatus(override?: FalixCredentials | null): Promise<LiveStatus> {
  const cfg = getFalixConfig(override);
  const address = process.env["MC_SERVER_ADDRESS"];
  const problems: string[] = [];

  if (cfg) {
    try {
      return await statusFromFalix(cfg);
    } catch (error) {
      problems.push(
        `API Falix non raggiungibile (${error instanceof Error ? error.message : "errore"})`,
      );
    }
  } else {
    problems.push("chiave Falix mancante (env o account)");
  }

  if (address) {
    try {
      const live = await statusFromMcStatus(address);
      return { ...live, note: `${problems.join("; ")}. ${live.note ?? ""}`.trim() };
    } catch (error) {
      problems.push(
        `query pubblica fallita (${error instanceof Error ? error.message : "errore"})`,
      );
    }
  } else {
    problems.push("indirizzo pubblico del server non configurato (MC_SERVER_ADDRESS)");
  }

  throw new Error(problems.join("; "));
}

export async function executeFalixAction(
  id: string,
  params: Record<string, string | number | boolean>,
  override?: FalixCredentials | null,
): Promise<{ demo: boolean; output: string }> {
  const { getAction } = await import("./falix-actions");
  const def = getAction(id);
  if (!def) throw new Error(`Azione sconosciuta: ${id}`);

  const cfg = getFalixConfig(override);
  if (!cfg) {
    logAction("warn", `Azione "${id}" simulata (chiave Falix mancante)`);
    return { demo: true, output: `[demo] azione "${id}" non inviata: chiave Falix mancante.` };
  }

  const path = def.path.replace(/\{(\w+)\}/g, (_m, key: string) => {
    if (key === "id") return encodeURIComponent(cfg.serverId);
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Parametro mancante per l'azione ${id}: ${key}`);
    }
    return encodeURIComponent(safeFalixPath(String(value), id));
  });

  // Whitelist stretta: solo i campi dichiarati in def.body (niente mass-assignment
  // di chiavi extra verso l'API Falix).
  let body: Record<string, string | number | boolean> | undefined;
  if (def.method !== "GET") {
    body = {};
    for (const key of def.body ?? []) {
      if (params[key] !== undefined) body[key] = params[key];
    }
    if (id.startsWith("power.")) body["signal"] = id.slice("power.".length);
  }

  const data = await falixFetch(cfg, path, {
    method: def.method,
    ...(body ? { body } : {}),
  });

  logAction(def.risk === "read" ? "info" : "warn", `Azione Falix "${id}" eseguita (${def.scope})`);
  const output = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { demo: false, output: output.slice(0, 4000) };
}

/** Test connessione account (senza loggare la key). */
export async function testFalixConnection(
  override: FalixCredentials,
): Promise<{ ok: boolean; message: string }> {
  const cfg = getFalixConfig(override);
  if (!cfg) return { ok: false, message: "Credenziali incomplete" };
  try {
    await falixFetch(cfg, `/servers/${cfg.serverId}/console/status`);
    return { ok: true, message: "Connessione Falix OK" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
