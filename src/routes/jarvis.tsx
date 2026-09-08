import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUp,
  BrainCircuit,
  Cable,
  Check,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Home,
  LoaderCircle,
  LogOut,
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
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { buildBrainContextForPrompt } from "@/lib/agent-brain";
import { getAuthState, logout } from "@/lib/auth.functions";
import type { Msg } from "@/lib/chats";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";
import {
  deleteJarvisFile,
  getJarvisWorkspace,
  sendJarvisMessage,
  syncJarvisWorkspace,
  uploadJarvisFile,
} from "@/lib/jarvis.functions";
import {
  createJarvisChat,
  jarvisId,
  loadJarvisWorkspace,
  saveJarvisWorkspace,
  type JarvisChat,
  type JarvisProject,
  type JarvisWorkspace,
} from "@/lib/jarvis";

const searchSchema = z.object({ chat: z.string().optional() });

export const Route = createFileRoute("/jarvis")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "JARVIS — Workspace personale" },
      {
        name: "description",
        content: "Workspace JARVIS con progetti, conversazioni e file privati.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: JarvisWorkspacePage,
});

type CloudState = "loading" | "synced" | "offline" | "error";
type ProjectDraft = Pick<JarvisProject, "id" | "name" | "description" | "instructions">;

function sortChats(chats: JarvisChat[]) {
  return [...chats].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileToBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossibile leggere il file."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function JarvisWorkspacePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchWorkspace = useServerFn(getJarvisWorkspace);
  const syncWorkspace = useServerFn(syncJarvisWorkspace);
  const askJarvis = useServerFn(sendJarvisMessage);
  const uploadFile = useServerFn(uploadJarvisFile);
  const removeFileCloud = useServerFn(deleteJarvisFile);
  const doLogout = useServerFn(logout);
  const [workspace, setWorkspace] = useState<JarvisWorkspace>({
    projects: [],
    chats: [],
    files: [],
  });
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState<CloudState>("loading");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [chatMenu, setChatMenu] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [input, setInput] = useState("");
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedChat = useMemo(
    () => workspace.chats.find((chat) => chat.id === search.chat) ?? workspace.chats[0] ?? null,
    [search.chat, workspace.chats],
  );
  const selectedProject = useMemo(
    () => workspace.projects.find((project) => project.id === selectedChat?.projectId) ?? null,
    [selectedChat?.projectId, workspace.projects],
  );
  const visibleChats = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase("it");
    return sortChats(
      query
        ? workspace.chats.filter((chat) => chat.title.toLocaleLowerCase("it").includes(query))
        : workspace.chats,
    );
  }, [searchText, workspace.chats]);
  const projectFiles = useMemo(
    () =>
      workspace.files.filter((file) =>
        selectedProject
          ? file.projectId === selectedProject.id
          : file.projectId === null && file.chatId === selectedChat?.id,
      ),
    [selectedChat?.id, selectedProject, workspace.files],
  );

  const replaceWorkspace = useCallback((next: JarvisWorkspace) => {
    setWorkspace(next);
    saveJarvisWorkspace(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const local = loadJarvisWorkspace();
    const localWithChat = local.chats.length ? local : { ...local, chats: [createJarvisChat()] };
    replaceWorkspace(localWithChat);
    void (async () => {
      try {
        const result = await fetchWorkspace({});
        if (cancelled) return;
        if (!result.cloud || !result.workspace) {
          setCloud("offline");
        } else if (result.workspace.chats.length || result.workspace.projects.length) {
          const remote = result.workspace.chats.length
            ? result.workspace
            : { ...result.workspace, chats: [createJarvisChat()] };
          replaceWorkspace(remote);
          setCloud("synced");
        } else {
          await syncWorkspace({ data: localWithChat });
          setCloud("synced");
        }
      } catch (error) {
        if (!cancelled) {
          setCloud("error");
          setNotice(error instanceof Error ? error.message : "Sincronizzazione non disponibile.");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWorkspace, replaceWorkspace, syncWorkspace]);

  useEffect(() => {
    if (!ready || cloud === "offline") return;
    const timer = window.setTimeout(() => {
      void syncWorkspace({ data: workspace })
        .then((result) => setCloud(result.cloud ? "synced" : "offline"))
        .catch(() => setCloud("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [cloud, ready, syncWorkspace, workspace]);

  useEffect(() => {
    if (selectedChat && search.chat !== selectedChat.id) {
      void navigate({ search: { chat: selectedChat.id }, replace: true });
    }
  }, [navigate, search.chat, selectedChat]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [busy, selectedChat?.messages]);

  function updateWorkspace(mutator: (current: JarvisWorkspace) => JarvisWorkspace) {
    setWorkspace((current) => {
      const next = mutator(current);
      saveJarvisWorkspace(next);
      return next;
    });
  }

  function selectChat(id: string) {
    void navigate({ search: { chat: id } });
    setSidebarOpen(false);
    setChatMenu(null);
  }

  function addChat(projectId: string | null = selectedProject?.id ?? null) {
    const chat = createJarvisChat(projectId);
    updateWorkspace((current) => ({ ...current, chats: [chat, ...current.chats] }));
    selectChat(chat.id);
  }

  function patchChat(id: string, patch: Partial<JarvisChat>) {
    updateWorkspace((current) => ({
      ...current,
      chats: current.chats.map((chat) =>
        chat.id === id ? { ...chat, ...patch, updatedAt: Date.now() } : chat,
      ),
    }));
  }

  function renameChat(chat: JarvisChat) {
    const title = window.prompt("Nuovo nome della chat", chat.title)?.trim();
    if (title) patchChat(chat.id, { title: title.slice(0, 140) });
    setChatMenu(null);
  }

  function deleteChat(chat: JarvisChat) {
    if (!window.confirm(`Eliminare “${chat.title}”?`)) return;
    const remaining = workspace.chats.filter((item) => item.id !== chat.id);
    const fallback = remaining[0] ?? createJarvisChat();
    const disposableFiles = workspace.files.filter(
      (file) => file.chatId === chat.id && file.projectId === null,
    );
    void Promise.all(disposableFiles.map((file) => removeFileCloud({ data: { id: file.id } })));
    updateWorkspace((current) => ({
      ...current,
      chats: remaining.length ? remaining : [fallback],
      files: current.files.filter((file) => !disposableFiles.some((item) => item.id === file.id)),
    }));
    if (selectedChat?.id === chat.id) selectChat(fallback.id);
  }

  function saveProject() {
    if (!projectDraft?.name.trim()) return;
    const now = Date.now();
    const existing = workspace.projects.find((project) => project.id === projectDraft.id);
    const project: JarvisProject = {
      ...projectDraft,
      name: projectDraft.name.trim(),
      description: projectDraft.description.trim(),
      instructions: projectDraft.instructions.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    updateWorkspace((current) => ({
      ...current,
      projects: existing
        ? current.projects.map((item) => (item.id === project.id ? project : item))
        : [project, ...current.projects],
    }));
    setProjectDraft(null);
  }

  function deleteProject(project: JarvisProject) {
    if (
      !window.confirm(`Eliminare “${project.name}” e i suoi file? Le chat resteranno in archivio.`)
    )
      return;
    updateWorkspace((current) => ({
      projects: current.projects.filter((item) => item.id !== project.id),
      chats: current.chats.map((chat) =>
        chat.projectId === project.id ? { ...chat, projectId: null, updatedAt: Date.now() } : chat,
      ),
      files: current.files.filter((file) => file.projectId !== project.id),
    }));
  }

  async function onSend() {
    const question = input.trim();
    if (!question || !selectedChat || busy) return;
    setInput("");
    setBusy(true);
    setNotice(null);
    const withUser: Msg[] = [...selectedChat.messages, { role: "user", content: question }];
    patchChat(selectedChat.id, {
      messages: withUser,
      title: selectedChat.title === "Nuova chat" ? question.slice(0, 48) : selectedChat.title,
    });
    try {
      const result = await askJarvis({
        data: {
          question,
          history: selectedChat.messages.slice(-14).map(({ role, content }) => ({ role, content })),
          model,
          projectId: selectedProject?.id ?? null,
          chatId: selectedChat.id,
          projectInstructions: selectedProject?.instructions,
          brainContext: buildBrainContextForPrompt(),
        },
      });
      const sources = result.sources.length ? `\n\nFonti: ${result.sources.join(", ")}` : "";
      patchChat(selectedChat.id, {
        messages: [...withUser, { role: "assistant", content: `${result.answer}${sources}` }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "JARVIS non è disponibile.";
      patchChat(selectedChat.id, {
        messages: [...withUser, { role: "assistant", content: message }],
      });
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: globalThis.File) {
    if (!selectedChat) return;
    if (file.size > 10 * 1024 * 1024) {
      setNotice("Il file supera il limite di 10 MB.");
      return;
    }
    setNotice(`Indicizzazione di ${file.name}…`);
    try {
      if (cloud === "synced") await syncWorkspace({ data: workspace });
      const result = await uploadFile({
        data: {
          id: jarvisId("f"),
          projectId: selectedProject?.id ?? null,
          chatId: selectedChat.id,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          contentBase64: await fileToBase64(file),
        },
      });
      updateWorkspace((current) => ({ ...current, files: [result.file, ...current.files] }));
      setNotice(`${file.name} indicizzato in ${result.chunks} passaggi.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload non riuscito.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeFile(id: string) {
    const file = workspace.files.find((item) => item.id === id);
    if (!file || !window.confirm(`Eliminare “${file.name}”?`)) return;
    try {
      await removeFileCloud({ data: { id } });
      updateWorkspace((current) => ({
        ...current,
        files: current.files.filter((item) => item.id !== id),
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Eliminazione non riuscita.");
    }
  }

  function toggleDictation() {
    if (listening) return;
    type Recognition = new () => {
      lang: string;
      interimResults: boolean;
      start: () => void;
      onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onend: () => void;
      onerror: () => void;
    };
    const speechWindow = window as typeof window & {
      SpeechRecognition?: Recognition;
      webkitSpeechRecognition?: Recognition;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setNotice("La dettatura non è supportata da questo browser.");
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setNotice("Non sono riuscito ad ascoltare. Controlla il permesso del microfono.");
    };
    setListening(true);
    recognition.start();
  }

  async function onLogout() {
    await doLogout({});
    window.location.href = "/login";
  }

  const pinnedChats = visibleChats.filter((chat) => chat.pinned);
  const recentChats = visibleChats.filter((chat) => !chat.pinned);

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-[#05080d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_12%,rgba(14,165,233,0.11),transparent_30%),radial-gradient(circle_at_45%_105%,rgba(37,99,235,0.09),transparent_38%)]" />
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Chiudi menu"
          className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(88vw,19rem)] flex-col border-r border-sky-300/10 bg-[#080d14]/98 shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/[0.055] px-4">
          <Link to="/home" className="group flex min-w-0 items-center gap-3 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/10 shadow-[0_0_24px_rgba(56,189,248,0.12)]">
              <Sparkles className="h-4 w-4 text-sky-300" />
            </span>
            <span>
              <span className="block font-display text-sm font-semibold tracking-[0.18em] text-white">
                JARVIS
              </span>
              <span className="block text-[10px] tracking-wide text-sky-200/45">
                Neural workspace
              </span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Chiudi menu"
            className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => addChat(null)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-3 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_8px_28px_rgba(14,165,233,0.18)] transition hover:bg-sky-300"
          >
            <Plus className="h-4 w-4" /> Nuova chat
          </button>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.055] bg-white/[0.025] px-3 py-2 text-slate-500 focus-within:border-sky-300/25 focus-within:text-sky-300">
            <Search className="h-3.5 w-3.5" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Cerca chat"
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace JARVIS">
          <p className="mb-1 px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Sistema
          </p>
          <Link
            to="/agent"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-400 no-underline hover:bg-sky-300/[0.06] hover:text-sky-200"
          >
            <BrainCircuit className="h-4 w-4" /> Sistema neurale
          </Link>
          <Link
            to="/connectors"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-400 no-underline hover:bg-sky-300/[0.06] hover:text-sky-200"
          >
            <Cable className="h-4 w-4" /> Connettori
          </Link>

          <div className="mb-1 mt-5 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              Progetti
            </p>
            <button
              type="button"
              aria-label="Crea progetto"
              onClick={() =>
                setProjectDraft({ id: jarvisId("p"), name: "", description: "", instructions: "" })
              }
              className="rounded p-1 text-slate-600 hover:bg-white/5 hover:text-sky-300"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {workspace.projects.length ? (
            workspace.projects.map((project) => (
              <div
                key={project.id}
                className="group flex items-center rounded-lg hover:bg-white/[0.035]"
              >
                <button
                  type="button"
                  onClick={() => addChat(project.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs ${selectedProject?.id === project.id ? "text-sky-200" : "text-slate-400"}`}
                >
                  {selectedProject?.id === project.id ? (
                    <FolderOpen className="h-4 w-4 shrink-0 text-sky-300" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">{project.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Modifica ${project.name}`}
                  onClick={() =>
                    setProjectDraft({
                      id: project.id,
                      name: project.name,
                      description: project.description,
                      instructions: project.instructions,
                    })
                  }
                  className="p-1 text-slate-700 hover:text-sky-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Elimina ${project.name}`}
                  onClick={() => deleteProject(project)}
                  className="mr-1 p-1 text-slate-700 hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          ) : (
            <p className="px-2.5 py-2 text-[11px] leading-relaxed text-slate-700">
              Raggruppa chat, istruzioni e file.
            </p>
          )}

          {pinnedChats.length ? (
            <ChatGroup
              title="Fissate"
              chats={pinnedChats}
              selectedId={selectedChat?.id}
              projects={workspace.projects}
              menuId={chatMenu}
              onMenu={setChatMenu}
              onSelect={selectChat}
              onPatch={patchChat}
              onRename={renameChat}
              onDelete={deleteChat}
            />
          ) : null}
          <ChatGroup
            title="Recenti"
            chats={recentChats}
            selectedId={selectedChat?.id}
            projects={workspace.projects}
            menuId={chatMenu}
            onMenu={setChatMenu}
            onSelect={selectChat}
            onPatch={patchChat}
            onRename={renameChat}
            onDelete={deleteChat}
          />
        </nav>

        <div className="border-t border-white/[0.055] p-3">
          <div className="mb-2 flex items-center justify-between rounded-lg px-2 py-1.5 text-[10px] text-slate-600">
            <span className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${cloud === "synced" ? "bg-emerald-400" : cloud === "loading" ? "animate-pulse bg-sky-400" : "bg-amber-400"}`}
              />
              {cloud === "synced"
                ? "Cloud privata"
                : cloud === "loading"
                  ? "Sincronizzazione"
                  : "Modalità locale"}
            </span>
            {cloud === "synced" ? <Check className="h-3 w-3 text-emerald-400" /> : null}
          </div>
          <div className="flex gap-1">
            <Link
              to="/home"
              className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-500 no-underline hover:bg-white/5 hover:text-white"
            >
              <Home className="h-3.5 w-3.5" /> Hub
            </Link>
            <button
              type="button"
              aria-label="Esci"
              onClick={() => void onLogout()}
              className="rounded-lg px-2.5 text-slate-600 hover:bg-white/5 hover:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.055] bg-[#05080d]/75 px-3 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Apri menu"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-white/[0.07] p-2 text-slate-400 hover:text-sky-300 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-sm font-semibold text-slate-100">
                  {selectedChat?.title ?? "JARVIS"}
                </h1>
                {selectedChat?.pinned ? <Pin className="h-3 w-3 shrink-0 text-sky-300" /> : null}
              </div>
              <p className="truncate text-[10px] text-slate-600">
                {selectedProject
                  ? `${selectedProject.name} · ${projectFiles.length} file`
                  : "Chat personale"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedProject ? (
              <button
                type="button"
                onClick={() =>
                  setProjectDraft({
                    id: selectedProject.id,
                    name: selectedProject.name,
                    description: selectedProject.description,
                    instructions: selectedProject.instructions,
                  })
                }
                className="hidden rounded-lg border border-sky-300/10 bg-sky-300/[0.035] px-3 py-1.5 text-[11px] text-sky-200/70 hover:border-sky-300/25 sm:inline-flex"
              >
                Istruzioni progetto
              </button>
            ) : null}
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-300/[0.04] px-2.5 py-1 text-[10px] text-emerald-300/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-44 pt-8 sm:px-8 sm:pt-12">
            {selectedChat?.messages.length ? (
              <div className="space-y-8">
                {selectedChat.messages.map((message, index) => (
                  <Message key={`${message.role}-${index}`} message={message} />
                ))}
                {busy ? (
                  <div className="flex items-center gap-3 text-xs text-sky-200/55">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/[0.06]">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    </span>
                    JARVIS sta elaborando…
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="my-auto flex flex-col items-center py-16 text-center">
                <div className="relative mb-7 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-sky-300/15 bg-gradient-to-br from-sky-300/10 to-blue-600/5 shadow-[0_0_70px_rgba(14,165,233,0.12)]">
                  <div className="absolute inset-2 rounded-[1.2rem] border border-sky-300/10" />
                  <Sparkles className="h-8 w-8 text-sky-300" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300/45">
                  Omnicore intelligence
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Come posso aiutarti?
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                  Ragiona con JARVIS, crea un progetto oppure allega documenti per costruire un
                  contesto dedicato e privato.
                </p>
                <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {[
                    "Organizza un nuovo progetto",
                    "Analizza i file del progetto",
                    "Prepara un piano operativo",
                    "Riassumi le mie priorità",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="rounded-xl border border-white/[0.055] bg-white/[0.02] px-4 py-3 text-left text-xs text-slate-500 transition hover:border-sky-300/20 hover:bg-sky-300/[0.035] hover:text-sky-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#05080d] via-[#05080d] to-transparent px-3 pb-4 pt-16 sm:px-6 sm:pb-6">
          <div className="pointer-events-auto mx-auto max-w-3xl">
            {notice ? (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-sky-300/10 bg-[#0a111b]/95 px-3 py-2 text-[11px] text-sky-100/65">
                <span className="truncate">{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  aria-label="Chiudi avviso"
                  className="ml-3 text-slate-600 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            {projectFiles.length ? (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {projectFiles.map((file) => (
                  <span
                    key={file.id}
                    className="flex shrink-0 items-center gap-2 rounded-lg border border-sky-300/10 bg-[#0a111b]/95 px-2.5 py-1.5 text-[10px] text-slate-500"
                  >
                    <FileText className="h-3 w-3 text-sky-300/60" /> {file.name}{" "}
                    <span className="text-slate-700">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      aria-label={`Elimina ${file.name}`}
                      onClick={() => void removeFile(file.id)}
                      className="hover:text-rose-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="rounded-2xl border border-sky-300/15 bg-[#0a1018]/95 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.55),0_0_0_1px_rgba(56,189,248,0.02)] backdrop-blur-xl focus-within:border-sky-300/30">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void onSend();
                  }
                }}
                rows={2}
                placeholder={
                  selectedProject
                    ? `Scrivi a JARVIS su ${selectedProject.name}…`
                    : "Scrivi a JARVIS…"
                }
                className="max-h-40 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-700"
              />
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <div className="flex min-w-0 items-center gap-1">
                  <input
                    ref={fileInput}
                    type="file"
                    className="hidden"
                    accept=".pdf,.txt,.md,.markdown,.json,.csv,.ts,.tsx,.js,.jsx,.css,.html,.xml,.yaml,.yml,.toml,.sql,.py,.java,.c,.cpp,.h,.hpp,.go,.rs,.php,.rb,.sh"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Allega file"
                    onClick={() => fileInput.current?.click()}
                    className="rounded-lg p-2 text-slate-600 hover:bg-sky-300/[0.06] hover:text-sky-300"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Dettatura vocale"
                    onClick={toggleDictation}
                    className={`rounded-lg p-2 hover:bg-sky-300/[0.06] hover:text-sky-300 ${listening ? "text-sky-300" : "text-slate-600"}`}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <label className="hidden items-center gap-1 text-[10px] text-slate-600 sm:flex">
                    <select
                      value={model}
                      onChange={(event) => setModel(event.target.value as GroqModelId)}
                      className="max-w-36 appearance-none truncate bg-transparent py-1 pl-1 pr-5 text-[10px] text-slate-500 outline-none"
                    >
                      {GROQ_MODELS.map((item) => (
                        <option key={item.id} value={item.id} className="bg-[#0a1018]">
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="-ml-5 h-3 w-3 pointer-events-none" />
                  </label>
                </div>
                <button
                  type="button"
                  aria-label="Invia messaggio"
                  disabled={!input.trim() || busy}
                  onClick={() => void onSend()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-300 text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-[9px] tracking-wide text-slate-700">
              JARVIS può commettere errori. Verifica le informazioni importanti.
            </p>
          </div>
        </div>
      </main>

      {projectDraft ? (
        <ProjectDialog
          draft={projectDraft}
          onChange={setProjectDraft}
          onClose={() => setProjectDraft(null)}
          onSave={saveProject}
        />
      ) : null}
    </div>
  );
}

function Message({ message }: { message: Msg }) {
  if (message.role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-sky-300/10 bg-sky-300/[0.07] px-4 py-3 text-sm leading-7 text-slate-200 sm:max-w-[78%]">
          {message.content}
        </div>
      </div>
    );
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/[0.06]">
        <Sparkles className="h-3.5 w-3.5 text-sky-300" />
      </span>
      <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-7 text-slate-300">
        {message.content}
      </div>
    </div>
  );
}

function ChatGroup({
  title,
  chats,
  selectedId,
  projects,
  menuId,
  onMenu,
  onSelect,
  onPatch,
  onRename,
  onDelete,
}: {
  title: string;
  chats: JarvisChat[];
  selectedId?: string;
  projects: JarvisProject[];
  menuId: string | null;
  onMenu: (id: string | null) => void;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<JarvisChat>) => void;
  onRename: (chat: JarvisChat) => void;
  onDelete: (chat: JarvisChat) => void;
}) {
  return (
    <section className="mt-5">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
        {title}
      </p>
      <div className="space-y-0.5">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`group relative flex items-center rounded-lg ${selectedId === chat.id ? "bg-sky-300/[0.08]" : "hover:bg-white/[0.035]"}`}
          >
            <button
              type="button"
              onClick={() => onSelect(chat.id)}
              className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs ${selectedId === chat.id ? "text-sky-100" : "text-slate-500"}`}
            >
              <MessageSquare
                className={`h-3.5 w-3.5 shrink-0 ${selectedId === chat.id ? "text-sky-300" : ""}`}
              />
              <span className="truncate">{chat.title}</span>
            </button>
            <button
              type="button"
              aria-label={`Azioni per ${chat.title}`}
              onClick={() => onMenu(menuId === chat.id ? null : chat.id)}
              className="mr-1 rounded p-1 text-slate-700 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuId === chat.id ? (
              <div className="absolute right-1 top-9 z-50 w-48 rounded-xl border border-white/10 bg-[#0d141f] p-1.5 text-[11px] shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    onPatch(chat.id, { pinned: !chat.pinned });
                    onMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  {chat.pinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                  {chat.pinned ? "Rimuovi dai fissati" : "Fissa chat"}
                </button>
                <button
                  type="button"
                  onClick={() => onRename(chat)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" /> Rinomina
                </button>
                <label className="flex items-center rounded-lg px-2.5 py-1.5 text-slate-400 hover:bg-white/5">
                  <select
                    aria-label="Assegna progetto"
                    value={chat.projectId ?? ""}
                    onChange={(event) => {
                      onPatch(chat.id, { projectId: event.target.value || null });
                      onMenu(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent py-1 outline-none"
                  >
                    <option value="" className="bg-[#0d141f]">
                      Nessun progetto
                    </option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id} className="bg-[#0d141f]">
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onDelete(chat)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-rose-300/70 hover:bg-rose-400/10 hover:text-rose-200"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Elimina
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectDialog({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: ProjectDraft;
  onChange: (draft: ProjectDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-sky-300/15 bg-[#0a1018] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/50">
              Contesto dedicato
            </p>
            <h2 id="project-title" className="mt-1 font-display text-xl text-white">
              Configura progetto
            </h2>
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-xs text-slate-400">
            Nome
            <input
              autoFocus
              value={draft.name}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              maxLength={100}
              placeholder="Es. Lancio prodotto"
              className="mt-2 w-full rounded-xl border border-white/[0.07] bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky-300/30"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Descrizione
            <input
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              maxLength={600}
              placeholder="Obiettivo e perimetro del progetto"
              className="mt-2 w-full rounded-xl border border-white/[0.07] bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none focus:border-sky-300/30"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Istruzioni per JARVIS
            <textarea
              value={draft.instructions}
              onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
              maxLength={6000}
              rows={5}
              placeholder="Tono, vincoli, formato delle risposte…"
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.07] bg-black/20 px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none focus:border-sky-300/30"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs text-slate-500 hover:bg-white/5 hover:text-white"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={!draft.name.trim()}
            onClick={onSave}
            className="rounded-xl bg-sky-300 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-40"
          >
            Salva progetto
          </button>
        </div>
      </div>
    </div>
  );
}
