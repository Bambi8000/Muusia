import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "align",
      name: "Align",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "hor", label: "Horizontal", type: "select", options: ["None", "Left", "Center", "Right"], def: "Center" },
      { key: "ver", label: "Vertical", type: "select", options: ["None", "Top", "Middle", "Bottom"], def: "Middle" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 80, step: 1, def: 10 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const path of src.paths) for (const [x, y] of path.pts) {
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
      let dx = 0, dy = 0;
      if (p.hor === "Left") dx = p.margin - x0;
      else if (p.hor === "Center") dx = (ctx.W - (x1 - x0)) / 2 - x0;
      else if (p.hor === "Right") dx = ctx.W - p.margin - x1;
      if (p.ver === "Top") dy = p.margin - y0;
      else if (p.ver === "Middle") dy = (ctx.H - (y1 - y0)) / 2 - y0;
      else if (p.ver === "Bottom") dy = ctx.H - p.margin - y1;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [x + dx, y + dy]),
      }));
      return { paths };
    }
  
};
