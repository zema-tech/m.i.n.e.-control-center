export type AssistantReply = {
  risposta: string;
  comandi: { comando: string; motivo: string }[];
};

const SYSTEM_PROMPT = `Sei M.I.N.E., assistente IA per l'amministrazione di UN server Minecraft (Paper) hostato su Falix.
Rispondi SEMPRE in italiano, in modo tecnico ma chiaro e sintetico.
Analizzi i log forniti, individui la causa dei problemi e proponi soluzioni concrete.
NON esegui mai azioni da solo: puoi solo PROPORRE comandi da console Minecraft che l'amministratore confermerà.
Rispondi esclusivamente con JSON valido in questa forma:
{"risposta":"spiegazione in italiano","comandi":[{"comando":"say ciao","motivo":"perché serve"}]}
Se non serve nessun comando usa "comandi": [].`;

export async function askGroq(
  question: string,
  logContext: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<AssistantReply> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY non configurata sul server.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["GROQ_MODEL"] ?? "llama-3.3-70b-versatile",
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
    };
  } catch {
    return { risposta: content || "Nessuna risposta dall'IA.", comandi: [] };
  }
}
