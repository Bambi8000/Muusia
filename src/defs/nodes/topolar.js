import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "topolar",
    name: "To Polar",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "rin", label: "Inner radius mm", type: "slider", min: 0, max: 80, step: 1, def: 15 },
      { key: "turns", label: "Turns", type: "slider", min: 0.25, max: 3, step: 0.05, def: 1 },
      { key: "start", label: "Start angle deg", type: "slider", min: 0, max: 360, step: 1, def: 270 },
      { key: "flip", label: "Top of canvas", type: "select", options: ["Outer edge", "Inner edge"], def: "Outer edge" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const rOut = Math.min(W, H) / 2 - m;
      const rIn = Math.max(0, Math.min(p.rin, rOut - 2));
      if (rOut - rIn < 2) return { paths: [] };
      const cx = W / 2, cy = H / 2;
      const a0 = (p.start * Math.PI) / 180;
      const TWO = Math.PI * 2;
      const outerTop = p.flip === "Outer edge";
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      /* cartesian canvas wrapped onto a ring: x -> angle, y -> radius */
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.25, p.res)).map(([x, y]) => {
          const u = x / W;
          const v = y / H;
          const ang = a0 + u * p.turns * TWO;
          const frac = outerTop ? 1 - v : v;
          const rr = rIn + frac * (rOut - rIn);
          return clamp([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
        })
      }));
      return { paths };
    }
  
};
