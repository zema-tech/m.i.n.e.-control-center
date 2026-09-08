"use client";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/panel.functions";
import { buildBrainContextForPrompt } from "@/lib/agent-brain";
import { type GroqModelId } from "@/lib/groq-models";
import {
  appendMessage,
  createChat,
  searchFileContext,
  type JarvisStore,
} from "@/lib/jarvis-workspace";
import {
  executePlan,
  formatPlanForChat,
  jarvisAgentBrainPrompt,
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
}) {
  const ask = useServerFn(askAssistant);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState(true);
  const [pendingPlan, setPendingPlan] = useState<JarvisPlan | null>(null);
  const [planChatId, setPlanChatId] = useState<string | null>(null);

  const runPendingPlan = useCallback(
    async (plan: JarvisPlan, chatId: string, baseStore: JarvisStore) => {
      setBusy(true);
      setPendingPlan(null);
      try {
        const { store: nextStore, plan: done, downloads } = executePlan(
          baseStore,
          plan,
          { projectId: opts.activeProjectId, chatId },
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
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        opts.persist(
          appendMessage(baseStore, chatId, { role: "assistant", content: `Errore piano: ${msg}` }),
        );
      } finally {
        setBusy(false);
      }
    },
    [opts],
  );

  async function sendMessage(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    let s = opts.store;
    let chatId = opts.activeChatId;
    if (!chatId) {
      const created = createChat(s, { projectId: opts.activeProjectId });
      s = created.store;
      chatId = created.chat.id;
      opts.setActiveChatId(chatId);
    }
    s = appendMessage(s, chatId, { role: "user", content: t });
    opts.persist(s);
    setBusy(true);
    setError(null);
    setPendingPlan(null);

    const chat = s.chats.find((c) => c.id === chatId)!;
    const project = s.projects.find((p) => p.id === (chat.projectId || opts.activeProjectId));
    const fileCtx = searchFileContext(s, t, {
      projectId: chat.projectId || opts.activeProjectId,
      chatId,
    });
    const useAgent = agentMode || shouldPreferAgentMode(t);
    const brain = [
      buildBrainContextForPrompt(),
      project?.instructions ? `### Istruzioni progetto\n${project.instructions}` : "",
      fileCtx ? `### Contesto file\n${fileCtx}` : "",
      useAgent ? jarvisAgentBrainPrompt(summarizeFilesForPrompt(s)) : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 11000);

    try {
      const res = await ask({
        data: {
          question: t,
          history: chat.messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          model: opts.model,
          brainContext: brain,
        },
      });
      const reply =
        (res as { risposta?: string }).risposta ||
        (res as { message?: string }).message ||
        "Nessuna risposta.";

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
        s = appendMessage(s, chatId, { role: "assistant", content: intro });
        opts.persist(s);
        if (plan.needsConfirm) {
          setPendingPlan(plan);
          setPlanChatId(chatId);
        } else {
          await runPendingPlan(plan, chatId, s);
          return;
        }
      } else {
        opts.persist(appendMessage(s, chatId, { role: "assistant", content: reply }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      opts.persist(appendMessage(s, chatId, { role: "assistant", content: `Errore: ${msg}` }));
    } finally {
      setBusy(false);
    }
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
  };
}
