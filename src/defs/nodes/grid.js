import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "grid",
    name: "Grid", cat: "gen", group: "geometric", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "vlines", label: "Vertical lines", type: "slider", min: 0, max: 60, step: 1, def: 13 },
      { key: "hlines", label: "Horizontal lines", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "res", label: "Resolution mm", type: "slider", min: 0.5, max: 10, step: 0.5, def: 2 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const x0 = p.margin, y0 = p.margin, x1 = W - p.margin, y1 = H - p.margin;
      const paths = [];
      const line = (ax, ay, bx, by) => {
        const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / p.res));
        const pts = [];
        for (let i = 0; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
        paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      };
      const hN = Math.round(p.hlines), vN = Math.round(p.vlines);
      for (let r = 0; r < hN; r++) {
        const y = hN === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * r) / (hN - 1);
        line(x0, y, x1, y);
      }
      for (let c = 0; c < vN; c++) {
        const x = vN === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * c) / (vN - 1);
        line(x, y0, x, y1);
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
