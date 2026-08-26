/**
 * Catalogo piattaforme One (withoneai/cli / mcp.withone.ai).
 * One espone 700+ app via 4 tool MCP universali — non serve un connettore
 * nativo per ciascuna. Qui elenchiamo le piattaforme documentate pubblicamente
 * così risultano cercabili in M.I.N.E.; l'elenco completo live arriva da
 * list_one_integrations dopo OAuth su https://mcp.withone.ai/mcp
 */

export type OneCategory =
  | "communication"
  | "email"
  | "productivity"
  | "crm"
  | "dev"
  | "payments"
  | "ecommerce"
  | "storage"
  | "database"
  | "analytics"
  | "support"
  | "marketing"
  | "social"
  | "hr"
  | "design"
  | "infra"
  | "other";

export type OnePlatform = {
  id: string;
  label: string;
  category: OneCategory;
  detail: string;
};

export const ONE_MCP_URL = "https://mcp.withone.ai/mcp";
export const ONE_DOCS_URL = "https://www.withone.ai/docs/mcp";
export const ONE_CLI_REPO = "https://github.com/withoneai/cli";

/** Tool MCP universali One (sempre 4, indipendentemente dal n° di app). */
export const ONE_MCP_TOOL_NAMES = [
  "list_one_integrations",
  "search_one_platform_actions",
  "get_one_action_knowledge",
  "execute_one_action",
] as const;

export const ONE_CATEGORY_LABELS: Record<OneCategory, string> = {
  communication: "Comunicazione",
  email: "Email",
  productivity: "Produttività",
  crm: "CRM & Sales",
  dev: "Dev & Git",
  payments: "Pagamenti",
  ecommerce: "E-commerce",
  storage: "Storage",
  database: "Database",
  analytics: "Analytics",
  support: "Support",
  marketing: "Marketing",
  social: "Social",
  hr: "HR & People",
  design: "Design",
  infra: "Infra & Cloud",
  other: "Altro",
};

/** Piattaforme citate nella documentazione pubblica One (subset curato). */
export const ONE_PLATFORMS: OnePlatform[] = [
  // Email
  { id: "gmail", label: "Gmail", category: "email", detail: "Email Google Workspace" },
  { id: "outlook", label: "Microsoft Outlook", category: "email", detail: "Mail e calendario Microsoft 365" },
  { id: "sendgrid", label: "SendGrid", category: "email", detail: "Email transazionale" },
  { id: "mailchimp", label: "Mailchimp", category: "marketing", detail: "Email marketing" },
  // Communication
  { id: "slack", label: "Slack", category: "communication", detail: "Messaggi e canali team" },
  { id: "microsoft-teams", label: "Microsoft Teams", category: "communication", detail: "Chat e meeting enterprise" },
  { id: "discord", label: "Discord", category: "communication", detail: "Community e bot" },
  { id: "whatsapp", label: "WhatsApp", category: "communication", detail: "Messaggistica business" },
  { id: "telegram", label: "Telegram", category: "communication", detail: "Bot e canali" },
  { id: "zoom", label: "Zoom", category: "communication", detail: "Video meeting" },
  { id: "google-meet", label: "Google Meet", category: "communication", detail: "Video call Google" },
  // Productivity
  { id: "notion", label: "Notion", category: "productivity", detail: "Docs e database" },
  { id: "asana", label: "Asana", category: "productivity", detail: "Task e progetti" },
  { id: "linear", label: "Linear", category: "dev", detail: "Issue tracking product" },
  { id: "jira", label: "Jira", category: "dev", detail: "Issue tracking Atlassian" },
  { id: "trello", label: "Trello", category: "productivity", detail: "Board Kanban" },
  { id: "clickup", label: "ClickUp", category: "productivity", detail: "Work OS" },
  { id: "monday", label: "Monday.com", category: "productivity", detail: "Work management" },
  { id: "airtable", label: "Airtable", category: "productivity", detail: "Spreadsheet-database" },
  { id: "calendly", label: "Calendly", category: "productivity", detail: "Scheduling" },
  { id: "google-calendar", label: "Google Calendar", category: "productivity", detail: "Calendario Google" },
  // CRM
  { id: "hubspot", label: "HubSpot", category: "crm", detail: "CRM e marketing hub" },
  { id: "salesforce", label: "Salesforce", category: "crm", detail: "CRM enterprise" },
  // Dev
  { id: "github", label: "GitHub", category: "dev", detail: "Repo, PR, actions" },
  { id: "gitlab", label: "GitLab", category: "dev", detail: "DevOps Git" },
  { id: "bitbucket", label: "Bitbucket", category: "dev", detail: "Repo Atlassian" },
  // Payments
  { id: "stripe", label: "Stripe", category: "payments", detail: "Pagamenti e abbonamenti" },
  { id: "paypal", label: "PayPal", category: "payments", detail: "Pagamenti online" },
  { id: "square", label: "Square", category: "payments", detail: "POS e pagamenti" },
  { id: "plaid", label: "Plaid", category: "payments", detail: "Open banking" },
  { id: "brex", label: "Brex", category: "payments", detail: "Corporate cards" },
  { id: "quickbooks", label: "QuickBooks", category: "payments", detail: "Contabilità" },
  { id: "xero", label: "Xero", category: "payments", detail: "Contabilità cloud" },
  { id: "netsuite", label: "NetSuite", category: "payments", detail: "ERP Oracle" },
  // E-commerce
  { id: "shopify", label: "Shopify", category: "ecommerce", detail: "Store e-commerce" },
  // Storage
  { id: "google-drive", label: "Google Drive", category: "storage", detail: "File Google" },
  { id: "dropbox", label: "Dropbox", category: "storage", detail: "Cloud file" },
  { id: "onedrive", label: "OneDrive", category: "storage", detail: "Storage Microsoft" },
  { id: "box", label: "Box", category: "storage", detail: "Enterprise content" },
  { id: "aws-s3", label: "AWS S3", category: "storage", detail: "Object storage AWS" },
  // Database
  { id: "postgresql", label: "PostgreSQL", category: "database", detail: "DB relazionale" },
  { id: "mysql", label: "MySQL", category: "database", detail: "DB relazionale" },
  { id: "mongodb", label: "MongoDB", category: "database", detail: "DB document" },
  { id: "snowflake", label: "Snowflake", category: "database", detail: "Data warehouse" },
  { id: "bigquery", label: "BigQuery", category: "database", detail: "Analytics Google Cloud" },
  { id: "supabase", label: "Supabase", category: "database", detail: "Backend Postgres" },
  { id: "firebase", label: "Firebase", category: "database", detail: "Backend Google" },
  // Support
  { id: "zendesk", label: "Zendesk", category: "support", detail: "Helpdesk" },
  { id: "intercom", label: "Intercom", category: "support", detail: "Customer messaging" },
  { id: "freshdesk", label: "Freshdesk", category: "support", detail: "Support tickets" },
  // Marketing / analytics
  { id: "twilio", label: "Twilio", category: "communication", detail: "SMS e voice API" },
  { id: "segment", label: "Segment", category: "analytics", detail: "Customer data" },
  { id: "amplitude", label: "Amplitude", category: "analytics", detail: "Product analytics" },
  { id: "mixpanel", label: "Mixpanel", category: "analytics", detail: "Event analytics" },
  { id: "google-analytics", label: "Google Analytics", category: "analytics", detail: "Web analytics" },
  { id: "datadog", label: "Datadog", category: "infra", detail: "Monitoring" },
  { id: "pagerduty", label: "PagerDuty", category: "infra", detail: "Incident response" },
  // Social
  { id: "linkedin", label: "LinkedIn", category: "social", detail: "Professional network" },
  { id: "twitter", label: "X / Twitter", category: "social", detail: "Social posts" },
  { id: "instagram", label: "Instagram", category: "social", detail: "Meta social" },
  { id: "facebook", label: "Facebook", category: "social", detail: "Meta pages" },
  { id: "youtube", label: "YouTube", category: "social", detail: "Video Google" },
  { id: "tiktok", label: "TikTok", category: "social", detail: "Short video" },
  // HR / docs
  { id: "docusign", label: "DocuSign", category: "hr", detail: "Firme digitali" },
  { id: "pandadoc", label: "PandaDoc", category: "hr", detail: "Documenti e proposte" },
  { id: "gusto", label: "Gusto", category: "hr", detail: "Payroll" },
  { id: "rippling", label: "Rippling", category: "hr", detail: "HRIS" },
  { id: "workday", label: "Workday", category: "hr", detail: "HR enterprise" },
  // Design
  { id: "figma", label: "Figma", category: "design", detail: "Design collaborativo" },
  { id: "canva", label: "Canva", category: "design", detail: "Grafica semplificata" },
];

export function onePlatformsByCategory(): Record<OneCategory, OnePlatform[]> {
  const out = {} as Record<OneCategory, OnePlatform[]>;
  for (const p of ONE_PLATFORMS) {
    if (!out[p.category]) out[p.category] = [];
    out[p.category]!.push(p);
  }
  return out;
}

export function searchOnePlatforms(q: string): OnePlatform[] {
  const s = q.trim().toLowerCase();
  if (!s) return ONE_PLATFORMS;
  return ONE_PLATFORMS.filter(
    (p) =>
      p.id.includes(s) ||
      p.label.toLowerCase().includes(s) ||
      p.detail.toLowerCase().includes(s) ||
      p.category.includes(s),
  );
}
