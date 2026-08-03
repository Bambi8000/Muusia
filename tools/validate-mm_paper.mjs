// tools/validate-mm_paper.mjs — Millimeter Paper harness.
// Run from repo root: node tools/validate-mm_paper.mjs
// Auto-switches to the baked version (src/defs/nodes/mm_paper.js) when it exists.
import fs from "node:fs";
import * as HELP from "../src/defs/helpers.js";

const BAKED = new URL("../src/defs/nodes/mm_paper.js", import.meta.url);
const LAB = new URL("../nodes-lab/mm_paper.plotternode.js", import.meta.url);
let N;
if (fs.existsSync(BAKED)) {
  N = (await import(BAKED)).default;
  console.log("target: BAKED src/defs/nodes/mm_paper.js");
} else {
  const H = {
    Pin: HELP.Pin, EMPTY: HELP.EMPTY, PENS: HELP.PENS,
    mulberry32: HELP.mulberry32, hash2: HELP.hash2, noise2: HELP.noise2,
    resample: HELP.resample, pathLength: HELP.pathLength,
    applyStyle: HELP.applyStyle, signedArea: HELP.signedArea,
  };
  const src = fs.readFileSync(LAB, "utf8");
  N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));
  console.log("target: LAB nodes-lab/mm_paper.plotternode.js");
}

const defs = {};
for (const pr of N.params) defs[pr.key] = pr.def;
const CTX = { W: 297, H: 210 };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defs, ...over }, ctx, {});
const J = (r) => JSON.stringify(r);

let fails = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra ? "  (" + extra + ")" : ""));
  if (!ok) { fails++; process.exitCode = 1; }
};

// helpers over a result
const xs = (r) => [...new Set(r.paths.filter((p) => p.pts[0][0] === p.pts[1][0]).map((p) => p.pts[0][0]))].sort((a, b) => a - b);
const ys = (r) => [...new Set(r.paths.filter((p) => p.pts[0][1] === p.pts[1][1]).map((p) => p.pts[0][1]))].sort((a, b) => a - b);

// 1. defaults on A4 landscape: snap to whole 10mm cells, exact line counts
const r = run();
// A4L: 297-20=277 -> 270 wide (27 cells), 210-20=190 -> 190 tall (19 cells)
const NX = 270, NY = 190;
check("every line is a 2-pt open path", r.paths.every((p) => p.pts.length === 2 && !p.closed));
check("all coords finite + on sheet", r.paths.every((p) => p.pts.every((q) =>
  Number.isFinite(q[0]) && Number.isFinite(q[1]) && q[0] >= -0.01 && q[0] <= CTX.W + 0.01 && q[1] >= -0.01 && q[1] <= CTX.H + 0.01)));
check("snapped grid is whole major cells + centered",
  xs(r)[0] === (CTX.W - NX) / 2 && xs(r).at(-1) === (CTX.W + NX) / 2 &&
  ys(r)[0] === (CTX.H - NY) / 2 && ys(r).at(-1) === (CTX.H + NY) / 2,
  `x ${xs(r)[0]}..${xs(r).at(-1)}, y ${ys(r)[0]}..${ys(r).at(-1)}`);
check("exact line count (each line drawn once)", r.paths.length === (NX + 1) + (NY + 1),
  r.paths.length + " vs " + ((NX + 1) + (NY + 1)));
check("no duplicate lines", xs(r).length === NX + 1 && ys(r).length === NY + 1);

// 2. level classification: every 10th major pen, every 5th (not 10th) medium, rest fine
let clsOk = true;
for (const p of r.paths) {
  const vert = p.pts[0][0] === p.pts[1][0];
  const c = vert ? p.pts[0][0] - xs(r)[0] : p.pts[0][1] - ys(r)[0];
  const i = Math.round(c / defs.fine);
  const want = i % 10 === 0 ? defs.penMajor : i % 5 === 0 ? defs.penMid : defs.penFine;
  if (p.layer !== want) clsOk = false;
}
check("three-level pen classification exact", clsOk);

// 3. pen order: majors first, then medium, then fine (pen-change friendly)
const layerSeq = r.paths.map((p) => p.layer);
const firstFine = layerSeq.indexOf(defs.penFine), lastMajor = layerSeq.lastIndexOf(defs.penMajor);
const lastMid = layerSeq.lastIndexOf(defs.penMid);
check("layers grouped major->medium->fine", lastMajor < layerSeq.indexOf(defs.penMid) && lastMid < firstFine);

// 4. serpentine: consecutive lines within a level pass alternate direction
let serp = true;
for (let i = 1; i < r.paths.length; i++) {
  const a = r.paths[i - 1], b = r.paths[i];
  const av = a.pts[0][0] === a.pts[1][0], bv = b.pts[0][0] === b.pts[1][0];
  if (a.layer !== b.layer || av !== bv) continue;
  const dirOf = (p, v) => Math.sign(v ? p.pts[1][1] - p.pts[0][1] : p.pts[1][0] - p.pts[0][0]);
  if (dirOf(a, av) === dirOf(b, bv)) serp = false;
}
check("serpentine direction alternates", serp);

// 5. determinism (no seed by design)
check("deterministic (double run)", J(run()) === J(run()));

// 6. pen params live and land on the right level
const rp = run({ penFine: 5, penMid: 6, penMajor: 7 });
const lvSet = new Set(rp.paths.map((p) => p.layer));
check("pen choices applied", lvSet.has(5) && lvSet.has(6) && lvSet.has(7) && lvSet.size === 3);

// 7. Fine lines off -> only medium+major remain, count exact
const rNoFine = run({ fineOn: false });
check("Fine off leaves only 5mm+ lines", rNoFine.paths.every((p) => p.layer !== defs.penFine) &&
  rNoFine.paths.length === (NX / 5 + 1) + (NY / 5 + 1), rNoFine.paths.length + " lines");

// 8. levels off via every=0
const rNoMaj = run({ majorEvery: 0 });
check("Major every 0 disables majors", rNoMaj.paths.every((p) => p.layer !== defs.penMajor));
const rOnly = run({ midEvery: 0, majorEvery: 0, fineOn: true });
check("mid+major 0 -> uniform fine grid", rOnly.paths.every((p) => p.layer === defs.penFine));

// 9. border off removes exactly the 4 outermost lines
const rNoB = run({ border: false });
check("Border off removes 4 frame lines", r.paths.length - rNoB.paths.length === 4 &&
  !xs(rNoB).includes(xs(r)[0]) && !ys(rNoB).includes(ys(r).at(-1)));

// 10. snap off fills the margin box to the nearest fine step
const rNoSnap = run({ snap: false });
check("snap off widens the grid", xs(rNoSnap).at(-1) - xs(rNoSnap)[0] >= NX &&
  (xs(rNoSnap).length - 1) % 10 !== 0 || xs(rNoSnap).length > NX + 1);

// 11. margin respected at a large value
const rm = run({ margin: 30 });
check("margin respected", rm.paths.every((p) => p.pts.every((q) =>
  q[0] >= 30 - 0.01 && q[0] <= CTX.W - 30 + 0.01 && q[1] >= 30 - 0.01 && q[1] <= CTX.H - 30 + 0.01)));

// 12. fine step liveness + tiny wire-driven value stays within budget (empty guard ok)
check("fine step live", J(run({ fine: 2 })) !== J(run()));
const rTiny = run({ fine: 0.05 }, { W: 594, H: 420 });
const totalPts = rTiny.paths.reduce((a, p) => a + p.pts.length, 0);
check("hostile tiny step stays under budget", totalPts < 120000, totalPts + " pts");

// 13. overlay guide matches grid bounds exactly
if (N.overlay) {
  const g = N.overlay({ ...defs }, CTX)[0];
  check("overlay rect equals grid area", g.kind === "rect" &&
    g.x === xs(r)[0] && g.y === ys(r)[0] && g.w === NX && g.h === NY);
} else check("overlay present", false);

// 14. non-integer canvas: lines still land exactly on fine multiples from origin
const rq = run({}, { W: 297.3, H: 209.7 });
const ox = xs(rq)[0];
check("odd canvas: spacing exact", xs(rq).every((x) => Math.abs((x - ox) / defs.fine - Math.round((x - ox) / defs.fine)) < 1e-9));

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL CHECKS PASSED");
