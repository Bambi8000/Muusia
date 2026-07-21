import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "fold",
    name: "Fold",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "gain", label: "Gain (drive)", type: "slider", min: 1, max: 4, step: 0.05, def: 1.5 },
      { key: "wx", label: "Window width mm", type: "slider", min: 20, max: 220, step: 1, def: 120 },
      { key: "wy", label: "Window height mm", type: "slider", min: 20, max: 300, step: 1, def: 160 },
      { key: "axis", label: "Fold axis", type: "select", options: ["Both", "X only", "Y only"], def: "Both" },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const hx = Math.max(5, p.wx / 2), hy = Math.max(5, p.wy / 2);
      const gain = Math.max(0.1, p.gain);
      /* wavefolder: reflect back into the window, repeatedly (triangle fold) */
      const fold1 = (v, half) => {
        const period = 4 * half;
        let u = ((v + half) % period + period) % period;
        return (u < 2 * half ? u - half : 3 * half - u);
      };
      const doX = p.axis !== "Y only", doY = p.axis !== "X only";
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.25, p.res)).map(([x, y]) => {
          /* drive: scale outward from center before folding, like input gain */
          let lx = (x - cx) * gain, ly = (y - cy) * gain;
          if (doX) lx = fold1(lx, hx);
          if (doY) ly = fold1(ly, hy);
          return [cx + lx, cy + ly];
        })
      }));
      return { paths };
    }
  
};
