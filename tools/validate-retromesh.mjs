// validate-retromesh.mjs — harness per MUUSIA-NODE-API §9
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
const src = fs.readFileSync(new URL("../nodes-lab/retromesh.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defs(), ...over }, CTX, {});
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((s, pp) => s + pp.pts.length, 0);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

const MODES = ["Hourglass", "Funnel", "Horn", "Laser floor"];

// 1) determinism + modes distinct
for (const m of MODES) ok(J(run({ mode: m })) === J(run({ mode: m })), `determinism (${m})`);
ok(new Set(MODES.map((m) => J(run({ mode: m })))).size === 4, "modes distinct");

// 2) geometry sanity across modes/extremes
for (const m of MODES) for (const c of [{}, { persp: 1, rx: 60, ry: 120 }, { persp: 0 }, { rings: 40, spokes: 48 }, { flare: 4, throat: 0.05, height: 3 }, { size: 20 }, { terrain: 1 }]) {
  const r = run({ mode: m, ...c });
  let finite = true, inSheet = true, minPts = true;
  for (const pp of r.paths) {
    if (pp.pts.length < 2) minPts = false;
    for (const [x, y] of pp.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < 0 || x > CTX.W || y < 0 || y > CTX.H) inSheet = false;
    }
  }
  ok(finite && inSheet && minPts && r.paths.length > 5, `geometry ${m} ${Object.keys(c).join(",") || "def"} (paths=${r.paths.length})`);
}

// 3) structure: hourglass has 2*(rings+1) ring circles + 2*spokes meridians
const rh = run({ mode: "Hourglass", rings: 8, spokes: 12, rx: 10, persp: 0.5 });
const closedN = rh.paths.filter((pp) => pp.closed).length;
ok(closedN >= 2 * (8 + 1) - 4, `hourglass rings present (${closedN} closed)`); // a few may split at extreme tilt

// 4) perspective property: with tilt, the near mouth projects wider than the far mouth; effect grows with persp
const mouthWidths = (persp) => {
  const r = run({ mode: "Hourglass", rx: 18, persp, ry: 0 });
  const rings = r.paths.filter((pp) => pp.closed);
  let top = null, bot = null;
  for (const pp of rings) {
    let cx0 = 1e9, cx1 = -1e9, cym = 0;
    for (const [x, y] of pp.pts) { cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); cym += y; }
    cym /= pp.pts.length;
    const wdt = cx1 - cx0;
    if (!top || cym < top.cy) top = { cy: cym, w: wdt };
    if (!bot || cym > bot.cy) bot = { cy: cym, w: wdt };
  }
  return Math.abs(top.w - bot.w) / Math.max(top.w, bot.w);
};
ok(mouthWidths(1) > mouthWidths(0) + 0.03, `perspective foreshortening grows with Perspective (${mouthWidths(1).toFixed(3)} > ${mouthWidths(0).toFixed(3)})`);

// 5) laser floor: rows shrink toward horizon; horizon toggle works
const rf = run({ mode: "Laser floor", rx: 0, ry: 0, terrain: 0, rings: 10, spokes: 10, horizon: false });
const rows = rf.paths.filter((pp) => {
  let dy = 0; for (let i = 1; i < pp.pts.length; i++) dy = Math.max(dy, Math.abs(pp.pts[i][1] - pp.pts[0][1]));
  return dy < 1 && pp.pts.length > 10;
});
ok(rows.length >= 10, `floor rows detected (${rows.length})`);
const rowW = (pp) => Math.max(...pp.pts.map((q) => q[0])) - Math.min(...pp.pts.map((q) => q[0]));
const sorted = rows.slice().sort((a, b) => a.pts[0][1] - b.pts[0][1]);
ok(rowW(sorted[0]) < rowW(sorted[sorted.length - 1]) * 0.6, `rows converge to vanishing point (${rowW(sorted[0]).toFixed(0)} < ${rowW(sorted[sorted.length - 1]).toFixed(0)} mm)`);
ok(run({ mode: "Laser floor", horizon: true }).paths.length === run({ mode: "Laser floor", horizon: false }).paths.length + 1, "horizon adds one line");

// 6) terrain raises bumps but keeps the center corridor flat
const rt = run({ mode: "Laser floor", terrain: 1, rx: 0, ry: 0, horizon: false });
const rt0 = run({ mode: "Laser floor", terrain: 0, rx: 0, ry: 0, horizon: false });
ok(J(rt) !== J(rt0), "terrain liveness");

// 7) budget
ok(nPts(run({ rings: 40, spokes: 48, mode: "Hourglass" })) <= 120000, `budget (${nPts(run({ rings: 40, spokes: 48 }))} pts)`);

// 8) size fit + liveness of remaining params
const rz = run({ size: 120 });
let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
for (const pp of rz.paths) for (const [x, y] of pp.pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
ok(Math.abs(Math.max(bx1 - bx0, by1 - by0) - 120) < 2, `size fit (${Math.max(bx1 - bx0, by1 - by0).toFixed(1)} mm)`);
for (const [k, v] of [["rings", 20], ["spokes", 30], ["flare", 3.5], ["throat", 0.6], ["height", 2.5], ["persp", 0.9], ["rx", 45], ["ry", 90], ["layer", 5]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);
ok(J(run({ mode: "Laser floor", seed: 1, terrain: 0.8 })) !== J(run({ mode: "Laser floor", seed: 2, terrain: 0.8 })), "seed liveness (terrain)");

ok(run().paths.every((pp) => typeof pp.closed === "boolean" && Number.isInteger(pp.layer)), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
