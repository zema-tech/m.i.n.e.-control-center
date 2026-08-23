import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "./groq-models";

/**
 * Analisi neurale della rete server via Groq.
 * Riceve un riassunto nodi/server e restituisce insight in italiano.
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

  const system = `Sei il nucleo neurale di M.I.N.E (Minecraft Intelligent Network Engine).
Analizzi la rete di nodi (server, giocatori, mondi, plugin, metriche, connettori) e rispondi in italiano.
Sii concreto: rischi (TPS, RAM, CPU), giocatori, servizi offline, azioni consigliate.
Max 180 parole. Nessun JSON.`;

  const user = `Server selezionato: ${input.serverLabel}
Stato: ${input.status}

Mappa nodi / metriche:
${input.summary.slice(0, 5000)}

Dammi un briefing operativo della rete.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: chosen,
        temperature: 0.35,
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
