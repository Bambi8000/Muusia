import { Pin, mulberry32 } from "../helpers.js";

export default {
  key: "satunnainen",
    name: "Random", cat: "math", ins: [], outs: [Pin("value")],
    params: [
      { key: "min", label: "Min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 11 },
    ],
    compute(_ins, p) {
      const rng = mulberry32(p.seed * 2749 + 331);
      return p.min + rng() * (p.max - p.min);
    },
  
};
