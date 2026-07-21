import { Pin, EMPTY, mulberry32, hash2, noise2, resample } from "../helpers.js";

export default {
  key: "glitch_loom",
    name: "Glitch Loom",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 42 },
      { key: "pitch", label: "Loom Pitch (mm)", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "shift", label: "Max Warp Shift", type: "slider", min: 0, max: 60, step: 1, def: 20 },
      { key: "fray", label: "Fray Probability", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "fray_len", label: "Fray Length", type: "slider", min: 2, max: 40, step: 1, def: 12 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 48611 + 12345);
      const paths = [];
      const pitchVal = Math.max(0.5, p.pitch);
      const stepSize = Math.max(0.2, pitchVal / 6);
      /* the app does not clip out-of-canvas geometry, so the mod must:
         shifted rows and frayed threads are clamped to the sheet */
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));

      src.paths.forEach((path) => {
        const resampled = resample(path.pts, path.closed, stepSize);
        if (resampled.length < 2) return;
        let currentSegment = [];
        let lastRow = Math.floor(resampled[0][1] / pitchVal);
        const flush = (row) => {
          if (currentSegment.length < 2) { currentSegment = []; return; }
          const rowSeed = hash2(0, row, p.seed);
          const dx = (rowSeed - 0.5) * 2 * p.shift;
          const shiftedPts = currentSegment.map(([sx, sy]) => [clampX(sx + dx), sy]);
          paths.push({ pts: shiftedPts, closed: false, layer: path.layer });
          if (rng() < p.fray) {
            const lastPt = shiftedPts[shiftedPts.length - 1];
            const frayPts = [lastPt.slice()];
            const steps = 6;
            for (let k = 1; k <= steps; k++) {
              const t = k / steps;
              const fx = clampX(lastPt[0] + (noise2(lastPt[0] * 0.08, t * 3, p.seed + row) - 0.5) * 6);
              const fy = clampY(lastPt[1] + t * p.fray_len);
              frayPts.push([fx, fy]);
            }
            paths.push({ pts: frayPts, closed: false, layer: path.layer });
          }
          currentSegment = [];
        };
        for (let i = 0; i < resampled.length; i++) {
          const [x, y] = resampled[i];
          const currentRow = Math.floor(y / pitchVal);
          if (currentRow !== lastRow && currentSegment.length > 0) flush(lastRow);
          currentSegment.push([x, y]);
          lastRow = currentRow;
        }
        flush(lastRow);
      });
      return { paths };
    }
  
};
