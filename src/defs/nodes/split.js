import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "split",
    name: "Split", cat: "duo",
    ins: [Pin("paths")],
    outs: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 3 }, (_, i) => Pin("paths", String(i + 1))),
    params: [
      { key: "count", label: "Outputs", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "dx", label: "Δ X mm / output", type: "slider", min: -30, max: 30, step: 0.25, def: 2 },
      { key: "dy", label: "Δ Y mm / output", type: "slider", min: -30, max: 30, step: 0.25, def: 0 },
      { key: "drot", label: "Δ Rotate ° / output", type: "slider", min: -45, max: 45, step: 0.5, def: 0 },
      { key: "dscale", label: "Δ Scale % / output", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 6 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const n = Math.round(p.count);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const outs = [];
      for (let i = 0; i < n; i++) {
        const rng = mulberry32(p.seed * 77 + i * 991 + 3);
        const jx = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const jy = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const tx = p.dx * i + jx, ty = p.dy * i + jy;
        const rad = ((p.drot * i) * Math.PI) / 180;
        const sc = 1 + (p.dscale * i) / 100;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        outs.push({
          paths: src.paths.map((path) => ({
            ...path,
            pts: path.pts.map(([x, y]) => {
              const dx0 = (x - cx) * sc, dy0 = (y - cy) * sc;
              return [cx + dx0 * ca - dy0 * sa + tx, cy + dx0 * sa + dy0 * ca + ty];
            }),
          })),
        });
      }
      return outs;
    },
  
};
