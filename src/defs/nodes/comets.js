import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "comets",
    name: "Comets",
    cat: "gen",
    group: "nature",
    desc: "Comets with a nucleus and a sweeping tail. Detailed style draws the ball with coma arcs and a fan of curved tail streamlines; Minimal is just a dot and a single line. Body and tail on separate pens for two-color plots. Tails all point away from the sun direction with a little natural scatter.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "style", label: "Style", type: "select", options: ["Detailed", "Minimal"], def: "Detailed" },
      { key: "count", label: "Comets", type: "slider", min: 1, max: 12, step: 1, def: 3 },
      { key: "size", label: "Ball size mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "tailLen", label: "Tail length mm", type: "slider", min: 10, max: 160, step: 2, def: 70 },
      { key: "tailLines", label: "Tail lines", type: "slider", min: 1, max: 9, step: 1, def: 5 },
      { key: "curve", label: "Tail curve", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "sunAng", label: "Sun direction deg", type: "slider", min: 0, max: 360, step: 5, def: 315 },
      { key: "bodyPen", label: "Ball pen", type: "pen", def: 0 },
      { key: "tailPen", label: "Tail pen", type: "pen", def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 2 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 6113 + 41);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      const circle = (cx, cy, r) => {
        const nn = Math.max(10, Math.round(r * 5));
        const c = [];
        for (let k = 0; k < nn; k++) {
          const a = (k / nn) * Math.PI * 2;
          c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return c;
      };
      const bodyPen = Math.round(p.bodyPen), tailPen = Math.round(p.tailPen);
      const N = Math.round(p.count);
      const K = p.style === "Minimal" ? 1 : Math.round(p.tailLines);
      for (let i = 0; i < N; i++) {
        const r = (p.size / 2) * (0.6 + rng() * 0.6);
        const tl = p.tailLen * (0.6 + rng() * 0.5);
        const ta = ((p.sunAng + 180) * Math.PI) / 180 + (rng() - 0.5) * 0.35; /* tail away from sun */
        /* keep ball + tail box inside margins */
        const pad = r * 2 + 2;
        const ex = Math.cos(ta) * tl, ey = Math.sin(ta) * tl;
        const lo = (v, e) => v + Math.min(0, e) - pad, hi = (v, e) => v + Math.max(0, e) + pad;
        let cx = 0, cy = 0, ok = false;
        for (let t2 = 0; t2 < 40 && !ok; t2++) {
          cx = x0 + pad + rng() * (x1 - x0 - 2 * pad);
          cy = y0 + pad + rng() * (y1 - y0 - 2 * pad);
          ok = lo(cx, ex) >= x0 - 0.5 && hi(cx, ex) <= x1 + 0.5 && lo(cy, ey) >= y0 - 0.5 && hi(cy, ey) <= y1 + 0.5;
        }
        if (!ok) continue;
        if (p.style === "Minimal") {
          if (p.size < 1.2) push([[cx, cy], [cx + 0.1, cy]], false, bodyPen);
          else push(circle(cx, cy, r), true, bodyPen);
          push([[cx + Math.cos(ta) * r, cy + Math.sin(ta) * r], [cx + ex, cy + ey]], false, tailPen);
          continue;
        }
        /* Detailed: nucleus + coma arcs + fan of curved streamlines */
        push(circle(cx, cy, r), true, bodyPen);
        for (const cr of [1.5, 2.1]) {
          const arc = [];
          const nn = 16;
          for (let k = 0; k <= nn; k++) {
            const a = ta + Math.PI + (-0.9 + (k / nn) * 1.8); /* arc on the sun side */
            arc.push([cx + Math.cos(a) * r * cr, cy + Math.sin(a) * r * cr]);
          }
          push(arc, false, bodyPen);
        }
        const perp = ta + Math.PI / 2;
        const bendDir = rng() < 0.5 ? 1 : -1;
        for (let k = 0; k < K; k++) {
          const f = K > 1 ? (k / (K - 1) - 0.5) : 0;
          const spread = f * r * 1.6;
          const sxp = cx + Math.cos(ta) * r * 0.9 + Math.cos(perp) * spread;
          const syp = cy + Math.sin(ta) * r * 0.9 + Math.sin(perp) * spread;
          const len = tl * (0.55 + (1 - Math.abs(f) * 1.2) * 0.45) * (0.9 + rng() * 0.2);
          const line = [];
          const nn = Math.max(8, Math.round(len / 2.5));
          for (let s = 0; s <= nn; s++) {
            const t2 = s / nn;
            const bend = p.curve * bendDir * t2 * t2 * len * 0.35;
            const fan = spread * t2 * 1.6;
            line.push([
              sxp + Math.cos(ta) * len * t2 + Math.cos(perp) * (bend + fan),
              syp + Math.sin(ta) * len * t2 + Math.sin(perp) * (bend + fan)
            ]);
          }
          push(line, false, tailPen);
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
