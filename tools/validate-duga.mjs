/* Validator for the Duga Array node. Run from the repo root:
   node tools/validate-duga.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "duga";

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
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");
ok(!def.params.some((q) => q.type === "seed"), "no seed param: fully deterministic geometry");
ok(def.params.filter((q) => q.type === "pen").length === 3, "three pen params");

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

/* --- every parameter must do something (camera params in Camera view, defaults) --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => { const b = base ? JSON.stringify(run(base)) : bJ; ok(JSON.stringify(run({ ...(base || p0), ...patch })) !== b, "param live: " + label); };
diff({ sections: "Low band" }, "sections"); diff({ towersA: 6 }, "towersA"); diff({ towersB: 3 }, "towersB");
diff({ bay: 30 }, "bay"); diff({ heightA: 100 }, "heightA"); diff({ heightB: 60 }, "heightB"); diff({ gapAB: 0 }, "gapAB");
diff({ towerW: 8 }, "towerW"); diff({ detail: "Outline" }, "detail"); diff({ pitchZ: 20 }, "pitchZ");
diff({ dipLen: 0.5 }, "dipLen"); diff({ dipDia: 8 }, "dipDia"); diff({ wires: 6 }, "wires"); diff({ standoff: 0 }, "standoff");
diff({ stagger: true }, "stagger"); diff({ feeds: false }, "feeds"); diff({ screen: "None" }, "screen"); diff({ screenGap: 12 }, "screenGap");
diff({ ground: false }, "ground"); diff({ view: "Front elevation" }, "view");
diff({ yaw: 0 }, "yaw"); diff({ pitch: 10 }, "pitch"); diff({ persp: 0 }, "persp"); diff({ eye: 100 }, "eye");
diff({ margin: 30 }, "margin"); diff({ pen: 3 }, "pen"); diff({ penDip: 4 }, "penDip"); diff({ penScreen: 5 }, "penScreen");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- front elevation oracles: orthographic, sliders ignored, real proportions --- */
{
  const F = { ...p0, view: "Front elevation", penDip: 4 };
  const a = run(F), b = run({ ...F, yaw: 60, pitch: 30, persp: 3, eye: 200 });
  ok(JSON.stringify(a) === JSON.stringify(b), "Front elevation ignores the camera sliders");
  /* every mast leg is vertical and every truss horizontal in the front view */
  const legs = a.paths.filter((q) => q.layer === p0.pen && !q.closed && q.pts.length === 2 && Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6 && Math.abs(q.pts[0][1] - q.pts[1][1]) > 5);
  ok(legs.length >= 2 * (p0.towersA + p0.towersB), "front view: mast legs project vertical (" + legs.length + ")");
  /* the two sections keep their height ratio */
  const one = (sec) => { const r = run({ ...F, sections: sec, ground: false, screen: "None" }); const bb = bbox(r); return (bb.y1 - bb.y0) / (bb.x1 - bb.x0); };
  const ratioA = one("Low band"), ratioB = one("High band");
  const expA = p0.heightA / ((p0.towersA - 1) * p0.bay + p0.towerW), expB = p0.heightB / ((p0.towersB - 1) * p0.bay + p0.towerW);
  ok(Math.abs(ratioA - expA) < 0.02 && Math.abs(ratioB - expB) < 0.02, "front view: section aspect ratios match height / length (" + ratioA.toFixed(3) + " vs " + expA.toFixed(3) + ", " + ratioB.toFixed(3) + " vs " + expB.toFixed(3) + ")");
  /* orthographic front view: all four legs of a mast collapse onto two x positions */
  const xs = [...new Set(legs.map((q) => Math.round(q.pts[0][0] * 1000)))];
  ok(xs.length === 2 * (p0.towersA + p0.towersB), "front view: 4 legs per mast collapse to 2 visible edges (" + xs.length + ")");
}
/* --- structure oracles --- */
{
  const S = { ...p0, view: "Front elevation", sections: "Low band", screen: "None", ground: false, feeds: false, detail: "Outline", towersA: 3, penDip: 4 };
  const r = run(S);
  /* dipoles: levels x bays, each dipole = 2 arms x (NW wires + 2 hoops) + 1 stand-off */
  const levels = Math.floor((p0.heightA - p0.dipDia / 2 - 1 - p0.pitchZ * 0.9) / p0.pitchZ) + 1;
  const dip = r.paths.filter((q) => q.layer === 4);
  ok(dip.length === levels * 2 * 2 * (p0.wires + 2), "dipole paths = levels x bays x 2 arms x (wires + 2 hoops) (" + dip.length + " for " + levels + " levels)");
  ok(dip.filter((q) => q.closed).length === levels * 2 * 4, "hoops: four closed rings per dipole");
  ok(dip.filter((q) => !q.closed).every((q) => q.pts.length === 4), "every cage wire is a 4-point polyline");
  /* Outline masts: 4 legs + 1 top ring each, plus top truss + level trusses + stand-offs */
  const mast = r.paths.filter((q) => q.layer === p0.pen);
  ok(mast.length === 3 * 5 + 1 + levels + levels * 2, "Outline detail: 4 legs + top ring per mast, trusses, stand-offs (" + mast.length + ")");
  const full = run({ ...S, detail: "Full lattice" }).paths.filter((q) => q.layer === p0.pen).length;
  const light = run({ ...S, detail: "Light" }).paths.filter((q) => q.layer === p0.pen).length;
  ok(full > light && light > mast.length, "tower detail: Full > Light > Outline path counts (" + full + " > " + light + " > " + mast.length + ")");
  /* stagger shifts alternate levels and drops the dipoles that would poke past the last mast */
  const st = run({ ...S, stagger: true }).paths.filter((q) => q.layer === 4).length;
  ok(st < dip.length && st > dip.length / 2, "stagger: alternate levels lose one bay at the end (" + st + " < " + dip.length + ")");
}
/* screen: vertical wires on the screen pen, count follows spacing */
{
  const S = { ...p0, view: "Front elevation", sections: "Low band", ground: false };
  const n6 = run({ ...S, screenGap: 6 }).paths.filter((q) => q.layer === p0.penScreen).length;
  const n12 = run({ ...S, screenGap: 12 }).paths.filter((q) => q.layer === p0.penScreen).length;
  ok(n6 > 1.8 * n12 && n12 > 0, "screen wire count roughly doubles when spacing halves (" + n12 + " -> " + n6 + ")");
  const mesh = run({ ...S, screen: "Mesh" }).paths.filter((q) => q.layer === p0.penScreen).length;
  ok(mesh > n6, "Mesh adds horizontal screen wires");
  ok(run({ ...S, screen: "None" }).paths.every((q) => q.layer !== p0.penScreen), "screen None: nothing on the screen pen");
}
/* perspective: with persp > 0 and yaw the near mast is taller on paper than the far one */
{
  const P = { ...p0, sections: "Low band", screen: "None", feeds: false, ground: false, detail: "Outline", yaw: 45, pitch: 0, eye: 0 };
  const legH = (r) => r.paths.filter((q) => q.layer === p0.pen && !q.closed && q.pts.length === 2 && Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-3).map((q) => [q.pts[0][0], Math.abs(q.pts[1][1] - q.pts[0][1])]).sort((u, v) => u[0] - v[0]);
  const o = legH(run({ ...P, persp: 0 })), q = legH(run({ ...P, persp: 2 }));
  ok(o.length > 4 && Math.max(...o.map((v) => v[1])) - Math.min(...o.map((v) => v[1])) < 1e-6, "persp 0: all legs equally tall (orthographic)");
  ok(q.length > 4 && q[0][1] > q[q.length - 1][1] * 1.5, "persp 2: the near mast is clearly taller than the far one");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, towersA: 2, towersB: 2, bay: 20, heightA: 40, heightB: 30, gapAB: 0, towerW: 2, pitchZ: 40, dipLen: 0.3, dipDia: 1, wires: 4, standoff: 0, screen: "None", margin: 0 })), "degenerate params produce no NaN");
const ext = run({ ...p0, towersA: 16, towersB: 12, heightA: 250, heightB: 200, towerW: 2, pitchZ: 6, dipDia: 12, wires: 16, screen: "Mesh", screenGap: 2, stagger: true, persp: 3, margin: 40 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(inb(ext, 297, 210, 40), "extreme params stay inside their margin box");
const wild = run({ ...p0, towersA: 999, towersB: -5, bay: 0, heightA: 1e6, heightB: -3, towerW: 500, pitchZ: 0, dipLen: 9, dipDia: -2, wires: 0, standoff: -50, screenGap: 0, yaw: 5000, pitch: -300, persp: 99, eye: -1e5, margin: -9 });
ok(finiteAll(wild) && npts(wild) <= 120000, "wired-out-of-range values: finite + budget held (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, { W: 4, H: 4 })), "tiny canvas: finite");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(!vis({ ...p0, view: "Front elevation" }).includes("yaw") && vis(p0).includes("yaw"), "showIf: camera sliders hidden in Front elevation");
ok(!vis({ ...p0, sections: "Low band" }).includes("towersB") && !vis({ ...p0, sections: "Low band" }).includes("gapAB"), "showIf: high-band params hidden for Low band");
ok(!vis({ ...p0, screen: "None" }).includes("screenGap"), "showIf: screenGap hidden without a screen");
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
