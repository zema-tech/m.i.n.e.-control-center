import { useEffect, useState } from "react";
import { Activity, Brain, Terminal, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/EmptyState";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import {
  AI_ACTIVITY_EVENT,
  activityForAccount,
  kindLabel,
  type AiActivity,
} from "@/lib/ai-activity";

function iconFor(kind: AiActivity["kind"]) {
  if (kind === "analysis" || kind === "chat") return Brain;
  if (kind === "execute_command" || kind === "propose_command") return Terminal;
  return Zap;
}

function toneFor(status: AiActivity["status"]): StatusTone {
  if (status === "error") return "error";
  if (status === "rejected") return "offline";
  if (status === "pending") return "pending";
  if (status === "done") return "online";
  return "offline";
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
    <section className="panel flex h-full flex-col p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-section text-primary">
          <Activity className="h-3.5 w-3.5" />
          Come agisce l&apos;IA · {accountLabel || "server"}
        </h2>
        <span className="text-caption font-mono text-muted-foreground">{items.length} eventi</span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Nessuna azione IA su questo server"
          description="Usa analisi neurale oppure la Chat IA mentre questo account è selezionato: compariranno qui proposte, esecuzioni e analisi."
          action={
            <Link
              to="/assistant"
              className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              apri chat IA
            </Link>
          }
        />
      ) : (
        <ul className="max-h-80 flex-1 space-y-2 overflow-y-auto">
          {items.map((ev) => {
            const Icon = iconFor(ev.kind);
            return (
              <li
                key={ev.id}
                className="rounded-md border border-border/70 bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-foreground">{ev.title}</span>
                      <span className="text-caption uppercase tracking-wider text-muted-foreground">
                        {kindLabel(ev.kind)}
                      </span>
                      <StatusBadge status={toneFor(ev.status)} label={ev.status} />
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
