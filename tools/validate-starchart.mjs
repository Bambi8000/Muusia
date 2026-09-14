/* Validator for the Star Chart node. Run from the repo root:
   node tools/validate-starchart.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "starchart";

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
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const p0 = defaults();
const run = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
/* hits are the small closed polygons on the hit pen; use distinct pens to split layers */
const P = { ...p0, gpen: 1, hpen: 2 };
const hitPaths = (r) => r.paths.filter((q) => q.layer === 2 && q.closed && q.pts.length <= 8);
const gridPaths = (r) => r.paths.filter((q) => q.layer === 1);
const centroid = (q) => q.pts.reduce((a, pt) => [a[0] + pt[0] / q.pts.length, a[1] + pt[1] / q.pts.length], [0, 0]);

/* --- universal --- */
const r1 = run(P);
ok(JSON.stringify(r1) === JSON.stringify(run(P)), "deterministic (double run byte-identical)");
ok(r1.paths.length > 100, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 1.0;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(P, { W: 210, H: 297 }), 210, 297) && run(P, { W: 210, H: 297 }).paths.length > 100, "in bounds + non-empty on A4 tall");
ok(inb(run({ ...P, system: "Cartesian" }), 297, 210), "Cartesian in bounds");

/* --- hits obey the chart --- */
{
  const hits = hitPaths(r1);
  ok(hits.length > 400, "plenty of hits at defaults (" + hits.length + ")");
  const R = Math.min(297, 210) / 2 - P.margin - 6;
  const holeR = R * P.hole;
  const minR = Math.min(...hits.map((q) => Math.hypot(centroid(q)[0] - 148.5, centroid(q)[1] - 105)));
  ok(minR > holeR + P.dotmax + 0.1, "polar hole stays clean incl. dot buffer (nearest hit " + minR.toFixed(1) + " mm vs hole+dot " + (holeR + P.dotmax).toFixed(1) + ")");
  const maxHalf = Math.max(...hits.map((q) => {
    const c = centroid(q);
    return Math.max(...q.pts.map((pt) => Math.hypot(pt[0] - c[0], pt[1] - c[1])));
  }));
  ok(maxHalf <= P.dotmax + 0.05, "dot radii within Dot max (" + maxHalf.toFixed(2) + " <= " + P.dotmax + ")");
}

/* --- falloff really steers density --- */
{
  const meanR = (r) => {
    const hits = hitPaths(r);
    return hits.reduce((a, q) => a + Math.hypot(centroid(q)[0] - 148.5, centroid(q)[1] - 105), 0) / Math.max(1, hits.length);
  };
  const out = meanR(run({ ...P, falloff: 1 }));
  const inn = meanR(run({ ...P, falloff: -1 }));
  ok(out > inn + 4, "falloff steers hits outward vs inward (mean radius " + out.toFixed(1) + " vs " + inn.toFixed(1) + " mm)");
}

/* --- wear erodes the graticule --- */
{
  const glen = (r) => gridPaths(r).reduce((a, q) => {
    let L = 0;
    for (let i = 1; i < q.pts.length; i++) L += Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1]);
    return a + L;
  }, 0);
  const fresh = glen(run({ ...P, wear: 0, hits: 0 }));
  const wornL = glen(run({ ...P, wear: 0.9, hits: 0 }));
  ok(wornL < fresh * 0.75, "wear erodes graticule ink (" + Math.round(fresh) + " -> " + Math.round(wornL) + " mm)");
}

/* --- hits count scales, labels toggle, params live --- */
ok(hitPaths(run({ ...P, hits: 6000 })).length > hitPaths(run({ ...P, hits: 1000 })).length * 2.5, "Hits scales the dot count");
ok(run({ ...P, labels: false }).paths.length < r1.paths.length, "labels toggle removes label strokes");
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => {
  const b = base ? JSON.stringify(run({ ...P, ...base })) : bJ;
  ok(JSON.stringify(run({ ...P, ...(base || {}), ...patch })) !== b, "param live: " + label);
};
diff({ seed: 8 }, "seed");
diff({ system: "Cartesian" }, "system");
diff({ rings: 6 }, "rings");
diff({ band: 1 }, "band");
diff({ bandgap: 1.6 }, "bandgap");
diff({ spokes: 24 }, "spokes");
diff({ hole: 0.4 }, "hole");
diff({ wear: 0.9 }, "wear", { wear: 0 });
diff({ wobble: 1 }, "wobble", { wobble: 0 });
diff({ dotmin: 1 }, "dotmin");
diff({ dotmax: 2 }, "dotmax");
diff({ patchiness: 1 }, "patchiness", { patchiness: 0 });
diff({ margin: 40 }, "margin");
diff({ gpen: 5 }, "gpen");
diff({ hpen: 6 }, "hpen");

for (const opt of ["Polar", "Cartesian"]) {
  const r = run({ ...P, system: opt });
  ok(r.paths.length > 100 && finiteAll(r), "system '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* --- degenerate / extreme --- */
ok(finiteAll(run({ ...P, hits: 0, rings: 4, band: 1, hole: 0, wear: 1, labels: false })), "degenerate params: no NaN");
{
  const ext = run({ ...P, hits: 8000, rings: 24, band: 5, spokes: 36, wobble: 1 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
}
ok(finiteAll(run({ ...P, margin: 60 }, { W: 100, H: 100 })), "tiny canvas + huge margin: no NaN");

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(vis(P).includes("hole") && !vis({ ...P, system: "Cartesian" }).includes("hole"), "showIf: hole/spokes are polar-only");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay.call(def, P, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.some((g) => g.kind === "rect") && g1.some((g) => g.kind === "circle"), "overlay: margin rect + chart circles");
  let threw = false;
  try { def.overlay.call({}, P, { W: 4, H: 4 }, undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay survives degenerate input and broken this-binding");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
