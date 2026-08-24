import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Play, RefreshCw, Square } from "lucide-react";

import { AiActivityPanel } from "@/components/AiActivityPanel";
import { AppShell } from "@/components/AppShell";
import { NeuralGraph, type GraphNode } from "@/components/NeuralGraph";
import {
  ACTIVE_ACCOUNT_EVENT,
  credentialsPayload,
  getActiveFalixAccount,
  listFalixAccounts,
  loadAccounts,
  setActiveAccount,
  type ApiAccount,
} from "@/lib/accounts";
import {
  AI_ACTIVITY_EVENT,
  activityForAccount,
  logAiActivity,
  type AiActivity,
} from "@/lib/ai-activity";
import { getAuthState, getDashboardForAccount } from "@/lib/auth.functions";
import { loadConnectors, type CustomConnector } from "@/lib/connectors";
import { loadHosts, providerLabel, type HostProfile } from "@/lib/hosts";
import { analyzeNetwork, powerAction } from "@/lib/panel.functions";
import type { ServerStats } from "@/lib/types";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [{ title: "Rete neurale — M.I.N.E" }],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: NetworkPage,
});

function NetworkPage() {
  const doPower = useServerFn(powerAction);
  const doAnalyze = useServerFn(analyzeNetwork);
  const doDashboard = useServerFn(getDashboardForAccount);

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [hosts, setHosts] = useState<HostProfile[]>([]);
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [aiEvents, setAiEvents] = useState<AiActivity[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [busy, setBusy] = useState<null | "start" | "stop" | "restart">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  const refreshAccounts = useCallback(() => {
    const list = loadAccounts();
    setAccounts(list);
    setHosts(loadHosts());
    setConnectors(loadConnectors());
    const active = getActiveFalixAccount();
    setActiveId(active?.id ?? "");
    setAiEvents(activityForAccount(active?.id ?? "", 20));
    return active;
  }, []);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    const active = getActiveFalixAccount();
    const credentials = credentialsPayload(active);
    try {
      const res = await doDashboard({
        data: {
          ...(credentials ? { credentials } : {}),
          accountLabel: active?.label,
        },
      });
      if (res.stats) setStats(res.stats);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingStats(false);
    }
  }, [doDashboard]);

  useEffect(() => {
    refreshAccounts();
    void loadStats();
  }, [refreshAccounts, loadStats]);

  useEffect(() => {
    const onAccount = () => {
      refreshAccounts();
      setAnalysis(null);
      void loadStats();
    };
    const onAi = () => {
      const active = getActiveFalixAccount();
      setAiEvents(activityForAccount(active?.id ?? "", 20));
    };
    window.addEventListener(ACTIVE_ACCOUNT_EVENT, onAccount);
    window.addEventListener(AI_ACTIVITY_EVENT, onAi);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_EVENT, onAccount);
      window.removeEventListener(AI_ACTIVITY_EVENT, onAi);
    };
  }, [refreshAccounts, loadStats]);

  const falixAccounts = useMemo(() => listFalixAccounts(), [accounts]);
  const activeLabel =
    falixAccounts.find((a) => a.id === activeId)?.label ??
    getActiveFalixAccount()?.label ??
    "Server live";

  const graphNodes: GraphNode[] = useMemo(() => {
    if (!stats) return [];
    const online = stats.status === "online";
    const list: GraphNode[] = [
      {
        id: "server",
        label: activeLabel.slice(0, 18),
        kind: "server",
        status: online ? "online" : "offline",
        detail: `Rete neurale di ${activeLabel} · ${stats.version ?? "n/d"}`,
        size: 18,
      },
      {
        id: "ai:core",
        label: "IA Groq",
        kind: "service",
        status: "online",
        detail: `Nucleo IA sul server "${activeLabel}". Analisi, proposte e azioni tracciate sotto.`,
        size: 13,
      },
    ];

    // Solo account correlati: attivo in evidenza
    for (const acc of falixAccounts) {
      list.push({
        id: acc.id,
        label: acc.label,
        kind: "service",
        status: acc.id === activeId ? "online" : "offline",
        detail:
          acc.id === activeId
            ? `Account attivo · competenze: ${acc.skills.join(", ")}`
            : `Account Falix inattivo su questa vista · ${acc.skills.join(", ")}`,
        size: acc.id === activeId ? 12 : 7,
      });
    }

    for (const name of stats.players.names) {
      list.push({
        id: `player:${name}`,
        label: name,
        kind: "player",
        status: "online",
        detail: `Giocatore online su ${activeLabel}`,
        size: 9,
      });
    }

    for (const world of ["world", "world_nether", "world_the_end"]) {
      list.push({
        id: `world:${world}`,
        label: world,
        kind: "world",
        status: online ? "online" : "offline",
        detail: `Dimensione su ${activeLabel}`,
        size: 8,
      });
    }

    const ramPct =
      stats.ram.used !== null && stats.ram.total
        ? Math.round((stats.ram.used / stats.ram.total) * 100)
        : null;

    list.push(
      {
        id: "metric:cpu",
        label: `CPU ${stats.cpu ?? "?"}%`,
        kind: "metric",
        status: stats.cpu !== null && stats.cpu > 85 ? "error" : online ? "online" : "offline",
        detail: `CPU · ${activeLabel}`,
        size: 10,
      },
      {
        id: "metric:ram",
        label: `RAM ${ramPct ?? "?"}%`,
        kind: "metric",
        status: ramPct !== null && ramPct > 85 ? "error" : online ? "online" : "offline",
        detail: `RAM · ${activeLabel}`,
        size: 10,
      },
      {
        id: "metric:tps",
        label: `TPS ${stats.tps?.toFixed(1) ?? "n/d"}`,
        kind: "metric",
        status: online ? "online" : "offline",
        detail: `TPS · ${activeLabel}`,
        size: 10,
      },
    );

    // Nodi dalle ultime azioni IA su QUESTO server
    for (const ev of aiEvents.slice(0, 8)) {
      list.push({
        id: `ai-ev:${ev.id}`,
        label: ev.title.slice(0, 16),
        kind: "log",
        status:
          ev.status === "error"
            ? "error"
            : ev.status === "rejected"
              ? "offline"
              : "online",
        detail: `[IA · ${ev.kind}] ${ev.detail || ev.title}`,
        size: 7,
      });
    }

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

    for (const h of hosts) {
      list.push({
        id: h.id,
        label: h.label,
        kind: "service",
        status: "offline",
        detail: providerLabel(h.provider),
        size: 8,
      });
    }

    return list;
  }, [stats, falixAccounts, connectors, hosts, activeId, activeLabel, aiEvents]);

  function onSelectAccount(id: string) {
    setActiveId(id);
    setActiveAccount(id);
    setAnalysis(null);
    setAiEvents(activityForAccount(id, 20));
    setMsg(`Rete neurale su: ${getActiveFalixAccount()?.label ?? id}`);
  }

  async function onPower(signal: "start" | "stop" | "restart") {
    setBusy(signal);
    setMsg(null);
    const active = getActiveFalixAccount();
    const credentials = credentialsPayload(active);
    try {
      const res = await doPower({
        data: { signal, ...(credentials ? { credentials } : {}) },
      });
      setMsg(active ? `[${active.label}] ${res.output}` : res.output);
      void loadStats();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onNeural() {
    if (!stats) return;
    setAnalyzing(true);
    setAnalysis(null);
    const active = getActiveFalixAccount();
    const summary = graphNodes
      .map((n) => `${n.kind}:${n.label} [${n.status}] ${n.detail ?? ""}`)
      .join("\n");
    try {
      const res = await doAnalyze({
        data: {
          serverLabel: activeLabel,
          status: stats.status,
          summary,
        },
      });
      setAnalysis(res.analysis);
      logAiActivity({
        accountId: active?.id ?? activeId,
        accountLabel: activeLabel,
        kind: "analysis",
        title: res.ok ? "Analisi rete completata" : "Analisi fallita",
        detail: res.analysis,
        status: res.ok ? "done" : "error",
      });
      setAiEvents(activityForAccount(active?.id ?? activeId, 20));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setAnalysis(message);
      logAiActivity({
        accountId: active?.id ?? activeId,
        accountLabel: activeLabel,
        kind: "analysis",
        title: "Errore analisi",
        detail: message,
        status: "error",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <AppShell
      title="Rete / pallini"
      subtitle="Ogni server ha la sua rete neurale — seleziona Gino, Edo o il tuo e vedi come agisce l'IA"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            server
            <select
              value={activeId}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-primary outline-none focus:border-primary"
            >
              {falixAccounts.length === 0 ? (
                <option value="">Nessun account — Competenze</option>
              ) : (
                falixAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.active ? " ★" : ""}
                  </option>
                ))
              )}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void onPower("start")}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> avvia
          </button>
          <button
            type="button"
            onClick={() => void onPower("stop")}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-md border border-destructive px-3 py-1.5 text-[11px] uppercase tracking-widest text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Square className="h-3 w-3" /> spegni
          </button>
          <button
            type="button"
            onClick={() => void onPower("restart")}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" /> riavvia
          </button>
          <button
            type="button"
            onClick={() => void onNeural()}
            disabled={analyzing || !stats}
            className="flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Brain className="h-3 w-3" /> {analyzing ? "analisi…" : "analisi neurale Groq"}
          </button>
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loadingStats}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loadingStats ? "animate-spin" : ""}`} /> aggiorna
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Vista rete: <span className="text-primary">{activeLabel}</span>
          {aiEvents.length > 0 ? (
            <> · {aiEvents.length} eventi IA su questo server</>
          ) : null}
        </p>

        {msg ? <p className="font-mono text-xs text-muted-foreground">{msg}</p> : null}
        {stats?.note ? <p className="text-[11px] text-muted-foreground">{stats.note}</p> : null}

        {analysis ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
              <Brain className="h-3.5 w-3.5" /> briefing neurale · {activeLabel}
            </p>
            <p className="whitespace-pre-wrap text-foreground/90">{analysis}</p>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-lg border border-border">
            {stats ? (
              <NeuralGraph nodes={graphNodes} serverOnline={stats.status === "online"} />
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {loadingStats
                  ? "Caricamento rete neurale…"
                  : "Nessun dato. Aggiungi un account Falix in Competenze."}
              </p>
            )}
          </div>

          <AiActivityPanel accountId={activeId} accountLabel={activeLabel} />
        </div>
      </div>
    </AppShell>
  );
}
