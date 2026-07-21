import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "mask",
    name: "Mask", cat: "duo", ins: [Pin("paths", "Target"), Pin("paths", "Mask")], outs: [Pin("paths")],
    params: [{ key: "keep", label: "Keep", type: "select", options: ["Outside", "Inside"], def: "Outside" }],
    compute(ins, p) {
      const src = ins[0] || EMPTY, msk = ins[1] || EMPTY;
      if (!msk.paths.length) return src;
      const wantInside = p.keep === "Inside";
      const paths = [];
      for (const path of src.paths) {
        const pts = resample(path.pts, path.closed, 1.5);
        let run = [];
        for (const pt of pts) {
          const keep = pointInMask(msk, pt[0], pt[1]) === wantInside;
          if (keep) run.push(pt);
          else if (run.length > 1) { paths.push({ pts: run, closed: false, layer: path.layer }); run = []; }
          else run = [];
        }
        if (run.length > 1) paths.push({ pts: run, closed: false, layer: path.layer });
      }
      return { paths };
    },
  
};
