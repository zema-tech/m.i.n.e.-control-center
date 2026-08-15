/** Modelli Groq gratuiti supportati (safe per client + server). */
export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  { id: "gemma2-9b-it", label: "Gemma 2 9B" },
] as const;

export type GroqModelId = (typeof GROQ_MODELS)[number]["id"];

export const DEFAULT_GROQ_MODEL: GroqModelId = "llama-3.3-70b-versatile";
