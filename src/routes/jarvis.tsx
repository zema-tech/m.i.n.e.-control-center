import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Brain,
  Cable,
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
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { useJarvisAgent } from "@/lib/use-jarvis-agent";
import { JARVIS_COMPOSER_KEY } from "@/lib/jarvis-plugins";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [
      { title: "JARVIS — Workspace" },
      { name: "description", content: "Workspace JARVIS con modalità agente. Azzurro TripVault." },
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
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

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
      const composerPrompt = window.localStorage.getItem(JARVIS_COMPOSER_KEY);
      if (composerPrompt) {
        setInput(composerPrompt);
        window.localStorage.removeItem(JARVIS_COMPOSER_KEY);
      }
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
    if (!window.confirm(`Eliminare progetto "${p.name}"?`)) return;
    const next = deleteProject(store, p.id);
    persist(next);
    if (activeProjectId === p.id) setActiveProjectId(null);
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await agent.sendMessage(text);
  }

  async function onAttach(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError("File oltre 10 MB.");
      return;
    }
    const lower = file.name.toLowerCase();
    if (!/\.(txt|md|json|csv|ts|tsx|js|jsx|py|log|html|css)$/i.test(lower)) {
      setError("Formato non supportato (testo/codice).");
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      setError("File vuoto.");
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
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  const sidebar = (
    <aside className="flex h-full w-full flex-col border-r border-[#abddf7]/12 bg-[#05070c]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 border-b border-[#abddf7]/10 px-3 py-3">
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#abddf7]/70 no-underline hover:text-[#e8f4fb]"
        >
          <Home className="h-3.5 w-3.5" /> Hub
        </Link>
        <span className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#e8f4fb]">
          <Sparkles className="h-4 w-4 text-[#abddf7]" /> JARVIS
        </span>
        <button
          type="button"
          className="md:hidden text-[#abddf7]/60"
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
          className="flex w-full items-center gap-2 rounded-xl bg-[#026ca3]/35 px-3 py-2.5 text-[13px] font-semibold text-[#e8f4fb] hover:bg-[#026ca3]/50"
        >
          <Plus className="h-4 w-4" /> Nuova chat
        </button>
        <button
          type="button"
          onClick={onNewProject}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-[#abddf7]/70 hover:bg-white/[0.04]"
        >
          <FolderPlus className="h-3.5 w-3.5" /> Nuovo progetto
        </button>
        <Link
          to="/customize"
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-[#abddf7]/70 no-underline hover:bg-white/[0.04] hover:text-[#e8f4fb]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Personalizza
        </Link>
      </div>
      <div className="flex gap-1 border-y border-[#abddf7]/10 px-2 py-2">
        {(
          [
            { id: "chat" as const, label: "Chat", icon: Sparkles },
            { id: "neural" as const, label: "Neurale", icon: Brain },
            { id: "connectors" as const, label: "Connettori", icon: Cable },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPanel(t.id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium uppercase ${
              panel === t.id
                ? "bg-[#026ca3]/40 text-[#e8f4fb]"
                : "text-[#abddf7]/45 hover:text-[#e8f4fb]"
            }`}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#abddf7]/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca chat…"
            className="w-full rounded-xl border border-[#abddf7]/12 bg-black/35 py-2 pl-8 pr-2 text-[12px] text-[#e8f4fb] outline-none placeholder:text-[#abddf7]/30 focus:border-[#abddf7]/35"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#abddf7]/40">
          Progetti
        </p>
        <button
          type="button"
          onClick={() => setActiveProjectId(null)}
          className={`mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-[12px] ${
            !activeProjectId
              ? "bg-[#026ca3]/30 text-[#e8f4fb]"
              : "text-[#abddf7]/60 hover:bg-white/[0.03]"
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
                  ? "bg-[#026ca3]/30 text-[#e8f4fb]"
                  : "text-[#abddf7]/60 hover:bg-white/[0.03]"
              }`}
            >
              {p.name}
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-[#abddf7]/40 hover:text-red-300"
              onClick={() => onDeleteProject(p)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <p className="mb-1.5 mt-4 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#abddf7]/40">
          Conversazioni
        </p>
        {filteredChats.length === 0 ? (
          <p className="px-2 text-[11px] text-[#abddf7]/40">Nessuna chat</p>
        ) : (
          filteredChats.map((c) => (
            <div
              key={c.id}
              className={`group mb-0.5 flex items-center gap-0.5 rounded-lg ${activeChatId === c.id ? "bg-[#026ca3]/35" : "hover:bg-white/[0.03]"}`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveChatId(c.id);
                  setPanel("chat");
                  setSidebarOpen(false);
                }}
                onDoubleClick={() => onRenameChat(c)}
                className="min-w-0 flex-1 truncate px-2 py-2 text-left text-[12px] text-[#e8f4fb]"
              >
                {c.pinned ? "📌 " : ""}
                {c.title}
              </button>
              <button
                type="button"
                className="p-1 text-[#abddf7]/40 opacity-0 hover:text-[#e8f4fb] group-hover:opacity-100"
                onClick={() => onTogglePin(c)}
              >
                {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
              <button
                type="button"
                className="p-1 text-[#abddf7]/40 opacity-0 hover:text-red-300 group-hover:opacity-100"
                onClick={() => onDeleteChat(c)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
        {projectFiles.length > 0 ? (
          <>
            <p className="mb-1.5 mt-4 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#abddf7]/40">
              File
            </p>
            {projectFiles.map((f) => (
              <div
                key={f.id}
                className="group flex items-center gap-1 px-2 py-1 text-[11px] text-[#abddf7]/60"
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
    <div className="relative flex h-[100dvh] overflow-hidden text-[#e8f4fb]">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          backgroundColor: "#05070c",
          backgroundImage:
            "radial-gradient(ellipse 80% 55% at 75% 15%, rgba(171,221,247,0.16), transparent 55%), radial-gradient(ellipse 55% 45% at 15% 85%, rgba(2,108,163,0.22), transparent 50%), linear-gradient(145deg, #05070c 0%, #071018 40%, #026ca3 160%)",
        }}
      />
      <div className="hidden w-[280px] shrink-0 md:block">{sidebar}</div>
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 h-full w-[min(100%,280px)]">{sidebar}</div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[#abddf7]/10 bg-[#05070c]/50 px-3 py-2.5 backdrop-blur-xl sm:px-4">
          <button
            type="button"
            className="rounded-xl border border-[#abddf7]/20 p-2 text-[#abddf7] md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold text-[#e8f4fb]">
              {panel === "neural"
                ? "Sistema neurale"
                : panel === "connectors"
                  ? "Connettori"
                  : activeChat?.title || "JARVIS"}
            </h1>
            <p className="truncate text-[11px] text-[#abddf7]/50">Workspace · agente locale</p>
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
            className="max-w-[140px] truncate rounded-xl border border-[#abddf7]/15 bg-black/40 px-2 py-1.5 text-[11px] text-[#e8f4fb] outline-none"
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </header>

        {panel !== "chat" ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[13px] text-[#abddf7]/50">
            {panel === "neural" ? "Pannello neurale in arrivo." : "Connettori MCP — Fase 2."}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
              <div className="mx-auto max-w-3xl space-y-3">
                {(activeChat?.messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#026ca3]/50 text-[#e8f4fb]"
                          : "border border-[#abddf7]/12 bg-[#05070c]/65 text-[#e8f4fb]/90 backdrop-blur-md"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-[#abddf7]/12 bg-[#05070c]/65 px-4 py-3 text-[13px] text-[#abddf7]/70">
                      JARVIS sta pensando…
                    </div>
                  </div>
                ) : null}
                {error ? <p className="text-center text-[12px] text-red-300/90">{error}</p> : null}
                <div ref={bottomRef} />
              </div>
            </div>

            {agent.pendingPlan && agent.planChatId ? (
              <div className="border-t border-[#abddf7]/15 bg-[#026ca3]/15 px-3 py-3 sm:px-6">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
                  <ListChecks className="h-4 w-4 text-[#abddf7]" />
                  <span className="text-[13px] font-medium text-[#e8f4fb]">
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
                    className="rounded-xl border border-[#abddf7]/20 px-3 py-1.5 text-[12px] text-[#abddf7]/80"
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
                    className="rounded-xl bg-gradient-to-r from-[#026ca3] to-[#0484c7] px-4 py-1.5 text-[12px] font-semibold text-white"
                  >
                    Esegui piano
                  </button>
                </div>
              </div>
            ) : null}

            <div className="border-t border-[#abddf7]/10 bg-[#05070c]/55 px-3 py-3 backdrop-blur-xl sm:px-6">
              <div className="mx-auto max-w-3xl rounded-2xl border border-[#abddf7]/15 bg-black/40 p-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  rows={2}
                  placeholder="Scrivi… (Agente: piano + tool file/CSV)"
                  className="w-full resize-none bg-transparent px-2 py-2 text-[14px] text-[#e8f4fb] outline-none placeholder:text-[#abddf7]/30"
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
                    className="rounded-xl p-2 text-[#abddf7]/50 hover:bg-white/[0.04]"
                    title="Allega"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={!voiceSupported}
                    className={`rounded-xl p-2 ${listening ? "text-[#abddf7]" : "text-[#abddf7]/50"} disabled:opacity-30`}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => agent.setAgentMode((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium ${
                      agent.agentMode ? "bg-[#026ca3]/40 text-[#e8f4fb]" : "text-[#abddf7]/50"
                    }`}
                    title="Modalità agente"
                  >
                    <ListChecks className="h-3.5 w-3.5" /> Agente
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    disabled={busy || !input.trim()}
                    onClick={() => void onSend()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#026ca3] to-[#0484c7] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" /> Invia
                  </button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-[#abddf7]/30">
                Dati privati · tool solo workspace locale
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
