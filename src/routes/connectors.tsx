import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cable, Cloud, ExternalLink, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { getAuthState } from "@/lib/auth.functions";
import {
  addConnector,
  connectModeLabel,
  CONNECTOR_KIND_OPTIONS,
  DEFAULT_CONNECTOR_CATALOG,
  ensureDefaultConnectors,
  isPresetActive,
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
  const [kind, setKind] = useState<ConnectorKind>("cloud");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    setList(ensureDefaultConnectors());
  }, []);

  function save() {
    if (!label.trim()) return;
    addConnector({ label, kind, detail: detail || undefined });
    setList(loadConnectors());
    setLabel("");
    setDetail("");
  }

  function activatePreset(id: string) {
    const p = DEFAULT_CONNECTOR_CATALOG.find((x) => x.id === id);
    if (!p) return;
    if (isPresetActive(id)) return;
    addConnector({ label: p.label, kind: p.kind, detail: p.detail, preset: p.id });
    setList(loadConnectors());
  }

  const cloud = DEFAULT_CONNECTOR_CATALOG.filter((d) => d.kind === "cloud");
  const core = DEFAULT_CONNECTOR_CATALOG.filter((d) => d.kind !== "cloud");

  return (
    <AppShell
      title="Connettori"
      subtitle="Storage, MCP, cloud app (Koyeb, Railway…) e webhook"
    >
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            <p className="text-label text-primary">Cloud & app host</p>
          </div>
          <p className="text-caption text-muted-foreground">
            Oltre Minecraft: collega Koyeb, Railway, Render, Fly e simili via API. Profilo in Host,
            ricerca con Host Research.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {cloud.map((d, i) => {
              const active = isPresetActive(d.id);
              return (
                <li
                  key={d.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="card-interactive animate-fade-in-up rounded-lg border border-border bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{d.label}</p>
                    <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                      {connectModeLabel(d.connectMode)}
                    </span>
                    {active ? <StatusBadge status="online" label="in rete" /> : null}
                  </div>
                  <p className="mt-1 text-caption text-muted-foreground">{d.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!active ? (
                      <button
                        type="button"
                        onClick={() => activatePreset(d.id)}
                        className="btn-matrix rounded-md border border-primary px-2.5 py-1 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                      >
                        attiva
                      </button>
                    ) : null}
                    <Link
                      to="/hosts"
                      className="btn-matrix text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                    >
                      Host →
                    </Link>
                    {d.docsUrl ? (
                      <a
                        href={d.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-matrix inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                      >
                        docs <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <p className="text-label text-primary">Catalogo core</p>
          <p className="text-caption text-muted-foreground">
            Ogni servizio indica se si collega via <span className="text-primary">MCP</span> oppure{" "}
            <span className="text-primary">API</span>.
          </p>
          <ul className="space-y-3">
            {core.map((d, i) => {
              const active = isPresetActive(d.id);
              return (
                <li
                  key={d.id}
                  style={{ animationDelay: `${i * 35}ms` }}
                  className="card-interactive animate-fade-in-up rounded-lg border border-border bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{d.label}</p>
                        <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                          {connectModeLabel(d.connectMode)}
                        </span>
                        {active ? <StatusBadge status="online" label="in rete" /> : null}
                      </div>
                      <p className="mt-1 text-caption text-muted-foreground">{d.detail}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {d.connectHint}
                      </p>
                      {d.mcpTools?.length ? (
                        <p className="mt-1 font-mono text-[10px] text-primary/80">
                          Tool: {d.mcpTools.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                      {!active ? (
                        <button
                          type="button"
                          onClick={() => activatePreset(d.id)}
                          className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                        >
                          attiva in rete
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          già attivo
                        </span>
                      )}
                      {d.skillsPath === "/skills" ? (
                        <Link
                          to="/skills"
                          className="btn-matrix text-center text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                        >
                          collega account →
                        </Link>
                      ) : null}
                      {d.skillsPath === "/hosts" ? (
                        <Link
                          to="/hosts"
                          className="btn-matrix text-center text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                        >
                          apri Host →
                        </Link>
                      ) : null}
                      {d.docsUrl ? (
                        <a
                          href={d.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-matrix inline-flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                        >
                          docs <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="panel-spacious space-y-3">
          <p className="text-label text-primary">Nuovo connettore custom</p>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome"
            className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ConnectorKind)}
            className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
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
            className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={save}
            className="btn-matrix flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-xs uppercase tracking-widest text-primary hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> aggiungi
          </button>
        </div>

        <section>
          <p className="mb-2 text-label text-muted-foreground">Attivi sulla rete neurale</p>
          {list.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={Cable}
                title="Nessun connettore attivo"
                description="Attiva MEGA, Koyeb o Falix MCP dal catalogo sopra."
                action={
                  <button
                    type="button"
                    onClick={() => activatePreset("koyeb")}
                    className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                  >
                    attiva Koyeb
                  </button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => (
                <li
                  key={c.id}
                  className="card-interactive flex items-center gap-3 rounded-lg border border-border px-3 py-3"
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
        </section>
      </div>
    </AppShell>
  );
}
