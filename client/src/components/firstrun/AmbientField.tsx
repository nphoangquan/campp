import { useEffect, useRef } from 'react';

/*
 * The black ground, alive: a slow pixel cloud along the top edge that keeps
 * re-dithering itself, and sparse pixel dust drifting down through the dark.
 * Vivid colour appears only as a minority of the dust, so the page stays
 * black and white with colour as embellishment.
 */

const CELL = 14; // pixel cloud cell size
const CLOUD_DEPTH = 210; // how far the cloud reaches down from the top
const FPS = 30;

/* Accent dust: the five-hue set (blue, purple, pink, red, gold) */
const DUST_COLORS = ['#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#e4ae39'];

/* Cloud and dust tones come from the active theme, so the field works on light and dark grounds. */
function themeTones() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    cloud: dark ? ['#16171a', '#1c1e21', '#232528', '#2a2d30'] : [v('--line'), v('--line-strong'), '#bcc6d0', '#b0bac5'],
    mote: v('--fg') || (dark ? '#e9edf1' : '#121314'),
    dark,
  };
}

interface Mote {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  color: string;
  alpha: number;
}

function makeMote(w: number, h: number, anywhere: boolean, mote = '#ffffff'): Mote {
  const vivid = Math.random() < 0.28;
  return {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : -8 - Math.random() * 40,
    size: Math.random() < 0.45 ? 2 : Math.random() < 0.75 ? 3 : 4,
    speed: 8 + Math.random() * 22,
    sway: 4 + Math.random() * 10,
    phase: Math.random() * Math.PI * 2,
    color: vivid ? DUST_COLORS[(Math.random() * DUST_COLORS.length) | 0] : mote,
    alpha: vivid ? 0.5 + Math.random() * 0.35 : 0.12 + Math.random() * 0.3,
  };
}

/* Cheap smooth field: a few drifting sine waves, -1..1 */
function field(x: number, y: number, t: number) {
  return (
    Math.sin(x * 0.011 + t * 0.21) * 0.5 +
    Math.sin(x * 0.023 - y * 0.017 - t * 0.13) * 0.3 +
    Math.sin((x + y) * 0.037 + t * 0.34) * 0.2
  );
}

/* Stable per-cell hash, 0..1, so the dither pattern holds still between ticks */
function hash(i: number, j: number) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export default function AmbientField({ contained = false }: { contained?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0;
    let h = 0;
    let motes: Mote[] = [];
    let raf = 0;
    let last = 0;
    let t = Math.random() * 100;
    let tones = themeTones();

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      const count = Math.round((w * h) / 8500);
      motes = Array.from({ length: count }, () => makeMote(w, h, true, tones.mote));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Pixel cloud: denser at the top, dissolving downward, re-dithering slowly
      const cols = Math.ceil(w / CELL);
      const rows = Math.ceil(CLOUD_DEPTH / CELL);
      for (let j = 0; j < rows; j++) {
        const depth = j / rows; // 0 at top, 1 at the cloud's foot
        for (let i = 0; i < cols; i++) {
          const x = i * CELL;
          const y = j * CELL;
          const v = field(x, y, t) * 0.5 + 0.5; // 0..1
          const threshold = 0.34 + depth * 0.8 + (hash(i, j) - 0.5) * 0.35;
          if (v < threshold) continue;
          const tone = Math.min(tones.cloud.length - 1, Math.floor((v - threshold) * 9 + (1 - depth) * 1.5));
          ctx.fillStyle = tones.cloud[Math.max(0, tone)];
          ctx.fillRect(x, y, CELL - 1, CELL - 1);
        }
      }

      // Pixel dust drifting down
      for (const m of motes) {
        const px = Math.round(m.x + Math.sin(t * 0.6 + m.phase) * m.sway);
        const py = Math.round(m.y);
        const fadeIn = Math.min(1, (m.y + 8) / 60);
        const fadeOut = Math.min(1, (h - m.y) / 80);
        ctx.globalAlpha = m.alpha * Math.max(0, Math.min(fadeIn, fadeOut));
        ctx.fillStyle = m.color;
        ctx.fillRect(px, py, m.size, m.size);
      }
      ctx.globalAlpha = 1;
    };

    const step = (dt: number) => {
      t += dt;
      for (let k = 0; k < motes.length; k++) {
        const m = motes[k];
        m.y += m.speed * dt;
        if (m.y > h + 8) motes[k] = makeMote(w, h, false, tones.mote);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / FPS) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      step(dt);
      draw();
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (reduce.matches || document.hidden) {
        draw(); // one still frame
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    start();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce.matches) draw();
    });
    ro.observe(canvas);
    document.addEventListener('visibilitychange', start);
    // Re-tone when the theme flips
    const mo = new MutationObserver(() => {
      tones = themeTones();
      for (const m of motes) if (!DUST_COLORS.includes(m.color)) m.color = tones.mote;
      if (reduce.matches) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    reduce.addEventListener('change', start);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', start);
      reduce.removeEventListener('change', start);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`${contained ? 'absolute' : 'fixed'} inset-0 w-full h-full pointer-events-none [image-rendering:pixelated]`}
    />
  );
}
