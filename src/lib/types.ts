export type ActionLogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
};

export type StatsSource = "falix" | "mcstatus" | "demo";

export type ServerStats = {
  status: "online" | "offline";
  players: { online: number | null; max: number | null; names: string[] };
  ram: { used: number | null; total: number | null };
  cpu: number | null;
  tps: number | null;
  uptime: string | null;
  version: string | null;
  history: { t: string; tps: number | null; ram: number | null }[];
  demo: boolean;
  source: StatsSource;
  note: string | null;
  log: ActionLogEntry[];
};
