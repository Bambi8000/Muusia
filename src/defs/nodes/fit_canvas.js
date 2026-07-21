import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "fit_canvas",
      name: "Fit to Canvas",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 80, step: 1, def: 15 },
      { key: "mode", label: "Mode", type: "select", options: ["Fit (contain)", "Stretch (fill)", "Fit width", "Fit height"], def: "Fit (contain)" },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const path of src.paths) for (const [x, y] of path.pts) {
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
      const bw = Math.max(0.01, x1 - x0), bh = Math.max(0.01, y1 - y0);
      const aw = Math.max(1, ctx.W - 2 * p.margin), ah = Math.max(1, ctx.H - 2 * p.margin);
      let sx, sy;
      if (p.mode === "Stretch (fill)") { sx = aw / bw; sy = ah / bh; }
      else if (p.mode === "Fit width") { sx = sy = aw / bw; }
      else if (p.mode === "Fit height") { sx = sy = ah / bh; }
      else { sx = sy = Math.min(aw / bw, ah / bh); }
      const ox = (ctx.W - bw * sx) / 2, oy = (ctx.H - bh * sy) / 2;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [ox + (x - x0) * sx, oy + (y - y0) * sy]),
      }));
      return { paths };
    }
  
};
