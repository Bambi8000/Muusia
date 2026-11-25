import { Pin, mulberry32, noise2, resample, pathLength, applyStyle } from "../helpers.js";

/* Silhouette v6 = an explicit anatomical anchor loop, smoothed through one
   periodic Catmull-Rom pass and resampled to even arc length. Every feature -
   neckline dip, trapezius caps, deltoid round, armpit dent, chest swell,
   waist, hip flare, hem corners, the short tail the crop trims into the flat
   bust plate - is a placed control point, so the outline ALONE reads as a
   torso. A pure radial profile cannot do this: its crown stays the widest
   point, which is what made v5 read as a head with a stem.
   Frame: y runs from the neckline (screen top) to the hem tail (screen
   bottom), x mirrored about the axis; anchors list the right flank only. */
const TAU = Math.PI * 2;
const mirrorLoop = (side) => {
  const m = side.length;
  return [...side, ...side.slice(1, m - 1).map(([x, y]) => [-x, y]).reverse()];
};
const crLoop = (anchors, n) => {
  const a = anchors, m = a.length;
  const raw = [];
  for (let i = 0; i < m; i++) {
    const p0 = a[(i - 1 + m) % m], p1 = a[i], p2 = a[(i + 1) % m], p3 = a[(i + 2) % m];
    for (let k = 0; k < 48; k++) {
      const t = k / 48, t2 = t * t, t3 = t2 * t;
      raw.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  const L = pathLength(raw, true);
  return resample(raw, true, L / n);
};

export default ({
  key: "bust",
  name: "Bust",
  cat: "gen",
  group: "creatures",
  desc: "A nude bust study in one stroke language. *Form* picks the torso - Female or Male - built as one smooth designed silhouette - broad rounded shoulders, a shallow neck scoop, chest mounds, a soft S-curve waist and flared hips, cut by *Crop* into the classic wide flat bust plate - with Seeded *Wobble* rippling the edge a fixed fraction of the figure height, so it stays clean even in thin places. Wobble 0 is a glass-smooth line for broad ink drawings; raise it for a hand-cut frilled edge. *Crop* cuts the lower arc into a straight chord, leaving the classic flat bust plate; 0 keeps the full round form. *Style* details the form: Outline draws the silhouette alone; Contours scales nested copies toward the chest foci; Curved Hatch and Crosshatch sweep strokes that circulate into the shadow under each mound, like engraving; Stipple scatters dots denser in that shade; Rosette clips counter-rotated banknote circle families into the form, guilloche medallion style. *Size* is the figure height in millimetres; the whole composition auto-fits the paper inside *Margin*, centred on Position X/Y. Pair places two facing studies and Stacked a top/bottom pair, with *Asymmetry* breaking the mirror and *Overlap* setting pair spacing. *Pen* and *Detail pen* route the outline and the interior work to separate pens - broad ink for the line, a 0.35 mm technical pen for the detail. Past the point budget the detail stops starting new strokes rather than cutting paths, so exports stay complete.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "form", label: "Form", type: "select", options: ["Female", "Male"], def: "Female" },
    { key: "style", label: "Style", type: "select", options: ["Outline", "Contours", "Curved hatch", "Crosshatch", "Stipple", "Rosette"], def: "Outline" },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 30, step: 0.5, def: 0 },
    { key: "crop", label: "Crop bottom", type: "slider", min: 0, max: 30, step: 0.5, def: 22 },
    { key: "size", label: "Size", type: "slider", min: 40, max: 260, step: 1, def: 90 },
    { key: "layout", label: "Layout", type: "select", options: ["Single", "Pair", "Stacked"], def: "Single" },
    { key: "posX", label: "Position X", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "posY", label: "Position Y", type: "slider", min: 0, max: 100, step: 0.5, def: 52 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
    { key: "asym", label: "Asymmetry", type: "slider", min: 0, max: 100, step: 1, def: 10, showIf: p => p.layout !== "Single" },
    { key: "overlap", label: "Overlap", type: "slider", min: 0, max: 60, step: 1, def: 15, showIf: p => p.layout === "Pair" },
    { key: "tilt", label: "Tilt", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
    { key: "cLines", label: "Contour lines", type: "slider", min: 4, max: 80, step: 1, def: 22, showIf: p => p.style === "Contours" },
    { key: "cGamma", label: "Contour bias", type: "slider", min: 0.3, max: 1.5, step: 0.05, def: 0.75, showIf: p => p.style === "Contours" },
    { key: "hSpacing", label: "Hatch pitch", type: "slider", min: 0.4, max: 6, step: 0.05, def: 1.2, showIf: p => p.style === "Curved hatch" || p.style === "Crosshatch" },
    { key: "hLift", label: "Hatch curl", type: "slider", min: 0, max: 10, step: 0.1, def: 4.5, showIf: p => p.style === "Curved hatch" || p.style === "Crosshatch" },
    { key: "sDots", label: "Stipple dots", type: "slider", min: 50, max: 3000, step: 10, def: 700, showIf: p => p.style === "Stipple" },
    { key: "sGap", label: "Dot gap", type: "slider", min: 0.3, max: 5, step: 0.05, def: 0.9, showIf: p => p.style === "Stipple" },
    { key: "sDotR", label: "Dot size", type: "slider", min: 0.08, max: 1.2, step: 0.01, def: 0.25, showIf: p => p.style === "Stipple" },
    { key: "sBias", label: "Shade bias", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7, showIf: p => p.style === "Stipple" },
    { key: "rPetals", label: "Rosette petals", type: "slider", min: 4, max: 48, step: 1, def: 16, showIf: p => p.style === "Rosette" },
    { key: "rOrbit", label: "Rosette orbit", type: "slider", min: 0.05, max: 0.6, step: 0.01, def: 0.3, showIf: p => p.style === "Rosette" },
    { key: "rPetalR", label: "Petal size", type: "slider", min: 0.1, max: 1.2, step: 0.01, def: 0.55, showIf: p => p.style === "Rosette" },
    { key: "rTwin", label: "Twin family", type: "check", def: true, showIf: p => p.style === "Rosette" },
    { key: "penMain", label: "Pen", type: "pen", def: 0 },
    { key: "penDetail", label: "Detail pen", type: "pen", def: 1 }
  ],
  /* Form silhouettes, v6: placed anchors (right flank, neckline -> tail),
     mirrored into the closed loop. Coordinates are the unit frame described
     above - y from the neckline (-1.45) to the tail tip (+1.45), so the
     whole figure spans about 2.9 units before cropping; the crop chord lands
     on the hem line at its default. Values tuned against renders, not
     equations: graded, separated anchors read as a body; equal-strength
     bumps average into an egg. `focus` is the chest centre each form details
     around (areola home for the female; the shading pole for both). */
   _forms: {
     Female: {
       anchors: [
         [0, -1.45],            /* neckline dip */
         [0.16, -1.42],         /* neck slope */
         [0.34, -1.38],         /* trapezius cap */
         [0.56, -1.29],         /* deltoid round */
         [0.50, -1.05],         /* armpit dent - deep enough that the swell pops */
         [0.72, -0.68],         /* chest swell - the defining feature */
         [0.42, -0.20],         /* waist - narrowest */
         [0.72, 0.40],          /* hip flare - widest */
         [0.62, 0.85],          /* hem corner */
         [0.44, 1.28],          /* tail */
         [0.18, 1.42],
         [0, 1.45]              /* tail tip (the crop trims this off) */
       ],
       focus: [0.34, -0.62],
       areola: true, areolaR: 0.085, nippleR: 0.034, moundK: 0.5
     },
     Male: {
       anchors: [
         [0, -1.41],            /* neckline - a shallow broad scoop (a deep V cusps) */
         [0.13, -1.38],         /* neck slope */
         [0.40, -1.36],         /* broad flat traps - the dominant line */
         [0.60, -1.27],         /* angular deltoid */
         [0.50, -0.98],         /* deeper armpit dent */
         [0.63, -0.66],         /* pecs - a modest swell */
         [0.36, -0.16],         /* tapered waist */
         [0.48, 0.44],          /* barest hip hint */
         [0.42, 0.85],          /* hem corner */
         [0.30, 1.28],          /* tail */
         [0.14, 1.42],
         [0, 1.45]              /* tail tip */
       ],
       focus: [0.30, -0.58],
       areola: false, areolaR: 0, nippleR: 0, moundK: 0.5
     }
   },
  _num(v, d, lo, hi) { const n = +v; return Number.isFinite(n) ? Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, n)) : d; },
  /* Wobbled unit-frame ring. Wobble is an absolute fraction of the figure
     height applied along the local polar direction, three seeded octaves -
     so a thin region ripples gently instead of folding into spikes. */
  /* Wobbled unit-frame ring: the anchor loop resampled to even spacing, then
      rippled along the local radial direction - three seeded octaves, applied
      as a fixed fraction of the figure height and fading out near the centre
      axis - so a thin region ripples gently instead of folding into spikes.
      Wobble 0 returns the pure spline (seed-invariant, glass smooth). */
  _ring(F, wob, sd, n, seed) {
    const uH = this._uH(F);
    const ring = crLoop(mirrorLoop(F.anchors), n);
    if (!wob) return ring;
    return ring.map(([bx, by], i) => {
      let s = 0, norm = 0, amp1 = 1, f = 1.9;
      const t = (i / n) * TAU;
      for (let o = 0; o < 3; o++) {
        s += (noise2(Math.cos(t) * f, Math.sin(t) * f, seed * 131 + sd * 1313 + o * 7919) - 0.5) * 2 * amp1;
        norm += amp1; amp1 *= 0.5; f *= 2.13;
      }
      const bl = Math.hypot(bx, by);
      const fade = bl < 0.05 * uH ? bl / (0.05 * uH) : 1;   /* vanish toward the centre */
      const d = wob * 0.012 * uH * fade * (s / norm);
      return [bx + (bx / (bl || 1e-9)) * d, by + (by / (bl || 1e-9)) * d];
    });
  },
  _uH(F) {
    if (F._uH === undefined) {
      let hi = -Infinity, lo = Infinity;
      for (const [, y] of mirrorLoop(F.anchors)) { hi = Math.max(hi, y); lo = Math.min(lo, y); }
      F._uH = Math.max(1e-3, hi - lo);
    }
    return F._uH;
  },
  _cropF(p) { return Math.min(0.45, Math.max(0, this._num(p.crop, 22)) / 100); },
  _place(pts, F, size, sizeF, tiltDeg, side, S, lift, ov, cen, cropF = 0, foc = null) {
    /* size is the VISIBLE (post-crop) figure height, so undo the crop fraction
       in the unit-frame scale; crop 0 keeps the classic full-height behaviour. */
    const sc = (size * sizeF) / (this._uH(F) * (1 - cropF));
    const a = (tiltDeg * Math.PI) / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const c = cen || (() => { let x = 0, y = 0; for (const q of pts) { x += q[0]; y += q[1]; } return [x / pts.length, y / pts.length]; })();
    const xf = ([x, y]) => {
      x -= c[0]; y -= c[1];
      if (side < 0) x = -x;
      const X = x * ca - y * sa, Y = x * sa + y * ca;
      return [X * sc, Y * sc + S * 1.05 + lift];
    };
    let out = pts.map(xf);
    let b0x0 = Infinity, b0x1 = -Infinity;
    for (const [x] of out) { b0x0 = Math.min(b0x0, x); b0x1 = Math.max(b0x1, x); }
    const sh = (b0x1 - b0x0) * 0.5 * (1 - ov) * side;
    if (sh) out = out.map(([x, y]) => [x + sh, y]);
    const focOut = foc ? foc.map((q) => { const [x, y] = xf(q); return [x + (sh || 0), y]; }) : null;
    return { pts: out, cen: c, foc: focOut };
  },
  /* Per-layout build specs - the single source both overlay and compute use. */
  _specs(p, S, rnd) {
    const aSize = 1 + (rnd() * 2 - 1) * p._asym * 0.5;
    const aTilt = (rnd() * 2 - 1) * p._asym * 22;
    const aLift = (rnd() * 2 - 1) * p._asym * 6;
    if (p._layout === "Stacked") {
      return [
        { sd: 0, sizeF: aSize, tilt: aTilt, side: 1, lift: S * 1.5 },
        { sd: 11, sizeF: 1, tilt: -aTilt * 0.6, side: 1, lift: -S * 1.5 }
      ];
    }
    if (p._layout === "Pair") {
      return [
        { sd: 0, sizeF: aSize, tilt: aTilt, side: -1, lift: aLift },
        { sd: 11, sizeF: 1, tilt: -aTilt * 0.7, side: 1, lift: -aLift }
      ];
    }
    return [{ sd: 0, sizeF: 1, tilt: this._num(p.tilt, 0, -90, 90), side: 1, lift: 0 }];
  },
  /* Fit the group bbox into the paper inside margin; never enlarge. */
  _fit(bb, W, H, m) {
    const bw = Math.max(1e-3, bb.x1 - bb.x0), bh = Math.max(1e-3, bb.y1 - bb.y0);
    const aw = Math.max(1, W - 2 * m), ah = Math.max(1, H - 2 * m);
    return Math.min(1, aw / bw, ah / bh);
  },
  _bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
  },
  overlay(p, ctx) {
    try {
      const W = +ctx.W, H = +ctx.H;
      if (!(W > 8) || !(H > 8)) return [];
      const F = this._forms[p.form === "Male" ? "Male" : "Female"] || this._forms.Female;
      const amp = this._num(p.wobble, 0, 0, 60) / 100;
      const size = this._num(p.size, 90, 4, 1000);
      const S = size / 2;
      const m = this._num(p.margin, 8, 0, Math.min(W, H) / 2 - 1);
      const ov = this._num(p.overlap, 15, 0, 90) / 100;
      const rp = { ...p, _asym: this._num(p.asym, 10, 0, 100) / 100, _layout: p.layout || "Single" };
      const rnd = mulberry32(this._num(p.seed, 7, -1e9, 1e9) * 104729 + 3);
      const specs = this._specs(rp, S, rnd);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sp of specs) {
        const env = this._ring(F, amp, sp.sd, 360, Math.round(this._num(p.seed, 7)));
        const pl = this._place(env, F, size, sp.sizeF, sp.tilt, sp.side, S, sp.lift, ov, null, this._cropF(p));
        for (const [x, y] of pl.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      const k = this._fit({ x0, y0, x1, y1 }, W, H, m);
      const gx = (x1 - x0) * k, gy = (y1 - y0) * k;
      const cx = Math.min(W - m - gx / 2, Math.max(m + gx / 2, (this._num(p.posX, 50, 0, 100) / 100) * W));
      const cy = Math.min(H - m - gy / 2, Math.max(m + gy / 2, (this._num(p.posY, 52, 0, 100) * H) / 100));
      const pad = 0.08 * size + 1;
      return [{ kind: "rect", x: cx - gx / 2 - pad, y: cy - gy / 2 - pad, w: gx + 2 * pad, h: gy + 2 * pad }];
    } catch { return []; }
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const F = this._forms[p.form === "Male" ? "Male" : "Female"] || this._forms.Female;
    const seed = Math.round(this._num(p.seed, 7, -1e9, 1e9));
    const amp = this._num(p.wobble, 0, 0, 60) / 100;
    const size = this._num(p.size, 90, 4, 1000);
    const S = size / 2;
    const m = this._num(p.margin, 8, 0, Math.min(W, H) / 2 - 1);
    const ov = this._num(p.overlap, 15, 0, 90) / 100;
    const layout = p.layout || "Single";
    const style = p.style || "Outline";
    const layMain = ((Math.round(this._num(p.penMain, 0, -99, 99)) % 12) + 12) % 12;
    const layDet = ((Math.round(this._num(p.penDetail, 1, -99, 99)) % 12) + 12) % 12;
    const rnd = mulberry32(seed * 104729 + 3);
    const rp = { ...p, _asym: this._num(p.asym, 10, 0, 100) / 100, _layout: layout };
    const specs = this._specs(rp, S, rnd);

    const smooth = (pts) => {
      let sm = pts;
      for (let k = 0; k < 2; k++) {
        const n = sm.length;
        sm = sm.map((q, i) => {
          const a = sm[(i - 1 + n) % n], b = q, c = sm[(i + 1 + n) % n];
          return [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4];
        });
      }
      return sm;
    };
    const inPoly = (x, y, poly, bbo) => {
      if (bbo && (x < bbo.x0 || x > bbo.x1 || y < bbo.y0 || y > bbo.y1)) return false;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const circleIn = (cx, cy, r, poly, budget) => {
      const chains = [];
      if (!poly.length || !(r > 0) || !Number.isFinite(r)) return chains;
      const bbo = this._bbox(poly);
      const pad = r + 0.5 * Math.max(bbo.x1 - bbo.x0, bbo.y1 - bbo.y0);
      if (cx + r < bbo.x0 - pad || cx - r > bbo.x1 + pad || cy + r < bbo.y0 - pad || cy - r > bbo.y1 + pad) return chains;
      const n = poly.length, nA = 200;
      let cur = null, prevPt = null;
      for (let i = 0; i < n; i++) {
        const a = poly[(i - 1 + n) % n], b = poly[i];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const fx = a[0] - cx, fy = a[1] - cy;
        const A = ex * ex + ey * ey, B = ex * fx + ey * fy, C = fx * fx + fy * fy - r * r;
        const D = B * B - A * C;
        const ts = [0];
        if (D > 0) {
          const sq = Math.sqrt(D);
          for (const t of [(-B - sq) / A, (-B + sq) / A]) if (t > 0 && t < 1) ts.push(t);
        }
        ts.push(1);
        for (let k = 0; k + 1 < ts.length; k++) {
          const tm = (ts[k] + ts[k + 1]) / 2;
          const mx = a[0] + ex * tm, my = a[1] + ey * tm;
          const ml = Math.hypot(mx - cx, my - cy) || 1e-9;
          const px = cx + r * (mx - cx) / ml, py = cy + r * (my - cy) / ml;
          const inNow = inPoly(px, py, poly, bbo);
          if (inNow) {
            if (!cur) { cur = []; chains.push(cur); }
            if (prevPt) {
              const a0 = Math.atan2(prevPt[1] - cy, prevPt[0] - cx);
              const aC = Math.atan2(py - cy, px - cx);
              let d = aC - a0;
              while (d > Math.PI) d -= TAU;
              while (d < -Math.PI) d += TAU;
              const steps = Math.max(1, Math.ceil((Math.abs(d) / TAU) * nA));
              for (let s2 = 1; s2 <= steps; s2++) {
                const aa = a0 + (d * s2) / steps;
                cur.push([cx + r * Math.cos(aa), cy + r * Math.sin(aa)]);
                if (budget && --budget.n < 0) return chains;
              }
            } else cur.push([px, py]);
          } else if (cur) cur = null;
          prevPt = inNow ? [px, py] : null;
        }
      }
      const pad2 = 0.02 * Math.max(bbo.x1 - bbo.x0, bbo.y1 - bbo.y0);
      return chains.filter((c) => c.length >= 3 && c.every(([x, y]) => x >= bbo.x0 - pad2 && x <= bbo.x1 + pad2 && y >= bbo.y0 - pad2 && y <= bbo.y1 + pad2));
    };
    /* ---------- per-form build ---------- */
    const budget = { n: 90000 };
    const builds = specs.map(sp => {
      const raw = this._ring(F, amp, sp.sd, 480, seed);
      const placed = this._place(raw, F, size, sp.sizeF, sp.tilt, sp.side, S, sp.lift, ov, null, this._cropF(p), [F.focus, [-F.focus[0], F.focus[1]]]);
      const sm = smooth(placed.pts);
      /* Optional flat bottom crop - the classic bust-plate cut. Trims the
         rounded tail below the hem line with a straight chord, so the figure
         ends in a clean horizontal edge instead of a tail. 0 keeps the full
         round form. */
      const cropF = this._cropF(p);
      let cropped = sm;
      if (cropF > 0.001) {
        const bbr = this._bbox(sm);
        const yC = bbr.y1 - cropF * (bbr.y1 - bbr.y0);
        const out = [];
        let chord = false;
        for (let i = 0; i < sm.length; i++) {
          const p0 = sm[i], p1 = sm[(i + 1) % sm.length];
          const in0 = p0[1] <= yC, in1 = p1[1] <= yC;
          if (in0) out.push(p0);
          if (in0 !== in1) {
            const t = (yC - p0[1]) / (p1[1] - p0[1]);
            out.push([p0[0] + (p1[0] - p0[0]) * t, yC]);
            chord = true;
          }
        }
        if (chord && out.length >= 8) cropped = out;
      }
      const L = pathLength(cropped, true);
      if (!Number.isFinite(L)) throw new Error("bust outline produced non-finite coordinates");
      const pts = resample(cropped, true, Math.max(0.02, L / 700));
      if (pts.length < 8 || !pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) throw new Error("bust resampled outline invalid");
      const bb = this._bbox(pts);
      const Hh = bb.y1 - bb.y0;
      const Wd = bb.x1 - bb.x0;
      const c = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2];
      const paths = [];
      /* Chest foci: each form declares its detail pole in the unit frame;
         _place carried it through scale/tilt/mirror with the silhouette, so
         the areolae and the under-mound shade track the form exactly. */
      const foci = placed.foc;
      /* Under-mound shadow anchors: below each focus, tilted toward the sternum. */
      const shades = foci.map((fo) => {
        const ux = fo[0] - c[0], uy = fo[1] - c[1];
        const ul = Math.hypot(ux, uy) || 1e-9;
        const vx = -0.5 * ux / ul, vy = 1;
        const vl = Math.hypot(vx, vy);
        return [fo[0] + (vx / vl) * 0.30 * Hh, fo[1] + (vy / vl) * 0.30 * Hh];
      });
      /* female anatomy anchors */
      if (F.areola) {
        for (const fo of foci) {
          const ux = fo[0] - c[0], uy = fo[1] - c[1];
          const ul = Math.hypot(ux, uy) || 1e-9;
          const ax = fo[0] - (ux / ul) * 0.18 * Wd * 0.5, ay = fo[1] - (uy / ul) * 0.18 * Wd * 0.5;
          const ar = F.areolaR * Wd, nr = F.nippleR * Wd;
          if (ar > 0.4) {
            const ap = [];
            for (let i = 0; i < 64; i++) { const a2 = (i / 64) * TAU; ap.push([ax + Math.cos(a2) * ar, ay + Math.sin(a2) * ar * 0.94]); }
            paths.push({ pts: ap, closed: true, layer: layDet });
          }
          if (nr > 0.2) {
            const np = [];
            for (let i = 0; i < 22; i++) { const a2 = (i / 22) * TAU; np.push([ax + Math.cos(a2) * nr, ay + Math.sin(a2) * nr]); }
            paths.push({ pts: np, closed: true, layer: layDet });
          }
        }
      }
      switch (style) {
        case "Outline":
          break;
        case "Contours": {
          const N0 = Math.max(2, Math.min(80, Math.round(this._num(p.cLines, 22))));
          const gamma = this._num(p.cGamma, 0.75, 0.05, 2);
          /* Rings close toward the chest - the midpoint of the two detail foci
             - so the nested series reads as form, not a waist bowtie. */
          const ax = foci.length === 2 ? (foci[0][0] + foci[1][0]) / 2 : c[0];
          const ay = foci.length === 2 ? (foci[0][1] + foci[1][1]) / 2 : c[1];
          const N = Math.max(2, Math.min(N0, Math.floor(budget.n / Math.max(1, pts.length))));
          for (let i = 0; i < N; i++) {
            const s = Math.pow((i + 1) / (N + 1), gamma);
            paths.push({ pts: pts.map(([x, y]) => [ax + (x - ax) * s, ay + (y - ay) * s]), closed: true, layer: layDet });
          }
          budget.n -= N * pts.length;
          break;
        }
        case "Curved hatch":
        case "Crosshatch": {
          const spc = Math.max(0.3, this._num(p.hSpacing, 1.2, 0.1, 100));
          const A = Math.max(0, this._num(p.hLift, 4.5, 0, 100));
          /* Pen-style hatching: families of strokes whose samples are warped
             into a circulation around each under-mound shadow, so strokes
             bend to follow the form and bunch in the shadow. Curved = one
             vertical family; Cross = two closely angled families (a small
             separation keeps the crossings in soft bands, never a checker
             moire). A slow seeded field jitters each line's offset by up to
             45% of the spacing so the pen work looks drawn, not gridded. */
          const sigS = Math.max(2, 0.5 * Wd);
          const angles = style === "Crosshatch" ? [58, 30] : [90];
          const diag = Math.hypot(Wd, Hh);
          const hrnd = mulberry32((seed + 131) * 104729 + 3);
          const nSeed = hrnd() * 1e4;
          const warp = (qx, qy) => {
            let wx = qx, wy = qy;
            for (let si = 0; si < shades.length; si++) {
              const vx = wx - shades[si][0], vy = wy - shades[si][1];
              const d = Math.hypot(vx, vy);
              if (d < 1e-6) continue;
              const g = Math.exp(-((d / sigS) ** 2));
              if (g < 0.004) continue;
              const dirn = si === 0 ? 1 : -1;      /* mirror-symmetric wrap */
              /* Pull dominates: lines gather into the shadow crescent (a dark
                 band under each mound); the lighter circulation bends them so
                 the bunching follows the form like an engraver's hatching. */
              const tA = A * 0.55 * g, pA = A * 0.9 * g;
              wx += (-vy / d) * tA * dirn - (vx / d) * pA;
              wy += (vx / d) * tA * dirn - (vy / d) * pA;
            }
            return [wx, wy];
          };
          for (const aDeg of angles) {
            const a = (aDeg * Math.PI) / 180;
            const dx = Math.cos(a), dy = Math.sin(a);   /* stroke direction */
            const nx = -dy, ny = dx;                    /* offset axis */
            const T = diag * 0.5 + spc * 2;
            for (let t = -T; t <= T; t += spc) {
              if (budget.n < 4) break;
              const jit = noise2(t * 0.06 + nSeed, aDeg * 7.3) * 0.45 * spc;
              const o = t + jit;
              const ox = c[0] + nx * o, oy = c[1] + ny * o;
              let chain = null;
              for (let s = -diag; s <= diag; s += 1.2) {
                const [wx, wy] = warp(ox + dx * s, oy + dy * s);
                if (inPoly(wx, wy, pts, bb)) {
                  if (!chain) chain = [];
                  chain.push([wx, wy]);
                  budget.n -= 1;
                  if (budget.n < 0) break;
                } else if (chain) {
                  /* A chain that survives is a real stroke; a one-sample graze
                     of the rim is dropped, so no degenerate paths ship. */
                  if (chain.length >= 2) paths.push({ pts: chain, closed: false, layer: layDet });
                  chain = null;
                }
              }
              if (chain && chain.length >= 2) paths.push({ pts: chain, closed: false, layer: layDet });
            }
          }
          break;
        }
        case "Stipple": {
          const count = Math.max(10, Math.min(3000, Math.round(this._num(p.sDots, 700))));
          const gap = Math.max(0.2, this._num(p.sGap, 0.9, 0.1, 100));
          const bias = this._num(p.sBias, 0.7, 0, 1);
          const rDot = Math.max(0.05, Math.min(2, this._num(p.sDotR, 0.25)));
          const srnd = mulberry32((seed + 77) * 7919 + 5);
          const grid = new Map();
          const cell = gap;
          const under = shades;                                    /* shared under-mound shadow anchors */
          const sig = 0.42 * Math.min(Wd, Hh);
          const dots = [];
          let tries = 0;
          while (dots.length < count && tries < count * 50) {
            tries++;
            const x = bb.x0 + srnd() * Wd;
            const y = bb.y0 + srnd() * Hh;
            if (!inPoly(x, y, pts, bb)) continue;
            const tn = 1 - (bb.y1 - y) / Hh;                       /* 0 top … 1 bottom */
            let sh = 0;
            for (const [ux2, uy2] of under) {
              const dd = Math.hypot(x - ux2, y - uy2) / sig;
              sh = Math.max(sh, Math.exp(-dd * dd));
            }
            const wgt = 0.10 + 0.90 * ((1 - bias) * 0.5 + bias * Math.pow(sh, 1.2) * 0.85 + bias * tn * 0.15);
            if (srnd() > wgt) continue;
            const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
            let okFlag = true;
            for (let ix = gx - 1; ix <= gx + 1 && okFlag; ix++)
              for (let iy = gy - 1; iy <= gy + 1 && okFlag; iy++)
                for (const [qx, qy] of grid.get(ix + "," + iy) || [])
                  if (Math.hypot(qx - x, qy - y) < gap) { okFlag = false; break; }
            if (!okFlag) continue;
            if (!grid.has(gx + "," + gy)) grid.set(gx + "," + gy, []);
            grid.get(gx + "," + gy).push([x, y]);
            dots.push([x, y]);
          }
          for (const [x, y] of dots) {
            if (budget.n < 14) break;
            budget.n -= 14;
            const cp = [];
            for (let i = 0; i < 14; i++) { const a2 = (i / 14) * TAU; cp.push([x + Math.cos(a2) * rDot, y + Math.sin(a2) * rDot]); }
            paths.push({ pts: cp, closed: true, layer: layDet });
          }
          break;
        }
        case "Rosette": {
          const cx = c[0], cy = c[1];
          const R = Math.min(Wd, Hh) * 0.5;
          const petals = Math.max(3, Math.min(48, Math.round(this._num(p.rPetals, 16))));
          const orbit = Math.max(0, Math.min(1, this._num(p.rOrbit, 0.3)));
          const petalR = Math.max(0.05, Math.min(1.5, this._num(p.rPetalR, 0.55)));
          const fams = p.rTwin
            ? [{ o: orbit, r: petalR, off: 0 }, { o: orbit * 0.72, r: petalR * 1.38, off: Math.PI / petals }]
            : [{ o: orbit, r: petalR, off: 0 }];
          for (const f of fams) {
            for (let k = 0; k < petals; k++) {
              if (budget.n < 0) break;
              const a = f.off + (k / petals) * TAU;
              for (const ch of circleIn(cx + R * f.o * Math.cos(a), cy + R * f.o * Math.sin(a), R * f.r, pts, budget)) {
                paths.push({ pts: ch, closed: false, layer: layDet });
              }
            }
          }
          /* Filled core: a few seeded concentric circles close the inner hole,
             so the rosette reads as a full guilloche medallion, not a target. */
          const rr = mulberry32((seed + 311) * 6151 + 9);
          for (let k = 1; k <= 5; k++) {
            if (budget.n < 0) break;
            const rad = R * petalR * (0.14 + 0.075 * k) * (0.92 + 0.16 * rr());
            for (const ch of circleIn(cx, cy, rad, pts, budget)) paths.push({ pts: ch, closed: false, layer: layDet });
          }
          break;
        }
      }
      paths.unshift({ pts, closed: true, layer: layMain });
      return { pts, bb, paths };
    });

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of builds) {
      const ob = this._bbox(b.pts);
      x0 = Math.min(x0, ob.x0); y0 = Math.min(y0, ob.y0);
      x1 = Math.max(x1, ob.x1); y1 = Math.max(y1, ob.y1);
    }
    /* Fit the VISIBLE figure: the cropped-away lower arc is never drawn, so the
       paper fit must not reserve space for it (the margin keeps the edges clear). */
    const k = this._fit({ x0, y0, x1, y1 }, W, H, m);
    const gcx = (x0 + x1) / 2, gcy = (y0 + y1) / 2;
    const cx = Math.min(W - m - (x1 - x0) * k / 2, Math.max(m + (x1 - x0) * k / 2, (this._num(p.posX, 50, 0, 100) / 100) * W));
    const cy = Math.min(H - m - (y1 - y0) * k / 2, Math.max(m + (y1 - y0) * k / 2, (this._num(p.posY, 52, 0, 100) * H) / 100));
    const tx = cx - gcx * k;
    const ty = cy - gcy * k;

    const paths = [];
    for (const b of builds) {
      for (const pa of b.paths) paths.push({ ...pa, pts: pa.pts.map(([x, y]) => [x * k + tx, y * k + ty]) });
    }
    return applyStyle({ paths }, ins[0]);
  }
});
