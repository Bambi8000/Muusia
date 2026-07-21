import { Pin, EMPTY, PENS, mulberry32 } from "../helpers.js";

export default {
  key: "array",
    name: "Array", cat: "duo", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Copies", type: "slider", min: 2, max: 8, step: 1, def: 3 },
      { key: "dx", label: "Δ X mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 2 },
      { key: "dy", label: "Δ Y mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 0 },
      { key: "drot", label: "Δ Rotate ° / copy", type: "slider", min: -45, max: 45, step: 0.5, def: 0 },
      { key: "dscale", label: "Δ Scale % / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 0 },
      { key: "penPer", label: "Pen change per copy", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 16 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const n = Math.round(p.count);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const paths = [];
      for (let i = 0; i < n; i++) {
        const rng = mulberry32(p.seed * 77 + i * 991 + 3);
        const jx = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const jy = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const tx = p.dx * i + jx, ty = p.dy * i + jy;
        const rad = ((p.drot * i) * Math.PI) / 180;
        const sc = 1 + (p.dscale * i) / 100;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        for (const path of src.paths) {
          paths.push({
            pts: path.pts.map(([x, y]) => {
              const dx0 = (x - cx) * sc, dy0 = (y - cy) * sc;
              return [cx + dx0 * ca - dy0 * sa + tx, cy + dx0 * sa + dy0 * ca + ty];
            }),
            closed: path.closed,
            layer: p.penPer ? i % PENS.length : path.layer,
          });
        }
      }
      return { paths };
    },
  
};
