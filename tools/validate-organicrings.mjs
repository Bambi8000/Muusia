// validate-organicrings.mjs — harness per MUUSIA-NODE-API §9
import fs from "fs";
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y, seed) { let h = seed + x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; }
function pathLength(pts, closed) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return L; }
const resample = (p) => p, applyStyle = (ps) => ps, signedArea = () => 0;
const H = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const src = fs.readFileSync(new URL("../nodes-lab/organicrings.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defs(), ...over }, CTX, {});
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((s, p) => s + p.pts.length, 0);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

ok(J(run()) === J(run()), "determinism");
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "seed liveness");

for (const c of [{}, { rings: 60, halo: 1, merges: 12, bulges: 8, bulgesize: 1 }, { hole: 0, wav: 1, bundling: 1 }, { hole: 0.8, dotshare: 1 }, { dotshare: 0 }, { size: 280 }, { size: 30 }])
  for (const seed of [1, 8, 55]) {
    const r = run({ ...c, seed });
    let finite = true, inSheet = true, minPts = true;
    for (const pp of r.paths) {
      if (pp.pts.length < 2) minPts = false;
      for (const [x, y] of pp.pts) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
        if (x < 0 || x > CTX.W || y < 0 || y > CTX.H) inSheet = false;
      }
    }
    ok(finite && inSheet && minPts && r.paths.length > 5, `geometry ${Object.keys(c).join(",") || "def"} s${seed} (paths=${r.paths.length}, pts=${nPts(r)})`);
  }

// hole stays clean: no point closer to center than rIn*0.55 (wobble floor)
const cx = 105, cy = 148.5;
const rh = run({ hole: 0.4, size: 160, halo: 0 });
let minD = 1e9;
for (const pp of rh.paths) for (const [x, y] of pp.pts) minD = Math.min(minD, Math.hypot(x - cx, y - cy));
ok(minD > 80 * 0.4 * 0.55, `hollow center preserved (min r ${minD.toFixed(1)} mm)`);

// halo dots exist outside the outermost ring line; halo=0 removes them
const dotsOf = (r) => r.paths.filter((pp) => pp.closed && pp.pts.length === 7);
const rHalo = run({ halo: 1 }), rNo = run({ halo: 0 });
ok(dotsOf(rHalo).length > dotsOf(rNo).length + 50, `halo adds dot mist (${dotsOf(rHalo).length} vs ${dotsOf(rNo).length} dots)`);

// merges add open connector strands
ok(run({ merges: 12, dotshare: 0 }).paths.filter((pp) => !pp.closed).length >
   run({ merges: 0, dotshare: 0 }).paths.filter((pp) => !pp.closed).length, "merges add strands");

// pens cycle within 0..11
const lay = new Set(run({ pens: 5, layer: 9 }).paths.map((pp) => pp.layer));
ok(lay.size > 1 && [...lay].every((l) => Number.isInteger(l) && l >= 0 && l < 12), `pens cycle (${[...lay].sort((a, b) => a - b).join(",")})`);

// bulges create measurable radial excursion on line rings
const excur = (r) => Math.max(0, ...r.paths.filter((pp) => pp.closed && pp.pts.length > 30).map((pp) => {
  let a = 1e9, b = 0;
  for (const [x, y] of pp.pts) { const d = Math.hypot(x - cx, y - cy); a = Math.min(a, d); b = Math.max(b, d); }
  return b - a;
}));
ok(excur(run({ bulges: 6, bulgesize: 1, wav: 0, halo: 0, dotshare: 0 })) >
   excur(run({ bulges: 0, wav: 0, halo: 0, dotshare: 0 })) + 3,
  `bulges create eye excursions (${excur(run({ bulges: 6, bulgesize: 1, wav: 0, halo: 0, dotshare: 0 })).toFixed(1)} vs ${excur(run({ bulges: 0, wav: 0, halo: 0, dotshare: 0 })).toFixed(1)} mm)`);
// eye parts in BOTH directions: some rings excurse outward (max>>mean), others inward (min<<mean)
let bothDirs = false;
for (let sd = 1; sd <= 8 && !bothDirs; sd++) {
  const rb = run({ bulges: 1, bulgesize: 1, wav: 0, halo: 0, dotshare: 0, merges: 0, seed: sd });
  let outw = 0, inw = 0;
  for (const pp of rb.paths.filter((q) => q.closed && q.pts.length > 30)) {
    let mn = 1e9, mx = 0, sum = 0;
    for (const [x, y] of pp.pts) { const d = Math.hypot(x - cx, y - cy); mn = Math.min(mn, d); mx = Math.max(mx, d); sum += d; }
    const mean = sum / pp.pts.length;
    outw = Math.max(outw, mx - mean);
    inw = Math.max(inw, mean - mn);
  }
  if (outw > 2.5 && inw > 2.5) bothDirs = true;
}
ok(bothDirs, "bulge parts rings in both directions (outward + inward excursions)");
ok(J(run({ bulges: 5 })) !== J(run({ bulges: 0 })), "bulges liveness");
ok(J(run({ bulges: 5, bulgesize: 1 })) !== J(run({ bulges: 5, bulgesize: 0.2 })), "bulgesize liveness");

ok(nPts(run({ rings: 60, halo: 1, size: 280 })) <= 120000, `budget (${nPts(run({ rings: 60, halo: 1, size: 280 }))} pts)`);

for (const [k, v] of [["size", 100], ["hole", 0.6], ["rings", 12], ["wav", 1], ["bundling", 1], ["dotshare", 0.9], ["dotsize", 1], ["merges", 10], ["halo", 0.1], ["pens", 2], ["layer", 5]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);

ok(run().paths.every((pp) => typeof pp.closed === "boolean" && Number.isInteger(pp.layer)), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
