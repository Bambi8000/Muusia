import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "phyllo",
    name: "Phyllotaxis", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Count", type: "slider", min: 10, max: 1500, step: 10, def: 400 },
      { key: "c", label: "Spacing c", type: "slider", min: 0.5, max: 8, step: 0.1, def: 2.5 },
      { key: "angle", label: "Angle °", type: "slider", min: 100, max: 180, step: 0.1, def: 137.5 },
      { key: "mode", label: "Mode", type: "select", options: ["Dots", "Spiral"], def: "Dots" },
      { key: "dotR", label: "Dot size mm", type: "slider", min: 0.2, max: 6, step: 0.1, def: 1 },
      { key: "layer", label: "Pen", type: "pen", def: 2 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) / 2 - 8;
      const golden = (p.angle * Math.PI) / 180;
      const paths = [];
      const centers = [];
      for (let i = 0; i < p.count; i++) {
        const r = p.c * Math.sqrt(i);
        if (r > maxR) break;
        const a = i * golden;
        centers.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      if (p.mode === "Spiral") {
        if (centers.length > 1) paths.push({ pts: centers, closed: false, layer: Math.round(p.layer) });
      } else {
        for (const [x, y] of centers) {
          const pts = [];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            pts.push([x + Math.cos(a) * (p.dotR / 2), y + Math.sin(a) * (p.dotR / 2)]);
          }
          paths.push({ pts, closed: true, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
