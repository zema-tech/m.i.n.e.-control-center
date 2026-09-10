/** Modelli Groq supportati (safe per client + server). Solo ID attivi. */
export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
] as const;

export type GroqModelId = (typeof GROQ_MODELS)[number]["id"];

export const DEFAULT_GROQ_MODEL: GroqModelId = "llama-3.3-70b-versatile";
