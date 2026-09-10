/** Workspace JARVIS — persistenza locale isolata per account (preparata per sync cloud). */

export type JarvisMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type JarvisFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  text: string;
  createdAt: number;
  projectId?: string | null;
  chatId?: string | null;
};

export type JarvisProject = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: number;
  updatedAt: number;
};

export type JarvisChat = {
  id: string;
  title: string;
  projectId: string | null;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  messages: JarvisMsg[];
};

export type JarvisStore = {
  version: 1;
  projects: JarvisProject[];
  chats: JarvisChat[];
  files: JarvisFile[];
};

const PREFIX = "omnicore.jarvis.v1.";

function key(accountKey: string) {
  return `${PREFIX}${accountKey || "local"}`;
}

function empty(): JarvisStore {
  return { version: 1, projects: [], chats: [], files: [] };
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function loadJarvisStore(accountKey: string): JarvisStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(key(accountKey));
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as JarvisStore;
    if (!parsed || parsed.version !== 1) return empty();
    return {
      version: 1,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return empty();
  }
}

export function saveJarvisStore(accountKey: string, store: JarvisStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(accountKey), JSON.stringify(store));
  } catch {
    /* ignore — quota privata / storage pieno */
  }
}

/** Importa una volta le chat legacy da mine.chats.v1 */
export function migrateLegacyChats(accountKey: string): JarvisStore {
  const store = loadJarvisStore(accountKey);
  if (store.chats.length > 0) return store;
  if (typeof window === "undefined") return store;
  try {
    const raw = window.localStorage.getItem("mine.chats.v1");
    if (!raw) return store;
    const legacy = JSON.parse(raw) as Array<{
      id: string;
      title: string;
      updatedAt: number;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }>;
    if (!Array.isArray(legacy) || legacy.length === 0) return store;
    const migrated: JarvisChat[] = legacy.map((t) => ({
      id: t.id.startsWith("c") ? `chat_${t.id}` : t.id,
      title: t.title || "Chat importata",
      projectId: null,
      pinned: false,
      createdAt: t.updatedAt || Date.now(),
      updatedAt: t.updatedAt || Date.now(),
      messages: (t.messages || []).map((m, i) => ({
        id: `msg_${t.id}_${i}`,
        role: m.role,
        content: m.content,
        createdAt: (t.updatedAt || Date.now()) - (t.messages.length - i) * 1000,
      })),
    }));
    const next = { ...store, chats: migrated };
    saveJarvisStore(accountKey, next);
    return next;
  } catch {
    return store;
  }
}

export function createProject(
  store: JarvisStore,
  opts: { name: string; description?: string; instructions?: string },
): { store: JarvisStore; project: JarvisProject } {
  const project: JarvisProject = {
    id: newId("prj"),
    name: opts.name.trim() || "Nuovo progetto",
    description: (opts.description || "").trim(),
    instructions: (opts.instructions || "").trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return { store: { ...store, projects: [project, ...store.projects] }, project };
}

export function updateProject(
  store: JarvisStore,
  id: string,
  patch: Partial<Pick<JarvisProject, "name" | "description" | "instructions">>,
): JarvisStore {
  return {
    ...store,
    projects: store.projects.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
    ),
  };
}

export function deleteProject(store: JarvisStore, id: string): JarvisStore {
  return {
    ...store,
    projects: store.projects.filter((p) => p.id !== id),
    chats: store.chats.map((c) => (c.projectId === id ? { ...c, projectId: null } : c)),
    files: store.files.filter((f) => f.projectId !== id),
  };
}

export function createChat(
  store: JarvisStore,
  opts?: { projectId?: string | null; title?: string },
): { store: JarvisStore; chat: JarvisChat } {
  const chat: JarvisChat = {
    id: newId("chat"),
    title: opts?.title || "Nuova chat",
    projectId: opts?.projectId ?? null,
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  return { store: { ...store, chats: [chat, ...store.chats] }, chat };
}

export function updateChat(
  store: JarvisStore,
  id: string,
  patch: Partial<Pick<JarvisChat, "title" | "projectId" | "pinned" | "messages">>,
): JarvisStore {
  return {
    ...store,
    chats: store.chats
      .map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt),
  };
}

export function deleteChat(store: JarvisStore, id: string): JarvisStore {
  return {
    ...store,
    chats: store.chats.filter((c) => c.id !== id),
    files: store.files.filter((f) => f.chatId !== id),
  };
}

export function appendMessage(
  store: JarvisStore,
  chatId: string,
  msg: Omit<JarvisMsg, "id" | "createdAt"> & { id?: string; createdAt?: number },
): JarvisStore {
  const full: JarvisMsg = {
    id: msg.id || newId("msg"),
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt || Date.now(),
  };
  return {
    ...store,
    chats: store.chats.map((c) => {
      if (c.id !== chatId) return c;
      const messages = [...c.messages, full];
      const title =
        c.title === "Nuova chat" && full.role === "user" ? full.content.slice(0, 48) : c.title;
      return { ...c, messages, title, updatedAt: Date.now() };
    }),
  };
}

/** VibeSec: sanificazione centrale dei nomi file (UI + tool agente). */
export function sanitizeJarvisFileName(raw: string): string {
  const base = String(raw ?? "")
    .split(/[/\\]/)
    .pop()
    ?.replace(/\0/g, "")
    .replace(/\.\.+/g, ".")
    .trim();
  const safe = base?.replace(/[^a-zA-Z0-9._\-àèéìòù ]/g, "_").slice(0, 120) || "file.txt";
  // Niente dotfile nascosti né nomi che finiscono col punto
  return safe.replace(/^\.+/, "_").replace(/\.+$/, "") || "file.txt";
}

export function addTextFile(
  store: JarvisStore,
  opts: {
    name: string;
    text: string;
    mime?: string;
    projectId?: string | null;
    chatId?: string | null;
  },
): { store: JarvisStore; file: JarvisFile } {
  const file: JarvisFile = {
    id: newId("file"),
    name: sanitizeJarvisFileName(opts.name),
    mime: opts.mime || "text/plain",
    size: opts.text.length,
    text: opts.text.slice(0, 500_000),
    createdAt: Date.now(),
    projectId: opts.projectId ?? null,
    chatId: opts.chatId ?? null,
  };
  return { store: { ...store, files: [file, ...store.files] }, file };
}

export function deleteFile(store: JarvisStore, id: string): JarvisStore {
  return { ...store, files: store.files.filter((f) => f.id !== id) };
}

/** Estrae snippet rilevanti dai file del progetto/chat per il prompt. */
export function searchFileContext(
  store: JarvisStore,
  query: string,
  opts?: { projectId?: string | null; chatId?: string | null; maxChars?: number },
): string {
  const q = query.toLowerCase().trim();
  if (!q) return "";
  const max = opts?.maxChars ?? 6000;
  const files = store.files.filter((f) => {
    if (opts?.projectId && f.projectId === opts.projectId) return true;
    if (opts?.chatId && f.chatId === opts.chatId) return true;
    if (!opts?.projectId && !opts?.chatId) return true;
    return false;
  });
  const chunks: string[] = [];
  let used = 0;
  for (const f of files) {
    const lines = f.text.split(/\n/);
    const hits = lines.filter((l) => l.toLowerCase().includes(q)).slice(0, 8);
    if (hits.length === 0 && f.name.toLowerCase().includes(q)) {
      const head = f.text.slice(0, 400);
      const block = `### File: ${f.name}\n${head}`;
      if (used + block.length > max) break;
      chunks.push(block);
      used += block.length;
      continue;
    }
    if (hits.length) {
      const block = `### File: ${f.name}\n${hits.join("\n")}`;
      if (used + block.length > max) break;
      chunks.push(block);
      used += block.length;
    }
  }
  return chunks.join("\n\n");
}
