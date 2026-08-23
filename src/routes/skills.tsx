import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AccountsPanel } from "@/components/AccountsPanel";
import { AppShell } from "@/components/AppShell";
import { loadAccounts, SKILL_META, type ApiAccount, type SkillId } from "@/lib/accounts";
import { getAuthState } from "@/lib/auth.functions";

export const Route = createFileRoute("/skills")({
  head: () => ({ meta: [{ title: "Competenze — M.I.N.E" }] }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: SkillsPage,
});

function SkillsPage() {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);

  useEffect(() => {
    setAccounts(loadAccounts());
  }, []);

  const allSkills = Object.keys(SKILL_META) as SkillId[];

  return (
    <AppShell
      title="Competenze"
      subtitle="Abilita power, console, metriche… per ogni account collegato"
    >
      <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:grid-cols-2 sm:p-6">
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <AccountsPanel accounts={accounts} onChange={setAccounts} />
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-primary">Mappa competenze</h2>
            <ul className="space-y-2">
              {allSkills.map((s) => (
                <li key={s} className="rounded-md border border-border/60 px-3 py-2">
                  <p className="text-sm text-foreground">{SKILL_META[s].label}</p>
                  <p className="text-[11px] text-muted-foreground">{SKILL_META[s].hint}</p>
                  <p className="mt-1 text-[10px] text-primary/80">
                    Attiva su:{" "}
                    {accounts.filter((a) => a.skills.includes(s)).map((a) => a.label).join(", ") ||
                      "nessun account"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Aggiungi account Falix (o altri host) con la tua API key, poi attiva le competenze.
            L&apos;account con la stella guida power e console dalla Rete e dalla dashboard.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
