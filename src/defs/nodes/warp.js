import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "warp",
    name: "Warp", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["4 corners", "Grid lattice"], def: "4 corners" },
      { key: "tlx", label: "TL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "tly", label: "TL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trx", label: "TR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trY", label: "TR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "brx", label: "BR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bry", label: "BR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "blx", label: "BL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bly", label: "BL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "cells", label: "Grid cells", type: "slider", min: 2, max: 12, step: 1, def: 4 },
      { key: "amp", label: "Grid amp mm", type: "slider", min: 0, max: 60, step: 0.5, def: 15 },
      { key: "seed", label: "Grid seed", type: "seed", def: 21 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      let disp;
      if (p.mode === "4 corners") {
        disp = (x, y) => {
          const u = Math.max(0, Math.min(1, x / W)), v = Math.max(0, Math.min(1, y / H));
          const topX = p.tlx + (p.trx - p.tlx) * u, botX = p.blx + (p.brx - p.blx) * u;
          const topY = p.tly + (p.trY - p.tly) * u, botY = p.bly + (p.bry - p.bly) * u;
          return [topX + (botX - topX) * v, topY + (botY - topY) * v];
        };
      } else {
        const n = Math.round(p.cells);
        const rng = mulberry32(p.seed * 359 + 41);
        const lat = [];
        for (let j = 0; j <= n; j++) {
          const row = [];
          for (let i = 0; i <= n; i++) {
            /* reunat paikoillaan, sisäpisteet satunnaisesti */
            const edge = i === 0 || j === 0 || i === n || j === n;
            row.push(edge ? [0, 0] : [(rng() - 0.5) * 2 * p.amp, (rng() - 0.5) * 2 * p.amp]);
          }
          lat.push(row);
        }
        const sm = (t) => t * t * (3 - 2 * t);
        disp = (x, y) => {
          const fx = Math.max(0, Math.min(n - 0.0001, (x / W) * n));
          const fy = Math.max(0, Math.min(n - 0.0001, (y / H) * n));
          const i = Math.floor(fx), j = Math.floor(fy);
          const tx = sm(fx - i), ty = sm(fy - j);
          const a = lat[j][i], b = lat[j][i + 1], c = lat[j + 1][i], d = lat[j + 1][i + 1];
          return [
            (a[0] + (b[0] - a[0]) * tx) * (1 - ty) + (c[0] + (d[0] - c[0]) * tx) * ty,
            (a[1] + (b[1] - a[1]) * tx) * (1 - ty) + (c[1] + (d[1] - c[1]) * tx) * ty,
          ];
        };
      }
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 1.2).map(([x, y]) => {
          const [dx, dy] = disp(x, y);
          return [x + dx, y + dy];
        }),
      }));
      return { paths };
    },
  
};
