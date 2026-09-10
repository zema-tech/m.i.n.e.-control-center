import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Activity,
  Brain,
  Cable,
  Check,
  Copy,
  Download,
  Eraser,
  FolderPlus,
  Home,
  ListChecks,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { getAuthState } from "@/lib/auth.functions";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";
import {
  addTextFile,
  createChat,
  createProject,
  deleteChat,
  deleteFile,
  deleteProject,
  migrateLegacyChats,
  saveJarvisStore,
  updateChat,
  type JarvisChat,
  type JarvisProject,
  type JarvisStore,
} from "@/lib/jarvis-workspace";
import { loadGithubPat, saveGithubPat } from "@/lib/jarvis-agent";
import { useJarvisAgent } from "@/lib/use-jarvis-agent";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [
      { title: "JARVIS — Workspace Hermes" },
      {
        name: "description",
        content: "Workspace JARVIS Hermes: azzurro → nero, voce, piani confermati, file locali.",
      },
    ],
  }),
  loader: async () => {
    try {
      const state = await getAuthState();
      if (!state.authenticated) throw redirect({ to: "/login" });
      if (state.mustSetPassword) throw redirect({ to: "/setup-password" });
      return { accountKey: state.label || state.role || "user" };
    } catch (e) {
      if (e instanceof Response) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: JarvisWorkspace,
});

const MODEL_KEY = "omnicore.jarvis.model";
type Panel = "chat" | "neural" | "connectors" | "activity";

const QUICK_PROMPTS = [
  "Riassumi i file del progetto in 5 punti",
  "Cerca nei file: fattura e prepara un CSV",
  "Crea un file piano-settimana.md con 3 priorità",
  "Profilo GitHub autenticato via MCP",
];

const ALLOWED_EXT = [
  "txt",
  "md",
  "json",
  "csv",
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "log",
  "html",
  "css",
];

/**
 * VibeSec upload hardening:
 * - mai path traversal (strip directory, .., /, \, null byte)
 * - allowlist estensioni + limite 10MB + testo non vuoto
 * - contenuto reso solo come testo (React escape, mai dangerouslySetInnerHTML)
 */
function sanitizeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() || "file.txt";
  const clean = base.replace(/\0/g, "").replace(/\.\.+/g, ".").trim();
  const safe = clean.replace(/[^a-zA-Z0-9._\-àèéìòù ]/g, "_").slice(0, 120) || "file.txt";
  return safe;
}

function extOf(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function JarvisWorkspace() {
  const { accountKey } = Route.useLoaderData();
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
  const [input, setInput] = useState("");
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pat, setPat] = useState("");
  const [patSaved, setPatSaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const persist = useCallback(
    (next: JarvisStore) => {
      setStore(next);
      saveJarvisStore(accountKey, next);
    },
    [accountKey],
  );

  const agent = useJarvisAgent({
    store,
    persist,
    activeChatId,
    setActiveChatId,
    activeProjectId,
    model,
  });
  const { busy, error, setError } = agent;

  useEffect(() => {
    const migrated = migrateLegacyChats(accountKey);
    setStore(migrated);
    if (migrated.chats[0]) setActiveChatId(migrated.chats[0].id);
    try {
      const m = window.localStorage.getItem(MODEL_KEY);
      if (m && GROQ_MODELS.some((x) => x.id === m)) setModel(m as GroqModelId);
      setPat(loadGithubPat() ? "••••••••" : "");
      setPatSaved(Boolean(loadGithubPat()));
    } catch {
      /* ignore */
    }
    const W = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    setVoiceSupported(Boolean(W.SpeechRecognition || W.webkitSpeechRecognition));
  }, [accountKey]);

  const activeChat = useMemo(
    () => store.chats.find((c) => c.id === activeChatId) ?? null,
    [store.chats, activeChatId],
  );
  const projectFiles = useMemo(
    () =>
      store.files.filter(
        (f) =>
          (activeProjectId && f.projectId === activeProjectId) ||
          (activeChatId && f.chatId === activeChatId),
      ),
    [store.files, activeProjectId, activeChatId],
  );
  const filteredChats = useMemo(() => {
    let list = store.chats;
    if (activeProjectId) list = list.filter((c) => c.projectId === activeProjectId);
    const q = deferredSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => m.content.toLowerCase().includes(q)),
      );
    }
    return [...list].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
    );
  }, [store.chats, activeProjectId, deferredSearch]);

  const totalMessages = useMemo(
    () => store.chats.reduce((n, c) => n + c.messages.length, 0),
    [store.chats],
  );

  const recentActivity = useMemo(() => {
    const all = store.chats.flatMap((c) =>
      c.messages.slice(-3).map((m) => ({ chat: c.title, ...m })),
    );
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  }, [store.chats]);

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
    const { store: next, project } = createProject(store, { name: name.trim().slice(0, 80) });
    persist(next);
    setActiveProjectId(project.id);
  }
  function onRenameChat(chat: JarvisChat) {
    const name = window.prompt("Rinomina chat", chat.title);
    if (!name?.trim()) return;
    persist(updateChat(store, chat.id, { title: name.trim().slice(0, 80) }));
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
    if (!window.confirm(`Eliminare progetto "${p.name}"?`)) return;
    const next = deleteProject(store, p.id);
    persist(next);
    if (activeProjectId === p.id) setActiveProjectId(null);
  }

  function onCopy(id: string, text: string) {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId(null), 1400);
      },
      () => setError("Copia non riuscita."),
    );
  }

  function onExportChat() {
    if (!activeChat) return;
    const lines = [
      `# ${activeChat.title}`,
      `_Esportato ${new Date().toLocaleString("it-IT")} · ${activeChat.messages.length} messaggi_`,
      "",
      ...activeChat.messages.map(
        (m) =>
          `**${m.role === "user" ? "Tu" : "JARVIS"}** (${formatTime(m.createdAt)}):\n${m.content}`,
      ),
    ];
    const blob = new Blob([lines.join("\n\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(activeChat.title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onSend() {
    const text = input.trim().slice(0, 8000);
    if (!text || busy) return;
    setInput("");
    await agent.sendMessage(text);
  }

  async function onAttach(file: File) {
    const safeName = sanitizeFileName(file.name);
    const ext = extOf(safeName);
    if (!ALLOWED_EXT.includes(ext)) {
      setError("Formato non supportato (testo/codice).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File oltre 10 MB.");
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      setError("File vuoto.");
      return;
    }
    const { store: next } = addTextFile(store, {
      name: safeName,
      text,
      mime: "text/plain",
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
      setError("Dettatura non supportata.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "it-IT";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript;
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t).slice(0, 8000));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function savePat() {
    if (pat === "••••••••") return;
    // VibeSec: PAT solo in localStorage locale, mai nei log, mai nel prompt.
    saveGithubPat(pat.trim());
    setPatSaved(Boolean(pat.trim()));
    if (pat.trim()) setPat("••••••••");
    setError(null);
  }

  const sidebar = (
    <aside className="flex h-full w-full flex-col border-r border-sky-100/10 bg-[#020617]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 border-b border-sky-100/10 px-3 py-3">
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 text-[12px] text-sky-100/70 no-underline hover:text-white"
        >
          <Home className="h-3.5 w-3.5" /> Hub
        </Link>
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-sky-200" />
          <span className="font-hermes text-[17px] tracking-[0.18em] text-white">JARVIS</span>
        </span>
        <button
          type="button"
          className="md:hidden text-sky-100/60"
          onClick={() => setSidebarOpen(false)}
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1 p-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-xl bg-gradient-to-b from-sky-200 to-sky-400 px-3 py-2.5 text-[13px] font-semibold text-black hover:from-white hover:to-sky-200"
        >
          <Plus className="h-4 w-4" /> Nuova chat
        </button>
        <button
          type="button"
          onClick={onNewProject}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-sky-100/70 hover:bg-white/[0.04]"
        >
          <FolderPlus className="h-3.5 w-3.5" /> Nuovo progetto
        </button>
      </div>
      <div className="flex gap-1 border-y border-sky-100/10 px-2 py-2">
        {(
          [
            { id: "chat" as const, label: "Chat", icon: Sparkles },
            { id: "neural" as const, label: "Neurale", icon: Brain },
            { id: "connectors" as const, label: "MCP", icon: Cable },
            { id: "activity" as const, label: "Log", icon: Activity },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPanel(t.id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-medium uppercase ${
              panel === t.id ? "bg-sky-300/25 text-white" : "text-sky-100/45 hover:text-white"
            }`}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-100/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.slice(0, 120))}
            placeholder="Cerca chat…"
            maxLength={120}
            autoComplete="off"
            className="w-full rounded-xl border border-sky-100/10 bg-black/35 py-2 pl-8 pr-2 text-[12px] text-white outline-none placeholder:text-sky-100/30 focus:border-sky-200/35"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/40">
          Progetti
        </p>
        <button
          type="button"
          onClick={() => setActiveProjectId(null)}
          className={`mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-[12px] ${
            !activeProjectId ? "bg-sky-300/20 text-white" : "text-sky-100/60 hover:bg-white/[0.03]"
          }`}
        >
          Tutti
        </button>
        {store.projects.map((p) => (
          <div key={p.id} className="group mb-0.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveProjectId(p.id)}
              className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-[12px] ${
                activeProjectId === p.id
                  ? "bg-sky-300/20 text-white"
                  : "text-sky-100/60 hover:bg-white/[0.03]"
              }`}
            >
              {p.name}
            </button>
            <button
              type="button"
              aria-label={`Elimina ${p.name}`}
              className="opacity-0 group-hover:opacity-100 text-sky-100/40 hover:text-red-300"
              onClick={() => onDeleteProject(p)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <p className="mb-1.5 mt-4 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/40">
          Conversazioni
        </p>
        {filteredChats.length === 0 ? (
          <p className="px-2 text-[11px] text-sky-100/40">Nessuna chat</p>
        ) : (
          filteredChats.map((c) => (
            <div
              key={c.id}
              className={`group mb-0.5 flex items-center gap-0.5 rounded-lg ${activeChatId === c.id ? "bg-sky-300/20" : "hover:bg-white/[0.03]"}`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveChatId(c.id);
                  setPanel("chat");
                  setSidebarOpen(false);
                }}
                onDoubleClick={() => onRenameChat(c)}
                className="min-w-0 flex-1 truncate px-2 py-2 text-left text-[12px] text-white"
              >
                {c.pinned ? "📌 " : ""}
                {c.title}
              </button>
              <button
                type="button"
                aria-label="Pin"
                className="p-1 text-sky-100/40 opacity-0 hover:text-white group-hover:opacity-100"
                onClick={() => onTogglePin(c)}
              >
                {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
              <button
                type="button"
                aria-label="Elimina chat"
                className="p-1 text-sky-100/40 opacity-0 hover:text-red-300 group-hover:opacity-100"
                onClick={() => onDeleteChat(c)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
        {projectFiles.length > 0 ? (
          <>
            <p className="mb-1.5 mt-4 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/40">
              File · {projectFiles.length}
            </p>
            {projectFiles.map((f) => (
              <div
                key={f.id}
                className="group flex items-center gap-1 px-2 py-1 text-[11px] text-sky-100/60"
              >
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Elimina ${f.name}`}
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
      <div className="border-t border-sky-100/10 p-3">
        <p className="flex items-center gap-1.5 text-[11px] text-sky-100/50">
          <ShieldCheck className="h-3.5 w-3.5" /> Privato · locale · confermato
        </p>
      </div>
    </aside>
  );

  const isEmpty = (activeChat?.messages.length ?? 0) === 0;

  return (
    <div className="relative flex h-[100dvh] overflow-hidden text-slate-100">
      {/* Sfondo Hermes: azzurro chiaro → nero */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="hermes-sky absolute inset-0 opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/60 to-black/95" />
        <div className="hermes-orb left-[60%] top-[-80px] h-[260px] w-[260px] bg-sky-200/30" />
      </div>
      <div className="relative hidden w-[290px] shrink-0 md:block">{sidebar}</div>
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 h-full w-[min(100%,290px)]">{sidebar}</div>
        </div>
      ) : null}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-sky-100/10 bg-black/45 px-3 py-2.5 backdrop-blur-xl sm:px-4">
          <button
            type="button"
            className="rounded-xl border border-sky-100/20 p-2 text-sky-100 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-hermes text-[20px] tracking-[0.08em] text-white">
              {panel === "neural"
                ? "SISTEMA NEURALE"
                : panel === "connectors"
                  ? "CONNETTORI MCP"
                  : panel === "activity"
                    ? "ATTIVITÀ"
                    : activeChat?.title || "JARVIS"}
            </h1>
            <p className="truncate text-[11px] text-sky-100/50">
              Hermes Agent · workspace locale · {agent.agentMode ? "agente ON" : "agente OFF"} ·{" "}
              {totalMessages} msg
            </p>
          </div>
          {panel === "chat" && activeChat ? (
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={onExportChat}
                title="Esporta chat .md"
                className="rounded-xl border border-sky-100/15 p-2 text-sky-100/70 hover:text-white"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Svuota chat"
                onClick={() => {
                  if (!activeChat || !window.confirm("Svuotare i messaggi?")) return;
                  persist(updateChat(store, activeChat.id, { messages: [] }));
                }}
                className="rounded-xl border border-sky-100/15 p-2 text-sky-100/70 hover:text-white"
              >
                <Eraser className="h-4 w-4" />
              </button>
            </div>
          ) : null}
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
            aria-label="Modello"
            className="max-w-[150px] truncate rounded-xl border border-sky-100/15 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none"
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </header>

        {panel === "neural" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { v: String(store.projects.length), l: "Progetti" },
                { v: String(store.chats.length), l: "Chat" },
                { v: String(store.files.length), l: "File contesto" },
              ].map((s) => (
                <div key={s.l} className="hermes-card p-5 text-center">
                  <p className="font-hermes text-4xl italic text-white">{s.v}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-sky-100/60">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
            <div className="hermes-card mx-auto mt-4 max-w-3xl p-5 sm:p-6">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
                <Brain className="h-4 w-4 text-sky-200" /> Come ragiona Jarvis qui
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300/85">
                Istruzioni progetto + snippet file rilevanti + modalità agente vengono composti nel
                prompt (max ~11k caratteri). Niente disco OS: solo questo workspace per account. I
                piani con <span className="font-mono text-sky-200">mcp_call</span> chiedono sempre
                conferma umana.
              </p>
            </div>
          </div>
        ) : panel === "connectors" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="hermes-card mx-auto max-w-2xl p-5 sm:p-7">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
                <Cable className="h-4 w-4 text-sky-200" /> GitHub MCP via PAT
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300/80">
                Il token resta nel tuo browser (localStorage), non viaggia nei log e non entra nel
                prompt. Incollalo una volta, poi resta mascherato.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value.slice(0, 200))}
                  onFocus={() => {
                    // Il valore mascherato non è editabile: si riparte da vuoto.
                    if (patSaved) setPat("");
                  }}
                  placeholder={patSaved ? "•••••••• (salvato)" : "ghp_…"}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={200}
                  className="min-w-0 flex-1 rounded-xl border border-sky-100/15 bg-black/40 px-3 py-2.5 font-mono text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-sky-200/40"
                />
                <button
                  type="button"
                  onClick={savePat}
                  className="rounded-xl bg-gradient-to-b from-sky-200 to-sky-400 px-4 py-2 text-[13px] font-semibold text-black"
                >
                  Salva
                </button>
                {patSaved ? (
                  <button
                    type="button"
                    onClick={() => {
                      saveGithubPat("");
                      setPat("");
                      setPatSaved(false);
                    }}
                    className="rounded-xl border border-red-300/25 px-3 py-2 text-[13px] text-red-200"
                  >
                    Rimuovi
                  </button>
                ) : null}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-200/80" />
                VibeSec: segreto mai hardcodato, mai nei log, revocabile in un tap.
              </p>
            </div>
          </div>
        ) : panel === "activity" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto max-w-3xl space-y-2">
              {recentActivity.length === 0 ? (
                <p className="hermes-card p-6 text-center text-[13px] text-slate-300/70">
                  Nessuna attività. Scrivi il primo messaggio in Chat.
                </p>
              ) : (
                recentActivity.map((m) => (
                  <div key={m.id} className="hermes-card p-4">
                    <p className="font-mono text-[11px] tracking-wide text-sky-200/70">
                      {m.chat} · {m.role} · {formatTime(m.createdAt)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] text-slate-200">{m.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
              <div className="mx-auto max-w-3xl space-y-3">
                {isEmpty ? (
                  <div className="hermes-card p-6 text-center sm:p-8">
                    <p className="hermes-badge mx-auto">
                      <span className="dot" />
                      Hermes Agent
                    </p>
                    <p className="font-hermes mt-4 text-[30px] italic leading-tight text-white">
                      “Dimmi il compito. Penso io ai passi.”
                    </p>
                    <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
                      {QUICK_PROMPTS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setInput(q)}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[13px] text-slate-200 transition hover:border-sky-200/40 hover:bg-white/[0.05]"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(activeChat?.messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`group flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-sky-300/85 text-black"
                          : "border border-sky-100/10 bg-black/55 text-slate-100 backdrop-blur-md"
                      }`}
                    >
                      {/* VibeSec: testo puro, React fa escape — mai HTML grezzo */}
                      {m.content}
                      <span className="mt-1.5 flex items-center gap-2 opacity-70">
                        <span className="font-mono text-[10px]">{formatTime(m.createdAt)}</span>
                        {m.role === "assistant" ? (
                          <button
                            type="button"
                            aria-label="Copia risposta"
                            onClick={() => onCopy(m.id, m.content)}
                            className="rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-white/10"
                          >
                            {copiedId === m.id ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        ) : null}
                      </span>
                    </div>
                  </div>
                ))}
                {busy ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-sky-100/10 bg-black/55 px-4 py-3 text-[13px] text-sky-100/70">
                      <span className="hermes-typing flex gap-1" aria-hidden>
                        <span />
                        <span />
                        <span />
                      </span>
                      JARVIS sta pensando…
                    </div>
                  </div>
                ) : null}
                {error ? (
                  <p className="text-center text-[12px] text-red-300/90" role="alert">
                    {error}
                  </p>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </div>

            {agent.pendingPlan && agent.planChatId ? (
              <div className="border-t border-sky-200/15 bg-sky-400/10 px-3 py-3 backdrop-blur sm:px-6">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
                  <ListChecks className="h-4 w-4 text-sky-200" />
                  <span className="text-[13px] font-medium text-white">
                    Confermi il piano ({agent.pendingPlan.steps.length} step)?
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      agent.setPendingPlan(null);
                      agent.setPlanChatId(null);
                    }}
                    className="rounded-xl border border-sky-100/20 px-3 py-1.5 text-[12px] text-sky-100/80"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (agent.pendingPlan && agent.planChatId)
                        void agent.runPendingPlan(agent.pendingPlan, agent.planChatId, store);
                    }}
                    className="rounded-xl bg-gradient-to-b from-sky-100 to-sky-300 px-4 py-1.5 text-[12px] font-semibold text-black"
                  >
                    Esegui piano
                  </button>
                </div>
              </div>
            ) : null}

            <div className="border-t border-sky-100/10 bg-black/50 px-3 py-3 backdrop-blur-xl sm:px-6">
              <div className="mx-auto max-w-3xl rounded-2xl border border-sky-100/15 bg-black/45 p-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 8000))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  rows={2}
                  maxLength={8000}
                  placeholder="Scrivi o detta… (Agente: piano + tool file/CSV)"
                  aria-label="Messaggio per Jarvis"
                  className="w-full resize-none bg-transparent px-2 py-2 text-[14px] text-white outline-none placeholder:text-sky-100/30"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.log,.html,.css"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onAttach(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-xl p-2 text-sky-100/50 hover:bg-white/[0.04]"
                    title="Allega file testo (max 10MB)"
                    aria-label="Allega file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={!voiceSupported}
                    aria-label="Dettatura vocale"
                    className={`rounded-xl p-2 ${listening ? "text-sky-200" : "text-sky-100/50"} disabled:opacity-30`}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => agent.setAgentMode((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium ${
                      agent.agentMode ? "bg-sky-300/25 text-white" : "text-sky-100/50"
                    }`}
                    title="Modalità agente"
                    aria-pressed={agent.agentMode}
                  >
                    <ListChecks className="h-3.5 w-3.5" /> Agente
                  </button>
                  <div className="flex-1" />
                  <span className="hidden font-mono text-[10px] text-sky-100/30 sm:inline">
                    {input.length}/8000
                  </span>
                  <button
                    type="button"
                    disabled={busy || !input.trim()}
                    onClick={() => void onSend()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-100 to-sky-300 px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" /> Invia
                  </button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-sky-100/30">
                Dati privati · tool solo workspace locale · mcp_call sempre con conferma
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
