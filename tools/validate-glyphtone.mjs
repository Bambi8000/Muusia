// validate-glyphtone.mjs — harness per MUUSIA-NODE-API §9, real helper impls
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
const src = fs.readFileSync(new URL("../nodes-lab/glyphtone.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

// synthetic image: horizontal darkness gradient with a dark square block
const IW = 80, IH = 80;
const g = new Float32Array(IW * IH);
for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
  let v = x / (IW - 1);
  if (x > 20 && x < 45 && y > 20 && y < 45) v = 1;
  g[y * IW + x] = v;
}
const NODE_IMG = { data: { img: { w: IW, h: IH, g } } };

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, node = {}) => N.compute([undefined], { ...defs(), ...over }, CTX, node);
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((s, p) => s + p.pts.length, 0);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

// 1) determinism (noise + image source)
ok(J(run()) === J(run()), "determinism (Noise)");
ok(J(run({ source: "Image" }, NODE_IMG)) === J(run({ source: "Image" }, NODE_IMG)), "determinism (Image)");

// 2) Image source without a file → EMPTY; with file → output
ok(run({ source: "Image" }).paths.length === 0, "Image source w/o file → EMPTY");
ok(run({ source: "Image" }, NODE_IMG).paths.length > 20, "Image source w/ file draws");

// 3) geometry sanity across sources/extremes
const cases = [
  {}, { cell: 3, big: 1, jitter: 1 }, { cell: 20 }, { gamma: 3, cutoff: 0.5 },
  { invert: true }, { typeby: "Random", gChe: true }, { margin: 0 }, { pens: 12 },
  { source: "Image" }, { source: "Image", cell: 4, big: 0.8 },
];
for (const c of cases) {
  const r = run(c, NODE_IMG);
  let finite = true, inSheet = true, minPts = true;
  for (const p of r.paths) {
    if (p.pts.length < 2) minPts = false;
    for (const [x, y] of p.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < -0.01 || x > CTX.W + 0.01 || y < -0.01 || y > CTX.H + 0.01) inSheet = false;
    }
  }
  ok(finite && inSheet && minPts, `geometry ${Object.keys(c).join(",") || "def"} (paths=${r.paths.length}, pts=${nPts(r)})`);
}

// 4) point budget at worst case
ok(nPts(run({ cell: 3, cutoff: 0, big: 0.5 })) <= 120000, `budget cell=3 (${nPts(run({ cell: 3, cutoff: 0, big: 0.5 }))} pts)`);

// 5) glyph checkboxes: none enabled → EMPTY; single-type runs differ
ok(run({ gDot: false, gRing: false, gClu: false, gStr: false, gChe: false }).paths.length === 0, "no glyphs → EMPTY");
const only = (k) => ({ gDot: false, gRing: false, gClu: false, gStr: false, gChe: false, [k]: true });
const rr = ["gDot", "gRing", "gClu", "gStr", "gChe"].map((k) => J(run(only(k))));
ok(new Set(rr).size === 5, "each glyph type renders distinctly");

// 6) stripes are horizontal open lines when only stripes enabled
const rs = run(only("gStr"));
ok(rs.paths.every((p) => !p.closed && p.pts.length === 2 && Math.abs(p.pts[0][1] - p.pts[1][1]) < 1e-9), "stripes are horizontal 2-pt lines");

// 7) dots/rings are closed when only those enabled
ok(run(only("gDot")).paths.every((p) => p.closed), "dots closed");
ok(run(only("gRing")).paths.every((p) => p.closed), "rings closed");

// 8) big cells: bigger max glyph extent with big=1 vs big=0
const ext = (r) => Math.max(...r.paths.map((p) => {
  let a0 = 1e9, a1 = -1e9;
  for (const [x] of p.pts) { a0 = Math.min(a0, x); a1 = Math.max(a1, x); }
  return a1 - a0;
}));
ok(ext(run({ big: 1, gDot: true })) > ext(run({ big: 0 })), `big cells enlarge glyphs (${ext(run({ big: 1 })).toFixed(1)} > ${ext(run({ big: 0 })).toFixed(1)} mm)`);

// 9) cutoff: raising it reduces glyph count
ok(run({ cutoff: 0.5 }).paths.length < run({ cutoff: 0 }).paths.length, "cutoff reduces glyphs");

// 10) pens: with pens=6, layers span >1 value; layers stay 0..11 ints
const rp = run({ pens: 6, layer: 8 });
const layers = new Set(rp.paths.map((p) => p.layer));
ok(layers.size > 1 && [...layers].every((l) => Number.isInteger(l) && l >= 0 && l < 12), `pens spread layers (${[...layers].sort((a, b) => a - b).join(",")})`);
ok(run({ pens: 1, layer: 5 }).paths.every((p) => p.layer === 5), "pens=1 keeps base pen");

// 11) image content shows: dark block region has larger total ink than light strip
const ri = run({ source: "Image", cell: 5, typeby: "Value" }, NODE_IMG);
const inkIn = (r, x0, x1) => r.paths.reduce((s, p) => {
  const cx = p.pts.reduce((a, q) => a + q[0], 0) / p.pts.length;
  return s + (cx >= x0 && cx < x1 ? pathLength(p.pts, p.closed) : 0);
}, 0);
ok(inkIn(ri, 20, 90) < inkIn(ri, 120, 190), "image gradient: right (dark) side gets more ink");

// 12) remaining param liveness
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "seed liveness");
for (const [k, v] of [["cell", 10], ["typeby", "Random"], ["big", 0.9], ["jitter", 1], ["cutoff", 0.3], ["gamma", 2.5], ["invert", true], ["nscale", 0.03], ["pitch", 1.5], ["pens", 4], ["margin", 30], ["layer", 3]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);

// 13) path-set shape
ok(run().paths.every((p) => typeof p.closed === "boolean" && Number.isInteger(p.layer)), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
