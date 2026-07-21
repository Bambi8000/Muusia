import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "flow",
    name: "Flow Field", cat: "gen", group: "organic", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Trails", type: "slider", min: 5, max: 300, step: 5, def: 80 },
      { key: "steps", label: "Length", type: "slider", min: 10, max: 300, step: 5, def: 90 },
      { key: "scale", label: "Field scale", type: "slider", min: 0.005, max: 0.08, step: 0.005, def: 0.02 },
      { key: "curl", label: "Curl", type: "slider", min: 0.5, max: 4, step: 0.25, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 2 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1013 + 77);
      const paths = [];
      for (let k = 0; k < p.count; k++) {
        let x = p.margin + rng() * (W - 2 * p.margin);
        let y = p.margin + rng() * (H - 2 * p.margin);
        const pts = [[x, y]];
        for (let s = 0; s < p.steps; s++) {
          const a = noise2(x * p.scale, y * p.scale, p.seed) * Math.PI * 2 * p.curl;
          x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6;
          if (x < p.margin || x > W - p.margin || y < p.margin || y > H - p.margin) break;
          pts.push([x, y]);
        }
        if (pts.length > 3) paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
