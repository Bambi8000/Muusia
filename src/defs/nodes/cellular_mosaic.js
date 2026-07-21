import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "cellular_mosaic",
    name: "Cellular Mosaic Displace",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 719 },
      { key: "scale", label: "Cell Size (mm)", type: "slider", min: 3, max: 40, step: 0.5, def: 12 },
      { key: "shatter", label: "Shatter Explode", type: "slider", min: 0, max: 25, step: 0.5, def: 8 },
      { key: "quantize", label: "Snap to Grid", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      const cellSize = Math.max(1, p.scale);
      const q = cellSize / 4; /* sub-lattice pitch for quantize mode */

      const flushSeg = (pts, layer) => {
        /* drop consecutive duplicates; a path of identical points is a
           zero-length pen mark */
        const clean = [];
        for (const pt of pts) {
          const last = clean[clean.length - 1];
          if (!last || Math.abs(last[0] - pt[0]) > 1e-6 || Math.abs(last[1] - pt[1]) > 1e-6) {
            clean.push(pt);
          }
        }
        if (clean.length > 1) paths.push({ pts: clean, closed: false, layer });
      };

      src.paths.forEach((path) => {
        const densified = resample(path.pts, path.closed, 0.5);
        if (densified.length < 2) return;
        let currentPts = [];
        let lastCellKey = "";
        for (let i = 0; i < densified.length; i++) {
          const [x, y] = densified[i];
          const gx = Math.floor(x / cellSize);
          const gy = Math.floor(y / cellSize);
          const hx = hash2(gx, gy, p.seed);
          const hy = hash2(gx, gy, p.seed + 555);
          const cellKey = gx + "_" + gy;
          if (cellKey !== lastCellKey && currentPts.length > 0) {
            flushSeg(currentPts, path.layer);
            currentPts = [];
          }
          const dx = (hx - 0.5) * p.shatter;
          const dy = (hy - 0.5) * p.shatter;
          let nx = x + dx;
          let ny = y + dy;
          if (p.quantize) {
            /* snap the point to a sub-lattice INSIDE the cell.
               (Snapping every point to one cell corner collapsed whole
               segments into zero-length stacks of identical points.) */
            nx = Math.round(x / q) * q + dx;
            ny = Math.round(y / q) * q + dy;
          }
          currentPts.push([nx, ny]);
          lastCellKey = cellKey;
        }
        flushSeg(currentPts, path.layer);
      });
      return { paths };
    }
  
};
