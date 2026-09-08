import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Bot,
  Brain,
  Cable,
  Code2,
  Database,
  Home,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  Network,
  Palette,
  Server,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountSelector } from "@/components/AccountSelector";
import { SectionBackdrop } from "@/components/SectionTheme";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getAuthState, logout } from "@/lib/auth.functions";
import type { Permission } from "@/lib/auth.permissions";
import { sectionFromPath } from "@/lib/section-themes";

type NavTo =
  | "/home"
  | "/jarvis"
  | "/mine"
  | "/design"
  | "/code"
  | "/agent"
  | "/network"
  | "/skills"
  | "/hosts"
  | "/connectors"
  | "/memory"
  | "/gateway"
  | "/cowork"
  | "/pulse"
  | "/access";

const NAV: { to: NavTo; label: string; icon: typeof Home; perm: Permission }[] = [
  { to: "/home", label: "Hub", icon: LayoutGrid, perm: "home" },
  { to: "/jarvis", label: "JARVIS", icon: Sparkles, perm: "jarvis" },
  { to: "/mine", label: "M.I.N.E", icon: Network, perm: "mine" },
  { to: "/design", label: "A.R.T", icon: Palette, perm: "design" },
  { to: "/code", label: "P.R.O.M.P.T", icon: Code2, perm: "code" },
  { to: "/agent", label: "Sistema neurale", icon: Brain, perm: "agent" },
  { to: "/connectors", label: "Connettori", icon: Cable, perm: "connectors" },
  { to: "/memory", label: "Memoria", icon: Database, perm: "memory" },
  { to: "/gateway", label: "Gateway", icon: Bot, perm: "gateway" },
  { to: "/network", label: "Rete M.I.N.E", icon: Network, perm: "network" },
  { to: "/skills", label: "Competenze", icon: KeyRound, perm: "skills" },
  { to: "/hosts", label: "Host", icon: Server, perm: "hosts" },
  { to: "/cowork", label: "Cowork", icon: Users, perm: "cowork" },
  { to: "/pulse", label: "Pulse", icon: Activity, perm: "pulse" },
  { to: "/access", label: "Accesso", icon: KeyRound, perm: "access" },
];

function NavItems({
  items,
  pathname,
  onNavigate,
}: {
  items: typeof NAV;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || (to !== "/home" && pathname.startsWith(`${to}/`));
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium no-underline transition ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </>
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const getState = useServerFn(getAuthState);
  const doLogout = useServerFn(logout);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isAdmin, setIsAdmin] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-section", sectionFromPath(pathname));
  }, [pathname]);

  useEffect(() => {
    void getState({})
      .then((state) => {
        if (state.authenticated) {
          setPermissions(state.permissions ?? []);
          setIsAdmin(state.role === "admin");
        }
      })
      .catch(() => undefined);
  }, [getState]);

  const allowed = NAV.filter((item) => isAdmin || permissions.includes(item.perm));
  const primary = allowed.slice(0, 5);
  const secondary = allowed.slice(5);

  async function onLogout() {
    await doLogout({});
    window.location.href = "/login";
  }

  return (
    <div className="relative min-h-screen text-foreground">
      <SectionBackdrop />
      <header className="shell-header sticky top-0 z-30 border-b border-white/[0.055] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Apri navigazione"
                className="rounded-lg border border-white/[0.07] p-2 text-muted-foreground hover:text-primary md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[min(88vw,19rem)] flex-col border-border bg-background p-0"
            >
              <SheetHeader className="border-b border-white/[0.055] p-5 text-left">
                <SheetTitle className="font-display text-base tracking-[0.14em] text-foreground">
                  OMNICORE
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                <NavItems
                  items={allowed}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </nav>
              <div className="border-t border-white/[0.055] p-3">
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-white/5 hover:text-rose-300"
                >
                  <LogOut className="h-3.5 w-3.5" /> Esci
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/home" className="mr-1 flex shrink-0 items-center gap-2 no-underline">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </span>
            <span className="hidden font-display text-xs font-semibold tracking-[0.14em] text-foreground sm:block">
              OMNICORE
            </span>
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
            <NavItems items={primary} pathname={pathname} />
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden lg:block">
              <AccountSelector />
            </div>
            {secondary.length ? (
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-white/[0.07] px-3 py-2 text-xs text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  >
                    <Menu className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Strumenti</span>
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="flex w-[min(88vw,20rem)] flex-col border-border bg-background p-0"
                >
                  <SheetHeader className="border-b border-white/[0.055] p-5 text-left">
                    <SheetTitle className="font-display text-base">Strumenti Omnicore</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-1 p-3">
                    <NavItems items={secondary} pathname={pathname} />
                  </nav>
                </SheetContent>
              </Sheet>
            ) : null}
            <button
              type="button"
              aria-label="Esci"
              onClick={() => void onLogout()}
              className="hidden rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-rose-300 sm:block"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {title || subtitle ? (
          <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 border-t border-white/[0.035] px-4 py-3 sm:px-6">
            <h1 className="text-title text-foreground">{title}</h1>
            {subtitle ? <p className="hidden truncate text-caption sm:block">{subtitle}</p> : null}
          </div>
        ) : null}
      </header>
      <main className="page-enter relative z-10">{children}</main>
    </div>
  );
}
