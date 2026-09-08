import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAuthState } from "@/lib/auth.functions";

/** Redirect legacy → workspace JARVIS */
export const Route = createFileRoute("/assistant/")({
  head: () => ({
    meta: [{ title: "Chat — JARVIS" }],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    throw redirect({ to: "/jarvis" });
  },
  component: () => null,
});
