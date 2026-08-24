import { useEffect, useState } from "react";
import { Activity, Brain, Terminal, Zap } from "lucide-react";

import {
  AI_ACTIVITY_EVENT,
  activityForAccount,
  kindLabel,
  statusColor,
  type AiActivity,
} from "@/lib/ai-activity";

function iconFor(kind: AiActivity["kind"]) {
  if (kind === "analysis" || kind === "chat") return Brain;
  if (kind === "execute_command" || kind === "propose_command") return Terminal;
  return Zap;
}

export function AiActivityPanel({
  accountId,
  accountLabel,
}: {
  accountId: string;
  accountLabel: string;
}) {
  const [items, setItems] = useState<AiActivity[]>([]);

  useEffect(() => {
    const refresh = () => setItems(activityForAccount(accountId, 40));
    refresh();
    window.addEventListener(AI_ACTIVITY_EVENT, refresh);
    return () => window.removeEventListener(AI_ACTIVITY_EVENT, refresh);
  }, [accountId]);

  return (
    <section className="rounded-lg border border-border bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
          <Activity className="h-3.5 w-3.5" />
          Come agisce l&apos;IA · {accountLabel || "server"}
        </h2>
        <span className="font-mono text-[10px] text-muted-foreground">{items.length} eventi</span>
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Nessuna azione IA su questo server. Usa <span className="text-primary">analisi neurale</span>{" "}
          oppure la <span className="text-primary">Chat IA</span> mentre questo account è selezionato:
          compariranno qui proposte, esecuzioni e analisi.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {items.map((ev) => {
            const Icon = iconFor(ev.kind);
            return (
              <li
                key={ev.id}
                className="rounded-md border border-border/70 bg-background/60 px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-foreground">{ev.title}</span>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {kindLabel(ev.kind)}
                      </span>
                      <span className={`text-[9px] uppercase ${statusColor(ev.status)}`}>
                        {ev.status}
                      </span>
                    </div>
                    {ev.detail ? (
                      <p className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                        {ev.detail.slice(0, 280)}
                        {ev.detail.length > 280 ? "…" : ""}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[9px] text-muted-foreground/70">
                      {new Date(ev.ts).toLocaleString("it-IT")}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
