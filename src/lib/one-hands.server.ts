/**
 * MANI JARVIS — bridge verso One (withoneai).
 * Remote MCP: https://mcp.withone.ai/mcp
 * API passthrough (se ONE_API_KEY / ONE_SECRET in env): https://api.withone.ai
 *
 * Senza chiave: restituisce istruzioni per collegare OAuth/CLI.
 * Con chiave: tenta passthrough REST best-effort.
 */

import { ONE_MCP_URL, ONE_MCP_TOOL_NAMES } from "./one-platforms";

export type OneHandResult = {
  ok: boolean;
  tool: string;
  output: string;
  raw?: unknown;
};

function oneApiKey(): string | undefined {
  return (
    process.env["ONE_API_KEY"] ||
    process.env["ONE_SECRET"] ||
    process.env["WITHONE_API_KEY"] ||
    undefined
  );
}

const CONNECT_HINT = [
  `Mani One non ancora autenticate sul server.`,
  `Collega il remote MCP: ${ONE_MCP_URL}`,
  `Oppure CLI: npm i -g @withone/cli && one init && one add <platform>`,
  `Oppure imposta ONE_API_KEY (dashboard app.withone.ai) sulle env Vercel per passthrough server-side.`,
].join(" ");

/** Esegue (o simula con guida) un tool One MCP. */
export async function runOneHand(
  tool: string,
  params: Record<string, string | number | boolean>,
  approved: boolean,
): Promise<OneHandResult> {
  if (!ONE_MCP_TOOL_NAMES.includes(tool as (typeof ONE_MCP_TOOL_NAMES)[number])) {
    return { ok: false, tool, output: `Tool One sconosciuto: ${tool}` };
  }

  if (tool === "execute_one_action" && !approved) {
    return {
      ok: false,
      tool,
      output:
        "execute_one_action richiede approvazione esplicita (scrittura su app esterne).",
    };
  }

  const key = oneApiKey();

  // Senza chiave: guida operativa (le mani esistono via MCP client / CLI lato utente)
  if (!key) {
    const platform = String(params.platform ?? "");
    const query = String(params.query ?? "");
    const actionId = String(params.actionId ?? "");

    if (tool === "list_one_integrations") {
      return {
        ok: true,
        tool,
        output: [
          "Piano mani — list_one_integrations:",
          CONNECT_HINT,
          "Dopo il collegamento, l'agente potrà elencare piattaforme e access policy.",
        ].join("\n"),
      };
    }
    if (tool === "search_one_platform_actions") {
      return {
        ok: true,
        tool,
        output: [
          `Piano mani — search su platform="${platform || "?"}" query="${query || "?"}":`,
          CONNECT_HINT,
          platform && query
            ? `CLI equivalente: one actions search ${platform} "${query}"`
            : "Specifica platform e query.",
        ].join("\n"),
      };
    }
    if (tool === "get_one_action_knowledge") {
      return {
        ok: true,
        tool,
        output: [
          `Piano mani — knowledge ${platform || "?"} / ${actionId || "?"}:`,
          CONNECT_HINT,
          platform && actionId
            ? `CLI: one actions knowledge ${platform} ${actionId}`
            : "Servono platform e actionId.",
        ].join("\n"),
      };
    }
    // execute
    return {
      ok: true,
      tool,
      output: [
        `Piano mani — execute ${platform || "?"} action=${actionId || "?"} (approvato=${approved}):`,
        CONNECT_HINT,
        "Quando ONE_API_KEY è configurata, execute userà il passthrough API.",
      ].join("\n"),
    };
  }

  // Con chiave: best-effort verso API One (passthrough / management)
  try {
    const base = (process.env["ONE_API_BASE"] || "https://api.withone.ai").replace(/\/$/, "");

    if (tool === "list_one_integrations") {
      const res = await fetch(`${base}/v1/connections`, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[one] connections ${res.status}: ${text.slice(0, 300)}`);
        return {
          ok: false,
          tool,
          output: `One API connections ${res.status}. Verifica ONE_API_KEY o usa MCP ${ONE_MCP_URL}`,
        };
      }
      return { ok: true, tool, output: text.slice(0, 8000), raw: safeJson(text) };
    }

    if (tool === "search_one_platform_actions") {
      const platform = String(params.platform ?? "");
      const query = String(params.query ?? "");
      if (!platform || !query) {
        return { ok: false, tool, output: "Servono params.platform e params.query" };
      }
      const url = `${base}/v1/actions/search?platform=${encodeURIComponent(platform)}&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[one] search ${res.status}: ${text.slice(0, 300)}`);
        return {
          ok: false,
          tool,
          output: `One search ${res.status}. Alternativa CLI: one actions search ${platform} "${query}"`,
        };
      }
      return { ok: true, tool, output: text.slice(0, 8000), raw: safeJson(text) };
    }

    if (tool === "get_one_action_knowledge") {
      const platform = String(params.platform ?? "");
      const actionId = String(params.actionId ?? "");
      if (!platform || !actionId) {
        return { ok: false, tool, output: "Servono platform e actionId" };
      }
      const url = `${base}/v1/actions/${encodeURIComponent(platform)}/${encodeURIComponent(actionId)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[one] knowledge ${res.status}: ${text.slice(0, 300)}`);
        return { ok: false, tool, output: `One knowledge ${res.status}` };
      }
      return { ok: true, tool, output: text.slice(0, 8000), raw: safeJson(text) };
    }

    // execute_one_action
    const platform = String(params.platform ?? "");
    const actionId = String(params.actionId ?? "");
    const connectionKey = params.connectionKey != null ? String(params.connectionKey) : undefined;
    let bodyData: unknown = params.data;
    if (typeof params.data === "string") {
      try {
        bodyData = JSON.parse(params.data);
      } catch {
        bodyData = params.data;
      }
    }
    if (!platform || !actionId) {
      return { ok: false, tool, output: "execute richiede platform e actionId" };
    }

    const res = await fetch(`${base}/v1/passthrough`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        platform,
        actionId,
        connectionKey,
        data: bodyData,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[one] execute ${res.status}: ${text.slice(0, 300)}`);
      return {
        ok: false,
        tool,
        output: `One execute ${res.status}`,
      };
    }
    return { ok: true, tool, output: text.slice(0, 8000), raw: safeJson(text) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      tool,
      output: `Errore mani One: ${message}. Fallback: collega ${ONE_MCP_URL}`,
    };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function oneHandsStatus(): { configured: boolean; mcpUrl: string; message: string } {
  const configured = Boolean(oneApiKey());
  return {
    configured,
    mcpUrl: ONE_MCP_URL,
    message: configured
      ? "ONE_API_KEY presente — passthrough server-side attivo."
      : `Nessuna ONE_API_KEY: usa MCP ${ONE_MCP_URL} o CLI; le proposte tool restano valide come piano mani.`,
  };
}
