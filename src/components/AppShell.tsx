import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Code2,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  Network,
  Palette,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountSelector } from "@/components/AccountSelector";
import { SectionBackdrop } from "@/components/SectionTheme";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { loadAgentProfile } from "@/lib/agent-profile";
import { getAuthState, logout } from "@/lib/auth.functions";
import type { Permission } from "@/lib/auth.permissions";
import { sectionFromPath } from "@/lib/section-themes";

type NavTo = "/home" | "/jarvis" | "/mine" | "/design" | "/code" | "/access";

const NAV_ITEMS: { to: NavTo; label: string; icon: typeof LayoutGrid; perm: Permission }[] = [
  { to: "/home", label: "Hub", icon: LayoutGrid, perm: "home" },
  { to: "/jarvis", label: "JARVIS", icon: Sparkles, perm: "jarvis" },
  { to: "/mine", label: "M.I.N.E", icon: Network, perm: "mine" },
  { to: "/design", label: "Design", icon: Palette, perm: "design" },
  { to: "/code", label: "Code", icon: Code2, perm: "code" },
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
  icon: typeof LayoutGrid;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = pathname === to || (to !== "/home" && pathname.startsWith(`${to}/`));
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`btn-matrix group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium tracking-wide ${
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
  permissions,
  isAdmin,
}: {
  pathname: string;
  onNavigate?: () => void;
  agentName: string;
  permissions: Permission[];
  isAdmin: boolean;
}) {
  const section = sectionFromPath(pathname);
  const can = (p: Permission) => isAdmin || permissions.includes(p);
  const items = NAV_ITEMS.filter((i) => can(i.perm));
  const showAccess = isAdmin || permissions.includes("access");

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      {items.length > 0 ? (
        <>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            Navigazione
          </p>
          {items.map((item) => (
            <NavLink key={item.to} {...item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </>
      ) : null}

      {showAccess ? (
        <div className="mt-4">
          <NavLink
            to="/access"
            label="Accesso"
            icon={KeyRound}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}

      <div className="mt-auto rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
        <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
          <Brain className="h-3.5 w-3.5" />
          {agentName}
        </p>
        <p className="text-[11px] capitalize text-muted-foreground">
          Tema · {section}
          {!isAdmin ? " · ospite" : ""}
        </p>
      </div>
    </nav>
  );
}

function BrandBlock({ agentName }: { agentName: string }) {
  return (
    <Link to="/home" className="group block">
      <span className="logo-gradient font-display text-[1.3rem] font-bold tracking-tight transition-opacity group-hover:opacity-90">
        {agentName}
      </span>
      <span className="mt-0.5 block text-[11px] font-medium tracking-wide text-muted-foreground">
        Omnicore
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
  const doAuth = useServerFn(getAuthState);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agentName, setAgentName] = useState("JARVIS");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isAdmin, setIsAdmin] = useState(true);

  useEffect(() => {
    setAgentName(loadAgentProfile().name || "JARVIS");
    document.documentElement.setAttribute("data-section", sectionFromPath(pathname));
  }, [pathname]);

  useEffect(() => {
    void (async () => {
      try {
        const state = await doAuth({});
        if (state.authenticated) {
          setIsAdmin(state.role === "admin");
          setPermissions(state.permissions ?? []);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [doAuth]);

  async function onLogout() {
    await doLogout({});
    window.location.href = "/login";
  }

  return (
    <div className="relative flex min-h-screen text-foreground">
      <SectionBackdrop />

      <aside className="shell-aside relative z-10 hidden w-[232px] shrink-0 flex-col md:flex">
        <div className="border-b border-white/[0.045] px-4 py-4">
          <BrandBlock agentName={agentName} />
          <div className="mt-3">
            <AccountSelector />
          </div>
        </div>

        <SideNav
          pathname={pathname}
          agentName={agentName}
          permissions={permissions}
          isAdmin={isAdmin}
        />

        <div className="border-t border-white/[0.045] p-3">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="btn-matrix flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="shell-header sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
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
                className="flex w-[min(100%,17rem)] flex-col border-border bg-background p-0"
              >
                <SheetHeader className="border-b border-white/[0.045] px-4 py-4 text-left">
                  <SheetTitle className="sr-only">Navigazione</SheetTitle>
                  <BrandBlock agentName={agentName} />
                  <div className="mt-3">
                    <AccountSelector />
                  </div>
                </SheetHeader>
                <SideNav
                  pathname={pathname}
                  agentName={agentName}
                  permissions={permissions}
                  isAdmin={isAdmin}
                  onNavigate={() => setMobileOpen(false)}
                />
                <div className="mt-auto border-t border-white/[0.045] p-3">
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="btn-matrix flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-white/[0.04]"
                  >
                    <LogOut className="h-4 w-4" />
                    Esci
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 animate-fade-in">
              {title ? <h1 className="text-title text-foreground">{title}</h1> : null}
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
              Online
            </span>
          </div>
        </header>

        <div className="page-enter flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
