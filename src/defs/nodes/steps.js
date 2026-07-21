import { Pin, hash2 } from "../helpers.js";

export default {
  key: "steps",
    name: "Steps",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "steps", label: "Steps", type: "slider", min: 2, max: 16, step: 1, def: 4 },
      { key: "mode", label: "Pattern", type: "select", options: ["Ramp up", "Ramp down", "Ping-pong", "Random"], def: "Ramp up" },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed (random)", type: "seed", def: 4 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const N = Math.max(2, Math.min(64, Math.round(p.steps)));
      const u = ((raw % 1) + 1) % 1;
      const i = Math.min(N - 1, Math.floor(u * N));
      let f;
      if (p.mode === "Ramp down") f = 1 - i / (N - 1);
      else if (p.mode === "Ping-pong") {
        const half = Math.ceil((N - 1) / 2);
        f = (i <= half ? i : (N - 1 - i)) / Math.max(1, half);
      }
      else if (p.mode === "Random") f = hash2(i * 17 + 3, 7, p.seed);
      else f = i / (N - 1);
      return p.min + f * (p.max - p.min);
    }
  
};
