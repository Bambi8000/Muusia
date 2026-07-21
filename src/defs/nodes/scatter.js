import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "scatter",
    name: "Scatter", cat: "mod", group: "cutsplit", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Gradient", type: "select", options: ["Top → Bottom", "Bottom → Top", "Left → Right", "Right → Left", "Radial", "Uniform"], def: "Top → Bottom" },
      { key: "offset", label: "Max offset mm", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
      { key: "rot", label: "Max rotate °", type: "slider", min: 0, max: 90, step: 1, def: 25 },
      { key: "seed", label: "Seed", type: "seed", def: 33 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const paths = src.paths.map((path, i) => {
        const cx = path.pts.reduce((s, q) => s + q[0], 0) / path.pts.length;
        const cy = path.pts.reduce((s, q) => s + q[1], 0) / path.pts.length;
        let f;
        switch (p.mode) {
          case "Top → Bottom": f = cy / H; break;
          case "Bottom → Top": f = 1 - cy / H; break;
          case "Left → Right": f = cx / W; break;
          case "Right → Left": f = 1 - cx / W; break;
          case "Radial": f = Math.hypot(cx - W / 2, cy - H / 2) / (Math.hypot(W, H) / 2); break;
          default: f = 1;
        }
        f = Math.max(0, Math.min(1, f));
        const rng = mulberry32(p.seed * 613 + i * 89 + 7);
        const ang = rng() * Math.PI * 2;
        const dist = rng() * p.offset * f;
        const tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist;
        const rad = ((rng() - 0.5) * 2 * p.rot * f * Math.PI) / 180;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        return {
          ...path,
          pts: path.pts.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            return [cx + dx * ca - dy * sa + tx, cy + dx * sa + dy * ca + ty];
          }),
        };
      });
      return { paths };
    },
  
};
