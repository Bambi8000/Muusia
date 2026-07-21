import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "explosion",
      name: "Explosion",
    cat: "mod", group: "cutsplit",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "zone", label: "Zone", type: "select", options: ["Circle", "Rectangle"], def: "Circle" },
      { key: "cx", label: "Center X mm", type: "slider", min: -100, max: 500, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: -100, max: 500, step: 1, def: 100 },
      { key: "zw", label: "Zone Ø / width mm", type: "slider", min: 10, max: 500, step: 1, def: 240 },
      { key: "zh", label: "Zone height mm", type: "slider", min: 10, max: 500, step: 1, def: 150 },
      { key: "axis", label: "Axis (rectangle)", type: "select", options: ["Horizontal", "Vertical"], def: "Horizontal" },
      { key: "strength", label: "Strength mm", type: "slider", min: 0, max: 300, step: 1, def: 60 },
      { key: "dir", label: "Direction", type: "select", options: ["Outward", "Inward", "Directional"], def: "Outward" },
      { key: "angle", label: "Angle ° (directional)", type: "slider", min: -180, max: 180, step: 1, def: -90 },
      { key: "falloff", label: "Falloff", type: "select", options: ["Uniform", "Near stronger", "Far stronger"], def: "Near stronger" },
      { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "spread", label: "Spread °", type: "slider", min: 0, max: 90, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 103 },
    ],
    overlay(p) {
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.zone === "Circle") {
        g.push({ kind: "circle", cx: p.cx, cy: p.cy, r: p.zw / 2 });
      } else {
        g.push({ kind: "rect", x: p.cx - p.zw / 2, y: p.cy - p.zh / 2, w: p.zw, h: p.zh });
      }
      const L = Math.max(15, Math.min(p.strength, 70));
      if (p.dir === "Directional") {
        const a = (p.angle * Math.PI) / 180;
        g.push({ kind: "arrow", x1: p.cx, y1: p.cy, x2: p.cx + Math.cos(a) * L, y2: p.cy + Math.sin(a) * L });
      } else if (p.zone === "Rectangle") {
        /* suuntanuolet akselia pitkin molempiin suuntiin */
        const s = p.dir === "Inward" ? -1 : 1;
        if (p.axis === "Horizontal") {
          g.push({ kind: "arrow", x1: p.cx + 6 * s, y1: p.cy, x2: p.cx + (6 + L) * s, y2: p.cy });
          g.push({ kind: "arrow", x1: p.cx - 6 * s, y1: p.cy, x2: p.cx - (6 + L) * s, y2: p.cy });
        } else {
          g.push({ kind: "arrow", x1: p.cx, y1: p.cy + 6 * s, x2: p.cx, y2: p.cy + (6 + L) * s });
          g.push({ kind: "arrow", x1: p.cx, y1: p.cy - 6 * s, x2: p.cx, y2: p.cy - (6 + L) * s });
        }
      }
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* jaykka siirto per polku: muoto sailyy, vain sijainti muuttuu.
         Vaikutusalue rajaa: alueen ulkopuoliset kappaleet eivat liiku. */
      const paths = src.paths.map((path, pi) => {
        const rng = mulberry32(p.seed * 419 + pi * 233 + 13);
        let sx = 0, sy = 0;
        for (const [x, y] of path.pts) { sx += x; sy += y; }
        const cx0 = sx / path.pts.length, cy0 = sy / path.pts.length;
        const dx = cx0 - p.cx, dy = cy0 - p.cy;
        let inZone, d, baseDir;
        if (p.zone === "Circle") {
          d = Math.hypot(dx, dy) || 0.001;
          inZone = d <= p.zw / 2;
          baseDir = Math.atan2(dy, dx);
        } else {
          inZone = Math.abs(dx) <= p.zw / 2 && Math.abs(dy) <= p.zh / 2;
          if (p.axis === "Horizontal") {
            d = Math.abs(dx) || 0.001;
            baseDir = dx >= 0 ? 0 : Math.PI;
          } else {
            d = Math.abs(dy) || 0.001;
            baseDir = dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        if (!inZone) return path;
        let f;
        if (p.falloff === "Uniform") f = 1;
        else if (p.falloff === "Near stronger") f = 80 / (30 + d);
        else f = d / 90;
        let amt = p.strength * f * (1 - p.jitter * rng());
        if (p.dir === "Inward") amt = -Math.min(amt, d * 0.95); /* ei ylity keskilinjan yli */
        /* suuntahajonta */
        const dev = ((rng() - 0.5) * 2 * p.spread * Math.PI) / 180;
        const A = (p.dir === "Directional" ? (p.angle * Math.PI) / 180 : baseDir) + dev;
        const mx = Math.cos(A) * amt;
        const my = Math.sin(A) * amt;
        return {
          ...path,
          pts: path.pts.map(([x, y]) => [x + mx, y + my]),
        };
      });
      return { paths };
    }
  
};
