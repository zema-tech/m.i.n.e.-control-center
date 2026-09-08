import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { JarvisChat, JarvisFile, JarvisProject, JarvisWorkspace } from "./jarvis";
import { GROQ_MODELS } from "./groq-models";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(16000),
});
const entityIdSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const projectSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(600),
  instructions: z.string().max(6000),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
const chatSchema = z.object({
  id: entityIdSchema,
  title: z.string().min(1).max(140),
  projectId: entityIdSchema.nullable(),
  pinned: z.boolean(),
  messages: z.array(messageSchema).max(300),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
const workspaceSchema = z.object({
  projects: z.array(projectSchema).max(100),
  chats: z.array(chatSchema).max(300),
  files: z.array(z.unknown()).max(1000).default([]),
});
const modelIds = GROQ_MODELS.map((model) => model.id) as [string, ...string[]];

type DbProject = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  created_at: string;
  updated_at: string;
};
type DbChat = {
  id: string;
  project_id: string | null;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};
type DbMessage = {
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  position: number;
};
type DbFile = {
  id: string;
  project_id: string | null;
  chat_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  status: "ready" | "processing" | "error";
  error: string | null;
  created_at: string;
};

async function requestAccountId() {
  const [{ getCookie }, auth] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("./auth.server"),
  ]);
  const session = await auth.readSession(getCookie(auth.sessionCookieName));
  if (!session || session.mustSetPassword) throw new Error("Sessione non valida.");
  if (!session.permissions.includes("jarvis")) throw new Error("Accesso JARVIS non autorizzato.");
  if (session.role === "admin") return "admin";
  if (!session.userId) throw new Error("Account privo di identificativo.");
  return `member:${session.userId}`;
}

async function cloudClient(): Promise<SupabaseClient | null> {
  const module = await import("@/integrations/supabase/client.server");
  return module.isSupabaseAdminConfigured()
    ? (module.supabaseAdmin as unknown as SupabaseClient)
    : null;
}

function timestamp(value: string) {
  return new Date(value).getTime();
}

async function readCloudWorkspace(
  client: SupabaseClient,
  accountId: string,
): Promise<JarvisWorkspace> {
  const [projectsResult, chatsResult, messagesResult, filesResult] = await Promise.all([
    client
      .from("jarvis_projects")
      .select("*")
      .eq("account_id", accountId)
      .order("updated_at", { ascending: false }),
    client
      .from("jarvis_chats")
      .select("*")
      .eq("account_id", accountId)
      .order("updated_at", { ascending: false }),
    client
      .from("jarvis_messages")
      .select("chat_id,role,content,position")
      .eq("account_id", accountId)
      .order("position"),
    client
      .from("jarvis_files")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
  ]);
  const error =
    projectsResult.error || chatsResult.error || messagesResult.error || filesResult.error;
  if (error) throw new Error(`Sincronizzazione JARVIS fallita: ${error.message}`);

  const projects = (projectsResult.data as DbProject[]).map<JarvisProject>((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    instructions: project.instructions,
    createdAt: timestamp(project.created_at),
    updatedAt: timestamp(project.updated_at),
  }));
  const messages = messagesResult.data as DbMessage[];
  const chats = (chatsResult.data as DbChat[]).map<JarvisChat>((chat) => ({
    id: chat.id,
    title: chat.title,
    projectId: chat.project_id,
    pinned: chat.pinned,
    messages: messages
      .filter((message) => message.chat_id === chat.id)
      .sort((a, b) => a.position - b.position)
      .map((message) => ({ role: message.role, content: message.content })),
    createdAt: timestamp(chat.created_at),
    updatedAt: timestamp(chat.updated_at),
  }));
  const files = (filesResult.data as DbFile[]).map<JarvisFile>((file) => ({
    id: file.id,
    projectId: file.project_id,
    chatId: file.chat_id,
    name: file.name,
    mimeType: file.mime_type,
    size: file.size_bytes,
    status: file.status,
    ...(file.error ? { error: file.error } : {}),
    createdAt: timestamp(file.created_at),
  }));
  return { projects, chats, files };
}

export const getJarvisWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const accountId = await requestAccountId();
  const client = await cloudClient();
  if (!client) return { cloud: false as const, workspace: null };
  return { cloud: true as const, workspace: await readCloudWorkspace(client, accountId) };
});

export const syncJarvisWorkspace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => workspaceSchema.parse(input))
  .handler(async ({ data }) => {
    const accountId = await requestAccountId();
    const client = await cloudClient();
    if (!client) return { cloud: false as const };

    const projectIds = new Set(data.projects.map((project) => project.id));
    const chats = data.chats.map((chat) => ({
      ...chat,
      projectId: chat.projectId && projectIds.has(chat.projectId) ? chat.projectId : null,
    }));
    const projectRows = data.projects.map((project) => ({
      id: project.id,
      account_id: accountId,
      name: project.name,
      description: project.description,
      instructions: project.instructions,
      created_at: new Date(project.createdAt).toISOString(),
      updated_at: new Date(project.updatedAt).toISOString(),
    }));
    const chatRows = chats.map((chat) => ({
      id: chat.id,
      account_id: accountId,
      project_id: chat.projectId,
      title: chat.title,
      pinned: chat.pinned,
      created_at: new Date(chat.createdAt).toISOString(),
      updated_at: new Date(chat.updatedAt).toISOString(),
    }));

    const proposedIds = [...projectRows.map((row) => row.id), ...chatRows.map((row) => row.id)];
    if (proposedIds.length) {
      const collisionResults = await Promise.all([
        client.from("jarvis_projects").select("account_id").in("id", proposedIds),
        client.from("jarvis_chats").select("account_id").in("id", proposedIds),
      ]);
      const hasForeignCollision = collisionResults.some((result) =>
        (result.data as { account_id: string }[] | null)?.some(
          (row) => row.account_id !== accountId,
        ),
      );
      if (hasForeignCollision) throw new Error("Identificativo workspace non valido.");
    }

    const existingProjects = await client
      .from("jarvis_projects")
      .select("id")
      .eq("account_id", accountId);
    const existingChats = await client
      .from("jarvis_chats")
      .select("id")
      .eq("account_id", accountId);
    if (existingProjects.error || existingChats.error)
      throw new Error("Impossibile leggere il workspace cloud.");
    const staleChats = (existingChats.data as { id: string }[])
      .map((item) => item.id)
      .filter((id) => !chats.some((chat) => chat.id === id));
    const staleProjects = (existingProjects.data as { id: string }[])
      .map((item) => item.id)
      .filter((id) => !projectIds.has(id));

    if (projectRows.length) {
      const result = await client.from("jarvis_projects").upsert(projectRows, { onConflict: "id" });
      if (result.error) throw new Error(result.error.message);
    }
    if (chatRows.length) {
      const result = await client.from("jarvis_chats").upsert(chatRows, { onConflict: "id" });
      if (result.error) throw new Error(result.error.message);
    }
    if (staleChats.length)
      await client.from("jarvis_chats").delete().eq("account_id", accountId).in("id", staleChats);
    if (staleProjects.length) {
      const staleFiles = await client
        .from("jarvis_files")
        .select("storage_path")
        .eq("account_id", accountId)
        .in("project_id", staleProjects);
      const stalePaths = (staleFiles.data as { storage_path: string }[] | null)?.map(
        (file) => file.storage_path,
      );
      if (stalePaths?.length) await client.storage.from("jarvis-private").remove(stalePaths);
      await client
        .from("jarvis_projects")
        .delete()
        .eq("account_id", accountId)
        .in("id", staleProjects);
    }

    for (const chat of chats) {
      await client
        .from("jarvis_messages")
        .delete()
        .eq("account_id", accountId)
        .eq("chat_id", chat.id);
      if (chat.messages.length) {
        const result = await client.from("jarvis_messages").insert(
          chat.messages.map((message, position) => ({
            account_id: accountId,
            chat_id: chat.id,
            role: message.role,
            content: message.content,
            position,
          })),
        );
        if (result.error) throw new Error(result.error.message);
      }
    }
    return { cloud: true as const };
  });

const uploadSchema = z.object({
  id: entityIdSchema,
  projectId: entityIdSchema.nullable(),
  chatId: entityIdSchema.nullable(),
  name: z.string().min(1).max(240),
  mimeType: z.string().max(120),
  size: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
  contentBase64: z.string().min(1).max(14_500_000),
});

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "html",
  "xml",
  "yaml",
  "yml",
  "toml",
  "sql",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "go",
  "rs",
  "php",
  "rb",
  "sh",
]);

function fileExtension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function splitText(text: string) {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += 3600) {
    chunks.push(text.slice(start, start + 4000));
  }
  return chunks.slice(0, 250);
}

export const uploadJarvisFile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const accountId = await requestAccountId();
    const client = await cloudClient();
    if (!client) throw new Error("Configura Supabase per sincronizzare e indicizzare i file.");
    const extension = fileExtension(data.name);
    if (extension !== "pdf" && !TEXT_EXTENSIONS.has(extension)) {
      throw new Error("Formato non supportato. Usa PDF, TXT, Markdown, JSON, CSV o file sorgente.");
    }
    if (data.projectId) {
      const ownedProject = await client
        .from("jarvis_projects")
        .select("id")
        .eq("account_id", accountId)
        .eq("id", data.projectId)
        .maybeSingle();
      if (!ownedProject.data) throw new Error("Progetto non disponibile per questo account.");
    }
    if (data.chatId) {
      const ownedChat = await client
        .from("jarvis_chats")
        .select("id")
        .eq("account_id", accountId)
        .eq("id", data.chatId)
        .maybeSingle();
      if (!ownedChat.data) throw new Error("Chat non disponibile per questo account.");
    }
    const bytes = Buffer.from(data.contentBase64, "base64");
    if (bytes.byteLength !== data.size || bytes.byteLength > 10 * 1024 * 1024) {
      throw new Error("Dimensione del file non valida.");
    }
    let text = "";
    if (extension === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const document = await getDocumentProxy(new Uint8Array(bytes));
      const extracted = await extractText(document, { mergePages: true });
      text = extracted.text;
    } else {
      text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }
    text = text.replaceAll("\u0000", "").trim();
    if (text.length < 2) throw new Error("Il file non contiene testo estraibile.");

    const safeAccount = accountId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeName = data.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
    const path = `${safeAccount}/${data.projectId ?? "inbox"}/${data.id}-${safeName}`;
    const storage = await client.storage.from("jarvis-private").upload(path, bytes, {
      contentType: data.mimeType || "application/octet-stream",
      upsert: false,
    });
    if (storage.error) throw new Error(`Upload non riuscito: ${storage.error.message}`);
    const fileRow = {
      id: data.id,
      account_id: accountId,
      project_id: data.projectId,
      chat_id: data.chatId,
      name: data.name,
      mime_type: data.mimeType || "application/octet-stream",
      size_bytes: data.size,
      storage_path: path,
      status: "ready",
    };
    const inserted = await client.from("jarvis_files").insert(fileRow);
    if (inserted.error) {
      await client.storage.from("jarvis-private").remove([path]);
      throw new Error(inserted.error.message);
    }
    const chunks = splitText(text);
    const chunkResult = await client.from("jarvis_file_chunks").insert(
      chunks.map((content, chunkIndex) => ({
        account_id: accountId,
        file_id: data.id,
        project_id: data.projectId,
        chat_id: data.chatId,
        chunk_index: chunkIndex,
        content,
      })),
    );
    if (chunkResult.error) {
      await client.from("jarvis_files").delete().eq("account_id", accountId).eq("id", data.id);
      await client.storage.from("jarvis-private").remove([path]);
      throw new Error(`Indicizzazione non riuscita: ${chunkResult.error.message}`);
    }
    return {
      cloud: true as const,
      file: {
        id: data.id,
        projectId: data.projectId,
        chatId: data.chatId,
        name: data.name,
        mimeType: data.mimeType,
        size: data.size,
        status: "ready" as const,
        createdAt: Date.now(),
      },
      chunks: chunks.length,
    };
  });

export const deleteJarvisFile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: entityIdSchema }).parse(input))
  .handler(async ({ data }) => {
    const accountId = await requestAccountId();
    const client = await cloudClient();
    if (!client) return { cloud: false as const };
    const file = await client
      .from("jarvis_files")
      .select("storage_path")
      .eq("account_id", accountId)
      .eq("id", data.id)
      .maybeSingle();
    if (file.data?.storage_path)
      await client.storage.from("jarvis-private").remove([file.data.storage_path as string]);
    const result = await client
      .from("jarvis_files")
      .delete()
      .eq("account_id", accountId)
      .eq("id", data.id);
    if (result.error) throw new Error(result.error.message);
    return { cloud: true as const };
  });

export const sendJarvisMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(8000),
        history: z.array(messageSchema).max(20).default([]),
        model: z.enum(modelIds).optional(),
        projectId: entityIdSchema.nullable(),
        chatId: entityIdSchema,
        projectInstructions: z.string().max(6000).optional(),
        brainContext: z.string().max(12000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const accountId = await requestAccountId();
    const client = await cloudClient();
    let fileContext = "";
    let sourceIds: string[] = [];
    if (client) {
      const search = await client.rpc("search_jarvis_chunks", {
        owner_account_id: accountId,
        selected_project_id: data.projectId,
        selected_chat_id: data.chatId,
        search_query: data.question,
        result_limit: 6,
      });
      if (!search.error && Array.isArray(search.data)) {
        const rows = search.data as { file_id: string; content: string }[];
        sourceIds = [...new Set(rows.map((row) => row.file_id))];
        fileContext = rows
          .map((row, index) => `[Passaggio ${index + 1}]\n${row.content}`)
          .join("\n\n");
      }
    }
    const { askJarvis } = await import("./jarvis.server");
    const answer = await askJarvis({ ...data, fileContext });
    let sources: string[] = [];
    if (client && sourceIds.length) {
      const files = await client
        .from("jarvis_files")
        .select("id,name")
        .eq("account_id", accountId)
        .in("id", sourceIds);
      if (!files.error)
        sources = (files.data as { id: string; name: string }[]).map((file) => file.name);
    }
    return { ok: true as const, answer: answer.answer, model: answer.model, sources };
  });
