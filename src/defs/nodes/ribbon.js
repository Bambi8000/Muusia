import { Pin, noise2, applyStyle } from "../helpers.js";

export default {
  key: "ribbon",
    name: "Ribbon", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "wander", label: "Wander mm", type: "slider", min: 0, max: 120, step: 1, def: 45 },
      { key: "wscale", label: "Wander scale", type: "slider", min: 0.2, max: 4, step: 0.1, def: 1 },
      { key: "width", label: "Width mm", type: "slider", min: 2, max: 80, step: 0.5, def: 28 },
      { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8 },
      { key: "lines", label: "Lines", type: "slider", min: 1, max: 60, step: 1, def: 24 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 27 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      /* selkäranka: vasemmalta oikealle, pystysuuntainen kohinavaellus */
      const N = 160;
      const bb = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = p.margin + (W - 2 * p.margin) * t;
        const y = H / 2 + (noise2(t * 4 * p.wscale, 3.3, p.seed) - 0.5) * 2 * p.wander;
        bb.push([x, Math.max(p.margin, Math.min(H - p.margin, y))]);
      }
      /* leveys(t): kohina, pinch lähelle nollaa */
      const widthAt = (t) => {
        const v = noise2(t * 5 * p.wscale + 40, 8.8, p.seed + 9);
        const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
        return Math.max(0.3, w);
      };
      const normals = bb.map((pt, i) => {
        const nI = Math.min(i + 1, bb.length - 1), pI = Math.max(i - 1, 0);
        const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        return [-ty / tl, tx / tl];
      });
      const K = Math.round(p.lines);
      const paths = [];
      for (let k = 0; k < K; k++) {
        const f = K === 1 ? 0 : k / (K - 1) - 0.5;
        const pts = bb.map((pt, i) => {
          const w = widthAt(i / N);
          return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
        });
        paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
