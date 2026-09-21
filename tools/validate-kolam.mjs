/* Validator for the Kolam node (key kolam).
   Run from the repo root: node tools/validate-kolam.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "kolam";

const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href)).default;
  mode = "[baked]";
} else {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const CTX = { W: 297, H: 210 };
const run = (p, ctx, ins) => def.compute(ins || [undefined, undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const byPen = (r, pen) => r.paths.filter((q) => q.layer === pen);
const lines = (r) => byPen(r, p0.layer);
const rect = (x, y, w, h) => ({ paths: [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true, layer: 0 }] });

/* ---------------------------------------------------------- universal */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.01;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
const inMargin = (r, m, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - tol && x <= W - m + tol && y >= m - tol && y <= Hh - m + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");
ok(inMargin(r1, p0.margin, 297, 210), "inside the margin box at defaults (loops included)");
ok(inMargin(run({ ...p0, pitch: 80, reach: 2 }, { W: 210, H: 297 }), p0.margin, 210, 297), "pitch 80 + reach 2 on A4 tall still fits (shrink-only)");
{
  const B0 = def._build(p0, CTX), B1 = def._build({ ...p0, pitch: 80 }, CTX), B2 = def._build({ ...p0, pitch: 10 }, CTX);
  ok(B1.place.px < 80 && B2.place.px === 10 && B0.place.px < p0.pitch, "pitch stays exact when it fits (10), shrinks when it does not (" + B1.place.px.toFixed(2) + " mm at 80, " + B0.place.px.toFixed(2) + " at 24)");
}

/* ---------------------------------------------------------- strands / topology */
const B = def._build(p0, CTX);
ok(B && B.dots.length === 25, "Interlaced 4 x 7 has 25 dots (1-3-5-7-5-3-1)");
ok(B.curves.length === 1, "Single line at defaults -> exactly one strand");
ok(lines({ ...r1, paths: r1.paths }).length === 1 && lines(r1)[0].closed, "centerline output is one closed path at defaults");
ok(B.curves[0].nodes.length === 8 * 25 / 2, "one strand visits every pass once (" + B.curves[0].nodes.length + " nodes = 4 per dot)");
{
  const B2 = def._build({ ...p0, turns: 0, strands: "Free" }, CTX);
  ok(B2.mirrors.size === 0, "Turns 0 places no interior mirrors");
  ok(B2.curves.reduce((a, c) => a + c.nodes.length, 0) === 4 * 25, "all strands together cover every pass exactly once");
}
/* gcd law: n x m square grid with no interior mirrors -> gcd(n, m) strands */
{
  let good = true, list = [];
  for (const [n, m] of [[4, 4], [6, 4], [5, 3], [6, 3], [7, 7], [8, 6], [9, 6], [2, 5]]) {
    const b = def._build({ ...p0, layout: "Square", cols: n, rows: m, turns: 0, strands: "Free" }, CTX);
    list.push(n + "x" + m + "=" + b.curves.length);
    if (b.curves.length !== gcd(n, m)) good = false;
  }
  ok(good, "gcd law: n x m without mirrors gives gcd(n,m) strands (" + list.join(" ") + ")");
}
/* Single line across seeds, layouts, sizes */
{
  let good = true, tried = 0;
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) for (const lay of [
    { layout: "Interlaced", cols: 4, rows: 7 }, { layout: "Interlaced", cols: 6, rows: 11 }, { layout: "Interlaced", cols: 3, rows: 4 },
    { layout: "Square", cols: 6, rows: 4 }, { layout: "Square", cols: 7, rows: 7 }, { layout: "Square", cols: 1, rows: 5 },
    { layout: "Diamond", radius: 2 }, { layout: "Diamond", radius: 5 }]) {
    for (const turns of [0, 12, 60]) {
      const b = def._build({ ...p0, ...lay, seed, turns, strands: "Single line" }, CTX);
      tried++;
      if (!b || b.curves.length !== 1) { good = false; console.log("     single-line miss:", JSON.stringify(lay), "seed", seed, "turns", turns, "->", b && b.curves.length); }
    }
  }
  ok(good, "Single line always yields exactly one strand (" + tried + " cases)");
  const t3 = def._build({ ...p0, layout: "Square", cols: 6, rows: 4, turns: 0, strands: "Target count", strandN: 3 }, CTX);
  ok(t3.curves.length === 3, "Target count 3 from a 2-strand grid splits to 3 (" + t3.curves.length + ")");
  const t1 = def._build({ ...p0, layout: "Square", cols: 6, rows: 4, turns: 60, strands: "Target count", strandN: 1 }, CTX);
  ok(t1.curves.length === 1, "Target count 1 merges to one");
  const free = def._build({ ...p0, layout: "Square", cols: 8, rows: 6, turns: 50, strands: "Free" }, CTX);
  const b0 = def._build({ ...p0, layout: "Square", cols: 8, rows: 6, turns: 50, strands: "Free", seed: 3 }, CTX);
  ok(free.curves.length >= 1 && (free.curves.length !== b0.curves.length || free.mirrors.size !== b0.mirrors.size), "Free: seed changes mirrors / strand count");
}

/* ---------------------------------------------------------- crossings are 90-degree X */
/* strict on the raw polygon (no rounding, no loop displacement): the two passes
   go exactly through the midpoint at 90 degrees */
{
  const pc = { ...p0, dots: "None", round: 0, reach: 0, turnSize: 0 };
  const rc = run(pc), Bc = def._build(pc, CTX);   /* reach changes the fit, so rebuild for the same params */
  const strands = lines(rc);
  const segs = [];
  for (const q of strands) for (let a = 0; a < q.pts.length; a++) { const A = q.pts[a], Bq = q.pts[(a + 1) % q.pts.length]; segs.push([A, Bq]); }
  const segDist = (P, A, Bq) => { const dx = Bq[0] - A[0], dy = Bq[1] - A[1], L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(P[0] - (A[0] + dx * t), P[1] - (A[1] + dy * t)); };
  let crossings = 0, bad = 0;
  for (const cv of Bc.curves) for (const n of cv.nodes) {
    if (n.refl) continue;
    crossings++;
    const M = Bc.place.toMM(n.X / 2, n.Y / 2);
    const near = segs.filter(([A, Bq]) => segDist(M, A, Bq) < 1e-6);
    const dirs = near.map(([A, Bq]) => { const dx = Bq[0] - A[0], dy = Bq[1] - A[1], L = Math.hypot(dx, dy); return [dx / L, dy / L]; });
    /* two distinct directions, perpendicular */
    let d1 = dirs[0], d2 = dirs.find((d) => Math.abs(d[0] * d1[0] + d[1] * d1[1]) < 0.5);
    if (!d1 || !d2 || Math.abs(d1[0] * d2[0] + d1[1] * d2[1]) > 1e-6) bad++;
  }
  ok(crossings > 0 && bad === 0, "raw polygon: every crossing is passed by two strands at exactly 90 degrees (" + (crossings / 2) + " crossings)");
  ok(crossings / 2 === B.edges.length - B.mirrors.size, "crossing count = interior edges without mirrors (" + (crossings / 2) + ")");
  /* rounded default: both passes still come within 0.2 pitch of the midpoint and meet at 60..120 degrees */
  const rd = run({ ...p0, dots: "None" });
  const segsR = [];
  for (const q of lines(rd)) for (let a = 0; a < q.pts.length; a++) segsR.push([q.pts[a], q.pts[(a + 1) % q.pts.length]]);
  let loose = 0;
  for (const cv of B.curves) for (const n of cv.nodes) {
    if (n.refl) continue;
    const M = B.place.toMM(n.X / 2, n.Y / 2);
    const near = segsR.filter(([A, Bq]) => segDist(M, A, Bq) < 0.2 * B.place.px).map(([A, Bq]) => { const dx = Bq[0] - A[0], dy = Bq[1] - A[1], L = Math.hypot(dx, dy); return [dx / L, dy / L]; });
    const d1 = near[0], d2 = near.find((d) => d1 && Math.abs(d[0] * d1[0] + d[1] * d1[1]) < 0.5);
    if (!d1 || !d2) loose++;
  }
  ok(loose === 0, "rounded default: both passes reach every crossing point and meet between 60 and 120 degrees");
}

/* ---------------------------------------------------------- border loops reach out */
{
  const rc = run({ ...p0, dots: "None" });
  const pts = lines(rc).flatMap((q) => q.pts);
  const px = B.place.px;
  let minApex = Infinity, n = 0;
  for (const cv of B.curves) for (const nd of cv.nodes) {
    if (!nd.bnd) continue;
    n++;
    const dot = (nd.X & 1) === 0 ? [nd.X / 2, (nd.Y - nd.iny) / 2] : [(nd.X - nd.inx) / 2, nd.Y / 2];
    const D = B.place.toMM(dot[0], dot[1]);
    const M = B.place.toMM(nd.X / 2, nd.Y / 2);
    const out = [(M[0] - D[0]) / (px / 2), (M[1] - D[1]) / (px / 2)];   /* unit outward */
    let apex = -Infinity;
    for (const q of pts) apex = Math.max(apex, ((q[0] - D[0]) * out[0] + (q[1] - D[1]) * out[1]) / px);
    minApex = Math.min(minApex, apex);
  }
  ok(n === 4 * B.dots.length - 2 * B.edges.length && minApex > 0.6, "every border turn loops out past the dot midpoint (" + n + " loops = boundary edges, min apex " + minApex.toFixed(2) + " pitch)");
  /* reach in lattice units at a pitch that never triggers the fit */
  const apexOf = (reach) => { const pp = { ...p0, dots: "None", reach, pitch: 10 }; const rr = run(pp), b = def._build(pp, CTX); const qs = lines(rr).flatMap((q) => q.pts); let ymin = Infinity; for (const q of qs) ymin = Math.min(ymin, q[1]); return (b.place.toMM(0, 0)[1] - ymin) / b.place.px; };
  ok(apexOf(2) > apexOf(1) && apexOf(1) > apexOf(0.3), "Loop reach is monotonic in lattice units (" + apexOf(0.3).toFixed(2) + " < " + apexOf(1).toFixed(2) + " < " + apexOf(2).toFixed(2) + ")");
  const sharp = run({ ...p0, dots: "None", round: 0 });
  ok(npts(sharp) === B.curves[0].nodes.length, "Roundness 0 is the raw midpoint polygon (" + npts(sharp) + " pts)");
  ok(npts(run({ ...p0, dots: "None", round: 1 })) === npts(sharp) * 16, "Roundness 1 = four Chaikin rounds (x16 points)");
}

/* ---------------------------------------------------------- under gaps */
{
  for (const turns of [0, 25]) {
    const p = { ...p0, dots: "None", cross: "Under gaps", turns };
    const b = def._build(p, CTX), r = run(p);
    const pieces = lines(r);
    const crossings = b.edges.length - b.mirrors.size;
    ok(pieces.every((q) => !q.closed) && pieces.length === crossings, "Under gaps turns " + turns + ": one open piece per crossing (" + pieces.length + " pieces, " + crossings + " crossings)");
    /* every crossing point is uncovered by exactly one strand: no output point within gap/2 - tiny of an under point... check: no point of ANY piece lies within 0.45*gap of a crossing AND on the under pass -> weaker: each crossing has >= 1 piece endpoint within gap/2 + 1 mm */
    let good = true;
    for (const cv of b.curves) for (const nd of cv.nodes) {
      if (nd.refl) continue;
      const M = b.place.toMM(nd.X / 2, nd.Y / 2);
      const ends = pieces.filter((q) => Math.hypot(q.pts[0][0] - M[0], q.pts[0][1] - M[1]) < p.gap / 2 + 1 || Math.hypot(q.pts[q.pts.length - 1][0] - M[0], q.pts[q.pts.length - 1][1] - M[1]) < p.gap / 2 + 1);
      if (ends.length !== 2) good = false;
    }
    ok(good, "Under gaps turns " + turns + ": exactly two piece ends at every crossing (one strand cut, one continuous)");
  }
  /* alternation: walking each strand, the crossings it passes go over, under,
     over... Derived from the OUTPUT: at a crossing the cut pass is the one whose
     piece ends point along it, so compare each pass direction with the piece ends */
  {
    const p = { ...p0, dots: "None", cross: "Under gaps", turns: 30, strands: "Free", layout: "Square", cols: 7, rows: 5 };
    const b = def._build(p, CTX), r = run(p);
    const pieces = lines(r);
    let strandsChecked = 0, bad = 0, seq = 0;
    for (const cv of b.curves) {
      const flags = [];
      for (const n of cv.nodes) {
        if (n.refl) continue;
        const M = b.place.toMM(n.X / 2, n.Y / 2);
        const P = b.place.toMM(n.X / 2 + n.dx * 0.5, n.Y / 2 + n.dy * 0.5);
        const L = Math.hypot(P[0] - M[0], P[1] - M[1]);
        const ux = (P[0] - M[0]) / L, uy = (P[1] - M[1]) / L;
        /* piece ends near M and their outgoing direction */
        let under = false;
        for (const q of pieces) {
          for (const [E, N] of [[q.pts[0], q.pts[1]], [q.pts[q.pts.length - 1], q.pts[q.pts.length - 2]]]) {
            if (Math.hypot(E[0] - M[0], E[1] - M[1]) > p.gap / 2 + 1) continue;
            const dx = N[0] - E[0], dy = N[1] - E[1], l = Math.hypot(dx, dy) || 1;
            if (Math.abs((dx * ux + dy * uy) / l) > 0.7) under = true;
          }
        }
        flags.push(under);
      }
      if (flags.length < 2) continue;
      strandsChecked++;
      for (let k = 0; k < flags.length; k++) { seq++; if (flags[k] === flags[(k + 1) % flags.length]) bad++; }
    }
    ok(strandsChecked > 0 && bad === 0, "over/under alternates along every strand (" + seq + " crossings on " + strandsChecked + " strands)");
  }
  const g1 = run({ ...p0, dots: "None", cross: "Under gaps", gap: 1 }), g4 = run({ ...p0, dots: "None", cross: "Under gaps", gap: 4 });
  const tot = (r) => lines(r).reduce((a, q) => a + H.pathLength(q.pts, false), 0);
  ok(tot(g4) < tot(g1), "wider Gap removes more ink");
}

/* ---------------------------------------------------------- SDF ribbon / contours */
{
  const center = lines(run({ ...p0, dots: "None" }));
  const segs = [];
  for (const q of center) for (let a = 0; a < q.pts.length; a++) segs.push([q.pts[a], q.pts[(a + 1) % q.pts.length]]);
  const segDist = (P, [A, Bq]) => { const dx = Bq[0] - A[0], dy = Bq[1] - A[1], L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(P[0] - (A[0] + dx * t), P[1] - (A[1] + dy * t)); };
  const dist = (P) => { let b = Infinity; for (const s of segs) { const d = segDist(P, s); if (d < b) b = d; } return b; };
  const rib = run({ ...p0, dots: "None", render: "Ribbon" });
  ok(rib.paths.length > 0 && rib.paths.every((q) => q.closed), "Ribbon: all isolines closed (" + rib.paths.length + ")");
  let maxErr = 0; for (const q of rib.paths) for (const P of q.pts) maxErr = Math.max(maxErr, Math.abs(dist(P) - p0.width / 2));
  ok(maxErr < p0.fcell * 1.2, "Ribbon isolines sit at Width/2 from the centerline (max error " + maxErr.toFixed(2) + " mm)");
  ok(rib.paths.every((q) => q.layer === p0.layer), "Ribbon uses the line pen");
  const both = run({ ...p0, dots: "None", render: "Centerline + ribbon" });
  ok(byPen(both, p0.layer).length === 1 && byPen(both, p0.penRibbon).length === rib.paths.length, "Centerline + ribbon: line on Line pen, isolines on Ribbon pen");
  const con = run({ ...p0, dots: "None", render: "Contours", contours: 3, cstep: 3 });
  const levels = [0, 1, 2].map((k) => p0.width / 2 + k * 3);
  let lvlBad = 0;
  for (const q of con.paths) { const md = q.pts.reduce((a, P) => a + dist(P), 0) / q.pts.length; if (!levels.some((L) => Math.abs(md - L) < p0.fcell * 1.2)) lvlBad++; }
  ok(con.paths.length > rib.paths.length && lvlBad === 0, "Contours: every isoline averages onto one of the levels (" + con.paths.length + " paths)");
  ok(run({ ...p0, dots: "None", render: "Contours", contours: 1, cstep: 3 }).paths.length === rib.paths.length, "Contours 1 = Ribbon");
  const w2 = run({ ...p0, dots: "None", render: "Ribbon", width: 10 });
  let e2 = 0; for (const q of w2.paths) for (const P of q.pts) e2 = Math.max(e2, Math.abs(dist(P) - 5));
  ok(e2 < p0.fcell * 1.2, "Ribbon follows Width (10 mm -> 5 mm offset, max error " + e2.toFixed(2) + ")");
}

/* ---------------------------------------------------------- dots and numbers */
{
  const rd = run({ ...p0, dots: "Dots" });
  ok(byPen(rd, p0.penDots).length === 25 && byPen(rd, p0.penDots).every((q) => q.closed), "Dots: one closed circle per dot");
  const rowOf = (i, j) => j;   /* unrotated: display row = j */
  const keys = [...new Set(B.dots.map(([i, j]) => rowOf(i, j)))].sort((a, b) => a - b);
  const expected = B.dots.reduce((a, [i, j]) => a + H.fontStrokes(String(keys.length - keys.indexOf(rowOf(i, j))), p0.numSize).strokes.length, 0);
  ok(byPen(r1, p0.penDots).length === expected, "Row numbers: stroke count matches SFONT digits 1..7 over 25 dots (" + expected + ")");
  ok(keys.length === 7, "Interlaced 4 x 7 unrotated has 7 display rows");
  /* the bottom row (largest y) is numbered 1: the lowest number strokes have the largest y */
  const numStrokes = byPen(r1, p0.penDots);
  const yOf = (q) => q.pts.reduce((a, P) => a + P[1], 0) / q.pts.length;
  const ys = numStrokes.map(yOf);
  const oneStrokes = H.fontStrokes("1", p0.numSize).strokes.length;
  ok(ys.filter((y) => y > Math.max(...ys) - p0.numSize).length === oneStrokes, "bottom row carries the digit 1 (chart counts from the bottom)");
  const rs = run({ ...p0, layout: "Square", cols: 6, rows: 4, turns: 0, strands: "Free", dots: "Strand numbers" });
  const s1 = H.fontStrokes("1", p0.numSize).strokes.length, s2 = H.fontStrokes("2", p0.numSize).strokes.length;
  ok(byPen(rs, p0.penDots).length === 12 * s1 + 12 * s2, "Strand numbers on a 2-strand grid: 12 dots each");
  const rr = run({ ...p0, rot45: true });
  const keysR = [...new Set(B.dots.map(([i, j]) => i + j))];
  ok(keysR.length === 7 && byPen(rr, p0.penDots).length > 0, "Rotate 45: rows counted along i+j (7 rows)");
}

/* ---------------------------------------------------------- wired region */
{
  ok(run({ ...p0, layout: "Wired region" }).paths.length === 0, "Wired region without a region -> EMPTY");
  const reg = rect(60, 40, 120, 100);
  const rw = run({ ...p0, layout: "Wired region", pitch: 20, dots: "Dots" }, CTX, [reg, undefined]);
  const bw = def._build({ ...p0, layout: "Wired region", pitch: 20 }, CTX, [reg, undefined]);
  ok(bw.dots.length > 10 && bw.dots.every(([i, j]) => { const [x, y] = bw.place.toMM(i, j); return x > 60 && x < 180 && y > 40 && y < 140; }), "Wired region: every dot inside the region (" + bw.dots.length + " dots)");
  ok(bw.place.px === 20, "Wired region keeps Pitch exact (no fit)");
  ok(bw.curves.length === 1 && lines(rw).length === 1, "Wired region + Single line -> one strand");
  ok(finiteAll(rw), "Wired region output finite");
  const tri = { paths: [{ pts: [[40, 180], [260, 180], [150, 30]], closed: true, layer: 0 }] };
  const bt = def._build({ ...p0, layout: "Wired region", pitch: 14, rot45: true }, CTX, [tri, undefined]);
  ok(bt && bt.dots.length > 20 && bt.curves.length === 1, "Wired triangle, rotated lattice: dots found, single strand (" + bt.dots.length + " dots)");
}

/* ---------------------------------------------------------- pens */
{
  const rp = run({ ...p0, layout: "Square", cols: 6, rows: 4, turns: 0, strands: "Free", penPer: true, dots: "None" });
  ok(new Set(rp.paths.map((q) => q.layer)).size === 2, "Pen per strand: 2 strands -> 2 pens");
  const rq = run({ ...p0, layout: "Square", cols: 6, rows: 4, turns: 0, strands: "Free", penPer: false, dots: "None" });
  ok(new Set(rq.paths.map((q) => q.layer)).size === 1, "without Pen per strand all strands share the line pen");
  const rl = run({ ...p0, layer: 5, penDots: 9 });
  ok(new Set(rl.paths.map((q) => q.layer)).size === 2 && rl.paths.some((q) => q.layer === 5) && rl.paths.some((q) => q.layer === 9), "Line pen / Dot pen route correctly");
}

/* ---------------------------------------------------------- seed scope */
{
  const s2 = run({ ...p0, seed: 99 });
  ok(JSON.stringify(s2) !== JSON.stringify(r1), "seed changes the mirror layout at Turns 12");
  ok(JSON.stringify(run({ ...p0, turns: 0, seed: 1, strands: "Free" })) === JSON.stringify(run({ ...p0, turns: 0, seed: 77, strands: "Free" })), "Turns 0 + Free is seed-independent");
  const d1 = def._build(p0, CTX).dots, d2 = def._build({ ...p0, seed: 99 }, CTX).dots;
  ok(JSON.stringify(d1) === JSON.stringify(d2), "seed never moves the dots");
}

/* ---------------------------------------------------------- param liveness */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ layout: "Square" }, "layout Square");
diff({ layout: "Diamond" }, "layout Diamond");
diff({ cols: 5 }, "cols");
diff({ rows: 5 }, "rows");
diff({ radius: 2, layout: "Diamond" }, "radius");
diff({ rot45: true }, "rot45");
diff({ pitch: 15 }, "pitch");
diff({ turns: 40 }, "turns");
diff({ strands: "Free" }, "strands");
diff({ strands: "Target count", strandN: 2 }, "strandN");
diff({ reach: 0.4 }, "reach");
diff({ turnSize: 0.2 }, "turnSize");
diff({ round: 0.5 }, "round");
diff({ cross: "Under gaps" }, "cross");
diff({ cross: "Under gaps", gap: 5 }, "gap (Under gaps)");
diff({ render: "Ribbon" }, "render");
diff({ render: "Ribbon", width: 8 }, "width");
diff({ render: "Contours", contours: 2 }, "contours");
diff({ render: "Contours", cstep: 5 }, "cstep");
diff({ render: "Ribbon", fcell: 2 }, "fcell");
diff({ dots: "Dots" }, "dots");
diff({ dots: "Dots", dotSize: 4 }, "dotSize");
diff({ numSize: 7 }, "numSize");
diff({ penPer: true, strands: "Free", layout: "Square", cols: 6, rows: 4, turns: 0 }, "penPer");
diff({ margin: 40, pitch: 80 }, "margin");
diff({ seed: 3 }, "seed");
diff({ layer: 4 }, "layer");
diff({ render: "Centerline + ribbon", penRibbon: 6 }, "penRibbon");
diff({ penDots: 6 }, "penDots");
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const ins = pd.key === "layout" && opt === "Wired region" ? [rect(60, 40, 120, 100), undefined] : undefined;
    const r = run({ ...p0, [pd.key]: opt }, CTX, ins);
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* ---------------------------------------------------------- degenerate / extreme */
ok(finiteAll(run({ ...p0, cols: 0, rows: 0, pitch: 0, turns: -5, reach: -1, turnSize: -1, round: 5, width: 0, fcell: 0, margin: -3, numSize: 0 })), "degenerate params produce no NaN");
ok(run({ ...p0, layout: "Square", cols: 1, rows: 1 }).paths.length > 0, "1 x 1 grid draws (a single loop)");
ok(run({ ...p0, layout: "Interlaced", cols: 1, rows: 1 }).paths.length > 0, "Interlaced 1 x 1 draws");
{
  const t0 = Date.now();
  const ext = run({ ...p0, layout: "Interlaced", cols: 12, rows: 23, turns: 40, render: "Contours", contours: 4, cstep: 2, width: 3, fcell: 0.8, cross: "Under gaps", pitch: 80, margin: 0 }, { W: 594, H: 420 });
  const ms = Date.now() - t0;
  ok(finiteAll(ext) && npts(ext) <= 120000 && inb(ext, 594, 420), "extreme A2 case: finite, on-sheet, budget held (" + npts(ext) + " pts)");
  ok(ms < 3000, "extreme A2 case computes in " + ms + " ms");
  const t1 = Date.now(); run(p0); ok(Date.now() - t1 < 100, "defaults compute fast (" + (Date.now() - t1) + " ms)");
}
ok(finiteAll(run(p0, { W: 20, H: 20 })) && inb(run(p0, { W: 20, H: 20 }), 20, 20), "20 x 20 mm canvas: on-sheet");

/* ---------------------------------------------------------- showIf */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis(p0).includes("gap") && vis({ ...p0, cross: "Under gaps" }).includes("gap"), "gap shown only for Under gaps");
  ok(!vis(p0).includes("width") && vis({ ...p0, render: "Ribbon" }).includes("width"), "width shown only for SDF renders");
  ok(vis(p0).includes("cols") && !vis({ ...p0, layout: "Diamond" }).includes("cols") && vis({ ...p0, layout: "Diamond" }).includes("radius"), "cols/rows vs radius follow layout");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "hidden params carry defaults");
}

/* ---------------------------------------------------------- overlay */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 2 && g1[1].kind === "rect", "overlay: margin box + drawing box");
  const bb = g1[1];
  ok(r1.paths.every((q) => q.pts.every(([x, y]) => x >= bb.x - tol && x <= bb.x + bb.w + tol && y >= bb.y - tol && y <= bb.y + bb.h + tol)), "all output inside the drawing box guide");
  const gw = def.overlay({ ...p0, layout: "Wired region", pitch: 20 }, CTX, [rect(60, 40, 120, 100), undefined], {});
  ok(gw.some((g) => g.kind === "point"), "Wired region overlay marks the dots");
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }, undefined, undefined); def.overlay({ ...p0, layout: "Wired region" }, CTX); def.overlay.call(undefined, p0, CTX); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws (degenerate canvas, no region, unbound this)");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
