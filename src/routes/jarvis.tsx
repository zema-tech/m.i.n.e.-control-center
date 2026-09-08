import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArrowUp,
  AtSign,
  Brain,
  Cable,
  Check,
  ChevronDown,
  CircleStop,
  Clipboard,
  Clock3,
  Copy,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Menu,
  MessageSquareText,
  Mic,
  MicOff,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAuthState } from "@/lib/auth.functions";
import { buildBrainContextForPrompt } from "@/lib/agent-brain";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";
import {
  addTextFile,
  appendMessage,
  createChat,
  createProject,
  deleteChat,
  deleteFile,
  deleteProject,
  migrateLegacyChats,
  saveJarvisStore,
  searchFileContext,
  updateChat,
  updateProject,
  type JarvisChat,
  type JarvisMsg,
  type JarvisProject,
  type JarvisStore,
} from "@/lib/jarvis-workspace";
import { askAssistant } from "@/lib/panel.functions";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [
      { title: "JARVIS — AI Workspace" },
      {
        name: "description",
        content: "Il workspace conversazionale di JARVIS: chat, progetti, file e memoria.",
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
const MODE_KEY = "omnicore.jarvis.mode";
type Panel = "chat" | "neural" | "connectors";
type WorkMode = "auto" | "fast" | "deep";

const WORK_MODES: Record<
  WorkMode,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: typeof Sparkles;
    swarm: "auto" | "rapido" | "deep";
  }
> = {
  auto: {
    label: "Automatico",
    shortLabel: "Auto",
    description: "JARVIS sceglie il percorso migliore",
    icon: Sparkles,
    swarm: "auto",
  },
  fast: {
    label: "Risposta rapida",
    shortLabel: "Rapido",
    description: "Ideale per domande e attività brevi",
    icon: Zap,
    swarm: "rapido",
  },
  deep: {
    label: "Analisi profonda",
    shortLabel: "Deep",
    description: "Più passaggi per problemi complessi",
    icon: Brain,
    swarm: "deep",
  },
};

const STARTERS = [
  {
    icon: Brain,
    label: "Analizza",
    prompt: "Analizza questo problema in profondità, evidenzia rischi e opportunità: ",
  },
  { icon: PenLine, label: "Crea", prompt: "Aiutami a creare una prima versione completa di " },
  {
    icon: Search,
    label: "Esplora",
    prompt: "Esplora questo argomento e costruisci una sintesi chiara: ",
  },
  {
    icon: Clipboard,
    label: "Pianifica",
    prompt: "Prepara un piano concreto, ordinato per priorità, per ",
  },
] as const;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function safeFilename(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "conversazione-jarvis"
  );
}

function MessageContent({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      {content.split(/```/g).map((block, index) => {
        if (index % 2 === 1) {
          const firstBreak = block.indexOf("\n");
          const language = firstBreak > -1 ? block.slice(0, firstBreak).trim() : "";
          const code = firstBreak > -1 ? block.slice(firstBreak + 1) : block;
          return (
            <div
              key={`${index}-${block.slice(0, 12)}`}
              className="overflow-hidden rounded-xl border border-white/8 bg-[#080a0f]"
            >
              <div className="flex items-center justify-between border-b border-white/7 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <span>{language || "codice"}</span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(code)}
                  className="inline-flex items-center gap-1 hover:text-slate-200"
                >
                  <Copy className="h-3 w-3" /> Copia
                </button>
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-6 text-slate-200">
                <code>{code.trim()}</code>
              </pre>
            </div>
          );
        }
        return block.trim() ? (
          <p key={`${index}-${block.slice(0, 12)}`} className="whitespace-pre-wrap">
            {block.trim()}
          </p>
        ) : null;
      })}
    </div>
  );
}

function IconButton({
  label,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 disabled:pointer-events-none disabled:opacity-35 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function JarvisWorkspace() {
  const { accountKey } = Route.useLoaderData();
  const ask = useServerFn(askAssistant);
  const [store, setStore] = useState<JarvisStore>({
    version: 1,
    projects: [],
    chats: [],
    files: [],
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState({ name: "", description: "", instructions: "" });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const [workMode, setWorkMode] = useState<WorkMode>("auto");
  const [search, setSearch] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const persist = useCallback(
    (next: JarvisStore) => {
      setStore(next);
      saveJarvisStore(accountKey, next);
    },
    [accountKey],
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-section", "jarvis");
    const migrated = migrateLegacyChats(accountKey);
    setStore(migrated);
    if (migrated.chats[0]) setActiveChatId(migrated.chats[0].id);
    try {
      const storedModel = window.localStorage.getItem(MODEL_KEY);
      if (storedModel && GROQ_MODELS.some((item) => item.id === storedModel))
        setModel(storedModel as GroqModelId);
      const storedMode = window.localStorage.getItem(MODE_KEY);
      if (storedMode && storedMode in WORK_MODES) setWorkMode(storedMode as WorkMode);
    } catch {
      /* localStorage may be unavailable */
    }
    const browserWindow = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    setVoiceSupported(
      Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition),
    );
    return () => abortControllerRef.current?.abort();
  }, [accountKey]);

  const activeChat = useMemo(
    () => store.chats.find((chat) => chat.id === activeChatId) ?? null,
    [store.chats, activeChatId],
  );
  const activeProject = useMemo(
    () => store.projects.find((project) => project.id === activeProjectId) ?? null,
    [store.projects, activeProjectId],
  );
  const visibleFiles = useMemo(
    () =>
      store.files.filter(
        (file) =>
          (activeProjectId && file.projectId === activeProjectId) ||
          (activeChatId && file.chatId === activeChatId),
      ),
    [store.files, activeProjectId, activeChatId],
  );
  const filteredChats = useMemo(() => {
    let chats = store.chats;
    if (activeProjectId) chats = chats.filter((chat) => chat.projectId === activeProjectId);
    if (search.trim()) {
      const query = search.toLocaleLowerCase("it");
      chats = chats.filter(
        (chat) =>
          chat.title.toLocaleLowerCase("it").includes(query) ||
          chat.messages.some((message) => message.content.toLocaleLowerCase("it").includes(query)),
      );
    }
    return [...chats].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
    );
  }, [store.chats, activeProjectId, search]);

  const onNewChat = useCallback(() => {
    const { store: next, chat } = createChat(store, { projectId: activeProjectId });
    persist(next);
    setActiveChatId(chat.id);
    setPanel("chat");
    setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [store, activeProjectId, persist]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, busy]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onNewChat();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [onNewChat]);

  function onCreateProject() {
    if (!projectDraft.name.trim()) return;
    const { store: next, project } = createProject(store, projectDraft);
    persist(next);
    setActiveProjectId(project.id);
    setProjectDraft({ name: "", description: "", instructions: "" });
    setProjectDialogOpen(false);
    setContextOpen(true);
  }

  function onRenameChat(chat: JarvisChat) {
    const name = window.prompt("Rinomina conversazione", chat.title);
    if (name?.trim()) persist(updateChat(store, chat.id, { title: name.trim() }));
  }

  function onDeleteChat(chat: JarvisChat) {
    if (!window.confirm(`Eliminare “${chat.title}”?`)) return;
    const next = deleteChat(store, chat.id);
    persist(next);
    if (activeChatId === chat.id) setActiveChatId(next.chats[0]?.id ?? null);
  }

  function onDeleteProject(project: JarvisProject) {
    if (!window.confirm(`Eliminare il progetto “${project.name}”? Le chat resteranno disponibili.`))
      return;
    const next = deleteProject(store, project.id);
    persist(next);
    if (activeProjectId === project.id) setActiveProjectId(null);
  }

  function onClearChat() {
    if (activeChat && window.confirm("Svuotare tutti i messaggi di questa conversazione?")) {
      persist(updateChat(store, activeChat.id, { messages: [] }));
    }
  }

  function exportChat() {
    if (!activeChat) return;
    const project = store.projects.find((item) => item.id === activeChat.projectId);
    const markdown = [
      `# ${activeChat.title}`,
      "",
      project ? `Progetto: ${project.name}` : "",
      project ? "" : "",
      ...activeChat.messages.flatMap((message) => [
        `## ${message.role === "user" ? "Tu" : "JARVIS"}`,
        "",
        message.content,
        "",
      ]),
    ]
      .filter((line, index, all) => line !== "" || all[index - 1] !== "")
      .join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(activeChat.title)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyMessage(message: JarvisMsg) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError("Non riesco a copiare il messaggio in questo browser.");
    }
  }

  async function requestReply(nextStore: JarvisStore, chatId: string, question: string) {
    const requestId = ++requestIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setBusy(true);
    setError(null);
    const chat = nextStore.chats.find((item) => item.id === chatId);
    if (!chat) {
      setBusy(false);
      return;
    }
    const project = nextStore.projects.find(
      (item) => item.id === (chat.projectId || activeProjectId),
    );
    const fileContext = searchFileContext(nextStore, question, {
      projectId: chat.projectId || activeProjectId,
      chatId,
    });
    const brainContext = [
      buildBrainContextForPrompt(),
      project?.description ? `### Contesto progetto\n${project.description}` : "",
      project?.instructions ? `### Istruzioni progetto\n${project.instructions}` : "",
      fileContext ? `### Contesto file\n${fileContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 11_000);
    try {
      const response = await ask({
        data: {
          question,
          history: chat.messages
            .slice(0, -1)
            .slice(-14)
            .map((message) => ({ role: message.role, content: message.content.slice(0, 4_000) })),
          model,
          brainContext,
          swarmMode: WORK_MODES[workMode].swarm,
        },
        signal: abortController.signal,
      });
      if (requestId !== requestIdRef.current) return;
      const reply =
        (response as { risposta?: string }).risposta ||
        (response as { message?: string }).message ||
        "Non ho ricevuto una risposta. Riprova tra poco.";
      persist(appendMessage(nextStore, chatId, { role: "assistant", content: reply }));
    } catch (caught) {
      if (!abortController.signal.aborted && requestId === requestIdRef.current)
        setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (requestId === requestIdRef.current) {
        abortControllerRef.current = null;
        setBusy(false);
      }
    }
  }

  async function onSend(prompt?: string) {
    const question = (prompt ?? input).trim();
    if (!question || busy) return;
    let nextStore = store;
    let chatId = activeChatId;
    if (!chatId) {
      const created = createChat(nextStore, { projectId: activeProjectId });
      nextStore = created.store;
      chatId = created.chat.id;
      setActiveChatId(chatId);
    }
    nextStore = appendMessage(nextStore, chatId, { role: "user", content: question });
    persist(nextStore);
    setInput("");
    await requestReply(nextStore, chatId, question);
  }

  async function onRegenerate() {
    if (!activeChat || busy) return;
    const lastUserIndex = activeChat.messages.findLastIndex((message) => message.role === "user");
    if (lastUserIndex < 0) return;
    const question = activeChat.messages[lastUserIndex].content;
    const nextStore = updateChat(store, activeChat.id, {
      messages: activeChat.messages.slice(0, lastUserIndex + 1),
    });
    persist(nextStore);
    await requestReply(nextStore, activeChat.id, question);
  }

  function onStop() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestIdRef.current += 1;
    setBusy(false);
    setError("Generazione interrotta.");
  }

  async function onAttach(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError("Il file supera il limite di 10 MB.");
      return;
    }
    if (!/\.(txt|md|json|csv|ts|tsx|js|jsx|py|rs|go|java|css|html|log)$/i.test(file.name)) {
      setError("Formato non supportato. Usa un file di testo, codice, JSON o CSV.");
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      setError("Il file è vuoto.");
      return;
    }
    const { store: next } = addTextFile(store, {
      name: file.name,
      text,
      mime: file.type || "text/plain",
      projectId: activeProjectId,
      chatId: activeChatId,
    });
    persist(next);
    setError(null);
  }

  function toggleVoice() {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const browserWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("La dettatura non è supportata in questo browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "it-IT";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setInput((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  const sidebar = (
    <aside className="flex h-full w-full flex-col border-r border-white/[0.055] bg-[#111216] text-slate-200">
      <div className="flex h-16 items-center gap-2 px-3">
        <Link
          to="/home"
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 no-underline transition hover:bg-white/[0.045]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-200 via-amber-300 to-orange-500 text-[#24160e] shadow-[0_8px_24px_rgba(251,146,60,0.16)]">
            <WandSparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[14px] font-semibold text-slate-50">
              JARVIS
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.19em] text-slate-500">
              Omnicore AI
            </span>
          </span>
        </Link>
        <IconButton label="Chiudi menu" onClick={() => setSidebarOpen(false)} className="md:hidden">
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.045] px-3 py-2.5 text-[12px] font-semibold text-slate-100 transition hover:border-orange-300/20 hover:bg-white/[0.07]"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nuova chat
          </span>
          <span className="rounded-md border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-slate-500">
            ⌘ K
          </span>
        </button>
      </div>

      <nav className="space-y-0.5 px-3 pb-3">
        {[
          { id: "chat" as const, label: "Conversazioni", icon: MessageSquareText },
          { id: "neural" as const, label: "Cervello e memoria", icon: Brain },
          { id: "connectors" as const, label: "Strumenti connessi", icon: Cable },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setPanel(item.id);
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] transition ${panel === item.id ? "bg-white/[0.065] font-medium text-slate-100" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
          >
            <item.icon className={`h-3.5 w-3.5 ${panel === item.id ? "text-orange-300" : ""}`} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mx-3 h-px bg-white/[0.055]" />
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Progetti
          </p>
          <IconButton
            label="Crea progetto"
            onClick={() => setProjectDialogOpen(true)}
            className="h-6 w-6 rounded-md"
          >
            <Plus className="h-3 w-3" />
          </IconButton>
        </div>
        <button
          type="button"
          onClick={() => setActiveProjectId(null)}
          className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition ${!activeProjectId ? "bg-orange-300/10 text-orange-100" : "text-slate-400 hover:bg-white/[0.04]"}`}
        >
          <Archive className="h-3.5 w-3.5" /> Tutte le chat
        </button>
        {store.projects.map((project) => (
          <div
            key={project.id}
            className="group flex items-center rounded-lg hover:bg-white/[0.04]"
          >
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(project.id);
                setContextOpen(true);
              }}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] ${activeProjectId === project.id ? "text-orange-100" : "text-slate-400"}`}
            >
              <Folder
                className={`h-3.5 w-3.5 shrink-0 ${activeProjectId === project.id ? "text-orange-300" : ""}`}
              />
              <span className="truncate">{project.name}</span>
            </button>
            <IconButton
              label={`Elimina ${project.name}`}
              onClick={() => onDeleteProject(project)}
              className="mr-1 h-6 w-6 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </IconButton>
          </div>
        ))}

        <div className="mb-2 mt-5 flex items-center justify-between px-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">Recenti</p>
          <span className="text-[9px] text-slate-600">{filteredChats.length}</span>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca nelle chat"
            className="w-full rounded-lg border border-transparent bg-white/[0.025] py-2 pl-7 pr-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-white/[0.08] focus:bg-white/[0.04]"
          />
        </div>
        {filteredChats.length === 0 ? (
          <p className="px-2 py-4 text-center text-[10px] text-slate-600">Nessuna conversazione</p>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`group mb-0.5 flex items-center rounded-lg transition ${activeChatId === chat.id && panel === "chat" ? "bg-white/[0.065]" : "hover:bg-white/[0.035]"}`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveChatId(chat.id);
                  setActiveProjectId(chat.projectId);
                  setPanel("chat");
                  setSidebarOpen(false);
                }}
                className="min-w-0 flex-1 px-2.5 py-2 text-left"
              >
                <span className="flex items-center gap-1.5">
                  {chat.pinned ? <Pin className="h-2.5 w-2.5 shrink-0 text-orange-300" /> : null}
                  <span
                    className={`truncate text-[11px] ${activeChatId === chat.id ? "text-slate-100" : "text-slate-400"}`}
                  >
                    {chat.title}
                  </span>
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    label={`Opzioni per ${chat.title}`}
                    className="mr-1 h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-44 border-white/10 bg-[#191a1f] text-slate-200"
                >
                  <DropdownMenuItem onSelect={() => onRenameChat(chat)}>
                    <PenLine /> Rinomina
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => persist(updateChat(store, chat.id, { pinned: !chat.pinned }))}
                  >
                    {chat.pinned ? <PinOff /> : <Pin />}{" "}
                    {chat.pinned ? "Rimuovi dai fissati" : "Fissa in alto"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/8" />
                  <DropdownMenuItem
                    onSelect={() => onDeleteChat(chat)}
                    className="text-red-300 focus:text-red-200"
                  >
                    <Trash2 /> Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-white/[0.055] p-3">
        <Link
          to="/home"
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-slate-500 no-underline transition hover:bg-white/[0.04] hover:text-slate-200"
        >
          <Home className="h-3.5 w-3.5" /> Torna al Control Center
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-[#17181c] text-slate-100 selection:bg-orange-300/25">
      <div className="hidden w-[260px] shrink-0 md:block">{sidebar}</div>
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Chiudi menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full w-[min(86vw,280px)] shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.055),transparent_35%)]">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/[0.055] bg-[#17181c]/90 px-3 backdrop-blur-xl sm:px-5">
          <IconButton label="Apri menu" onClick={() => setSidebarOpen(true)} className="md:hidden">
            <Menu className="h-4 w-4" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-[14px] font-semibold tracking-[-0.02em] text-slate-100">
                {panel === "neural"
                  ? "Cervello e memoria"
                  : panel === "connectors"
                    ? "Strumenti connessi"
                    : activeChat?.title || "Nuova conversazione"}
              </h1>
              {activeProject ? (
                <span className="hidden rounded-full border border-orange-300/15 bg-orange-300/[0.06] px-2 py-0.5 text-[9px] font-semibold text-orange-200/70 sm:inline">
                  {activeProject.name}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-slate-600">
              {panel === "chat"
                ? `${WORK_MODES[workMode].label} · ${GROQ_MODELS.find((item) => item.id === model)?.label}`
                : "JARVIS Control Center"}
            </p>
          </div>
          {panel === "chat" ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 text-[10px] text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200 sm:flex"
                  >
                    {GROQ_MODELS.find((item) => item.id === model)?.label}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 border-white/10 bg-[#191a1f] text-slate-200"
                >
                  {GROQ_MODELS.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() => {
                        setModel(item.id);
                        window.localStorage.setItem(MODEL_KEY, item.id);
                      }}
                      className="justify-between"
                    >
                      {item.label} {model === item.id ? <Check /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <IconButton
                label={contextOpen ? "Chiudi contesto" : "Apri contesto"}
                onClick={() => setContextOpen((value) => !value)}
              >
                <Settings2 className="h-4 w-4" />
              </IconButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label="Azioni conversazione">
                    <MoreHorizontal className="h-4 w-4" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 border-white/10 bg-[#191a1f] text-slate-200"
                >
                  <DropdownMenuItem
                    disabled={!activeChat}
                    onSelect={() => activeChat && onRenameChat(activeChat)}
                  >
                    <PenLine /> Rinomina
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!activeChat?.messages.length} onSelect={exportChat}>
                    <Download /> Esporta in Markdown
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/8" />
                  <DropdownMenuItem
                    disabled={!activeChat?.messages.length}
                    onSelect={onClearChat}
                    className="text-red-300 focus:text-red-200"
                  >
                    <Trash2 /> Svuota chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </header>

        {panel === "neural" ? (
          <FeaturePanel
            eyebrow="Identità e conoscenza"
            title="Il cervello di JARVIS"
            description="Personalizza il modo in cui JARVIS ragiona, ricorda e risponde. Le informazioni del Brain vengono incluse automaticamente nelle conversazioni."
            icon={Brain}
            actions={[
              { label: "Apri il Brain", to: "/agent" },
              { label: "Esplora la memoria", to: "/memory" },
            ]}
            cards={[
              {
                icon: AtSign,
                title: "Profilo",
                body: "Nome, tono, personalità e preferenze operative.",
              },
              {
                icon: Brain,
                title: "Memoria",
                body: "Contesto persistente richiamato durante le conversazioni.",
              },
              {
                icon: Clipboard,
                title: "Regole",
                body: "Limiti, conferme e istruzioni sempre attive.",
              },
            ]}
          />
        ) : panel === "connectors" ? (
          <FeaturePanel
            eyebrow="Azioni e automazioni"
            title="Porta JARVIS nei tuoi strumenti"
            description="Collega servizi e app tramite One MCP. JARVIS può consultare i dati e proporre azioni; ogni modifica sensibile resta sotto conferma umana."
            icon={Cable}
            actions={[{ label: "Gestisci connettori", to: "/connectors" }]}
            cards={[
              {
                icon: Cable,
                title: "One MCP",
                body: "Un unico accesso alle integrazioni SaaS abilitate.",
              },
              {
                icon: Search,
                title: "Ricerca azioni",
                body: "Trova lo strumento giusto in base alla richiesta.",
              },
              {
                icon: Check,
                title: "Controllo umano",
                body: "Conferma esplicita prima di ogni azione write.",
              },
            ]}
          />
        ) : (
          <>
            <section className="flex-1 overflow-y-auto">
              {!activeChat || activeChat.messages.length === 0 ? (
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
                  <div className="mb-8 text-center sm:text-left">
                    <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-200/20 bg-gradient-to-br from-orange-200/20 to-orange-500/10 text-orange-200 shadow-[0_16px_50px_rgba(251,146,60,0.10)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h2 className="font-display text-3xl font-semibold tracking-[-0.05em] text-slate-100 sm:text-4xl">
                      Ciao, sono JARVIS.
                    </h2>
                    <p className="mt-3 max-w-xl text-[13px] leading-6 text-slate-500 sm:text-sm">
                      Posso ragionare, creare, analizzare file e usare il tuo contesto personale. Da
                      dove iniziamo?
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {STARTERS.map((starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        onClick={() => {
                          setInput(starter.prompt);
                          inputRef.current?.focus();
                        }}
                        className="group flex items-start gap-3 rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4 text-left transition hover:-translate-y-0.5 hover:border-orange-200/15 hover:bg-white/[0.04]"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] text-slate-500 transition group-hover:bg-orange-300/10 group-hover:text-orange-200">
                          <starter.icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-slate-300">
                            {starter.label}
                          </span>
                          <span className="mt-1 block text-[10px] leading-4 text-slate-600">
                            {starter.prompt}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
                  {activeChat.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`group flex gap-3 sm:gap-4 ${message.role === "user" ? "justify-end" : ""}`}
                    >
                      {message.role === "assistant" ? (
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-orange-200/15 bg-orange-300/[0.08] text-orange-200">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                      ) : null}
                      <div
                        className={`min-w-0 ${message.role === "user" ? "max-w-[88%]" : "flex-1"}`}
                      >
                        <div
                          className={
                            message.role === "user"
                              ? "rounded-[20px] rounded-tr-md border border-white/[0.07] bg-white/[0.055] px-4 py-3 text-[13px] leading-6 text-slate-200"
                              : "text-[13px] leading-6 text-slate-300 sm:text-[14px] sm:leading-7"
                          }
                        >
                          <MessageContent content={message.content} />
                        </div>
                        <div
                          className={`mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 ${message.role === "user" ? "justify-end" : ""}`}
                        >
                          <span className="mr-1 text-[9px] text-slate-700">
                            {timeLabel(message.createdAt)}
                          </span>
                          <IconButton
                            label="Copia messaggio"
                            onClick={() => void copyMessage(message)}
                            className="h-7 w-7"
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3 w-3 text-emerald-300" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </IconButton>
                          {message.role === "assistant" &&
                          message.id === activeChat.messages.at(-1)?.id ? (
                            <IconButton
                              label="Rigenera risposta"
                              onClick={() => void onRegenerate()}
                              className="h-7 w-7"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </IconButton>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                  {busy ? (
                    <div className="flex items-center gap-4" aria-live="polite">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-orange-200/15 bg-orange-300/[0.08] text-orange-200">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
                      </div>
                    </div>
                  ) : null}
                  <div ref={bottomRef} />
                </div>
              )}
            </section>

            <div className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
              {error ? (
                <div
                  className="mx-auto mb-2 flex max-w-3xl items-center justify-between rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-200/80"
                  role="alert"
                >
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)} aria-label="Chiudi errore">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
              <div className="mx-auto max-w-3xl rounded-[22px] border border-white/[0.09] bg-[#202126] p-2 shadow-[0_18px_55px_rgba(0,0,0,0.32),0_1px_0_rgba(255,255,255,0.04)_inset] transition focus-within:border-orange-200/20">
                {visibleFiles.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto px-1 pb-1">
                    {visibleFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex max-w-48 shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/15 px-2.5 py-2"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-orange-200/70" />
                        <span className="truncate text-[10px] text-slate-400">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => persist(deleteFile(store, file.id))}
                          aria-label={`Rimuovi ${file.name}`}
                          className="text-slate-600 hover:text-red-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void onSend();
                    }
                  }}
                  rows={2}
                  maxLength={2_000}
                  placeholder="Chiedi qualsiasi cosa a JARVIS…"
                  className="max-h-44 min-h-14 w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-6 text-slate-100 outline-none placeholder:text-slate-600"
                />
                <div className="flex items-center gap-1 px-1">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.rs,.go,.java,.log,.html,.css"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onAttach(file);
                      event.target.value = "";
                    }}
                  />
                  <IconButton label="Allega file" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={listening ? "Ferma dettatura" : "Avvia dettatura"}
                    onClick={toggleVoice}
                    disabled={!voiceSupported}
                    className={listening ? "bg-red-300/10 text-red-200" : ""}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </IconButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
                      >
                        {(() => {
                          const ModeIcon = WORK_MODES[workMode].icon;
                          return <ModeIcon className="h-3 w-3 text-orange-200/70" />;
                        })()}
                        {WORK_MODES[workMode].shortLabel}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-64 border-white/10 bg-[#191a1f] p-1.5 text-slate-200"
                    >
                      {(
                        Object.entries(WORK_MODES) as [WorkMode, (typeof WORK_MODES)[WorkMode]][]
                      ).map(([id, item]) => (
                        <DropdownMenuItem
                          key={id}
                          onSelect={() => {
                            setWorkMode(id);
                            window.localStorage.setItem(MODE_KEY, id);
                          }}
                          className="items-start py-2"
                        >
                          <item.icon className="mt-0.5" />
                          <span className="flex-1">
                            <span className="block text-[11px] font-medium">{item.label}</span>
                            <span className="block text-[9px] leading-4 text-slate-500">
                              {item.description}
                            </span>
                          </span>
                          {workMode === id ? <Check className="mt-0.5 text-orange-200" /> : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="flex-1" />
                  {busy ? (
                    <button
                      type="button"
                      onClick={onStop}
                      aria-label="Interrompi generazione"
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-950 transition hover:bg-white"
                    >
                      <CircleStop className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!input.trim()}
                      onClick={() => void onSend()}
                      aria-label="Invia messaggio"
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-orange-300 text-[#28170c] shadow-[0_8px_20px_rgba(251,146,60,0.16)] transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-25"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-center text-[9px] text-slate-700">
                JARVIS può commettere errori. Verifica le informazioni importanti.
              </p>
            </div>
          </>
        )}
      </main>

      {contextOpen && panel === "chat" ? (
        <>
          <button
            type="button"
            aria-label="Chiudi pannello contesto"
            className="fixed inset-0 z-30 bg-black/45 xl:hidden"
            onClick={() => setContextOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-40 flex w-[min(88vw,340px)] shrink-0 flex-col border-l border-white/[0.06] bg-[#131418] shadow-2xl xl:static xl:w-[310px] xl:shadow-none">
            <div className="flex h-16 items-center justify-between border-b border-white/[0.055] px-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-200">Contesto</p>
                <p className="mt-0.5 text-[9px] text-slate-600">Istruzioni, file e progetto</p>
              </div>
              <IconButton label="Chiudi contesto" onClick={() => setContextOpen(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {activeProject ? (
                <>
                  <FieldLabel htmlFor="project-name" label="Progetto">
                    <input
                      id="project-name"
                      value={activeProject.name}
                      onChange={(event) =>
                        persist(
                          updateProject(store, activeProject.id, { name: event.target.value }),
                        )
                      }
                      className="jarvis-field"
                    />
                  </FieldLabel>
                  <FieldLabel htmlFor="project-description" label="Descrizione">
                    <textarea
                      id="project-description"
                      value={activeProject.description}
                      onChange={(event) =>
                        persist(
                          updateProject(store, activeProject.id, {
                            description: event.target.value,
                          }),
                        )
                      }
                      rows={3}
                      placeholder="Di cosa si occupa questo progetto?"
                      className="jarvis-field resize-none leading-5"
                    />
                  </FieldLabel>
                  <FieldLabel htmlFor="project-instructions" label="Istruzioni personalizzate">
                    <textarea
                      id="project-instructions"
                      value={activeProject.instructions}
                      onChange={(event) =>
                        persist(
                          updateProject(store, activeProject.id, {
                            instructions: event.target.value,
                          }),
                        )
                      }
                      rows={5}
                      placeholder="Come deve lavorare JARVIS in questo progetto?"
                      className="jarvis-field resize-none leading-5"
                    />
                    <p className="mt-1.5 text-[9px] leading-4 text-slate-700">
                      Vengono aggiunte automaticamente a ogni richiesta del progetto.
                    </p>
                  </FieldLabel>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setProjectDialogOpen(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/[0.1] p-4 text-left transition hover:border-orange-200/20 hover:bg-orange-200/[0.025]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500">
                    <FolderPlus className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[11px] font-medium text-slate-300">
                      Crea un progetto
                    </span>
                    <span className="mt-1 block text-[9px] leading-4 text-slate-600">
                      Raggruppa chat, file e istruzioni.
                    </span>
                  </span>
                </button>
              )}
              <div className="h-px bg-white/[0.055]" />
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                    File nel contesto
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-[9px] font-medium text-orange-200/70 hover:text-orange-200"
                  >
                    + Aggiungi
                  </button>
                </div>
                {visibleFiles.length > 0 ? (
                  <div className="space-y-1.5">
                    {visibleFiles.map((file) => (
                      <div
                        key={file.id}
                        className="group flex items-center gap-2 rounded-xl border border-white/[0.055] bg-white/[0.02] p-2.5"
                      >
                        <FileText className="h-3.5 w-3.5 text-orange-200/60" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] text-slate-400">{file.name}</p>
                          <p className="mt-0.5 text-[8px] text-slate-700">
                            {Math.max(1, Math.round(file.size / 1024))} KB
                          </p>
                        </div>
                        <IconButton
                          label={`Rimuovi ${file.name}`}
                          onClick={() => persist(deleteFile(store, file.id))}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-white/[0.018] px-3 py-4 text-center text-[9px] leading-4 text-slate-700">
                    Allega testo o codice per usarlo come contesto nelle risposte.
                  </p>
                )}
              </div>
              <div className="h-px bg-white/[0.055]" />
              <div className="space-y-2 text-[9px] text-slate-600">
                <Stat
                  icon={MessageSquareText}
                  label="Messaggi"
                  value={activeChat?.messages.length ?? 0}
                />
                <Stat icon={FileText} label="File attivi" value={visibleFiles.length} />
                <Stat icon={Clock3} label="Salvataggio" value="Locale · attivo" success />
              </div>
            </div>
          </aside>
        </>
      ) : null}

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="border-white/10 bg-[#191a1f] text-slate-100 shadow-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nuovo progetto</DialogTitle>
            <DialogDescription className="text-[12px] leading-5 text-slate-500">
              Riunisci conversazioni, documenti e istruzioni in un unico spazio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <input
              autoFocus
              value={projectDraft.name}
              onChange={(event) =>
                setProjectDraft((current) => ({ ...current, name: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") onCreateProject();
              }}
              placeholder="Nome del progetto"
              className="jarvis-field"
            />
            <textarea
              value={projectDraft.description}
              onChange={(event) =>
                setProjectDraft((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              placeholder="Descrizione (opzionale)"
              className="jarvis-field resize-none leading-5"
            />
            <textarea
              value={projectDraft.instructions}
              onChange={(event) =>
                setProjectDraft((current) => ({ ...current, instructions: event.target.value }))
              }
              rows={3}
              placeholder="Istruzioni per JARVIS (opzionale)"
              className="jarvis-field resize-none leading-5"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setProjectDialogOpen(false)}
              className="rounded-xl px-4 py-2 text-[11px] text-slate-400 hover:bg-white/[0.04]"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={!projectDraft.name.trim()}
              onClick={onCreateProject}
              className="rounded-xl bg-orange-200 px-4 py-2 text-[11px] font-semibold text-[#2d1a0d] disabled:opacity-35"
            >
              Crea progetto
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  success = false,
}: {
  icon: typeof Brain;
  label: string;
  value: string | number;
  success?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className={success ? "text-emerald-400/60" : ""}>{value}</span>
    </div>
  );
}

function FeaturePanel({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  cards,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Brain;
  actions: { label: string; to: "/agent" | "/memory" | "/connectors" }[];
  cards: { icon: typeof Brain; title: string; body: string }[];
}) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-200/15 bg-orange-300/[0.07] text-orange-200">
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-orange-200/60">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-slate-100 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-[13px] leading-6 text-slate-500">{description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Link
                key={action.to}
                to={action.to}
                className={`rounded-xl px-4 py-2.5 text-[11px] font-semibold no-underline transition ${index === 0 ? "bg-orange-200 text-[#2d1a0d] hover:bg-orange-100" : "border border-white/[0.08] text-slate-300 hover:bg-white/[0.04]"}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4"
            >
              <card.icon className="h-4 w-4 text-orange-200/60" />
              <h3 className="mt-4 text-[12px] font-semibold text-slate-300">{card.title}</h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-600">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
