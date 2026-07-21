import { Pin, EMPTY, PENS } from "../helpers.js";

export default {
  key: "merge",
    name: "Merge", cat: "duo",
    ins: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 2 }, (_, i) => Pin("paths", String(i + 1))),
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Inputs", type: "slider", min: 2, max: 6, step: 1, def: 2 },
      { key: "penPer", label: "Pen change per input", type: "check", def: false },
    ],
    compute(ins, p) {
      const paths = [];
      for (let i = 0; i < Math.round(p.count); i++) {
        const src = ins[i] || EMPTY;
        if (!src.paths) continue;
        for (const path of src.paths) paths.push(p.penPer ? { ...path, layer: i % PENS.length } : path);
      }
      return { paths };
    },
  
};
