import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  HardDrive,
  LogOut,
  Play,
  Power,
  RefreshCw,
  Square,
  Users,
} from "lucide-react";

import { NeuralGraph, type GraphNode } from "@/components/NeuralGraph";
import { getDashboard, logout } from "@/lib/auth.functions";
import { powerAction } from "@/lib/panel.functions";
import type { ServerStats } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "M.I.N.E — Pannello server Minecraft con IA" },
      {
        name: "description",
        content:
          "M.I.N.E: dashboard in tempo reale del tuo server Minecraft su Falix con stato, giocatori, RAM, CPU e TPS.",
      },
      { property: "og:title", content: "M.I.N.E — Pannello server Minecraft con IA" },
      {
        property: "og:description",
        content: "Dashboard cyberpunk per monitorare e gestire il tuo server Minecraft su Falix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const res = await getDashboard();
    if (!res.authenticated || !res.stats) throw redirect({ to: "/login" });
    return res.stats;
  },
  component: Dashboard,
});

function barColor(pct: number | null) {
  if (pct === null) return "bg-muted-foreground";
  if (pct < 60) return "bg-primary";
  if (pct < 85) return "bg-warning";
  return "bg-destructive";
}

function tpsColor(tps: number | null) {
  if (tps === null) return "bg-muted-foreground";
  if (tps >= 18) return "bg-primary";
  if (tps >= 15) return "bg-warning";
  return "bg-destructive";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function Dashboard() {
  const stats = Route.useLoaderData() as ServerStats;
  const router = useRouter();
  const doLogout = useServerFn(logout);
  const doPower = useServerFn(powerAction);

  const [busy, setBusy] = useState<null | "start" | "stop">(null);
  const [powerMsg, setPowerMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void router.invalidate();
    }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, router]);

  async function onLogout() {
    await doLogout({});
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  async function onPower(signal: "start" | "stop") {
    setBusy(signal);
    setPowerMsg(null);
    try {
      const res = await doPower({ data: { signal } });
      setPowerMsg(res.output);
      await router.invalidate();
      for (const delay of [5000, 10000, 20000]) {
        setTimeout(() => void router.invalidate(), delay);
      }
    } catch (error) {
      setPowerMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const ramPct =
    stats.ram.used !== null && stats.ram.total
      ? Math.round((stats.ram.used / stats.ram.total) * 100)
      : null;
  const nd = (v: number | string | null, suffix = "") => (v === null ? "n/d" : `${v}${suffix}`);

  const graphNodes: GraphNode[] = useMemo(() => {
    const list: GraphNode[] = [
      {
        id: "server",
        label: "Minecraft",
        kind: "server",
        status: stats.status === "online" ? "online" : "offline",
        detail: `${stats.version ?? "n/d"} · ${stats.uptime ?? "uptime n/d"}`,
      },
    ];
    for (const name of stats.players.names) {
      list.push({
        id: `player:${name}`,
        label: name,
        kind: "player",
        status: "online",
        detail: "Giocatore online",
      });
    }
    // Mondi tipici (non sempre esposti dall'API)
    for (const world of ["world", "world_nether", "world_the_end"]) {
      list.push({
        id: `world:${world}`,
        label: world,
        kind: "world",
        status: stats.status === "online" ? "online" : "offline",
        detail: "Mondo del server",
      });
    }
    return list;
  }, [stats]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-glow text-xl font-bold text-primary sm:text-2xl">M.I.N.E</h1>
            <span className="hidden text-[11px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
              intelligent network engine
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/assistant"
              className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              ia + console
            </Link>
            <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-primary">
              <Power className="h-3.5 w-3.5" />
              {stats.status === "online" ? "online" : "offline"}
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <LogOut className="h-3.5 w-3.5" /> esci
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-0 lg:gap-6">
        {/* Sidebar stats sinistra */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-background/60 p-4 lg:block">
          <h2 className="mb-4 text-[11px] uppercase tracking-[0.25em] text-primary">Live</h2>

          <div className="mb-5">
            <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Users className="h-3 w-3 text-primary" /> giocatori
            </p>
            {stats.players.names.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nessuno online</p>
            ) : (
              <ul className="space-y-2">
                {stats.players.names.map((name) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-[10px] font-bold text-primary">
                      {initials(name)}
                    </span>
                    <span className="truncate text-xs text-foreground">{name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-4">
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" /> cpu
              </span>
              <span>{nd(stats.cpu, "%")}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${barColor(stats.cpu)}`}
                style={{ width: `${Math.min(100, Math.max(0, stats.cpu ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" /> ram
              </span>
              <span>{ramPct === null ? "n/d" : `${ramPct}%`}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${barColor(ramPct)}`}
                style={{ width: `${Math.min(100, Math.max(0, ramPct ?? 0))}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {nd(stats.ram.used)} / {nd(stats.ram.total)} GB
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> tps
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${tpsColor(stats.tps)}`} />
                {stats.tps === null ? "n/d" : stats.tps.toFixed(1)}
              </span>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          <section className="panel flex flex-wrap items-center gap-3 p-4">
            <button
              onClick={() => void onPower("start")}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> {busy === "start" ? "avvio…" : "avvia server"}
            </button>
            <button
              onClick={() => void onPower("stop")}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-xs uppercase tracking-widest text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5" /> {busy === "stop" ? "arresto…" : "spegni server"}
            </button>
            <button
              onClick={() => void router.invalidate()}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" /> aggiorna
            </button>
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-primary"
              />
              auto 10s
            </label>
            {powerMsg ? (
              <p className="w-full font-mono text-xs text-muted-foreground">{powerMsg}</p>
            ) : null}
          </section>

          {stats.demo || stats.note ? (
            <div className="panel flex items-start gap-3 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-muted-foreground">
                {stats.demo ? (
                  <>
                    <span className="text-primary">Dati dimostrativi.</span>{" "}
                    {stats.note ??
                      "Stato reale non disponibile: verifica la configurazione Falix."}
                  </>
                ) : (
                  <>
                    <span className="text-primary">
                      Sorgente: {stats.source === "falix" ? "API Falix" : "query server Minecraft"}.
                    </span>{" "}
                    {stats.note}
                  </>
                )}
              </p>
            </div>
          ) : null}

          {/* Grafo neurale */}
          <section className="panel p-4 sm:p-6">
            <h2 className="mb-3 text-sm uppercase tracking-[0.25em] text-primary">
              Rete neurale server
            </h2>
            <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
              <NeuralGraph nodes={graphNodes} onSelect={setSelectedNode} />
              <div className="rounded-md border border-border bg-background/40 p-3 text-xs">
                <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Dettaglio nodo
                </p>
                {selectedNode ? (
                  <div className="space-y-1">
                    <p className="font-display text-sm text-primary">{selectedNode.label}</p>
                    <p className="text-muted-foreground">tipo: {selectedNode.kind}</p>
                    <p className="text-muted-foreground">stato: {selectedNode.status}</p>
                    {selectedNode.detail ? (
                      <p className="text-muted-foreground">{selectedNode.detail}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Clicca un nodo per i dettagli.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Giocatori"
              value={`${nd(stats.players.online)}/${nd(stats.players.max)}`}
              detail={stats.players.names.join(", ") || undefined}
            />
            <StatCard
              icon={<HardDrive className="h-4 w-4" />}
              label="RAM"
              value={`${nd(stats.ram.used)} / ${nd(stats.ram.total)} GB`}
              detail={ramPct === null ? "non disponibile" : `${ramPct}% utilizzata`}
              progress={ramPct ?? undefined}
              progressClass={barColor(ramPct)}
            />
            <StatCard
              icon={<Cpu className="h-4 w-4" />}
              label="CPU"
              value={nd(stats.cpu, "%")}
              detail={`uptime ${nd(stats.uptime)}`}
              progress={stats.cpu ?? undefined}
              progressClass={barColor(stats.cpu)}
            />
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="TPS"
              value={stats.tps === null ? "n/d" : stats.tps.toFixed(1)}
              detail={stats.version ?? undefined}
              progress={stats.tps === null ? undefined : (stats.tps / 20) * 100}
              progressClass={tpsColor(stats.tps)}
            />
          </section>

          <section className="panel p-4 sm:p-6">
            <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-primary">
              Andamento TPS
            </h2>
            {stats.history.some((p) => p.tps !== null) ? (
              <>
                <div className="flex h-32 items-end gap-1">
                  {stats.history.map((point, i) => (
                    <div
                      key={`${point.t}-${i}`}
                      className="group flex-1"
                      title={`${point.t} — ${point.tps ?? "n/d"} TPS`}
                    >
                      <div
                        className="w-full rounded-sm bg-primary-dim transition-colors group-hover:bg-primary"
                        style={{ height: `${Math.max(6, ((point.tps ?? 0) / 20) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{stats.history[0]?.t}</span>
                  <span>{stats.history[stats.history.length - 1]?.t}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                TPS non disponibili da questa sorgente: servono i dati del pannello Falix.
              </p>
            )}
          </section>

          <section className="panel p-4 sm:p-6">
            <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-primary">
              Registro azioni
            </h2>
            <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
              {stats.log.length === 0 ? (
                <p className="text-muted-foreground">Nessuna azione registrata.</p>
              ) : (
                stats.log.map((entry, i) => (
                  <p
                    key={`${entry.ts}-${i}`}
                    className={
                      entry.level === "error"
                        ? "text-destructive"
                        : entry.level === "warn"
                          ? "text-warning"
                          : "text-muted-foreground"
                    }
                  >
                    <span className="text-primary-dim">[{entry.ts.slice(11, 19)}]</span>{" "}
                    {entry.message}
                  </p>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  progress,
  progressClass = "bg-primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string | undefined;
  progress?: number | undefined;
  progressClass?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="text-glow mt-3 font-display text-2xl font-bold text-primary">{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${progressClass}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
      {detail ? (
        <p className="mt-2 truncate text-[11px] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
