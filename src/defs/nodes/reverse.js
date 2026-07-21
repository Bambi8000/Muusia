import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "reverse",
      name: "Reverse",
    cat: "mod", group: "pathops",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Which paths", type: "select", options: ["All", "Every 2nd", "Random"], def: "All" },
      { key: "seed", label: "Seed (random)", type: "seed", def: 83 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rng = mulberry32(p.seed * 431 + 3);
      const paths = src.paths.map((path, i) => {
        let flip;
        if (p.mode === "All") flip = true;
        else if (p.mode === "Every 2nd") flip = i % 2 === 1;
        else flip = rng() > 0.5;
        return flip ? { ...path, pts: [...path.pts].reverse() } : path;
      });
      return { paths };
    }
  
};
