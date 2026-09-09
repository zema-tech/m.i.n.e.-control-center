"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Link2 } from "lucide-react";

import {
  addCustomMcpServer,
  loadCustomMcpServers,
  removeCustomMcpServer,
  type CustomMcpServer,
} from "@/lib/mcp-custom";
import { listHttpMcpServers } from "@/lib/mcp-servers";

export function CustomMcpPanel() {
  const [list, setList] = useState<CustomMcpServer[]>([]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [auth, setAuth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const presets = listHttpMcpServers();

  useEffect(() => {
    setList(loadCustomMcpServers());
  }, []);

  function add() {
    setError(null);
    try {
      addCustomMcpServer({ label, url, authHeader: auth || undefined });
      setList(loadCustomMcpServers());
      setLabel("");
      setUrl("");
      setAuth("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function remove(id: string) {
    setList(removeCustomMcpServer(id));
  }

  return (
    <section className="panel-spacious space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 text-primary" />
        <p className="text-label text-primary">MCP custom (URL)</p>
      </div>
      <p className="text-caption text-muted-foreground">
        Aggiungi qualsiasi server MCP streamable-http. Esempio config:
      </p>
      <pre className="overflow-x-auto rounded border border-border bg-background/60 p-3 font-mono text-[10px] text-muted-foreground">
        {`{
  "servers": {
    "mio": { "type": "http", "url": "https://…/mcp" }
  }
}`}
      </pre>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome (es. Mio MCP)"
          className="rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/mcp"
          className="rounded border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
        />
        <input
          value={auth}
          onChange={(e) => setAuth(e.target.value)}
          placeholder="Token opzionale (Bearer … o Header: valore)"
          className="sm:col-span-2 rounded border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary"
        />
      </div>
      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={add}
        className="btn-matrix inline-flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
      >
        <Plus className="h-3 w-3" /> aggiungi MCP
      </button>

      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-background/40 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">{s.label}</p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-primary/80">{s.url}</p>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                  id={s.id} → mcp_call server={s.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="btn-matrix inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" /> rimuovi
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-muted-foreground">Nessun MCP custom ancora.</p>
      )}

      <div className="border-t border-border/60 pt-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preset HTTP pronti</p>
        <ul className="mt-2 space-y-1">
          {presets.map((p) => (
            <li key={p.id} className="font-mono text-[10px] text-muted-foreground">
              <span className="text-primary">{p.id}</span> → {p.url}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
