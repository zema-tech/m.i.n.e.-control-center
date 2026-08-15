import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GraphNode = {
  id: string;
  label: string;
  kind: "server" | "player" | "world" | "plugin";
  status: "online" | "offline" | "error";
  detail?: string;
};

type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Link = { source: string; target: string };

const COLORS = {
  online: "#00ff41",
  offline: "#6b7280",
  error: "#ef4444",
  link: "rgba(0, 255, 65, 0.25)",
  text: "#00ff41",
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function NeuralGraph({
  nodes,
  onSelect,
}: {
  nodes: GraphNode[];
  onSelect?: (node: GraphNode | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SimNode[]>([]);
  const linksRef = useRef<Link[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const sizeRef = useRef({ w: 600, h: 320 });

  const nodeKey = useMemo(() => nodes.map((n) => n.id).join(","), [nodes]);

  useEffect(() => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const cx = w / 2;
    const cy = h / 2;
    const server = nodes.find((n) => n.kind === "server");
    const others = nodes.filter((n) => n.kind !== "server");

    const sim: SimNode[] = nodes.map((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const r = n.kind === "server" ? 0 : 80 + (hash(n.id) % 60);
      return {
        ...n,
        x: n.kind === "server" ? cx : cx + Math.cos(angle) * r,
        y: n.kind === "server" ? cy : cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    simRef.current = sim;

    const links: Link[] = [];
    if (server) {
      for (const o of others) links.push({ source: server.id, target: o.id });
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

    const sim = simRef.current;
    const byId = new Map(sim.map((n) => [n.id, n]));

    // links
    ctx.strokeStyle = COLORS.link;
    ctx.lineWidth = 1;
    for (const l of linksRef.current) {
      const a = byId.get(l.source);
      const b = byId.get(l.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes
    for (const n of sim) {
      const r = n.kind === "server" ? 14 : n.kind === "player" ? 8 : 7;
      const color = COLORS[n.status];
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = n.status === "offline" ? 0.5 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (selected === n.id) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = COLORS.text;
      ctx.font = "10px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(n.label.slice(0, 12), n.x, n.y + r + 12);
    }
  }, [selected]);

  // simple force simulation loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const sim = simRef.current;
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;

      // repulsion
      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const a = sim[i]!;
          const b = sim[j]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD = a.kind === "server" || b.kind === "server" ? 70 : 40;
          if (dist < minD) {
            const f = ((minD - dist) / dist) * 0.15;
            dx *= f;
            dy *= f;
            a.vx += dx;
            a.vy += dy;
            b.vx -= dx;
            b.vy -= dy;
          }
        }
      }

      // spring to center for server, mild attraction along links
      for (const n of sim) {
        if (n.kind === "server") {
          n.vx += (cx - n.x) * 0.02;
          n.vy += (cy - n.y) * 0.02;
        } else {
          n.vx += (cx - n.x) * 0.002;
          n.vy += (cy - n.y) * 0.002;
        }
      }

      for (const l of linksRef.current) {
        const a = sim.find((n) => n.id === l.source);
        const b = sim.find((n) => n.id === l.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const ideal = 100;
        const f = ((dist - ideal) / dist) * 0.01;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }

      for (const n of sim) {
        if (dragRef.current?.id === n.id) continue;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(20, Math.min(w - 20, n.x));
        n.y = Math.max(20, Math.min(h - 20, n.y));
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
      sizeRef.current = { w: el.clientWidth || 600, h: 320 };
    });
    ro.observe(el);
    sizeRef.current = { w: el.clientWidth || 600, h: 320 };
    return () => ro.disconnect();
  }, []);

  function hitTest(mx: number, my: number): SimNode | null {
    for (let i = simRef.current.length - 1; i >= 0; i--) {
      const n = simRef.current[i]!;
      const r = n.kind === "server" ? 16 : 10;
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

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-md border border-border bg-background/50">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 flex gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00ff41]" /> online
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#6b7280]" /> offline
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#ef4444]" /> error
        </span>
      </div>
    </div>
  );
}
