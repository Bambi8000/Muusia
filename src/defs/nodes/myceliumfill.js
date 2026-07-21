import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "myceliumfill",
  name: "Mycelium Fill",
  cat: "mod",
  group: "fillstyle",
  desc: "Grows organic flesh along a line network: parallel strands follow each input line, and the width swells near junctions (places where 3+ path ends meet, or where different paths cross) so joints read thicker - a slime-mould / mycelium look on a Voronoi or Network input. Strands that would invade a neighbouring strut's territory are cut, except near junctions where they merge. Waviness adds hyphal wobble; Taper thins the open ends.",
  ins: [Pin("paths", "Network")],
  outs: [Pin("paths")],
  params: [
    { key: "strands", label: "Strands per side", type: "slider", min: 1, max: 8, step: 1, def: 2 },
    { key: "width", label: "Base width mm", type: "slider", min: 0.5, max: 24, step: 0.5, def: 4 },
    { key: "boost", label: "Junction boost", type: "slider", min: 0, max: 3, step: 0.05, def: 1.2 },
    { key: "wav", label: "Waviness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "taper", label: "Taper ends mm", type: "slider", min: 0, max: 30, step: 1, def: 6 },
    { key: "keep", label: "Keep source", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 21 },
    { key: "layer", label: "Strand pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const L = Math.round(p.layer);
    const out = p.keep ? src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) : [];
    const BUDGET = 120000;
    let total = out.reduce((s, pa) => s + pa.pts.length, 0);

    /* ---- segment soup + spatial grid (for territory queries) ---- */
    const segs = []; /* [x1,y1,x2,y2,owner] */
    const spines = [];
    src.paths.forEach((pa, id) => {
      if (pa.pts.length < 2) return;
      const pts = resample(pa.pts, pa.closed, 1);
      if (pts.length < 3) return;
      spines.push({ pts, closed: pa.closed, id });
      const coarse = resample(pa.pts, pa.closed, 2.5);
      const M = pa.closed ? coarse.length : coarse.length - 1;
      for (let i = 0; i < M; i++) {
        const a = coarse[i], b = coarse[(i + 1) % coarse.length];
        segs.push([a[0], a[1], b[0], b[1], id]);
      }
    });
    if (!spines.length) return { paths: out };
    const CELL = 6;
    const grid = new Map();
    const gk = (x, y) => x + "," + y;
    segs.forEach((s, i) => {
      const x0 = Math.floor(Math.min(s[0], s[2]) / CELL), x1 = Math.floor(Math.max(s[0], s[2]) / CELL);
      const y0 = Math.floor(Math.min(s[1], s[3]) / CELL), y1 = Math.floor(Math.max(s[1], s[3]) / CELL);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        const k = gk(gx, gy);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    });
    const segDist = (x, y, s) => {
      const dx = s[2] - s[0], dy = s[3] - s[1];
      const L2 = dx * dx + dy * dy || 1e-9;
      let t = ((x - s[0]) * dx + (y - s[1]) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
    };
    const nearestOther = (x, y, owner, maxR) => {
      const r = Math.max(1, Math.ceil(maxR / CELL));
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      let best = Infinity;
      for (let gx = cx - r; gx <= cx + r; gx++) for (let gy = cy - r; gy <= cy + r; gy++) {
        for (const i of grid.get(gk(gx, gy)) || []) {
          if (segs[i][4] === owner) continue;
          const d = segDist(x, y, segs[i]);
          if (d < best) best = d;
        }
      }
      return best;
    };

    /* ---- junctions: endpoint clusters (deg >= 3) + cross-owner intersections ---- */
    const junctions = [];
    {
      const endMap = new Map();
      for (const pa of src.paths) {
        if (pa.closed || pa.pts.length < 2) continue;
        for (const q of [pa.pts[0], pa.pts[pa.pts.length - 1]]) {
          const k = Math.round(q[0]) + "," + Math.round(q[1]);
          if (!endMap.has(k)) endMap.set(k, { x: 0, y: 0, n: 0 });
          const e = endMap.get(k);
          e.x += q[0]; e.y += q[1]; e.n++;
        }
      }
      for (const e of endMap.values()) if (e.n >= 3) junctions.push([e.x / e.n, e.y / e.n]);
      /* crossings between different owners sharing a grid cell */
      const segInt = (A, B) => {
        const d1x = A[2] - A[0], d1y = A[3] - A[1], d2x = B[2] - B[0], d2y = B[3] - B[1];
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 1e-9) return null;
        const t = ((B[0] - A[0]) * d2y - (B[1] - A[1]) * d2x) / den;
        const u = ((B[0] - A[0]) * d1y - (B[1] - A[1]) * d1x) / den;
        if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
        return [A[0] + d1x * t, A[1] + d1y * t];
      };
      let tests = 0;
      const cSeen = new Set();
      outer: for (const arr of grid.values()) {
        for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) {
          if (tests++ > 20000) break outer;
          const A = segs[arr[a]], B = segs[arr[b]];
          if (A[4] === B[4]) continue;
          const ix = segInt(A, B);
          if (ix) {
            const k = Math.round(ix[0]) + "," + Math.round(ix[1]);
            if (!cSeen.has(k)) { cSeen.add(k); junctions.push(ix); }
          }
        }
      }
    }
    const jr = p.width * 2.5 + 4;
    const jlist = junctions.slice(0, 500);
    const Jat = (x, y) => {
      let s = 0;
      for (const [jx, jy] of jlist) {
        const d = Math.hypot(x - jx, y - jy);
        if (d < jr * 2.2) s += Math.exp(-(d * d) / (jr * jr * 0.35));
      }
      return Math.min(1.5, s);
    };

    /* ---- strands ---- */
    const K = Math.max(1, Math.round(p.strands));
    for (const sp of spines) {
      const pts = sp.pts;
      const N = pts.length;
      const dArr = [0];
      for (let i = 1; i < N; i++) dArr.push(dArr[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const totalLen = dArr[N - 1];
      const normals = pts.map((pt, i) => {
        const nI = sp.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
        const pI = sp.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
        const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        return [-ty / tl, tx / tl];
      });
      const Jcache = pts.map((q) => Jat(q[0], q[1]));
      for (const side of [-1, 1]) {
        for (let k = 1; k <= K; k++) {
          if (total > BUDGET) break;
          const frac = k / K;
          const sd = p.seed * 7919 + sp.id * 613 + k * 97 + (side > 0 ? 31 : 0);
          const qpts = new Array(N);
          const vis = new Array(N);
          for (let i = 0; i < N; i++) {
            const J = Jcache[i];
            let w = p.width * (1 + p.boost * J);
            if (!sp.closed && p.taper > 0.5) {
              const edge = Math.min(dArr[i], totalLen - dArr[i]);
              let tE = Math.min(1, edge / p.taper);
              tE = tE * tE * (3 - 2 * tE);
              w *= tE;
            }
            const wob = (noise2(dArr[i] * 0.08, k * 3.1, sd) - 0.5) * p.wav * p.width * 0.8 * frac;
            const off = side * frac * (w / 2) + wob;
            const q = [pts[i][0] + normals[i][0] * off, pts[i][1] + normals[i][1] * off];
            qpts[i] = q;
            const oAbs = Math.abs(off);
            if (J >= 0.15 || oAbs < 0.3) vis[i] = true;
            else vis[i] = !(nearestOther(q[0], q[1], sp.id, oAbs + 1.5) < oAbs * 0.95);
          }
          /* emit runs, wrap-aware for closed spines */
          const cutIdx = vis.findIndex((v) => !v);
          if (sp.closed && cutIdx < 0) {
            if (total + N <= BUDGET) { out.push({ pts: qpts.map((q) => q.slice()), closed: true, layer: L }); total += N; }
            continue;
          }
          const start = sp.closed ? cutIdx : 0;
          const M = sp.closed ? N : N;
          let run = [];
          const flush = () => {
            if (run.length > 2 && total + run.length <= BUDGET) { out.push({ pts: run, closed: false, layer: L }); total += run.length; }
            run = [];
          };
          for (let s2 = 0; s2 <= (sp.closed ? M : M - 1); s2++) {
            const i = sp.closed ? (start + s2) % N : s2;
            if (vis[i]) run.push(qpts[i].slice());
            else flush();
          }
          flush();
        }
      }
    }
    return { paths: out };
  },
};