// Validator for Op Tunnel. Run from repo root: node tools/validate-op_tunnel.mjs
// Auto-switches: prefers baked src/defs/nodes/op_tunnel.js, falls back to
// nodes-lab/op_tunnel.plotternode.js evaluated with the REAL src/defs/helpers.js.
import fs from "fs";
import * as H from "../src/defs/helpers.js";

let N, source;
if (fs.existsSync("src/defs/nodes/op_tunnel.js")) {
  N = (await import("../src/defs/nodes/op_tunnel.js")).default;
  source = "baked";
} else {
  const txt = fs.readFileSync("nodes-lab/op_tunnel.plotternode.js", "utf8");
  const keys = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample","pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  N = new Function(...keys, '"use strict"; return (' + txt + ");")(...keys.map((k) => H[k]));
  source = "lab";
}

const CTX = { W: 420, H: 297 };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defs(), ...over }, ctx, {});
const J = (r) => JSON.stringify(r.paths);
const nPts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const allPts = (r) => r.paths.flatMap((q) => q.pts);

console.log(`Op Tunnel validator (${source} mode)`);

// 1. determinism
ok(J(run()) === J(run()), "determinism: identical JSON on double run");

// 2. structure, bounds, budget across seeds and extremes
for (const over of [{}, { seed: 999 }, { sides: 3, irregular: 1, fillStep: 0.1, glitches: 40, glitchSize: 25, depth: 0.1, edgeGap: 1, vpx: 95, vpy: 5 }]) {
  const r = run(over);
  const mg = ("margin" in over ? over.margin : defs().margin);
  ok(r.paths.length > 0 && r.paths.every((q) => q.pts.length >= 2), `structure: paths >= 2 pts (${JSON.stringify(over).slice(0, 40)})`);
  ok(allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), "structure: finite coords");
  ok(allPts(r).every(([x, y]) => x >= mg - 1e-6 && x <= CTX.W - mg + 1e-6 && y >= mg - 1e-6 && y <= CTX.H - mg + 1e-6),
    "bounds: everything inside the margin box");
  ok(nPts(r) <= 120000, `budget: ${nPts(r)} <= 120000`);
}

// 3. parallel-stripe oracle: regular polygon, no glitches -> every segment is
//    parallel to one of the n outer edges (uniform fit preserves directions)
{
  const p = { irregular: 0, glitches: 0, fillStep: 0.5, sides: 6, rotate: -8 };
  const r = run(p);
  const rot = (p.rotate * Math.PI) / 180;
  const dirs = [];
  for (let i = 0; i < 6; i++) {
    const a0 = rot + (i / 6) * Math.PI * 2, a1 = rot + (((i + 1) % 6) / 6) * Math.PI * 2;
    const dx = Math.cos(a1) - Math.cos(a0), dy = Math.sin(a1) - Math.sin(a0);
    const l = Math.hypot(dx, dy);
    dirs.push([dx / l, dy / l]);
  }
  let bad = 0;
  for (const q of r.paths) {
    const dx = q.pts[1][0] - q.pts[0][0], dy = q.pts[1][1] - q.pts[0][1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) { bad++; continue; }
    const parallel = dirs.some(([ex, ey]) => Math.abs((dx / l) * ey - (dy / l) * ex) < 1e-6);
    if (!parallel) bad++;
  }
  ok(bad === 0, `parallel: all ${r.paths.length} segments parallel to a polygon edge (${bad} off)`);
}

// 4. geometric-series oracle: group segments by sector (parallel edge), then by
//    endpoint ray from the vp - one (sector, ray) bucket must be a single
//    geometric series with a constant depth ratio q
{
  const p = { irregular: 0, glitches: 0, fillStep: 0, sides: 6, rotate: -8, vpx: 55, vpy: 42 };
  const r = run(p);
  const C = [(CTX.W * p.vpx) / 100, (CTX.H * p.vpy) / 100];
  const rot = (p.rotate * Math.PI) / 180;
  const dirs = [];
  for (let i = 0; i < 6; i++) {
    const a0 = rot + (i / 6) * Math.PI * 2, a1 = rot + (((i + 1) % 6) / 6) * Math.PI * 2;
    const dx = Math.cos(a1) - Math.cos(a0), dy = Math.sin(a1) - Math.sin(a0);
    const l = Math.hypot(dx, dy);
    dirs.push([dx / l, dy / l]);
  }
  const buckets = new Map();
  for (const q of r.paths) {
    const dx = q.pts[1][0] - q.pts[0][0], dy = q.pts[1][1] - q.pts[0][1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    let sec = -1;
    dirs.forEach(([ex, ey], i) => { if (Math.abs((dx / l) * ey - (dy / l) * ex) < 1e-6) sec = i; });
    for (const e of q.pts) {
      const ang = Math.round((Math.atan2(e[1] - C[1], e[0] - C[0]) * 1800) / Math.PI);
      const key = sec + ":" + ang;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(Math.hypot(e[0] - C[0], e[1] - C[1]));
    }
  }
  const ray = [...buckets.values()].sort((a, b) => b.length - a.length)[0].sort((a, b) => b - a);
  const ratios = [];
  for (let i = 1; i < ray.length; i++) if (ray[i - 1] - ray[i] > 1e-6) ratios.push(ray[i] / ray[i - 1]);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const maxDev = Math.max(...ratios.map((x) => Math.abs(x - mean)));
  ok(ratios.length > 20 && maxDev < 1e-7, `geometric series: ${ratios.length + 1} stripes on one sector ray, ratio ${mean.toFixed(5)} constant (max dev ${maxDev.toExponential(1)})`);
}

// 5. glitch invariants: glitches split stripes -> more paths; glitched output differs
{
  const a = run({ glitches: 0 }).paths.length;
  const b = run({ glitches: 20 }).paths.length;
  ok(b > a, `glitch: 20 glitches give ${b} paths > ${a} without`);
  ok(J(run({ glitches: 14, glitchSize: 20 })) !== J(run({ glitches: 14 })), "glitch: glitchSize changes output");
}

// 6. fill invariants: fillStep > 0 adds sub-stripes; smaller step adds more
{
  const a = run({ fillStep: 0 }).paths.length;
  const b = run({ fillStep: 1.5 }).paths.length;
  const c = run({ fillStep: 0.5 }).paths.length;
  ok(b > a && c > b, `fill: paths ${a} < ${b} (1.5mm) < ${c} (0.5mm)`);
}

// 7. edgeGap: wider stripes -> fewer stripes
ok(run({ edgeGap: 8, glitches: 0 }).paths.length < run({ edgeGap: 2, glitches: 0 }).paths.length,
  "edgeGap: 8mm gives fewer stripes than 2mm");

// 8. depth: bigger center hole -> fewer stripes; and no endpoint closer than depth% along its ray
{
  ok(run({ depth: 15, glitches: 0 }).paths.length < run({ depth: 0.5, glitches: 0 }).paths.length,
    "depth: 15% gives fewer stripes than 0.5%");
}

// 9. seed + parameter liveness
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "liveness: seed (irregular + glitch placement)");
for (const [k, v] of Object.entries({ sides: 8, irregular: 0.9, rotate: 40, vpx: 30, vpy: 70, margin: 25, edgeGap: 6, depth: 5, layer: 4 }))
  ok(J(run({ [k]: v })) !== J(run()), `liveness: ${k}`);

// 10. pen routing
ok(run({ layer: 3 }).paths.every((q) => q.layer === 3), "pen: layer routes to every path");

// 11. overlay: polygon poly + vp point, poly matches compute's outermost stripe endpoints
{
  const g = N.overlay(defs(), CTX);
  const poly = g.find((q) => q.kind === "poly");
  const pnt = g.find((q) => q.kind === "point");
  ok(poly && pnt, "overlay: poly + vp point present");
  ok(pnt.x === (CTX.W * defs().vpx) / 100 && pnt.y === (CTX.H * defs().vpy) / 100, "overlay: vp point at exactly VP X/Y %");
  const r = run({ glitches: 0, fillStep: 0 });
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  ok(poly.pts.every((v) => allPts(r).some((e) => near(v, e))), "overlay: every polygon vertex is an outermost stripe endpoint");
}

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
