import type { Msg } from "./chats";

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
  messages: Msg[];
  createdAt: number;
  updatedAt: number;
};

export type JarvisFile = {
  id: string;
  projectId: string | null;
  chatId: string | null;
  name: string;
  mimeType: string;
  size: number;
  status: "ready" | "processing" | "error";
  error?: string;
  createdAt: number;
};

export type JarvisWorkspace = {
  projects: JarvisProject[];
  chats: JarvisChat[];
  files: JarvisFile[];
};

const WORKSPACE_KEY = "omnicore.jarvis.workspace.v1";
const LEGACY_KEY = "mine.chats.v1";
const MIGRATED_KEY = "omnicore.jarvis.legacy-migrated.v1";

export const EMPTY_JARVIS_WORKSPACE: JarvisWorkspace = {
  projects: [],
  chats: [],
  files: [],
};

export function jarvisId(prefix: "p" | "c" | "f") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function readStoredWorkspace(): JarvisWorkspace {
  if (typeof window === "undefined") return EMPTY_JARVIS_WORKSPACE;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return EMPTY_JARVIS_WORKSPACE;
    const parsed = JSON.parse(raw) as Partial<JarvisWorkspace>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return EMPTY_JARVIS_WORKSPACE;
  }
}

/** Importa una sola volta le vecchie chat /assistant senza creare duplicati. */
function migrateLegacyChats(workspace: JarvisWorkspace): JarvisWorkspace {
  if (typeof window === "undefined" || window.localStorage.getItem(MIGRATED_KEY)) return workspace;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    const legacy = raw
      ? (JSON.parse(raw) as Array<{
          id: string;
          title: string;
          updatedAt: number;
          messages: Msg[];
        }>)
      : [];
    const known = new Set(workspace.chats.map((chat) => chat.id));
    const imported = Array.isArray(legacy)
      ? legacy
          .filter((chat) => !known.has(chat.id))
          .map((chat) => ({
            id: chat.id,
            title: chat.title || "Chat importata",
            projectId: null,
            pinned: false,
            messages: Array.isArray(chat.messages) ? chat.messages : [],
            createdAt: chat.updatedAt || Date.now(),
            updatedAt: chat.updatedAt || Date.now(),
          }))
      : [];
    const next = { ...workspace, chats: [...imported, ...workspace.chats] };
    window.localStorage.setItem(MIGRATED_KEY, "1");
    if (imported.length) saveJarvisWorkspace(next);
    return next;
  } catch {
    window.localStorage.setItem(MIGRATED_KEY, "1");
    return workspace;
  }
}

export function loadJarvisWorkspace(): JarvisWorkspace {
  return migrateLegacyChats(readStoredWorkspace());
}

export function saveJarvisWorkspace(workspace: JarvisWorkspace) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
}

export function createJarvisChat(projectId: string | null = null): JarvisChat {
  const now = Date.now();
  return {
    id: jarvisId("c"),
    title: "Nuova chat",
    projectId,
    pinned: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
