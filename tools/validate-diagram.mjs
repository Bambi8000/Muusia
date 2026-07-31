/* tools/validate-diagram.mjs — run from repo root: node tools/validate-diagram.mjs
   Validates nodes-lab/diagram.plotternode.js, or the baked
   src/defs/nodes/diagram.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/diagram.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/diagram.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/diagram.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/diagram.plotternode.js");
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

let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { seed: 1 }, { seed: 99, layout: "Random", nodes: 9, extra: 6 },
  { layout: "Grid", nodes: 12, shape: "Square", corners: "90\u00b0" },
  { corners: "45\u00b0", style: "Single line", crossing: "Cross" },
  { style: "Thick outline", width: 12, cornerR: 25, jitter: 1 },
  { nodes: 2, margin: 0 }, { nodeSize: 30, headLen: 20, seed: 5 },
  { width: 0.2, fillStep: 0.3, seed: 42, extra: 8 },
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

{
  const r = run({ seed: 3 });
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    minx = Math.min(minx, x); maxx = Math.max(maxx, x);
    miny = Math.min(miny, y); maxy = Math.max(maxy, y);
  }
  const tol = 0.5;
  T("in bounds (default margin 15)",
    minx > -tol && miny > -tol && maxx < ctx.W + tol && maxy < ctx.H + tol,
    `bbox ${minx.toFixed(1)},${miny.toFixed(1)} .. ${maxx.toFixed(1)},${maxy.toFixed(1)}`);
}

T("seed changes output", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));

const live = (k, v) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run()) !== sig(run({ [k]: v })));
live("nodes", 6); live("shape", "Square"); live("nodeSize", 20);
live("layout", "Grid"); live("extra", 5); live("style", "Single line");
live("width", 8); live("fillStep", 2); live("headLen", 15);
live("corners", "90\u00b0"); live("cornerR", 3); live("labels", false);
live("margin", 30); live("nodePen", 3); live("linePen", 5);
live("crossing", "Cross"); live("jitter", 0.9);

{
  const a = run({ seed: 11, extra: 6, nodes: 6, crossing: "Under" });
  const b = run({ seed: 11, extra: 6, nodes: 6, crossing: "Cross" });
  T("Under splits lines at crossings", a.paths.length > b.paths.length,
    `under=${a.paths.length} cross=${b.paths.length}`);
}
{
  const a = run({ style: "Thick filled" });
  const b = run({ style: "Thick outline" });
  T("filled has more strokes than outline", pts(a) > pts(b));
}
{
  const r = run({ nodePen: 2, linePen: 7 });
  const layers = new Set(r.paths.map((q) => q.layer));
  T("pen layers correct", layers.has(2) && layers.has(7) && layers.size === 2,
    [...layers].join(","));
}
{
  const withL = run({ labels: true }).paths.length;
  const noL = run({ labels: false }).paths.length;
  T("labels add strokes", withL > noL, `${withL} vs ${noL}`);
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
