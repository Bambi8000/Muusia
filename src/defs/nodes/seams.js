import { Pin, EMPTY, hash2 } from "../helpers.js";

export default {
  /* Shuffle Seams - rotates the start point of every closed path so the
     pen-down/pen-up seams stop lining up (nested Rings fills draw a
     visible seam column otherwise), with an optional overlap run past
     the seam that hides the pen dot entirely. */
  key: "seams",
  name: "Shuffle Seams",
  cat: "mod",
  group: "pathops",
  desc: "Moves the start point of every closed path so pen-down seams stop lining up - concentric Rings fills otherwise plot a visible seam column where every circle starts and ends. Golden spiral steps each seam by the golden angle so no two ever align (the right choice for nested rings), Random scatters them with the seed, Fixed step rotates each successive path by Step degrees. The cut lands at an exact arc-length position (a new point is interpolated, z values included), so the geometry is untouched - only the draw order around the loop changes. Overlap makes each path run past its seam by that many millimetres and emits it as an open path, hiding the pen dot under fresh ink; 0 keeps paths closed. Open paths pass through untouched.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Golden spiral", "Random", "Fixed step"], def: "Golden spiral" },
    { key: "step", label: "Step deg", type: "slider", min: 5, max: 360, step: 5, def: 137.5, showIf: (p) => p.mode === "Fixed step" },
    { key: "seed", label: "Seed (random)", type: "seed", def: 83 },
    { key: "overlap", label: "Overlap mm", type: "slider", min: 0, max: 5, step: 0.1, def: 0 },
  ],
  compute(ins, p) {
    const src = ins[0] || EMPTY;
    const overlap = Math.max(0, p.overlap);
    let k = 0;
    const paths = src.paths.map((path) => {
      if (!path.closed || !path.pts || path.pts.length < 3) return path;
      const pts = path.pts;
      const n = pts.length;
      const cum = [0];
      for (let i = 1; i <= n; i++) {
        const a = pts[i - 1], b = pts[i % n];
        cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      const L = cum[n];
      if (L < 1e-6) return path;
      let frac;
      if (p.mode === "Random") frac = hash2(k, 9, (p.seed >>> 0) * 17 + 3);
      else if (p.mode === "Fixed step") frac = (((k * p.step) / 360) % 1 + 1) % 1;
      else frac = (k * 0.3819660113) % 1;
      k++;
      const target = Math.min(L - 1e-9, frac * L);
      let si = 0;
      while (si < n - 1 && cum[si + 1] < target) si++;
      const segLen = cum[si + 1] - cum[si];
      const t = segLen > 1e-9 ? (target - cum[si]) / segLen : 0;
      const A = pts[si], B = pts[(si + 1) % n];
      const cut = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
      if (A.length > 2 && B.length > 2) cut.push(A[2] + (B[2] - A[2]) * t);
      else if (A.length > 2) cut.push(A[2]);
      const out = [cut];
      for (let i = 1; i <= n; i++) out.push(pts[(si + i) % n].slice());
      if (overlap <= 0.001) return { ...path, pts: out, closed: true };
      /* run past the seam: close back to the cut, then continue forward */
      out.push(cut.slice(0, 2));
      let acc = 0, i2 = (si + 1) % n, prev = cut, guard = 0;
      while (acc < overlap && guard++ <= n + 2) {
        const q = pts[i2];
        const d = Math.hypot(q[0] - prev[0], q[1] - prev[1]);
        if (acc + d >= overlap) {
          const tt = d > 1e-9 ? (overlap - acc) / d : 0;
          out.push([prev[0] + (q[0] - prev[0]) * tt, prev[1] + (q[1] - prev[1]) * tt]);
          break;
        }
        out.push(q.slice(0, 2));
        acc += d;
        prev = q;
        i2 = (i2 + 1) % n;
      }
      return { ...path, pts: out, closed: false };
    });
    return { paths };
  },
};
