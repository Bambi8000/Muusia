import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "tangle",
    name: "Tangle Zone", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Zone", type: "select", options: ["Rectangle", "Circle"], def: "Rectangle" },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "zw", label: "Width / Ø mm", type: "slider", min: 10, max: 300, step: 1, def: 120 },
      { key: "zh", label: "Height mm", type: "slider", min: 10, max: 300, step: 1, def: 90 },
      { key: "strength", label: "Strength mm", type: "slider", min: 0, max: 80, step: 0.5, def: 25 },
      { key: "scale", label: "Noise scale", type: "slider", min: 0.01, max: 0.3, step: 0.005, def: 0.05 },
      { key: "seed", label: "Seed", type: "seed", def: 31 },
    ],
    overlay(p) {
      return p.shape === "Circle"
        ? [{ kind: "circle", cx: p.cx, cy: p.cy, r: p.zw / 2 }]
        : [{ kind: "rect", x: p.cx - p.zw / 2, y: p.cy - p.zh / 2, w: p.zw, h: p.zh }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* voimakkuus 0 reunalla -> ankkurit pysyvat; kasvaa keskustaa kohti */
      const fall = (x, y) => {
        let t;
        if (p.shape === "Circle") {
          const d = Math.hypot(x - p.cx, y - p.cy);
          t = 1 - d / (p.zw / 2);
        } else {
          const fx = 1 - Math.abs(x - p.cx) / (p.zw / 2);
          const fy = 1 - Math.abs(y - p.cy) / (p.zh / 2);
          t = Math.min(fx, fy);
        }
        if (t <= 0) return 0;
        t = Math.min(1, t * 1.6);
        return t * t * (3 - 2 * t);
      };
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 1).map(([x, y]) => {
          const f = fall(x, y);
          if (f === 0) return [x, y];
          const dx = (noise2(x * p.scale, y * p.scale, p.seed) - 0.5) * 2;
          const dy = (noise2(x * p.scale + 77, y * p.scale + 31, p.seed) - 0.5) * 2;
          return [x + dx * p.strength * f, y + dy * p.strength * f];
        }),
      }));
      return { paths };
    },
  
};
