/**
 * Host Research Agent — pipeline leggera ispirata a multi-agent research.
 * Nodi logici: ProviderScan → ApiDocsProbe → Curator → Briefing (Groq).
 * Nessuna nuova dipendenza: fetch HTTP + GROQ_API_KEY esistente.
 */

import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "./groq-models";
import { HOST_PROVIDERS, type HostProviderId } from "./hosts";
import type { HostResearchReport } from "./host-research.types";

export type { HostResearchReport };

/** Knowledge seed offline (sempre disponibile). */
const SEED: Record<
  string,
  {
    providerId: HostProviderId;
    urls: string[];
    apiAvailable: boolean;
    mcpHint: string;
    baseUrl: string;
    blurb: string;
    pricing: string;
    risk: string;
    fields: string[];
  }
> = {
  falix: {
    providerId: "falix",
    urls: ["https://falixnodes.net", "https://docs.falixnodes.net", "https://api.falixnodes.net"],
    apiAvailable: true,
    mcpHint: "MCP nativo M.I.N.E (falix_* tools). Nessun MCP ufficiale pubblico separato.",
    baseUrl: "https://api.falixnodes.net",
    blurb:
      "FalixNodes: hosting Minecraft con API REST per power, console, file, backup e metriche. Integrazione primaria di M.I.N.E.",
    pricing: "Piani a pagamento; verifica sul sito ufficiale.",
    risk: "Proteggi API key; non esporre token in chat pubbliche.",
    fields: ["apiKey", "serverId", "baseUrl"],
  },
  pterodactyl: {
    providerId: "pterodactyl",
    urls: ["https://pterodactyl.io", "https://dashflo.net/docs/api/"],
    apiAvailable: true,
    mcpHint: "Nessun MCP ufficiale; bridge via Application/Client API (Bearer).",
    baseUrl: "",
    blurb:
      "Pterodactyl: panel open-source. Molti host (Apex, Bisect, …) lo usano sotto il cofano. API Application + Client.",
    pricing: "Panel free; hosting dipende dal provider.",
    risk: "Application API ha privilegi elevati — usa Client API se possibile.",
    fields: ["apiKey", "serverId", "baseUrl"],
  },
  pelican: {
    providerId: "pelican",
    urls: ["https://pelican.dev"],
    apiAvailable: true,
    mcpHint: "Fork Pterodactyl — pattern API API simili; nessun MCP ufficiale M.I.N.E.",
    baseUrl: "",
    blurb: "Pelican: fork moderno di Pterodactyl con API compatibili in larga misura.",
    pricing: "Software free; hosting a parte.",
    risk: "Verifica versione API del tuo panel prima di automazioni write.",
    fields: ["apiKey", "serverId", "baseUrl"],
  },
  mcsmanager: {
    providerId: "mcsmanager",
    urls: ["https://mcsmanager.com", "https://docs.mcsmanager.com"],
    apiAvailable: true,
    mcpHint: "API HTTP documentata; bridge MCP custom possibile, non incluso di default.",
    baseUrl: "",
    blurb: "MCSManager: panel free multi-machine con API HTTP per istanze e daemon.",
    pricing: "Gratuito (self-host).",
    risk: "Esporre il panel su internet richiede TLS e ACL.",
    fields: ["apiKey", "serverId", "baseUrl"],
  },
  aternos: {
    providerId: "aternos",
    urls: ["https://aternos.org"],
    apiAvailable: false,
    mcpHint: "Nessuna API ufficiale stabile. Non automatizzare login web.",
    baseUrl: "",
    blurb:
      "Aternos: hosting gratuito con code di avvio. Ideale solo come profilo/indirizzo, non per controllo API.",
    pricing: "Gratuito con limiti.",
    risk: "Automazione account viola spesso ToS; evita scraping login.",
    fields: ["address", "notes"],
  },
  exaroton: {
    providerId: "exaroton",
    urls: ["https://exaroton.com", "https://developers.exaroton.com"],
    apiAvailable: true,
    mcpHint: "API ufficiale Exaroton (token account). Bridge MCP non nativo in M.I.N.E.",
    baseUrl: "https://api.exaroton.com",
    blurb: "Exaroton (team Aternos): pay-as-you-go con API sviluppatori.",
    pricing: "Pay-as-you-go.",
    risk: "Gestisci token account con attenzione.",
    fields: ["apiKey", "serverId", "baseUrl"],
  },
  bloom: {
    providerId: "bloom",
    urls: ["https://bloom.host"],
    apiAvailable: false,
    mcpHint: "Verifica se il panel espone API/Pterodactyl; altrimenti solo profilo.",
    baseUrl: "",
    blurb: "Bloom Host: hosting premium Ryzen, panel moderno.",
    pricing: "Premium a pagamento.",
    risk: "Senza API pubblica, le azioni live restano su Falix.",
    fields: ["apiKey", "serverId", "baseUrl", "address"],
  },
  apex: {
    providerId: "apex",
    urls: ["https://apexminecrafthosting.com"],
    apiAvailable: false,
    mcpHint: "Spesso panel Pterodactyl — usa provider pterodactyl se hai Client API.",
    baseUrl: "",
    blurb: "Apex Hosting: premium, molti modpack; spesso basato su panel Pterodactyl.",
    pricing: "Premium.",
    risk: "Conferma con il supporto se Client API è abilitata.",
    fields: ["apiKey", "serverId", "baseUrl"],
  },
  bisect: {
    providerId: "bisect",
    urls: ["https://www.bisecthosting.com"],
    apiAvailable: false,
    mcpHint: "Panel proprietario / Pterodactyl a seconda del piano — verifica docs.",
    baseUrl: "",
    blurb: "BisectHosting: ampia libreria modpack one-click.",
    pricing: "A pagamento, vari piani.",
    risk: "API non garantita su tutti i piani.",
    fields: ["apiKey", "serverId", "baseUrl", "address"],
  },
  shockbyte: {
    providerId: "shockbyte",
    urls: ["https://shockbyte.com"],
    apiAvailable: false,
    mcpHint: "Controlla documentazione panel per API; altrimenti profilo manuale.",
    baseUrl: "",
    blurb: "Shockbyte: hosting Minecraft popolare con panel completo.",
    pricing: "Budget / mid-tier.",
    risk: "Azioni live M.I.N.E. solo se API documentata.",
    fields: ["apiKey", "serverId", "baseUrl", "address"],
  },
  akliz: {
    providerId: "akliz",
    urls: ["https://www.akliz.net"],
    apiAvailable: false,
    mcpHint: "Modded-first; verifica API panel se esposta.",
    baseUrl: "",
    blurb: "Akliz: orientato a server moddati e multi-server.",
    pricing: "Premium.",
    risk: "Senza API, solo anagrafica host.",
    fields: ["apiKey", "serverId", "baseUrl", "address"],
  },
  selfhosted: {
    providerId: "selfhosted",
    urls: [],
    apiAvailable: false,
    mcpHint: "RCON, MCSManager, Pterodactyl self-host o script custom.",
    baseUrl: "",
    blurb: "Self-hosted / VPS: Docker, RCON, panel a scelta.",
    pricing: "Costo VPS.",
    risk: "Sicurezza rete e backup a carico tuo.",
    fields: ["baseUrl", "address", "notes"],
  },
};

function resolveSeed(query: string): (typeof SEED)[string] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const [key, seed] of Object.entries(SEED)) {
    if (q === key || q.includes(key)) return seed;
  }
  for (const p of HOST_PROVIDERS) {
    if (q.includes(p.id) || q.includes(p.label.toLowerCase())) {
      return SEED[p.id] ?? null;
    }
  }
  try {
    const u = new URL(q.startsWith("http") ? q : `https://${q}`);
    const host = u.hostname.replace(/^www\./, "");
    for (const seed of Object.values(SEED)) {
      for (const url of seed.urls) {
        try {
          if (new URL(url).hostname.replace(/^www\./, "").includes(host.split(".")[0]!)) {
            return seed;
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function probeUrl(
  url: string,
  timeoutMs = 4500,
): Promise<{ url: string; ok: boolean; snippet: string }> {
  // VibeSec: redirect manuali con rivalidazione a ogni hop (max 3).
  // Un 302 verso http://169.254.169.254 o 127.0.0.1 non viene mai seguito.
  let current = url;
  let res: Response | null = null;
  try {
    const { assertPublicHttpsUrl } = await import("./ssrf-guard");
    for (let hop = 0; hop <= 3; hop++) {
      assertPublicHttpsUrl(current, "Probe URL");
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        res = await fetch(current, {
          method: "GET",
          headers: {
            "User-Agent": "M.I.N.E-HostResearch/1.0",
            Accept: "text/html,application/json,text/plain",
          },
          signal: ctrl.signal,
          redirect: "manual",
        });
      } finally {
        clearTimeout(t);
      }
      if (res.status < 300 || res.status >= 400 || hop === 3) break;
      const loc = res.headers.get("location");
      if (!loc) break;
      try {
        current = new URL(loc, current).toString();
      } catch {
        break;
      }
    }
    if (!res) throw new Error("probe fallita");
    const text = await res.text();
    const clean = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1800);
    return { url, ok: res.ok, snippet: clean };
  } catch (e) {
    return {
      url,
      ok: false,
      snippet: e instanceof Error ? e.message.slice(0, 120) : "fetch failed",
    };
  }
}

function buildLocalReport(
  query: string,
  seed: (typeof SEED)[string] | null,
  probes: { url: string; ok: boolean; snippet: string }[],
): HostResearchReport {
  const providerId = seed?.providerId ?? "generic";
  const label =
    HOST_PROVIDERS.find((p) => p.id === providerId)?.label ??
    (query.trim().slice(0, 48) || "Host sconosciuto");
  const liveBits = probes
    .filter((p) => p.ok && p.snippet.length > 40)
    .map((p) => `Fonte ${p.url}: ${p.snippet.slice(0, 400)}`)
    .join("\n");

  const summary = [
    seed?.blurb ??
      `Ricerca su "${query}": provider non in catalogo seed. Usa i campi generici e verifica manualmente docs API.`,
    liveBits ? `\n\nEstratti live:\n${liveBits.slice(0, 1200)}` : "",
  ]
    .join("")
    .trim();

  return {
    query,
    providerId,
    label,
    summary,
    apiAvailable: seed?.apiAvailable ?? false,
    mcpHint: seed?.mcpHint ?? "Nessun MCP noto — valuta API REST custom o profilo manuale.",
    suggestedBaseUrl: seed?.baseUrl ?? "",
    suggestedFields: seed?.fields ?? ["label", "apiKey", "baseUrl", "notes"],
    pricingNotes: seed?.pricing ?? "Verifica prezzi sul sito ufficiale.",
    riskNotes: seed?.risk ?? "Non salvare segreti in chiaro fuori dal pannello.",
    sources: (seed?.urls ?? [])
      .concat(probes.filter((p) => p.ok).map((p) => p.url))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 6)
      .map((url) => ({ title: url.replace(/^https?:\/\//, "").split("/")[0] || url, url })),
    draftProfile: {
      label,
      provider: providerId,
      baseUrl: seed?.baseUrl ?? "",
      notes: seed?.mcpHint ?? HOST_PROVIDERS.find((p) => p.id === providerId)?.apiHint ?? "",
    },
  };
}

async function enrichWithGroq(
  local: HostResearchReport,
  model: string,
): Promise<HostResearchReport> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) return local;

  const allowed = GROQ_MODELS.map((m) => m.id);
  const chosen = allowed.includes(model as GroqModelId)
    ? model
    : (process.env["GROQ_MODEL"] ?? DEFAULT_GROQ_MODEL);

  const system = `Sei l'Host Research Agent di M.I.N.E (Minecraft panel control).
Analizzi provider di hosting MC e panel (Falix, Pterodactyl, Aternos, …).
Rispondi SOLO JSON valido, in italiano, senza markdown.
Schema:
{"summary":"...","apiAvailable":true|false,"mcpHint":"...","suggestedBaseUrl":"...","suggestedFields":["apiKey","serverId"],"pricingNotes":"...","riskNotes":"...","label":"..."}
Non inventare endpoint API non supportati dal contesto. Se i dati sono limitati, sii cauto.`;

  const user = [
    `Query: ${local.query}`,
    `Provider seed: ${local.providerId}`,
    `Report locale:`,
    local.summary.slice(0, 3500),
    `API seed: ${local.apiAvailable}`,
    `Base URL seed: ${local.suggestedBaseUrl}`,
    `MCP hint seed: ${local.mcpHint}`,
    `Fonti: ${local.sources.map((s) => s.url).join(", ")}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: chosen,
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return local;
    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as Partial<HostResearchReport>;
    const label =
      typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : local.label;
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : local.summary;
    const providerId = local.providerId;
    return {
      ...local,
      label,
      summary,
      apiAvailable:
        typeof parsed.apiAvailable === "boolean" ? parsed.apiAvailable : local.apiAvailable,
      mcpHint:
        typeof parsed.mcpHint === "string" && parsed.mcpHint.trim()
          ? parsed.mcpHint.trim()
          : local.mcpHint,
      suggestedBaseUrl:
        typeof parsed.suggestedBaseUrl === "string"
          ? parsed.suggestedBaseUrl.trim()
          : local.suggestedBaseUrl,
      suggestedFields: Array.isArray(parsed.suggestedFields)
        ? parsed.suggestedFields.filter((x): x is string => typeof x === "string").slice(0, 8)
        : local.suggestedFields,
      pricingNotes:
        typeof parsed.pricingNotes === "string" && parsed.pricingNotes.trim()
          ? parsed.pricingNotes.trim()
          : local.pricingNotes,
      riskNotes:
        typeof parsed.riskNotes === "string" && parsed.riskNotes.trim()
          ? parsed.riskNotes.trim()
          : local.riskNotes,
      draftProfile: {
        label,
        provider: providerId === "unknown" ? "generic" : providerId,
        baseUrl:
          typeof parsed.suggestedBaseUrl === "string"
            ? parsed.suggestedBaseUrl.trim()
            : local.suggestedBaseUrl,
        notes:
          typeof parsed.mcpHint === "string" && parsed.mcpHint.trim()
            ? parsed.mcpHint.trim().slice(0, 200)
            : local.draftProfile.notes,
      },
    };
  } catch {
    return local;
  }
}

export async function researchHostProvider(input: {
  query: string;
  model?: string;
}): Promise<{ ok: true; report: HostResearchReport } | { ok: false; message: string }> {
  const query = input.query.trim().slice(0, 200);
  if (!query) return { ok: false, message: "Inserisci nome host o URL da studiare." };

  const seed = resolveSeed(query);
  const urls = new Set<string>();
  if (seed) seed.urls.forEach((u) => urls.add(u));
  // URL da input utente: solo https pubblico, mai rete interna (anti-SSRF).
  // I seed del catalogo restano trusted.
  try {
    if (/^https?:\/\//i.test(query)) {
      const { assertPublicHttpsUrl } = await import("./ssrf-guard");
      urls.add(assertPublicHttpsUrl(query, "URL"));
    } else if (query.includes(".") && !query.includes(" ")) {
      const { assertPublicHttpsUrl } = await import("./ssrf-guard");
      urls.add(assertPublicHttpsUrl(`https://${query.replace(/^\/+/, "")}`, "URL"));
    }
  } catch {
    /* URL utente non consentito: si usa solo il seed */
  }

  const probes = await Promise.all([...urls].slice(0, 3).map((u) => probeUrl(u)));
  const local = buildLocalReport(query, seed, probes);
  const report = await enrichWithGroq(local, input.model ?? DEFAULT_GROQ_MODEL);
  return { ok: true, report };
}
