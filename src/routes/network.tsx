import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Brain, Play, RefreshCw, Square } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { NeuralGraph, type GraphNode } from "@/components/NeuralGraph";
import {
  credentialsPayload,
  getActiveFalixAccount,
  loadAccounts,
  type ApiAccount,
} from "@/lib/accounts";
import { getDashboard } from "@/lib/auth.functions";
import { loadConnectors, type CustomConnector } from "@/lib/connectors";
import { loadHosts, providerLabel, type HostProfile } from "@/lib/hosts";
import { analyzeNetwork, powerAction } from "@/lib/panel.functions";
import type { ServerStats } from "@/lib/types";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [{ title: "Rete neurale — M.I.N.E" }],
  }),
  loader: async () => {
    const res = await getDashboard();
    if (!res.authenticated || !res.stats) throw redirect({ to: "/login" });
    return res.stats;
  },
  component: NetworkPage,
});

function NetworkPage() {
  const stats = Route.useLoaderData() as ServerStats;
  const router = Route.useNavigate();
  const doPower = useServerFn(powerAction);
  const doAnalyze = useServerFn(analyzeNetwork);

  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [hosts, setHosts] = useState<HostProfile[]>([]);
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [serverKey, setServerKey] = useState<string>("live");
  const [busy, setBusy] = useState<null | "start" | "stop">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setAccounts(loadAccounts());
    setHosts(loadHosts());
    setConnectors(loadConnectors());
  }, []);

  const servers = useMemo(() => {
    const list: { key: string; label: string; kind: "live" | "account" | "host" }[] = [
      { key: "live", label: "Server live (API)", kind: "live" },
    ];
    for (const a of accounts) {
      list.push({ key: a.id, label: a.label, kind: "account" });
    }
    for (const h of hosts) {
      list.push({ key: h.id, label: h.label, kind: "host" });
    }
    return list;
  }, [accounts, hosts]);

  const selectedLabel = servers.find((s) => s.key === serverKey)?.label ?? "Server";

  const graphNodes: GraphNode[] = useMemo(() => {
    const online = stats.status === "online";
    const list: GraphNode[] = [
      {
        id: "server",
        label: selectedLabel.slice(0, 18),
        kind: "server",
        status: online ? "online" : "offline",
        detail: `${stats.version ?? "n/d"} · ${selectedLabel}`,
        size: 18,
      },
    ];

    // solo account/host correlati alla selezione
    if (serverKey === "live") {
      for (const acc of accounts) {
        list.push({
          id: acc.id,
          label: acc.label,
          kind: "service",
          status: acc.active ? "online" : "offline",
          detail: `${acc.provider} · ${acc.skills.join(", ")}`,
          size: acc.active ? 11 : 8,
        });
      }
    } else {
      const acc = accounts.find((a) => a.id === serverKey);
      if (acc) {
        list.push({
          id: acc.id,
          label: acc.label,
          kind: "service",
          status: "online",
          detail: `${acc.provider} · competenze: ${acc.skills.join(", ")}`,
          size: 12,
        });
      }
      const host = hosts.find((h) => h.id === serverKey);
      if (host) {
        list.push({
          id: host.id,
          label: host.label,
          kind: "service",
          status: "online",
          detail: providerLabel(host.provider),
          size: 11,
        });
      }
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
        detail: "CPU",
        size: 10,
      },
      {
        id: "metric:ram",
        label: `RAM ${ramPct ?? "?"}%`,
        kind: "metric",
        status: ramPct !== null && ramPct > 85 ? "error" : online ? "online" : "offline",
        detail: "RAM",
        size: 10,
      },
      {
        id: "metric:tps",
        label: `TPS ${stats.tps?.toFixed(1) ?? "n/d"}`,
        kind: "metric",
        status: online ? "online" : "offline",
        detail: "TPS",
        size: 10,
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
  }, [stats, accounts, hosts, connectors, serverKey, selectedLabel]);

  async function onPower(signal: "start" | "stop") {
    setBusy(signal);
    setMsg(null);
    const active = getActiveFalixAccount();
    const credentials = credentialsPayload(active);
    try {
      const res = await doPower({
        data: { signal, ...(credentials ? { credentials } : {}) },
      });
      setMsg(res.output);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onNeural() {
    setAnalyzing(true);
    setAnalysis(null);
    const summary = graphNodes
      .map((n) => `${n.kind}:${n.label} [${n.status}] ${n.detail ?? ""}`)
      .join("\n");
    try {
      const res = await doAnalyze({
        data: {
          serverLabel: selectedLabel,
          status: stats.status,
          summary,
        },
      });
      setAnalysis(res.analysis);
    } catch (e) {
      setAnalysis(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <AppShell title="Rete / pallini" subtitle="Cambia server — la mappa nodi si aggiorna · Groq analizza la rete">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            server
            <select
              value={serverKey}
              onChange={(e) => setServerKey(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-primary outline-none focus:border-primary"
            >
              {servers.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
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
            onClick={() => void onNeural()}
            disabled={analyzing}
            className="flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Brain className="h-3 w-3" /> {analyzing ? "analisi…" : "analisi neurale Groq"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
          >
            <RefreshCw className="h-3 w-3" /> aggiorna
          </button>
        </div>

        {msg ? <p className="font-mono text-xs text-muted-foreground">{msg}</p> : null}

        {analysis ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
              <Brain className="h-3.5 w-3.5" /> briefing neurale · {selectedLabel}
            </p>
            <p className="whitespace-pre-wrap text-foreground/90">{analysis}</p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border">
          <NeuralGraph nodes={graphNodes} serverOnline={stats.status === "online"} />
        </div>
      </div>
    </AppShell>
  );
}
