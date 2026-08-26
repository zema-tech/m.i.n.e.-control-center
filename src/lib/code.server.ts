/**
 * Jarvis Code Agent — chiamate Groq in modalità Kilo/Claude Code.
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
    "Sei JARVIS, l'agente personale del proprietario di M.I.N.E — stile assistente competente, proattivo, chiaro.",
    "Sei anche un coding agent ispirato a Kilo Code e Claude Code: ragioni per task, non solo autocomplete.",
    "Rispondi SEMPRE in italiano (codice e identificatori restano nella lingua del progetto).",
    "",
    m.systemHint,
    "",
    `Linguaggio preferito del workspace: ${language}.",
    "",
    "Linee guida:",
    "- Codice corretto, tipizzato dove ha senso, senza placeholder finti tipo TODO ovunque.",
    "- Se il contesto è incompleto, dichiara assunzioni.",
    "- Non inventare API inesistenti.",
    "- Per sicurezza: evita eval, secrets hardcoded, SQL injection; segnala rischi.",
    "- Human-in-the-loop: non pretendere di aver eseguito comandi sul sistema dell'utente.",
    "",
    "Rispondi SOLO con JSON valido:",
    JSON.stringify({
      risposta: "spiegazione breve",
      files: [{ path: "relativo/file.ts", language: "typescript", content: "..." }],
      nextSteps: ["passo successivo opzionale"],
    }),
    "files può essere []. content deve essere il file intero o patch chiara. Max 6 file. Max 5 nextSteps.",
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

  const history = (input.history ?? []).slice(-8);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chosen,
      temperature: input.mode === "architect" ? 0.35 : 0.22,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildCodeSystemPrompt(input.mode, input.language) },
        ...history,
        {
          role: "user",
          content: [
            input.context?.trim()
              ? `### Contesto / codice allegato\n${input.context.trim().slice(0, 12000)}`
              : "",
            "### Richiesta",
            input.prompt,
          ]
            .filter(Boolean)
            .join("\n\n"),
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
