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

export type ProposedAction = {
  id: string;
  params: Record<string, string | number | boolean>;
  motivo: string;
};

export type AssistantReply = {
  risposta: string;
  comandi: { comando: string; motivo: string }[];
  azioni: ProposedAction[];
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

function sanitizeParams(input: unknown): Record<string, string | number | boolean> {
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

function systemPrompt(): string {
  const catalog = [
    "Azioni Falix (id [rischio] descrizione):",
    ACTION_CATALOG,
    "",
    "Tool MCP storage + connettori + research + One gateway:",
    STORAGE_CATALOG,
    "",
    mcpToolSummaryForAi(["falix", "mega", "gdrive", "connector", "research", "one"]).slice(0, 6000),
  ].join("\n");
  return buildExpertSystemPrompt(catalog);
}

export async function askGroq(
  question: string,
  logContext: string,
  history: { role: "user" | "assistant"; content: string }[],
  model: string = DEFAULT_GROQ_MODEL,
): Promise<AssistantReply> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY non configurata sul server.");

  const allowed = GROQ_MODELS.map((m) => m.id);
  const chosen = allowed.includes(model as GroqModelId)
    ? model
    : (process.env["GROQ_MODEL"] ?? DEFAULT_GROQ_MODEL);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chosen,
      temperature: 0.28,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt() },
        ...history.slice(-10),
        {
          role: "user",
          content: [
            "### Contesto operativo M.I.N.E",
            "Usa l'expert layer: diagnosi log, comandi sicuri, snippet config solo se utili.",
            "Per studiare un host/provider proponi host_research con params.query.",
            "Per app SaaS (Gmail, Slack, Stripe…) proponi i tool One: list_one_integrations, search_one_platform_actions, get_one_action_knowledge, execute_one_action (write richiede conferma).",
            "",
            "### Log recenti del server",
            logContext.slice(-7000),
            "",
            "### Domanda amministratore",
            question,
          ].join("\n"),
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
  try {
    const parsed = JSON.parse(content) as Partial<AssistantReply>;
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
    };
  } catch {
    return { risposta: content || "Nessuna risposta dall'IA.", comandi: [], azioni: [] };
  }
}
