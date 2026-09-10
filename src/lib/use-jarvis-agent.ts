"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/panel.functions";
import { mcpCallTool } from "@/lib/mcp.functions";
import { buildBrainContextForPrompt } from "@/lib/agent-brain";
import { getActiveSkills, loadSkillBody } from "@/lib/agent-skills";
import { findCustomMcp, loadCustomMcpServers } from "@/lib/mcp-custom";
import { type GroqModelId } from "@/lib/groq-models";
import {
  addJarvisMemory,
  formatJarvisMemoriesForPrompt,
  loadJarvisMemories,
  parseSlash,
  removeJarvisMemory,
  slashHelpText,
} from "@/lib/jarvis-plus";
import {
  appendMessage,
  createChat,
  searchFileContext,
  updateChat,
  type JarvisMsg,
  type JarvisStore,
} from "@/lib/jarvis-workspace";
import {
  executePlanAsync,
  formatPlanForChat,
  jarvisAgentBrainPrompt,
  loadGithubPat,
  parsePlanFromReply,
  shouldPreferAgentMode,
  summarizeFilesForPrompt,
  type JarvisPlan,
} from "@/lib/jarvis-agent";

export function useJarvisAgent(opts: {
  store: JarvisStore;
  persist: (s: JarvisStore) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  activeProjectId: string | null;
  model: GroqModelId;
  accountKey: string;
}) {
  const ask = useServerFn(askAssistant);
  const mcpCall = useServerFn(mcpCallTool);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState(true);
  const [pendingPlan, setPendingPlan] = useState<JarvisPlan | null>(null);
  const [planChatId, setPlanChatId] = useState<string | null>(null);
  // Skill attiva stile Claude: il body guida il prossimo messaggio.
  const [activeSkill, setActiveSkill] = useState<{ name: string; body: string } | null>(null);
  // Bump per refreshare le liste memorie/skill nella UI.
  const [memBump, setMemBump] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runPendingPlan = useCallback(
    async (plan: JarvisPlan, chatId: string, baseStore: JarvisStore) => {
      setBusy(true);
      setPendingPlan(null);
      try {
        const pat = loadGithubPat();
        const {
          store: nextStore,
          plan: done,
          downloads,
        } = await executePlanAsync(
          baseStore,
          plan,
          { projectId: opts.activeProjectId, chatId },
          async ({ serverId, name, arguments: args, approved }) => {
            // VibeSec: plugin MCP custom con URL/token dell'utente (mai env).
            // Token solo se bare-token (niente forma "Nome: valore": il server
            // non accetta extraHeaders arbitrari).
            let customUrl: string | undefined;
            let token: string | undefined;
            if (serverId.startsWith("custom:")) {
              const custom = findCustomMcp(serverId);
              if (!custom) return { ok: false, text: `Plugin MCP sconosciuto: ${serverId}` };
              customUrl = custom.url;
              const raw = custom.authHeader?.trim() || "";
              token = raw && !raw.includes(":") ? raw.slice(0, 800) : undefined;
            } else {
              token = pat || undefined;
            }
            const res = (await mcpCall({
              data: {
                serverId,
                name,
                arguments: args,
                approved,
                bearerToken: token,
                customUrl,
              },
            })) as unknown;
            const ok =
              typeof res === "object" && res !== null && "ok" in res
                ? Boolean((res as { ok: unknown }).ok)
                : false;
            const text =
              typeof res === "object" && res !== null && "text" in res
                ? String((res as { text: unknown }).text ?? "")
                : "";
            return { ok, text };
          },
        );
        opts.persist(nextStore);
        let msg = formatPlanForChat(done);
        if (downloads.length) {
          msg += "\n\n**Download pronti:** " + downloads.map((d) => d.filename).join(", ");
          for (const d of downloads) {
            try {
              const blob = new Blob([d.body], { type: d.mime });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = d.filename;
              a.click();
              URL.revokeObjectURL(url);
            } catch {
              /* ignore */
            }
          }
        }
        opts.persist(appendMessage(nextStore, chatId, { role: "assistant", content: msg }));
      } catch (e) {
        if (!mountedRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        opts.persist(
          appendMessage(baseStore, chatId, { role: "assistant", content: `Errore piano: ${msg}` }),
        );
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [opts, mcpCall],
  );

  /** Assicura una chat e ci accoda il messaggio utente. Ritorna [store, chatId]. */
  function ensureChat(base: JarvisStore): { store: JarvisStore; chatId: string } {
    if (opts.activeChatId) return { store: base, chatId: opts.activeChatId };
    const created = createChat(base, { projectId: opts.activeProjectId });
    opts.setActiveChatId(created.chat.id);
    return { store: created.store, chatId: created.chat.id };
  }

  /** Estrae meta ragionamento dalla risposta server (già senza contenuti). */
  function extractMeta(res: unknown): JarvisMsg["meta"] {
    if (typeof res !== "object" || res === null) return undefined;
    const r = res as { mode?: unknown; steps?: unknown };
    const mode = typeof r.mode === "string" ? r.mode.slice(0, 20) : undefined;
    let steps: NonNullable<JarvisMsg["meta"]>["steps"];
    if (Array.isArray(r.steps)) {
      steps = r.steps.slice(0, 12).map((s) => {
        const o = (typeof s === "object" && s !== null ? s : {}) as Record<string, unknown>;
        return {
          fase: String(o.fase ?? "").slice(0, 20),
          provider: String(o.provider ?? "").slice(0, 24),
          model: String(o.model ?? "").slice(0, 80),
          ok: Boolean(o.ok),
          ms: Number.isFinite(Number(o.ms)) ? Math.max(0, Math.round(Number(o.ms))) : 0,
        };
      });
    }
    if (!mode && !steps?.length) return undefined;
    return { mode, steps };
  }

  /** Invio reale all'IA (il messaggio utente è già in store). */
  async function deliver(chatId: string, base: JarvisStore, text: string) {
    const chat = base.chats.find((c) => c.id === chatId);
    if (!chat) {
      if (mountedRef.current) {
        setError("Chat non trovata.");
        setBusy(false);
      }
      return;
    }
    const project = base.projects.find((p) => p.id === (chat.projectId || opts.activeProjectId));
    const fileCtx = searchFileContext(base, text, {
      projectId: chat.projectId || opts.activeProjectId,
      chatId,
    });
    const useAgent = agentMode || shouldPreferAgentMode(text);
    const customs = loadCustomMcpServers();
    const brain = [
      buildBrainContextForPrompt(),
      formatJarvisMemoriesForPrompt(opts.accountKey),
      project?.instructions ? `### Istruzioni progetto\n${project.instructions}` : "",
      fileCtx ? `### Contesto file\n${fileCtx}` : "",
      activeSkill ? `### Skill attiva: ${activeSkill.name}\n${activeSkill.body}` : "",
      useAgent
        ? jarvisAgentBrainPrompt(
            summarizeFilesForPrompt(base),
            customs.length
              ? `GitHub (server=github) + plugin custom: ${customs.map((c) => `${c.id}`).join(", ")} — per i custom usa mcp_call server=<id> e solo tool di lettura senza conferma extra`
              : "- get_me, search_code, get_file_contents, list_issues, … (GitHub MCP)",
          )
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 11000);

    try {
      const res = await ask({
        data: {
          question: text,
          history: chat.messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          model: opts.model,
          brainContext: brain,
        },
      });
      const meta = extractMeta(res);
      const reply =
        typeof res === "object" &&
        res !== null &&
        "risposta" in res &&
        typeof (res as { risposta: unknown }).risposta === "string"
          ? (res as { risposta: string }).risposta
          : typeof res === "object" &&
              res !== null &&
              "message" in res &&
              typeof (res as { message: unknown }).message === "string"
            ? (res as { message: string }).message
            : "Nessuna risposta.";

      const plan = useAgent ? parsePlanFromReply(reply) : null;
      if (plan && plan.steps.length > 0) {
        const cleanReply = reply.replace(/```piano[\s\S]*?```/i, "").trim();
        const intro =
          (cleanReply || `Ho preparato un piano: **${plan.goal}**`) +
          "\n\n" +
          formatPlanForChat({
            ...plan,
            steps: plan.steps.map((st) => ({ ...st, status: "pending" as const })),
          });
        base = appendMessage(base, chatId, { role: "assistant", content: intro, meta });
        opts.persist(base);
        if (plan.needsConfirm) {
          setPendingPlan(plan);
          setPlanChatId(chatId);
        } else {
          await runPendingPlan(plan, chatId, base);
          return;
        }
      } else {
        opts.persist(appendMessage(base, chatId, { role: "assistant", content: reply, meta }));
      }
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      opts.persist(appendMessage(base, chatId, { role: "assistant", content: `Errore: ${msg}` }));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  /** Slash command locali (niente rete): ritorna true se gestito. */
  function handleSlash(chatId: string, base: JarvisStore, cmd: string, arg: string): boolean {
    const say = (content: string) => {
      opts.persist(appendMessage(base, chatId, { role: "assistant", content }));
    };
    switch (cmd) {
      case "aiuto":
        say(slashHelpText());
        return true;
      case "memorizza": {
        if (!arg) {
          say("Uso: `/memorizza <testo>` — es. `/memorizza preferisco risposte brevi`");
          return true;
        }
        const item = addJarvisMemory(opts.accountKey, arg);
        setMemBump((n) => n + 1);
        say(
          item
            ? `Memorizzato (${loadJarvisMemories(opts.accountKey).length} ricordi): “${item.text}”`
            : "Ricordo già presente o troppo corto.",
        );
        return true;
      }
      case "ricorda": {
        const list = loadJarvisMemories(opts.accountKey);
        say(
          list.length === 0
            ? "Nessun ricordo. Usa `/memorizza <testo>`."
            : `**Ricordi (${list.length})**\n${list.map((m, i) => `${i + 1}. ${m.text}`).join("\n")}`,
        );
        return true;
      }
      case "dimentica": {
        const n = Number.parseInt(arg, 10);
        const list = loadJarvisMemories(opts.accountKey);
        if (!Number.isFinite(n) || n < 1 || n > list.length) {
          say(`Uso: \`/dimentica <n>\` con n da 1 a ${list.length}. Vedi \`/ricorda\`.`);
          return true;
        }
        const target = list[n - 1];
        removeJarvisMemory(opts.accountKey, target.id);
        setMemBump((n2) => n2 + 1);
        say(`Dimenticato: “${target.text}”`);
        return true;
      }
      case "skill": {
        if (!arg) {
          const names = getActiveSkills()
            .map((s) => s.name)
            .slice(0, 12);
          say(
            names.length
              ? `Uso: \`/skill <nome>\`.\nAttive: ${names.map((n) => `\`${n}\``).join(", ")}`
              : "Nessuna skill attiva.",
          );
          return true;
        }
        const body = loadSkillBody(arg);
        if (!body) {
          say(`Skill \`${arg.slice(0, 40)}\` non trovata. Vedi \`/skills\`.`);
          return true;
        }
        const skillName = arg.toLowerCase().trim();
        setActiveSkill({ name: skillName, body: body.slice(0, 4000) });
        say(`Skill **${skillName}** attiva: guiderà la mia prossima risposta. Scrivi pure.`);
        return true;
      }
      case "skills": {
        const skills = getActiveSkills();
        say(
          skills.length === 0
            ? "Nessuna skill attiva."
            : `**Skill attive**\n${skills.map((s) => `• \`${s.name}\` — ${s.description}`).join("\n")}\n\nAttiva con \`/skill <nome>\`.`,
        );
        return true;
      }
      case "pulisci": {
        const cleared = updateChat(base, chatId, { messages: [] });
        opts.persist(
          appendMessage(cleared, chatId, {
            role: "assistant",
            content: "Chat svuotata. Da dove ripartiamo?",
          }),
        );
        return true;
      }
      case "esporta": {
        const chat = base.chats.find((c) => c.id === chatId);
        if (!chat || chat.messages.length === 0) {
          say("Niente da esportare.");
          return true;
        }
        try {
          const lines = [
            `# ${chat.title}`,
            `_Esportato ${new Date().toLocaleString("it-IT")}_`,
            "",
            ...chat.messages.map(
              (m) => `**${m.role === "user" ? "Tu" : "JARVIS"}**:\n${m.content}`,
            ),
          ];
          const blob = new Blob([lines.join("\n\n")], { type: "text/markdown" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `jarvis-chat-${new Date().toISOString().slice(0, 10)}.md`;
          a.click();
          URL.revokeObjectURL(url);
          say("Chat esportata in .md (download avviato).");
        } catch {
          say("Export fallito nel browser.");
        }
        return true;
      }
      case "riprova": {
        void regenerate(base, chatId);
        return true;
      }
      default:
        return false;
    }
  }

  async function sendMessage(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const ensured = ensureChat(opts.store);
    let s = ensured.store;
    const chatId = ensured.chatId;

    const slash = parseSlash(t);
    if (slash) {
      s = appendMessage(s, chatId, { role: "user", content: t.slice(0, 500) });
      opts.persist(s);
      handleSlash(chatId, s, slash.cmd, slash.arg);
      return;
    }

    s = appendMessage(s, chatId, { role: "user", content: t });
    opts.persist(s);
    setBusy(true);
    setError(null);
    setPendingPlan(null);
    await deliver(chatId, s, t);
  }

  /** Rigenera l'ultima risposta (stile Grok/Claude): riusa l'ultimo user msg. */
  async function regenerate(base?: JarvisStore, chatId?: string) {
    if (busy) return;
    const store = base ?? opts.store;
    const id = chatId ?? opts.activeChatId;
    if (!id) return;
    const chat = store.chats.find((c) => c.id === id);
    if (!chat || chat.messages.length === 0) return;
    const msgs = [...chat.messages];
    while (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") msgs.pop();
    const lastUser =
      msgs.length > 0 && msgs[msgs.length - 1].role === "user" ? msgs[msgs.length - 1] : null;
    if (!lastUser) return;
    const trimmed = updateChat(store, id, { messages: msgs });
    opts.persist(trimmed);
    setBusy(true);
    setError(null);
    setPendingPlan(null);
    await deliver(id, trimmed, lastUser.content);
  }

  /** Attiva una skill dal picker UI (come /skill). */
  function applySkill(name: string): boolean {
    const body = loadSkillBody(name);
    if (!body) return false;
    setActiveSkill({ name: name.toLowerCase().trim(), body: body.slice(0, 4000) });
    return true;
  }

  return {
    busy,
    error,
    setError,
    agentMode,
    setAgentMode,
    pendingPlan,
    planChatId,
    setPendingPlan,
    setPlanChatId,
    sendMessage,
    runPendingPlan,
    regenerate: () => void regenerate(),
    activeSkill,
    clearSkill: () => setActiveSkill(null),
    applySkill,
    memBump,
  };
}
