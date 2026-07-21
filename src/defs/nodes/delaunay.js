import { Pin, mulberry32, resample, applyStyle } from "../helpers.js";

export default {
  key: "delaunay",
    name: "Delaunay",
    cat: "gen",
    group: "geometric",
    ins: [Pin("paths", "Points (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "points", label: "Points (if unwired)", type: "slider", min: 3, max: 400, step: 1, def: 60 },
      { key: "spacing", label: "Input spacing mm (0=vertices)", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 43 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[1]);
      /* points: from wired paths (resampled/vertices) or seeded random */
      let pts = [];
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        if (p.spacing > 0.01) {
          /* escalate spacing until under the triangulation budget so the
             slider has a visible effect at every value */
          let sp = Math.max(1, p.spacing);
          const gather = (s) => {
            const out = [];
            for (const pa of ins[0].paths) for (const q of resample(pa.pts, pa.closed, s)) out.push([q[0], q[1]]);
            return out;
          };
          pts = gather(sp);
          let g2 = 0;
          while (pts.length > 600 && g2++ < 14) { sp *= 1.3; pts = gather(sp); }
        } else {
          for (const pa of ins[0].paths) for (const q of pa.pts) pts.push([q[0], q[1]]);
        }
      } else {
        const rng = mulberry32(p.seed * 3803 + 27);
        const N = Math.max(3, Math.min(400, Math.round(p.points)));
        for (let i = 0; i < N; i++) {
          pts.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
        }
      }
      /* dedupe near-identical points (degenerate circumcircles) */
      const seenP = new Set();
      pts = pts.filter(([x, y]) => {
        const k = Math.round(x * 10) + "," + Math.round(y * 10);
        if (seenP.has(k)) return false;
        seenP.add(k);
        return true;
      });
      if (pts.length > 600) {
        const stride = pts.length / 600;
        const dec = [];
        for (let i = 0; i < 600; i++) dec.push(pts[Math.floor(i * stride)]);
        pts = dec;
      }
      if (pts.length < 3) return applyStyle({ paths: [] }, ins[1]);
      /* Bowyer-Watson triangulation */
      const n = pts.length;
      const big = Math.max(W, H) * 10;
      const P = pts.concat([[W / 2 - big, H / 2 - big], [W / 2 + big, H / 2 - big], [W / 2, H / 2 + big]]);
      let tris = [[n, n + 1, n + 2]];
      const circum = (i, j, k) => {
        const [ax, ay] = P[i], [bx, by] = P[j], [cx2, cy2] = P[k];
        const d = 2 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by));
        if (Math.abs(d) < 1e-12) return null;
        const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx2 * cx2 + cy2 * cy2;
        const ux = (a2 * (by - cy2) + b2 * (cy2 - ay) + c2 * (ay - by)) / d;
        const uy = (a2 * (cx2 - bx) + b2 * (ax - cx2) + c2 * (bx - ax)) / d;
        return [ux, uy, (ux - ax) * (ux - ax) + (uy - ay) * (uy - ay)];
      };
      for (let pi = 0; pi < n; pi++) {
        const [px, py] = P[pi];
        const bad = [];
        for (let t = 0; t < tris.length; t++) {
          const cc = circum(tris[t][0], tris[t][1], tris[t][2]);
          if (!cc) { continue; }
          const dx = px - cc[0], dy = py - cc[1];
          if (dx * dx + dy * dy < cc[2] - 1e-9) bad.push(t);
        }
        /* boundary polygon = edges of bad triangles not shared by two bad ones */
        const edgeCount = new Map();
        const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            const k = ek(u, v);
            edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
          }
        }
        const boundary = [];
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            if (edgeCount.get(ek(u, v)) === 1) boundary.push([u, v]);
          }
        }
        for (let i = bad.length - 1; i >= 0; i--) tris.splice(bad[i], 1);
        for (const [u, v] of boundary) tris.push([u, v, pi]);
      }
      /* unique edges, skipping the super-triangle */
      const L = Math.round(p.layer);
      const paths = [];
      const seen = new Set();
      for (const [a, b, c] of tris) {
        if (a >= n || b >= n || c >= n) continue;
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const k = u < v ? u + "_" + v : v + "_" + u;
          if (seen.has(k)) continue;
          seen.add(k);
          paths.push({ pts: [[P[u][0], P[u][1]], [P[v][0], P[v][1]]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[1]);
    }
  
};
