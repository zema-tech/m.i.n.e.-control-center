import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Cable,
  Code2,
  Home,
  KeyRound,
  LogOut,
  Menu,
  MessageSquare,
  Network,
  Server,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountSelector } from "@/components/AccountSelector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { loadAgentProfile } from "@/lib/agent-profile";
import { logout } from "@/lib/auth.functions";

type NavTo =
  | "/agent"
  | "/assistant"
  | "/code"
  | "/network"
  | "/skills"
  | "/hosts"
  | "/connectors";

const NAV_CORE: { to: NavTo; label: string; icon: typeof Home }[] = [
  { to: "/agent", label: "Agente", icon: Home },
  { to: "/assistant", label: "Chat", icon: MessageSquare },
  { to: "/code", label: "Codice", icon: Code2 },
  { to: "/network", label: "Rete", icon: Network },
];

const NAV_CAP: { to: NavTo; label: string; icon: typeof Home }[] = [
  { to: "/skills", label: "Competenze", icon: KeyRound },
  { to: "/hosts", label: "Host", icon: Server },
  { to: "/connectors", label: "Connettori", icon: Cable },
];

function NavLink({
  to,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: {
  to: NavTo;
  label: string;
  icon: typeof Home;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    pathname === to || (to === "/assistant" && pathname.startsWith("/assistant"));
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`btn-matrix group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium tracking-wide ${
        active
          ? "nav-item-active"
          : "border border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        }`}
      />
      {label}
    </Link>
  );
}

function SideNav({
  pathname,
  onNavigate,
  agentName,
}: {
  pathname: string;
  onNavigate?: () => void;
  agentName: string;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
        Principie
      </p>
      {NAV_CORE.map((item) => (
        <NavLink key={item.to} {...item} pathname={pathname} onNavigate={onNavigate} />
      ))}

      <p className="mb-1.5 mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
        Capacità
      </p>
      {NAV_CAP.map((item) => (
        <NavLink key={item.to} {...item} pathname={pathname} onNavigate={onNavigate} />
      ))}

      <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
          <Brain className="h-3.5 w-3.5" />
          {agentName}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          4 pilastri attivi · Groq · One MCP
        </p>
      </div>
    </nav>
  );
}

function BrandBlock({ agentName }: { agentName: string }) {
  return (
    <Link to="/agent" className="block group">
      <span className="logo-gradient font-display text-[1.35rem] font-bold tracking-tight transition-opacity group-hover:opacity-90">
        {agentName}
      </span>
      <span className="mt-0.5 block text-[11px] font-medium tracking-wide text-muted-foreground">
        Agente personale
      </span>
    </Link>
  );
}

export function AppShell({
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agentName, setAgentName] = useState("JARVIS");

  useEffect(() => {
    setAgentName(loadAgentProfile().name || "JARVIS");
  }, [pathname]);

  async function onLogout() {
    await doLogout({});
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen text-foreground">
      <aside className="shell-aside hidden w-[240px] shrink-0 flex-col md:flex">
        <div className="border-b border-white/[0.05] px-4 py-5">
          <BrandBlock agentName={agentName} />
          <div className="mt-4">
            <AccountSelector />
          </div>
        </div>

        <SideNav pathname={pathname} agentName={agentName} />

        <div className="border-t border-white/[0.05] p-3">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="btn-matrix flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shell-header sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="btn-matrix inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 text-muted-foreground hover:border-primary/30 hover:text-primary md:hidden"
                  aria-label="Apri menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[min(100%,17.5rem)] flex-col border-border bg-background p-0"
              >
                <SheetHeader className="border-b border-white/[0.05] px-4 py-5 text-left">
                  <SheetTitle className="sr-only">Navigazione</SheetTitle>
                  <BrandBlock agentName={agentName} />
                  <div className="mt-4">
                    <AccountSelector />
                  </div>
                </SheetHeader>
                <SideNav
                  pathname={pathname}
                  agentName={agentName}
                  onNavigate={() => setMobileOpen(false)}
                />
                <div className="mt-auto border-t border-white/[0.05] p-3">
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="btn-matrix flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-white/[0.04]"
                  >
                    <LogOut className="h-4 w-4" />
                    Esci
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 animate-fade-in">
              {title ? (
                <h1 className="text-title text-foreground">{title}</h1>
              ) : null}
              {subtitle ? <p className="text-caption mt-0.5">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AccountSelector className="md:hidden" />
            <span className="hidden items-center gap-1.5 rounded-full border border-white/6 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <Sparkles className="h-3 w-3 text-primary" />
              Online
            </span>
          </div>
        </header>

        <div className="page-enter flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
