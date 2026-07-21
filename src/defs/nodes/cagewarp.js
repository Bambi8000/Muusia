import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "cagewarp",
    name: "Cage Warp",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "grid", label: "Cage cells", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "amount", label: "Amount mm", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "pin", label: "Pin edges", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.5 },
      { key: "seed", label: "Seed", type: "seed", def: 23 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const G = Math.max(1, Math.min(8, Math.round(p.grid)));
      const amt = Math.max(0, p.amount);
      /* seeded control-point displacements on a (G+1)x(G+1) lattice */
      const dxs = [], dys = [];
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          const border = i === 0 || j === 0 || i === G || j === G;
          const k = p.pin && border ? 0 : 1;
          dxs.push((hash2(i * 7 + 1, j * 7 + 2, p.seed) - 0.5) * 2 * amt * k);
          dys.push((hash2(i * 7 + 3, j * 7 + 4, p.seed + 99) - 0.5) * 2 * amt * k);
        }
      }
      const at = (arr, i, j) => arr[j * (G + 1) + i];
      const ss = (t) => t * t * (3 - 2 * t);
      const disp = (x, y) => {
        const u = Math.max(0, Math.min(0.9999, x / W)) * G;
        const v = Math.max(0, Math.min(0.9999, y / H)) * G;
        const i = Math.floor(u), j = Math.floor(v);
        const fu = ss(u - i), fv = ss(v - j);
        const bl = (arr) =>
          at(arr, i, j) * (1 - fu) * (1 - fv) + at(arr, i + 1, j) * fu * (1 - fv) +
          at(arr, i, j + 1) * (1 - fu) * fv + at(arr, i + 1, j + 1) * fu * fv;
        return [bl(dxs), bl(dys)];
      };
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.3, p.res)).map(([x, y]) => {
          const [dx, dy] = disp(x, y);
          return [clampX(x + dx), clampY(y + dy)];
        })
      }));
      return { paths };
    }
  
};
