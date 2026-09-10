import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useParallax } from "@/hooks/use-reveal";
import { sectionFromPath, type SectionId } from "@/lib/section-themes";

/** Applica data-section sul documentElement in base alla route. */
export function SectionThemeProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const id: SectionId = sectionFromPath(pathname);
    document.documentElement.setAttribute("data-section", id);
    return () => {
      /* keep last theme until next page */
    };
  }, [pathname]);

  return <>{children}</>;
}

export function SectionBackdrop() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const id = sectionFromPath(pathname);
  const parallaxRef = useParallax<HTMLDivElement>(0.06);
  return (
    <div
      className="section-backdrop grain pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div ref={parallaxRef} className="absolute inset-0">
        <div className={`orb orb-a orb-${id} parallax-slow`} />
        <div className={`orb orb-b orb-${id} parallax-slow`} />
        <div className={`orb orb-c orb-${id} parallax-slow`} />
      </div>
      <div className="mesh-grid" />
      {/* vignetta cinematica + top glow per profondità Product Bold */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_0%,transparent_55%,oklch(0_0_0/0.42))]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.035] to-transparent" />
    </div>
  );
}
