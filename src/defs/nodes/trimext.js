import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
  key: "trimext",
    name: "Trim/Extend", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "ends", label: "Ends mm (− trim, + extend)", type: "slider", min: -20, max: 20, step: 0.25, def: 2 }],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      for (const path of src.paths) {
        if (path.closed || path.pts.length < 2 || p.ends === 0) { paths.push(path); continue; }
        if (p.ends > 0) {
          const pts = path.pts.map((q) => q.slice());
          const s0 = pts[0], s1 = pts[1];
          const e1 = pts[pts.length - 2], e0 = pts[pts.length - 1];
          const dl = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1;
          const el = Math.hypot(e0[0] - e1[0], e0[1] - e1[1]) || 1;
          pts.unshift([s0[0] - ((s1[0] - s0[0]) / dl) * p.ends, s0[1] - ((s1[1] - s0[1]) / dl) * p.ends]);
          pts.push([e0[0] + ((e0[0] - e1[0]) / el) * p.ends, e0[1] + ((e0[1] - e1[1]) / el) * p.ends]);
          paths.push({ ...path, pts });
        } else {
          const trim = -p.ends;
          const fine = resample(path.pts, false, 0.5);
          const L = pathLength(fine, false);
          if (L <= trim * 2 + 0.5) continue;
          const start = Math.ceil(trim / 0.5), end = fine.length - Math.ceil(trim / 0.5);
          const pts = fine.slice(start, Math.max(start + 2, end));
          if (pts.length > 1) paths.push({ ...path, pts });
        }
      }
      return { paths };
    },
  
};
