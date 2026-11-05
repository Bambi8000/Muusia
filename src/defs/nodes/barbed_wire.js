import { Pin, EMPTY, PENS, mulberry32 } from "../helpers.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-7;

// Keep the clipped endpoints exact, including when a long barb crosses the edge.
function clipSegment(a, b, x0, y0, x1, y1) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let lo = 0, hi = 1;
  for (const [v, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (Math.abs(v) < 1e-12) { if (q < 0) return null; continue; }
    const t = q / v;
    if (v < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
    if (lo > hi) return null;
  }
  return [[a[0] + lo * dx, a[1] + lo * dy], [a[0] + hi * dx, a[1] + hi * dy]];
}

function route(pts, closed) {
  const points = [];
  for (const q of pts) {
    if (!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) return null;
    if (!points.length || !same(q, points[points.length - 1])) points.push([q[0], q[1]]);
  }
  if (closed && points.length > 2 && same(points[0], points[points.length - 1])) points.pop();
  if (points.length < (closed ? 3 : 2)) return null;
  const seq = closed ? [...points, points[0]] : points;
  const distances = [0];
  for (let i = 1; i < seq.length; i++) distances.push(distances[i - 1] + Math.hypot(seq[i][0] - seq[i - 1][0], seq[i][1] - seq[i - 1][1]));
  const length = distances[distances.length - 1];
  if (length < 0.5) return null;
  const at = s => {
    s = closed ? ((s % length) + length) % length : clamp(s, 0, length);
    let lo = 0, hi = distances.length - 2;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (distances[mid + 1] < s) lo = mid + 1; else hi = mid; }
    const i = lo, span = distances[i + 1] - distances[i] || 1, t = (s - distances[i]) / span;
    const a = seq[i], b = seq[i + 1], tx = (b[0] - a[0]) / span, ty = (b[1] - a[1]) / span;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx, ty, nx: -ty, ny: tx };
  };
  return { length, at, closed };
}

export default {
  key: "barbed_wire",
  name: "Barbed Wire",
  cat: "mod",
  group: "deform",
  desc: "Turns every wired line into barbed wire. Twisted pair draws two crossing strands and hooked barb pairs. Alternating thorns keeps one strand and adds sharp hooks. Razor blades keeps one strand and adds pointed closed blades. Spacing, barb length, lean angle, side, strand gap, twist pitch, blade width and variation shape the result. The source path's pen is inherited by default. Closed paths wrap without a twist seam. Clip to paper cuts any barbs that would extend past the margin. Very dense input is thinned evenly to bound the drawing; each retained path is processed in full.",
  ins: [Pin("paths", "Line")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Type", type: "select", options: ["Twisted pair", "Alternating thorns", "Razor blades"], def: "Twisted pair" },
    { key: "spacing", label: "Barb spacing mm", type: "slider", min: 3, max: 60, step: 0.5, def: 12 },
    { key: "length", label: "Barb length mm", type: "slider", min: 1, max: 20, step: 0.5, def: 5 },
    { key: "angle", label: "Barb lean °", type: "slider", min: -60, max: 60, step: 1, def: 22 },
    { key: "side", label: "Barb sides", type: "select", options: ["Both", "Alternate", "Left", "Right"], def: "Both" },
    { key: "gap", label: "Strand gap mm", type: "slider", min: 0.2, max: 6, step: 0.1, def: 1.2, showIf: p => p.mode === "Twisted pair" },
    { key: "twist", label: "Twist pitch mm", type: "slider", min: 2, max: 40, step: 0.5, def: 9, showIf: p => p.mode === "Twisted pair" },
    { key: "blade", label: "Blade width mm", type: "slider", min: 0.5, max: 8, step: 0.1, def: 2.2, showIf: p => p.mode === "Razor blades" },
    { key: "vary", label: "Variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
    { key: "clip", label: "Clip to paper", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 0, showIf: p => p.clip },
    { key: "inherit", label: "Inherit source pens", type: "check", def: true },
    { key: "layer", label: "Pen", type: "pen", def: 0, showIf: p => !p.inherit },
    { key: "seed", label: "Seed", type: "seed", def: 17 },
  ],
  overlay(p, ctx) {
    if (!p.clip || !ctx) return [];
    const m = clamp(p.margin || 0, 0, Math.min(ctx.W, ctx.H) / 2);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths?.length) return { paths: [] };
    const all = src.paths.map(q => {
      const r = q?.pts && route(q.pts, !!q.closed);
      return r ? { ...r, layer: p.inherit ? (Number.isInteger(q.layer) ? q.layer : 0) : clamp(Math.round(p.layer || 0), 0, PENS.length - 1) } : null;
    }).filter(Boolean);
    if (!all.length) return { paths: [] };
    // Thinning is even across paths; no path is cut halfway through its motif.
    const stride = Math.max(1, Math.ceil(all.length / 5000));
    const routes = all.filter((_, i) => i % stride === 0);
    const total = routes.reduce((n, r) => n + r.length, 0);
    const twisted = p.mode === "Twisted pair", razor = p.mode === "Razor blades";
    const gap = clamp(p.gap ?? 1.2, 0.2, 6), twist = clamp(p.twist ?? 9, 2, 40);
    const barbLength = clamp(p.length ?? 5, 1, 20), lean = Math.tan(clamp(p.angle ?? 22, -60, 60) * Math.PI / 180);
    const vary = clamp(p.vary ?? 0, 0, 1), spacing = Math.max(3, p.spacing || 12, total / 3500);
    const step = Math.max(0.35, twisted ? twist / 14 : 0.8, total * (twisted ? 2 : 1) / 60000);
    const margin = ctx ? clamp(p.margin || 0, 0, Math.min(ctx.W, ctx.H) / 2) : 0;
    const box = ctx && p.clip ? [margin, margin, ctx.W - margin, ctx.H - margin] : null;
    const paths = [];
    const emit = (pts, closed, layer) => {
      if (pts.length < 2) return;
      if (!box) { paths.push({ pts, closed, layer }); return; }
      const [x0, y0, x1, y1] = box;
      if (pts.every(q => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1)) { paths.push({ pts, closed, layer }); return; }
      const seq = closed ? [...pts, pts[0]] : pts;
      let run = [];
      const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer }); run = []; };
      for (let i = 1; i < seq.length; i++) {
        const seg = clipSegment(seq[i - 1], seq[i], x0, y0, x1, y1);
        if (!seg || same(seg[0], seg[1])) { flush(); continue; }
        if (run.length && !same(run[run.length - 1], seg[0])) flush();
        if (!run.length) run.push(seg[0]);
        if (!same(run[run.length - 1], seg[1])) run.push(seg[1]);
      }
      flush();
    };
    routes.forEach((r, ri) => {
      const rng = mulberry32(((p.seed || 0) * 7919 + ri * 104729 + 17) >>> 0);
      if (twisted) {
        const periods = Math.max(1, Math.round(r.length / twist));
        const count = Math.max(r.closed ? 3 : 1, Math.ceil(r.length / step));
        for (const sign of [1, -1]) {
          const pts = [];
          for (let i = 0; i < (r.closed ? count : count + 1); i++) {
            const s = r.length * i / count, q = r.at(s);
            const off = sign * gap * 0.5 * Math.cos(2 * Math.PI * periods * s / r.length);
            pts.push([q.x + q.nx * off, q.y + q.ny * off]);
          }
          emit(pts, r.closed, r.layer);
        }
      } else {
        const count = Math.max(r.closed ? 3 : 1, Math.ceil(r.length / step));
        const pts = [];
        for (let i = 0; i < (r.closed ? count : count + 1); i++) { const q = r.at(r.length * i / count); pts.push([q.x, q.y]); }
        emit(pts, r.closed, r.layer);
      }
      const n = Math.floor(r.length / spacing);
      for (let k = 0; k < n; k++) {
        const s = (k + 0.5 + (rng() - 0.5) * 0.5 * vary) * r.length / n;
        const q = r.at(s), len = barbLength * (1 + (rng() - 0.5) * 0.7 * vary);
        const sides = p.side === "Left" ? [1] : p.side === "Right" ? [-1] : p.side === "Alternate" ? [k % 2 ? -1 : 1] : [1, -1];
        const point = (along, across) => [q.x + q.tx * along + q.nx * across, q.y + q.ty * along + q.ny * across];
        for (const side of sides) {
          if (razor) {
            const w = clamp(p.blade ?? 2.2, 0.5, 8), sl = lean * len * 0.35;
            emit([point(-w * 0.55, 0), point(-w * 0.18 + sl, side * len * 0.88), point(sl, side * len), point(w * 0.55, 0)], true, r.layer);
          } else if (twisted) {
            emit([point(-len * 0.36, 0), point(lean * len * 0.35, side * len), point(len * 0.36, 0)], false, r.layer);
          } else {
            emit([point(0, 0), point(lean * len * 0.32, side * len * 0.65), point(lean * len * 0.32 + len * 0.26, side * len)], false, r.layer);
          }
        }
      }
    });
    return { paths };
  },
};
