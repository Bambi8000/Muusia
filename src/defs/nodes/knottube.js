import { Pin, PENS, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  /* Knot Tube - a closed 3-D knot drawn as a cross-wound tube with exact
     hidden-line removal.

     THE TUBE IS A CANAL SURFACE: the boundary of the union of spheres of
     radius r swept along the spine. That is what makes occlusion exact rather
     than approximate. For an orthographic camera a point is hidden exactly when
     some sphere's near surface lies in front of it, which is one distance in
     screen space and one square root - no z-buffer, no depth sorting, no
     resolution to be wrong at. A 2-D hash over the spine samples keeps it cheap.

     TWO CLAMPS ARE NOT OPTIONAL. The canal surface is only the boundary of the
     union while the radius stays below the local curvature radius AND below
     half the distance at which the spine approaches itself. Past either, the
     tube eats itself: the occlusion test then reports surface points as hidden
     by their own body and the drawing dissolves. Both bounds are measured from
     the actual sampled spine and the radius is clamped to them, so a tight knot
     simply draws a thinner tube instead of falling apart.

     THE WINDING HAS TO CLOSE. A Frenet frame whips through inflection points,
     so the frame is parallel-transported instead; transport around a closed
     loop comes back rotated by a holonomy angle, which is measured and spread
     evenly over the loop. With a periodic frame the helix rejoins itself iff
     the turn count is a whole number, so it is rounded. Skip any of that and
     the seam shows as a visible scar.

     this._build is shared by compute and overlay; the engine calls both as
     methods on this def object. */
  key: "knottube",
  name: "Knot Tube",
  cat: "gen",
  group: "geometric",
  desc: "A closed 3-D knot swept into a tube and drawn as counter-wound helices with real hidden-line removal: the far side of the tube and everything passing behind it is cut away exactly, so the knot reads as solid. Curve picks the spine - a p·q torus knot, the figure-eight knot, a Lissajous knot, or Tangle, a seeded sum of harmonics that is always smooth and always closed, so the Seed shuffles through endless genuine knots. Surface Cross winds a right-handed and a left-handed helix over each other, which is where the diamond moiré comes from; Right and Left helix use one direction only, Rings stacks perpendicular circles, and Longitudinals runs lines along the tube. Turns sets how many times the winding wraps - high values are the dense silk look and cost the most plotting time. Strands adds parallel starts to each helix. Tube radius is clamped automatically: past the local curvature radius, or past half the distance at which the spine approaches itself, a tube would intersect its own body, so a tight knot quietly draws thinner rather than dissolving. Radius variation breathes the thickness along the length. Yaw and Pitch turn the knot - wire Frame into Yaw for a spin - and Size is a true millimetre measurement, shrunk only if it would run off the sheet.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "curve", label: "Curve", type: "select", options: ["Torus knot", "Figure-8 knot", "Lissajous", "Tangle (seeded)"], def: "Torus knot" },
    { key: "kp", label: "p (winds around)", type: "slider", min: 2, max: 9, step: 1, def: 3, showIf: (p) => p.curve === "Torus knot" },
    { key: "kq", label: "q (winds through)", type: "slider", min: 2, max: 9, step: 1, def: 2, showIf: (p) => p.curve === "Torus knot" },
    { key: "nx", label: "Lissajous nx", type: "slider", min: 1, max: 9, step: 1, def: 3, showIf: (p) => p.curve === "Lissajous" },
    { key: "ny", label: "Lissajous ny", type: "slider", min: 1, max: 9, step: 1, def: 2, showIf: (p) => p.curve === "Lissajous" },
    { key: "nz", label: "Lissajous nz", type: "slider", min: 1, max: 9, step: 1, def: 5, showIf: (p) => p.curve === "Lissajous" },
    { key: "harm", label: "Harmonics", type: "slider", min: 2, max: 6, step: 1, def: 4, showIf: (p) => p.curve === "Tangle (seeded)" },
    { key: "size", label: "Size mm", type: "slider", min: 40, max: 280, step: 1, def: 165 },
    { key: "radius", label: "Tube radius mm", type: "slider", min: 1, max: 40, step: 0.5, def: 13 },
    { key: "rmod", label: "Radius variation", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.15 },
    { key: "surface", label: "Surface", type: "select", options: ["Cross", "Right helix", "Left helix", "Cross + rings", "Rings", "Longitudinals"], def: "Cross" },
    { key: "turns", label: "Turns", type: "slider", min: 1, max: 400, step: 1, def: 14, showIf: (p) => p.surface !== "Rings" && p.surface !== "Longitudinals" },
    { key: "strands", label: "Strands", type: "slider", min: 1, max: 64, step: 1, def: 26, showIf: (p) => p.surface !== "Rings" && p.surface !== "Longitudinals" },
    { key: "ringGap", label: "Ring spacing mm", type: "slider", min: 1, max: 20, step: 0.5, def: 4, showIf: (p) => p.surface === "Rings" || p.surface === "Cross + rings" },
    { key: "longs", label: "Longitudinals", type: "slider", min: 3, max: 24, step: 1, def: 10, showIf: (p) => p.surface === "Longitudinals" },
    { key: "hidden", label: "Hidden lines", type: "check", def: true },
    { key: "yaw", label: "Yaw °", type: "slider", min: -180, max: 180, step: 1, def: 25 },
    { key: "pitch", label: "Pitch °", type: "slider", min: -89, max: 89, step: 1, def: 20 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  /* ------------------------------------------------------------------ build
     Spine in view space, in millimetres, with a periodic frame, the clamped
     radius and the fit transform. compute draws from it, overlay guides from
     it, so the two can never disagree. */
  _build(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 5, p.margin));
    const bw = W - 2 * m, bh = H - 2 * m;
    if (!(bw > 8) || !(bh > 8)) return { ok: false };

    /* ---- 1. sample the closed spine in abstract coordinates ---- */
    const N = 1400;
    const TWO = Math.PI * 2;
    const kind = p.curve;
    const seed = Math.round(p.seed) || 1;
    let coef = null;
    if (kind === "Tangle (seeded)") {
      const K = Math.max(2, Math.min(6, Math.round(p.harm) || 2));
      const rng = mulberry32(seed * 7717 + 13);
      coef = [];
      for (let k = 1; k <= K; k++) {
        /* 1/k^2 collapses the curve into a circle - the fundamental drowns
           everything else and no amount of seed shuffling produces a knot.
           1/k keeps the higher modes present enough to actually tangle, and
           the fundamental is held back so it cannot dominate. */
        const amp = (k === 1 ? 0.62 : 1) / k;
        coef.push({
          k,
          ax: amp * (0.4 + rng()), px: rng() * TWO,
          ay: amp * (0.4 + rng()), py: rng() * TWO,
          az: amp * (0.4 + rng()), pz: rng() * TWO,
        });
      }
    }
    const at = (t) => {
      if (kind === "Figure-8 knot") {
        return [(2 + Math.cos(2 * t)) * Math.cos(3 * t), (2 + Math.cos(2 * t)) * Math.sin(3 * t), Math.sin(4 * t)];
      }
      if (kind === "Lissajous") {
        const a = Math.max(1, Math.round(p.nx) || 1), b = Math.max(1, Math.round(p.ny) || 1), c = Math.max(1, Math.round(p.nz) || 1);
        return [Math.cos(a * t + 0.7), Math.cos(b * t + 0.2), Math.cos(c * t + 1.3)];
      }
      if (kind === "Tangle (seeded)") {
        let x = 0, y = 0, z = 0;
        for (const c of coef) {
          x += c.ax * Math.cos(c.k * t + c.px);
          y += c.ay * Math.cos(c.k * t + c.py);
          z += c.az * Math.cos(c.k * t + c.pz);
        }
        return [x, y, z];
      }
      const pp = Math.max(1, Math.round(p.kp) || 2), qq = Math.max(1, Math.round(p.kq) || 2);
      const rad = 2 + Math.cos(qq * t);
      return [rad * Math.cos(pp * t), rad * Math.sin(pp * t), -Math.sin(qq * t)];
    };

    /* ---- 2. rotate into view space (z toward the camera) ---- */
    const rad = Math.PI / 180;
    const cy = Math.cos(p.yaw * rad), sy = Math.sin(p.yaw * rad);
    const cp = Math.cos(p.pitch * rad), sp = Math.sin(p.pitch * rad);
    const toView = (v) => {
      const x = v[0] * cy + v[2] * sy;
      let z = -v[0] * sy + v[2] * cy;
      const y = v[1] * cp - z * sp;
      z = v[1] * sp + z * cp;
      return [x, y, z];
    };

    /* Sample densely in t, then RESAMPLE BY ARC LENGTH. A Fourier or Lissajous
       parametrisation runs at wildly varying speed, and where it crawls the
       samples bunch up and the finite-difference curvature estimate explodes -
       a parametrisation artefact that the radius clamp then obeys, pinching the
       tube to nothing at a bend that is not actually sharp. Uniform arc length
       makes curvature, the transported frame and the occluder spacing all
       well-behaved for the same price. */
    const RAWN = 6000;
    const rawT = new Array(RAWN + 1);
    for (let i = 0; i <= RAWN; i++) rawT[i] = toView(at((i / RAWN) * TWO));
    const rawCum = new Array(RAWN + 1);
    rawCum[0] = 0;
    for (let i = 1; i <= RAWN; i++) {
      const a = rawT[i - 1], b = rawT[i];
      rawCum[i] = rawCum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    const total = rawCum[RAWN];
    if (!(total > 1e-9)) return { ok: false };
    const raw = new Array(N);
    let cursor = 0;
    for (let i = 0; i < N; i++) {
      const want = (i / N) * total;
      while (cursor < RAWN - 1 && rawCum[cursor + 1] < want) cursor++;
      const span = rawCum[cursor + 1] - rawCum[cursor];
      const u = span > 1e-12 ? (want - rawCum[cursor]) / span : 0;
      const a = rawT[cursor], b = rawT[cursor + 1];
      raw[i] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }

    /* ---- 3. scale to millimetres: Size is a real measurement ---- */
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of raw) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    const spanAbs = Math.max(x1 - x0, y1 - y0);
    if (!isFinite(spanAbs) || spanAbs < 1e-9) return { ok: false };
    const rWant = Math.max(0.4, p.radius);
    const target = Math.max(12, Math.max(40, p.size) - 2 * rWant);
    const s0 = target / spanAbs;
    const P = raw.map((q) => [q[0] * s0, q[1] * s0, q[2] * s0]);

    /* ---- 4. arc length ---- */
    const seg = new Array(N);
    let L = 0;
    for (let i = 0; i < N; i++) {
      const a = P[i], b = P[(i + 1) % N];
      seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      L += seg[i];
    }
    if (!(L > 1e-6)) return { ok: false };
    const cum = new Array(N + 1); cum[0] = 0;
    for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + seg[i];

    /* unit tangents, needed by both the envelope correction and the frame */
    const T = new Array(N);
    for (let i = 0; i < N; i++) {
      const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
      const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const l = Math.hypot(tx, ty, tz) || 1;
      T[i] = [tx / l, ty / l, tz / l];
    }

    /* ---- 5. radius: clamped LOCALLY against curvature ----
       A single tight bend must not decide the thickness of the whole tube.
       An earlier version took the maximum curvature over the entire spine and
       clamped globally, which crushed the Lissajous and the tighter tangles to
       a 0.5 mm thread because of one corner. The radius is a FUNCTION of arc
       length instead: thick where the curve is lazy, pinched only where it
       genuinely turns hard - which is also what a real tube does.

       Two conditions keep the canal surface a proper boundary. r < 1/kappa
       locally, or the inner wall folds inside the body and every surface point
       reports as hidden. And |dr/ds| <= 1, or the envelope tears where the
       radius changes faster than the surface can follow; the smoothing pass
       plus the Lipschitz sweeps enforce it with margin.

       Strands passing within a tube diameter of each other are NOT clamped
       against: the tubes fuse, the union of spheres renders that fusion
       correctly, and a fused knot is a picture, not a fault. */
    const kap = new Array(N);
    for (let i = 0; i < N; i++) {
      const a = P[(i - 1 + N) % N], b = P[i], c = P[(i + 1) % N];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const bc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]);
      const ca = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const cx = uy * vz - uz * vy, cyy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const area2 = Math.hypot(cx, cyy, cz);
      kap[i] = (area2 < 1e-12 || ab * bc * ca < 1e-12) ? 0 : (2 * area2) / (ab * bc * ca);
    }
    const rmod = Math.max(0, Math.min(0.8, p.rmod));
    let rr = new Array(N);
    for (let i = 0; i < N; i++) {
      const lim = kap[i] > 1e-9 ? 0.8 / kap[i] : Infinity;
      const f = rmod > 0 ? 1 + rmod * (noise2((cum[i] / L) * 7.3, 3.1, seed) - 0.5) * 2 : 1;
      rr[i] = Math.max(0.02, Math.min(rWant * f, lim));
    }
    /* ORDER MATTERS. Smoothing can RAISE a value, so the curvature clamp has to
       be reapplied after it; the Lipschitz sweeps only ever lower values, so
       they can safely come last and cannot reintroduce a fold. Doing it the
       other way round - clamp, smooth, Lipschitz, clamp - puts a fresh cliff
       back into the radius at exactly the tight bends, which is how the first
       version failed its own Lipschitz test.

       There is also no generous floor here. Flooring the radius at a quarter of
       a millimetre looks harmless and quietly overrides the curvature clamp
       wherever the limit falls below it, which is precisely where a fold does
       the most damage. */
    const limOf = (i) => (kap[i] > 1e-9 ? 0.8 / kap[i] : Infinity);
    for (let pass = 0; pass < 3; pass++) {
      const t2 = new Array(N);
      for (let i = 0; i < N; i++) {
        t2[i] = (rr[(i - 2 + N) % N] + rr[(i - 1 + N) % N] + rr[i] + rr[(i + 1) % N] + rr[(i + 2) % N]) / 5;
      }
      rr = t2;
    }
    for (let i = 0; i < N; i++) rr[i] = Math.max(0.02, Math.min(rr[i], limOf(i)));
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) {
        const j = (i - 1 + N) % N;
        rr[i] = Math.min(rr[i], rr[j] + 0.5 * seg[j]);
      }
      for (let i = N - 1; i >= 0; i--) {
        const j = (i + 1) % N;
        rr[i] = Math.min(rr[i], rr[j] + 0.5 * seg[i]);
      }
    }
    let rMax = 0, rMin = Infinity, rSum = 0;
    for (let i = 0; i < N; i++) {
      if (rr[i] > rMax) rMax = rr[i];
      if (rr[i] < rMin) rMin = rr[i];
      rSum += rr[i];
    }
    const R = rSum / N;
    const clamped = rMin < rWant * (1 - rmod) - 1e-6;

    /* ---- 5b. the canal-surface circle is NOT the naive one ----
       Where the radius changes along the spine, the boundary of the union of
       spheres is not the circle of radius r in the plane perpendicular to T.
       That circle dips inside the neighbouring spheres, the occlusion test
       correctly calls those points hidden, and the surface comes out torn -
       exactly the ragged shreds the tighter knots showed. The true envelope
       circle is pulled back along the tangent by r*r' and shrunk to
       r*sqrt(1 - r'^2). With r' small this is a small correction; where the
       tube pinches hard it is the difference between a surface and confetti. */
    const CC = new Array(N), CR = new Array(N);
    for (let i = 0; i < N; i++) {
      const ip = (i + 1) % N, im = (i - 1 + N) % N;
      const ds = seg[im] + seg[i];
      const rp = ds > 1e-9 ? (rr[ip] - rr[im]) / ds : 0;
      const rpc = Math.max(-0.95, Math.min(0.95, rp));
      CR[i] = Math.max(0.05, rr[i] * Math.sqrt(Math.max(0, 1 - rpc * rpc)));
      CC[i] = [P[i][0] - rr[i] * rpc * T[i][0], P[i][1] - rr[i] * rpc * T[i][1], P[i][2] - rr[i] * rpc * T[i][2]];
    }

    /* ---- 6. parallel transport, made periodic ---- */
    const U = new Array(N), V = new Array(N);
    /* seed the frame with any vector not parallel to T0 */
    let u = Math.abs(T[0][0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    const orth = (v, t) => {
      const d = v[0] * t[0] + v[1] * t[1] + v[2] * t[2];
      const w = [v[0] - d * t[0], v[1] - d * t[1], v[2] - d * t[2]];
      const l = Math.hypot(w[0], w[1], w[2]) || 1;
      return [w[0] / l, w[1] / l, w[2] / l];
    };
    u = orth(u, T[0]);
    for (let i = 0; i < N; i++) {
      if (i > 0) u = orth(u, T[i]);      /* rotation-minimising: project, do not rebuild */
      U[i] = u;
      V[i] = [T[i][1] * u[2] - T[i][2] * u[1], T[i][2] * u[0] - T[i][0] * u[2], T[i][0] * u[1] - T[i][1] * u[0]];
    }
    /* holonomy: transporting once around the loop returns a rotated frame */
    const uEnd = orth(U[N - 1], T[0]);
    const hol = Math.atan2(
      uEnd[0] * V[0][0] + uEnd[1] * V[0][1] + uEnd[2] * V[0][2],
      uEnd[0] * U[0][0] + uEnd[1] * U[0][1] + uEnd[2] * U[0][2]
    );

    /* ---- 8. fit: shrink only, so Size stays a real measurement ---- */
    let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity;
    for (let i = 0; i < N; i++) {
      if (P[i][0] - rr[i] < fx0) fx0 = P[i][0] - rr[i];
      if (P[i][0] + rr[i] > fx1) fx1 = P[i][0] + rr[i];
      if (P[i][1] - rr[i] < fy0) fy0 = P[i][1] - rr[i];
      if (P[i][1] + rr[i] > fy1) fy1 = P[i][1] + rr[i];
    }
    const gw = (fx1 - fx0) || 1, gh = (fy1 - fy0) || 1;
    const sc = Math.min(1, Math.min(bw / gw, bh / gh));
    const ox = m + (bw - gw * sc) / 2 - fx0 * sc;
    const oy = m + (bh - gh * sc) / 2 - fy0 * sc;
    const proj = (x, y) => [x * sc + ox, y * sc + oy];

    /* ---- 9. screen-space hash over the spine, for the occlusion query ---- */
    /* The occluder set is DECIMATED. The spine is sampled far finer than the
       union of spheres needs - neighbouring spheres overlap enormously - and
       every surplus sphere is paid for on every visibility query, which is the
       node's whole running time. One sphere per R/6 of arc keeps the union
       smooth and cuts the query cost several-fold. */
    const cell = Math.max(1e-6, rMax);
    const occStep = Math.max(1, Math.round((N * (R / 6)) / L));
    const occ = [];
    for (let i = 0; i < N; i += occStep) occ.push(i);
    const grid = new Map();
    const key = (a, b) => a + "," + b;
    for (const i of occ) {
      const a = Math.floor(P[i][0] / cell), b = Math.floor(P[i][1] / cell);
      const k = key(a, b);
      let bucket = grid.get(k);
      if (!bucket) { bucket = []; grid.set(k, bucket); }
      bucket.push(i);
    }
    const reach = Math.ceil(rMax / cell) + 1;
    /* a point is hidden when some sphere's NEAR surface is in front of it */
    const occluded = (x, y, z, eps) => {
      const a0 = Math.floor(x / cell), b0 = Math.floor(y / cell);
      for (let b = b0 - reach; b <= b0 + reach; b++) {
        for (let a = a0 - reach; a <= a0 + reach; a++) {
          const bucket = grid.get(key(a, b));
          if (!bucket) continue;
          for (const i of bucket) {
            const dx = x - P[i][0], dy = y - P[i][1];
            const d2 = dx * dx + dy * dy;
            const ri = rr[i];
            if (d2 >= ri * ri) continue;
            if (P[i][2] + Math.sqrt(ri * ri - d2) > z + eps) return true;
          }
        }
      }
      return false;
    };

    return { ok: true, N, P, T, U, V, rr, CC, CR, R, rMax, clamped, hol, cum, L, m, bw, bh, sc, ox, oy, proj, occluded, rWant };
  },

  compute(ins, p, ctx) {
    const B = this._build(p, ctx);
    if (!B || !B.ok) return applyStyle({ paths: [] }, ins[0]);
    const { N, P, U, V, T, rr, CC, CR, hol, cum, L, proj, occluded, rMax } = B;
    const LAY = Math.max(0, Math.min(PENS.length - 1, Math.round(p.layer)));
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const doHide = p.hidden !== false;
    const EPS = rMax * 0.02;

    /* surface point at spine index i (fractional) and winding phase phi */
    const surf = (fi, phi) => {
      const i0 = Math.floor(fi) % N, i1 = (i0 + 1) % N;
      const t = fi - Math.floor(fi);
      const ux = U[i0][0] + (U[i1][0] - U[i0][0]) * t, uy = U[i0][1] + (U[i1][1] - U[i0][1]) * t, uz = U[i0][2] + (U[i1][2] - U[i0][2]) * t;
      const vx = V[i0][0] + (V[i1][0] - V[i0][0]) * t, vy = V[i0][1] + (V[i1][1] - V[i0][1]) * t, vz = V[i0][2] + (V[i1][2] - V[i0][2]) * t;
      const px = CC[i0][0] + (CC[i1][0] - CC[i0][0]) * t, py = CC[i0][1] + (CC[i1][1] - CC[i0][1]) * t, pz = CC[i0][2] + (CC[i1][2] - CC[i0][2]) * t;
      const r = CR[i0] + (CR[i1] - CR[i0]) * t;
      const c = Math.cos(phi), s = Math.sin(phi);
      return [px + r * (c * ux + s * vx), py + r * (c * uy + s * vy), pz + r * (c * uz + s * vz)];
    };

    /* clip a 3-D polyline to its visible runs, cutting by bisection */
    const emit = (pts, closed) => {
      if (used >= BUDGET || pts.length < 2) return;
      if (!doHide) {
        const out = pts.map((q) => proj(q[0], q[1]));
        used += out.length;
        paths.push({ pts: out, closed: !!closed, layer: LAY });
        return;
      }
      const seq = closed ? pts.concat([pts[0]]) : pts;
      const vis = seq.map((q) => !occluded(q[0], q[1], q[2], EPS));
      if (vis.every(Boolean)) {
        const out = pts.map((q) => proj(q[0], q[1]));
        used += out.length;
        paths.push({ pts: out, closed: !!closed, layer: LAY });
        return;
      }
      const cut = (a, b) => {
        let lo = 0, hi = 1;
        for (let it = 0; it < 7; it++) {
          const mid = (lo + hi) / 2;
          const q = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid, a[2] + (b[2] - a[2]) * mid];
          if (!occluded(q[0], q[1], q[2], EPS)) lo = mid; else hi = mid;
        }
        const t = (lo + hi) / 2;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      };
      const runs = [];
      let run = null;
      for (let i = 0; i < seq.length; i++) {
        if (vis[i]) {
          if (!run) { run = []; if (i > 0) run.push(cut(seq[i], seq[i - 1])); }
          run.push(seq[i]);
        } else if (run) { run.push(cut(seq[i - 1], seq[i])); runs.push(run); run = null; }
      }
      if (run) runs.push(run);
      if (closed && runs.length > 1 && vis[0] && vis[seq.length - 1]) {
        const first = runs.shift();
        runs[runs.length - 1] = runs[runs.length - 1].concat(first.slice(1));
      }
      for (const r of runs) {
        if (r.length < 2 || used >= BUDGET) continue;
        const out = r.map((q) => proj(q[0], q[1]));
        used += out.length;
        paths.push({ pts: out, closed: false, layer: LAY });
      }
    };

    const mode = p.surface;
    const wantHelix = mode === "Cross" || mode === "Right helix" || mode === "Left helix" || mode === "Cross + rings";
    const wantRings = mode === "Rings" || mode === "Cross + rings";
    const wantLongs = mode === "Longitudinals";

    if (wantHelix) {
      /* Turns must be a whole number or the helix cannot rejoin itself once
         the frame has been made periodic. */
      let turns = Math.max(1, Math.round(p.turns) || 1);
      let strands = Math.max(1, Math.min(64, Math.round(p.strands) || 1));
      const dirs = mode === "Cross" || mode === "Cross + rings" ? [1, -1] : mode === "Left helix" ? [-1] : [1];
      /* samples per turn, coarsened rather than hung */
      let sPer = 22;
      const est = () => turns * sPer * strands * dirs.length;
      while (est() > BUDGET * 0.75 && sPer > 8) sPer = Math.max(8, Math.round(sPer * 0.75));
      while (est() > BUDGET * 0.75 && strands > 2) strands = Math.max(2, Math.round(strands * 0.8));
      while (est() > BUDGET * 0.75 && turns > 2) turns = Math.max(2, Math.round(turns * 0.8));
      const steps = Math.max(64, turns * sPer);
      for (const d of dirs) {
        for (let s = 0; s < strands && used < BUDGET; s++) {
          const phi0 = (s / strands) * Math.PI * 2;
          const pts = [];
          for (let k = 0; k < steps; k++) {
            const f = k / steps;
            /* the holonomy correction is what closes the seam */
            const phi = phi0 + d * f * Math.PI * 2 * turns - hol * f;
            pts.push(surf(f * N, phi));
          }
          emit(pts, true);
        }
      }
    }

    if (wantRings) {
      const gap = Math.max(0.6, p.ringGap);
      const nR = Math.max(2, Math.min(600, Math.round(L / gap)));
      const seg = 26;
      for (let k = 0; k < nR && used < BUDGET; k++) {
        const targetS = (k / nR) * L;
        /* find the sample at that arc length */
        let lo = 0, hi = N;
        while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= targetS) lo = mid; else hi = mid; }
        const fi = lo + (cum[lo + 1] - cum[lo] > 0 ? (targetS - cum[lo]) / (cum[lo + 1] - cum[lo]) : 0);
        const pts = [];
        for (let j = 0; j < seg; j++) pts.push(surf(fi, (j / seg) * Math.PI * 2));
        emit(pts, true);
      }
    }

    if (wantLongs) {
      const nL = Math.max(2, Math.min(24, Math.round(p.longs) || 3));
      const steps = Math.max(240, Math.min(2400, Math.round(L / 0.8)));
      for (let j = 0; j < nL && used < BUDGET; j++) {
        const phi0 = (j / nL) * Math.PI * 2;
        const pts = [];
        for (let k = 0; k < steps; k++) {
          const f = k / steps;
          pts.push(surf(f * N, phi0 - hol * f));
        }
        emit(pts, true);
      }
    }

    return applyStyle({ paths }, ins[0]);
  },

  overlay(p, ctx) {
    try {
      const B = this && this._build ? this._build(p, ctx) : null;
      if (!B || !B.ok) return [];
      const g = [{ kind: "rect", x: B.m, y: B.m, w: B.bw, h: B.bh }];
      const step = Math.max(1, Math.round(B.N / 180));
      const pts = [];
      for (let i = 0; i < B.N; i += step) pts.push(B.proj(B.P[i][0], B.P[i][1]));
      if (pts.length > 2) { pts.push(pts[0]); g.push({ kind: "poly", pts }); }
      return g;
    } catch (e) { return []; }
  },
};
