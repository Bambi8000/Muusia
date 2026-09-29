import { Pin, mulberry32, noise2, resample } from "../helpers.js";

export default {
  /* Stripe Discs — op-art rotated-disc displacement: a field of lines (the
     built-in stripes, or anything wired into Field) is cut by circular discs;
     inside every disc the field is rotated about the disc centre by its own
     angle, outside it is left alone, and the two meet exactly on the rim.
     Discs sit on a grid or are scattered without overlap; their angles follow
     a modulation (progressive, by row / column, alternating, random, noise).
     Clipping is exact: runs are cut at the true segment/circle intersection,
     then collinear points are dropped so straight stripes stay 2-point lines. */
  key: "stripediscs",
  name: "Stripe Discs",
  cat: "mod",
  group: "deform",
  desc: "Op-art rotated discs after Bridget Riley: a field of stripes is cut by circles, and inside each circle the field is rotated about the circle's centre while outside it runs on untouched, so the stripes appear to twist through round lenses. With nothing wired the node draws its own stripes (Stripe spacing, Stripe angle); wire any lines into Field to twist those instead. Layout Grid places Columns x Rows discs (Jitter nudges them), Random scatters Count discs without overlap (Radius variation shrinks some). Rotation sets how the disc angles vary: Progressive steps by Angle step disc by disc, Rows and Columns step per row or column, Alternate flips +/- step, Random and Noise are seeded; Angle is the base - wire Frame into it to spin every disc. Gap parts the rotated content from the rim, Rim draws the circle itself, and Disc pen recolours the twisted content. Overlay shows the discs.",
  ins: [Pin("paths", "Field (optional)")],
  outs: [Pin("paths")],
  params: [
    { key: "spacing", label: "Stripe spacing mm", type: "slider", min: 0.8, max: 12, step: 0.1, def: 2.6 },
    { key: "stripeAngle", label: "Stripe angle deg", type: "slider", min: 0, max: 180, step: 1, def: 90 },
    { key: "layout", label: "Layout", type: "select", options: ["Grid", "Random"], def: "Grid" },
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 10, step: 1, def: 3, showIf: (p) => p.layout === "Grid" },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 10, step: 1, def: 3, showIf: (p) => p.layout === "Grid" },
    { key: "jitter", label: "Jitter (x cell)", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.08, showIf: (p) => p.layout === "Grid" },
    { key: "count", label: "Count", type: "slider", min: 1, max: 40, step: 1, def: 9, showIf: (p) => p.layout === "Random" },
    { key: "radius", label: "Radius mm", type: "slider", min: 3, max: 120, step: 0.5, def: 24 },
    { key: "radVar", label: "Radius variation", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.3, showIf: (p) => p.layout === "Random" },
    { key: "mode", label: "Rotation", type: "select", options: ["Progressive", "Rows", "Columns", "Alternate", "Random", "Noise"], def: "Rows" },
    { key: "angle", label: "Angle deg (wire Frame)", type: "slider", min: -360, max: 360, step: 1, def: 90 },
    { key: "stepA", label: "Angle step deg", type: "slider", min: -180, max: 180, step: 1, def: -50, showIf: (p) => p.mode !== "Random" && p.mode !== "Noise" },
    { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 6, step: 0.1, def: 0 },
    { key: "rim", label: "Rim", type: "check", def: false },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "layer", label: "Stripe pen", type: "pen", def: 0 },
    { key: "penMode", label: "Disc pen", type: "select", options: ["Same as field", "Disc pen"], def: "Same as field" },
    { key: "penDisc", label: "Disc pen", type: "pen", def: 2, showIf: (p) => p.penMode === "Disc pen" },
  ],

  /* shared disc placement: [cx, cy, r, angleRad] per disc — same code feeds compute and overlay */
  _discs(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const m = Math.max(0, Math.min(cl(p.margin, 0, 1e4), Math.min(W, H) / 2 - 1));
    const R = cl(p.radius, 0.5, 1e4);
    const seed = (Math.round(+p.seed) || 1) >>> 0;
    const rng = mulberry32(seed * 4241 + 7);
    const out = [];
    let cols = 1, rows = 1;
    if (p.layout === "Random") {
      const n = Math.max(1, Math.min(200, Math.round(+p.count || 1)));
      const rv = cl(p.radVar, 0, 0.95);
      for (let i = 0; i < n; i++) {
        const r = Math.max(0.5, R * (1 - rv * rng()));
        let ok = false;
        for (let t = 0; t < 60 && !ok; t++) {
          const cx = m + r + rng() * Math.max(0, W - 2 * m - 2 * r), cy = m + r + rng() * Math.max(0, H - 2 * m - 2 * r);
          if (r > (W - 2 * m) / 2 || r > (H - 2 * m) / 2) break;
          ok = out.every((d) => Math.hypot(d[0] - cx, d[1] - cy) >= d[2] + r + 1);
          if (ok) out.push([cx, cy, r, 0, i, 0]);
        }
      }
    } else {
      cols = Math.max(1, Math.min(40, Math.round(+p.cols || 1))); rows = Math.max(1, Math.min(40, Math.round(+p.rows || 1)));
      const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
      const r = Math.min(R, 0.48 * Math.min(cw, ch));
      const j = cl(p.jitter, 0, 0.5);
      for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
        const jx = (rng() * 2 - 1) * j * (cw / 2 - r), jy = (rng() * 2 - 1) * j * (ch / 2 - r);
        out.push([m + cw * (cx + 0.5) + jx, m + ch * (ry + 0.5) + jy, r, 0, cx, ry]);
      }
    }
    /* angles */
    const base = (+p.angle || 0) * Math.PI / 180, st = (+p.stepA || 0) * Math.PI / 180;
    const arng = mulberry32(seed * 911 + 3);
    out.forEach((d, i) => {
      let a = base;
      if (p.mode === "Progressive") a += st * i;
      else if (p.mode === "Rows") a += st * (p.layout === "Random" ? Math.floor(((d[1] - m) / Math.max(1e-6, H - 2 * m)) * 3) : d[5]);
      else if (p.mode === "Columns") a += st * (p.layout === "Random" ? Math.floor(((d[0] - m) / Math.max(1e-6, W - 2 * m)) * 3) : d[4]);
      else if (p.mode === "Alternate") a += st * ((p.layout === "Random" ? i : d[4] + d[5]) % 2 ? -0.5 : 0.5);
      else if (p.mode === "Random") a += (arng() - 0.5) * Math.PI;
      else if (p.mode === "Noise") a += (noise2(d[0] * 0.02, d[1] * 0.02, seed + 5) - 0.5) * Math.PI * 1.6;
      d[3] = a;
    });
    return out.map((d) => [d[0], d[1], d[2], d[3]]);
  },

  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const m = Math.max(0, Math.min(+(p && p.margin) || 0, Math.min(W, H) / 2 - 1));
      const g = [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }];
      const discs = this && typeof this._discs === "function" ? this._discs(p, ctx) : [];
      for (const d of discs.slice(0, 400)) g.push({ kind: "circle", cx: d[0], cy: d[1], r: d[2] });
      return g;
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const m = Math.max(0, Math.min(cl(p.margin, 0, 1e4), Math.min(W, H) / 2 - 1));
    const pen = Math.max(0, Math.min(11, Math.round(+p.layer || 0)));
    const penD = Math.max(0, Math.min(11, Math.round(+p.penDisc || 0)));
    const recolor = p.penMode === "Disc pen";
    const gap = cl(p.gap, 0, 100);
    const discs = this._discs(p, ctx);
    const STEP = 0.5;

    /* ---- the field: wired paths, or built-in stripes across the margin box ---- */
    let field;
    const src = ins && ins[0] && Array.isArray(ins[0].paths) ? ins[0] : null;
    if (src && src.paths.length) {
      field = src.paths.filter((q) => q && q.pts && q.pts.length >= 2).map((q) => ({ pts: resample(q.pts, !!q.closed, STEP), layer: q.layer, closed: !!q.closed }));
    } else {
      field = [];
      const sp = cl(p.spacing, 0.3, 200);
      const a = (+p.stripeAngle || 0) * Math.PI / 180;
      const dx = Math.cos(a), dy = Math.sin(a);           /* stripe direction */
      const nx = -dy, ny = dx;                             /* across stripes */
      const cx = W / 2, cy = H / 2;
      const bw = W - 2 * m, bh = H - 2 * m;
      const Rr = Math.hypot(bw, bh) / 2 + sp;
      let flip = false;
      for (let d = -Rr; d <= Rr; d += sp) {
        const ox = cx + nx * d, oy = cy + ny * d;
        /* clip the infinite stripe to the margin box */
        let t0 = -Infinity, t1 = Infinity;
        for (const [o, dir, lo, hi] of [[ox, dx, m, W - m], [oy, dy, m, H - m]]) {
          if (Math.abs(dir) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; } continue; }
          const ta = (lo - o) / dir, tb = (hi - o) / dir;
          t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
        }
        if (t1 - t0 < 0.5) continue;
        const A = [ox + dx * t0, oy + dy * t0], B = [ox + dx * t1, oy + dy * t1];
        field.push({ pts: resample(flip ? [B, A] : [A, B], false, STEP), layer: pen, closed: false });
        flip = !flip;
      }
    }

    /* ---- clipping helpers ---- */
    const paths = [];
    let budget = 115000;
    /* drop points that sit on the straight line between their neighbours */
    const simplify = (pts) => {
      if (pts.length <= 2) return pts;
      const out = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
        const ux = c[0] - a[0], uy = c[1] - a[1], L = Math.hypot(ux, uy) || 1;
        const dev = Math.abs((b[0] - a[0]) * uy - (b[1] - a[1]) * ux) / L;
        if (dev > 0.02) out.push(b);
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    const emit = (pts, layer) => {
      const s = simplify(pts);
      if (s.length < 2 || budget <= 0) return;
      budget -= s.length;
      paths.push({ pts: s, closed: false, layer });
    };
    /* first crossing parameter t in (0,1) of segment a->b with circle (c, r); null if none */
    const cross = (a, b, c, r) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - c[0], fy = a[1] - c[1];
      const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
      const disc = B * B - 4 * A * C;
      if (A < 1e-12 || disc < 0) return null;
      const s = Math.sqrt(disc);
      const t1 = (-B - s) / (2 * A), t2 = (-B + s) / (2 * A);
      if (t1 > 1e-9 && t1 < 1 - 1e-9) return t1;
      if (t2 > 1e-9 && t2 < 1 - 1e-9) return t2;
      return null;
    };
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    /* which disc (index) contains point q at radius scale rs, or -1 */
    let near = discs;   /* discs whose bbox meets the current polyline (set per polyline) */
    const inDisc = (q, rOff) => {
      for (let i = 0; i < near.length; i++) { const d = near[i]; if (Math.hypot(q[0] - d[0], q[1] - d[1]) < d[2] + rOff) return d[4]; }
      return -1;
    };
    discs.forEach((d, i) => { d[4] = i; });
    const bboxOf = (pts) => { let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity; for (const pt of pts) { if (pt[0] < bx0) bx0 = pt[0]; if (pt[0] > bx1) bx1 = pt[0]; if (pt[1] < by0) by0 = pt[1]; if (pt[1] > by1) by1 = pt[1]; } return [bx0, by0, bx1, by1]; };
    for (const q of field) q.bb = bboxOf(q.pts);
    /* walk a polyline, cutting it into runs by a predicate with exact circle crossings */
    const runs = (pts, closed, keep, circleOf, rOff) => {
      const P = closed ? [...pts, pts[0]] : pts;
      const out = [];
      let cur = [];
      let prevIn = keep(P[0]);
      if (prevIn) cur.push(P[0]);
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i];
        const nowIn = keep(b);
        if (nowIn === prevIn) { if (nowIn) cur.push(b); continue; }
        /* boundary crossed: find the circle involved and the exact point */
        const ci = circleOf(a, b);
        let x = null;
        if (ci >= 0) { const d = discs[ci]; const t = cross(a, b, d, d[2] + rOff); if (t !== null) x = lerp(a, b, t); }
        if (!x) x = lerp(a, b, 0.5);
        if (prevIn) { cur.push(x); if (cur.length >= 2) out.push(cur); cur = []; }
        else { cur = [x, b]; }
        prevIn = nowIn;
      }
      if (cur.length >= 2) out.push(cur);
      return out;
    };

    /* ---- outside the discs: field runs where no disc (grown by gap) contains the point ---- */
    for (const q of field) {
      near = discs.filter((d) => !(q.bb[2] < d[0] - d[2] - gap || q.bb[0] > d[0] + d[2] + gap || q.bb[3] < d[1] - d[2] - gap || q.bb[1] > d[1] + d[2] + gap));
      if (!near.length) { emit(q.closed ? [...q.pts, q.pts[0]] : q.pts, q.layer); if (budget <= 0) break; continue; }
      const outside = (pt) => inDisc(pt, gap) < 0;
      const circleOf = (a, b) => { const ia = inDisc(a, gap), ib = inDisc(b, gap); return ia >= 0 ? ia : ib; };
      for (const r of runs(q.pts, q.closed, outside, circleOf, gap)) emit(r, q.layer);
      if (budget <= 0) break;
    }
    /* ---- inside each disc: clip the field to the disc (shrunk by gap), rotate about its centre ---- */
    for (let di = 0; di < discs.length && budget > 0; di++) {
      const d = discs[di], ri = d[2] - gap;
      if (ri <= 0.2) continue;
      const ca = Math.cos(d[3]), sa = Math.sin(d[3]);
      const inside = (pt) => Math.hypot(pt[0] - d[0], pt[1] - d[1]) < ri;
      for (const q of field) {
        if (q.bb[2] < d[0] - ri || q.bb[0] > d[0] + ri || q.bb[3] < d[1] - ri || q.bb[1] > d[1] + ri) continue;
        for (const r of runs(q.pts, q.closed, inside, () => di, -gap)) {
          emit(r.map(([x, y]) => { const px = x - d[0], py = y - d[1]; return [d[0] + px * ca - py * sa, d[1] + px * sa + py * ca]; }), recolor ? penD : q.layer);
        }
      }
    }
    /* ---- rims ---- */
    if (p.rim) for (const d of discs) {
      const n = Math.max(24, Math.min(160, Math.round(d[2] * 2.2)));
      const ring = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ring.push([d[0] + Math.cos(a) * d[2], d[1] + Math.sin(a) * d[2]]); }
      if (budget > 0) { budget -= n; paths.push({ pts: ring, closed: true, layer: recolor ? penD : pen }); }
    }
    return { paths };
  },
};
