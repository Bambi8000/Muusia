import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "cmyk_registration";
const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");

let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href)).default;
  mode = "[baked]";
} else {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample", "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? "OK   " : "FAIL ") + msg);
  if (!cond) fails++;
};

const defaults = () => {
  const p = {};
  for (const pr of def.params) p[pr.key] = pr.def;
  return p;
};
const run = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = defaults();
const r1 = run(p0);
const r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
const usedLayers = [...new Set(r1.paths.map((q) => q.layer))].sort((a, b) => a - b);
ok(usedLayers.length === 4, "4 plate pens in use at defaults (" + usedLayers.join(",") + ")");

const tol = p0.misreg + p0.wobble + 1.6;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide (tol " + tol.toFixed(1) + " mm)");
const rT = run(p0, { W: 210, H: 297 });
ok(inb(rT, 210, 297), "in bounds on A4 tall");
ok(npts(r1) < 120000, "point budget at defaults");

const MARK_KEYS = ["mCross", "mBull", "mStar", "mTomboC", "mTomboK", "mCrop", "mBar", "mLadder", "mEye", "mQuart", "mMicro", "mSteps", "mScale"];
const only = (k) => { const o = {}; for (const q of MARK_KEYS) o[q] = q === k; return o; };
const base = { ...p0, layout: "Grid" };
const bJ = JSON.stringify(run(base));
const diff = (patch, label) => ok(JSON.stringify(run({ ...base, ...patch })) !== bJ, "param live: " + label);
diff({ size: 22 }, "size");
diff({ count: 30 }, "count");
diff({ margin: 32 }, "margin");
diff({ misreg: 3 }, "misreg");
diff({ wobble: 2 }, "wobble");
diff({ plates: "K only" }, "plates");
diff({ penC: 4 }, "penC");
diff({ penM: 2 }, "penM");
diff({ penY: 3 }, "penY");
diff({ penK: 9 }, "penK");
diff({ frame: false }, "frame");
diff({ seed: p0.seed + 5 }, "seed");
diff({ layout: "Press sheet" }, "layout");
for (const k of MARK_KEYS) diff({ [k]: false }, "checkbox " + k);
const cb = { ...base, ...only("mBar") };
ok(JSON.stringify(run({ ...cb, hatch: 1.6 })) !== JSON.stringify(run(cb)), "param live: hatch (Color bar only)");

for (const k of MARK_KEYS) {
  const r = run({ ...base, ...only(k) });
  ok(r.paths.length > 0 && finiteAll(r), "single mark '" + k + "' draws finite paths (" + r.paths.length + ")");
}
const noneOn = {}; for (const q of MARK_KEYS) noneOn[q] = false;
const rNone = run({ ...base, ...noneOn });
ok(rNone.paths.length > 0 && finiteAll(rNone), "none ticked falls back to crosshairs (" + rNone.paths.length + ")");
const sC = run({ ...base, layout: "Single", single: "Crosshair target", frame: false, misreg: 0, wobble: 0 });
ok(sC.paths.length === 12, "Single crosshair: 3 elements x 4 plates = 12 paths (" + sC.paths.length + ")");
let sx = 0, sy = 0, sn = 0;
for (const q of sC.paths) for (const pt of q.pts) { sx += pt[0]; sy += pt[1]; sn++; }
ok(Math.abs(sx / sn - 148.5) < 0.5 && Math.abs(sy / sn - 105) < 0.5, "Single mark sits at canvas center");
const sT = run({ ...base, layout: "Single", single: "Tombo corner", frame: false, misreg: 0, wobble: 0 });
ok(sT.paths.length === 64, "Single tombo corner: 4 corners x 4 lines x 4 plates = 64 paths (" + sT.paths.length + ")");
const m0 = p0.margin;
const corners = [[m0, m0], [297 - m0, m0], [297 - m0, 210 - m0], [m0, 210 - m0]];
const nearC = sT.paths.every((q) => {
  const cxp = q.pts.reduce((a, pt) => a + pt[0], 0) / q.pts.length;
  const cyp = q.pts.reduce((a, pt) => a + pt[1], 0) / q.pts.length;
  return corners.some(([kx, ky]) => Math.hypot(cxp - kx, cyp - ky) < p0.size * 1.3);
});
ok(nearC, "Single tombo corner marks cluster at the four trim corners");
const sCrop = run({ ...base, layout: "Single", single: "Crop marks", frame: false });
ok(sCrop.paths.length === 32, "Single crop marks: 4 corners x 2 lines x 4 plates = 32 paths (" + sCrop.paths.length + ")");
const sBase = { ...base, layout: "Single" };
const sJ = JSON.stringify(run(sBase));
ok(JSON.stringify(run({ ...sBase, single: "Bullseye" })) !== sJ, "param live: single (dropdown changes the mark)");
const noneOnS = {}; for (const q of MARK_KEYS) noneOnS[q] = false;
ok(JSON.stringify(run({ ...sBase, ...noneOnS })) === sJ, "Single ignores the checkboxes (dropdown is the sole selector)");
for (const opt of def.params.find((q) => q.key === "single").options) {
  const r = run({ ...sBase, single: opt });
  ok(r.paths.length > 0 && finiteAll(r), "Single '" + opt + "' draws finite paths (" + r.paths.length + ")");
}
const psOne = run({ ...p0, layout: "Press sheet", ...only("mCross") });
const psAll = run({ ...p0, layout: "Press sheet" });
ok(psOne.paths.length > 0 && psOne.paths.length < psAll.paths.length, "press sheet filters by ticked types (" + psOne.paths.length + " < " + psAll.paths.length + ")");
for (const opt of def.params.find((q) => q.key === "layout").options) {
  const r = run({ ...p0, layout: opt });
  ok(r.paths.length > 0 && finiteAll(r), "layout '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

const reg = run({ ...base, ...only("mCross"), misreg: 0, wobble: 0, count: 6 });
const byLayer = new Map();
for (const q of reg.paths) {
  if (!byLayer.has(q.layer)) byLayer.set(q.layer, []);
  byLayer.get(q.layer).push(q.pts.map(([x, y]) => x.toFixed(4) + "," + y.toFixed(4)).join(";") + (q.closed ? "C" : "O"));
}
ok(byLayer.size === 4, "registration color: 4 plates present");
const sigs = [...byLayer.values()].map((a) => a.slice().sort().join("|"));
ok(sigs.every((sg) => sg === sigs[0]), "zero misreg + zero wobble => identical geometry on every plate");

const ko = run({ ...base, plates: "K only" });
ok(ko.paths.length > 0 && ko.paths.every((q) => q.layer === Math.round(p0.penK)), "K only plots only with the Black pen");

const cmOnly = run({ ...base, plates: "CM", ...only("mBar") });
const cmLayers = new Set(cmOnly.paths.map((q) => q.layer));
ok(!cmLayers.has(Math.round(p0.penY)) && !cmLayers.has(Math.round(p0.penK)), "CM plates never touch Y/K pens");

const ext = run({ ...base, size: 60, count: 80, misreg: 8, wobble: 5, hatch: 0.3 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
const zero = run({ ...base, size: 0, count: 0, margin: 0 });
ok(finiteAll(zero), "degenerate params do not produce NaN");

if (def.overlay) {
  const g1 = def.overlay(p0, { W: 297, H: 210 });
  ok(Array.isArray(g1) && g1.length > 1 && g1[0].kind === "rect", "overlay returns margin rect + placement points (" + g1.length + " guides)");
  let threw = false;
  try { def.overlay({ ...p0, margin: 0, size: 0, count: 0 }, { W: 40, H: 40 }); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate params");
} else {
  ok(false, "overlay exists (spatial params require it)");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
