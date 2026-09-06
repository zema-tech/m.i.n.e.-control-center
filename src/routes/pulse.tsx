import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BookOpen, Sparkles, Trophy, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import {
  achievementViews,
  bumpMetric,
  type AchievementDef,
} from "@/lib/agent-achievements";
import {
  appendJournalLine,
  getEntryForDay,
  todayKey,
  upsertJournal,
} from "@/lib/agent-journal";
import {
  activeSuggestions,
  dismissSuggestion,
  type AutomationSuggestion,
} from "@/lib/agent-suggestions";
import { getAuthState } from "@/lib/auth.functions";
import { createGoal } from "@/lib/cowork";

export const Route = createFileRoute("/pulse")({
  head: () => ({
    meta: [
      { title: "Pulse — diario · achievement · automazioni" },
      {
        name: "description",
        content: "Idee da Hermes: session notes, badge, suggestion catalog.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: PulsePage,
});

function PulsePage() {
  const [day] = useState(todayKey);
  const [journal, setJournal] = useState("");
  const [line, setLine] = useState("");
  const [achs, setAchs] = useState(achievementViews);
  const [sugs, setSugs] = useState<AutomationSuggestion[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  function reload() {
    setJournal(getEntryForDay(day)?.body ?? "");
    setAchs(achievementViews());
    setSugs(activeSuggestions());
  }

  useEffect(() => {
    reload();
  }, [day]);

  function saveJournal() {
    upsertJournal(journal);
    bumpMetric("journal_days", getEntryForDay(day) ? 0 : 1);
    // se già esisteva non incrementare: ricalcola giorni distinti in modo soft
    setMsg("Diario salvato");
    setAchs(achievementViews());
  }

  function quickLine() {
    if (!line.trim()) return;
    appendJournalLine(line.trim());
    setLine("");
    reload();
    setMsg("Riga aggiunta al diario");
  }

  function acceptSug(s: AutomationSuggestion) {
    createGoal(s.title, s.brief, 5);
    dismissSuggestion(s.key);
    setMsg(`Obiettivo Cowork creato: ${s.title}`);
    reload();
  }

  return (
    <AppShell title="Pulse" subtitle="Diario · achievement · automazioni (Hermes)">
      <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:grid-cols-2 sm:p-6">
        {msg ? (
          <p className="sm:col-span-2 rounded border border-border bg-background/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {msg}
          </p>
        ) : null}

        <section className="panel-spacious space-y-3 sm:col-span-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-section text-primary">Diario · {day}</h2>
          </div>
          <p className="text-caption">
            Session notes stile Hermes: decisioni, lezioni, follow-up — non un romanzo.
          </p>
          <textarea
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            rows={6}
            className="input-field resize-none font-mono text-[12px]"
            placeholder="Cosa è successo oggi nell'ops / con l'agente…"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveJournal}
              className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary"
            >
              salva giorno
            </button>
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="Riga rapida…"
              className="input-field max-w-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") quickLine();
              }}
            />
            <button
              type="button"
              onClick={quickLine}
              className="btn-matrix rounded-md border border-border px-3 py-1.5 text-[11px] text-muted-foreground"
            >
              + riga
            </button>
          </div>
        </section>

        <section className="panel-spacious space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="text-section text-primary">Achievement</h2>
          </div>
          <p className="text-caption">Badge da uso reale (chat, skill, cowork, host…).</p>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {achs.map((a) => (
              <AchievementCard key={a.id} a={a} />
            ))}
          </ul>
        </section>

        <section className="panel-spacious space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-section text-primary">Automazioni suggerite</h2>
          </div>
          <p className="text-caption">
            Catalogo tipo Hermes cron suggestions — accetta → obiettivo Cowork.
          </p>
          <ul className="space-y-3">
            {sugs.length === 0 ? (
              <li className="text-caption">Nessun suggerimento attivo (tutti archiviati).</li>
            ) : (
              sugs.map((s) => (
                <li
                  key={s.key}
                  className="rounded-lg border border-border/60 bg-background/30 p-3"
                >
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="mt-1 text-caption">{s.description}</p>
                  <p className="mt-1 font-mono text-[10px] text-primary/80">{s.scheduleHint}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => acceptSug(s)}
                      className="btn-primary px-3 py-1.5 text-[11px]"
                    >
                      Accetta → Cowork
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        dismissSuggestion(s.key);
                        reload();
                      }}
                      className="btn-matrix rounded-md border border-border px-3 py-1.5 text-[11px] text-muted-foreground"
                    >
                      Nascondi
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
          <Link to="/cowork" className="text-[12px] text-primary hover:underline">
            Apri Cowork →
          </Link>
        </section>

        <section className="panel-spacious sm:col-span-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-section text-primary">Da Hermes in questo pack</h2>
          </div>
          <ul className="mt-2 list-inside list-disc text-caption">
            <li>Session notes / notepad → diario</li>
            <li>Achievements plugin → badge metric-driven</li>
            <li>Cron suggestion catalog → automazioni accettabili</li>
            <li>Skill authoring rigoroso → skill seed extra in Competenze</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function AchievementCard({
  a,
}: {
  a: AchievementDef &
    {
      value: number;
      unlocked: "copper" | "silver" | "gold" | null;
      discovered: boolean;
      hidden: boolean;
      next: number | null;
    };
}) {
  if (a.hidden) {
    return (
      <li className="rounded-lg border border-dashed border-border/50 px-3 py-2 text-[12px] text-muted-foreground">
        ??? · secret
      </li>
    );
  }
  return (
    <li className="rounded-lg border border-border/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">{a.title}</span>
        <span className="font-mono text-[10px] uppercase text-primary">
          {a.unlocked ?? "locked"}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.description}</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {a.value}
        {a.next != null ? ` / ${a.next}` : " · max"}
      </p>
    </li>
  );
}
