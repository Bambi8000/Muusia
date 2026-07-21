import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "kierto",
    name: "Rotate", cat: "mod", group: "transform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "deg", label: "Angle °", type: "slider", min: -180, max: 180, step: 1, def: 15 },
      { key: "per", label: "Per path (centroid)", type: "check", def: false },
      { key: "grad", label: "Progressive (Molnár)", type: "check", def: false },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const rot = (pts, cx, cy, rad) =>
        pts.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
        });
      const n = src.paths.length || 1;
      const paths = src.paths.map((path, i) => {
        const f = p.grad ? i / n : 1;
        const rad = ((p.deg * Math.PI) / 180) * f;
        let cx = ctx.W / 2, cy = ctx.H / 2;
        if (p.per) {
          cx = path.pts.reduce((s, q) => s + q[0], 0) / path.pts.length;
          cy = path.pts.reduce((s, q) => s + q[1], 0) / path.pts.length;
        }
        return { ...path, pts: rot(path.pts, cx, cy, rad) };
      });
      return { paths };
    },
  
};
