import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Check,
  Circle,
  Copy,
  Layers,
  Palette,
  Sparkles,
  Square,
  Type,
  Waves,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";

export const Route = createFileRoute("/design")({
  head: () => ({
    meta: [
      { title: "A.R.T — Design Studio" },
      {
        name: "description",
        content: "Design system Omnicore: palette, tipografia, componenti e motion.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    if (state.mustSetPassword) throw redirect({ to: "/setup-password" });
    return null;
  },
  component: DesignStudio,
});

const WORLDS = [
  {
    name: "JARVIS",
    tag: "IA",
    gradient: "from-sky-400 via-sky-500 to-blue-700",
    glow: "shadow-sky-500/25",
    hex: "#38bdf8",
    note: "Azzurro · nero",
  },
  {
    name: "M.I.N.E",
    tag: "Gaming",
    gradient: "from-emerald-400 via-green-500 to-green-800",
    glow: "shadow-emerald-500/25",
    hex: "#34d399",
    note: "Verde matrix",
  },
  {
    name: "A.R.T",
    tag: "Design",
    gradient: "from-violet-400 via-fuchsia-500 to-amber-400",
    glow: "shadow-violet-500/25",
    hex: "#a78bfa",
    note: "Violetto · oro",
  },
  {
    name: "P.R.O.M.P.T",
    tag: "Code",
    gradient: "from-indigo-400 via-blue-600 to-slate-900",
    glow: "shadow-indigo-500/25",
    hex: "#818cf8",
    note: "Blu scuro",
  },
] as const;

const TOKENS = [
  { label: "Background", varName: "--background", sample: "bg-background border border-border" },
  { label: "Card", varName: "--card", sample: "bg-card border border-border" },
  { label: "Primary", varName: "--primary", sample: "bg-primary" },
  { label: "Muted", varName: "--muted", sample: "bg-muted border border-border" },
  { label: "Accent", varName: "--accent", sample: "bg-accent border border-border" },
  { label: "Destructive", varName: "--destructive", sample: "bg-destructive" },
] as const;

const TYPE_SCALE = [
  { label: "Display XL", className: "font-display text-4xl font-bold tracking-tight sm:text-5xl", sample: "Omnicore" },
  { label: "Title", className: "text-title", sample: "Titolo sezione" },
  { label: "Body", className: "text-[15px] leading-relaxed", sample: "Testo interfaccia leggibile e compatto." },
  { label: "Caption", className: "text-caption", sample: "Dettaglio secondario · meta" },
  { label: "Label", className: "text-label", sample: "Etichetta uppercase" },
  { label: "Mono", className: "font-mono text-sm tracking-tight text-primary", sample: "const tone = oklch(0.72 0.13 310)" },
] as const;

const RADII = [
  { name: "sm", cls: "rounded-sm", px: "4px" },
  { name: "md", cls: "rounded-md", px: "6px" },
  { name: "lg", cls: "rounded-lg", px: "12px" },
  { name: "xl", cls: "rounded-xl", px: "18px" },
  { name: "2xl", cls: "rounded-2xl", px: "24px" },
] as const;

function CopyChip({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setOk(true);
          window.setTimeout(() => setOk(false), 1200);
        });
      }}
      className="btn-matrix inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-muted-foreground hover:border-primary/30 hover:text-primary"
      title="Copia"
    >
      {ok ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {value}
    </button>
  );
}

function DesignStudio() {
  return (
    <AppShell title="A.R.T" subtitle="Design system · palette, type, motion">
      <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero */}
        <section className="panel-spacious relative overflow-hidden animate-fade-in-up">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl"
            style={{ animation: "orb-drift 18s ease-in-out infinite" }}
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl"
            style={{ animation: "orb-drift 22s ease-in-out infinite", animationDelay: "-4s" }}
          />
          <div className="pointer-events-none absolute inset-0 mesh-grid opacity-60" />
          <div className="relative">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
              <Palette className="h-3.5 w-3.5" />
              Laboratorio estetico
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                A.R.T Design System
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Quattro mondi cromatici, tipografia Sora + Manrope, token OKLCH, motion
              cubic-bezier. Un solo nucleo Omnicore, quattro personalità.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-200">
                OKLCH tokens
              </span>
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-100/90">
                Dark-first
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-muted-foreground">
                Section themes
              </span>
            </div>
          </div>
        </section>

        {/* World palettes */}
        <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <p className="text-label flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            Palette mondi
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORLDS.map((s) => (
              <div
                key={s.name}
                className={`group overflow-hidden rounded-2xl border border-white/10 bg-card/40 shadow-lg transition hover:border-white/20 hover:shadow-xl ${s.glow}`}
              >
                <div className={`relative h-24 bg-gradient-to-br ${s.gradient}`}>
                  <span className="absolute left-3 top-3 rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                    {s.tag}
                  </span>
                </div>
                <div className="space-y-2 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-semibold tracking-tight text-foreground">
                      {s.name}
                    </p>
                    <CopyChip value={s.hex} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Semantic tokens (live theme) */}
        <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <p className="text-label flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-violet-400" />
            Token semantici (tema attivo)
          </p>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {TOKENS.map((t) => (
              <div
                key={t.label}
                className="overflow-hidden rounded-xl border border-white/8 bg-black/20"
              >
                <div className={`h-12 ${t.sample}`} />
                <div className="px-2.5 py-2">
                  <p className="text-[12px] font-medium text-foreground">{t.label}</p>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                    {t.varName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="grid gap-4 lg:grid-cols-5 animate-fade-in-up" style={{ animationDelay: "140ms" }}>
          <div className="panel-spacious lg:col-span-3">
            <p className="mb-4 flex items-center gap-2 text-label">
              <Type className="h-3.5 w-3.5" />
              Scala tipografica
            </p>
            <div className="space-y-5">
              {TYPE_SCALE.map((t) => (
                <div key={t.label} className="border-b border-white/[0.05] pb-4 last:border-0 last:pb-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                    {t.label}
                  </p>
                  <p className={t.className}>{t.sample}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-spacious space-y-5 lg:col-span-2">
            <div>
              <p className="mb-2 text-label">Font stack</p>
              <ul className="space-y-3 text-sm">
                <li>
                  <span className="font-display text-lg font-bold">Sora</span>
                  <p className="text-caption">Display · titoli</p>
                </li>
                <li>
                  <span className="text-[15px] font-medium">Manrope</span>
                  <p className="text-caption">UI · corpo</p>
                </li>
                <li>
                  <span className="font-mono text-sm">JetBrains Mono</span>
                  <p className="text-caption">Dati · codice</p>
                </li>
              </ul>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-label">Letter-spacing</p>
              <p className="text-[13px] text-muted-foreground">
                Display <span className="text-foreground">−0.035em</span> · Body{" "}
                <span className="text-foreground">−0.012em</span> · Label{" "}
                <span className="text-foreground">0.1em</span>
              </p>
            </div>
          </div>
        </section>

        {/* Components */}
        <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
          <p className="text-label flex items-center gap-2">
            <Square className="h-3.5 w-3.5 text-violet-400" />
            Componenti
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel-spacious space-y-4">
              <p className="text-[12px] font-medium text-muted-foreground">Bottoni</p>
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" className="btn-primary px-4 py-2 text-sm">
                  Primary
                </button>
                <button
                  type="button"
                  className="btn-matrix rounded-lg border border-white/10 px-4 py-2 text-sm text-foreground hover:border-primary/30"
                >
                  Ghost
                </button>
                <button
                  type="button"
                  className="btn-matrix rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                >
                  Destructive
                </button>
                <button type="button" className="btn-primary px-4 py-2 text-sm opacity-40" disabled>
                  Disabled
                </button>
              </div>
              <p className="text-[12px] font-medium text-muted-foreground">Input</p>
              <input className="input-field" placeholder="Campo focus con ring primary…" />
            </div>
            <div className="panel-spacious space-y-4">
              <p className="text-[12px] font-medium text-muted-foreground">Badge & stato</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  <Circle className="h-2 w-2 fill-current" /> Online
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                  Warning
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Neutral
                </span>
              </div>
              <p className="text-[12px] font-medium text-muted-foreground">Panel</p>
              <div className="panel rounded-xl p-4">
                <p className="text-sm text-foreground">Card con bordo soft e glow top</p>
                <p className="mt-1 text-caption">`.panel` · backdrop blur + shadow-card</p>
              </div>
            </div>
          </div>
        </section>

        {/* Radius + Motion */}
        <section className="grid gap-4 sm:grid-cols-2 animate-fade-in-up" style={{ animationDelay: "220ms" }}>
          <div className="panel-spacious">
            <p className="mb-4 flex items-center gap-2 text-label">
              <Square className="h-3.5 w-3.5" />
              Raggi
            </p>
            <div className="flex flex-wrap items-end gap-3">
              {RADII.map((r) => (
                <div key={r.name} className="text-center">
                  <div
                    className={`mx-auto mb-1.5 h-12 w-12 border border-primary/30 bg-primary/15 ${r.cls}`}
                  />
                  <p className="text-[11px] font-medium text-foreground">{r.name}</p>
                  <p className="font-mono text-[9px] text-muted-foreground">{r.px}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-spacious">
            <p className="mb-4 flex items-center gap-2 text-label">
              <Waves className="h-3.5 w-3.5" />
              Motion
            </p>
            <ul className="space-y-2.5 text-[13px] text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="text-foreground">fade-in-up</span> — ingresso pagine (0.45s)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="text-foreground">orb-drift</span> — ambient backdrop (22s)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="text-foreground">card-interactive</span> — hover 220ms lift
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="text-foreground">form-shake</span> — feedback errore login
                </span>
              </li>
            </ul>
            <div className="mt-4 flex gap-2">
              <div className="h-8 flex-1 animate-soft-float rounded-lg bg-gradient-to-r from-violet-500/40 to-amber-400/30" />
              <div className="shimmer-line h-8 flex-1 rounded-lg" />
            </div>
          </div>
        </section>

        <p className="text-center text-[11px] text-muted-foreground/60 animate-fade-in" style={{ animationDelay: "280ms" }}>
          Token in <code className="text-muted-foreground">styles.css</code> · temi per sezione via{" "}
          <code className="text-muted-foreground">data-section</code>
        </p>
      </div>
    </AppShell>
  );
}
