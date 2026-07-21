import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "superformula",
    name: "Superformula",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "m", label: "Symmetry m", type: "slider", min: 0, max: 24, step: 1, def: 6 },
      { key: "n1", label: "n1", type: "slider", min: 0.1, max: 40, step: 0.1, def: 3 },
      { key: "n2", label: "n2", type: "slider", min: 0.1, max: 40, step: 0.1, def: 6 },
      { key: "n3", label: "n3", type: "slider", min: 0.1, max: 40, step: 0.1, def: 6 },
      { key: "asym", label: "a/b asymmetry", type: "slider", min: 0.2, max: 5, step: 0.05, def: 1 },
      { key: "rings", label: "Rings", type: "slider", min: 1, max: 24, step: 1, def: 1 },
      { key: "twist", label: "Twist deg / ring", type: "slider", min: 0, max: 45, step: 0.5, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m2 = Math.max(0, p.margin);
      const Rmax = Math.min(W, H) / 2 - m2;
      if (Rmax < 5) return applyStyle({ paths: [] }, ins[0]);
      const cx = W / 2, cy = H / 2;
      const mm = Math.max(0, Math.round(p.m));
      const n1 = Math.max(0.05, p.n1), n2 = Math.max(0.05, p.n2), n3 = Math.max(0.05, p.n3);
      const a = 1, b = Math.max(0.05, p.asym);
      const NPTS = 720;
      /* Gielis superformula, guarded against zero base */
      const rBase = new Float64Array(NPTS);
      let rMax = 0;
      for (let i = 0; i < NPTS; i++) {
        const th = (i / NPTS) * Math.PI * 2;
        const t1 = Math.pow(Math.abs(Math.cos((mm * th) / 4) / a), n2);
        const t2 = Math.pow(Math.abs(Math.sin((mm * th) / 4) / b), n3);
        const base = Math.max(1e-9, t1 + t2);
        const r = Math.pow(base, -1 / n1);
        rBase[i] = Number.isFinite(r) ? r : 0;
        if (rBase[i] > rMax) rMax = rBase[i];
      }
      if (rMax < 1e-9) return applyStyle({ paths: [] }, ins[0]);
      const K = Math.max(1, Math.min(32, Math.round(p.rings)));
      const paths = [];
      for (let k = 0; k < K; k++) {
        const scale = (K - k) / K;
        const off = (p.twist * Math.PI / 180) * k;
        const pts = [];
        for (let i = 0; i < NPTS; i++) {
          const th = (i / NPTS) * Math.PI * 2;
          const rr = (rBase[i] / rMax) * Rmax * scale;
          pts.push([cx + Math.cos(th + off) * rr, cy + Math.sin(th + off) * rr]);
        }
        paths.push({ pts, closed: true, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
