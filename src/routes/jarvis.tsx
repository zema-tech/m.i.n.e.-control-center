import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Brain,
  Cable,
  Download,
  Eraser,
  FlaskConical,
  FolderPlus,
  History,
  Home,
  ListChecks,
  Menu,
  Mic,
  MicOff,
  Network,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Puzzle,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { CustomMcpPanel } from "@/components/CustomMcpPanel";
import { JarvisMessage } from "@/components/JarvisMessage";
import { KnowledgeGraph, type GraphEdge, type GraphNode } from "@/components/KnowledgeGraph";
import { NeuralNet } from "@/components/NeuralNet";
import { getAuthState } from "@/lib/auth.functions";
import {
  loadAgentSkills,
  proposeOrCreateSkill,
  removeSkill,
  setSkillStatus,
} from "@/lib/agent-skills";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";
import {
  addJarvisMemory,
  exportJarvisMemories,
  importJarvisMemories,
  loadJarvisMemories,
  removeJarvisMemory,
  stopJarvisSpeech,
} from "@/lib/jarvis-plus";
import { loadCustomMcpServers } from "@/lib/mcp-custom";
import { mcpListTools } from "@/lib/mcp.functions";
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
  "/aiuto",
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
  const [pat, setPat] = useState("");
  const [patSaved, setPatSaved] = useState(false);
  const [memInput, setMemInput] = useState("");
  const [memTick, setMemTick] = useState(0);
  const [memQuery, setMemQuery] = useState("");
  const [skillTick, setSkillTick] = useState(0);
  const [skillForm, setSkillForm] = useState({ name: "", desc: "", body: "", activate: false });
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [toolsBusy, setToolsBusy] = useState(false);
  const [toolsResult, setToolsResult] = useState<{
    ok: boolean;
    message: string;
    names: string[];
  } | null>(null);
  const memFileRef = useRef<HTMLInputElement>(null);
  const doListTools = useServerFn(mcpListTools);
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
      stopJarvisSpeech();
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
    accountKey,
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

  const memories = useMemo(
    () => loadJarvisMemories(accountKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountKey, agent.memBump, memTick],
  );
  const skills = useMemo(
    () => loadAgentSkills(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel, agent.memBump, skillTick],
  );

  /** Grafo neurale vivo: nodi reali + fili di relazione. */
  const graph = useMemo(() => {
    const freshAfter = Date.now() - 10 * 60 * 1000;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    for (const p of store.projects.slice(0, 6)) {
      nodes.push({
        id: `prj:${p.id}`,
        kind: "project",
        label: p.name,
        fresh: p.updatedAt > freshAfter,
      });
    }
    const chats = [...store.chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    for (const c of chats) {
      nodes.push({
        id: `chat:${c.id}`,
        kind: "chat",
        label: c.title,
        fresh: c.updatedAt > freshAfter,
      });
      if (c.projectId && store.projects.some((p) => p.id === c.projectId)) {
        edges.push({ from: `chat:${c.id}`, to: `prj:${c.projectId}`, strong: true });
      }
    }
    for (const f of store.files.slice(0, 8)) {
      nodes.push({
        id: `file:${f.id}`,
        kind: "file",
        label: f.name,
        fresh: f.createdAt > freshAfter,
      });
      if (f.projectId && store.projects.some((p) => p.id === f.projectId)) {
        edges.push({ from: `file:${f.id}`, to: `prj:${f.projectId}` });
      } else if (f.chatId && chats.some((c) => c.id === f.chatId)) {
        edges.push({ from: `file:${f.id}`, to: `chat:${f.chatId}` });
      }
    }
    for (const m of memories.slice(0, 12)) {
      nodes.push({
        id: `mem:${m.id}`,
        kind: "memory",
        label: m.text,
        fresh: m.createdAt > freshAfter,
      });
    }
    for (const s of skills.filter((s) => s.status === "active").slice(0, 8)) {
      nodes.push({ id: `skill:${s.id}`, kind: "skill", label: s.name });
    }
    for (const c of loadCustomMcpServers().slice(0, 6)) {
      nodes.push({ id: `mcp:${c.id}`, kind: "mcp", label: c.label });
    }
    return { nodes, edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, memories, skills, panel, agent.memBump]);

  function onGraphSelect(n: GraphNode) {
    const [prefix, rest] = [n.id.slice(0, n.id.indexOf(":")), n.id.slice(n.id.indexOf(":") + 1)];
    if (prefix === "chat") {
      setActiveChatId(rest);
      setPanel("chat");
      setSidebarOpen(false);
    } else if (prefix === "prj") {
      setActiveProjectId(rest);
      setPanel("chat");
      setSidebarOpen(false);
    } else if (prefix === "skill") {
      const skill = skills.find((s) => s.id === rest);
      if (skill && agent.applySkill(skill.name)) {
        setPanel("chat");
        setSidebarOpen(false);
      }
    } else if (prefix === "mem") {
      const mem = memories.find((m) => m.id === rest);
      setInput(mem ? `Partendo da questo ricordo (“${mem.text}”), ` : "");
      setPanel("chat");
      setSidebarOpen(false);
    } else if (prefix === "mcp") {
      setPanel("connectors");
    }
  }

  async function onTestGithubTools() {
    const token = loadGithubPat();
    if (!token) {
      setToolsResult({ ok: false, message: "Salva prima il PAT GitHub.", names: [] });
      return;
    }
    setToolsBusy(true);
    setToolsResult(null);
    try {
      const res = await doListTools({ data: { serverId: "github", bearerToken: token } });
      setToolsResult({
        ok: res.ok,
        message: res.message,
        names: (res.tools ?? []).slice(0, 24).map((t: { name: string }) => t.name),
      });
    } catch (e) {
      setToolsResult({ ok: false, message: e instanceof Error ? e.message : String(e), names: [] });
    } finally {
      setToolsBusy(false);
    }
  }

  function onExportMemories() {
    try {
      const blob = new Blob([exportJarvisMemories(accountKey)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jarvis-memorie-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export memorie fallito.");
    }
  }

  async function onImportMemories(file: File) {
    if (file.size > 512 * 1024) {
      setError("File memorie oltre 512 KB.");
      return;
    }
    try {
      const text = await file.text();
      const { added, skipped } = importJarvisMemories(accountKey, text);
      setMemTick((n) => n + 1);
      setError(null);
      if (added === 0 && skipped > 0) setError(`Nessun ricordo importato (${skipped} scartati).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import fallito.");
    }
  }

  function onAddMemory() {
    if (!memInput.trim()) return;
    if (addJarvisMemory(accountKey, memInput)) setMemInput("");
    setMemTick((n) => n + 1);
  }

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
          <span className="font-hermes jx-title-glow text-[17px] tracking-[0.18em]">JARVIS</span>
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
      <div className="jx-scroll flex-1 overflow-y-auto px-2 pb-3">
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
              className={`group mb-0.5 flex items-center gap-0.5 rounded-lg border border-transparent ${activeChatId === c.id ? "jx-side-active" : "hover:bg-white/[0.03]"}`}
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
          <div key="neural" className="jx-scroll jx-panel flex-1 overflow-y-auto p-4 sm:p-8">
            {/* Hero: rete neurale viva */}
            <div className="hermes-card relative mx-auto max-w-3xl overflow-hidden p-6 sm:p-8">
              <NeuralNet
                active={panel === "neural"}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30"
                aria-hidden
              />
              <div className="relative">
                <p className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.24em] text-sky-200/80">
                  <Network className="h-3.5 w-3.5" />
                  SISTEMA NEURALE · HNA
                </p>
                <h2 className="font-hermes mt-3 text-[34px] leading-tight text-white sm:text-[40px]">
                  La rete di <span className="hermes-gradient-text italic">Jarvis.</span>
                </h2>
                <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-slate-300/85">
                  Ogni pallino è un oggetto vivo del tuo workspace — chat, progetti, file, ricordi,
                  skill, plugin — tutti collegati al nucleo. Tocca un nodo per aprirlo.
                </p>
                <div className="mt-4 flex gap-5">
                  <p>
                    <span className="font-hermes text-3xl italic text-white">
                      {graph.nodes.length}
                    </span>
                    <span className="ml-1.5 text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
                      nodi
                    </span>
                  </p>
                  <p>
                    <span className="font-hermes text-3xl italic text-white">
                      {graph.nodes.length + graph.edges.length}
                    </span>
                    <span className="ml-1.5 text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
                      fili
                    </span>
                  </p>
                  <p>
                    <span className="font-hermes text-3xl italic text-white">{totalMessages}</span>
                    <span className="ml-1.5 text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
                      msg
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Grafo interattivo */}
            <div className="hermes-card jx-card mx-auto mt-4 max-w-3xl p-4 sm:p-6">
              {graph.nodes.length > 0 ? (
                <>
                  <KnowledgeGraph
                    nodes={graph.nodes}
                    edges={graph.edges}
                    onSelect={onGraphSelect}
                  />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3">
                    {(
                      [
                        ["project", "Progetti", "#34d399"],
                        ["chat", "Chat", "#7dd3fc"],
                        ["file", "File", "#fbbf24"],
                        ["memory", "Ricordi", "#c4b5fd"],
                        ["skill", "Skill", "#f0abfc"],
                        ["mcp", "Plugin", "#fb9238"],
                      ] as const
                    ).map(([kind, label, color]) => {
                      const n = graph.nodes.filter((x) => x.kind === kind).length;
                      return (
                        <span
                          key={kind}
                          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                          {label} · {n}
                        </span>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="p-4 text-center text-[13px] text-slate-400">
                  Rete vuota: scrivi in chat, crea un progetto o salva un ricordo con{" "}
                  <span className="font-mono text-sky-200">/memorizza</span> e i nodi si accendono.
                </p>
              )}
            </div>
            <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { v: String(store.projects.length), l: "Progetti" },
                { v: String(store.chats.length), l: "Chat" },
                { v: String(store.files.length), l: "File contesto" },
              ].map((s) => (
                <div key={s.l} className="hermes-card jx-card p-5 text-center">
                  <p className="font-hermes text-4xl italic text-white">{s.v}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-sky-100/60">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
            <div className="hermes-card jx-card mx-auto mt-4 max-w-3xl p-5 sm:p-6">
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

            {/* Ricordi locali stile Claude memory */}
            <div className="hermes-card jx-card mx-auto mt-4 max-w-3xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex flex-1 items-center gap-2 text-[14px] font-semibold text-white">
                  <History className="h-4 w-4 text-sky-200" /> Ricordi · {memories.length}/50
                </p>
                <button
                  type="button"
                  onClick={onExportMemories}
                  title="Esporta ricordi in JSON"
                  aria-label="Esporta ricordi"
                  className="rounded-xl border border-sky-100/15 p-2 text-sky-100/70 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => memFileRef.current?.click()}
                  title="Importa ricordi da JSON"
                  aria-label="Importa ricordi"
                  className="rounded-xl border border-sky-100/15 p-2 text-sky-100/70 hover:text-white"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={memFileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImportMemories(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">
                Fatti e preferenze che Jarvis riusa in ogni chat (solo questo browser). Anche via{" "}
                <span className="font-mono text-sky-200">/memorizza</span>.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={memInput}
                  onChange={(e) => setMemInput(e.target.value.slice(0, 300))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onAddMemory();
                    }
                  }}
                  placeholder="es. preferisco risposte brevi…"
                  maxLength={300}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-xl border border-sky-100/15 bg-black/40 px-3 py-2 text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-sky-200/40"
                />
                <button
                  type="button"
                  onClick={onAddMemory}
                  disabled={!memInput.trim()}
                  className="rounded-xl bg-gradient-to-b from-sky-200 to-sky-400 px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {memories.length > 3 ? (
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-100/40" />
                  <input
                    value={memQuery}
                    onChange={(e) => setMemQuery(e.target.value.slice(0, 80))}
                    placeholder="Filtra ricordi…"
                    maxLength={80}
                    autoComplete="off"
                    className="w-full rounded-xl border border-sky-100/10 bg-black/35 py-2 pl-9 pr-3 text-[12.5px] text-white outline-none placeholder:text-sky-100/30 focus:border-sky-200/35"
                  />
                </div>
              ) : null}
              {memories.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {memories
                    .filter((m) =>
                      memQuery.trim()
                        ? m.text.toLowerCase().includes(memQuery.trim().toLowerCase())
                        : true,
                    )
                    .map((m) => (
                      <li
                        key={m.id}
                        className="group flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-slate-200"
                      >
                        <span className="min-w-0 flex-1 truncate">{m.text}</span>
                        <button
                          type="button"
                          aria-label={`Dimentica ${m.text}`}
                          onClick={() => {
                            removeJarvisMemory(accountKey, m.id);
                            setMemTick((n) => n + 1);
                          }}
                          className="shrink-0 rounded p-1 text-slate-500 opacity-0 hover:text-red-300 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>

            {/* Skill stile Claude Agent Skills */}
            <div className="hermes-card jx-card mx-auto mt-4 max-w-3xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex flex-1 items-center gap-2 text-[14px] font-semibold text-white">
                  <Puzzle className="h-4 w-4 text-sky-200" /> Skill ·{" "}
                  {skills.filter((s) => s.status === "active").length} attive
                </p>
                <button
                  type="button"
                  onClick={() => setShowSkillForm((v) => !v)}
                  aria-expanded={showSkillForm}
                  className="inline-flex items-center gap-1 rounded-xl border border-sky-100/15 px-3 py-1.5 text-[12px] text-sky-100/80 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Nuova
                </button>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">
                Procedure riusabili (stile Claude SKILL.md). “Usa” la arma per la prossima risposta,
                oppure <span className="font-mono text-sky-200">/skill &lt;nome&gt;</span> in chat.
                Le bozze restano inattive finché non le abiliti.
              </p>
              {showSkillForm ? (
                <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3.5">
                  <input
                    value={skillForm.name}
                    onChange={(e) =>
                      setSkillForm((f) => ({ ...f, name: e.target.value.slice(0, 48) }))
                    }
                    placeholder="nome-skill (kebab-case)"
                    maxLength={48}
                    autoComplete="off"
                    className="w-full rounded-xl border border-sky-100/15 bg-black/40 px-3 py-2 font-mono text-[12.5px] text-white outline-none placeholder:text-slate-500 focus:border-sky-200/40"
                  />
                  <input
                    value={skillForm.desc}
                    onChange={(e) =>
                      setSkillForm((f) => ({ ...f, desc: e.target.value.slice(0, 200) }))
                    }
                    placeholder="Una riga: quando usarla"
                    maxLength={200}
                    autoComplete="off"
                    className="w-full rounded-xl border border-sky-100/15 bg-black/40 px-3 py-2 text-[12.5px] text-white outline-none placeholder:text-slate-500 focus:border-sky-200/40"
                  />
                  <textarea
                    value={skillForm.body}
                    onChange={(e) =>
                      setSkillForm((f) => ({ ...f, body: e.target.value.slice(0, 12000) }))
                    }
                    placeholder="Body SKILL.md: Quando / Passi / Evita…"
                    rows={3}
                    maxLength={12000}
                    className="w-full resize-y rounded-xl border border-sky-100/15 bg-black/40 px-3 py-2 text-[12.5px] text-white outline-none placeholder:text-slate-500 focus:border-sky-200/40"
                  />
                  <div className="flex items-center gap-2">
                    <label className="inline-flex flex-1 items-center gap-2 text-[12px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={skillForm.activate}
                        onChange={(e) =>
                          setSkillForm((f) => ({ ...f, activate: e.target.checked }))
                        }
                        className="h-3.5 w-3.5 accent-sky-300"
                      />
                      Attiva subito
                    </label>
                    <button
                      type="button"
                      disabled={
                        !skillForm.name.trim() || !skillForm.desc.trim() || !skillForm.body.trim()
                      }
                      onClick={() => {
                        const res = proposeOrCreateSkill({
                          name: skillForm.name,
                          description: skillForm.desc,
                          body: skillForm.body,
                          activate: skillForm.activate,
                          source: "user",
                        });
                        if (res.ok) {
                          setSkillForm({ name: "", desc: "", body: "", activate: false });
                          setShowSkillForm(false);
                          setSkillTick((n) => n + 1);
                        } else {
                          setError(res.message);
                        }
                      }}
                      className="rounded-xl bg-gradient-to-b from-sky-200 to-sky-400 px-4 py-2 text-[12.5px] font-semibold text-black disabled:opacity-40"
                    >
                      Crea
                    </button>
                  </div>
                </div>
              ) : null}
              {skills.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {skills.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={s.status === "active"}
                        aria-label={`${s.status === "active" ? "Disattiva" : "Attiva"} ${s.name}`}
                        title={
                          s.status === "active"
                            ? "Attiva — tocca per mettere in bozza"
                            : "Bozza — tocca per attivare"
                        }
                        onClick={() => {
                          setSkillStatus(s.id, s.status === "active" ? "draft" : "active");
                          if (agent.activeSkill?.name === s.name.toLowerCase()) agent.clearSkill();
                          setSkillTick((n) => n + 1);
                        }}
                        className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${
                          s.status === "active" ? "bg-sky-300/60" : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                            s.status === "active" ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[12px] text-sky-100">
                          {s.name}
                          {s.status !== "active" ? (
                            <span className="ml-2 rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] text-slate-400">
                              bozza
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-[11.5px] text-slate-400">
                          {s.description} · usata {s.useCount}×
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (agent.applySkill(s.name)) {
                            setPanel("chat");
                            setSidebarOpen(false);
                          }
                        }}
                        disabled={s.status !== "active"}
                        className={`shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-semibold disabled:opacity-30 ${
                          agent.activeSkill?.name === s.name.toLowerCase()
                            ? "bg-emerald-300/25 text-emerald-100"
                            : "bg-sky-300/20 text-white hover:bg-sky-300/30"
                        }`}
                      >
                        {agent.activeSkill?.name === s.name.toLowerCase() ? "Attiva ✓" : "Usa"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Elimina ${s.name}`}
                        title="Elimina skill"
                        onClick={() => {
                          if (!window.confirm(`Eliminare la skill "${s.name}"?`)) return;
                          removeSkill(s.id);
                          if (agent.activeSkill?.name === s.name.toLowerCase()) agent.clearSkill();
                          setSkillTick((n) => n + 1);
                        }}
                        className="shrink-0 rounded p-1 text-slate-500 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[12.5px] text-slate-500">
                  Nessuna skill — creane una qui sopra o chiedi a Jarvis di proporla.
                </p>
              )}
            </div>
          </div>
        ) : panel === "connectors" ? (
          <div key="connectors" className="jx-scroll jx-panel flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="hermes-card jx-card p-5 sm:p-7">
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
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <button
                    type="button"
                    onClick={() => void onTestGithubTools()}
                    disabled={toolsBusy || !patSaved}
                    title={patSaved ? "Elenca i tool MCP GitHub" : "Salva prima il PAT"}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-100/15 px-3 py-2 text-[12px] text-sky-100/80 hover:text-white disabled:opacity-40"
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    {toolsBusy ? "Verifica…" : "Verifica connessione ed elenca tool"}
                  </button>
                  {toolsResult ? (
                    <div
                      className={`mt-2.5 rounded-xl border px-3 py-2.5 text-[12.5px] leading-relaxed ${toolsResult.ok ? "border-emerald-300/25 bg-emerald-400/[0.06] text-emerald-50" : "border-red-300/25 bg-red-950/40 text-red-100"}`}
                      role="status"
                    >
                      <p>{toolsResult.message}</p>
                      {toolsResult.names.length > 0 ? (
                        <p className="mt-1.5 flex flex-wrap gap-1.5">
                          {toolsResult.names.map((n) => (
                            <span
                              key={n}
                              className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10.5px] text-sky-100"
                            >
                              {n}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {/* Plugin MCP custom stile Claude Connectors */}
              <div className="hermes-card jx-card p-5 sm:p-7">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
                  <Cable className="h-4 w-4 text-sky-200" /> Plugin MCP custom
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300/80">
                  Collega server MCP streamable-http: in modalità agente li uso via{" "}
                  <span className="font-mono text-sky-200">mcp_call server=&lt;id&gt;</span> sempre
                  con conferma. Solo https pubblici; auth solo con il tuo token.
                </p>
                <div className="mt-4 [&_section]:!animate-none [&_.panel-spacious]:!border-sky-100/10 [&_.panel-spacious]:!bg-transparent [&_.panel-spacious]:!p-0 [&_.panel-spacious]:!shadow-none">
                  <CustomMcpPanel />
                </div>
              </div>
            </div>
          </div>
        ) : panel === "activity" ? (
          <div key="activity" className="jx-scroll jx-panel flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto max-w-3xl space-y-2">
              {recentActivity.length === 0 ? (
                <p className="hermes-card p-6 text-center text-[13px] text-slate-300/70">
                  Nessuna attività. Scrivi il primo messaggio in Chat.
                </p>
              ) : (
                recentActivity.map((m) => (
                  <div key={m.id} className="hermes-card jx-card p-4">
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
            <div className="jx-scroll flex-1 overflow-y-auto px-3 py-4 sm:px-6">
              <div className="mx-auto max-w-3xl space-y-3" key={activeChatId ?? "empty"}>
                {isEmpty ? (
                  <div className="hermes-card jx-panel p-6 text-center sm:p-8">
                    <p className="hermes-badge mx-auto">
                      <span className="dot" />
                      Hermes Agent
                    </p>
                    <p className="font-hermes mt-4 text-[30px] italic leading-tight text-white">
                      “Dimmi il compito.{" "}
                      <span className="hermes-gradient-text">Penso io ai passi.</span>”
                    </p>
                    <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
                      {QUICK_PROMPTS.map((q, i) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setInput(q)}
                          style={{ "--jx-i": i } as CSSProperties}
                          className="jx-card jx-stagger rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[13px] text-slate-200"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(activeChat?.messages ?? []).map((m, idx, arr) => (
                  <JarvisMessage
                    key={m.id}
                    msg={m}
                    time={formatTime(m.createdAt)}
                    isLastAssistant={m.role === "assistant" && idx === arr.length - 1}
                    canRegenerate={!busy}
                    onRegenerate={() => void agent.regenerate()}
                  />
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
              <div className="jx-plan border-t border-sky-200/15 px-3 py-3 backdrop-blur sm:px-6">
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
              <div className="jx-input mx-auto max-w-3xl rounded-2xl border border-sky-100/15 bg-black/45 p-2">
                {agent.activeSkill ? (
                  <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100">
                      <Puzzle className="h-3 w-3" />
                      Skill: {agent.activeSkill.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => agent.clearSkill()}
                      aria-label="Disattiva skill"
                      className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="hidden text-[11px] text-slate-500 sm:inline">
                      Guida la prossima risposta
                    </span>
                  </div>
                ) : null}
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
                  placeholder="Scrivi, detta o usa /aiuto… (Agente: piano + tool file/CSV)"
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
                    className="jx-send inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-40"
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
