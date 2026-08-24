import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Cable,
  KeyRound,
  LogOut,
  MessageSquare,
  Network,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { AccountSelector } from "@/components/AccountSelector";
import { logout } from "@/lib/auth.functions";

const NAV = [
  { to: "/network" as const, label: "Rete / pallini", icon: Network },
  { to: "/assistant" as const, label: "Chat IA", icon: MessageSquare },
  { to: "/skills" as const, label: "Competenze", icon: KeyRound },
  { to: "/connectors" as const, label: "Connettori", icon: Cable },
];

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

  async function onLogout() {
    await doLogout({});
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background/90">
        <div className="border-b border-border px-4 py-4">
          <Link to="/network" className="block">
            <span className="text-glow font-display text-lg font-bold tracking-widest text-primary">
              M.I.N.E
            </span>
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              network engine
            </span>
          </Link>
          <div className="mt-3">
            <AccountSelector />
          </div>
        </div>

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
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs uppercase tracking-widest transition-colors ${
                  active
                    ? "border border-primary/40 bg-primary/10 text-primary"
                    : "border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}

          <div className="mt-4 rounded-md border border-border/60 bg-background/50 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
              <Brain className="h-3 w-3" /> sistema neurale
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Rete collegata a <span className="text-primary">Groq API</span> — azioni su account
              Falix selezionato (Gino, Edo, …).
            </p>
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <LogOut className="h-3.5 w-3.5" /> esci
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {(title || subtitle) && (
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6">
            <div className="min-w-0">
              {title ? (
                <h1 className="font-display text-lg font-bold tracking-wide text-primary">{title}</h1>
              ) : null}
              {subtitle ? (
                <p className="text-[11px] text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <AccountSelector className="sm:hidden" />
              <span className="hidden items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground sm:flex">
                <Sparkles className="h-3 w-3 text-primary" /> groq online
              </span>
            </div>
          </header>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
