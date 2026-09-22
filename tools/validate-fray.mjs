/* Validator for the Fray node (key: fray).
   Run from the repo root: node tools/validate-fray.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "fray";

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

/* ---------- fixture: an arch ring (clockwise on screen), a box on pen 4, an open line on pen 7 ---------- */
const ARCH = { pts: [[110, 60], [190, 60], [190, 190], [165, 190], [165, 110], [135, 110], [135, 190], [110, 190]], closed: true, layer: 0 };
const BOX = { pts: [[125, 15], [175, 15], [175, 50], [125, 50]], closed: true, layer: 4 };
const LINE = { pts: [[20, 200], [60, 180], [90, 195]], closed: false, layer: 7 };
const FIX = { paths: [ARCH, BOX, LINE] };
const CTX = { W: 297, H: 210 };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx, fix) => def.compute([fix || FIX], p, ctx || CTX, {});
const isSrc = (q, fix) => (fix || FIX).paths.includes(q);
const threads = (r, fix) => r.paths.filter((q) => !isSrc(q, fix) && !q.closed);
const beads = (r, fix) => r.paths.filter((q) => !isSrc(q, fix) && q.closed);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

/* ---------- geometry ---------- */
const segDist = (P, A, B) => {
  const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2));
  return Math.hypot(P[0] - (A[0] + dx * t), P[1] - (A[1] + dy * t));
};
const distToSrc = (P, fix) => {
  let b = Infinity;
  for (const pa of (fix || FIX).paths) {
    const Q = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
    for (let i = 0; i + 1 < Q.length; i++) b = Math.min(b, segDist(P, Q[i], Q[i + 1]));
  }
  return b;
};
const ringContains = (ring, x, y) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};
const insideSrc = (x, y) => { let c = false; for (const pa of FIX.paths) if (pa.closed && ringContains(pa.pts, x, y)) c = !c; return c; };
const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
const segsCross = (A, B, C, D) => {
  const d1 = cross(C[0], C[1], D[0], D[1], A[0], A[1]), d2 = cross(C[0], C[1], D[0], D[1], B[0], B[1]);
  const d3 = cross(A[0], A[1], B[0], B[1], C[0], C[1]), d4 = cross(A[0], A[1], B[0], B[1], D[0], D[1]);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};
/* global proper-crossing count over every segment of the result (spatial hash, adjacent segments excluded) */
const crossingCount = (r) => {
  const segs = [];
  r.paths.forEach((q, pi) => {
    const Q = q.closed ? [...q.pts, q.pts[0]] : q.pts;
    for (let i = 0; i + 1 < Q.length; i++) segs.push([Q[i], Q[i + 1], pi, i]);
  });
  const CELL = 4, grid = new Map();
  const key = (x, y) => x * 100003 + y;
  let count = 0;
  for (const s of segs) {
    const x0 = Math.floor(Math.min(s[0][0], s[1][0]) / CELL), x1 = Math.floor(Math.max(s[0][0], s[1][0]) / CELL);
    const y0 = Math.floor(Math.min(s[0][1], s[1][1]) / CELL), y1 = Math.floor(Math.max(s[0][1], s[1][1]) / CELL);
    const seen = new Set();
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = key(cx, cy);
      let arr = grid.get(k);
      if (!arr) { arr = []; grid.set(k, arr); }
      for (const o of arr) {
        if (seen.has(o)) continue; seen.add(o);
        if (o[2] === s[2] && Math.abs(o[3] - s[3]) <= 1) continue;
        if (segsCross(s[0], s[1], o[0], o[1])) count++;
      }
      arr.push(s);
    }
  }
  return count;
};

/* mutation tests */
{
  const bad = { paths: [ARCH, { pts: [[100, 100], [200, 100]], closed: false, layer: 1 }] };
  ok(crossingCount(bad) === 2, "oracle mutation: crossing counter sees a line piercing both arch legs (" + crossingCount(bad) + ")");
  ok(crossingCount({ paths: [ARCH, BOX, LINE] }) === 0, "oracle sanity: fixture itself is crossing-free");
  ok(distToSrc([150, 100]) > 5 && distToSrc([110, 100]) < 1e-9, "oracle sanity: distance-to-source");
  ok(insideSrc(150, 80) && !insideSrc(150, 150) && !insideSrc(50, 50), "oracle sanity: inside test (arch body in, doorway out, margin out)");
}

const p0 = defaults();

/* ---------- universal invariants ---------- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(threads(r1).length > 30, "non-empty at defaults (" + threads(r1).length + " threads, " + beads(r1).length + " beads, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.05;
const inb = (r, W, Hh, mm) => r.paths.filter((q) => !isSrc(q)).every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "Clip to margin: every fray point inside the margin box");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "in bounds on A4 tall");
ok(inb(run({ ...p0, margin: 30 }), 297, 210, 30), "Margin 30 respected");
ok(r1.paths.filter((q) => isSrc(q)).length === 3, "Keep source: source paths pass through");
ok(run({ ...p0, keepSrc: false }).paths.filter((q) => isSrc(q)).length === 0, "Keep source off");

/* ---------- roots & structure ---------- */
{
  const th = threads(r1);
  ok(th.every((q) => distToSrc(q.pts[0]) < 0.05), "every thread starts on the source line (segment distance < 0.05 mm)");
  const g = def.overlay(p0, CTX, [FIX], {});
  const roots = g.filter((q) => q.kind === "point");
  ok(g.some((q) => q.kind === "rect") && roots.length >= th.length, "overlay: margin rect + root points (" + roots.length + " roots, " + th.length + " threads)");
  ok(th.every((q) => roots.some((rt) => Math.hypot(rt.x - q.pts[0][0], rt.y - q.pts[0][1]) < 1e-6)), "every thread root coincides with an overlay root point");
  ok(!def.overlay({ ...p0, clip: false }, CTX, [FIX], {}).some((q) => q.kind === "rect"), "overlay: no margin rect when Clip is off");
  ok(beads(r1).length > 0 && beads(r1).every((q) => q.pts.length === 16), "beads are small closed rings");
  ok(beads(run({ ...p0, beads: 0 })).length === 0, "Beads 0: no beads");
  ok(beads(run({ ...p0, beads: 1 })).length > beads(r1).length, "Beads 1: more beads than default");
}

/* ---------- straight-thread oracle: no wave, no wander, no spread, no variation, no ends ---------- */
{
  const ps = { ...p0, waveAmp: 0, wander: 0, spread: 0, lenVar: 0, end: "None", hitches: 0, beads: 0, clip: false, drift: 0, length: 40, spacing: 10 };
  const r = run(ps);
  const th = threads(r);
  const len = (q) => { let L = 0; for (let i = 1; i < q.pts.length; i++) L += Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1]); return L; };
  ok(th.length > 10 && th.every((q) => Math.abs(len(q) - 40) < 0.7), "straight mode: every thread is Length mm long (40 ± 0.7)");
  const straight = (q) => { const A = q.pts[0], B = q.pts[q.pts.length - 1]; return q.pts.every((P) => segDist(P, A, B) < 0.05); };
  ok(th.every(straight), "straight mode: every thread is a straight segment");
  /* Outward: 5 mm along every arch/box thread is outside that closed shape */
  const archBox = th.filter((q) => distToSrc(q.pts[0], { paths: [ARCH, BOX] }) < 1e-6);
  const at5 = (q) => { const A = q.pts[0], B = q.pts[q.pts.length - 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]); return [A[0] + ((B[0] - A[0]) / L) * 3, A[1] + ((B[1] - A[1]) / L) * 3]; };
  const outwardOK = archBox.every((q) => { const P = at5(q); const onArch = distToSrc(q.pts[0], { paths: [ARCH] }) < 1e-6; return onArch ? !ringContains(ARCH.pts, P[0], P[1]) : !ringContains(BOX.pts, P[0], P[1]); });
  ok(archBox.length > 10 && outwardOK, "Outward: 3 mm along every closed-shape thread lies outside its own shape (" + archBox.length + " threads)");
  const r2b = run({ ...ps, length: 80 });
  ok(threads(r2b).every((q) => Math.abs(len(q) - 80) < 0.7), "Length 80: threads are 80 mm");
  /* Side Left vs Right on the open line: opposite sides */
  const side = (r) => threads(r).filter((q) => distToSrc(q.pts[0], { paths: [LINE] }) < 1e-6).map((q) => {
    const A = q.pts[0], B = q.pts[q.pts.length - 1];
    const seg = segDist(A, LINE.pts[0], LINE.pts[1]) < 1e-6 ? [LINE.pts[0], LINE.pts[1]] : [LINE.pts[1], LINE.pts[2]];
    return Math.sign(cross(seg[0][0], seg[0][1], seg[1][0], seg[1][1], B[0], B[1]));
  });
  const L = side(run({ ...ps, side: "Left" })), Rr = side(run({ ...ps, side: "Right" }));
  ok(L.length > 3 && L.every((s) => s === L[0]) && Rr.every((s) => s === -L[0]), "Side Left / Right put open-line threads on opposite sides");
  const both = side(run({ ...ps, side: "Both" }));
  ok(both.some((s) => s > 0) && both.some((s) => s < 0), "Side Both: open-line threads on both sides");
  const alt = side(run({ ...ps, side: "Alternate" }));
  ok(alt.length > 3 && alt.every((s, i) => i === 0 || s === -alt[i - 1]), "Side Alternate: strictly alternating");
}

/* ---------- Avoid source ---------- */
{
  const r = run({ ...p0, avoid: true, spacing: 5 });
  const bad = r.paths.filter((q) => !isSrc(q)).some((q) => q.pts.some((P, i) => (i > 3 || q.closed) && insideSrc(P[0], P[1])));
  ok(!bad && threads(r).length > 30, "Avoid source: no thread/bead/coil point inside a closed source shape (" + threads(r).length + " threads)");
  const r0 = run({ ...p0, avoid: false, spacing: 5 });
  ok(r0.paths.filter((q) => !isSrc(q)).some((q) => q.pts.some((P) => insideSrc(P[0], P[1]))), "Avoid off: threads may run over the shape (control)");
}

/* ---------- Crossings: None ---------- */
for (const [label, patch] of Object.entries({ "None": { crossings: "None" }, "None + Avoid": { crossings: "None", avoid: true, spacing: 5 }, "None + Coil": { crossings: "None", end: "Coil", beads: 1 }, "None on A4 tall": { crossings: "None" } })) {
  const ctx = label.includes("tall") ? { W: 210, H: 297 } : CTX;
  const r = run({ ...p0, ...patch }, ctx);
  const c = crossingCount(r);
  ok(c === 0 && threads(r).length > 20, "Crossings " + label + ": zero proper crossings in the whole result (" + threads(r).length + " threads, " + npts(r) + " pts)");
}
ok(crossingCount(r1) > 20, "Crossings Allowed (control): default drawing does cross (" + crossingCount(r1) + ")");

/* ---------- ends ---------- */
{
  const base = { ...p0, hitches: 0, beads: 0, waveAmp: 0, wander: 0, spread: 0, lenVar: 0, clip: false, length: 30, spacing: 10 };
  const nNone = npts(run({ ...base, end: "None" }));
  for (const e of ["Coil", "Ring", "Knot", "Mix"]) ok(npts(run({ ...base, end: e })) > nNone + 200, "End " + e + " adds end pieces beyond the plain thread");
  const rc = run({ ...base, end: "Coil", coilSize: 10, coilVar: 0 });
  const far = threads(rc).every((q) => { const A = q.pts[0]; return q.pts.some((P) => Math.hypot(P[0] - A[0], P[1] - A[1]) > 30 + 10) ; });
  ok(far, "Coil size 10: coil reaches beyond thread end");
  ok(threads(run({ ...base, end: "Coil", coilSize: 2, coilVar: 0 })).every((q) => q.pts.every((P) => Math.hypot(P[0] - q.pts[0][0], P[1] - q.pts[0][1]) < 30 + 2 * 2.6 + 0.5)), "Coil size 2: coil stays within ~2.6R of the thread end");
}

/* ---------- pens ---------- */
{
  const lay = (r) => new Set(threads(r).map((q) => q.layer));
  ok(lay(r1).size <= 6 && lay(r1).size >= 4 && [...lay(r1)].every((l) => l >= 0 && l < 6), "Pens used 6 from First pen 0: thread pens within 0..5");
  ok(lay(run({ ...p0, pens: 1 })).size === 1, "Pens used 1: a single pen");
  ok([...lay(run({ ...p0, pen0: 9, pens: 4 }))].every((l) => [9, 10, 11, 0].includes(l)), "First pen 9 + 4 pens wraps 9,10,11,0");
  const ri = run({ ...p0, inherit: true });
  const inh = threads(ri).every((q) => { const onLine = distToSrc(q.pts[0], { paths: [LINE] }) < 1e-6, onBox = distToSrc(q.pts[0], { paths: [BOX] }) < 1e-6; return q.layer === (onLine ? 7 : onBox ? 4 : 0); });
  ok(inh, "Inherit source pens: every thread takes its root path's pen");
  ok(beads(ri).every((q) => [0, 4, 7].includes(q.layer)), "Inherit: beads follow too");
}

/* ---------- liveness ---------- */
const J = (r) => JSON.stringify(r);
const live = (base, patch, label) => ok(J(run({ ...base, ...patch })) !== J(run(base)), "param live: " + label);
live(p0, { spacing: 15 }, "spacing");
live(p0, { spJit: 0 }, "spJit");
live(p0, { side: "Both" }, "side");
live(p0, { avoid: true }, "avoid");
live(p0, { spread: 60 }, "spread");
live({ ...p0, drift: 0.5 }, { driftAng: 90 }, "driftAng (drift on)");
live(p0, { drift: 0.5 }, "drift");
live(p0, { length: 150 }, "length");
live(p0, { lenVar: 0 }, "lenVar");
live(p0, { clip: false }, "clip");
live(p0, { margin: 30 }, "margin");
live(p0, { waveAmp: 3 }, "waveAmp");
live(p0, { waveLen: 30 }, "waveLen");
live(p0, { wander: 0 }, "wander");
live(p0, { hitches: 0 }, "hitches");
live(p0, { beads: 0 }, "beads");
live(p0, { end: "None" }, "end");
live({ ...p0, end: "Coil" }, { coilSize: 12 }, "coilSize");
live({ ...p0, end: "Coil" }, { coilVar: 0 }, "coilVar");
live(p0, { crossings: "None" }, "crossings");
live(p0, { pen0: 3 }, "pen0");
live(p0, { pens: 1 }, "pens");
live(p0, { inherit: true }, "inherit");
live(p0, { keepSrc: false }, "keepSrc");
live(p0, { seed: 99 }, "seed");

/* ---------- every select option renders ---------- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(threads(r).length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite threads (" + threads(r).length + ")");
}

/* ---------- degenerate / extreme ---------- */
{
  let threw = false, rE;
  try { rE = def.compute([undefined], p0, CTX, {}); } catch (e) { threw = true; }
  ok(!threw && rE && rE.paths.length === 0, "no input: empty output, no throw");
  const DEG = { paths: [{ pts: [[1, 1]], closed: false, layer: 0 }, { pts: [[NaN, 1], [3, 3]], closed: false, layer: 0 }, { pts: [[5, 5], [5, 5], [5, 5]], closed: true, layer: 0 }] };
  try { rE = def.compute([DEG], p0, CTX, {}); } catch (e) { threw = true; }
  ok(!threw && threads(rE, DEG).length === 0 && rE.paths.length === 3, "degenerate input (1-pt, NaN, zero-length ring): no throw, no threads, inputs pass through");
  const ext = run({ ...p0, spacing: 2, spJit: 0, length: 300, lenVar: 0, end: "Coil", coilSize: 15, beads: 1, hitches: 1, pens: 12 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme (spacing 2, length 300, big coils): finite + budget held (" + npts(ext) + " pts)");
  const extN = run({ ...p0, spacing: 2, length: 300, crossings: "None", avoid: true });
  ok(finiteAll(extN) && npts(extN) <= 120000 && crossingCount(extN) === 0, "extreme + Crossings None: budget held and still crossing-free (" + npts(extN) + " pts)");
  ok(finiteAll(run(p0, { W: 30, H: 30 }, { paths: [{ pts: [[10, 10], [20, 10], [20, 20], [10, 20]], closed: true, layer: 0 }] })), "tiny canvas: finite");
}

/* ---------- showIf ---------- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(vis(p0).includes("margin") && !vis({ ...p0, clip: false }).includes("margin"), "showIf: margin follows Clip");
  ok(vis(p0).includes("hitches") && !vis({ ...p0, crossings: "None" }).includes("hitches"), "showIf: hitches hidden in Crossings None");
  ok(vis(p0).includes("coilSize") && !vis({ ...p0, end: "None" }).includes("coilSize"), "showIf: coil params hidden for End None");
  ok(vis(p0).includes("pens") && !vis({ ...p0, inherit: true }).includes("pens"), "showIf: Pens used hidden when inheriting");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
}

/* ---------- overlay robustness ---------- */
{
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }, undefined, undefined); def.overlay(p0, undefined, [undefined]); def.overlay(p0, CTX, [{ paths: [{ pts: [[NaN, 0], [1, 1]], closed: false }] }]); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate / missing input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
