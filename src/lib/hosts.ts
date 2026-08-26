/**
 * Profili host multipli per M.I.N.E.
 * Minecraft panels + cloud app hosts (Koyeb, Railway, Render, Fly…).
 * Nome host + API (key, base URL, server id) — preset di default o custom.
 */

export type HostProviderId =
  | "falix"
  | "bloom"
  | "apex"
  | "bisect"
  | "shockbyte"
  | "akliz"
  | "pterodactyl"
  | "pelican"
  | "mcsmanager"
  | "exaroton"
  | "aternos"
  | "selfhosted"
  | "koyeb"
  | "railway"
  | "render"
  | "fly"
  | "vercel"
  | "digitalocean"
  | "coolify"
  | "generic";

export type HostProfile = {
  id: string;
  label: string;
  provider: HostProviderId;
  address: string;
  /** API key / token panel */
  apiKey: string;
  /** Server / instance id sul panel */
  serverId: string;
  /** Base URL API (opzionale) */
  baseUrl: string;
  notes: string;
  primary: boolean;
  createdAt: number;
};

export const HOST_PROVIDERS: {
  id: HostProviderId;
  label: string;
  blurb: string;
  falixLike: boolean;
  apiReady: boolean;
  category: "premium" | "budget" | "free" | "panel" | "cloud" | "other";
  /** Suggerimento campi API */
  apiHint: string;
  defaultBase?: string;
}[] = [
  {
    id: "falix",
    label: "FalixNodes",
    blurb: "API power, console, metriche — integrazione nativa M.I.N.E (Minecraft)",
    falixLike: true,
    apiReady: true,
    category: "premium",
    apiHint: "API Key + Server ID dal pannello Falix",
    defaultBase: "https://api.falixnodes.net",
  },
  {
    id: "koyeb",
    label: "Koyeb",
    blurb: "Cloud app / container — deploy API e worker globali",
    falixLike: false,
    apiReady: true,
    category: "cloud",
    apiHint: "API token Koyeb + App / Service ID",
    defaultBase: "https://app.koyeb.com/v1",
  },
  {
    id: "railway",
    label: "Railway",
    blurb: "Deploy app e DB con API GraphQL / token account",
    falixLike: false,
    apiReady: true,
    category: "cloud",
    apiHint: "Railway API token + Project / Service ID",
    defaultBase: "https://backboard.railway.app/graphql/v2",
  },
  {
    id: "render",
    label: "Render",
    blurb: "Web services, workers e cron — API REST",
    falixLike: false,
    apiReady: true,
    category: "cloud",
    apiHint: "API Key Render + Service ID",
    defaultBase: "https://api.render.com/v1",
  },
  {
    id: "fly",
    label: "Fly.io",
    blurb: "App globali edge — Machines API",
    falixLike: false,
    apiReady: true,
    category: "cloud",
    apiHint: "Fly API token + App name",
    defaultBase: "https://api.machines.dev/v1",
  },
  {
    id: "vercel",
    label: "Vercel",
    blurb: "Frontend / serverless — deploy e env via API",
    falixLike: false,
    apiReady: true,
    category: "cloud",
    apiHint: "Vercel token + Project / Team ID",
    defaultBase: "https://api.vercel.com",
  },
  {
    id: "digitalocean",
    label: "DigitalOcean",
    blurb: "Droplet, App Platform, Kubernetes",
    falixLike: false,
    apiReady: true,
    category: "cloud",
    apiHint: "Personal Access Token + resource ID",
    defaultBase: "https://api.digitalocean.com/v2",
  },
  {
    id: "coolify",
    label: "Coolify",
    blurb: "Self-host PaaS (alternativa open a Heroku/Vercel)",
    falixLike: false,
    apiReady: true,
    category: "cloud",
    apiHint: "Coolify API token + base URL della tua istanza",
  },
  {
    id: "pterodactyl",
    label: "Pterodactyl",
    blurb: "Panel open-source usato da molti host game",
    falixLike: true,
    apiReady: true,
    category: "panel",
    apiHint: "Application/Client API key + Server identifier",
  },
  {
    id: "pelican",
    label: "Pelican",
    blurb: "Fork moderno di Pterodactyl",
    falixLike: true,
    apiReady: true,
    category: "panel",
    apiHint: "API key panel + Server ID",
  },
  {
    id: "mcsmanager",
    label: "MCSManager",
    blurb: "Panel free multi-machine + API HTTP",
    falixLike: true,
    apiReady: true,
    category: "panel",
    apiHint: "API key MCSManager + daemon/instance",
  },
  {
    id: "bloom",
    label: "Bloom Host",
    blurb: "Ryzen, panel moderno — simile a Falix",
    falixLike: true,
    apiReady: false,
    category: "premium",
    apiHint: "Se il panel espone API, inserisci key + base URL",
  },
  {
    id: "apex",
    label: "Apex Hosting",
    blurb: "Premium + modpack; spesso Pterodactyl",
    falixLike: true,
    apiReady: false,
    category: "premium",
    apiHint: "Spesso via API Pterodactyl del panel",
  },
  {
    id: "bisect",
    label: "BisectHosting",
    blurb: "1000+ modpack one-click",
    falixLike: true,
    apiReady: false,
    category: "premium",
    apiHint: "API panel se disponibile",
  },
  {
    id: "shockbyte",
    label: "Shockbyte",
    blurb: "Hosting MC popolare, panel completo",
    falixLike: true,
    apiReady: false,
    category: "budget",
    apiHint: "API panel se disponibile",
  },
  {
    id: "akliz",
    label: "Akliz",
    blurb: "Modded-first, multi-server",
    falixLike: true,
    apiReady: false,
    category: "premium",
    apiHint: "API panel se disponibile",
  },
  {
    id: "exaroton",
    label: "Exaroton",
    blurb: "Pay-as-you-go (team Aternos)",
    falixLike: true,
    apiReady: false,
    category: "budget",
    apiHint: "Token account Exaroton se usi API",
  },
  {
    id: "aternos",
    label: "Aternos",
    blurb: "Gratuito — coda avvio, no API pubblica stabile",
    falixLike: false,
    apiReady: false,
    category: "free",
    apiHint: "Nessuna API ufficiale — solo profilo / IP",
  },
  {
    id: "selfhosted",
    label: "Self-hosted / VPS",
    blurb: "Docker, RCON, IP pubblico, panel custom",
    falixLike: false,
    apiReady: false,
    category: "other",
    apiHint: "Base URL del tuo panel o RCON (note)",
  },
  {
    id: "generic",
    label: "Altro host / app",
    blurb: "Qualsiasi provider — nome + API custom",
    falixLike: false,
    apiReady: false,
    category: "other",
    apiHint: "Inserisci nome, API key e base URL a piacere",
  },
];

const KEY = "mine.hosts.v1";
const SEEDED_KEY = "mine.hosts.seeded.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

function normalize(h: Partial<HostProfile> & { id: string; label: string }): HostProfile {
  return {
    id: h.id,
    label: h.label,
    provider: (h.provider as HostProviderId) || "generic",
    address: h.address ?? "",
    apiKey: h.apiKey ?? "",
    serverId: h.serverId ?? "",
    baseUrl: h.baseUrl ?? "",
    notes: h.notes ?? "",
    primary: Boolean(h.primary),
    createdAt: h.createdAt ?? Date.now(),
  };
}

export function loadHosts(): HostProfile[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<HostProfile>[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((h) =>
      normalize({
        id: h.id || `host:${Math.random().toString(36).slice(2)}`,
        label: h.label || "Host",
        ...h,
      }),
    );
  } catch {
    return [];
  }
}

export function saveHosts(list: HostProfile[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

/** Seed: profilo Falix vuoto pronto da compilare. */
export function ensureDefaultHosts(): HostProfile[] {
  if (!canUseStorage()) return [];
  const existing = loadHosts();
  try {
    if (window.localStorage.getItem(SEEDED_KEY) === "1") return existing;
  } catch {
    /* ignore */
  }
  if (existing.length > 0) {
    try {
      window.localStorage.setItem(SEEDED_KEY, "1");
    } catch {
      /* ignore */
    }
    return existing;
  }
  const falix = HOST_PROVIDERS.find((p) => p.id === "falix")!;
  const seed: HostProfile = {
    id: "host:default:falix",
    label: "FalixNodes",
    provider: "falix",
    address: "",
    apiKey: "",
    serverId: "",
    baseUrl: falix.defaultBase ?? "",
    notes: falix.apiHint,
    primary: true,
    createdAt: Date.now(),
  };
  saveHosts([seed]);
  try {
    window.localStorage.setItem(SEEDED_KEY, "1");
  } catch {
    /* ignore */
  }
  return [seed];
}

export function addHost(input: {
  label: string;
  provider: HostProviderId;
  address?: string;
  apiKey?: string;
  serverId?: string;
  baseUrl?: string;
  notes?: string;
  primary?: boolean;
}): HostProfile {
  let list = loadHosts();
  const def = HOST_PROVIDERS.find((p) => p.id === input.provider);
  const profile: HostProfile = {
    id: `host:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: input.label.trim().slice(0, 48) || def?.label || "Nuovo host",
    provider: input.provider,
    address: (input.address ?? "").trim().slice(0, 120),
    apiKey: (input.apiKey ?? "").trim().slice(0, 500),
    serverId: (input.serverId ?? "").trim().slice(0, 120),
    baseUrl: (input.baseUrl ?? def?.defaultBase ?? "").trim().slice(0, 300),
    notes: (input.notes ?? def?.apiHint ?? "").trim().slice(0, 200),
    primary: Boolean(input.primary) || list.length === 0,
    createdAt: Date.now(),
  };
  if (profile.primary) {
    list = list.map((h) => ({ ...h, primary: false }));
  }
  list = [profile, ...list];
  saveHosts(list);
  return profile;
}

export function updateHost(id: string, patch: Partial<HostProfile>): HostProfile[] {
  let list = loadHosts().map((h) => (h.id === id ? normalize({ ...h, ...patch, id: h.id }) : h));
  if (patch.primary) {
    list = list.map((h) => ({ ...h, primary: h.id === id }));
  }
  saveHosts(list);
  return list;
}

export function removeHost(id: string): HostProfile[] {
  let next = loadHosts().filter((h) => h.id !== id);
  if (next.length && !next.some((h) => h.primary)) {
    next = next.map((h, i) => ({ ...h, primary: i === 0 }));
  }
  saveHosts(next);
  return next;
}

export function setPrimaryHost(id: string): HostProfile[] {
  const next = loadHosts().map((h) => ({ ...h, primary: h.id === id }));
  saveHosts(next);
  return next;
}

export function getPrimaryHost(): HostProfile | null {
  const list = loadHosts();
  return list.find((h) => h.primary) ?? list[0] ?? null;
}

export function providerLabel(id: HostProviderId): string {
  return HOST_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

export function hostsByCategory() {
  const groups: Record<string, typeof HOST_PROVIDERS> = {
    cloud: [],
    premium: [],
    budget: [],
    free: [],
    panel: [],
    other: [],
  };
  for (const p of HOST_PROVIDERS) {
    groups[p.category]!.push(p);
  }
  return groups;
}

export function maskKey(key: string) {
  if (!key) return "—";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
