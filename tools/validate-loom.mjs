// Validator for Loom. Run from repo root: node tools/validate-loom.mjs
// Auto-switches: prefers baked src/defs/nodes/loom.js, falls back to
// nodes-lab/loom.plotternode.js evaluated with the REAL src/defs/helpers.js.
import fs from "fs";
import * as H from "../src/defs/helpers.js";

let N, source;
if (fs.existsSync("src/defs/nodes/loom.js")) {
  N = (await import("../src/defs/nodes/loom.js")).default;
  source = "baked";
} else {
  const txt = fs.readFileSync("nodes-lab/loom.plotternode.js", "utf8");
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

// same formula as the node
const gridDims = (p, ctx) => {
  const mg = Math.max(0, Math.min(p.margin, Math.min(ctx.W, ctx.H) / 2 - 2));
  const w = ctx.W - 2 * mg, h = ctx.H - 2 * mg;
  let step = Math.max(0.8, p.density);
  const minStep = Math.sqrt((2 * w * h) / 110000);
  if (step < minStep) step = minStep;
  return {
    mg, w, h,
    nx: Math.max(3, Math.round(w / step) + 1),
    ny: Math.max(3, Math.round(h / step) + 1),
  };
};

console.log(`Loom validator (${source} mode)`);

// 1. determinism
ok(J(run()) === J(run()), "determinism: identical JSON on double run");

// 2. structure + exact path-count oracle for every threads mode
{
  const { nx, ny } = gridDims(defs(), CTX);
  ok(run().paths.length === nx + ny, `count: Both = nx+ny = ${nx + ny}`);
  ok(run({ threads: "Warp (rows)" }).paths.length === ny, `count: warp-only = ny = ${ny}`);
  ok(run({ threads: "Weft (columns)" }).paths.length === nx, `count: weft-only = nx = ${nx}`);
  const r = run();
  ok(r.paths.every((q) => q.pts.length >= 2 && q.closed === false), "structure: open paths, >= 2 points");
  ok(allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), "structure: all coords finite");
}

// 3. bounds + budget across seeds and extremes
for (const over of [{}, { density: 0.5, drape: 60, margin: 0, seed: 999 }, { density: 8, drape: 0, margin: 40 },
                    { noiseAmt: 25, noiseScale: 6, drift: 60, driftAngle: -135, drape: 40, seed: 42 }]) {
  const r = run(over);
  const d = { ...defs(), ...over };
  const pad = d.drape + (d.noiseAmt || 0) + 1.3 * (d.drift || 0) + 0.001;
  ok(allPts(r).every(([x, y]) => x >= -pad && x <= CTX.W + pad && y >= -pad && y <= CTX.H + pad),
    `bounds: within sheet +/- drape (${JSON.stringify(over)})`);
  ok(nPts(r) <= 120000, `budget: ${nPts(r)} <= 120000 (${JSON.stringify(over)})`);
}

// 4. flatness + exact-spacing oracle: drape 0 -> perfect grid
{
  const r = run({ drape: 0 });
  const { mg, w, h, nx, ny } = gridDims({ ...defs(), drape: 0 }, CTX);
  const rows = r.paths.slice(0, ny), cols = r.paths.slice(ny);
  ok(rows.every((q) => q.pts.every(([, y]) => Math.abs(y - q.pts[0][1]) < 1e-9)), "flatness: rows exactly horizontal at drape 0");
  ok(cols.every((q) => q.pts.every(([x]) => Math.abs(x - q.pts[0][0]) < 1e-9)), "flatness: columns exactly vertical at drape 0");
  const dys = h / (ny - 1);
  ok(rows.every((q, j) => Math.abs(q.pts[0][1] - (mg + j * dys)) < 1e-9), "spacing: row y = margin + j*h/(ny-1) exactly");
  ok(Math.abs(rows[0].pts[nx - 1][0] - (mg + w)) < 1e-9, "spacing: rows span the full margin box");
}

// 5. liveness
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "liveness: seed (with drape > 0)");
for (const [k, v] of Object.entries({ density: 4, margin: 25, drape: 30, layer: 5, noiseAmt: 10, drift: 30 }))
  ok(J(run({ [k]: v })) !== J(run()), `liveness: ${k}`);
ok(J(run({ noiseAmt: 10, noiseScale: 4 })) !== J(run({ noiseAmt: 10 })), "liveness: noiseScale (with noiseAmt > 0)");
ok(J(run({ drift: 30, driftAngle: 0 })) !== J(run({ drift: 30 })), "liveness: driftAngle (with drift > 0)");

// 5b. drift ramp oracle: drift-only, angle 0 (-> +x): per row, x-displacement is
//     non-negative, non-decreasing along the row, capped at 1.3*drift; y untouched
{
  const D = 40;
  const r = run({ drape: 0, noiseAmt: 0, drift: D, driftAngle: 0 });
  const { mg, w, nx, ny } = gridDims(defs(), CTX);
  const dxs = w / (nx - 1);
  const rows = r.paths.slice(0, ny);
  let mono = true, bounded = true, flat = true;
  for (const q of rows) {
    let prev = -1e-9;
    for (let i = 0; i < nx; i++) {
      const disp = q.pts[i][0] - (mg + i * dxs);
      if (disp < prev - 1e-9) mono = false;
      if (disp < -1e-9 || disp > 1.3 * D + 1e-9) bounded = false;
      if (Math.abs(q.pts[i][1] - q.pts[0][1]) > 1e-9) flat = false;
      prev = disp;
    }
  }
  ok(mono, "drift: x-displacement non-decreasing along each row (angle 0)");
  ok(bounded, "drift: displacement within [0, 1.3*drift]");
  ok(flat, "drift: angle 0 leaves y untouched");
}

// 5c. shape noise amplitude oracle: noise-only displacement stays within +/- noiseAmt per axis
{
  const NA = 12;
  const r = run({ drape: 0, drift: 0, noiseAmt: NA });
  const { mg, w, h, nx, ny } = gridDims(defs(), CTX);
  const dxs = w / (nx - 1), dys = h / (ny - 1);
  const rows = r.paths.slice(0, ny);
  let bounded = true, moved = false;
  rows.forEach((q, j) => {
    for (let i = 0; i < nx; i++) {
      const ex = Math.abs(q.pts[i][0] - (mg + i * dxs));
      const ey = Math.abs(q.pts[i][1] - (mg + j * dys));
      if (ex > NA + 1e-9 || ey > NA + 1e-9) bounded = false;
      if (ex > 0.5 || ey > 0.5) moved = true;
    }
  });
  ok(bounded, "shape noise: per-axis displacement <= noiseAmt");
  ok(moved, "shape noise: actually displaces the mesh");
}

// 6. pen routing
ok(run({ layer: 7 }).paths.every((q) => q.layer === 7), "pen: layer routes to every path");

// 7. overlay: margin rect with the exact margin math
{
  const g = N.overlay({ ...defs(), margin: 20 }, CTX);
  const rect = g.find((q) => q.kind === "rect");
  ok(rect && rect.x === 20 && rect.y === 20 && rect.w === CTX.W - 40 && rect.h === CTX.H - 40, "overlay: rect matches margin box exactly");
}

// 8. degenerate guard
ok(run({ margin: 40 }, { W: 20, H: 20 }).paths.length === 0, "guard: degenerate canvas returns EMPTY");

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
