/* Validator for the Scaffolding node. Run from the repo root:
   node tools/validate-scaffolding.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "scaffolding";

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
const run = (p, ctx, node) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, node || {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
};

const p0 = defaults();

/* --- static shape --- */
ok(def.cat === "gen" && def.group === "structural", "cat gen / group structural");
ok(typeof def.desc === "string" && def.desc.length > 80, "desc present");
ok(def.params.some((q) => q.type === "seed"), "has a seed param");
ok(def.params.filter((q) => q.type === "pen").length === 2, "two pen params");

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");

const tol = 1.0;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "inside margin box on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "inside margin box on A4 tall");
const bb = bbox(r1);
ok((bb.x1 - bb.x0) > 0.8 * (297 - 2 * p0.margin) || (bb.y1 - bb.y0) > 0.8 * (210 - 2 * p0.margin), "fit fills the margin box in at least one axis");

/* --- pens land where declared --- */
const layers = new Set(r1.paths.map((q) => q.layer));
ok(layers.has(p0.pen) && layers.has(p0.deckPen) && layers.size === 2, "exactly the tube pen and the deck pen are used (" + [...layers].join(",") + ")");
ok(r1.paths.some((q) => q.layer === p0.deckPen && q.closed && q.pts.length === 4), "deck boards are closed 4-point rectangles");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ bays: 4 }, "bays");
diff({ lifts: 3 }, "lifts");
diff({ rows: 1 }, "rows");
diff({ liftR: 1.2 }, "liftR");
diff({ depthR: 0.6 }, "depthR");
diff({ shape: "Full" }, "shape");
diff({ vary: 0.8 }, "vary");
diff({ braces: "None" }, "braces");
diff({ decks: "Top" }, "decks");
diff({ boards: 5 }, "boards");
diff({ rails: false }, "rails");
diff({ couplers: false }, "couplers");
diff({ tube: "Line" }, "tube");
diff({ tubeW: 2.0 }, "tubeW");
diff({ yaw: -20 }, "yaw");
diff({ pitch: 40 }, "pitch");
diff({ persp: 0 }, "persp");
diff({ margin: 30 }, "margin");
diff({ seed: 8 }, "seed");
diff({ pen: 3 }, "pen");
diff({ deckPen: 5 }, "deckPen");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- node-specific oracles --- */
/* Line mode: tubes are single 2-pt open paths; Double mode has more tube-pen paths */
const rLine = run({ ...p0, tube: "Line", couplers: false, decks: "None" });
const rDbl = run({ ...p0, tube: "Double", couplers: false, decks: "None" });
ok(rLine.paths.filter((q) => !q.closed).every((q) => q.pts.length === 2), "Line mode: every open path is a 2-point segment");
const openLine = rLine.paths.filter((q) => !q.closed).length, openDbl = rDbl.paths.filter((q) => !q.closed).length;
ok(openDbl === 2 * openLine, "Double mode emits exactly 2x the open segments of Line mode (" + openLine + " -> " + openDbl + ")");
/* Double mode: the two lines of a standard sit tubeW apart */
{
  const pd = { ...p0, tube: "Double", couplers: false, decks: "None", braces: "None", rows: 1, bays: 1, lifts: 1, shape: "Full" };
  const r = run(pd);
  const opens = r.paths.filter((q) => !q.closed);
  const a = opens[0].pts, b = opens[1].pts;
  const d = Math.hypot(a[0][0] - b[1][0], a[0][1] - b[1][1]);
  ok(Math.abs(d - pd.tubeW) < 1e-6, "Double mode: the two lines of one tube are tubeW apart (" + d.toFixed(4) + ")");
}
/* Shape Full: no column shorter than lifts -> every standard reaches the same top (Line, no extras) */
{
  const pf = { ...p0, shape: "Full", tube: "Line", couplers: false, decks: "None", braces: "None", rows: 1, pitch: 0, persp: 0, yaw: 0 };
  const r = run(pf);
  const stds = r.paths.filter((q) => !q.closed && Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6);
  const tops = stds.map((q) => Math.min(q.pts[0][1], q.pts[1][1]));
  ok(stds.length === pf.bays + 1, "Full/front view: one vertical standard per column (" + stds.length + ")");
  ok(Math.max(...tops) - Math.min(...tops) < 1e-6, "Full: all standards share one top height");
  /* Ragged at vary=1 must produce differing tops */
  const rr = run({ ...pf, shape: "Ragged", vary: 1 });
  const tops2 = rr.paths.filter((q) => !q.closed && Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6).map((q) => Math.min(q.pts[0][1], q.pts[1][1]));
  ok(Math.max(...tops2) - Math.min(...tops2) > 1, "Ragged vary=1: standards differ in height");
  /* Stairs: heights rise monotonically left to right */
  const rs = run({ ...pf, shape: "Stairs", vary: 1, bays: 8, lifts: 8 });
  const cols = rs.paths.filter((q) => !q.closed && Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6)
    .map((q) => [q.pts[0][0], Math.min(q.pts[0][1], q.pts[1][1])]).sort((u, v) => u[0] - v[0]);
  ok(cols.every((c, i) => i === 0 || c[1] <= cols[i - 1][1] + 1e-6), "Stairs: tops never drop going right");
}
/* decks: None removes every deck-pen path; rows=1 has no decks even when requested */
ok(run({ ...p0, decks: "None" }).paths.every((q) => q.layer !== p0.deckPen), "decks None: no deck-pen paths");
ok(run({ ...p0, rows: 1 }).paths.every((q) => q.layer !== p0.deckPen), "rows=1: no deck-pen paths (nothing to stand on)");
/* Top vs Every lift: Every lift has at least as many boards */
const nDeck = (r) => r.paths.filter((q) => q.layer === p0.deckPen).length;
ok(nDeck(run({ ...p0, decks: "Every lift" })) > nDeck(run({ ...p0, decks: "Top" })), "Every lift has more boards than Top");
/* seed changes Ragged heights but not Full */
ok(JSON.stringify(run({ ...p0, shape: "Full", braces: "Zigzag", decks: "None", seed: 1 })) ===
   JSON.stringify(run({ ...p0, shape: "Full", braces: "Zigzag", decks: "None", seed: 2 })), "Full + Zigzag + no decks: seed has no effect");
ok(JSON.stringify(run({ ...p0, braces: "Random", seed: 1 })) !== JSON.stringify(run({ ...p0, braces: "Random", seed: 2 })), "Random braces: seed changes output");

/* --- degenerate and extreme values --- */
const rd = run({ ...p0, bays: 1, lifts: 1, rows: 1, liftR: 0.4, depthR: 0.15, vary: 0, tubeW: 0.4, pitch: 0, persp: 0, margin: 0, boards: 2 });
ok(finiteAll(rd) && rd.paths.length > 0, "degenerate params produce finite non-empty output");
const ext = run({ ...p0, bays: 14, lifts: 12, rows: 3, boards: 6, braces: "Lattice", decks: "Every lift", vary: 1, tubeW: 3, pitch: 60, persp: 1, margin: 40 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(inb(ext, 297, 210, 40), "extreme params stay inside their margin box");
const wild = run({ ...p0, bays: 200, lifts: 200, rows: 9, boards: 40, yaw: 999, pitch: -500, persp: 50, margin: -5, tubeW: -1, seed: -3.7 });
ok(finiteAll(wild) && npts(wild) <= 120000, "wired-out-of-range values: finite + budget held (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, { W: 4, H: 4 })), "tiny canvas: finite");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis(p0).includes("vary") && !vis({ ...p0, shape: "Full" }).includes("vary"), "showIf: vary hidden only for Full");
ok(vis(p0).includes("boards") && !vis({ ...p0, decks: "None" }).includes("boards"), "showIf: boards hidden when decks None");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "rect", "overlay returns one rect guide");
  ok(g1[0].x === p0.margin && g1[0].w === 297 - 2 * p0.margin, "overlay rect matches the margin");
  let threw = false;
  try { def.overlay({ ...p0, margin: 999 }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

/* --- style passthrough --- */
{
  const r = def.compute([undefined], p0, { W: 297, H: 210 }, {});
  ok(r && Array.isArray(r.paths), "returns a path set with undefined style");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
