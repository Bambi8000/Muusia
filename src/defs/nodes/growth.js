import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "growth",
    name: "Growth", cat: "gen", group: "organic",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations", type: "slider", min: 20, max: 600, step: 5, def: 220 },
      { key: "repelR", label: "Repel radius mm", type: "slider", min: 1, max: 15, step: 0.25, def: 4 },
      { key: "repelF", label: "Repulsion", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "attract", label: "Cohesion", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "maxEdge", label: "Split edge mm", type: "slider", min: 0.6, max: 6, step: 0.1, def: 2 },
      { key: "growRate", label: "Growth rate", type: "slider", min: 0, max: 10, step: 1, def: 3 },
      { key: "startR", label: "Start radius mm", type: "slider", min: 3, max: 80, step: 1, def: 22 },
      { key: "bound", label: "Bounds", type: "select", options: ["Canvas margin", "Circle"], def: "Circle" },
      { key: "boundR", label: "Circle bound Ø mm", type: "slider", min: 20, max: 400, step: 1, def: 170 },
      { key: "rings", label: "History rings", type: "check", def: true },
      { key: "ringEvery", label: "Ring every N iters", type: "slider", min: 5, max: 100, step: 1, def: 24 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 149 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    overlay(p, ctx) {
      return p.bound === "Circle"
        ? [{ kind: "circle", cx: p.cx, cy: p.cy, r: p.boundR / 2 }]
        : [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
    },
    compute(ins, p, ctx) {
      /* differential growth: silmukka kasvaa — naapurivetovoima pitaa kasassa,
         lahitorjunta tyontaa erilleen, pitkat sarmat halkeavat -> poimuttuva kayra */
      const { W, H } = ctx;
      const MAXP = 2400;
      const rng = mulberry32(p.seed * 6091 + 113);
      let pts = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const r = p.startR * (1 + 0.08 * (rng() - 0.5));
        pts.push([p.cx + Math.cos(a) * r, p.cy + Math.sin(a) * r]);
      }
      const clampB = (q) => {
        if (p.bound === "Circle") {
          const dx = q[0] - p.cx, dy = q[1] - p.cy;
          const d = Math.hypot(dx, dy);
          const R = p.boundR / 2 - 1;
          if (d > R) return [p.cx + (dx / d) * R, p.cy + (dy / d) * R];
          return q;
        }
        return [Math.max(p.margin, Math.min(W - p.margin, q[0])), Math.max(p.margin, Math.min(H - p.margin, q[1]))];
      };
      const paths = [];
      const L = Math.round(p.layer);
      const rr = p.repelR, rr2 = rr * rr;
      const nIters = Math.round(p.iters);
      for (let it = 0; it < nIters; it++) {
        const N = pts.length;
        /* spatiaalinen hila naapurihakuun */
        const cellS = rr;
        const grid = new Map();
        for (let i = 0; i < N; i++) {
          const key = Math.floor(pts[i][0] / cellS) + "," + Math.floor(pts[i][1] / cellS);
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(i);
        }
        const next = new Array(N);
        for (let i = 0; i < N; i++) {
          const [x, y] = pts[i];
          let rx = 0, ry = 0;
          const gx = Math.floor(x / cellS), gy = Math.floor(y / cellS);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const lst = grid.get((gx + ox) + "," + (gy + oy));
            if (!lst) continue;
            for (const j of lst) {
              /* ohita kayran valittomat naapurit — muuten torjunta kumoaa koheesion */
              const ringD = Math.min((i - j + N) % N, (j - i + N) % N);
              if (ringD <= 2) continue;
              const dx = x - pts[j][0], dy = y - pts[j][1];
              const d2 = dx * dx + dy * dy;
              if (d2 > rr2 || d2 < 1e-9) continue;
              const d = Math.sqrt(d2);
              const f = (1 - d / rr) / d;
              rx += dx * f; ry += dy * f;
            }
          }
          const ip = (i - 1 + N) % N, inx = (i + 1) % N;
          const ax = (pts[ip][0] + pts[inx][0]) / 2 - x;
          const ay = (pts[ip][1] + pts[inx][1]) / 2 - y;
          let mx = rx * p.repelF * 0.55 + ax * p.attract * 0.55;
          let my = ry * p.repelF * 0.55 + ay * p.attract * 0.55;
          const ml = Math.hypot(mx, my);
          if (ml > 0.9) { mx = (mx / ml) * 0.9; my = (my / ml) * 0.9; }
          next[i] = clampB([x + mx, y + my]);
        }
        /* sarmien halkaisu: pitkat sarmat + kasvupaine (satunnaiset halkaisut) */
        const forceSplit = new Set();
        for (let k = 0; k < Math.round(p.growRate); k++) forceSplit.add(Math.floor(rng() * N));
        const grown = [];
        for (let i = 0; i < N; i++) {
          const a = next[i], b = next[(i + 1) % N];
          grown.push(a);
          const eLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (grown.length < MAXP && (eLen > p.maxEdge || (forceSplit.has(i) && eLen > 0.5))) {
            grown.push([(a[0] + b[0]) / 2 + (rng() - 0.5) * 0.15, (a[1] + b[1]) / 2 + (rng() - 0.5) * 0.15]);
          }
        }
        pts = grown;
        if (p.rings && it > 0 && it % Math.round(p.ringEvery) === 0) {
          paths.push({ pts: pts.map((q) => q.slice()), closed: true, layer: L });
        }
      }
      paths.push({ pts, closed: true, layer: L });
      return applyStyle({ paths }, ins[0]);
    },
  
};
