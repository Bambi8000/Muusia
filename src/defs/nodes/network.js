import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "network",
    name: "Network",
    cat: "gen",
    group: "structural",
    desc: "A seeded graph laid out by force simulation (nodes repel, edges pull), replayed deterministically for N iterations - wire a value into Iterations to watch it untangle. Nearest-neighbour links plus a few long-range ones give constellation diagrams; node circles can scale by connection count.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "nodes", label: "Nodes", type: "slider", min: 5, max: 120, step: 1, def: 40 },
      { key: "links", label: "Links per node", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "longp", label: "Long links", type: "slider", min: 0, max: 0.3, step: 0.01, def: 0.06 },
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 300, step: 5, def: 120 },
      { key: "dots", label: "Draw nodes", type: "check", def: true },
      { key: "degsize", label: "Size by connections", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const N2 = Math.max(3, Math.min(150, Math.round(p.nodes)));
      const rng = mulberry32(p.seed * 9013 + 3);
      const pos = [];
      for (let i = 0; i < N2; i++) {
        pos.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
      }
      /* edges: k nearest at start + seeded long-range links */
      const edges = new Set();
      const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
      const kNear = Math.max(1, Math.min(6, Math.round(p.links)));
      for (let i = 0; i < N2; i++) {
        const d = pos.map((q, j) => [Math.hypot(q[0] - pos[i][0], q[1] - pos[i][1]), j])
          .sort((a, b) => a[0] - b[0]);
        for (let k = 1; k <= kNear && k < d.length; k++) edges.add(ek(i, d[k][1]));
        if (rng() < p.longp * 3) {
          const j = Math.floor(rng() * N2);
          if (j !== i) edges.add(ek(i, j));
        }
      }
      const E = [...edges].map((k) => k.split("_").map(Number));
      const deg = new Array(N2).fill(0);
      for (const [a, b] of E) { deg[a]++; deg[b]++; }
      /* force layout: repulsion all pairs, springs on edges, deterministic */
      const gens = Math.max(0, Math.min(400, Math.floor(p.iters)));
      const ideal = Math.sqrt(((x1 - x0) * (y1 - y0)) / N2) * 0.9;
      for (let g = 0; g < gens; g++) {
        const fx = new Float64Array(N2), fy = new Float64Array(N2);
        for (let i = 0; i < N2; i++) {
          for (let j = i + 1; j < N2; j++) {
            let ox = pos[i][0] - pos[j][0], oy = pos[i][1] - pos[j][1];
            let d = Math.hypot(ox, oy);
            if (d < 0.01) { ox = 0.01 * ((i % 3) - 1); oy = 0.01; d = 0.014; }
            const f = (ideal * ideal) / (d * d) * 0.5;
            fx[i] += (ox / d) * f; fy[i] += (oy / d) * f;
            fx[j] -= (ox / d) * f; fy[j] -= (oy / d) * f;
          }
        }
        for (const [a, b] of E) {
          const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
          const d = Math.hypot(ox, oy) || 0.01;
          const f = (d - ideal) * 0.05;
          fx[a] += (ox / d) * f; fy[a] += (oy / d) * f;
          fx[b] -= (ox / d) * f; fy[b] -= (oy / d) * f;
        }
        const cool = 1 - g / (gens + 1);
        for (let i = 0; i < N2; i++) {
          const fl = Math.hypot(fx[i], fy[i]) || 1;
          const s = Math.min(3 * cool + 0.2, fl) / fl;
          pos[i][0] = Math.max(x0, Math.min(x1, pos[i][0] + fx[i] * s));
          pos[i][1] = Math.max(y0, Math.min(y1, pos[i][1] + fy[i] * s));
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      const rOf = (i) => p.degsize ? 1 + Math.min(4, deg[i] * 0.5) : 1.6;
      for (const [a, b] of E) {
        /* trim edge lines so they stop at the node circles */
        const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
        const d = Math.hypot(ox, oy);
        if (d < 0.5) continue;
        const ra = p.dots ? rOf(a) + 0.4 : 0, rb = p.dots ? rOf(b) + 0.4 : 0;
        if (ra + rb >= d) continue;
        paths.push({
          pts: [
            [pos[a][0] + (ox / d) * ra, pos[a][1] + (oy / d) * ra],
            [pos[b][0] - (ox / d) * rb, pos[b][1] - (oy / d) * rb]
          ],
          closed: false, layer: L
        });
      }
      if (p.dots) {
        for (let i = 0; i < N2; i++) {
          const r = rOf(i);
          const c = [];
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            c.push([pos[i][0] + Math.cos(a) * r, pos[i][1] + Math.sin(a) * r]);
          }
          paths.push({ pts: c, closed: true, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
