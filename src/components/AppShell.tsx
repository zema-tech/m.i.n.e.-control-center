import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountSelector } from "@/components/AccountSelector";
import { SectionBackdrop } from "@/components/SectionTheme";
import { loadAgentProfile } from "@/lib/agent-profile";
import { logout } from "@/lib/auth.functions";
import { sectionFromPath } from "@/lib/section-themes";

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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
      <header className="shell-header sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/home" className="group flex shrink-0 items-center gap-2.5 no-underline">
            <span className="brand-mark" aria-hidden>
              <span className="brand-mark-ring" />
              <Sparkles className="relative h-4 w-4 text-primary" />
            </span>
            <span className="hidden sm:block">
              <span className="logo-gradient block font-display text-sm font-bold">
                {agentName}
              </span>
              <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Torna all'Hub
              </span>
            </span>
          </Link>
          <span className="h-7 w-px bg-white/[0.07]" aria-hidden />
          <div className="min-w-0">
            {title ? (
              <h1 className="truncate font-display text-base font-semibold">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="hidden truncate text-xs text-muted-foreground md:block">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AccountSelector />
          <button
            type="button"
            onClick={() => void onLogout()}
            className="btn-matrix inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] text-muted-foreground hover:text-primary"
            aria-label="Esci"
            title="Esci"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="page-enter relative z-10 min-h-0 flex-1">{children}</main>
    </div>
  );
}
