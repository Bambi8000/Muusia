/* Validator for the Reeds in Snow node. Run from the repo root:
   node tools/validate-reedsnow.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "reedsnow";

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
const CTX = { W: 210, H: 297 };
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }; };
const p0 = defaults();
/* stalks only: no light-pen extras */
const bare = { ...p0, windMarks: 0, tangles: 0, wisps: 0 };

/* --- static shape --- */
ok(def.cat === "gen" && def.group === "nature", "cat gen / group nature");
ok(def.params.some((q) => q.type === "seed"), "has a seed param");
ok(def.params.filter((q) => q.type === "pen").length === 2, "two pen params");
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.01;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 210, 297, p0.margin), "inside margin box on A4 tall");
ok(inb(run(p0, { W: 297, H: 210 }), 297, 210, p0.margin), "inside margin box on A4 wide");

/* --- pens --- */
ok(run(bare).paths.every((q) => q.layer === p0.layer), "stalks only: everything on the stalk pen");
ok(run({ ...bare, windMarks: 5 }).paths.some((q) => q.layer === p0.penLight), "wind marks land on the light pen");
ok(run({ ...bare, wisps: 5 }).paths.some((q) => q.layer === p0.penLight), "wisps land on the light pen");
{
  const nb = run(bare).paths.length, nw = run({ ...bare, windMarks: 7 }).paths.length;
  ok(nw === nb + 7, "each wind mark is one path (" + (nw - nb) + " for 7)");
}

/* --- single stalk oracles --- */
{
  const one = { ...bare, count: 1, weight: 0.18, weightVar: 0, broken: 0, fallen: 0, lean: 0, leanVar: 0, bend: 0, rough: 0, height: 80, heightVar: 0, groundDepth: 0, seed: 3 };
  const r = run(one);
  ok(r.paths.length === 1, "one stalk at weight 0.18 = one pass, one path (" + r.paths.length + ")");
  const bb = bbox(r);
  ok(bb.w < 1e-6 && Math.abs(bb.h - 80) < 0.5, "no lean / bend / rough: a perfectly vertical stalk of the set height (" + bb.h.toFixed(2) + ")");
  ok(Math.abs(bb.y1 - (p0.margin + p0.ground * (297 - 2 * p0.margin))) < 1e-6, "stalk foot sits exactly on the ground line when ground depth is 0");
  const five = run({ ...one, weight: 0.9 });
  ok(five.paths.length === 5, "weight 0.9 = 5 passes (" + five.paths.length + ")");
  const ends = five.paths.map((q) => (q.pts[0][1] < q.pts[q.pts.length - 1][1] ? q.pts[0] : q.pts[q.pts.length - 1]));
  const feet = five.paths.map((q) => (q.pts[0][1] < q.pts[q.pts.length - 1][1] ? q.pts[q.pts.length - 1] : q.pts[0]));
  const spread = (P) => Math.max(...P.map((q) => q[0])) - Math.min(...P.map((q) => q[0]));
  ok(Math.abs(spread(feet) - 4 * 0.18) < 1e-6, "passes are 0.18 mm apart at the foot (" + spread(feet).toFixed(3) + ")");
  ok(spread(ends) < spread(feet) * 0.2, "taper: passes converge at the tip (" + spread(ends).toFixed(3) + " vs " + spread(feet).toFixed(3) + ")");
  const flat = run({ ...one, weight: 0.9, taper: false });
  const endsF = flat.paths.map((q) => (q.pts[0][1] < q.pts[q.pts.length - 1][1] ? q.pts[0] : q.pts[q.pts.length - 1]));
  ok(Math.abs(spread(endsF) - 4 * 0.18) < 1e-6, "no taper: passes stay parallel to the tip");
  ok(five.paths.every((q, i) => i === 0 || (q.pts[0][1] < q.pts[q.pts.length - 1][1]) !== (five.paths[i - 1].pts[0][1] < five.paths[i - 1].pts[q.pts.length - 1 < five.paths[i - 1].pts.length ? five.paths[i - 1].pts.length - 1 : 0][1])), "passes alternate direction for pen travel");
  const lean = bbox(run({ ...one, lean: 20 }));
  ok(Math.abs(lean.w / lean.h - Math.tan(20 * Math.PI / 180)) < 0.02, "lean 20: stalk tilts by tan(20)");
  const bent = bbox(run({ ...one, bend: 0.6 }));
  ok(bent.w > 4, "bend curves the stalk sideways");
  const dotted = run({ ...one, broken: 1 });
  ok(dotted.paths.length > 5 && dotted.paths.every((q) => q.pts.length <= 4), "broken 1: the stalk becomes short dashes (" + dotted.paths.length + ")");
  const tall = bbox(run({ ...one, height: 400 }));
  ok(Math.abs(tall.y0 - p0.margin) < 2.5, "oversized stalk is shortened to the margin box");
}
/* fallen: every stalk tilted well off vertical */
{
  const r = run({ ...bare, fallen: 1, lean: 0, leanVar: 0, bend: 0, rough: 0, weight: 0.18, weightVar: 0, broken: 0, count: 12 });
  const tilts = r.paths.map((q) => { const a = q.pts[0], b = q.pts[q.pts.length - 1]; return Math.abs(Math.atan2(b[0] - a[0], Math.abs(b[1] - a[1]))) * 180 / Math.PI; });
  ok(tilts.length > 3 && tilts.every((t) => t > 12), "fallen 1: all stalks lean more than 12 deg (min " + Math.min(...tilts).toFixed(1) + ")");
  const up = run({ ...bare, fallen: 0, lean: 0, leanVar: 0, bend: 0, rough: 0, weight: 0.18, weightVar: 0, broken: 0, count: 12 });
  ok(up.paths.every((q) => Math.abs(q.pts[0][0] - q.pts[q.pts.length - 1][0]) < 1e-6), "fallen 0 with no lean: all stalks vertical");
}
/* ground band: feet spread within ground depth */
{
  const r = run({ ...bare, count: 30, fallen: 0, lean: 0, leanVar: 0, bend: 0, rough: 0, weight: 0.18, weightVar: 0, broken: 0, groundDepth: 40 });
  const feet = r.paths.map((q) => Math.max(q.pts[0][1], q.pts[q.pts.length - 1][1]));
  const gy = p0.margin + p0.ground * (297 - 2 * p0.margin);
  ok(feet.every((y) => y >= gy - 20 - 1e-6 && y <= gy + 20 + 1e-6) && Math.max(...feet) - Math.min(...feet) > 20, "feet scatter across the ground band and no further");
}

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => { const b = base ? JSON.stringify(run(base)) : bJ; ok(JSON.stringify(run({ ...(base || p0), ...patch })) !== b, "param live: " + label); };
diff({ count: 5 }, "count"); diff({ height: 100 }, "height"); diff({ heightVar: 0 }, "heightVar"); diff({ bend: 0 }, "bend");
diff({ lean: -10 }, "lean"); diff({ leanVar: 0 }, "leanVar"); diff({ rough: 0 }, "rough"); diff({ fallen: 0 }, "fallen");
diff({ weight: 0.2 }, "weight"); diff({ weightVar: 0 }, "weightVar"); diff({ taper: false }, "taper"); diff({ broken: 0 }, "broken");
diff({ windMarks: 0 }, "windMarks"); diff({ tangles: 0 }, "tangles"); diff({ wisps: 0 }, "wisps"); diff({ ground: 0.6 }, "ground");
diff({ groundDepth: 0 }, "groundDepth"); diff({ margin: 30 }, "margin"); diff({ seed: 12 }, "seed"); diff({ layer: 2 }, "layer"); diff({ penLight: 2 }, "penLight");

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, count: 1, height: 20, heightVar: 1, bend: 1, lean: 30, leanVar: 1, rough: 1, fallen: 1, weight: 0.15, broken: 1, windMarks: 0, tangles: 0, wisps: 0, groundDepth: 80, margin: 0 })), "degenerate params produce no NaN");
const ext = run({ ...p0, count: 60, height: 400, weight: 1.5, weightVar: 0, broken: 0.5, windMarks: 40, tangles: 8, wisps: 20, margin: 40 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(inb(ext, 210, 297, 40), "extreme params stay inside their margin box");
const wild = run({ ...p0, count: 9999, height: -5, heightVar: 9, bend: -3, lean: 500, leanVar: -1, rough: 50, fallen: 7, weight: 99, weightVar: 9, broken: -1, windMarks: 1e6, tangles: 1e6, wisps: 1e6, ground: 5, groundDepth: -30, margin: -20, seed: -1, layer: 40 });
ok(finiteAll(wild) && npts(wild) <= 120000, "wired-out-of-range values: finite + budget held (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, { W: 4, H: 4 })), "tiny canvas: finite");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 2 && g1.every((g) => g.kind === "rect"), "overlay: margin rect + ground band");
  ok(Math.abs(g1[1].h - p0.groundDepth) < 1e-6, "overlay ground band is Ground depth tall");
  let threw = false;
  try { def.overlay({ ...p0, margin: 999, ground: 9 }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
