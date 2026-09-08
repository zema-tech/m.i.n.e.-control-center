import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Home, LogOut, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountSelector } from "@/components/AccountSelector";
import { SectionBackdrop } from "@/components/SectionTheme";
import { loadAgentProfile } from "@/lib/agent-profile";
import { logout } from "@/lib/auth.functions";
import { sectionFromPath } from "@/lib/section-themes";
import { useRouterState } from "@tanstack/react-router";

/** Header compatto senza sidebar globale — per sezioni diverse da JARVIS. */
export function CompactShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const doLogout = useServerFn(logout);
  const [agentName, setAgentName] = useState("JARVIS");

  useEffect(() => {
    setAgentName(loadAgentProfile().name || "JARVIS");
    document.documentElement.setAttribute("data-section", sectionFromPath(pathname));
  }, [pathname]);

  async function onLogout() {
    await doLogout({});
    window.location.href = "/login";
  }

  return (
    <div className="relative flex min-h-screen flex-col text-foreground">
      <SectionBackdrop />
      <header className="shell-header relative z-20 sticky top-0 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-1.5 text-[12px] text-muted-foreground no-underline transition hover:border-primary/30 hover:text-primary"
          >
            <Home className="h-3.5 w-3.5" />
            Hub
          </Link>
          <div className="min-w-0">
            {title ? (
              <h1 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                {title}
              </h1>
            ) : null}
            {subtitle ? <p className="text-caption mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AccountSelector />
          <span className="hidden text-[11px] text-muted-foreground sm:inline">{agentName}</span>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="btn-matrix inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Esci
          </button>
        </div>
      </header>
      <div className="relative z-10 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
