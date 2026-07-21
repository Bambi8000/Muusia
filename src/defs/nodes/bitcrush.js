import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "bitcrush",
    name: "Bitcrush",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "rate", label: "Sample rate mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 4 },
      { key: "depth", label: "Bit depth grid mm (0=off)", type: "slider", min: 0, max: 12, step: 0.25, def: 2 },
      { key: "axis", label: "Quantize axis", type: "select", options: ["Both", "X only", "Y only"], def: "Both" }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const rate = Math.max(0.3, p.rate);
      const q = Math.max(0, p.depth);
      const qx = p.axis !== "Y only", qy = p.axis !== "X only";
      const snap = (v) => q > 0.01 ? Math.round(v / q) * q : v;
      const paths = [];
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, rate).map(([x, y]) => [
          qx ? snap(x) : x, qy ? snap(y) : y
        ]);
        /* quantizing can stack identical points: dedupe (no zero-length marks) */
        const clean = [];
        for (const pt of pts) {
          const last = clean[clean.length - 1];
          if (!last || Math.abs(last[0] - pt[0]) > 1e-6 || Math.abs(last[1] - pt[1]) > 1e-6) clean.push(pt);
        }
        if (path.closed && clean.length > 2) {
          const a = clean[0], b = clean[clean.length - 1];
          if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) clean.pop();
        }
        if (clean.length > 1) paths.push({ pts: clean, closed: path.closed && clean.length > 2, layer: path.layer });
      });
      return { paths };
    }
  
};
