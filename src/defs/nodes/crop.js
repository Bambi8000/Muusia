import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "crop",
      name: "Crop",
    cat: "mod", group: "cutsplit",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "x", label: "X mm", type: "slider", min: -100, max: 400, step: 1, def: 40 },
      { key: "y", label: "Y mm", type: "slider", min: -100, max: 400, step: 1, def: 30 },
      { key: "w", label: "Width mm", type: "slider", min: 5, max: 400, step: 1, def: 220 },
      { key: "h", label: "Height mm", type: "slider", min: 5, max: 400, step: 1, def: 140 },
      { key: "keep", label: "Keep", type: "select", options: ["Inside", "Outside"], def: "Inside" },
    ],
    overlay(p) {
      return [{ kind: "rect", x: p.x, y: p.y, w: p.w, h: p.h }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const insideRect = ([x, y]) =>
        x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      const want = (pt) => (p.keep === "Inside" ? insideRect(pt) : !insideRect(pt));
      /* rajanylityksen tarkennus bisektiolla (a haluttu, b ei) */
      const cross = (a, b) => {
        let lo = a, hi = b;
        for (let i = 0; i < 10; i++) {
          const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
          if (want(mid)) lo = mid; else hi = mid;
        }
        return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
      };
      const paths = [];
      for (const path of src.paths) {
        const pts = resample(path.pts, path.closed, 0.8);
        const seq = path.closed && pts.length > 1 ? [...pts, pts[0]] : pts;
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer: path.layer });
          run = [];
        };
        for (let i = 0; i < seq.length; i++) {
          const cur = seq[i];
          const inW = want(cur);
          if (inW) {
            if (run.length === 0 && i > 0 && !want(seq[i - 1])) run.push(cross(cur, seq[i - 1]));
            run.push(cur);
          } else {
            if (run.length > 0) {
              run.push(cross(seq[i - 1], cur));
              flush();
            }
          }
        }
        /* kokonaan sisalla pysynyt suljettu polku sailyy suljettuna */
        if (path.closed && run.length === seq.length) {
          run.pop();
          paths.push({ pts: run, closed: true, layer: path.layer });
        } else flush();
      }
      return { paths };
    }
  
};
