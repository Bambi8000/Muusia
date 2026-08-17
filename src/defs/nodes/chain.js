import { Pin, PENS, resample, applyStyle } from "../helpers.js";

export default {
  /* Chain - interlocking flat bands with exact planar hidden-line removal.

     WHY FLAT BANDS. Each link is a closed ribbon lying in ONE plane, not a
     round tube. That single fact is what makes the occlusion exact and cheap:
     for an orthographic camera the depth of a plane is a closed-form solve at
     any screen point, so "is this pen point behind link j" is one dot product
     and a 2-D point-in-band test. Over/under at every crossing then falls out
     of the geometry - there is no weaving bookkeeping anywhere in this node,
     and a chain can never be drawn inconsistently.

     THE ONE REAL CONSTRAINT. The band is built by offsetting the centerline
     along its own normal, so the INNER offset folds over itself wherever the
     centerline curves tighter than the band half-width. On a polygon link that
     happens at every corner. Corner rounding is therefore not decoration: the
     rounding radius is clamped to stay above the half-width, and the
     half-width is clamped below the inradius. The validator proves the inner
     edge stays simple with a segment-intersection oracle.

     this._build is shared by compute and overlay so the guides cannot drift
     from the drawing; the engine calls both as methods on this def object. */
  key: "chain",
  name: "Chain",
  cat: "gen",
  group: "geometric",
  desc: "Interlocking chain links drawn as flat hatched bands with real hidden-line removal. Each link is a closed ribbon in its own plane, so where two links cross the one behind is cut away exactly - the over/under weave is a consequence of the geometry, never a decoration. Element picks the link outline: Circle, Triangle, Square or Hexagon, with Corner round softening the polygons (rounding is also what keeps the inner edge of a wide band from folding over itself at the corners, so it is clamped, not free). Layout runs the chain along a straight line, closes it into a ring, or follows any paths wired into the Spine input. Alternate tilt is the character control: 90 degrees gives a real chain with every second link edge-on, low values lay all the links nearly face-on so they read as overlapping ellipses. Link spin turns each element inside its own plane and Spin / link adds to that per link, so square links can alternate square-diamond-square or a hexagon chain can twist gradually along its length - a circle is rotationally symmetric so spin only shifts its hatch phase, but on the polygons it reshapes the whole silhouette. Offset slides every second link sideways within its plane, staggering the chain into a zigzag; the sign alternates because a constant offset would only translate the whole drawing and disappear in the centring. Hatch fills the band - Chevron sends a V across it (Lean sets how far the apex leans along the band), Chevron alternating flips every rung into a herringbone, plus plain Rungs, Diagonal and Cross. Overlap sets how deeply consecutive links pass through each other, Yaw and Pitch turn the whole chain in space and Rotate spins the finished drawing on the sheet. Hatch spacing drives plotting time more than any other parameter.",
  ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "shape", label: "Element", type: "select", options: ["Circle", "Triangle", "Square", "Hexagon"], def: "Circle" },
    { key: "links", label: "Links", type: "slider", min: 1, max: 24, step: 1, def: 5 },
    { key: "size", label: "Link size mm", type: "slider", min: 10, max: 140, step: 1, def: 40 },
    { key: "band", label: "Band width %", type: "slider", min: 4, max: 60, step: 1, def: 26 },
    { key: "round", label: "Corner round %", type: "slider", min: 0, max: 100, step: 5, def: 55, showIf: (p) => p.shape !== "Circle" },
    { key: "layout", label: "Layout", type: "select", options: ["Line", "Ring", "Wired spine"], def: "Line", showIf: (p) => Math.round(p.links) > 1 },
    { key: "overlap", label: "Overlap %", type: "slider", min: 0, max: 70, step: 1, def: 42, showIf: (p) => Math.round(p.links) > 1 },
    { key: "tilt", label: "Alternate tilt °", type: "slider", min: 0, max: 90, step: 1, def: 40, showIf: (p) => Math.round(p.links) > 1 },
    { key: "spin", label: "Link spin °", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "spinStep", label: "Spin / link °", type: "slider", min: -180, max: 180, step: 1, def: 0, showIf: (p) => Math.round(p.links) > 1 },
    { key: "off", label: "Offset mm (alternating)", type: "slider", min: -40, max: 40, step: 0.5, def: 0, showIf: (p) => Math.round(p.links) > 1 },
    { key: "hatch", label: "Hatch", type: "select", options: ["Chevron", "Chevron alternating", "Rungs", "Diagonal", "Cross", "None"], def: "Chevron" },
    { key: "gap", label: "Hatch spacing mm", type: "slider", min: 0.4, max: 8, step: 0.1, def: 1.2 },
    { key: "lean", label: "Lean mm", type: "slider", min: -12, max: 12, step: 0.25, def: 3.5, showIf: (p) => p.hatch === "Chevron" || p.hatch === "Chevron alternating" || p.hatch === "Diagonal" || p.hatch === "Cross" },
    { key: "edges", label: "Draw band edges", type: "check", def: true },
    { key: "hidden", label: "Hidden lines", type: "check", def: true, showIf: (p) => Math.round(p.links) > 1 },
    { key: "yaw", label: "Yaw °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "pitch", label: "Pitch °", type: "slider", min: -89, max: 89, step: 1, def: 18 },
    { key: "rot", label: "Rotate °", type: "slider", min: -180, max: 180, step: 1, def: 90 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 14 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  /* ---------------------------------------------------------------- build
     Everything geometric that compute and overlay must agree on. Returns
     view-space link frames, the unit centerline, an occlusion grid and the
     fit transform. Never throws: a degenerate setup returns ok:false. */
  _build(p, ctx, ins) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 5, p.margin));
    const bw = W - 2 * m, bh = H - 2 * m;
    if (!(bw > 8) || !(bh > 8)) return { ok: false };

    const nLinks = Math.max(1, Math.min(24, Math.round(p.links) || 1));
    const R = Math.max(1, p.size) / 2;

    /* --- unit centerline: circle or rounded regular polygon, circumradius 1 --- */
    const shape = p.shape;
    const k = shape === "Triangle" ? 3 : shape === "Square" ? 4 : shape === "Hexagon" ? 6 : 0;
    const rIn = k ? Math.cos(Math.PI / k) : 1;              /* inradius */
    let hU = Math.max(0.01, Math.min(60, p.band) / 100);    /* band half-width, unit */
    /* corner radius: user value, but never below the half-width or the inner
       offset folds over itself at every corner */
    let cr = k ? (Math.max(0, Math.min(100, p.round)) / 100) * rIn : Infinity;
    if (k) {
      hU = Math.min(hU, rIn * 0.82);
      cr = Math.max(cr, hU * 1.25);
      cr = Math.min(cr, rIn);
      hU = Math.min(hU, cr * 0.8);
    } else {
      hU = Math.min(hU, 0.85);
    }

    const clRaw = [];
    if (!k) {
      const N = 512;   /* dense on purpose: see the faceting note below */
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; clRaw.push([Math.cos(a), Math.sin(a)]); }
    } else {
      const t = cr * Math.tan(Math.PI / k);                 /* along-edge setback */
      const d = cr / Math.cos(Math.PI / k);                 /* vertex -> arc center */
      const half = Math.PI / k;
      for (let i = 0; i < k; i++) {
        const a = -Math.PI / 2 + (i / k) * Math.PI * 2;     /* flat-ish bottom */
        const vx = Math.cos(a), vy = Math.sin(a);
        const an = -Math.PI / 2 + ((i + 1) / k) * Math.PI * 2;
        const nx = Math.cos(an), ny = Math.sin(an);
        const ex = nx - vx, ey = ny - vy;
        const eL = Math.hypot(ex, ey) || 1;
        const ux = ex / eL, uy = ey / eL;
        /* rounded corner: the arc center sits on the vertex bisector, cr/cos(pi/k)
           INWARD from the vertex - i.e. at radius (1 - d) from the origin. At
           maximum rounding d reaches 1, the center lands on the origin and the
           polygon degenerates into a circle of radius rIn, which is correct. */
        const cx = vx * (1 - d), cy = vy * (1 - d);
        const a0 = a - half, a1 = a + half;
        /* Arc density is a correctness matter, not a smoothness one. Offsetting
           inward compresses the corner arcs by (cr - hU) / cr, so a coarse arc's
           faceting error gets amplified until it rivals the spacing between
           offset points and the inner edge starts stepping backwards. One raw
           sample per 0.01 unit of arc keeps that error three orders down. */
        const steps = Math.max(6, Math.ceil((cr * (2 * Math.PI / k)) / 0.01));
        for (let s = 0; s <= steps; s++) {
          const aa = a0 + (a1 - a0) * (s / steps);
          clRaw.push([cx + cr * Math.cos(aa), cy + cr * Math.sin(aa)]);
        }
        /* straight run to the next corner's start */
        const sx = vx + ux * t, sy = vy + uy * t;
        const gx = nx - ux * t, gy = ny - uy * t;
        const segL = Math.hypot(gx - sx, gy - sy);
        const segN = Math.max(1, Math.round(segL / 0.01));
        for (let s = 1; s < segN; s++) clRaw.push([sx + (gx - sx) * (s / segN), sy + (gy - sy) * (s / segN)]);
      }
    }
    /* Even out the raw construction. The corner arcs and the straight runs meet
       at shared points, and at maximum rounding the straight runs collapse to
       zero length: that leaves coincident vertices whose neighbour-difference
       normals disagree, and the inner offset then steps BACKWARDS by a hair at
       every corner - a hairline reversal that reads as a self-intersection and
       would plot as a whisker. Resampling by arc length removes the duplicates
       and gives every normal the same quality. */
    let cl = resample(clRaw, true, 0.02);
    while (cl.length > 8 && Math.hypot(cl[cl.length - 1][0] - cl[0][0], cl[cl.length - 1][1] - cl[0][1]) < 0.012) cl.pop();
    const NC = cl.length;
    if (NC < 8) return { ok: false };

    /* outward normals from the closed centerline */
    const nrm = new Array(NC);
    for (let i = 0; i < NC; i++) {
      const a = cl[(i - 1 + NC) % NC], b = cl[(i + 1) % NC];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      let nx = ty, ny = -tx;
      if (nx * cl[i][0] + ny * cl[i][1] < 0) { nx = -nx; ny = -ny; }
      nrm[i] = [nx, ny];
    }
    /* cumulative arc length, for even hatch spacing */
    const cum = new Array(NC + 1); cum[0] = 0;
    for (let i = 0; i < NC; i++) {
      const a = cl[i], b = cl[(i + 1) % NC];
      cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const per = cum[NC];

    /* occlusion grid over unit space: boolean "within hU of the centerline" */
    const cell = Math.max(0.03, hU);
    const G = Math.ceil(2.6 / cell) + 1;
    const grid = new Array(G * G);
    const gi = (u, v) => {
      const a = Math.floor((u + 1.3) / cell), b = Math.floor((v + 1.3) / cell);
      return a < 0 || b < 0 || a >= G || b >= G ? -1 : b * G + a;
    };
    for (let i = 0; i < NC; i++) {
      const a = cl[i], b = cl[(i + 1) % NC];
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
      const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      for (let u = x0; u <= x1 + cell; u += cell) {
        for (let v = y0; v <= y1 + cell; v += cell) {
          const id = gi(u, v);
          if (id >= 0) { if (!grid[id]) grid[id] = []; if (grid[id].indexOf(i) < 0) grid[id].push(i); }
        }
      }
    }
    const nearCenterline = (u, v) => {
      if (Math.abs(u) > 1.3 || Math.abs(v) > 1.3) return false;
      const a0 = Math.floor((u + 1.3) / cell), b0 = Math.floor((v + 1.3) / cell);
      const rad = 2;
      const h2 = hU * hU;
      for (let b = b0 - rad; b <= b0 + rad; b++) {
        if (b < 0 || b >= G) continue;
        for (let a = a0 - rad; a <= a0 + rad; a++) {
          if (a < 0 || a >= G) continue;
          const bucket = grid[b * G + a];
          if (!bucket) continue;
          for (const si of bucket) {
            const s = cl[si], e = cl[(si + 1) % NC];
            const dx = e[0] - s[0], dy = e[1] - s[1];
            const L2 = dx * dx + dy * dy;
            let t = L2 > 0 ? ((u - s[0]) * dx + (v - s[1]) * dy) / L2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = u - (s[0] + dx * t), qy = v - (s[1] + dy * t);
            if (qx * qx + qy * qy <= h2) return true;
          }
        }
      }
      return false;
    };

    /* --- spine: world-space centers + a transported frame (T, A, B) --- */
    const pitch = 2 * R * Math.max(0.12, 1 - Math.max(0, Math.min(70, p.overlap)) / 100);
    const spine = [];
    const src = (ins && ins[0] && ins[0].paths) ? ins[0].paths : null;
    let wired = null;
    if (p.layout === "Wired spine" && src && src.length) {
      let best = null, bl = -1;
      for (const q of src) {
        if (!q || !q.pts || q.pts.length < 2) continue;
        let L = 0;
        for (let i = 1; i < q.pts.length; i++) L += Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1]);
        if (L > bl) { bl = L; best = q; }
      }
      if (best) wired = resample(best.pts, !!best.closed, Math.max(0.5, pitch));
    }
    if (wired && wired.length >= 2) {
      const cx = wired.reduce((s, q) => s + q[0], 0) / wired.length;
      const cy = wired.reduce((s, q) => s + q[1], 0) / wired.length;
      for (let i = 0; i < Math.min(nLinks, wired.length); i++) spine.push([wired[i][0] - cx, -(wired[i][1] - cy), 0]);
    } else if (p.layout === "Ring") {
      const Rs = (nLinks * pitch) / (Math.PI * 2);
      for (let i = 0; i < nLinks; i++) {
        const a = (i / nLinks) * Math.PI * 2;
        spine.push([Rs * Math.cos(a), Rs * Math.sin(a), 0]);
      }
    } else {
      const span = (nLinks - 1) * pitch;
      for (let i = 0; i < nLinks; i++) spine.push([-span / 2 + i * pitch, 0, 0]);
    }
    const NL = spine.length;
    if (!NL) return { ok: false };

    const tangent = (i) => {
      const a = spine[Math.max(0, i - 1)], b = spine[Math.min(NL - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const l = Math.hypot(tx, ty, tz);
      if (l < 1e-9) return [1, 0, 0];
      return [tx / l, ty / l, tz / l];
    };

    /* --- world -> view rotation (yaw about Y, pitch about X, roll on screen) --- */
    const rad = Math.PI / 180;
    const cy1 = Math.cos(p.yaw * rad), sy1 = Math.sin(p.yaw * rad);
    const cp = Math.cos(p.pitch * rad), sp = Math.sin(p.pitch * rad);
    const cr2 = Math.cos(p.rot * rad), sr2 = Math.sin(p.rot * rad);
    const toView = (v) => {
      let x = v[0] * cy1 + v[2] * sy1;
      let z = -v[0] * sy1 + v[2] * cy1;
      let y = v[1] * cp - z * sp;
      z = v[1] * sp + z * cp;
      const rx = x * cr2 - y * sr2, ry = x * sr2 + y * cr2;
      return [rx, ry, z];
    };

    /* --- link frames in view space --- */
    const tiltR = Math.max(0, Math.min(90, p.tilt)) * rad;
    const links = [];
    for (let i = 0; i < NL; i++) {
      const T = tangent(i);
      /* two perpendiculars to T: one in the world XY plane, one out of it */
      let A = [-T[1], T[0], 0];
      let al = Math.hypot(A[0], A[1], A[2]);
      if (al < 1e-6) { A = [0, 1, 0]; al = 1; }
      A = [A[0] / al, A[1] / al, A[2] / al];
      const B = [T[1] * A[2] - T[2] * A[1], T[2] * A[0] - T[0] * A[2], T[0] * A[1] - T[1] * A[0]];
      const ph = (i % 2) ? tiltR : 0;
      const ca = Math.cos(ph), sa = Math.sin(ph);
      const Wv = [A[0] * ca + B[0] * sa, A[1] * ca + B[1] * sa, A[2] * ca + B[2] * sa];
      /* Offset slides the link sideways INSIDE its own plane, perpendicular to
         the chain axis, with the sign alternating - a constant offset would
         merely translate the whole chain and vanish in the centring. */
      const offMM = (Number.isFinite(p.off) ? p.off : 0) * ((i % 2) ? -1 : 1);
      const Cw = [spine[i][0] + Wv[0] * offMM, spine[i][1] + Wv[1] * offMM, spine[i][2] + Wv[2] * offMM];
      /* link plane spanned by (T, Wv) - a chain link's plane contains the axis */
      let Uv = toView(T), Vv = toView(Wv);
      /* Spin turns the element within that plane. Rotating the BASIS rather
         than the point list means the band, the hatch and the occlusion test
         all inherit it for free - they are all expressed in (U, V). A circle is
         rotationally symmetric, so spin only shifts its hatch phase; on the
         polygons it is the whole point. */
      const th = ((Number.isFinite(p.spin) ? p.spin : 0) + i * (Number.isFinite(p.spinStep) ? p.spinStep : 0)) * rad;
      if (th) {
        const ct = Math.cos(th), st = Math.sin(th);
        const U2 = [Uv[0] * ct + Vv[0] * st, Uv[1] * ct + Vv[1] * st, Uv[2] * ct + Vv[2] * st];
        const V2 = [-Uv[0] * st + Vv[0] * ct, -Uv[1] * st + Vv[1] * ct, -Uv[2] * st + Vv[2] * ct];
        Uv = U2; Vv = V2;
      }
      const Cv = toView(Cw);
      const N = [Uv[1] * Vv[2] - Uv[2] * Vv[1], Uv[2] * Vv[0] - Uv[0] * Vv[2], Uv[0] * Vv[1] - Uv[1] * Vv[0]];
      links.push({ C: Cv, U: Uv, V: Vv, N });
    }

    /* --- fit: bbox of every projected outer edge point --- */
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const lk of links) {
      for (let i = 0; i < NC; i += 2) {
        const u = (cl[i][0] + nrm[i][0] * hU) * R, v = (cl[i][1] + nrm[i][1] * hU) * R;
        const x = lk.C[0] + lk.U[0] * u + lk.V[0] * v;
        const y = lk.C[1] + lk.U[1] * u + lk.V[1] * v;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (!isFinite(x0) || !isFinite(y0)) return { ok: false };
    const gw = (x1 - x0) || 1, gh = (y1 - y0) || 1;
    /* SHRINK TO FIT, never grow. Scaling up to the margin box would make "Link
       size mm" meaningless - the drawing would fill the sheet at every size and
       the parameter would only change how many hatch rungs got packed in, which
       reads as a density knob, not a size knob. Clamping the scale at 1 makes
       the millimetres real; oversized chains still get pulled back onto the
       sheet rather than running off it. */
    const sc = Math.min(1, Math.min(bw / gw, bh / gh));
    const ox = m + (bw - gw * sc) / 2 - x0 * sc;
    const oy = m + (bh - gh * sc) / 2 - y0 * sc;
    const proj = (x, y) => [x * sc + ox, y * sc + oy];

    return { ok: true, links, cl, nrm, cum, per, NC, hU, R, sc, ox, oy, proj, nearCenterline, spine, toView, m, bw, bh };
  },

  compute(ins, p, ctx) {
    const B = this._build(p, ctx, ins);
    if (!B || !B.ok) return applyStyle({ paths: [] }, ins[1]);
    const { links, cl, nrm, cum, per, NC, hU, R, proj, nearCenterline } = B;
    /* B.sc is read directly below: hatch spacing is quoted in paper mm */
    const L = Math.max(0, Math.min(PENS.length - 1, Math.round(p.layer)));
    const BUDGET = 110000;
    let used = 0;
    const paths = [];

    /* ---- visibility: is this view-space point behind another link's band? ---- */
    const doHide = p.hidden !== false && links.length > 1;
    const visible = (P, self) => {
      if (!doHide) return true;
      for (let j = 0; j < links.length; j++) {
        if (j === self) continue;               /* a plane cannot occlude itself */
        const lk = links[j];
        const nz = lk.N[2];
        if (Math.abs(nz) < 1e-7) continue;      /* edge-on: occludes a zero-width sliver */
        const t = ((lk.C[0] - P[0]) * lk.N[0] + (lk.C[1] - P[1]) * lk.N[1] + (lk.C[2] - P[2]) * lk.N[2]) / nz;
        if (t <= 1e-6) continue;                /* that plane is behind this point */
        const qz = P[2] + t;
        const dx = P[0] - lk.C[0], dy = P[1] - lk.C[1], dz = qz - lk.C[2];
        const u = (dx * lk.U[0] + dy * lk.U[1] + dz * lk.U[2]) / R;
        const v = (dx * lk.V[0] + dy * lk.V[1] + dz * lk.V[2]) / R;
        if (nearCenterline(u, v)) return false;
      }
      return true;
    };

    /* ---- clip a view-space polyline to its visible runs, cutting by bisection ---- */
    const emit = (pts3, self, closed) => {
      if (used >= BUDGET || pts3.length < 2) return;
      if (!doHide) {
        const out = pts3.map((q) => proj(q[0], q[1]));
        used += out.length;
        paths.push({ pts: out, closed: !!closed, layer: L });
        return;
      }
      const seq = closed ? pts3.concat([pts3[0]]) : pts3;
      const vis = seq.map((q) => visible(q, self));
      if (vis.every(Boolean)) {
        const out = pts3.map((q) => proj(q[0], q[1]));
        used += out.length;
        paths.push({ pts: out, closed: !!closed, layer: L });
        return;
      }
      const cut = (a, b, aVis) => {         /* boundary point between a and b */
        let lo = 0, hi = 1;
        for (let it = 0; it < 8; it++) {
          const mid = (lo + hi) / 2;
          const q = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid, a[2] + (b[2] - a[2]) * mid];
          if (visible(q, self) === aVis) lo = mid; else hi = mid;
        }
        const t = (lo + hi) / 2;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      };
      const runs = [];
      let run = null;
      for (let i = 0; i < seq.length; i++) {
        if (vis[i]) {
          if (!run) {
            run = [];
            if (i > 0) run.push(cut(seq[i], seq[i - 1], true));
          }
          run.push(seq[i]);
        } else if (run) {
          run.push(cut(seq[i - 1], seq[i], true));
          runs.push(run);
          run = null;
        }
      }
      if (run) runs.push(run);
      /* a closed curve whose seam is visible arrives as two runs that are one */
      if (closed && runs.length > 1 && vis[0] && vis[seq.length - 1]) {
        const first = runs.shift();
        runs[runs.length - 1] = runs[runs.length - 1].concat(first.slice(1));
      }
      for (const r of runs) {
        if (r.length < 2 || used >= BUDGET) continue;
        const out = r.map((q) => proj(q[0], q[1]));
        used += out.length;
        paths.push({ pts: out, closed: false, layer: L });
      }
    };

    const at = (lk, u, v) => [
      lk.C[0] + lk.U[0] * u * R + lk.V[0] * v * R,
      lk.C[1] + lk.U[1] * u * R + lk.V[1] * v * R,
      lk.C[2] + lk.U[2] * u * R + lk.V[2] * v * R,
    ];
    /* centerline point + outward normal at arc position s (0..per), wrapping */
    const atS = (s) => {
      let x = ((s % per) + per) % per;
      let lo = 0, hi = NC;
      while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= x) lo = mid; else hi = mid; }
      const a = cl[lo], b = cl[(lo + 1) % NC];
      const na = nrm[lo], nb = nrm[(lo + 1) % NC];
      const seg = (cum[lo + 1] - cum[lo]) || 1;
      const t = (x - cum[lo]) / seg;
      return [
        [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        [na[0] + (nb[0] - na[0]) * t, na[1] + (nb[1] - na[1]) * t],
      ];
    };

    /* ---- band edges ---- */
    if (p.edges !== false) {
      for (let i = 0; i < links.length && used < BUDGET; i++) {
        for (const sgn of [-1, 1]) {
          const ring = [];
          for (let c = 0; c < NC; c++) ring.push(at(links[i], cl[c][0] + nrm[c][0] * hU * sgn, cl[c][1] + nrm[c][1] * hU * sgn));
          emit(ring, i, true);
        }
      }
    }

    /* ---- hatch ---- */
    const mode = p.hatch;
    if (mode !== "None") {
      const perMM = per * R;
      /* Hatch spacing and Lean are quoted in PAPER millimetres, so divide out
         the shrink: whatever the fit does, the rungs land Gap apart in ink. */
      const S = B.sc > 1e-6 ? B.sc : 1;
      let gapMM = Math.max(0.35, p.gap) / S;
      /* coarsen rather than hang: rungs x samples x links must stay in budget */
      const SAMP = Math.max(4, Math.min(14, Math.round((2 * hU * R * S) / 1.6) + 2));
      const est = () => (perMM / gapMM) * SAMP * links.length * (mode === "Cross" ? 2 : 1);
      while (est() > BUDGET * 0.9 && gapMM < 40 / S) gapMM *= 1.35;
      const nR = Math.max(3, Math.round(perMM / gapMM));
      const leanU = ((p.lean || 0) / S) / R;   /* paper mm -> local -> unit */

      for (let i = 0; i < links.length && used < BUDGET; i++) {
        for (let r = 0; r < nR && used < BUDGET; r++) {
          const s0 = (r / nR) * per;
          const flip = (mode === "Chevron alternating" && (r % 2)) ? -1 : 1;
          const arms = mode === "Cross" ? [1, -1] : [flip];
          for (const arm of arms) {
            const pts = [];
            for (let q = 0; q < SAMP; q++) {
              const w = -1 + 2 * (q / (SAMP - 1));      /* -1 inner .. +1 outer */
              let shift = 0;
              if (mode === "Diagonal" || mode === "Cross") shift = leanU * arm * w;
              else if (mode === "Chevron" || mode === "Chevron alternating") shift = leanU * arm * (Math.abs(w) - 0.5) * 2;
              const [c, n] = atS(s0 + shift);
              pts.push(at(links[i], c[0] + n[0] * hU * w, c[1] + n[1] * hU * w));
            }
            emit(pts, i, false);
          }
        }
      }
    }

    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx, ins) {
    try {
      const B = this && this._build ? this._build(p, ctx, ins) : null;
      if (!B || !B.ok) return [];
      const g = [{ kind: "rect", x: B.m, y: B.m, w: B.bw, h: B.bh }];
      /* the actual link centres, not the raw spine: Offset moves them off the
         axis and a guide that ignored that would lie about the drawing */
      const sp = B.links.map((lk) => B.proj(lk.C[0], lk.C[1]));
      if (sp.length >= 2) g.push({ kind: "poly", pts: sp });
      for (const q of sp) g.push({ kind: "point", x: q[0], y: q[1] });
      return g;
    } catch (e) { return []; }
  },
};
