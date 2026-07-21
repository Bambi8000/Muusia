import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "aggregate",
    name: "Aggregate",
    cat: "gen",
    group: "structural",
    desc: "WASP-style discrete aggregation: copies of a module snap together at connector points (bounding-box edge midpoints), growing a crystal-like assembly one part at a time with collision checks. Wire your own Module in, or use the built-in part. Wire a value into Iterations to animate the growth.",
    ins: [Pin("paths", "Module (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 1, max: 400, step: 1, def: 60 },
      { key: "scale", label: "Module scale %", type: "slider", min: 20, max: 300, step: 5, def: 100 },
      { key: "rot", label: "Random 90deg rotations", type: "check", def: true },
      { key: "gap", label: "Gap mm", type: "slider", min: -1, max: 6, step: 0.25, def: 0.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen (built-in part)", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[1]);
      /* module: wired paths, or a built-in open U part */
      let mod;
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        mod = ins[0].paths.map((pa) => ({ pts: pa.pts.map((q) => q.slice()), closed: pa.closed, layer: pa.layer }));
      } else {
        const L = Math.round(p.layer);
        mod = [
          { pts: [[-5, 5], [-5, -5], [5, -5], [5, 5]], closed: false, layer: L },
          { pts: [[-2.5, 0], [2.5, 0]], closed: false, layer: L }
        ];
      }
      /* center + measure the module */
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const pa of mod) for (const [x, y] of pa.pts) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const sc = Math.max(0.05, p.scale / 100);
      const mcx = (bx0 + bx1) / 2, mcy = (by0 + by1) / 2;
      const mw = Math.max(1, (bx1 - bx0)) * sc, mh = Math.max(1, (by1 - by0)) * sc;
      const gap = p.gap;
      /* placements: {x, y, rot(0-3), w, h} — 90deg rotations swap w/h */
      const placed = [];
      const rng = mulberry32(p.seed * 5741 + 19);
      const dims = (rot) => (rot % 2 === 0 ? [mw, mh] : [mh, mw]);
      const collides = (x, y, w, h) => {
        const tol = -0.2; /* slight touch allowed */
        if (x - w / 2 < x0 || x + w / 2 > x1 || y - h / 2 < y0 || y + h / 2 > y1) return true;
        for (const pl of placed) {
          const [pw, ph] = dims(pl.rot);
          if (Math.abs(x - pl.x) < (w + pw) / 2 + tol && Math.abs(y - pl.y) < (h + ph) / 2 + tol) return true;
        }
        return false;
      };
      const open = []; /* connectors: {x, y, dir 0=N 1=E 2=S 3=W} on placed parts */
      const addConnectors = (pl) => {
        const [w, h] = dims(pl.rot);
        open.push({ x: pl.x, y: pl.y - h / 2, dir: 0 });
        open.push({ x: pl.x + w / 2, y: pl.y, dir: 1 });
        open.push({ x: pl.x, y: pl.y + h / 2, dir: 2 });
        open.push({ x: pl.x - w / 2, y: pl.y, dir: 3 });
      };
      const first = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rot: 0 };
      placed.push(first);
      addConnectors(first);
      const target = Math.max(1, Math.min(500, Math.round(p.iters)));
      let guard = target * 30;
      while (placed.length < target && open.length && guard-- > 0) {
        const ci = Math.floor(rng() * open.length);
        const c = open[ci];
        const rot = p.rot ? Math.floor(rng() * 4) : 0;
        const [w, h] = dims(rot);
        /* new part sits beyond the connector, opposite side facing it */
        let nx = c.x, ny = c.y;
        if (c.dir === 0) ny -= h / 2 + gap;
        else if (c.dir === 1) nx += w / 2 + gap;
        else if (c.dir === 2) ny += h / 2 + gap;
        else nx -= w / 2 + gap;
        if (collides(nx, ny, w, h)) {
          open.splice(ci, 1);
          continue;
        }
        const pl = { x: nx, y: ny, rot };
        placed.push(pl);
        addConnectors(pl);
        open.splice(ci, 1);
      }
      /* render: module transformed to each placement */
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      for (const pl of placed) {
        const a = (pl.rot * Math.PI) / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (const pa of mod) {
          if (total + pa.pts.length > BUDGET) return applyStyle({ paths }, ins[1]);
          total += pa.pts.length;
          paths.push({
            pts: pa.pts.map(([x, y]) => {
              const lx = (x - mcx) * sc, ly = (y - mcy) * sc;
              return [pl.x + lx * ca - ly * sa, pl.y + lx * sa + ly * ca];
            }),
            closed: pa.closed, layer: pa.layer
          });
        }
      }
      return applyStyle({ paths }, ins[1]);
    }
  
};
