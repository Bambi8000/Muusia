/* validate-needlepunch.mjs — Needle Punch invariants.
   Run from repo root: node tools/validate-needlepunch.mjs
   Auto-switches: uses src/defs/nodes/needlepunch.js if baked, else evaluates
   nodes-lab/needlepunch.plotternode.js with the REAL src/defs/helpers.js
   (verbatim by construction — v2.45 harness-drift lesson). */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bakedPath = path.join(root, "src/defs/nodes/needlepunch.js");
const labPath = path.join(root, "nodes-lab/needlepunch.plotternode.js");

let N;
if (fs.existsSync(bakedPath)) {
  N = (await import("file://" + bakedPath)).default;
  console.log("Testing BAKED node:", bakedPath);
} else {
  const H = await import("file://" + path.join(root, "src/defs/helpers.js"));
  const helperNames = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2",
    "resample", "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG",
    "SFONT", "fontStrokes"];
  const src = fs.readFileSync(labPath, "utf8");
  N = new Function(...helperNames, '"use strict"; return (' + src + ");")(
    ...helperNames.map((k) => H[k]));
  console.log("Testing LAB node:", labPath);
}

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? "  PASS " : "  FAIL ") + msg);
  if (!cond) { fails++; process.exitCode = 1; }
};
const defaults = () => {
  const p = {};
  for (const pr of N.params) p[pr.key] = pr.def;
  return p;
};
const ctx = { W: 210, H: 297 };
const run = (paths, over = {}) => N.compute([{ paths }], { ...defaults(), ...over }, ctx, {});
const line = (x0, y0, x1, y1) => ({ pts: [[x0, y0], [x1, y1]], closed: false, layer: 0 });
const near = (a, b, tol = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
const xy = (r) => r.paths.map((pa) => [pa.pts[0][0], pa.pts[0][1]]);

console.log("\n[1] Structure: every punch is a degenerate 2-pt path with z on both points");
{
  const r = run([line(0, 50, 100, 50)], { mode: "Both", depth: 2.5, layer: 4 });
  ok(r.paths.length > 0, "produces punches");
  ok(r.paths.every((pa) => pa.pts.length === 2), "exactly 2 points per path (survives pts.length<2 filters)");
  ok(r.paths.every((pa) => pa.pts[0][0] === pa.pts[1][0] && pa.pts[0][1] === pa.pts[1][1]), "both points identical XY");
  ok(r.paths.every((pa) => pa.pts[0][2] === 2.5 && pa.pts[1][2] === 2.5), "z === Depth on BOTH points");
  ok(r.paths.every((pa) => pa.closed === false), "closed: false");
  ok(r.paths.every((pa) => pa.layer === 4), "layer follows Pen param");
  ok(r.paths.every((pa) => pa.pts.every((q) => q.every(Number.isFinite))), "all coords finite");
}

console.log("\n[2] Determinism: double run identical");
{
  const inp = [line(0, 50, 100, 50), line(50, 0, 50, 100), line(10, 10, 90, 90)];
  const a = JSON.stringify(run(inp, { mode: "Both" }));
  const b = JSON.stringify(run(inp, { mode: "Both" }));
  ok(a === b, "identical JSON");
}

console.log("\n[3] Interval exactness: 100 mm line, interval 10, offset 0, ends off");
{
  const r = run([line(0, 50, 100, 50)], { mode: "Interval", interval: 10, offset: 0, ends: false, gap: 0 });
  const P = xy(r);
  ok(P.length === 11, `11 punches at 0..100 (got ${P.length})`);
  ok(P.every((q, i) => near(q, [i * 10, 50])), "positions exact to 1e-9");
}

console.log("\n[4] Offset liveness + ends");
{
  const r = run([line(0, 50, 100, 50)], { mode: "Interval", interval: 10, offset: 3, ends: false, gap: 0 });
  const P = xy(r);
  ok(P.length === 10 && P.every((q, i) => near(q, [3 + i * 10, 50])), `offset 3 -> punches at 3,13..93 (got ${P.length})`);
  const r2 = run([line(0, 50, 100, 50)], { mode: "Interval", interval: 10, offset: 3, ends: true, gap: 0 });
  ok(r2.paths.length === 12, `ends adds the 2 endpoints (got ${r2.paths.length})`);
  ok(near(xy(r2)[0], [0, 50]) && xy(r2).some((q) => near(q, [100, 50])), "endpoints present at 0 and 100");
}

console.log("\n[5] Ends + interval start coincide -> Min gap merges (no double stab)");
{
  const r = run([line(0, 50, 100, 50)], { mode: "Interval", interval: 10, offset: 0, ends: true, gap: 0.5 });
  ok(r.paths.length === 11, `start/end duplicates merged, 11 total (got ${r.paths.length})`);
}

console.log("\n[6] Intersections: X cross -> exactly 1 punch at exact crossing");
{
  const r = run([line(0, 50, 100, 50), line(50, 0, 50, 100)], { mode: "Intersections" });
  ok(r.paths.length === 1, `1 punch (got ${r.paths.length})`);
  ok(near(xy(r)[0], [50, 50]), "at (50,50) exact");
}

console.log("\n[7] Intersections: 5x4 grid -> 20 punches");
{
  const inp = [];
  for (let i = 0; i < 5; i++) inp.push(line(20 + i * 15, 10, 20 + i * 15, 120));
  for (let j = 0; j < 4; j++) inp.push(line(5, 25 + j * 20, 110, 25 + j * 20));
  const r = run(inp, { mode: "Intersections", gap: 0.5 });
  ok(r.paths.length === 20, `20 crossings (got ${r.paths.length})`);
}

console.log("\n[8] Intersections: zigzag has NO false joint punches");
{
  const zig = { pts: [[0, 0], [20, 30], [40, 0], [60, 30], [80, 0]], closed: false, layer: 0 };
  const r = run([zig.pts && zig].flat(), { mode: "Intersections" });
  ok(r.paths.length === 0, `adjacent segments skipped (got ${r.paths.length})`);
}

console.log("\n[9] Intersections: self-crossing polyline (bowtie) -> 1 punch");
{
  const bow = { pts: [[0, 0], [40, 40], [40, 0], [0, 40]], closed: false, layer: 0 };
  const r = run([bow], { mode: "Intersections" });
  ok(r.paths.length === 1, `1 self-crossing (got ${r.paths.length})`);
  ok(near(xy(r)[0], [20, 20]), "at (20,20) exact");
}

console.log("\n[10] Closed square: closing segment walked, perimeter/interval punches");
{
  const sq = { pts: [[10, 10], [50, 10], [50, 50], [10, 50]], closed: true, layer: 0 };
  const r = run([sq], { mode: "Interval", interval: 10, offset: 0, ends: true, gap: 0.5 });
  ok(r.paths.length === 16, `perimeter 160 / 10 = 16 (start==end merged, ends ignored on closed; got ${r.paths.length})`);
  ok(xy(r).some((q) => near(q, [10, 40])), "punch on the closing segment (10,40 = arc 130)");
}

console.log("\n[11] Both = union with dedupe; interval-first order");
{
  const inp = [line(0, 50, 100, 50), line(50, 0, 50, 100)];
  const rI = run(inp, { mode: "Interval", interval: 10, offset: 0, ends: false, gap: 0.5 });
  const rB = run(inp, { mode: "Both", interval: 10, offset: 0, ends: false, gap: 0.5 });
  ok(rB.paths.length === rI.paths.length, `crossing (50,50) already an interval punch -> merged (I=${rI.paths.length}, B=${rB.paths.length})`);
  const rB2 = run(inp, { mode: "Both", interval: 10, offset: 3, ends: false, gap: 0.5 });
  const rI2 = run(inp, { mode: "Both", interval: 10, offset: 3, ends: false, gap: 0.5, mode: "Interval" });
  ok(rB2.paths.length === rI2.paths.length + 1 && xy(rB2).some((q) => near(q, [50, 50])), "offset 3 -> crossing punch added");
}

console.log("\n[12] Min gap: duplicate identical line collapses to one punch set");
{
  const r1 = run([line(0, 50, 100, 50)], { mode: "Interval", interval: 10, ends: false, gap: 0.5 });
  const r2 = run([line(0, 50, 100, 50), line(0, 50, 100, 50)], { mode: "Interval", interval: 10, ends: false, gap: 0.5 });
  ok(r1.paths.length === r2.paths.length, `dedupe collapses coincident punches (${r1.paths.length} vs ${r2.paths.length})`);
}

console.log("\n[13] Depth: liveness + hard clamp to export's 6 mm ceiling");
{
  const r3 = run([line(0, 50, 100, 50)], { depth: 3 });
  const r8 = run([line(0, 50, 100, 50)], { depth: 8 });
  ok(r3.paths[0].pts[0][2] === 3, "depth 3 -> z 3");
  ok(r8.paths[0].pts[0][2] === 6, `wire-pushed depth 8 clamps to 6 (got ${r8.paths[0].pts[0][2]})`);
}

console.log("\n[14] Guards: unwired input, empty input, missing mode");
{
  const ru = N.compute([undefined], defaults(), ctx, {});
  ok(ru && Array.isArray(ru.paths) && ru.paths.length === 0, "unwired -> empty path set");
  const rm = N.compute([{ paths: [line(0, 0, 50, 50)] }], { ...defaults(), mode: undefined }, ctx, {});
  ok(rm.paths.length > 0, "missing mode falls back to Interval (old-patch tolerance)");
}

console.log("\n[15] Budget + speed: dense grid stays under 120k points");
{
  const inp = [];
  for (let i = 0; i < 60; i++) inp.push(line(0, 2 + i * 3, 200, 2 + i * 3));
  for (let i = 0; i < 60; i++) inp.push(line(2 + i * 3, 0, 2 + i * 3, 200));
  const t0 = Date.now();
  const r = run(inp, { mode: "Both", interval: 2, ends: false, gap: 0.5 });
  const ms = Date.now() - t0;
  const pts = r.paths.length * 2;
  ok(pts < 120000, `${r.paths.length} punches = ${pts} pts < 120k`);
  console.log(`  info: dense Both run ${ms} ms`);
  ok(ms < 2000, "runtime sane");
}

const gaps = (r) => {
  const xs = xy(r).map((q) => q[0]);
  const g = [];
  for (let i = 1; i < xs.length; i++) g.push(xs[i] - xs[i - 1]);
  return g;
};

console.log("\n[16] Spacing mod Off: Mod amount is dead, walk identical");
{
  const a = JSON.stringify(run([line(0, 50, 200, 50)], { mode: "Interval", interval: 5, ends: false, gap: 0, mod: "Off", modAmt: 0 }));
  const b = JSON.stringify(run([line(0, 50, 200, 50)], { mode: "Interval", interval: 5, ends: false, gap: 0, mod: "Off", modAmt: 1 }));
  ok(a === b, "amt 0 === amt 1 when Off");
}

console.log("\n[17] Wave: spacing varies along arc, Mod length is live");
{
  const base = { mode: "Interval", interval: 5, ends: false, gap: 0, mod: "Wave", modAmt: 0.5, modLen: 25 };
  const g = gaps(run([line(0, 50, 200, 50)], base));
  ok(Math.max(...g) - Math.min(...g) > 1, `gap swing > 1 mm (got ${(Math.max(...g) - Math.min(...g)).toFixed(2)})`);
  ok(Math.min(...g) > 2 && Math.max(...g) < 8, `gaps inside interval*(1±amt) band (${Math.min(...g).toFixed(2)}..${Math.max(...g).toFixed(2)})`);
  const b = JSON.stringify(run([line(0, 50, 200, 50)], { ...base, modLen: 50 }));
  ok(b !== JSON.stringify(run([line(0, 50, 200, 50)], base)), "Mod length changes the pattern");
}

console.log("\n[18] Ramp: spacing grows monotonically from tight to loose");
{
  const g = gaps(run([line(0, 50, 200, 50)], { mode: "Interval", interval: 5, ends: false, gap: 0, mod: "Ramp", modAmt: 0.5 }));
  ok(g.every((v, i) => i === 0 || v >= g[i - 1] - 1e-6), "gaps non-decreasing");
  ok(g[0] < g[g.length - 1], `first ${g[0].toFixed(2)} < last ${g[g.length - 1].toFixed(2)}`);
}

console.log("\n[19] Noise + Jitter: seed live, still deterministic");
{
  for (const m of ["Noise", "Jitter"]) {
    const base = { mode: "Interval", interval: 5, ends: false, gap: 0, mod: m, modAmt: 0.5, modLen: 20 };
    const s1 = JSON.stringify(run([line(0, 50, 200, 50)], { ...base, seed: 1 }));
    const s2 = JSON.stringify(run([line(0, 50, 200, 50)], { ...base, seed: 2 }));
    ok(s1 !== s2, m + ": seed changes output");
    ok(s1 === JSON.stringify(run([line(0, 50, 200, 50)], { ...base, seed: 1 })), m + ": double run identical");
    const g = gaps(run([line(0, 50, 200, 50)], { ...base, seed: 1 }));
    ok(Math.max(...g) - Math.min(...g) > 0.5, m + `: spacing actually varies (${(Math.max(...g) - Math.min(...g)).toFixed(2)})`);
  }
}

console.log("\n[20] Extreme wire-pushed Mod amount: terminates, 0.1 mm floor holds");
{
  const r = run([line(0, 50, 200, 50)], { mode: "Interval", interval: 5, ends: false, gap: 0, mod: "Wave", modAmt: 5, modLen: 25 });
  const g = gaps(r);
  ok(r.paths.length > 0 && r.paths.length < 3000, `finite punch count (${r.paths.length})`);
  ok(g.every((v) => v >= 0.0999), `every gap >= 0.1 mm floor (min ${Math.min(...g).toFixed(3)})`);
  ok(r.paths.every((pa) => pa.pts.every((q) => q.every(Number.isFinite))), "all coords finite");
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS");
