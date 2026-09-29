import { Pin, mulberry32, noise2, applyStyle, fontStrokes } from "../helpers.js";

export default {
  /* Fruits — Kosmos Botanika companion to Root Vegetables: lemon, apple, pear,
     kiwi, avocado, fig, starfruit, dragon fruit and pomegranate, whole or
     halved. Three drawing layers per specimen: the outline, a Fill of the
     peel (hatch / contours / stipple, clipped to the peel band on halved
     fruit and around the sticker on whole fruit) and kind-specific Details
     (pores, fuzz, scales, cores, seeds, arils). Local frame: body centre at
     0,0, x right, y down, height h; rotated and bbox-placed like Root
     Vegetables. */
  key: "fruits",
  name: "Fruits",
  cat: "gen",
  group: "nature",
  desc: "A fruit bowl for the Kosmos Botanika plates: Lemon, Apple, Pear, Kiwi, Avocado, Fig, Starfruit, Dragon fruit and Pomegranate, or Mix for a seeded medley. Cut draws them Whole, Halved or a Mix - a halved kiwi shows its seed ring and pale core, an avocado its pit, a lemon its segments, a starfruit its five-point star, a pomegranate its honeycomb of arils, a dragon fruit its speckled flesh, apple and pear their core and seeds. Every specimen is an outline from a kind-specific profile roughened by Irregularity (apple dimple, lemon nipples, pear neck, fig teardrop), Fill hatches, contours or stipples the peel (only the peel band on halved fruit, never under the sticker) at Fill density, and Details adds what belongs to the kind: lemon pores, kiwi fuzz, avocado bumps, fig meridians, starfruit ridges, dragon-fruit scales, the pomegranate crown, seeds and membranes inside. Stems draws stems and leaves on the Leaf pen; Sticker puts a small produce sticker with Label text on whole fruit. Size is the body height, Size variation scatters it; Rotation Upright / Tilt / Random (lemons and kiwis lie on their side); Placement No overlap keeps specimens apart by bounding box, Loose lets them touch. Pens: body, Detail (flesh, seeds), Leaf, Sticker.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "kind", label: "Kind", type: "select", options: ["Mix", "Lemon", "Apple", "Pear", "Kiwi", "Avocado", "Fig", "Starfruit", "Dragon fruit", "Pomegranate"], def: "Mix" },
    { key: "cut", label: "Cut", type: "select", options: ["Whole", "Halved", "Mix"], def: "Mix" },
    { key: "count", label: "Specimens", type: "slider", min: 1, max: 40, step: 1, def: 8 },
    { key: "size", label: "Size mm (body height)", type: "slider", min: 10, max: 150, step: 1, def: 48 },
    { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "irr", label: "Irregularity", type: "slider", min: 0, max: 0.5, step: 0.02, def: 0.08 },
    { key: "fill", label: "Fill", type: "select", options: ["None", "Hatch", "Contours", "Stipple"], def: "Hatch" },
    { key: "fillDens", label: "Fill density", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.45, showIf: (p) => p.fill !== "None" },
    { key: "details", label: "Details", type: "slider", min: 0, max: 1, step: 0.05, def: 0.7 },
    { key: "stems", label: "Stems & leaves", type: "check", def: true },
    { key: "sticker", label: "Sticker", type: "select", options: ["None", "Oval", "Round"], def: "Oval" },
    { key: "label", label: "Sticker label", type: "text", def: "FRESH", showIf: (p) => p.sticker !== "None" },
    { key: "place", label: "Placement", type: "select", options: ["No overlap", "Loose (may overlap)"], def: "No overlap" },
    { key: "rotation", label: "Rotation", type: "select", options: ["Upright", "Tilt", "Random"], def: "Tilt" },
    { key: "tilt", label: "Tilt deg", type: "slider", min: 0, max: 60, step: 1, def: 20, showIf: (p) => p.rotation === "Tilt" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 23 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "penDetail", label: "Detail pen", type: "pen", def: 8 },
    { key: "penLeaf", label: "Leaf pen", type: "pen", def: 3 },
    { key: "penSticker", label: "Sticker pen", type: "pen", def: 1 },
  ],

  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const m = Math.max(0, Math.min(+(p && p.margin) || 0, Math.min(W, H) / 2 - 2));
      return [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }];
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const m = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const seed = (Math.round(+p.seed) || 1) >>> 0;
    const rng = mulberry32(seed * 3137 + 41);
    const KINDS = ["Lemon", "Apple", "Pear", "Kiwi", "Avocado", "Fig", "Starfruit", "Dragon fruit", "Pomegranate"];
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const penB = cl(Math.round(p.layer), 0, 11), penD = cl(Math.round(p.penDetail), 0, 11), penL = cl(Math.round(p.penLeaf), 0, 11), penS = cl(Math.round(p.penSticker), 0, 11);
    const irr = cl(p.irr, 0, 0.6);
    const det = cl(p.details, 0, 1);
    const dens = cl(p.fillDens, 0.05, 1);
    const TWO_PI = Math.PI * 2;
    const paths = [];
    const BUDGET = 110000;
    let pts = 0;

    /* ---------------- kind profiles: hw(t) in [0,1] × half-width, t = 0 top … 1 bottom ---------------- */
    const circ = (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)));
    const sm = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
    /* Catmull-Rom half-width curve through [t, hw] control points (t ascending, 0..1) */
    const spline = (K) => (t) => {
      t = Math.max(0, Math.min(1, t));
      let i = 0; while (i < K.length - 2 && K[i + 1][0] <= t) i++;
      const P0 = K[Math.max(0, i - 1)], P1 = K[i], P2 = K[i + 1], P3 = K[Math.min(K.length - 1, i + 2)];
      const u = (t - P1[0]) / ((P2[0] - P1[0]) || 1), u2 = u * u, u3 = u2 * u;
      return Math.max(0, 0.5 * ((2 * P1[1]) + (-P0[1] + P2[1]) * u + (2 * P0[1] - 5 * P1[1] + 4 * P2[1] - P3[1]) * u2 + (-P0[1] + 3 * P1[1] - 3 * P2[1] + P3[1]) * u3));
    };
    const norm = (f) => { let mx = 1e-9; for (let i = 0; i <= 40; i++) mx = Math.max(mx, f(i / 40)); return (t) => f(t) / mx; };
    const PROF = {
      /* stem end at t = 0 (small collar), blossom-end nipple at t = 1 */
      Lemon: { aspect: 1.55, ang: Math.PI / 2, peel: 0.13, irrK: 0.3, hw: spline([[0, 0], [0.012, 0.1], [0.03, 0.14], [0.055, 0.2], [0.1, 0.5], [0.18, 0.79], [0.28, 0.94], [0.42, 1], [0.56, 0.99], [0.68, 0.91], [0.78, 0.74], [0.855, 0.46], [0.905, 0.22], [0.935, 0.15], [0.965, 0.13], [0.988, 0.08], [1, 0]]) },
      Apple: { aspect: 0.92, ang: 0, peel: 0.03, irrK: 0.8, dimple: [0.13, 0.05], hw: (t) => Math.pow(circ(t), 0.68) },
      Pear: { aspect: 1.35, ang: 0, peel: 0.03, irrK: 0.8, dimple: [0, 0.04], hw: norm((t) => circ(t) * (0.42 + 0.58 * sm((t - 0.28) / 0.45))) },
      Kiwi: { aspect: 1.25, ang: Math.PI / 2, peel: 0.06, irrK: 0.45, hw: (t) => Math.pow(circ(t), 0.92) },
      Avocado: { aspect: 1.45, ang: 0, peel: 0.08, irrK: 0.7, hw: norm((t) => circ(t) * (0.52 + 0.48 * t)) },
      Fig: { aspect: 1.15, ang: 0, peel: 0.06, irrK: 1, hw: norm((t) => Math.pow(circ(t), 0.85) * (0.3 + 0.7 * Math.pow(t, 0.6))) },
      Starfruit: { aspect: 1.9, ang: 0, peel: 0.05, irrK: 0.4, hw: (t) => Math.pow(circ(t), 0.55) },
      "Dragon fruit": { aspect: 1.3, ang: 0, peel: 0.1, irrK: 0.5, hw: (t) => Math.pow(circ(t), 0.88) },
      Pomegranate: { aspect: 0.98, ang: 0, peel: 0.08, irrK: 0.55, dimple: [0.04, 0], hw: (t) => Math.pow(circ(t), 0.74) },
    };
    /* cross-section overrides when halved */
    const HALF = {
      Lemon: { aspect: 1.02, ang: 0, hw: (t) => Math.pow(circ(t), 0.92) },
      Kiwi: { aspect: 1.1, ang: 0, hw: (t) => Math.pow(circ(t), 0.92) },
      Pomegranate: { aspect: 1.0, ang: 0, hw: (t) => Math.pow(circ(t), 0.85), dimple: null },
    };

    /* ---------------- generic helpers ---------------- */
    const push = (arr, list, pen, closed) => { if (list.length >= 2) arr.push({ pts: list, closed: !!closed, layer: pen }); };
    const noiseAt = (a, b) => noise2(a, b, seed + 17);
    const inPoly = (poly) => (x, y) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const scalePoly = (poly, k, cx, cy) => poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
    const bboxP = (poly) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of poly) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };
    /* split a polyline into runs where keep(x,y) is true */
    const clipRuns = (out, list, closed, keep, pen) => {
      const src = closed ? [...list, list[0]] : list;
      let run = [];
      for (const q of src) { if (keep(q[0], q[1])) run.push(q); else { if (run.length >= 2) push(out, run, pen, false); run = []; } }
      if (run.length >= 2) push(out, run, pen, false);
    };
    /* radial lookup for a star-shaped polygon around (cx,cy) */
    const radial = (poly, cx, cy) => {
      const arr = poly.map(([x, y]) => [Math.atan2(y - cy, x - cx), Math.hypot(x - cx, y - cy)]).sort((a, b) => a[0] - b[0]);
      return (th) => {
        th = Math.atan2(Math.sin(th), Math.cos(th));
        let lo = 0, hi = arr.length - 1;
        if (th <= arr[0][0] || th >= arr[hi][0]) { const a = arr[hi], b = arr[0]; const span = (b[0] + TWO_PI) - a[0]; const u = ((th < a[0] ? th + TWO_PI : th) - a[0]) / (span || 1); return a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, u)); }
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid][0] <= th) lo = mid; else hi = mid; }
        const a = arr[lo], b = arr[hi]; const u = (th - a[0]) / ((b[0] - a[0]) || 1);
        return a[1] + (b[1] - a[1]) * u;
      };
    };
    const ellipse = (cx, cy, rx, ry, n, rot) => { const C = []; const ca = Math.cos(rot || 0), sa = Math.sin(rot || 0); for (let i = 0; i < n; i++) { const a = (i / n) * TWO_PI; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; C.push([cx + x * ca - y * sa, cy + x * sa + y * ca]); } return C; };
    const dot = (out, x, y, r, pen) => push(out, [[x + r, y], [x, y + r], [x - r, y], [x, y - r]], pen, true);
    /* leaf blade: closed outline along a curved centreline + midrib */
    const blade = (out, base, ang, len, wid, bend, pen, midrib, tipSharp) => {
      const N = 12, L = [], R = [], C = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, a = ang + bend * u;
        const cx = base[0] + Math.cos(a) * len * u, cy = base[1] + Math.sin(a) * len * u;
        const w = wid * Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, u * 0.9 + 0.05))), tipSharp ? 1.4 : 0.8);
        const nx = -Math.sin(a), ny = Math.cos(a);
        L.push([cx + nx * w, cy + ny * w]); R.push([cx - nx * w, cy - ny * w]); C.push([cx, cy]);
      }
      push(out, [...L, ...R.reverse()], pen, true);
      if (midrib) push(out, C.slice(1, N), pen, false);
    };
    const stem = (out, base, ang, len, bend, pen) => {
      const N = 6, C = [];
      for (let i = 0; i <= N; i++) { const u = i / N, a = ang + bend * u; C.push([base[0] + Math.cos(a) * len * u, base[1] + Math.sin(a) * len * u]); }
      push(out, C, pen, false);
      return C;
    };
    /* hatch a region: parallel runs at angle a, spacing s, sampled every ds */
    const hatch = (out, bb, keep, a, s, pen) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
      const R = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 1;
      const ds = Math.min(0.6, s * 0.5);
      let flip = false;
      for (let d = -R; d <= R; d += s) {
        const ox = cx + (-sa) * d, oy = cy + ca * d;
        const run = [];
        const emit = () => { if (run.length >= 2) { const q = [run[0], run[run.length - 1]]; push(out, flip ? q.reverse() : q, pen, false); } run.length = 0; };
        for (let u = -R; u <= R; u += ds) {
          const x = ox + ca * u, y = oy + sa * u;
          if (keep(x, y)) run.push([x, y]); else emit();
        }
        emit();
        flip = !flip;
      }
    };

    /* ---------------- one specimen in local coords ---------------- */
    const specimen = (kind, h, halved, r) => {
      const P0 = PROF[kind];
      const OV = halved && HALF[kind];
      const P = OV ? { ...P0, ...OV } : P0;
      const w2 = h / P.aspect / 2;
      const out = [], bodyOut = [];
      const ph = [r() * TWO_PI, r() * TWO_PI, r() * TWO_PI, r() * TWO_PI];
      const irrL = irr * (P.irrK || 1);
      const wob = (t, side) => 1 + irrL * (0.6 * Math.sin(TWO_PI * t * 1.3 + ph[side * 2]) + 0.4 * Math.sin(TWO_PI * t * 2.9 + ph[side * 2 + 1]));
      const yAt = (t) => -h / 2 + h * t;
      const hwAt = (t, side) => Math.max(0, P.hw(t)) * w2 * wob(t, side);
      let body;
      if (kind === "Starfruit" && halved) {
        /* five-point star cross-section, rounded tips */
        const R = h * 0.5, N = 90;
        body = [];
        for (let i = 0; i < N; i++) { const th = -Math.PI / 2 + (i / N) * TWO_PI; const k = 0.56 + 0.44 * Math.pow(0.5 + 0.5 * Math.cos(5 * (th + Math.PI / 2)), 0.62); const wobr = 1 + irrL * 0.4 * Math.sin(th * 3 + ph[0]); body.push([Math.cos(th) * R * k * wobr, Math.sin(th) * R * k * wobr]); }
      } else {
        const M = 56, tOf = (i) => 0.5 - 0.5 * Math.cos((Math.PI * i) / M);
        const right = [], left = [];
        for (let i = 0; i <= M; i++) { const t = tOf(i); right.push([hwAt(t, 0), yAt(t)]); left.push([-hwAt(t, 1), yAt(t)]); }
        body = [...right, ...left.reverse()].filter((q, i, arr) => i === 0 || Math.hypot(q[0] - arr[i - 1][0], q[1] - arr[i - 1][1]) > 1e-6);
        if (P.dimple) { /* push the top / bottom centre inward (apple stem cavity, calyx) */
          const [dt, db] = P.dimple, sw = w2 * 0.28;
          body = body.map(([x, y]) => { const g = Math.exp(-(x * x) / (sw * sw)); if (y < -h * 0.2) y += dt * h * g * sm((-y - h * 0.2) / (h * 0.3)); else if (y > h * 0.2) y -= db * h * g * sm((y - h * 0.2) / (h * 0.3)); return [x, y]; });
        }
      }
      push(bodyOut, body, penB, true);
      const inBody = inPoly(body);
      const rOf = radial(body, 0, 0);
      const bb = bboxP(body);
      const top = body.reduce((a, q) => (q[1] < a[1] ? q : a), body[0]);
      const topY = kind === "Apple" || kind === "Pomegranate" ? -h / 2 + (P.dimple ? P.dimple[0] * h : 0) : -h / 2;
      const meridian = (k, t0, t1, pen, arr) => { const C = []; for (let i = 0; i <= 16; i++) { const t = t0 + (t1 - t0) * (i / 16); C.push([k * hwAt(t, k < 0 ? 1 : 0), yAt(t)]); } push(arr || out, C, pen, false); };

      /* ---- flesh polygon (halved) ---- */
      let flesh = null, inFlesh = () => false;
      if (halved) { flesh = scalePoly(body, 1 - P.peel, 0, kind === "Avocado" ? h * 0.02 : 0); inFlesh = inPoly(flesh); }

      /* ---- sticker (whole fruit) ---- */
      let inSticker = () => false;
      if (!halved && p.sticker !== "None") {
        const sw = w2 * 0.5, sh = p.sticker === "Round" ? sw : sw * 0.62;
        const t = 0.35 + r() * 0.3, side = (r() - 0.5) * 0.7;
        const cx = side * hwAt(t, side > 0 ? 0 : 1), cy = yAt(t);
        const rot = -P.ang + (r() - 0.5) * 0.5;
        const sPoly = ellipse(cx, cy, sw, sh, 28, rot);
        const inS = inPoly(sPoly);
        inSticker = (x, y) => inS(x, y);
        push(out, sPoly, penS, true);
        const text = String(p.label == null ? "" : p.label).trim().slice(0, 12);
        if (text) {
          const F = fontStrokes(text, 10, 1);
          const size = Math.min(sh * 0.9, (sw * 1.45 / Math.max(1e-6, F.width)) * 10);
          if (size >= 1.6) {
            const G = fontStrokes(text, size, 1);
            const ca = Math.cos(rot), sa = Math.sin(rot);
            const ox = -G.width / 2, oy = -size / 2;
            for (const st of G.strokes) push(out, st.map(([x, y]) => [cx + (x + ox) * ca - (y + oy) * sa, cy + (x + ox) * sa + (y + oy) * ca]), penS, false);
          }
        }
      }

      /* ---- fill of the peel ---- */
      if (p.fill !== "None") {
        const keep = halved ? (x, y) => inBody(x, y) && !inFlesh(x, y) : (x, y) => inBody(x, y) && !inSticker(x, y);
        if (p.fill === "Hatch") {
          const s = Math.max(0.5, 3.2 - 2.7 * dens) * Math.max(0.5, Math.min(1.6, h / 45));
          hatch(out, bb, keep, (r() - 0.5) * 0.5 + (halved ? Math.PI / 4 : -0.6), s, penB);
        } else if (p.fill === "Contours") {
          const n = halved ? Math.max(1, Math.round(dens * 3)) : Math.round(1 + dens * 8);
          const kMin = halved ? 1 - P.peel : 0.06;
          for (let i = 1; i <= n; i++) { const k = 1 - (1 - kMin) * (i / (n + 1)); clipRuns(out, scalePoly(body, k, 0, 0), true, halved ? () => true : (x, y) => !inSticker(x, y), penB); }
        } else { /* Stipple */
          const area = (bb[2] - bb[0]) * (bb[3] - bb[1]);
          const n = Math.min(1200, Math.round(area * dens * (halved ? 0.06 : 0.12)));
          const rd = Math.max(0.15, h * 0.004);
          for (let i = 0; i < n; i++) { const x = bb[0] + r() * (bb[2] - bb[0]), y = bb[1] + r() * (bb[3] - bb[1]); if (keep(x, y)) dot(out, x, y, rd, penB); }
        }
      }

      /* ---- details: whole fruit skin ---- */
      if (!halved && det > 0) {
        if (kind === "Lemon") { const n = Math.round(det * 45); for (let i = 0; i < n; i++) { const t = 0.08 + r() * 0.84; const x = (r() * 2 - 1) * hwAt(t, 0) * 0.85, y = yAt(t); if (!inSticker(x, y)) dot(out, x, y, h * 0.004, penB); } }
        else if (kind === "Apple" || kind === "Pear") { const n = Math.round(det * (kind === "Apple" ? 14 : 30)); for (let i = 0; i < n; i++) { const t = 0.1 + r() * 0.8; const x = (r() * 2 - 1) * hwAt(t, 0) * 0.9, y = yAt(t); if (inBody(x, y) && !inSticker(x, y)) dot(out, x, y, h * 0.003, penB); } }
        else if (kind === "Kiwi") { /* fuzz: short outward hairs from the outline */
          const n = Math.round(det * 90); const L = body.length;
          for (let i = 0; i < n; i++) { const j = Math.floor(r() * L); const q = body[j], q1 = body[(j + 1) % L], q0 = body[(j + L - 1) % L]; let nx = q1[1] - q0[1], ny = -(q1[0] - q0[0]); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if (nx * q[0] + ny * q[1] < 0) { nx = -nx; ny = -ny; } const len = h * (0.012 + r() * 0.02), tw = (r() - 0.5) * 0.8; push(out, [q, [q[0] + (nx * Math.cos(tw) - ny * Math.sin(tw)) * len, q[1] + (nx * Math.sin(tw) + ny * Math.cos(tw)) * len]], penB, false); }
          push(out, ellipse(-w2 * 0.86, 0, h * 0.02, h * 0.035, 10), penB, true);
        }
        else if (kind === "Avocado") { const n = Math.round(det * 55); for (let i = 0; i < n; i++) { const t = 0.08 + r() * 0.86; const x = (r() * 2 - 1) * hwAt(t, 0) * 0.88, y = yAt(t); if (inSticker(x, y)) continue; const rr = h * (0.008 + r() * 0.008), a0 = r() * TWO_PI; push(out, [[x + Math.cos(a0) * rr, y + Math.sin(a0) * rr], [x + Math.cos(a0 + 1.2) * rr, y + Math.sin(a0 + 1.2) * rr], [x + Math.cos(a0 + 2.4) * rr, y + Math.sin(a0 + 2.4) * rr]], penB, false); } }
        else if (kind === "Fig") { const n = Math.round(2 + det * 4); for (let i = 1; i <= n; i++) { const k = (i / (n + 1)) * 1.6 - 0.8; const C = []; for (let j = 0; j <= 16; j++) { const t = 0.1 + 0.8 * (j / 16); C.push([k * hwAt(t, k < 0 ? 1 : 0), yAt(t)]); } clipRuns(out, C, false, (x, y) => !inSticker(x, y), penB); } }
        else if (kind === "Starfruit") { for (const k of [-0.58, 0.02, 0.6]) { const C = []; for (let j = 0; j <= 20; j++) { const t = 0.04 + 0.92 * (j / 20); C.push([k * hwAt(t, k < 0 ? 1 : 0) * (0.9 + 0.1 * Math.sin(Math.PI * t)), yAt(t)]); } clipRuns(out, C, false, (x, y) => !inSticker(x, y), penB); } if (det > 0.5) for (const k of [-0.32, 0.31]) { const C = []; for (let j = 0; j <= 12; j++) { const t = 0.02 + 0.96 * (j / 12); C.push([k * hwAt(t, k < 0 ? 1 : 0) * 1.02, yAt(t)]); } clipRuns(out, C, false, (x, y) => !inSticker(x, y), penB); } }
        else if (kind === "Dragon fruit") { /* pointed bracts rooted on the body, tips poking out */
          const n = Math.round(7 + det * 8);
          for (let i = 0; i < n; i++) { const t = 0.06 + 0.8 * (i / n) + r() * 0.04; const side = (i % 2 ? 1 : -1) * (0.2 + r() * 0.65); const bx = side * hwAt(t, side > 0 ? 0 : 1), by = yAt(t); const a = -Math.PI / 2 + side * 0.55 + (r() - 0.5) * 0.3; const L = h * (0.18 + r() * 0.1); blade(out, [bx * 0.72, by + h * 0.05], a, L, h * 0.034, side * 0.7, penB, false, true); }
        }
        else if (kind === "Pomegranate") { const n = Math.round(det * 8); for (let i = 0; i < n; i++) { const t = 0.15 + r() * 0.7; const x = (r() * 2 - 1) * hwAt(t, 0) * 0.85, y = yAt(t); if (inSticker(x, y)) continue; push(out, [[x, y], [x + h * 0.02 * (r() - 0.5), y + h * 0.03 * (0.5 + r())]], penB, false); } }
      }
      /* pomegranate crown belongs to the shape even at Details 0 */
      if (!halved && kind === "Pomegranate") {
        const cw = w2 * 0.3, C = [[-cw, topY + h * 0.01]];
        const nsp = 5; for (let i = 0; i < nsp; i++) { const u = (i + 0.5) / nsp; C.push([-cw + cw * 2 * (u - 0.5 / nsp) + cw * 0.15, topY - h * (0.07 + 0.04 * r())]); C.push([-cw + cw * 2 * u + cw * 0.1, topY - h * 0.03]); }
        C.push([cw, topY + h * 0.01]);
        push(out, C, penB, false);
      }

      /* ---- stems & leaves (whole fruit; halved apple / pear keep the stem) ---- */
      if (p.stems) {
        if (kind === "Apple" || kind === "Pear") {
          const a = -Math.PI / 2 + (r() - 0.5) * 0.5, len = h * (kind === "Apple" ? 0.2 : 0.26);
          const C = stem(out, [0, topY - h * 0.01], a, len, (r() - 0.5) * 0.8, penL);
          if (!halved || r() < 0.5) { const e = C[3]; const la = a + (r() < 0.5 ? 0.9 : -0.9) + (r() - 0.5) * 0.3; blade(out, e, la, h * (0.22 + r() * 0.1), h * 0.07, (r() - 0.5) * 0.6, penL, true, false); }
        } else if (!halved && kind === "Lemon") { if (r() < 0.7) { const a = -Math.PI / 2 + (r() - 0.5) * 0.6; const C = stem(out, [0, -h / 2 + h * 0.005], a, h * 0.06, 0, penL); blade(out, C[C.length - 1], a + (r() < 0.5 ? 0.7 : -0.7), h * (0.3 + r() * 0.12), h * 0.075, (r() - 0.5) * 0.5, penL, true, false); } }
        else if (!halved && kind === "Fig") { stem(out, [-h * 0.012, -h / 2], -Math.PI / 2 + 0.25, h * 0.12, 0.3, penL); stem(out, [h * 0.012, -h / 2], -Math.PI / 2 + 0.2, h * 0.12, 0.3, penL); }
        else if (!halved && kind === "Avocado") { push(out, ellipse(0, -h / 2 + h * 0.005, w2 * 0.16, h * 0.02, 10), penL, true); }
      }

      /* ---- details: halved interiors ---- */
      if (halved) {
        const fOf = radial(flesh, 0, 0);
        if (kind === "Apple" || kind === "Pear") {
          /* core lens + two seeds; no visible inset line, the skin is thin */
          const cy = kind === "Pear" ? h * 0.18 : h * 0.02, lh = h * 0.2, lw = w2 * 0.2;
          const lens = []; for (let i = 0; i <= 14; i++) { const u = i / 14; lens.push([lw * Math.sin(Math.PI * u), cy - lh + 2 * lh * u]); } for (let i = 14; i >= 0; i--) { const u = i / 14; lens.push([-lw * Math.sin(Math.PI * u), cy - lh + 2 * lh * u]); }
          push(out, lens.filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-6), penD, true);
          for (const s of [-1, 1]) { const sx = s * lw * 0.35, sy = cy + lh * 0.1; const sd = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TWO_PI; const rr = h * 0.03 * (a < Math.PI ? 1 : 0.55); sd.push([sx + Math.sin(a) * rr * 0.5 * s * -1, sy + Math.cos(a) * rr]); } push(out, sd, penD, true); }
          push(out, [[0, cy - lh], [0, topY + h * 0.02]], penD, false);
          push(out, [[0, cy + lh], [0, h / 2 - h * 0.03]], penD, false);
          if (det > 0.4) push(out, [[-w2 * 0.06, h / 2 - h * 0.05], [0, h / 2 - h * 0.02], [w2 * 0.06, h / 2 - h * 0.05]], penD, false);
        } else {
          push(out, flesh, penD, true);
          if (kind === "Lemon") {
            const rc = w2 * 0.07; push(out, ellipse(0, 0, rc, rc, 12), penD, true);
            const ns = 8 + Math.floor(r() * 3), a0 = r() * TWO_PI;
            for (let i = 0; i < ns; i++) { const a = a0 + (i / ns) * TWO_PI; const R = fOf(a) * 0.985; const g = 0.012 * w2 / Math.max(rc, 1e-6); for (const s of [-1, 1]) push(out, [[Math.cos(a + s * g) * rc, Math.sin(a + s * g) * rc], [Math.cos(a + s * g * rc / R) * R, Math.sin(a + s * g * rc / R) * R]], penD, false); }
            const nv = Math.round(det * 5); if (nv > 0) for (let i = 0; i < ns; i++) for (let k = 0; k < nv; k++) { const a = a0 + ((i + 0.12 + 0.76 * r()) / ns) * TWO_PI; const R = fOf(a); const u0 = 0.35 + r() * 0.3, u1 = Math.min(0.93, u0 + 0.15 + r() * 0.25); push(out, [[Math.cos(a) * R * u0, Math.sin(a) * R * u0], [Math.cos(a) * R * u1, Math.sin(a) * R * u1]], penD, false); }
          } else if (kind === "Kiwi") {
            push(out, ellipse(0, 0, w2 * 0.16, h * 0.15, 20), penD, true);
            const ns = Math.round(14 + det * 26); for (let i = 0; i < ns; i++) { const a = (i / ns) * TWO_PI + (r() - 0.5) * 0.2; const R = fOf(a) * (0.33 + r() * 0.16); const x = Math.cos(a) * R, y = Math.sin(a) * R; const l = h * 0.012; push(out, [[x - Math.cos(a) * l, y - Math.sin(a) * l], [x + Math.cos(a) * l, y + Math.sin(a) * l]], penD, false); }
            const nr = Math.round(det * 22); for (let i = 0; i < nr; i++) { const a = (i / nr) * TWO_PI + r() * 0.1; const R = fOf(a); push(out, [[Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5], [Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94]], penD, false); }
          } else if (kind === "Avocado") {
            const pr = w2 * 0.62, pcy = h * 0.17;
            push(out, ellipse(0, pcy, pr, pr * 1.05, 32), penD, true);
            if (det > 0) { for (const k of [0.82, 0.62]) { if (k < 0.7 && det < 0.5) break; const C = []; for (let i = 0; i <= 14; i++) { const a = Math.PI * 0.7 + (i / 14) * Math.PI * 1.1; C.push([Math.cos(a) * pr * k, pcy + Math.sin(a) * pr * 1.05 * k]); } push(out, C, penD, false); } }
          } else if (kind === "Fig") {
            const cav = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TWO_PI; const rr = h * 0.13 * (1 + 0.15 * noiseAt(i * 0.5, 3)); cav.push([Math.cos(a) * rr * 0.9, h * 0.08 + Math.sin(a) * rr]); } push(out, cav, penD, true);
            const n = Math.round(det * 60); for (let i = 0; i < n; i++) { const a = r() * TWO_PI; const R1 = fOf(a) * 0.95; const R0 = h * 0.14; const c = [0, h * 0.08]; const u0 = 0.15 + r() * 0.55; const x0 = c[0] + Math.cos(a) * (R0 + (R1 - R0) * u0) * 0.95, y0 = c[1] + Math.sin(a) * (R0 + (R1 - R0) * u0); const l = h * 0.03; push(out, [[x0, y0], [x0 + Math.cos(a) * l, y0 + Math.sin(a) * l]], penD, false); dot(out, x0 + Math.cos(a) * l * 1.15, y0 + Math.sin(a) * l * 1.15, h * 0.005, penD); }
          } else if (kind === "Starfruit") {
            const R = h * 0.5;
            push(out, ellipse(0, 0, R * 0.09, R * 0.09, 8), penD, true);
            for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + Math.PI / 5 + (i / 5) * TWO_PI; push(out, ellipse(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3, R * 0.05, R * 0.1, 10, a + Math.PI / 2), penD, true); }
            if (det > 0.3) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * TWO_PI; const R1 = fOf(a); push(out, [[Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12], [Math.cos(a) * R1 * 0.9, Math.sin(a) * R1 * 0.9]], penD, false); }
          } else if (kind === "Dragon fruit") {
            const nb = Math.round(3 + det * 5), Lb = body.length;
            for (let i = 0; i < nb; i++) { const j = Math.floor(((i + 0.3 + r() * 0.4) / nb) * Lb) % Lb; const q = body[j]; const a = Math.atan2(q[1], q[0]) + (q[1] < 0 ? (q[0] < 0 ? 0.5 : -0.5) : (q[0] < 0 ? 1 : -1) * 1.1); blade(out, [q[0] * 0.92, q[1] * 0.92], a, h * (0.1 + r() * 0.05), h * 0.025, (q[0] < 0 ? -1 : 1) * 0.5, penB, false, true); }
            const n = Math.min(500, Math.round(det * (bb[2] - bb[0]) * (bb[3] - bb[1]) * 0.06));
            for (let i = 0; i < n; i++) { const x = bb[0] + r() * (bb[2] - bb[0]), y = bb[1] + r() * (bb[3] - bb[1]); if (inFlesh(x, y) && Math.hypot(x, y) < fOf(Math.atan2(y, x)) * 0.94) dot(out, x, y, h * 0.005, penD); }
          } else if (kind === "Pomegranate") {
            const nm = 5, a0 = r() * TWO_PI, mem = [];
            for (let i = 0; i < nm; i++) { const a = a0 + (i / nm) * TWO_PI + (r() - 0.5) * 0.3; mem.push(a); const R = fOf(a) * 0.97; const C = []; for (let j = 0; j <= 8; j++) { const u = j / 8; const aa = a + 0.25 * Math.sin(Math.PI * u) * (r() > 0.5 ? 1 : -1) * 0.5; C.push([Math.cos(aa) * R * u, Math.sin(aa) * R * u]); } push(out, C, penD, false); }
            if (det > 0) {
              const cell = h * 0.075, ar = cell * 0.36;
              for (let gy = bb[1]; gy <= bb[3]; gy += cell * 0.87) { let row = 0; for (let gx = bb[0] + ((Math.round((gy - bb[1]) / (cell * 0.87)) % 2) ? cell / 2 : 0); gx <= bb[2]; gx += cell) {
                const x = gx + (r() - 0.5) * cell * 0.3, y = gy + (r() - 0.5) * cell * 0.3; row++;
                const rr = Math.hypot(x, y), th = Math.atan2(y, x);
                if (rr > fOf(th) * 0.9 || rr < h * 0.05) continue;
                let near = false; for (const a of mem) { let d = Math.abs(Math.atan2(Math.sin(th - a), Math.cos(th - a))); if (d * rr < cell * 0.45) { near = true; break; } }
                if (near || r() > 0.2 + det * 0.8) continue;
                const A = []; const rot = r() * TWO_PI; for (let k = 0; k < 6; k++) { const a = rot + (k / 6) * TWO_PI; A.push([x + Math.cos(a) * ar * (0.85 + r() * 0.3), y + Math.sin(a) * ar * (0.85 + r() * 0.3)]); } push(out, A, penD, true);
              } }
            }
          }
        }
      }
      return { body: bodyOut, parts: out };
    };

    /* ---------------- placement ---------------- */
    const rot = (list, ca, sa) => list.map((q) => ({ ...q, pts: q.pts.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]) }));
    const bboxOf = (lists) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of lists) for (const [x, y] of q.pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };
    const noOv = p.place !== "Loose (may overlap)";
    const target = Math.max(1, Math.min(60, Math.round(+p.count || 1)));
    const diag = Math.hypot(Math.max(1, W - 2 * m), Math.max(1, H - 2 * m));
    const placed = [];
    let guard = 0, made = 0;
    const order = KINDS.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    while (made < target && guard++ < target * 12 && pts < BUDGET) {
      const kind = p.kind === "Mix" ? order[made % order.length] : (PROF[p.kind] ? p.kind : "Lemon");
      const halved = p.cut === "Halved" ? true : p.cut === "Whole" ? false : rng() < 0.5;
      const h = Math.max(4, (+p.size || 10) * (1 - cl(p.sizeVar, 0, 1) * rng()));
      if (h > diag) continue;
      const PP = halved && HALF[kind] ? { ...PROF[kind], ...HALF[kind] } : PROF[kind];
      let ang = PP.ang;
      if (p.rotation === "Tilt") ang += (rng() * 2 - 1) * (Math.max(0, +p.tilt || 0) * Math.PI) / 180;
      else if (p.rotation === "Random") ang = rng() * TWO_PI;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      /* body-only rotated bbox: skip a specimen that cannot fit before building its details */
      const bw0 = (h / PP.aspect) * Math.abs(ca) + h * Math.abs(sa), bh0 = (h / PP.aspect) * Math.abs(sa) + h * Math.abs(ca);
      if (bw0 * 0.95 > W - 2 * m || bh0 * 0.95 > H - 2 * m) continue;
      const spec = specimen(kind, h, halved, rng);
      const body = rot(spec.body, ca, sa), parts = rot(spec.parts, ca, sa);
      const bb = noOv ? bboxOf([...body, ...parts]) : bboxOf(body);
      const bw = bb[2] - bb[0], bh = bb[3] - bb[1];
      if (bw > W - 2 * m || bh > H - 2 * m) continue;
      let cx = 0, cy = 0, box = null, ok = false;
      for (let tries = 0; tries < 80 && !ok; tries++) {
        cx = m - bb[0] + rng() * (W - 2 * m - bw); cy = m - bb[1] + rng() * (H - 2 * m - bh);
        box = [bb[0] + cx, bb[1] + cy, bb[2] + cx, bb[3] + cy];
        ok = true;
        for (const q of placed) { if (noOv ? !(box[2] + 1 < q[0] || box[0] - 1 > q[2] || box[3] + 1 < q[1] || box[1] - 1 > q[3]) : Math.hypot((box[0] + box[2]) / 2 - (q[0] + q[2]) / 2, (box[1] + box[3]) / 2 - (q[1] + q[3]) / 2) < 0.35 * Math.min(bw + q[2] - q[0], bh + q[3] - q[1])) { ok = false; break; } }
      }
      if (!ok) continue;
      placed.push(box);
      for (const q of [...body, ...parts]) { paths.push({ pts: q.pts.map(([x, y]) => [x + cx, y + cy]), closed: q.closed, layer: q.layer }); pts += q.pts.length; }
      made++;
    }
    for (const q of paths) q.pts = q.pts.map(([x, y]) => [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
    return applyStyle({ paths }, ins && ins[0]);
  },
};
