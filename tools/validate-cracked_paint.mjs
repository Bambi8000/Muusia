/* tools/validate-cracked_paint.mjs — run from repo root.
   Validates nodes-lab/cracked_paint.plotternode.js, or the baked
   src/defs/nodes/cracked_paint.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/cracked_paint.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/cracked_paint.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/cracked_paint.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/cracked_paint.plotternode.js");
}

const ctx = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defaults(), ...over }, ctx, {});
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const ink = (r) => r.paths.reduce((a, q) => a + H.pathLength(q.pts, q.closed), 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));
T("seed changes output", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));

/* finite + sanity + budget + margin */
let allFinite = true, allLen = true, maxPts = 0, inMargin = true;
const sweeps = [
  {}, { flake: 8, chips: 1, curl: 1 }, { widthMax: 0 }, { widthMax: 6, fillStep: 0.4 },
  { hbias: 1, wobble: 1 }, { hbias: 0, wobble: 0, hier: 0 },
  { fill: false, chips: 0, curl: 0 }, { flake: 60, seed: 42 }, { margin: 35 },
];
for (const ov of sweeps) {
  const p = { ...defaults(), ...ov };
  const r = run(ov);
  maxPts = Math.max(maxPts, pts(r));
  for (const q of r.paths) {
    if (q.pts.length < 2) allLen = false;
    for (const [x, y] of q.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) allFinite = false;
      if (x < p.margin - 0.05 || x > ctx.W - p.margin + 0.05 ||
          y < p.margin - 0.05 || y > ctx.H - p.margin + 0.05) inMargin = false;
    }
  }
}
T("all coords finite", allFinite);
T("every path >= 2 pts", allLen);
T("point budget < 120000", maxPts < 120000, "max " + maxPts);
T("margin respected", inMargin);

/* HIERARCHY: wide cracks exist as closed outlines; hierarchy contrast shows
   as fewer wide outlines when hier is strong (later gens go hairline) */
{
  const outlines = (over) => run({ ...over, chips: 0 }).paths
    .filter((q) => q.closed).length;
  T("wide cracks draw closed outlines", outlines({}) > 5, outlines({}) + " outlines");
  T("hierarchy thins later generations",
    outlines({ hier: 1 }) < outlines({ hier: 0 }),
    `${outlines({ hier: 1 })} < ${outlines({ hier: 0 })}`);
  T("widthMax 0 -> hairlines only", outlines({ widthMax: 0 }) === 0);
}

/* HORIZONTAL BIAS: segment direction energy shifts horizontal */
{
  const horiz = (hbias) => {
    const r = run({ hbias, chips: 0, widthMax: 0, wobble: 0 });
    let h = 0, v = 0;
    for (const q of r.paths) for (let i = 1; i < q.pts.length; i += 3) {
      const dx = Math.abs(q.pts[i][0] - q.pts[i - 1][0]);
      const dy = Math.abs(q.pts[i][1] - q.pts[i - 1][1]);
      if (dx > dy) h += dx; else v += dy;
    }
    return h / (h + v);
  };
  const h0 = horiz(0), h1 = horiz(1);
  T("horizontal bias steers cracks", h1 > h0 + 0.12,
    `${h1.toFixed(2)} > ${h0.toFixed(2)}+0.12`);
}

/* WOBBLE: 0 -> straight hairline cracks; 1 -> bent */
{
  const dev = (wobble) => {
    const r = run({ wobble, widthMax: 0, chips: 0 });
    let md = 0;
    for (const q of r.paths) {
      const A = q.pts[0], B = q.pts[q.pts.length - 1];
      const ux = B[0] - A[0], uy = B[1] - A[1];
      const L = Math.hypot(ux, uy) || 1;
      if (L < 15) continue;
      for (const [x, y] of q.pts)
        md = Math.max(md, Math.abs((x - A[0]) * uy - (y - A[1]) * ux) / L);
    }
    return md;
  };
  T("wobble=0 gives straight cracks", dev(0) < 0.05, "maxDev=" + dev(0).toFixed(3));
  T("wobble=1 bends cracks", dev(1) > 2, "maxDev=" + dev(1).toFixed(1));
}

/* FILL + CHIPS + CURL add ink; chip pen separates */
{
  T("fill adds ink", ink(run({ fill: true })) > ink(run({ fill: false })) * 1.15);
  T("chips add ink", ink(run({ chips: 1 })) > ink(run({ chips: 0 })));
  T("curl adds paths", run({ curl: 1 }).paths.length > run({ curl: 0 }).paths.length);
  const L = new Set(run({ chips: 1, chipPen: 5 }).paths.map((q) => q.layer));
  T("chip pen separates", L.has(5) && L.has(0), [...L].join(","));
  const L0 = new Set(run({ chips: 0, chipPen: 5 }).paths.map((q) => q.layer));
  T("chips=0 removes chip pen", !L0.has(5));
}

/* flake size scales crack count */
{
  T("smaller flakes -> more cracks",
    run({ flake: 10 }).paths.length > run({ flake: 45 }).paths.length * 1.5,
    `${run({ flake: 10 }).paths.length} vs ${run({ flake: 45 }).paths.length}`);
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("flake", 14);
live("hbias", 1);
live("wobble", 0.9);
live("widthMax", 5);
live("hier", 0.1);
live("chips", 0.9);
live("fill", false);
live("fillStep", 1.6);
live("curl", 0.9);
live("margin", 25);
live("layer", 4);
live("chipPen", 6, { chips: 0.9 });

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
