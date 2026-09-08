import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import { SWARM_MODELS } from "./ai-providers";
import { readSession, sessionCookieName } from "./auth.server";
import { isSupabaseAdminConfigured, supabaseAdmin } from "@/integrations/supabase/client.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(12000),
});

async function ownerKey() {
  const session = await readSession(getCookie(sessionCookieName));
  if (!session) throw new Error("Sessione scaduta: accedi di nuovo.");
  return session.role === "admin"
    ? "admin"
    : session.userId || session.tempId || `member:${session.label || "guest"}`;
}

function db() {
  // I tipi generati verranno riallineati al prossimo `supabase gen types`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function requireOwnedProject(owner: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const project = await db()
    .from("jarvis_projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_key", owner)
    .maybeSingle();
  if (project.error || !project.data) throw new Error("Progetto non trovato o non accessibile.");
}

async function requireOwnedChat(owner: string, chatId: string) {
  const chat = await db()
    .from("jarvis_chats")
    .select("id")
    .eq("id", chatId)
    .eq("owner_key", owner)
    .maybeSingle();
  if (chat.error || !chat.data) throw new Error("Chat non trovata o non accessibile.");
}

export const loadJarvisWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const owner = await ownerKey();
  if (!isSupabaseAdminConfigured())
    return { cloud: false as const, projects: [], chats: [], messages: [], files: [] };
  const [projects, chats, messages, files] = await Promise.all([
    db()
      .from("jarvis_projects")
      .select("*")
      .eq("owner_key", owner)
      .order("updated_at", { ascending: false }),
    db()
      .from("jarvis_chats")
      .select("*")
      .eq("owner_key", owner)
      .order("updated_at", { ascending: false }),
    db()
      .from("jarvis_messages")
      .select("*")
      .eq("owner_key", owner)
      .order("created_at", { ascending: true }),
    db()
      .from("jarvis_files")
      .select("id,project_id,chat_id,name,mime_type,size,created_at")
      .eq("owner_key", owner)
      .order("created_at", { ascending: false }),
  ]);
  const error = projects.error || chats.error || messages.error || files.error;
  if (error) throw new Error(`Cloud JARVIS non disponibile: ${error.message}`);
  return {
    cloud: true as const,
    projects: projects.data,
    chats: chats.data,
    messages: messages.data,
    files: files.data,
  };
});

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("project.create"),
    id: z.string(),
    name: z.string().min(1).max(80),
    description: z.string().max(1200).default(""),
  }),
  z.object({
    action: z.literal("project.update"),
    id: z.string(),
    name: z.string().min(1).max(80),
    description: z.string().max(1200).default(""),
  }),
  z.object({ action: z.literal("project.delete"), id: z.string() }),
  z.object({
    action: z.literal("chat.create"),
    id: z.string(),
    title: z.string().min(1).max(120),
    projectId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("chat.update"),
    id: z.string(),
    title: z.string().min(1).max(120),
    projectId: z.string().nullable().optional(),
    pinned: z.boolean().default(false),
  }),
  z.object({ action: z.literal("chat.delete"), id: z.string() }),
  z.object({
    action: z.literal("chat.import"),
    chats: z
      .array(
        z.object({
          id: z.string(),
          title: z.string().max(120),
          updatedAt: z.number(),
          messages: z.array(messageSchema).max(200),
        }),
      )
      .max(100),
  }),
  z.object({
    action: z.literal("message.add"),
    chatId: z.string(),
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    content: z.string().max(12000),
  }),
  z.object({ action: z.literal("file.delete"), id: z.string() }),
]);
export type JarvisMutation = z.infer<typeof mutationSchema>;

export const mutateJarvisWorkspace = createServerFn({ method: "POST" })
  .validator((input: unknown) => mutationSchema.parse(input))
  .handler(async ({ data }) => {
    const owner = await ownerKey();
    if (!isSupabaseAdminConfigured()) return { cloud: false as const };
    let query;
    if (data.action === "project.create")
      query = db()
        .from("jarvis_projects")
        .insert({ id: data.id, owner_key: owner, name: data.name, description: data.description });
    else if (data.action === "project.update")
      query = db()
        .from("jarvis_projects")
        .update({
          name: data.name,
          description: data.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("owner_key", owner);
    else if (data.action === "project.delete")
      query = db().from("jarvis_projects").delete().eq("id", data.id).eq("owner_key", owner);
    else if (data.action === "chat.create") {
      await requireOwnedProject(owner, data.projectId);
      query = db()
        .from("jarvis_chats")
        .insert({
          id: data.id,
          owner_key: owner,
          title: data.title,
          project_id: data.projectId ?? null,
        });
    } else if (data.action === "chat.update") {
      await requireOwnedChat(owner, data.id);
      await requireOwnedProject(owner, data.projectId);
      query = db()
        .from("jarvis_chats")
        .update({
          title: data.title,
          project_id: data.projectId ?? null,
          pinned: data.pinned,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("owner_key", owner);
    } else if (data.action === "chat.delete")
      query = db().from("jarvis_chats").delete().eq("id", data.id).eq("owner_key", owner);
    else if (data.action === "message.add") {
      await requireOwnedChat(owner, data.chatId);
      query = db().from("jarvis_messages").upsert(
        {
          id: data.id,
          owner_key: owner,
          chat_id: data.chatId,
          role: data.role,
          content: data.content,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      const touched = await db()
        .from("jarvis_chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.chatId)
        .eq("owner_key", owner);
      if (touched.error) throw new Error(touched.error.message);
    } else if (data.action === "file.delete") {
      const existing = await db()
        .from("jarvis_files")
        .select("storage_path")
        .eq("id", data.id)
        .eq("owner_key", owner)
        .maybeSingle();
      if (existing.data?.storage_path)
        await db().storage.from("jarvis-project-files").remove([existing.data.storage_path]);
      query = db().from("jarvis_files").delete().eq("id", data.id).eq("owner_key", owner);
    } else {
      for (const chat of data.chats) {
        const imported = await db()
          .from("jarvis_chats")
          .upsert(
            {
              id: chat.id,
              owner_key: owner,
              title: chat.title || "Chat importata",
              updated_at: new Date(chat.updatedAt).toISOString(),
            },
            { onConflict: "id", ignoreDuplicates: true },
          );
        if (imported.error) throw new Error(imported.error.message);
        const owned = await db()
          .from("jarvis_chats")
          .select("id")
          .eq("id", chat.id)
          .eq("owner_key", owner)
          .maybeSingle();
        if (!owned.data) continue;
        if (chat.messages.length) {
          const importedMessages = await db()
            .from("jarvis_messages")
            .upsert(
              chat.messages.map((message, index) => ({
                id: `${chat.id}-legacy-${index}`,
                owner_key: owner,
                chat_id: chat.id,
                role: message.role,
                content: message.content,
              })),
              { onConflict: "id", ignoreDuplicates: true },
            );
          if (importedMessages.error) throw new Error(importedMessages.error.message);
        }
      }
      return { cloud: true as const };
    }
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return { cloud: true as const };
  });

export const uploadJarvisFile = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string(),
        projectId: z.string().nullable(),
        chatId: z.string().nullable(),
        name: z.string().min(1).max(180),
        mimeType: z.string().max(100),
        size: z
          .number()
          .int()
          .nonnegative()
          .max(10 * 1024 * 1024),
        base64: z.string().max(15_000_000),
        text: z.string().max(2_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const owner = await ownerKey();
    if (!isSupabaseAdminConfigured()) return { cloud: false as const };
    if (!data.projectId && !data.chatId)
      throw new Error("Seleziona un progetto o una chat per il file.");
    await requireOwnedProject(owner, data.projectId);
    if (data.chatId) await requireOwnedChat(owner, data.chatId);
    const extension = data.name.split(".").pop()?.toLowerCase() || "";
    const supported = new Set([
      "txt",
      "md",
      "markdown",
      "json",
      "csv",
      "js",
      "jsx",
      "ts",
      "tsx",
      "css",
      "html",
      "py",
      "java",
      "c",
      "cpp",
      "h",
      "go",
      "rs",
      "sql",
      "yaml",
      "yml",
      "xml",
      "pdf",
    ]);
    if (!supported.has(extension)) throw new Error(`Formato .${extension || "?"} non supportato.`);
    if (!data.text.trim())
      throw new Error("Il file non contiene testo leggibile. I PDF scansionati richiedono OCR.");
    const bytes = Uint8Array.from(atob(data.base64), (character) => character.charCodeAt(0));
    if (bytes.byteLength !== data.size) throw new Error("Dimensione del file non valida.");
    const safeOwner = owner.replace(/[^a-zA-Z0-9:_-]/g, "_");
    const safeScope = (data.projectId || `chat-${data.chatId}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${safeOwner}/${safeScope}/${data.id.replace(/[^a-zA-Z0-9_-]/g, "_")}-${data.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const stored = await db()
      .storage.from("jarvis-project-files")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (stored.error) throw new Error(stored.error.message);
    const inserted = await db().from("jarvis_files").insert({
      id: data.id,
      owner_key: owner,
      project_id: data.projectId,
      chat_id: data.chatId,
      name: data.name,
      mime_type: data.mimeType,
      size: data.size,
      storage_path: path,
      extracted_text: data.text,
    });
    if (inserted.error) {
      await db().storage.from("jarvis-project-files").remove([path]);
      throw new Error(inserted.error.message);
    }
    const chunks = data.text.match(/[\s\S]{1,1400}/g) ?? [];
    if (chunks.length) {
      const chunked = await db()
        .from("jarvis_file_chunks")
        .insert(
          chunks.slice(0, 300).map((content, index) => ({
            owner_key: owner,
            file_id: data.id,
            project_id: data.projectId,
            chat_id: data.chatId,
            chunk_index: index,
            content,
          })),
        );
      if (chunked.error) {
        await db().from("jarvis_files").delete().eq("id", data.id).eq("owner_key", owner);
        await db().storage.from("jarvis-project-files").remove([path]);
        throw new Error(`Indicizzazione file fallita: ${chunked.error.message}`);
      }
    }
    return { cloud: true as const };
  });

export const askJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(12000),
        chatId: z.string(),
        projectId: z.string().nullable(),
        model: z.string().max(160).optional(),
        history: z.array(messageSchema).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const owner = await ownerKey();
    let context = "";
    let projectInstructions = "";
    if (isSupabaseAdminConfigured()) {
      await requireOwnedChat(owner, data.chatId);
      await requireOwnedProject(owner, data.projectId);
      if (data.projectId) {
        const project = await db()
          .from("jarvis_projects")
          .select("description")
          .eq("id", data.projectId)
          .eq("owner_key", owner)
          .single();
        if (!project.error)
          projectInstructions = String(project.data?.description || "").slice(0, 3000);
      }
      let query = db()
        .from("jarvis_file_chunks")
        .select("content,jarvis_files(name)")
        .eq("owner_key", owner);
      query = data.projectId
        ? query.eq("project_id", data.projectId)
        : query.eq("chat_id", data.chatId);
      const words = data.question
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => word.length > 3)
        .slice(0, 8);
      if (words.length)
        query = query.textSearch("search_vector", words.join(" | "), {
          type: "raw",
          config: "italian",
        });
      const found = await query.limit(8);
      if (!found.error)
        context = (found.data ?? [])
          .map(
            (item: { content: string; jarvis_files?: { name?: string } }) =>
              `[${item.jarvis_files?.name || "file"}]\n${item.content}`,
          )
          .join("\n\n")
          .slice(0, 10000);
    }
    const { availableProviders, callModel } = await import("./llm.server");
    const providers = availableProviders();
    const preferred = SWARM_MODELS.find(
      (item) => item.id === data.model && providers.includes(item.provider),
    );
    const selected =
      preferred ??
      SWARM_MODELS.find((item) => item.tier === "smart" && providers.includes(item.provider)) ??
      SWARM_MODELS.find((item) => providers.includes(item.provider));
    if (!selected) throw new Error("Nessun provider IA configurato.");
    const risposta = await callModel(
      selected.provider,
      selected.id,
      [
        {
          role: "system",
          content: [
            "Sei JARVIS, assistente personale generalista di Omnicore. Rispondi in italiano con precisione e tono naturale. Usa il contesto dei file quando pertinente e dichiaralo senza inventare. Non sei un pannello Minecraft: log, console e Falix appartengono a M.I.N.E. Non affermare mai di aver eseguito azioni che non risultano da uno strumento.",
            projectInstructions ? `Istruzioni del progetto:\n${projectInstructions}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        ...data.history.slice(-12),
        {
          role: "user",
          content: `${context ? `CONTESTO FILE DEL PROGETTO:\n${context}\n\n` : ""}${data.question}`,
        },
      ],
      { maxTokens: 3000, temperature: 0.25 },
    );
    return {
      risposta,
      provider: selected.provider,
      model: selected.id,
      contextUsed: Boolean(context),
    };
  });
