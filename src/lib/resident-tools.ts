/**
 * Tool loop residente — eseguiti nel browser dopo la risposta IA.
 * Safe: solo localStorage (memoria, skill, pattern). Nessuna write host.
 */

import { memoryTool, type MemoryTarget } from "./agent-brain";
import { observePattern, patternsReadyToPromote } from "./agent-patterns";
import {
  loadSkillBody,
  proposeOrCreateSkill,
} from "./agent-skills";

export type ResidentToolId =
  | "observe_pattern"
  | "memory_add"
  | "memory_replace"
  | "memory_remove"
  | "propose_skill"
  | "load_skill"
  | "list_promotions";

export type ResidentCall = {
  tool: ResidentToolId | string;
  params: Record<string, string | number | boolean>;
  motivo?: string;
};

export type ResidentResult = {
  tool: string;
  ok: boolean;
  output: string;
};

const ALLOWED = new Set<string>([
  "observe_pattern",
  "memory_add",
  "memory_replace",
  "memory_remove",
  "propose_skill",
  "load_skill",
  "list_promotions",
]);

export function parseResidentCalls(raw: unknown): ResidentCall[] {
  if (!Array.isArray(raw)) return [];
  const out: ResidentCall[] = [];
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tool = String(row.tool ?? row.id ?? "").trim();
    if (!tool || !ALLOWED.has(tool)) continue;
    const params: Record<string, string | number | boolean> = {};
    const p = row.params;
    if (p && typeof p === "object") {
      for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          params[k] = v;
        } else if (v != null) {
          params[k] = JSON.stringify(v);
        }
      }
    }
    out.push({
      tool,
      params,
      motivo: typeof row.motivo === "string" ? row.motivo : undefined,
    });
  }
  return out;
}

function str(params: Record<string, string | number | boolean>, key: string): string {
  const v = params[key];
  return v == null ? "" : String(v).trim();
}

/** Esegue una lista di tool residenti (solo client). */
export function executeResidentCalls(calls: ResidentCall[]): ResidentResult[] {
  if (typeof window === "undefined") {
    return calls.map((c) => ({
      tool: c.tool,
      ok: false,
      output: "Tool residenti solo nel browser",
    }));
  }

  const results: ResidentResult[] = [];

  for (const call of calls) {
    try {
      const r = runOne(call);
      results.push(r);
    } catch (e) {
      results.push({
        tool: call.tool,
        ok: false,
        output: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}

function runOne(call: ResidentCall): ResidentResult {
  const { tool, params } = call;

  switch (tool) {
    case "observe_pattern": {
      const key = str(params, "key") || str(params, "name");
      const label = str(params, "label") || key;
      if (!key) return { tool, ok: false, output: "serve params.key" };
      const p = observePattern({
        key,
        label,
        detail: str(params, "detail") || undefined,
      });
      return {
        tool,
        ok: true,
        output: `Pattern "${p.label}" ×${p.count}${p.count >= 3 && !p.promoted ? " (candidato promozione)" : ""}`,
      };
    }

    case "memory_add": {
      const target = (str(params, "target") || "memory") as MemoryTarget;
      if (target !== "memory" && target !== "user") {
        return { tool, ok: false, output: "target deve essere memory|user" };
      }
      const content = str(params, "content");
      const res = memoryTool({ action: "add", target, content });
      return {
        tool,
        ok: res.ok,
        output: res.ok
          ? `Memoria ${target} +1 · ${res.usage}`
          : res.error,
      };
    }

    case "memory_replace": {
      const target = (str(params, "target") || "memory") as MemoryTarget;
      const res = memoryTool({
        action: "replace",
        target,
        old_text: str(params, "old_text"),
        content: str(params, "content"),
      });
      return {
        tool,
        ok: res.ok,
        output: res.ok ? `Replace ${target} · ${res.usage}` : res.error,
      };
    }

    case "memory_remove": {
      const target = (str(params, "target") || "memory") as MemoryTarget;
      const res = memoryTool({
        action: "remove",
        target,
        old_text: str(params, "old_text"),
      });
      return {
        tool,
        ok: res.ok,
        output: res.ok ? `Remove ${target} · ${res.usage}` : res.error,
      };
    }

    case "propose_skill": {
      const res = proposeOrCreateSkill({
        name: str(params, "name"),
        description: str(params, "description"),
        body: str(params, "body"),
        activate: params.activate === true || params.activate === "true",
        source: "agent",
        tags: str(params, "tags")
          ? str(params, "tags").split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
      });
      return {
        tool,
        ok: res.ok,
        output: res.message + (res.skill ? ` [${res.skill.status}]` : ""),
      };
    }

    case "load_skill": {
      const name = str(params, "name");
      const body = loadSkillBody(name);
      if (!body) return { tool, ok: false, output: `Skill "${name}" non trovata/attiva` };
      return {
        tool,
        ok: true,
        output: body.slice(0, 2500),
      };
    }

    case "list_promotions": {
      const list = patternsReadyToPromote(3);
      if (list.length === 0) {
        return { tool, ok: true, output: "Nessun pattern ≥3 da promuovere" };
      }
      return {
        tool,
        ok: true,
        output: list.map((p) => `${p.label} ×${p.count}`).join("; "),
      };
    }

    default:
      return { tool, ok: false, output: `Tool sconosciuto: ${tool}` };
  }
}

export const RESIDENT_TOOL_DOCS = `
### Tool RESIDENTI (eseguiti subito nel browser, senza conferma)
Mettili in JSON campo "resident": [{"tool":"...","params":{...},"motivo":"..."}]

- observe_pattern — params: key*, label*, detail?
- memory_add — params: target (memory|user), content*
- memory_replace — params: target, old_text*, content*
- memory_remove — params: target, old_text*
- propose_skill — params: name*, description*, body* (markdown SKILL), activate? (bool, default false=draft)
- load_skill — params: name* (carica corpo skill attiva nel contesto mentale)
- list_promotions — pattern con count≥3 non ancora promossi

Regole:
- Preferenze stabili utente → memory_add target=user
- Lezioni ambiente/server → memory_add target=memory
- Procedura ripetibile → propose_skill (draft)
- NON usare resident per azioni Falix/One (quelle stanno in azioni[] con conferma)
`.trim();
