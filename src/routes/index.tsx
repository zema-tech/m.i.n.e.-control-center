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

import { NeuralGraph, type GraphNode } from "@/components/NeuralGraph";
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
          "M.I.N.E: dashboard multi-host per server Minecraft (Falix e altri) con connettori, rete neurale e assistente IA.",
      },
      { property: "og:title", content: "M.I.N.E — Pannello server Minecraft con IA" },
      {
        property: "og:description",
        content: "Semplifica l'hosting Minecraft: Falix, altri host e connettori tipo MEGA.",
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

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [hosts, setHosts] = useState<HostProfile[]>([]);
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
    addConnector({
      label,
      kind: connKind,
      detail: connDetail.trim() || undefined,
    });
    setConnectors(loadConnectors());
    setConnLabel("");
    setConnDetail("");
    setShowAddConnector(false);
  }

  function onPresetConnector(presetId: string) {
    const p = CONNECTOR_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    addConnector({
      label: p.label,
      kind: p.kind,
      detail: p.detail,
      preset: p.id,
    });
    setConnectors(loadConnectors());
  }

  function onRemoveConnector(id: string) {
    setConnectors(removeConnector(id));
  }

  function onAddHost() {
    const label = hostLabel.trim() || providerLabel(hostProvider);
    addHost({
      label,
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

  function onRemoveHost(id: string) {
    setHosts(removeHost(id));
  }

  function onSetPrimary(id: string) {
    setHosts(setPrimaryHost(id));
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

    // Host configurati (Falix + altri)
    list.push({
      id: "host:falix-env",
      label: "Falix (API)",
      kind: "service",
      status: stats.source === "falix" ? "online" : "offline",
      detail: "Host principale collegato via env / API",
      size: 10,
    });
    for (const h of hosts) {
      list.push({
        id: h.id,
        label: h.label,
        kind: "service",
        status: h.primary ? (online ? "online" : "offline") : "offline",
        detail: `${providerLabel(h.provider)}${h.address ? ` · ${h.address}` : ""}${h.notes ? ` · ${h.notes}` : ""}`,
        size: h.primary ? 11 : 8,
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
    if (stats.players.names.length === 0 && (stats.players.online ?? 0) > 0) {
      for (let i = 0; i < Math.min(stats.players.online ?? 0, 8); i++) {
        list.push({
          id: `player:slot-${i}`,
          label: `Player ${i + 1}`,
          kind: "player",
          status: "online",
          detail: "Slot online (nome non esposto)",
        });
      }
    }

    for (const world of ["world", "world_nether", "world_the_end"]) {
      list.push({
        id: `world:${world}`,
        label: world,
        kind: "world",
        status: online ? "online" : "offline",
        detail: "Dimensione del server",
        size: 8,
      });
    }

    const plugins = [
      "Paper",
      "EssentialsX",
      "WorldGuard",
      "LuckPerms",
      "Vault",
      "PlaceholderAPI",
      "CoreProtect",
      "Spark",
    ];
    for (const p of plugins) {
      list.push({
        id: `plugin:${p}`,
        label: p,
        kind: "plugin",
        status: online ? "online" : "offline",
        detail: "Plugin / stack server",
        size: 7,
      });
    }

    list.push({
      id: "metric:cpu",
      label: `CPU ${nd(stats.cpu, "%")}`,
      kind: "metric",
      status: stats.cpu !== null && stats.cpu > 85 ? "error" : online ? "online" : "offline",
      detail: "Utilizzo processore",
      size: 10,
    });
    list.push({
      id: "metric:ram",
      label: `RAM ${ramPct ?? "?"}%`,
      kind: "metric",
      status: ramPct !== null && ramPct > 85 ? "error" : online ? "online" : "offline",
      detail: `${nd(stats.ram.used)} / ${nd(stats.ram.total)} GB`,
      size: 10,
    });
    list.push({
      id: "metric:tps",
      label: `TPS ${stats.tps === null ? "n/d" : stats.tps.toFixed(1)}`,
      kind: "metric",
      status:
        stats.tps !== null && stats.tps < 15
          ? "error"
          : stats.tps !== null && stats.tps < 18
            ? "offline"
            : online
              ? "online"
              : "offline",
      detail: "Tick per secondo",
      size: 10,
    });
    list.push({
      id: "metric:players",
      label: `${nd(stats.players.online)}/${nd(stats.players.max)}`,
      kind: "metric",
      status: online ? "online" : "offline",
      detail: "Slot giocatori",
      size: 9,
      items: stats.players.names,
    });

    const services: { id: string; label: string; detail: string; ok: boolean }[] = [
      {
        id: "svc:falix",
        label: "Falix API",
        detail: stats.source === "falix" ? "Connesso" : "Non primario",
        ok: stats.source === "falix",
      },
      {
        id: "svc:mcstatus",
        label: "MC Query",
        detail: stats.source === "mcstatus" ? "Attivo" : "Fallback",
        ok: stats.source === "mcstatus" || stats.source === "falix",
      },
      {
        id: "svc:console",
        label: "Console",
        detail: "Comandi server",
        ok: online,
      },
      {
        id: "svc:groq",
        label: "Groq IA",
        detail: "Assistente M.I.N.E",
        ok: true,
      },
      {
        id: "svc:rcon",
        label: "Power",
        detail: "Start / stop",
        ok: online || stats.status === "offline",
      },
    ];
    for (const s of services) {
      list.push({
        id: s.id,
        label: s.label,
        kind: "service",
        status: s.ok ? "online" : "offline",
        detail: s.detail,
        size: 8,
      });
    }

    const recent = stats.log.slice(-6);
    for (let i = 0; i < recent.length; i++) {
      const entry = recent[i]!;
      list.push({
        id: `log:${i}:${entry.ts}`,
        label: entry.message.slice(0, 18),
        kind: "log",
        status: entry.level === "error" ? "error" : entry.level === "warn" ? "offline" : "online",
        detail: entry.message.slice(0, 120),
        size: 6,
      });
    }

    // Connettori (MEGA, Discord, …) — mappati su kind del grafo
    for (const c of connectors) {
      const kindMap: Record<string, GraphNode["kind"]> = {
        storage: "service",
        backup: "service",
        chat: "service",
        rcon: "service",
        service: "service",
        plugin: "plugin",
        world: "world",
        metric: "metric",
      };
      list.push({
        id: c.id,
        label: c.label,
        kind: kindMap[c.kind] ?? "service",
        status: c.status,
        detail: c.detail + (c.preset ? ` · preset:${c.preset}` : ""),
        size: c.preset === "mega" ? 11 : 9,
      });
    }

    return list;
  }, [stats, ramPct, connectors, hosts]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-glow text-xl font-bold text-primary sm:text-2xl">M.I.N.E</h1>
            <span className="hidden text-[11px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
              multi-host network engine
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
        <aside className="flex w-full shrink-0 flex-col gap-5 border-b border-border bg-background/60 p-4 sm:w-64 sm:border-b-0 sm:border-r lg:w-60">
          {/* Host multipli */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
                <Server className="h-3 w-3" /> host
              </h2>
              <button
                type="button"
                onClick={() => setShowAddHost((v) => !v)}
                className="flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" /> aggiungi
              </button>
            </div>
            <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
              Falix è l&apos;API principale. Puoi registrare altri host (Aternos, Apex, VPS…).
            </p>

            {showAddHost ? (
              <div className="mb-2 space-y-2 rounded-md border border-border bg-background/50 p-2">
                <select
                  value={hostProvider}
                  onChange={(e) => setHostProvider(e.target.value as HostProviderId)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                >
                  {HOST_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.apiReady ? " · API" : ""}
                    </option>
                  ))}
                </select>
                <input
                  value={hostLabel}
                  onChange={(e) => setHostLabel(e.target.value)}
                  placeholder="Nome profilo (es. SMP amici)"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                />
                <input
                  value={hostAddress}
                  onChange={(e) => setHostAddress(e.target.value)}
                  placeholder="IP:porta o hostname"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                />
                <input
                  value={hostNotes}
                  onChange={(e) => setHostNotes(e.target.value)}
                  placeholder="Note / panel URL"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onAddHost}
                    className="flex-1 rounded border border-primary py-1 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                  >
                    salva
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddHost(false)}
                    className="rounded border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground"
                  >
                    annulla
                  </button>
                </div>
              </div>
            ) : null}

            <div className="max-h-36 space-y-1 overflow-y-auto">
              <div className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
                <Star className="h-3 w-3 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                  Falix (env)
                  <span className="ml-1 text-[9px] text-primary/70">API live</span>
                </span>
              </div>
              {hosts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nessun host extra.</p>
              ) : (
                hosts.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5"
                  >
                    <button
                      type="button"
                      title="Imposta primario (UI)"
                      onClick={() => onSetPrimary(h.id)}
                      className={`shrink-0 ${h.primary ? "text-primary" : "text-muted-foreground"}`}
                    >
                      <Star className="h-3 w-3" />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {h.label}
                      <span className="ml-1 text-[9px] text-primary/70">
                        {providerLabel(h.provider)}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Rimuovi ${h.label}`}
                      onClick={() => onRemoveHost(h.id)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Chat IA */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
                <MessageSquare className="h-3 w-3" /> chat ia
              </h2>
              <button
                type="button"
                onClick={onNewChat}
                className="flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" /> nuova
              </button>
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {threads.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nessuna chat.</p>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5"
                  >
                    <Link
                      to="/assistant/$threadId"
                      params={{ threadId: t.id }}
                      className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground transition-colors hover:text-primary"
                    >
                      {t.title}
                    </Link>
                    <button
                      type="button"
                      aria-label={`Elimina ${t.title}`}
                      onClick={() => onDeleteChat(t.id)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Connettori + preset MEGA */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
                <Cable className="h-3 w-3" /> connettori
              </h2>
              <button
                type="button"
                onClick={() => setShowAddConnector((v) => !v)}
                className="flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" /> aggiungi
              </button>
            </div>

            <div className="mb-2 flex flex-wrap gap-1">
              {CONNECTOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPresetConnector(p.id)}
                  className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  title={p.detail}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {showAddConnector ? (
              <div className="mb-2 space-y-2 rounded-md border border-border bg-background/50 p-2">
                <input
                  value={connLabel}
                  onChange={(e) => setConnLabel(e.target.value)}
                  placeholder="Nome (es. MEGA backup)"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                />
                <select
                  value={connKind}
                  onChange={(e) => setConnKind(e.target.value as ConnectorKind)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                >
                  {CONNECTOR_KIND_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  value={connDetail}
                  onChange={(e) => setConnDetail(e.target.value)}
                  placeholder="Dettaglio (opzionale)"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onAddConnector}
                    className="flex-1 rounded border border-primary py-1 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                  >
                    salva
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddConnector(false)}
                    className="rounded border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground"
                  >
                    annulla
                  </button>
                </div>
              </div>
            ) : null}

            <div className="max-h-28 space-y-1 overflow-y-auto">
              {connectors.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nessun connettore. Prova <strong className="text-primary">MEGA</strong> per i
                  backup.
                </p>
              ) : (
                connectors.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {c.label}
                      <span className="ml-1 text-[9px] text-primary/70">{c.kind}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Rimuovi ${c.label}`}
                      onClick={() => onRemoveConnector(c.id)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Live stats */}
          <section>
            <h2 className="mb-3 text-[11px] uppercase tracking-[0.25em] text-primary">Live</h2>

            <div className="mb-4">
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

            <div className="mb-3">
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

            <div className="mb-3">
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
            </div>

            <div className="mb-3">
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

            {selectedNode ? (
              <div className="rounded-md border border-border bg-background/50 p-3 text-[11px]">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-primary">Nodo</p>
                <p className="font-display text-sm text-primary">{selectedNode.label}</p>
                <p className="mt-1 text-muted-foreground">
                  {selectedNode.kind} · {selectedNode.status}
                </p>
                {selectedNode.detail ? (
                  <p className="mt-1 text-muted-foreground">{selectedNode.detail}</p>
                ) : null}
              </div>
            ) : null}
          </section>
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

          <section className="panel overflow-hidden p-0 sm:p-0">
            <NeuralGraph
              nodes={graphNodes}
              serverOnline={stats.status === "online"}
              onSelect={setSelectedNode}
            />
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
