import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "view3d",
    name: "3D View",
    cat: "mod",
    group: "deform",
    desc: "Puts the drawing into 3D space and views it from any angle: yaw/pitch/roll with adjustable perspective (0 = isometric, 1 = dramatic). Z source: Flat tilts the sheet like paper; Pens stacked gives each pen layer its own depth (parallax when rotated); Noise relief bends the drawing over a heightfield. Wire Frame into Yaw for a spinning-drawing animation.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "yaw", label: "Yaw deg (wire Frame x360)", type: "slider", min: 0, max: 360, step: 1, def: 30 },
      { key: "pitch", label: "Pitch deg", type: "slider", min: -90, max: 90, step: 1, def: 30 },
      { key: "roll", label: "Roll deg", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.02, def: 0.5 },
      { key: "zsource", label: "Z source", type: "select", options: ["Flat", "Pens stacked", "Noise relief"], def: "Flat" },
      { key: "gap", label: "Pen layer gap mm", type: "slider", min: 1, max: 40, step: 0.5, def: 10 },
      { key: "relief", label: "Relief height mm", type: "slider", min: 0, max: 60, step: 1, def: 25 },
      { key: "rscale", label: "Relief scale", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.5 },
      { key: "fit", label: "Fit to sheet", type: "check", def: true },
      { key: "res", label: "Relief sample mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.2 },
      { key: "seed", label: "Seed (relief)", type: "seed", def: 3 },
      { key: "margin", label: "Fit margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const D2R = Math.PI / 180;
      const ya = p.yaw * D2R, pi2 = p.pitch * D2R, ro = p.roll * D2R;
      const cyaw = Math.cos(ya), syaw = Math.sin(ya);
      const cpit = Math.cos(pi2), spit = Math.sin(pi2);
      const crol = Math.cos(ro), srol = Math.sin(ro);
      /* perspective: exponential focal curve — 0 is genuinely isometric
         (focal ~60x canvas), 0.5 pleasant, 1 dramatic */
      const span = Math.max(W, H);
      const FOC = span * 0.7 * Math.pow(85, 1 - Math.max(0, Math.min(1, p.persp)));
      const zOf = (x, y, layer) => {
        if (p.zsource === "Pens stacked") return -(layer || 0) * Math.max(0, p.gap);
        if (p.zsource === "Noise relief") {
          return (noise2(x * 0.012 * p.rscale + 5.7, y * 0.012 * p.rscale + 2.3, p.seed) - 0.5) * 2 * Math.max(0, p.relief);
        }
        return 0;
      };
      const proj = (x, y, layer) => {
        let X = x - cx, Y = y - cy, Z = zOf(x, y, layer);
        /* roll (Z axis) */
        let X1 = X * crol - Y * srol, Y1 = X * srol + Y * crol;
        /* yaw (Y axis) */
        let X2 = X1 * cyaw + Z * syaw;
        let Z2 = -X1 * syaw + Z * cyaw;
        /* pitch (X axis) */
        const Y3 = Y1 * cpit - Z2 * spit;
        const Z3 = Y1 * spit + Z2 * cpit;
        const s = FOC / Math.max(FOC * 0.1, FOC + Z3);
        return [X2 * s, Y3 * s];
      };
      /* straight lines stay straight under perspective, so resampling is only
         needed when the relief bends the plane itself */
      const needResample = p.zsource === "Noise relief";
      const projected = src.paths.map((path) => ({
        layer: path.layer, closed: path.closed,
        pts: (needResample ? resample(path.pts, path.closed, Math.max(0.4, p.res)) : path.pts)
          .map(([x, y]) => proj(x, y, path.layer))
      }));
      /* fit or clamp */
      const m = Math.max(0, p.margin);
      let paths;
      if (p.fit) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const pa of projected) for (const [x, y] of pa.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const bw = W - 2 * m, bh = H - 2 * m;
        const sc = Math.min(bw / ((x1 - x0) || 1), bh / ((y1 - y0) || 1));
        const ox = m + (bw - (x1 - x0) * sc) / 2 - x0 * sc;
        const oy = m + (bh - (y1 - y0) * sc) / 2 - y0 * sc;
        paths = projected.map((pa) => ({
          ...pa, pts: pa.pts.map(([x, y]) => [x * sc + ox, y * sc + oy])
        }));
      } else {
        paths = projected.map((pa) => ({
          ...pa,
          pts: pa.pts.map(([x, y]) => [
            Math.max(0.5, Math.min(W - 0.5, x + cx)),
            Math.max(0.5, Math.min(H - 0.5, y + cy))
          ])
        }));
      }
      return { paths };
    }
  
};
