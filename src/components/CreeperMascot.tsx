import { useCallback, useEffect, useRef, useState } from "react";
import { CREEPER_MASCOT_SRC } from "@/lib/creeper-asset";
import { cn } from "@/lib/utils";

type Pos = { x: number; y: number };

/**
 * Mascotte Creeper M.I.N.E — PNG trasparente, trascinabile, esplode al tocco.
 */
export function CreeperMascot({ className }: { className?: string }) {
  const [pos, setPos] = useState<Pos>({ x: 24, y: 140 });
  const [dragging, setDragging] = useState(false);
  const [exploding, setExploding] = useState(false);
  const [face, setFace] = useState<"idle" | "happy" | "boom">("idle");
  const [loaded, setLoaded] = useState(false);
  const [bob, setBob] = useState(0);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startPtr = useRef({ x: 0, y: 0 });
  const size = 112;

  useEffect(() => {
    if (dragging || exploding) return;
    const id = window.setInterval(() => {
      setBob((b) => (b + 1) % 200);
      setPos((p) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const t = Date.now() / 1000;
        const dx = Math.sin(t / 1.8) * 1.1;
        const dy = Math.cos(t / 2.2) * 0.7;
        return {
          x: Math.min(Math.max(8, p.x + dx), Math.max(8, w - size - 8)),
          y: Math.min(Math.max(72, p.y + dy), Math.max(72, h - size - 32)),
        };
      });
    }, 32);
    return () => clearInterval(id);
  }, [dragging, exploding]);

  const explode = useCallback(() => {
    if (exploding) return;
    setExploding(true);
    setFace("boom");
    window.setTimeout(() => {
      setExploding(false);
      setFace("happy");
      setPos({
        x: 32 + Math.random() * Math.max(40, window.innerWidth - 160),
        y: 90 + Math.random() * Math.max(40, window.innerHeight - 220),
      });
      window.setTimeout(() => setFace("idle"), 1400);
    }, 750);
  }, [exploding]);

  function onPointerDown(e: React.PointerEvent) {
    if (exploding) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setFace("happy");
    startPtr.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || exploding) return;
    setPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    setDragging(false);
    const moved =
      Math.abs(e.clientX - startPtr.current.x) +
      Math.abs(e.clientY - startPtr.current.y);
    if (moved < 12) explode();
    else setFace("idle");
  }

  const floatY = exploding ? 0 : Math.sin(bob / 10) * 7;

  return (
    <div className={cn("pointer-events-none fixed inset-0 z-40", className)}>
      {exploding
        ? Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="creeper-particle absolute h-2.5 w-2.5 rounded-sm bg-emerald-400"
              style={
                {
                  left: pos.x + size / 2,
                  top: pos.y + size / 2,
                  "--a": `${(i / 16) * 360}deg`,
                  "--d": `${36 + (i % 6) * 16}px`,
                } as React.CSSProperties
              }
            />
          ))
        : null}

      <button
        type="button"
        aria-label="Mascotte Creeper — trascina o tocca per far esplodere"
        className={cn(
          "pointer-events-auto absolute touch-none select-none bg-transparent p-0 border-0",
          "cursor-grab active:cursor-grabbing",
          exploding && "creeper-explode",
        )}
        style={{
          left: pos.x,
          top: pos.y,
          width: size,
          height: size,
          transform: `translateY(${floatY}px) scale(${dragging ? 1.1 : 1})`,
          transition: dragging ? "none" : "transform 0.12s ease",
          background: "transparent",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragging(false)}
      >
        <img
          src={CREEPER_MASCOT_SRC}
          alt="Creeper — mascotte M.I.N.E"
          draggable={false}
          width={size}
          height={size}
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-full w-full object-contain object-center",
            "drop-shadow-[0_10px_24px_rgba(16,185,129,0.45)]",
            face === "happy" && "creeper-wiggle",
            exploding && "opacity-0",
            !loaded && "opacity-0",
            loaded && "opacity-100 transition-opacity duration-300",
          )}
          style={{ backgroundColor: "transparent", background: "none" }}
        />
        {!exploding ? (
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-400/35 bg-black/55 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-sm">
            {dragging ? "tienimi…" : "tocca · trascina"}
          </span>
        ) : (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-xl font-bold tracking-wide text-emerald-300 drop-shadow-[0_0_12px_#34d399]">
            BOOM!
          </span>
        )}
      </button>
    </div>
  );
}
