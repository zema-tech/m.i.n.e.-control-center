import { FALIX_ACTIONS } from "./falix-actions";
import { buildExpertSystemPrompt } from "./ai-expert";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "./groq-models";
import {
  CONNECTOR_MCP_TOOLS,
  GDRIVE_MCP_TOOLS,
  MEGA_MCP_TOOLS,
  ONE_MCP_TOOLS,
  RESEARCH_MCP_TOOLS,
  isKnownActionId,
  mcpToolSummaryForAi,
} from "./mcp";
import { oneHandsStatus } from "./one-hands.server";
import { parseResidentCalls, type ResidentCall } from "./resident-tools";

export type ProposedAction = {
  id: string;
  params: Record<string, string | number | boolean>;
  motivo: string;
};

export type AssistantReply = {
  risposta: string;
  comandi: { comando: string; motivo: string }[];
  azioni: ProposedAction[];
  /** Tool memoria/skill/pattern — eseguiti client-side. */
  resident: ResidentCall[];
};

export { GROQ_MODELS, DEFAULT_GROQ_MODEL, type GroqModelId };

const ACTION_CATALOG = FALIX_ACTIONS.map(
  (a) => `${a.id} [${a.risk}] ${a.label}${a.body?.length ? ` (params: ${a.body.join(", ")})` : ""}`,
).join("\n");

const STORAGE_CATALOG = [
  ...MEGA_MCP_TOOLS,
  ...GDRIVE_MCP_TOOLS,
  ...CONNECTOR_MCP_TOOLS,
  ...RESEARCH_MCP_TOOLS,
  ...ONE_MCP_TOOLS,
]
  .map(
    (t) =>
      `${t.name} [${t.risk}] ${t.description}` +
      (t.params.length
        ? ` (params: ${t.params.map((p) => p.name + (p.required ? "*" : "")).join(", ")})`
        : ""),
  )
  .join("\n");

export function sanitizeParams(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        out[key] = value;
      } else if (value !== null && value !== undefined) {
        out[key] = JSON.stringify(value);
      }
    }
  }
  return out;
}

export function assistantSystemPrompt(): string {
  const hands = oneHandsStatus();
  const catalog = [
    "=== MANI FALIX ===",
    ACTION_CATALOG,
    "",
    "=== MANI MCP (storage, connector, research, ONE) ===",
    STORAGE_CATALOG,
    "",
    mcpToolSummaryForAi(["falix", "mega", "gdrive", "connector", "research", "one"]).slice(0, 5500),
    "",
    `Stato mani One: ${hands.message}`,
    `MCP URL: ${hands.mcpUrl}`,
  ].join("\n");
  return buildExpertSystemPrompt(catalog);
}

export async function askGroq(
  question: string,
  logContext: string,
  history: { role: "user" | "assistant"; content: string }[],
  model: string = DEFAULT_GROQ_MODEL,
  brainContext?: string,
): Promise<AssistantReply> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY non configurata sul server.");

  const allowed = GROQ_MODELS.map((m) => m.id);
  const chosen = allowed.includes(model as GroqModelId)
    ? model
    : (process.env["GROQ_MODEL"] ?? DEFAULT_GROQ_MODEL);

  const brain = (brainContext ?? "").trim().slice(0, 10000);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chosen,
      temperature: 0.18,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: assistantSystemPrompt() },
        ...history.slice(-12),
        {
          role: "user",
          content: [
            brain
              ? [
                  "### CONTESTO AGENTE RESIDENTE (SOUL / MEMORY / USER / skills / pattern)",
                  brain,
                  "",
                ].join("\n")
              : "",
            "### Ruolo",
            "Sei il CERVELLO. Le MANI host/app sono in azioni[]. I tool residenti (memoria/skill) in resident[].",
            "Protocollo: CAPISCO → DATI → IPOTESI → PIANO MANI → RISCHIO.",
            "",
            "### Log / contesto server",
            logContext.slice(-8000) || "(nessun log)",
            "",
            "### Richiesta umana",
            question,
            "",
            "Rispondi solo JSON.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) throw new Error("Groq: limite di richieste raggiunto, riprova tra poco.");
    if (res.status === 401) throw new Error("Groq: chiave API non valida.");
    throw new Error(`Groq ${res.status}: ${text.slice(0, 300)}`);
  }

  const payload = JSON.parse(text) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  return parseAssistantReply(content);
}

/** Parser condiviso della risposta JSON dell'assistente. */
export function parseAssistantReply(content: string): AssistantReply {
  try {
    const parsed = JSON.parse(content) as Partial<AssistantReply> & {
      resident?: unknown;
      tools?: unknown;
    };
    return {
      risposta: parsed.risposta ?? content,
      comandi: Array.isArray(parsed.comandi)
        ? parsed.comandi
            .filter((c) => typeof c?.comando === "string" && c.comando.trim().length > 0)
            .slice(0, 5)
            .map((c) => ({ comando: c.comando.trim(), motivo: c.motivo ?? "" }))
        : [],
      azioni: Array.isArray(parsed.azioni)
        ? parsed.azioni
            .filter((a) => typeof a?.id === "string" && isKnownActionId(a.id))
            .slice(0, 5)
            .map((a) => ({
              id: a.id,
              params: sanitizeParams(a.params),
              motivo: a.motivo ?? "",
            }))
        : [],
      resident: parseResidentCalls(parsed.resident ?? parsed.tools),
    };
  } catch {
    return { risposta: content || "Nessuna risposta dall'IA.", comandi: [], azioni: [], resident: [] };
  }
}
