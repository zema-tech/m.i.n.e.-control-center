import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ModeBadge } from "@/components/ModeBadge";
import { cn } from "@/lib/utils";

export type LogLineView = {
  ts?: string;
  level?: "info" | "warn" | "error" | string;
  message: string;
};

function levelClass(level?: string) {
  if (level === "error") return "text-destructive";
  if (level === "warn") return "text-warning";
  if (level === "info") return "text-primary/80";
  return "text-muted-foreground";
}

export function LogViewer({
  lines,
  title,
  onRefresh,
  demo,
  error,
  maxCollapsed = 40,
  className,
}: {
  lines: LogLineView[];
  title?: string;
  onRefresh?: () => void;
  demo?: boolean;
  error?: string | null;
  maxCollapsed?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stuckBottom, setStuckBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const visible = expanded ? lines : lines.slice(-maxCollapsed);
  const isDemo = Boolean(demo) || Boolean(error);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stuckBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, expanded, stuckBottom]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setStuckBottom(atBottom);
    setShowJump(!atBottom);
  }

  function jumpBottom() {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStuckBottom(true);
    setShowJump(false);
  }

  return (
    <section className={cn("panel relative p-4", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-section text-primary">{title ?? "Log"}</h2>
          <ModeBadge
            mode={isDemo ? "demo" : "live"}
            detail={
              error
                ? "errore"
                : demo
                  ? "no Falix attivo"
                  : "Falix"
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn-matrix flex items-center gap-1 text-caption uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> comprimi
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> espandi
              </>
            )}
          </button>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="btn-matrix text-muted-foreground hover:text-primary"
              aria-label="Aggiorna log"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      {isDemo ? (
        <p className="mb-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100/90">
          {error
            ? `Errore log: ${error}`
            : "Modalità DEMO — i log non arrivano da un server reale. Aggiungi un account Falix in Competenze e impostalo attivo."}
        </p>
      ) : null}

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className={cn(
          "overflow-y-auto font-mono text-[11px] leading-relaxed",
          expanded ? "max-h-72" : "max-h-40",
        )}
      >
        {visible.length === 0 ? (
          <p className="text-muted-foreground">Nessuna riga di log.</p>
        ) : (
          visible.map((l, i) => {
            const n = (expanded ? 0 : Math.max(0, lines.length - maxCollapsed)) + i + 1;
            return (
              <div key={`${n}-${l.message.slice(0, 24)}`} className="flex gap-2">
                <span className="w-7 shrink-0 select-none text-right text-[9px] text-muted-foreground/50">
                  {n}
                </span>
                <p className={cn("min-w-0 flex-1 break-all", levelClass(l.level))}>
                  {l.message}
                </p>
              </div>
            );
          })
        )}
      </div>

      {showJump ? (
        <button
          type="button"
          onClick={jumpBottom}
          className="btn-matrix absolute bottom-3 right-3 rounded-full border border-primary/50 bg-background/90 px-2.5 py-1 text-[9px] uppercase tracking-wider text-primary"
        >
          ↓ fine
        </button>
      ) : null}
    </section>
  );
}
