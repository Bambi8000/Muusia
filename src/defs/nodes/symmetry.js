import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "symmetry",
    name: "Symmetry", cat: "mod", group: "transform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "folds", label: "Folds", type: "slider", min: 1, max: 12, step: 1, def: 6 },
      { key: "mirror", label: "Mirror", type: "check", def: false },
      { key: "useCenter", label: "Use canvas center", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      const folds = Math.max(1, Math.round(p.folds));
      const paths = [];
      const variants = p.mirror
        ? [(x, y) => [x, y], (x, y) => [2 * cx - x, y]]
        : [(x, y) => [x, y]];
      for (const path of src.paths) {
        for (const v of variants) {
          const base = path.pts.map(([x, y]) => v(x, y));
          for (let k = 0; k < folds; k++) {
            const a = (k / folds) * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            paths.push({
              pts: base.map(([x, y]) => {
                const dx = x - cx, dy = y - cy;
                return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
              }),
              closed: path.closed, layer: path.layer,
            });
          }
        }
      }
      return { paths };
    },
  
};
