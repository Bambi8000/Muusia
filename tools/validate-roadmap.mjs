/* tools/validate-roadmap.mjs — run from repo root: node tools/validate-roadmap.mjs
   Validates nodes-lab/roadmap.plotternode.js, or the baked
   src/defs/nodes/roadmap.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/roadmap.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/roadmap.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/roadmap.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/roadmap.plotternode.js");
}

const ctx = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defaults(), ...over }, ctx, {});
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));
T("seed changes output", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));

/* finite + sanity + budget over the parameter space */
let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { districts: 24, spacing: 2, ragged: 0 }, { water: "None", empty: 0 },
  { water: "Lakes" }, { highways: 4, ramps: 1, hwWidth: 6 },
  { highways: 0, arterials: 0, landmarks: 0, fields: 0 },
  { empty: 1, fields: 20 }, { wGrid: 0, wOrg: 0, wRad: 0, wSparse: 0 },
  { margin: 30, waterW: 30 }, { seed: 99, districts: 3 },
];
for (const ov of sweeps) {
  const r = run(ov);
  maxPts = Math.max(maxPts, pts(r));
  for (const q of r.paths) {
    if (q.pts.length < 2) allLen = false;
    for (const [x, y] of q.pts)
      if (!Number.isFinite(x) || !Number.isFinite(y)) allFinite = false;
  }
}
T("all coords finite", allFinite);
T("every path >= 2 pts", allLen);
T("point budget < 120000", maxPts < 120000, "max " + maxPts);

/* margin respected */
{
  const p = { ...defaults(), margin: 15 };
  const r = run(p);
  let ok = true;
  for (const q of r.paths) for (const [x, y] of q.pts)
    if (x < 15 - 0.3 || x > ctx.W - 15 + 0.3 || y < 15 - 0.3 || y > ctx.H - 15 + 0.3) ok = false;
  T("margin respected", ok);
}

/* pens: features land on their own pens and vanish when disabled */
{
  const r = run({ roadPen: 1, waterPen: 5, fieldPen: 8 });
  const L = new Set(r.paths.map((q) => q.layer));
  T("three pens in use", L.has(1) && L.has(5) && L.has(8), [...L].join(","));
  const noW = new Set(run({ water: "None", waterPen: 5, fieldPen: 8 }).paths.map((q) => q.layer));
  T("water=None removes water pen", !noW.has(5));
  const noF = new Set(run({ fields: 0, waterPen: 5, fieldPen: 8 }).paths.map((q) => q.layer));
  T("fields=0 removes field pen", !noF.has(8));
}

/* MONOTONIC STRUCTURE INVARIANTS */
{
  const streetPts = (over) => run({ ...over, landmarks: 0, fields: 0 }).paths
    .filter((q) => q.layer === defaults().roadPen)
    .reduce((a, q) => a + q.pts.length, 0); // roads only, not shorelines
  T("river carves streets away",
    streetPts({ water: "None" }) > streetPts({ water: "River", waterW: 30 }),
    `${streetPts({ water: "None" })} > ${streetPts({ water: "River", waterW: 30 })}`);
  T("empty space reduces streets",
    streetPts({ empty: 0 }) > streetPts({ empty: 1 }) * 1.3,
    `${streetPts({ empty: 0 })} vs ${streetPts({ empty: 1 })}`);
  T("raggedness thins streets",
    streetPts({ ragged: 0 }) > streetPts({ ragged: 0.9 }),
    `${streetPts({ ragged: 0 })} > ${streetPts({ ragged: 0.9 })}`);
  T("wider spacing thins streets",
    streetPts({ spacing: 2.5 }) > streetPts({ spacing: 9 }));
  T("motorways add geometry",
    pts(run({ highways: 3 })) > pts(run({ highways: 0 })));
  T("ramps add arcs (with motorways present)",
    run({ highways: 3, ramps: 1, arterials: 1 }).paths.length >
    run({ highways: 3, ramps: 0, arterials: 1 }).paths.length);
}

/* landmarks: closed concentric squares */
{
  const r = run({ landmarks: 30 });
  const squares = r.paths.filter((q) => q.closed && q.pts.length === 4);
  T("landmark squares present", squares.length >= 10, squares.length + " squares");
}

/* MOTORWAY STRAIGHTNESS: at hwBend 0 the centerline is nearly the straight
   chord; at hwBend 1 it detours. Measure the longest roadPen open path
   (motorway stroke) length vs its endpoint chord. */
{
  const wig = (bend) => {
    const r = run({ highways: 1, hwBend: bend, arterials: 0, landmarks: 0,
      fields: 0, empty: 1, water: "None", ramps: 0 });
    let best = null, bl = 0;
    for (const q of r.paths) {
      const L = H.pathLength(q.pts, false);
      if (!q.closed && L > bl) { bl = L; best = q; }
    }
    const chord = Math.hypot(best.pts[0][0] - best.pts[best.pts.length - 1][0],
                             best.pts[0][1] - best.pts[best.pts.length - 1][1]);
    return bl / chord;
  };
  const s0 = wig(0), s1 = wig(1);
  T("hwBend 0 -> nearly straight motorway", s0 < 1.03, "ratio=" + s0.toFixed(3));
  T("hwBend 1 -> detouring motorway", s1 > s0 + 0.02, `${s1.toFixed(3)} > ${s0.toFixed(3)}`);
}
/* irregularity: bends are discrete kinks, not waves */
{
  T("param live: irregular", sig(run()) !== sig(run({ irregular: 0 })));
  T("param live: hwBend", sig(run({ highways: 2, hwBend: 0 })) !== sig(run({ highways: 2, hwBend: 1 })));
  const streetsOnly = (irr) => run({ irregular: irr, ragged: 0, highways: 0,
    arterials: 0, landmarks: 0, fields: 0, water: "None", empty: 0,
    wGrid: 1, wOrg: 0, wRad: 0, wSparse: 0 });
  const maxDevOf = (r) => {
    let md = 0;
    for (const q of r.paths) {
      if (q.closed || q.pts.length < 3) continue;
      const A = q.pts[0], B = q.pts[q.pts.length - 1];
      const ux = B[0] - A[0], uy = B[1] - A[1];
      const L = Math.hypot(ux, uy) || 1;
      for (const [x, y] of q.pts)
        md = Math.max(md, Math.abs((x - A[0]) * uy - (y - A[1]) * ux) / L);
    }
    return md;
  };
  const d0 = maxDevOf(streetsOnly(0)), d1 = maxDevOf(streetsOnly(1));
  T("irregular=0 -> straight street segments", d0 < 0.05, "maxDev=" + d0.toFixed(3));
  T("irregular=1 -> kinked streets", d1 > 0.8, "maxDev=" + d1.toFixed(2));
  // dead-end stubs appear with irregularity
  T("irregularity adds stubs",
    streetsOnly(1).paths.length > streetsOnly(0).paths.length,
    `${streetsOnly(1).paths.length} > ${streetsOnly(0).paths.length}`);
  // streets are NOT parallel waves: direction histogram of segments should
  // spread beyond two grid directions at high irregularity
  const dirSpread = (r) => {
    const bins = new Array(18).fill(0);
    for (const q of r.paths) {
      if (q.closed) continue;
      for (let i = 1; i < q.pts.length; i += 4) {
        const a = Math.atan2(q.pts[i][1] - q.pts[i - 1][1], q.pts[i][0] - q.pts[i - 1][0]);
        bins[Math.floor((((a + Math.PI) / Math.PI) * 9)) % 18]++;
      }
    }
    const total = bins.reduce((a, b) => a + b) || 1;
    return bins.filter((b) => b / total > 0.02).length;
  };
  T("street directions spread (not just 2 axes)", dirSpread(streetsOnly(0.8)) >= 5,
    dirSpread(streetsOnly(0.8)) + " active direction bins");
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("districts", 5);
live("spacing", 7);
live("ragged", 0.8);
live("wGrid", 0);
live("wOrg", 0);
live("wRad", 1);
live("wSparse", 0);
live("empty", 0.8);
live("highways", 0);
live("hwWidth", 6, { highways: 2 });
live("ramps", 0, { highways: 3, arterials: 1 });
live("arterials", 0);
live("water", "None");
live("waterW", 25);
live("fields", 0);
live("landmarks", 0);
live("margin", 20);
live("roadPen", 4);
live("waterPen", 6);
live("fieldPen", 9);

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
