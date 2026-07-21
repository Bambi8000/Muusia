import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "copypoints",
    name: "Copy to Points",
    cat: "duo",
    ins: [Pin("paths", "Points"), Pin("paths", "Motif")],
    outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Point spacing mm (0=vertices)", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
      { key: "scale", label: "Scale %", type: "slider", min: 5, max: 300, step: 1, def: 100 },
      { key: "sjit", label: "Scale jitter %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
      { key: "rmode", label: "Rotation", type: "select", options: ["None", "Along tangent", "Random"], def: "None" },
      { key: "rjit", label: "Rotation jitter deg", type: "slider", min: 0, max: 180, step: 1, def: 0 },
      { key: "prob", label: "Probability", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
      { key: "seed", label: "Seed", type: "seed", def: 31 }
    ],
    compute(ins, p, ctx) {
      const ptsIn = ins[0], motifIn = ins[1];
      if (!ptsIn || !ptsIn.paths || !ptsIn.paths.length) return EMPTY;
      if (!motifIn || !motifIn.paths || !motifIn.paths.length) return EMPTY;
      /* motif centered on its bounding-box center */
      let mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
      for (const pa of motifIn.paths) for (const [x, y] of pa.pts) {
        if (x < mx0) mx0 = x; if (x > mx1) mx1 = x;
        if (y < my0) my0 = y; if (y > my1) my1 = y;
      }
      const mcx = (mx0 + mx1) / 2, mcy = (my0 + my1) / 2;
      const paths = [];
      const BUDGET = 100000;
      let total = 0, idx = 0;
      for (const host of ptsIn.paths) {
        const pts = p.spacing > 0.01
          ? resample(host.pts, host.closed, Math.max(0.5, p.spacing))
          : host.pts;
        for (let i = 0; i < pts.length; i++) {
          idx++;
          if (p.prob < 1 && hash2(idx * 3 + 1, 5, p.seed) >= p.prob) continue;
          const sc = (p.scale / 100) *
            (1 + (hash2(idx * 3 + 2, 7, p.seed) - 0.5) * 2 * (p.sjit / 100));
          if (sc <= 0.001) continue;
          let ang = 0;
          if (p.rmode === "Along tangent") {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          } else if (p.rmode === "Random") {
            ang = hash2(idx * 3 + 3, 9, p.seed) * Math.PI * 2;
          }
          ang += (hash2(idx * 3 + 4, 11, p.seed) - 0.5) * 2 * (p.rjit * Math.PI / 180);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const [px, py] = pts[i];
          for (const mp of motifIn.paths) {
            if (total + mp.pts.length > BUDGET) return { paths };
            total += mp.pts.length;
            paths.push({
              pts: mp.pts.map(([x, y]) => {
                const lx = (x - mcx) * sc, ly = (y - mcy) * sc;
                return [px + lx * ca - ly * sa, py + lx * sa + ly * ca];
              }),
              closed: mp.closed, layer: mp.layer
            });
          }
        }
      }
      return { paths };
    }
  
};
