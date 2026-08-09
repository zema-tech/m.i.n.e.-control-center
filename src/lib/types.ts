export type ActionLogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
};

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
  log: ActionLogEntry[];
};
