import { Pin, EMPTY, PENS } from "../helpers.js";

export default {
  key: "echo",
    name: "Echo",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "copies", label: "Echo copies", type: "slider", min: 1, max: 12, step: 1, def: 4 },
      { key: "dx", label: "Move X mm / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 4 },
      { key: "dy", label: "Move Y mm / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 4 },
      { key: "rot", label: "Rotate deg / copy", type: "slider", min: -90, max: 90, step: 0.5, def: 0 },
      { key: "scale", label: "Scale % / copy", type: "slider", min: 50, max: 150, step: 1, def: 100 },
      { key: "pivot", label: "Pivot", type: "select", options: ["Canvas center", "Path centroid"], def: "Canvas center" },
      { key: "orig", label: "Include original", type: "check", def: true },
      { key: "cycle", label: "Cycle pens", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const K = Math.max(1, Math.min(20, Math.round(p.copies)));
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      src.paths.forEach((path) => {
        if (p.orig) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
        let pcx = W / 2, pcy = H / 2;
        if (p.pivot === "Path centroid") {
          pcx = 0; pcy = 0;
          for (const [x, y] of path.pts) { pcx += x; pcy += y; }
          pcx /= path.pts.length; pcy /= path.pts.length;
        }
        for (let k = 1; k <= K; k++) {
          const ang = (p.rot * Math.PI / 180) * k;
          const sc = Math.pow(p.scale / 100, k);
          if (sc < 0.005) break;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const ox = p.dx * k, oy = p.dy * k;
          const layer = p.cycle ? ((path.layer + k) % PENS.length) : path.layer;
          paths.push({
            pts: path.pts.map(([x, y]) => {
              const lx = (x - pcx) * sc, ly = (y - pcy) * sc;
              return clamp([pcx + lx * ca - ly * sa + ox, pcy + lx * sa + ly * ca + oy]);
            }),
            closed: path.closed, layer
          });
        }
      });
      return { paths };
    }
  
};
