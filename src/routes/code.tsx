import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Code2, Copy, Loader2, Plus, Send, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { getAuthState } from "@/lib/auth.functions";
import {
  appendCodeMessage,
  CODE_LANGUAGES,
  CODE_MODES,
  createCodeSession,
  deleteCodeSession,
  loadCodeSessions,
  type CodeModeId,
  type CodeSession,
  updateCodeSession,
} from "@/lib/code-modes";
import { GROQ_MODELS, DEFAULT_GROQ_MODEL } from "@/lib/groq-models";
import { askCodeAgent } from "@/lib/panel.functions";

export const Route = createFileRoute("/code")({
  head: () => ({
    meta: [
      { title: "Codice — JARVIS" },
      {
        name: "description",
        content: "Coding agent personale — modalità Code, Architect, Ask, Debug, Review.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: CodePage,
});

function CodePage() {
  const runCode = useServerFn(askCodeAgent);
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_GROQ_MODEL);

  useEffect(() => {
    const list = loadCodeSessions();
    if (list.length === 0) {
      const s = createCodeSession("code");
      setSessions([s]);
      setActiveId(s.id);
    } else {
      setSessions(list);
      setActiveId(list[0]!.id);
    }
  }, []);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  function refresh() {
    setSessions(loadCodeSessions());
  }

  function newSession(mode: CodeModeId = "code") {
    const s = createCodeSession(mode);
    refresh();
    setActiveId(s.id);
    setError(null);
  }

  async function send() {
    if (!active || !prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    const userText = prompt.trim();
    setPrompt("");
    appendCodeMessage(active.id, {
      role: "user",
      content: userText,
      mode: active.mode,
    });
    refresh();

    try {
      const history = active.messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 3000),
      }));
      const res = await runCode({
        data: {
          prompt: userText,
          mode: active.mode,
          language: active.language,
          context: context.trim() || undefined,
          history,
          model,
        },
      });

      if (!res.ok) {
        setError(res.risposta);
        appendCodeMessage(active.id, {
          role: "assistant",
          content: res.risposta,
          mode: active.mode,
        });
      } else {
        const blocks =
          res.files.length > 0
            ? res.files
                .map(
                  (f) =>
                    `\n\n── ${f.path} (${f.language}) ──\n\`\`\`${f.language}\n${f.content}\n\`\`\``,
                )
                .join("")
            : "";
        const steps =
          res.nextSteps.length > 0
            ? `\n\n**Prossimi passi**\n${res.nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
            : "";
        appendCodeMessage(active.id, {
          role: "assistant",
          content: `${res.risposta}${blocks}${steps}`,
          mode: active.mode,
        });
      }
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function copyLastCode() {
    if (!active) return;
    const last = [...active.messages].reverse().find((m) => m.role === "assistant");
    if (last) void navigator.clipboard.writeText(last.content);
  }

  return (
    <AppShell
      title="Codice"
      subtitle="JARVIS coding agent — ispirato a Kilo Code & Claude Code"
    >
      <div className="flex h-[calc(100vh-3.5rem)] min-h-[28rem] flex-col md:flex-row">
        {/* Sidebar sessioni */}
        <aside className="flex w-full shrink-0 flex-col border-b border-border md:w-52 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between p-3">
            <p className="text-label text-primary">Sessioni</p>
            <button
              type="button"
              onClick={() => newSession(active?.mode ?? "code")}
              className="btn-matrix rounded border border-border p-1 text-muted-foreground hover:border-primary hover:text-primary"
              aria-label="Nuova sessione"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="max-h-36 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 md:max-h-none">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`btn-matrix flex w-full items-center justify-between gap-1 rounded-md px-2 py-2 text-left text-[11px] ${
                    s.id === activeId
                      ? "border border-primary/40 bg-primary/10 text-primary"
                      : "border border-transparent text-muted-foreground hover:border-border"
                  }`}
                >
                  <span className="truncate">{s.title}</span>
                  <span className="shrink-0 text-[9px] uppercase opacity-70">{s.mode}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {active ? (
            <>
              {/* Mode bar */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
                {CODE_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.blurb}
                    onClick={() => {
                      updateCodeSession(active.id, { mode: m.id });
                      refresh();
                    }}
                    className={`btn-matrix rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                      active.mode === m.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
                <select
                  value={active.language}
                  onChange={(e) => {
                    updateCodeSession(active.id, { language: e.target.value });
                    refresh();
                  }}
                  className="ml-auto rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                >
                  {CODE_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as typeof model)}
                  className="rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                >
                  {GROQ_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={copyLastCode}
                  className="btn-matrix rounded border border-border p-1.5 text-muted-foreground hover:text-primary"
                  title="Copia ultima risposta"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteCodeSession(active.id);
                    const next = loadCodeSessions();
                    setSessions(next);
                    setActiveId(next[0]?.id ?? null);
                    if (!next[0]) newSession();
                  }}
                  className="btn-matrix rounded border border-border p-1.5 text-muted-foreground hover:text-destructive"
                  title="Elimina sessione"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="border-b border-border/60 px-3 py-1.5 text-caption text-muted-foreground">
                {CODE_MODES.find((m) => m.id === active.mode)?.blurb}
              </p>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
                {active.messages.length === 0 ? (
                  <EmptyState
                    icon={Code2}
                    title="Sessione codice pronta"
                    description="Scegli una modalità (Code, Architect, Debug…) e descrivi il task. Incolla contesto nel box sotto se serve."
                  />
                ) : (
                  active.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-3xl rounded-lg border px-3 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "ml-auto border-primary/30 bg-primary/5 text-foreground"
                          : "mr-auto border-border bg-background/60 text-foreground"
                      }`}
                    >
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                        {m.role === "user" ? "tu" : "jarvis"} · {m.mode}
                      </p>
                      <pre className="whitespace-pre-wrap break-words font-sans text-[13px]">
                        {m.content}
                      </pre>
                    </div>
                  ))
                )}
                {busy ? (
                  <p className="flex items-center gap-2 text-caption text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Jarvis sta elaborando…
                  </p>
                ) : null}
                {error ? (
                  <p className="text-caption text-destructive">{error}</p>
                ) : null}
              </div>

              {/* Context + prompt */}
              <div className="space-y-2 border-t border-border p-3">
                <details className="text-caption">
                  <summary className="cursor-pointer text-muted-foreground hover:text-primary">
                    Contesto / codice allegato (opzionale)
                  </summary>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    rows={4}
                    placeholder="Incolla stack trace, file, errori…"
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2 font-mono text-[11px] outline-none focus:border-primary"
                  />
                </details>
                <div className="flex gap-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    placeholder={
                      active.mode === "architect"
                        ? "Descrivi la feature da progettare…"
                        : active.mode === "debug"
                          ? "Descrivi il bug o incolla l'errore…"
                          : "Cosa vuoi che implementi o analizzi…"
                    }
                    className="min-h-[2.75rem] flex-1 resize-y rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={busy || !prompt.trim()}
                    onClick={() => void send()}
                    className="btn-matrix flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary text-primary hover:bg-primary/10 disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={Code2}
                title="Nessuna sessione"
                description="Crea una sessione codice per iniziare."
                action={
                  <button
                    type="button"
                    onClick={() => newSession()}
                    className="btn-matrix rounded-md border border-primary px-3 py-1.5 text-[10px] uppercase tracking-widest text-primary"
                  >
                    nuova sessione
                  </button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
