import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "switch",
    name: "Switch",
    cat: "duo",
    ins: [Pin("value", "Select"), Pin("paths", "A"), Pin("paths", "B"), Pin("paths", "C")],
    outs: [Pin("paths")],
    params: [
      { key: "sel", label: "Select (if unwired, wire Steps)", type: "slider", min: 0, max: 2, step: 1, def: 0 }
    ],
    compute(ins, p) {
      const val = typeof ins[0] === "number" ? ins[0] : p.sel;
      const wired = [];
      for (let i = 1; i <= 3; i++) {
        if (ins[i] && ins[i].paths && ins[i].paths.length) wired.push(ins[i]);
      }
      if (!wired.length) return EMPTY;
      const idx = ((Math.floor(val) % wired.length) + wired.length) % wired.length;
      const pick = wired[idx];
      return { paths: pick.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
    }
  
};
