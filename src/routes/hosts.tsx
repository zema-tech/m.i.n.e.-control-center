import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Search, Server, Star, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { getAuthState } from "@/lib/auth.functions";
import {
  addHost,
  ensureDefaultHosts,
  HOST_PROVIDERS,
  loadHosts,
  maskKey,
  providerLabel,
  removeHost,
  setPrimaryHost,
  updateHost,
  type HostProfile,
  type HostProviderId,
} from "@/lib/hosts";
import type { HostResearchReport } from "@/lib/host-research.types";
import { researchHost } from "@/lib/panel.functions";

export const Route = createFileRoute("/hosts")({
  head: () => ({ meta: [{ title: "Host — M.I.N.E" }] }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: HostsPage,
});

function HostsPage() {
  const [list, setList] = useState<HostProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState<HostProviderId>("falix");
  const [apiKey, setApiKey] = useState("");
  const [serverId, setServerId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [address, setAddress] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const [researchQuery, setResearchQuery] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [report, setReport] = useState<HostResearchReport | null>(null);

  useEffect(() => {
    setList(ensureDefaultHosts());
  }, []);

  const def = HOST_PROVIDERS.find((p) => p.id === provider);

  function resetForm() {
    setLabel("");
    setApiKey("");
    setServerId("");
    setBaseUrl(def?.defaultBase ?? "");
    setAddress("");
    setEditId(null);
    setOpen(false);
  }

  function onProviderChange(id: HostProviderId) {
    setProvider(id);
    const p = HOST_PROVIDERS.find((x) => x.id === id);
    if (p?.defaultBase) setBaseUrl(p.defaultBase);
    if (!label.trim()) setLabel(p?.label ?? "");
  }

  function save() {
    if (!label.trim() && !def) return;
    if (editId) {
      setList(
        updateHost(editId, {
          label: label || def?.label || "Host",
          provider,
          apiKey,
          serverId,
          baseUrl,
          address,
          notes: def?.apiHint,
        }),
      );
    } else {
      addHost({
        label: label || def?.label || "Host",
        provider,
        apiKey,
        serverId,
        baseUrl: baseUrl || def?.defaultBase,
        address,
        notes: def?.apiHint,
        primary: list.length === 0,
      });
      setList(loadHosts());
    }
    resetForm();
  }

  function startEdit(h: HostProfile) {
    setEditId(h.id);
    setLabel(h.label);
    setProvider(h.provider);
    setApiKey(h.apiKey);
    setServerId(h.serverId);
    setBaseUrl(h.baseUrl);
    setAddress(h.address);
    setOpen(true);
  }

  function quickAdd(id: HostProviderId) {
    const p = HOST_PROVIDERS.find((x) => x.id === id);
    if (!p) return;
    addHost({
      label: p.label,
      provider: id,
      baseUrl: p.defaultBase,
      notes: p.apiHint,
    });
    setList(loadHosts());
  }

  async function runResearch(q?: string) {
    const query = (q ?? researchQuery).trim();
    if (!query) return;
    setResearching(true);
    setResearchError(null);
    try {
      const res = await researchHost({ data: { query } });
      if (!res.ok || !("report" in res) || !res.report) {
        setResearchError(
          "message" in res && typeof res.message === "string"
            ? res.message
            : "Ricerca non riuscita.",
        );
        setReport(null);
        return;
      }
      setReport(res.report);
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setResearching(false);
    }
  }

  function applyReportToForm(r: HostResearchReport) {
    const pid =
      r.draftProfile.provider && HOST_PROVIDERS.some((p) => p.id === r.draftProfile.provider)
        ? r.draftProfile.provider
        : "generic";
    setProvider(pid);
    setLabel(r.draftProfile.label || r.label);
    setBaseUrl(r.draftProfile.baseUrl || r.suggestedBaseUrl || "");
    setEditId(null);
    setOpen(true);
  }

  function saveFromReport(r: HostResearchReport) {
    const pid =
      r.draftProfile.provider && HOST_PROVIDERS.some((p) => p.id === r.draftProfile.provider)
        ? r.draftProfile.provider
        : "generic";
    addHost({
      label: r.draftProfile.label || r.label,
      provider: pid,
      baseUrl: r.draftProfile.baseUrl || r.suggestedBaseUrl,
      notes: r.draftProfile.notes || r.mcpHint,
    });
    setList(loadHosts());
  }

  return (
    <AppShell
      title="Host"
      subtitle="Cambia host facilmente — nome, API key, Server ID e base URL"
    >
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="panel-spacious space-y-3">
          <div>
            <p className="text-label text-primary">Studia questo provider</p>
            <p className="text-caption text-muted-foreground">
              Host Research Agent (seed + probe sito + Groq) — API, MCP, prezzi e bozza profilo
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runResearch();
              }}
              placeholder="es. falix, pterodactyl, aternos.org, bloom.host"
              className="w-full flex-1 rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={researching || !researchQuery.trim()}
              onClick={() => void runResearch()}
              className="btn-matrix flex items-center justify-center gap-1.5 rounded-md border border-primary px-4 py-2.5 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {researching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              studia
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["falix", "pterodactyl", "aternos", "exaroton", "mcsmanager"].map((q) => (
              <button
                key={q}
                type="button"
                disabled={researching}
                onClick={() => {
                  setResearchQuery(q);
                  void runResearch(q);
                }}
                className="btn-matrix rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          {researchError ? <p className="text-caption text-destructive">{researchError}</p> : null}
          {report ? (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-foreground">{report.label}</p>
                <StatusBadge
                  status={report.apiAvailable ? "online" : "offline"}
                  label={report.apiAvailable ? "API documentata" : "API limitata / assente"}
                />
              </div>
              <p className="text-caption whitespace-pre-wrap text-muted-foreground">
                {report.summary.slice(0, 900)}
                {report.summary.length > 900 ? "…" : ""}
              </p>
              <p className="text-caption text-muted-foreground">
                <span className="text-primary">MCP:</span> {report.mcpHint}
              </p>
              {report.suggestedBaseUrl ? (
                <p className="font-mono text-[10px] text-muted-foreground/90">
                  base: {report.suggestedBaseUrl}
                </p>
              ) : null}
              <p className="text-caption text-muted-foreground">
                {report.pricingNotes} · {report.riskNotes}
              </p>
              {report.sources.length > 0 ? (
                <p className="text-caption text-muted-foreground/80">
                  Fonti:{" "}
                  {report.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 ? " · " : ""}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-primary/40 hover:text-primary"
                      >
                        {s.title}
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => saveFromReport(report)}
                  className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                >
                  salva profilo host
                </button>
                <button
                  type="button"
                  onClick={() => applyReportToForm(report)}
                  className="btn-matrix rounded-md border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
                >
                  precompila form
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-label text-muted-foreground">Preset host</p>
          <div className="flex flex-wrap gap-2">
            {HOST_PROVIDERS.filter((p) => p.apiReady || p.id === "falix" || p.id === "generic").map(
              (p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => quickAdd(p.id)}
                  className="btn-matrix rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary"
                  title={p.apiHint}
                >
                  {p.label}
                  {p.apiReady ? " · API" : ""}
                </button>
              ),
            )}
          </div>
          <p className="mt-2 text-caption text-muted-foreground">
            Falix è pronto per le azioni live. Altri host: salvi nome + API per switch rapido; le
            azioni live restano su account Falix in Competenze finché non estendi il adapter.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-label text-primary">I tuoi host</p>
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setOpen((v) => !v);
              if (!open && def?.defaultBase) setBaseUrl(def.defaultBase);
            }}
            className="btn-matrix flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-widest text-primary hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> {open ? "chiudi" : "nuovo host"}
          </button>
        </div>

        {open ? (
          <div className="panel-spacious space-y-3">
            <p className="text-label text-primary">
              {editId ? "Modifica host" : "Aggiungi host"}
            </p>
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as HostProviderId)}
              className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {HOST_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.apiReady ? " (API)" : ""}
                </option>
              ))}
            </select>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nome host (es. SMP Gino, Falix main)"
              className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key / Token"
              autoComplete="off"
              className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              placeholder="Server ID / Instance ID"
              className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="API Base URL (opz.)"
              className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="IP:porta o hostname pubblico (opz.)"
              className="w-full rounded border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            {def ? <p className="text-caption text-muted-foreground">{def.apiHint}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                className="btn-matrix flex-1 rounded-md border border-primary py-2 text-xs uppercase tracking-widest text-primary hover:bg-primary/10"
              >
                {editId ? "salva modifiche" : "salva host"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-matrix rounded-md border border-border px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground"
              >
                annulla
              </button>
            </div>
          </div>
        ) : null}

        {list.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Server}
              title="Nessun host"
              description="Aggiungi Falix o un altro provider con nome e API."
              action={
                <button
                  type="button"
                  onClick={() => quickAdd("falix")}
                  className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
                >
                  aggiungi FalixNodes
                </button>
              }
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((h) => (
              <li
                key={h.id}
                className={`rounded-lg border px-3 py-3 transition-colors ${
                  h.primary
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    title="Imposta host primario"
                    onClick={() => setList(setPrimaryHost(h.id))}
                    className={h.primary ? "text-primary" : "text-muted-foreground"}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{h.label}</p>
                      <StatusBadge
                        status={h.apiKey ? "online" : "offline"}
                        label={h.apiKey ? "api impostata" : "api mancante"}
                      />
                      {h.primary ? (
                        <span className="text-caption text-primary">primario ★</span>
                      ) : null}
                    </div>
                    <p className="text-caption text-muted-foreground">
                      {providerLabel(h.provider)}
                      {h.serverId
                        ? ` · srv ${h.serverId.slice(0, 10)}${h.serverId.length > 10 ? "…" : ""}`
                        : ""}
                      {" · "}
                      {maskKey(h.apiKey)}
                    </p>
                    {h.baseUrl ? (
                      <p className="truncate font-mono text-[10px] text-muted-foreground/80">
                        {h.baseUrl}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(h)}
                    className="btn-matrix text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                  >
                    modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => setList(removeHost(h.id))}
                    className="btn-matrix text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
