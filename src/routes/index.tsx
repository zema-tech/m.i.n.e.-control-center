import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth.functions";

/** Home: login o rete neurale. */
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { authenticated } = await getAuthState();
    if (!authenticated) throw redirect({ to: "/login" });
    throw redirect({ to: "/network" });
  },
});
