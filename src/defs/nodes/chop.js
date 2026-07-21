import { Pin, EMPTY, PENS, mulberry32, resample } from "../helpers.js";

export default {
  key: "chop",
    name: "Chop", cat: "mod", group: "cutsplit", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "length", label: "Piece length mm", type: "slider", min: 1, max: 80, step: 0.5, def: 12 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 20, step: 0.25, def: 0 },
      { key: "pens", label: "Pens to use", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "start", label: "Start pen", type: "pen", def: 0 },
      { key: "assign", label: "Assign", type: "select", options: ["Cycle", "Random"], def: "Cycle" },
      { key: "seed", label: "Seed", type: "seed", def: 61 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const nP = Math.round(p.pens);
      const paths = [];
      let globalIdx = 0;
      src.paths.forEach((path, pi) => {
        const rng = mulberry32(p.seed * 379 + pi * 149 + 7);
        const pts = resample(path.pts, path.closed, 0.5);
        const closedPts = path.closed ? [...pts, pts[0]] : pts;
        const cum = [0];
        for (let i = 1; i < closedPts.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(closedPts[i][0] - closedPts[i - 1][0], closedPts[i][1] - closedPts[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 0.5) return;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          return [closedPts[lo][0] + (closedPts[hi][0] - closedPts[lo][0]) * f,
                  closedPts[lo][1] + (closedPts[hi][1] - closedPts[lo][1]) * f, lo];
        };
        let s = 0;
        while (s < total - 0.3) {
          const pieceLen = Math.max(0.5, p.length * (1 - p.lenVar * rng()));
          const s0 = s + p.gap / 2;
          const s1 = Math.min(total, s + pieceLen - p.gap / 2);
          if (s1 - s0 > 0.3) {
            const [ax, ay, aIdx] = at(s0);
            const [bx, by, bIdx] = at(s1);
            const piece = [[ax, ay]];
            for (let i = aIdx + 1; i <= bIdx; i++) piece.push([closedPts[i][0], closedPts[i][1]]);
            piece.push([bx, by]);
            const pen = p.assign === "Random"
              ? Math.floor(rng() * nP)
              : globalIdx % nP;
            paths.push({ pts: piece, closed: false, layer: (Math.round(p.start) + pen) % PENS.length });
            globalIdx++;
          }
          s += pieceLen;
        }
      });
      return { paths };
    },
  
};
