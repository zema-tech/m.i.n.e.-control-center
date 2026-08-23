/**
 * Profili host multipli per M.I.N.E.
 * Falix resta l'host principale con API completa lato server;
 * gli altri profili sono gestiti in locale (indirizzo pubblico / note / credenziali UI)
 * e compaiono sulla rete neurale come hub alternativi.
 */

export type HostProviderId =
  | "falix"
  | "pterodactyl"
  | "aternos"
  | "minehut"
  | "apex"
  | "bisect"
  | "shockbyte"
  | "exaroton"
  | "generic"
  | "selfhosted";

export type HostProfile = {
  id: string;
  label: string;
  provider: HostProviderId;
  /** Indirizzo pubblico IP:porta o hostname (query mcstatus). */
  address: string;
  /** Note / API base / server id (testo libero, non inviato a terzi). */
  notes: string;
  /** Host attivo per la dashboard (un solo primary). */
  primary: boolean;
  createdAt: number;
};

export const HOST_PROVIDERS: {
  id: HostProviderId;
  label: string;
  blurb: string;
  apiReady: boolean;
}[] = [
  {
    id: "falix",
    label: "FalixNodes",
    blurb: "Host principale — API power, console, metriche",
    apiReady: true,
  },
  {
    id: "pterodactyl",
    label: "Pterodactyl / Pelican",
    blurb: "Panel open-source (Apex e molti host lo usano)",
    apiReady: false,
  },
  {
    id: "aternos",
    label: "Aternos",
    blurb: "Hosting gratuito — stato via indirizzo pubblico",
    apiReady: false,
  },
  {
    id: "minehut",
    label: "Minehut",
    blurb: "Network + server esterni",
    apiReady: false,
  },
  {
    id: "apex",
    label: "Apex Hosting",
    blurb: "Hosting premium (spesso Pterodactyl)",
    apiReady: false,
  },
  {
    id: "bisect",
    label: "BisectHosting",
    blurb: "Modpack one-click",
    apiReady: false,
  },
  {
    id: "shockbyte",
    label: "Shockbyte",
    blurb: "Hosting Minecraft popolare",
    apiReady: false,
  },
  {
    id: "exaroton",
    label: "Exaroton",
    blurb: "Pay-as-you-go (team Aternos)",
    apiReady: false,
  },
  {
    id: "selfhosted",
    label: "Self-hosted / VPS",
    blurb: "Docker, MCSManager, Crafty, RCON",
    apiReady: false,
  },
  {
    id: "generic",
    label: "Altro host",
    blurb: "Qualsiasi provider — monitor via IP pubblico",
    apiReady: false,
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
