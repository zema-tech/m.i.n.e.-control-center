import type { ActionLogEntry, ServerStats } from "./types";
import type { LiveStatus } from "./falix.server";

function jitter(base: number, spread: number) {
  return Math.round((base + (Math.random() - 0.5) * spread) * 10) / 10;
}

type Sample = { t: string; tps: number | null; ram: number | null };
const samples: Sample[] = [];

export function recordSample(tps: number | null, ram: number | null) {
  const now = new Date();
  samples.push({
    t: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    tps,
    ram,
  });
  if (samples.length > 48) samples.shift();
}

export function getHistory(): Sample[] {
  return samples.slice();
}

export function buildStats(live: LiveStatus, log: ActionLogEntry[]): ServerStats {
  recordSample(live.tps, live.ram.used);
  return {
    status: live.status,
    players: live.players,
    ram: live.ram,
    cpu: live.cpu,
    tps: live.tps,
    uptime: live.uptime,
    version: live.version,
    history: getHistory(),
    demo: live.source === "demo",
    source: live.source,
    note: live.note,
    log,
  };
}

export function buildDemoStats(log: ActionLogEntry[], note?: string): ServerStats {
  const history = Array.from({ length: 24 }, (_, i) => ({
    t: `${String(i).padStart(2, "0")}:00`,
    tps: Math.min(20, jitter(19.2, 1.6)),
    ram: jitter(3.1, 1.2),
  }));

  return {
    status: "online",
    players: { online: 4, max: 20, names: ["Steve", "Alex", "Herobrine", "Notch"] },
    ram: { used: 3.2, total: 6 },
    cpu: 41,
    tps: 19.8,
    uptime: "2g 14h 06m",
    version: "Paper 1.21.4",
    demo: true,
    source: "demo",
    note: note ?? null,
    history,
    log,
  };
}
