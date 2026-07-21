import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "stretch",
    name: "Stretch", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Point (perspective)", "Directional"], def: "Directional" },
      { key: "cx", label: "Band center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Band center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "zw", label: "Band length mm (along)", type: "slider", min: 5, max: 300, step: 1, def: 40 },
      { key: "zh", label: "Band height mm (across)", type: "slider", min: 10, max: 400, step: 1, def: 120 },
      { key: "vpx", label: "Vanish point X mm", type: "slider", min: -300, max: 600, step: 1, def: 20 },
      { key: "vpy", label: "Vanish point Y mm", type: "slider", min: -300, max: 600, step: 1, def: 100 },
      { key: "angle", label: "Angle ° (directional)", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "amount", label: "Stretch mm (− compress)", type: "slider", min: -250, max: 250, step: 1, def: 90 },
      { key: "falloff", label: "Edge falloff", type: "select", options: ["Smooth", "Linear", "Spike"], def: "Smooth" },
      { key: "jit", label: "Per-path jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 47 },
    ],
    overlay(p) {
      let ux, uy;
      if (p.mode === "Directional") {
        const a = (p.angle * Math.PI) / 180;
        ux = Math.cos(a); uy = Math.sin(a);
      } else {
        const dx = p.cx - p.vpx, dy = p.cy - p.vpy;
        const d = Math.hypot(dx, dy) || 1;
        ux = dx / d; uy = dy / d;
      }
      const px = -uy, py = ux;
      const hw = p.zw / 2, hh = p.zh / 2;
      const g = [{
        kind: "poly",
        pts: [
          [p.cx - ux * hw - px * hh, p.cy - uy * hw - py * hh],
          [p.cx + ux * hw - px * hh, p.cy + uy * hw - py * hh],
          [p.cx + ux * hw + px * hh, p.cy + uy * hw + py * hh],
          [p.cx - ux * hw + px * hh, p.cy - uy * hw + py * hh],
        ],
      }];
      if (p.mode !== "Directional") g.push({ kind: "point", x: p.vpx, y: p.vpy });
      const L = Math.max(20, Math.min(Math.abs(p.amount), 80)) * Math.sign(p.amount || 1);
      g.push({ kind: "arrow", x1: p.cx, y1: p.cy, x2: p.cx + ux * L, y2: p.cy + uy * L });
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* monotoninen kaista-remap: kaistan sisalla u venyy lineaarisesti,
         kaistan jalkeen kaikki siirtyy amountin verran -> ei laskoksia, viivat suoriksi */
      const shape = (t) => {
        if (t <= 0) return 0;
        t = Math.min(1, t);
        if (p.falloff === "Linear") return t;
        if (p.falloff === "Spike") return Math.pow(t, 2.5);
        return t * t * (3 - 2 * t);
      };
      const half = p.zw / 2;
      const dirAngle = (p.angle * Math.PI) / 180;
      const dux = Math.cos(dirAngle), duy = Math.sin(dirAngle);
      const cdx = p.cx - p.vpx, cdy = p.cy - p.vpy;
      const rc = Math.hypot(cdx, cdy) || 1;
      const angC = Math.atan2(cdy, cdx);
      const angHalf = Math.atan(Math.max(0.01, (p.zh / 2) / rc));
      const paths = src.paths.map((path, pi) => {
        const rng = mulberry32(p.seed * 733 + pi * 271 + 9);
        const amt0 = p.amount * (1 - p.jit * rng());
        return {
          ...path,
          pts: resample(path.pts, path.closed, 0.8).map(([x, y]) => {
            let ux, uy, u, vF;
            if (p.mode === "Directional") {
              ux = dux; uy = duy;
              const rx = x - p.cx, ry = y - p.cy;
              u = rx * ux + ry * uy;
              const v = -rx * uy + ry * ux;
              vF = shape(1 - Math.abs(v) / (p.zh / 2));
            } else {
              const dx = x - p.vpx, dy = y - p.vpy;
              const r = Math.hypot(dx, dy) || 1;
              ux = dx / r; uy = dy / r;
              u = r - rc;
              let dA = Math.atan2(dy, dx) - angC;
              while (dA > Math.PI) dA -= Math.PI * 2;
              while (dA < -Math.PI) dA += Math.PI * 2;
              vF = shape(1 - Math.abs(dA) / angHalf);
            }
            if (vF <= 0) return [x, y];
            const amt = Math.max(-(p.zw * 0.95), amt0 * vF);
            let du;
            if (u <= -half) du = 0;
            else if (u >= half) du = amt;
            else du = ((u + half) / p.zw) * amt;
            return [x + ux * du, y + uy * du];
          }),
        };
      });
      return { paths };
    },
  
};
