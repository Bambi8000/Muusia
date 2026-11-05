import { Pin, EMPTY, applyStyle } from "../helpers.js";

// Smooth along travel distance before spline interpolation. Dense freehand
// samples otherwise have such short segments that changing the spline alone
// barely changes the visible stroke.
export function filterStroke(points, closed, amount, radius) {
  if (amount <= 0 || radius <= 0 || points.length < 3) return points;
  const n = points.length, reach = radius * 3;
  return points.map((p, i) => {
    if (!closed && (i === 0 || i === n - 1)) return p;
    let sx = p[0], sy = p[1], total = 1;
    for (const direction of [-1, 1]) {
      let previous = p, distance = 0;
      const limit = closed ? Math.floor((n - 1) / 2) : n - 1;
      for (let step = 1; step <= limit; step++) {
        const j = i + direction * step;
        if (!closed && (j < 0 || j >= n)) break;
        const q = points[(j + n) % n];
        distance += Math.hypot(q[0] - previous[0], q[1] - previous[1]);
        if (distance > reach) break;
        const weight = Math.exp(-.5 * (distance / radius) ** 2);
        sx += q[0] * weight; sy += q[1] * weight; total += weight;
        previous = q;
      }
    }
    return [p[0] * (1 - amount) + sx / total * amount,
      p[1] * (1 - amount) + sy / total * amount];
  });
}

export default {
  key: "drawn_path",
  name: "Draw Path",
  cat: "gen",
  group: "textimg",
  desc: "Draw an open line or a closed shape directly in the node. Click to place and drag control points, or switch the editor to Freehand and draw a stroke. Smoothness removes small wobbles from dense freehand strokes and rounds the curve; zero preserves straight point-to-point segments. Margin keeps the result away from the paper edge. The result is ordinary paths, ready for Barbed Wire, Hatch Fill, Seamless Tile and any other path node. Freehand input is stored with the patch and does not change between frames.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Drawing")],
  params: [
    { key: "points", label: "Draw", type: "drawpath", def: [[.1,.68],[.28,.26],[.52,.53],[.75,.23],[.9,.56]] },
    { key: "closed", label: "Closed shape", type: "check", def: false },
    { key: "smoothness", label: "Smoothness %", type: "slider", min: 0, max: 100, step: 1, def: 70 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const W = Number(ctx?.W), H = Number(ctx?.H);
    if (!(Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0)) return [];
    const m = Math.max(0, Math.min(Math.min(W, H) / 2, Number.isFinite(+p.margin) ? +p.margin : 12));
    return [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const W = Number(ctx?.W), H = Number(ctx?.H);
    if (!(Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0)) return EMPTY;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2, Number.isFinite(+p.margin) ? +p.margin : 12));
    if (W - 2 * m <= 0 || H - 2 * m <= 0) return EMPTY;
    const raw = Array.isArray(p.points) ? p.points : [];
    const pts = [];
    for (const q of raw.slice(0, 256)) {
      if (!Array.isArray(q) || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue;
      const x = m + Math.max(0, Math.min(1, q[0])) * (W - 2 * m);
      const y = m + Math.max(0, Math.min(1, q[1])) * (H - 2 * m);
      if (!pts.length || Math.hypot(x - pts.at(-1)[0], y - pts.at(-1)[1]) > .02) pts.push([x, y]);
    }
    const closed = !!p.closed;
    if (closed && pts.length > 2 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) <= .02) pts.pop();
    if (pts.length < (closed ? 3 : 2)) return EMPTY;
    const smooth = Math.max(0, Math.min(1, (Number.isFinite(+p.smoothness) ? +p.smoothness : 70) / 100));
    const filtered = filterStroke(pts, closed, smooth, Math.min(W - 2 * m, H - 2 * m) * .075 * smooth);
    const segs = closed ? filtered.length : filtered.length - 1;
    const maxPerSegment = Math.max(1, Math.floor(100000 / segs));
    const output = [];
    for (let i = 0; i < segs; i++) {
      const a = filtered[i], b = filtered[(i + 1) % filtered.length];
      const prev = filtered[closed ? (i - 1 + filtered.length) % filtered.length : Math.max(0, i - 1)];
      const next = filtered[closed ? (i + 2) % filtered.length : Math.min(filtered.length - 1, i + 2)];
      const steps = Math.min(maxPerSegment, Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2)));
      for (let j = 0; j < steps; j++) {
        const t = j / steps, t2 = t * t, t3 = t2 * t;
        const q = [0, 1].map(k => {
          const linear = a[k] + (b[k] - a[k]) * t;
          const m0 = (b[k] - prev[k]) * .5, m1 = (next[k] - a[k]) * .5;
          const curve = (2*t3 - 3*t2 + 1)*a[k] + (t3 - 2*t2 + t)*m0 + (-2*t3 + 3*t2)*b[k] + (t3 - t2)*m1;
          return Math.max(m, Math.min((k === 0 ? W : H) - m, linear * (1 - smooth) + curve * smooth));
        });
        output.push(q);
      }
    }
    if (!closed) output.push(filtered.at(-1).slice());
    const layer = Math.max(0, Math.min(11, Math.round(Number.isFinite(+p.layer) ? +p.layer : 0)));
    return applyStyle({ paths: [{ pts: output, closed, layer }] }, ins?.[0]);
  },
};
