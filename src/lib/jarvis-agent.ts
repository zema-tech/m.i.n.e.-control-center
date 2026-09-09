/**
 * JARVIS Fase 1 — pianificazione autonoma + tool interni sul workspace locale.
 * + mcp_call verso server MCP HTTP (es. GitHub) via serverFn.
 * Opera solo su localStorage isolato per account (nessun accesso disco OS).
 */

import {
  addTextFile,
  newId,
  searchFileContext,
  type JarvisFile,
  type JarvisStore,
} from "./jarvis-workspace";

export type JarvisToolName =
  | "list_files"
  | "list_projects"
  | "search_files"
  | "read_file"
  | "create_file"
  | "update_file"
  | "generate_csv_report"
  | "mcp_call"
  | "think";

export type JarvisPlanStep = {
  id: string;
  tool: JarvisToolName;
  args: Record<string, string>;
  description: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  result?: string;
};

export type JarvisPlan = {
  goal: string;
  steps: JarvisPlanStep[];
  /** Se true, l'UI chiede conferma prima di eseguire. */
  needsConfirm: boolean;
};

export type ToolRunResult = {
  ok: boolean;
  message: string;
  store?: JarvisStore;
  /** Contenuto scaricabile (es. CSV). */
  download?: { filename: string; mime: string; body: string };
};

const TOOL_NAMES: JarvisToolName[] = [
  "list_files",
  "list_projects",
  "search_files",
  "read_file",
  "create_file",
  "update_file",
  "generate_csv_report",
  "mcp_call",
  "think",
];

/** Prompt da iniettare in brainContext quando Modalità Agente è attiva. */
export function jarvisAgentBrainPrompt(fileSummary: string, mcpHint?: string): string {
  return [
    "### MODALITÀ AGENTE JARVIS (workspace locale + MCP HTTP)",
    "Sei JARVIS in modalità pianificazione. Prima di rispondere con testo libero,",
    "se il compito richiede più passi o tool, produci un PIANO strutturato.",
    "",
    "Tool disponibili (workspace browser, nessun disco OS):",
    "- list_files — elenca file nel progetto/chat",
    "- list_projects — elenca progetti",
    "- search_files — cerca testo nei file (args: query)",
    "- read_file — legge un file (args: name o id)",
    "- create_file — crea file testo (args: name, content)",
    "- update_file — aggiorna file esistente (args: name o id, content)",
    "- generate_csv_report — genera report CSV (args: filename, headers=col1|col2, rows=a;b||c;d)",
    "- mcp_call — chiama tool su server MCP HTTP (args: server=github, name=<tool>, args_json={...})",
    "- think — ragionamento senza side-effect (args: note)",
    "",
    "MCP HTTP configurato (stile Cursor):",
    '  servers.github = { type: "http", url: "https://api.githubcopilot.com/mcp/" }',
    "Per GitHub: mcp_call | server=github | name=get_me | desc=Chi sono su GitHub",
    "oppure name=search_code | args_json={\"query\":\"repo:owner/name\"}",
    mcpHint ? `Tool MCP noti:\n${mcpHint}` : "(lista tool: usa mcp_call dopo list lato server)",
    "",
    "Formato obbligatorio se usi tool (includilo nella risposta testuale):",
    "```piano",
    "GOAL: <obiettivo in una riga>",
    "CONFIRM: yes|no",
    "1. tool=search_files | query=fattura | desc=Cerca riferimenti fatture",
    "2. tool=mcp_call | server=github | name=get_me | desc=Profilo GitHub autenticato",
    "3. tool=generate_csv_report | filename=report.csv | headers=Data|Importo|Voce | rows=2026-01-01;12.50;Pranzo | desc=Report",
    "```",
    "Poi spiega all'utente in italiano cosa farai.",
    "Se la richiesta è banale (saluto, domanda teorica), NON usare il blocco piano.",
    "",
    fileSummary ? `### File già nel workspace\n${fileSummary}` : "### File nel workspace\n(nessuno)",
  ].join("\n");
}

export function summarizeFilesForPrompt(store: JarvisStore, limit = 12): string {
  if (store.files.length === 0) return "";
  return store.files
    .slice(0, limit)
    .map((f) => `- ${f.name} (${f.size} char)${f.projectId ? ` [prj]` : ""}`)
    .join("\n");
}

/** Estrae blocco ```piano ... ``` dalla risposta assistente. */
export function parsePlanFromReply(text: string): JarvisPlan | null {
  const m = text.match(/```piano\s*([\s\S]*?)```/i);
  if (!m) return null;
  const body = m[1].trim();
  if (!body) return null;

  let goal = "Piano JARVIS";
  let needsConfirm = true;
  const steps: JarvisPlanStep[] = [];

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const goalMatch = line.match(/^GOAL:\s*(.+)$/i);
    if (goalMatch) {
      goal = goalMatch[1].trim();
      continue;
    }
    const confMatch = line.match(/^CONFIRM:\s*(yes|no|sì|si|true|false)/i);
    if (confMatch) {
      const v = confMatch[1].toLowerCase();
      needsConfirm = !(v === "no" || v === "false");
      continue;
    }
    const stepMatch = line.match(/^\d+\.\s*(.+)$/);
    if (!stepMatch) continue;
    const parts = stepMatch[1].split("|").map((p) => p.trim());
    const map: Record<string, string> = {};
    for (const p of parts) {
      const eq = p.indexOf("=");
      if (eq > 0) {
        map[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
      }
    }
    const toolRaw = (map.tool || "").toLowerCase() as JarvisToolName;
    const tool = TOOL_NAMES.includes(toolRaw) ? toolRaw : "think";
    const description = map.desc || map.description || `${tool}`;
    const args: Record<string, string> = { ...map };
    delete args.tool;
    delete args.desc;
    delete args.description;
    steps.push({
      id: newId("step"),
      tool,
      args,
      description,
      status: "pending",
    });
  }

  if (steps.length === 0) return null;
  // mcp_call di scrittura → conferma
  if (steps.some((s) => s.tool === "mcp_call")) needsConfirm = true;
  return { goal, steps, needsConfirm };
}

function findFile(store: JarvisStore, nameOrId: string): JarvisFile | undefined {
  const q = nameOrId.trim().toLowerCase();
  return store.files.find(
    (f) => f.id === nameOrId || f.name.toLowerCase() === q || f.name.toLowerCase().includes(q),
  );
}

export function runJarvisTool(
  store: JarvisStore,
  tool: JarvisToolName,
  args: Record<string, string>,
  ctx?: { projectId?: string | null; chatId?: string | null },
): ToolRunResult {
  try {
    switch (tool) {
      case "think":
        return { ok: true, message: args.note || args.content || "(ok)" };

      case "mcp_call":
        // Eseguito async dal hook via serverFn mcpCallTool
        return {
          ok: false,
          message: "mcp_call va eseguito dal client (serverFn) — non usare runJarvisTool sync.",
        };

      case "list_projects": {
        if (store.projects.length === 0) return { ok: true, message: "Nessun progetto." };
        const lines = store.projects.map((p) => `• ${p.name} (${p.id})`);
        return { ok: true, message: lines.join("\n") };
      }

      case "list_files": {
        const files = store.files.filter((f) => {
          if (ctx?.projectId && f.projectId === ctx.projectId) return true;
          if (ctx?.chatId && f.chatId === ctx.chatId) return true;
          if (!ctx?.projectId && !ctx?.chatId) return true;
          return !ctx?.projectId && !ctx?.chatId;
        });
        if (files.length === 0) return { ok: true, message: "Nessun file nel contesto." };
        return {
          ok: true,
          message: files.map((f) => `• ${f.name} — ${f.size} char (${f.id})`).join("\n"),
        };
      }

      case "search_files": {
        const query = args.query || args.q || "";
        if (!query.trim()) return { ok: false, message: "Serve args.query" };
        const hit = searchFileContext(store, query, {
          projectId: ctx?.projectId,
          chatId: ctx?.chatId,
          maxChars: 4000,
        });
        return {
          ok: true,
          message: hit || `Nessun risultato per "${query}".`,
        };
      }

      case "read_file": {
        const key = args.name || args.id || args.file || "";
        if (!key) return { ok: false, message: "Serve name o id del file." };
        const f = findFile(store, key);
        if (!f) return { ok: false, message: `File non trovato: ${key}` };
        const body = f.text.length > 6000 ? f.text.slice(0, 6000) + "\n…(troncato)" : f.text;
        return { ok: true, message: `### ${f.name}\n${body}` };
      }

      case "create_file": {
        const name = (args.name || args.filename || "nota.txt").trim();
        const content = args.content || args.text || args.body || "";
        if (!content) return { ok: false, message: "Serve content non vuoto." };
        const { store: next, file } = addTextFile(store, {
          name,
          text: content,
          mime: name.endsWith(".csv") ? "text/csv" : "text/plain",
          projectId: ctx?.projectId,
          chatId: ctx?.chatId,
        });
        return {
          ok: true,
          message: `Creato file "${file.name}" (${file.size} char).`,
          store: next,
        };
      }

      case "update_file": {
        const key = args.name || args.id || args.file || "";
        const content = args.content || args.text || args.body;
        if (!key) return { ok: false, message: "Serve name o id." };
        if (content == null) return { ok: false, message: "Serve content." };
        const f = findFile(store, key);
        if (!f) return { ok: false, message: `File non trovato: ${key}` };
        const next: JarvisStore = {
          ...store,
          files: store.files.map((x) =>
            x.id === f.id
              ? { ...x, text: content.slice(0, 500_000), size: content.length, mime: x.mime }
              : x,
          ),
        };
        return {
          ok: true,
          message: `Aggiornato "${f.name}" (${content.length} char).`,
          store: next,
        };
      }

      case "generate_csv_report": {
        const filename = (args.filename || args.name || "report.csv").replace(/[^\w.\-]+/g, "_");
        const headers = (args.headers || "Col1|Col2")
          .split("|")
          .map((h) => h.trim())
          .filter(Boolean);
        const rowStr = args.rows || args.data || "";
        const rows = rowStr
          .split("||")
          .map((r) => r.split(";").map((c) => c.trim()))
          .filter((r) => r.some((c) => c.length > 0));

        const escape = (c: string) => {
          if (/[",\n]/.test(c)) return `"${c.replace(/"/g, '""')}"`;
          return c;
        };
        const lines = [headers.map(escape).join(",")];
        for (const r of rows) {
          const padded = headers.map((_, i) => escape(r[i] ?? ""));
          lines.push(padded.join(","));
        }
        const body = lines.join("\n");
        const { store: next, file } = addTextFile(store, {
          name: filename.endsWith(".csv") ? filename : `${filename}.csv`,
          text: body,
          mime: "text/csv",
          projectId: ctx?.projectId,
          chatId: ctx?.chatId,
        });
        return {
          ok: true,
          message: `Report CSV "${file.name}" creato (${rows.length} righe).`,
          store: next,
          download: { filename: file.name, mime: "text/csv", body },
        };
      }

      default:
        return { ok: false, message: `Tool sconosciuto: ${tool}` };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Esegue step locali in sequenza. Gli step mcp_call restano pending (li gestisce il hook). */
export function executePlan(
  store: JarvisStore,
  plan: JarvisPlan,
  ctx?: { projectId?: string | null; chatId?: string | null },
  onStep?: (step: JarvisPlanStep, index: number) => void,
  mcpRunner?: (step: JarvisPlanStep) => Promise<ToolRunResult>,
): {
  store: JarvisStore;
  plan: JarvisPlan;
  downloads: NonNullable<ToolRunResult["download"]>[];
  /** true se c'erano mcp_call e mcpRunner non era fornito */
  needsAsyncMcp: boolean;
} {
  let s = store;
  const steps = plan.steps.map((st) => ({ ...st }));
  const downloads: NonNullable<ToolRunResult["download"]>[] = [];
  let needsAsyncMcp = false;

  // Nota: executePlan sync non aspetta mcpRunner async — il hook usa executePlanAsync
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].tool === "mcp_call") {
      needsAsyncMcp = true;
      steps[i] = { ...steps[i], status: "pending", result: "In attesa MCP…" };
      onStep?.(steps[i], i);
      continue;
    }
    steps[i] = { ...steps[i], status: "running" };
    onStep?.(steps[i], i);
    const res = runJarvisTool(s, steps[i].tool, steps[i].args, ctx);
    if (res.store) s = res.store;
    if (res.download) downloads.push(res.download);
    steps[i] = {
      ...steps[i],
      status: res.ok ? "done" : "error",
      result: res.message,
    };
    onStep?.(steps[i], i);
  }

  void mcpRunner;

  return {
    store: s,
    plan: { ...plan, steps },
    downloads,
    needsAsyncMcp,
  };
}

/** Esecuzione completa inclusi mcp_call (async). */
export async function executePlanAsync(
  store: JarvisStore,
  plan: JarvisPlan,
  ctx: { projectId?: string | null; chatId?: string | null } | undefined,
  mcpCall: (args: {
    serverId: string;
    name: string;
    arguments: Record<string, unknown>;
    approved: boolean;
  }) => Promise<{ ok: boolean; text: string }>,
): Promise<{ store: JarvisStore; plan: JarvisPlan; downloads: NonNullable<ToolRunResult["download"]>[] }> {
  let s = store;
  const steps = plan.steps.map((st) => ({ ...st }));
  const downloads: NonNullable<ToolRunResult["download"]>[] = [];

  for (let i = 0; i < steps.length; i++) {
    steps[i] = { ...steps[i], status: "running" };
    if (steps[i].tool === "mcp_call") {
      const serverId = steps[i].args.server || steps[i].args.serverid || "github";
      const name = steps[i].args.name || steps[i].args.tool_name || "";
      let argumentsObj: Record<string, unknown> = {};
      const raw = steps[i].args.args_json || steps[i].args.arguments || steps[i].args.args || "{}";
      try {
        argumentsObj = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        argumentsObj = {};
      }
      // copia altri args stringa non riservati
      for (const [k, v] of Object.entries(steps[i].args)) {
        if (["server", "serverid", "name", "tool_name", "args_json", "arguments", "args"].includes(k))
          continue;
        if (!(k in argumentsObj)) argumentsObj[k] = v;
      }
      if (!name) {
        steps[i] = { ...steps[i], status: "error", result: "mcp_call senza name" };
        continue;
      }
      const res = await mcpCall({
        serverId,
        name,
        arguments: argumentsObj,
        approved: true, // già confermato dall'UI
      });
      steps[i] = {
        ...steps[i],
        status: res.ok ? "done" : "error",
        result: res.text.slice(0, 2000),
      };
      continue;
    }
    const res = runJarvisTool(s, steps[i].tool, steps[i].args, ctx);
    if (res.store) s = res.store;
    if (res.download) downloads.push(res.download);
    steps[i] = {
      ...steps[i],
      status: res.ok ? "done" : "error",
      result: res.message,
    };
  }

  return { store: s, plan: { ...plan, steps }, downloads };
}

export function formatPlanForChat(plan: JarvisPlan): string {
  const lines = [
    `**Piano: ${plan.goal}**`,
    plan.needsConfirm ? "_In attesa di conferma_" : "_Esecuzione automatica_",
    "",
    ...plan.steps.map((s, i) => {
      const icon =
        s.status === "done"
          ? "✅"
          : s.status === "error"
            ? "❌"
            : s.status === "running"
              ? "⏳"
              : "○";
      const tail = s.result ? `\n   → ${s.result.slice(0, 400)}` : "";
      return `${icon} **${i + 1}.** [${s.tool}] ${s.description}${tail}`;
    }),
  ];
  return lines.join("\n");
}

/** Heuristica: messaggio che probabilmente vuole multi-step / file / report / github. */
export function shouldPreferAgentMode(text: string): boolean {
  const q = text.toLowerCase();
  const keys = [
    "piano",
    "organizza",
    "riordina",
    "rinomina",
    "archivia",
    "estrai",
    "report",
    "excel",
    "csv",
    "foglio",
    "tabella",
    "fattur",
    "scontrin",
    "document",
    "crea file",
    "genera",
    "analizza i file",
    "cerca nei file",
    "riassumi i file",
    "github",
    "pull request",
    "issue",
    "repository",
    "repo ",
  ];
  return keys.some((k) => q.includes(k));
}

export const JARVIS_GITHUB_PAT_KEY = "jarvis.mcp.github.pat";

export function loadGithubPat(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(JARVIS_GITHUB_PAT_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function saveGithubPat(token: string) {
  if (typeof window === "undefined") return;
  try {
    if (token.trim()) window.localStorage.setItem(JARVIS_GITHUB_PAT_KEY, token.trim());
    else window.localStorage.removeItem(JARVIS_GITHUB_PAT_KEY);
  } catch {
    /* ignore */
  }
}
