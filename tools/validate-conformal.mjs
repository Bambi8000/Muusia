/* Validator for the Conformal Grid node (key conformal).
   Run from the repo root: node tools/validate-conformal.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "conformal";

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
const byPen = (r, pen) => r.paths.filter((q) => q.layer === pen);
const gridPens = (r, p) => r.paths.filter((q) => q.layer === p.penMajor || q.layer === p.penMinor || q.layer === p.penFine);
const rect = (x, y, w, h) => ({ paths: [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true, layer: 0 }] });
const tol = 0.01;

/* ---------------------------------------------------------- universal */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
const inMargin = (r, m, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - tol && x <= W - m + tol && y >= m - tol && y <= Hh - m + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");
ok(inMargin(r1, p0.margin, 297, 210), "everything (scales included) inside the margin box at defaults");
ok(inMargin(run({ ...p0, radius: 300 }, { W: 148, H: 105 }), p0.margin, 148, 105), "radius 300 on A6 still fits the margin box (shrink-only)");
{
  const G = def._build(p0, CTX), G2 = def._build({ ...p0, radius: 40 }, CTX);
  ok(G.Rmm < p0.radius && G2.Rmm === 40, "Disc fit: radius shrinks when the rings would not fit (" + G.Rmm.toFixed(2) + " of 90), stays exact at 40");
}

/* ---------------------------------------------------------- geometry oracles */
const G = def._build(p0, CTX);
const dist = (P, Q) => Math.hypot(P[0] - Q[0], P[1] - Q[1]);
const centre = [G.cx, G.cy];
{
  /* grid stays in the disc, scales stay in the ring band */
  const grid = gridPens(r1, p0);
  ok(grid.every((q) => q.pts.every((P) => dist(P, centre) <= G.Rmm + 0.02)), "Disc clip: every grid point inside the unit disc");
  const sc = byPen(r1, p0.penScale);
  ok(sc.length > 0 && sc.every((q) => q.pts.every((P) => dist(P, centre) >= G.Rmm * 1.03 && dist(P, centre) <= G.Rmm * G.outer + 0.02)), "scales lie in the ring band outside the disc");
  /* unit circle (R = 0) is present as the outermost major */
  const majors = byPen(r1, p0.penMajor);
  const rim = majors.filter((q) => q.pts.every((P) => Math.abs(dist(P, centre) - G.Rmm) < 0.05));
  ok(rim.length >= 1 && rim.reduce((a, q) => a + H.pathLength(q.pts, q.closed), 0) > 2 * Math.PI * G.Rmm * 0.98, "R = 0 maps to the full unit circle (rim length " + rim.reduce((a, q) => a + H.pathLength(q.pts, q.closed), 0).toFixed(1) + " mm)");
  /* R = 1 circle passes through the centre */
  ok(majors.some((q) => q.pts.some((P) => dist(P, centre) < 0.08)), "R = 1 circle passes through the chart centre");
  /* every major R circle is tangent at (1, 0): all majors touch the right rim point */
  const right = [G.cx + G.Rmm, G.cy];
  const smithR = def._SMITH.filter((v) => v > 0);
  const touching = majors.filter((q) => q.pts.some((P) => dist(P, right) < 0.6)).length;
  ok(touching >= smithR.length + 20, "R circles and X arcs all converge on the right rim point (" + touching + " majors touch it)");
}
/* conformality from the OUTPUT: at f(Rc, Xc) the two majors cross at 90 degrees */
const conformal = (p, pairs, label, tolDeg) => {
  const r = run(p);
  const majors = byPen(r, p.penMajor);
  const g = def._build(p, CTX);
  const segs = [];
  for (const q of majors) for (let i = 1; i < q.pts.length; i++) segs.push([q.pts[i - 1], q.pts[i]]);
  const segDist = (P, [A, B]) => { const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(P[0] - (A[0] + dx * t), P[1] - (A[1] + dy * t)); };
  let checked = 0, worst = 0, missing = 0;
  for (const [Rc, Xc] of pairs) {
    const z = def._f(p.map, Rc, Xc, p.range, p.exponent);
    if (!z || Math.hypot(z[0], z[1]) > 0.97) continue;
    const P = g.toMM(z[0], z[1]);
    const near = segs.filter((s) => segDist(P, s) < 0.12).map(([A, B]) => { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); return [dx / L, dy / L]; });
    if (near.length < 2) { missing++; continue; }
    const d1 = near[0];
    const d2 = near.find((d) => Math.abs(d[0] * d1[0] + d[1] * d1[1]) < 0.7);
    if (!d2) { missing++; continue; }
    const ang = Math.acos(Math.min(1, Math.abs(d1[0] * d2[0] + d1[1] * d2[1]))) * 180 / Math.PI;
    worst = Math.max(worst, Math.abs(90 - ang)); checked++;
  }
  ok(checked > 0 && missing === 0 && worst < tolDeg, label + ": majors cross at 90 deg (" + checked + " crossings, worst deviation " + worst.toFixed(2) + " deg)");
};
{
  const pairs = [];
  for (const Rc of [0.2, 0.5, 1, 2, 3]) for (const Xc of [-2, -1, -0.5, 0.5, 1, 2]) pairs.push([Rc, Xc]);
  conformal({ ...p0, scales: "None", labels: false, axis: false }, pairs, "Smith", 2.5);
  const pp = []; for (const Rc of [-2, -1, 1, 2]) for (const Xc of [-2, -1, 1, 2]) pp.push([Rc, Xc]);
  conformal({ ...p0, map: "Inversion 1/z", scales: "None", labels: false, axis: false, range: 3, majors: 6 }, pp, "Inversion", 2.5);
  conformal({ ...p0, map: "Joukowski", scales: "None", labels: false, axis: false, range: 3, majors: 6 }, pp, "Joukowski", 2.5);
  const pl = []; for (const Rc of [1, 1.5, 2, 2.5]) for (const Xc of [Math.PI / 6, Math.PI / 2, -Math.PI / 3]) pl.push([Rc, Xc]);
  conformal({ ...p0, map: "Log-polar", scales: "None", labels: false, axis: false, range: 3, majors: 6 }, pl, "Log-polar", 2.5);
  const pw = []; for (const Rc of [0.5, 1, 1.5, 2]) for (const Xc of [-1.5, -0.5, 0.5, 1.5]) pw.push([Rc, Xc]);
  conformal({ ...p0, map: "Power z^n", scales: "None", labels: false, axis: false, range: 3, majors: 6, exponent: 2 }, pw, "Power z^2", 2.5);
}

/* ---------------------------------------------------------- adaptive subdivision */
{
  const finePts = (p) => npts({ paths: byPen(run(p), p.penFine).filter((q) => q.layer !== p.penMinor) });
  const base = { ...p0, scales: "None", labels: false, axis: false, penMinor: 5, penFine: 6 };
  const c09 = finePts({ ...base, cell: 0.9 }), c12 = finePts({ ...base, cell: 1.2 }), c3 = finePts({ ...base, cell: 3 }), c10 = finePts({ ...base, cell: 10 });
  ok(c09 > c12 && c12 > c3 && c3 > c10, "Cell mm prunes the fine level monotonically (" + [c09, c12, c3, c10].join(" > ") + ")");
  ok(finePts({ ...base, cell: 0.5 }) === 0 && byPen(run({ ...base, cell: 0.5 }), 5).length > 0, "over budget: the fine level is dropped whole, minors kept");
  ok(byPen(run({ ...base, depth: 0 }), 6).length === 0 && byPen(run({ ...base, depth: 1 }), 6).length > 0, "Fine depth 0 draws no fine lines, depth 1 does");
  ok(byPen(run({ ...base, minorDiv: 1 }), 5).length === 0 && byPen(run({ ...base, minorDiv: 5 }), 5).length > 0, "Minor per major 1 draws no minors, 5 does");
  const minorPts = (cell) => npts({ paths: byPen(run({ ...base, cell }), 5) });
  ok(minorPts(0.5) > minorPts(3), "minors are pruned by Cell mm too");
  ok(npts({ paths: byPen(run({ ...base, cell: 0.5 }), 0) }) === npts({ paths: byPen(run({ ...base, cell: 10 }), 0) }), "majors are never pruned by Cell mm");
  /* prune rule on the output: no fine point sits closer than 0.9 * Cell to a fine point of a different path in the same family... approximated by nearest-other-path distance */
  const r = run({ ...base, cell: 2.5, depth: 1, minorDiv: 2 });
  const fine = byPen(r, 6);
  let tooClose = 0, tested = 0;
  for (let i = 0; i < fine.length; i += 3) {
    const q = fine[i]; const mid = q.pts[Math.floor(q.pts.length / 2)];
    for (let j = 0; j < fine.length; j++) {
      if (j === i) continue;
      const o = fine[j];
      /* skip paths that cross this one (other family) - they pass within ~0 anyway; only compare paths roughly parallel at the closest point */
      let best = Infinity, bi = -1;
      for (let k = 1; k < o.pts.length; k++) { const d = dist(mid, o.pts[k]); if (d < best) { best = d; bi = k; } }
      if (best < 2.5 * 0.9 && bi > 0) {
        const a = q.pts[Math.min(q.pts.length - 1, Math.floor(q.pts.length / 2) + 1)], t1 = [a[0] - mid[0], a[1] - mid[1]];
        const t2 = [o.pts[bi][0] - o.pts[bi - 1][0], o.pts[bi][1] - o.pts[bi - 1][1]];
        const cosang = Math.abs(t1[0] * t2[0] + t1[1] * t2[1]) / (Math.hypot(...t1) * Math.hypot(...t2) || 1);
        if (cosang > 0.95) tooClose++;
      }
    }
    tested++;
  }
  ok(tested > 0 && tooClose === 0, "fine lines keep >= 0.9 x Cell from their parallel neighbours (" + tested + " sampled)");
}

/* ---------------------------------------------------------- map variants */
{
  const base = { ...p0, scales: "None", labels: false, axis: false };
  const rs = run(base);
  const ra = run({ ...base, map: "Admittance" });
  const mirror = (r) => JSON.stringify(r.paths.map((q) => ({ layer: q.layer, pts: q.pts.map(([x, y]) => [Math.round((2 * G.cx - x) * 1000) / 1000, Math.round((2 * G.cy - y) * 1000) / 1000]) })));
  const plain = (r) => JSON.stringify(r.paths.map((q) => ({ layer: q.layer, pts: q.pts.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) })));
  ok(plain(ra) === mirror(rs), "Admittance is the Smith grid mirrored through the centre (byte-level)");
  const ri = run({ ...base, map: "Immittance" });
  const y = byPen(ri, p0.penY), z = ri.paths.filter((q) => q.layer !== p0.penY);
  ok(y.length > 0 && z.length > 0 && new Set(ri.paths.map((q) => q.layer)).size === 3, "Immittance: Smith pens + Admittance pen");
  const zPlain = JSON.stringify(z.map((q) => ({ layer: q.layer, pts: q.pts.map(([a, b]) => [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]) })));
  ok(zPlain === plain(rs), "Immittance impedance half equals the plain Smith grid");
  const yMirror = JSON.stringify(y.map((q) => q.pts.map(([a, b]) => [Math.round((2 * G.cx - a) * 1000) / 1000, Math.round((2 * G.cy - b) * 1000) / 1000])));
  ok(yMirror === JSON.stringify(rs.paths.map((q) => q.pts.map(([a, b]) => [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]))), "Immittance admittance half is the mirrored Smith grid");
  for (const m of ["Inversion 1/z", "Joukowski", "Log-polar", "Power z^n"]) {
    const r = run({ ...base, map: m });
    ok(r.paths.length > 20 && finiteAll(r) && r.paths.every((q) => q.pts.every((P) => dist(P, centre) <= def._build({ ...base, map: m }, CTX).Rmm + 0.02)), m + ": draws, finite, inside the disc (" + r.paths.length + " paths)");
  }
  ok(JSON.stringify(run({ ...base, map: "Power z^n", exponent: 1.5 })) !== JSON.stringify(run({ ...base, map: "Power z^n", exponent: 2.5 })), "Exponent is live");
  ok(JSON.stringify(run({ ...base, map: "Inversion 1/z", range: 2 })) !== JSON.stringify(run({ ...base, map: "Inversion 1/z", range: 4 })), "Range is live");
  ok(byPen(run({ ...base, map: "Inversion 1/z", majors: 3, minorDiv: 1, depth: 0 }), p0.penMajor).length < byPen(run({ ...base, map: "Inversion 1/z", majors: 8, minorDiv: 1, depth: 0 }), p0.penMajor).length, "Major lines per range is live");
}

/* ---------------------------------------------------------- dressing */
{
  const tickLen = (q) => q.pts.length === 2 ? H.pathLength(q.pts, false) : -1;
  const ticks = (r, lo, hi) => byPen(r, p0.penScale).filter((q) => { const L = tickLen(q); return L > lo * G.Rmm && L < hi * G.Rmm; });
  const rA = run({ ...p0, scales: "Angle" }), rW = run({ ...p0, scales: "Wavelength" }), rN = run({ ...p0, scales: "None" });
  const GA = def._build({ ...p0, scales: "Angle" }, CTX);
  /* a tick is a 2-point radial segment (both ends collinear with the centre); glyph strokes are not radial */
  const radial = (q) => { if (q.pts.length !== 2) return false; const [A, Bq] = q.pts; const cr = (A[0] - g0.cx) * (Bq[1] - g0.cy) - (A[1] - g0.cy) * (Bq[0] - g0.cx); return Math.abs(cr) < 0.02 * g0.Rmm; };
  const g0 = GA;
  const tk = (r, lo, hi, g) => byPen(r, p0.penScale).filter((q) => { if (!radial(q)) return false; const L = tickLen(q); return L > lo * g.Rmm && L < hi * g.Rmm; });
  ok(tk(rA, 0.012, 0.022, GA).length === 144 && tk(rA, 0.03, 0.04, GA).length === 36, "Angle scale: 144 short + 36 long ticks (every 2 deg, long every 10)");
  ok(tk(rW, 0.012, 0.022, GA).length === 200 && tk(rW, 0.03, 0.04, GA).length === 50, "Wavelength scale: 200 short + 50 long ticks (every 0.002, long every 0.01)");
  ok(byPen(rN, p0.penScale).length === 0, "Scales None draws nothing on the scale pen");
  const rB = run(p0);
  ok(byPen(rB, p0.penScale).filter((q) => q.closed).length === 4, "Both scales: four ring circles");
  ok(byPen(run({ ...p0, labels: false }), p0.penLabel).length === byPen(run({ ...p0, labels: false }), p0.penMajor).length, "Labels off: nothing extra on the label pen (shares pen 0 with majors here)");
  const rl = run({ ...p0, penLabel: 7 });
  const expected = def._SMITH.filter((v) => v > 0).reduce((a, v) => a + H.fontStrokes(String(v), p0.labelSize).strokes.length, 0) * 3;   /* R once, X twice (+/-, the minus adds a stroke each) */
  const minus = def._SMITH.filter((v) => v > 0).length * H.fontStrokes("-", p0.labelSize).strokes.length;
  ok(byPen(rl, 7).length === expected + minus, "Labels: SFONT stroke count for R values + X values (" + byPen(rl, 7).length + ")");
  ok(byPen(run({ ...p0, axis: false, penLabel: 7, scales: "None" }), p0.penMajor).length === byPen(run({ ...p0, axis: true, penLabel: 7, scales: "None" }), p0.penMajor).length - 3, "Axis adds axis line + centre cross (3 paths)");
  ok(byPen(run({ ...p0, map: "Joukowski", scales: "Both", labels: true, axis: true, penLabel: 7, penScale: 8 }), 7).length === 0 && byPen(run({ ...p0, map: "Joukowski", scales: "Both", penScale: 8 }), 8).length === 0, "dressing is Smith-only (no scales/labels on other maps)");
}

/* ---------------------------------------------------------- clip modes */
{
  const rs = run({ ...p0, clip: "Sheet", radius: 200, scales: "None", labels: false });
  ok(inMargin(rs, p0.margin, 297, 210) && rs.paths.some((q) => q.pts.some((P) => dist(P, centre) > 120)), "Sheet clip: fills to the margin box beyond the disc");
  ok(run({ ...p0, clip: "Wired shape" }).paths.length === 0, "Wired shape without a region -> EMPTY");
  const reg = rect(80, 50, 140, 100);
  const rw = run({ ...p0, clip: "Wired shape", radius: 200, scales: "None", labels: false }, CTX, [reg, undefined]);
  ok(rw.paths.length > 0 && rw.paths.every((q) => q.pts.every(([x, y]) => x >= 80 - 0.05 && x <= 220 + 0.05 && y >= 50 - 0.05 && y <= 150 + 0.05)), "Wired shape: every point inside the wired rectangle");
  const G2 = def._build({ ...p0, clip: "Sheet", radius: 200 }, CTX);
  ok(G2.Rmm === 200, "Sheet / Wired keep Radius exact (no disc fit)");
}

/* ---------------------------------------------------------- param liveness */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ map: "Admittance" }, "map");
diff({ clip: "Sheet", radius: 200 }, "clip");
diff({ radius: 50 }, "radius");
diff({ minorDiv: 2 }, "minorDiv");
diff({ depth: 0 }, "depth");
diff({ cell: 3 }, "cell");
diff({ step: 1.5 }, "step");
diff({ axis: false }, "axis");
diff({ scales: "Angle" }, "scales");
diff({ labels: false }, "labels");
diff({ labelSize: 4 }, "labelSize");
diff({ yoff: 5, radius: 40 }, "yoff");
diff({ margin: 30 }, "margin");
diff({ penMajor: 3 }, "penMajor");
diff({ penMinor: 3 }, "penMinor");
diff({ penFine: 3 }, "penFine");
diff({ penScale: 3 }, "penScale");
diff({ penLabel: 3 }, "penLabel");
diff({ map: "Immittance", penY: 3 }, "penY");
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const ins = pd.key === "clip" && opt === "Wired shape" ? [rect(80, 50, 140, 100), undefined] : undefined;
    const r = run({ ...p0, [pd.key]: opt }, CTX, ins);
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* ---------------------------------------------------------- degenerate / extreme */
ok(finiteAll(run({ ...p0, radius: 0, cell: 0, step: 0, minorDiv: 0, depth: -1, margin: -3, labelSize: 0, range: 0, majors: 0 })), "degenerate params produce no NaN");
{
  const t0 = Date.now();
  const ext = run({ ...p0, map: "Immittance", depth: 3, minorDiv: 10, cell: 0.5, step: 0.3, radius: 300, margin: 0 }, { W: 594, H: 420 });
  const ms = Date.now() - t0;
  ok(finiteAll(ext) && npts(ext) <= 120000 && inb(ext, 594, 420), "extreme A2 Immittance: finite, on-sheet, budget held (" + npts(ext) + " pts)");
  ok(byPen(ext, p0.penMajor).length > 40, "budget trims fine levels first, majors survive (" + byPen(ext, p0.penMajor).length + " major paths)");
  ok(ms < 6000, "extreme case computes in " + ms + " ms");
  const t1 = Date.now(); run(p0); const d = Date.now() - t1; ok(d < 600, "defaults compute in " + d + " ms");
}
ok(finiteAll(run(p0, { W: 20, H: 20 })) && inb(run(p0, { W: 20, H: 20 }), 20, 20), "20 x 20 mm canvas: on-sheet");

/* ---------------------------------------------------------- showIf */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis(p0).includes("range") && vis({ ...p0, map: "Joukowski" }).includes("range"), "Range hidden for Smith maps");
  ok(!vis(p0).includes("exponent") && vis({ ...p0, map: "Power z^n" }).includes("exponent"), "Exponent only for Power");
  ok(!vis(p0).includes("penY") && vis({ ...p0, map: "Immittance" }).includes("penY"), "Admittance pen only for Immittance");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "hidden params carry defaults");
}

/* ---------------------------------------------------------- overlay */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 3 && g1[1].kind === "circle" && Math.abs(g1[1].r - G.Rmm) < 1e-9, "overlay: margin box + disc + outer ring circle");
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }); def.overlay.call(undefined, p0, CTX); def.overlay({ ...p0, scales: "None", labels: false }, CTX); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws");
  ok(def.overlay({ ...p0, scales: "None", labels: false }, CTX).length === 2, "no dressing -> no outer ring guide");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
