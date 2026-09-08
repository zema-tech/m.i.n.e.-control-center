import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Cable, Cloud, ExternalLink, Globe2, Plus, Search, Server, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BrandLogo } from "@/components/BrandLogo";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { getAuthState } from "@/lib/auth.functions";
import { getBrandfetchClientId } from "@/lib/brandfetch";
import {
  addConnector,
  connectModeLabel,
  CONNECTOR_KIND_OPTIONS,
  DEFAULT_CONNECTOR_CATALOG,
  ensureDefaultConnectors,
  isPresetActive,
  loadConnectors,
  ONE_CLI_REPO,
  ONE_DOCS_URL,
  ONE_MCP_URL,
  removeConnector,
  type ConnectorKind,
  type CustomConnector,
} from "@/lib/connectors";
import {
  ONE_CATEGORY_LABELS,
  searchOnePlatforms,
  type OneCategory,
} from "@/lib/one-platforms";

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
  const [kind, setKind] = useState<ConnectorKind>("one");
  const [detail, setDetail] = useState("");
  const [oneQuery, setOneQuery] = useState("");
  const [oneCategory, setOneCategory] = useState<OneCategory | "all">("all");
  const [bfClient, setBfClient] = useState("");

  useEffect(() => {
    setList(ensureDefaultConnectors());
    setBfClient(getBrandfetchClientId());
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

  function saveBrandfetchClientId() {
    const v = bfClient.trim();
    try {
      if (v) window.localStorage.setItem("omnicore.brandfetch.clientId", v);
      else window.localStorage.removeItem("omnicore.brandfetch.clientId");
    } catch {
      /* ignore */
    }
    setBfClient(getBrandfetchClientId());
  }

  const native = DEFAULT_CONNECTOR_CATALOG.filter((d) => !d.onePlatform);
  const official = native.filter((d) => d.officialMcp);
  const cloud = native.filter((d) => d.kind === "cloud");
  const core = native.filter((d) => d.kind !== "cloud" && !d.officialMcp);

  const oneFiltered = useMemo(() => {
    let rows = searchOnePlatforms(oneQuery);
    if (oneCategory !== "all") rows = rows.filter((p) => p.category === oneCategory);
    return rows;
  }, [oneQuery, oneCategory]);

  const categories = useMemo(
    () =>
      (Object.keys(ONE_CATEGORY_LABELS) as OneCategory[]).filter((c) =>
        searchOnePlatforms("").some((p) => p.category === c),
      ),
    [],
  );

  const hasBf = Boolean(getBrandfetchClientId());

  return (
    <AppShell title="Connettori" subtitle="One MCP · ufficiali · storage · cloud · Brandfetch">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
        <section className="panel-spacious space-y-3 animate-fade-in-up">
          <p className="text-label text-primary">Loghi brand (Brandfetch)</p>
          <p className="text-caption text-muted-foreground">
            Logo API gratuita — client ID da{" "}
            <a
              href="https://developers.brandfetch.com/register"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              developers.brandfetch.com
            </a>
            . Oppure imposta <span className="font-mono text-[10px]">VITE_BRANDFETCH_CLIENT_ID</span>{" "}
            su Vercel.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={bfClient}
              onChange={(e) => setBfClient(e.target.value)}
              placeholder="Brandfetch client ID"
              className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={saveBrandfetchClientId}
              className="btn-matrix rounded-md border border-primary px-3 py-2 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              salva
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Stato: {hasBf ? "client ID attivo — loghi dal CDN" : "nessun client ID — solo lettermark"}
          </p>
        </section>

        <section className="panel-spacious space-y-3 animate-fade-in-up">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex gap-3">
              <BrandLogo id="one-mcp" label="One MCP" size={36} />
              <div>
                <p className="flex items-center gap-2 text-label text-primary">
                  <Globe2 className="h-3.5 w-3.5" /> One MCP — withoneai/cli
                </p>
                <p className="mt-1 text-caption text-muted-foreground">
                  Un solo gateway MCP per centinaia di SaaS.
                </p>
              </div>
            </div>
            {isPresetActive("one-mcp") ? <StatusBadge status="online" label="in rete" /> : null}
          </div>
          <p className="font-mono text-[10px] text-primary/90 break-all">{ONE_MCP_URL}</p>
          <div className="flex flex-wrap gap-2">
            {!isPresetActive("one-mcp") ? (
              <button
                type="button"
                onClick={() => activatePreset("one-mcp")}
                className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
              >
                attiva gateway One
              </button>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                gateway già in rete
              </span>
            )}
            <a href={ONE_DOCS_URL} target="_blank" rel="noreferrer" className="btn-matrix inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary">
              docs MCP <ExternalLink className="h-3 w-3" />
            </a>
            <a href={ONE_CLI_REPO} target="_blank" rel="noreferrer" className="btn-matrix inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary">
              GitHub CLI <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>

        {/* MCP ufficiali — GitHub remote + reference */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-primary" />
              <p className="text-label text-primary">MCP ufficiali</p>
            </div>
            <a
              href="https://registry.modelcontextprotocol.io"
              target="_blank"
              rel="noreferrer"
              className="btn-matrix inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
            >
              registry <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-caption text-muted-foreground">
            GitHub remote (streamable-http) + reference del steering group. I stdio richiedono processo
            locale o bridge; GitHub è usabile da browser con PAT.
          </p>
          <ul className="space-y-3">
            {official.map((d, i) => {
              const active = isPresetActive(d.id);
              return (
                <li
                  key={d.id}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className="card-interactive animate-fade-in-up rounded-lg border border-border bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <BrandLogo id={d.id} label={d.label} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{d.label}</p>
                        <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                          {connectModeLabel(d.connectMode)}
                        </span>
                        {d.browserReady ? (
                          <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-400">
                            remote
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-amber-400">
                            local stdio
                          </span>
                        )}
                        {active ? <StatusBadge status="online" label="in rete" /> : null}
                      </div>
                      <p className="mt-1 text-caption text-muted-foreground">{d.detail}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{d.connectHint}</p>
                      {d.mcpTools?.length ? (
                        <p className="mt-1 font-mono text-[10px] text-primary/80">
                          Tool: {d.mcpTools.slice(0, 8).join(", ")}
                          {d.mcpTools.length > 8 ? "…" : ""}
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

        <section className="space-y-3">
          <p className="text-label text-primary">Piattaforme One (catalogo)</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={oneQuery}
                onChange={(e) => setOneQuery(e.target.value)}
                placeholder="Cerca Gmail, Slack, Stripe…"
                className="w-full rounded border border-border bg-background py-2.5 pl-8 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <select
              value={oneCategory}
              onChange={(e) => setOneCategory(e.target.value as OneCategory | "all")}
              className="rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="all">Tutte le categorie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {ONE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <ul className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {oneFiltered.map((p, i) => {
              const presetId = `one:${p.id}`;
              const active = isPresetActive(presetId);
              return (
                <li
                  key={p.id}
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                  className="card-interactive animate-fade-in-up rounded-lg border border-border bg-background/40 p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <BrandLogo id={p.id} label={p.label} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm text-foreground">{p.label}</p>
                        <span className="rounded-full border border-primary/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-primary">
                          {ONE_CATEGORY_LABELS[p.category]}
                        </span>
                        {active ? <StatusBadge status="online" label="rete" /> : null}
                      </div>
                      <p className="mt-0.5 text-caption text-muted-foreground">{p.detail}</p>
                      <p className="mt-1 font-mono text-[9px] text-muted-foreground/70">one add {p.id}</p>
                      {!active ? (
                        <button
                          type="button"
                          onClick={() => activatePreset(presetId)}
                          className="btn-matrix mt-2 rounded border border-primary/50 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary hover:bg-primary/10"
                        >
                          attiva
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            <p className="text-label text-primary">Cloud & app host</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {cloud.map((d, i) => {
              const active = isPresetActive(d.id);
              return (
                <li
                  key={d.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="card-interactive animate-fade-in-up rounded-lg border border-border bg-background/40 p-4"
                >
                  <div className="flex items-start gap-3">
                    <BrandLogo id={d.id} label={d.label} size={36} />
                    <div className="min-w-0 flex-1">
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
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <p className="text-label text-primary">Catalogo nativo M.I.N.E</p>
          <ul className="space-y-3">
            {core.map((d, i) => {
              const active = isPresetActive(d.id);
              return (
                <li
                  key={d.id}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className="card-interactive animate-fade-in-up rounded-lg border border-border bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <BrandLogo id={d.id} label={d.label} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{d.label}</p>
                        <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                          {connectModeLabel(d.connectMode)}
                        </span>
                        {active ? <StatusBadge status="online" label="in rete" /> : null}
                      </div>
                      <p className="mt-1 text-caption text-muted-foreground">{d.detail}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{d.connectHint}</p>
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
            className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
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
                description="Attiva One MCP, GitHub MCP o Falix dal catalogo sopra."
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => (
                <li
                  key={c.id}
                  className="card-interactive flex items-center gap-3 rounded-lg border border-border px-3 py-3"
                >
                  <BrandLogo id={c.preset || c.id} label={c.label} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm text-foreground">{c.label}</p>
                      <StatusBadge
                        status={
                          c.status === "online" ? "online" : c.status === "error" ? "error" : "offline"
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
