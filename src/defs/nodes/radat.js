import { Pin, noise2, applyStyle } from "../helpers.js";

export default {
  key: "radat",
    name: "Tracks", cat: "gen", group: "geometric", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "rings", label: "Loops", type: "slider", min: 1, max: 30, step: 1, def: 10 },
      { key: "gap", label: "Gap mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "wob", label: "Shape noise", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "drift", label: "Drift", type: "slider", min: 0, max: 20, step: 0.5, def: 4 },
      { key: "seed", label: "Seed", type: "seed", def: 7 },
      { key: "layer", label: "Pen", type: "pen", def: 1 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) / 2 - 8;
      const paths = [];
      for (let r = 0; r < p.rings; r++) {
        const base = maxR - r * p.gap;
        if (base < 3) break;
        const ox = (noise2(r * 0.7, 0.3, p.seed) - 0.5) * 2 * p.drift * (r / Math.max(1, p.rings));
        const oy = (noise2(0.3, r * 0.7, p.seed + 9) - 0.5) * 2 * p.drift * (r / Math.max(1, p.rings));
        const N = Math.max(24, Math.floor(base * 1.2));
        const pts = [];
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          const wob = (noise2(Math.cos(a) * 1.3 + r * 0.31, Math.sin(a) * 1.3, p.seed + 40) - 0.5) * 2 * p.wob;
          const rr = base + wob;
          pts.push([cx + ox + Math.cos(a) * rr * (W / Math.min(W, H)) * 0.9, cy + oy + Math.sin(a) * rr]);
        }
        paths.push({ pts, closed: true, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
