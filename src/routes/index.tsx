import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cable,
  Cpu,
  HardDrive,
  LogOut,
  MessageSquare,
  Play,
  Plus,
  Power,
  RefreshCw,
  Server,
  Square,
  Star,
  Trash2,
  Users,
} from "lucide-react";

import { AccountsPanel } from "@/components/AccountsPanel";
import { NeuralGraph, type GraphNode } from "@/components/NeuralGraph";
import {
  credentialsPayload,
  getActiveFalixAccount,
  loadAccounts,
  type ApiAccount,
} from "@/lib/accounts";
import { getDashboard, logout } from "@/lib/auth.functions";
import {
  createThread,
  deleteThread,
  loadThreads,
  type ChatThread,
} from "@/lib/chats";
import {
  addConnector,
  CONNECTOR_KIND_OPTIONS,
  CONNECTOR_PRESETS,
  loadConnectors,
  removeConnector,
  type ConnectorKind,
  type CustomConnector,
} from "@/lib/connectors";
import {
  addHost,
  HOST_PROVIDERS,
  loadHosts,
  providerLabel,
  removeHost,
  setPrimaryHost,
  type HostProfile,
  type HostProviderId,
} from "@/lib/hosts";
import { powerAction } from "@/lib/panel.functions";
import type { ServerStats } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "M.I.N.E — Pannello server Minecraft con IA" },
      {
        name: "description",
        content:
          "M.I.N.E: multi-account con API key proprie, connettori e competenze per host Minecraft.",
      },
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
  const [, setSelectedNode] = useState<GraphNode | null>(null);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [hosts, setHosts] = useState<HostProfile[]>([]);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [showAddHost, setShowAddHost] = useState(false);
  const [connLabel, setConnLabel] = useState("");
  const [connKind, setConnKind] = useState<ConnectorKind>("storage");
  const [connDetail, setConnDetail] = useState("");
  const [hostLabel, setHostLabel] = useState("");
  const [hostProvider, setHostProvider] = useState<HostProviderId>("generic");
  const [hostAddress, setHostAddress] = useState("");
  const [hostNotes, setHostNotes] = useState("");

  useEffect(() => {
    setThreads(loadThreads());
    setConnectors(loadConnectors());
    setHosts(loadHosts());
    setAccounts(loadAccounts());
  }, []);

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
    const active = getActiveFalixAccount();
    const credentials = credentialsPayload(active);
    try {
      const res = await doPower({
        data: {
          signal,
          ...(credentials ? { credentials } : {}),
        },
      });
      setPowerMsg(active ? `${res.output} (account: ${active.label})` : res.output);
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

  function onNewChat() {
    const t = createThread();
    setThreads(loadThreads());
    void router.navigate({ to: "/assistant/$threadId", params: { threadId: t.id } });
  }

  function onDeleteChat(id: string) {
    setThreads(deleteThread(id));
  }

  function onAddConnector() {
    const label = connLabel.trim();
    if (!label) return;
    addConnector({ label, kind: connKind, detail: connDetail.trim() || undefined });
    setConnectors(loadConnectors());
    setConnLabel("");
    setConnDetail("");
    setShowAddConnector(false);
  }

  function onPresetConnector(presetId: string) {
    const p = CONNECTOR_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    addConnector({ label: p.label, kind: p.kind, detail: p.detail, preset: p.id });
    setConnectors(loadConnectors());
  }

  function onAddHost() {
    addHost({
      label: hostLabel.trim() || providerLabel(hostProvider),
      provider: hostProvider,
      address: hostAddress,
      notes: hostNotes,
      primary: hosts.length === 0,
    });
    setHosts(loadHosts());
    setHostLabel("");
    setHostAddress("");
    setHostNotes("");
    setShowAddHost(false);
  }

  const ramPct =
    stats.ram.used !== null && stats.ram.total
      ? Math.round((stats.ram.used / stats.ram.total) * 100)
      : null;
  const nd = (v: number | string | null, suffix = "") => (v === null ? "n/d" : `${v}${suffix}`);

  const graphNodes: GraphNode[] = useMemo(() => {
    const online = stats.status === "online";
    const list: GraphNode[] = [
      {
        id: "server",
        label: "Minecraft",
        kind: "server",
        status: online ? "online" : "offline",
        detail: `${stats.version ?? "n/d"} · uptime ${stats.uptime ?? "n/d"}`,
        size: 18,
      },
    ];
    for (const acc of accounts) {
      list.push({
        id: acc.id,
        label: acc.label,
        kind: "service",
        status: acc.active ? (online ? "online" : "offline") : "offline",
        detail: `${acc.provider} · ${acc.skills.join(", ")}`,
        size: acc.active ? 12 : 8,
      });
    }
    for (const h of hosts) {
      list.push({
        id: h.id,
        label: h.label,
        kind: "service",
        status: h.primary ? (online ? "online" : "offline") : "offline",
        detail: providerLabel(h.provider),
        size: 8,
      });
    }
    for (const name of stats.players.names) {
      list.push({
        id: `player:${name}`,
        label: name,
        kind: "player",
        status: "online",
        detail: "Giocatore online",
        size: 9,
      });
    }
    for (const world of ["world", "world_nether", "world_the_end"]) {
      list.push({
        id: `world:${world}`,
        label: world,
        kind: "world",
        status: online ? "online" : "offline",
        detail: "Dimensione",
        size: 8,
      });
    }
    list.push(
      {
        id: "metric:cpu",
        label: `CPU ${nd(stats.cpu, "%")}`,
        kind: "metric",
        status: stats.cpu !== null && stats.cpu > 85 ? "error" : online ? "online" : "offline",
        detail: "CPU",
        size: 10,
      },
      {
        id: "metric:ram",
        label: `RAM ${ramPct ?? "?"}%`,
        kind: "metric",
        status: ramPct !== null && ramPct > 85 ? "error" : online ? "online" : "offline",
        detail: `${nd(stats.ram.used)} / ${nd(stats.ram.total)} GB`,
        size: 10,
      },
      {
        id: "metric:tps",
        label: `TPS ${stats.tps === null ? "n/d" : stats.tps.toFixed(1)}`,
        kind: "metric",
        status: online ? "online" : "offline",
        detail: "TPS",
        size: 10,
      },
      {
        id: "metric:players",
        label: `${nd(stats.players.online)}/${nd(stats.players.max)}`,
        kind: "metric",
        status: online ? "online" : "offline",
        detail: "Slot",
        size: 9,
        items: stats.players.names,
      },
    );
    for (const c of connectors) {
      list.push({
        id: c.id,
        label: c.label,
        kind: "service",
        status: c.status,
        detail: c.detail,
        size: 9,
      });
    }
    return list;
  }, [stats, ramPct, connectors, hosts, accounts]);

  const activeAcc = accounts.find((a) => a.active);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-glow text-xl font-bold text-primary sm:text-2xl">M.I.N.E</h1>
            <span className="hidden text-[11px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
              multi-account network engine
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/assistant" className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary">
              ia + console
            </Link>
            <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-primary">
              <Power className="h-3.5 w-3.5" />
              {stats.status === "online" ? "online" : "offline"}
            </span>
            <button onClick={onLogout} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary">
              <LogOut className="h-3.5 w-3.5" /> esci
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-0 lg:gap-6">
        <aside className="flex w-full shrink-0 flex-col gap-5 border-b border-border bg-background/60 p-4 sm:w-72 sm:border-b-0 sm:border-r lg:w-64">
          <AccountsPanel accounts={accounts} onChange={setAccounts} />

          {activeAcc ? (
            <p className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-[10px] text-muted-foreground">
              Account attivo: <span className="text-primary">{activeAcc.label}</span> — power/console usano questa API key.
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">Nessun account attivo: si usa la chiave env se presente.</p>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
                <Server className="h-3 w-3" /> host profili
              </h2>
              <button type="button" onClick={() => setShowAddHost((v) => !v)} className="rounded border border-primary px-2 py-0.5 text-primary">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {showAddHost ? (
              <div className="mb-2 space-y-2 rounded border border-border p-2">
                <select value={hostProvider} onChange={(e) => setHostProvider(e.target.value as HostProviderId)} className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]">
                  {HOST_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <input value={hostLabel} onChange={(e) => setHostLabel(e.target.value)} placeholder="Nome" className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]" />
                <input value={hostAddress} onChange={(e) => setHostAddress(e.target.value)} placeholder="IP:porta" className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]" />
                <input value={hostNotes} onChange={(e) => setHostNotes(e.target.value)} placeholder="Note" className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]" />
                <button type="button" onClick={onAddHost} className="w-full rounded border border-primary py-1 text-[10px] text-primary">salva</button>
              </div>
            ) : null}
            {hosts.map((h) => (
              <div key={h.id} className="mb-1 flex items-center gap-1 rounded border border-border px-2 py-1">
                <button type="button" onClick={() => setHosts(setPrimaryHost(h.id))} className={h.primary ? "text-primary" : "text-muted-foreground"}><Star className="h-3 w-3" /></button>
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{h.label}</span>
                <button type="button" onClick={() => setHosts(removeHost(h.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
                <MessageSquare className="h-3 w-3" /> chat ia
              </h2>
              <button type="button" onClick={onNewChat} className="rounded border border-primary px-2 py-0.5 text-primary"><Plus className="h-3 w-3" /></button>
            </div>
            {threads.map((t) => (
              <div key={t.id} className="mb-1 flex items-center gap-1 rounded border border-border px-2 py-1">
                <Link to="/assistant/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground hover:text-primary">{t.title}</Link>
                <button type="button" onClick={() => onDeleteChat(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
                <Cable className="h-3 w-3" /> preset
              </h2>
              <button type="button" onClick={() => setShowAddConnector((v) => !v)} className="rounded border border-primary px-2 py-0.5 text-primary"><Plus className="h-3 w-3" /></button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {CONNECTOR_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => onPresetConnector(p.id)} className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase text-muted-foreground hover:border-primary hover:text-primary">{p.label}</button>
              ))}
            </div>
            {showAddConnector ? (
              <div className="mb-2 space-y-2 rounded border border-border p-2">
                <input value={connLabel} onChange={(e) => setConnLabel(e.target.value)} placeholder="Nome" className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]" />
                <select value={connKind} onChange={(e) => setConnKind(e.target.value as ConnectorKind)} className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]">
                  {CONNECTOR_KIND_OPTIONS.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
                </select>
                <input value={connDetail} onChange={(e) => setConnDetail(e.target.value)} placeholder="Dettaglio" className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]" />
                <button type="button" onClick={onAddConnector} className="w-full rounded border border-primary py-1 text-[10px] text-primary">salva</button>
              </div>
            ) : null}
            {connectors.map((c) => (
              <div key={c.id} className="mb-1 flex items-center gap-1 rounded border border-border px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{c.label}</span>
                <button type="button" onClick={() => setConnectors(removeConnector(c.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-[11px] uppercase tracking-[0.25em] text-primary">Live</h2>
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-2 text-[10px] uppercase text-muted-foreground"><Users className="h-3 w-3 text-primary" /> giocatori</p>
              {stats.players.names.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nessuno online</p>
              ) : (
                <ul className="space-y-2">
                  {stats.players.names.map((name) => (
                    <li key={name} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-[10px] font-bold text-primary">{initials(name)}</span>
                      <span className="truncate text-xs">{name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-[10px] uppercase text-muted-foreground"><span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> cpu</span><span>{nd(stats.cpu, "%")}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${barColor(stats.cpu)}`} style={{ width: `${Math.min(100, Math.max(0, stats.cpu ?? 0))}%` }} /></div>
            </div>
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-[10px] uppercase text-muted-foreground"><span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> ram</span><span>{ramPct === null ? "n/d" : `${ramPct}%`}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${barColor(ramPct)}`} style={{ width: `${Math.min(100, Math.max(0, ramPct ?? 0))}%` }} /></div>
            </div>
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-[10px] uppercase text-muted-foreground"><span className="flex items-center gap-1"><Activity className="h-3 w-3" /> tps</span><span className="flex items-center gap-1.5"><span className={`inline-block h-2 w-2 rounded-full ${tpsColor(stats.tps)}`} />{stats.tps === null ? "n/d" : stats.tps.toFixed(1)}</span></div>
            </div>
          </section>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          <section className="panel flex flex-wrap items-center gap-3 p-4">
            <button onClick={() => void onPower("start")} disabled={busy !== null} className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-xs uppercase tracking-widest text-primary hover:bg-primary/10 disabled:opacity-50">
              <Play className="h-3.5 w-3.5" /> {busy === "start" ? "avvio…" : "avvia server"}
            </button>
            <button onClick={() => void onPower("stop")} disabled={busy !== null} className="flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-xs uppercase tracking-widest text-destructive hover:bg-destructive/10 disabled:opacity-50">
              <Square className="h-3.5 w-3.5" /> {busy === "stop" ? "arresto…" : "spegni server"}
            </button>
            <button onClick={() => void router.invalidate()} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary">
              <RefreshCw className="h-3.5 w-3.5" /> aggiorna
            </button>
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-primary" /> auto 10s
            </label>
            {powerMsg ? <p className="w-full font-mono text-xs text-muted-foreground">{powerMsg}</p> : null}
          </section>

          {stats.demo || stats.note ? (
            <div className="panel flex items-start gap-3 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-muted-foreground">
                {stats.demo ? (<><span className="text-primary">Dati dimostrativi.</span> {stats.note ?? "Aggiungi un account Falix con API key."}</>) : (<><span className="text-primary">Sorgente: {stats.source}.</span> {stats.note}</>)}
              </p>
            </div>
          ) : null}

          <section className="panel overflow-hidden p-0">
            <NeuralGraph nodes={graphNodes} serverOnline={stats.status === "online"} onSelect={setSelectedNode} />
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Users className="h-4 w-4" />} label="Giocatori" value={`${nd(stats.players.online)}/${nd(stats.players.max)}`} detail={stats.players.names.join(", ") || undefined} />
            <StatCard icon={<HardDrive className="h-4 w-4" />} label="RAM" value={`${nd(stats.ram.used)} / ${nd(stats.ram.total)} GB`} progress={ramPct ?? undefined} progressClass={barColor(ramPct)} />
            <StatCard icon={<Cpu className="h-4 w-4" />} label="CPU" value={nd(stats.cpu, "%")} progress={stats.cpu ?? undefined} progressClass={barColor(stats.cpu)} />
            <StatCard icon={<Activity className="h-4 w-4" />} label="TPS" value={stats.tps === null ? "n/d" : stats.tps.toFixed(1)} progress={stats.tps === null ? undefined : (stats.tps / 20) * 100} progressClass={tpsColor(stats.tps)} />
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
          <div className={`h-full rounded-full ${progressClass}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      ) : null}
      {detail ? <p className="mt-2 truncate text-[11px] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
