/**
 * Stato env e servizi — niente secret in chiaro, solo configurato sì/no.
 */

export type HealthItem = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  detail: string;
};

export type SystemHealth = {
  items: HealthItem[];
  readyOps: boolean;
  readyAi: boolean;
  readyOne: boolean;
};

function present(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && String(v).trim().length > 0);
}

export function getSystemHealth(): SystemHealth {
  const jwt = present("MINE_JWT_SECRET");
  const pass = present("MINE_PASSWORD_HASH");
  const groq = present("GROQ_API_KEY");
  const falixKey = present("FALIX_API_KEY");
  const falixId = present("FALIX_SERVER_ID");
  const one =
    present("ONE_API_KEY") || present("ONE_SECRET") || present("WITHONE_API_KEY");
  const mcAddr = present("MC_SERVER_ADDRESS");

  const items: HealthItem[] = [
    {
      id: "jwt",
      label: "MINE_JWT_SECRET",
      ok: jwt,
      required: true,
      detail: jwt ? "Sessione JWT operativa" : "Manca — login non può firmare token",
    },
    {
      id: "password",
      label: "MINE_PASSWORD_HASH",
      ok: pass,
      required: true,
      detail: pass ? "Password admin configurata" : "Manca — login disabilitato",
    },
    {
      id: "groq",
      label: "GROQ_API_KEY",
      ok: groq,
      required: true,
      detail: groq ? "Cervello Groq disponibile" : "Manca — chat/code IA non rispondono",
    },
    {
      id: "falix_env",
      label: "FALIX_API_KEY + SERVER_ID",
      ok: falixKey && falixId,
      required: false,
      detail:
        falixKey && falixId
          ? "Fallback env Falix presente"
          : "Opzionale se usi account in Competenze",
    },
    {
      id: "one",
      label: "ONE_API_KEY",
      ok: one,
      required: false,
      detail: one
        ? "Passthrough One server-side attivo"
        : "Assente — mani One = istruzioni / MCP client",
    },
    {
      id: "mc_addr",
      label: "MC_SERVER_ADDRESS",
      ok: mcAddr,
      required: false,
      detail: mcAddr
        ? "Query pubblica mcstatus disponibile"
        : "Opzionale — status pubblico se API Falix fallisce",
    },
  ];

  return {
    items,
    readyOps: jwt && pass,
    readyAi: groq,
    readyOne: one,
  };
}
