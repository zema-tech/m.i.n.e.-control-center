import { cn } from "@/lib/utils";

/** Badge impossibile da confondere: LIVE vs DEMO. */
export function ModeBadge({
  mode,
  className,
  detail,
}: {
  mode: "live" | "demo";
  className?: string;
  detail?: string;
}) {
  const live = mode === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]",
        live
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
          : "border-amber-400/50 bg-amber-500/15 text-amber-200",
        className,
      )}
      title={detail}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          live ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
        )}
      />
      {live ? "LIVE" : "DEMO"}
      {detail ? (
        <span className="max-w-[140px] truncate font-sans text-[9px] font-normal normal-case tracking-normal opacity-80">
          {detail}
        </span>
      ) : null}
    </span>
  );
}
