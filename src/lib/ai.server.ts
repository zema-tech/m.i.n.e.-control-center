import { FALIX_ACTIONS } from "./falix-actions";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "./groq-models";
import { MEGA_MCP_TOOLS, GDRIVE_MCP_TOOLS } from "./mcp";

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

const STORAGE_CATALOG = [...MEGA_MCP_TOOLS, ...GDRIVE_MCP_TOOLS]
  .map(
    (t) =>
      `${t.name} [${t.risk}] ${t.description}` +
      (t.params.length
        ? ` (params: ${t.params.map((p) => p.name + (p.required ? "*" : "")).join(", ")})`
        : ""),
  )
  .join("\n");

const STORAGE_TOOL_IDS = new Set(
  [...MEGA_MCP_TOOLS, ...GDRIVE_MCP_TOOLS].map((t) => t.name),
);

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

const SYSTEM_PROMPT = `Sei M.I.N.E., assistente IA per l'amministrazione di UN server Minecraft (Paper) hostato su Falix.
Rispondi SEMPRE in italiano, in modo tecnico ma chiaro e sintetico.
Analizzi i log forniti, individui la causa dei problemi e proponi soluzioni concrete.
NON esegui mai azioni da solo: PROPONI comandi console e/o azioni API Falix / tool MCP storage che l'amministratore approva.
Le azioni con rischio "write" o "critical" richiedono approvazione esplicita: spiega sempre le conseguenze.

Scope API: SOLO Falix (multi-account) + storage MEGA / Google Drive. Nessun altro host MC.

Azioni Falix disponibili (id [rischio] descrizione):
${ACTION_CATALOG}

Tool MCP storage MEGA / Google Drive (id [rischio] descrizione):
${STORAGE_CATALOG}

Rispondi esclusivamente con JSON valido in questa forma:
{"risposta":"spiegazione in italiano","comandi":[{"comando":"say ciao","motivo":"perché serve"}],"azioni":[{"id":"files.read","params":{"path":"/logs/latest.log"},"motivo":"perché serve"}]}
Usa "comandi" solo per comandi da console Minecraft, "azioni" per operazioni sul pannello Falix O tool storage (mega_*, gdrive_*).
Se non serve nulla usa liste vuote.`;

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
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-8),
        {
          role: "user",
          content: `Log recenti del server:\n${logContext.slice(-6000)}\n\nDomanda: ${question}`,
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
            .filter(
              (a) =>
                typeof a?.id === "string" &&
                (FALIX_ACTIONS.some((d) => d.id === a.id) || STORAGE_TOOL_IDS.has(a.id)),
            )
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
