import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
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
  return (
    <div className="section-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className={`orb orb-a orb-${id}`} />
      <div className={`orb orb-b orb-${id}`} />
      <div className={`orb orb-c orb-${id}`} />
      <div className="mesh-grid" />
    </div>
  );
}
