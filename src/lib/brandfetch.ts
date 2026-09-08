/**
 * Brandfetch Logo API — CDN hotlink per loghi brand (connettori / One).
 * Docs: https://docs.brandfetch.com/logo-api/overview
 *
 * Client ID gratuito: https://developers.brandfetch.com/register
 * Env: VITE_BRANDFETCH_CLIENT_ID (esposto al client; è un client ID pubblico, non un secret).
 */

export type BrandLogoTheme = "light" | "dark";
export type BrandLogoType = "icon" | "logo" | "symbol";
export type BrandLogoFallback = "lettermark" | "brandfetch" | "transparent" | "404";

/** Domini noti per id catalogo (native + One slug + MCP ufficiali). */
const DOMAIN_BY_ID: Record<string, string> = {
  // Native M.I.N.E
  "one-mcp": "withone.ai",
  mega: "mega.io",
  gdrive: "google.com",
  "falix-mcp": "falixnodes.net",
  koyeb: "koyeb.com",
  railway: "railway.app",
  render: "render.com",
  fly: "fly.io",
  "connector-mcp": "modelcontextprotocol.io",
  "discord-native": "discord.com",
  "webhook-generic": "webhook.site",
  "host-research": "falixnodes.net",
  groq: "groq.com",
  // MCP ufficiali (opzione A)
  "github-mcp": "github.com",
  "mcp-filesystem": "modelcontextprotocol.io",
  "mcp-fetch": "modelcontextprotocol.io",
  "mcp-git": "modelcontextprotocol.io",
  "mcp-memory": "modelcontextprotocol.io",
  "mcp-sequential-thinking": "modelcontextprotocol.io",
  "mcp-time": "modelcontextprotocol.io",
  "mcp-everything": "modelcontextprotocol.io",
  // One platforms
  gmail: "gmail.com",
  outlook: "microsoft.com",
  sendgrid: "sendgrid.com",
  mailchimp: "mailchimp.com",
  slack: "slack.com",
  "microsoft-teams": "microsoft.com",
  discord: "discord.com",
  whatsapp: "whatsapp.com",
  telegram: "telegram.org",
  zoom: "zoom.us",
  "google-meet": "meet.google.com",
  notion: "notion.so",
  asana: "asana.com",
  linear: "linear.app",
  jira: "atlassian.com",
  trello: "trello.com",
  clickup: "clickup.com",
  monday: "monday.com",
  airtable: "airtable.com",
  calendly: "calendly.com",
  "google-calendar": "calendar.google.com",
  hubspot: "hubspot.com",
  salesforce: "salesforce.com",
  github: "github.com",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
  stripe: "stripe.com",
  paypal: "paypal.com",
  square: "squareup.com",
  plaid: "plaid.com",
  brex: "brex.com",
  quickbooks: "intuit.com",
  xero: "xero.com",
  netsuite: "netsuite.com",
  shopify: "shopify.com",
  "google-drive": "drive.google.com",
  dropbox: "dropbox.com",
  onedrive: "onedrive.live.com",
  box: "box.com",
  "aws-s3": "aws.amazon.com",
  postgresql: "postgresql.org",
  mysql: "mysql.com",
  mongodb: "mongodb.com",
  snowflake: "snowflake.com",
  bigquery: "cloud.google.com",
  supabase: "supabase.com",
  firebase: "firebase.google.com",
  zendesk: "zendesk.com",
  intercom: "intercom.com",
  freshdesk: "freshdesk.com",
  twilio: "twilio.com",
  segment: "segment.com",
  amplitude: "amplitude.com",
  mixpanel: "mixpanel.com",
  "google-analytics": "analytics.google.com",
  datadog: "datadoghq.com",
  pagerduty: "pagerduty.com",
  linkedin: "linkedin.com",
  twitter: "x.com",
  instagram: "instagram.com",
  facebook: "facebook.com",
  youtube: "youtube.com",
  tiktok: "tiktok.com",
  docusign: "docusign.com",
  pandadoc: "pandadoc.com",
  gusto: "gusto.com",
  rippling: "rippling.com",
  workday: "workday.com",
  figma: "figma.com",
  canva: "canva.com",
};

/** Client ID pubblico Brandfetch (Logo API). */
export function getBrandfetchClientId(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const fromVite = env?.["VITE_BRANDFETCH_CLIENT_ID"]?.trim();
    if (fromVite) return fromVite;
  } catch {
    /* ignore */
  }
  // Opzionale: override runtime in localStorage per test senza redeploy
  if (typeof window !== "undefined") {
    try {
      const local = window.localStorage.getItem("omnicore.brandfetch.clientId")?.trim();
      if (local) return local;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function resolveBrandDomain(input: {
  id?: string;
  domain?: string;
  label?: string;
}): string | null {
  if (input.domain?.trim()) return input.domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!;

  const rawId = (input.id || "").replace(/^one:/, "").replace(/^conn:default:/, "");
  if (rawId && DOMAIN_BY_ID[rawId]) return DOMAIN_BY_ID[rawId];

  // Heuristica leggera sul label (es. "Google Drive" → non affidabile; solo se match mappa inversa)
  const label = (input.label || "").toLowerCase();
  for (const [id, domain] of Object.entries(DOMAIN_BY_ID)) {
    if (label.includes(id.replace(/-/g, " ")) || label.includes(id)) return domain;
  }
  return null;
}

export type BrandLogoUrlOpts = {
  domain: string;
  w?: number;
  h?: number;
  theme?: BrandLogoTheme;
  type?: BrandLogoType;
  fallback?: BrandLogoFallback;
  clientId?: string;
};

/** Costruisce URL CDN Brandfetch. Senza clientId restituisce null. */
export function brandLogoUrl(opts: BrandLogoUrlOpts): string | null {
  const clientId = (opts.clientId ?? getBrandfetchClientId()).trim();
  if (!clientId) return null;

  const domain = opts.domain.replace(/^https?:\/\//, "").split("/")[0]!;
  const w = opts.w ?? 64;
  const h = opts.h ?? 64;
  const theme = opts.theme ?? "dark";
  const type = opts.type ?? "icon";
  const fallback = opts.fallback ?? "lettermark";

  const path = [
    "https://cdn.brandfetch.io",
    "domain",
    encodeURIComponent(domain),
    "w",
    String(w),
    "h",
    String(h),
    "theme",
    theme,
    "fallback",
    fallback,
    "type",
    type,
  ].join("/");

  return `${path}?c=${encodeURIComponent(clientId)}`;
}

/** URL logo da id catalogo connettore / piattaforma One. */
export function connectorBrandLogoUrl(
  connectorId: string,
  opts?: Omit<BrandLogoUrlOpts, "domain"> & { label?: string },
): string | null {
  const domain = resolveBrandDomain({ id: connectorId, label: opts?.label });
  if (!domain) return null;
  return brandLogoUrl({ domain, ...opts });
}

/** Iniziali per lettermark locale se Brandfetch non configurato. */
export function brandLettermark(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
