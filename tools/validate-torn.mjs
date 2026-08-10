// Validator for Torn (standalone tear modifier). Run from repo root:
// node tools/validate-torn.mjs
// Auto-switches: prefers baked src/defs/nodes/torn.js, falls back to
// nodes-lab/torn.plotternode.js evaluated with the REAL src/defs/helpers.js.
import fs from "fs";
import * as H from "../src/defs/helpers.js";

let N, source;
if (fs.existsSync("src/defs/nodes/torn.js")) {
  N = (await import("../src/defs/nodes/torn.js")).default;
  source = "baked";
} else {
  const txt = fs.readFileSync("nodes-lab/torn.plotternode.js", "utf8");
  const keys = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample","pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  N = new Function(...keys, '"use strict"; return (' + txt + ");")(...keys.map((k) => H[k]));
  source = "lab";
}

const CTX = { W: 420, H: 297 };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (input, over = {}, ctx = CTX) => N.compute([input], { ...defs(), ...over }, ctx, {});
const J = (r) => JSON.stringify(r.paths);
const nPts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const allPts = (r) => r.paths.flatMap((q) => q.pts);

// synthetic inputs
const hatch = (() => {
  const paths = [];
  for (let j = 0; j < 60; j++) {
    const y = 20 + j * 4.3;
    const pts = [];
    for (let i = 0; i <= 190; i++) pts.push([20 + i * 2, y]);
    paths.push({ pts, closed: false, layer: j % 3 });
  }
  return { paths };
})();
const circles = (() => {
  const paths = [];
  for (let c = 1; c <= 12; c++) {
    const r = c * 11, pts = [];
    for (let k = 0; k < 256; k++) {
      const a = (k / 256) * Math.PI * 2;
      pts.push([CTX.W / 2 + Math.cos(a) * r, CTX.H / 2 + Math.sin(a) * r]);
    }
    paths.push({ pts, closed: true, layer: 4 });
  }
  return { paths };
})();

console.log(`Torn validator (${source} mode)`);

// 1. determinism + unwired guard
ok(J(run(hatch)) === J(run(hatch)), "determinism: identical JSON on double run");
ok(N.compute([undefined], defs(), CTX, {}).paths.length === 0, "guard: unwired input -> EMPTY");

// 2. structure on both inputs
for (const [name, input] of [["hatch", hatch], ["circles", circles]]) {
  const r = run(input);
  ok(r.paths.every((q) => q.pts.length >= 2), `structure: every path >= 2 pts (${name})`);
  ok(allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), `structure: finite coords (${name})`);
  ok(nPts(r) <= 120000, `budget: ${nPts(r)} <= 120000 (${name})`);
}

// 3. passthrough oracle: band moved fully off the geometry -> byte-identical output
{
  const r = run(hatch, { offset: 1000, detail: 0 });
  ok(J(r) === JSON.stringify(hatch.paths), "passthrough: off-geometry band leaves input byte-identical");
  const rc = run(circles, { offset: 1000, detail: 0 });
  ok(JSON.stringify(rc.paths) === JSON.stringify(circles.paths), "passthrough: closed paths preserved closed");
}

// 4. band-clearance oracle: bridge-only, ragged 0, gape 0, detail 0
{
  const r = run(hatch, { flingPct: 0, snapPct: 0, ragged: 0, gape: 0, detail: 0 });
  const A = (defs().angle * Math.PI) / 180;
  const perX = -Math.sin(A), perY = Math.cos(A);
  const cx = CTX.W / 2, cy = CTX.H / 2, w2 = defs().width / 2;
  const bad = allPts(r).filter(([x, y]) => Math.abs((x - cx) * perX + (y - cy) * perY) < w2 - 1e-6);
  ok(bad.length === 0, `band clearance: 0 vertices inside nominal band (found ${bad.length})`);
}

// 5. mode invariants on open paths
{
  const a = run(hatch, { flingPct: 0, snapPct: 0 }).paths.length;
  const b = run(hatch, { flingPct: 0, snapPct: 100 }).paths.length;
  const c = run(hatch, { flingPct: 100, snapPct: 0 }).paths.length;
  ok(b > a, `snap: snap-only path count ${b} > bridge-only ${a}`);
  ok(c === a, `fling: fling-only path count ${c} == bridge-only ${a}`);
  ok(nPts(run(hatch, { flingPct: 100, snapPct: 0 })) > nPts(run(hatch, { flingPct: 0, snapPct: 0 })),
    "fling: flung vertices kept (more points than bridge-only)");
}

// 6. closed-path handling: circles crossing the tear open up, untouched ones stay closed
{
  const r = run(circles, { flingPct: 0, snapPct: 0, ragged: 0, gape: 0 });
  const opened = r.paths.filter((q) => q.closed === false).length;
  const closed = r.paths.filter((q) => q.closed === true).length;
  ok(opened > 0, `closed paths: ${opened} circles opened by the tear`);
  ok(closed === 0 || closed < circles.paths.length, `closed paths: crossing circles no longer closed (${closed} intact)`);
  ok(r.paths.length <= circles.paths.length, "closed paths: bridge-only never multiplies closed paths");
  // fully swallowed circle (r=11 < width/2=22.5) is dropped in bridge mode
  ok(nPts(r) < nPts({ paths: circles.paths }), "closed paths: torn circles lose their in-band vertices");
}

// 7. layer preservation (modifier must not reroute pens)
{
  const inLayers = new Set(hatch.paths.map((q) => q.layer));
  const r = run(hatch);
  ok(r.paths.every((q) => inLayers.has(q.layer)), "layers: output layers subset of input layers");
}

// 8. detail resample + budget guard
{
  const r = run(hatch, { detail: 0.2 });
  ok(nPts(r) <= 120000, `detail: 0.2 mm resample stays in budget (${nPts(r)})`);
  ok(J(r) !== J(run(hatch, { detail: 0 })), "liveness: detail");
}

// 9. parameter liveness
ok(J(run(hatch, { seed: 1 })) !== J(run(hatch, { seed: 2 })), "liveness: seed");
for (const [k, v] of Object.entries({ angle: -20, offset: 60, width: 90, ragged: 0.1, gape: 30, fling: 120, chaos: 5, flingPct: 90, snapPct: 70 }))
  ok(J(run(hatch, { [k]: v })) !== J(run(hatch)), `liveness: ${k}`);

// 10. stacking smoke: Torn -> Torn with a different band
{
  const once = run(hatch);
  const twice = run(once, { angle: -30, offset: -40, seed: 11 });
  ok(twice.paths.length > 0 && allPts(twice).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
    "stacking: second Torn on first Torn's output is finite");
  ok(nPts(twice) <= 120000, `stacking: budget holds (${nPts(twice)})`);
  ok(J(twice) !== J(once), "stacking: second tear changes the result");
}

// 11. overlay: band poly at exactly width/2 + fling arrows
{
  const g = N.overlay(defs(), CTX);
  const poly = g.find((q) => q.kind === "poly");
  ok(poly && g.filter((q) => q.kind === "arrow").length === 2, "overlay: poly band + 2 arrows");
  const A = (defs().angle * Math.PI) / 180;
  const perX = -Math.sin(A), perY = Math.cos(A);
  const ds = poly.pts.map(([x, y]) => Math.abs((x - CTX.W / 2) * perX + (y - CTX.H / 2) * perY));
  ok(ds.every((d) => Math.abs(d - defs().width / 2) < 1e-6), "overlay: band edges at exactly width/2");
}

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
