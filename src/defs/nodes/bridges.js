import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "bridges",
  name: "Bridges",
  cat: "mod",
  group: "pathops",
  desc: "Connects points of the input with bridge lines. Source picks the points: Vertices (resampled at a spacing), Path centers (one point per path - Polka Dots or Phyllotaxis circles become nodes), or Endpoints of open paths. Rules: k-nearest, Within distance, Chain (one continuous nearest-neighbour stroke; Max bridge splits it at long jumps) or Delaunay edges. Trim ends stops each bridge short of its points so lines never pierce the dots.",
  ins: [Pin("paths", "Source")],
  outs: [Pin("paths")],
  params: [
    { key: "source", label: "Points from", type: "select", options: ["Path centers", "Vertices", "Endpoints"], def: "Path centers" },
    { key: "spacing", label: "Vertex spacing mm (0=raw)", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
    { key: "rule", label: "Connect", type: "select", options: ["k-nearest", "Within distance", "Chain", "Delaunay"], def: "k-nearest" },
    { key: "k", label: "k (nearest)", type: "slider", min: 1, max: 8, step: 1, def: 3 },
    { key: "dist", label: "Within mm", type: "slider", min: 2, max: 120, step: 1, def: 30 },
    { key: "maxPer", label: "Max per point", type: "slider", min: 1, max: 12, step: 1, def: 6 },
    { key: "minLen", label: "Min bridge mm", type: "slider", min: 0, max: 60, step: 1, def: 0 },
    { key: "maxLen", label: "Max bridge mm (0=off)", type: "slider", min: 0, max: 250, step: 1, def: 0 },
    { key: "trim", label: "Trim ends mm", type: "slider", min: 0, max: 12, step: 0.25, def: 0 },
    { key: "keep", label: "Keep source", type: "check", def: true },
    { key: "layer", label: "Bridge pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const L = Math.round(p.layer);
    const out = p.keep ? src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) : [];

    /* ---- gather points ---- */
    let pts = [];
    if (p.source === "Path centers") {
      for (const pa of src.paths) {
        if (pa.pts.length < 1) continue;
        let sx = 0, sy = 0;
        for (const q of pa.pts) { sx += q[0]; sy += q[1]; }
        pts.push([sx / pa.pts.length, sy / pa.pts.length]);
      }
    } else if (p.source === "Endpoints") {
      for (const pa of src.paths) {
        if (pa.closed || pa.pts.length < 2) continue;
        pts.push(pa.pts[0].slice(), pa.pts[pa.pts.length - 1].slice());
      }
    } else {
      for (const pa of src.paths) {
        const list = p.spacing > 0.01 ? resample(pa.pts, pa.closed, Math.max(1, p.spacing)) : pa.pts;
        for (const q of list) pts.push([q[0], q[1]]);
      }
    }
    /* dedupe near-identical */
    const seen = new Set();
    pts = pts.filter(([x, y]) => {
      const k2 = Math.round(x * 10) + "," + Math.round(y * 10);
      if (seen.has(k2)) return false;
      seen.add(k2);
      return true;
    });
    const CAP = p.rule === "Delaunay" ? 600 : 1500;
    if (pts.length > CAP) {
      const stride = pts.length / CAP;
      const dec = [];
      for (let i = 0; i < CAP; i++) dec.push(pts[Math.floor(i * stride)]);
      pts = dec;
    }
    const n = pts.length;
    if (n < 2) return { paths: out };
    const dOf = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
    const minL = Math.max(0, p.minLen);
    const maxL = p.maxLen > 0.5 ? p.maxLen : Infinity;
    const lenOk = (d) => d >= minL && d <= maxL;

    /* ---- build edges ---- */
    const edges = []; /* [a, b, d] */
    if (p.rule === "Chain") {
      const visited = new Uint8Array(n);
      let cur = 0;
      visited[0] = 1;
      let run = [pts[0].slice()];
      const flush = () => { if (run.length > 1) out.push({ pts: run, closed: false, layer: L }); run = []; };
      for (let step = 1; step < n; step++) {
        let best = -1, bd = Infinity;
        for (let j = 0; j < n; j++) {
          if (visited[j]) continue;
          const d = dOf(cur, j);
          if (d < bd - 1e-9) { bd = d; best = j; }
        }
        visited[best] = 1;
        if (bd > maxL) { flush(); run = [pts[best].slice()]; }
        else run.push(pts[best].slice());
        cur = best;
      }
      flush();
      return { paths: out };
    }
    if (p.rule === "Delaunay") {
      const big = Math.max(ctx.W, ctx.H) * 10;
      const P = pts.concat([[ctx.W / 2 - big, ctx.H / 2 - big], [ctx.W / 2 + big, ctx.H / 2 - big], [ctx.W / 2, ctx.H / 2 + big]]);
      let tris = [[n, n + 1, n + 2]];
      const circum = (i, j, k2) => {
        const [ax, ay] = P[i], [bx, by] = P[j], [cx, cy] = P[k2];
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) < 1e-12) return null;
        const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
        const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
        const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
        return [ux, uy, (ux - ax) * (ux - ax) + (uy - ay) * (uy - ay)];
      };
      const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
      for (let pi = 0; pi < n; pi++) {
        const [px, py] = P[pi];
        const bad = [];
        for (let t = 0; t < tris.length; t++) {
          const cc = circum(tris[t][0], tris[t][1], tris[t][2]);
          if (!cc) continue;
          const dx = px - cc[0], dy = py - cc[1];
          if (dx * dx + dy * dy < cc[2] - 1e-9) bad.push(t);
        }
        const edgeCount = new Map();
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            const k2 = ek(u, v);
            edgeCount.set(k2, (edgeCount.get(k2) || 0) + 1);
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
      const eseen = new Set();
      for (const [a, b, c] of tris) {
        if (a >= n || b >= n || c >= n) continue;
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const k2 = ek(u, v);
          if (eseen.has(k2)) continue;
          eseen.add(k2);
          const d = dOf(u, v);
          if (lenOk(d)) edges.push([u, v, d]);
        }
      }
    } else {
      /* candidate pairs: k-nearest sets, or all pairs within dist */
      const cand = [];
      const ekSeen = new Set();
      const addCand = (a, b) => {
        const k2 = a < b ? a + "_" + b : b + "_" + a;
        if (ekSeen.has(k2)) return;
        ekSeen.add(k2);
        const d = dOf(a, b);
        if (lenOk(d) && (p.rule === "k-nearest" || d <= p.dist)) cand.push([a, b, d]);
      };
      if (p.rule === "k-nearest") {
        const kk = Math.max(1, Math.round(p.k));
        for (let i = 0; i < n; i++) {
          const ds = [];
          for (let j = 0; j < n; j++) if (j !== i) ds.push([dOf(i, j), j]);
          ds.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
          for (let q = 0; q < Math.min(kk, ds.length); q++) addCand(i, ds[q][1]);
        }
      } else {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          if (dOf(i, j) <= p.dist) addCand(i, j);
        }
      }
      /* greedy by ascending length under per-point cap */
      cand.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
      const deg = new Uint16Array(n);
      const cap = Math.max(1, Math.round(p.maxPer));
      for (const [a, b, d] of cand) {
        if (deg[a] >= cap || deg[b] >= cap) continue;
        deg[a]++; deg[b]++;
        edges.push([a, b, d]);
      }
    }

    /* ---- emit with trim ---- */
    const tr = Math.max(0, p.trim);
    for (const [a, b, d] of edges) {
      let [ax, ay] = pts[a], [bx, by] = pts[b];
      if (tr > 0.01) {
        if (d <= tr * 2 + 0.4) continue;
        const ux = (bx - ax) / d, uy = (by - ay) / d;
        ax += ux * tr; ay += uy * tr;
        bx -= ux * tr; by -= uy * tr;
      }
      out.push({ pts: [[ax, ay], [bx, by]], closed: false, layer: L });
    }
    return { paths: out };
  },
};