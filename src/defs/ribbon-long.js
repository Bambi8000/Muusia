import { EMPTY, mulberry32 } from "./helpers.js";

const TAU = Math.PI * 2;
const num = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback));
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// Physical periods keep the same rhythm when the roll gets longer. Cross
// sections stay perpendicular to the roll, so fitting never shortens the spine.
export function longRibbon(p, ctx, palette) {
  const W = num(ctx.W, 0, 0, 100000), H = num(ctx.H, 0, 0, 100000);
  const m = num(p.margin, 12, 0, Math.min(W, H) / 2);
  const horizontal = p.orientation === "Horizontal";
  const length = (horizontal ? W : H) - 2 * m, across = (horizontal ? H : W) - 2 * m;
  if (length < 1 || across < 1) return EMPTY;
  const form = p.longForm || "Pleated", channels = form === "Channels";
  const K = Math.round(num(p.lines, 24, 1, 200));
  const width = num(p.width, 28, 0.1, across);
  const ripple = num(p.ripple, 0.6, 0, Math.max(0, (across - width) / 2));
  const wander = num(p.wander, 45, 0, Math.max(0, (across - width) / 2 - ripple));
  const variation = num(p.widthVar, 0.8, 0, 1), taper = num(p.taper, 0.8, 0, 1);
  const tail = num(p.tailLength, 120, 1, length / 2);
  // At extreme densities coarsen every period together instead of losing the
  // far end of a filament or aliasing the remaining bends into sharp zigzags.
  const maxN = Math.floor(80000 / K) - 1;
  const minPeriod = length / maxN * 24;
  const bendPeriod = Math.max(minPeriod, num(p.bendLength, 700, 20, 10000));
  const swellPeriod = Math.max(minPeriod, num(p.swellLength, 420, 20, 10000));
  const foldPeriod = Math.max(minPeriod, num(p.foldLength, 600, 20, 10000));
  const ripplePeriod = Math.max(minPeriod, bendPeriod / 6);
  const samplePeriod = Math.min(bendPeriod, swellPeriod, ripplePeriod, form === "Pleated" ? foldPeriod : Infinity);
  const N = Math.min(maxN, Math.max(2, Math.ceil(length / Math.min(1.2, samplePeriod / 24))));
  const rng = mulberry32(num(p.seed, 27, -1e9, 1e9) * 1427 + 83);
  const phase = rng() * TAU, phase2 = rng() * TAU;
  const toXY = (u, s) => horizontal ? [m + s, H / 2 + u] : [W / 2 + u, m + s];
  const frame = s => {
    const envelope = (1 - taper) + taper * smooth(Math.min(s, length - s) / tail);
    const swell = (1 + Math.sin(TAU * s / swellPeriod + phase2)) / 2;
    const w = width * (1 - variation + variation * (0.08 + 0.92 * swell ** 2)) * envelope;
    const u = wander * (0.8 * Math.sin(TAU * s / bendPeriod + phase) + 0.2 * Math.sin(TAU * s / (bendPeriod * 1.7) + phase2))
      + ripple * Math.sin(TAU * s / ripplePeriod + phase2);
    const fold = form === "Pleated" ? Math.cos(TAU * s / foldPeriod + phase2) : 1;
    return { u, w, fold };
  };
  const point = (s, v) => { const f = frame(s); return toXY(f.u + v * f.w * f.fold / 2, s); };
  const penAt = v => palette[Math.min(palette.length - 1, Math.floor(Math.max(0, Math.min(1, (v + 1) / 2)) * palette.length))];
  const pockets = [];
  if (channels) {
    const spacing = Math.max(num(p.pocketSpacing, 500, 20, 10000), length / 160, length / N * 24);
    for (let s = spacing / 2; s < length - spacing * 0.2; s += spacing) {
      pockets.push({ s, span: spacing * 0.2, v: (pockets.length % 2 ? 1 : -1) * 0.2, radius: num(p.pocketSize, 0.65, 0.1, 0.9) * 0.65 });
    }
  }
  const radiusAt = (s, q) => { const t = (s - q.s) / q.span; return Math.abs(t) < 1 ? q.radius * (1 - t * t) ** 2 : 0; };
  const deflect = (s, v) => {
    // Pockets do not overlap along the spine; at most one changes a section.
    for (const q of pockets) {
      if (s < q.s - q.span) break;
      if (s > q.s + q.span) continue;
      const r = radiusAt(s, q);
      return v <= q.v ? -1 + (v + 1) * (q.v - r + 1) / (q.v + 1) : q.v + r + (v - q.v) * (1 - q.v - r) / (1 - q.v);
    }
    return v;
  };
  const paths = [];
  for (let k = 0; k < K; k++) {
    const v = K === 1 ? 0 : 2 * k / (K - 1) - 1;
    const pts = Array.from({ length: N + 1 }, (_, i) => { const s = length * i / N; return point(s, deflect(s, v)); });
    paths.push({ pts, closed: false, layer: penAt(v) });
  }
  if (channels && ["Outline", "Hatch"].includes(p.pocketFill)) {
    const samples = Math.min(48, Math.max(8, Math.floor(10000 / Math.max(1, pockets.length * 2))));
    const pitch = Math.max(num(p.pocketPitch, 0.3, 0.1, 10), pockets.reduce((sum, q) => sum + q.span * 2, 0) / 3900);
    for (const q of pockets) {
      const pts = [];
      for (let i = 0; i <= samples; i++) { const s = q.s - q.span + 2 * q.span * i / samples; pts.push(point(s, q.v - radiusAt(s, q))); }
      for (let i = samples - 1; i > 0; i--) { const s = q.s - q.span + 2 * q.span * i / samples; pts.push(point(s, q.v + radiusAt(s, q))); }
      paths.push({ pts, closed: true, layer: penAt(q.v) });
      if (p.pocketFill === "Hatch") {
        // Intersect the emitted polygon itself, so coarse budget sampling can
        // never leave hatch ends outside the actual pocket outline.
        const local = pts.map(([x, y]) => horizontal ? [y, x - m] : [x, y - m]);
        for (let s = q.s - q.span + pitch / 2; s < q.s + q.span; s += pitch) {
          const xs = [];
          for (let i = 0, j = local.length - 1; i < local.length; j = i++) {
            const a = local[j], b = local[i];
            if ((a[1] <= s && b[1] > s) || (b[1] <= s && a[1] > s)) xs.push(a[0] + (s - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
          }
          xs.sort((a, b) => a - b);
          for (let i = 1; i < xs.length; i += 2) if (xs[i] - xs[i - 1] > 1e-8) {
            const xy = x => horizontal ? [m + s, x] : [x, m + s];
            paths.push({ pts: [xy(xs[i - 1]), xy(xs[i])], closed: false, layer: penAt(q.v) });
          }
        }
      }
    }
  }
  return { paths };
}
