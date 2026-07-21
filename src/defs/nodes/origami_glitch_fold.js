import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "origami_glitch_fold",
    name: "Origami Glitch Fold",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "angle", label: "Fold Angle (deg)", type: "slider", min: 0, max: 360, step: 1, def: 45 },
      { key: "offset", label: "Axis Position", type: "slider", min: -100, max: 100, step: 1, def: 0 },
      { key: "distortion", label: "Crease Warp", type: "slider", min: -0.5, max: 0.5, step: 0.01, def: 0.15 },
      { key: "keep", label: "Keep Original", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const rad = (p.angle * Math.PI) / 180;
      const nx = Math.cos(rad);
      const ny = Math.sin(rad);
      const cx = W / 2 + nx * p.offset;
      const cy = H / 2 + ny * p.offset;
      /* mirroring can fling points far off the sheet and the app does not clip */
      const clamp = ([x, y]) => [
        Math.max(0.5, Math.min(W - 0.5, x)),
        Math.max(0.5, Math.min(H - 0.5, y))
      ];

      const paths = [];
      src.paths.forEach((path) => {
        if (p.keep) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
        }
        const densified = resample(path.pts, path.closed, 1.0);
        const modifiedPts = densified.map(([x, y]) => {
          const dx = x - cx;
          const dy = y - cy;
          const distance = dx * nx + dy * ny;
          if (distance > 0) {
            let rx = x - 2 * distance * nx;
            let ry = y - 2 * distance * ny;
            const warpFactor = Math.abs(distance) * p.distortion;
            rx += -ny * warpFactor;
            ry += nx * warpFactor;
            return clamp([rx, ry]);
          }
          return [x, y];
        });
        paths.push({ ...path, pts: modifiedPts, closed: path.closed });
      });
      return { paths };
    }
  
};
