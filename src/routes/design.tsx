import { createFileRoute, redirect } from "@tanstack/react-router";
import { Palette, Type, Waves, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";

export const Route = createFileRoute("/design")({
  head: () => ({
    meta: [{ title: "Design — Studio" }],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: DesignStudio,
});

const SWATCHES = [
  { name: "JARVIS", cls: "from-sky-400 to-blue-600", hex: "#38bdf8" },
  { name: "M.I.N.E", cls: "from-emerald-400 to-green-700", hex: "#34d399" },
  { name: "Design", cls: "from-violet-400 to-fuchsia-600", hex: "#a78bfa" },
  { name: "Code", cls: "from-indigo-400 to-blue-900", hex: "#818cf8" },
];

function DesignStudio() {
  return (
    <AppShell title="Design" subtitle="Studio identità · gradienti e motion">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <section className="panel-spacious relative overflow-hidden animate-fade-in-up">
          <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-violet-500/25 blur-3xl animate-aurora" />
          <div
            className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl animate-aurora"
            style={{ animationDelay: "-2s" }}
          />
          <div className="relative">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
              <Palette className="h-3.5 w-3.5" />
              Laboratorio estetico
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                Design
              </span>
            </h2>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">
              Quattro mondi cromatici, tipografia Sora + Manrope, motion misurato. Un sistema visivo
              coerente, non una semplice skin.
            </p>
          </div>
        </section>

        <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          <p className="text-label flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" /> Palette sezioni
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {SWATCHES.map((s) => (
              <div
                key={s.name}
                className="overflow-hidden rounded-2xl border border-white/10 shadow-lg"
              >
                <div className={`h-20 bg-gradient-to-br ${s.cls}`} />
                <div className="bg-card/80 px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{s.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="panel-spacious animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <p className="mb-2 flex items-center gap-2 text-label">
              <Type className="h-3.5 w-3.5" /> Tipografia
            </p>
            <p className="font-display text-2xl font-bold">Sora — titoli</p>
            <p className="mt-1 text-sm">Manrope — interfaccia leggibile</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">JetBrains Mono — dati</p>
          </div>
          <div className="panel-spacious animate-fade-in-up" style={{ animationDelay: "160ms" }}>
            <p className="mb-2 flex items-center gap-2 text-label">
              <Waves className="h-3.5 w-3.5" /> Motion
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>fade-in-up · ingresso pagine</li>
              <li>aurora · orb ambient</li>
              <li>card lift · hover 220ms</li>
              <li>border-breathe · focus soft</li>
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
