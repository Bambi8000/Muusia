import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";
import { boundedLineGrowth, lineGrowthRegion } from "../line-growth.js";

export default {
  key: "diffgrowth",
    name: "Differential Growth",
    cat: "gen",
    group: "organic",
    desc: "Classic keeps the original circle simulation. Bounded grows a final line inside the Boundary input or a built-in Circle/Canvas. Closed Boundary paths use even-odd holes. Auto start uses wired Start paths or a small circle; Circle and Line start in the roomiest region. Growth % reveals simulation progress; Steps sets full growth and Spacing mm controls the repulsion reach and density, not a guaranteed physical nib clearance. Max points caps total detail. Seed and Chaos vary repeatable growth. Wired starts are clipped at the boundary and holes; disconnected pieces stay separate, while crossing or touching starts are refused. One accepted starting strand stays one stroke; several strands need pen lifts. Output includes only the final grown strands, without guides or growth history. Boundary and segment contact checks prevent new crossings; the simulation holds back invalid moves. Degenerate or oversized inputs return empty. Complex growth may take a few seconds; increasing Growth reuses the same simulation. Keep Seed and forces fixed when animating. Bounded mode uses adapted MIT Line Growth by Gilbert Chen (2026).",
    ins: [Pin("style", "Style"), Pin("paths", "Boundary"), Pin("paths", "Start")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Classic", "Bounded"], def: "Classic" },
      { key: "boundary", label: "Boundary", type: "select", options: ["Auto", "Circle", "Canvas", "Wired"], def: "Auto", showIf: p => p.mode === "Bounded" },
      { key: "start", label: "Start", type: "select", options: ["Auto", "Circle", "Line", "Wired"], def: "Auto", showIf: p => p.mode === "Bounded" },
      { key: "startSize", label: "Start size %", type: "slider", min: 1, max: 80, step: 1, def: 20, showIf: p => p.mode === "Bounded" && p.start !== "Wired" },
      { key: "growth", label: "Growth %", type: "slider", min: 0, max: 100, step: 1, def: 100, showIf: p => p.mode === "Bounded" },
      { key: "steps", label: "Steps", type: "slider", min: 100, max: 6000, step: 100, def: 2200, showIf: p => p.mode === "Bounded" },
      { key: "spacing", label: "Spacing mm", type: "slider", min: .5, max: 15, step: .1, def: 3.9, showIf: p => p.mode === "Bounded" },
      { key: "maxPoints", label: "Max points", type: "slider", min: 200, max: 12000, step: 200, def: 3600, showIf: p => p.mode === "Bounded" },
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 400, step: 5, def: 150, showIf: p => p.mode !== "Bounded" },
      { key: "repel", label: "Repulsion radius mm", type: "slider", min: 2, max: 15, step: 0.5, def: 6, showIf: p => p.mode !== "Bounded" },
      { key: "edge", label: "Edge length mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5, showIf: p => p.mode !== "Bounded" },
      { key: "chaos", label: "Chaos", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "r0", label: "Seed circle mm", type: "slider", min: 5, max: 60, step: 1, def: 18, showIf: p => p.mode !== "Bounded" },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 17 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    overlay(p, ctx, ins) {
      if (p.mode !== "Bounded") return [];
      return (lineGrowthRegion(p, ctx, ins?.[1]) || []).map(pts => ({ kind: "poly", pts: [...pts, pts[0]] }));
    },
    compute(ins, p, ctx) {
      if (p.mode === "Bounded") return applyStyle(boundedLineGrowth(ins, p, ctx), ins[0]);
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const R = Math.max(1.5, p.repel);
      const edge = Math.max(0.8, p.edge);
      const MAXP = 2600;
      /* seed circle */
      const rng = mulberry32(p.seed * 4241 + 13);
      const cx = W / 2, cy = H / 2;
      let pts = [];
      const N0 = 40;
      for (let i = 0; i < N0; i++) {
        const a = (i / N0) * Math.PI * 2;
        const rr = Math.max(3, p.r0) * (1 + (rng() - 0.5) * 0.1);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      const gens = Math.max(0, Math.min(500, Math.floor(p.iters)));
      const STEP = 0.55;
      for (let g = 0; g < gens; g++) {
        const n = pts.length;
        /* spatial buckets for repulsion */
        const bs = R;
        const grid = new Map();
        const bk = (x, y) => Math.floor(x / bs) + "," + Math.floor(y / bs);
        for (let i = 0; i < n; i++) {
          const k = bk(pts[i][0], pts[i][1]);
          let a = grid.get(k);
          if (!a) { a = []; grid.set(k, a); }
          a.push(i);
        }
        const nxt = new Array(n);
        for (let i = 0; i < n; i++) {
          const [x, y] = pts[i];
          let fx = 0, fy = 0;
          /* attraction: springs to ring neighbours */
          const pa = pts[(i - 1 + n) % n], pb = pts[(i + 1) % n];
          fx += (pa[0] + pb[0] - 2 * x) * 0.28;
          fy += (pa[1] + pb[1] - 2 * y) * 0.28;
          /* repulsion from everything nearby (bucket search) */
          const bxc = Math.floor(x / bs), byc = Math.floor(y / bs);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const cellA = grid.get((bxc + dx) + "," + (byc + dy));
              if (!cellA) continue;
              for (const j of cellA) {
                if (j === i) continue;
                const ox = x - pts[j][0], oy = y - pts[j][1];
                const d = Math.hypot(ox, oy);
                if (d > 1e-6 && d < R) {
                  const f = ((R - d) / R) * 0.9;
                  fx += (ox / d) * f;
                  fy += (oy / d) * f;
                }
              }
            }
          }
          /* position-hashed chaos: deterministic even as points split */
          if (p.chaos > 0) {
            const a = noise2(x * 0.11 + 31.7, y * 0.11 + 8.3, p.seed) * Math.PI * 4;
            fx += Math.cos(a) * p.chaos * 0.4;
            fy += Math.sin(a) * p.chaos * 0.4;
          }
          /* soft walls: repel from the margin box */
          if (x - x0 < R) fx += ((R - (x - x0)) / R) * 1.2;
          if (x1 - x < R) fx -= ((R - (x1 - x)) / R) * 1.2;
          if (y - y0 < R) fy += ((R - (y - y0)) / R) * 1.2;
          if (y1 - y < R) fy -= ((R - (y1 - y)) / R) * 1.2;
          const fl = Math.hypot(fx, fy);
          const s = fl > 1 ? STEP / fl : STEP;
          nxt[i] = [
            Math.max(x0, Math.min(x1, x + fx * s)),
            Math.max(y0, Math.min(y1, y + fy * s))
          ];
        }
        pts = nxt;
        /* growth: split edges that stretched past the threshold */
        if (pts.length < MAXP) {
          const grown = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            grown.push(a);
            if (grown.length + (pts.length - i) < MAXP &&
                Math.hypot(b[0] - a[0], b[1] - a[1]) > edge) {
              grown.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
            }
          }
          pts = grown;
        }
      }
      if (pts.length < 3) return applyStyle({ paths: [] }, ins[0]);
      return applyStyle({ paths: [{ pts, closed: true, layer: Math.round(p.layer) }] }, ins[0]);
    }
  
};
