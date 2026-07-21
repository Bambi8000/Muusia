import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "fabric",
    name: "Fabric", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Drape", type: "select", options: ["Curtain (folds)", "Flag (wave)", "Silk (flow)"], def: "Curtain (folds)" },
      { key: "warp", label: "Warp lines (vert)", type: "slider", min: 0, max: 80, step: 1, def: 34 },
      { key: "weft", label: "Weft lines (horiz)", type: "slider", min: 0, max: 80, step: 1, def: 18 },
      { key: "folds", label: "Folds", type: "slider", min: 1, max: 16, step: 0.5, def: 5 },
      { key: "depth", label: "Fold depth mm", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "sag", label: "Sag mm", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
      { key: "noiseAmt", label: "Rumple mm", type: "slider", min: 0, max: 25, step: 0.25, def: 4 },
      { key: "nscale", label: "Rumple scale", type: "slider", min: 0.5, max: 6, step: 0.1, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 67 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const w = W - 2 * m, h = H - 2 * m;
      if (w < 10 || h < 10) return EMPTY;
      const L = Math.round(p.layer);
      /* yhtenainen siirtymakentta molemmille lankasuunnille -> kudos pysyy koherenttina */
      const disp = (u, t) => {
        const nA = noise2(u * p.nscale * 3, t * p.nscale * 3, p.seed) - 0.5;
        const nB = noise2(u * p.nscale * 3 + 31, t * p.nscale * 3 + 17, p.seed + 5) - 0.5;
        let dx = 0, dy = 0;
        if (p.mode === "Curtain (folds)") {
          const ph = 3 * (noise2(u * 1.6, 0.3, p.seed + 9) - 0.5);
          dx = p.depth * (0.2 + 0.8 * t) * Math.sin(Math.PI * 2 * p.folds * u + ph);
          dy = p.sag * Math.sin(Math.PI * u) * t;
        } else if (p.mode === "Flag (wave)") {
          dx = p.depth * 0.4 * Math.sin(Math.PI * 2 * (p.folds * 0.5 * t + u * 0.6));
          dy = p.sag * u * Math.sin(Math.PI * 2 * (p.folds * u - t * 0.8));
        } else {
          dx = p.depth * 2 * nA;
          dy = p.sag * 2 * nB;
        }
        dx += p.noiseAmt * 2 * nA;
        dy += p.noiseAmt * 2 * nB;
        return [dx, dy];
      };
      const paths = [];
      const nS = 90;
      for (let i = 0; i <= Math.round(p.warp); i++) {
        if (p.warp === 0) break;
        const u = i / Math.round(p.warp);
        const pts = [];
        for (let k = 0; k <= nS; k++) {
          const t = k / nS;
          const [dx, dy] = disp(u, t);
          pts.push([m + u * w + dx, m + t * h + dy]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      for (let j = 0; j <= Math.round(p.weft); j++) {
        if (p.weft === 0) break;
        const t = j / Math.round(p.weft);
        const pts = [];
        for (let k = 0; k <= nS; k++) {
          const u = k / nS;
          const [dx, dy] = disp(u, t);
          pts.push([m + u * w + dx, m + t * h + dy]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
