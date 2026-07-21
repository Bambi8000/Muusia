import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "fur",
    name: "Fur", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 3 },
      { key: "length", label: "Length mm", type: "slider", min: 0.5, max: 30, step: 0.25, def: 5 },
      { key: "lenJit", label: "Length jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "angJit", label: "Angle jitter °", type: "slider", min: 0, max: 80, step: 1, def: 25 },
      { key: "side", label: "Side", type: "select", options: ["Both (alternate)", "Both (random)", "Left", "Right"], def: "Left" },
      { key: "host", label: "Include host path", type: "check", def: true },
      { key: "seed", label: "Seed", type: "seed", def: 43 },
      { key: "layer", label: "Hair pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      src.paths.forEach((path, pi) => {
        if (p.host) paths.push(path);
        const rng = mulberry32(p.seed * 883 + pi * 127 + 5);
        const pts = resample(path.pts, path.closed, Math.max(0.4, p.spacing));
        let alt = false;
        pts.forEach((pt, i) => {
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          let s;
          if (p.side === "Left") s = 1;
          else if (p.side === "Right") s = -1;
          else if (p.side === "Both (alternate)") { s = alt ? 1 : -1; alt = !alt; }
          else s = rng() > 0.5 ? 1 : -1;
          const baseA = Math.atan2(tx, -ty) + (s < 0 ? Math.PI : 0); /* normaalin suunta */
          const a = baseA + ((rng() - 0.5) * 2 * p.angJit * Math.PI) / 180;
          const len = Math.max(0.2, p.length * (1 - p.lenJit * rng()));
          paths.push({
            pts: [[pt[0], pt[1]], [pt[0] + Math.cos(a) * len, pt[1] + Math.sin(a) * len]],
            closed: false,
            layer: p.keepCol ? path.layer : Math.round(p.layer),
          });
        });
      });
      return { paths };
    },
  
};
