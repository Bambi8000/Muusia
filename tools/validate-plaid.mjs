/* Validator for the Plaid Grids 3D node. Run from the repo root:
   node tools/validate-plaid.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "plaid";

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

/* --- universal --- */
const r1 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(run(p0)), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 1.0;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));

/* --- THE loop claim: phase 1 is byte-identical to phase 0 --- */
for (const cfg of [{}, { bob: 20, yaw: 123, pitch: -30 }, { arrange: "Box" }, { arrange: "Random", persp: 0.8 }]) {
  const a = JSON.stringify(run({ ...p0, ...cfg, phase: 0 }));
  const b = JSON.stringify(run({ ...p0, ...cfg, phase: 1 }));
  ok(a === b, "seamless loop: phase 1 === phase 0 (" + JSON.stringify(cfg) + ")");
}
ok(JSON.stringify(run({ ...p0, phase: 0.5 })) !== JSON.stringify(r1), "phase 0.5 actually moves the camera");

/* --- no flicker: path count constant across the whole orbit --- */
{
  const counts = [0, 0.13, 0.37, 0.61, 0.89].map((ph) => run({ ...p0, phase: ph, dropout: 0.3, bob: 15 }).paths.length);
  ok(counts.every((c) => c === counts[0]), "no flicker: path count constant across orbit (" + counts.join(",") + ")");
}

/* --- in bounds across the orbit (fixed scale, no per-frame refit) --- */
{
  let bad = 0;
  for (const ph of [0, 0.2, 0.4, 0.6, 0.8]) {
    for (const arr of ["Stack", "Box", "Random"]) {
      if (!inb(run({ ...p0, phase: ph, arrange: arr, persp: 0.6 }), 297, 210)) bad++;
    }
  }
  ok(bad === 0, "in bounds across orbit x arrangement (15 combos)");
}
ok(run(p0, { W: 210, H: 297 }).paths.length > 0 && inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds + non-empty on A4 tall");

/* --- params live --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => {
  const b = base ? JSON.stringify(run({ ...p0, ...base })) : bJ;
  ok(JSON.stringify(run({ ...p0, ...(base || {}), ...patch })) !== b, "param live: " + label);
};
diff({ seed: 8 }, "seed");
diff({ grids: 7 }, "grids");
diff({ arrange: "Box" }, "arrange");
diff({ spread: 0.1 }, "spread");
diff({ size: 60 }, "size");
diff({ cellmin: 14 }, "cellmin");
diff({ cellmax: 30 }, "cellmax");
diff({ bands: 6 }, "bands", { bands: 1 });
diff({ bandgap: 3 }, "bandgap");
diff({ wobble: 0.9 }, "wobble", { wobble: 0 });
diff({ dropout: 0.7 }, "dropout", { dropout: 0 });
diff({ yaw: 200 }, "yaw");
diff({ pitch: -50 }, "pitch");
diff({ persp: 0.9 }, "persp", { persp: 0 });
diff({ phase: 0.3 }, "phase");
diff({ bob: 25 }, "bob", { phase: 0.3, bob: 0 });
diff({ margin: 50 }, "margin");
diff({ pen: 3 }, "pen");
diff({ penper: true }, "penper");

/* --- select options render --- */
for (const opt of ["Stack", "Box", "Random"]) {
  const r = run({ ...p0, arrange: opt });
  ok(r.paths.length > 0 && finiteAll(r), "arrange '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* --- bands multiply strokes, pen cycling works --- */
{
  const b1 = run({ ...p0, bands: 1, dropout: 0 }).paths.length;
  const b6 = run({ ...p0, bands: 6, dropout: 0 }).paths.length;
  ok(b6 > b1 * 1.5, "bands multiply stroke count (" + b1 + " -> " + b6 + ")");
  const layers = new Set(run({ ...p0, penper: true, pen: 2 }).paths.map((q) => q.layer));
  ok(layers.size >= Math.min(4, p0.grids), "pen per grid cycles layers (" + [...layers].join(",") + ")");
}

/* --- wobble 0 keeps straight lines as 2 points even under perspective --- */
{
  const r = run({ ...p0, wobble: 0, persp: 0.8 });
  ok(r.paths.every((q) => q.pts.length === 2), "wobble 0: pure endpoint lines (perspective keeps them straight)");
}

/* --- degenerate / extreme --- */
ok(finiteAll(run({ ...p0, grids: 2, size: 40, cellmin: 2, cellmax: 2, spread: 0, persp: 1 })), "degenerate params: no NaN");
{
  const ext = run({ ...p0, grids: 8, bands: 6, cellmin: 2, cellmax: 3, wobble: 1, size: 220, dropout: 0 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
}
ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "tiny canvas + huge margin: no NaN");

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay.call(def, p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.some((g) => g.kind === "rect") && g1.some((g) => g.kind === "circle"), "overlay: margin rect + plane circles (" + g1.length + ")");
  let threw = false;
  try { def.overlay.call({}, p0, { W: 4, H: 4 }, undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay survives degenerate input and broken this-binding");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
