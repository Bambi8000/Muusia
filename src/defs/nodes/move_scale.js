import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "move_scale",
      name: "Move / Scale",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "dx", label: "Move X mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "dy", label: "Move Y mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "scale", label: "Scale %", type: "slider", min: 5, max: 400, step: 1, def: 100 },
      { key: "scaleY", label: "Scale Y % (0 = same)", type: "slider", min: 0, max: 400, step: 1, def: 0 },
      { key: "origin", label: "Scale origin", type: "select", options: ["Content center", "Canvas center", "Custom point"], def: "Content center" },
      { key: "ox", label: "Origin X mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "oy", label: "Origin Y mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    overlay(p, ctx) {
      if (p.origin === "Custom point") return [{ kind: "point", x: p.ox, y: p.oy }];
      if (p.origin === "Canvas center") return [{ kind: "point", x: ctx.W / 2, y: ctx.H / 2 }];
      return [];
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let ox, oy;
      if (p.origin === "Canvas center") { ox = ctx.W / 2; oy = ctx.H / 2; }
      else if (p.origin === "Custom point") { ox = p.ox; oy = p.oy; }
      else {
        /* sisallon bbox-keskipiste */
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const path of src.paths) for (const [x, y] of path.pts) {
          if (x < x0) x0 = x; if (y < y0) y0 = y;
          if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
        ox = (x0 + x1) / 2; oy = (y0 + y1) / 2;
      }
      const sx = p.scale / 100;
      const sy = p.scaleY > 0 ? p.scaleY / 100 : sx;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [
          ox + (x - ox) * sx + p.dx,
          oy + (y - oy) * sy + p.dy,
        ]),
      }));
      return { paths };
    }
  
};
