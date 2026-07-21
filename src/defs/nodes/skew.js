import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "skew",
      name: "Skew",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "skx", label: "Skew X °", type: "slider", min: -60, max: 60, step: 0.5, def: 15 },
      { key: "sky", label: "Skew Y °", type: "slider", min: -60, max: 60, step: 0.5, def: 0 },
      { key: "origin", label: "Origin", type: "select", options: ["Content center", "Canvas center"], def: "Content center" },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let ox, oy;
      if (p.origin === "Canvas center") { ox = ctx.W / 2; oy = ctx.H / 2; }
      else {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const path of src.paths) for (const [x, y] of path.pts) {
          if (x < x0) x0 = x; if (y < y0) y0 = y;
          if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
        ox = (x0 + x1) / 2; oy = (y0 + y1) / 2;
      }
      const tx = Math.tan((p.skx * Math.PI) / 180);
      const ty = Math.tan((p.sky * Math.PI) / 180);
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const rx = x - ox, ry = y - oy;
          return [ox + rx + ry * tx, oy + ry + rx * ty];
        }),
      }));
      return { paths };
    }
  
};
