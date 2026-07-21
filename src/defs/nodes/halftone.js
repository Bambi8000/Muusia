import { Pin, noise2, applyStyle } from "../helpers.js";

export default {
  key: "halftone",
    name: "Halftone", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "cell", label: "Cell mm", type: "slider", min: 3, max: 25, step: 0.5, def: 8 },
      { key: "maxK", label: "Max dots / side", type: "slider", min: 1, max: 6, step: 1, def: 4 },
      { key: "dotR", label: "Dot size mm", type: "slider", min: 0.2, max: 4, step: 0.1, def: 0.7 },
      { key: "scale", label: "Field scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 29 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const fbm = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < 3; o++) {
          v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
          tot += amp; amp *= 0.5; fq *= 2;
        }
        return v / tot;
      };
      const paths = [];
      const cols = Math.floor((W - 2 * p.margin) / p.cell);
      const rows = Math.floor((H - 2 * p.margin) / p.cell);
      const ox = (W - cols * p.cell) / 2, oy = (H - rows * p.cell) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cx = ox + c * p.cell + p.cell / 2, cy = oy + r * p.cell + p.cell / 2;
        let v = fbm(cx, cy);
        if (p.invert) v = 1 - v;
        const k = Math.round(v * p.maxK);
        if (k <= 0) continue;
        const sp = p.cell / k;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
          const dx = ox + c * p.cell + sp * (i + 0.5), dy = oy + r * p.cell + sp * (j + 0.5);
          const pts = [];
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * Math.PI * 2;
            pts.push([dx + Math.cos(a) * (p.dotR / 2), dy + Math.sin(a) * (p.dotR / 2)]);
          }
          paths.push({ pts, closed: true, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
