import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Cable,
  FolderPlus,
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
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAuthState } from "@/lib/auth.functions";
import { buildBrainContextForPrompt } from "@/lib/agent-brain";
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
  updateProject,
  type JarvisChat,
  type JarvisFile,
  type JarvisProject,
  type JarvisStore,
} from "@/lib/jarvis-workspace";

export const Route = createFileRoute("/jarvis")({
  head: () => ({
    meta: [
      { title: "JARVIS — Workspace" },
      {
        name: "description",
        content: "Workspace JARVIS: progetti, chat, file. Azzurro TripVault e nero.",
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

function JarvisWorkspace() {
  const { accountKey } = Route.useLoaderData();
  const ask = useServerFn(askAssistant);

  const [store, setStore] = useState<JarvisStore>({ version: 1, projects: [], chats: [], files: [] });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("chat");
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
    if (migrated.chats[0]) setActiveChatId(migrated.chats[0].id);
    try {
      const m = window.localStorage.getItem(MODEL_KEY);
      if (m && GROQ_MODELS.some((x) => x.id === m)) setModel(m as GroqModelId);
    } catch {
      /* ignore */
    }
    const SR =
      typeof window !== "undefined"
        ? (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
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

  async function onAttach(file: File) {
    const max = 10 * 1024 * 1024;
    if (file.size > max) {
      setError("File oltre 10 MB.");
      return;
    }
    const name = file.name;
    const lower = name.toLowerCase();
    const okExt = /\.(txt|md|json|csv|ts|tsx|js|jsx|py|rs|go|java|css|html|log)$/i.test(lower);
    const isPdf = lower.endsWith(".pdf");
    if (!okExt && !isPdf) {
      setError("Formato non supportato. Usa testo, codice o PDF con testo.");
      return;
    }
    let text = "";
    if (isPdf) {
      setError("PDF: estrazione testo non disponibile offline. Usa TXT/MD/JSON per ora.");
      return;
    }
    text = await file.text();
    if (!text.trim()) {
      setError("File vuoto.");
      return;
    }
    const { store: next } = addTextFile(store, {
      name,
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
    <aside className="flex h-full w-full flex-col border-r border-[#abddf7]/12 bg-[#05070c]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 border-b border-[#abddf7]/10 px-3 py-3">
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#abddf7]/70 no-underline hover:text-[#e8f4fb]"
        >
          <Home className="h-3.5 w-3.5" /> Hub
        </Link>
        <span className="flex items-center gap-1.5 font-display text-sm font-semibold tracking-tight text-[#e8f4fb]">
          <Sparkles className="h-4 w-4 text-[#abddf7]" /> JARVIS
        </span>
        <button type="button" className="md:hidden text-[#abddf7]/60" onClick={() => setSidebarOpen(false)} aria-label="Chiudi">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1 p-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-xl bg-[#026ca3]/35 px-3 py-2.5 text-[13px] font-semibold text-[#e8f4fb] shadow-[0_0_24px_rgba(2,108,163,0.25)] transition hover:bg-[#026ca3]/50"
        >
          <Plus className="h-4 w-4" /> Nuova chat
        </button>
        <button
          type="button"
          onClick={onNewProject}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-[#abddf7]/70 hover:bg-white/[0.04] hover:text-[#e8f4fb]"
        >
          <FolderPlus className="h-3.5 w-3.5" /> Nuovo progetto
        </button>
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
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium uppercase tracking-wide ${
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
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#abddf7]/40">Progetti</p>
        <button
          type="button"
          onClick={() => setActiveProjectId(null)}
          className={`mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-[12px] ${
            !activeProjectId ? "bg-[#026ca3]/30 text-[#e8f4fb]" : "text-[#abddf7]/60 hover:bg-white/[0.03]"
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
              aria-label="Elimina progetto"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <p className="mb-1.5 mt-4 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#abddf7]/40">Conversazioni</p>
        {filteredChats.length === 0 ? (
          <p className="px-2 text-[11px] text-[#abddf7]/40">Nessuna chat</p>
        ) : (
          filteredChats.map((c) => (
            <div
              key={c.id}
              className={`group mb-0.5 flex items-center gap-0.5 rounded-lg ${
                activeChatId === c.id ? "bg-[#026ca3]/35" : "hover:bg-white/[0.03]"
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
                className="min-w-0 flex-1 truncate px-2 py-2 text-left text-[12px] text-[#e8f4fb]"
                title="Doppio click per rinominare"
              >
                {c.pinned ? "📌 " : ""}
                {c.title}
              </button>
              <button
                type="button"
                className="p-1 text-[#abddf7]/40 opacity-0 hover:text-[#e8f4fb] group-hover:opacity-100"
                onClick={() => onTogglePin(c)}
                aria-label={c.pinned ? "Sblocca" : "Fissa"}
              >
                {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
              <button
                type="button"
                className="p-1 text-[#abddf7]/40 opacity-0 hover:text-red-300 group-hover:opacity-100"
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
            <p className="mb-1.5 mt-4 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#abddf7]/40">File</p>
            {projectFiles.map((f) => (
              <div key={f.id} className="group flex items-center gap-1 px-2 py-1 text-[11px] text-[#abddf7]/60">
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
      {/* TripVault background — azzurro & nero */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          backgroundColor: "#05070c",
          backgroundImage: `
            radial-gradient(ellipse 80% 55% at 75% 15%, rgba(171,221,247,0.16), transparent 55%),
            radial-gradient(ellipse 55% 45% at 15% 85%, rgba(2,108,163,0.22), transparent 50%),
            linear-gradient(145deg, #05070c 0%, #071018 40%, #026ca3 160%)
          `,
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
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold tracking-tight text-[#e8f4fb]">
              {panel === "neural"
                ? "Sistema neurale"
                : panel === "connectors"
                  ? "Connettori"
                  : activeChat?.title || "JARVIS"}
            </h1>
            <p className="truncate text-[11px] text-[#abddf7]/50">Workspace · azzurro TripVault</p>
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

        {panel === "neural" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <Brain className="h-10 w-10 text-[#abddf7]/60" />
            <h2 className="font-display text-lg text-[#e8f4fb]">Sistema neurale</h2>
            <p className="max-w-md text-[13px] text-[#abddf7]/55">
              Memoria e pattern dell&apos;agente. In arrivo: grafo, achievement e journal.
            </p>
          </div>
        ) : panel === "connectors" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <Cable className="h-10 w-10 text-[#abddf7]/60" />
            <h2 className="font-display text-lg text-[#e8f4fb]">Connettori</h2>
            <p className="max-w-md text-[13px] text-[#abddf7]/55">
              Integrazioni esterne (Supabase, API, tool). Configurazione in sviluppo.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
              {!activeChat || activeChat.messages.length === 0 ? (
                <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
                  <Sparkles className="h-8 w-8 text-[#abddf7]" />
                  <h2 className="font-display text-xl text-[#e8f4fb]">Ciao. Sono JARVIS.</h2>
                  <p className="text-[13px] text-[#abddf7]/55">
                    Chat, progetti e file isolati per account. Usa la barra sotto per scrivere, allegare o dettare.
                  </p>
                </div>
              ) : (
                activeChat.messages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
                    className={`mx-auto mb-3 max-w-3xl ${
                      m.role === "user" ? "flex justify-end" : "flex justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "bg-[#026ca3]/45 text-[#e8f4fb] shadow-[0_4px_20px_rgba(2,108,163,0.2)]"
                          : "border border-[#abddf7]/12 bg-[#05070c]/65 text-[#e8f4fb]/95 backdrop-blur-md"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {busy ? (
                <div className="mx-auto flex max-w-3xl justify-start">
                  <div className="rounded-2xl border border-[#abddf7]/12 bg-[#05070c]/65 px-4 py-3 text-[13px] text-[#abddf7]/70 backdrop-blur-md">
                    JARVIS sta pensando…
                  </div>
                </div>
              ) : null}
              {error ? (
                <p className="mx-auto max-w-3xl text-center text-[12px] text-red-300/90">{error}</p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-[#abddf7]/10 bg-[#05070c]/55 px-3 py-3 backdrop-blur-xl sm:px-6">
              <div className="mx-auto max-w-3xl rounded-2xl border border-[#abddf7]/15 bg-black/40 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
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
                  placeholder="Scrivi un messaggio…"
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
                    className="rounded-xl p-2 text-[#abddf7]/50 hover:bg-white/[0.04] hover:text-[#e8f4fb]"
                    title="Allega file testo"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={!voiceSupported}
                    className={`rounded-xl p-2 hover:bg-white/[0.04] ${
                      listening ? "text-[#abddf7]" : "text-[#abddf7]/50 hover:text-[#e8f4fb]"
                    } disabled:opacity-30`}
                    title={voiceSupported ? "Dettatura" : "Dettatura non supportata"}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    disabled={busy || !input.trim()}
                    onClick={() => void onSend()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#026ca3] to-[#0484c7] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_20px_rgba(2,108,163,0.4)] disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Invia
                  </button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-[#abddf7]/30">
                Dati privati in questo browser · isolati per account
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
