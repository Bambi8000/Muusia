import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "randlines",
    name: "Random Lines", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Lines", type: "slider", min: 2, max: 600, step: 1, def: 80 },
      { key: "mode", label: "Mode", type: "select", options: ["Free (2 random points)", "Fixed length"], def: "Fixed length" },
      { key: "length", label: "Length mm", type: "slider", min: 2, max: 200, step: 1, def: 30 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "angles", label: "Angles", type: "select", options: ["Any", "Horizontal + Vertical", "Diagonals", "Quantized 45°"], def: "Any" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 53 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 997 + 3);
      const L = Math.round(p.layer);
      const m = p.margin;
      const paths = [];
      const rx = () => m + rng() * (W - 2 * m);
      const ry = () => m + rng() * (H - 2 * m);
      const clampP = (q) => [Math.max(m, Math.min(W - m, q[0])), Math.max(m, Math.min(H - m, q[1]))];
      for (let i = 0; i < Math.round(p.count); i++) {
        if (p.mode === "Free (2 random points)") {
          paths.push({ pts: [[rx(), ry()], [rx(), ry()]], closed: false, layer: L });
        } else {
          const cx = rx(), cy = ry();
          let a;
          if (p.angles === "Horizontal + Vertical") a = rng() > 0.5 ? 0 : Math.PI / 2;
          else if (p.angles === "Diagonals") a = rng() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
          else if (p.angles === "Quantized 45°") a = Math.floor(rng() * 4) * (Math.PI / 4);
          else a = rng() * Math.PI;
          const len = Math.max(1, p.length * (1 - p.lenVar * rng()));
          const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
          paths.push({ pts: [clampP([cx - dx, cy - dy]), clampP([cx + dx, cy + dy])], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
