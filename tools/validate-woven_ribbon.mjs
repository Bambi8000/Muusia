// Validator for Woven Ribbon. Run from repo root: node tools/validate-woven_ribbon.mjs
// Auto-switches: prefers baked src/defs/nodes/woven_ribbon.js, falls back to
// nodes-lab/woven_ribbon.plotternode.js evaluated with the REAL src/defs/helpers.js.
import fs from "fs";
import * as H from "../src/defs/helpers.js";

let N, source;
if (fs.existsSync("src/defs/nodes/woven_ribbon.js")) {
  N = (await import("../src/defs/nodes/woven_ribbon.js")).default;
  source = "baked";
} else {
  const txt = fs.readFileSync("nodes-lab/woven_ribbon.plotternode.js", "utf8");
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

// THE weave oracle: no two segments in the whole output may properly intersect.
// Spatial hash; shared endpoints (caps meeting track ends) are allowed.
const countCrossings = (r) => {
  const segs = [];
  r.paths.forEach((q, pi) => {
    for (let i = 0; i + 1 < q.pts.length; i++) segs.push([q.pts[i], q.pts[i + 1], pi, i]);
  });
  const CELL = 4;
  const hash = new Map();
  const put = (s, idx) => {
    const x0 = Math.floor(Math.min(s[0][0], s[1][0]) / CELL), x1 = Math.floor(Math.max(s[0][0], s[1][0]) / CELL);
    const y0 = Math.floor(Math.min(s[0][1], s[1][1]) / CELL), y1 = Math.floor(Math.max(s[0][1], s[1][1]) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = x + ":" + y;
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k).push(idx);
    }
  };
  segs.forEach((s, i) => put(s, i));
  const eps = 1e-9;
  let bad = 0;
  const seen = new Set();
  for (const list of hash.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const ia = list[a], ib = list[b];
        const pk = ia < ib ? ia + "_" + ib : ib + "_" + ia;
        if (seen.has(pk)) continue;
        seen.add(pk);
        const A = segs[ia], B = segs[ib];
        if (A[2] === B[2] && Math.abs(A[3] - B[3]) <= 1) continue; // adjacent in same path
        const [p1, p2] = A, [p3, p4] = B;
        const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
        const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 1e-12) continue; // parallel
        const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den;
        const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / den;
        if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) bad++;
      }
    }
  }
  return bad;
};

console.log(`Woven Ribbon validator (${source} mode)`);

// 1. determinism
ok(J(run()) === J(run()), "determinism: identical JSON on double run");

// 2. structure, bounds, budget
for (const over of [{}, { seed: 3 }, { grid: 10, steps: 100, pairs: 7, spacing: 4, gap: 0, straight: 0.2, seed: 5 }]) {
  const r = run(over);
  const mg = defs().margin;
  ok(r.paths.length > 0 && r.paths.every((q) => q.pts.length >= 2), `structure: paths >= 2 pts (${JSON.stringify(over).slice(0, 40)})`);
  ok(allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), "structure: finite coords");
  ok(allPts(r).every(([x, y]) => x >= mg - 1e-6 && x <= CTX.W - mg + 1e-6 && y >= mg - 1e-6 && y <= CTX.H - mg + 1e-6),
    "bounds: inside the margin box");
  ok(nPts(r) <= 120000, `budget: ${nPts(r)} <= 120000`);
}

// 3. THE weave oracle: zero proper intersections anywhere, all modes, several seeds
for (const seed of [1, 7, 23]) {
  for (const weave of ["Alternate", "Later over", "Earlier over"]) {
    const bad = countCrossings(run({ seed, weave }));
    ok(bad === 0, `no-cross: 0 intersections (seed ${seed}, ${weave}) - found ${bad}`);
  }
}
{
  const bad = countCrossings(run({ grid: 10, steps: 100, pairs: 7, spacing: 4, gap: 0, seed: 5 }));
  ok(bad === 0, `no-cross: 0 intersections at extreme params, gap 0 - found ${bad}`);
}

// 4. the walk actually weaves: over/under choice matters -> crossings exist
for (const seed of [1, 7, 23]) {
  ok(J(run({ seed, weave: "Later over" })) !== J(run({ seed, weave: "Earlier over" })),
    `weaves: crossings exist and weave mode matters (seed ${seed})`);
}

// 5. tracks: more pairs -> more paths; caps add paths
{
  ok(run({ pairs: 6 }).paths.length > run({ pairs: 2 }).paths.length, "tracks: pairs 6 > pairs 2 path count");
  ok(run({ caps: true }).paths.length > run({ caps: false }).paths.length, "caps: end caps add paths");
}

// 6. spacing clamp: tight grid + wide tracks stays legal (no-cross + in bounds)
{
  const r = run({ grid: 8, pairs: 8, spacing: 4, seed: 2 });
  ok(countCrossings(r) === 0 && allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
    "clamp: auto-shrunk spacing keeps the weave legal");
}

// 7. liveness
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "liveness: seed");
for (const [k, v] of Object.entries({ grid: 14, steps: 70, straight: 0.1, pairs: 3, spacing: 2.5, gap: 2, layer: 4 }))
  ok(J(run({ [k]: v })) !== J(run()), `liveness: ${k}`);
// the board is centered, so margin only matters once it constrains the board
ok(J(run({ margin: 80 })) !== J(run()), "liveness: margin (constraining value)");

// 8. pen routing
ok(run({ layer: 6 }).paths.every((q) => q.layer === 6), "pen: layer routes to every path");

// 9. overlay: exact margin rect
{
  const g = N.overlay({ ...defs(), margin: 20 }, CTX);
  const rect = g.find((q) => q.kind === "rect");
  ok(rect && rect.x === 20 && rect.y === 20 && rect.w === CTX.W - 40 && rect.h === CTX.H - 40, "overlay: rect matches margin box");
}

// 10. degenerate guard
ok(run({}, { W: 30, H: 30 }).paths.length === 0, "guard: canvas too small for the board returns EMPTY");

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
