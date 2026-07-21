import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "fresnel",
    name: "Fresnel Lens", cat: "mod", group: "fillstyle", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Lens", type: "select", options: ["Circular", "Linear"], def: "Circular" },
      { key: "cx", label: "Center X mm", type: "slider", min: -100, max: 500, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: -100, max: 500, step: 1, def: 100 },
      { key: "angle", label: "Angle ° (linear)", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "radius", label: "Lens Ø mm", type: "slider", min: 20, max: 500, step: 1, def: 180 },
      { key: "zoneW", label: "Groove pitch mm", type: "slider", min: 2, max: 60, step: 0.5, def: 14 },
      { key: "strength", label: "Strength (− expand)", type: "slider", min: -0.85, max: 0.85, step: 0.05, def: 0.5 },
      { key: "curve", label: "Groove profile", type: "select", options: ["Lens (smooth)", "Prism (linear)"], def: "Lens (smooth)" },
      { key: "edge", label: "Edge falloff", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    ],
    overlay(p) {
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.mode === "Circular") {
        g.push({ kind: "circle", cx: p.cx, cy: p.cy, r: p.radius / 2 });
        /* pari uraa nakyviin */
        for (let r = p.zoneW; r < p.radius / 2; r += p.zoneW * 2) {
          g.push({ kind: "circle", cx: p.cx, cy: p.cy, r });
        }
      } else {
        const a = (p.angle * Math.PI) / 180;
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const R = p.radius / 2;
        g.push({
          kind: "poly",
          pts: [
            [p.cx - dx * R - px * R, p.cy - dy * R - py * R],
            [p.cx + dx * R - px * R, p.cy + dy * R - py * R],
            [p.cx + dx * R + px * R, p.cy + dy * R + py * R],
            [p.cx - dx * R + px * R, p.cy - dy * R + py * R],
          ],
        });
      }
      return g;
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      /* fresnel: linssin taittuma vyohykkeittain — siirtyma nollautuu joka uran
         reunalla -> samankeskiset leikkaus-epajatkuvuudet kuten oikeassa linssissa.
         Vyohykkeen sisainen kartoitus on monotoninen -> ei laskoksia uran sisalla. */
      const R = p.radius / 2;
      const dirA = (p.angle * Math.PI) / 180;
      const dux = Math.cos(dirA), duy = Math.sin(dirA);
      const remapU = (u, f) => {
        const s = p.strength * f;
        if (p.curve === "Prism (linear)") {
          /* lineaarinen puristus vyohykkeen alkuun/loppuun */
          const k = 1 + s * 1.6;
          const v = Math.pow(u, k);
          return v;
        }
        /* sileä linssikayra: eksponenttikartoitus (monotoninen) */
        return Math.pow(u, 1 + s * 2.2);
      };
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 0.7).map(([x, y]) => {
          let d, ux, uy;
          if (p.mode === "Circular") {
            const dx = x - p.cx, dy = y - p.cy;
            d = Math.hypot(dx, dy);
            if (d < 0.001 || d > R) return [x, y];
            ux = dx / d; uy = dy / d;
          } else {
            const rx = x - p.cx, ry = y - p.cy;
            const v = -rx * duy + ry * dux;
            if (Math.abs(v) > R) return [x, y];
            d = rx * dux + ry * duy;
            if (Math.abs(d) > R) return [x, y];
            ux = dux; uy = duy;
          }
          /* reunahaivytys */
          const dd = Math.abs(d);
          const t = dd / R;
          let f = 1;
          if (p.edge > 0 && t > 1 - p.edge) {
            const e = (1 - t) / p.edge;
            f = e * e * (3 - 2 * e);
          }
          const sign = d >= 0 ? 1 : -1;
          const zone = Math.floor(dd / p.zoneW);
          const u = (dd - zone * p.zoneW) / p.zoneW;
          const nd = (zone + remapU(u, f)) * p.zoneW * sign;
          return [x + ux * (nd - d), y + uy * (nd - d)];
        }),
      }));
      return { paths };
    },
  
};
