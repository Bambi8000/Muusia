import { Pin, EMPTY, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "tvnoise",
      name: "Noise",
    cat: "gen", group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Pixel shape", type: "select", options: ["Square", "Circle", "Dash (scanline)"], def: "Square" },
      { key: "cell", label: "Cell size mm", type: "slider", min: 0.8, max: 15, step: 0.1, def: 3 },
      { key: "density", label: "Density", type: "slider", min: 0.02, max: 1, step: 0.02, def: 0.3 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "posJit", label: "Position jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "bands", label: "Interference bands", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 107 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const cell = Math.max(0.5, p.cell);
      const cols = Math.min(400, Math.floor((W - 2 * m) / cell));
      const rows = Math.min(400, Math.floor((H - 2 * m) / cell));
      if (cols < 1 || rows < 1) return EMPTY;
      const paths = [];
      let budget = 9000; /* max pikselia */
      for (let r = 0; r < rows && budget > 0; r++) {
        /* hairintajuovat: tiheys aaltoilee riveittain kuin huono signaali */
        const band = p.bands > 0
          ? 1 - p.bands * (0.5 + 0.5 * Math.sin(r * 0.7 + noise2(0.3, r * 0.13, p.seed + 7) * 6))
          : 1;
        for (let c = 0; c < cols && budget > 0; c++) {
          const h = hash2(c, r, p.seed);
          if (h > p.density * band) continue;
          budget--;
          const rng = mulberry32((r * 7919 + c) * 31 + p.seed);
          const sz = (cell / 2) * 0.85 * (1 - p.sizeVar * rng());
          const x = m + (c + 0.5) * cell + (rng() - 0.5) * cell * p.posJit;
          const y = m + (r + 0.5) * cell + (rng() - 0.5) * cell * p.posJit;
          if (p.shape === "Square") {
            paths.push({ pts: [[x - sz, y - sz], [x + sz, y - sz], [x + sz, y + sz], [x - sz, y + sz]], closed: true, layer: L });
          } else if (p.shape === "Circle") {
            const pts = [];
            const n = sz < 1 ? 6 : 10;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              pts.push([x + Math.cos(a) * sz, y + Math.sin(a) * sz]);
            }
            paths.push({ pts, closed: true, layer: L });
          } else {
            /* scanline: vaakaviiru, pituus vaihtelee */
            const len = sz * (1.5 + rng() * 3);
            paths.push({ pts: [[x - len, y], [x + len, y]], closed: false, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
