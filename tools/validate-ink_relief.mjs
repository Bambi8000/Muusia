/* Validator for the Ink Relief node.
   Run from the repo root: node tools/validate-ink_relief.mjs

   The headline test is physical rather than structural: build a stack of rings
   that all turn at the same spike, measure how much path length lands within a
   millimetre of it, and require every relief mode to cut that down. A node
   that only moved points around would pass a shape test and still bead ink. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "ink_relief";
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
const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (input, p) => def.compute([input], p, { W: 200, H: 200 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((t) => Number.isFinite(t[0]) && Number.isFinite(t[1])));

/* ---- fixtures ---- */
const TIP = [100, 38];
const spikeStack = (rings) => {
  const paths = [];
  for (let k = 0; k < rings; k++) {
    const r = 18 + k * 1.7, pts = [];
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2 - Math.PI / 2;
      if (s === 0) pts.push([TIP[0] + (k - rings / 2) * 0.03, TIP[1] + (k - rings / 2) * 0.03]);
      else pts.push([100 + Math.cos(a) * r, 100 + Math.sin(a) * r]);
    }
    paths.push({ pts, closed: true, layer: 0 });
  }
  return { paths };
};
/* a lone square far away: nothing here may ever be touched */
const lonely = { paths: [{ pts: [[10, 150], [30, 150], [30, 170], [10, 170]], closed: true, layer: 3 }] };
const mixed = { paths: [...spikeStack(28).paths, ...lonely.paths] };

const inkNear = (ps, cx, cy, rad, layer) => {
  let L = 0;
  for (const q of ps.paths) {
    if (layer !== undefined && q.layer !== layer) continue;
    const pts = q.closed ? [...q.pts, q.pts[0]] : q.pts;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const da = Math.hypot(a[0] - cx, a[1] - cy), db = Math.hypot(b[0] - cx, b[1] - cy);
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (da < rad && db < rad) L += seg;
      else if (da < rad || db < rad) L += seg * 0.5;
    }
  }
  return L;
};

const p0 = defaults();
const stack = spikeStack(28);
const base = inkNear(stack, TIP[0], TIP[1], 1.0);

/* ---- universal ---- */
const pc = { ...p0, target: "Corners" };
const r1 = run(stack, pc), r2 = run(stack, pc);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 200000, "point budget at defaults");

/* ---- THE test: every mode must actually remove ink from the pile-up ---- */
console.log("     baseline: " + base.toFixed(1) + " mm of path within 1 mm of the spike");
for (const [label, patch, ceiling] of [
  ["Round", { target: "Corners", cornerMode: "Round" }, 0.6],
  ["Fan", { target: "Corners", cornerMode: "Fan", amount: 3 }, 0.6],
  ["Fan 6 mm", { target: "Corners", cornerMode: "Fan", amount: 6 }, 0.25],
  ["Notch", { target: "Corners", cornerMode: "Notch", amount: 2 }, 0.02],
]) {
  const v = inkNear(run(stack, { ...p0, ...patch }), TIP[0], TIP[1], 1.0);
  ok(v < base * ceiling, label + " cuts ink at the spike to " + (100 * v / base).toFixed(0) + "% (limit " + (ceiling * 100) + "%)");
}
/* more relief must mean less ink, monotonically */
const ink = (a) => inkNear(run(stack, { ...p0, target: "Corners", cornerMode: "Fan", amount: a }), TIP[0], TIP[1], 1.0);
ok(ink(1) > ink(3) && ink(3) > ink(6), "more Amount means less ink at the spike (monotonic)");

/* ---- everything outside a hotspot must come through untouched ---- */
const mixOut = run(mixed, pc);
const lonelyOut = mixOut.paths.filter((q) => q.layer === 3);
ok(lonelyOut.length === 1, "the distant square survives as one path");
ok(JSON.stringify(lonelyOut[0].pts.map((q) => [q[0], q[1]])) === JSON.stringify(lonely.paths[0].pts),
  "a path with no pile-up is passed through byte-identical");
ok(inkNear(mixOut, 20, 160, 30, 3) === inkNear(lonely, 20, 160, 30, 3), "untouched geometry keeps its exact length");

/* ---- the gates must be able to switch the node off ---- */
const same = (r) => JSON.stringify(r.paths.map((q) => [q.pts, q.closed, q.layer]));
const passthrough = same({ paths: stack.paths.map((q) => ({ ...q })) });
ok(same(run(stack, { ...p0, target: "Corners", minCount: 40 })) === passthrough, "Min corners above the pile size disables the node");
ok(same(run(stack, { ...p0, target: "Corners", minTurn: 150 })) === passthrough, "Min turn above the corner angle disables the node");
ok(same(run(stack, { ...p0, target: "Corners", radius: 0.2 })) !== passthrough, "a tight Detect radius still finds a tight pile");
ok(same(run(stack, { ...p0, target: "Corners", amount: 0.1 })) !== passthrough, "a small Amount still does something");

/* ---- structure per mode ---- */
const rd = run(stack, { ...p0, target: "Corners", cornerMode: "Round" });
ok(rd.paths.length === stack.paths.length, "Round keeps the path count");
ok(rd.paths.every((q) => q.closed === true), "Round keeps closed paths closed");
ok(npts(rd) > npts(stack), "Round adds fillet points (" + npts(stack) + " -> " + npts(rd) + ")");
const fn = run(stack, { ...p0, target: "Corners", cornerMode: "Fan", amount: 3 });
ok(fn.paths.length === stack.paths.length && npts(fn) === npts(stack), "Fan moves points without adding or removing any");
ok(fn.paths.every((q) => q.closed === true), "Fan keeps closed paths closed");
const nt = run(stack, { ...p0, target: "Corners", cornerMode: "Notch", amount: 2 });
ok(nt.paths.every((q) => q.closed === false), "Notch opens every path it cuts");
ok(nt.paths.length >= stack.paths.length, "Notch yields at least one piece per ring (" + nt.paths.length + ")");
ok(nt.paths.every((q) => q.layer === 0), "Notch pieces inherit the pen of their path");

/* Fan: the innermost corner stays put, the outermost moves the full Amount */
const tips = (r) => r.paths.filter((q) => q.layer === 0).map((q) => q.pts[0]);
const moved = tips(fn).map((q, i) => Math.hypot(q[0] - tips(stack)[i][0], q[1] - tips(stack)[i][1]));
ok(Math.min(...moved) < 1e-9, "Fan leaves the seed corner of the cluster where it was");
ok(Math.max(...moved) > 2.5 && Math.max(...moved) <= 3 + 1e-6, "Fan displaces the outermost corner by Amount, never further");

/* ---- hotspot marks ---- */
const noMark = run(stack, { ...p0, target: "Corners", showMarks: false });
const withMark = run(stack, { ...p0, target: "Corners", showMarks: true, markPen: 5 });
ok(withMark.paths.length === noMark.paths.length + 1, "Show hotspots adds exactly one ring per cluster");
const rings = withMark.paths.filter((q) => q.layer === 5);
ok(rings.length === 1 && rings[0].closed, "the hotspot ring is closed and on the chosen pen");
const rc = rings[0].pts.reduce((a, q) => [a[0] + q[0] / rings[0].pts.length, a[1] + q[1] / rings[0].pts.length], [0, 0]);
ok(Math.hypot(rc[0] - TIP[0], rc[1] - TIP[1]) < p0.radius, "the ring is centred on the pile-up it found");
ok(JSON.stringify(withMark.paths.filter((q) => q.layer === 0)) === JSON.stringify(noMark.paths.filter((q) => q.layer === 0)),
  "marks never alter the drawing itself");

/* ---- density scaling ---- */
const small = spikeStack(8), big = spikeStack(40);
const relief = (st) => {
  const before = inkNear(st, TIP[0], TIP[1], 1.0);
  const after = inkNear(run(st, { ...p0, target: "Corners", cornerMode: "Fan", amount: 4 }), TIP[0], TIP[1], 1.0);
  return 1 - after / before;
};
ok(relief(big) > relief(small), "a denser pile gets proportionally more relief (" +
  (relief(small) * 100).toFixed(0) + "% vs " + (relief(big) * 100).toFixed(0) + "%)");

/* ---- param liveness ---- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run(stack, { ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ target: "Overlaps" }, "target");
diff({ cornerMode: "Fan" }, "cornerMode");
diff({ target: "Corners", amount: 4 }, "amount");
diff({ target: "Corners", radius: 8 }, "radius");
diff({ target: "Corners", minCount: 40 }, "minCount");
diff({ target: "Corners", fullAt: 100 }, "fullAt");
diff({ target: "Corners", minTurn: 150 }, "minTurn");
diff({ target: "Corners", steps: 12 }, "steps");
diff({ target: "Corners", showMarks: true }, "showMarks");
ok(JSON.stringify(run(stack, { ...pc, showMarks: true, markPen: 9 })) !== JSON.stringify(run(stack, { ...pc, showMarks: true })), "param live: markPen");

/* ---- degenerate input ---- */
ok(run(undefined, p0).paths.length === 0, "no input yields an empty result");
ok(run({ paths: [] }, p0).paths.length === 0, "empty input yields an empty result");
ok(finiteAll(run({ paths: [{ pts: [[0, 0], [1, 1]], closed: false, layer: 0 }] }, p0)), "a two-point path survives");
ok(finiteAll(run({ paths: [{ pts: [[5, 5], [5, 5], [5, 5]], closed: true, layer: 0 }] }, p0)), "a degenerate zero-length path produces no NaN");
const openStack = { paths: spikeStack(20).paths.map((q) => ({ ...q, closed: false })) };
ok(finiteAll(run(openStack, { ...p0, target: "Corners", cornerMode: "Notch" })), "Notch on open paths produces no NaN");
ok(run(openStack, { ...p0, target: "Corners", cornerMode: "Notch" }).paths.length >= openStack.paths.length, "Notch on open paths yields pieces");
ok(finiteAll(run(stack, { ...p0, amount: 10, radius: 20, minCount: 2, fullAt: 3, minTurn: 5, steps: 16 })), "extreme params produce no NaN");
const heavy = { paths: [] };
for (let k = 0; k < 400; k++) heavy.paths.push(spikeStack(1).paths[0]);
const hv = run(heavy, { ...p0, target: "Corners", minCount: 2, cornerMode: "Round", steps: 16 });
ok(finiteAll(hv) && npts(hv) <= 200000, "heavy input holds the budget (" + npts(hv) + " pts)");

/* ---- showIf ---- */
const visOf = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
ok(visOf(pc).includes("steps") && !visOf({ ...pc, cornerMode: "Fan" }).includes("steps"), "showIf: fillet steps only in Round");
ok(!visOf(p0).includes("markPen") && visOf({ ...p0, showMarks: true }).includes("markPen"), "showIf: hotspot pen only when marks are on");


/* ================= overlap pass =================
   A pinch where many rings collapse onto one straight run: the pen redraws the
   same 50 mm line 26 times. Corner detection sees nothing here — there is no
   corner — so this needs its own fixture and its own oracles. */
const neckStack = (rings, drift) => {
  const paths = [];
  for (let k = 0; k < rings; k++) {
    const off = k * drift, pts = [];
    for (let s = 0; s <= 30; s++) pts.push([100 + off, 40 + s * (50 / 30)]);
    const r = 8 + k * 1.5;
    for (let s = 1; s < 24; s++) {
      const a = Math.PI / 2 + (s / 24) * Math.PI;
      pts.push([100 + off + Math.cos(a) * r, 65 + Math.sin(a) * r * 0.9]);
    }
    paths.push({ pts, closed: true, layer: 0 });
  }
  return { paths };
};
const neck = neckStack(26, 0.05);
const po = { ...p0, target: "Overlaps" };
/* band width = how far apart the neck passes actually are on paper */
const bandWidth = (ps) => {
  /* the neck is the rightmost part of each ring inside the y band; taking the
     max per path avoids picking up the lobe, which sweeps left */
  const xs = [];
  for (const q of ps.paths) {
    if (q.layer !== 0) continue;
    const inBand = q.pts.filter((t) => t[1] > 55 && t[1] < 75);
    if (inBand.length) xs.push(Math.max(...inBand.map((t) => t[0])));
  }
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
};
const neckInk = (ps) => inkNear(ps, 100, 65, 3, 0);

const nBase = neckInk(neck), wBase = bandWidth(neck);
console.log("     neck baseline: " + nBase.toFixed(0) + " mm of ink, band " + wBase.toFixed(2) + " mm wide");
ok(nBase > 100 && wBase < 2, "fixture really is a pile-up: 26 passes inside a 2 mm band");

const oDet = run(neck, po);
ok(JSON.stringify(oDet) === JSON.stringify(run(neck, po)), "overlap pass is deterministic");
ok(finiteAll(oDet), "overlap pass keeps every coordinate finite");
ok(oDet.paths.every((q) => Number.isInteger(q.layer)), "overlap pass keeps integer pens");

/* Spread does not remove ink, it widens the band — so that is what is measured */
for (const [amt, least] of [[2, 1.8], [4, 3], [8, 5]]) {
  const w = bandWidth(run(neck, { ...po, overlapMode: "Spread", amount: amt }));
  ok(w > least, "Spread " + amt + " mm widens the band to " + w.toFixed(2) + " mm (was " + wBase.toFixed(2) + ")");
}
const wid = (a) => bandWidth(run(neck, { ...po, overlapMode: "Spread", amount: a }));
ok(wid(2) < wid(4) && wid(4) < wid(8), "band width grows with Amount (monotonic)");
const sp = run(neck, { ...po, overlapMode: "Spread", amount: 4 });
ok(sp.paths.length === neck.paths.length && npts(sp) === npts(neck), "Spread moves points without adding or removing any");
ok(sp.paths.every((q) => q.closed === true), "Spread keeps closed paths closed");

/* Thin and Taper remove ink from the run */
const th = run(neck, { ...po, overlapMode: "Thin" });
const tp = run(neck, { ...po, overlapMode: "Taper" });
ok(neckInk(th) < nBase * 0.6, "Thin cuts neck ink to " + (100 * neckInk(th) / nBase).toFixed(0) + "%");
ok(neckInk(tp) < nBase * 0.4, "Taper cuts neck ink to " + (100 * neckInk(tp) / nBase).toFixed(0) + "%");
ok(th.paths.concat(tp.paths).every((q) => q.pts.length >= 2), "cut pieces are never degenerate");
const keepMore = neckInk(run(neck, { ...po, overlapMode: "Thin", keepEvery: 2 }));
const keepLess = neckInk(run(neck, { ...po, overlapMode: "Thin", keepEvery: 8 }));
ok(keepMore > keepLess, "Keep every Nth controls how much survives (" + keepMore.toFixed(0) + " vs " + keepLess.toFixed(0) + " mm)");

/* Taper must keep the silhouette: the outermost passes stay whole */
const outer = tp.paths.filter((q) => q.layer === 0 && q.pts.some((t) => t[0] > 101.1));
ok(outer.length > 0, "Taper leaves the outermost pass of the stack intact");

/* the gates switch the overlap pass off */
const oPass = JSON.stringify(neck.paths.map((q) => [q.pts, q.closed, q.layer]));
const asList = (r) => JSON.stringify(r.paths.map((q) => [q.pts, q.closed, q.layer]));
ok(asList(run(neck, { ...po, minCount: 40 })) === oPass, "Min passes above the stack size disables the overlap pass");
ok(asList(run(neck, { ...po, oSpan: 60 })) === oPass, "Min run longer than the 50 mm pile leaves it alone");
ok(asList(run(neck, { ...po, oTol: 0.1 })) === oPass, "a gap tolerance below the drift finds nothing");

/* lines that merely cross must never be mistaken for a pile */
const crossing = { paths: [] };
for (let k = 0; k < 30; k++) {
  const a = (k / 30) * Math.PI;
  crossing.paths.push({ pts: [[100 - Math.cos(a) * 40, 65 - Math.sin(a) * 40], [100 + Math.cos(a) * 40, 65 + Math.sin(a) * 40]], closed: false, layer: 0 });
}
ok(asList(run(crossing, po)) === JSON.stringify(crossing.paths.map((q) => [q.pts, q.closed, q.layer])),
  "30 lines crossing at one point are not treated as an overlap");

/* the corner fixture has no overlaps, and the neck fixture has no corners */
/* the spike stack genuinely does contain near-parallel runs feeding the tip, so
   the overlap pass is expected to fire there; what must stay untouched is
   geometry with no pile at all */
const farOnly = run(lonely, po);
ok(JSON.stringify(farOnly.paths.map((q) => [q.pts, q.closed, q.layer])) ===
   JSON.stringify(lonely.paths.map((q) => [q.pts, q.closed, q.layer])),
  "a lone shape is untouched by the overlap pass");
const cOnNeck = run(neck, { ...p0, target: "Corners" });
ok(neckInk(cOnNeck) > nBase * 0.95, "the neck fixture is untouched by the corner pass");

/* Both runs corners first, then overlaps on that result */
const both = run(mixed, { ...p0, target: "Both" });
ok(finiteAll(both) && both.paths.length > 0, "Both produces a finite non-empty result");
const bothNeck = run(neck, { ...p0, target: "Both", overlapMode: "Taper" });
ok(neckInk(bothNeck) < nBase * 0.6, "Both still relieves the neck (" + (100 * neckInk(bothNeck) / nBase).toFixed(0) + "%)");

/* overlap hotspots are drawn as the run that was found, not as a huge circle */
const om = run(neck, { ...po, showMarks: true, markPen: 6 });
const runMarks = om.paths.filter((q) => q.layer === 6);
ok(runMarks.length >= 1 && runMarks.every((q) => q.pts.length === 2 && !q.closed), "overlap hotspots are drawn as line segments");
const rm = runMarks[0];
ok(Math.abs(rm.pts[0][0] - rm.pts[1][0]) < 1 && Math.abs(rm.pts[0][1] - rm.pts[1][1]) > 10, "the hotspot line follows the run it found");

/* param liveness for the overlap side */
const oJ = JSON.stringify(run(neck, po));
const odiff = (patch, label) => ok(JSON.stringify(run(neck, { ...po, ...patch })) !== oJ, "param live: " + label);
odiff({ overlapMode: "Thin" }, "overlapMode");
odiff({ oTol: 2 }, "oTol");
odiff({ oAngle: 25 }, "oAngle");
odiff({ oSpan: 60 }, "oSpan");
ok(JSON.stringify(run(neck, { ...po, overlapMode: "Thin", keepEvery: 8 })) !== JSON.stringify(run(neck, { ...po, overlapMode: "Thin" })), "param live: keepEvery");

/* showIf for the overlap side */
ok(!visOf({ ...p0, target: "Corners" }).includes("overlapMode"), "showIf: overlap controls hidden in Corners");
ok(!visOf({ ...p0, target: "Overlaps" }).includes("cornerMode"), "showIf: corner controls hidden in Overlaps");
ok(visOf({ ...p0, target: "Both" }).includes("cornerMode") && visOf({ ...p0, target: "Both" }).includes("overlapMode"), "showIf: Both shows both families");
ok(!visOf({ ...po, overlapMode: "Spread" }).includes("keepEvery") && visOf({ ...po, overlapMode: "Thin" }).includes("keepEvery"), "showIf: Keep every Nth only in Thin");

/* budget on a heavy pile */
const heavyNeck = neckStack(120, 0.01);
const hn = run(heavyNeck, { ...po, overlapMode: "Spread", amount: 6 });
ok(finiteAll(hn) && npts(hn) <= 200000, "a 120-pass pile holds the budget (" + npts(hn) + " pts)");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
