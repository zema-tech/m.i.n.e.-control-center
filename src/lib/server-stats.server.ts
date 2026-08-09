import type { ActionLog } from "./auth.server";

export type ServerStats = {
  status: "online" | "offline";
  players: { online: number; max: number; names: string[] };
  ram: { used: number; total: number };
  cpu: number;
  tps: number;
  uptime: string;
  version: string;
  history: { t: string; tps: number; ram: number }[];
  demo: boolean;
  log: ActionLog[];
};

function jitter(base: number, spread: number) {
  return Math.round((base + (Math.random() - 0.5) * spread) * 10) / 10;
}

export function buildDemoStats(log: ActionLog[]): ServerStats {
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
    history,
    log,
  };
}
