import { Pin, EMPTY, hash2, resample, pathLength, applyStyle, SFONT, fontStrokes } from "../helpers.js";

export default {
  /* Kolam - sikku / kambi kolam as Gerdes mirror curves.

     Dots sit on a square lattice. A ray travels at 45 degrees between the dots
     and at every midpoint between two neighbouring dots it either CROSSES
     (continues straight into the next cell) or TURNS (a mirror on that edge
     reflects it, so it keeps circling the same dot). Edges on the outside of
     the dot set always reflect, which gives the teardrop loops around the
     border dots. Every ray closes on itself, so the output is a set of closed
     strands; interior mirrors change the strand count by 0 or +-1, which lets
     "Single line" merge everything into one unbroken sikku deterministically.

     Coordinates: dots at integer (i, j); midpoints are stored DOUBLED so they
     stay integers: (2i+1, 2j) is the vertical edge between (i,j) and (i+1,j),
     (2i, 2j+1) the horizontal edge between (i,j) and (i,j+1). A ray step adds
     (dx, dy) in doubled units, so the two midpoint kinds always alternate.

     Render: Centerline (the ray, Chaikin-rounded), Ribbon (one SDF isoline at
     Width/2 - the crossings fuse like rice paste) or Contours (nested isolines).
     Under gaps: consistent alternating over/under (at horizontal-edge
     crossings the NE/SW pass is over, at vertical-edge crossings the NW/SE
     pass is over - this alternates along every strand regardless of turns).

     _build is shared by compute and overlay (the engine calls both as methods
     on the definition; overlay guards for an unbound this). */
  key: "kolam",
  name: "Kolam",
  cat: "gen",
  group: "geometric",
  desc: "Sikku (kambi) kolam: one or more closed loops winding at 45° through a grid of dots, drawn as mirror curves. At every midpoint between two neighbouring dots the line either crosses straight into the next cell or turns and keeps circling the same dot; on the outer edge it always turns, which gives the teardrop loops around the border dots. Layout Interlaced (the classic idukku pulli chart: Rows display rows alternating Cols and Cols−1 dots), Square (Cols × Rows), Diamond (dots with |i|+|j| ≤ Radius) or Wired region (dots wherever the wired closed shape covers the lattice at Pitch); Rotate 45° gives the classic diamond-standing chart. Turns % is the density of interior turns (seeded); Strands Free keeps whatever the mirrors give, Single line merges all strands into one unbroken kolam by toggling turns where two strands meet, Target count aims at N strands. Loop reach stretches the border loops outward, Roundness rounds the 45° polyline into smooth arcs around the dots (0 = angular). Crossings Cross draws real X crossings, Under gaps cuts the under strand at every crossing with a consistent alternating over/under, the knot look. Render Centerline plots the line itself; Ribbon plots one distance-field isoline at Width/2 around the whole line, so crossings fuse into one shape like paste on the floor; Contours nests Contours isolines Contour step apart; Centerline + ribbon draws both on separate pens. Dots draws the dot grid, Row numbers or Strand numbers write SFONT digits at the dots (Number size), the way kolam charts count rows. Pen per strand cycles a pen per closed loop. Pitch stays exact unless the drawing (loops included) cannot fit inside Margin, when it shrinks.",
  ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "layout", label: "Layout", type: "select", options: ["Interlaced", "Square", "Diamond", "Wired region"], def: "Interlaced" },
    { key: "cols", label: "Cols (long row)", type: "slider", min: 1, max: 24, step: 1, def: 4, showIf: (p) => p.layout === "Square" || p.layout === "Interlaced" },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 31, step: 1, def: 7, showIf: (p) => p.layout === "Square" || p.layout === "Interlaced" },
    { key: "radius", label: "Radius (dots)", type: "slider", min: 1, max: 12, step: 1, def: 3, showIf: (p) => p.layout === "Diamond" },
    { key: "rot45", label: "Rotate 45°", type: "check", def: false },
    { key: "pitch", label: "Pitch mm", type: "slider", min: 4, max: 80, step: 0.5, def: 24 },
    { key: "turns", label: "Turns %", type: "slider", min: 0, max: 100, step: 1, def: 12 },
    { key: "strands", label: "Strands", type: "select", options: ["Free", "Single line", "Target count"], def: "Single line" },
    { key: "strandN", label: "Target strands", type: "slider", min: 1, max: 8, step: 1, def: 2, showIf: (p) => p.strands === "Target count" },
    { key: "reach", label: "Loop reach", type: "slider", min: 0, max: 2, step: 0.05, def: 1 },
    { key: "turnSize", label: "Turn size", type: "slider", min: 0, max: 1.5, step: 0.05, def: 0.9 },
    { key: "round", label: "Roundness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8 },
    { key: "cross", label: "Crossings", type: "select", options: ["Cross", "Under gaps"], def: "Cross" },
    { key: "gap", label: "Gap mm", type: "slider", min: 0.5, max: 10, step: 0.25, def: 2.5, showIf: (p) => p.cross === "Under gaps" },
    { key: "render", label: "Render", type: "select", options: ["Centerline", "Ribbon", "Contours", "Centerline + ribbon"], def: "Centerline" },
    { key: "width", label: "Width mm", type: "slider", min: 0.5, max: 24, step: 0.25, def: 5, showIf: (p) => p.render !== "Centerline" },
    { key: "contours", label: "Contours", type: "slider", min: 1, max: 8, step: 1, def: 3, showIf: (p) => p.render === "Contours" },
    { key: "cstep", label: "Contour step mm", type: "slider", min: 0.5, max: 15, step: 0.25, def: 3, showIf: (p) => p.render === "Contours" },
    { key: "fcell", label: "Field cell mm", type: "slider", min: 0.4, max: 4, step: 0.1, def: 1.2, showIf: (p) => p.render !== "Centerline" },
    { key: "dots", label: "Dots", type: "select", options: ["None", "Dots", "Row numbers", "Strand numbers"], def: "Row numbers" },
    { key: "dotSize", label: "Dot size mm", type: "slider", min: 0.3, max: 8, step: 0.1, def: 1.6, showIf: (p) => p.dots === "Dots" },
    { key: "numSize", label: "Number size mm", type: "slider", min: 1.5, max: 14, step: 0.5, def: 4.5, showIf: (p) => p.dots === "Row numbers" || p.dots === "Strand numbers" },
    { key: "penPer", label: "Pen per strand", type: "check", def: false },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Line pen", type: "pen", def: 0 },
    { key: "penRibbon", label: "Ribbon pen", type: "pen", def: 1, showIf: (p) => p.render === "Centerline + ribbon" },
    { key: "penDots", label: "Dot / number pen", type: "pen", def: 2, showIf: (p) => p.dots !== "None" },
  ],

  /* ---------------------------------------------------------------- build
     Returns { dots, curves, place } or null.
       dots  : array of [i, j]
       curves: array of { nodes: [{X, Y, refl, bnd, dx, dy}] } (doubled coords,
               dx/dy = direction the ray LEAVES the node with; refl = turned
               here; bnd = turned on an outer edge)
       place : { px (mm per lattice unit), ox, oy, rot (bool), toMM(i, j) } */
  _build(p, ctx, ins) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const seed = Math.round(Number(p.seed) || 0);
    const turns = clamp(Number(p.turns) || 0, 0, 100) / 100;
    const rot = !!p.rot45;
    const margin = Math.max(0, Number(p.margin) || 0);
    const pitch0 = Math.max(0.5, Number(p.pitch) || 24);
    const reach = clamp(Number(p.reach) || 0, 0, 4);
    const R2 = Math.SQRT1_2;
    const rotXY = (i, j) => rot ? [(i - j) * R2, (i + j) * R2] : [i, j];

    /* ---- dot set ---- */
    const dots = [];
    const dset = new Set();
    const add = (i, j) => { const k = i + "," + j; if (!dset.has(k)) { dset.add(k); dots.push([i, j]); } };
    let px = pitch0, ox = 0, oy = 0;
    if (p.layout === "Diamond") {
      const rad = clamp(Math.round(Number(p.radius) || 1), 1, 20);
      for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (Math.abs(i) + Math.abs(j) <= rad) add(i, j);
    } else if (p.layout === "Wired region") {
      const src = (ins && ins[0]) || EMPTY;
      const polys = (src.paths || []).filter((q) => q.closed && q.pts.length >= 3).map((q) => q.pts);
      if (!polys.length) return null;
      const pip = (x, y, poly) => {
        let c = false;
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
          const yi = poly[a][1], yj = poly[b][1];
          if ((yi > y) !== (yj > y)) { const xi = poly[a][0], xj = poly[b][0]; if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; }
        }
        return c;
      };
      const inside = (x, y) => { let n = 0; for (const poly of polys) if (pip(x, y, poly)) n++; return (n & 1) === 1; };
      /* lattice anchored at the canvas centre, in canvas mm; dots wherever the
         lattice point AND its cell are inside (cell centre test only) */
      ox = W / 2; oy = H / 2;
      const span = Math.ceil(Math.hypot(W, H) / px) + 2;
      const cap = 900;
      for (let j = -span; j <= span && dots.length < cap; j++) for (let i = -span; i <= span && dots.length < cap; i++) {
        const [rx, ry] = rotXY(i, j);
        if (inside(ox + rx * px, oy + ry * px)) add(i, j);
      }
      if (!dots.length) return null;
    } else if (p.layout === "Interlaced") {
      /* idukku pulli: display rows alternate cols and cols-1 dots, offset by
         half a step. In lattice terms u = i - j runs across a row, v = i + j
         is the row; u and v must share parity for i, j to be integers. */
      const cols = clamp(Math.round(Number(p.cols) || 1), 1, 40), rows = clamp(Math.round(Number(p.rows) || 1), 1, 60);
      const v0 = (cols - 1) & 1;
      for (let r = 0; r < rows; r++) {
        const v = v0 + r;
        const n = (r & 1) === 0 ? cols : cols - 1;
        if (n <= 0) continue;
        for (let k = 0; k < n; k++) { const u = -(n - 1) + 2 * k; add((u + v) / 2, (v - u) / 2); }
      }
      if (!dots.length) return null;
    } else {
      const cols = clamp(Math.round(Number(p.cols) || 1), 1, 40), rows = clamp(Math.round(Number(p.rows) || 1), 1, 40);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) add(i, j);
    }
    const has = (i, j) => dset.has(i + "," + j);

    /* ---- interior edges + seeded mirrors ---- */
    /* edge key = doubled midpoint "X,Y" */
    const edges = [];
    for (const [i, j] of dots) {
      if (has(i + 1, j)) edges.push([2 * i + 1, 2 * j]);
      if (has(i, j + 1)) edges.push([2 * i, 2 * j + 1]);
    }
    edges.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const mirrors = new Set();
    for (const [X, Y] of edges) if (hash2(X, Y, seed + 31) < turns) mirrors.add(X + "," + Y);

    /* ---- ray tracing ---- */
    const trace = () => {
      const curves = [];
      const stateCurve = new Map();     /* "X,Y,dx,dy" -> curve index (both orientations) */
      const sk = (X, Y, dx, dy) => X + "," + Y + "," + dx + "," + dy;
      const step = (X, Y, dx, dy) => {
        /* advance one diagonal step from midpoint (X,Y) leaving with (dx,dy);
           returns the next node with the direction it leaves with */
        const nX = X + dx, nY = Y + dy;
        let refl = false, bnd = false, ndx = dx, ndy = dy;
        if ((nX & 1) === 0) {
          /* horizontal edge between (nX/2, (nY-1)/2) and (nX/2, (nY+1)/2); we move in dy */
          const i = nX / 2, jTo = (nY + dy) / 2;
          const inter = has(i, jTo);
          if (!inter || mirrors.has(nX + "," + nY)) { refl = true; bnd = !inter; ndy = -dy; }
        } else {
          const j = nY / 2, iTo = (nX + dx) / 2;
          const inter = has(iTo, j);
          if (!inter || mirrors.has(nX + "," + nY)) { refl = true; bnd = !inter; ndx = -dx; }
        }
        return { X: nX, Y: nY, refl, bnd, dx: ndx, dy: ndy, inx: dx, iny: dy };
      };
      /* start states: for every dot, its four edges, the two directions that
         leave the midpoint INTO this dot's cell */
      for (const [i, j] of dots) {
        const starts = [
          [2 * i - 1, 2 * j, 1, 1], [2 * i - 1, 2 * j, 1, -1],     /* W edge, leaving east */
          [2 * i + 1, 2 * j, -1, 1], [2 * i + 1, 2 * j, -1, -1],   /* E edge, leaving west */
          [2 * i, 2 * j - 1, 1, 1], [2 * i, 2 * j - 1, -1, 1],     /* S edge, leaving north */
          [2 * i, 2 * j + 1, 1, -1], [2 * i, 2 * j + 1, -1, -1],   /* N edge, leaving south */
        ];
        for (const [X, Y, dx, dy] of starts) {
          const k0 = sk(X, Y, dx, dy);
          if (stateCurve.has(k0)) continue;
          const idx = curves.length;
          const nodes = [];
          let cur = { X, Y, dx, dy, refl: false, bnd: false };
          let guard = 0;
          for (;;) {
            const nx = step(cur.X, cur.Y, cur.dx, cur.dy);
            stateCurve.set(sk(cur.X, cur.Y, cur.dx, cur.dy), idx);
            stateCurve.set(sk(nx.X, nx.Y, -cur.dx, -cur.dy), idx);   /* reverse orientation */
            nodes.push(nx);
            cur = nx;
            if (nx.X === X && nx.Y === Y && nx.dx === dx && nx.dy === dy) break;
            if (++guard > 200000) break;
          }
          /* the first entry in nodes is the node AFTER the start; the loop closes
             when the start state recurs, so the last node IS the start node */
          curves.push({ nodes });
        }
      }
      return { curves, stateCurve, sk };
    };
    let T = trace();

    /* ---- strand count control ---- */
    const target = p.strands === "Single line" ? 1 : p.strands === "Target count" ? clamp(Math.round(Number(p.strandN) || 1), 1, 40) : 0;
    if (target > 0 && edges.length) {
      const order = edges.map((e, k) => [hash2(e[0], e[1], seed + 77), k]).sort((a, b) => a[0] - b[0]).map((a) => edges[a[1]]);
      const sides = (X, Y) => {
        const m = mirrors.has(X + "," + Y);
        const c1 = T.stateCurve.get(T.sk(X, Y, 1, 1));
        const c2 = T.stateCurve.get(m && (X & 1) === 0 ? T.sk(X, Y, 1, -1) : T.sk(X, Y, -1, 1));
        return [c1, c2];
      };
      const toggle = (X, Y) => { const k = X + "," + Y; if (mirrors.has(k)) mirrors.delete(k); else mirrors.add(k); };
      let guard = 0;
      while (T.curves.length > target && guard++ < 4000) {
        let done = false;
        for (const [X, Y] of order) {
          const [c1, c2] = sides(X, Y);
          if (c1 !== undefined && c2 !== undefined && c1 !== c2) { toggle(X, Y); T = trace(); done = true; break; }
        }
        if (!done) break;
      }
      guard = 0;
      while (T.curves.length < target && guard++ < 4000) {
        let done = false;
        for (const [X, Y] of order) {
          const [c1, c2] = sides(X, Y);
          if (c1 === c2) {
            const before = T.curves.length;
            toggle(X, Y); const T2 = trace();
            if (T2.curves.length > before) { T = T2; done = true; break; }
            toggle(X, Y);
          }
        }
        if (!done) break;
      }
    }

    /* ---- placement ---- */
    let place;
    if (p.layout === "Wired region") {
      place = { px, ox, oy, rot, toMM: (i, j) => { const [rx, ry] = rotXY(i, j); return [ox + rx * px, oy + ry * px]; } };
    } else {
      /* extent in lattice units incl. loops, then shrink-only fit */
      const ext = 0.5 + reach * 0.5 + 0.6;   /* half cell + loop apex + slack */
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [i, j] of dots) { const [rx, ry] = rotXY(i, j); x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); y0 = Math.min(y0, ry); y1 = Math.max(y1, ry); }
      x0 -= ext; x1 += ext; y0 -= ext; y1 += ext;
      const avW = Math.max(1, W - 2 * margin), avH = Math.max(1, H - 2 * margin);
      px = Math.min(pitch0, avW / (x1 - x0), avH / (y1 - y0));
      ox = W / 2 - ((x0 + x1) / 2) * px; oy = H / 2 - ((y0 + y1) / 2) * px;
      place = { px, ox, oy, rot, toMM: (i, j) => { const [rx, ry] = rotXY(i, j); return [ox + rx * px, oy + ry * px]; }, bbox: [ox + x0 * px, oy + y0 * px, (x1 - x0) * px, (y1 - y0) * px] };
    }
    return { dots, curves: T.curves, mirrors, edges, place, has };
  },

  compute(ins, p, ctx) {
    const B = this._build(p, ctx, ins);
    if (!B) return EMPTY;
    const { dots, curves, place } = B;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pen = (v) => clamp(Math.round(Number(v) || 0), 0, 11);
    const PL = pen(p.layer), PR = pen(p.penRibbon), PD = pen(p.penDots);
    const px = place.px;
    const reach = clamp(Number(p.reach) || 0, 0, 4);
    const turnSize = clamp(Number(p.turnSize) || 0, 0, 1);
    const iters = Math.round(clamp(Number(p.round) || 0, 0, 1) * 4);
    const BUDGET = 112000;
    const R2 = Math.SQRT1_2;
    const toMM = (x, y) => place.toMM(x, y);   /* lattice (real) -> mm, handles rotation */

    /* ---- control polygons -> smoothed centerlines (mm) ---- */
    const strands = [];
    for (const cv of curves) {
      const ctrl = [];
      const under = [];     /* mm points where THIS strand passes under */
      for (const n of cv.nodes) {
        let x = n.X / 2, y = n.Y / 2;
        if (n.refl) {
          /* push the turning point outward, away from the cell being circled */
          const out = (n.X & 1) === 0 ? [0, n.iny] : [n.inx, 0];
          const d = n.bnd ? reach * 0.5 : turnSize * 0.5;
          x += out[0] * d; y += out[1] * d;
        } else if (p.cross === "Under gaps") {
          const over = (n.X & 1) === 0 ? n.dx * n.dy > 0 : n.dx * n.dy < 0;
          if (!over) {
            const P = toMM(x, y), Q = toMM(x + n.dx * 0.5, y + n.dy * 0.5);
            const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1;
            under.push([P[0], P[1], (Q[0] - P[0]) / L, (Q[1] - P[1]) / L]);
          }
        }
        ctrl.push(toMM(x, y));
      }
      if (ctrl.length < 2) continue;
      /* Chaikin corner cutting on the closed polygon; collinear runs stay straight */
      let pts = ctrl;
      for (let k = 0; k < iters; k++) {
        const o = [];
        for (let a = 0; a < pts.length; a++) {
          const A = pts[a], Bp = pts[(a + 1) % pts.length];
          o.push([0.75 * A[0] + 0.25 * Bp[0], 0.75 * A[1] + 0.25 * Bp[1]]);
          o.push([0.25 * A[0] + 0.75 * Bp[0], 0.25 * A[1] + 0.75 * Bp[1]]);
        }
        pts = o;
      }
      strands.push({ pts, under });
    }
    if (!strands.length) return EMPTY;

    const paths = [];
    let total = 0;
    const push = (pts, closed, layer) => { if (pts.length >= 2 && total < BUDGET) { paths.push({ pts, closed, layer }); total += pts.length; } };
    const strandPen = (k) => p.penPer ? (PL + k) % 12 : PL;

    /* ---- centerline output (with optional under gaps) ---- */
    const wantLine = p.render === "Centerline" || p.render === "Centerline + ribbon";
    if (wantLine) {
      const g = Math.max(0.1, Number(p.gap) || 0) / 2;
      strands.forEach((s, k) => {
        if (!s.under.length) { push(s.pts, true, strandPen(k)); return; }
        /* resample the closed loop, drop samples within g of an under point,
           emit the remaining runs as open paths */
        const rs = resample(s.pts, true, Math.min(0.6, g / 2));
        /* a sample is cut when it is within g of an under point AND travels
           along that pass - the same strand also crosses the point on top */
        const cut = rs.map(([x, y], a) => {
          const A = rs[(a - 1 + rs.length) % rs.length], Bq = rs[(a + 1) % rs.length];
          const tx = Bq[0] - A[0], ty = Bq[1] - A[1], L = Math.hypot(tx, ty) || 1;
          return s.under.some(([ux, uy, udx, udy]) => Math.hypot(x - ux, y - uy) < g && Math.abs((tx * udx + ty * udy) / L) > 0.7);
        });
        /* rotate so the loop starts on a cut sample (a gap), then split */
        let start = cut.indexOf(true);
        if (start < 0) { push(s.pts, true, strandPen(k)); return; }
        let run = [];
        for (let a = 1; a <= rs.length; a++) {
          const idx = (start + a) % rs.length;
          if (cut[idx]) { if (run.length >= 2) push(run, false, strandPen(k)); run = []; }
          else run.push(rs[idx]);
        }
        if (run.length >= 2) push(run, false, strandPen(k));
      });
    }

    /* ---- SDF ribbon / contours ---- */
    if (p.render !== "Centerline") {
      const width = Math.max(0.2, Number(p.width) || 1);
      const cell = clamp(Number(p.fcell) || 1.2, 0.3, 6);
      const levels = [];
      if (p.render === "Contours") { const n = clamp(Math.round(Number(p.contours) || 1), 1, 12), st = Math.max(0.1, Number(p.cstep) || 1); for (let k = 0; k < n; k++) levels.push(width / 2 + k * st); }
      else levels.push(width / 2);
      const maxD = levels[levels.length - 1] + cell * 2;
      /* segments of every centerline (closed loops, before gap cutting) */
      const segs = [];
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const s of strands) {
        const q = s.pts;
        for (let a = 0; a < q.length; a++) {
          const A = q[a], Bp = q[(a + 1) % q.length];
          segs.push([A[0], A[1], Bp[0], Bp[1]]);
          bx0 = Math.min(bx0, A[0]); bx1 = Math.max(bx1, A[0]); by0 = Math.min(by0, A[1]); by1 = Math.max(by1, A[1]);
        }
      }
      const bs = Math.max(2, cell * 3);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]), y0 = Math.min(s[1], s[3]), y1 = Math.max(s[1], s[3]);
        for (let by = Math.floor(y0 / bs); by <= Math.floor(y1 / bs); by++) for (let bx = Math.floor(x0 / bs); bx <= Math.floor(x1 / bs); bx++) {
          const k = bx + "," + by; let a = buckets.get(k); if (!a) { a = []; buckets.set(k, a); } a.push(i);
        }
      });
      const segDist = (x, y, s) => {
        const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
      };
      const distAt = (x, y) => {
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        let best = maxD + 1;
        const maxR = Math.ceil(maxD / bs) + 1;
        for (let r = 0; r <= maxR; r++) {
          if ((r - 1) * bs > best) break;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const a = buckets.get((bx + dx) + "," + (by + dy));
            if (!a) continue;
            for (const i of a) { const d = segDist(x, y, segs[i]); if (d < best) best = d; }
          }
        }
        return best;
      };
      const fx0 = bx0 - maxD - cell, fy0 = by0 - maxD - cell;
      const cols = Math.min(700, Math.max(4, Math.ceil((bx1 - bx0 + 2 * (maxD + cell)) / cell) + 1));
      const rows = Math.min(700, Math.max(4, Math.ceil((by1 - by0 + 2 * (maxD + cell)) / cell) + 1));
      const gx = (c) => fx0 + c * cell, gy = (r) => fy0 + r * cell;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = distAt(gx(c), gy(r));
      const segsOut = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (const lvl of levels) {
        for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
          const tl = F[r * cols + c], tr = F[r * cols + c + 1], bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
          let idx = 0;
          if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4; if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
          if (idx === 0 || idx === 15) continue;
          const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
          const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT], eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
          const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)], eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
          const S = (A, Bq) => segsOut.push([A, Bq]);
          switch (idx) {
            case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break; case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
            case 5: S(eL(), eT()); S(eB(), eR()); break; case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break; case 8: S(eL(), eT()); break;
            case 9: S(eT(), eB()); break; case 10: S(eL(), eB()); S(eT(), eR()); break; case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
            case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
          }
        }
      }
      /* link segments into chains */
      const qz = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => qz(pt[0]) + "," + qz(pt[1]);
      const map = new Map();
      const items = segsOut.map((s) => ({ a: s[0], b: s[1], used: false }));
      const put = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { put(kk(s.a), { i, end: "a" }); put(kk(s.b), { i, end: "b" }); });
      const ribbonPen = p.render === "Centerline + ribbon" ? PR : PL;
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        for (const dir of ["tail", "head"]) {
          let grow = true;
          while (grow) {
            grow = false;
            const endPt = dir === "tail" ? chain[chain.length - 1] : chain[0];
            for (const ref of (map.get(kk(endPt)) || [])) {
              const s = items[ref.i];
              if (s.used) continue;
              const nxt = ref.end === "a" ? s.b : s.a;
              if (dir === "tail") chain.push(nxt); else chain.unshift(nxt);
              s.used = true; grow = true; break;
            }
          }
        }
        if (chain.length < 3) continue;
        if (pathLength(chain, false) < 3) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        push(chain, closed, ribbonPen);
      }
    }

    /* ---- dots / numbers ---- */
    if (p.dots !== "None") {
      if (p.dots === "Dots") {
        const r = Math.max(0.15, (Number(p.dotSize) || 1) / 2);
        for (const [i, j] of dots) { const [cx, cy] = toMM(i, j); const o = []; for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } push(o, true, PD); }
      } else {
        const size = clamp(Number(p.numSize) || 4, 0.5, 40);
        /* row number: display rows bottom-up like a kolam chart (y-down canvas ->
           larger y = lower row); strand number: the strand that owns most of
           the four segments around the dot (ties -> lowest index) */
        let label;
        if (p.dots === "Row numbers") {
          const rowKey = (i, j) => place.rot ? (i + j) : j;
          const keys = [...new Set(dots.map(([i, j]) => rowKey(i, j)))].sort((a, b) => a - b);
          /* in canvas y-down the largest key is the top row; chart counts from the bottom */
          const rank = new Map(keys.map((k, n) => [k, keys.length - n]));
          label = (i, j) => String(rank.get(rowKey(i, j)));
        } else {
          const owner = new Map();
          curves.forEach((cv, k) => { for (const n of cv.nodes) {
            /* the segment leaving node n runs through the cell whose dot is the
               one we circle: dot = midpoint shifted half a cell along the
               perpendicular component of the leaving direction */
            const di = (n.X & 1) === 0 ? n.X / 2 : (n.X + n.dx) / 2, dj = (n.X & 1) === 0 ? (n.Y + n.dy) / 2 : n.Y / 2;
            const key = di + "," + dj; const m = owner.get(key) || new Map(); m.set(k, (m.get(k) || 0) + 1); owner.set(key, m);
          } });
          label = (i, j) => { const m = owner.get(i + "," + j); if (!m) return "?"; let best = -1, bc = -1; for (const [k, c] of m) if (c > bc || (c === bc && k < best)) { best = k; bc = c; } return String(best + 1); };
        }
        for (const [i, j] of dots) {
          const [cx, cy] = toMM(i, j);
          const fs = fontStrokes(label(i, j), size);
          const tw = fs.width - size * 0.2;   /* fontStrokes width includes one trailing letter gap */
          for (const st of fs.strokes) push(st.map(([x, y]) => [cx - tw / 2 + x, cy - size / 2 + y]), false, PD);
        }
      }
    }
    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      const guides = [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
      const B = this && typeof this._build === "function" ? this._build(p, ctx, ins) : null;
      if (B && B.place && B.place.bbox) { const [x, y, w, h] = B.place.bbox; guides.push({ kind: "rect", x, y, w, h }); }
      if (B && p.layout === "Wired region") { for (const [i, j] of B.dots.slice(0, 400)) { const [x, y] = B.place.toMM(i, j); guides.push({ kind: "point", x, y }); } }
      return guides;
    } catch (e) { return []; }
  },
};
