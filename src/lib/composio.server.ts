/**
 * Composio = mani esterne dell'agente (GitHub, Discord, Gmail, Notion…).
 * Le letture sono automatiche, le scritture richiedono approvazione umana.
 */

const BASE = "https://backend.composio.dev/api/v3";

const READ_PATTERNS = [
  "GET_",
  "LIST_",
  "FETCH_",
  "SEARCH_",
  "READ_",
  "FIND_",
  "RETRIEVE_",
  "_INFO",
  "_STATUS",
];

export type ComposioTool = {
  slug: string;
  name: string;
  toolkit: string;
  description: string;
  readOnly: boolean;
};

function key(): string {
  const k = process.env["COMPOSIO_API_KEY"];
  if (!k) throw new Error("COMPOSIO_API_KEY non configurata sul server.");
  return k;
}

export function composioConfigured(): boolean {
  return Boolean(process.env["COMPOSIO_API_KEY"]);
}

export function isReadOnlyTool(slug: string): boolean {
  const s = slug.toUpperCase();
  return READ_PATTERNS.some((p) => s.includes(p));
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": key(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Composio ${res.status}: ${text.slice(0, 250)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function listToolkits(): Promise<{ slug: string; name: string }[]> {
  const raw = (await api("/toolkits?limit=60")) as {
    items?: { slug?: string; name?: string }[];
  };
  return (raw.items ?? [])
    .filter((t) => t.slug)
    .map((t) => ({ slug: String(t.slug), name: t.name ?? String(t.slug) }));
}

export async function listTools(toolkit?: string): Promise<ComposioTool[]> {
  const query = toolkit ? `?toolkit_slug=${encodeURIComponent(toolkit)}&limit=50` : "?limit=50";
  const raw = (await api(`/tools${query}`)) as {
    items?: { slug?: string; name?: string; description?: string; toolkit?: { slug?: string } }[];
  };
  return (raw.items ?? [])
    .filter((t) => t.slug)
    .map((t) => ({
      slug: String(t.slug),
      name: t.name ?? String(t.slug),
      toolkit: t.toolkit?.slug ?? toolkit ?? "-",
      description: (t.description ?? "").slice(0, 240),
      readOnly: isReadOnlyTool(String(t.slug)),
    }));
}

export async function executeTool(input: {
  slug: string;
  args?: Record<string, unknown>;
  approved?: boolean;
  userId?: string;
}): Promise<{ ok: boolean; output: string }> {
  if (!isReadOnlyTool(input.slug) && !input.approved) {
    return {
      ok: false,
      output: `Azione Composio "${input.slug}" in scrittura: serve la tua approvazione.`,
    };
  }
  const raw = (await api(`/tools/execute/${encodeURIComponent(input.slug)}`, {
    method: "POST",
    body: JSON.stringify({
      arguments: input.args ?? {},
      user_id: input.userId ?? "mine-owner",
    }),
  })) as { successful?: boolean; error?: string; data?: unknown };

  return {
    ok: raw.successful !== false && !raw.error,
    output: raw.error ? String(raw.error) : JSON.stringify(raw.data ?? raw, null, 2).slice(0, 6000),
  };
}
