import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "travelsort",
    name: "Travel Sort",
    cat: "mod",
    group: "penout",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "reverse", label: "Allow reversing", type: "check", def: true },
      { key: "rotate", label: "Rotate closed starts", type: "check", def: true },
      { key: "bypen", label: "Group by pen", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (src.paths.length < 3) {
        return { paths: src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      /* group by pen (preserving order of first appearance), sort within groups */
      const groups = [];
      const byLayer = new Map();
      src.paths.forEach((pa) => {
        const key = p.bypen ? pa.layer : 0;
        if (!byLayer.has(key)) { byLayer.set(key, []); groups.push(byLayer.get(key)); }
        byLayer.get(key).push(pa);
      });
      const out = [];
      let cur = [0, 0];
      for (const group of groups) {
        const items = group.map((pa) => ({
          pa,
          start: pa.pts[0],
          end: pa.pts[pa.pts.length - 1],
          used: false
        }));
        const HARD = 3000; /* O(n^2) guard: beyond this, pass through unsorted */
        if (items.length > HARD) {
          for (const it of items) out.push({ ...it.pa, pts: it.pa.pts.map((q) => q.slice()) });
          continue;
        }
        for (let n = 0; n < items.length; n++) {
          let best = -1, bestD = Infinity, bestRev = false;
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.used) continue;
            const d1 = Math.hypot(cur[0] - it.start[0], cur[1] - it.start[1]);
            if (d1 < bestD) { bestD = d1; best = i; bestRev = false; }
            if (p.reverse && !it.pa.closed) {
              const d2 = Math.hypot(cur[0] - it.end[0], cur[1] - it.end[1]);
              if (d2 < bestD) { bestD = d2; best = i; bestRev = true; }
            }
          }
          const it = items[best];
          it.used = true;
          let pts = it.pa.pts.map((q) => q.slice());
          if (it.pa.closed && p.rotate) {
            /* enter a closed loop at its vertex nearest the pen */
            let bi = 0, bd = Infinity;
            for (let k = 0; k < pts.length; k++) {
              const d = Math.hypot(cur[0] - pts[k][0], cur[1] - pts[k][1]);
              if (d < bd) { bd = d; bi = k; }
            }
            if (bi > 0) pts = pts.slice(bi).concat(pts.slice(0, bi));
          } else if (bestRev) {
            pts.reverse();
          }
          out.push({ ...it.pa, pts });
          cur = it.pa.closed ? pts[0] : pts[pts.length - 1];
        }
      }
      return { paths: out };
    }
  
};
