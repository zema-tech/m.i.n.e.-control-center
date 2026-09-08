import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUp,
  Brain,
  Cable,
  ChevronDown,
  File,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SWARM_MODELS } from "@/lib/ai-providers";
import { getAuthState } from "@/lib/auth.functions";
import { type ChatThread, type Msg, loadThreads, newId, saveThreads } from "@/lib/chats";
import {
  askJarvis,
  loadJarvisWorkspace,
  mutateJarvisWorkspace,
  uploadJarvisFile,
  type JarvisMutation,
} from "@/lib/jarvis.functions";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [
      { title: "JARVIS — Workspace personale" },
      {
        name: "description",
        content: "Workspace JARVIS con progetti, chat, file e memoria privata.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
  },
  component: JarvisWorkspace,
});

type Project = { id: string; name: string; description: string; updatedAt: number };
type CloudFile = {
  id: string;
  projectId: string | null;
  chatId: string | null;
  name: string;
  mimeType: string;
  size: number;
};
type WorkspaceSnapshot = {
  cloud: boolean;
  projects: Array<Record<string, unknown>>;
  chats: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
};
const PROJECTS_KEY = "omnicore.jarvis.projects.v1";
const MIGRATION_KEY = "omnicore.jarvis.cloud-import.v1";
const ACCEPTED_EXTENSIONS = [
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
];

function localProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]") as Project[];
  } catch {
    return [];
  }
}
function persist(projects: Project[], chats: ChatThread[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  saveThreads(chats);
}
function titleFor(question: string) {
  return question.trim().replace(/\s+/g, " ").slice(0, 52) || "Nuova chat";
}
function bytesLabel(size: number) {
  return size < 1024
    ? `${size} B`
    : size < 1048576
      ? `${Math.ceil(size / 1024)} KB`
      : `${(size / 1048576).toFixed(1)} MB`;
}
function makeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
async function extractFile(file: globalThis.File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ACCEPTED_EXTENSIONS.includes(extension))
    throw new Error(`Formato .${extension || "?"} non supportato.`);
  if (file.size > 10 * 1024 * 1024) throw new Error("Il file supera il limite di 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension !== "pdf")
    return { text: new TextDecoder().decode(bytes), base64: makeBase64(bytes) };
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  const text = pages.join("\n").trim();
  if (!text)
    throw new Error(
      "Questo PDF non contiene testo selezionabile. I PDF scansionati richiedono OCR.",
    );
  return { text, base64: makeBase64(bytes) };
}

function JarvisWorkspace() {
  const loadCloud = useServerFn(loadJarvisWorkspace);
  const mutateCloud = useServerFn(mutateJarvisWorkspace);
  const uploadCloud = useServerFn(uploadJarvisFile);
  const sendToJarvis = useServerFn(askJarvis);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(
    SWARM_MODELS.find((item) => item.tier === "smart")?.id || SWARM_MODELS[0]?.id || "",
  );
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const active = chats.find((chat) => chat.id === activeId) ?? null;
  const activeProject = projects.find((project) => project.id === active?.projectId) ?? null;
  const activeFiles = files.filter((file) =>
    active?.projectId ? file.projectId === active.projectId : file.chatId === active?.id,
  );

  useEffect(() => {
    void (async () => {
      const fallbackChats = loadThreads();
      const fallbackProjects = localProjects();
      try {
        const raw = (await loadCloud({})) as WorkspaceSnapshot;
        setCloud(raw.cloud);
        if (raw.cloud) {
          if (!localStorage.getItem(MIGRATION_KEY) && fallbackChats.length) {
            await mutateCloud({
              data: {
                action: "chat.import",
                chats: fallbackChats.map((chat) => ({
                  id: chat.id,
                  title: chat.title,
                  updatedAt: chat.updatedAt,
                  messages: chat.messages.map(({ role, content }) => ({ role, content })),
                })),
              },
            });
            localStorage.setItem(MIGRATION_KEY, "done");
            const refreshed = (await loadCloud({})) as WorkspaceSnapshot;
            hydrate(refreshed);
          } else hydrate(raw);
        } else {
          setProjects(fallbackProjects);
          setChats(fallbackChats);
          setActiveId(fallbackChats[0]?.id ?? null);
        }
      } catch (reason) {
        setCloud(false);
        setProjects(fallbackProjects);
        setChats(fallbackChats);
        setActiveId(fallbackChats[0]?.id ?? null);
        setError(
          reason instanceof Error
            ? reason.message
            : "Cloud non raggiungibile: modalità locale attiva.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCloud, mutateCloud]);

  function hydrate(raw: WorkspaceSnapshot) {
    const nextProjects = raw.projects.map((item) => ({
      id: String(item.id),
      name: String(item.name),
      description: String(item.description || ""),
      updatedAt: Date.parse(String(item.updated_at)) || Date.now(),
    }));
    const messagesByChat = new Map<string, Msg[]>();
    raw.messages.forEach((item) => {
      const id = String(item.chat_id);
      messagesByChat.set(id, [
        ...(messagesByChat.get(id) || []),
        { role: item.role === "assistant" ? "assistant" : "user", content: String(item.content) },
      ]);
    });
    const nextChats: ChatThread[] = raw.chats.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      updatedAt: Date.parse(String(item.updated_at)) || Date.now(),
      projectId: item.project_id ? String(item.project_id) : null,
      pinned: Boolean(item.pinned),
      cloudId: String(item.id),
      messages: messagesByChat.get(String(item.id)) || [],
    }));
    setProjects(nextProjects);
    setChats(nextChats);
    setActiveId((current) =>
      current && nextChats.some((chat) => chat.id === current)
        ? current
        : (nextChats[0]?.id ?? null),
    );
    setFiles(
      raw.files.map((item) => ({
        id: String(item.id),
        projectId: item.project_id ? String(item.project_id) : null,
        chatId: item.chat_id ? String(item.chat_id) : null,
        name: String(item.name),
        mimeType: String(item.mime_type),
        size: Number(item.size),
      })),
    );
  }

  async function syncMutation(data: JarvisMutation) {
    if (cloud) await mutateCloud({ data });
  }
  function commit(nextProjects: Project[], nextChats: ChatThread[]) {
    setProjects(nextProjects);
    setChats(nextChats);
    persist(nextProjects, nextChats);
  }

  async function newChat(projectId: string | null = null) {
    const chat: ChatThread = {
      id: newId(),
      title: "Nuova chat",
      updatedAt: Date.now(),
      projectId,
      pinned: false,
      messages: [],
    };
    commit(projects, [chat, ...chats]);
    setActiveId(chat.id);
    setMobileOpen(false);
    await syncMutation({ action: "chat.create", id: chat.id, title: chat.title, projectId });
  }
  async function createProject() {
    const name = window.prompt("Nome del progetto intelligente:")?.trim();
    if (!name) return;
    const description =
      window.prompt("Descrizione e istruzioni del progetto (facoltative):")?.trim() || "";
    const project = { id: `p${newId()}`, name, description, updatedAt: Date.now() };
    commit([project, ...projects], chats);
    await syncMutation({ action: "project.create", id: project.id, name, description });
  }
  async function editProject(project: Project) {
    const name = window.prompt("Rinomina progetto:", project.name)?.trim();
    if (!name) return;
    const description =
      window.prompt("Descrizione e istruzioni:", project.description)?.trim() || "";
    const next = projects.map((item) =>
      item.id === project.id ? { ...item, name, description, updatedAt: Date.now() } : item,
    );
    commit(next, chats);
    await syncMutation({ action: "project.update", id: project.id, name, description });
  }
  async function deleteProject(project: Project) {
    if (!window.confirm(`Eliminare “${project.name}”? Le chat resteranno senza progetto.`)) return;
    const nextChats = chats.map((chat) =>
      chat.projectId === project.id ? { ...chat, projectId: null } : chat,
    );
    commit(
      projects.filter((item) => item.id !== project.id),
      nextChats,
    );
    await syncMutation({ action: "project.delete", id: project.id });
  }
  async function updateChat(chat: ChatThread, patch: Partial<ChatThread>) {
    const changed = { ...chat, ...patch, updatedAt: Date.now() };
    commit(
      projects,
      chats.map((item) => (item.id === chat.id ? changed : item)),
    );
    await syncMutation({
      action: "chat.update",
      id: changed.id,
      title: changed.title,
      projectId: changed.projectId ?? null,
      pinned: Boolean(changed.pinned),
    });
  }
  async function renameChat(chat: ChatThread) {
    const title = window.prompt("Rinomina chat:", chat.title)?.trim();
    if (title) await updateChat(chat, { title });
  }
  async function deleteChat(chat: ChatThread) {
    if (!window.confirm(`Eliminare “${chat.title}”?`)) return;
    const next = chats.filter((item) => item.id !== chat.id);
    commit(projects, next);
    if (activeId === chat.id) setActiveId(next[0]?.id ?? null);
    await syncMutation({ action: "chat.delete", id: chat.id });
  }

  async function deleteFile(file: CloudFile) {
    if (!window.confirm(`Eliminare il file “${file.name}”?`)) return;
    setFiles((current) => current.filter((item) => item.id !== file.id));
    await syncMutation({ action: "file.delete", id: file.id });
  }

  async function send() {
    const question = draft.trim();
    if (!question || sending) return;
    let chat = active;
    if (!chat) {
      chat = {
        id: newId(),
        title: titleFor(question),
        updatedAt: Date.now(),
        projectId: null,
        pinned: false,
        messages: [],
      };
      await syncMutation({
        action: "chat.create",
        id: chat.id,
        title: chat.title,
        projectId: null,
      });
      setActiveId(chat.id);
    }
    const userMessage: Msg = { role: "user", content: question };
    const nextTitle = chat.title === "Nuova chat" ? titleFor(question) : chat.title;
    const pending = {
      ...chat,
      title: nextTitle,
      updatedAt: Date.now(),
      messages: [...chat.messages, userMessage],
    };
    const nextChats = [pending, ...chats.filter((item) => item.id !== chat!.id)];
    commit(projects, nextChats);
    setDraft("");
    setSending(true);
    setError("");
    const userMessageId = `${chat.id}-${Date.now()}-u`;
    try {
      await syncMutation({
        action: "chat.update",
        id: chat.id,
        title: nextTitle,
        projectId: chat.projectId ?? null,
        pinned: Boolean(chat.pinned),
      });
      await syncMutation({
        action: "message.add",
        chatId: chat.id,
        id: userMessageId,
        role: "user",
        content: question,
      });
      const response = await sendToJarvis({
        data: {
          question,
          chatId: chat.id,
          projectId: chat.projectId ?? null,
          model,
          history: chat.messages.map(({ role, content }) => ({ role, content })),
        },
      });
      const assistant: Msg = { role: "assistant", content: response.risposta };
      const finished = nextChats.map((item) =>
        item.id === chat!.id
          ? { ...item, messages: [...pending.messages, assistant], updatedAt: Date.now() }
          : item,
      );
      commit(projects, finished);
      await syncMutation({
        action: "message.add",
        chatId: chat.id,
        id: `${chat.id}-${Date.now()}-a`,
        role: "assistant",
        content: response.risposta,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "JARVIS non è riuscito a rispondere.");
    } finally {
      setSending(false);
    }
  }

  async function attach(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!cloud) {
      setError(
        "Configura Supabase per allegare, indicizzare e sincronizzare i file in modo privato.",
      );
      return;
    }
    const projectId = active?.projectId ?? null;
    if (!projectId && !active) {
      setError("Apri una chat o seleziona un progetto prima di allegare un file.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const extracted = await extractFile(selected);
      const id = `f${newId()}`;
      await uploadCloud({
        data: {
          id,
          projectId,
          chatId: projectId ? null : active!.id,
          name: selected.name,
          mimeType: selected.type || "application/octet-stream",
          size: selected.size,
          base64: extracted.base64,
          text: extracted.text,
        },
      });
      setFiles((current) => [
        {
          id,
          projectId,
          chatId: projectId ? null : active!.id,
          name: selected.name,
          mimeType: selected.type,
          size: selected.size,
        },
        ...current,
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Caricamento file fallito.");
    } finally {
      setUploading(false);
    }
  }

  function dictate() {
    const SpeechRecognition = (
      window as typeof window & {
        webkitSpeechRecognition?: new () => {
          lang: string;
          interimResults: boolean;
          start(): void;
          stop(): void;
          onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
          onend: () => void;
          onerror: () => void;
        };
      }
    ).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(
        "La dettatura non è supportata da questo browser. Puoi continuare a scrivere normalmente.",
      );
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.onresult = (event) =>
      setDraft((value) => `${value}${value ? " " : ""}${event.results[0]?.[0]?.transcript || ""}`);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Dettatura interrotta: controlla il permesso del microfono.");
    };
    setListening(true);
    recognition.start();
  }

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, sending]);

  const pinned = useMemo(() => chats.filter((chat) => chat.pinned), [chats]);
  const recent = useMemo(() => chats.filter((chat) => !chat.pinned && !chat.projectId), [chats]);
  const sidebar = (
    <Sidebar
      projects={projects}
      chats={chats}
      pinned={pinned}
      recent={recent}
      activeId={activeId}
      files={files}
      onSelect={(id) => {
        setActiveId(id);
        setMobileOpen(false);
      }}
      onNew={newChat}
      onCreateProject={createProject}
      onEditProject={editProject}
      onDeleteProject={deleteProject}
      onUpdateChat={updateChat}
      onRenameChat={renameChat}
      onDeleteChat={deleteChat}
      onDeleteFile={deleteFile}
    />
  );

  return (
    <div className="jarvis-app flex h-dvh overflow-hidden bg-[#03070c] text-slate-100">
      <aside className="hidden w-[304px] shrink-0 border-r border-cyan-300/[0.09] bg-[#050a10] lg:flex">
        {sidebar}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(90vw,304px)] border-cyan-300/10 bg-[#050a10] p-0"
        >
          <SheetTitle className="sr-only">Menu JARVIS</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <main className="relative flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_8%,rgba(15,148,210,0.10),transparent_35%)]">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.05] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-cyan-300 lg:hidden"
              aria-label="Apri menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-sm font-semibold">
                {active?.title || "Nuova conversazione"}
              </h1>
              <p className="truncate text-[10px] uppercase tracking-[0.14em] text-cyan-300/55">
                {activeProject?.name || (cloud === false ? "Modalità locale" : "Workspace privato")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-cyan-300/10 bg-cyan-300/[0.04] px-2.5 py-1 text-[10px] text-cyan-200/65 sm:block">
              {cloud
                ? "Cloud sincronizzato"
                : cloud === false
                  ? "Solo dispositivo"
                  : "Connessione…"}
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-cyan-300/10 bg-cyan-300/[0.04] px-2.5 py-1 text-[10px] text-cyan-200/65 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Account privato
            </span>
          </div>
        </header>
        {loading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
          </div>
        ) : (
          <>
            <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-44 pt-6 sm:px-8">
              {activeFiles.length ? (
                <div
                  className="mx-auto mb-5 flex max-w-3xl flex-wrap gap-2"
                  aria-label="File nel contesto"
                >
                  {activeFiles.map((file) => (
                    <span
                      key={file.id}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-200/10 bg-cyan-300/[0.04] px-3 py-1.5 text-[10px] text-slate-300"
                    >
                      <FileText className="h-3 w-3 text-cyan-300/70" />
                      <span className="max-w-40 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => void deleteFile(file)}
                        className="text-slate-500 hover:text-rose-300"
                        aria-label={`Elimina ${file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {active?.messages.length ? (
                <div className="mx-auto max-w-3xl space-y-7">
                  {active.messages.map((message, index) => (
                    <article
                      key={`${message.role}-${index}`}
                      className={
                        message.role === "user"
                          ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-cyan-200/10 bg-cyan-300/[0.07] px-4 py-3 text-sm leading-7"
                          : "max-w-[92%] text-[15px] leading-7 text-slate-200"
                      }
                    >
                      {message.role === "assistant" ? (
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                          <Sparkles className="h-3.5 w-3.5" /> JARVIS
                        </div>
                      ) : null}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </article>
                  ))}
                  {sending ? (
                    <div className="flex items-center gap-2 text-sm text-cyan-200/70">
                      <Loader2 className="h-4 w-4 animate-spin" /> JARVIS sta elaborando…
                    </div>
                  ) : null}
                  <div ref={bottom} />
                </div>
              ) : (
                <EmptyState project={activeProject} />
              )}
            </section>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#03070c] via-[#03070c] to-transparent px-4 pb-5 pt-14 sm:px-8">
              <div className="pointer-events-auto mx-auto max-w-3xl">
                <Composer
                  draft={draft}
                  setDraft={setDraft}
                  model={model}
                  setModel={setModel}
                  sending={sending}
                  uploading={uploading}
                  listening={listening}
                  onSend={send}
                  onAttach={() => fileInput.current?.click()}
                  onDictate={dictate}
                />
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
                  onChange={(event) => void attach(event)}
                />
                {error ? (
                  <div className="mt-2 flex items-start justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-3 py-2 text-xs text-rose-200">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError("")} aria-label="Chiudi errore">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
                <p className="mt-2 text-center text-[10px] text-slate-600">
                  JARVIS può commettere errori. Verifica sempre le informazioni importanti.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Sidebar(props: {
  projects: Project[];
  chats: ChatThread[];
  pinned: ChatThread[];
  recent: ChatThread[];
  activeId: string | null;
  files: CloudFile[];
  onSelect(id: string): void;
  onNew(projectId?: string | null): void;
  onCreateProject(): void;
  onEditProject(project: Project): void;
  onDeleteProject(project: Project): void;
  onUpdateChat(chat: ChatThread, patch: Partial<ChatThread>): void;
  onRenameChat(chat: ChatThread): void;
  onDeleteChat(chat: ChatThread): void;
  onDeleteFile(file: CloudFile): void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-white/[0.05] px-4">
        <Link to="/home" className="flex items-center gap-2.5 no-underline">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-300/[0.08] text-cyan-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>
            <strong className="block font-display text-sm tracking-wide">JARVIS</strong>
            <small className="block text-[8px] uppercase tracking-[0.2em] text-cyan-300/55">
              Omnicore intelligence
            </small>
          </span>
        </Link>
        <Link
          to="/home"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-cyan-300"
          aria-label="Torna all'Hub"
        >
          <Home className="h-4 w-4" />
        </Link>
      </div>
      <div className="p-3">
        <button
          type="button"
          onClick={() => props.onNew(null)}
          className="flex w-full items-center gap-3 rounded-xl border border-cyan-200/15 bg-cyan-300/[0.08] px-3.5 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/[0.12]"
        >
          <Plus className="h-4 w-4" /> Nuova chat
        </button>
      </div>
      <nav className="space-y-1 px-3" aria-label="Strumenti JARVIS">
        <Link to="/agent" className="jarvis-side-link">
          <Brain className="h-4 w-4" /> Sistema neurale
        </Link>
        <Link to="/connectors" className="jarvis-side-link">
          <Cable className="h-4 w-4" /> Connettori
        </Link>
      </nav>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <SectionTitle
          label="Progetti"
          action={props.onCreateProject}
          icon={<FolderPlus className="h-3.5 w-3.5" />}
        />
        {props.projects.map((project) => (
          <div
            key={project.id}
            className="mb-2 rounded-xl border border-white/[0.045] bg-white/[0.018] p-1"
          >
            <div className="group flex items-center gap-2 px-2 py-2">
              <Folder className="h-4 w-4 text-cyan-300/65" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{project.name}</span>
              <button
                type="button"
                onClick={() => props.onNew(project.id)}
                className="text-slate-600 hover:text-cyan-300"
                aria-label={`Nuova chat in ${project.name}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => props.onEditProject(project)}
                className="text-slate-600 hover:text-cyan-300"
                aria-label={`Modifica ${project.name}`}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => props.onDeleteProject(project)}
                className="text-slate-600 hover:text-rose-300"
                aria-label={`Elimina ${project.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {project.description ? (
              <p className="line-clamp-2 px-2 pb-2 text-[10px] leading-4 text-slate-600">
                {project.description}
              </p>
            ) : null}
            {props.chats
              .filter((chat) => chat.projectId === project.id)
              .map((chat) => (
                <ChatRow key={chat.id} chat={chat} active={chat.id === props.activeId} {...props} />
              ))}
            {props.files
              .filter((file) => file.projectId === project.id)
              .slice(0, 3)
              .map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-slate-600"
                >
                  <FileText className="h-3 w-3" />
                  <span className="truncate">{file.name}</span>
                  <span className="ml-auto">{bytesLabel(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => props.onDeleteFile(file)}
                    className="hover:text-rose-300"
                    aria-label={`Elimina ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
          </div>
        ))}
        {props.pinned.length ? (
          <>
            <SectionTitle label="Fissate" />
            {props.pinned.map((chat) => (
              <ChatRow key={chat.id} chat={chat} active={chat.id === props.activeId} {...props} />
            ))}
          </>
        ) : null}
        <SectionTitle label="Recenti" />
        {props.recent.length ? (
          props.recent.map((chat) => (
            <ChatRow key={chat.id} chat={chat} active={chat.id === props.activeId} {...props} />
          ))
        ) : (
          <p className="px-2 py-3 text-xs text-slate-400">
            Le nuove conversazioni appariranno qui.
          </p>
        )}
      </div>
    </div>
  );
}
function SectionTitle({
  label,
  action,
  icon,
}: {
  label: string;
  action?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-1 mt-5 flex items-center justify-between px-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action}
          className="text-slate-600 hover:text-cyan-300"
          aria-label={`Aggiungi ${label}`}
        >
          {icon}
        </button>
      ) : null}
    </div>
  );
}
function ChatRow({
  chat,
  active,
  projects,
  onSelect,
  onUpdateChat,
  onRenameChat,
  onDeleteChat,
}: {
  chat: ChatThread;
  active: boolean;
  projects: Project[];
  onSelect(id: string): void;
  onUpdateChat(chat: ChatThread, patch: Partial<ChatThread>): void;
  onRenameChat(chat: ChatThread): void;
  onDeleteChat(chat: ChatThread): void;
}) {
  const [tools, setTools] = useState(false);
  return (
    <div
      className={`group relative mb-0.5 rounded-lg ${active ? "bg-cyan-300/[0.09] text-cyan-100" : "text-slate-400 hover:bg-white/[0.035] hover:text-slate-200"}`}
    >
      <button
        type="button"
        onClick={() => onSelect(chat.id)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs"
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="min-w-0 flex-1 truncate">{chat.title}</span>
      </button>
      <button
        type="button"
        onClick={() => setTools((value) => !value)}
        className="absolute right-1.5 top-1.5 rounded p-1 opacity-0 hover:bg-black/30 group-hover:opacity-100 focus:opacity-100"
        aria-label={`Azioni per ${chat.title}`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {tools ? (
        <div className="absolute right-1 top-9 z-20 w-48 rounded-xl border border-cyan-200/10 bg-[#091019] p-1.5 shadow-2xl">
          <ToolButton
            icon={chat.pinned ? PinOff : Pin}
            label={chat.pinned ? "Rimuovi dai fissati" : "Fissa"}
            onClick={() => {
              onUpdateChat(chat, { pinned: !chat.pinned });
              setTools(false);
            }}
          />
          <ToolButton
            icon={Pencil}
            label="Rinomina"
            onClick={() => {
              onRenameChat(chat);
              setTools(false);
            }}
          />
          <label className="flex items-center gap-2 rounded-lg px-2 py-2 text-[11px] text-slate-400">
            <Folder className="h-3.5 w-3.5" />
            <select
              value={chat.projectId || ""}
              onChange={(event) => {
                onUpdateChat(chat, { projectId: event.target.value || null });
                setTools(false);
              }}
              className="min-w-0 flex-1 bg-transparent outline-none"
            >
              <option value="">Nessun progetto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <ToolButton
            icon={Trash2}
            label="Elimina"
            danger
            onClick={() => {
              onDeleteChat(chat);
              setTools(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
function ToolButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pin;
  label: string;
  onClick(): void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] hover:bg-white/5 ${danger ? "text-rose-300" : "text-slate-400"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
function EmptyState({ project }: { project: Project | null }) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center text-center">
      <div className="relative mb-7 grid h-20 w-20 place-items-center rounded-full border border-cyan-200/15 bg-cyan-300/[0.04] shadow-[0_0_60px_rgba(34,211,238,0.12)]">
        <div className="absolute inset-2 rounded-full border border-dashed border-cyan-300/20" />
        <Sparkles className="h-7 w-7 text-cyan-300" />
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/60">
        {project ? project.name : "Intelligenza personale"}
      </p>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
        Come posso aiutarti?
      </h2>
      <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">
        {project?.description ||
          "Inizia una conversazione, collega le tue fonti o crea un progetto. JARVIS mantiene ogni spazio ordinato e privato."}
      </p>
    </div>
  );
}
function Composer({
  draft,
  setDraft,
  model,
  setModel,
  sending,
  uploading,
  listening,
  onSend,
  onAttach,
  onDictate,
}: {
  draft: string;
  setDraft(value: string): void;
  model: string;
  setModel(value: string): void;
  sending: boolean;
  uploading: boolean;
  listening: boolean;
  onSend(): void;
  onAttach(): void;
  onDictate(): void;
}) {
  return (
    <div className="rounded-2xl border border-cyan-200/15 bg-[#091019]/95 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.45),0_0_35px_rgba(8,145,178,0.05)] backdrop-blur-xl">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="Scrivi a JARVIS…"
        rows={2}
        className="max-h-40 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
        aria-label="Messaggio per JARVIS"
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onAttach}
          disabled={uploading}
          className="composer-tool"
          aria-label="Allega file"
          title="Allega TXT, Markdown, JSON, CSV, sorgenti o PDF"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onDictate}
          className={`composer-tool ${listening ? "text-cyan-300" : ""}`}
          aria-label="Dettatura vocale"
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <label className="ml-1 flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 hover:bg-white/5">
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="max-w-36 bg-transparent outline-none sm:max-w-52"
            aria-label="Modello IA"
          >
            {SWARM_MODELS.map((item) => (
              <option key={`${item.provider}-${item.id}`} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3 w-3" />
        </label>
        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim() || sending}
          className="ml-auto grid h-9 w-9 place-items-center rounded-xl bg-cyan-300 text-[#031017] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Invia messaggio"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
