/* Validator for the Dice Pips node.
   Run from the repo root: node tools/validate-dice_pips.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "dice_pips";
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
const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((t) => Number.isFinite(t[0]) && Number.isFinite(t[1])));
const bbox = (r) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of r.paths) for (const [x, y] of q.pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
};

const p0 = defaults();
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const inb = (r, W, Hh, t) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -(t || 1) && x <= W + (t || 1) && y >= -(t || 1) && y <= Hh + (t || 1)));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");

/* margin is honoured, not just the sheet edge */
const mb = bbox(run({ ...p0, margin: 40 }));
ok(mb.x0 >= 39.5 && mb.y0 >= 39.5 && mb.x1 <= 257.5 && mb.y1 <= 170.5, "40 mm margin respected on both axes");

/* --- param liveness --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ mode: "Single" }, "mode");
diff({ values: "0-9" }, "values");
diff({ columns: 6 }, "columns");
diff({ size: 60 }, "size");
diff({ gap: 24 }, "gap");
diff({ frame: "Circle" }, "frame");
diff({ pipSize: 26 }, "pipSize");
diff({ fill: "Spiral" }, "fill");
diff({ fillPitch: 1.4 }, "fillPitch");
diff({ pen: 6 }, "pen");
diff({ framePen: 4 }, "framePen");
const tight = { ...p0, size: 120, values: "0-9", columns: 5 };
ok(JSON.stringify(run({ ...tight, margin: 40 })) !== JSON.stringify(run({ ...tight, margin: 0 })), "param live: margin (bites via the fit, Sequence is page-centred)");
const single = { ...p0, mode: "Single" };
const sJ = JSON.stringify(run(single));
ok(JSON.stringify(run({ ...single, value: 2 })) !== sJ, "param live: value (Single)");
ok(JSON.stringify(run({ ...single, centerX: 20 })) !== sJ, "param live: centerX (Single)");
ok(JSON.stringify(run({ ...single, centerY: 20 })) !== sJ, "param live: centerY (Single)");
const rr = { ...p0, frame: "Rounded square" };
ok(JSON.stringify(run({ ...rr, roundness: 45 })) !== JSON.stringify(run(rr)), "param live: roundness");

/* --- select options --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- the pips must be countable: Outline fill + no frame means one closed path per pip --- */
const PIPS = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 };
let pipFails = 0;
for (let v = 0; v <= 9; v++) {
  const r = run({ ...p0, mode: "Single", value: v, fill: "Outline", frame: "None" });
  if (r.paths.length !== PIPS[v]) { console.log("FAIL pip count for " + v + ": got " + r.paths.length + " want " + PIPS[v]); pipFails++; }
}
ok(pipFails === 0, "pip count matches the face value for 0-9 (Outline, no frame)");
ok(run({ ...p0, mode: "Single", value: 0, fill: "Outline", frame: "None" }).paths.length === 0, "value 0 draws a blank face");
ok(run({ ...p0, mode: "Single", value: 0, fill: "Outline", frame: "Square" }).paths.length === 1, "value 0 with a frame draws only the frame");

/* pips sit on the standard 3x3 grid and stay inside their own face */
const face = run({ ...p0, mode: "Single", value: 9, fill: "Outline", frame: "Square", size: 60 });
const frameBox = bbox({ paths: face.paths.slice(0, 1) });
const pipBox = bbox({ paths: face.paths.slice(1) });
ok(pipBox.x0 > frameBox.x0 && pipBox.x1 < frameBox.x1 && pipBox.y0 > frameBox.y0 && pipBox.y1 < frameBox.y1, "pips stay inside the frame");
const cxs = [...new Set(face.paths.slice(1).map((q) => Math.round(((Math.min(...q.pts.map((t) => t[0])) + Math.max(...q.pts.map((t) => t[0]))) / 2) * 10) / 10))];
ok(cxs.length === 3, "value 9 uses exactly 3 pip columns (got " + cxs.length + ")");

/* --- sequence parsing --- */
const faces = (vals, extra) => {
  const r = run({ ...p0, mode: "Sequence", values: vals, fill: "Outline", frame: "Square", columns: 9, ...extra });
  return r.paths.filter((q) => q.pts.length === 4).length;
};
ok(faces("1-6") === 6, "'1-6' expands to 6 faces");
ok(faces("0-9") === 10, "'0-9' expands to 10 faces");
ok(faces("6-1") === 6, "'6-1' counts down to 6 faces");
ok(faces("987") === 3, "'987' reads as three separate digits");
ok(faces("") === 6, "empty Values falls back to 1-6");
ok(faces("hello") === 6, "non-numeric Values falls back to 1-6");
ok(finiteAll(run({ ...p0, values: "0-9 0-9 0-9 0-9 0-9 0-9 0-9 0-9 0-9" })), "over-long sequence is capped, still finite");

/* the grid shrinks to fit but never grows past the requested size */
const small = bbox(run({ ...p0, size: 20, values: "1-2", columns: 2 }));
ok(small.x1 - small.x0 <= 2 * 20 + 8 + 0.5, "grid never grows beyond the requested face size");
const huge = run({ ...p0, size: 180, values: "0-9", columns: 5 });
ok(inb(huge, 297, 210), "oversize request shrinks to fit the sheet");

/* --- fill modes --- */
const outl = run({ ...p0, mode: "Single", value: 5, fill: "Outline", frame: "None" });
const ring = run({ ...p0, mode: "Single", value: 5, fill: "Rings", frame: "None" });
const spir = run({ ...p0, mode: "Single", value: 5, fill: "Spiral", frame: "None" });
ok(npts(ring) > npts(outl) * 3, "Rings fill adds ink over Outline");
ok(spir.paths.length === 5, "Spiral fill is one continuous path per pip");
ok(ring.paths.every((q) => q.pts.length >= 2), "Rings fill emits no degenerate paths");
const fine = run({ ...p0, mode: "Single", value: 5, fill: "Rings", fillPitch: 0.15, frame: "None" });
ok(npts(fine) > npts(ring), "finer fill pitch means more ink");

/* --- pens --- */
const twoPen = run({ ...p0, pen: 3, framePen: 8, frame: "Square", mode: "Single", value: 6 });
const ls = [...new Set(twoPen.paths.map((q) => q.layer))].sort((a, b) => a - b);
ok(ls.length === 2 && ls[0] === 3 && ls[1] === 8, "pip pen and frame pen are separate layers");

/* --- degenerate and extreme --- */
ok(finiteAll(run({ ...p0, size: 5, gap: 0, pipSize: 4, margin: 0, fillPitch: 0.15 })), "minimum params produce no NaN");
const ext = run({ ...p0, size: 180, gap: 50, pipSize: 28, fillPitch: 0.15, values: "0-9", columns: 3, fill: "Spiral" });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(finiteAll(run(p0, { W: 30, H: 20 })), "tiny canvas produces no NaN");
ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "margin larger than half the sheet produces no NaN");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
ok(vis(p0).includes("values") && !vis(p0).includes("value"), "showIf: Sequence shows Values, hides Value");
ok(vis(single).includes("value") && !vis(single).includes("values"), "showIf: Single shows Value, hides Values");
ok(!vis({ ...p0, frame: "None" }).includes("framePen"), "showIf: frame pen hidden with no frame");
ok(!vis({ ...p0, fill: "Outline" }).includes("fillPitch"), "showIf: fill pitch hidden for Outline");

/* --- overlay --- */
const g = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
ok(Array.isArray(g) && g.length > 0, "overlay returns guides (" + g.length + ")");
for (const [label, pp] of [["defaults", p0], ["single", single], ["0-9 grid", { ...p0, values: "0-9", columns: 5 }], ["oversize", { ...p0, size: 180 }]]) {
  const gg = def.overlay(pp, { W: 297, H: 210 }, undefined, {}).find((q) => q.kind === "rect");
  const b = bbox(run(pp));
  ok(!!gg && b.x0 >= gg.x - 1 && b.x1 <= gg.x + gg.w + 1 && b.y0 >= gg.y - 1 && b.y1 <= gg.y + gg.h + 1, "overlay contains the ink: " + label);
}
let threw = false;
try { def.overlay(p0, { W: 4, H: 4 }); def.overlay({ ...p0, values: "" }, { W: 297, H: 210 }); } catch (e) { threw = true; }
ok(!threw, "overlay never throws on degenerate input");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
