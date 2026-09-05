/**
 * Lato server: stato gateway Discord.
 * Il bot process vero e proprio va avviato con un runtime persistente
 * (vedi scripts/discord-gateway.mjs quando aggiunto, o processo dedicato).
 */

import {
  helpText,
  parseInboundCommand,
  readDiscordConfigFromEnv,
  shouldHandleMessage,
  type DiscordInbound,
} from "./discord-gateway";

export function getDiscordGatewayStatus() {
  const cfg = readDiscordConfigFromEnv();
  return {
    ...cfg,
    ready:
      cfg.tokenConfigured &&
      (cfg.allowedUsers.length > 0 || cfg.allowedChannels.length > 0),
    hostingNote:
      "Discord WebSocket richiede un processo sempre acceso (VPS / Railway / locale). Su solo Vercel serverless il bot non resta connesso.",
    intentsRequired: ["Message Content Intent", "Server Members Intent"] as const,
    inviteScopes: ["bot", "applications.commands"] as const,
  };
}

/**
 * Entry point per un worker esterno: riceve un messaggio già normalizzato
 * e restituisce testo da inviare (o silent).
 * Collega qui askGroq / swarm quando il worker chiama l'API interna.
 */
export async function handleDiscordMessage(msg: DiscordInbound): Promise<{
  reply: string | null;
  meta: string;
}> {
  const cfg = readDiscordConfigFromEnv();
  const gate = shouldHandleMessage(cfg, msg);
  if (!gate.handle) {
    return { reply: null, meta: gate.reason ?? "ignored" };
  }

  const { command, args } = parseInboundCommand(msg.content.replace(/<@!?\d+>/g, "").trim());

  if (command === "help") {
    return { reply: helpText(), meta: "help" };
  }
  if (command === "whoami") {
    return {
      reply: `userId=\`${msg.userId}\` channel=\`${msg.channelId}\``,
      meta: "whoami",
    };
  }
  if (command === "status") {
    const st = getDiscordGatewayStatus();
    return {
      reply: [
        `token: ${st.tokenConfigured ? "ok" : "manca"}`,
        `allow users: ${st.allowedUsers.length}`,
        `allow channels: ${st.allowedChannels.length}`,
        `mention required: ${st.requireMention}`,
      ].join("\n"),
      meta: "status",
    };
  }
  if (command === "new" || command === "reset") {
    return {
      reply: "Sessione resettata (hook store da collegare).",
      meta: "reset",
    };
  }
  if (command === "approve" || command === "deny" || command === "stop" || command === "model") {
    return {
      reply: `Comando /${command} ricevuto${args ? `: ${args}` : ""}. Collegare coda azioni / provider.`,
      meta: command,
    };
  }

  // Chat libera: il worker dovrà chiamare l'LLM con buildBrainContextForPrompt.
  return {
    reply: null,
    meta: "chat_pending_llm",
  };
}
