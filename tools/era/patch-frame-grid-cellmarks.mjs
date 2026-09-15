/* Era patch: Frame Grid gains per-frame close-up marks for high-resolution
 * Kela capture — every frame photographed INDIVIDUALLY, the plotted cell
 * frame rectangle acting as the registration quad.
 *
 * New parameters (defaults keep every existing patch byte-identical,
 * proven below against the pre-patch module):
 *   - Clearance mm (0-10, def 0): the shared canvas->cell scale becomes
 *     min((cw-2c)/W, (ch-2c)/H), guaranteeing at least c mm of ink-free
 *     band between the drawing and the cell frame line in EVERY cell —
 *     registration is preserved because the scale stays shared.
 *   - Corner dots (Off/On, def Off): a 3 mm circle OUTSIDE each cell's
 *     top-left corner (center exactly 2.5 mm up-left of the corner, radius
 *     1.5 mm, marker pen) — the per-frame orientation anchor. Dots that
 *     would leave the canvas are skipped.
 *
 * Also updates tools/validate-frame_grid.mjs with oracles for both.
 *
 * Run from the repo root: node tools/era/patch-frame-grid-cellmarks.mjs
 * Reports OK / MISS / SKIP per edit; snapshots the CURRENT node's output on
 * a param sweep BEFORE editing and requires a byte-identical match after.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FILE = resolve("src/defs/nodes/frame_grid.js");
const VAL = resolve("tools/validate-frame_grid.mjs");
let src = readFileSync(FILE, "utf8");

if (src.includes('"cellmarks"')) {
  console.log("SKIP  frame_grid.js already carries the close-up marks");
  process.exit(0);
}

/* ---- pre-patch snapshot ---- */
const CTX = { W: 420, H: 297, frameIdx: 0, frameCount: 2 };
const F = { paths: [
  { pts: [[0, 0], [420, 297]], closed: false, layer: 5 },
  { pts: [[60, 40], [360, 40], [360, 260], [60, 260]], closed: true, layer: 2 },
] };
const defsOf = (d) => { const p = {}; for (const q of d.params) p[q.key] = q.def; return p; };
const SWEEP = (d) => {
  const p0 = defsOf(d);
  return [
    d.compute.call(d, [F], { ...p0, total: 14 }, CTX, {}),
    d.compute.call(d, [F], { ...p0, total: 14 }, { ...CTX, frameIdx: 1 }, {}),
    d.compute.call(d, [F, F, F], { ...p0, fill: "Inputs", count: 3, numbers: "On", cellFrames: "On", labelText: "T" }, CTX, {}),
    d.compute.call(d, [F], { ...p0, fill: "Clock", chrome: "First frame only" }, { ...CTX, frameIdx: 2 }, {}),
    d.compute.call(d, [F], { ...p0, layout: "Custom", cols: 5, rows: 2, scale: "Fit each", margin: 12, gap: 3 }, CTX, {}),
  ].map((r) => JSON.stringify(r));
};
const before = SWEEP((await import(pathToFileURL(FILE).href + "?pre=" + Date.now())).default);

let miss = 0;
const edit = (anchor, replacement, label) => {
  const parts = src.split(anchor);
  if (parts.length !== 2) {
    console.log("MISS  " + label + " (" + (parts.length - 1) + " hits, need exactly 1)");
    miss++;
    return;
  }
  src = parts[0] + replacement + parts[1];
  console.log("OK    " + label);
};

edit(
  "Canvas maps into every cell with one shared scale so frames stay registered.\",",
  "Canvas maps into every cell with one shared scale so frames stay registered. For per-frame close-up capture, Clearance mm keeps an ink-free band between the drawing and the cell frame line (the shared scale shrinks, registration holds) and Corner dots plots a 3 mm orientation circle outside each cell's top-left corner - the cell frame rectangle becomes the registration quad, the dot the rotation anchor.\",",
  "desc: close-up capture sentence"
);

edit(
  '{ key: "cellFrames", label: "Cell frames", type: "select", options: ["Off", "On"], def: "Off" },',
  '{ key: "cellFrames", label: "Cell frames", type: "select", options: ["Off", "On"], def: "Off" },\n' +
  '    { key: "inset", label: "Clearance mm", type: "slider", min: 0, max: 10, step: 0.5, def: 0 },\n' +
  '    { key: "cellmarks", label: "Corner dots", type: "select", options: ["Off", "On"], def: "Off" },',
  "params: Clearance mm + Corner dots"
);

edit(
  "const s = cw > 1 && ch > 1 ? Math.min(cw / W, ch / H) : 0;",
  "const ins2 = Math.max(0, Math.min(10, Number(p.inset) || 0));\n" +
  "    const aw = cw - 2 * ins2, ah = ch - 2 * ins2;\n" +
  "    const s = aw > 1 && ah > 1 ? Math.min(aw / W, ah / H) : 0;",
  "layout: clearance-aware shared scale"
);

edit(
  "return { W, H, cols, rows, cw, ch, cells, markers, ms, s };",
  "return { W, H, cols, rows, cw, ch, cells, markers, ms, s, ins: ins2 };",
  "layout: expose ins"
);

edit(
  "s = Math.min(q.w / bw, q.h / bh);",
  "s = Math.min(Math.max(1e-6, q.w - 2 * L.ins) / bw, Math.max(1e-6, q.h - 2 * L.ins) / bh);",
  "compute: Fit each honours clearance"
);

edit(
  "    if (chromeOn && p.numbers === \"On\") {",
  "    if (chromeOn && p.cellmarks === \"On\") {\n" +
  "      /* per-frame orientation dot: a 3 mm circle outside each cell's\n" +
  "         top-left corner - in close-up capture the cell frame rectangle is\n" +
  "         the registration quad and this dot is the rotation anchor */\n" +
  "      for (const q of L.cells) {\n" +
  "        const cx = q.x - 2.5, cy = q.y - 2.5, r = 1.5;\n" +
  "        if (cx - r < 0 || cy - r < 0) continue;\n" +
  "        const ring = [];\n" +
  "        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }\n" +
  "        push(ring, true, pen);\n" +
  "      }\n" +
  "    }\n\n" +
  "    if (chromeOn && p.numbers === \"On\") {",
  "compute: corner dots block (chrome-first)"
);

edit(
  'for (const q of L.cells) g.push({ kind: "rect", x: q.x, y: q.y, w: q.w, h: q.h });',
  'for (const q of L.cells) g.push({ kind: "rect", x: q.x, y: q.y, w: q.w, h: q.h });\n' +
  '      if (p.cellmarks === "On") for (const q of L.cells) g.push({ kind: "circle", cx: q.x - 2.5, cy: q.y - 2.5, r: 1.5 });',
  "overlay: dot guides"
);

if (miss) {
  console.log("ABORT " + miss + " missed anchor(s) - nothing written");
  process.exit(1);
}
writeFileSync(FILE, src);

/* ---- post-patch checks ---- */
let bad = 0;
const chk = (cond, msg) => { console.log((cond ? "OK    " : "FAIL  ") + msg); if (!cond) bad++; };
const def = (await import(pathToFileURL(FILE).href + "?post=" + Date.now())).default;
const after = SWEEP(def);
chk(after.length === before.length && after.every((s2, i) => s2 === before[i]),
  "old patches byte-identical across " + before.length + " param sets");

const p0 = defsOf(def);
/* clearance oracle: min window-to-cell-edge distance >= inset */
const clr = (inset) => {
  const r = def.compute.call(def, [F], { ...p0, fill: "Inputs", count: 3, inset }, CTX, {});
  const L = def._layout.call(def, { ...p0, fill: "Inputs", inset }, CTX);
  return Math.min((L.cw - 420 * L.s) / 2, (L.ch - 297 * L.s) / 2) + (r.paths.length ? 0 : NaN);
};
chk(clr(0) >= -1e-9 && clr(3) >= 3 - 1e-9 && clr(8) >= 8 - 1e-9,
  "Clearance guarantees the ink-free band (0/3/8 mm)");
chk(def._layout.call(def, { ...p0, inset: 3 }, CTX).s < def._layout.call(def, { ...p0, inset: 0 }, CTX).s,
  "clearance shrinks the shared scale");

/* corner dots oracle */
const rD = def.compute.call(def, [F], { ...p0, fill: "Inputs", count: 3, cellmarks: "On", penMark: 4 }, CTX, {});
const rN = def.compute.call(def, [F], { ...p0, fill: "Inputs", count: 3, penMark: 4 }, CTX, {});
const dots = rD.paths.filter((q) => q.closed && q.pts.length === 16);
const L0 = def._layout.call(def, { ...p0, fill: "Inputs" }, CTX);
chk(dots.length === L0.cells.length, "one dot per cell (" + dots.length + ")");
chk(dots.every((q, i) => {
  const mx = q.pts.reduce((a, pt) => a + pt[0], 0) / 16, my = q.pts.reduce((a, pt) => a + pt[1], 0) / 16;
  return L0.cells.some((c) => Math.abs(mx - (c.x - 2.5)) < 1e-6 && Math.abs(my - (c.y - 2.5)) < 1e-6);
}), "dot centers exactly 2.5 mm up-left of cell corners");
chk(dots.every((q) => q.layer === 4), "dots ride the marker pen");
chk(rD.paths.length === rN.paths.length + dots.length, "dots only add ink");
const g = def.overlay.call(def, { ...p0, cellmarks: "On" }, CTX);
chk(g.filter((q) => q.kind === "circle" && q.r === 1.5).length === L0.cells.length, "overlay shows the dot guides");
const rTight = def.compute.call(def, [F], { ...p0, fill: "Inputs", count: 3, cellmarks: "On", margin: 2 }, CTX, {});
chk(rTight.paths.every((q) => q.pts.every(([x, y]) => x >= 0 && y >= 0)), "dots that would leave the canvas are skipped");

console.log(bad === 0 ? "DONE  frame_grid.js patched, old output proven byte-identical" : "DONE WITH " + bad + " FAILURES");
if (bad) process.exit(1);

/* ---- extend the validator ---- */
let val = readFileSync(VAL, "utf8");
if (val.includes("cellmarks")) {
  console.log("SKIP  validator already extended");
  process.exit(0);
}
const VANCHOR = 'console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");';
const VTESTS =
"/* --- close-up capture marks --- */\n" +
"{\n" +
"  const pi3 = { ...p0, inset: 3 };\n" +
"  const L3 = def._layout.call(def, pi3, CTX), Lz = def._layout.call(def, p0, CTX);\n" +
"  ok(L3.s < Lz.s && Math.min((L3.cw - 420 * L3.s) / 2, (L3.ch - 297 * L3.s) / 2) >= 3 - 1e-9,\n" +
"    \"Clearance mm: shared scale shrinks, >= 3 mm band in every cell\");\n" +
"  const rD = run({ ...p0, cellmarks: \"On\" }, wired6);\n" +
"  const dots = rD.paths.filter((q) => q.closed && q.pts.length === 16);\n" +
"  ok(dots.length === Lz.cells.length && dots.every((q) => q.layer === p0.penMark),\n" +
"    \"Corner dots: one 3 mm ring per cell on the marker pen\");\n" +
"  ok(JSON.stringify(run({ ...p0, inset: 0, cellmarks: \"Off\" }, wired6)) === JSON.stringify(run(p0, wired6)),\n" +
"    \"defaults unchanged: inset 0 + dots Off is the original output\");\n" +
"}\n\n";
const vp = val.split(VANCHOR);
if (vp.length !== 2) {
  console.log("MISS  validator anchor - node patched OK, extend the validator manually");
  process.exit(1);
}
writeFileSync(VAL, vp[0] + VTESTS + VANCHOR + vp[1]);
console.log("OK    validator extended with close-up mark oracles");
