import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "diffpens",
    name: "Diff Pens",
    cat: "duo",
    desc: "Compares Modified against Original and recolors only what changed: paths that exist in both keep their pen, anything NEW in Modified moves to the Diff pen. Feed a sprig to Original, the same sprig through Fur to Modified - the sprig stays one color and the fur gets another. Exact match is fast for add-only modifiers; Distance match tolerates wobble and splits (Hand Drawn etc.) within the tolerance.",
    ins: [Pin("paths", "Original"), Pin("paths", "Modified")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Match", type: "select", options: ["Exact", "Distance"], def: "Exact" },
      { key: "tol", label: "Tolerance mm (Distance)", type: "slider", min: 0.2, max: 6, step: 0.1, def: 1.5 },
      { key: "cover", label: "Match coverage", type: "slider", min: 0.5, max: 1, step: 0.05, def: 0.9 },
      { key: "diffPen", label: "Diff pen (new parts)", type: "pen", def: 1 },
      { key: "recolorKept", label: "Recolor kept parts too", type: "check", def: false },
      { key: "keptPen", label: "Kept pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const A = ins[0] || EMPTY, B = ins[1] || EMPTY;
      if (!B.paths.length) return EMPTY;
      const copy = (pa, layer) => ({ ...pa, pts: pa.pts.map((q) => q.slice()), layer });
      if (!A.paths.length) {
        /* nothing to compare against: pass through untouched */
        return { paths: B.paths.map((pa) => copy(pa, pa.layer)) };
      }
      const diffPen = Math.round(p.diffPen);
      const keptOf = (pa) => (p.recolorKept ? Math.round(p.keptPen) : pa.layer);
      const out = [];
      if (p.mode === "Exact") {
        const q = (v) => Math.round(v * 100) / 100;
        const sig = (pa) => (pa.closed ? "C" : "O") + pa.pts.map(([x, y]) => q(x) + "," + q(y)).join(";");
        const set = new Set(A.paths.map(sig));
        for (const pa of B.paths) out.push(copy(pa, set.has(sig(pa)) ? keptOf(pa) : diffPen));
        return { paths: out };
      }
      /* Distance: a B path is "original" if >= coverage of its samples lie within tol of A's geometry */
      const tol = Math.max(0.05, p.tol);
      const segs = [];
      for (const pa of A.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
      }
      const bs = Math.max(3, tol * 2 + 1);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const sx0 = Math.min(s[0], s[2]) - tol, sx1 = Math.max(s[0], s[2]) + tol;
        const sy0 = Math.min(s[1], s[3]) - tol, sy1 = Math.max(s[1], s[3]) + tol;
        for (let by = Math.floor(sy0 / bs); by <= Math.floor(sy1 / bs); by++)
          for (let bx = Math.floor(sx0 / bs); bx <= Math.floor(sx1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k); if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
      });
      const nearA = (x, y) => {
        const a = buckets.get(Math.floor(x / bs) + "," + Math.floor(y / bs));
        if (!a) return false;
        for (const i of a) {
          const s = segs[i];
          const dx = s[2] - s[0], dy = s[3] - s[1];
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const ddx = x - (s[0] + dx * t), ddy = y - (s[1] + dy * t);
          if (ddx * ddx + ddy * ddy <= tol * tol) return true;
        }
        return false;
      };
      for (const pa of B.paths) {
        const pts = resample(pa.pts, pa.closed, Math.max(0.5, tol * 0.6));
        let hit = 0;
        for (const [x, y] of pts) if (nearA(x, y)) hit++;
        const matched = pts.length > 0 && hit / pts.length >= p.cover;
        out.push(copy(pa, matched ? keptOf(pa) : diffPen));
      }
      return { paths: out };
    }
  
};
