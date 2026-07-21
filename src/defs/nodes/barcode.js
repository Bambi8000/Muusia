import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "barcode",
    name: "Barcode", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "orient", label: "Orientation", type: "select", options: ["Vertical bars", "Horizontal bars"], def: "Vertical bars" },
      { key: "barMin", label: "Bar min mm", type: "slider", min: 0.3, max: 20, step: 0.1, def: 0.8 },
      { key: "barMax", label: "Bar max mm", type: "slider", min: 0.5, max: 40, step: 0.1, def: 8 },
      { key: "gapMin", label: "Gap min mm", type: "slider", min: 0.3, max: 20, step: 0.1, def: 1 },
      { key: "gapMax", label: "Gap max mm", type: "slider", min: 0.5, max: 40, step: 0.1, def: 6 },
      { key: "fill", label: "Fill spacing mm", type: "slider", min: 0.2, max: 5, step: 0.05, def: 0.6 },
      { key: "hJit", label: "Height jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 719 + 29);
      const vert = p.orient === "Vertical bars";
      const along0 = p.margin, along1 = vert ? H - p.margin : W - p.margin; /* viivan suunta */
      const across0 = p.margin, across1 = vert ? W - p.margin : H - p.margin; /* palkkien etenemissuunta */
      const bMin = Math.min(p.barMin, p.barMax), bMax = Math.max(p.barMin, p.barMax);
      const gMin = Math.min(p.gapMin, p.gapMax), gMax = Math.max(p.gapMin, p.gapMax);
      const L = Math.round(p.layer);
      const paths = [];
      let x = across0;
      let flip = false; /* boustrophedon: joka toinen viiva vastakkaiseen suuntaan */
      let guard = 0;
      while (x < across1 - bMin && guard++ < 4000) {
        const w = Math.min(bMin + rng() * (bMax - bMin), across1 - x);
        /* korkeusjitter per palkki */
        const a0 = along0 + rng() * p.hJit * (along1 - along0) * 0.35;
        const a1 = along1 - rng() * p.hJit * (along1 - along0) * 0.35;
        const n = Math.max(1, Math.round(w / Math.max(0.2, p.fill)));
        const sp = n > 0 ? w / n : w;
        for (let k = 0; k <= n; k++) {
          const c = x + k * sp;
          const A = flip ? a1 : a0, B = flip ? a0 : a1;
          paths.push({
            pts: vert ? [[c, A], [c, B]] : [[A, c], [B, c]],
            closed: false, layer: L,
          });
          flip = !flip;
        }
        x += w + gMin + rng() * (gMax - gMin);
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
