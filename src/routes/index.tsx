import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Cpu,
  HardDrive,
  LogOut,
  Power,
  Users,
} from "lucide-react";

import { getDashboard, logout } from "@/lib/auth.functions";
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

function Dashboard() {
  const stats = Route.useLoaderData() as ServerStats;
  const router = useRouter();
  const doLogout = useServerFn(logout);

  async function onLogout() {
    await doLogout({});
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  const ramPct = Math.round((stats.ram.used / stats.ram.total) * 100);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
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

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {stats.demo ? (
          <div className="panel flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-muted-foreground">
              Dati dimostrativi. Appena mi passi la <span className="text-primary">chiave API
              Falix</span> collego stato reale, log, console e performance del server.
            </p>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Giocatori"
            value={`${stats.players.online}/${stats.players.max}`}
            detail={stats.players.names.join(", ")}
          />
          <StatCard
            icon={<HardDrive className="h-4 w-4" />}
            label="RAM"
            value={`${stats.ram.used} / ${stats.ram.total} GB`}
            detail={`${ramPct}% utilizzata`}
            progress={ramPct}
          />
          <StatCard
            icon={<Cpu className="h-4 w-4" />}
            label="CPU"
            value={`${stats.cpu}%`}
            detail={`uptime ${stats.uptime}`}
            progress={stats.cpu}
          />
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="TPS"
            value={stats.tps.toFixed(1)}
            detail={stats.version}
            progress={(stats.tps / 20) * 100}
          />
        </section>

        <section className="panel p-4 sm:p-6">
          <h2 className="mb-4 text-sm uppercase tracking-[0.25em] text-primary">
            TPS ultime 24 ore
          </h2>
          <div className="flex h-32 items-end gap-1">
            {stats.history.map((point) => (
              <div key={point.t} className="group flex-1" title={`${point.t} — ${point.tps} TPS`}>
                <div
                  className="w-full rounded-sm bg-primary-dim transition-colors group-hover:bg-primary"
                  style={{ height: `${Math.max(6, (point.tps / 20) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
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
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  progress?: number;
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
            className="h-full rounded-full bg-primary"
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
