import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "image_rasterise";
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

const IW = 48, IH = 32;
const rgb = new Array(IW * IH * 3);
const gArr = new Array(IW * IH);
for (let y = 0; y < IH; y++) {
  for (let x = 0; x < IW; x++) {
    const i = y * IW + x;
    let r, g, b;
    if (x < 8 && y < 8) { r = 255; g = 255; b = 255; }
    else if (x >= IW - 8 && y >= IH - 8) { r = 0; g = 0; b = 0; }
    else {
      r = Math.round((x / (IW - 1)) * 255);
      g = Math.round((y / (IH - 1)) * 255);
      b = Math.round((1 - x / (IW - 1)) * 255);
    }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
    gArr[i] = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
}
const IMG = { w: IW, h: IH, g: gArr, rgb };
const IMG_GRAY = { w: IW, h: IH, g: gArr };
const WHITE = { w: 8, h: 8, g: new Array(64).fill(0), rgb: new Array(192).fill(255) };

const defaults = () => {
  const p = {};
  for (const pr of def.params) p[pr.key] = pr.def;
  return p;
};
const run = (p, img, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, { data: { img: img === undefined ? IMG : img } });
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = defaults();

ok(def.fileImage === true, "fileImage flag set (engine decodes to node.data.img)");
const rNo = def.compute([undefined], p0, { W: 297, H: 210 }, {});
ok(rNo.paths.length === 0, "no image loaded => EMPTY");

const r1 = run(p0);
const r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(r1.paths.every((q) => q.pts.every(([x, y]) => x >= -0.5 && x <= 297.5 && y >= -0.5 && y <= 210.5)), "in bounds at defaults");
ok(npts(r1) <= 120000, "point budget at defaults");
const usedLayers = [...new Set(r1.paths.map((q) => q.layer))].sort((a, b) => a - b);
ok(usedLayers.length === 4, "4 plate pens in use (" + usedLayers.join(",") + ")");

const rT = run(p0, IMG, { W: 210, H: 297 });
ok(rT.paths.length > 0 && finiteAll(rT), "A4 tall works");

const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ cell: 5 }, "cell");
diff({ scale: 0.7 }, "scale");
diff({ gamma: 2 }, "gamma");
diff({ cutoff: 0.3 }, "cutoff");
diff({ black: 0.3 }, "black (GCR)");
diff({ misreg: 3 }, "misreg");
diff({ skew: 2 }, "skew");
diff({ dotgain: 1.6 }, "dotgain");
diff({ doubling: 1 }, "doubling");
diff({ noise: 0.5 }, "noise");
diff({ margin: 30 }, "margin");
diff({ plates: "CMY" }, "plates");
diff({ penC: 4 }, "penC");
diff({ penM: 2 }, "penM");
diff({ penY: 3 }, "penY");
diff({ penK: 9 }, "penK");
diff({ seed: p0.seed + 5 }, "seed (drives misreg directions)");

for (const opt of def.params.find((q) => q.key === "dotstyle").options) {
  const r = run({ ...p0, dotstyle: opt });
  ok(r.paths.length > 0 && finiteAll(r) && npts(r) <= 120000, "dot style '" + opt + "' draws finite paths within budget (" + npts(r) + " pts)");
}

const std = JSON.stringify(run({ ...p0, angles: "Standard (15/75/0/45)" }));
ok(JSON.stringify(run({ ...p0, angles: "Standard (15/75/0/45)", angC: 60 })) === std, "Standard angles ignore the angle sliders (one-click reset)");
const custStd = JSON.stringify(run({ ...p0, angles: "Custom" }));
ok(custStd === std, "Custom with default sliders equals Standard");
ok(JSON.stringify(run({ ...p0, angles: "Custom", angC: 60 })) !== std, "param live: angC (Custom)");
ok(JSON.stringify(run({ ...p0, angles: "Custom", angM: 30 })) !== std, "param live: angM (Custom)");
ok(JSON.stringify(run({ ...p0, angles: "Custom", angY: 22 })) !== std, "param live: angY (Custom)");
ok(JSON.stringify(run({ ...p0, angles: "Custom", angK: 10 })) !== std, "param live: angK (Custom)");

const ko = run({ ...p0, plates: "K only" });
ok(ko.paths.length > 0 && ko.paths.every((q) => q.layer === Math.round(p0.penK)), "K only plots only with the Black pen");
const cm = run({ ...p0, plates: "CM" });
const cmL = new Set(cm.paths.map((q) => q.layer));
ok(!cmL.has(Math.round(p0.penY)) && !cmL.has(Math.round(p0.penK)), "CM plates never touch Y/K pens");

const gray = run(p0, IMG_GRAY);
const grayL = new Set(gray.paths.map((q) => q.layer));
ok(gray.paths.length > 0 && grayL.size === 1 && grayL.has(Math.round(p0.penK)), "grayscale fallback (no rgb): neutral image lands on the K plate only");

const white = run(p0, WHITE);
ok(white.paths.length === 0, "pure white image => no dots (cutoff)");

const ext = run({ ...p0, cell: 1, dotstyle: "Rings", dotgain: 2, doubling: 2, misreg: 8, cutoff: 0 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
const degen = run({ ...p0, margin: 0, cell: 0.1, scale: 0.5 });
ok(finiteAll(degen) && npts(degen) <= 120000, "degenerate params: finite + budget held (" + npts(degen) + " pts)");

const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
const vStd = vis({ ...p0, angles: "Standard (15/75/0/45)" });
const vCus = vis({ ...p0, angles: "Custom" });
ok(["angC", "angM", "angY", "angK"].every((k) => !vStd.includes(k)), "showIf: Standard hides all four angle sliders");
ok(["angC", "angM", "angY", "angK"].every((k) => vCus.includes(k)), "showIf: Custom shows all four angle sliders");
ok(vStd.includes("angles") && vCus.includes("angles"), "showIf: the Angles select itself is always visible");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
ok(Number.isInteger(def.imageMax) && def.imageMax > 160 && def.imageMax <= 1600, "imageMax opt-in set to " + def.imageMax + " px (engine clamps 32..1600)");

if (def.overlay) {
  const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, { data: { img: IMG } });
  ok(Array.isArray(g1) && g1.length === 2 && g1[0].kind === "rect" && g1[1].kind === "rect", "overlay: margin box + fitted image box");
  const g2 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g2) && g2.length === 1, "overlay without an image: margin box only");
  let threw = false;
  try { def.overlay({ ...p0, margin: 0 }, { W: 4, H: 4 }, undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws");
} else {
  ok(false, "overlay exists (spatial params require it)");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
