import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Bot,
  Cable,
  CheckSquare,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Home,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAuthState } from "@/lib/auth.functions";
import { buildBrainContextForPrompt } from "@/lib/agent-brain";
import { NeuralGraph, type GraphNode } from "@/components/NeuralGraph";
import { ensureDefaultConnectors, type CustomConnector } from "@/lib/connectors";
import { appendLog, createGoal, requestCoworkAutoStart } from "@/lib/cowork";
import { askAssistant } from "@/lib/panel.functions";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";
import {
  addTextFile,
  appendMessage,
  createChat,
  createProject,
  deleteChat,
  deleteFile,
  deleteProject,
  loadJarvisStore,
  migrateLegacyChats,
  saveJarvisStore,
  searchFileContext,
  updateChat,
  type JarvisChat,
  type JarvisProject,
  type JarvisStore,
} from "@/lib/jarvis-workspace";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [
      { title: "JARVIS — Workspace" },
      {
        name: "description",
        content: "Workspace JARVIS: progetti, chat, file e memoria. Nero e azzurro.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    if (state.mustSetPassword) throw redirect({ to: "/setup-password" });
    return { accountKey: state.label || state.role || "user" };
  },
  component: JarvisWorkspace,
});

const MODEL_KEY = "omnicore.jarvis.model";

type Panel = "chat" | "neural" | "connectors";
type InteractionMode = "chat" | "cowork";

function JarvisWorkspace() {
  const { accountKey } = Route.useLoaderData();
  const ask = useServerFn(askAssistant);
  const navigate = useNavigate();

  const [store, setStore] = useState<JarvisStore>({
    version: 1,
    projects: [],
    chats: [],
    files: [],
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("chat");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("chat");
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const [search, setSearch] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const persist = useCallback(
    (next: JarvisStore) => {
      setStore(next);
      saveJarvisStore(accountKey, next);
    },
    [accountKey],
  );

  useEffect(() => {
    const migrated = migrateLegacyChats(accountKey);
    setStore(migrated);
    setConnectors(ensureDefaultConnectors());
    if (migrated.chats[0]) setActiveChatId(migrated.chats[0].id);
    try {
      const m = window.localStorage.getItem(MODEL_KEY);
      if (m && GROQ_MODELS.some((x) => x.id === m)) setModel(m as GroqModelId);
    } catch {
      /* ignore */
    }
    const SR =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              SpeechRecognition?: new () => unknown;
              webkitSpeechRecognition?: new () => unknown;
            }
          ).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => unknown })
            .webkitSpeechRecognition
        : undefined;
    setVoiceSupported(Boolean(SR));
  }, [accountKey]);

  const activeChat = useMemo(
    () => store.chats.find((c) => c.id === activeChatId) ?? null,
    [store.chats, activeChatId],
  );

  const projectFiles = useMemo(() => {
    return store.files.filter(
      (f) =>
        (activeProjectId && f.projectId === activeProjectId) ||
        (activeChatId && f.chatId === activeChatId),
    );
  }, [store.files, activeProjectId, activeChatId]);

  const filteredChats = useMemo(() => {
    let list = store.chats;
    if (activeProjectId) list = list.filter((c) => c.projectId === activeProjectId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => m.content.toLowerCase().includes(q)),
      );
    }
    return [...list].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
    );
  }, [store.chats, activeProjectId, search]);

  const neuralNodes = useMemo<GraphNode[]>(() => {
    const nodes: GraphNode[] = [
      {
        id: "device:local",
        label: "Questo dispositivo",
        kind: "device",
        status: "online",
        detail:
          "File e cartelle scelti esplicitamente dal browser. JARVIS non accede al resto del dispositivo.",
        size: 19,
      },
    ];

    for (const project of store.projects) {
      nodes.push({
        id: `project:${project.id}`,
        parentId: "device:local",
        label: project.name,
        kind: "folder",
        status: "online",
        detail: project.description || "Progetto locale JARVIS",
        size: 11,
      });
    }

    const knownFolders = new Set<string>();
    for (const file of store.files.slice(0, 60)) {
      const scope = file.projectId || file.chatId || "local";
      let parentId = file.projectId ? `project:${file.projectId}` : "device:local";
      const parts = (file.path || file.name).split("/").filter(Boolean).slice(0, -1);
      let relativePath = "";
      for (const part of parts) {
        relativePath = relativePath ? `${relativePath}/${part}` : part;
        const folderId = `folder:${scope}:${relativePath}`;
        if (!knownFolders.has(folderId)) {
          nodes.push({
            id: folderId,
            parentId,
            label: part,
            kind: "folder",
            status: "online",
            detail: relativePath,
            size: 9,
          });
          knownFolders.add(folderId);
        }
        parentId = folderId;
      }
      nodes.push({
        id: `file:${file.id}`,
        parentId,
        label: file.name,
        kind: "file",
        status: "online",
        detail: `${file.path || file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`,
        size: 7,
      });
    }

    for (const connector of connectors) {
      nodes.push({
        id: `mcp:${connector.id}`,
        parentId: "device:local",
        label: connector.label,
        kind: "mcp",
        status: connector.status,
        detail: connector.detail,
        size: 10,
      });
    }
    return nodes;
  }, [connectors, store.files, store.projects]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, busy]);

  function onNewChat() {
    const { store: next, chat } = createChat(store, { projectId: activeProjectId });
    persist(next);
    setActiveChatId(chat.id);
    setPanel("chat");
    setSidebarOpen(false);
  }

  function onNewProject() {
    const name = window.prompt("Nome progetto");
    if (!name?.trim()) return;
    const { store: next, project } = createProject(store, { name });
    persist(next);
    setActiveProjectId(project.id);
  }

  function onRenameChat(chat: JarvisChat) {
    const name = window.prompt("Rinomina chat", chat.title);
    if (!name?.trim()) return;
    persist(updateChat(store, chat.id, { title: name.trim() }));
  }

  function onTogglePin(chat: JarvisChat) {
    persist(updateChat(store, chat.id, { pinned: !chat.pinned }));
  }

  function onDeleteChat(chat: JarvisChat) {
    if (!window.confirm(`Eliminare "${chat.title}"?`)) return;
    const next = deleteChat(store, chat.id);
    persist(next);
    if (activeChatId === chat.id) setActiveChatId(next.chats[0]?.id ?? null);
  }

  function onDeleteProject(p: JarvisProject) {
    if (!window.confirm(`Eliminare progetto "${p.name}"? Le chat restano senza cartella.`)) return;
    const next = deleteProject(store, p.id);
    persist(next);
    if (activeProjectId === p.id) setActiveProjectId(null);
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    let s = store;
    let chatId = activeChatId;
    if (!chatId) {
      const created = createChat(s, { projectId: activeProjectId });
      s = created.store;
      chatId = created.chat.id;
      setActiveChatId(chatId);
    }
    s = appendMessage(s, chatId, { role: "user", content: text });
    persist(s);
    setInput("");
    if (interactionMode === "cowork") {
      const goal = createGoal(text, "Obiettivo avviato dal composer JARVIS in modalità Cowork.", 6);
      appendLog("info", `Obiettivo ricevuto da JARVIS: ${goal.title}`);
      requestCoworkAutoStart();
      await navigate({ to: "/cowork" });
      return;
    }
    setBusy(true);
    setError(null);

    const chat = s.chats.find((c) => c.id === chatId)!;
    const project = s.projects.find((p) => p.id === (chat.projectId || activeProjectId));
    const fileCtx = searchFileContext(s, text, {
      projectId: chat.projectId || activeProjectId,
      chatId,
    });
    const brain = [
      buildBrainContextForPrompt(),
      project?.instructions ? `### Istruzioni progetto\n${project.instructions}` : "",
      fileCtx ? `### Contesto file\n${fileCtx}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 11000);

    try {
      const res = await ask({
        data: {
          question: text,
          history: chat.messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          model,
          brainContext: brain,
          skipLogs: true,
        },
      });
      const reply =
        (res as { risposta?: string }).risposta ||
        (res as { message?: string }).message ||
        "Nessuna risposta.";
      const next = appendMessage(s, chatId, { role: "assistant", content: reply });
      persist(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      const next = appendMessage(s, chatId, {
        role: "assistant",
        content: `Errore: ${msg}`,
      });
      persist(next);
    } finally {
      setBusy(false);
    }
  }

  async function onAttachFiles(files: File[]) {
    const max = 10 * 1024 * 1024;
    let next = store;
    let imported = 0;
    let skipped = Math.max(0, files.length - 100);
    for (const file of files.slice(0, 100)) {
      const supported =
        /\.(txt|md|json|csv|ts|tsx|js|jsx|py|rs|go|java|css|html|log|yml|yaml|xml)$/i.test(
          file.name,
        );
      if (!supported || file.size > max) {
        skipped += 1;
        continue;
      }
      const text = await file.text();
      if (!text.trim()) {
        skipped += 1;
        continue;
      }
      next = addTextFile(next, {
        name: file.name,
        path: file.webkitRelativePath || file.name,
        text,
        mime: file.type || "text/plain",
        projectId: activeProjectId,
        chatId: activeChatId,
      }).store;
      imported += 1;
    }
    persist(next);
    setError(
      imported === 0
        ? "Nessun file di testo supportato trovato."
        : skipped > 0
          ? `${imported} file importati · ${skipped} ignorati`
          : null,
    );
    if (imported > 0) setPanel("neural");
  }

  function toggleVoice() {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const W = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Dettatura non supportata in questo browser.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "it-IT";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript;
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  const sidebar = (
    <aside className="flex h-full w-full flex-col border-r border-white/[0.08] bg-[#0d0e10] text-[#e7e5df]">
      <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-5">
        <Link
          to="/home"
          className="font-serif text-[25px] font-semibold tracking-tight text-[#f2f0ea] no-underline"
        >
          Jarvis
        </Link>
        <div className="flex items-center gap-1">
          <Link
            to="/home"
            className="rounded-lg p-2 text-white/45 no-underline hover:bg-white/[0.06] hover:text-white"
            aria-label="Torna all'hub"
          >
            <Home className="h-4 w-4" />
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-white/45 hover:bg-white/[0.06] hover:text-white md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1 px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center gap-3 rounded-xl bg-[#333333] px-4 py-3 text-[14px] font-medium text-white transition hover:bg-[#3d3d3d]"
        >
          <Plus className="h-[18px] w-[18px]" /> Nuovo
        </button>
        <button
          type="button"
          onClick={onNewProject}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] text-white/65 hover:bg-white/[0.05] hover:text-white"
        >
          <FolderPlus className="h-4 w-4" /> Nuovo progetto
        </button>
      </div>

      <div className="mt-1 space-y-0.5 px-3 pb-3">
        {(
          [
            { id: "chat" as const, label: "Chat", icon: Bot },
            { id: "neural" as const, label: "Neurale", icon: Brain },
            { id: "connectors" as const, label: "Connettori", icon: Cable },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPanel(t.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-[13px] transition ${
              panel === t.id
                ? "bg-white/[0.07] text-white"
                : "text-white/60 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca chat…"
            className="w-full rounded-lg border border-white/[0.08] bg-black/20 py-2 pl-9 pr-2 text-[12px] text-white outline-none placeholder:text-white/30 focus:border-white/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-1.5 flex items-center justify-between px-3 text-[12px] text-white/40">
          Progetti
          <Plus className="h-3.5 w-3.5" />
        </p>
        <button
          type="button"
          onClick={() => setActiveProjectId(null)}
          className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] ${
            !activeProjectId ? "bg-white/[0.06] text-white" : "text-white/60 hover:bg-white/[0.03]"
          }`}
        >
          <FolderOpen className="h-4 w-4" /> Tutti i progetti
        </button>
        {store.projects.map((p) => (
          <div key={p.id} className="group mb-0.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveProjectId(p.id)}
              className={`flex min-w-0 flex-1 items-center gap-2 truncate rounded-md px-3 py-2 text-left text-[13px] ${
                activeProjectId === p.id
                  ? "bg-white/[0.06] text-white"
                  : "text-white/60 hover:bg-white/[0.03]"
              }`}
            >
              <Folder className="h-4 w-4 shrink-0" /> <span className="truncate">{p.name}</span>
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-sky-200/40 hover:text-red-300"
              onClick={() => onDeleteProject(p)}
              aria-label="Elimina progetto"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <p className="mb-1.5 mt-5 px-3 text-[12px] text-white/40">Conversazioni</p>
        {filteredChats.length === 0 ? (
          <p className="px-3 text-[12px] text-white/35">Nessuna chat</p>
        ) : (
          filteredChats.map((c) => (
            <div
              key={c.id}
              className={`group mb-0.5 flex items-center gap-0.5 rounded-md ${
                activeChatId === c.id ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveChatId(c.id);
                  setPanel("chat");
                  setSidebarOpen(false);
                }}
                onDoubleClick={() => onRenameChat(c)}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-[13px] text-white/75"
                title="Doppio click per rinominare"
              >
                {c.pinned ? "📌 " : ""}
                {c.title}
              </button>
              <button
                type="button"
                className="p-1 text-sky-200/40 opacity-0 hover:text-sky-100 group-hover:opacity-100"
                onClick={() => onTogglePin(c)}
                aria-label={c.pinned ? "Sblocca" : "Fissa"}
              >
                {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
              <button
                type="button"
                className="p-1 text-sky-200/40 opacity-0 hover:text-red-300 group-hover:opacity-100"
                onClick={() => onDeleteChat(c)}
                aria-label="Elimina"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}

        {projectFiles.length > 0 ? (
          <>
            <p className="mb-1.5 mt-5 px-3 text-[12px] text-white/40">File</p>
            {projectFiles.map((f) => (
              <div
                key={f.id}
                className="group flex items-center gap-1 px-2 py-1 text-[11px] text-sky-200/60"
              >
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 hover:text-red-300"
                  onClick={() => persist(deleteFile(store, f.id))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </aside>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#121315] text-[#eeeae2]">
      {/* Desktop sidebar */}
      <div className="hidden w-[320px] shrink-0 md:block">{sidebar}</div>

      {/* Mobile drawer */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 h-full w-[min(100%,320px)]">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 sm:px-5">
          <button
            type="button"
            className="rounded-lg border border-white/10 p-2 text-white/60 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14px] font-medium tracking-tight text-white/80">
              {panel === "neural"
                ? "Sistema neurale"
                : panel === "connectors"
                  ? "Connettori"
                  : activeChat?.title || "JARVIS"}
            </h1>
            <p className="truncate text-[10px] text-white/35">
              Workspace personale · memoria e strumenti connessi
            </p>
          </div>
          <select
            value={model}
            onChange={(e) => {
              const v = e.target.value as GroqModelId;
              setModel(v);
              try {
                window.localStorage.setItem(MODEL_KEY, v);
              } catch {
                /* ignore */
              }
            }}
            className="max-w-[150px] truncate rounded-lg border border-white/10 bg-[#1b1c1d] px-2 py-1.5 text-[11px] text-white/70 outline-none"
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </header>

        {panel === "neural" ? (
          <div className="flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="mx-auto max-w-[1400px] space-y-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/60">
                    Sistema neurale
                  </p>
                  <h2 className="font-serif text-2xl font-medium text-[#f1eee7]">
                    La rete di Jarvis
                  </h2>
                  <p className="mt-1 text-[12px] text-white/45">
                    MCP, progetti, cartelle e file accessibili all&apos;IA in un&apos;unica mappa.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.rs,.go,.java,.log,.html,.css,.yml,.yaml,.xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onAttachFiles([file]);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={folderRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length) void onAttachFiles(files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      folderRef.current?.setAttribute("webkitdirectory", "");
                      folderRef.current?.click();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.09] hover:text-white"
                  >
                    <FolderPlus className="h-4 w-4" /> Importa cartella
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.09] hover:text-white"
                  >
                    <Paperclip className="h-4 w-4" /> Aggiungi file
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                <NeuralGraph nodes={neuralNodes} serverOnline />
                <aside className="space-y-3">
                  <div className="rounded-xl border border-white/[0.08] bg-[#191a1c] p-4">
                    <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-white/80">
                      <HardDrive className="h-4 w-4 text-cyan-300" /> Questo dispositivo
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-black/20 p-2">
                        <strong className="block text-lg text-white">
                          {store.projects.length}
                        </strong>
                        <span className="text-[9px] uppercase tracking-wide text-white/35">
                          progetti
                        </span>
                      </div>
                      <div className="rounded-lg bg-black/20 p-2">
                        <strong className="block text-lg text-white">{store.files.length}</strong>
                        <span className="text-[9px] uppercase tracking-wide text-white/35">
                          file
                        </span>
                      </div>
                      <div className="rounded-lg bg-black/20 p-2">
                        <strong className="block text-lg text-white">{connectors.length}</strong>
                        <span className="text-[9px] uppercase tracking-wide text-white/35">
                          MCP
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-white/35">
                      Per privacy il browser mostra soltanto elementi selezionati da te.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-[#191a1c] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[12px] font-medium text-white/80">
                        <Cable className="h-4 w-4 text-emerald-300" /> Nodi MCP
                      </span>
                      <Link
                        to="/connectors"
                        className="text-[10px] text-white/40 no-underline hover:text-white"
                      >
                        Gestisci
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {connectors.slice(0, 6).map((connector) => (
                        <div
                          key={connector.id}
                          className="flex items-center gap-2 text-[11px] text-white/55"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${connector.status === "online" ? "bg-emerald-400" : connector.status === "error" ? "bg-red-400" : "bg-white/25"}`}
                          />
                          <span className="min-w-0 flex-1 truncate">{connector.label}</span>
                          <span className="uppercase text-white/25">{connector.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/agent"
                      className="rounded-xl border border-white/[0.08] bg-[#191a1c] p-3 text-center text-[11px] text-white/55 no-underline hover:bg-white/[0.06] hover:text-white"
                    >
                      <Brain className="mx-auto mb-1.5 h-4 w-4" /> Brain
                    </Link>
                    <Link
                      to="/network"
                      className="rounded-xl border border-white/[0.08] bg-[#191a1c] p-3 text-center text-[11px] text-white/55 no-underline hover:bg-white/[0.06] hover:text-white"
                    >
                      <SlidersHorizontal className="mx-auto mb-1.5 h-4 w-4" /> Host live
                    </Link>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        ) : panel === "connectors" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <Cable className="h-10 w-10 text-emerald-300" />
            <p className="max-w-md text-sm text-white/55">
              One MCP e app collegate. Le azioni write restano con conferma umana.
            </p>
            <Link
              to="/connectors"
              className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/80 no-underline hover:bg-white/[0.1]"
            >
              Apri connettori
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6">
              {!activeChat || activeChat.messages.length === 0 ? (
                <div className="mx-auto flex max-w-xl flex-col items-center gap-3 pt-[14vh] text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.06]">
                    <Sparkles className="h-6 w-6 text-cyan-300" />
                  </div>
                  <h2 className="font-serif text-4xl font-medium tracking-tight text-[#f1eee7]">
                    Benvenuto, {accountKey}
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-white/40">
                    Parla con Jarvis oppure affidagli un obiettivo in Cowork. File, memoria e MCP
                    sono già nel suo contesto.
                  </p>
                </div>
              ) : (
                activeChat.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`mx-auto flex max-w-3xl ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                        m.role === "user"
                          ? "border border-white/10 bg-[#2d2e30] text-white"
                          : "border border-white/[0.06] bg-white/[0.035] text-white/85"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))
              )}
              {busy ? (
                <p className="mx-auto max-w-3xl text-[12px] text-cyan-300/60">
                  Jarvis sta pensando…
                </p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="px-3 pb-4 pt-2 sm:px-6 sm:pb-6">
              {error ? (
                <p className="mb-2 text-center text-[12px] text-red-300/90" role="alert">
                  {error}
                </p>
              ) : null}
              <div
                className={`mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border p-2 shadow-[0_18px_60px_rgba(0,0,0,0.28)] ${interactionMode === "cowork" ? "border-violet-300/25 bg-[#201e25]" : "border-white/10 bg-[#1b1c1d]"}`}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  rows={3}
                  placeholder={
                    interactionMode === "cowork"
                      ? "Descrivi il risultato: Jarvis pianificherà ed eseguirà i passi…"
                      : "Come posso aiutarti oggi?"
                  }
                  className="w-full resize-none bg-transparent px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/20"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.rs,.go,.java,.log,.html,.css,.yml,.yaml,.xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onAttachFiles([f]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg p-2 text-white/45 hover:bg-white/[0.06] hover:text-white"
                    title="Allega file testo"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={!voiceSupported}
                    className={`rounded-lg p-2 hover:bg-white/[0.04] ${
                      listening ? "text-cyan-300" : "text-white/45 hover:text-white"
                    } disabled:opacity-30`}
                    title={voiceSupported ? "Dettatura" : "Dettatura non supportata"}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <div
                    className="ml-1 flex items-center rounded-lg bg-black/20 p-0.5"
                    aria-label="Modalità messaggio"
                  >
                    <button
                      type="button"
                      onClick={() => setInteractionMode("chat")}
                      aria-pressed={interactionMode === "chat"}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${interactionMode === "chat" ? "bg-white/10 text-white" : "text-white/35 hover:text-white/70"}`}
                    >
                      <Bot className="h-3.5 w-3.5" /> Chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setInteractionMode("cowork")}
                      aria-pressed={interactionMode === "cowork"}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${interactionMode === "cowork" ? "bg-violet-400/15 text-violet-200" : "text-white/35 hover:text-white/70"}`}
                    >
                      <CheckSquare className="h-3.5 w-3.5" /> Cowork
                    </button>
                  </div>
                  <div className="flex-1" />
                  <button
                    type="button"
                    disabled={busy || !input.trim()}
                    onClick={() => void onSend()}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold disabled:opacity-40 ${interactionMode === "cowork" ? "bg-violet-300 text-violet-950" : "bg-[#e8e5de] text-[#18191a]"}`}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {interactionMode === "cowork" ? "Avvia" : "Invia"}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/25">
                {interactionMode === "cowork"
                  ? "Cowork lavora in autonomia secondo i permessi configurati."
                  : "I dati locali restano isolati per account in questo browser."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
