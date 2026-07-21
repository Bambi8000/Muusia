import { Pin } from "../helpers.js";

export default {
  key: "adsr",
    name: "ADSR",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "a", label: "Attack", type: "slider", min: 0, max: 1, step: 0.01, def: 0.1 },
      { key: "d", label: "Decay", type: "slider", min: 0, max: 1, step: 0.01, def: 0.2 },
      { key: "s", label: "Sustain level", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: "r", label: "Release", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const u = Math.max(0, Math.min(1, raw));
      let a = Math.max(0, p.a), d = Math.max(0, p.d), r = Math.max(0, p.r);
      const sum = a + d + r;
      if (sum > 1) { a /= sum; d /= sum; r /= sum; } /* squeeze to fit; sustain -> 0 */
      const sus = Math.max(0, Math.min(1, p.s));
      const relStart = 1 - r;
      let v;
      if (u < a) v = a > 0 ? u / a : 1;
      else if (u < a + d) v = d > 0 ? 1 - (1 - sus) * ((u - a) / d) : sus;
      else if (u < relStart) v = sus;
      else v = r > 0 ? sus * (1 - (u - relStart) / r) : 0;
      return p.min + v * (p.max - p.min);
    }
  
};
