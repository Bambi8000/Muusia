import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "polkadots",
    name: "Polka Dots",
    cat: "gen",
    group: "geometric",
    desc: "Plain dots or circles on a grid: Square rows, Hex (net-like offset rows), or Random with even spacing. Dot size 0 plots a bare pen touch; larger sizes draw circles. Size variation makes the field breathe.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "layout", label: "Layout", type: "select", options: ["Square", "Hex", "Random"], def: "Hex" },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 3, max: 40, step: 0.5, def: 10 },
      { key: "size", label: "Dot size mm", type: "slider", min: 0, max: 20, step: 0.25, def: 3 },
      { key: "vary", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 1 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 5 || y1 - y0 < 5) return applyStyle({ paths: [] }, ins[0]);
      const sp = Math.max(1.5, p.spacing);
      const rng = mulberry32(p.seed * 613 + 11);
      const pts = [];
      if (p.layout === "Square") {
        for (let y = y0 + sp / 2; y <= y1 - sp / 4; y += sp) {
          for (let x = x0 + sp / 2; x <= x1 - sp / 4; x += sp) pts.push([x, y]);
        }
      } else if (p.layout === "Hex") {
        const rh = sp * Math.sqrt(3) / 2;
        let row = 0;
        for (let y = y0 + sp / 2; y <= y1 - sp / 4; y += rh, row++) {
          const off = (row % 2) * (sp / 2);
          for (let x = x0 + sp / 2 + off; x <= x1 - sp / 4; x += sp) pts.push([x, y]);
        }
      } else {
        /* random with even-ish spacing: dart throwing with min distance */
        const target = Math.round(((x1 - x0) * (y1 - y0)) / (sp * sp));
        const minD = sp * 0.62;
        let guard = target * 40;
        while (pts.length < target && guard-- > 0) {
          const x = x0 + sp * 0.3 + rng() * (x1 - x0 - sp * 0.6);
          const y = y0 + sp * 0.3 + rng() * (y1 - y0 - sp * 0.6);
          let ok = true;
          for (const q of pts) {
            if (Math.abs(x - q[0]) < minD && Math.abs(y - q[1]) < minD && Math.hypot(x - q[0], y - q[1]) < minD) { ok = false; break; }
          }
          if (ok) pts.push([x, y]);
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      const BUDGET = 120000;
      let total = 0;
      for (const [x, y] of pts) {
        const r = Math.max(0, p.size / 2) * (p.vary > 0 ? 1 + (rng() - 0.5) * 2 * p.vary * 0.9 : 1);
        if (r < 0.3) {
          /* bare pen touch: a minimal down-up dab */
          if (total + 2 > BUDGET) break;
          total += 2;
          paths.push({ pts: [[x, y], [x + 0.1, y]], closed: false, layer: L });
        } else {
          const n = Math.max(8, Math.min(48, Math.round(r * 4)));
          if (total + n > BUDGET) break;
          total += n;
          const c = [];
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            c.push([
              Math.max(0.5, Math.min(W - 0.5, x + Math.cos(a) * r)),
              Math.max(0.5, Math.min(H - 0.5, y + Math.sin(a) * r))
            ]);
          }
          paths.push({ pts: c, closed: true, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
