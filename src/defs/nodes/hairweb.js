import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  /* Hair Web — a dense tangle of hairline arcs between anchor points. Anchors
     sit on a jittered grid, scattered at random or on a ring; every strand
     is a cubic Bezier from one anchor to another (or back to itself as a
     petal loop), bulging sideways by Bulge with per-strand variation, some
     as S-curves. Endpoint choice favours near anchors by Locality and heavy
     hubs by Hubs, so the anchors darken into star bursts and the field between
     them stays a grey haze. A share of strands goes to the Light pen for
     depth. Strands that would leave the margin box are re-drawn, not clipped. */
  key: "hairweb",
  name: "Hair Web",
  cat: "gen",
  group: "organic",
  desc: "A tangle of thousands of hairline arcs strung between anchor points, dark star bursts where they meet and a grey haze between. Anchors: *Layout* Grid (Columns x Rows, Jitter), Random (Count, kept apart) or Ring (Count); *Strands* sets how many arcs are drawn. Each strand is a curve from one anchor to another, bowed sideways by *Bulge* (x distance) with *Bulge variation*, *S-curves* turns a share into twisted S-shapes, *Loops* sends a share out of an anchor and back into it as a petal. *Locality* prefers nearby partners (0 = any anchor, 1 = neighbours only), *Hubs* makes some anchors much busier than others. *Light share* draws that fraction of strands on the Light pen for depth. Strands that would leave *Margin* are redrawn with a smaller bow. Seeded; wire Frame into Seed for a boiling animation.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "layout", label: "Layout", type: "select", options: ["Grid", "Random", "Ring"], def: "Grid" },
    { key: "cols", label: "Columns", type: "slider", min: 2, max: 12, step: 1, def: 5, showIf: (p) => p.layout === "Grid" },
    { key: "rows", label: "Rows", type: "slider", min: 2, max: 12, step: 1, def: 5, showIf: (p) => p.layout === "Grid" },
    { key: "jitter", label: "Jitter (x cell)", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.06, showIf: (p) => p.layout === "Grid" },
    { key: "count", label: "Count", type: "slider", min: 3, max: 80, step: 1, def: 24, showIf: (p) => p.layout !== "Grid" },
    { key: "strands", label: "Strands", type: "slider", min: 50, max: 6000, step: 50, def: 1800 },
    { key: "bulge", label: "Bulge (x distance)", type: "slider", min: 0, max: 1.2, step: 0.02, def: 0.35 },
    { key: "bulgeVar", label: "Bulge variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.7 },
    { key: "scurve", label: "S-curves", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "loops", label: "Loops", type: "slider", min: 0, max: 0.6, step: 0.02, def: 0.06 },
    { key: "locality", label: "Locality", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "hubs", label: "Hubs", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    { key: "lightShare", label: "Light share", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "inset", label: "Anchor inset mm", type: "slider", min: 0, max: 80, step: 1, def: 30 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 8 },
    { key: "seed", label: "Seed", type: "seed", def: 3 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "penLight", label: "Light pen", type: "pen", def: 9 },
  ],

  /* anchors [x, y, weight] - shared by compute and overlay */
  _anchors(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const m = Math.max(0, Math.min(cl(p.margin, 0, 1e4), Math.min(W, H) / 2 - 1));
    const ins = Math.min(cl(p.inset, 0, 1e4), Math.min(W, H) / 2 - m - 2);
    const x0 = m + ins, y0 = m + ins, bw = Math.max(1, W - 2 * (m + ins)), bh = Math.max(1, H - 2 * (m + ins));
    const seed = (Math.round(+p.seed) || 1) >>> 0;
    const rng = mulberry32(seed * 8837 + 5);
    const hubs = cl(p.hubs, 0, 1);
    const out = [];
    const wgt = () => Math.pow(rng(), 3 * hubs);   /* hubs 0: all weights 1 */
    if (p.layout === "Grid") {
      const cols = Math.max(2, Math.min(40, Math.round(+p.cols || 2))), rows = Math.max(2, Math.min(40, Math.round(+p.rows || 2)));
      const j = cl(p.jitter, 0, 0.5), cw = bw / (cols - 1), ch = bh / (rows - 1);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * cw + (rng() * 2 - 1) * j * cw, y0 + r * ch + (rng() * 2 - 1) * j * ch, 0.2 + 0.8 * wgt()]);
    } else if (p.layout === "Ring") {
      const n = Math.max(3, Math.min(400, Math.round(+p.count || 3))), R = Math.min(bw, bh) / 2, cx = W / 2, cy = H / 2;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, 0.2 + 0.8 * wgt()]); }
    } else {
      const n = Math.max(3, Math.min(400, Math.round(+p.count || 3)));
      const minD = 0.5 * Math.sqrt((bw * bh) / n);
      for (let i = 0; i < n; i++) {
        let best = null;
        for (let t = 0; t < 30; t++) { const x = x0 + rng() * bw, y = y0 + rng() * bh; let d = Infinity; for (const a of out) d = Math.min(d, Math.hypot(a[0] - x, a[1] - y)); if (!best || d > best[2]) best = [x, y, d]; if (d >= minD) break; }
        out.push([best[0], best[1], 0.2 + 0.8 * wgt()]);
      }
    }
    return out;
  },

  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const m = Math.max(0, Math.min(+(p && p.margin) || 0, Math.min(W, H) / 2 - 1));
      const g = [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }];
      const A = this && typeof this._anchors === "function" ? this._anchors(p, ctx) : [];
      for (const a of A.slice(0, 400)) g.push({ kind: "point", x: a[0], y: a[1] });
      return g;
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const m = Math.max(0, Math.min(cl(p.margin, 0, 1e4), Math.min(W, H) / 2 - 1));
    const seed = (Math.round(+p.seed) || 1) >>> 0;
    const rng = mulberry32(seed * 2971 + 17);
    const pen = Math.max(0, Math.min(11, Math.round(+p.layer || 0))), penL = Math.max(0, Math.min(11, Math.round(+p.penLight || 0)));
    const A = this._anchors(p, ctx);
    const n = A.length;
    if (n < 2) return EMPTY;
    const strands = Math.max(1, Math.min(20000, Math.round(+p.strands || 1)));
    const bulge = cl(p.bulge, 0, 3), bVar = cl(p.bulgeVar, 0, 1), sShare = cl(p.scurve, 0, 1), loopShare = cl(p.loops, 0, 1);
    const loc = cl(p.locality, 0, 1), light = cl(p.lightShare, 0, 1);
    const diag = Math.hypot(W, H);
    /* endpoint sampling: weight * distance falloff */
    const pickA = () => { let tot = 0; for (const a of A) tot += a[2]; let r = rng() * tot; for (let i = 0; i < n; i++) { r -= A[i][2]; if (r <= 0) return i; } return n - 1; };
    const dist = []; for (let i = 0; i < n; i++) { dist.push([]); for (let j = 0; j < n; j++) dist[i].push(Math.hypot(A[i][0] - A[j][0], A[i][1] - A[j][1])); }
    const near = A.map((_, i) => { const d = dist[i].filter((v) => v > 0).sort((a, b) => a - b); return d[0] || 1; });
    const pickB = (i) => {
      const s = near[i] * (1.2 + 6 * (1 - loc) * (1 - loc));   /* falloff scale: tight at locality 1, whole sheet at 0 */
      const w = []; let tot = 0;
      for (let j = 0; j < n; j++) { if (j === i) { w.push(0); continue; } const v = A[j][2] * (loc >= 1 ? (dist[i][j] <= near[i] * 1.5 ? 1 : 0) : Math.exp(-dist[i][j] / s)); w.push(v); tot += v; }
      if (tot <= 0) return (i + 1) % n;
      let r = rng() * tot; for (let j = 0; j < n; j++) { r -= w[j]; if (r <= 0) return j; } return (i + 1) % n;
    };
    const paths = [];
    let budget = 115000;
    const inBox = (pts) => pts.every(([x, y]) => x >= m && x <= W - m && y >= m && y <= H - m);
    const bez = (P0, P1, P2, P3, k) => { const pts = []; for (let i = 0; i <= k; i++) { const t = i / k, u = 1 - t; pts.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]); } return pts; };
    let flip = false;
    for (let s = 0; s < strands && budget > 0; s++) {
      const i = pickA();
      const isLoop = rng() < loopShare;
      const j = isLoop ? i : pickB(i);
      const layer = rng() < light ? penL : pen;
      /* per-strand shape, retried with a smaller bow if it leaves the box */
      let b = bulge * (1 + bVar * (rng() * 2 - 1)) * (rng() < 0.5 ? -1 : 1);
      const sc = rng() < sShare;
      const a0 = rng() * Math.PI * 2, spread = 0.5 + rng() * 0.9, L0 = near[i] * (0.3 + rng() * 0.7);
      const t1 = 0.25 + rng() * 0.2, t2 = 0.55 + rng() * 0.2;
      let pts = null;
      for (let tries = 0; tries < 5 && !pts; tries++) {
        let P0, P1, P2, P3;
        if (isLoop) {
          const L = L0 * Math.pow(0.7, tries);
          P0 = P3 = [A[i][0], A[i][1]];
          P1 = [P0[0] + Math.cos(a0 - spread / 2) * L * 1.6, P0[1] + Math.sin(a0 - spread / 2) * L * 1.6];
          P2 = [P0[0] + Math.cos(a0 + spread / 2) * L * 1.6, P0[1] + Math.sin(a0 + spread / 2) * L * 1.6];
        } else {
          P0 = [A[i][0], A[i][1]]; P3 = [A[j][0], A[j][1]];
          const dx = P3[0] - P0[0], dy = P3[1] - P0[1], d = Math.hypot(dx, dy) || 1;
          const nx = -dy / d, ny = dx / d, bb = b * d * Math.pow(0.6, tries);
          P1 = [P0[0] + dx * t1 + nx * bb, P0[1] + dy * t1 + ny * bb];
          P2 = [P0[0] + dx * t2 + nx * bb * (sc ? -1 : 1), P0[1] + dy * t2 + ny * bb * (sc ? -1 : 1)];
        }
        const len = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) + Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) + Math.hypot(P3[0] - P2[0], P3[1] - P2[1]);
        const k = Math.max(6, Math.min(28, Math.round(len / 4)));
        const cand = bez(P0, P1, P2, P3, k);
        if (inBox(cand)) pts = cand;
        else if (tries === 4) pts = cand.map(([x, y]) => [Math.max(m, Math.min(W - m, x)), Math.max(m, Math.min(H - m, y))]);
      }
      if (!pts || pts.length < 2) continue;
      if (flip) pts.reverse(); flip = !flip;
      budget -= pts.length;
      paths.push({ pts, closed: false, layer });
    }
    return applyStyle({ paths }, ins[0]);
  },
};
