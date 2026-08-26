/**
 * Jarvis Code Agent — cervello potenziato (Kilo/Claude Code style).
 */

import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "./groq-models";
import { getCodeMode, type CodeModeId } from "./code-modes";

export type CodeAgentReply = {
  risposta: string;
  files: { path: string; language: string; content: string }[];
  nextSteps: string[];
};

function buildCodeSystemPrompt(mode: CodeModeId, language: string): string {
  const m = getCodeMode(mode);
  return [
    "Sei JARVIS — coding agent del proprietario (stile Kilo Code + Claude Code).",
    "CERVELLO = ragionamento. MANI per SaaS esterne = One MCP (https://mcp.withone.ai/mcp), non inventare integrazioni.",
    "Rispondi in italiano; codice nella lingua del progetto.",
    "",
    m.systemHint,
    "",
    `Linguaggio workspace: ${language}.`,
    "",
    "Protocollo qualità:",
    "1) Capisci il task e i vincoli.",
    "2) Se manca contesto, dichiara assunzioni esplicite.",
    "3) Preferisci soluzioni semplici e corrette a over-engineering.",
    "4) Codice completo, tipizzato dove serve, zero TODO finti.",
    "5) Sicurezza: no secrets, no eval, valida input.",
    "6) Non fingere di aver scritto su disco o eseguito test.",
    "",
    "Nella risposta testuale: breve piano (2-4 bullet) poi spiegazione; i file vanno in files[].",
    "",
    "JSON obbligatorio:",
    '{"risposta":"...","files":[{"path":"...","language":"...","content":"..."}],"nextSteps":["..."]}',
    "Max 6 file, max 5 nextSteps. files può essere [].",
  ].join("\n");
}

export async function askCodeAgent(input: {
  prompt: string;
  mode: CodeModeId;
  language: string;
  context?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  model?: string;
}): Promise<CodeAgentReply> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY non configurata sul server.");

  const allowed = GROQ_MODELS.map((m) => m.id);
  const chosen = allowed.includes(input.model as GroqModelId)
    ? (input.model as string)
    : (process.env["GROQ_MODEL"] ?? DEFAULT_GROQ_MODEL);

  const history = (input.history ?? []).slice(-10);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chosen,
      temperature: input.mode === "architect" ? 0.3 : 0.15,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildCodeSystemPrompt(input.mode, input.language) },
        ...history,
        {
          role: "user",
          content: [
            input.context?.trim()
              ? `### Contesto / codice allegato\n${input.context.trim().slice(0, 14000)}`
              : "(nessun contesto file allegato)",
            "### Task",
            input.prompt,
            "Ragiona bene. Qualità da senior engineer.",
          ].join("\n\n"),
        },
      ],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) throw new Error("Groq: limite richieste, riprova tra poco.");
    if (res.status === 401) throw new Error("Groq: chiave API non valida.");
    throw new Error(`Groq ${res.status}: ${text.slice(0, 280)}`);
  }

  const payload = JSON.parse(text) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content) as Partial<CodeAgentReply>;
    const files = Array.isArray(parsed.files)
      ? parsed.files
          .filter(
            (f) =>
              f &&
              typeof f.path === "string" &&
              typeof f.content === "string" &&
              f.content.length > 0,
          )
          .slice(0, 6)
          .map((f) => ({
            path: String(f.path).slice(0, 200),
            language: String(f.language ?? input.language).slice(0, 40),
            content: String(f.content).slice(0, 50000),
          }))
      : [];
    const nextSteps = Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.filter((s) => typeof s === "string").slice(0, 5)
      : [];
    return {
      risposta: typeof parsed.risposta === "string" ? parsed.risposta : content,
      files,
      nextSteps,
    };
  } catch {
    return { risposta: content || "Nessuna risposta.", files: [], nextSteps: [] };
  }
}
