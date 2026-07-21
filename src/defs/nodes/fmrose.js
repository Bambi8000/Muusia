import { Pin, PENS, applyStyle } from "../helpers.js";

export default {
  key: "fmrose",
  name: "FM Rose",
  cat: "gen",
  group: "geometric",
  desc: "FM synthesis as a polar curve: a modulator warps the carrier that shapes the radius. Low index gives rosettes, high index chaotic flowers; Rings stacks scaled copies with per-ring rotation, and Ring pens cycles successive rings through that many pens starting from Pen.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "fc", label: "Carrier", type: "slider", min: 1, max: 16, step: 1, def: 5 },
    { key: "fm", label: "Modulator", type: "slider", min: 1, max: 16, step: 1, def: 3 },
    { key: "index", label: "FM index", type: "slider", min: 0, max: 10, step: 0.1, def: 2 },
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 1, step: 0.02, def: 0.5 },
    { key: "rings", label: "Rings", type: "slider", min: 1, max: 16, step: 1, def: 1 },
    { key: "pens", label: "Ring pens (cycle)", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "rot", label: "Rotate deg / ring", type: "slider", min: 0, max: 90, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const R = Math.min(W, H) / 2 - m;
    if (R < 5) return applyStyle({ paths: [] }, ins[0]);
    const cx = W / 2, cy = H / 2;
    const fc = Math.max(1, Math.round(p.fc)), fm = Math.max(1, Math.round(p.fm));
    const depth = Math.max(0, Math.min(1, p.depth));
    const K = Math.max(1, Math.min(24, Math.round(p.rings)));
    const NP = Math.max(1, Math.min(PENS.length, Math.round(p.pens)));
    const paths = [];
    const NPTS = 720;
    for (let k = 0; k < K; k++) {
      const scale = (K - k) / K;
      const off = (p.rot * Math.PI / 180) * k;
      const pts = [];
      for (let i = 0; i < NPTS; i++) {
        const th = (i / NPTS) * Math.PI * 2;
        /* FM synthesis as a polar curve: r follows the modulated carrier */
        const r = (1 + depth * Math.sin(fc * th + p.index * Math.sin(fm * th))) / (1 + depth);
        const rr = R * scale * Math.max(0.02, r);
        pts.push([cx + Math.cos(th + off) * rr, cy + Math.sin(th + off) * rr]);
      }
      paths.push({ pts, closed: true, layer: (Math.round(p.layer) + (k % NP)) % PENS.length });
    }
    return applyStyle({ paths }, ins[0]);
  }
};