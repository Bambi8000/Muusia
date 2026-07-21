import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "lens",
    name: "Lens", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "useCenter", label: "Use canvas center", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "radius", label: "Radius mm", type: "slider", min: 10, max: 300, step: 1, def: 90 },
      { key: "strength", label: "Strength (− pinch, + bulge)", type: "slider", min: -0.9, max: 0.9, step: 0.05, def: 0.4 },
    ],
    overlay(p, ctx) {
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      return [{ kind: "circle", cx, cy, r: p.radius }, { kind: "point", x: cx, y: cy }];
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d >= p.radius || d < 0.001) return [x, y];
          const t = 1 - d / p.radius;
          const f = 1 + p.strength * t * t;
          return [cx + dx * f, cy + dy * f];
        }),
      }));
      return { paths };
    },
  
};
