/* Validator for the Mushroom node. Run from the repo root:
   node tools/validate-mushroom.mjs
   First output line tells which source was tested - [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "mushroom";

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
const runAll = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const run = (p, ctx) => runAll(p, ctx)[0];
const runMesh = (p, ctx) => runAll(p, ctx)[1];
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = defaults();
const SP = ["Chanterelle", "Funnel chanterelle", "Black trumpet", "Gomphidius", "Bolete", "Fly agaric", "Sheep polypore"];

/* --- universal invariants --- */
const r1 = run(p0);
ok(JSON.stringify(runAll(p0)) === JSON.stringify(runAll(p0)), "deterministic (double run, both outputs)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");

const tol = 1.0;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
const rTall = run(p0, { W: 210, H: 297 });
ok(rTall.paths.length > 0 && inb(rTall, 210, 297), "in bounds + non-empty on A4 tall");
const rMany = run({ ...p0, count: 6, size: 60, seed: 3 });
ok(rMany.paths.length > 0 && inb(rMany, 297, 210), "count 6: in bounds + non-empty");

/* --- full species x pitch x yaw sweep: intermediate camera angles are
   where projection geometry breaks first, so sweep them all --- */
{
  let bad = 0, total = 0, minPaths = Infinity;
  for (const sp of SP) {
    for (const pitch of [0, 20, 45, 70, 90]) {
      for (const yaw of [0, 130]) {
        const r = run({ ...p0, species: sp, pitch, yaw, size: 85 });
        total++;
        minPaths = Math.min(minPaths, r.paths.length);
        if (!(r.paths.length > 2 && finiteAll(r) && npts(r) < 120000 && inb(r, 297, 210))) {
          bad++;
          if (bad <= 3) console.log("     sweep fail:", sp, "pitch", pitch, "yaw", yaw, r.paths.length, "paths");
        }
      }
    }
  }
  ok(bad === 0, "angle sweep: " + total + " species/pitch/yaw combos all finite, non-trivial, in budget (min " + minPaths + " paths)");
}

/* --- every parameter does something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => {
  const b = base ? JSON.stringify(run({ ...p0, ...base })) : bJ;
  ok(JSON.stringify(run({ ...p0, ...(base || {}), ...patch })) !== b, "param live: " + label);
};
diff({ seed: 8 }, "seed");
diff({ count: 4 }, "count");
diff({ size: 55 }, "size");
diff({ sizevar: 0.6 }, "sizevar", { count: 5, sizevar: 0 });
diff({ yaw: 200 }, "yaw");
diff({ pitch: 50 }, "pitch");
diff({ anglejit: 170 }, "anglejit", { count: 5, anglejit: 0 });
diff({ leanjit: 40 }, "leanjit", { leanjit: 0 });
diff({ gillsp: 6 }, "gillsp");
diff({ wavy: 0 }, "wavy");
diff({ chaos: 0 }, "chaos");
diff({ chaos: 1 }, "chaos (up)", { chaos: 0.3 });
diff({ stemcurve: 1 }, "stemcurve", { stemcurve: 0 });
diff({ captex: "Stipple" }, "captex");
diff({ outlines: false }, "outlines");
diff({ margin: 45 }, "margin", { count: 5, margin: 5 });
diff({ pen: 3 }, "pen");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- gill spacing actually controls gill count --- */
{
  const gcount = (sp) => run({ ...p0, gillsp: sp, outlines: false, captex: "None" }).paths.length;
  ok(gcount(1.2) > gcount(6) + 4, "denser gill spacing yields more gill lines (" + gcount(1.2) + " vs " + gcount(6) + ")");
}

/* --- decurrent gills: the gill fan reaches down the stem (side view) --- */
{
  const gills = run({ ...p0, species: "Chanterelle", pitch: 0, outlines: false, captex: "None", size: 100, seed: 5 });
  const sil = run({ ...p0, species: "Chanterelle", pitch: 0, outlines: true, gillsp: 8, size: 100, seed: 5 });
  const maxy = (r) => Math.max(...r.paths.flatMap((q) => q.pts.map((pt) => pt[1])));
  ok(maxy(sil) - maxy(gills) < 0.18 * 100, "decurrent: gill lines run down the stem (gap " + (maxy(sil) - maxy(gills)).toFixed(1) + " mm)");
}

/* --- funnel interior: the far inner wall carries lines when looking in --- */
{
  const r = run({ ...p0, species: "Chanterelle", pitch: 45, outlines: false, captex: "None", size: 100, seed: 5 });
  const cy = 105 + 100 * 0.48 - 100 * 0.5; /* rough copy center on screen */
  const farPts = r.paths.reduce((a, q) => a + q.pts.filter((pt) => pt[1] < cy - 8).length, 0);
  ok(farPts > 250, "inner wall: far-side interior carries ridge lines (" + farPts + " pts above center)");
}

/* --- mesh output contract (v2.66 seam) --- */
{
  const m = runMesh(p0);
  ok(m && m.kind === "mesh", "mesh: kind is 'mesh'");
  ok(Number.isInteger(m.tri) && m.tri > 500, "mesh: substantial triangle count (" + m.tri + ")");
  ok(Array.isArray(m.v) && m.v.length === m.tri * 9, "mesh: v.length === tri*9");
  ok(m.v.every((x) => Number.isFinite(x)), "mesh: all coordinates finite");
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.v.length; i += 3) for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], m.v[i + k]); mx[k] = Math.max(mx[k], m.v[i + k]);
  }
  const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const big = Math.max(...ext);
  ok(Math.abs(big - 1) < 3e-3, "mesh: normalized, longest dimension 1 (" + big.toFixed(4) + ")");
  ok(ext.every((e, i) => Math.abs(e - m.dims[i]) < 3e-3) && Math.abs(Math.max(...m.dims) - 1) < 3e-3, "mesh: dims match bbox, max is 1");
  ok(mn.every((v, i) => Math.abs(v + mx[i]) < 4e-3), "mesh: centered on the origin");
  const m5 = runMesh({ ...p0, count: 5 });
  ok(JSON.stringify(m) === JSON.stringify(m5), "mesh: first-copy mesh is count-invariant");
  const mMix = runMesh({ ...p0, species: "Mix" });
  const mMix5 = runMesh({ ...p0, species: "Mix", count: 5 });
  ok(JSON.stringify(mMix) === JSON.stringify(mMix5), "mesh: count-invariant under Mix too");
  ok(JSON.stringify(runMesh({ ...p0, species: "Bolete" })) !== JSON.stringify(m), "mesh: species changes the mesh");
  ok(JSON.stringify(runMesh({ ...p0, size: 40 })) === JSON.stringify(runMesh({ ...p0, size: 120 })), "mesh: normalization cancels Size");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, size: 20, count: 1, wavy: 0, gillsp: 8, margin: 0, pitch: 0 })), "degenerate params: no NaN");
{
  const ext = run({ ...p0, count: 12, size: 140, sizevar: 0.6, captex: "Stipple", gillsp: 1, wavy: 1, pitch: 45, species: "Mix" });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
}
ok(finiteAll(run({ ...p0, margin: 60, count: 8 }, { W: 100, H: 100 })), "tiny canvas + huge margin: no NaN");

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis(p0).includes("sizevar") && vis({ ...p0, count: 3 }).includes("sizevar"), "showIf: sizevar follows count");
  ok(!vis(p0).includes("anglejit") && vis({ ...p0, count: 3 }).includes("anglejit"), "showIf: anglejit follows count");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay.call(def, { ...p0, count: 4 }, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.some((g) => g.kind === "rect") && g1.some((g) => g.kind === "circle"), "overlay: margin rect + copy circles (" + g1.length + ")");
  let threw = false;
  try { def.overlay.call(def, { ...p0 }, { W: 4, H: 4 }, undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
  let threw2 = false;
  try { def.overlay.call({}, p0, { W: 297, H: 210 }, undefined, {}); } catch (e) { threw2 = true; }
  ok(!threw2, "overlay survives a broken this-binding");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
