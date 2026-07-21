import { Pin, EMPTY, hash2, pathLength } from "../helpers.js";

export default {
  key: "cull",
    name: "Cull",
    cat: "mod",
    group: "penout",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Criterion", type: "select", options: ["Random", "Every Nth", "Shorter than", "Longer than"], def: "Random" },
      { key: "keep", label: "Keep probability", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "nth", label: "N (Every Nth)", type: "slider", min: 2, max: 20, step: 1, def: 2 },
      { key: "len", label: "Length mm", type: "slider", min: 0, max: 200, step: 1, def: 20 },
      { key: "invert", label: "Invert selection", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 61 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      src.paths.forEach((path, i) => {
        let drop;
        if (p.mode === "Every Nth") {
          drop = (i % Math.max(2, Math.round(p.nth))) === 0;
        } else if (p.mode === "Shorter than") {
          drop = pathLength(path.pts, path.closed) < p.len;
        } else if (p.mode === "Longer than") {
          drop = pathLength(path.pts, path.closed) > p.len;
        } else {
          drop = hash2(i * 13 + 5, 3, p.seed) >= Math.max(0, Math.min(1, p.keep));
        }
        if (p.invert) drop = !drop;
        if (!drop) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
      });
      return { paths };
    }
  
};
