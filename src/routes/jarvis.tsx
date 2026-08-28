import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Brain,
  Cable,
  CheckCircle2,
  Cpu,
  FileStack,
  Hand,
  MessageSquare,
  Monitor,
  Scale,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";
import { loadAgentProfile } from "@/lib/agent-profile";
import { loadRulesDoc } from "@/lib/agent-brain";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [{ title: "JARVIS — Agente personale" }],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: JarvisSection,
});

/** Regole fisse stabilite — sempre visibili, non negoziabili. */
const FIXED_RULES = [
  {
    title: "Conferma umana",
    body: "Ogni azione write o critical (file, console, app, desktop) richiede approvazione esplicita. Mai eseguire in silenzio.",
  },
  {
    title: "Niente inventati",
    body: "Non inventare log, output tool o risultati. Se manca un dato, chiedilo o proponi uno strumento di lettura.",
  },
  {
    title: "Read prima di write",
    body: "Leggi, ispeziona, verifica — poi agisci. Preferisci passi reversibili e backup quando tocchi file o host.",
  },
  {
    title: "Scope controllato",
    body: "Mani attive: Falix/host, storage, One MCP (app SaaS), codice. Desktop PC solo tramite bridge approvato e conferma.",
  },
  {
    title: "Segreti",
    body: "Mai esporre o richiedere API key/secret in chiaro nelle risposte. Usa i vault e le competenze già collegate.",
  },
  {
    title: "Rifiuto chiaro",
    body: "Richieste illegali, dannose o fuori policy: rifiuta in modo netto, spiega il perché, proponi alternative sicure.",
  },
] as const;

const CAPABILITIES = [
  {
    icon: MessageSquare,
    title: "Chat agentica",
    blurb: "Ragionamento strutturato stile Claude: capisco → dati → ipotesi → piano → rischio. Proposte tool, non finte esecuzioni.",
    to: "/assistant" as const,
    badge: "Core",
  },
  {
    icon: Brain,
    title: "4 pilastri",
    blurb: "Carattere, memoria, mani, regole — il cervello editabile. Come un Claude personalizzato + personalità Grok.",
    to: "/agent" as const,
    badge: "Identity",
  },
  {
    icon: Monitor,
    title: "Desktop Control",
    blurb: "Visione: controllo PC (app, file, finestre) via bridge locale. Oggi: host, storage e app SaaS. Sempre con conferma.",
    to: "/agent" as const,
    badge: "Mani",
  },
  {
    icon: FileStack,
    title: "File & storage",
    blurb: "File host, MEGA, Drive — lettura, upload note, cartelle. Write solo dopo approvazione.",
    to: "/skills" as const,
    badge: "Mani",
  },
  {
    icon: Cable,
    title: "App & One MCP",
    blurb: "700+ integrazioni (Gmail, Slack, CRM…). Catena list → search → knowledge → execute.",
    to: "/connectors" as const,
    badge: "Mani",
  },
  {
    icon: Terminal,
    title: "Host & console",
    blurb: "Power, log, comandi server Minecraft/cloud. Diagnosi lag/crash con evidenze, non indovinelli.",
    to: "/hosts" as const,
    badge: "Ops",
  },
] as const;

const PERSONALITY = [
  {
    label: "Claude",
    points: ["Strutturato e cauto", "Artifacts / proposte chiare", "Conferma sulle azioni critiche"],
  },
  {
    label: "Grok",
    points: ["Diretto, un po' ironico", "Curioso e proattivo", "Senza fuffa, risposte utili"],
  },
  {
    label: "JARVIS",
    points: ["Italiano nativo", "Ops + codice + app", "Il tuo assistente personale"],
  },
] as const;

function JarvisSection() {
  const [name, setName] = useState("JARVIS");
  const [rulesPreview, setRulesPreview] = useState("");

  useEffect(() => {
    setName(loadAgentProfile().name || "JARVIS");
    setRulesPreview(loadRulesDoc().rules.slice(0, 280));
  }, []);

  return (
    <AppShell title="JARVIS" subtitle="Agente principale · stile Claude + Grok · azzurro e nero">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* Hero */}
        <section className="panel-spacious relative overflow-hidden animate-fade-in-up">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl animate-aurora" />
          <div
            className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl animate-aurora"
            style={{ animationDelay: "-3s" }}
          />
          <div className="relative">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              IA principale · Control Center
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-sky-200 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                {name}
              </span>
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Il tuo assistente personale: ragiona come <strong className="text-sky-200/90">Claude</strong>,
              parla con il carattere di <strong className="text-sky-200/90">Grok</strong>, agisce con le{" "}
              <strong className="text-sky-200/90">mani</strong> (host, file, app SaaS) e — con bridge e conferma —
              può estendersi al controllo del PC.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/assistant"
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm no-underline"
              >
                <MessageSquare className="h-4 w-4" />
                Apri chat
              </Link>
              <Link
                to="/agent"
                className="btn-matrix inline-flex items-center gap-2 rounded-lg border border-sky-400/30 px-4 py-2.5 text-sm text-sky-200 no-underline hover:bg-sky-500/10"
              >
                <Brain className="h-4 w-4" />
                Pilastri & regole
              </Link>
            </div>
          </div>
        </section>

        {/* Personality — Claude + Grok */}
        <section className="animate-fade-in-up" style={{ animationDelay: "40ms" }}>
          <p className="mb-3 text-label">Personalità · Claude × Grok × JARVIS</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PERSONALITY.map((p) => (
              <div
                key={p.label}
                className="panel rounded-2xl border border-sky-400/10 p-4"
              >
                <p className="text-sm font-semibold text-sky-200">{p.label}</p>
                <ul className="mt-2 space-y-1.5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-sky-400/80" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-label">Cosa può fare</p>
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sky-300/70">
              <Hand className="h-3 w-3" /> mani + cervello
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => (
              <li key={c.title} style={{ animationDelay: `${100 + i * 40}ms` }} className="animate-fade-in-up">
                <Link
                  to={c.to}
                  className="card-interactive flex h-full flex-col rounded-2xl border border-sky-400/12 bg-sky-500/[0.04] p-4 no-underline"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <c.icon className="h-5 w-5 text-sky-300" />
                    <span className="rounded-full border border-sky-400/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300/80">
                      {c.badge}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{c.title}</span>
                  <span className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{c.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Desktop / PC control callout */}
        <section
          className="panel-spacious relative overflow-hidden border border-cyan-400/20 animate-fade-in-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10">
              <Cpu className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Controllo PC · app · file
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                <strong className="text-cyan-200/90">Oggi</strong>: JARVIS agisce su host (Falix),
                file server, storage cloud e app collegate via One MCP — sempre proponendo azioni e
                chiedendo conferma su write/critical.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <strong className="text-cyan-200/90">Desktop Control</strong> (stile Mark-LI): bridge
                locale per finestre, app e filesystem del PC. Non è abilitato nel browser puro — richiede
                un agente locale e le regole fisse sotto. Quando lo attiveremo, le stesse regole di
                conferma restano non negoziabili.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                  <Zap className="h-3 w-3" /> Host & console attivi
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                  <FileStack className="h-3 w-3" /> File / storage attivi
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
                  <Monitor className="h-3 w-3" /> Desktop: bridge previsto
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Fixed rules */}
        <section className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-label">
              <Scale className="h-3.5 w-3.5 text-rose-300/80" />
              Regole fisse stabilite
            </p>
            <Link
              to="/agent"
              className="text-[10px] uppercase tracking-wider text-sky-300/80 no-underline hover:text-sky-200"
            >
              modifica in Pilastri →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {FIXED_RULES.map((r) => (
              <div
                key={r.title}
                className="rounded-xl border border-rose-400/15 bg-rose-500/[0.04] p-3.5"
              >
                <p className="flex items-center gap-2 text-xs font-semibold text-rose-200/90">
                  <Shield className="h-3.5 w-3.5" />
                  {r.title}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
          {rulesPreview ? (
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Anteprima regole attive (cervello)
              </p>
              <pre className="max-h-28 overflow-hidden whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground/90">
                {rulesPreview}
                {rulesPreview.length >= 280 ? "…" : ""}
              </pre>
            </div>
          ) : null}
        </section>

        {/* Quick links */}
        <section
          className="grid gap-3 sm:grid-cols-3 animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <Link
            to="/assistant"
            className="card-interactive flex items-center gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/5 p-4 no-underline"
          >
            <MessageSquare className="h-5 w-5 text-sky-300" />
            <div>
              <p className="text-sm font-semibold">Chat</p>
              <p className="text-caption">Parla e proponi azioni</p>
            </div>
          </Link>
          <Link
            to="/agent"
            className="card-interactive flex items-center gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/5 p-4 no-underline"
          >
            <Brain className="h-5 w-5 text-sky-300" />
            <div>
              <p className="text-sm font-semibold">Pilastri</p>
              <p className="text-caption">Carattere · memoria · regole</p>
            </div>
          </Link>
          <Link
            to="/connectors"
            className="card-interactive flex items-center gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/5 p-4 no-underline"
          >
            <Cable className="h-5 w-5 text-sky-300" />
            <div>
              <p className="text-sm font-semibold">Connettori</p>
              <p className="text-caption">One MCP · app · webhook</p>
            </div>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
