import { MINE_EXPERT_CORE, MINE_PLAYBOOKS } from "./ai-expert";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "./groq-models";

/**
 * Analisi neurale della rete server via Groq + expert layer.
 */
export async function analyzeNetworkWithGroq(input: {
  serverLabel: string;
  status: string;
  summary: string;
  model?: string;
}): Promise<{ ok: true; analysis: string } | { ok: false; analysis: string }> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) {
    return {
      ok: false,
      analysis:
        "GROQ_API_KEY non configurata. Imposta la chiave sul server per attivare il sistema neurale.",
    };
  }

  const allowed = GROQ_MODELS.map((m) => m.id);
  const chosen = allowed.includes(input.model as GroqModelId)
    ? (input.model as string)
    : (process.env["GROQ_MODEL"] ?? DEFAULT_GROQ_MODEL);

  const system = `Sei il nucleo neurale 3D di M.I.N.E (Minecraft Intelligent Network Engine).
Analizzi la rete di nodi (server, giocatori, mondi, plugin, metriche, connettori MCP) e rispondi in italiano.
${MINE_EXPERT_CORE}

${MINE_PLAYBOOKS}

Sii concreto: rischi (TPS, RAM, CPU), giocatori, servizi offline, azioni consigliate (comandi o tool MCP).
Max 220 parole. Nessun JSON.`;

  const user = `Server selezionato: ${input.serverLabel}
Stato: ${input.status}

Mappa nodi / metriche / eventi IA:
${input.summary.slice(0, 5500)}

Dammi un briefing operativo della rete 3D.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: chosen,
        temperature: 0.32,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, analysis: `Groq ${res.status}: ${text.slice(0, 200)}` };
    }
    const payload = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim() ?? "Nessuna analisi.";
    return { ok: true, analysis: content };
  } catch (e) {
    return {
      ok: false,
      analysis: e instanceof Error ? e.message : String(e),
    };
  }
}
