import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "aaltoilu",
    name: "Wave", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amp", label: "Amplitude mm", type: "slider", min: 0, max: 20, step: 0.25, def: 3 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 2, max: 120, step: 1, def: 30 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.05, def: 0 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.8, p.wl / 14));
        let d = 0;
        const out = pts.map((pt, i) => {
          if (i > 0) d += Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]);
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          const off = Math.sin((d / Math.max(0.5, p.wl)) * Math.PI * 2 + p.phase) * p.amp;
          return [pt[0] + (-ty / tl) * off, pt[1] + (tx / tl) * off];
        });
        return { ...path, pts: out };
      });
      return { paths };
    },
  
};
