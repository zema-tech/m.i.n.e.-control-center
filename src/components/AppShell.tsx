import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Cable,
  KeyRound,
  LogOut,
  Menu,
  MessageSquare,
  Network,
  Server,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { AccountSelector } from "@/components/AccountSelector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logout } from "@/lib/auth.functions";

const NAV = [
  { to: "/network" as const, label: "Rete / pallini", icon: Network },
  { to: "/assistant" as const, label: "Chat IA", icon: MessageSquare },
  { to: "/skills" as const, label: "Competenze", icon: KeyRound },
  { to: "/hosts" as const, label: "Host", icon: Server },
  { to: "/connectors" as const, label: "Connettori", icon: Cable },
];

function SideNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active =
          pathname === item.to ||
          (item.to === "/assistant" && pathname.startsWith("/assistant"));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`btn-matrix flex items-center gap-2 rounded-md px-3 py-2.5 text-xs uppercase tracking-widest ${
              active
                ? "nav-item-active border border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_oklch(0.86_0.28_145_/_0.12)]"
                : "border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-4 animate-border-breathe rounded-md border border-border/60 bg-background/50 p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-label text-primary">
          <Brain className="h-3 w-3 animate-soft-float" /> sistema neurale
        </p>
        <p className="text-caption leading-relaxed text-muted-foreground">
          Rete collegata a <span className="text-primary">Groq</span> — MC, Koyeb, Railway e altri
          host in Host / Competenze.
        </p>
      </div>
    </nav>
  );
}

function BrandBlock() {
  return (
    <Link to="/network" className="block">
      <span className="text-glow font-display text-lg font-bold tracking-widest text-primary">
        M.I.N.E
      </span>
      <span className="mt-0.5 block text-caption uppercase tracking-[0.2em] text-muted-foreground">
        multi-app network engine
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

  async function onLogout() {
    await doLogout({});
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-background/90 backdrop-blur-sm md:flex">
        <div className="border-b border-border px-4 py-4">
          <BrandBlock />
          <div className="mt-3">
            <AccountSelector />
          </div>
        </div>

        <SideNav pathname={pathname} />

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="btn-matrix flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
          >
            <LogOut className="h-3.5 w-3.5" /> esci
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/80 px-3 py-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="btn-matrix inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary md:hidden"
                  aria-label="Apri menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[min(100%,18rem)] flex-col border-border bg-background p-0"
              >
                <SheetHeader className="border-b border-border px-4 py-4 text-left">
                  <SheetTitle className="sr-only">Navigazione</SheetTitle>
                  <BrandBlock />
                  <div className="mt-3">
                    <AccountSelector />
                  </div>
                </SheetHeader>
                <SideNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                <div className="mt-auto border-t border-border p-3">
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="btn-matrix flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <LogOut className="h-3.5 w-3.5" /> esci
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 animate-fade-in">
              {title ? (
                <h1 className="text-title text-glow text-primary">{title}</h1>
              ) : null}
              {subtitle ? (
                <p className="text-caption text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AccountSelector className="md:hidden" />
            <span className="hidden items-center gap-1.5 text-caption uppercase tracking-widest text-muted-foreground sm:flex">
              <Sparkles className="h-3 w-3 text-primary animate-soft-float" /> groq online
            </span>
          </div>
        </header>

        <div className="page-enter flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
