import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  /* Ribbon Type — lettering swept by a wide flat brush drawn as parallel
     hairlines. Each glyph is a monoline geometric skeleton of lines and arcs
     (x-height = 1, baseline y = 0, y up); Stretch X / Y and Slant deform the
     skeleton, then the ribbon is built as N offset curves of the skeleton at
     evenly spaced distances across Ribbon width. Straight parts give parallel
     lines, arcs give concentric arcs, corners mitre (bevel past the limit)
     so diagonals read as folded tape, and where the offset exceeds the local
     curvature radius the curve collapses to its centre - the inner lines of
     an arch or bowl vanish into a tiny hole exactly like a real brush.
     Facets samples arcs coarsely for an angular, folded alphabet. */
  key: "ribbontype",
  name: "Ribbon Type",
  cat: "gen",
  group: "textimg",
  desc: "Brush lettering as parallel hairlines: every letter is a monoline geometric skeleton (stems, bowls, arches - lowercase only, capitals fold to lowercase, digits and punctuation are skipped) swept by a flat brush of Ribbon width, drawn as Line gap-spaced offset curves. Straight strokes become parallel lines, bowls and arches concentric arcs that collapse into a pinhole at the centre once the ribbon is wider than the curve, and corners mitre so diagonals look like folded tape. Stretch X / Stretch Y and Slant deform the skeleton while the ribbon stays the same width; Ascender and Descender set how far stems run above and below the x-height; Facets samples arcs with few segments for an angular alphabet (1 = folded diamonds, 8 = round). Asymmetry scales each successive stroke of a letter from its own baseline anchor - Grow makes the second arch of an m or the bowl of a b larger than the stem beside it, Shrink the opposite, Alternate flips, Random draws seeded factors - by Asymmetry amount, and the advance follows the wider letter. Spacing, Align and Baseline place the word inside Margin, Fit shrinks an oversized word to the box (never grows it). Pen per letter cycles the palette. Wire Frame into Stretch Y or Slant to animate.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "text", label: "Text", type: "text", def: "origin" },
    { key: "xh", label: "x-height mm", type: "slider", min: 5, max: 200, step: 1, def: 32 },
    { key: "width", label: "Ribbon width (x x-height)", type: "slider", min: 0.05, max: 1.4, step: 0.01, def: 0.5 },
    { key: "gap", label: "Line gap mm", type: "slider", min: 0.25, max: 4, step: 0.05, def: 0.6 },
    { key: "stretchX", label: "Stretch X", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "stretchY", label: "Stretch Y", type: "slider", min: 0.3, max: 4, step: 0.05, def: 1 },
    { key: "slant", label: "Slant deg", type: "slider", min: -35, max: 35, step: 1, def: 0 },
    { key: "asc", label: "Ascender (x x-height)", type: "slider", min: 1, max: 8, step: 0.1, def: 2.6 },
    { key: "desc", label: "Descender (x x-height)", type: "slider", min: 0.1, max: 3, step: 0.1, def: 0.6 },
    { key: "facets", label: "Facets per quarter", type: "slider", min: 1, max: 8, step: 1, def: 8 },
    { key: "asym", label: "Asymmetry", type: "select", options: ["None", "Grow", "Shrink", "Alternate", "Random"], def: "None" },
    { key: "asymAmt", label: "Asymmetry amount", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4, showIf: (p) => p.asym !== "None" },
    { key: "seed", label: "Seed (Random asymmetry)", type: "seed", def: 3, showIf: (p) => p.asym === "Random" },
    { key: "spacing", label: "Letter spacing (x x-height)", type: "slider", min: -0.6, max: 1.5, step: 0.05, def: 0.12 },
    { key: "align", label: "Align", type: "select", options: ["Left", "Center", "Right"], def: "Center" },
    { key: "baseline", label: "Baseline (0 = top, 1 = bottom)", type: "slider", min: 0, max: 1, step: 0.01, def: 0.78 },
    { key: "fit", label: "Fit to margin box (shrink only)", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "penCycle", label: "Pen per letter", type: "check", def: false },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  /* ---- glyph skeletons in x-height units, y up; A = ascender, D = descender ----
     primitives: ["L", [x,y], [x,y], ...] polyline  |  ["A", cx, cy, r, a0deg, a1deg] arc, a1 > a0 = counter-clockwise
     ["@", x, y] as the first element pins the stroke's asymmetry anchor; a stroke that starts where the
     previous one ended is chained and scales about that join, otherwise about (leftmost x, baseline) */
  _glyphs(A, D) {
    const C = (cx, cy, r) => ["A", cx, cy, r, 0, 360];
    return {
      a: { adv: 1.0, s: [[C(0.5, 0.5, 0.5)], [["L", [1, 1], [1, 0]]]] },
      b: { adv: 1.0, s: [[["L", [0, A], [0, 0]]], [C(0.5, 0.5, 0.5)]] },
      c: { adv: 0.95, s: [[["A", 0.5, 0.5, 0.5, 40, 320]]] },
      d: { adv: 1.0, s: [[C(0.5, 0.5, 0.5)], [["L", [1, A], [1, 0]]]] },
      e: { adv: 1.0, s: [[["L", [0, 0.5], [1, 0.5]], ["A", 0.5, 0.5, 0.5, 0, 315]]] },
      f: { adv: 0.9, s: [[["A", 0.85, A - 0.35, 0.35, 90, 180], ["L", [0.5, A - 0.35], [0.5, 0]]], [["L", [0.15, 1], [0.85, 1]]]] },
      g: { adv: 1.0, s: [[C(0.5, 0.5, 0.5)], [["@", 1, 0], ["L", [1, 1], [1, 0.5 - D]], ["A", 0.5, 0.5 - D, 0.5, 0, -180]]] },
      h: { adv: 1.0, s: [[["L", [0, A], [0, 0]]], [["A", 0.5, 0.5, 0.5, 180, 0], ["L", [1, 0.5], [1, 0]]]] },
      i: { adv: 0.0, s: [[["L", [0, A], [0, 0]]]] },
      j: { adv: 0.5, s: [[["L", [0.5, 1], [0.5, 0.5 - D]], ["A", 0.25, 0.5 - D, 0.25, 0, -180]]] },
      k: { adv: 0.8, s: [[["L", [0, A], [0, 0]]], [["L", [0.75, 1], [0, 0.4]]], [["L", [0.22, 0.62], [0.8, 0]]]] },
      l: { adv: 0.0, s: [[["L", [0, A], [0, 0]]]] },
      m: { adv: 2.0, s: [[["L", [0, 0], [0, 0.5]], ["A", 0.5, 0.5, 0.5, 180, 0], ["L", [1, 0.5], [1, 0]]], [["L", [1, 0], [1, 0.5]], ["A", 1.5, 0.5, 0.5, 180, 0], ["L", [2, 0.5], [2, 0]]]] },
      n: { adv: 1.0, s: [[["L", [0, 1], [0, 0]]], [["A", 0.5, 0.5, 0.5, 180, 0], ["L", [1, 0.5], [1, 0]]]] },
      o: { adv: 1.0, s: [[C(0.5, 0.5, 0.5)]] },
      p: { adv: 1.0, s: [[["L", [0, 1], [0, -D]]], [C(0.5, 0.5, 0.5)]] },
      q: { adv: 1.0, s: [[C(0.5, 0.5, 0.5)], [["L", [1, 1], [1, -D]]]] },
      r: { adv: 0.6, s: [[["L", [0, 1], [0, 0]]], [["A", 0.5, 0.5, 0.5, 180, 90]]] },
      s: { adv: 1.0, s: [[["A", 0.5, 0.25, 0.25, -170, 90]], [["A", 0.5, 0.75, 0.25, 270, 10]]] },
      t: { adv: 0.75, s: [[["L", [0.35, 1 + (A - 1) * 0.55], [0.35, 0]]], [["L", [0, 1], [0.75, 1]]]] },
      u: { adv: 1.0, s: [[["L", [0, 1], [0, 0.5]], ["A", 0.5, 0.5, 0.5, 180, 360], ["L", [1, 0.5], [1, 1]]], [["L", [1, 0.5], [1, 0]]]] },
      v: { adv: 0.9, s: [[["L", [0, 1], [0.45, 0], [0.9, 1]]]] },
      w: { adv: 1.4, s: [[["L", [0, 1], [0.35, 0], [0.7, 1]]], [["L", [0.7, 1], [1.05, 0], [1.4, 1]]]] },
      x: { adv: 0.9, s: [[["L", [0, 1], [0.9, 0]]], [["L", [0, 0], [0.9, 1]]]] },
      y: { adv: 0.9, s: [[["L", [0, 1], [0.45, 0]]], [["L", [0.9, 1], [0.45, 0], [0.2, -D]]]] },
      z: { adv: 0.9, s: [[["L", [0, 1], [0.9, 1], [0, 0], [0.9, 0]]]] },
      " ": { adv: 0.6, s: [] },
    };
  },

  _layout(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const m = Math.max(0, Math.min(cl(p.margin, 0, 1e4), Math.min(W, H) / 2 - 1));
    const A = cl(p.asc, 1, 20), D = cl(p.desc, 0.05, 10);
    const G = this._glyphs(A, D);
    const text = String(p.text == null ? "" : p.text).toLowerCase();
    const sx = cl(p.stretchX, 0.05, 20), sy = cl(p.stretchY, 0.05, 20);
    const wr = cl(p.width, 0.01, 4), sp = cl(p.spacing, -1, 5);
    let xh = cl(p.xh, 1, 1e4);
    /* ---- asymmetry: scale stroke k of a glyph by f(k) about (leftmost skeleton x, baseline) ---- */
    const amt = cl(p.asymAmt, 0, 3);
    const seed = (Math.round(+p.seed) || 1) >>> 0;
    const rng = mulberry32(seed * 7717 + 11);
    const factor = (k) => {
      if (p.asym === "Grow") return 1 + amt * k;
      if (p.asym === "Shrink") return 1 / (1 + amt * k);
      if (p.asym === "Alternate") return k % 2 ? 1 + amt : 1;
      if (p.asym === "Random") return Math.max(0.25, 1 + amt * (rng() * 2 - 1));
      return 1;
    };
    const geo = (st) => st.filter((pr) => pr[0] !== "@");
    const primXs = (pr) => (pr[0] === "L" ? pr.slice(1).map((q) => q[0]) : pr[0] === "A" ? [pr[1] - pr[3], pr[1] + pr[3]] : []);
    const primYs = (pr) => (pr[0] === "L" ? pr.slice(1).map((q) => q[1]) : pr[0] === "A" ? [pr[2] - pr[3], pr[2] + pr[3]] : []);
    const arcPt = (pr, deg) => [pr[1] + Math.cos(deg * Math.PI / 180) * pr[3], pr[2] + Math.sin(deg * Math.PI / 180) * pr[3]];
    const startOf = (st) => { const pr = geo(st)[0]; return pr[0] === "L" ? pr[1] : arcPt(pr, pr[4]); };
    const endOf = (st) => { const g2 = geo(st); const pr = g2[g2.length - 1]; return pr[0] === "L" ? pr[pr.length - 1] : arcPt(pr, pr[5]); };
    /* scale a stroke by f about anchor a (raw coordinates), then translate so the anchor lands on 'to' */
    const scaleStroke = (stroke, f, a, to) => geo(stroke).map((pr) => (pr[0] === "L"
      ? ["L", ...pr.slice(1).map(([qx, qy]) => [to[0] + (qx - a[0]) * f, to[1] + (qy - a[1]) * f])]
      : ["A", to[0] + (pr[1] - a[0]) * f, to[1] + (pr[2] - a[1]) * f, pr[3] * f, pr[4], pr[5]]));
    const scaleGlyph = (strokes) => {
      const out = [];
      let prevRawEnd = null, prevEnd = null;
      strokes.forEach((st, k) => {
        const f = factor(k);
        let a, to;
        const start = startOf(st);
        if (st[0][0] === "@") { a = [st[0][1], st[0][2]]; to = a; }
        else if (prevRawEnd && Math.hypot(start[0] - prevRawEnd[0], start[1] - prevRawEnd[1]) < 1e-9) { a = start; to = prevEnd; }
        else { let ax = Infinity; for (const pr of geo(st)) for (const v of primXs(pr)) ax = Math.min(ax, v); a = [ax, 0]; to = a; }
        const sc = scaleStroke(st, f, a, to);
        out.push(sc);
        prevRawEnd = endOf(st); prevEnd = endOf(sc);
      });
      return out;
    };
    const chars = [];
    let x = 0, yMax = A, yMin = -D;
    /* advance = skeleton width + ribbon + spacing, so Spacing 0 means ribbons just touch */
    for (const ch of text) {
      const g = G[ch];
      if (!g) { if (ch !== " ") x += (0.6 + wr + sp); continue; }
      let strokes = g.s, adv = g.adv;
      if (p.asym !== "None" && strokes.length) {
        strokes = scaleGlyph(strokes);
        const edge = (ss) => { let e = -Infinity; for (const st of ss) for (const pr of st) for (const v of primXs(pr)) e = Math.max(e, v); return e; };
        adv = g.adv + (edge(strokes) - edge(g.s));
        for (const st of strokes) for (const pr of st) for (const v of primYs(pr)) { yMax = Math.max(yMax, v); yMin = Math.min(yMin, v); }
      }
      chars.push({ g: { adv, s: strokes }, x });
      x += adv + wr + sp;
    }
    if (chars.length) x -= wr + sp;
    /* extents in units before scaling: ribbon adds wr/2 all round; the word spans [ -wr/2 .. x + wr/2 ] */
    const unitsW = (x + wr) * sx;
    const unitsUp = yMax * sy + wr / 2, unitsDown = -yMin * sy + wr / 2;
    if (p.fit) {
      const kx = Math.max(1e-6, W - 2 * m) / Math.max(1e-6, unitsW * xh);
      const ky = Math.max(1e-6, H - 2 * m) / Math.max(1e-6, (unitsUp + unitsDown) * xh);
      const k = Math.min(1, kx, ky);
      xh *= k;
    }
    const wordW = unitsW * xh;
    const bx0 = p.align === "Left" ? m : p.align === "Right" ? W - m - wordW : W / 2 - wordW / 2;
    let base = m + cl(p.baseline, 0, 1) * (H - 2 * m);
    if (p.fit) base = Math.max(m + unitsUp * xh, Math.min(H - m - unitsDown * xh, base));
    const tanS = Math.tan(cl(p.slant, -80, 80) * Math.PI / 180);
    const originX = bx0 + (wr / 2) * sx * xh;
    /* unit -> mm (y up in units, y down on canvas) */
    const T = (u, v) => [originX + (u * sx + v * sy * tanS) * xh, base - v * sy * xh];
    return { chars, xh, T, A, D, wr, sx, sy, m, W, H, box: { x: bx0, y: base - unitsUp * xh, w: wordW, h: (unitsUp + unitsDown) * xh }, base };
  },

  overlay(p, ctx) {
    try {
      const L = this._layout(p, ctx);
      const g = [{ kind: "rect", x: L.m, y: L.m, w: L.W - 2 * L.m, h: L.H - 2 * L.m }];
      if (L.chars.length) { g.push({ kind: "rect", x: L.box.x, y: L.box.y, w: L.box.w, h: L.box.h }); g.push({ kind: "arrow", x1: L.box.x, y1: L.base, x2: L.box.x + L.box.w, y2: L.base }); }
      return g;
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const L = this._layout(p, ctx);
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const pen = Math.max(0, Math.min(11, Math.round(+p.layer || 0)));
    const facets = Math.max(1, Math.min(16, Math.round(+p.facets || 8)));
    const smooth = facets >= 4;
    const wmm = L.wr * L.xh;
    const gapmm = cl(p.gap, 0.1, 100);
    const N = Math.max(1, Math.min(400, Math.round(wmm / gapmm) + 1));
    const paths = [];
    let budget = 115000;
    const TWO_PI = Math.PI * 2, DEG = Math.PI / 180;

    /* ---- sample a stroke (list of primitives) into mm points with per-vertex curvature centres ---- */
    const sample = (prims, cx0) => {
      const pts = [], cc = [];  /* cc[i] = [x,y] curvature centre for arc vertices, null for line vertices */
      const push = (q, c) => { if (pts.length && Math.hypot(q[0] - pts[pts.length - 1][0], q[1] - pts[pts.length - 1][1]) < 1e-6) { if (c) cc[cc.length - 1] = c; return; } pts.push(q); cc.push(c); };
      for (const pr of prims) {
        if (pr[0] === "@") continue;
        if (pr[0] === "L") { for (let i = 1; i < pr.length; i++) push(L.T(cx0 + pr[i][0], pr[i][1]), null); }
        else {
          const [, cx, cy, r, a0, a1] = pr;
          const span = Math.abs(a1 - a0) * DEG;
          const quarters = Math.max(1, span / (Math.PI / 2));
          let n;
          if (smooth) { const rOut = (r + L.wr / 2) * L.xh * Math.max(L.sx, L.sy); n = Math.max(Math.ceil(quarters * 6), Math.ceil((span * rOut) / 1.2)); }
          else n = Math.max(1, Math.round(quarters * facets));
          const arcPts = [];
          for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * (i / n)) * DEG; arcPts.push(L.T(cx0 + cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
          /* curvature centres: circumcentre of consecutive sampled triples (exact for circles, good for stretched ones) */
          const centres = arcPts.map((q, i) => {
            if (!smooth) return null;
            const a = arcPts[Math.max(0, Math.min(arcPts.length - 3, i - 1))], b = arcPts[Math.max(1, Math.min(arcPts.length - 2, i))], c = arcPts[Math.max(2, Math.min(arcPts.length - 1, i + 1))];
            const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
            if (Math.abs(d) < 1e-9) return null;
            const ux = ((a[0] * a[0] + a[1] * a[1]) * (b[1] - c[1]) + (b[0] * b[0] + b[1] * b[1]) * (c[1] - a[1]) + (c[0] * c[0] + c[1] * c[1]) * (a[1] - b[1])) / d;
            const uy = ((a[0] * a[0] + a[1] * a[1]) * (c[0] - b[0]) + (b[0] * b[0] + b[1] * b[1]) * (a[0] - c[0]) + (c[0] * c[0] + c[1] * c[1]) * (b[0] - a[0])) / d;
            return [ux, uy];
          });
          arcPts.forEach((q, i) => push(q, centres[i]));
        }
      }
      const closed = pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6;
      if (closed) { pts.pop(); cc.pop(); }
      return { pts, cc, closed };
    };

    /* ---- offset a sampled stroke by signed distance d (left of travel), mitre joins with bevel limit, curvature collapse ---- */
    const LIMIT = 3;
    const offset = (S, d) => {
      const { pts, cc, closed } = S;
      const n = pts.length;
      if (n < 2) return null;
      const out = [];
      const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const hasPrev = closed || i > 0, hasNext = closed || i < n - 1;
        const pv = hasPrev ? pts[(i - 1 + n) % n] : null, nx = hasNext ? pts[(i + 1) % n] : null;
        const d1 = pv ? unit([p[0] - pv[0], p[1] - pv[1]]) : null, d2 = nx ? unit([nx[0] - p[0], nx[1] - p[1]]) : null;
        const n1 = d1 ? [-d1[1], d1[0]] : null, n2 = d2 ? [-d2[1], d2[0]] : null;
        let cand;
        if (n1 && n2) {
          const nb = unit([n1[0] + n2[0], n1[1] + n2[1]]);
          const cosH = nb[0] * n1[0] + nb[1] * n1[1];
          if (cosH < 1e-6 || 1 / cosH > LIMIT) { cand = [[p[0] + n1[0] * d, p[1] + n1[1] * d], [p[0] + n2[0] * d, p[1] + n2[1] * d]]; }
          else { const k = d / cosH; cand = [[p[0] + nb[0] * k, p[1] + nb[1] * k]]; }
        } else { const nn = n1 || n2; cand = [[p[0] + nn[0] * d, p[1] + nn[1] * d]]; }
        /* curvature collapse: an inward offset past the local radius lands on the centre of curvature */
        const c = cc[i];
        if (c && cand.length === 1) {
          const ux = c[0] - p[0], uy = c[1] - p[1], rho = Math.hypot(ux, uy);
          const ox = cand[0][0] - p[0], oy = cand[0][1] - p[1];
          if (rho > 1e-9 && ox * ux + oy * uy > 0 && Math.hypot(ox, oy) >= rho - 1e-9) cand = [[c[0], c[1]]];
        }
        for (const q of cand) if (!out.length || Math.hypot(q[0] - out[out.length - 1][0], q[1] - out[out.length - 1][1]) > 1e-6) out.push(q);
      }
      if (closed && out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
      if (out.length < (closed ? 3 : 2)) return null;
      return { pts: out, closed };
    };

    /* ---- sweep every stroke of every letter ---- */
    let ci = 0;
    for (const ch of L.chars) {
      const layer = p.penCycle ? (pen + ci) % 12 : pen;
      ci++;
      for (const stroke of ch.g.s) {
        const S = sample(stroke, ch.x);
        if (S.pts.length < 2) continue;
        for (let k = 0; k < N; k++) {
          const d = N === 1 ? 0 : -wmm / 2 + (wmm * k) / (N - 1);
          const O = offset(S, d);
          if (!O || budget <= 0) continue;
          const pts = k % 2 ? O.pts.slice().reverse() : O.pts;
          budget -= pts.length;
          paths.push({ pts, closed: O.closed, layer });
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
