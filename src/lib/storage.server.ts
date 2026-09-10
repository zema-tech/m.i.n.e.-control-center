/**
 * Storage connectors (MEGA / Google Drive).
 * Non esegue upload reali senza SDK completi: valida credenziali presenti
 * e registra job di backup come note (human-in-the-loop).
 */

export type StorageProvider = "mega" | "gdrive";

export type StorageCredentials = {
  provider: StorageProvider;
  /** Email MEGA o API key / service-account JSON (GDrive) */
  apiKey: string;
  /** Password/session MEGA o Folder ID GDrive */
  serverId?: string;
  /** Folder handle MEGA o Client ID OAuth opzionale */
  baseUrl?: string;
};

const JOBS_KEY = "mine.storage.jobs"; // solo riferimento lato server log

export function storageStatus(creds: StorageCredentials): {
  ok: boolean;
  message: string;
  configured: boolean;
} {
  const key = (creds.apiKey ?? "").trim();
  if (!key) {
    return {
      ok: false,
      configured: false,
      message: `${creds.provider === "mega" ? "MEGA" : "Google Drive"}: nessuna credenziale. Aggiungi l'account in Competenze.`,
    };
  }

  if (creds.provider === "mega") {
    const hasSecret = Boolean((creds.serverId ?? "").trim());
    return {
      ok: true,
      configured: true,
      message: hasSecret
        ? `MEGA configurato (email ${mask(key)}). Upload reali richiedono sessione client; i job restano in coda con conferma.`
        : `MEGA: email presente (${mask(key)}), manca password/session token nel campo secondario.`,
    };
  }

  // gdrive
  const looksJson = key.startsWith("{") && key.includes("client_email");
  const folder = (creds.serverId ?? "").trim();
  return {
    ok: true,
    configured: true,
    message: looksJson
      ? `Google Drive: service account rilevato${folder ? ` · folder ${folder.slice(0, 12)}…` : ""}. Upload via API dopo conferma.`
      : `Google Drive: API key presente (${mask(key)})${folder ? ` · folder ${folder.slice(0, 12)}…` : ""}.`,
  };
}

export function registerUploadNote(
  creds: StorageCredentials,
  params: { filename: string; sourcePath?: string; folderId?: string },
): { ok: boolean; output: string; jobId: string } {
  const status = storageStatus(creds);
  if (!status.configured) {
    return {
      ok: false,
      jobId: "",
      output: status.message,
    };
  }

  // VibeSec: filename sanificato (niente path/null/CRLF) + cap sui campi liberi.
  const filename = (params.filename ?? "")
    .split(/[/\\]/)
    .pop()
    ?.replace(/\0/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\.\.+/g, ".")
    .trim()
    .slice(0, 120);
  if (!filename) {
    return { ok: false, jobId: "", output: "Serve un nome file (filename)." };
  }
  const folderId = (params.folderId ?? "")
    .replace(/[\r\n\0]/g, "")
    .trim()
    .slice(0, 200);
  const sourcePath = (params.sourcePath ?? "")
    .replace(/[\r\n\0]/g, "")
    .trim()
    .slice(0, 300);

  const jobId = `job:${Date.now().toString(36)}`;
  const dest =
    creds.provider === "mega"
      ? `MEGA${creds.baseUrl ? ` folder=${creds.baseUrl}` : ""}`
      : `Drive${folderId || creds.serverId ? ` folder=${folderId || creds.serverId}` : ""}`;

  const output = [
    `Job backup registrato [${jobId}]`,
    `→ destinazione: ${dest}`,
    `→ file: ${filename}`,
    sourcePath ? `→ sorgente server: ${sourcePath}` : "→ sorgente: da definire in conferma",
    "Stato: in attesa (human-in-the-loop). Esecuzione upload nativa in arrivo con SDK.",
  ].join("\n");

  // Log server-side leggero (no persistenza cross-instance su serverless)
  console.info(`[storage] ${JOBS_KEY}`, jobId, creds.provider, filename);

  return { ok: true, jobId, output };
}

function mask(s: string) {
  if (s.length <= 8) return "••••";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
