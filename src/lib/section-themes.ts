/**
 * Omnicore — mondi del prodotto.
 * Ogni sezione è un agente specializzato sotto un unico nucleo.
 */

export type SectionId = "jarvis" | "edit" | "mine" | "prompt" | "art";

export type SectionDef = {
  id: SectionId;
  title: string;
  tagline: string;
  description: string;
  colors: string;
  href: string;
  links: { label: string; to: string }[];
};

export const SECTIONS: SectionDef[] = [
  {
    id: "jarvis",
    title: "J.A.R.V.I.S",
    tagline: "IA principale",
    description:
      "Orchestratore Omnicore: cervello, chat, 4 pilastri, connettori. Azzurro e nero.",
    colors: "Azzurro · Nero",
    href: "/jarvis",
    links: [
      { label: "Hub agente", to: "/jarvis" },
      { label: "Chat", to: "/assistant" },
      { label: "Pilastri", to: "/agent" },
      { label: "Connettori", to: "/connectors" },
    ],
  },
  {
    id: "edit",
    title: "E.D.I.T",
    tagline: "Social & content",
    description:
      "Assistente per social, contenuti e presenza online. Rosa e nero.",
    colors: "Rosa · Nero",
    href: "/edit",
    links: [{ label: "Hub E.D.I.T", to: "/edit" }],
  },
  {
    id: "mine",
    title: "M.I.N.E",
    tagline: "Gaming & host",
    description:
      "Server Minecraft/Falix, rete, log, power e host. Verde matrix e nero.",
    colors: "Verde · Nero",
    href: "/mine",
    links: [
      { label: "Hub M.I.N.E", to: "/mine" },
      { label: "Rete", to: "/network" },
      { label: "Host", to: "/hosts" },
      { label: "Competenze", to: "/skills" },
    ],
  },
  {
    id: "prompt",
    title: "P.R.O.M.P.T",
    tagline: "Coding agent",
    description:
      "Code, Architect, Debug, Review — stile agentic coding. Blu scuro e nero.",
    colors: "Blu scuro · Nero",
    href: "/code",
    links: [{ label: "Workspace codice", to: "/code" }],
  },
  {
    id: "art",
    title: "A.R.T",
    tagline: "Design",
    description:
      "Identità visiva, palette, tipografia, motion e componenti. Violetto e oro.",
    colors: "Violetto · Oro",
    href: "/design",
    links: [{ label: "Studio design", to: "/design" }],
  },
];

/** Retro-compat: path storici /code e /design restano validi. */
export function sectionFromPath(pathname: string): SectionId {
  if (pathname.startsWith("/code")) return "prompt";
  if (pathname.startsWith("/design")) return "art";
  if (pathname.startsWith("/edit")) return "edit";
  if (
    pathname.startsWith("/mine") ||
    pathname.startsWith("/network") ||
    pathname.startsWith("/hosts") ||
    pathname.startsWith("/skills")
  ) {
    return "mine";
  }
  return "jarvis";
}
