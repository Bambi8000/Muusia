import { Pin, EMPTY, applyStyle, SFONT, fontStrokes } from "../helpers.js";

export default {
  /* Conformal Grid - the Smith chart and its relatives.

     A rectangular grid in the source plane w = R + iX is pushed through a
     conformal map into the target plane; grid lines become the curving
     families of the chart and stay orthogonal wherever they cross (any
     analytic map is conformal, which the validator checks on the output).

       Smith        z = (w-1)/(w+1)   right half-plane -> unit disc
       Admittance   z = -(w-1)/(w+1)  same, mirrored through the centre
       Immittance   both, admittance on its own pen
       Inversion    z = 1/w
       Joukowski    z = (w + 1/w)/2
       Log-polar    z = exp(w - Range)
       Power        z = (w/Range)^n

     Adaptive subdivision follows the printed chart: every major interval is
     split into Minor per major, each minor again into halves Fine depth
     times, and a sub-level line is drawn only along the stretch where the
     gap to its same-level neighbour is at least Cell mm - so the fine
     hatching appears where cells are large and fades out where they crowd.
     Majors are always drawn whole.

     Everything is polylines sampled by rendered length (Line step mm), so the
     same code serves every map; the target frame is x right / y up and is
     flipped when converted to canvas mm. _build is shared by compute and
     overlay (guarded for an unbound this). */
  key: "conformal",
  name: "Conformal Grid",
  cat: "gen",
  group: "geometric",
  desc: "The Smith chart and its relatives: a rectangular R × X grid pushed through a conformal map, so the grid lines curve into circle and arc families that stay orthogonal at every crossing. Map Smith is the impedance chart (right half-plane to the unit disc), Admittance its mirror image, Immittance both together with the admittance grid on its own pen; Inversion 1/z, Joukowski (z+1/z)/2, Log-polar exp(z) and Power z^n (Exponent) map a symmetric source grid of Range and Major lines per range. Subdivision follows the printed chart: each major interval is split into Minor per major, each minor is halved Fine depth times, and a sub-level line is drawn only along the stretch where the gap to its same-level neighbour is at least Cell mm, so fine hatching appears where cells are large and fades where they crowd; majors are always drawn whole. Clip Disc keeps the unit disc (Radius mm, shrink-only fit), Sheet lets the map run to the margin box, Wired shape clips to a wired closed path. Dressing, all optional: Axis (horizontal axis and centre mark), Scales Angle (reflection-coefficient angle ring, ticks every 2°, numbers every 10°) and Wavelength (0 to 0.5 clockwise from the left, ticks every 0.002, numbers every 0.01), Labels (SFONT values on the majors: R along the axis, X at the rim, rotated radially). Pens: Major, Minor, Fine, Admittance, Scales, Labels. No randomness.",
  ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "map", label: "Map", type: "select", options: ["Smith", "Admittance", "Immittance", "Inversion 1/z", "Joukowski", "Log-polar", "Power z^n"], def: "Smith" },
    { key: "exponent", label: "Exponent", type: "slider", min: 0.5, max: 4, step: 0.1, def: 2, showIf: (p) => p.map === "Power z^n" },
    { key: "range", label: "Range", type: "slider", min: 0.5, max: 10, step: 0.1, def: 3, showIf: (p) => !/^(Smith|Admittance|Immittance)$/.test(p.map) },
    { key: "majors", label: "Major lines per range", type: "slider", min: 1, max: 12, step: 1, def: 6, showIf: (p) => !/^(Smith|Admittance|Immittance)$/.test(p.map) },
    { key: "clip", label: "Clip", type: "select", options: ["Disc", "Sheet", "Wired shape"], def: "Disc" },
    { key: "radius", label: "Radius mm", type: "slider", min: 20, max: 300, step: 1, def: 90 },
    { key: "minorDiv", label: "Minor per major", type: "slider", min: 1, max: 10, step: 1, def: 5 },
    { key: "depth", label: "Fine depth", type: "slider", min: 0, max: 3, step: 1, def: 2 },
    { key: "cell", label: "Cell mm", type: "slider", min: 0.5, max: 10, step: 0.1, def: 1.2 },
    { key: "step", label: "Line step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.6 },
    { key: "axis", label: "Axis", type: "check", def: true },
    { key: "scales", label: "Scales", type: "select", options: ["None", "Angle", "Wavelength", "Both"], def: "Both" },
    { key: "labels", label: "Labels", type: "check", def: true },
    { key: "labelSize", label: "Label size mm", type: "slider", min: 1, max: 6, step: 0.1, def: 2.6, showIf: (p) => p.labels },
    { key: "yoff", label: "Y offset mm", type: "slider", min: -140, max: 140, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "penMajor", label: "Major pen", type: "pen", def: 0 },
    { key: "penMinor", label: "Minor pen", type: "pen", def: 9 },
    { key: "penFine", label: "Fine pen", type: "pen", def: 9 },
    { key: "penY", label: "Admittance pen", type: "pen", def: 2, showIf: (p) => p.map === "Immittance" },
    { key: "penScale", label: "Scale pen", type: "pen", def: 1, showIf: (p) => p.scales !== "None" },
    { key: "penLabel", label: "Label pen", type: "pen", def: 0, showIf: (p) => p.labels },
  ],

  _SMITH: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, 10, 20, 50],

  /* target-frame map: returns [u, v] or null when undefined */
  _f(kind, R, X, range, n) {
    if (kind === "Smith" || kind === "Admittance" || kind === "Immittance") {
      const d = (R + 1) * (R + 1) + X * X;
      if (d < 1e-12) return null;
      const u = (R * R + X * X - 1) / d, v = (2 * X) / d;
      return kind === "Admittance" ? [-u, -v] : [u, v];
    }
    if (kind === "Inversion 1/z") { const d = R * R + X * X; if (d < 1e-9) return null; return [R / d, -X / d]; }
    if (kind === "Joukowski") { const d = R * R + X * X; if (d < 1e-9) return null; return [(R + R / d) / 2, (X - X / d) / 2]; }
    if (kind === "Log-polar") { const m = Math.exp(R - range); return [m * Math.cos(X), m * Math.sin(X)]; }
    /* Power z^n on the half-plane R >= 0 */
    const m = Math.hypot(R, X) / range, a = Math.atan2(X, R);
    if (m < 1e-9) return [0, 0];
    const mn = Math.pow(m, n);
    return [mn * Math.cos(a * n), mn * Math.sin(a * n)];
  },

  /* geometry shared by compute and overlay */
  _build(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const margin = Math.max(0, Number(p.margin) || 0);
    const smith = /^(Smith|Admittance|Immittance)$/.test(p.map);
    const scales = p.scales !== "None";
    const outer = scales ? (p.scales === "Both" ? 1.245 : 1.135) : (smith && p.labels ? 1.02 : 1.0);
    const avail = Math.max(1, Math.min(W, H) / 2 - margin);
    const R0 = Math.max(1, Number(p.radius) || 90);
    const Rmm = p.clip === "Disc" ? Math.min(R0, avail / outer) : R0;
    const cx = W / 2, cy = H / 2 + (Number(p.yoff) || 0);
    return { Rmm, cx, cy, outer, smith, margin, W, H, toMM: (u, v) => [cx + u * Rmm, cy - v * Rmm] };
  },

  compute(ins, p, ctx) {
    const G = this._build(p, ctx);
    const { Rmm, cx, cy, smith, margin, W, H, toMM } = G;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pen = (v) => clamp(Math.round(Number(v) || 0), 0, 11);
    const PM = pen(p.penMajor), PN = pen(p.penMinor), PF = pen(p.penFine), PY = pen(p.penY), PS = pen(p.penScale), PL = pen(p.penLabel);
    const range = clamp(Number(p.range) || 3, 0.1, 50);
    const nPow = clamp(Number(p.exponent) || 2, 0.1, 8);
    const minorDiv = clamp(Math.round(Number(p.minorDiv) || 1), 1, 20);
    const depth = clamp(Math.round(Number(p.depth) || 0), 0, 4);
    const cellMm = Math.max(0.1, Number(p.cell) || 1.6);
    const stepMm = clamp(Number(p.step) || 0.6, 0.1, 10);
    const BUDGET = 112000;
    const kind = p.map;
    const f = (R, X) => this._f(kind, R, X, range, nPow);

    /* ---- clip predicate in target units ---- */
    const region = (ins && ins[0]) || EMPTY;
    const polys = p.clip === "Wired shape" ? (region.paths || []).filter((q) => q.closed && q.pts.length >= 3).map((q) => q.pts) : [];
    if (p.clip === "Wired shape" && !polys.length) return EMPTY;
    const pip = (x, y, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const yi = poly[a][1], yj = poly[b][1]; if ((yi > y) !== (yj > y)) { const xi = poly[a][0], xj = poly[b][0]; if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } } return c; };
    const inside = (u, v) => {
      if (p.clip === "Disc") return u * u + v * v <= 1 + 1e-9;
      const [x, y] = toMM(u, v);
      if (p.clip === "Sheet") return x >= margin && x <= W - margin && y >= margin && y <= H - margin;
      let n = 0; for (const poly of polys) if (pip(x, y, poly)) n++; return (n & 1) === 1;
    };
    const bisect = (A, B) => { /* A inside, B outside -> boundary point */
      let a = A, b = B;
      for (let k = 0; k < 18; k++) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (inside(m[0], m[1])) a = m; else b = m; }
      return a;
    };
    /* clip a target-frame polyline (with nulls as breaks) into runs, then to mm */
    /* output is collected per priority (0 = majors + dressing, 1 = minors,
       2.. = fine levels) and assembled coarse-first under the budget, so a
       heavy chart loses its finest hatching, never its skeleton */
    const buckets = [];
    let prio = 0;
    const emit = (pts, closed, layer) => { if (pts.length >= 2) { (buckets[prio] || (buckets[prio] = [])).push({ pts, closed, layer }); } };
    const emitClipped = (pts, layer) => {
      let run = [];
      const flush = () => { if (run.length >= 2) emit(run.map(([u, v]) => toMM(u, v)), false, layer); run = []; };
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        if (!q) { flush(); continue; }
        const inQ = inside(q[0], q[1]);
        const prev = i > 0 ? pts[i - 1] : null;
        if (inQ) {
          if (prev && !inside(prev[0], prev[1])) run.push(bisect(q, prev));
          run.push(q);
        } else {
          if (prev && inside(prev[0], prev[1])) { run.push(bisect(prev, q)); flush(); }
        }
      }
      flush();
    };

    /* ---- families: value lists and the parameter that runs along each line ---- */
    /* smith: R in [0, inf) via tan, X in (-inf, inf) via tan; others: finite */
    const halfPlane = smith || kind === "Power z^n";
    const majorsR = [], majorsX = [];
    if (smith) { for (const v of this._SMITH) majorsR.push(v); for (const v of this._SMITH) { if (v === 0) majorsX.push(0); else { majorsX.push(v); majorsX.push(-v); } } }
    else {
      const nM = clamp(Math.round(Number(p.majors) || 1), 1, 40);
      const st = range / nM;
      if (kind === "Log-polar") { for (let k = -nM; k <= nM; k++) majorsR.push(k * st); for (let k = -12; k < 12; k++) majorsX.push(k * Math.PI / 12); }
      else if (kind === "Power z^n") { for (let k = 0; k <= nM; k++) majorsR.push(k * st); for (let k = -nM; k <= nM; k++) majorsX.push(k * st); }
      else { for (let k = -nM; k <= nM; k++) { majorsR.push(k * st); majorsX.push(k * st); } }
    }
    majorsR.sort((a, b) => a - b); majorsX.sort((a, b) => a - b);
    /* sub-levels: level 1 = minors, level 2.. = halvings */
    const levels = (majors) => {
      const out = [{ vals: majors.slice(), step: null }];
      let prev = majors.slice();
      for (let L = 1; L <= depth + 1; L++) {
        if (L === 1 && minorDiv <= 1) { out.push({ vals: [], step: null }); continue; }
        const div = L === 1 ? minorDiv : 2;
        const vals = [], all = prev.slice().sort((a, b) => a - b);
        for (let i = 0; i + 1 < all.length; i++) { const a = all[i], b = all[i + 1]; for (let k = 1; k < div; k++) vals.push(a + (b - a) * k / div); }
        out.push({ vals, step: null });
        prev = all.concat(vals);
      }
      return out;
    };
    const lvR = levels(majorsR), lvX = levels(majorsX);
    /* the neighbour distance at a level: nearest other value at that level or above */
    const neighbourStep = (allSorted, c) => { let best = Infinity; for (const v of allSorted) { const d = Math.abs(v - c); if (d > 1e-12 && d < best) best = d; } return best; };

    /* along-line parameter ranges */
    const NC = 64;   /* coarse samples for the length estimate */
    const paramX = (t) => smith ? Math.tan((t - 0.5) * Math.PI * 0.998) : kind === "Log-polar" ? -Math.PI + t * 2 * Math.PI : (t - 0.5) * 2 * range;
    const paramR = (t) => smith ? Math.tan(t * Math.PI / 2 * 0.998) : halfPlane ? t * range : (t - 0.5) * 2 * range;
    const lineAlongX = (Rc, N) => { const o = []; for (let i = 0; i <= N; i++) o.push(f(Rc, paramX(i / N))); return o; };
    const lineAlongR = (Xc, N) => { const o = []; for (let i = 0; i <= N; i++) o.push(f(paramR(i / N), Xc)); return o; };
    const clippedLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (!a || !b) continue; if (!inside(a[0], a[1]) && !inside(b[0], b[1])) continue; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L * Rmm; };
    const sampleCount = (pts) => clamp(Math.ceil(clippedLen(pts) / stepMm), 12, 2600);

    /* draw one family; level 0 whole, deeper levels gap-pruned against their neighbours */
    const family = (isR, lv, mirror, penFor) => {
      const seen = [];
      lv.forEach((level, L) => {
        const allHere = seen.concat(level.vals).sort((a, b) => a - b);
        for (const c of level.vals) {
          const coarse = isR ? lineAlongX(c, NC) : lineAlongR(c, NC);
          const N = sampleCount(coarse);
          let pts = isR ? lineAlongX(c, N) : lineAlongR(c, N);
          if (L > 0) {
            const s = neighbourStep(allHere, c);
            if (!Number.isFinite(s)) continue;
            pts = pts.map((q, i) => {
              if (!q) return null;
              const t = i / N;
              const nA = isR ? f(c + s, paramX(t)) : f(paramR(t), c + s), nB = isR ? f(c - s, paramX(t)) : f(paramR(t), c - s);
              const gA = nA ? Math.hypot(nA[0] - q[0], nA[1] - q[1]) * Rmm : Infinity, gB = nB ? Math.hypot(nB[0] - q[0], nB[1] - q[1]) * Rmm : Infinity;
              return Math.min(gA, gB) >= cellMm ? q : null;
            });
          }
          if (mirror) pts = pts.map((q) => q ? [-q[0], -q[1]] : null);
          prio = L;
          emitClipped(pts, penFor(L));
          prio = 0;
        }
        seen.push(...level.vals);
      });
    };
    const penFor = (L) => L === 0 ? PM : L === 1 ? PN : PF;
    const drawGrid = (mirror, penAll) => {
      const pf = penAll === null ? penFor : () => penAll;
      family(true, lvR, mirror, pf);
      family(false, lvX, mirror, pf);
    };
    if (kind === "Immittance") { drawGrid(false, null); drawGrid(true, PY); }
    else drawGrid(false, null);

    /* ---- text helper: SFONT in the target frame, rotated so "up" points along angle a ---- */
    const text = (str, size, anchorU, anchorV, a, layer, align) => {
      const fs = fontStrokes(str, size);
      const w = fs.width - size * 0.2;
      const ox = align === "left" ? 0 : align === "right" ? -w : -w / 2;
      const ca = Math.cos(a - Math.PI / 2), sa = Math.sin(a - Math.PI / 2);
      for (const st of fs.strokes) {
        const pts = st.map(([gx, gy]) => {
          const lx = (gx + ox) / Rmm, ly = (size / 2 - gy) / Rmm;   /* glyph -> target units, y up */
          return toMM(anchorU + lx * ca - ly * sa, anchorV + lx * sa + ly * ca);
        });
        emit(pts, false, layer);
      }
    };
    const fmt = (v) => { const s = Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 1000) / 1000); return s; };

    /* ---- Smith dressing ---- */
    if (smith && p.axis) {
      emitClipped([[-1, 0], [1, 0]], PM);
      const m = 0.02; emit([toMM(-m, 0), toMM(m, 0)], false, PM); emit([toMM(0, -m), toMM(0, m)], false, PM);
    }
    if (smith && p.labels) {
      const size = Math.min(clamp(Number(p.labelSize) || 2.6, 0.5, 20), Rmm * 0.04) / Rmm;   /* target units, capped for small charts */
      /* R values just above the axis at the point where the circle crosses it */
      for (const c of majorsR) { if (c === 0) continue; const q = f(c, 0); if (!q) continue; text(fmt(c), size * Rmm, q[0], size * 0.35, Math.PI, PL, "left"); }
      /* X values at the rim, upright along the radius, slightly inside */
      for (const c of majorsX) { if (c === 0) continue; const q = f(0, c); if (!q) continue; const a = Math.atan2(q[1], q[0]); const rr = 1 - size * 0.9; text(fmt(c), size * Rmm, rr * Math.cos(a), rr * Math.sin(a), a, PL, "center"); }
    }
    if (smith && p.scales !== "None") {
      const rings = [];
      if (p.scales === "Angle" || p.scales === "Both") rings.push({ kind: "angle", r0: 1.04, r1: 1.135 });
      if (p.scales === "Wavelength" || p.scales === "Both") rings.push({ kind: "wl", r0: p.scales === "Both" ? 1.15 : 1.04, r1: p.scales === "Both" ? 1.245 : 1.135 });
      const circle = (r, layer) => { const n = clamp(Math.ceil((2 * Math.PI * r * Rmm) / stepMm), 48, 2000); const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push(toMM(r * Math.cos(a), r * Math.sin(a))); } emit(o, true, layer); };
      const tick = (a, ra, rb, layer) => emit([toMM(ra * Math.cos(a), ra * Math.sin(a)), toMM(rb * Math.cos(a), rb * Math.sin(a))], false, layer);
      const lsize = Math.min(clamp(Number(p.labelSize) || 2.6, 0.5, 20), Rmm * 0.04) * 0.85;
      for (const ring of rings) {
        circle(ring.r0, PS); circle(ring.r1, PS);
        const rt = ring.r0 + (ring.r1 - ring.r0) * 0.42;   /* tick base */
        if (ring.kind === "angle") {
          for (let d = -180; d < 180; d += 2) {
            const a = d * Math.PI / 180;
            const len = d % 10 === 0 ? 0.035 : 0.017;
            tick(a, ring.r0, ring.r0 + len, PS);
            if (d % 10 === 0) text(d === -180 ? "180" : String(d), lsize, (rt + 0.03) * Math.cos(a), (rt + 0.03) * Math.sin(a), a, PS, "center");
          }
        } else {
          /* wavelengths toward the generator: 0 at the left, clockwise */
          for (let k = 0; k < 250; k++) {
            const wl = k * 0.002;
            const a = Math.PI - wl * 4 * Math.PI;
            const isTen = k % 5 === 0;
            tick(a, ring.r0, ring.r0 + (isTen ? 0.035 : 0.017), PS);
            if (isTen) text(fmt(wl), lsize, (rt + 0.03) * Math.cos(a), (rt + 0.03) * Math.sin(a), a, PS, "center");
          }
        }
      }
    }

    const paths = [];
    let total = 0;
    buckets.forEach((b, i) => {
      if (!b || total >= BUDGET) return;
      const n = b.reduce((a, q) => a + q.pts.length, 0);
      if (i === 0) { for (const q of b) { if (total + q.pts.length > BUDGET) break; paths.push(q); total += q.pts.length; } return; }   /* skeleton: as much as fits */
      if (total + n > BUDGET) { total = BUDGET; return; }   /* a sub-level is all or nothing, and nothing finer follows */
      paths.push(...b); total += n;
    });
    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      const guides = [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
      const G = this && typeof this._build === "function" ? this._build(p, ctx) : null;
      if (G) {
        guides.push({ kind: "circle", x: G.cx, y: G.cy, r: G.Rmm });
        if (G.outer > 1) guides.push({ kind: "circle", x: G.cx, y: G.cy, r: G.Rmm * G.outer });
      }
      return guides;
    } catch (e) { return []; }
  },
};
