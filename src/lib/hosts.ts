/**
 * Profili host multipli per M.I.N.E.
 * Falix resta l'host con integrazione API più completa;
 * gli altri sono profili panel-style (spesso Pterodactyl) o free-tier.
 */

export type HostProviderId =
  | "falix"
  | "bloom"
  | "apex"
  | "bisect"
  | "shockbyte"
  | "akliz"
  | "flexynode"
  | "meloncube"
  | "craftserve"
  | "minekeep"
  | "exaroton"
  | "aternos"
  | "minehut"
  | "minefort"
  | "pterodactyl"
  | "pelican"
  | "mcsmanager"
  | "amp"
  | "crafty"
  | "selfhosted"
  | "generic";

export type HostProfile = {
  id: string;
  label: string;
  provider: HostProviderId;
  address: string;
  notes: string;
  primary: boolean;
  createdAt: number;
};

export const HOST_PROVIDERS: {
  id: HostProviderId;
  label: string;
  blurb: string;
  /** Simile a Falix: panel completo, power, file, console */
  falixLike: boolean;
  apiReady: boolean;
  category: "premium" | "budget" | "free" | "panel" | "other";
}[] = [
  {
    id: "falix",
    label: "FalixNodes",
    blurb: "API power, console, metriche — integrazione nativa M.I.N.E",
    falixLike: true,
    apiReady: true,
    category: "premium",
  },
  {
    id: "bloom",
    label: "Bloom Host",
    blurb: "Ryzen, panel moderno — simile a Falix",
    falixLike: true,
    apiReady: false,
    category: "premium",
  },
  {
    id: "apex",
    label: "Apex Hosting",
    blurb: "Premium + modpack; spesso Pterodactyl",
    falixLike: true,
    apiReady: false,
    category: "premium",
  },
  {
    id: "bisect",
    label: "BisectHosting",
    blurb: "1000+ modpack one-click",
    falixLike: true,
    apiReady: false,
    category: "premium",
  },
  {
    id: "shockbyte",
    label: "Shockbyte",
    blurb: "Hosting MC popolare, panel completo",
    falixLike: true,
    apiReady: false,
    category: "budget",
  },
  {
    id: "akliz",
    label: "Akliz",
    blurb: "Modded-first, multi-server",
    falixLike: true,
    apiReady: false,
    category: "premium",
  },
  {
    id: "flexynode",
    label: "FlexyNode",
    blurb: "Ryzen 9, NVMe, network-ready",
    falixLike: true,
    apiReady: false,
    category: "premium",
  },
  {
    id: "meloncube",
    label: "MelonCube",
    blurb: "Hardware enterprise, prezzo contenuto",
    falixLike: true,
    apiReady: false,
    category: "budget",
  },
  {
    id: "craftserve",
    label: "CraftServe",
    blurb: "Hosting PL — panel proprietario",
    falixLike: true,
    apiReady: false,
    category: "budget",
  },
  {
    id: "minekeep",
    label: "MineKeep",
    blurb: "Free + paid, panel semplice",
    falixLike: true,
    apiReady: false,
    category: "budget",
  },
  {
    id: "exaroton",
    label: "Exaroton",
    blurb: "Pay-as-you-go (team Aternos)",
    falixLike: true,
    apiReady: false,
    category: "budget",
  },
  {
    id: "aternos",
    label: "Aternos",
    blurb: "Gratuito — coda avvio, no API pubblica",
    falixLike: false,
    apiReady: false,
    category: "free",
  },
  {
    id: "minehut",
    label: "Minehut",
    blurb: "Network + external servers",
    falixLike: false,
    apiReady: false,
    category: "free",
  },
  {
    id: "minefort",
    label: "Minefort",
    blurb: "Free 24/7, slot illimitati",
    falixLike: false,
    apiReady: false,
    category: "free",
  },
  {
    id: "pterodactyl",
    label: "Pterodactyl",
    blurb: "Panel open-source usato da molti host",
    falixLike: true,
    apiReady: false,
    category: "panel",
  },
  {
    id: "pelican",
    label: "Pelican",
    blurb: "Fork moderno di Pterodactyl",
    falixLike: true,
    apiReady: false,
    category: "panel",
  },
  {
    id: "mcsmanager",
    label: "MCSManager",
    blurb: "Panel free multi-machine + API HTTP",
    falixLike: true,
    apiReady: false,
    category: "panel",
  },
  {
    id: "amp",
    label: "AMP (CubeCoders)",
    blurb: "Panel multi-game commerciale",
    falixLike: true,
    apiReady: false,
    category: "panel",
  },
  {
    id: "crafty",
    label: "Crafty Controller",
    blurb: "Panel Python self-hosted",
    falixLike: true,
    apiReady: false,
    category: "panel",
  },
  {
    id: "selfhosted",
    label: "Self-hosted / VPS",
    blurb: "Docker, RCON, IP pubblico",
    falixLike: false,
    apiReady: false,
    category: "other",
  },
  {
    id: "generic",
    label: "Altro host",
    blurb: "Qualsiasi provider — monitor via IP",
    falixLike: false,
    apiReady: false,
    category: "other",
  },
];

const KEY = "mine.hosts.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadHosts(): HostProfile[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as HostProfile[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHosts(list: HostProfile[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function addHost(input: {
  label: string;
  provider: HostProviderId;
  address?: string;
  notes?: string;
  primary?: boolean;
}): HostProfile {
  let list = loadHosts();
  const profile: HostProfile = {
    id: `host:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: input.label.trim().slice(0, 48) || "Nuovo host",
    provider: input.provider,
    address: (input.address ?? "").trim().slice(0, 120),
    notes: (input.notes ?? "").trim().slice(0, 200),
    primary: Boolean(input.primary),
    createdAt: Date.now(),
  };
  if (profile.primary) {
    list = list.map((h) => ({ ...h, primary: false }));
  }
  list = [profile, ...list];
  saveHosts(list);
  return profile;
}

export function removeHost(id: string): HostProfile[] {
  const next = loadHosts().filter((h) => h.id !== id);
  saveHosts(next);
  return next;
}

export function setPrimaryHost(id: string): HostProfile[] {
  const next = loadHosts().map((h) => ({ ...h, primary: h.id === id }));
  saveHosts(next);
  return next;
}

export function providerLabel(id: HostProviderId): string {
  return HOST_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

export function hostsByCategory() {
  const groups: Record<string, typeof HOST_PROVIDERS> = {
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
