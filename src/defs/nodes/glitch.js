import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "glitch",
    name: "Glitch", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amount", label: "Amount %", type: "slider", min: 0, max: 100, step: 1, def: 20 },
      { key: "amp", label: "Displacement mm", type: "slider", min: 0, max: 30, step: 0.5, def: 6 },
      { key: "skip", label: "Drop strokes %", type: "slider", min: 0, max: 90, step: 1, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rng = mulberry32(p.seed * 7919 + 13);
      const paths = [];
      for (const path of src.paths) {
        if (rng() * 100 < p.skip) continue;
        const pts = path.pts.map((pt) => pt.slice());
        const segs = Math.max(1, Math.floor((pts.length * p.amount) / 400));
        for (let g = 0; g < segs; g++) {
          if (rng() * 100 > p.amount) continue;
          const i0 = Math.floor(rng() * pts.length);
          const len = 1 + Math.floor(rng() * Math.max(2, pts.length / 10));
          const dx = (rng() - 0.5) * 2 * p.amp, dy = (rng() - 0.5) * 2 * p.amp;
          for (let i = i0; i < Math.min(pts.length, i0 + len); i++) { pts[i][0] += dx; pts[i][1] += dy; }
        }
        paths.push({ ...path, pts });
      }
      return { paths };
    },
  
};
