import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "simplify",
    name: "Simplify", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "tol", label: "Tolerance mm", type: "slider", min: 0.05, max: 3, step: 0.05, def: 0.2 }],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rdp = (pts, tol) => {
        if (pts.length < 3) return pts;
        const keep = new Array(pts.length).fill(false);
        keep[0] = keep[pts.length - 1] = true;
        const stack = [[0, pts.length - 1]];
        while (stack.length) {
          const [a, b] = stack.pop();
          const [ax, ay] = pts[a], [bx, by] = pts[b];
          const dx = bx - ax, dy = by - ay;
          const len = Math.hypot(dx, dy) || 1e-9;
          let maxD = 0, maxI = -1;
          for (let i = a + 1; i < b; i++) {
            const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
            if (d > maxD) { maxD = d; maxI = i; }
          }
          if (maxD > tol && maxI > 0) {
            keep[maxI] = true;
            stack.push([a, maxI], [maxI, b]);
          }
        }
        return pts.filter((_, i) => keep[i]);
      };
      const paths = src.paths.map((path) => ({ ...path, pts: rdp(path.pts, p.tol) }));
      return { paths };
    },
  
};
