import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "magnet",
    name: "Magnet", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "px", label: "Point X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Point Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "radius", label: "Radius mm", type: "slider", min: 5, max: 250, step: 1, def: 70 },
      { key: "strength", label: "Strength mm (− attract)", type: "slider", min: -40, max: 40, step: 0.5, def: 12 },
      { key: "falloff", label: "Falloff", type: "select", options: ["Linear", "Smooth"], def: "Smooth" },
    ],
    overlay(p) {
      return [{ kind: "circle", cx: p.px, cy: p.py, r: p.radius }, { kind: "point", x: p.px, y: p.py }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const dx = x - p.px, dy = y - p.py;
          const d = Math.hypot(dx, dy);
          if (d >= p.radius || d < 0.001) return [x, y];
          let t = 1 - d / p.radius;
          if (p.falloff === "Smooth") t = t * t * (3 - 2 * t);
          const f = p.strength * t;
          return [x + (dx / d) * f, y + (dy / d) * f];
        }),
      }));
      return { paths };
    },
  
};
