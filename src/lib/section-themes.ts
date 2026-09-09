/**
 * Omnicore — mondi del prodotto.
 * Ogni sezione è un agente specializzato sotto un unico nucleo.
 * Gli id devono coincidere con html[data-section] e le classi .orb-* in styles.css.
 */

export type SectionId = "jarvis" | "mine" | "design" | "code";

export type SectionHref = "/jarvis" | "/mine" | "/design" | "/code";

export type SectionDef = {
  id: SectionId;
  title: string;
  tagline: string;
  description: string;
  colors: string;
  href: SectionHref;
  links: { label: string; to: string }[];
};

export const SECTIONS: SectionDef[] = [
  {
    id: "jarvis",
    title: "J.A.R.V.I.S",
    tagline: "IA principale",
    description:
      "Orchestratore Omnicore: workspace chat, cervello e connettori. Azzurro e nero.",
    colors: "Azzurro · Nero",
    href: "/jarvis",
    links: [
      { label: "Workspace", to: "/jarvis" },
      { label: "Brain", to: "/agent" },
      { label: "Connettori", to: "/connectors" },
    ],
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
    id: "design",
    title: "A.R.T",
    tagline: "Design system",
    description:
      "Identità visiva, palette, tipografia, motion e componenti. Violetto e oro.",
    colors: "Violetto · Oro",
    href: "/design",
    links: [{ label: "Studio design", to: "/design" }],
  },
  {
    id: "code",
    title: "P.R.O.M.P.T",
    tagline: "Coding agent",
    description:
      "Code, Architect, Debug, Review — stile agentic coding. Blu scuro e nero.",
    colors: "Blu scuro · Nero",
    href: "/code",
    links: [{ label: "Workspace codice", to: "/code" }],
  },
];

/** Mappa path → tema CSS (data-section / orb-*). */
export function sectionFromPath(pathname: string): SectionId {
  if (pathname.startsWith("/code")) return "code";
  if (pathname.startsWith("/design")) return "design";
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
