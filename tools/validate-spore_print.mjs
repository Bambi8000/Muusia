/* tools/validate-spore_print.mjs — run from repo root.
   Validates nodes-lab/spore_print.plotternode.js, or the baked
   src/defs/nodes/spore_print.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/spore_print.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/spore_print.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/spore_print.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/spore_print.plotternode.js");
}

const ctx = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defaults(), ...over }, ctx, {});
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));
const C = () => [ctx.W * defaults().cx / 100, ctx.H * defaults().cy / 100];

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));
T("seed changes output", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));

/* finite + sanity + budget */
let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { count: 6, size: 90, dust: 1, rim: 1 }, { fade: 1, wobble: 1, swirl: 60 },
  { fade: 0, wobble: 0, swirl: 0, dust: 0, rim: 0, edgeVar: 0 },
  { prim: 60, gap: 1, size: 90 }, { hole: 30, size: 32 },
  { count: 3, margin: 0 }, { gap: 6, prim: 8, seed: 42 },
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

/* stem disc stays empty (single print, no dust interference) */
{
  const p = { ...defaults(), dust: 0, wobble: 0, fade: 0 };
  const r = run(p);
  const [X, Y] = C();
  let mind = Infinity;
  for (const q of r.paths) for (const [x, y] of q.pts)
    mind = Math.min(mind, Math.hypot(x - X, y - Y));
  T("stem disc stays empty", mind >= p.hole - 0.2,
    `minDist=${mind.toFixed(2)} hole=${p.hole}`);
}

/* stays within cap radius allowance */
{
  const p = { ...defaults(), edgeVar: 1, dust: 1 };
  const r = run(p);
  const [X, Y] = C();
  let maxd = 0;
  for (const q of r.paths) for (const [x, y] of q.pts)
    maxd = Math.max(maxd, Math.hypot(x - X, y - Y));
  T("stays within cap allowance", maxd <= p.size * 1.25,
    `maxd=${maxd.toFixed(1)} limit=${(p.size * 1.25).toFixed(1)}`);
}

/* LAMELLULA HIERARCHY: with fade/wobble off, gill start radii cluster into
   >= 3 distinct tiers (primaries + at least two subdivision generations) */
{
  const p = { ...defaults(), fade: 0, wobble: 0, swirl: 0, dust: 0, rim: 0, edgeVar: 0 };
  const r = run(p);
  const [X, Y] = C();
  const starts = r.paths.filter((q) => !q.closed)
    .map((q) => Math.min(Math.hypot(q.pts[0][0] - X, q.pts[0][1] - Y),
                         Math.hypot(q.pts[q.pts.length - 1][0] - X, q.pts[q.pts.length - 1][1] - Y)));
  const tiers = new Set(starts.map((s) => Math.round(s / 4)));
  T("gill start radii form >= 3 tiers", tiers.size >= 3, tiers.size + " tiers");
  // primaries reach the stem disc
  const atHole = starts.filter((s) => s < p.hole + 1.2).length;
  T("primaries start at the stem disc", atHole >= p.prim * 0.9,
    `${atHole} >= ${Math.round(p.prim * 0.9)}`);
}

/* spacing control: smaller Gap -> more gill lines */
{
  const lines = (gap) => run({ gap, dust: 0, rim: 0, fade: 0 }).paths.length;
  T("smaller Gap densifies gills", lines(1.2) > lines(4) * 1.5,
    `${lines(1.2)} vs ${lines(4)}`);
}

/* fade: more fade -> fewer points, and lines break into more pieces */
{
  const a = run({ fade: 0, dust: 0, rim: 0 });
  const b = run({ fade: 0.8, dust: 0, rim: 0 });
  T("fade removes ink", pts(b) < pts(a), `${pts(b)} < ${pts(a)}`);
  T("fade splits lines", b.paths.length > a.paths.length,
    `${b.paths.length} > ${a.paths.length}`);
}

/* straight radial when wobble=swirl=0: max perpendicular deviation tiny */
{
  const r = run({ wobble: 0, swirl: 0, fade: 0, dust: 0, rim: 0 });
  const [X, Y] = C();
  let md = 0;
  for (const q of r.paths) {
    if (q.closed) continue;
    const A = q.pts[0], B = q.pts[q.pts.length - 1];
    const ux = B[0] - A[0], uy = B[1] - A[1];
    const L = Math.hypot(ux, uy) || 1;
    for (const [x, y] of q.pts)
      md = Math.max(md, Math.abs((x - A[0]) * uy - (y - A[1]) * ux) / L);
  }
  T("wobble=0 gives straight rays", md < 0.05, "maxDev=" + md.toFixed(3));
}

/* dust: closed specks on the dust pen, gone at 0 */
{
  const r = run({ dust: 0.8, dustPen: 5 });
  const specks = r.paths.filter((q) => q.closed && q.layer === 5);
  T("dust specks are closed loops on dust pen", specks.length > 50, specks.length + " specks");
  const r0 = run({ dust: 0, dustPen: 5 });
  T("dust=0 removes specks", r0.paths.every((q) => !(q.closed && q.layer === 5)));
}

/* multi-print: caps do not collide (path clusters honour spacing) */
{
  const r = run({ count: 4, dust: 0, seed: 9 });
  T("multi-print produces more geometry than single", r.paths.length > run({ dust: 0 }).paths.length * 1.5);
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("count", 3);
live("size", 30);
live("hole", 15);
live("prim", 12);
live("gap", 4);
live("wobble", 0.9);
live("swirl", -40);
live("edgeVar", 0.9);
live("fade", 0.9);
live("dust", 0.9);
live("rim", 0.9);
live("cx", 30);
live("cy", 70);
live("margin", 30, { count: 3 });
live("layer", 4);
live("dustPen", 6, { dust: 0.8 });

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
