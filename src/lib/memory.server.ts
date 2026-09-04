/**
 * Memoria persistente dell'agente (Lovable Cloud).
 * Accesso solo lato server: il pannello è protetto da password + sessione.
 */

export type MemoryRow = {
  id: string;
  kind: string;
  title: string;
  content: string;
  tags: string[];
  importance: number;
  source: string;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  kind: string;
  provider: string | null;
  model: string | null;
  summary: string;
  detail: string;
  ok: boolean;
  created_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listMemories(limit = 100): Promise<MemoryRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("agent_memory")
    .select("*")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MemoryRow[];
}

export async function addMemory(input: {
  kind?: string;
  title: string;
  content: string;
  tags?: string[];
  importance?: number;
  source?: string;
}): Promise<MemoryRow> {
  const db = await admin();
  const { data, error } = await db
    .from("agent_memory")
    .insert({
      kind: input.kind ?? "nota",
      title: input.title.slice(0, 200),
      content: input.content.slice(0, 8000),
      tags: input.tags ?? [],
      importance: Math.min(5, Math.max(1, input.importance ?? 3)),
      source: input.source ?? "manuale",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MemoryRow;
}

export async function removeMemory(id: string): Promise<void> {
  const db = await admin();
  const { error } = await db.from("agent_memory").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Contesto compatto da iniettare nel prompt IA. */
export async function memoryContext(limit = 25): Promise<string> {
  try {
    const rows = await listMemories(limit);
    if (rows.length === 0) return "";
    return rows
      .map((r) => `- [${r.kind}·p${r.importance}] ${r.title}: ${r.content.slice(0, 400)}`)
      .join("\n");
  } catch {
    return "";
  }
}

export async function recordEvent(input: {
  kind: string;
  summary: string;
  provider?: string | null;
  model?: string | null;
  detail?: Record<string, unknown>;
  ok?: boolean;
}): Promise<void> {
  try {
    const db = await admin();
    await db.from("agent_events").insert({
      kind: input.kind,
      summary: input.summary.slice(0, 2000),
      provider: input.provider ?? null,
      model: input.model ?? null,
      detail: (input.detail ?? {}) as never,
      ok: input.ok ?? true,
    });
  } catch {
    // la memoria non deve mai bloccare l'operazione principale
  }
}

export async function listEvents(limit = 80): Promise<EventRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("agent_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...(row as Omit<EventRow, "detail">),
    detail: JSON.stringify((row as { detail?: unknown }).detail ?? {}),
  }));
}
