"use client";
import { useEffect, useRef } from "react";

type P = { x: number; y: number; vx: number; vy: number; r: number };

/**
 * Rete neurale ambientale: pallini che derivano lenti, tutti collegati da
 * fili quando vicini — stile ScrollCraft (solo transform/opacity del canvas).
 * VibeSec: puramente decorativo, nessun dato utente dentro.
 * Accessibilità: fermo con prefers-reduced-motion, pausa a tab nascosto.
 */
export function NeuralNet({
  active = true,
  density = 1,
  className,
}: {
  active?: boolean;
  density?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let pts: P[] = [];
    const mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function seed() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, Math.max(28, (w * h) / 14000)) * density);
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1 + Math.random() * 1.6,
      }));
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h);
      const LINK = 130;
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }
      ctx!.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const alpha = (1 - Math.sqrt(d2) / LINK) * 0.35;
          ctx!.strokeStyle = `rgba(125, 211, 252, ${alpha.toFixed(3)})`;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
        const mdx = a.x - mouse.x;
        const mdy = a.y - mouse.y;
        const md = Math.hypot(mdx, mdy);
        const glow = md < 140 ? 1 - md / 140 : 0;
        ctx!.fillStyle = `rgba(186, 230, 253, ${(0.35 + glow * 0.55).toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(a.x, a.y, a.r + glow * 1.6, 0, Math.PI * 2);
        ctx!.fill();
      }
      if (!reduced) raf = requestAnimationFrame(frame);
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }
    function onVis() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (active && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    }

    seed();
    frame();
    const ro = new ResizeObserver(() => {
      seed();
      if (reduced) frame();
    });
    ro.observe(canvas);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, density]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
