import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "lathe",
    name: "Lathe", cat: "gen", group: "structural", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "sheds", label: "Sheds (skirts)", type: "slider", min: 1, max: 20, step: 1, def: 6 },
      { key: "depth", label: "Shed depth mm", type: "slider", min: 0, max: 50, step: 0.5, def: 16 },
      { key: "shape", label: "Shed shape", type: "select", options: ["Skirt (insulator)", "Round wave", "Sharp zigzag"], def: "Skirt (insulator)" },
      { key: "coreR", label: "Core radius mm", type: "slider", min: 2, max: 60, step: 0.5, def: 13 },
      { key: "height", label: "Height mm", type: "slider", min: 20, max: 300, step: 1, def: 150 },
      { key: "rings", label: "Rings", type: "slider", min: 10, max: 300, step: 2, def: 110 },
      { key: "tilt", label: "View tilt", type: "slider", min: 0.05, max: 1, step: 0.05, def: 0.32 },
      { key: "mode", label: "Render", type: "select", options: ["Rings", "Profile", "Both"], def: "Rings" },
      { key: "px", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const L = Math.round(p.layer);
      const paths = [];
      /* pyorahdysprofiili r(t), t = 0 ylhaalla .. 1 alhaalla */
      const rAt = (t) => {
        const u = (t * p.sheds) % 1;
        let bump;
        if (p.shape === "Skirt (insulator)") bump = Math.pow(u, 0.65);          /* kasvaa, pudotus poimun lopussa */
        else if (p.shape === "Sharp zigzag") bump = 1 - Math.abs(u * 2 - 1);
        else bump = 0.5 + 0.5 * Math.sin((t * p.sheds) * Math.PI * 2 - Math.PI / 2);
        /* paat kapenevat hieman (kaula & kanta) */
        const env = Math.min(1, Math.min(t, 1 - t) * 8 + 0.35);
        return (p.coreR + p.depth * bump) * env + p.coreR * (1 - env) * 0.6;
      };
      const y0 = p.py - p.height / 2;
      if (p.mode !== "Profile") {
        const nR = Math.round(p.rings);
        for (let i = 0; i <= nR; i++) {
          const t = i / nR;
          const r = rAt(t);
          const cy = y0 + t * p.height;
          const pts = [];
          for (let k = 0; k < 48; k++) {
            const a = (k / 48) * Math.PI * 2;
            pts.push([p.px + Math.cos(a) * r, cy + Math.sin(a) * r * p.tilt]);
          }
          paths.push({ pts, closed: true, layer: L });
        }
      }
      if (p.mode !== "Rings") {
        const nP = 400;
        const left = [], right = [];
        for (let i = 0; i <= nP; i++) {
          const t = i / nP;
          const r = rAt(t);
          const cy = y0 + t * p.height;
          left.push([p.px - r, cy]);
          right.push([p.px + r, cy]);
        }
        paths.push({ pts: left, closed: false, layer: L });
        paths.push({ pts: right, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
