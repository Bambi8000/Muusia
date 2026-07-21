import { Pin } from "../helpers.js";

export default {
  key: "shaper",
    name: "Shaper",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "curve", label: "Curve", type: "select", options: ["Linear", "Smoothstep", "Ease in", "Ease out", "Ease in-out", "Bounce", "Reverse", "Triangle"], def: "Smoothstep" },
      { key: "repeat", label: "Repeat / loop", type: "slider", min: 1, max: 8, step: 1, def: 1 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const rep = Math.max(1, Math.round(p.repeat));
      /* end-inclusive wrap: t=1 lands on the END of the last cycle, so a
         write-on driven by Frame does not snap back on its final frame.
         (For a seamless LOOP use Triangle, whose endpoints match anyway.) */
      let u = ((raw * rep) % 1 + 1) % 1;
      if (u === 0 && raw * rep > 0) u = 1;
      switch (p.curve) {
        case "Linear": return u;
        case "Ease in": return u * u * u;
        case "Ease out": { const w = 1 - u; return 1 - w * w * w; }
        case "Ease in-out": return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        case "Bounce": {
          const n1 = 7.5625, d1 = 2.75;
          let x = u;
          if (x < 1 / d1) return n1 * x * x;
          if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
          if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
          x -= 2.625 / d1; return n1 * x * x + 0.984375;
        }
        case "Reverse": return 1 - u;
        case "Triangle": return 1 - Math.abs(u * 2 - 1);
        default: return u * u * (3 - 2 * u);
      }
    }
  
};
