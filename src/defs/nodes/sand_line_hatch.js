import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "sand_line_hatch",
    name: "Sand Line Hatch",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 1337 },
      { key: "lines", label: "Line Count", type: "slider", min: 10, max: 200, step: 1, def: 80 },
      { key: "density", label: "Max Density", type: "slider", min: 0.1, max: 1.0, step: 0.05, def: 0.7 },
      { key: "freq", label: "Noise Frequency", type: "slider", min: 0.001, max: 0.05, step: 0.001, def: 0.015 },
      { key: "grain_len", label: "Grain Length (mm)", type: "slider", min: 0.5, max: 5.0, step: 0.1, def: 1.5 },
      { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      if (W - 2 * m < 5 || H - 2 * m < 5) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 997 + 11);
      const paths = [];
      const L = Math.round(p.layer);
      const count = Math.round(p.lines);
      const grainSize = Math.max(0.2, p.grain_len);
      const dens = Math.max(0, Math.min(1, p.density));

      for (let i = 0; i < count; i++) {
        const y = m + ((H - 2 * m) * (i / (count - 1 || 1)));
        const lineSegs = [];
        let x = m;
        let runStart = null;
        while (x < W - m) {
          const noiseVal = noise2(x * p.freq, y * p.freq, p.seed);
          /* darkness = noise * density: density now scales ink amount correctly
             (the old rng()*density threshold was inverted: low density = MORE ink) */
          if (rng() < noiseVal * dens) {
            if (runStart === null) runStart = x;
            x = Math.min(x + grainSize, W - m);
          } else {
            if (runStart !== null && x - runStart > 0.1) {
              lineSegs.push([[runStart, y], [x, y]]); /* runs are collinear: 2 pts suffice */
            }
            runStart = null;
            x += grainSize * (0.5 + rng() * 0.5);
          }
        }
        if (runStart !== null && x - runStart > 0.1) {
          lineSegs.push([[runStart, y], [Math.min(x, W - m), y]]);
        }
        /* serpentine: alternate line direction so the pen never shuttles back empty */
        if (i % 2 === 1) {
          lineSegs.reverse();
          for (const seg of lineSegs) seg.reverse();
        }
        for (const seg of lineSegs) paths.push({ pts: seg, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
