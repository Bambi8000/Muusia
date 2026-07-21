import { Pin, noise2 } from "../helpers.js";

export default {
  key: "lfo",
    name: "LFO",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "wave", label: "Waveform", type: "select", options: ["Sine", "Triangle", "Saw", "Square", "Noise loop"], def: "Sine" },
      { key: "cycles", label: "Cycles / loop", type: "slider", min: 1, max: 16, step: 1, def: 1 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed (noise)", type: "seed", def: 8 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const cyc = Math.max(1, Math.round(p.cycles)); /* integer -> loop stays seamless */
      const u = ((raw * cyc + p.phase) % 1 + 1) % 1;
      let v;
      if (p.wave === "Triangle") v = 1 - Math.abs(u * 2 - 1);
      else if (p.wave === "Saw") v = u;
      else if (p.wave === "Square") v = u < 0.5 ? 1 : 0;
      else if (p.wave === "Noise loop") {
        const a = u * Math.PI * 2;
        v = noise2(Math.cos(a) * 1.5 + 7.3, Math.sin(a) * 1.5 + 2.9, p.seed);
      } else v = 0.5 + 0.5 * Math.sin(u * Math.PI * 2);
      return p.min + v * (p.max - p.min);
    }
  
};
