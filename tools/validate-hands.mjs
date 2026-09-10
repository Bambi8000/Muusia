/* Validator for the Hands node. Run from the repo root: node tools/validate-hands.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "hands";

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
const SPINE = { paths: [
  { pts: [[60, 180], [90, 120], [140, 80], [200, 60]], closed: false, layer: 0 },
  { pts: [[230, 185], [200, 110], [150, 70]], closed: false, layer: 0 },
] };
const run = (p, ctx, ins) => def.compute(ins || [undefined, p.layout === "Spine" ? SPINE : undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = defaults();

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");

const tol = 1.0;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => {
  const b = base ? JSON.stringify(run(base)) : bJ;
  ok(JSON.stringify(run({ ...(base || p0), ...patch })) !== b, "param live: " + label);
};
diff({ layout: "Spine" }, "layout");
diff({ count: 9 }, "count");
diff({ rows: 3 }, "rows");
diff({ size: 70 }, "size");
diff({ which: "Right" }, "which");
diff({ armlen: "Full arm" }, "armlen");
diff({ armw: 150 }, "armw");
diff({ cut: "Flat" }, "cut");
diff({ pose: "Claw" }, "pose");
diff({ posejit: 90 }, "posejit");
diff({ spread: 30 }, "spread");
diff({ wrist: 30 }, "wrist");
diff({ elbow: -50 }, "elbow (in Full arm)", { ...p0, armlen: "Full arm" });
diff({ mut: 80 }, "mut");
diff({ detail: 15 }, "detail");
diff({ nails: false }, "nails");
diff({ jitter: 90 }, "jitter");
diff({ seed: 999 }, "seed");
diff({ layer: 4 }, "layer");
ok(run({ ...p0, layer: 4 }).paths.every((q) => q.layer === 4), "layer applied to every path");

/* --- every select option renders (Spine gets a wired spine) --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- spine mount (perpendicular placement) --- */
const sb = { ...p0, layout: "Spine" };
diff({ mount: "Left" }, "mount (Spine)", sb);
diff({ space: 80 }, "space (Spine Left)", { ...sb, mount: "Left" });
for (const opt of ["Along", "Left", "Right", "Both (alternate)", "Both (random)"]) {
  const r = run({ ...sb, mount: opt });
  ok(r.paths.length > 0 && finiteAll(r), "mount '" + opt + "' draws finite paths (" + r.paths.length + ")");
}
const FLAT = { paths: [{ pts: [[40, 100], [260, 100]], closed: false, layer: 0 }] };
const rBoth = def.compute([undefined, FLAT], { ...sb, mount: "Both (alternate)", space: 40, size: 20 }, { W: 297, H: 210 }, {});
ok(rBoth.paths.some((q) => q.pts.some(([x, y]) => y < 90)) && rBoth.paths.some((q) => q.pts.some(([x, y]) => y > 110)),
  "Both (alternate) places hands on both sides of a flat spine");
const rPerpX = def.compute([undefined, FLAT], { ...sb, mount: "Both (random)", space: 4, size: 150, detail: 100, mut: 100, armlen: "Full arm" }, { W: 297, H: 210 }, {});
ok(finiteAll(rPerpX) && npts(rPerpX) <= 120000, "perpendicular extreme: finite + budget held (" + npts(rPerpX) + " pts)");

/* --- spine mode specifics --- */
const rs1 = run({ ...p0, layout: "Spine" }), rs2 = run({ ...p0, layout: "Spine" });
ok(JSON.stringify(rs1) === JSON.stringify(rs2), "spine mode deterministic");
ok(rs1.paths.length >= 2, "spine mode: one silhouette per wired path (" + rs1.paths.length + " paths)");
ok(run({ ...p0, layout: "Spine" }, undefined, [undefined, undefined]).paths.length === 0, "spine mode with no wire returns EMPTY");
ok(run({ ...p0, layout: "Spine" }, undefined, [undefined, { paths: [{ pts: [[10, 10]], closed: false, layer: 0 }] }]).paths.length === 0,
  "spine mode skips degenerate 1-pt spine");

/* --- closed-silhouette contract --- */
const rc = run({ ...p0, nails: false, cut: "Flat" });
ok(rc.paths.every((q) => q.closed === true), "Flat + no nails: every path is a closed shape");
const rn = run({ ...p0, nails: true, cut: "Flat" });
ok(rn.paths.length > rc.paths.length, "nails add extra closed shapes");
ok(rn.paths.every((q) => q.closed === true), "nail shapes are closed");
const rcuff = run({ ...p0, cut: "Cuff", nails: false });
ok(rcuff.paths.some((q) => q.closed === false), "Cuff adds the open rim arc");

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, count: 1, rows: 1, size: 10, detail: 0, mut: 0, spread: 0, armw: 40, posejit: 0, jitter: 0 })),
  "degenerate params produce no NaN");
const ext = run({ ...p0, count: 40, rows: 6, size: 150, detail: 100, mut: 100, posejit: 100, jitter: 100, armlen: "Full arm", spread: 150, armw: 180 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(inb(ext, 297, 210), "extreme params stay in bounds (Rows fit)");
const wild = run({ ...p0, mut: 300, size: 400, count: 100, wrist: 200, elbow: 500 });
ok(finiteAll(wild), "wire-pushed out-of-range values produce no NaN");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis(p0).includes("count") && vis(p0).includes("jitter"), "showIf: rows params visible in Rows");
ok(!vis({ ...p0, layout: "Spine" }).includes("count"), "showIf: rows params hidden in Spine");
ok(!vis(p0).includes("elbow") && vis({ ...p0, armlen: "Full arm" }).includes("elbow"), "showIf: elbow only in Full arm");
ok(!vis(p0).includes("mount") && vis({ ...p0, layout: "Spine" }).includes("mount"), "showIf: mount only in Spine");
ok(!vis({ ...p0, layout: "Spine" }).includes("space") && vis({ ...p0, layout: "Spine", mount: "Left" }).includes("space"),
  "showIf: space only when mount != Along");
ok(vis({ ...p0, layout: "Spine", mount: "Left" }).includes("jitter") && !vis({ ...p0, layout: "Spine" }).includes("jitter"),
  "showIf: jitter in Rows and perpendicular Spine only");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined),
  "showIf: hidden params still carry defaults");

/* --- overlay --- */
const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
ok(Array.isArray(g1) && g1.length > 0 && g1.length <= 60, "overlay returns guides in Rows (" + g1.length + ")");
const g2 = def.overlay({ ...p0, layout: "Spine" }, { W: 297, H: 210 }, [undefined, SPINE], {});
ok(Array.isArray(g2) && g2.some((g) => g.kind === "poly"), "overlay shows wired spines in Spine mode");
let threw = false;
try {
  def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined);
  def.overlay({}, undefined, undefined, undefined);
  def.overlay({ ...p0, layout: "Spine" }, { W: 297, H: 210 }, undefined, undefined);
} catch (e) { threw = true; }
ok(!threw, "overlay never throws on degenerate input");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
