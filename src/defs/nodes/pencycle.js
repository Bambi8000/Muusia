import { Pin, EMPTY, PENS, mulberry32 } from "../helpers.js";

export default {
  key: "pencycle",
    name: "Pen Cycle", cat: "mod", group: "penout", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "group", label: "Paths per pen", type: "slider", min: 1, max: 20, step: 1, def: 1 },
      { key: "pens", label: "Pens to use", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "start", label: "Start pen", type: "pen", def: 0 },
      { key: "mode", label: "Mode", type: "select", options: ["Cycle", "Random"], def: "Cycle" },
      { key: "seed", label: "Seed", type: "seed", def: 35 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const g = Math.max(1, Math.round(p.group));
      const nP = Math.round(p.pens);
      const rng = mulberry32(p.seed * 449 + 13);
      let rndMap = null;
      if (p.mode === "Random") {
        rndMap = {};
      }
      const paths = src.paths.map((path, i) => {
        const grp = Math.floor(i / g);
        let pen;
        if (p.mode === "Random") {
          if (rndMap[grp] === undefined) rndMap[grp] = Math.floor(rng() * nP);
          pen = rndMap[grp];
        } else {
          pen = grp % nP;
        }
        return { ...path, layer: (Math.round(p.start) + pen) % PENS.length };
      });
      return { paths };
    },
  
};
