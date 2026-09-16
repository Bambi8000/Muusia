/* Validator for the Whale node. Run from the repo root: node tools/validate-whale.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "whale";

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
const CTX = { W: 297, H: 210 };
const runAll = (p, ctx, ins) => def.compute(ins || [undefined, undefined], p, ctx || CTX, {});
const run = (p, ctx, ins) => runAll(p, ctx, ins)[0];
const bodies = (p, ctx, ins) => runAll(p, ctx, ins)[1];
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
const inb = (r, W, Hh, m, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - tol && x <= W - m + tol && y >= m - tol && y <= Hh - m + tol));

const p0 = { ...defaults(), species: "Generic" };   /* Generic for count checks; Mixed includes the 9-body octopus */
const pM = defaults();

/* --- definition shape --- */
ok(def.cat === "gen" && def.group === "creatures", "definition: gen/creatures");
ok(typeof def.desc === "string" && def.desc.length > 200, "definition: desc present");
ok(Array.isArray(def.ins) && def.ins.length === 2 && def.ins[0].type === "style" && def.ins[1].type === "paths", "pins: Style + Spine inputs");
ok(Array.isArray(def.outs) && def.outs.length === 2, "pins: two outputs (Lines, Bodies)");
ok(def.params.every((q) => /^[a-z][a-z0-9]*$/i.test(q.key)) && new Set(def.params.map((q) => q.key)).size === def.params.length, "params: unique keys");
ok(def.params.some((q) => q.type === "seed") && def.params.some((q) => q.type === "pen"), "params: seed and pen present");

/* --- universal invariants at defaults --- */
const a1 = runAll(p0), a2 = runAll(p0);
ok(Array.isArray(a1) && a1.length === 2, "compute returns two path sets");
const r1 = a1[0], b1 = a1[1];
ok(JSON.stringify(a1) === JSON.stringify(a2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1) && finiteAll(b1), "all coordinates finite (both outputs)");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
ok(inb(r1, 297, 210, p0.margin, 1.0), "in bounds inside margin on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin, 1.0), "in bounds inside margin on A4 tall");

/* --- bodies output --- */
const nFishDefault = p0.count * p0.rows;
ok(b1.paths.length === nFishDefault, "bodies: one closed silhouette per creature (" + b1.paths.length + " = " + nFishDefault + ")");
ok(b1.paths.every((q) => q.closed && q.pts.length > 20), "bodies: all closed, substantial");
const bbL = bbox(r1), bbB = bbox(b1);
ok(bbB.x0 >= bbL.x0 - 0.01 && bbB.x1 <= bbL.x1 + 0.01 && bbB.y0 >= bbL.y0 - 0.01 && bbB.y1 <= bbL.y1 + 0.01, "bodies: lie within the lines' extent");
ok(b1.paths.every((q) => Math.abs(H.signedArea(q.pts)) > 20), "bodies: real area (no degenerate silhouettes)");

/* --- point count / per creature sanity --- */
const oneD = run({ ...p0, style: "Detailed", count: 1, rows: 1, spout: false, species: "Humpback" });
const oneS = run({ ...p0, style: "Simple", count: 1, rows: 1, spout: false });
ok(npts(oneD) > npts(oneS) * 1.2 && oneD.paths.length > oneS.paths.length, "Detailed draws more than Simple (" + npts(oneD) + " vs " + npts(oneS) + " pts, " + oneD.paths.length + " vs " + oneS.paths.length + " paths)");
ok(oneS.paths.length >= 3 && oneS.paths.length <= 40, "Simple whale is a handful of strokes (" + oneS.paths.length + ")");

/* --- every parameter must do something --- */
const J = (p, ins) => JSON.stringify(run(p, undefined, ins));
const baseJ = J(p0);
const diff = (patch, label, base, ins) => ok(J({ ...(base || p0), ...patch }, ins) !== (base ? J(base, ins) : baseJ), "param live: " + label);
diff({ style: "Simple" }, "style");
diff({ species: "Orca" }, "species (Detailed)");
diff({ layout: "School" }, "layout");
diff({ count: 5 }, "count");
diff({ rows: 2 }, "rows");
const pS = { ...p0, layout: "Spine" };
diff({ space: 30 }, "space (Spine)", pS);
diff({ mount: "Left" }, "mount (Spine)", pS);
diff({ size: 20 }, "size");
diff({ vary: 0.9 }, "vary");
diff({ facing: "Left" }, "facing");
const pC = { ...p0, layout: "School" };
diff({ heading: 40 }, "heading (School)", pC);
diff({ turn: 60 }, "turn (School)", pC);
diff({ detail: 10 }, "detail");
diff({ texture: false }, "texture (Detailed)");
diff({ mouth: "Open" }, "mouth");
diff({ spout: false }, "spout");
diff({ wobble: 0 }, "wobble");
diff({ jitter: 90 }, "jitter (Rows)");
diff({ margin: 30 }, "margin");
diff({ seed: 99 }, "seed");
diff({ layer: 3 }, "layer");
ok(run({ ...p0, layer: 3 }).paths.every((q) => q.layer === 3), "layer applies to every path");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const base = pd.key === "mount" || pd.key === "space" ? pS : pd.key === "species" ? { ...p0, style: "Detailed" } : p0;
    const r = run({ ...base, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}
for (const sp of def.params.find((q) => q.key === "species").options) {
  if (sp === "Octopus" || sp === "Mixed") continue;
  const r = run({ ...p0, style: "Detailed", species: sp, count: 1, rows: 1, wobble: 0, spout: false });
  const bb = bbox(r);
  ok(bb.w > 20 && bb.h > 5 && bb.h < bb.w, "species '" + sp + "' is longer than tall (" + bb.w.toFixed(1) + " x " + bb.h.toFixed(1) + ")");
}
{
  const po = { ...p0, species: "Octopus", count: 1, rows: 1, wobble: 0 };
  const [lo, bo] = runAll({ ...po, style: "Detailed" });
  ok(bo.paths.length === 9 && bo.paths.every((q) => q.closed), "Octopus Detailed: mantle + eight arms as closed bodies (" + bo.paths.length + ")");
  ok(lo.paths.length > 9 && finiteAll(lo), "Octopus Detailed: draws (" + lo.paths.length + " paths)");
  const [ls, bs] = runAll({ ...po, style: "Simple" });
  ok(bs.paths.length === 1 && ls.paths.length >= 8, "Octopus Simple: one head body, arms as open strokes (" + ls.paths.length + " paths)");
  const bbo = bbox(lo);
  ok(bbo.w > 20 && bbo.h > 20, "Octopus has real extent (" + bbo.w.toFixed(1) + " x " + bbo.h.toFixed(1) + ")");
  const mixed = runAll({ ...pM, count: 6, rows: 4 });
  ok(mixed[1].paths.length >= 24 && finiteAll(mixed[0]) && finiteAll(mixed[1]), "species Mixed rolls species per creature, bodies >= creatures (" + mixed[1].paths.length + ")");
  const spines = new Set(); for (let i = 0; i < 40; i++) { const b = runAll({ ...pM, count: 1, rows: 1, seed: i })[1].paths.length; spines.add(b); }
  ok(spines.has(1) && spines.has(9), "species Mixed actually produces both whales and octopuses across seeds");
}

/* --- facing: Left is an exact mirror of Right --- */
{
  const pr = { ...p0, count: 1, rows: 1, jitter: 0, wobble: 0, style: "Detailed", species: "Orca" };
  const R = run(pr), Lf = run({ ...pr, facing: "Left" });
  const bR = bbox(R), bL = bbox(Lf);
  ok(Math.abs(bR.w - bL.w) < 0.01 && Math.abs(bR.h - bL.h) < 0.01, "facing Left keeps the same extent");
  const cx = (bR.x0 + bR.x1 + bL.x0 + bL.x1) / 4;
  const mirrored = new Set(R.paths.flatMap((q) => q.pts.map(([x, y]) => (2 * cx - x).toFixed(3) + "," + y.toFixed(3))));
  const hit = Lf.paths.flatMap((q) => q.pts).filter(([x, y]) => mirrored.has(x.toFixed(3) + "," + y.toFixed(3))).length;
  const tot = Lf.paths.reduce((a, q) => a + q.pts.length, 0);
  ok(hit / tot > 0.98, "facing Left is a point-for-point mirror (" + hit + "/" + tot + ")");
}

/* --- shrink only: a small creature in a huge cell never grows --- */
{
  const r = run({ ...p0, count: 1, rows: 1, size: 12, wobble: 0, style: "Detailed", species: "Generic", spout: false, jitter: 0 });
  const bb = bbox(r);
  ok(bb.w <= 12 * 1.05 && bb.w > 9, "shrink only: size 12 stays about 12 mm long in a full sheet (" + bb.w.toFixed(1) + ")");
  const big = run({ ...p0, count: 6, rows: 4, size: 200, wobble: 0 });
  ok(inb(big, 297, 210, p0.margin, 1.0), "shrink only: size 200 in a 6x4 grid is fitted into the cells");
  const bigB = bodies({ ...p0, count: 6, rows: 4, size: 200, wobble: 0 });
  ok(bigB.paths.length === 24 && inb(bigB, 297, 210, p0.margin, 1.0), "bodies follow the same fit");
}

/* --- rows grid: creature sit in distinct cells --- */
{
  const r = bodies({ ...p0, count: 4, rows: 2, jitter: 0, vary: 0 });
  const cxs = r.paths.map((q) => q.pts.reduce((a, pt) => a + pt[0], 0) / q.pts.length);
  const cys = r.paths.map((q) => q.pts.reduce((a, pt) => a + pt[1], 0) / q.pts.length);
  ok(new Set(cxs.map((v) => Math.round(v / 10))).size >= 4 && new Set(cys.map((v) => Math.round(v / 10))).size >= 2, "Rows: 4x2 grid occupies 4 columns and 2 rows");
}

/* --- school --- */
{
  const ps = { ...p0, layout: "School", count: 12, wobble: 0 };
  const r = run(ps), b = bodies(ps);
  ok(b.paths.length === 12, "School: 12 creature placed (" + b.paths.length + ")");
  ok(inb(r, 297, 210, p0.margin, 1.0) && inb(run(ps, { W: 210, H: 297 }), 210, 297, p0.margin, 1.0), "School: in bounds on both orientations");
  const dense = bodies({ ...ps, count: 60, size: 60 });
  ok(dense.paths.length === 60 && inb(dense, 297, 210, p0.margin, 1.0), "School: 60 large creature still all placed and in bounds");
  const cent = (q) => [q.pts.reduce((a, pt) => a + pt[0], 0) / q.pts.length, q.pts.reduce((a, pt) => a + pt[1], 0) / q.pts.length];
  const cs = b.paths.map(cent);
  let minD = 1e9;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) minD = Math.min(minD, Math.hypot(cs[i][0] - cs[j][0], cs[i][1] - cs[j][1]));
  ok(minD > 8, "School: creature centres are spread out (min distance " + minD.toFixed(1) + " mm)");
  const h0 = bbox(run({ ...ps, count: 1, heading: 0, turn: 0 })), h90 = bbox(run({ ...ps, count: 1, heading: 90, turn: 0 }));
  ok(h90.h > h90.w && h0.w > h0.h, "School: heading 90 turns the creature upright");
}

/* --- spine --- */
{
  const line = { paths: [{ pts: [[20, 40], [280, 40]], closed: false, layer: 0 }] };
  const ins = [undefined, line];
  const pw = { ...p0, layout: "Spine", space: 40, size: 30, vary: 0, wobble: 0 };
  const b = bodies(pw, undefined, ins);
  const expect = H.resample(line.paths[0].pts, false, 40).length;
  ok(b.paths.length === expect, "Spine: one creature per resampled point (" + b.paths.length + " = " + expect + ")");
  const unw = bodies(pw);
  ok(unw.paths.length > 1 && inb(run(pw), 297, 210, 0, 1.0), "Spine unwired: default line draws creature inside the sheet (" + unw.paths.length + ")");
  const cy = (bb) => (bb.y0 + bb.y1) / 2;
  const on = bbox(bodies({ ...pw, mount: "On path" }, undefined, ins));
  const left = bbox(bodies({ ...pw, mount: "Left" }, undefined, ins));
  const right = bbox(bodies({ ...pw, mount: "Right" }, undefined, ins));
  ok(Math.abs(cy(on) - 40) < 1.5, "Spine On path: creature centred on the line (y " + cy(on).toFixed(1) + ")");
  ok(cy(left) > 40 + 3 && cy(right) < 40 - 3, "Spine Left/Right sit on opposite sides, Fur convention (Left below a left-to-right line)");
  const alt = bodies({ ...pw, mount: "Both (alternate)" }, undefined, ins);
  const sides = alt.paths.map((q) => Math.sign(q.pts.reduce((a, pt) => a + pt[1], 0) / q.pts.length - 40));
  ok(sides.some((s) => s > 0) && sides.some((s) => s < 0) && sides.every((s, i) => i === 0 || s !== sides[i - 1]), "Spine Both (alternate) alternates sides");
  const rnd = bodies({ ...pw, mount: "Both (random)" }, undefined, ins);
  const sidesR = rnd.paths.map((q) => Math.sign(q.pts.reduce((a, pt) => a + pt[1], 0) / q.pts.length - 40));
  ok(sidesR.some((s) => s > 0) && sidesR.some((s) => s < 0), "Spine Both (random) uses both sides");
  /* travel direction: a right-to-left line flips the creature */
  const back = { paths: [{ pts: [[280, 40], [20, 40]], closed: false, layer: 0 }] };
  const pd = { ...pw, space: 100, spout: false };
  const f1 = bodies(pd, undefined, ins).paths[0], f2 = bodies(pd, undefined, [undefined, back]).paths[0];
  const bx = (q) => { const b = bbox({ paths: [q] }); return (b.x0 + b.x1) / 2; };
  ok(f1 && f2 && Math.abs(bx(f1) - 20) < 2.5 && Math.abs(bx(f2) - 280) < 2.5, "Spine: creature are centred on the sample points (" + bx(f1).toFixed(1) + ", " + bx(f2).toFixed(1) + ")");
  /* the narwhal's tusk reaches far ahead of the body: the long side of the bbox around the body centroid is the nose side */
  const pdd = { ...pd, style: "Detailed", species: "Narwhal", texture: false };
  const dirOf = (insX) => { const [ln, bd] = runAll(pdd, undefined, insX); const b = bd.paths[0]; const cx = b.pts.reduce((a, pt) => a + pt[0], 0) / b.pts.length; const bb = bbox(ln); return (bb.x1 - cx) - (cx - bb.x0); };
  ok(dirOf(ins) > 5 && dirOf([undefined, back]) < -5, "Spine: creatures face the path's travel direction (tusk points along travel)");
  const vert = { paths: [{ pts: [[100, 20], [100, 190]], closed: false, layer: 0 }] };
  const bv = bbox(bodies({ ...pw, space: 500 }, undefined, [undefined, vert]));
  ok(bv.h > bv.w, "Spine: a vertical line stands the creature on end");
  const circ = { paths: [{ pts: Array.from({ length: 64 }, (_, i) => [150 + Math.cos(i / 64 * Math.PI * 2) * 60, 105 + Math.sin(i / 64 * Math.PI * 2) * 60]), closed: true, layer: 0 }] };
  const rc = run(pw, undefined, [undefined, circ]);
  ok(rc.paths.length > 0 && finiteAll(rc), "Spine: closed path hosts creature");
  const empty = run(pw, undefined, [undefined, { paths: [] }]);
  ok(empty.paths.length > 0, "Spine: EMPTY input falls back to the default line");
  const dot = run(pw, undefined, [undefined, { paths: [{ pts: [[50, 50]], closed: false, layer: 0 }] }]);
  ok(finiteAll(dot), "Spine: single-point path does not throw");
}

/* --- style Mixed rolls both --- */
{
  const r = runAll({ ...p0, style: "Mixed", count: 10, rows: 3, wobble: 0 });
  const S = run({ ...p0, style: "Simple", count: 10, rows: 3, wobble: 0 }), D = run({ ...p0, style: "Detailed", count: 10, rows: 3, wobble: 0 });
  ok(npts(r[0]) > npts(S) * 1.15 && npts(r[0]) < npts(D) * 0.9, "style Mixed lands between Simple and Detailed (" + npts(S) + " < " + npts(r[0]) + " < " + npts(D) + ")");
}

/* --- wobble --- */
{
  const pw = { ...p0, style: "Simple", count: 1, rows: 1 };
  const w0 = run({ ...pw, wobble: 0 }), w100 = run({ ...pw, wobble: 100 });
  ok(npts(w100) > npts(w0), "wobble densifies the strokes (" + npts(w0) + " -> " + npts(w100) + ")");
  const bb0 = bbox(w0), bb1 = bbox(w100);
  ok(Math.abs(bb0.w - bb1.w) < bb0.w * 0.12, "wobble 100 does not blow up the size (" + bb0.w.toFixed(1) + " vs " + bb1.w.toFixed(1) + ")");
  ok(w100.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]))), "wobble 100 finite");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, count: 0, rows: 0, size: 0, detail: 0, wobble: 0, margin: 0, vary: 0 })), "degenerate params produce no NaN");
ok(finiteAll(run({ ...p0, count: -5, rows: -2, size: -10, detail: -50, wobble: -20, margin: -5, jitter: -100 })), "negative wired values produce no NaN");
ok(finiteAll(run({ ...p0, margin: 200 })), "margin larger than the sheet does not throw");
ok(finiteAll(run(p0, { W: 30, H: 20 })), "tiny sheet does not throw");
const ext = runAll({ ...p0, count: 60, rows: 12, detail: 100, texture: true, style: "Detailed", size: 200, wobble: 100 });
ok(finiteAll(ext[0]) && npts(ext[0]) <= 120000, "extreme params: finite + budget held (" + npts(ext[0]) + " pts)");
ok(ext[1].paths.length === 720, "extreme params: every body still drawn before decoration is cut (" + ext[1].paths.length + ")");
const extS = runAll({ ...p0, layout: "School", count: 60, detail: 100, size: 200, wobble: 100 });
ok(finiteAll(extS[0]) && npts(extS[0]) <= 120000 && extS[1].paths.length === 60, "extreme School: finite, budget, all placed");
const dense = runAll({ ...p0, layout: "Spine", space: 5, size: 200, detail: 100 }, undefined, [undefined, { paths: [{ pts: [[0, 0], [297, 210], [0, 210], [297, 0]], closed: true, layer: 0 }] }]);
ok(finiteAll(dense[0]) && npts(dense[0]) <= 120000, "dense Spine: budget held (" + npts(dense[0]) + " pts)");

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
  const vS = vis({ ...p0, style: "Simple" }), vD = vis({ ...p0, style: "Detailed" });
  ok(!vS.includes("texture") && vD.includes("texture") && vS.includes("species"), "showIf: Skin texture hides in Simple, Species stays (Octopus is a Simple too)");
  const vSp = vis({ ...p0, layout: "Spine" }), vR = vis({ ...p0, layout: "Rows" }), vC = vis({ ...p0, layout: "School" });
  ok(vSp.includes("space") && vSp.includes("mount") && !vSp.includes("count") && !vSp.includes("rows") && !vSp.includes("facing"), "showIf: Spine shows Spacing/Mount, hides Count/Rows/Facing");
  ok(vR.includes("rows") && vR.includes("jitter") && !vR.includes("heading") && !vR.includes("space"), "showIf: Rows shows Rows/Jitter, hides Heading/Spacing");
  ok(vC.includes("heading") && vC.includes("turn") && !vC.includes("rows") && !vC.includes("jitter"), "showIf: School shows Heading/Turn, hides Rows/Jitter");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 + p0.count * p0.rows, "overlay: margin rect + one cell per creature (" + g1.length + ")");
  const gS = def.overlay({ ...p0, layout: "Spine" }, CTX, [undefined, undefined], {});
  ok(gS.some((g) => g.kind === "arrow"), "overlay Spine unwired: default line arrow");
  const gW = def.overlay({ ...p0, layout: "Spine" }, CTX, [undefined, { paths: [{ pts: [[1, 1], [50, 50]], closed: false }] }], {});
  ok(gW.some((g) => g.kind === "poly"), "overlay Spine wired: spine poly");
  const gC = def.overlay({ ...p0, layout: "School" }, CTX, undefined, {});
  ok(gC.some((g) => g.kind === "arrow"), "overlay School: heading arrow");
  let threw = false;
  try { def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined); def.overlay({}, {}, null, null); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
} else ok(false, "overlay missing (node places a spatial region)");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
