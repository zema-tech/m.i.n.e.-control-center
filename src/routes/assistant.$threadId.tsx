import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAuthState } from "@/lib/auth.functions";

export const Route = createFileRoute("/assistant/$threadId")({
  loader: async ({ params }) => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    throw redirect({ to: "/jarvis", search: { chat: params.threadId } });
  },
});
