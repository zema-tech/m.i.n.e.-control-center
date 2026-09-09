export type PluginSource = "builtin" | "manual" | "github" | "jarvis";

export type JarvisPlugin = {
  id: string;
  name: string;
  description: string;
  source: PluginSource;
  enabled: boolean;
  capabilities: string[];
  repository?: string;
  installedAt: number;
};

const KEY = "omnicore.jarvis.plugins.v1";

const DEFAULT_PLUGINS: JarvisPlugin[] = [
  {
    id: "plugin:workspace-kit",
    name: "Workspace Kit",
    description: "Skill, comandi e strumenti locali per organizzare i progetti di JARVIS.",
    source: "builtin",
    enabled: true,
    capabilities: ["3 skill", "2 comandi", "1 agente"],
    installedAt: 0,
  },
  {
    id: "plugin:server-operations",
    name: "Server Operations",
    description: "Playbook e connettori per health check, backup e operazioni sugli host.",
    source: "builtin",
    enabled: true,
    capabilities: ["2 skill", "4 connettori", "1 hook"],
    installedAt: 0,
  },
];

function canUseStorage() {
  return typeof window !== "undefined";
}

function createId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return `plugin:${slug || Date.now().toString(36)}:${Date.now().toString(36)}`;
}

function persist(plugins: JarvisPlugin[]) {
  if (canUseStorage()) window.localStorage.setItem(KEY, JSON.stringify(plugins));
  return plugins;
}

export function loadJarvisPlugins(): JarvisPlugin[] {
  if (!canUseStorage()) return DEFAULT_PLUGINS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return persist(DEFAULT_PLUGINS);
    const parsed = JSON.parse(raw) as JarvisPlugin[];
    return Array.isArray(parsed) ? parsed : persist(DEFAULT_PLUGINS);
  } catch {
    return DEFAULT_PLUGINS;
  }
}

export function addJarvisPlugin(input: {
  name: string;
  description: string;
  source: Exclude<PluginSource, "builtin">;
  capabilities?: string[];
  repository?: string;
}): JarvisPlugin {
  const plugin: JarvisPlugin = {
    id: createId(input.name),
    name: input.name.trim().slice(0, 64),
    description: input.description.trim().slice(0, 240),
    source: input.source,
    enabled: true,
    capabilities: (input.capabilities ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8),
    repository: input.repository,
    installedAt: Date.now(),
  };
  persist([plugin, ...loadJarvisPlugins()]);
  return plugin;
}

export function setJarvisPluginEnabled(id: string, enabled: boolean) {
  return persist(
    loadJarvisPlugins().map((plugin) => (plugin.id === id ? { ...plugin, enabled } : plugin)),
  );
}

export function removeJarvisPlugin(id: string) {
  return persist(loadJarvisPlugins().filter((plugin) => plugin.id !== id));
}

export function parseGitHubRepository(value: string): {
  ok: boolean;
  url?: string;
  name?: string;
  error?: string;
} {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
      return { ok: false, error: "Inserisci un URL https://github.com/owner/repository." };
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return { ok: false, error: "Il repository GitHub deve includere owner e nome." };
    }
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) return { ok: false, error: "Repository GitHub non valido." };
    return {
      ok: true,
      url: `https://github.com/${owner}/${repo}`,
      name: repo.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    };
  } catch {
    return { ok: false, error: "URL GitHub non valido." };
  }
}

export const JARVIS_COMPOSER_KEY = "omnicore.jarvis.composer.v1";

export function handoffToJarvis(kind: "skill" | "plugin", request: string) {
  if (!canUseStorage()) return;
  const prompt =
    kind === "skill"
      ? `Aiutami a creare una Skill riutilizzabile per questo obiettivo: ${request}. Fammi le domande necessarie, poi proponila in draft con nome, descrizione e contenuto SKILL.md.`
      : `Aiutami a progettare un Plugin JARVIS per questo obiettivo: ${request}. Definisci nome, descrizione, skill, comandi, agenti, hook e connettori necessari. Procedi un passo alla volta.`;
  window.localStorage.setItem(JARVIS_COMPOSER_KEY, prompt);
}
