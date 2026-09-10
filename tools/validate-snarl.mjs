/* Validator for the Snarled Line node.
   Run from the repo root: node tools/validate-snarl.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "snarl";

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

const p0 = (() => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; })();
const CTX = { W: 420, H: 297 };
const run = (p, clumpAt, ctx) => def.compute.call(def, [clumpAt, undefined], p, ctx || CTX, { params: p });
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => pt.every(Number.isFinite)));

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0 && npts(r1) > 1000, "non-empty at defaults (" + r1.paths.length + " strands, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(npts(r1) <= 110000, "point budget at defaults");
const m = p0.margin;
ok(r1.paths.every((q) => q.pts.every(([x, y]) =>
  x >= m - 1e-6 && x <= 420 - m + 1e-6 && y >= m - 1e-6 && y <= 297 - m + 1e-6)),
  "every point inside the margin rectangle (soft + hard walls)");
ok(r1.paths.length === p0.strands, "one continuous stroke per strand (Clump pen Off)");
ok(r1.paths.every((q) => q.layer === p0.layer), "single-pen mode: everything on Pen");

/* --- clumping concentration oracle: ink fraction inside the clump circles --- */
const fracIn = (r, cs, R) => {
  let inC = 0, n = 0;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    n++;
    for (const c of cs) if (Math.hypot(x - c[0], y - c[1]) < R) { inC++; break; }
  }
  return n ? inC / n : 0;
};
const pDense = { ...p0, clumping: 1, tighten: 0.9, clumps: 1, start: "Clumps" };
const pLoose = { ...pDense, clumping: 0, tighten: 0, start: "Edges" };
const csD = def._centers(pDense, CTX, [undefined]);
const fD = fracIn(run(pDense), csD, pDense.clumpsize);
const fL = fracIn(run(pLoose), csD, pDense.clumpsize);
ok(fD > 0.5 && fD > fL * 2,
  "clumping concentrates ink into the clump circles (" + fL.toFixed(3) + " -> " + fD.toFixed(3) + ")");

/* --- coil oracle: bigger coil -> gentler turning --- */
const p90Turn = (r) => {
  const ts = [];
  for (const q of r.paths) for (let i = 2; i < q.pts.length; i++) {
    const a1 = Math.atan2(q.pts[i - 1][1] - q.pts[i - 2][1], q.pts[i - 1][0] - q.pts[i - 2][0]);
    const a2 = Math.atan2(q.pts[i][1] - q.pts[i - 1][1], q.pts[i][0] - q.pts[i - 1][0]);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    ts.push(Math.abs(d));
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length * 0.5)];
};
const pCoil = { ...p0, clumping: 0, clumps: 0, mess: 0.15, memory: 0.9 };
ok(p90Turn(run({ ...pCoil, coil: 8 })) > p90Turn(run({ ...pCoil, coil: 44 })) * 2,
  "coil memory: small Coil turns much tighter than large (median)");

/* --- wired clump centers --- */
const AT = { paths: [{ pts: [[120, 100], [300, 200]], closed: false, layer: 0 }] };
const cs = def._centers(p0, CTX, [AT]);
ok(cs.length === 2 && cs[0][0] === 120 && cs[1][1] === 200, "wired Clump at: centers on the path's points");
ok(def._centers(p0, CTX, [undefined]).length === p0.clumps, "unwired: Clumps count of seeded centers");
ok(def._centers({ ...p0, clumps: 0 }, CTX, [undefined]).length === 0, "clumps 0: no centers");
const MANY = { paths: [{ pts: Array.from({ length: 60 }, (_, k) => [20 + k * 6, 150]), closed: false, layer: 0 }] };
ok(def._centers(p0, CTX, [MANY]).length <= 12, "dense input resamples and caps at 12 centers");
const rAT = run({ ...p0, clumping: 1, start: "Clumps" }, AT);
ok(finiteAll(rAT) && rAT.paths.length > 0, "wired run computes");
const frozen = JSON.parse(JSON.stringify(AT));
const snap = JSON.stringify(frozen);
Object.freeze(frozen); frozen.paths.forEach((q) => { Object.freeze(q); Object.freeze(q.pts); q.pts.forEach((pt) => Object.freeze(pt)); });
run(p0, frozen);
ok(JSON.stringify(frozen) === snap, "Clump at input never mutated");

/* --- clump pen splitting --- */
const rCP = run({ ...p0, clumppen: "On", clumping: 1, start: "Clumps", cpen: 4 });
const lset = [...new Set(rCP.paths.map((q) => q.layer))].sort((a, b) => a - b);
ok(lset.length === 2 && lset.includes(p0.layer) && lset.includes(4),
  "Clump pen On splits in-zone segments onto Core pen [" + lset + "]");
ok(rCP.paths.length > p0.strands, "splitting produces more, shorter segments");
/* consecutive segments of a strand share their junction point (no pen-lift gaps) */
ok(Math.abs(rCP.paths[0].pts[rCP.paths[0].pts.length - 1][0] - rCP.paths[1].pts[0][0]) < 1e-9 ||
   rCP.paths.length === p0.strands, "segments join seamlessly at zone boundaries");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ strands: 3 }, "strands");
diff({ length: 300 }, "length");
diff({ coil: 40 }, "coil");
diff({ memory: 0.1 }, "memory");
diff({ mess: 0.9 }, "mess");
diff({ loopvary: 0 }, "loopvary");
{
  /* loop-size diversity: spread of coiling-phase turn angles grows with Loop vary */
  /* instantaneous loop radius r = ds/|dtheta| on coiling steps; the
     log-radius spread must widen with Loop vary */
  const spread = (r) => {
    const rs = [];
    for (const q of r.paths) for (let i = 2; i < q.pts.length; i++) {
      const a1 = Math.atan2(q.pts[i - 1][1] - q.pts[i - 2][1], q.pts[i - 1][0] - q.pts[i - 2][0]);
      const a2 = Math.atan2(q.pts[i][1] - q.pts[i - 1][1], q.pts[i][0] - q.pts[i - 1][0]);
      let d = a2 - a1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      d = Math.abs(d);
      if (d > 0.045 && d < 0.6) rs.push(Math.log(0.9 / d));
    }
    rs.sort((a, b) => a - b);
    return rs[Math.floor(rs.length * 0.85)] - rs[Math.floor(rs.length * 0.15)];
  };
  const pLV = { ...p0, clumping: 0, clumps: 0, mess: 0.1, memory: 0.9 };
  const c0 = spread(run({ ...pLV, loopvary: 0 }));
  const c1 = spread(run({ ...pLV, loopvary: 1 }));
  ok(c1 > c0 * 2, "Loop vary spreads loop radii (log-spread " + c0.toFixed(2) + " -> " + c1.toFixed(2) + ")");
}
diff({ clumps: 4 }, "clumps");
diff({ clumping: 0 }, "clumping");
diff({ clumpsize: 100 }, "clumpsize");
diff({ tighten: 0 }, "tighten");
diff({ start: "Random" }, "start");
diff({ clumppen: "On" }, "clumppen");
{
  const a = run({ ...p0, clumppen: "On", cpen: 2 });
  const b = run({ ...p0, clumppen: "On", cpen: 6 });
  ok(JSON.stringify(a) !== JSON.stringify(b), "param live: cpen");
}
diff({ margin: 25 }, "margin");
diff({ layer: 5 }, "layer");
diff({ seed: 99 }, "seed");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite strands (" + r.paths.length + ")");
  }
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, strands: 1, length: 100, coil: 4, mess: 0, memory: 0, clumps: 0 })),
  "minimal strand: no NaN");
const rX = run({ ...p0, strands: 40, length: 3000, mess: 1, memory: 1, tighten: 1, clumping: 1, clumps: 6 });
ok(finiteAll(rX) && npts(rX) <= 110000, "extreme tangle: finite, budget held (" + npts(rX) + " pts)");
ok(finiteAll(run(p0, undefined, { W: 60, H: 60 })), "tiny canvas: no NaN");
ok(finiteAll(run({ ...p0, margin: 30 }, undefined, { W: 80, H: 70 })), "margin nearly swallowing the canvas: no NaN");

/* --- overlay --- */
ok(typeof def.overlay === "function", "overlay exists");
const g1 = def.overlay.call(def, p0, CTX, [undefined]);
ok(Array.isArray(g1) && g1.length === p0.clumps && g1.every((q) => q.kind === "circle"),
  "overlay: one circle per seeded clump");
const g2 = def.overlay.call(def, p0, CTX, [AT]);
ok(g2.length === 2 && g2[0].cx === 120, "overlay circles follow wired centers");
ok(Array.isArray(def.overlay.call(def, { clumpsize: NaN }, null, null)), "overlay never throws");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(!vis(p0).includes("cpen") && vis({ ...p0, clumppen: "On" }).includes("cpen"),
  "showIf: cpen only when Clump pen is On");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
