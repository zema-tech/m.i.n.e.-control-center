"use client";
import { useMemo } from "react";

export type GraphKind = "project" | "chat" | "file" | "memory" | "skill" | "mcp";

export type GraphNode = {
  id: string;
  kind: GraphKind;
  /** Etichetta breve (React fa escape: mai HTML). */
  label: string;
  /** Evidenzia attività recente. */
  fresh?: boolean;
};

export type GraphEdge = { from: string; to: string; strong?: boolean };

const KIND_COLOR: Record<GraphKind, string> = {
  project: "#34d399",
  chat: "#7dd3fc",
  file: "#fbbf24",
  memory: "#c4b5fd",
  skill: "#f0abfc",
  mcp: "#fb9238",
};

// Settori angolari (gradi, 0 = destra, senso orario verso il basso in SVG).
const SECTOR: Record<GraphKind, { mid: number; spread: number; radius: number }> = {
  project: { mid: -90, spread: 64, radius: 185 },
  skill: { mid: -32, spread: 40, radius: 200 },
  chat: { mid: 22, spread: 52, radius: 205 },
  file: { mid: 90, spread: 60, radius: 185 },
  mcp: { mid: 152, spread: 40, radius: 200 },
  memory: { mid: 208, spread: 52, radius: 205 },
};

const W = 800;
const H = 520;
const CX = W / 2;
const CY = H / 2 - 10;

type Placed = GraphNode & { x: number; y: number };

/**
 * Knowledge graph vivo del workspace Jarvis: ogni pallino è un oggetto reale
 * (chat, progetto, file, ricordo, skill, plugin) collegato al nucleo e alle
 * sue relazioni. Click = naviga/attiva.
 */
export function KnowledgeGraph({
  nodes,
  edges,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (node: GraphNode) => void;
}) {
  const { placed, links } = useMemo(() => {
    const byKind = new Map<GraphKind, GraphNode[]>();
    for (const n of nodes) {
      const arr = byKind.get(n.kind) ?? [];
      arr.push(n);
      byKind.set(n.kind, arr);
    }
    const pos = new Map<string, { x: number; y: number }>();
    for (const [kind, list] of byKind) {
      const s = SECTOR[kind];
      list.forEach((n, i) => {
        const t = list.length === 1 ? 0.5 : i / (list.length - 1);
        const ang = ((s.mid - s.spread / 2 + t * s.spread) * Math.PI) / 180;
        pos.set(n.id, {
          x: CX + Math.cos(ang) * s.radius,
          y: CY + Math.sin(ang) * s.radius * 0.82,
        });
      });
    }
    const placedList: Placed[] = nodes
      .filter((n) => pos.has(n.id))
      .map((n) => ({ ...n, ...(pos.get(n.id) as { x: number; y: number }) }));
    const linkList = edges.flatMap((e) => {
      const a = e.from === "__core__" ? { x: CX, y: CY } : pos.get(e.from);
      const b = e.to === "__core__" ? { x: CX, y: CY } : pos.get(e.to);
      return a && b ? [{ ...e, a, b }] : [];
    });
    return { placed: placedList, links: linkList };
  }, [nodes, edges]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Grafo neurale del workspace Jarvis"
      className="h-auto w-full"
    >
      {/* fili deboli nucleo → nodi */}
      {placed.map((n) => (
        <line
          key={`spoke-${n.id}`}
          x1={CX}
          y1={CY}
          x2={n.x}
          y2={n.y}
          stroke={KIND_COLOR[n.kind]}
          strokeOpacity={0.22}
          strokeWidth={1}
        />
      ))}
      {/* relazioni forti (chat→progetto, file→contesto) */}
      {links.map((l, i) => (
        <line
          key={`link-${i}`}
          x1={l.a.x}
          y1={l.a.y}
          x2={l.b.x}
          y2={l.b.y}
          stroke="#e0f2fe"
          strokeOpacity={l.strong ? 0.5 : 0.25}
          strokeWidth={l.strong ? 1.5 : 1}
          strokeDasharray={l.strong ? undefined : "3 4"}
        />
      ))}
      {/* nucleo */}
      <g>
        <circle cx={CX} cy={CY} r={30} fill="#0c4a6e" stroke="#7dd3fc" strokeWidth={1.5} />
        <circle
          cx={CX}
          cy={CY}
          r={30}
          fill="none"
          stroke="#7dd3fc"
          strokeOpacity={0.4}
          className="jx-node-ping"
        />
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          fontSize={11}
          fill="#e0f2fe"
          fontFamily="monospace"
          letterSpacing={2}
        >
          J
        </text>
      </g>
      {/* nodi */}
      {placed.map((n) => (
        <g
          key={n.id}
          onClick={() => onSelect(n)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(n);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`${n.kind}: ${n.label}`}
          className="cursor-pointer"
        >
          <title>{n.label}</title>
          {n.fresh ? (
            <circle
              cx={n.x}
              cy={n.y}
              r={10}
              fill="none"
              stroke={KIND_COLOR[n.kind]}
              strokeOpacity={0.5}
              className="jx-node-ping"
            />
          ) : null}
          <circle
            cx={n.x}
            cy={n.y}
            r={7}
            fill="#020617"
            stroke={KIND_COLOR[n.kind]}
            strokeWidth={2}
          />
          <circle cx={n.x} cy={n.y} r={2.5} fill={KIND_COLOR[n.kind]} />
          <text x={n.x} y={n.y + 22} textAnchor="middle" fontSize={10.5} fill="#cbd5e1">
            {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
