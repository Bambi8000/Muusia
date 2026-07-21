import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "granulate",
    name: "Granulate",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "grain", label: "Grain length mm", type: "slider", min: 1, max: 25, step: 0.5, def: 6 },
      { key: "density", label: "Density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.9 },
      { key: "jitter", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 2 },
      { key: "rotate", label: "Rotate ± deg", type: "slider", min: 0, max: 90, step: 1, def: 12 },
      { key: "sjit", label: "Scale jitter %", type: "slider", min: 0, max: 80, step: 1, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 37 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const gl = Math.max(0.8, p.grain);
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      let gid = 0;
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.min(0.6, gl / 4));
        if (pts.length < 2) return;
        let start = 0, acc = 0;
        const flushGrain = (a, b) => {
          gid++;
          if (b - a < 1) return;
          if (hash2(gid * 5 + 1, 3, p.seed) >= Math.max(0, Math.min(1, p.density))) return;
          const grainPts = pts.slice(a, b + 1);
          /* transform the grain around its own centroid */
          let gx = 0, gy = 0;
          for (const [x, y] of grainPts) { gx += x; gy += y; }
          gx /= grainPts.length; gy /= grainPts.length;
          const jx = (hash2(gid * 5 + 2, 7, p.seed) - 0.5) * 2 * p.jitter;
          const jy = (hash2(gid * 5 + 3, 9, p.seed) - 0.5) * 2 * p.jitter;
          const ang = (hash2(gid * 5 + 4, 11, p.seed) - 0.5) * 2 * (p.rotate * Math.PI / 180);
          const sc = 1 + (hash2(gid * 5 + 5, 13, p.seed) - 0.5) * 2 * (p.sjit / 100);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          paths.push({
            pts: grainPts.map(([x, y]) => {
              const lx = (x - gx) * sc, ly = (y - gy) * sc;
              return clamp([gx + lx * ca - ly * sa + jx, gy + lx * sa + ly * ca + jy]);
            }),
            closed: false, layer: path.layer
          });
        };
        for (let i = 1; i < pts.length; i++) {
          acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (acc >= gl) { flushGrain(start, i); start = i; acc = 0; }
        }
        flushGrain(start, pts.length - 1);
      });
      return { paths };
    }
  
};
