"use client";
import { Check, ChevronDown, Copy, Cpu, Eye, RefreshCw, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { JarvisMsg } from "@/lib/jarvis-workspace";
import { speakJarvis, stopJarvisSpeech } from "@/lib/jarvis-plus";

type Block = { kind: "text"; text: string } | { kind: "code"; lang: string; code: string };

/** Parser minimale dei fence ``` (testo puro, niente HTML: React fa escape). */
function splitBlocks(content: string): Block[] {
  const out: Block[] = [];
  const re = /```(\w*)\n?([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: content.slice(last, m.index) });
    out.push({ kind: "code", lang: (m[1] || "code").slice(0, 20), code: m[2].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push({ kind: "text", text: content.slice(last) });
  return out.length ? out : [{ kind: "text", text: content }];
}

const PREVIEWABLE = new Set(["html", "svg"]);

/**
 * VibeSec: l'anteprima usa <iframe sandbox=""> SENZA allow-scripts —
 * script/event-handler nel contenuto non eseguono mai. Niente srcDoc con
 * javascript:, niente allow-same-origin (niente accesso al DOM padre).
 */
function CodePreview({ lang, code }: { lang: string; code: string }) {
  const [open, setOpen] = useState(false);
  if (!PREVIEWABLE.has(lang.toLowerCase())) return null;
  const doc =
    lang.toLowerCase() === "svg"
      ? `<!DOCTYPE html><html><body style="margin:0;display:flex;justify-content:center;background:#fff">${code.slice(0, 60000)}</body></html>`
      : code.slice(0, 60000);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100/20 px-2.5 py-1 text-[11px] text-sky-100/80 hover:bg-white/5"
      >
        <Eye className="h-3 w-3" /> {open ? "Nascondi anteprima" : "Anteprima sicura"}
      </button>
      {open ? (
        <iframe
          title="Anteprima codice (sandbox, senza script)"
          sandbox=""
          loading="lazy"
          srcDoc={doc}
          className="mt-2 h-64 w-full rounded-xl border border-sky-100/15 bg-white"
        />
      ) : null}
    </div>
  );
}

function CodeBlock({
  lang,
  code,
  onCopy,
  copied,
}: {
  lang: string;
  code: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-sky-200/70">
          {lang}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copia codice"
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-300" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 font-mono text-[12px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
      <div className="px-3 pb-3">
        <CodePreview lang={lang} code={code} />
      </div>
    </div>
  );
}

export function JarvisMessage({
  msg,
  time,
  isLastAssistant,
  onRegenerate,
  canRegenerate,
}: {
  msg: JarvisMsg;
  time: string;
  isLastAssistant: boolean;
  onRegenerate: () => void;
  canRegenerate: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const blocks = useMemo(
    () => (msg.role === "assistant" ? splitBlocks(msg.content) : null),
    [msg.content, msg.role],
  );
  const steps = msg.meta?.steps ?? [];

  function copyText(text: string, done: () => void) {
    void navigator.clipboard?.writeText(text).then(
      () => {
        done();
        window.setTimeout(() => {
          setCopied(false);
          setCopiedCode(null);
        }, 1400);
      },
      () => {},
    );
  }

  function toggleSpeak() {
    if (speaking) {
      stopJarvisSpeech();
      setSpeaking(false);
      return;
    }
    if (speakJarvis(msg.content)) {
      setSpeaking(true);
      window.setTimeout(() => setSpeaking(false), 30000);
    }
  }

  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
          msg.role === "user"
            ? "bg-sky-300/85 text-black"
            : "border border-sky-100/10 bg-black/55 text-slate-100 backdrop-blur-md"
        }`}
      >
        {msg.role === "assistant" && blocks ? (
          <div className="space-y-2.5">
            {blocks.map((b, i) =>
              b.kind === "text" ? (
                // VibeSec: testo puro (escape React), mai HTML grezzo.
                <p key={i} className="whitespace-pre-wrap">
                  {b.text}
                </p>
              ) : (
                <CodeBlock
                  key={i}
                  lang={b.lang}
                  code={b.code}
                  copied={copiedCode === i}
                  onCopy={() => copyText(b.code, () => setCopiedCode(i))}
                />
              ),
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        )}

        {steps.length > 0 ? (
          <details className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px]">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sky-100/80">
              <Cpu className="h-3.5 w-3.5" />
              Come ho ragionato{msg.meta?.mode ? ` · ${msg.meta.mode}` : ""}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </summary>
            <ul className="mt-2 space-y-1">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 font-mono text-[11px] text-slate-300"
                >
                  <span className={s.ok ? "text-emerald-300" : "text-red-300"}>
                    {s.ok ? "●" : "○"}
                  </span>
                  <span className="text-slate-400">{s.fase}</span>
                  <span className="truncate">
                    {s.provider}:{s.model.split("/").pop()}
                  </span>
                  <span className="ml-auto shrink-0 text-slate-500">{s.ms}ms</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <span className="mt-1.5 flex items-center gap-1.5 opacity-70">
          <span className="font-mono text-[10px]">{time}</span>
          {msg.role === "assistant" ? (
            <>
              <button
                type="button"
                aria-label="Copia risposta"
                onClick={() => copyText(msg.content, () => setCopied(true))}
                className="rounded p-0.5 hover:bg-white/10"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
              <button
                type="button"
                aria-label={speaking ? "Ferma lettura" : "Leggi ad alta voce"}
                aria-pressed={speaking}
                onClick={toggleSpeak}
                className={`rounded p-0.5 hover:bg-white/10 ${speaking ? "text-sky-200" : ""}`}
              >
                <Volume2 className="h-3 w-3" />
              </button>
              {isLastAssistant ? (
                <button
                  type="button"
                  aria-label="Rigenera risposta"
                  disabled={!canRegenerate}
                  onClick={onRegenerate}
                  className="rounded p-0.5 hover:bg-white/10 disabled:opacity-30"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              ) : null}
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
