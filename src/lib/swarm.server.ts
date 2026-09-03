/**
 * Orchestratore multi-IA (stile Hermes): brainstorming con modelli veloci,
 * sintesi + giudizio con modelli forti. Fallback automatico su Groq.
 */

import { SWARM_MODELS, type SwarmMode, type SwarmModel } from "./ai-providers";
import { assistantSystemPrompt, parseAssistantReply, type AssistantReply } from "./ai.server";
import { availableProviders, callModel, type ChatMsg } from "./llm.server";

export type SwarmStep = {
  fase: "brainstorm" | "critica" | "sintesi";
  provider: string;
  model: string;
  ok: boolean;
  contenuto: string;
  ms: number;
};

export type SwarmResult = AssistantReply & {
  mode: Exclude<SwarmMode, "auto">;
  steps: SwarmStep[];
};

const COMPLEX_HINTS = [
  "perché",
  "perche",
  "analizza",
  "ottimizza",
  "ottimizzare",
  "lag",
  "crash",
  "tps",
  "memoria",
  "ram",
  "plugin",
  "confronta",
  "piano",
  "strategia",
  "migra",
  "backup",
  "sicurezza",
  "errore",
  "exception",
  "timeout",
  "performance",
  "configura",
];

const CRITICAL_HINTS = ["elimina", "delete", "billing", "pagament", "reinstall", "wipe", "reset"];

/** Classificazione euristica della complessità. */
export function classifyComplexity(question: string, logContext: string): Exclude<SwarmMode, "auto"> {
  const q = question.toLowerCase();
  const hits = COMPLEX_HINTS.filter((h) => q.includes(h)).length;
  const risky = CRITICAL_HINTS.some((h) => q.includes(h));
  const long = question.length > 220;
  const bigLog = logContext.length > 2500;

  if (risky || hits >= 3 || (long && bigLog)) return "deep";
  if (hits >= 1 || long || bigLog || q.includes("?") === false) return "swarm";
  return "rapido";
}

function pick(tier: "fast" | "smart", limit: number): SwarmModel[] {
  const ready = new Set(availableProviders());
  const pool = SWARM_MODELS.filter((m) => m.tier === tier && ready.has(m.provider));
  // un modello per provider prima di ripetere lo stesso provider
  const out: SwarmModel[] = [];
  const seen = new Set<string>();
  for (const m of pool) {
    if (!seen.has(m.provider)) {
      seen.add(m.provider);
      out.push(m);
    }
  }
  for (const m of pool) if (!out.includes(m)) out.push(m);
  return out.slice(0, limit);
}

async function run(
  fase: SwarmStep["fase"],
  model: SwarmModel,
  messages: ChatMsg[],
  json: boolean,
  maxTokens: number,
): Promise<SwarmStep> {
  const started = Date.now();
  try {
    const contenuto = await callModel(model.provider, model.id, messages, {
      json,
      maxTokens,
      temperature: fase === "sintesi" ? 0.18 : 0.5,
    });
    return { fase, provider: model.provider, model: model.id, ok: true, contenuto, ms: Date.now() - started };
  } catch (error) {
    return {
      fase,
      provider: model.provider,
      model: model.id,
      ok: false,
      contenuto: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    };
  }
}

const JSON_CONTRACT = [
  "Rispondi SOLO con JSON valido in questo formato:",
  '{"risposta":"...","comandi":[{"comando":"...","motivo":"..."}],"azioni":[{"id":"...","params":{},"motivo":"..."}]}',
  "Le azioni devono usare SOLO id presenti nel catalogo mani. Niente azioni inventate.",
].join("\n");

export async function askSwarm(input: {
  question: string;
  logContext: string;
  history: { role: "user" | "assistant"; content: string }[];
  mode?: SwarmMode;
  brainContext?: string;
  memoryContext?: string;
}): Promise<SwarmResult> {
  const providers = availableProviders();
  if (providers.length === 0) {
    throw new Error(
      "Nessun provider IA configurato: aggiungi almeno GROQ_API_KEY (o OpenRouter / NVIDIA / Bytez).",
    );
  }

  const mode =
    !input.mode || input.mode === "auto"
      ? classifyComplexity(input.question, input.logContext)
      : input.mode;

  const system = assistantSystemPrompt();
  const brain = (input.brainContext ?? "").trim().slice(0, 8000);
  const memory = (input.memoryContext ?? "").trim().slice(0, 6000);

  const contextBlock = [
    brain ? `### PILASTRI ASSISTENTE\n${brain}` : "",
    memory ? `### MEMORIA PERSISTENTE (ricordi salvati)\n${memory}` : "",
    `### LOG / CONTESTO SERVER\n${input.logContext.slice(-7000) || "(nessun log)"}`,
    `### RICHIESTA UMANA\n${input.question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const steps: SwarmStep[] = [];
  const smart = pick("smart", 2);
  const fast = pick("fast", 3);

  if (mode === "rapido") {
    const single = fast[0] ?? smart[0];
    if (!single) throw new Error("Nessun modello disponibile per i provider configurati.");
    const step = await run(
      "sintesi",
      single,
      [
        { role: "system", content: system },
        ...input.history.slice(-8),
        { role: "user", content: `${contextBlock}\n\n${JSON_CONTRACT}` },
      ],
      true,
      2048,
    );
    steps.push(step);
    if (!step.ok) throw new Error(step.contenuto);
    return { ...parseAssistantReply(step.contenuto), mode, steps };
  }

  // Fase 1 — brainstorming parallelo (modelli veloci)
  const brainstormers = (fast.length ? fast : smart).slice(0, 3);
  const ideas = await Promise.all(
    brainstormers.map((m) =>
      run(
        "brainstorm",
        m,
        [
          {
            role: "system",
            content:
              "Sei un nodo di brainstorming di uno sciame IA che gestisce un server Minecraft su Falix. " +
              "Dai 3-5 ipotesi concrete e le verifiche/azioni consigliate. Max 160 parole. Nessun JSON.",
          },
          { role: "user", content: contextBlock },
        ],
        false,
        700,
      ),
    ),
  );
  steps.push(...ideas);

  const goodIdeas = ideas.filter((i) => i.ok && i.contenuto.trim().length > 0);

  // Fase 2 (solo deep) — critica incrociata
  let critique = "";
  if (mode === "deep" && smart[0] && goodIdeas.length > 0) {
    const step = await run(
      "critica",
      smart[0],
      [
        {
          role: "system",
          content:
            "Sei il revisore critico dello sciame. Valuta le ipotesi: quali sono solide, quali sbagliate e perché, " +
            "cosa manca. Max 180 parole, nessun JSON.",
        },
        {
          role: "user",
          content: `${contextBlock}\n\n### IPOTESI DEI NODI\n${goodIdeas
            .map((i, n) => `[nodo ${n + 1} · ${i.model}]\n${i.contenuto}`)
            .join("\n\n")}`,
        },
      ],
      false,
      600,
    );
    steps.push(step);
    if (step.ok) critique = step.contenuto;
  }

  // Fase 3 — sintesi finale con modello forte (fallback sugli altri)
  const synthPool = [...smart, ...fast];
  let final: SwarmStep | null = null;
  for (const m of synthPool) {
    const step = await run(
      "sintesi",
      m,
      [
        { role: "system", content: system },
        ...input.history.slice(-8),
        {
          role: "user",
          content: [
            contextBlock,
            goodIdeas.length
              ? `### IPOTESI DELLO SCIAME\n${goodIdeas
                  .map((i, n) => `[nodo ${n + 1} · ${i.model}]\n${i.contenuto}`)
                  .join("\n\n")}`
              : "",
            critique ? `### CRITICA DEL REVISORE\n${critique}` : "",
            "Sei il CERVELLO finale: unisci le idee, scarta le sbagliate, decidi e proponi le mani da usare.",
            JSON_CONTRACT,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      true,
      3000,
    );
    steps.push(step);
    if (step.ok && step.contenuto.trim()) {
      final = step;
      break;
    }
  }

  if (!final) {
    throw new Error(
      steps.filter((s) => !s.ok).map((s) => `${s.provider}: ${s.contenuto}`).join(" | ") ||
        "Sintesi IA non disponibile.",
    );
  }

  return { ...parseAssistantReply(final.contenuto), mode, steps };
}
