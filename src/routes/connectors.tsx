import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cable, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { getAuthState } from "@/lib/auth.functions";
import {
  addConnector,
  CONNECTOR_KIND_OPTIONS,
  CONNECTOR_PRESETS,
  loadConnectors,
  removeConnector,
  type ConnectorKind,
  type CustomConnector,
} from "@/lib/connectors";

export const Route = createFileRoute("/connectors")({
  head: () => ({ meta: [{ title: "Connettori — M.I.N.E" }] }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const [list, setList] = useState<CustomConnector[]>([]);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ConnectorKind>("storage");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    setList(loadConnectors());
  }, []);

  function save() {
    if (!label.trim()) return;
    addConnector({ label, kind, detail: detail || undefined });
    setList(loadConnectors());
    setLabel("");
    setDetail("");
  }

  function preset(id: string) {
    const p = CONNECTOR_PRESETS.find((x) => x.id === id);
    if (!p) return;
    addConnector({ label: p.label, kind: p.kind, detail: p.detail, preset: p.id });
    setList(loadConnectors());
  }

  return (
    <AppShell
      title="Connettori"
      subtitle="Falix MCP · MEGA · Google Drive — nodi sulla rete neurale"
    >
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div>
          <p className="mb-2 text-label text-muted-foreground">Preset</p>
          <div className="flex flex-wrap gap-2">
            {CONNECTOR_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => preset(p.id)}
                className="btn-matrix rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-spacious space-y-3">
          <p className="text-label text-primary">Nuovo connettore</p>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome"
            className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ConnectorKind)}
            className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
          >
            {CONNECTOR_KIND_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Dettaglio"
            className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={save}
            className="btn-matrix flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-xs uppercase tracking-widest text-primary hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> aggiungi
          </button>
        </div>

        {list.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Cable}
              title="Nessun connettore"
              description="Prova i preset Falix MCP, MEGA o Google Drive — compariranno come nodi sulla rete neurale."
              action={
                <button
                  type="button"
                  onClick={() => preset("falix-mcp")}
                  className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                >
                  aggiungi Falix MCP
                </button>
              }
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm text-foreground">{c.label}</p>
                    <StatusBadge
                      status={
                        c.status === "online"
                          ? "online"
                          : c.status === "error"
                            ? "error"
                            : "offline"
                      }
                    />
                  </div>
                  <p className="truncate text-caption text-muted-foreground">
                    {c.kind} · {c.detail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setList(removeConnector(c.id))}
                  className="btn-matrix text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
