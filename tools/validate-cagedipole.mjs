/* Validator for the Cage Dipoles node. Run from the repo root:
   node tools/validate-cagedipole.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "cagedipole";

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
const bbox = (r) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };

const p0 = defaults();

/* --- static shape --- */
ok(def.cat === "gen" && def.group === "structural", "cat gen / group structural");
ok(typeof def.desc === "string" && def.desc.length > 120, "desc present");
ok(!def.params.some((q) => q.type === "seed"), "no seed param: the node is fully deterministic geometry");
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
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "inside margin box on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "inside margin box on A4 tall");
const bb = bbox(r1);
ok(Math.abs((bb.x1 - bb.x0) - (297 - 2 * p0.margin)) < 0.01 || Math.abs((bb.y1 - bb.y0) - (210 - 2 * p0.margin)) < 0.01, "fit touches the margin box in one axis");

/* --- structure count oracle at defaults --- */
{
  const rows = p0.rows, per = p0.perRow, NW = p0.wires, NH = p0.hoops;
  const perArm = NW + NH + (p0.stays ? 4 : 0);
  const expect = rows * (1 + per * 2 * perArm + (p0.poles ? (per + 1) * 3 : 0)) + (p0.poles && p0.ground ? (rows > 1 ? 4 : 3) : 0);
  ok(r1.paths.length === expect, "path count matches booms + cages + poles (" + r1.paths.length + " = " + expect + ")");
  const wires4 = r1.paths.filter((q) => !q.closed && q.pts.length === 4 && q.layer === p0.pen).length;
  ok(wires4 === rows * per * 2 * NW, "every wire is one 4-point polyline apex-hoop-hoop-apex (" + wires4 + ")");
  const hoops = r1.paths.filter((q) => q.closed).length;
  ok(hoops === rows * per * 2 * NH, "hoops are the only closed paths (" + hoops + ")");
  ok(!r1.paths.some((q) => q.layer === p0.penPole) === !p0.poles, "pole pen used iff poles on");
  /* wires alternate direction: consecutive wires start at opposite ends */
  const w = r1.paths.filter((q) => !q.closed && q.pts.length === 4 && q.layer === p0.pen);
  let alt = 0; for (let i = 1; i < 6; i++) if (Math.hypot(w[i].pts[0][0] - w[i - 1].pts[3][0], w[i].pts[0][1] - w[i - 1].pts[3][1]) < 1.5) alt++;
  ok(alt >= 4, "consecutive wires start where the previous one ended (pen travel), " + alt + "/5");
}

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ rows: 2 }, "rows"); diff({ perRow: 2 }, "perRow"); diff({ rowGap: 2 }, "rowGap");
diff({ dia: 0.4 }, "dia"); diff({ cyl: 0.3 }, "cyl"); diff({ gap: 0.1 }, "gap");
diff({ wires: 8 }, "wires"); diff({ hoops: 5 }, "hoops"); diff({ stays: !p0.stays }, "stays");
diff({ poles: !p0.poles }, "poles"); diff({ poleH: 1.5 }, "poleH"); diff({ ground: !p0.ground }, "ground");
diff({ yaw: -40 }, "yaw"); diff({ pitch: 30 }, "pitch"); diff({ persp: 0 }, "persp"); diff({ eye: 1 }, "eye");
diff({ margin: 30 }, "margin"); diff({ pen: 3 }, "pen"); diff({ penPole: 4 }, "penPole");

/* --- perspective oracles: yaw 0, pitch 0, camera looking across the rows --- */
{
  const base = { ...p0, rows: 3, perRow: 2, yaw: 0, pitch: 0, poles: false, stays: false, hoops: 2, wires: 4 };
  const boomLen = (r) => r.paths.filter((q) => !q.closed && q.pts.length === 2).map((q) => Math.abs(q.pts[1][0] - q.pts[0][0]));
  const flat = boomLen(run({ ...base, persp: 0 }));
  ok(flat.length === 3 && Math.max(...flat) - Math.min(...flat) < 1e-6, "persp 0: all three booms project to the same length (orthographic)");
  const deep = boomLen(run({ ...base, persp: 2 }));
  ok(deep[0] > deep[1] && deep[1] > deep[2], "persp 2: nearer booms are longer (" + deep.map((v) => v.toFixed(1)).join(" > ") + ")");
  /* eye height: with the eye at the boom the middle boom stays centred vertically; a low eye pushes far booms down */
  const boomY = (r) => r.paths.filter((q) => !q.closed && q.pts.length === 2).map((q) => q.pts[0][1]);
  const yl = boomY(run({ ...base, persp: 2, eye: -1 }));
  ok(yl[0] < yl[1] && yl[1] < yl[2], "low eye: farther booms sit lower on the sheet (toward the horizon)");
  const yh = boomY(run({ ...base, persp: 2, eye: 1 }));
  ok(yh[0] > yh[1] && yh[1] > yh[2], "high eye: farther booms sit higher on the sheet");
  /* symmetry of one dipole in front view */
  const one = run({ ...base, rows: 1, perRow: 1, persp: 0, eye: 0 });
  const b1 = bbox(one);
  ok(Math.abs(b1.x0 + b1.x1 - 297) < 1e-6 && Math.abs(b1.y0 + b1.y1 - 210) < 1e-6, "single dipole, front view: centred on the sheet");
  /* gap: apexes of the two arms sit 2*gap apart in dipole units; at gap 0 they coincide */
  const apexes = (r) => r.paths.filter((q) => !q.closed && q.pts.length === 4).map((q) => [q.pts[0], q.pts[3]]).flat().map((q) => q[0]);
  const g0 = run({ ...base, rows: 1, perRow: 1, persp: 0, gap: 0 }), gx = apexes(g0);
  const midCount = gx.filter((x) => Math.abs(x - 297 / 2) < 1e-6).length;
  ok(midCount === 8, "gap 0: both arms' inner apexes meet at the centre (" + midCount + " wire ends)");
}
/* pole height: taller poles = taller drawing before fit -> compare pole pen segment vs boom */
{
  const q = run({ ...p0, rows: 1, perRow: 1, yaw: 0, pitch: 0, persp: 0, poles: true, ground: false, poleH: 1 });
  const boom = q.paths.find((x) => x.layer === p0.pen && !x.closed && x.pts.length === 2);
  const pole = q.paths.filter((x) => x.layer === p0.penPole).map((x) => Math.abs(x.pts[1][1] - x.pts[0][1])).sort((a, b) => b - a)[0];
  const bl = Math.abs(boom.pts[1][0] - boom.pts[0][0]);
  ok(Math.abs(pole / bl - 0.98 / 1.12) < 0.02, "pole height 1 dipole draws at the right ratio to the boom (" + (pole / bl).toFixed(3) + ")");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, rows: 1, perRow: 1, dia: 0.08, cyl: 0.2, gap: 0, wires: 4, hoops: 2, stays: false, poles: false, persp: 0, margin: 0 })), "degenerate params produce no NaN");
const ext = run({ ...p0, rows: 8, perRow: 12, wires: 24, hoops: 6, dia: 0.5, persp: 3, ground: true, margin: 40 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(inb(ext, 297, 210, 40), "extreme params stay inside their margin box");
const wild = run({ ...p0, rows: 100, perRow: 100, wires: 999, hoops: 99, dia: 9, cyl: 5, gap: -1, yaw: 1000, pitch: 400, persp: 99, eye: -99, margin: -10, poleH: -3 });
ok(finiteAll(wild) && npts(wild) <= 120000, "wired-out-of-range values: finite + budget held (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, { W: 4, H: 4 })), "tiny canvas: finite");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(!vis({ ...p0, rows: 1 }).includes("rowGap") && vis(p0).includes("rowGap"), "showIf: rowGap only with more than one row");
ok(!vis({ ...p0, poles: false }).includes("poleH") && !vis({ ...p0, poles: false }).includes("ground"), "showIf: pole params hidden without poles");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "rect" && g1[0].x === p0.margin, "overlay returns the margin rect");
  let threw = false;
  try { def.overlay({ ...p0, margin: 999 }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
