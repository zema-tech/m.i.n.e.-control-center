/**
 * Livello unico di chiamata IA multi-provider (server only).
 * Groq / OpenRouter / NVIDIA Build usano lo schema OpenAI-compatible.
 * Bytez usa il suo endpoint nativo.
 */

import type { ProviderId } from "./ai-providers";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const SECRETS: Record<ProviderId, string> = {
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  nvidia: "NVIDIA_API_KEY",
  bytez: "BYTEZ_API_KEY",
};

const OPENAI_COMPATIBLE: Partial<Record<ProviderId, string>> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
};

export function providerKey(provider: ProviderId): string | undefined {
  const name = SECRETS[provider];
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function availableProviders(): ProviderId[] {
  return (Object.keys(SECRETS) as ProviderId[]).filter((p) => Boolean(providerKey(p)));
}

export type CallOptions = {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
};

export async function callModel(
  provider: ProviderId,
  model: string,
  messages: ChatMsg[],
  opts: CallOptions = {},
): Promise<string> {
  const key = providerKey(provider);
  if (!key) throw new Error(`${provider}: chiave API non configurata sul server.`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

  try {
    if (provider === "bytez") {
      const res = await fetch(`https://api.bytez.com/models/v2/${model}`, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          params: { max_new_tokens: opts.maxTokens ?? 1024, temperature: opts.temperature ?? 0.3 },
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Bytez ${res.status}: ${text.slice(0, 200)}`);
      const payload = JSON.parse(text) as {
        output?: string | { content?: string };
        error?: string;
      };
      if (payload.error) throw new Error(`Bytez: ${payload.error}`);
      const out = payload.output;
      return (typeof out === "string" ? out : out?.content) ?? "";
    }

    const url = OPENAI_COMPATIBLE[provider];
    if (!url) throw new Error(`Provider ${provider} non supportato.`);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://mine.lovable.app";
      headers["X-Title"] = "M.I.N.E Panel";
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.25,
        max_tokens: opts.maxTokens ?? 2048,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 429) throw new Error(`${provider}: limite richieste raggiunto.`);
      if (res.status === 401) throw new Error(`${provider}: chiave API non valida.`);
      throw new Error(`${provider} ${res.status}: ${text.slice(0, 220)}`);
    }
    const payload = JSON.parse(text) as {
      choices?: { message?: { content?: string; reasoning?: string } }[];
    };
    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}
