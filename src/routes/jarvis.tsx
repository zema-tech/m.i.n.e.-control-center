import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Brain,
  Cable,
  CheckCircle2,
  Cpu,
  FileStack,
  FileText,
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
import { loadSoul } from "@/lib/agent-brain";

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

/** Guardrail operativi — non negoziabili (anche se SOUL è editabile). */
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
    blurb: "Proposte tool, non finte esecuzioni. Conferma su write/critical.",
    to: "/assistant" as const,
    badge: "Core",
  },
  {
    icon: FileText,
    title: "SOUL · USER · MEMORY",
    blurb: "Identità e memoria file-based stile Hermes. Edit in /agent.",
    to: "/agent" as const,
    badge: "Brain",
  },
  {
    icon: Monitor,
    title: "Desktop Control",
    blurb: "Bridge locale per app/file/PC — previsto. Oggi: host, storage, SaaS.",
    to: "/agent" as const,
    badge: "Tools",
  },
  {
    icon: FileStack,
    title: "File & storage",
    blurb: "File host, MEGA, Drive. Write solo dopo approvazione.",
    to: "/skills" as const,
    badge: "Tools",
  },
  {
    icon: Cable,
    title: "App & One MCP",
    blurb: "list → search → knowledge → execute sulle app collegate.",
    to: "/connectors" as const,
    badge: "Tools",
  },
  {
    icon: Terminal,
    title: "Host & console",
    blurb: "Power, log, comandi server. Diagnosi con evidenze.",
    to: "/hosts" as const,
    badge: "Ops",
  },
] as const;

const PERSONALITY = [
  {
    label: "Claude",
    points: ["Strutturato e cauto", "Proposte chiare", "Conferma sulle azioni critiche"],
  },
  {
    label: "Grok",
    points: ["Diretto", "Curioso e proattivo", "Senza fuffa"],
  },
  {
    label: "JARVIS",
    points: ["Italiano nativo", "Ops + codice + app", "Assistente personale"],
  },
] as const;

function JarvisSection() {
  const [name, setName] = useState("JARVIS");
  const [soulPreview, setSoulPreview] = useState("");

  useEffect(() => {
    setName(loadAgentProfile().name || "JARVIS");
    setSoulPreview(loadSoul().content.slice(0, 320));
  }, []);

  return (
    <AppShell title="JARVIS" subtitle="Agente principale · SOUL/USER/MEMORY · azzurro e nero">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
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
              Assistente personale: identità in <strong className="text-sky-200/90">SOUL.md</strong>,
              profilo in <strong className="text-sky-200/90">USER.md</strong>, note in{" "}
              <strong className="text-sky-200/90">MEMORY.md</strong>. Tool con conferma umana su write/critical.
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
                SOUL · USER · MEMORY
              </Link>
            </div>
          </div>
        </section>

        <section className="animate-fade-in-up" style={{ animationDelay: "40ms" }}>
          <p className="mb-3 text-label">Personalità · Claude × Grok × JARVIS</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PERSONALITY.map((p) => (
              <div key={p.label} className="panel rounded-2xl border border-sky-400/10 p-4">
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

        <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-label">Cosa può fare</p>
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sky-300/70">
              <Hand className="h-3 w-3" /> tools + memory
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
                <strong className="text-cyan-200/90">Oggi</strong>: host (Falix), file server, storage e
                One MCP — sempre con proposta e conferma su write/critical.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <strong className="text-cyan-200/90">Desktop</strong>: bridge locale previsto; stesse
                regole di conferma.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                  <Zap className="h-3 w-3" /> Host & console
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                  <FileStack className="h-3 w-3" /> File / storage
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
                  <Monitor className="h-3 w-3" /> Desktop: previsto
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-label">
              <Scale className="h-3.5 w-3.5 text-rose-300/80" />
              Guardrail fissi
            </p>
            <Link
              to="/agent"
              className="text-[10px] uppercase tracking-wider text-sky-300/80 no-underline hover:text-sky-200"
            >
              modifica SOUL →
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
          {soulPreview ? (
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Anteprima SOUL.md
              </p>
              <pre className="max-h-28 overflow-hidden whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground/90">
                {soulPreview}
                {soulPreview.length >= 320 ? "…" : ""}
              </pre>
            </div>
          ) : null}
        </section>

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
              <p className="text-caption">Proposte e azioni</p>
            </div>
          </Link>
          <Link
            to="/agent"
            className="card-interactive flex items-center gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/5 p-4 no-underline"
          >
            <Brain className="h-5 w-5 text-sky-300" />
            <div>
              <p className="text-sm font-semibold">Brain</p>
              <p className="text-caption">SOUL · USER · MEMORY</p>
            </div>
          </Link>
          <Link
            to="/connectors"
            className="card-interactive flex items-center gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/5 p-4 no-underline"
          >
            <Cable className="h-5 w-5 text-sky-300" />
            <div>
              <p className="text-sm font-semibold">Connettori</p>
              <p className="text-caption">One MCP · app</p>
            </div>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
