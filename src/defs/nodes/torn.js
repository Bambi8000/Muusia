import { Pin, EMPTY, hash2, noise2, resample, pathLength } from "../helpers.js";

export default {
  key: "torn",
  name: "Torn",
  cat: "mod",
  group: "cutsplit",
  desc: "Rips the input open along a tear band. Every path crossing the band deterministically either BRIDGES the gap as one long straight span, gets FLUNG aside as a coherent burst (Fling = reach in mm, Chaos = angular spread), or SNAPS into two spiky loose ends; Fling % / Snap % set the mix, the rest bridge. Gape pushes intact geometry apart so the wound visibly opens, Ragged makes the edge irregular, Detail resamples the input first (0 = keep original vertices) so coarse shapes tear cleanly. Angle/Offset/Width place the band (dashed overlay). Closed paths that cross the tear become open; paths swallowed whole by the band are flung or dropped. Works on anything - stack several Torn nodes for multiple rips. Classic pairing: Loom -> Torn.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "detail", label: "Detail (mm)", type: "slider", min: 0, max: 5, step: 0.1, def: 0 },
    { key: "angle", label: "Tear angle", type: "slider", min: -90, max: 90, step: 1, def: 38 },
    { key: "offset", label: "Tear offset", type: "slider", min: -150, max: 150, step: 1, def: 0 },
    { key: "width", label: "Tear width", type: "slider", min: 5, max: 120, step: 1, def: 45 },
    { key: "ragged", label: "Ragged edge", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "gape", label: "Gape", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
    { key: "fling", label: "Fling (mm)", type: "slider", min: 0, max: 150, step: 1, def: 60 },
    { key: "chaos", label: "Chaos (deg)", type: "slider", min: 0, max: 90, step: 1, def: 55 },
    { key: "flingPct", label: "Fling %", type: "slider", min: 0, max: 100, step: 1, def: 45 },
    { key: "snapPct", label: "Snap %", type: "slider", min: 0, max: 100, step: 1, def: 25 },
  ],
  overlay(p, ctx) {
    const W = ctx.W, H = ctx.H;
    const A = ((+p.angle || 0) * Math.PI) / 180;
    const dirX = Math.cos(A), dirY = Math.sin(A);
    const perX = -dirY, perY = dirX;
    const off = +p.offset || 0;
    const cx = W / 2 + perX * off, cy = H / 2 + perY * off;
    const w2 = Math.max(1, (+p.width || 0) / 2);
    const L = Math.hypot(W, H) / 2 + 10;
    const c = (sd, sp) => [cx + dirX * L * sd + perX * w2 * sp, cy + dirY * L * sd + perY * w2 * sp];
    const reach = Math.max(10, +p.fling || 0);
    return [
      { kind: "poly", pts: [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)] },
      { kind: "arrow", x1: cx, y1: cy, x2: cx + perX * reach, y2: cy + perY * reach },
      { kind: "arrow", x1: cx, y1: cy, x2: cx - perX * reach, y2: cy - perY * reach },
    ];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const W = ctx.W, H = ctx.H;
    const S = Math.round(+p.seed || 0);
    const A = ((+p.angle || 0) * Math.PI) / 180;
    const dirX = Math.cos(A), dirY = Math.sin(A);
    const perX = -dirY, perY = dirX;
    const off = +p.offset || 0;
    const cx = W / 2 + perX * off, cy = H / 2 + perY * off;
    const w2 = Math.max(1, (+p.width || 0) / 2);
    const rag = Math.max(0, Math.min(1, +p.ragged || 0));
    const gape = Math.max(0, +p.gape || 0);
    const fl = Math.max(0, +p.fling || 0);
    const chaosR = (Math.max(0, Math.min(179, +p.chaos || 0)) * Math.PI) / 180;
    const flingPct = Math.max(0, Math.min(100, +p.flingPct || 0));
    const snapPct = Math.max(0, Math.min(100, +p.snapPct || 0));
    const perAng = Math.atan2(perY, perX);

    // resample budget guard: never let Detail explode the point count
    let step = Math.max(0, +p.detail || 0);
    if (step > 0) {
      let totalLen = 0;
      for (const q of src.paths) totalLen += pathLength(q.pts, q.closed);
      step = Math.max(step, totalLen / 105000);
    }

    const clampPt = (x, y) => [
      Math.min(W - 1.5, Math.max(1.5, x)),
      Math.min(H - 1.5, Math.max(1.5, y)),
    ];
    const vecFor = (ti, gi, salt) => {
      const r2 = hash2(ti, gi * 11 + salt + 2, S * 7919 + 101);
      const r3 = hash2(ti, gi * 11 + salt + 3, S * 7919 + 101);
      const r4 = hash2(ti, gi * 11 + salt + 4, S * 7919 + 101);
      const sgn = r2 < 0.5 ? -1 : 1;
      const ang = (sgn > 0 ? perAng : perAng + Math.PI) + (r3 - 0.5) * 2 * chaosR;
      const mag = fl * (0.25 + r4 * r4 * 1.2);
      return [Math.cos(ang) * mag, Math.sin(ang) * mag];
    };

    const out = [];
    src.paths.forEach((path, pi) => {
      let pts = step > 0 ? resample(path.pts, path.closed, step) : path.pts.map((q) => q.slice());
      const n = pts.length;
      if (n < 2) { out.push({ ...path, pts }); return; }
      const ti = pi * 2 + 1;

      // classify against the band (pre-gape position), then apply the gape push
      const DEP = new Float64Array(n);
      const Q = new Array(n);
      let anyIn = false;
      for (let i = 0; i < n; i++) {
        let x = pts[i][0], y = pts[i][1];
        const rdx = x - cx, rdy = y - cy;
        const d = rdx * perX + rdy * perY;
        const s = rdx * dirX + rdy * dirY;
        const e = w2 * (1 - rag * 0.75 + rag * 1.5 * noise2(s * 0.02, 3.7, S * 29 + 11));
        const ad = Math.abs(d);
        if (ad < e) { DEP[i] = 1 - ad / e; anyIn = true; }
        if (gape > 0) {
          const push = Math.sign(d || 1) * gape * Math.pow(Math.max(0, 1 - ad / (e * 2.6)), 1.4);
          x += perX * push;
          y += perY * push;
        }
        Q[i] = [x, y];
      }
      if (!anyIn) { out.push({ ...path, pts: Q }); return; }

      const layer = path.layer;
      const emit = (ps) => { if (ps.length >= 2) out.push({ pts: ps, closed: false, layer }); };

      // closed path swallowed whole by the band: fling it as one piece, or drop
      let V = Q, D = DEP, m = n, wasClosed = path.closed;
      if (wasClosed) {
        let s0 = -1;
        for (let i = 0; i < n; i++) if (DEP[i] <= 0) { s0 = i; break; }
        if (s0 < 0) {
          const r1 = hash2(ti, 12, S * 7919 + 101);
          if (r1 * 100 < flingPct) {
            const v = vecFor(ti, 1, 0);
            out.push({
              ...path,
              pts: Q.map((q, i) => clampPt(q[0] + v[0] * Math.pow(DEP[i], 0.7), q[1] + v[1] * Math.pow(DEP[i], 0.7))),
            });
          }
          return;
        }
        // rotate so the walk starts outside, duplicate the start to close the ring
        V = new Array(n + 1);
        D = new Float64Array(n + 1);
        for (let i = 0; i <= n; i++) {
          const k = (s0 + i) % n;
          V[i] = Q[k];
          D[i] = DEP[k];
        }
        m = n + 1;
      }

      let cur = [];
      let gi = 0;
      let i = 0;
      while (i < m) {
        if (D[i] <= 0) { cur.push(V[i].slice()); i++; continue; }
        let k = i;
        while (k < m && D[k] > 0) k++;
        gi++;
        const r1 = hash2(ti, gi * 11 + 1, S * 7919 + 101);
        const pick = r1 * 100;
        if (pick < flingPct) {
          const v = vecFor(ti, gi, 0);
          for (let q = i; q < k; q++) {
            const dep = Math.pow(D[q], 0.7);
            cur.push(clampPt(V[q][0] + v[0] * dep, V[q][1] + v[1] * dep));
          }
        } else if (pick < flingPct + snapPct) {
          if (cur.length) {
            const v = vecFor(ti, gi, 0);
            const last = cur[cur.length - 1];
            cur.push(clampPt(last[0] + v[0], last[1] + v[1]));
            emit(cur);
            cur = [];
          }
          if (k < m) {
            const v2 = vecFor(ti, gi, 5);
            cur.push(clampPt(V[k][0] + v2[0], V[k][1] + v2[1]));
          }
        }
        // Bridge: skip the inside vertices entirely -> one long straight span
        i = k;
      }
      emit(cur);
    });
    return { paths: out };
  },
};
