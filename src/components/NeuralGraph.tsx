import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_GROQ_MODEL, GROQ_MODELS, type GroqModelId } from "@/lib/groq-models";

export type NodeKind =
  | "server"
  | "device"
  | "folder"
  | "file"
  | "mcp"
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
  items?: string[];
  parentId?: string;
};

type SimNode = GraphNode & {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hue: number;
  phase: number;
  baseR: number;
};

type Link = { source: string; target: string };

const KIND_META: Record<NodeKind, { hue: number; label: string; order: number; hint: string }> = {
  server: { hue: 145, label: "Server", order: 0, hint: "Hub centrale Minecraft" },
  device: { hue: 205, label: "Dispositivo", order: 1, hint: "Dispositivo locale autorizzato" },
  folder: { hue: 42, label: "Cartelle", order: 2, hint: "Cartelle e progetti importati" },
  file: { hue: 188, label: "File", order: 3, hint: "File disponibili nel contesto IA" },
  mcp: { hue: 150, label: "MCP", order: 4, hint: "Connettori e strumenti disponibili" },
  player: { hue: 200, label: "Giocatori", order: 5, hint: "Click per roster" },
  world: { hue: 270, label: "Mondi", order: 6, hint: "Dimensioni" },
  plugin: { hue: 45, label: "Plugin", order: 7, hint: "Stack moduli" },
  metric: { hue: 330, label: "Metriche", order: 8, hint: "CPU RAM TPS" },
  service: { hue: 160, label: "Servizi", order: 9, hint: "API IA e connettori" },
  log: { hue: 220, label: "Log / eventi", order: 10, hint: "Eventi IA" },
};

const MODEL_KEY = "mine.groq.model";
const FOCAL = 520;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hsl(h: number, s = 100, l = 62, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
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

function project(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  rotY: number,
  rotX: number,
) {
  // rotazione Y poi X
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const x1 = x * cosY - z * sinY;
  let z1 = x * sinY + z * cosY;
  const y1 = y * cosX - z1 * sinX;
  z1 = y * sinX + z1 * cosX;
  const depth = z1 + FOCAL * 0.85;
  const scale = FOCAL / Math.max(120, depth);
  return {
    sx: cx + x1 * scale,
    sy: cy + y1 * scale,
    scale,
    depth: z1,
  };
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
  const timeRef = useRef(0);
  const rotRef = useRef({ y: 0.35, x: 0.28 });
  const autoSpin = useRef(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<NodeKind>>(new Set());
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const dragNode = useRef<{ id: string } | null>(null);
  const orbitDrag = useRef<{ lx: number; ly: number } | null>(null);
  const sizeRef = useRef({ w: 960, h: 640 });
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

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
    const sim: SimNode[] = nodes.map((n, i) => {
      const meta = KIND_META[n.kind];
      const angle = ((hash(n.id) % 360) * Math.PI) / 180 + i * 0.4;
      const elev = ((hash(n.id + "e") % 100) / 100 - 0.5) * Math.PI * 0.7;
      const isRoot = n.kind === "server" || n.kind === "device";
      const ring = isRoot
        ? 0
        : n.kind === "metric"
          ? 90 + (hash(n.id) % 40)
          : n.kind === "player"
            ? 120 + (hash(n.id) % 50)
            : 150 + (hash(n.id) % 90);
      const baseR =
        n.size ?? (isRoot ? 18 : n.kind === "player" ? 11 : n.kind === "metric" ? 10 : 9);
      const hueJitter = (hash(n.id + "h") % 24) - 12;
      const x = isRoot ? 0 : Math.cos(angle) * Math.cos(elev) * ring;
      const y = isRoot ? 0 : Math.sin(elev) * ring * 0.85;
      const z = isRoot ? 0 : Math.sin(angle) * Math.cos(elev) * ring;
      return {
        ...n,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        hue: (meta.hue + hueJitter + 360) % 360,
        phase: (hash(n.id) % 628) / 100,
        baseR,
      };
    });
    simRef.current = sim;

    const byKind = (k: NodeKind) => sim.filter((n) => n.kind === k);
    const links: Link[] = [];
    const root = sim.find((n) => n.kind === "server" || n.kind === "device");
    if (root) {
      for (const n of sim) {
        if (n.id !== root.id && !n.parentId) links.push({ source: root.id, target: n.id });
      }
    }
    for (const n of sim) {
      if (n.parentId && sim.some((candidate) => candidate.id === n.parentId)) {
        links.push({ source: n.parentId, target: n.id });
      }
    }
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
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        if (hash(players[i]!.id + players[j]!.id) % 3 === 0) {
          links.push({ source: players[i]!.id, target: players[j]!.id });
        }
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const cx = w / 2;
    const cy = h * 0.5;
    const rotY = rotRef.current.y;
    const rotX = rotRef.current.x;

    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    bg.addColorStop(0, "#12102a");
    bg.addColorStop(0.45, "#0b0b1e");
    bg.addColorStop(1, "#05050f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // griglia piano 3D leggera
    ctx.strokeStyle = "rgba(69,255,138,0.04)";
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      const a = project(-220, 80, i * 55, cx, cy, rotY, rotX);
      const b = project(220, 80, i * 55, cx, cy, rotY, rotX);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
      const c = project(i * 55, 80, -220, cx, cy, rotY, rotX);
      const d = project(i * 55, 80, 220, cx, cy, rotY, rotX);
      ctx.beginPath();
      ctx.moveTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.stroke();
    }

    const sim = simRef.current;
    const hide = hiddenRef.current;
    const sel = selectedRef.current;
    const t = timeRef.current;
    const byId = new Map(sim.map((n) => [n.id, n]));

    type Proj = ReturnType<typeof project> & { id: string };
    const projs = new Map<string, Proj>();
    for (const n of sim) {
      if (hide.has(n.kind)) continue;
      const p = project(n.x, n.y, n.z, cx, cy, rotY, rotX);
      projs.set(n.id, { ...p, id: n.id });
    }

    // link
    ctx.lineCap = "round";
    for (const l of linksRef.current) {
      const a = byId.get(l.source);
      const b = byId.get(l.target);
      const pa = projs.get(l.source);
      const pb = projs.get(l.target);
      if (!a || !b || !pa || !pb) continue;
      const isHot = sel && (sel === a.id || sel === b.id);
      const depthFactor = (pa.scale + pb.scale) / 2;
      const alpha = isHot ? 0.5 : 0.08 + depthFactor * 0.12;
      const grad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
      grad.addColorStop(0, hsl(a.hue, 100, 62, alpha));
      grad.addColorStop(1, hsl(b.hue, 100, 62, alpha));
      ctx.strokeStyle = grad;
      ctx.lineWidth = (isHot ? 1.6 : 0.45) * depthFactor;
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    }

    // nodi ordinati per profondità
    const ordered = [...sim]
      .filter((n) => !hide.has(n.kind) && projs.has(n.id))
      .sort((a, b) => (projs.get(a.id)!.depth < projs.get(b.id)!.depth ? -1 : 1));

    for (const n of ordered) {
      const p = projs.get(n.id)!;
      const pulse = Math.sin(t * 0.9 + n.phase) * 0.5 + 0.5;
      const r = n.baseR * p.scale * (1 + Math.sin(t * 0.7 + n.phase) * 0.05);
      const dim = n.status === "offline" ? 0.35 : n.status === "error" ? 0.95 : 1;
      const isSel = sel === n.id;

      ctx.globalAlpha = dim;
      ctx.shadowColor = hsl(n.hue, 100, 62, 1);
      ctx.shadowBlur = (isSel ? 32 : 14 + pulse * 12) * p.scale * dim;

      ctx.fillStyle = hsl(n.hue, 100, 62, 1);
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = isSel ? 2.4 : 1.1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.stroke();

      if (n.status === "error") {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = `rgba(255,255,255,${0.22 + pulse * 0.12})`;
      ctx.beginPath();
      ctx.arc(p.sx - r * 0.25, p.sy - r * 0.28, r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      if (n.kind === "server" || n.kind === "device" || isSel || n.baseR >= 11) {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font =
          n.kind === "server" || n.kind === "device"
            ? "bold 12px Orbitron, system-ui, sans-serif"
            : "10px 'Share Tech Mono', ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.label.slice(0, 18), p.sx, p.sy + r + 14);
      }
      ctx.globalAlpha = 1;
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      timeRef.current += 0.016;
      if (autoSpin.current && !orbitDrag.current) {
        rotRef.current.y += 0.0022;
      }

      const sim = simRef.current;
      const hide = hiddenRef.current;

      // repulsion 3D
      for (let i = 0; i < sim.length; i++) {
        if (hide.has(sim[i]!.kind)) continue;
        for (let j = i + 1; j < sim.length; j++) {
          if (hide.has(sim[j]!.kind)) continue;
          const a = sim[i]!;
          const b = sim[j]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
          const minD =
            a.kind === "server" || b.kind === "server" ? 100 : a.kind === b.kind ? 42 : 55;
          if (dist < minD) {
            const f = ((minD - dist) / dist) * 0.09;
            dx *= f;
            dy *= f;
            dz *= f;
            a.vx += dx;
            a.vy += dy;
            a.vz += dz;
            b.vx -= dx;
            b.vy -= dy;
            b.vz -= dz;
          }
        }
      }

      for (const n of sim) {
        if (hide.has(n.kind)) continue;
        if (n.kind === "server") {
          n.vx += -n.x * 0.02;
          n.vy += -n.y * 0.02;
          n.vz += -n.z * 0.02;
        } else {
          n.vx += -n.x * 0.001;
          n.vy += -n.y * 0.001;
          n.vz += -n.z * 0.001;
        }
      }

      for (const l of linksRef.current) {
        const a = sim.find((n) => n.id === l.source);
        const b = sim.find((n) => n.id === l.target);
        if (!a || !b || hide.has(a.kind) || hide.has(b.kind)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const ideal = a.kind === "server" || b.kind === "server" ? 130 : 72;
        const f = ((dist - ideal) / dist) * 0.006;
        a.vx += dx * f;
        a.vy += dy * f;
        a.vz += dz * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
        b.vz -= dz * f;
      }

      for (const n of sim) {
        if (dragNode.current?.id === n.id) continue;
        if (hide.has(n.kind)) continue;
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.vz *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;
        const lim = 280;
        n.x = Math.max(-lim, Math.min(lim, n.x));
        n.y = Math.max(-lim, Math.min(lim, n.y));
        n.z = Math.max(-lim, Math.min(lim, n.z));
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
      sizeRef.current = {
        w: el.clientWidth || 960,
        h: Math.max(560, el.clientHeight || 640),
      };
    });
    ro.observe(el);
    sizeRef.current = {
      w: el.clientWidth || 960,
      h: Math.max(560, el.clientHeight || 640),
    };
    return () => ro.disconnect();
  }, []);

  function hitTest(mx: number, my: number): SimNode | null {
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h * 0.5;
    const hide = hiddenRef.current;
    let best: SimNode | null = null;
    let bestD = Infinity;
    for (const n of simRef.current) {
      if (hide.has(n.kind)) continue;
      const p = project(n.x, n.y, n.z, cx, cy, rotRef.current.y, rotRef.current.x);
      const r = n.baseR * p.scale + 8;
      const dx = p.sx - mx;
      const dy = p.sy - my;
      const d = dx * dx + dy * dy;
      if (d <= r * r && p.depth < bestD) {
        best = n;
        bestD = p.depth;
      }
    }
    return best;
  }

  function onPointerDown(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);
    if (hit) {
      setSelected(hit.id);
      onSelect?.(hit);
      dragNode.current = { id: hit.id };
      autoSpin.current = false;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setSelected(null);
      onSelect?.(null);
      orbitDrag.current = { lx: e.clientX, ly: e.clientY };
      autoSpin.current = false;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (orbitDrag.current) {
      const dx = e.clientX - orbitDrag.current.lx;
      const dy = e.clientY - orbitDrag.current.ly;
      rotRef.current.y += dx * 0.005;
      rotRef.current.x = Math.max(-0.9, Math.min(0.9, rotRef.current.x + dy * 0.004));
      orbitDrag.current = { lx: e.clientX, ly: e.clientY };
      return;
    }
    if (!dragNode.current) return;
    // leggero spostamento nel piano della camera
    const n = simRef.current.find((x) => x.id === dragNode.current!.id);
    if (!n) return;
    n.x += e.movementX * 0.35;
    n.y += e.movementY * 0.35;
    n.vx = 0;
    n.vy = 0;
    n.vz = 0;
  }

  function onPointerUp() {
    dragNode.current = null;
    orbitDrag.current = null;
    // riprendi spin dopo un attimo
    setTimeout(() => {
      if (!dragNode.current && !orbitDrag.current) autoSpin.current = true;
    }, 1800);
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
  const selMeta = selectedNode ? KIND_META[selectedNode.kind] : null;
  const playerRoster = useMemo(
    () => nodes.filter((n) => n.kind === "player").map((n) => n.label),
    [nodes],
  );

  return (
    <div className="relative h-[min(78vh,720px)] min-h-[560px] w-full overflow-hidden rounded-xl border border-primary/20 bg-[#05050f] shadow-[0_0_40px_oklch(0.86_0.28_145_/_0.08)]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      <div className="absolute right-3 top-3 z-10 w-44 rounded-xl border border-white/10 bg-[rgba(8,8,20,0.8)] p-3 backdrop-blur-xl">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
          Rete 3D · filtri
        </p>
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
                      off ? "opacity-30" : "opacity-100"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: hsl(meta.hue),
                        boxShadow: `0 0 10px ${hsl(meta.hue, 100, 62, 0.7)}`,
                      }}
                    />
                    <span className="flex-1 truncate text-white/70">{meta.label}</span>
                    <span className="font-mono text-[10px] text-white/40">{count}</span>
                  </button>
                </li>
              );
            })}
        </ul>
        <p className="mt-2 text-[9px] leading-relaxed text-white/35">
          Trascina lo sfondo per orbitare · click nodo = dettaglio
        </p>
      </div>

      {selectedNode && selMeta ? (
        <div className="absolute left-3 top-3 z-10 max-w-[280px] rounded-xl border border-white/10 bg-[rgba(8,8,20,0.88)] p-3 text-xs backdrop-blur-xl">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Nodo 3D
          </p>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                backgroundColor: hsl(selMeta.hue),
                boxShadow: `0 0 12px ${hsl(selMeta.hue, 100, 62, 0.8)}`,
              }}
            />
            <p className="font-semibold text-white">{selectedNode.label}</p>
          </div>
          <p className="text-white/55">
            {selMeta.label} · <span className="uppercase">{selectedNode.status}</span>
          </p>
          <p className="mt-1 text-[11px] text-white/40">{selMeta.hint}</p>
          {selectedNode.detail ? (
            <p className="mt-2 text-[11px] leading-relaxed text-white/70">{selectedNode.detail}</p>
          ) : null}
          {(selectedNode.kind === "player" ||
            selectedNode.id === "metric:players" ||
            selectedNode.items?.length) && (
            <div className="mt-3 border-t border-white/10 pt-2">
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
                Giocatori online
              </p>
              {(selectedNode.items?.length ? selectedNode.items : playerRoster).length === 0 ? (
                <p className="text-[11px] text-white/40">Nessun giocatore online</p>
              ) : (
                <ul className="max-h-28 space-y-1 overflow-y-auto">
                  {(selectedNode.items?.length ? selectedNode.items : playerRoster).map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/80"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: hsl(KIND_META.player.hue) }}
                      />
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[220px] rounded-xl border border-white/10 bg-[rgba(8,8,20,0.55)] px-3 py-2 text-[11px] text-white/40 backdrop-blur-xl">
          Rete neurale 3D — trascina per ruotare
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-2">
        <div
          className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/15 bg-[rgba(8,8,20,0.75)] backdrop-blur-xl"
          style={{
            boxShadow:
              serverOnline !== false
                ? "0 0 40px rgba(69,255,138,0.28), inset 0 0 24px rgba(69,255,138,0.06)"
                : "0 0 24px rgba(100,100,120,0.25)",
          }}
        >
          <span className="bg-gradient-to-r from-[#ff2d95] via-[#45ff8a] to-[#2dd4ff] bg-clip-text text-sm font-black tracking-[0.15em] text-transparent">
            M.I.N.E
          </span>
          <span
            className={`mt-1 text-[9px] uppercase tracking-[0.25em] ${
              serverOnline === false ? "text-white/40" : "text-[#45ff8a]"
            }`}
          >
            {serverOnline === false ? "offline" : "online · 3d"}
          </span>
        </div>
        <label className="flex flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">modello ia</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="max-w-[140px] rounded-full border border-white/15 bg-[rgba(8,8,20,0.9)] px-3 py-1 font-mono text-[10px] text-white/80 outline-none focus:border-white/40"
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-[rgba(8,8,20,0.75)] px-3 py-1.5 font-mono text-[10px] tracking-wide text-white/50 backdrop-blur-xl">
        {nodes.length} nodi · proiezione 3D · spin automatico
      </div>
    </div>
  );
}
