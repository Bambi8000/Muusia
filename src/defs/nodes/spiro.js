import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "spiro",
    name: "Spirograph", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "R", label: "Ring R", type: "slider", min: 10, max: 100, step: 1, def: 60 },
      { key: "r", label: "Gear r", type: "slider", min: 2, max: 90, step: 1, def: 21 },
      { key: "d", label: "Pen offset d", type: "slider", min: 0, max: 90, step: 0.5, def: 30 },
      { key: "kind", label: "Kind", type: "select", options: ["Hypotrochoid", "Epitrochoid"], def: "Hypotrochoid" },
      { key: "turns", label: "Turns", type: "slider", min: 1, max: 120, step: 1, def: 40 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 4 },
    ],
    compute(ins, p, ctx) {
      const N = Math.min(14000, Math.round(p.turns * 160));
      const raw = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns * Math.PI * 2;
        let x, y;
        if (p.kind === "Hypotrochoid") {
          const k = (p.R - p.r) / p.r;
          x = (p.R - p.r) * Math.cos(t) + p.d * Math.cos(k * t);
          y = (p.R - p.r) * Math.sin(t) - p.d * Math.sin(k * t);
        } else {
          const k = (p.R + p.r) / p.r;
          x = (p.R + p.r) * Math.cos(t) - p.d * Math.cos(k * t);
          y = (p.R + p.r) * Math.sin(t) - p.d * Math.sin(k * t);
        }
        raw.push([x, y]);
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  
};
