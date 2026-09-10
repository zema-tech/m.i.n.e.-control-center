import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

type Variant = "up" | "left" | "right" | "scale" | "clip";

export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      data-variant={variant === "up" ? undefined : variant}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
      className={cn("reveal", visible && "is-visible", className)}
    >
      {children}
    </Tag>
  );
}

export function Stagger({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>(0.12);
  return (
    <div
      ref={ref}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
      className={cn("stagger", visible && "is-visible", className)}
    >
      {children}
    </div>
  );
}
