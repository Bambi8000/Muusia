import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "flash_distort",
  name: "Flash Distort",
  cat: "mod",
  group: "deform",
  desc: "The lightning-bolt poster cut: slices everything into parallel strips and slides each strip along its own direction, so stripes and shapes break into jagged flashes. Angle rotates the whole cut (0 = vertical strips shifted up/down, 90 = horizontal strips shifted sideways); Segments sets the strip count across the sheet and Width variation makes them unequal thicknesses (Uniform / Random / Ramp / Wave). Shift is the travel in mm and Shift pattern picks how strips move: Alternate (the classic zigzag), Ramp (staircase), Wave, Random, or Walk (drifting random walk); Jitter adds seeded randomness on top of any pattern. Cuts are exact. Close cut faces clips closed shapes into per-strip closed polygons (new edges along the cuts) - feed those into Hatch Fill for the filled flash-stripe poster look; off, outlines just break at the cuts. Output clamped to the sheet; dashed guides show the cuts and the + shift direction.",
  ins: [Pin("paths", "Source")],
  outs: [Pin("paths")],
  params: [
    { key: "angle", label: "Angle (deg)", type: "slider", min: 0, max: 180, step: 1, def: 0 },
    { key: "segs", label: "Segments", type: "slider", min: 2, max: 60, step: 1, def: 9 },
    { key: "widthMode", label: "Widths", type: "select", options: ["Uniform", "Random", "Ramp", "Wave"], def: "Random" },
    { key: "widthAmt", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "shift", label: "Shift mm", type: "slider", min: 0, max: 80, step: 0.5, def: 14 },
    { key: "shiftMode", label: "Shift pattern", type: "select", options: ["Alternate", "Ramp", "Wave", "Random", "Walk"], def: "Alternate" },
    { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "closeCuts", label: "Close cut faces", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],
  overlay(p, ctx) {
    /* cut lines + shift direction; MUST mirror the strip math in compute */
    const { W, H } = ctx;
    const rad = (p.angle * Math.PI) / 180;
    const nx = Math.cos(rad), ny = Math.sin(rad);
    const dx = -ny, dy = nx;
    const us = [0, W * nx, H * ny, W * nx + H * ny];
    const u0 = Math.min(...us), u1 = Math.max(...us);
    const n = Math.max(2, Math.min(60, Math.round(p.segs)));
    const rng = mulberry32(p.seed * 577 + 7);
    const raw = [];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const mI = p.widthMode === "Random" ? rng() * 2 - 1
        : p.widthMode === "Ramp" ? -1 + 2 * t
        : p.widthMode === "Wave" ? Math.sin(t * Math.PI * 2)
        : 0;
      raw.push(Math.max(0.12, 1 + p.widthAmt * mI));
    }
    const sum = raw.reduce((a, b) => a + b, 0);
    const B = [u0];
    for (let i = 0; i < n; i++) B.push(B[i] + (raw[i] / sum) * (u1 - u0));
    const guides = [];
    const every = Math.max(1, Math.ceil((n + 1) / 40));
    for (let k = 0; k <= n; k += every) {
      const cx = nx * B[k], cy = ny * B[k];
      let t0 = -1e9, t1 = 1e9, ok = true;
      const clip1 = (pos, dir, lo, hi) => {
        if (Math.abs(dir) < 1e-9) { if (pos < lo || pos > hi) ok = false; return; }
        let a = (lo - pos) / dir, b = (hi - pos) / dir;
        if (a > b) { const q = a; a = b; b = q; }
        if (a > t0) t0 = a;
        if (b < t1) t1 = b;
      };
      clip1(cx, dx, 0, W);
      clip1(cy, dy, 0, H);
      if (ok && t0 <= t1) {
        guides.push({ kind: "poly", pts: [[cx + dx * t0, cy + dy * t0], [cx + dx * t1, cy + dy * t1]] });
      }
    }
    guides.push({ kind: "arrow", x1: W / 2, y1: H / 2, x2: W / 2 + dx * 16, y2: H / 2 + dy * 16 });
    return guides;
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const { W, H } = ctx;
    const rad = (p.angle * Math.PI) / 180;
    const nx = Math.cos(rad), ny = Math.sin(rad);   /* across strips (u) */
    const dx = -ny, dy = nx;                        /* along strips = shift direction */
    const U = (q) => q[0] * nx + q[1] * ny;
    /* strips span the canvas in u, so composition stays put when content moves */
    const us = [0, W * nx, H * ny, W * nx + H * ny];
    const u0 = Math.min(...us), u1 = Math.max(...us);
    const n = Math.max(2, Math.min(60, Math.round(p.segs)));
    const rng = mulberry32(p.seed * 577 + 7);
    /* strip widths (same rng stream order as overlay: widths first, shifts after) */
    const raw = [];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const mI = p.widthMode === "Random" ? rng() * 2 - 1
        : p.widthMode === "Ramp" ? -1 + 2 * t
        : p.widthMode === "Wave" ? Math.sin(t * Math.PI * 2)
        : 0;
      raw.push(Math.max(0.12, 1 + p.widthAmt * mI));
    }
    const sum = raw.reduce((a, b) => a + b, 0);
    const B = [u0];
    for (let i = 0; i < n; i++) B.push(B[i] + (raw[i] / sum) * (u1 - u0));
    /* per-strip shift in mm: pattern in -1..1 plus seeded jitter */
    const walk = [];
    if (p.shiftMode === "Walk") {
      let acc = 0, mx = 1e-9;
      for (let i = 0; i < n; i++) { acc += rng() * 2 - 1; walk.push(acc); mx = Math.max(mx, Math.abs(acc)); }
      for (let i = 0; i < n; i++) walk[i] /= mx;
    }
    const shifts = [];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const pat = p.shiftMode === "Alternate" ? (i % 2 ? -1 : 1)
        : p.shiftMode === "Ramp" ? -1 + 2 * t
        : p.shiftMode === "Wave" ? Math.sin(t * Math.PI * 2)
        : p.shiftMode === "Random" ? rng() * 2 - 1
        : walk[i];
      shifts.push(p.shift * (pat + p.jitter * (rng() * 2 - 1)));
    }
    const stripOf = (u) => {
      for (let k = 1; k < n; k++) if (u < B[k]) return k - 1;
      return n - 1;
    };
    const clampP = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];

    const paths = [];
    const BUDGET = 120000;
    let total = 0;
    const emit = (pts, closed, layer) => {
      if (pts.length < 2 || total + pts.length > BUDGET) return;
      total += pts.length;
      paths.push({ pts: pts.map(clampP), closed, layer });
    };
    const shifted = (pts, si) => pts.map(([x, y]) => [x + dx * shifts[si], y + dy * shifts[si]]);

    /* exact splitting of a polyline: interpolate every boundary crossing so
       pieces meet exactly at the cut before they slide apart */
    const splitRuns = (pts, closed) => {
      const runs = [];
      let cur = [pts[0].slice()];
      let curU = U(pts[0]);
      const nSeg = closed ? pts.length : pts.length - 1;
      for (let i = 1; i <= nSeg; i++) {
        const A = pts[i - 1], Bp = pts[i % pts.length];
        const ua = U(A), ub = U(Bp);
        /* boundaries strictly between ua and ub, in travel order */
        const cross = [];
        if (ub > ua) { for (let k = 1; k < n; k++) if (B[k] > ua && B[k] < ub) cross.push(B[k]); }
        else if (ub < ua) { for (let k = n - 1; k >= 1; k--) if (B[k] < ua && B[k] > ub) cross.push(B[k]); }
        for (const c of cross) {
          const t = (c - ua) / (ub - ua);
          const Pc = [A[0] + (Bp[0] - A[0]) * t, A[1] + (Bp[1] - A[1]) * t];
          cur.push(Pc);
          /* strip of the finished run from a mid-run u sample (robust on boundaries) */
          runs.push({ pts: cur, s: stripOf((curU + c) / 2 - 1e-9 * Math.sign(c - curU || 1)) });
          cur = [Pc.slice()];
          curU = c;
        }
        cur.push(Bp.slice());
      }
      runs.push({ pts: cur, s: stripOf((curU + U(cur[cur.length - 1])) / 2) });
      /* mid-run strip fallback for zero-length runs */
      for (const r of runs) {
        if (r.pts.length >= 2) {
          const mid = r.pts[Math.floor(r.pts.length / 2)];
          r.s = stripOf(U(mid) === U(r.pts[0]) && r.pts.length === 2
            ? (U(r.pts[0]) + U(r.pts[1])) / 2 : U(mid));
        }
      }
      return runs;
    };

    /* Sutherland-Hodgman against one half-plane u >= c (side +1) or u <= c (side -1) */
    const clipHalf = (poly, c, side) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], Bp = poly[(i + 1) % poly.length];
        const ua = U(A), ub = U(Bp);
        const ka = side * (ua - c) >= 0, kb = side * (ub - c) >= 0;
        if (ka) out.push(A);
        if (ka !== kb) {
          const t = (c - ua) / (ub - ua);
          out.push([A[0] + (Bp[0] - A[0]) * t, A[1] + (Bp[1] - A[1]) * t]);
        }
      }
      return out;
    };

    src.paths.forEach((path) => {
      if (path.pts.length < 2) return;
      if (path.closed && p.closeCuts) {
        /* clip the polygon to every overlapped strip: closed piece per strip */
        let mn = 1e18, mx = -1e18;
        for (const q of path.pts) { const u = U(q); if (u < mn) mn = u; if (u > mx) mx = u; }
        const k0 = stripOf(mn), k1 = stripOf(mx);
        for (let k = k0; k <= k1; k++) {
          let poly = path.pts.map((q) => q.slice());
          poly = clipHalf(poly, B[k], 1);
          if (poly.length >= 3) poly = clipHalf(poly, B[k + 1], -1);
          if (poly.length >= 3) emit(shifted(poly, k), true, path.layer);
        }
        return;
      }
      const runs = splitRuns(path.pts, path.closed);
      if (runs.length === 1) {
        const pts = runs[0].pts;
        if (path.closed && pts.length > 2) pts.pop(); /* wrap walk repeats the first point */
        emit(shifted(pts, runs[0].s), path.closed, path.layer);
        return;
      }
      /* closed path: first and last run share a strip through the wrap seam */
      if (path.closed && runs[0].s === runs[runs.length - 1].s) {
        const last = runs.pop();
        runs[0] = { pts: [...last.pts.slice(0, -1), ...runs[0].pts], s: runs[0].s };
      }
      for (const r of runs) emit(shifted(r.pts, r.s), false, path.layer);
    });
    return { paths };
  }
};
