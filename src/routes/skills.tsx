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
  const falix = accounts.filter((a) => a.provider === "falix");
  const active = accounts.find((a) => a.active);

  return (
    <AppShell
      title="Competenze"
      subtitle="Multi-account Falix: Gino, Edo, il tuo — uno attivo alla volta"
    >
      <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:grid-cols-2 sm:p-6">
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <AccountsPanel accounts={accounts} onChange={setAccounts} />
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-primary">Account attivi</h2>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Falix collegati: <span className="text-primary">{falix.length}</span>
              {active ? (
                <>
                  {" "}· in uso: <span className="text-primary">{active.label}</span>
                </>
              ) : null}
            </p>
            <ul className="mb-4 space-y-1 text-[11px] text-muted-foreground">
              {falix.map((a) => (
                <li key={a.id}>
                  {a.active ? "★ " : "· "}{
                  a.label} — Server {a.serverId.slice(0, 8)}
                  {a.serverId.length > 8 ? "…" : ""}
                </li>
              ))}
              {falix.length === 0 ? <li>Nessun Falix ancora.</li> : null}
            </ul>
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
            Il selettore in sidebar (e in Rete) cambia l&apos;account attivo. Tutte le azioni — status,
            avvio/stop, log, console, chat IA — usano solo quell&apos;account.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
