/**
 * Quattro mondi del prodotto — ciascuno con palette e destinazioni.
 */

export type SectionId = "jarvis" | "mine" | "design" | "code";

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
    title: "JARVIS",
    tagline: "Agente personale",
    description:
      "Cervello, chat, 4 pilastri, connettori One MCP. Azzurro e nero — il tuo Claude.",
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
    id: "mine",
    title: "M.I.N.E",
    tagline: "Host Minecraft",
    description:
      "Server Falix, rete neurale, log, power e host MC. Nero e verde matrix.",
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
    title: "DESIGN",
    tagline: "Identità visiva",
    description:
      "Palette, tipografia, motion e componenti. Laboratorio estetico premium.",
    colors: "Violetto · Oro",
    href: "/design",
    links: [{ label: "Studio design", to: "/design" }],
  },
  {
    id: "code",
    title: "CODE",
    tagline: "Coding agent",
    description:
      "Code, Architect, Debug, Review — stile Kilo / Claude Code. Blu scuro e nero.",
    colors: "Blu scuro · Nero",
    href: "/code",
    links: [{ label: "Workspace codice", to: "/code" }],
  },
];

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
