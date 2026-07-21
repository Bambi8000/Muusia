import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "origami",
    name: "Origami", cat: "gen", group: "structural", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "splits", label: "Splits", type: "slider", min: 1, max: 80, step: 1, def: 16 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 23 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 941 + 5);
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      let polys = [[[p.margin, p.margin], [W - p.margin, p.margin], [W - p.margin, H - p.margin], [p.margin, H - p.margin]]];
      for (let s = 0; s < Math.round(p.splits); s++) {
        const idx = Math.floor(rng() * polys.length);
        const poly = polys[idx];
        const n = poly.length;
        if (n < 3) continue;
        const a = Math.floor(rng() * n);
        const b = (a + 1 + Math.floor(rng() * (n - 1))) % n;
        if (a === b) continue;
        const Pa = lerp(poly[a], poly[(a + 1) % n], 0.2 + rng() * 0.6);
        const Pb = lerp(poly[b], poly[(b + 1) % n], 0.2 + rng() * 0.6);
        const polyA = [Pa], polyB = [Pb];
        for (let i = (a + 1) % n; ; i = (i + 1) % n) { polyA.push(poly[i]); if (i === b) break; }
        polyA.push(Pb);
        for (let i = (b + 1) % n; ; i = (i + 1) % n) { polyB.push(poly[i]); if (i === a) break; }
        polyB.push(Pa);
        polys[idx] = polyA;
        polys.push(polyB);
      }
      const paths = polys.map((poly) => ({ pts: poly.map((q) => q.slice()), closed: true, layer: Math.round(p.layer) }));
      return applyStyle({ paths }, ins[0]);
    },
  
};
