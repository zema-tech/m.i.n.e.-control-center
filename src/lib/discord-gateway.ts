/**
 * Discord messaging gateway — modello Hermes.
 *
 * Importante: Discord richiede un WebSocket persistente.
 * Su Vercel/serverless il bot NON resta online.
 * Esegui il processo gateway su host lungo (VPS, Railway, Fly, PC locale).
 *
 * Env (solo server, mai in client):
 *   DISCORD_BOT_TOKEN
 *   DISCORD_ALLOWED_USERS=id1,id2
 *   DISCORD_ALLOWED_CHANNELS=id1 (opzionale)
 *   DISCORD_HOME_CHANNEL=id (opzionale)
 */

export type DiscordGatewayConfig = {
  /** Token presente lato server (mascherato in UI). */
  tokenConfigured: boolean;
  allowedUsers: string[];
  allowedChannels: string[];
  homeChannel: string | null;
  /** Solo menzioni / DM vs tutto il canale (serve Message Content Intent). */
  requireMention: boolean;
};

export type DiscordSlashCommand = {
  name: string;
  description: string;
  adminOnly?: boolean;
};

/** Comandi allineati a Hermes gateway chat. */
export const DISCORD_COMMANDS: DiscordSlashCommand[] = [
  { name: "new", description: "Nuova conversazione (reset sessione)" },
  { name: "reset", description: "Alias di /new" },
  { name: "status", description: "Info sessione e provider" },
  { name: "help", description: "Elenco comandi" },
  { name: "model", description: "Mostra o cambia modello (se multi-provider)" },
  { name: "stop", description: "Interrompe il task in corso" },
  { name: "approve", description: "Approva azione write/critical in sospeso" },
  { name: "deny", description: "Rifiuta azione in sospeso" },
  { name: "whoami", description: "Il tuo Discord user id e livello accesso" },
];

export function parseIdList(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{5,30}$/.test(s));
}

export function readDiscordConfigFromEnv(): DiscordGatewayConfig {
  const token = process.env["DISCORD_BOT_TOKEN"]?.trim() ?? "";
  return {
    tokenConfigured: token.length > 20,
    allowedUsers: parseIdList(process.env["DISCORD_ALLOWED_USERS"]),
    allowedChannels: parseIdList(process.env["DISCORD_ALLOWED_CHANNELS"]),
    homeChannel: parseIdList(process.env["DISCORD_HOME_CHANNEL"])[0] ?? null,
    requireMention: process.env["DISCORD_REQUIRE_MENTION"] !== "false",
  };
}

/** Fail-closed: senza allowlist, nessun messaggio elaborato. */
export function isDiscordSenderAllowed(
  cfg: DiscordGatewayConfig,
  userId: string,
  channelId?: string,
): { ok: boolean; reason?: string } {
  if (!cfg.tokenConfigured) {
    return { ok: false, reason: "DISCORD_BOT_TOKEN non configurato" };
  }
  if (cfg.allowedUsers.length === 0 && cfg.allowedChannels.length === 0) {
    return {
      ok: false,
      reason: "Nessuna allowlist: imposta DISCORD_ALLOWED_USERS o DISCORD_ALLOWED_CHANNELS",
    };
  }
  if (cfg.allowedUsers.length > 0 && !cfg.allowedUsers.includes(userId)) {
    return { ok: false, reason: "User non in DISCORD_ALLOWED_USERS" };
  }
  if (
    channelId &&
    cfg.allowedChannels.length > 0 &&
    !cfg.allowedChannels.includes(channelId)
  ) {
    return { ok: false, reason: "Canale non in DISCORD_ALLOWED_CHANNELS" };
  }
  return { ok: true };
}

export type DiscordInbound = {
  userId: string;
  channelId: string;
  content: string;
  isMention: boolean;
  isDm: boolean;
};

export type DiscordOutbound =
  | { type: "reply"; text: string }
  | { type: "silent" }
  | { type: "command"; command: string; args: string };

const SILENCE = new Set(["[SILENT]", "SILENT", "NO_REPLY", "NO REPLY"]);

export function parseInboundCommand(content: string): {
  command: string | null;
  args: string;
  rest: string;
} {
  const trimmed = content.trim();
  const m = trimmed.match(/^\/([a-zA-Z0-9_-]+)\s*(.*)$/s);
  if (!m) return { command: null, args: "", rest: trimmed };
  return { command: m[1].toLowerCase(), args: (m[2] ?? "").trim(), rest: trimmed };
}

/** Decide se processare il messaggio (menzione / DM / policy). */
export function shouldHandleMessage(
  cfg: DiscordGatewayConfig,
  msg: DiscordInbound,
): { handle: boolean; reason?: string } {
  const access = isDiscordSenderAllowed(cfg, msg.userId, msg.channelId);
  if (!access.ok) return { handle: false, reason: access.reason };
  if (msg.isDm) return { handle: true };
  if (cfg.requireMention && !msg.isMention) {
    return { handle: false, reason: "Richiede @menzione nel canale" };
  }
  return { handle: true };
}

export function isSilenceReply(text: string): boolean {
  const t = text.trim().toUpperCase().replace(/\s+/g, " ");
  return SILENCE.has(t) || SILENCE.has(text.trim());
}

export function helpText(): string {
  const lines = DISCORD_COMMANDS.map((c) => `/${c.name} — ${c.description}`);
  return [
    "**Omnicore / JARVIS — comandi Discord**",
    "",
    ...lines,
    "",
    "Messaggi normali → chat con SOUL/USER/MEMORY.",
    "Azioni write/critical → /approve o /deny.",
  ].join("\n");
}
