import { cn } from "@/lib/utils";

export type StatusTone = "online" | "offline" | "error" | "pending" | "warning";

const TONE: Record<
  StatusTone,
  { dot: string; label: string; ring?: string }
> = {
  online: {
    dot: "bg-primary shadow-[0_0_8px_var(--color-primary)]",
    label: "text-primary",
    ring: "animate-status-pulse",
  },
  offline: {
    dot: "bg-muted-foreground/50",
    label: "text-muted-foreground",
  },
  error: {
    dot: "bg-destructive shadow-[0_0_8px_var(--color-destructive)]",
    label: "text-destructive",
    ring: "animate-status-pulse",
  },
  pending: {
    dot: "bg-warning shadow-[0_0_6px_var(--color-warning)]",
    label: "text-warning",
    ring: "animate-status-pulse",
  },
  warning: {
    dot: "bg-warning",
    label: "text-warning",
  },
};

const DEFAULT_LABEL: Record<StatusTone, string> = {
  online: "online",
  offline: "offline",
  error: "error",
  pending: "in corso",
  warning: "attenzione",
};

export function StatusBadge({
  status,
  label,
  size = "sm",
  className,
}: {
  status: StatusTone;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = TONE[status] ?? TONE.offline;
  const text = label ?? DEFAULT_LABEL[status];
  const dotSize = size === "md" ? "h-2.5 w-2.5" : "h-1.5 w-1.5";
  const textSize = size === "md" ? "text-[11px]" : "text-[9px]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 uppercase tracking-wider",
        t.label,
        textSize,
        className,
      )}
    >
      <span className="relative flex shrink-0">
        <span className={cn("rounded-full", dotSize, t.dot)} />
        {t.ring ? (
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-60",
              t.dot.split(" ")[0],
              t.ring,
            )}
          />
        ) : null}
      </span>
      {text}
    </span>
  );
}
