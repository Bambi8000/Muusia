import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "circpack",
    name: "Circle Packing", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "attempts", label: "Attempts", type: "slider", min: 50, max: 3000, step: 50, def: 800 },
      { key: "minR", label: "Min R mm", type: "slider", min: 0.5, max: 15, step: 0.25, def: 1.5 },
      { key: "maxR", label: "Max R mm", type: "slider", min: 2, max: 60, step: 0.5, def: 18 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 14 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 271 + 91);
      const circles = [];
      for (let a = 0; a < p.attempts; a++) {
        const x = p.margin + rng() * (W - 2 * p.margin);
        const y = p.margin + rng() * (H - 2 * p.margin);
        let r = Math.min(p.maxR, x - p.margin, W - p.margin - x, y - p.margin, H - p.margin - y);
        for (const c of circles) {
          const d = Math.hypot(x - c[0], y - c[1]) - c[2];
          if (d < r) r = d;
          if (r < p.minR) break;
        }
        if (r >= p.minR) circles.push([x, y, r]);
      }
      const paths = circles.map(([x, y, r]) => {
        const n = Math.min(64, Math.max(12, Math.ceil(r * 2.5)));
        const pts = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        return { pts, closed: true, layer: Math.round(p.layer) };
      });
      return applyStyle({ paths }, ins[0]);
    },
  
};
