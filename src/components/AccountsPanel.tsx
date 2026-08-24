import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, KeyRound, Plus, Star, Trash2, Zap } from "lucide-react";

import {
  ACCOUNT_PROVIDERS,
  addAccount,
  loadAccounts,
  maskKey,
  removeAccount,
  setActiveAccount,
  SKILL_META,
  toggleSkill,
  type AccountProvider,
  type ApiAccount,
  type SkillId,
} from "@/lib/accounts";
import { testAccountConnection } from "@/lib/panel.functions";

export function AccountsPanel({
  accounts,
  onChange,
}: {
  accounts: ApiAccount[];
  onChange: (list: ApiAccount[]) => void;
}) {
  const doTest = useServerFn(testAccountConnection);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState<AccountProvider>("falix");
  const [apiKey, setApiKey] = useState("");
  const [serverId, setServerId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [address, setAddress] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const def = ACCOUNT_PROVIDERS.find((p) => p.id === provider);
  const falixCount = accounts.filter((a) => a.provider === "falix").length;

  function save() {
    if (!apiKey.trim()) {
      setTestMsg("Serve almeno una chiave / token API.");
      return;
    }
    if (provider === "falix" && !serverId.trim()) {
      setTestMsg("Per Falix serve anche il Server ID.");
      return;
    }
    addAccount({
      label: label || (provider === "falix" ? `Falix #${falixCount + 1}` : def?.label) || "Account",
      provider,
      apiKey,
      serverId,
      baseUrl,
      address,
      active: accounts.length === 0,
    });
    onChange(loadAccounts());
    setLabel("");
    setApiKey("");
    setServerId("");
    setBaseUrl("");
    setAddress("");
    setOpen(false);
    setTestMsg(null);
  }

  async function test(acc: ApiAccount) {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await doTest({
        data: {
          key: acc.apiKey,
          serverId: acc.serverId || "-",
          base: acc.baseUrl || undefined,
          provider: acc.provider,
        },
      });
      setTestMsg(`${acc.label}: ${res.message}`);
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-primary">
          <KeyRound className="h-3 w-3" /> account Falix &amp; altri
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded border border-primary px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="h-3 w-3" /> account
        </button>
      </div>
      <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
        Aggiungi più account Falix (es. <span className="text-primary">Gino</span>,{" "}
        <span className="text-primary">Edo</span>, <span className="text-primary">il mio</span>) ciascuno
        con la sua API key. La stella ★ = account attivo per status, power, log, console e IA.
      </p>

      {open ? (
        <div className="mb-2 space-y-2 rounded-md border border-border bg-background/50 p-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AccountProvider)}
            className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
          >
            {ACCOUNT_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome (es. Gino, Edo, Il mio SMP)"
            className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
          />
          {def?.fields.map((f) => {
            const val =
              f.key === "apiKey"
                ? apiKey
                : f.key === "serverId"
                  ? serverId
                  : f.key === "baseUrl"
                    ? baseUrl
                    : address;
            const set =
              f.key === "apiKey"
                ? setApiKey
                : f.key === "serverId"
                  ? setServerId
                  : f.key === "baseUrl"
                    ? setBaseUrl
                    : setAddress;
            return (
              <input
                key={f.key}
                type={f.secret ? "password" : "text"}
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={f.label}
                autoComplete="off"
                className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
              />
            );
          })}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded border border-primary py-1 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              salva account
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              annulla
            </button>
          </div>
        </div>
      ) : null}

      {testMsg ? (
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">{testMsg}</p>
      ) : null}

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {accounts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nessun account. Aggiungi almeno un Falix (puoi averne tanti: Gino, Edo, il tuo…).
          </p>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className={`rounded-md border p-2 ${
                acc.active
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-background/40"
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Imposta come account attivo"
                  onClick={() => onChange(setActiveAccount(acc.id))}
                  className={acc.active ? "text-primary" : "text-muted-foreground"}
                >
                  <Star className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setExpanded(expanded === acc.id ? null : acc.id)}
                >
                  <span className="block truncate text-[11px] text-foreground">{acc.label}</span>
                  <span className="block truncate text-[9px] text-muted-foreground">
                    {ACCOUNT_PROVIDERS.find((p) => p.id === acc.provider)?.label} ·{" "}
                    {maskKey(acc.apiKey)}
                    {acc.active ? " · attivo ★" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => void test(acc)}
                  className="text-muted-foreground hover:text-primary"
                  title="Test connessione"
                >
                  <Zap className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(removeAccount(acc.id))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {expanded === acc.id ? (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <p className="mb-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                    Competenze
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(SKILL_META) as SkillId[]).map((skill) => {
                      const on = acc.skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          title={SKILL_META[skill].hint}
                          onClick={() => onChange(toggleSkill(acc.id, skill))}
                          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
                            on
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {on ? <Check className="h-2.5 w-2.5" /> : null}
                          {SKILL_META[skill].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-[9px] text-muted-foreground">
                  {acc.skills.map((s) => SKILL_META[s]?.label ?? s).join(" · ") || "nessuna"}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
