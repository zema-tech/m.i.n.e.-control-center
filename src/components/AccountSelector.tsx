import { useEffect, useState } from "react";
import { Server } from "lucide-react";

import {
  ACTIVE_ACCOUNT_EVENT,
  listFalixAccounts,
  loadAccounts,
  setActiveAccount,
  type ApiAccount,
} from "@/lib/accounts";

/**
 * Selettore account Falix attivo (Gino / Edo / il tuo).
 * Tutte le azioni (status, power, log, console, IA) usano questo account.
 */
export function AccountSelector({ className = "" }: { className?: string }) {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  function refresh() {
    const all = loadAccounts();
    const falix = listFalixAccounts();
    setAccounts(falix.length > 0 ? falix : all.filter((a) => a.provider === "falix"));
    const active = all.find((a) => a.active) ?? falix[0] ?? null;
    setActiveId(active?.id ?? "");
  }

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(ACTIVE_ACCOUNT_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  if (accounts.length === 0) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground ${className}`}
      >
        <Server className="h-3 w-3" />
        <span className="hidden sm:inline">Nessun Falix — aggiungi in Competenze</span>
        <span className="sm:hidden">No Falix</span>
      </div>
    );
  }

  return (
    <label
      className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground ${className}`}
    >
      <Server className="h-3 w-3 shrink-0 text-primary" />
      <span className="hidden sm:inline">account</span>
      <select
        value={activeId}
        onChange={(e) => {
          const id = e.target.value;
          setActiveId(id);
          setActiveAccount(id);
          setAccounts(listFalixAccounts());
        }}
        className="max-w-[140px] truncate rounded-md border border-border bg-background px-1.5 py-1 font-mono text-[11px] normal-case tracking-normal text-primary outline-none focus:border-primary sm:max-w-[180px]"
        title="Account Falix attivo: status, power, log, console e IA"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
            {a.active ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
