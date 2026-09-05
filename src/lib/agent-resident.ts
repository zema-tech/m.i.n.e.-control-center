/**
 * JARVIS residente — policy e contesto unificato.
 *
 * "Vivere al posto tuo sul server" = sessione continua di osservazione +
 * skill + memoria, con mani (Falix file/console, One MCP apps).
 * Write/critical sempre dietro conferma umana.
 */

import {
  buildBrainContextForPrompt,
  memoryTool,
  type MemoryTarget,
} from "./agent-brain";
import {
  formatPatternsForPrompt,
  observePattern,
  patternsReadyToPromote,
} from "./agent-patterns";
import {
  formatSkillsCatalogForPrompt,
  loadSkillBody,
  proposeOrCreateSkill,
  type ProposeSkillInput,
} from "./agent-skills";

export const RESIDENT_POLICY = `
### Mandato agente residente
Sei JARVIS: non sei una chat usa-e-getta. Operi come presenza sul Control Center / server dell'utente.

Obiettivi:
1. **Osservare** pattern (orari, comandi ricorrenti, preferenze) e registrarli.
2. **Ricordare** via MEMORY (lezioni ambiente) e USER (preferenze stabili).
3. **Creare skill** quando una procedura si ripete — prima in draft, attiva solo con OK umano.
4. **Agire** con tool: lettura file/log, console host, app via One MCP — **write/critical solo dopo conferma**.

Regole inviolabili:
- Non inventare output di tool non eseguiti.
- Non esporre secret.
- Preferisci read → piano → conferma → write.
- Se puoi diventare una skill riusabile, proponila invece di ripetere gli stessi passi a mano ogni volta.
`.trim();

/** System context completo per chat / Discord / gateway. */
export function buildResidentSystemContext(): string {
  return [
    buildBrainContextForPrompt(),
    "",
    RESIDENT_POLICY,
    "",
    formatSkillsCatalogForPrompt(),
    "",
    formatPatternsForPrompt(),
  ].join("\n");
}

/** Tool-facing API usata dalla chat quando l'agente emette azioni strutturate. */
export const residentTools = {
  observe_pattern(key: string, label: string, detail?: string) {
    return observePattern({ key, label, detail });
  },

  memory_add(target: MemoryTarget, content: string) {
    return memoryTool({ action: "add", target, content });
  },

  memory_replace(target: MemoryTarget, old_text: string, content: string) {
    return memoryTool({ action: "replace", target, old_text, content });
  },

  memory_remove(target: MemoryTarget, old_text: string) {
    return memoryTool({ action: "remove", target, old_text });
  },

  propose_skill(input: ProposeSkillInput) {
    return proposeOrCreateSkill({ ...input, source: input.source ?? "agent" });
  },

  load_skill(name: string) {
    const body = loadSkillBody(name);
    return body
      ? { ok: true as const, body }
      : { ok: false as const, error: `Skill "${name}" non trovata o non attiva` };
  },

  promotion_candidates(minCount = 3) {
    return patternsReadyToPromote(minCount);
  },
};

export type ResidentToolName = keyof typeof residentTools;
