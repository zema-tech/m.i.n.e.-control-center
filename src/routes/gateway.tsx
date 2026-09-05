import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import {
  Bot,
  ExternalLink,
  MessageSquare,
  Shield,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { getAuthState } from "@/lib/auth.functions";
import { DISCORD_COMMANDS } from "@/lib/discord-gateway";
import { getDiscordGatewayStatus } from "@/lib/discord-gateway.server";

const fetchGatewayStatus = createServerFn({ method: "GET" }).handler(async () => {
  return getDiscordGatewayStatus();
});

export const Route = createFileRoute("/gateway")({
  head: () => ({
    meta: [
      { title: "Gateway — Discord" },
      {
        name: "description",
        content: "Messaging gateway stile Hermes: Discord bot, allowlist, comandi.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: GatewayPage,
});

type Status = ReturnType<typeof getDiscordGatewayStatus>;

function GatewayPage() {
  const load = useServerFn(fetchGatewayStatus);
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void load({})
      .then(setSt)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [load]);

  return (
    <AppShell
      title="Gateway"
      subtitle="Discord · stile Hermes messaging"
    >
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <section className="panel-spacious space-y-3 border border-amber-500/20">
          <p className="flex items-center gap-2 text-label text-amber-200/90">
            <Bot className="h-3.5 w-3.5" /> Discord bot
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Come Hermes: un processo gateway legge i messaggi, applica allowlist
            fail-closed, usa SOUL/USER/MEMORY e propone azioni. Il token resta solo
            in env server — mai nel browser.
          </p>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          {st ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <StatusRow
                label="DISCORD_BOT_TOKEN"
                ok={st.tokenConfigured}
                detail={st.tokenConfigured ? "configurato" : "manca"}
              />
              <StatusRow
                label="Allowlist"
                ok={st.allowedUsers.length > 0 || st.allowedChannels.length > 0}
                detail={
                  st.allowedUsers.length || st.allowedChannels.length
                    ? `${st.allowedUsers.length} user · ${st.allowedChannels.length} canali`
                    : "obbligatoria"
                }
              />
              <StatusRow
                label="Gateway ready"
                ok={st.ready}
                detail={st.ready ? "policy ok" : "completa env"}
              />
              <StatusRow
                label="@menzione"
                ok={true}
                detail={st.requireMention ? "richiesta in canale" : "tutti i messaggi"}
              />
            </div>
          ) : (
            !err && <p className="text-caption">Caricamento stato…</p>
          )}
          {st ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-[12px] leading-relaxed text-amber-100/80">
              {st.hostingNote}
            </p>
          ) : null}
        </section>

        <section className="panel-spacious space-y-3">
          <p className="flex items-center gap-2 text-label text-primary">
            <Shield className="h-3.5 w-3.5" /> Setup (Developer Portal)
          </p>
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
            <li>
              Crea un’app su{" "}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Discord Developer Portal <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              Bot → abilita <strong className="text-foreground">Message Content Intent</strong> e{" "}
              <strong className="text-foreground">Server Members Intent</strong>
            </li>
            <li>
              Invito OAuth2: scopes <code className="text-primary">bot</code> +{" "}
              <code className="text-primary">applications.commands</code>; permessi Send Messages,
              Read History, Embed Links, Attach Files
            </li>
            <li>
              Env sul host del gateway:
              <pre className="mt-2 overflow-x-auto rounded border border-border bg-black/40 p-3 font-mono text-[11px] text-foreground">
{`DISCORD_BOT_TOKEN=...
DISCORD_ALLOWED_USERS=tuo_user_id
# opzionale:
DISCORD_ALLOWED_CHANNELS=channel_id
DISCORD_HOME_CHANNEL=channel_id
DISCORD_REQUIRE_MENTION=true`}
              </pre>
            </li>
            <li>
              User ID: Discord → Impostazioni → Avanzate → Modalità sviluppatore → tasto destro sul
              tuo nome → Copia ID
            </li>
          </ol>
        </section>

        <section className="panel-spacious space-y-3">
          <p className="flex items-center gap-2 text-label text-primary">
            <Terminal className="h-3.5 w-3.5" /> Comandi in chat
          </p>
          <ul className="space-y-1.5 font-mono text-[12px]">
            {DISCORD_COMMANDS.map((c) => (
              <li key={c.name} className="flex gap-2 border-b border-border/40 py-1.5">
                <span className="shrink-0 text-amber-200/90">/{c.name}</span>
                <span className="text-muted-foreground">{c.description}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 text-caption text-muted-foreground">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Testo libero (con @bot se require mention) → stessa chat agent del Control Center.
            Risposta esatta <code className="text-primary">[SILENT]</code> /{" "}
            <code className="text-primary">NO_REPLY</code> → nessuna delivery (come Hermes).
          </p>
        </section>

        <section className="panel-spacious space-y-2 border border-border">
          <p className="text-label">Cosa manca ancora (prossimo passo codice)</p>
          <ul className="list-disc space-y-1 pl-4 text-[12px] text-muted-foreground">
            <li>Worker Node con discord.js collegato a handleDiscordMessage + LLM</li>
            <li>Session store per-channel (come Hermes session store)</li>
            <li>Coda /approve per azioni Falix/MCP proposte da Discord</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
      <span className="text-[11px] text-foreground">{label}</span>
      <span
        className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
          ok
            ? "border-emerald-400/40 text-emerald-300"
            : "border-amber-400/40 text-amber-200"
        }`}
      >
        {detail}
      </span>
    </div>
  );
}
