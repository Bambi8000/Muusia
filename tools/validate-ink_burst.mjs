/* validate-ink_burst.mjs — run from repo root: node tools/validate-ink_burst.mjs
   Auto-switch: prefers baked src/defs/nodes/ink_burst.js, falls back to
   nodes-lab/ink_burst.plotternode.js evaluated with the REAL src/defs/helpers.js. */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const BAKED = "src/defs/nodes/ink_burst.js";
const LAB = "nodes-lab/ink_burst.plotternode.js";
let N, mode;
if (fs.existsSync(BAKED)) {
  N = (await import(pathToFileURL(path.resolve(BAKED)).href)).default;
  mode = "baked";
} else {
  const H = await import(pathToFileURL(path.resolve("src/defs/helpers.js")).href);
  const keys = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample", "pathLength", "applyStyle", "signedArea", "isStyle", "parseSVG", "SFONT", "fontStrokes"];
  const src = fs.readFileSync(LAB, "utf8");
  N = new Function(...keys, '"use strict"; return (' + src + ");")(...keys.map((k) => H[k]));
  mode = "lab";
}
console.log(`[${mode}] ink_burst validator`);

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute.call(N, [undefined], { ...defs(), ...over }, ctx, {});
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ok  " + msg); } else { fail++; console.log("  FAIL " + msg); } };
const plen = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };

/* 1. determinism */
ok(JSON.stringify(run()) === JSON.stringify(run()), "deterministic (double run identical)");

/* 2. finite, >=2 pts, in-bounds across seeds + extremes */
const cases = [
  {}, { seed: 2 }, { seed: 3 }, { seed: 4 },
  { radius: 140, reach: 1, blob: 6, tendrils: 300, striae: 1, seed: 5 },
  { radius: 140, aspect: 0.5, margin: 0, seed: 6 },
  { radius: 140, aspect: 1.5, margin: 40, edge: 1, wobble: 1, breakup: 1, seed: 7 },
  { core: 0.5, body: 0.85, beads: 1, curl: 1, seed: 8 },
];
let geomOK = true, boundsOK = true, minPts = true;
for (const c of cases) {
  const r = run(c);
  const m = Math.max(0, c.margin ?? defs().margin);
  for (const ph of r.paths) {
    if (ph.pts.length < 2) minPts = false;
    for (const [x, y] of ph.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) geomOK = false;
      if (x < m - 0.01 || x > CTX.W - m + 0.01 || y < m - 0.01 || y > CTX.H - m + 0.01) boundsOK = false;
    }
  }
}
ok(geomOK, "all coordinates finite (8 cases incl. extremes)");
ok(minPts, "every path >= 2 points");
ok(boundsOK, "all points inside the margin box (8 cases)");

/* 3. seed liveness */
ok(JSON.stringify(run({ seed: 1 })) !== JSON.stringify(run({ seed: 2 })), "seed changes output");

/* 4. per-param liveness */
const base = JSON.stringify(run());
const live = [
  ["radius", 100], ["aspect", 1.3], ["edge", 0.9], ["core", 0.3], ["body", 0.7],
  ["striae", 0.2], ["wobble", 0.95], ["breakup", 0.9], ["tendrils", 40],
  ["reach", 0.2], ["curl", 0.9], ["blob", 5], ["beads", 0.9], ["margin", 40],
];
for (const [k, v] of live) ok(JSON.stringify(run({ [k]: v })) !== base, `param live: ${k}`);
ok(run({ layer: 7 }).paths.every((ph) => ph.layer === 7), "layer applied to every path");

/* 5. CORE VOID: no ink inside half the core radius (default wobble) */
{
  const p = { core: 0.3, radius: 80, seed: 3 };
  const r = run(p);
  const cx = CTX.W / 2, cy = CTX.H / 2;
  /* invert the aspect mapping (aspect 0.85 -> ax=0.85, ay=1) */
  const ax = 0.85, ay = 1;
  let minRho = Infinity;
  for (const ph of r.paths) for (const [x, y] of ph.pts) {
    const rho = Math.hypot((x - cx) / ax, (y - cy) / ay);
    if (rho < minRho) minRho = rho;
  }
  const R = 80; /* radius 80 fits A4 with margin 10 at these settings */
  ok(minRho > 0.3 * R * 0.5, `core void preserved (closest ink ${minRho.toFixed(1)} mm > ${(0.3 * R * 0.5).toFixed(1)} mm)`);
}

/* 6. BREAKUP monotonic: more breakup -> less total drawn length (tendrils fixed) */
{
  const total = (b) => run({ breakup: b, tendrils: 10, beads: 0 }).paths.reduce((s, ph) => s + plen(ph.pts), 0);
  const lo = total(0.05), hi = total(0.85);
  ok(hi < lo * 0.85, `breakup tears ink away (${hi.toFixed(0)} mm < ${lo.toFixed(0)} mm)`);
}

/* 7. ASPECT: oval footprint - bbox width < height at aspect 0.85 on a square canvas */
{
  const r = run({}, { W: 300, H: 300 });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const ph of r.paths) for (const [x, y] of ph.pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  ok((x1 - x0) < (y1 - y0) * 0.97, `aspect 0.85 squeezes the burst (${(x1 - x0).toFixed(0)} x ${(y1 - y0).toFixed(0)} mm)`);
}

/* 8. DROPLET spirals: with straight stems (curl 0), the stroke tail turns hard - it's a spiral */
{
  const r = run({ tendrils: 60, striae: 0, breakup: 0, beads: 0, blob: 3, curl: 0, seed: 4 });
  let checked = 0, curled = 0;
  for (const ph of r.paths) {
    if (ph.pts.length < 8) continue;
    checked++;
    const tail = ph.pts.slice(-16);
    let turn = 0;
    for (let i = 2; i < tail.length; i++) {
      const a1 = Math.atan2(tail[i - 1][1] - tail[i - 2][1], tail[i - 1][0] - tail[i - 2][0]);
      const a2 = Math.atan2(tail[i][1] - tail[i - 1][1], tail[i][0] - tail[i - 1][0]);
      let d = a2 - a1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      turn += Math.abs(d);
    }
    if (turn > 2.5) curled++;
  }
  ok(checked > 50 && curled / checked > 0.9, `every stroke ends in a spiral droplet (${curled}/${checked})`);
}

/* 9. STEM + droplet are one continuous stroke: no jump > 2.5 mm inside any tendril path */
{
  const r = run({ tendrils: 60, striae: 0, breakup: 0, beads: 0, seed: 5 });
  let contOK = true;
  for (const ph of r.paths) {
    for (let i = 1; i < ph.pts.length; i++) {
      if (Math.hypot(ph.pts[i][0] - ph.pts[i - 1][0], ph.pts[i][1] - ph.pts[i - 1][1]) > 2.5) contOK = false;
    }
  }
  ok(contOK, "tendril stem flows into its droplet as one continuous stroke");
}

/* 10. point budget at max settings */
{
  const r = run({ radius: 140, striae: 1, tendrils: 300, blob: 6, beads: 1, reach: 1 });
  const total = r.paths.reduce((s, ph) => s + ph.pts.length, 0);
  ok(total <= 110000 + 1200, `point budget respected at max settings (${total} pts)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
