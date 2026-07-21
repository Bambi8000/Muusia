import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "lissajous",
    name: "Lissajous", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "fx", label: "Freq X", type: "slider", min: 1, max: 16, step: 1, def: 3 },
      { key: "fy", label: "Freq Y", type: "slider", min: 1, max: 16, step: 1, def: 4 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 1.57 },
      { key: "turns", label: "Turns", type: "slider", min: 1, max: 60, step: 1, def: 8 },
      { key: "damp", label: "Damping", type: "slider", min: 0, max: 0.05, step: 0.001, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 1 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const Ax = W / 2 - p.margin, Ay = H / 2 - p.margin;
      const cx = W / 2, cy = H / 2;
      const N = Math.min(12000, Math.round(p.turns * 220));
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns * Math.PI * 2;
        const e = Math.exp(-p.damp * t);
        pts.push([cx + Ax * Math.sin(p.fx * t + p.phase) * e, cy + Ay * Math.sin(p.fy * t) * e]);
      }
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  
};
