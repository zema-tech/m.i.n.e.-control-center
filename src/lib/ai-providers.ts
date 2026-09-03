/**
 * Catalogo multi-provider IA (safe per client: nessuna chiave qui).
 * fast  = modelli rapidi → fase di brainstorming
 * smart = modelli forti  → fase di sintesi / giudizio
 */

export type ProviderId = "groq" | "openrouter" | "nvidia" | "bytez";
export type ModelTier = "fast" | "smart";

export type SwarmModel = {
  provider: ProviderId;
  id: string;
  label: string;
  tier: ModelTier;
};

export const PROVIDERS: {
  id: ProviderId;
  label: string;
  secret: string;
  docs: string;
  note: string;
}[] = [
  {
    id: "groq",
    label: "Groq",
    secret: "GROQ_API_KEY",
    docs: "https://console.groq.com/keys",
    note: "Inferenza ultra-rapida: ideale per il brainstorming.",
  },
  {
    id: "openrouter",
    label: "OpenRouter (free)",
    secret: "OPENROUTER_API_KEY",
    docs: "https://openrouter.ai/models?q=free",
    note: "Tanti modelli gratuiti, ottimo per idee diverse in parallelo.",
  },
  {
    id: "nvidia",
    label: "NVIDIA Build",
    secret: "NVIDIA_API_KEY",
    docs: "https://build.nvidia.com/models",
    note: "Modelli grandi (Nemotron, DeepSeek) per sintesi e giudizio.",
  },
  {
    id: "bytez",
    label: "Bytez",
    secret: "BYTEZ_API_KEY",
    docs: "https://bytez.com/models",
    note: "Catalogo enorme di modelli open per task specializzati.",
  },
];

export const SWARM_MODELS: SwarmModel[] = [
  // --- Groq ---
  { provider: "groq", id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", tier: "smart" },
  { provider: "groq", id: "gemma2-9b-it", label: "Gemma 2 9B", tier: "fast" },
  { provider: "groq", id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", tier: "fast" },
  // --- OpenRouter (free) ---
  {
    provider: "openrouter",
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "OR · Llama 3.3 70B",
    tier: "smart",
  },
  {
    provider: "openrouter",
    id: "deepseek/deepseek-r1:free",
    label: "OR · DeepSeek R1",
    tier: "smart",
  },
  {
    provider: "openrouter",
    id: "qwen/qwen-2.5-72b-instruct:free",
    label: "OR · Qwen 2.5 72B",
    tier: "fast",
  },
  {
    provider: "openrouter",
    id: "google/gemma-2-9b-it:free",
    label: "OR · Gemma 2 9B",
    tier: "fast",
  },
  // --- NVIDIA Build ---
  {
    provider: "nvidia",
    id: "nvidia/llama-3.3-nemotron-super-49b-v1",
    label: "NV · Nemotron Super 49B",
    tier: "smart",
  },
  {
    provider: "nvidia",
    id: "meta/llama-3.3-70b-instruct",
    label: "NV · Llama 3.3 70B",
    tier: "smart",
  },
  {
    provider: "nvidia",
    id: "qwen/qwen2.5-coder-32b-instruct",
    label: "NV · Qwen Coder 32B",
    tier: "fast",
  },
  // --- Bytez ---
  { provider: "bytez", id: "microsoft/phi-4", label: "Bytez · Phi-4", tier: "fast" },
  {
    provider: "bytez",
    id: "Qwen/Qwen2.5-7B-Instruct",
    label: "Bytez · Qwen 2.5 7B",
    tier: "fast",
  },
];

export type SwarmMode = "rapido" | "swarm" | "deep" | "auto";

export const SWARM_MODES: { id: SwarmMode; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Decide da sé: veloce per cose semplici, swarm per task complessi." },
  { id: "rapido", label: "Rapido", hint: "Un solo modello veloce. Risposta immediata." },
  { id: "swarm", label: "Swarm", hint: "Più modelli veloci fanno brainstorming, un modello forte sintetizza." },
  { id: "deep", label: "Deep", hint: "Brainstorming + critica incrociata + sintesi finale (stile Hermes)." },
];

export function modelsByTier(tier: ModelTier): SwarmModel[] {
  return SWARM_MODELS.filter((m) => m.tier === tier);
}
