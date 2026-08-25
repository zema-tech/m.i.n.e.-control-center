import { cn } from "@/lib/utils";

/** Skeleton Matrix: glow verde pulsante invece dello shimmer grigio. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-skeleton-glow rounded-md bg-primary/10",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
