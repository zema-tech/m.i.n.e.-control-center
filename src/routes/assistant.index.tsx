import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { getAuthState } from "@/lib/auth.functions";
import { createThread, loadThreads } from "@/lib/chats";

export const Route = createFileRoute("/assistant/")({
  head: () => ({
    meta: [
      { title: "IA Assistant e Console — M.I.N.E" },
      {
        name: "description",
        content:
          "Chat con l'IA che analizza i log del server Minecraft, propone comandi da confermare e li invia su Falix.",
      },
      { property: "og:title", content: "IA Assistant e Console — M.I.N.E" },
      {
        property: "og:description",
        content: "Assistente IA in italiano che analizza i log e propone comandi da confermare.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    throw redirect({ to: "/jarvis" });
  },
  component: AssistantIndex,
});

function AssistantIndex() {
  const navigate = Route.useNavigate();

  useEffect(() => {
    const existing = loadThreads();
    const thread = existing[0] ?? createThread();
    void navigate({
      to: "/assistant/$threadId",
      params: { threadId: thread.id },
      replace: true,
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Apertura chat…
    </div>
  );
}
