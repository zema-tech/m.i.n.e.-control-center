import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "./groq-models";

export type JarvisAnswer = {
  answer: string;
  model: string;
};

export async function askJarvis(input: {
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  model?: string;
  brainContext?: string;
  projectInstructions?: string;
  fileContext?: string;
}): Promise<JarvisAnswer> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY non configurata sul server.");

  const selected = GROQ_MODELS.some((item) => item.id === input.model)
    ? (input.model as GroqModelId)
    : DEFAULT_GROQ_MODEL;
  const system = [
    "Sei JARVIS, assistente personale e orchestratore generale di Omnicore.",
    "Rispondi in italiano, in modo concreto, calmo e professionale.",
    "Questa è la workspace JARVIS: non assumere accesso a Minecraft, Falix, log o console.",
    "Usa il contesto dei file solo quando pertinente e non inventare contenuti mancanti.",
    "Non esporre segreti. Qualsiasi futura azione esterna write o critical richiede conferma umana.",
    input.projectInstructions
      ? `\nIstruzioni del progetto:\n${input.projectInstructions.slice(0, 6000)}`
      : "",
    input.brainContext ? `\nMemoria e profilo JARVIS:\n${input.brainContext.slice(0, 8000)}` : "",
    input.fileContext
      ? `\nPassaggi rilevanti dai file del progetto:\n${input.fileContext.slice(0, 12000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: selected,
      temperature: 0.25,
      max_tokens: 4096,
      messages: [
        { role: "system", content: system },
        ...input.history.slice(-14),
        { role: "user", content: input.question },
      ],
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    if (response.status === 429) throw new Error("Limite IA raggiunto. Riprova tra poco.");
    if (response.status === 401) throw new Error("Chiave Groq non valida.");
    throw new Error(`Provider IA non disponibile (${response.status}).`);
  }
  const payload = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
  return {
    answer: payload.choices?.[0]?.message?.content?.trim() || "Nessuna risposta ricevuta.",
    model: selected,
  };
}
