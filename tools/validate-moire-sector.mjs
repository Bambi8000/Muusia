/* Validator: Moire Disc pie-slice sector cutter.
   Run from the repo root: node tools/validate-moire-sector.mjs
   Imports the REAL helpers and the baked node (lab file takes precedence if
   one exists). Oracles: determinism, legacy invariance (sector 360 ignores
   Sector start entirely), the sector containment invariant for every content
   mode, clean cut-edge tolerance, cake-slice rim, parameter liveness,
   degenerate values, finite coordinates, point budget. */

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const LAB = "nodes-lab/moire_disc.plotternode.js";
const BAKED = "src/defs/nodes/moire_disc.js";

let def;
if (existsSync(LAB)) {
  console.log("[lab] " + LAB);
  const body = readFileSync(LAB, "utf8");
  const helpers = await import(pathToFileURL("src/defs/helpers.js").href);
  const fn = new Function(...Object.keys(helpers), "return " + body.trim().replace(/;\s*$/, "") + ";");
  def = fn(...Object.values(helpers));
} else {
  console.log("[baked] " + BAKED);
  def = (await import(pathToFileURL(BAKED).href)).default;
}

let pass = 0, fail = 0;
const CHECK = (name, cond, extra) => {
  if (cond) { console.log("ok    " + name); pass++; }
  else { console.log("FAIL  " + name + (extra ? " - " + extra : "")); fail++; }
};

const defaults = {};
for (const q of def.params) defaults[q.key] = q.def;
const ctxP = { W: 210, H: 297 };
const ctxL = { W: 297, H: 210 };
const run = (over, ctx = ctxP) => def.compute([null], { ...defaults, ...over }, ctx, { params: {} });
const allPts = (o) => o.paths.flatMap((p) => p.pts);
const finite = (o) => allPts(o).every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
const sig = (o) => JSON.stringify(o.paths);

/* --- determinism --- */
{
  const a = run({ sweep: 137, sectorStart: 42, disorder: 0.6, seed: 9 });
  const b = run({ sweep: 137, sectorStart: 42, disorder: 0.6, seed: 9 });
  CHECK("determinism (same inputs, identical output)", sig(a) === sig(b));
}

/* --- legacy invariance: full disc ignores Sector start --- */
{
  const a = run({ sweep: 360, sectorStart: 0 });
  const b = run({ sweep: 360, sectorStart: 271.5 });
  CHECK("sector 360: Sector start is inert", sig(a) === sig(b));
  const c = run({});
  CHECK("defaults (sweep 360) render non-empty", c.paths.length > 0);
}

/* --- sector containment invariant, every content mode --- */
const MODES = def.params.find((q) => q.key === "content").options;
const TAU = Math.PI * 2;
const inWedge = (x, y, cx, cy, th0, sweepR, tolA, tolR) => {
  const dx = x - cx, dy = y - cy;
  const r = Math.hypot(dx, dy);
  if (r < 0.08) return true;
  let d = (Math.atan2(dy, dx) - th0) % TAU;
  if (d < 0) d += TAU;
  const slack = tolA + tolR / Math.max(r, 0.08);
  return d <= sweepR + slack || d >= TAU - slack;
};
for (const mode of MODES) {
  const P = { content: mode, sweep: 210, sectorStart: 30, disorder: 0.5, seed: 4, rim: true };
  const o = run(P);
  const cx = (ctxP.W * defaults.x) / 100, cy = (ctxP.H * defaults.y) / 100;
  const R = defaults.radius;
  const th0 = ((30 - 90) * Math.PI) / 180;
  const sweepR = (210 * Math.PI) / 180;
  const pts = allPts(o);
  const badS = pts.filter((q) => !inWedge(q[0], q[1], cx, cy, th0, sweepR, 2e-3, 0.02));
  const badD = pts.filter((q) => Math.hypot(q[0] - cx, q[1] - cy) > R + 0.01);
  CHECK("[" + mode + "] sector 210: non-empty", o.paths.length > 0);
  CHECK("[" + mode + "] sector 210: all points inside wedge", badS.length === 0,
    badS.length + " leaks, e.g. " + JSON.stringify(badS[0]));
  CHECK("[" + mode + "] sector 210: all points inside disc", badD.length === 0);
  CHECK("[" + mode + "] sector 210: finite coords", finite(o));
  const oL = run(P, ctxL);
  CHECK("[" + mode + "] landscape: finite + non-empty", oL.paths.length > 0 && finite(oL));
}

/* --- cake-slice rim: one closed path touching the apex --- */
{
  const o = run({ sweep: 120, sectorStart: 0, rim: true, content: "Rings" });
  const cx = (ctxP.W * defaults.x) / 100, cy = (ctxP.H * defaults.y) / 100;
  const wedge = o.paths.find((p) => p.closed && p.pts.some((q) => Math.hypot(q[0] - cx, q[1] - cy) < 0.01));
  CHECK("rim becomes a closed wedge outline (apex present)", !!wedge);
  const o2 = run({ sweep: 120, sectorStart: 0, rim: false, content: "Rings" });
  const wedge2 = o2.paths.find((p) => p.closed && p.pts.some((q) => Math.hypot(q[0] - cx, q[1] - cy) < 0.01));
  CHECK("rim off: no wedge outline", !wedge2);
}

/* --- cut-edge cleanliness: clipped ring runs end ON the sector edge --- */
{
  const o = run({ sweep: 180, sectorStart: 0, rim: false, content: "Rings", disorder: 0 });
  const cx = (ctxP.W * defaults.x) / 100, cy = (ctxP.H * defaults.y) / 100;
  const th0 = ((0 - 90) * Math.PI) / 180;
  const sweepR = Math.PI;
  const norm = (a) => { let d = (a - th0) % TAU; if (d < 0) d += TAU; return d; };
  let worst = 0;
  for (const p of o.paths) {
    if (p.closed) continue;
    for (const q of [p.pts[0], p.pts[p.pts.length - 1]]) {
      const d = norm(Math.atan2(q[1] - cy, q[0] - cx));
      worst = Math.max(worst, Math.min(d, Math.abs(d - sweepR), TAU - d));
    }
  }
  CHECK("cut ends sit on the sector edges (worst " + worst.toFixed(5) + " rad)", worst < 5e-3);
}

/* --- parameter liveness --- */
{
  CHECK("sweep is live (360 vs 180 differ)", sig(run({ sweep: 360 })) !== sig(run({ sweep: 180 })));
  CHECK("sectorStart is live at sweep 180", sig(run({ sweep: 180, sectorStart: 0 })) !== sig(run({ sweep: 180, sectorStart: 90 })));
  CHECK("sweep 0: no output", run({ sweep: 0 }).paths.length === 0);
  const miss = run({ sweep: undefined, sectorStart: undefined });
  CHECK("missing sector params (old saved patch) fall back to full disc", sig(miss) === sig(run({ sweep: 360, sectorStart: 0 })));
}

/* --- degenerate / extreme values --- */
{
  const cases = [
    { sweep: 0.5, sectorStart: 359.5, disorder: 1 },
    { sweep: 359.5, sectorStart: 180 },
    { sweep: 90, radius: 5, pitch: 0.8 },
    { sweep: 45, sectorStart: 300, content: "Spiral", disorder: 1 },
    { sweep: 270, content: "Phyllotaxis", csize: 0.4, pitch: 0.8 },
  ];
  let okAll = true, budgetOk = true;
  for (const c of cases) {
    const o = run(c);
    if (!finite(o)) okAll = false;
    const tot = allPts(o).length;
    if (tot > 115000) budgetOk = false;
  }
  CHECK("degenerate/extreme cases: finite, no NaN", okAll);
  CHECK("point budget respected", budgetOk);
}

/* --- overlay: never throws, wedge guide appears --- */
{
  let ov1, ov2, threw = false;
  try {
    ov1 = def.overlay({ ...defaults }, ctxP, [null], { params: {} });
    ov2 = def.overlay({ ...defaults, sweep: 90, sectorStart: 45 }, ctxP, [null], { params: {} });
    def.overlay({ ...defaults, sweep: undefined, sectorStart: undefined }, ctxP, [null], { params: {} });
  } catch (e) { threw = true; }
  CHECK("overlay never throws", !threw);
  CHECK("overlay: full disc = circle only", ov1 && ov1.length === 1 && ov1[0].kind === "circle");
  CHECK("overlay: sector adds a wedge poly", ov2 && ov2.length === 2 && ov2[1].kind === "poly" && ov2[1].pts.length > 10);
}

console.log((fail ? "FAILED " : "ALL OK ") + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
