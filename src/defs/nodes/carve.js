import { Pin, EMPTY, pathLength } from "../helpers.js";

export default {
  key: "carve",
    name: "Carve",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "t0", label: "Start t (0-1)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "t1", label: "End t (0-1, wire Frame)", type: "slider", min: 0, max: 1, step: 0.001, def: 1 },
      { key: "invert", label: "Keep outside", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      let a = Math.max(0, Math.min(1, Math.min(p.t0, p.t1)));
      let b = Math.max(0, Math.min(1, Math.max(p.t0, p.t1)));
      const paths = [];
      const extract = (pts, s0, s1, layer) => {
        /* substring of a polyline by arc length, interpolated cut points */
        if (s1 - s0 < 0.01) return;
        const out = [];
        let acc = 0, started = false;
        for (let i = 1; i < pts.length; i++) {
          const ax = pts[i - 1][0], ay = pts[i - 1][1];
          const bx = pts[i][0], by = pts[i][1];
          const seg = Math.hypot(bx - ax, by - ay);
          if (seg < 1e-9) continue;
          const e0 = acc, e1 = acc + seg;
          if (e1 > s0 && e0 < s1) {
            const f0 = Math.max(0, (s0 - e0) / seg);
            const f1 = Math.min(1, (s1 - e0) / seg);
            if (!started) {
              out.push([ax + (bx - ax) * f0, ay + (by - ay) * f0]);
              started = true;
            }
            out.push([ax + (bx - ax) * f1, ay + (by - ay) * f1]);
          }
          acc = e1;
          if (e1 >= s1) break;
        }
        if (out.length > 1) paths.push({ pts: out, closed: false, layer });
      };
      src.paths.forEach((path) => {
        const raw = path.closed ? [...path.pts, path.pts[0]] : path.pts;
        const total = pathLength(raw, false);
        if (total < 0.01 || raw.length < 2) return;
        if (!p.invert && a <= 0.0005 && b >= 0.9995) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        if (!p.invert) {
          extract(raw, a * total, b * total, path.layer);
        } else if (path.closed) {
          /* complement of the window wraps around a closed path */
          const dbl = [...raw.slice(0, -1), ...raw];
          extract(dbl, b * total, (a + 1) * total, path.layer);
        } else {
          extract(raw, 0, a * total, path.layer);
          extract(raw, b * total, total, path.layer);
        }
      });
      return { paths };
    }
  
};
