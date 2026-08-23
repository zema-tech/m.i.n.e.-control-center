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
  /** Elenco extra (es. nomi giocatori se il nodo è un aggregato). */
  items?: string[];
};

type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  phase: number;
  baseR: number;
};

type Link = { source: string; target: string };

/** Colori vividi per funzione (stile pallini collegati). */
const KIND_META: Record<
  NodeKind,
  { hue: number; label: string; order: number; hint: string }
> = {
  server: {
    hue: 145,
    label: "Server",
    order: 0,
    hint: "Hub centrale Minecraft",
  },
  player: {
    hue: 200,
    label: "Giocatori",
    order: 1,
    hint: "Click per vedere chi è online",
  },
  world: {
    hue: 270,
    label: "Mondi",
    order: 2,
    hint: "Dimensioni del server",
  },
  plugin: {
    hue: 45,
    label: "Plugin",
    order: 3,
    hint: "Stack / moduli installati",
  },
  metric: {
    hue: 330,
    label: "Metriche",
    order: 4,
    hint: "CPU, RAM, TPS, slot",
  },
  service: {
    hue: 160,
    label: "Servizi",
    order: 5,
    hint: "API, console, IA, power",
  },
  log: {
    hue: 220,
    label: "Log / eventi",
    order: 6,
    hint: "Ultimi eventi registrati",
  },
};

const MODEL_KEY = "mine.groq.model";

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
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<NodeKind>>(new Set());
  const [model, setModel] = useState<GroqModelId>(DEFAULT_GROQ_MODEL);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const sizeRef = useRef({ w: 800, h: 480 });
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
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const cx = w / 2;
    const cy = h * 0.52;

    const sim: SimNode[] = nodes.map((n, i) => {
      const meta = KIND_META[n.kind];
      const angle = ((hash(n.id) % 360) * Math.PI) / 180 + i * 0.35;
      const ring =
        n.kind === "server"
          ? 0
          : n.kind === "metric"
            ? 70 + (hash(n.id) % 35)
            : n.kind === "player"
              ? 105 + (hash(n.id) % 45)
              : 130 + (hash(n.id) % 75);
      const baseR =
        n.size ??
        (n.kind === "server" ? 16 : n.kind === "player" ? 10 : n.kind === "metric" ? 9 : 8);
      // lieve variazione hue per nodo, restando nella famiglia del tipo
      const hueJitter = (hash(n.id + "h") % 24) - 12;
      return {
        ...n,
        x: n.kind === "server" ? cx : cx + Math.cos(angle) * ring + ((hash(n.id) % 10) - 5),
        y: n.kind === "server" ? cy : cy + Math.sin(angle) * ring + ((hash(n.id + "y") % 10) - 5),
        vx: 0,
        vy: 0,
        hue: (meta.hue + hueJitter + 360) % 360,
        phase: (hash(n.id) % 628) / 100,
        baseR,
      };
    });
    simRef.current = sim;

    const byKind = (k: NodeKind) => sim.filter((n) => n.kind === k);
    const links: Link[] = [];
    const server = sim.find((n) => n.kind === "server");

    if (server) {
      for (const n of sim) {
        if (n.id !== server.id) links.push({ source: server.id, target: n.id });
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
    // collegamenti densità extra tra player
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

    // sfondo viola scuro stile demo
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#0b0b1e");
    bg.addColorStop(0.35, "#12102a");
    bg.addColorStop(0.75, "#161033");
    bg.addColorStop(1, "#1a1035");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const sim = simRef.current;
    const hide = hiddenRef.current;
    const sel = selectedRef.current;
    const t = timeRef.current;
    const byId = new Map(sim.map((n) => [n.id, n]));
    const visible = (id: string) => {
      const n = byId.get(id);
      return Boolean(n && !hide.has(n.kind));
    };

    ctx.lineCap = "round";

    // link con gradient HSL
    for (const l of linksRef.current) {
      if (!visible(l.source) || !visible(l.target)) continue;
      const a = byId.get(l.source)!;
      const b = byId.get(l.target)!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      const maxD = Math.hypot(w, h);
      const closeness = 1 - dist / maxD;
      const isHot = sel && (sel === a.id || sel === b.id);
      const alpha = isHot
        ? 0.55
        : (0.12 + closeness * 0.14) * (0.9 + 0.1 * Math.sin(t * 0.6 + a.phase));

      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, hsl(a.hue, 100, 62, alpha));
      grad.addColorStop(1, hsl(b.hue, 100, 62, alpha));
      ctx.strokeStyle = grad;
      ctx.lineWidth = isHot ? 1.8 : 0.55 + closeness * 0.55;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodi
    for (const n of sim) {
      if (hide.has(n.kind)) continue;
      const pulse = Math.sin(t * 0.9 + n.phase) * 0.5 + 0.5;
      const r = n.baseR * (1 + Math.sin(t * 0.7 + n.phase) * 0.06);
      const dim = n.status === "offline" ? 0.35 : n.status === "error" ? 0.95 : 1;
      const isSel = sel === n.id;

      ctx.globalAlpha = dim;
      ctx.shadowColor = hsl(n.hue, 100, 62, 1);
      ctx.shadowBlur = (isSel ? 28 : 12 + pulse * 10) * dim;

      ctx.fillStyle = hsl(n.hue, 100, 62, 1);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      // bordo bianco sottile
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = isSel ? 2.2 : 1.1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.stroke();

      if (n.status === "error") {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // highlight specular
      ctx.fillStyle = `rgba(255,255,255,${0.25 + pulse * 0.12})`;
      ctx.beginPath();
      ctx.arc(n.x - r * 0.25, n.y - r * 0.28, r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // label
      if (n.kind === "server" || isSel || n.baseR >= 10) {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font =
          n.kind === "server"
            ? "bold 11px Inter, system-ui, sans-serif"
            : "10px 'Share Tech Mono', ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.label.slice(0, 18), n.x, n.y + r + 13);
      }
      ctx.globalAlpha = 1;
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      timeRef.current += 0.016;
      const sim = simRef.current;
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h * 0.52;
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
              ? 88
              : a.kind === b.kind
                ? 34
                : 46;
          if (dist < minD) {
            const f = ((minD - dist) / dist) * 0.11;
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
          n.vx += (cx - n.x) * 0.0012;
          n.vy += (cy - n.y) * 0.0012;
        }
      }

      for (const l of linksRef.current) {
        const a = sim.find((n) => n.id === l.source);
        const b = sim.find((n) => n.id === l.target);
        if (!a || !b || hide.has(a.kind) || hide.has(b.kind)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const ideal = a.kind === "server" || b.kind === "server" ? 118 : 68;
        const f = ((dist - ideal) / dist) * 0.007;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }

      for (const n of sim) {
        if (dragRef.current?.id === n.id) continue;
        if (hide.has(n.kind)) continue;
        n.vx *= 0.87;
        n.vy *= 0.87;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(28, Math.min(w - 28, n.x));
        n.y = Math.max(28, Math.min(h - 28, n.y));
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
      const r = n.baseR + 6;
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
  const selMeta = selectedNode ? KIND_META[selectedNode.kind] : null;

  // se clicchi un singolo giocatore, mostra anche gli altri player come contesto
  const playerRoster = useMemo(
    () => nodes.filter((n) => n.kind === "player").map((n) => n.label),
    [nodes],
  );

  return (
    <div className="relative h-[min(62vh,560px)] min-h-[420px] w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b0b1e]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Legenda colori = funzione */}
      <div className="absolute right-3 top-3 z-10 w-44 rounded-xl border border-white/10 bg-[rgba(12,10,28,0.75)] p-3 backdrop-blur-xl">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
          Colori · funzione
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
      </div>

      {/* Inspector ricco al click */}
      {selectedNode && selMeta ? (
        <div className="absolute left-3 top-3 z-10 max-w-[260px] rounded-xl border border-white/10 bg-[rgba(12,10,28,0.82)] p-3 text-xs backdrop-blur-xl">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Dettaglio nodo
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

          {/* Lista giocatori se nodo player o metrica players */}
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

          {selectedNode.kind === "plugin" ? (
            <p className="mt-2 text-[11px] text-white/50">
              Plugin nello stack server. I nomi predefiniti sono placeholder finché non c&apos;è API
              plugin Falix.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[200px] rounded-xl border border-white/10 bg-[rgba(12,10,28,0.55)] px-3 py-2 text-[11px] text-white/40 backdrop-blur-xl">
          Clicca un pallino per i dettagli
        </div>
      )}

      {/* Orbe M.I.N.E */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-2">
        <div
          className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/15 bg-[rgba(12,10,28,0.7)] backdrop-blur-xl"
          style={{
            boxShadow:
              serverOnline !== false
                ? "0 0 40px rgba(69,255,138,0.25), inset 0 0 24px rgba(69,255,138,0.06)"
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
            {serverOnline === false ? "offline" : "online"}
          </span>
        </div>
        <label className="flex flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">modello ia</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="max-w-[140px] rounded-full border border-white/15 bg-[rgba(12,10,28,0.85)] px-3 py-1 font-mono text-[10px] text-white/80 outline-none focus:border-white/40"
          >
            {GROQ_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-[rgba(14,12,28,0.7)] px-3 py-1.5 font-mono text-[10px] tracking-wide text-white/50 backdrop-blur-xl">
        {nodes.length} pallini · {linksRef.current.length || "…"} collegamenti · click = info
      </div>
    </div>
  );
}
