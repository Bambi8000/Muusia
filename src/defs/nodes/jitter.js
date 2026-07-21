import { Pin, EMPTY, noise2 } from "../helpers.js";

export default {
  key: "jitter",
    name: "Jitter", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amp", label: "Strength mm", type: "slider", min: 0, max: 15, step: 0.25, def: 2 },
      { key: "scale", label: "Noise scale", type: "slider", min: 0.01, max: 0.5, step: 0.01, def: 0.08 },
      { key: "seed", label: "Seed", type: "seed", def: 1 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [
          x + (noise2(x * p.scale, y * p.scale, p.seed) - 0.5) * 2 * p.amp,
          y + (noise2(x * p.scale + 91, y * p.scale + 37, p.seed) - 0.5) * 2 * p.amp,
        ]),
      }));
      return { paths };
    },
  
};
