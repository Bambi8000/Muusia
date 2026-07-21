import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "hairs",
    name: "Hairs", cat: "gen", group: "organic", ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Hairs", type: "slider", min: 20, max: 4000, step: 10, def: 700 },
      { key: "length", label: "Length mm", type: "slider", min: 1, max: 40, step: 0.5, def: 7 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "curl", label: "Curl", type: "slider", min: 0, max: 3, step: 0.05, def: 0.8 },
      { key: "dirMode", label: "Direction", type: "select", options: ["Flow (noise)", "Fixed angle", "Radial out"], def: "Flow (noise)" },
      { key: "angle", label: "Angle ° (fixed)", type: "slider", min: -180, max: 180, step: 1, def: 90 },
      { key: "fscale", label: "Flow scale", type: "slider", min: 0.002, max: 0.05, step: 0.001, def: 0.01 },
      { key: "droop", label: "Gravity droop", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "margin", label: "Margin mm (no region)", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 71 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      /* alue: suljetut sisaantulopolut (even-odd) tai koko canvas */
      const regions = ins[0] && ins[0].paths ? ins[0].paths.filter((q) => q.closed && q.pts.length > 2) : [];
      const inside = (x, y) => {
        if (!regions.length) {
          return x >= p.margin && x <= W - p.margin && y >= p.margin && y <= H - p.margin;
        }
        let cnt = 0;
        for (const path of regions) {
          const pts = path.pts;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
                (x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0])) cnt++;
          }
        }
        return cnt % 2 === 1;
      };
      /* alueen bbox naytteistysta varten */
      let bx0 = p.margin, by0 = p.margin, bx1 = W - p.margin, by1 = H - p.margin;
      if (regions.length) {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
        for (const path of regions) for (const [x, y] of path.pts) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      }
      const rng = mulberry32(p.seed * 1721 + 29);
      const paths = [];
      let guard = 0;
      const target = Math.round(p.count);
      while (paths.length < target && guard++ < target * 30) {
        const x0 = bx0 + rng() * (bx1 - bx0);
        const y0 = by0 + rng() * (by1 - by0);
        if (!inside(x0, y0)) continue;
        let a;
        if (p.dirMode === "Fixed angle") a = (p.angle * Math.PI) / 180 + (rng() - 0.5) * 0.4;
        else if (p.dirMode === "Radial out") a = Math.atan2(y0 - H / 2, x0 - W / 2) + (rng() - 0.5) * 0.3;
        else a = noise2(x0 * p.fscale, y0 * p.fscale, p.seed + 3) * Math.PI * 4;
        const len = Math.max(0.5, p.length * (1 - p.lenVar * rng()));
        const nSeg = 6;
        const step = len / nSeg;
        const curlDir = rng() > 0.5 ? 1 : -1;
        const pts = [[x0, y0]];
        let x = x0, y = y0, ha = a;
        for (let s = 0; s < nSeg; s++) {
          /* kihara + painovoima: suunta taipuu alaspain matkalla */
          ha += (p.curl * curlDir * 0.25) + (rng() - 0.5) * 0.1;
          const down = Math.PI / 2;
          let dA = down - ha;
          while (dA > Math.PI) dA -= Math.PI * 2;
          while (dA < -Math.PI) dA += Math.PI * 2;
          ha += dA * p.droop * 0.12;
          x += Math.cos(ha) * step;
          y += Math.sin(ha) * step;
          pts.push([x, y]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[1]);
    },
  
};
