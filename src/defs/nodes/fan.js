import { Pin, mulberry32 } from "../helpers.js";

export default {
  key: "fan",
    name: "Fan", cat: "math",
    ins: [Pin("value", "Value")],
    outs: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 3 }, (_, i) => Pin("value", String(i + 1))),
    params: [
      { key: "count", label: "Outputs", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "base", label: "Value (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 3 },
      { key: "mode", label: "Spread", type: "select", options: ["Same", "Step +", "Factor ×", "Random"], def: "Step +" },
      { key: "step", label: "Step", type: "slider", min: -50, max: 50, step: 0.25, def: 2 },
      { key: "seed", label: "Seed", type: "seed", def: 8 },
    ],
    compute(ins, p) {
      const v = typeof ins[0] === "number" ? ins[0] : p.base;
      const n = Math.round(p.count);
      const rng = mulberry32(p.seed * 613 + 29);
      const outs = [];
      for (let i = 0; i < n; i++) {
        if (p.mode === "Same") outs.push(v);
        else if (p.mode === "Step +") outs.push(v + p.step * i);
        else if (p.mode === "Factor ×") outs.push(v * Math.pow(p.step === 0 ? 1 : p.step, i));
        else outs.push(v + (rng() - 0.5) * 2 * p.step);
      }
      return outs;
    },
  
};
