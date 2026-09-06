import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Bot,
  Pause,
  Play,
  Shield,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import {
  activeCredentials,
  getActiveFalixAccount,
} from "@/lib/accounts";
import { buildBrainContextForPrompt } from "@/lib/agent-brain";
import { logAiActivity } from "@/lib/ai-activity";
import { getAuthState } from "@/lib/auth.functions";
import {
  appendLog,
  buildCoworkStepPrompt,
  canAutoApprove,
  clearLog,
  consentSummary,
  createGoal,
  loadConsent,
  loadGoal,
  loadLog,
  patchGoal,
  saveConsent,
  type ConsentLevel,
  type CoworkGoal,
  type CoworkLogEntry,
} from "@/lib/cowork";
import { getAction, type ActionRisk } from "@/lib/falix-actions";
import {
  CONNECTOR_MCP_TOOLS,
  GDRIVE_MCP_TOOLS,
  MEGA_MCP_TOOLS,
  ONE_MCP_TOOLS,
  RESEARCH_MCP_TOOLS,
} from "@/lib/mcp";
import { askAssistant, runFalixAction, runOneHand } from "@/lib/panel.functions";
import { executeResidentCalls } from "@/lib/resident-tools";

export const Route = createFileRoute("/cowork")({
  head: () => ({
    meta: [
      { title: "Cowork — JARVIS autonomo" },
      {
        name: "description",
        content: "Obiettivi autonomi e policy di consenso per azioni senza micro-approve.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: CoworkPage,
});

const ONE_IDS = new Set(ONE_MCP_TOOLS.map((t) => t.name));
const RESEARCH_IDS = new Set(RESEARCH_MCP_TOOLS.map((t) => t.name));
const STORAGE_IDS = new Set([...MEGA_MCP_TOOLS, ...GDRIVE_MCP_TOOLS].map((t) => t.name));
const CONNECTOR_IDS = new Set(CONNECTOR_MCP_TOOLS.map((t) => t.name));

function resolveRisk(id: string): ActionRisk {
  if (ONE_IDS.has(id)) return ONE_MCP_TOOLS.find((t) => t.name === id)?.risk ?? "write";
  if (RESEARCH_IDS.has(id)) return "read";
  if (STORAGE_IDS.has(id)) {
    return [...MEGA_MCP_TOOLS, ...GDRIVE_MCP_TOOLS].find((t) => t.name === id)?.risk ?? "write";
  }
  if (CONNECTOR_IDS.has(id)) return CONNECTOR_MCP_TOOLS.find((t) => t.name === id)?.risk ?? "write";
  return getAction(id)?.risk ?? "critical";
}

function CoworkPage() {
  const ask = useServerFn(askAssistant);
  const execAction = useServerFn(runFalixAction);
  const execOne = useServerFn(runOneHand);

  const [consent, setConsent] = useState<ConsentLevel>(loadConsent);
  const [goal, setGoal] = useState<CoworkGoal | null>(null);
  const [log, setLog] = useState<CoworkLogEntry[]>([]);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [maxSteps, setMaxSteps] = useState(5);
  const [busy, setBusy] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    setGoal(loadGoal());
    setLog(loadLog());
    setConsent(loadConsent());
  }, []);

  function updateConsent(patch: Partial<ConsentLevel>) {
    const next = saveConsent({ ...consent, ...patch });
    setConsent(next);
  }

  function onCreateGoal() {
    if (!title.trim()) return;
    const g = createGoal(title, brief, maxSteps);
    setGoal(g);
    setLog(appendLog("info", `Obiettivo creato: ${g.title}`, g.brief));
    setTitle("");
    setBrief("");
  }

  const runStep = useCallback(
    async (g: CoworkGoal) => {
      const step = g.stepsDone + 1;
      const credentials = activeCredentials();
      const active = getActiveFalixAccount();
      const prompt = buildCoworkStepPrompt(g, step);

      setLog(appendLog("think", `Passo ${step}/${g.maxSteps}`, "Ragionamento…"));

      const res = await ask({
        data: {
          question: prompt,
          history: [],
          brainContext: buildBrainContextForPrompt(),
          ...(credentials ? { credentials } : {}),
          accountLabel: active?.label,
          swarmMode: "rapido",
        },
      });

      setLog(
        appendLog(
          "think",
          `Risposta passo ${step}`,
          (res.risposta ?? "").slice(0, 800),
        ),
      );

      const c = loadConsent();
      if (c.autoResident) {
        const rr = executeResidentCalls(
          Array.isArray((res as { resident?: unknown }).resident)
            ? (res as { resident: Parameters<typeof executeResidentCalls>[0] }).resident
            : [],
        );
        for (const r of rr) {
          setLog(appendLog("resident", r.tool, r.output.slice(0, 400)));
        }
      }

      for (const a of res.azioni ?? []) {
        const risk = resolveRisk(a.id);
        if (!canAutoApprove(risk, c)) {
          setLog(
            appendLog(
              "queued",
              `${a.id} [${risk}] in attesa consenso`,
              a.motivo || "Abilita auto-write/critical o approva in Chat",
            ),
          );
          continue;
        }

        try {
          if (ONE_IDS.has(a.id)) {
            const oneRes = await execOne({
              data: {
                tool: a.id as
                  | "list_one_integrations"
                  | "search_one_platform_actions"
                  | "get_one_action_knowledge"
                  | "execute_one_action",
                params: a.params ?? {},
                approved: risk !== "read",
              },
            });
            setLog(appendLog("auto", `One ${a.id}`, oneRes.output.slice(0, 500)));
          } else {
            const out = await execAction({
              data: {
                id: a.id,
                params: a.params ?? {},
                approved: risk !== "read",
                ...(credentials ? { credentials } : {}),
              },
            });
            setLog(
              appendLog(
                "auto",
                `${a.id} [${risk}]`,
                String(out.output ?? "").slice(0, 500),
              ),
            );
          }
          logAiActivity({
            accountId: active?.id ?? "unknown",
            accountLabel: active?.label ?? "server",
            kind: "execute_action",
            title: `Cowork auto: ${a.id}`,
            detail: a.motivo,
            status: "done",
          });
        } catch (e) {
          setLog(
            appendLog(
              "error",
              `Fallita ${a.id}`,
              e instanceof Error ? e.message : String(e),
            ),
          );
        }
      }

      for (const cmd of res.comandi ?? []) {
        if (!canAutoApprove("write", c)) {
          setLog(appendLog("queued", `Console: ${cmd.comando}`, cmd.motivo));
          continue;
        }
        try {
          const out = await execAction({
            data: {
              id: "command.send",
              params: { command: cmd.comando },
              approved: true,
              ...(credentials ? { credentials } : {}),
            },
          });
          setLog(
            appendLog(
              "auto",
              `Console /${cmd.comando}`,
              String(out.output ?? "").slice(0, 400),
            ),
          );
        } catch (e) {
          setLog(
            appendLog(
              "error",
              `Console fallita`,
              e instanceof Error ? e.message : String(e),
            ),
          );
        }
      }

      const doneHint = /obiettivo (raggiunto|completato)|nulla da fare|nessun altro passo/i.test(
        res.risposta ?? "",
      );
      return { doneHint, ok: res.ok !== false };
    },
    [ask, execAction, execOne],
  );

  async function startLoop() {
    const g = loadGoal();
    if (!g || busy) return;
    stopRef.current = false;
    setBusy(true);
    patchGoal({ status: "running" });
    setGoal(loadGoal());
    setLog(appendLog("info", "Cowork avviato", consentSummary(loadConsent())));

    try {
      let current = loadGoal()!;
      while (
        current &&
        current.stepsDone < current.maxSteps &&
        !stopRef.current &&
        current.status === "running"
      ) {
        const { doneHint, ok } = await runStep(current);
        current =
          patchGoal({
            stepsDone: current.stepsDone + 1,
            status: doneHint ? "done" : ok ? "running" : "error",
          }) ?? current;
        setGoal(current);
        if (doneHint || !ok) break;
        await new Promise((r) => setTimeout(r, 600));
        current = loadGoal()!;
      }
      if (stopRef.current) {
        patchGoal({ status: "paused" });
        setLog(appendLog("info", "Cowork in pausa"));
      } else if (loadGoal()?.status === "running") {
        patchGoal({ status: "done" });
        setLog(appendLog("info", "Limite passi raggiunto o obiettivo chiuso"));
      }
      setGoal(loadGoal());
    } catch (e) {
      patchGoal({ status: "error" });
      setGoal(loadGoal());
      setLog(
        appendLog("error", "Loop interrotto", e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setBusy(false);
    }
  }

  function stopLoop() {
    stopRef.current = true;
    patchGoal({ status: "paused" });
    setGoal(loadGoal());
  }

  return (
    <AppShell title="Cowork" subtitle="Obiettivi autonomi · consenso azioni">
      <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:grid-cols-2 sm:p-6">
        <section className="panel-spacious space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-section text-primary">Consenso</h2>
          </div>
          <p className="text-caption">
            Senza micro "approva / nega" su ogni click. Scegli cosa JARVIS può fare da solo in
            Cowork.
          </p>

          <label className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent.autoRead}
              onChange={(e) => updateConsent({ autoRead: e.target.checked })}
            />
            <span>
              <span className="text-sm text-foreground">Auto lettura</span>
              <span className="block text-caption">Log, status, list file, research…</span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent.autoWrite}
              onChange={(e) => updateConsent({ autoWrite: e.target.checked })}
            />
            <span>
              <span className="text-sm text-foreground">Auto scrittura</span>
              <span className="block text-caption">
                Console, restart, write file, One execute…
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent.autoCritical}
              onChange={(e) => {
                if (e.target.checked && !consent.criticalAck) return;
                updateConsent({ autoCritical: e.target.checked });
              }}
            />
            <span>
              <span className="flex items-center gap-1 text-sm text-amber-100">
                <AlertTriangle className="h-3.5 w-3.5" /> Auto critical
              </span>
              <span className="block text-caption">
                Delete, reinstall, wipe — richiede ack sotto.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent.criticalAck}
              onChange={(e) =>
                updateConsent({
                  criticalAck: e.target.checked,
                  autoCritical: e.target.checked ? consent.autoCritical : false,
                })
              }
            />
            <span className="text-caption">
              Ho capito che critical può essere irreversibile. Abilito la possibilità di
              auto-critical.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent.autoResident}
              onChange={(e) => updateConsent({ autoResident: e.target.checked })}
            />
            <span>
              <span className="text-sm text-foreground">Auto resident</span>
              <span className="block text-caption">Memoria, pattern, propose_skill</span>
            </span>
          </label>

          <p className="font-mono text-[11px] text-muted-foreground">
            Policy: {consentSummary(consent)}
          </p>
        </section>

        <section className="panel-spacious space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-section text-primary">Obiettivo</h2>
          </div>
          <p className="text-caption">
            Un goal ad alto livello. JARVIS decide i passi (fino a N) senza micro-comandi.
          </p>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es. Stabilizza TPS e prepara backup"
            className="input-field"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="Contesto opzionale: plugin sospetti, orari, vincoli…"
            className="input-field resize-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-caption">
              Max passi{" "}
              <input
                type="number"
                min={1}
                max={12}
                value={maxSteps}
                onChange={(e) => setMaxSteps(Number(e.target.value) || 5)}
                className="ml-2 w-16 rounded border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={onCreateGoal}
              className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10"
            >
              Imposta obiettivo
            </button>
          </div>

          {goal ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="font-display text-lg text-foreground">{goal.title}</p>
              {goal.brief ? <p className="mt-1 text-caption">{goal.brief}</p> : null}
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {goal.status} · {goal.stepsDone}/{goal.maxSteps}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startLoop()}
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  {busy ? "Lavora…" : "Lavora"}
                </button>
                <button
                  type="button"
                  disabled={!busy}
                  onClick={stopLoop}
                  className="btn-matrix inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  <Pause className="h-3.5 w-3.5" /> Pausa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopRef.current = true;
                    patchGoal({ status: "idle", stepsDone: 0 });
                    setGoal(loadGoal());
                    setLog(appendLog("info", "Sessione azzerata"));
                  }}
                  className="btn-matrix inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  <Square className="h-3.5 w-3.5" /> Reset passi
                </button>
              </div>
            </div>
          ) : (
            <p className="text-caption">Nessun obiettivo attivo.</p>
          )}
        </section>

        <section className="panel-spacious space-y-3 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-section text-primary">Diario cowork</h2>
            <button
              type="button"
              onClick={() => {
                clearLog();
                setLog([]);
              }}
              className="btn-matrix inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> svuota
            </button>
          </div>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {log.length === 0 ? (
              <li className="text-caption">Il diario si riempie quando avvii "Lavora".</li>
            ) : (
              log.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-border/50 bg-background/30 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                      {e.kind}
                    </span>
                    <span className="text-[12px] text-foreground">{e.title}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  {e.detail ? (
                    <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
                      {e.detail}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
