/* Validator for the Belt Drive node. Run from the repo root:
   node tools/validate-belt.mjs
   First line tells which source was tested - [lab] before bake, [baked] after. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "belt";

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
const runAll = (p, ctx, ins) => def.compute(ins || [undefined, undefined], p, ctx || { W: 297, H: 210 }, {});
const run = (p, ctx, ins) => runAll(p, ctx, ins)[0];
const runE = (p, ctx, ins) => runAll(p, ctx, ins)[1];
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = defaults();

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(runAll(p0)) === JSON.stringify(runAll(p0)), "deterministic (double run byte-identical, both outputs)");
ok(r1.paths.length > 0 || r2.paths.length > 0, "sanity");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");

const tol = 1.0;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
const rTall = run(p0, { W: 210, H: 297 });
ok(rTall.paths.length > 0 && inb(rTall, 210, 297), "in bounds + non-empty on A4 tall");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => {
  const b = base ? JSON.stringify(run({ ...p0, ...base })) : bJ;
  const pp = { ...p0, ...(base || {}), ...patch };
  ok(JSON.stringify(run(pp)) !== b, "param live: " + label);
};
diff({ seed: 8 }, "seed");
diff({ count: 9 }, "count");
diff({ rmin: 12 }, "rmin");
diff({ rmax: 30 }, "rmax");
diff({ loose: 5 }, "loose");
diff({ margin: 35 }, "margin");
diff({ order: "Random" }, "order (Chain vs Random)");
diff({ weave: "Same side" }, "weave");
diff({ loop: false }, "loop");
diff({ endwrap: 20 }, "endwrap (open belt)", { loop: false, endwrap: 300 });
diff({ width: 8 }, "width (placement clearance + edges)", { brender: "Edges" });
diff({ gap: 6 }, "gap");
diff({ idlers: false }, "idlers", { width: 10, seed: 2, gap: 2, count: 9, loose: 3 });
diff({ brender: "Ribbon" }, "brender (Edges vs Ribbon, open)", { width: 8, loop: false });
diff({ pdraw: "None" }, "pdraw");
diff({ showtape: false }, "showtape");
diff({ showpul: false }, "showpul");
diff({ fillfrac: 100 }, "fillfrac", { pdraw: "Rings", fillfrac: 0 });
diff({ pitch: 3 }, "pitch", { pdraw: "Rings", fillfrac: 100 });
diff({ lpen: 3 }, "lpen");
diff({ ppen: 5 }, "ppen");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- belt geometry: the centerline is C1-continuous (no cusps) ---
   the tangent construction guarantees direction continuity at every
   arc/line junction; a flipped tangent normal produces ~180 deg cusps,
   so this is the geometric truth test for the tangent math */
{
  const r = run({ ...p0, pdraw: "None", width: 0, count: 8, seed: 4 });
  const belt = r.paths.find((q) => q.layer === p0.lpen);
  let maxTurn = 0;
  if (belt) {
    const P = belt.closed ? belt.pts.concat([belt.pts[0], belt.pts[1]]) : belt.pts;
    for (let i = 2; i < P.length; i++) {
      const ax = P[i - 1][0] - P[i - 2][0], ay = P[i - 1][1] - P[i - 2][1];
      const bx = P[i][0] - P[i - 1][0], by = P[i][1] - P[i - 1][1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-6 || lb < 1e-6) continue;
      const dot = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
      maxTurn = Math.max(maxTurn, Math.acos(dot));
    }
  }
  ok(belt && maxTurn < Math.PI / 4, "belt centerline C1-continuous, max turn " + (maxTurn * 180 / Math.PI).toFixed(1) + " deg");
}

/* --- no roller penetration: the tape may never cut through a pulley ---
   samples the belt centerline over many seeds/configs and asserts every
   point stays outside every pulley circle (small tolerance for the
   sampled-chord sagitta on tight arcs) */
const segd = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
};
const beltClearance = (pp) => {
  /* min over every belt SEGMENT (not just sampled points - straight
     tangent runs carry only their endpoints) of distance to every
     pulley circle */
  const L = def._layout([undefined, undefined], pp, { W: 297, H: 210 });
  const r = def.compute([undefined, undefined], pp, { W: 297, H: 210 }, {})[0];
  let w = Infinity;
  for (const q of r.paths) {
    if (q.layer !== pp.lpen) continue;
    const P = q.closed ? q.pts.concat([q.pts[0]]) : q.pts;
    for (let i = 1; i < P.length; i++)
      for (const c of L.pulleys)
        w = Math.min(w, segd(c.x, c.y, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]) - c.r);
  }
  return w;
};
{
  let worst = Infinity, n = 0;
  for (let seed = 1; seed <= 10; seed++) {
    for (const cfg of [{ count: 10, loose: 4 }, { count: 14, loose: 6, rmax: 30 }, { count: 8, loose: 0, weave: "Same side" }, { count: 12, loose: 8, margin: 8, rmax: 26 }, { count: 7, loose: 6, loop: false }]) {
      worst = Math.min(worst, beltClearance({ ...p0, ...cfg, seed, pdraw: "None", width: 0, gap: 0 }));
      n++;
    }
  }
  ok(n === 50 && worst > -0.08, "tape never cuts through a pulley (worst segment clearance " + worst.toFixed(3) + " mm over " + n + " configs)");
}

/* --- acute pinch fix: idlers reduce sharp self-overlaps of a wide belt
   and can NEVER make a config worse (the node measures and reverts) --- */
{
  const segX = (a, b, c, d) => {
    const d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = d[0] - c[0], d2y = d[1] - c[1];
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * d2y - (c[1] - a[1]) * d2x) / den;
    const u = ((c[0] - a[0]) * d1y - (c[1] - a[1]) * d1x) / den;
    if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
    return [a[0] + d1x * t, a[1] + d1y * t];
  };
  const acute = (pp) => {
    const L = def._layout([undefined, undefined], pp, { W: 297, H: 210 });
    const r = def.compute([undefined, undefined], pp, { W: 297, H: 210 }, {})[0];
    let n = 0;
    for (const q of r.paths) {
      if (q.layer !== pp.lpen) continue;
      const P = q.closed ? q.pts.concat([q.pts[0]]) : q.pts;
      const runs = [];
      for (let i = 1; i < P.length; i++)
        if (Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) > 3) runs.push([P[i - 1], P[i]]);
      for (let a = 0; a < runs.length; a++)
        for (let b = a + 1; b < runs.length; b++) {
          const X = segX(runs[a][0], runs[a][1], runs[b][0], runs[b][1]);
          if (!X) continue;
          const va = [runs[a][1][0] - runs[a][0][0], runs[a][1][1] - runs[a][0][1]];
          const vb = [runs[b][1][0] - runs[b][0][0], runs[b][1][1] - runs[b][0][1]];
          const co = Math.abs(va[0] * vb[0] + va[1] * vb[1]) / ((Math.hypot(va[0], va[1]) * Math.hypot(vb[0], vb[1])) || 1);
          if (co < Math.cos((30 * Math.PI) / 180)) continue;
          for (const c of L.pulleys)
            if (Math.hypot(X[0] - c.x, X[1] - c.y) < c.r + pp.gap + pp.width / 2 + 1.5) { n++; break; }
        }
    }
    return n;
  };
  let sumOn = 0, sumOff = 0, worse = 0;
  for (let seed = 1; seed <= 12; seed++) {
    for (const cfg of [{ count: 9, loose: 3, gap: 2 }, { count: 12, loose: 6, rmax: 26, margin: 10, gap: 1 }]) {
      const pp = { ...p0, ...cfg, seed, width: 10, brender: "Centerline", pdraw: "None" };
      const on = acute(pp), off = acute({ ...pp, idlers: false });
      sumOn += on; sumOff += off;
      if (on > off) worse++;
    }
  }
  ok(worse === 0, "pinch fix never makes a config worse (0/24 regressions, " + worse + " found)");
  ok(sumOff > 0 && sumOn < sumOff, "idlers reduce acute self-overlaps (" + sumOff + " -> " + sumOn + " over 24 configs)");
  const w1 = runAll({ ...p0, width: 10, seed: 2, gap: 2, count: 9, loose: 3 });
  const w2 = runAll({ ...p0, width: 10, seed: 2, gap: 2, count: 9, loose: 3 });
  ok(JSON.stringify(w1) === JSON.stringify(w2), "idler insertion is deterministic");
}

/* --- wide belt: the inner EDGE clears every pulley by ~Gap --- */
{
  let worst = Infinity;
  for (let seed = 5; seed <= 8; seed++)
    worst = Math.min(worst, beltClearance({ ...p0, count: 9, loose: 3, seed, width: 10, gap: 2, brender: "Edges", pdraw: "None" }));
  ok(worst > 2 - 0.15, "wide belt inner edge clears pulleys by Gap (worst " + worst.toFixed(3) + " mm, gap 2)");
}

/* --- ribbon on an open belt is a closed shape --- */
{
  const r = run({ ...p0, width: 10, brender: "Ribbon", loop: false });
  ok(r.paths.some((q) => q.closed && q.layer === p0.lpen && q.pts.length > 20), "open Ribbon emits one closed belt outline");
}

/* --- Ribbon must differ from Edges in EVERY mode (the loop case shipped
   identical once) --- */
{
  const e1 = run({ ...p0, width: 8, brender: "Edges", pdraw: "None" });
  const r1 = run({ ...p0, width: 8, brender: "Ribbon", pdraw: "None" });
  ok(JSON.stringify(e1) !== JSON.stringify(r1), "Ribbon differs from Edges on a closed loop");
  const beltPaths = (r) => r.paths.filter((q) => q.layer === p0.lpen).length;
  ok(beltPaths(r1) > beltPaths(e1), "loop Ribbon adds rail lines (" + beltPaths(e1) + " -> " + beltPaths(r1) + " belt paths)");
  const e2 = run({ ...p0, width: 8, brender: "Edges", loop: false });
  const r2 = run({ ...p0, width: 8, brender: "Ribbon", loop: false });
  ok(JSON.stringify(e2) !== JSON.stringify(r2), "Ribbon differs from Edges on an open belt");
  const r3 = run({ ...p0, width: 8, brender: "Ribbon", pdraw: "None", pitch: 3 });
  ok(JSON.stringify(r3) !== JSON.stringify(r1), "Fill pitch is live in Ribbon mode");
}

/* --- wired pulleys: closed circles become pulleys, generator params go quiet --- */
const circleSet = (list) => ({
  paths: list.map(([cx, cy, r]) => {
    const pts = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return { pts, closed: true, layer: 0 };
  }),
});
{
  const ins = [undefined, circleSet([[60, 60, 18], [150, 105, 25], [240, 60, 12], [150, 170, 15]])];
  const a = run(p0, undefined, ins);
  ok(a.paths.length > 0 && finiteAll(a), "wired pulleys: draws finite paths (" + a.paths.length + ")");
  const b = run({ ...p0, count: 20, rmin: 3, rmax: 5 }, undefined, ins);
  ok(JSON.stringify(a) === JSON.stringify(b), "wired pulleys: generator params (count/radii) are ignored");
  const open = run({ ...p0, loop: false, order: "Source order" }, undefined, ins);
  ok(open.paths.length > 0 && finiteAll(open), "wired pulleys: open belt finite");
}

/* --- overlapping wired circles: fallback must not throw and stays finite --- */
{
  let threw = false, r = null;
  try { r = run({ ...p0, weave: "Alternate", order: "Source order" }, undefined, [undefined, circleSet([[100, 100, 30], [130, 100, 30], [220, 100, 20]])]); }
  catch (e) { threw = true; }
  ok(!threw && r && finiteAll(r), "overlapping wired pulleys: no throw, finite output");
}
{
  let threw = false, r = null;
  try { r = run(p0, undefined, [undefined, circleSet([[100, 100, 40], [102, 100, 5]])]); }
  catch (e) { threw = true; }
  ok(!threw && r && finiteAll(r), "contained wired pulley: no throw, finite output");
}

/* --- Empty output: unfilled pulley circles as clean regions --- */
{
  const both = runAll(p0);
  ok(Array.isArray(both) && both.length === 2, "compute returns [Out, Empty]");
  const e = both[1];
  ok(e.paths.length > 0 && e.paths.every((q) => q.closed && q.pts.length >= 8), "Empty at defaults: closed circle regions (" + e.paths.length + ")");
  ok(e.paths.every((q) => Number.isFinite(q.pts[0][0]) && q.layer === p0.ppen), "Empty: finite, on Pulley pen");
  const L = def._layout([undefined, undefined], p0, { W: 297, H: 210 });
  ok(runE({ ...p0, pdraw: "Outline" }).paths.length === L.pulleys.length, "Empty: Outline mode emits every pulley circle");
  ok(runE({ ...p0, pdraw: "Rings", fillfrac: 0 }).paths.length === L.pulleys.length, "Empty: Filled 0% leaves all pulleys empty");
  ok(runE({ ...p0, pdraw: "Rings", fillfrac: 100 }).paths.length === 0, "Empty: Filled 100% leaves none");
  ok(runE({ ...p0, pdraw: "None", showpul: false }).paths.length === L.pulleys.length, "Empty: emits regions even with pulleys hidden");
  const ppI = { ...p0, width: 10, seed: 2, gap: 0, count: 10, loose: 4, pdraw: "Outline" };
  const LI = def._layout([undefined, undefined], ppI, { W: 297, H: 210 });
  ok(runE(ppI).paths.length > LI.pulleys.length, "Empty: auto idlers are included (" + runE(ppI).paths.length + " > " + LI.pulleys.length + " base pulleys)");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, count: 2, rmin: 2, rmax: 2, margin: 0, width: 0, gap: 0, pitch: 0.4 })), "degenerate params produce no NaN");
{
  const ext = run({ ...p0, count: 24, loose: 20, rmax: 60, pdraw: "Spiral", fillfrac: 100, pitch: 0.4, width: 24, gap: 15, brender: "Ribbon" });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
}
ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "tiny canvas + huge margin: no NaN");

/* --- seeded fill selection is stable per pulley index --- */
{
  const a = run({ ...p0, pdraw: "Rings", fillfrac: 50 });
  const b = run({ ...p0, pdraw: "Rings", fillfrac: 50 });
  ok(JSON.stringify(a) === JSON.stringify(b), "rings fill selection deterministic");
}

/* --- showIf --- */
if (def.params.some((q) => typeof q.showIf === "function")) {
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(vis(p0).length > 0, "showIf: something is visible at defaults");
  ok(!vis(p0).includes("endwrap"), "showIf: endwrap hidden while Loop is on");
  ok(vis({ ...p0, loop: false }).includes("endwrap"), "showIf: endwrap visible when Loop off");
  ok(!vis(p0).includes("brender") && vis({ ...p0, width: 8 }).includes("brender"), "showIf: brender follows width");
  ok(!vis({ ...p0, showtape: false }).includes("width") && !vis({ ...p0, showpul: false }).includes("pdraw"), "showIf: show toggles hide their groups");
  ok(!vis({ ...p0, pdraw: "Outline" }).includes("fillfrac") && vis({ ...p0, pdraw: "Rings" }).includes("fillfrac"), "showIf: fillfrac follows pdraw");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay.call(def, p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.length > 1, "overlay returns guides (" + g1.length + ")");
  ok(g1.some((g) => g.kind === "rect") && g1.some((g) => g.kind === "circle"), "overlay has margin rect + pulley circles");
  let threw = false;
  try { def.overlay.call(def, { ...p0 }, { W: 4, H: 4 }, undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
  let threw2 = false;
  try { def.overlay.call({}, p0, { W: 297, H: 210 }, undefined, {}); } catch (e) { threw2 = true; }
  ok(!threw2, "overlay survives a broken this-binding");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
