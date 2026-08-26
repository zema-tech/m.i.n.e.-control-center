import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AccountsPanel } from "@/components/AccountsPanel";
import { AppShell } from "@/components/AppShell";
import { ModeBadge } from "@/components/ModeBadge";
import {
  downloadBrainBackup,
  importBrainBackup,
} from "@/lib/agent-brain";
import { loadAccounts, SKILL_META, type ApiAccount, type SkillId } from "@/lib/accounts";
import { getAuthState } from "@/lib/auth.functions";
import { getSystemHealth } from "@/lib/panel.functions";
import type { SystemHealth } from "@/lib/system-health.server";

export const Route = createFileRoute("/skills")({
  head: () => ({ meta: [{ title: "Competenze — Health" }] }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: SkillsPage,
});

function SkillsPage() {
  const fetchHealth = useServerFn(getSystemHealth);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccounts(loadAccounts());
  }, []);

  async function loadHealth() {
    try {
      setHealthErr(null);
      const h = await fetchHealth({});
      setHealth(h);
    } catch (e) {
      setHealthErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  const allSkills = Object.keys(SKILL_META) as SkillId[];
  const falix = accounts.filter((a) => a.provider === "falix");
  const active = accounts.find((a) => a.active);
  const hasLiveFalix = Boolean(
    active?.provider === "falix" && active.apiKey && active.serverId,
  );

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const res = importBrainBackup(data);
        setImportMsg(res.message);
      } catch {
        setImportMsg("JSON non valido");
      }
    };
    reader.readAsText(file);
  }

  return (
    <AppShell
      title="Competenze"
      subtitle="Account · health env · backup cervello"
    >
      <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:grid-cols-2 sm:p-6">
        <div className="space-y-4">
          <div className="panel-spacious">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-section text-primary">Operatività</h2>
              <ModeBadge
                mode={hasLiveFalix ? "live" : "demo"}
                detail={hasLiveFalix ? active?.label : "nessun Falix attivo"}
              />
            </div>
            <p className="text-caption mb-3">
              {hasLiveFalix
                ? "Account Falix attivo: log, power e console possono essere LIVE."
                : "Senza Falix attivo resti in DEMO (log simulati, comandi non reali)."}
            </p>
            <AccountsPanel accounts={accounts} onChange={setAccounts} />
          </div>

          <div className="panel-spacious">
            <h2 className="mb-2 text-section text-primary">Backup cervello</h2>
            <p className="text-caption mb-3">
              Esporta carattere, memoria e regole (JSON). Utile prima di cancellare i dati del
              browser.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadBrainBackup()}
                className="btn-matrix flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10"
              >
                <Download className="h-3.5 w-3.5" /> esporta JSON
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-matrix flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary"
              >
                <Upload className="h-3.5 w-3.5" /> importa JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            {importMsg ? (
              <p className="mt-2 text-[11px] text-primary">{importMsg}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel-spacious">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-section text-primary">Health env</h2>
              <button
                type="button"
                onClick={() => void loadHealth()}
                className="btn-matrix text-muted-foreground hover:text-primary"
                aria-label="Aggiorna health"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {healthErr ? (
              <p className="text-sm text-destructive">{healthErr}</p>
            ) : null}
            {health ? (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <ModeBadge mode={health.readyOps ? "live" : "demo"} detail="login/sessione" />
                  <ModeBadge mode={health.readyAi ? "live" : "demo"} detail="Groq IA" />
                  <ModeBadge mode={health.readyOne ? "live" : "demo"} detail="One API" />
                </div>
                <ul className="space-y-2">
                  {health.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-border/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-foreground">{item.label}</span>
                        <span
                          className={
                            item.ok
                              ? "text-[10px] font-bold uppercase text-emerald-400"
                              : item.required
                                ? "text-[10px] font-bold uppercase text-amber-300"
                                : "text-[10px] uppercase text-muted-foreground"
                          }
                        >
                          {item.ok ? "ok" : item.required ? "manca" : "opz."}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{item.detail}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Imposta le variabili su Vercel. Per le mani One reali:{" "}
                  <span className="text-primary">ONE_API_KEY</span> (dashboard withone).
                </p>
              </>
            ) : (
              !healthErr && <p className="text-caption">Caricamento health…</p>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-primary">Account Falix</h2>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Collegati: <span className="text-primary">{falix.length}</span>
              {active ? (
                <>
                  {" "}· in uso: <span className="text-primary">{active.label}</span>
                </>
              ) : null}
            </p>
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-primary">Mappa competenze</h2>
            <ul className="space-y-2">
              {allSkills.map((s) => (
                <li key={s} className="rounded-md border border-border/60 px-3 py-2">
                  <p className="text-sm text-foreground">{SKILL_META[s].label}</p>
                  <p className="text-[11px] text-muted-foreground">{SKILL_META[s].hint}</p>
                  <p className="mt-1 text-[10px] text-primary/80">
                    Attiva su:{" "}
                    {accounts.filter((a) => a.skills.includes(s)).map((a) => a.label).join(", ") ||
                      "nessun account"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
