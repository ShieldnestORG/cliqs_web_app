import { useEffect, useRef } from "react";

/**
 * GridSpotlight — global "living dot matrix" background with a cursor
 * spotlight and a comet trail (the Coherence Daddy brand background effect).
 *
 * A single fixed <canvas> behind everything (z-index:-1, pointer-events:none)
 * that draws three layers each frame:
 *   1. a dot lattice whose dots slowly drift in size — the "bigness" migrates
 *      across the field, a calm hypnotic shimmer (always animating, slowly);
 *   2. dots near the cursor brightened to a neutral off-white (the spotlight);
 *   3. a fading comet trail of small neutral dots along the pointer's path.
 *
 * The base canvas colour (#0E0E10) lives on <html> and body/page wrappers are
 * transparent (see styles/globals.css @layer base), so this layer shows
 * through on every page.
 *
 * Cost control: ~30fps cap, paused when the tab is hidden, and frozen to a
 * single static frame under prefers-reduced-motion. The cursor spotlight +
 * trail only run for a fine pointer (mouse) — the drift still renders on
 * touch.
 */
const CELL = 26; // dot spacing (px)
const RADIUS = 160; // spotlight reach (px)
const TRAIL_LIFE = 650; // comet-trail dot lifetime (ms)

const GridSpotlight = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Resizing clears the buffer; with reduced motion nothing redraws it.
      if (reduce) draw(0);
    };
    resize();

    let mx = -9999;
    let my = -9999;
    const trail: { x: number; y: number; t: number }[] = [];

    // Translucent cards (bg-card/40 etc.) sit ABOVE this z-index:-1 canvas, so
    // the cursor spotlight bleeds through them. Suppress the spotlight + trail
    // whenever the pointer is over any element that paints its own
    // (semi-)opaque background — a card, panel, header, button — so the
    // spotlight only lights the transparent page background. Walk up to the
    // nearest painted surface (a card's own bg lives on the card div, not the
    // text under the cursor). Cached per hovered element so getComputedStyle
    // runs on element change, not every move.
    const SURFACE_ALPHA = 0.12;
    // Alpha of a computed background-color, robust across serialisation
    // formats: modern "oklab(L a b / A)" / "rgb(r g b / A)" put alpha after a
    // slash; legacy "rgba(r,g,b,a)" puts it 4th; bare "rgb()/oklab()" and named
    // colours have no alpha channel (opaque → 1); "transparent" → 0. Parsing
    // the alpha directly avoids being fooled by digits in a colour-space name
    // (e.g. display-p3).
    const bgAlpha = (bg: string) => {
      if (!bg || bg === "transparent") return 0;
      const slash = bg.indexOf("/");
      if (slash !== -1) return parseFloat(bg.slice(slash + 1)) || 0;
      const open = bg.indexOf("(");
      if (open !== -1) {
        const parts = bg.slice(open + 1, bg.lastIndexOf(")")).split(",");
        if (parts.length >= 4) return parseFloat(parts[3]) || 0;
      }
      return 1; // opaque (rgb/oklab/named, no alpha channel)
    };
    const paintsSurface = (start: Element | null) => {
      for (let el = start; el && el !== document.body; el = el.parentElement) {
        if (bgAlpha(getComputedStyle(el).backgroundColor) >= SURFACE_ALPHA) return true;
      }
      return false;
    };
    let hoverEl: Element | null = null;
    let hoverBlocks = false;

    // Per-dot size in [0,1] from a smooth 2D value-noise field (NOT a
    // directional wave — a wave's peaks line up on diagonals). The sample
    // point slowly orbits with time, so the bigness clusters into scattered
    // blobs that gently migrate; peaked (pow) so only a few dots are large.
    const frac = (x: number) => x - Math.floor(x);
    const hash2 = (ix: number, iy: number) => frac(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453);
    const noise2 = (x: number, y: number) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = hash2(ix, iy);
      const b = hash2(ix + 1, iy);
      const c = hash2(ix, iy + 1);
      const d = hash2(ix + 1, iy + 1);
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    };
    const bigness = (gx: number, gy: number, t: number) => {
      const ox = 0.6 * Math.sin(t * 0.0001);
      const oy = 0.6 * Math.cos(t * 0.00008);
      const n = noise2(gx * 0.022 + ox, gy * 0.022 + oy);
      return Math.pow(n, 2.6);
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const t = reduce ? 0 : now;
      for (let gx = 0; gx <= w; gx += CELL) {
        for (let gy = 0; gy <= h; gy += CELL) {
          const b = bigness(gx, gy, t);
          let r = 1.0 + 0.6 * b;
          const d = mx > -1000 ? Math.hypot(gx - mx, gy - my) : 99999;
          const k = d < RADIUS ? 1 - d / RADIUS : 0;
          if (k > 0) {
            ctx.fillStyle = `rgba(242,241,237,${(0.05 + 0.18 * b + k * k * 0.66).toFixed(3)})`;
            r += k * 0.6;
          } else {
            ctx.fillStyle = `rgba(242,241,237,${(0.05 + 0.18 * b).toFixed(3)})`;
          }
          ctx.beginPath();
          ctx.arc(gx, gy, r, 0, 6.2832);
          ctx.fill();
        }
      }
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i];
        const age = now - p.t;
        if (age > TRAIL_LIFE) {
          trail.splice(i, 1);
          continue;
        }
        const a = 1 - age / TRAIL_LIFE;
        ctx.beginPath();
        ctx.fillStyle = `rgba(242,241,237,${(a * 0.6).toFixed(3)})`;
        ctx.arc(p.x, p.y, 0.4 + a * 1.2, 0, 6.2832);
        ctx.fill();
      }
    };

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30fps cap
      last = now;
      draw(now);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target !== hoverEl) {
        hoverEl = target;
        hoverBlocks = paintsSurface(target);
      }
      if (hoverBlocks) {
        // Over a card/surface — kill the spotlight so it can't show through.
        mx = -9999;
        my = -9999;
        return;
      }
      mx = e.clientX;
      my = e.clientY;
      const lastP = trail[trail.length - 1];
      const tnow = performance.now();
      if (!lastP || Math.hypot(mx - lastP.x, my - lastP.y) > 11) {
        trail.push({ x: mx, y: my, t: tnow });
      }
    };
    const onLeave = () => {
      mx = -9999;
      my = -9999;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!reduce) start();
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (fine) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }

    if (reduce) {
      draw(0); // single static frame — respect reduced motion
    } else {
      start();
    }

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
};

export default GridSpotlight;
