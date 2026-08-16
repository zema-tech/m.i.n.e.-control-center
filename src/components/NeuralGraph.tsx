import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";

export type NodeKind =
  | "server"
  | "player"
  | "world"
  | "plugin"
  | "metric"
  | "service"
  | "log";

export type GraphNode = {
  id: string;
  label: string;
  kind: NodeKind;
  status: "online" | "offline" | "error";
  detail?: string;
  size?: number;
};

type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Link = { source: string; target: string };

const KIND_META: Record<
  NodeKind,
  { color: string; label: string; order: number }
> = {
  server: { color: "#00ff41", label: "Server", order: 0 },
  player: { color: "#38bdf8", label: "Giocatori", order: 1 },
  world: { color: "#a78bfa", label: "Mondi", order: 2 },
  plugin: { color: "#fbbf24", label: "Plugin", order: 3 },
  metric: { color: "#f472b6", label: "Metriche", order: 4 },
  service: { color: "#34d399", label: "Servizi", order: 5 },
  log: { color: "#94a3b8", label: "Log / eventi", order: 6 },
};

const MODEL_KEY = "mine.groq.model";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function loadModel(): GroqModelId {
  if (typeof window === "undefined") return DEFAULT_GROQ_MODEL;
  try {
    const v = window.localStorage.getItem(MODEL_KEY);
    if (v && GROQ_MODELS.some((m) => m.id === v)) return v as GroqModelId;
  } catch {
    /* ignore */
  }
  return DEFAULT_GROQ_MODEL;
}

export function NeuralGraph({
  nodes,
  serverOnline,
  onSelect,
}: {
  nodes: GraphNode[];
  serverOnline?: boolean;
  onSelect?: (node: GraphNode | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SimNode[]>([]);
  const linksRef = useRef<Link[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<NodeKind>>(new Set());
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const sizeRef = useRef({ w: 800, h: 480 });
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  useEffect(() => {
    setModel(loadModel());
  }, []);

  const nodeKey = useMemo(() => nodes.map((n) => `${n.id}:${n.status}`).join(","), [nodes]);

  const counts = useMemo(() => {
    const c: Partial<Record<NodeKind, number>> = {};
    for (const n of nodes) c[n.kind] = (c[n.kind] ?? 0) + 1;
    return c;
  }, [nodes]);

  useEffect(() => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const cx = w / 2;
    const cy = h / 2;

    const sim: SimNode[] = nodes.map((n, i) => {
      const angle = (hash(n.id) % 360) * (Math.PI / 180) + i * 0.4;
      const ring =
        n.kind === "server"
          ? 0
          : n.kind === "metric"
            ? 70 + (hash(n.id) % 40)
            : n.kind === "player"
              ? 110 + (hash(n.id) % 50)
              : 140 + (hash(n.id) % 80);
      return {
        ...n,
        x: n.kind === "server" ? cx : cx + Math.cos(angle) * ring,
        y: n.kind === "server" ? cy : cy + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
      };
    });
    simRef.current = sim;

    const byKind = (k: NodeKind) => sim.filter((n) => n.kind === k);
    const links: Link[] = [];
    const server = sim.find((n) => n.kind === "server");

    // hub: tutto collega al server
    if (server) {
      for (const n of sim) {
        if (n.id !== server.id) links.push({ source: server.id, target: n.id });
      }
    }

    // cluster interni: mondi ↔ plugin, metriche ↔ server già ok, player ↔ world
    const worlds = byKind("world");
    const plugins = byKind("plugin");
    const players = byKind("player");
    const metrics = byKind("metric");
    const services = byKind("service");

    for (const wld of worlds) {
      for (const pl of plugins) {
        if (hash(wld.id + pl.id) % 3 === 0) links.push({ source: wld.id, target: pl.id });
      }
      for (const p of players) {
        if (hash(wld.id + p.id) % 2 === 0) links.push({ source: wld.id, target: p.id });
      }
    }
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        links.push({ source: metrics[i]!.id, target: metrics[j]!.id });
      }
    }
    for (const s of services) {
      for (const m of metrics) {
        if (hash(s.id + m.id) % 2 === 0) links.push({ source: s.id, target: m.id });
      }
    }

    linksRef.current = links;
  }, [nodeKey, nodes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, w, h);

    // subtle grid
    ctx.strokeStyle = "rgba(0,255,65,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const sim = simRef.current;
    const hide = hiddenRef.current;
    const byId = new Map(sim.map((n) => [n.id, n]));
    const visible = (id: string) => {
      const n = byId.get(id);
      return n && !hide.has(n.kind);
    };

    // links
    for (const l of linksRef.current) {
      if (!visible(l.source) || !visible(l.target)) continue;
      const a = byId.get(l.source)!;
      const b = byId.get(l.target)!;
      const col = KIND_META[a.kind].color;
      ctx.strokeStyle =
        selected && (selected === a.id || selected === b.id)
          ? col
          : col.replace(")", ",0.22)").replace("rgb", "rgba").startsWith("#")
            ? `${col}33`
            : "rgba(0,255,65,0.15)";
      // hex alpha
      ctx.strokeStyle =
        selected && (selected === a.id || selected === b.id) ? `${col}cc` : `${col}28`;
      ctx.lineWidth = selected && (selected === a.id || selected === b.id) ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes
    for (const n of sim) {
      if (hide.has(n.kind)) continue;
      const base =
        n.size ??
        (n.kind === "server" ? 16 : n.kind === "player" ? 9 : n.kind === "metric" ? 8 : 7);
      const color = KIND_META[n.kind].color;
      const dim = n.status === "offline" ? 0.4 : n.status === "error" ? 0.9 : 1;

      // outer glow
      ctx.globalAlpha = 0.35 * dim;
      ctx.shadowColor = color;
      ctx.shadowBlur = n.kind === "server" ? 22 : 12;
      ctx.beginPath();
      ctx.arc(n.x, n.y, base + 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = dim;

      ctx.beginPath();
      ctx.arc(n.x, n.y, base, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (n.status === "error") {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (selected === n.id) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, base + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // label for larger / selected nodes
      if (n.kind === "server" || selected === n.id || base >= 9) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#e5ffe9";
        ctx.font = n.kind === "server" ? "bold 11px Orbitron, sans-serif" : "10px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.label.slice(0, 16), n.x, n.y + base + 12);
      }
      ctx.globalAlpha = 1;
    }
  }, [selected]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const sim = simRef.current;
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const hide = hiddenRef.current;

      for (let i = 0; i < sim.length; i++) {
        if (hide.has(sim[i]!.kind)) continue;
        for (let j = i + 1; j < sim.length; j++) {
          if (hide.has(sim[j]!.kind)) continue;
          const a = sim[i]!;
          const b = sim[j]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD =
            a.kind === "server" || b.kind === "server"
              ? 90
              : a.kind === b.kind
                ? 36
                : 48;
          if (dist < minD) {
            const f = ((minD - dist) / dist) * 0.12;
            dx *= f;
            dy *= f;
            a.vx += dx;
            a.vy += dy;
            b.vx -= dx;
            b.vy -= dy;
          }
        }
      }

      for (const n of sim) {
        if (hide.has(n.kind)) continue;
        if (n.kind === "server") {
          n.vx += (cx - n.x) * 0.025;
          n.vy += (cy - n.y) * 0.025;
        } else {
          n.vx += (cx - n.x) * 0.0015;
          n.vy += (cy - n.y) * 0.0015;
        }
      }

      for (const l of linksRef.current) {
        const a = sim.find((n) => n.id === l.source);
        const b = sim.find((n) => n.id === l.target);
        if (!a || !b || hide.has(a.kind) || hide.has(b.kind)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const ideal = a.kind === "server" || b.kind === "server" ? 120 : 70;
        const f = ((dist - ideal) / dist) * 0.008;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }

      for (const n of sim) {
        if (dragRef.current?.id === n.id) continue;
        if (hide.has(n.kind)) continue;
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(24, Math.min(w - 24, n.x));
        n.y = Math.max(24, Math.min(h - 24, n.y));
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw, nodeKey]);

  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: el.clientWidth || 800, h: Math.max(420, el.clientHeight || 480) };
    });
    ro.observe(el);
    sizeRef.current = { w: el.clientWidth || 800, h: Math.max(420, el.clientHeight || 480) };
    return () => ro.disconnect();
  }, []);

  function hitTest(mx: number, my: number): SimNode | null {
    const hide = hiddenRef.current;
    for (let i = simRef.current.length - 1; i >= 0; i--) {
      const n = simRef.current[i]!;
      if (hide.has(n.kind)) continue;
      const r = (n.size ?? (n.kind === "server" ? 16 : 9)) + 4;
      const dx = n.x - mx;
      const dy = n.y - my;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);
    if (hit) {
      setSelected(hit.id);
      onSelect?.(hit);
      dragRef.current = { id: hit.id, ox: mx - hit.x, oy: my - hit.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setSelected(null);
      onSelect?.(null);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const n = simRef.current.find((x) => x.id === dragRef.current!.id);
    if (n) {
      n.x = mx - dragRef.current.ox;
      n.y = my - dragRef.current.oy;
      n.vx = 0;
      n.vy = 0;
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function toggleKind(k: NodeKind) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function onModelChange(id: string) {
    const next = (GROQ_MODELS.some((m) => m.id === id) ? id : DEFAULT_GROQ_MODEL) as GroqModelId;
    setModel(next);
    try {
      window.localStorage.setItem(MODEL_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const selectedNode = selected ? nodes.find((n) => n.id === selected) : null;

  return (
    <div className="relative h-[min(62vh,560px)] min-h-[420px] w-full overflow-hidden rounded-lg border border-border bg-[#050805]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Legenda in alto a destra */}
      <div className="absolute right-3 top-3 z-10 w-40 rounded-md border border-border/80 bg-background/80 p-3 backdrop-blur-md">
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-primary">Filter</p>
        <ul className="space-y-1.5">
          {(Object.keys(KIND_META) as NodeKind[])
            .sort((a, b) => KIND_META[a].order - KIND_META[b].order)
            .map((k) => {
              const meta = KIND_META[k];
              const count = counts[k] ?? 0;
              if (count === 0) return null;
              const off = hidden.has(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => toggleKind(k)}
                    className={`flex w-full items-center gap-2 text-left text-[11px] transition-opacity ${
                      off ? "opacity-35" : "opacity-100"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">{meta.label}</span>
                    <span className="font-mono text-[10px] text-primary/80">{count}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </div>

      {/* Inspector selezione */}
      {selectedNode ? (
        <div className="absolute left-3 top-3 z-10 max-w-[220px] rounded-md border border-border/80 bg-background/85 p-3 text-xs backdrop-blur-md">
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Inspector</p>
          <p className="font-display text-sm text-primary">{selectedNode.label}</p>
          <p className="mt-1 text-muted-foreground">
            {KIND_META[selectedNode.kind].label} · {selectedNode.status}
          </p>
          {selectedNode.detail ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{selectedNode.detail}</p>
          ) : null}
        </div>
      ) : null}

      {/* Orbe M.I.N.E + switch modello */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-2">
        <div
          className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 border-primary/60 bg-background/70 shadow-[0_0_40px_rgba(0,255,65,0.25)] backdrop-blur-md"
          style={{
            boxShadow:
              serverOnline !== false
                ? "0 0 40px rgba(0,255,65,0.35), inset 0 0 24px rgba(0,255,65,0.08)"
                : "0 0 24px rgba(107,114,128,0.3)",
          }}
        >
          <span className="font-display text-sm font-bold tracking-[0.15em] text-primary text-glow">
            M.I.N.E
          </span>
          <span
            className={`mt-1 text-[9px] uppercase tracking-[0.25em] ${
              serverOnline === false ? "text-muted-foreground" : "text-primary"
            }`}
          >
            {serverOnline === false ? "offline" : "online"}
          </span>
          <span className="pointer-events-none absolute inset-0 rounded-full border border-primary/20" />
          <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full border border-primary/10" />
        </div>
        <label className="flex flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">modello ia</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="max-w-[140px] rounded-md border border-primary/40 bg-background/90 px-2 py-1 font-mono text-[10px] text-primary outline-none focus:border-primary"
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] uppercase tracking-widest text-muted-foreground/70">
        {nodes.length} nodi · trascina · filtra dalla legenda
      </div>
    </div>
  );
}
