import { Pin, EMPTY, resample } from "../helpers.js";

function pointInMask(mask, x, y) {
  let inside = false;
  for (const path of mask.paths || []) {
    if (!path.closed || path.pts?.length < 3) continue;
    const pts = path.pts;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) {
        inside = !inside;
      }
    }
  }
  return inside;
}

export default {
  key: "mask",
    name: "Mask", cat: "duo", hidden: true,
    desc: "DEPRECATED since 2.40 — hidden from the palette; old patches keep working unchanged. Use Container instead: it clips by wired closed shapes too, and adds parametric Rectangle/Circle/Triangle regions with rotation, a grow/shrink Gap and bisection-accurate cuts.",
    ins: [Pin("paths", "Target"), Pin("paths", "Mask")], outs: [Pin("paths")],
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
