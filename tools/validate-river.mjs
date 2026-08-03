// tools/validate-river.mjs — River meander-migration solver harness.
// Run from repo root: node tools/validate-river.mjs
// Auto-switches to the baked version (src/defs/nodes/river.js) when it exists.
import fs from "node:fs";
import * as HELP from "../src/defs/helpers.js";

const BAKED = new URL("../src/defs/nodes/river.js", import.meta.url);
const LAB = new URL("../nodes-lab/river.plotternode.js", import.meta.url);
let N;
if (fs.existsSync(BAKED)) {
  N = (await import(BAKED)).default;
  console.log("target: BAKED src/defs/nodes/river.js");
} else {
  const H = {
    Pin: HELP.Pin, EMPTY: HELP.EMPTY, PENS: HELP.PENS,
    mulberry32: HELP.mulberry32, hash2: HELP.hash2, noise2: HELP.noise2,
    resample: HELP.resample, pathLength: HELP.pathLength,
    applyStyle: HELP.applyStyle, signedArea: HELP.signedArea,
  };
  const src = fs.readFileSync(LAB, "utf8");
  N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));
  console.log("target: LAB nodes-lab/river.plotternode.js");
}

const defs = {};
for (const pr of N.params) defs[pr.key] = pr.def;
const CTX = { W: 297, H: 210 };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defs, ...over }, ctx, {});
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((a, p) => a + p.pts.length, 0);

let fails = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra ? "  (" + extra + ")" : ""));
  if (!ok) { fails++; process.exitCode = 1; }
};

// 1. structure, finiteness, bounds, degenerates, budget
const r = run();
let finite = true, inb = true, short = false;
for (const p of r.paths) {
  if (p.pts.length < 2) short = true;
  for (const q of p.pts) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
    if (q[0] < -0.01 || q[0] > CTX.W + 0.01 || q[1] < -0.01 || q[1] > CTX.H + 0.01) inb = false;
  }
}
check("paths produced", r.paths.length > 5, r.paths.length + " paths");
check("all points finite", finite);
check("all points on sheet", inb);
check("no degenerate paths", !short);
check("point budget", nPts(r) < 120000, nPts(r) + " pts");

// 2. determinism + seed liveness
check("deterministic (double run)", J(run()) === J(run()));
check("seed changes output", J(run({ seed: 7 })) !== J(run({ seed: 8 })));

// 3. steps: live + more steps -> more history lines
const r150 = run({ steps: 150 }), r500 = run({ steps: 500 });
check("steps live", J(r150) !== J(r500));
check("more steps -> more history lines", r500.paths.length > r150.paths.length,
  r150.paths.length + " -> " + r500.paths.length);

// 4. drawEvery: exact strided count with oxbows isolated off
const s5 = run({ drawEvery: 5, oxbows: false }).paths.length;
const s40 = run({ drawEvery: 40, oxbows: false }).paths.length;
check("Draw every Nth thins the stack", s40 < s5, s40 + " < " + s5);
const expected5 = Math.ceil((defs.steps - 1) / 5) + 1; // history snapshots + final
check("stride count exact", Math.abs(s5 - expected5) <= 1, s5 + " vs " + expected5);

// 5. skip: removes early snapshots only, final unchanged
const sk0 = run({ oxbows: false }), sk50 = run({ skip: 50, oxbows: false });
check("Skip first % thins the early stack", sk50.paths.length < sk0.paths.length,
  sk50.paths.length + " < " + sk0.paths.length);
check("skip leaves the final channel identical",
  J(sk0.paths[sk0.paths.length - 1]) === J(sk50.paths[sk50.paths.length - 1]));

// 6. parameter liveness
for (const [k, v] of [["rate", 2], ["memory", 40], ["wobble", 8], ["width", 12], ["confine", 0.8]]) {
  check(k + " live", J(run({ [k]: v })) !== J(run()));
}

// 7. oxbows: occur, are closed, toggle removes exactly them
let oxSeed = -1, oxClosed = true;
for (let s = 1; s <= 8; s++) {
  const on = run({ seed: s }), off = run({ seed: s, oxbows: false });
  const extra = on.paths.length - off.paths.length;
  if (extra > 0) {
    if (oxSeed < 0) oxSeed = s;
    if (on.paths.filter((p) => p.closed).length !== extra) oxClosed = false;
  }
}
check("neck cutoffs occur (some seed 1-8)", oxSeed >= 0, oxSeed >= 0 ? "first at seed " + oxSeed : "none");
check("every oxbow is a closed loop / toggle exact", oxClosed);

// 8. oxbow neck: cut arc endpoints within channel width
if (oxSeed >= 0) {
  let neckOk = true;
  for (const p of run({ seed: oxSeed }).paths) {
    if (!p.closed) continue;
    const a = p.pts[0], b = p.pts[p.pts.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > defs.width + 0.5) neckOk = false;
  }
  check("oxbow neck gap <= channel width", neckOk);
}

// 9. confinement narrows the final channel's y-spread
const spread = (rr) => {
  const fin = rr.paths.filter((p) => !p.closed).pop();
  let lo = 1e9, hi = -1e9;
  for (const q of fin.pts) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }
  return hi - lo;
};
const sp0 = spread(run({ confine: 0 })), sp1 = spread(run({ confine: 1 }));
check("confinement narrows final channel", sp1 <= sp0 + 1, sp1.toFixed(1) + " <= " + sp0.toFixed(1));

// 10. margin respected at a large value
let mOk = true;
for (const p of run({ margin: 30 }).paths) for (const q of p.pts) {
  if (q[0] < 30 - 0.01 || q[0] > CTX.W - 30 + 0.01 || q[1] < 30 - 0.01 || q[1] > CTX.H - 30 + 0.01) mOk = false;
}
check("margin respected", mOk);

// 11. Vertical is the exact transpose of Horizontal on a square canvas
const sq = { W: 240, H: 240 };
const rh = run({}, sq), rv = run({ dir: "Vertical" }, sq);
const transpose = (rr) => rr.paths.map((p) => ({ ...p, pts: p.pts.map((q) => [q[1], q[0]]) }));
check("Vertical is exact transpose (square canvas)", J(transpose(rh)) === J(rv.paths));

// 12. final channel: open, Final pen, meandering lengthened it
const fin = r.paths[r.paths.length - 1];
check("final channel drawn with Final pen", !fin.closed && fin.layer === defs.penFinal);
const finLen = HELP.pathLength(fin.pts, false);
const span = CTX.W - 2 * defs.margin;
check("meandering lengthens the river", finLen > span * 1.5, finLen.toFixed(0) + " mm vs span " + span);

// 13. performance sanity at defaults
const t0 = Date.now();
run();
check("compute time reasonable", Date.now() - t0 < 900, (Date.now() - t0) + " ms");

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL CHECKS PASSED");
