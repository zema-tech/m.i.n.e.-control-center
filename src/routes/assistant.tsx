import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bot, Check, RefreshCw, Send, Terminal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAuthState } from "@/lib/auth.functions";
import { askAssistant, getLogs, runCommand } from "@/lib/panel.functions";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "IA Assistant e Console — M.I.N.E" },
      {
        name: "description",
        content:
          "Chiedi all'IA di analizzare i log del server Minecraft, conferma i comandi proposti e inviali dalla console.",
      },
      { property: "og:title", content: "IA Assistant e Console — M.I.N.E" },
      {
        property: "og:description",
        content: "Assistente IA in italiano che analizza i log e propone comandi da confermare.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: AssistantPage,
});

type Proposal = { comando: string; motivo: string; state: "pending" | "done" | "rejected"; output?: string };
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };
type LogLine = { ts: string; level: "info" | "warn" | "error"; message: string };

function AssistantPage() {
  const ask = useServerFn(askAssistant);
  const fetchLogs = useServerFn(getLogs);
  const exec = useServerFn(runCommand);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logDemo, setLogDemo] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [consoleOut, setConsoleOut] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadLogs = useCallback(async () => {
    const res = await fetchLogs({});
    setLogs(res.lines as LogLine[]);
    setLogDemo(res.demo);
    setLogError(res.ok ? null : ((res as { message?: string }).message ?? "Errore log"));
  }, [fetchLogs]);

  useEffect(() => {
    void loadLogs();
    const id = setInterval(() => void loadLogs(), 15000);
    return () => clearInterval(id);
  }, [loadLogs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy]);

  async function onAsk() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: question }]);
    try {
      const res = await ask({
        data: {
          question,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.risposta,
          proposals: res.comandi.map((c) => ({ ...c, state: "pending" as const })),
        },
      ]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: error instanceof Error ? error.message : String(error) },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function updateProposal(mi: number, pi: number, patch: Partial<Proposal>) {
    setMessages((prev) =>
      prev.map((msg, i) => {
        if (i !== mi || !msg.proposals) return msg;
        return {
          ...msg,
          proposals: msg.proposals.map((p, j) => (j === pi ? { ...p, ...patch } : p)),
        };
      }),
    );
  }

  async function confirmProposal(mi: number, pi: number, cmd: string) {
    const res = await exec({ data: { command: cmd } });
    updateProposal(mi, pi, { state: "done", output: res.output });
    setConsoleOut((o) => [...o, `> ${cmd}`, res.output]);
    void loadLogs();
  }

  async function onSendCommand() {
    const cmd = command.trim();
    if (!cmd) return;
    setCommand("");
    const res = await exec({ data: { command: cmd } });
    setConsoleOut((o) => [...o, `> ${cmd}`, res.output]);
    void loadLogs();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="text-glow text-xl font-bold text-primary">M.I.N.E</h1>
          <nav className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <Link
              to="/"
              className="rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              dashboard
            </Link>
            <span className="rounded-md border border-primary px-3 py-1.5 text-primary">
              ia + console
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section className="panel flex h-[70vh] flex-col p-4 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-primary">
            <Bot className="h-4 w-4" /> IA Assistant
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
            {messages.length === 0 ? (
              <p className="text-muted-foreground">
                Chiedi ad esempio: <span className="text-primary">&quot;perché il server lagga?&quot;</span>{" "}
                — l&apos;IA legge i log e propone comandi che devi confermare.
              </p>
            ) : null}
            {messages.map((m, mi) => (
              <div
                key={mi}
                className={
                  m.role === "user"
                    ? "rounded-md border border-border bg-muted/40 p-3"
                    : "rounded-md border border-primary/40 p-3"
                }
              >
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m.role === "user" ? "tu" : "m.i.n.e"}
                </p>
                <p className="whitespace-pre-wrap text-foreground">{m.content}</p>
                {m.proposals?.length ? (
                  <div className="mt-3 space-y-2">
                    {m.proposals.map((p, pi) => (
                      <div key={pi} className="rounded-md border border-border p-2">
                        <p className="font-mono text-xs text-primary">/{p.comando}</p>
                        {p.motivo ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">{p.motivo}</p>
                        ) : null}
                        {p.state === "pending" ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => void confirmProposal(mi, pi, p.comando)}
                              className="flex items-center gap-1 rounded border border-primary px-2 py-1 text-[11px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
                            >
                              <Check className="h-3 w-3" /> conferma
                            </button>
                            <button
                              onClick={() => updateProposal(mi, pi, { state: "rejected" })}
                              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                            >
                              <X className="h-3 w-3" /> rifiuta
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {p.state === "done" ? (p.output ?? "eseguito") : "rifiutato"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <p className="text-xs text-primary">M.I.N.E sta analizzando i log…</p> : null}
          </div>
          <div className="mt-3 flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onAsk();
                }
              }}
              rows={2}
              placeholder="Chiedi qualcosa sul server…"
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              onClick={() => void onAsk()}
              disabled={busy}
              className="flex items-center gap-1 rounded-md border border-primary px-3 text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" /> invia
            </button>
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.25em] text-primary">Log server</h2>
              <button
                onClick={() => void loadLogs()}
                className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
              >
                <RefreshCw className="h-3 w-3" /> aggiorna
              </button>
            </div>
            {logDemo || logError ? (
              <p className="mb-2 flex items-start gap-2 text-[11px] text-warning">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {logError ?? "Log dimostrativi: aggiungi la chiave Falix per i log reali."}
              </p>
            ) : null}
            <div className="max-h-64 space-y-0.5 overflow-y-auto font-mono text-[11px]">
              {logs.map((l, i) => (
                <p
                  key={i}
                  className={
                    l.level === "error"
                      ? "text-destructive"
                      : l.level === "warn"
                        ? "text-warning"
                        : "text-muted-foreground"
                  }
                >
                  {l.message}
                </p>
              ))}
            </div>
          </section>

          <section className="panel p-4 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-primary">
              <Terminal className="h-4 w-4" /> Console
            </h2>
            <div className="mb-3 max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px] text-muted-foreground">
              {consoleOut.length === 0 ? (
                <p>Nessun comando inviato.</p>
              ) : (
                consoleOut.map((line, i) => (
                  <p key={i} className={line.startsWith(">") ? "text-primary" : undefined}>
                    {line}
                  </p>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onSendCommand();
                }}
                placeholder="say ciao"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
              <button
                onClick={() => void onSendCommand()}
                className="rounded-md border border-primary px-3 text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
              >
                invia
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
