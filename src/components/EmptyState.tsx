import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-10 text-center",
        className,
      )}
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/5">
        <Icon className="h-6 w-6 text-primary animate-flicker" />
        <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_20px_oklch(0.86_0.28_145_/_0.25)]" />
      </div>
      <div className="max-w-xs space-y-1">
        <p className="text-label text-foreground">{title}</p>
        {description ? (
          <p className="text-caption leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
