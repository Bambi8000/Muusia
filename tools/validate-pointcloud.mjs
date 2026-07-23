import fs from "fs";
const code = fs.readFileSync("nodes-lab/pointcloud.plotternode.js", "utf8");
const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const H = {
  Pin: (t, l) => ({ type: t, label: l }), EMPTY: { paths: [] },
  PENS: Array.from({ length: 12 }, () => ({})),
  mulberry32: (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
  hash2: (x, y, s) => {
    let h = s + x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  noise2: () => 0.5,
  resample: (x) => x, pathLength: () => 0, applyStyle: (ps) => ps, signedArea: () => 0,
};
const def = new Function(...Object.keys(H), '"use strict"; return (' + code.trim().replace(/^\(/, "").replace(/\)\s*;?\s*$/, "") + ");")(...Object.values(H));
const P = (o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const CTX = { W: 300, H: 200 };

/* file source: synthetic torus text */
let txt = "# synthetic torus\nx, y, z\n";
for (let i = 0; i < 3000; i++) {
  const u = (i * 0.618034) % 1 * Math.PI * 2;
  const v = (i * 0.7548777) % 1 * Math.PI * 2;
  txt += ((30 + 12 * Math.cos(v)) * Math.cos(u)).toFixed(3) + " " + ((30 + 12 * Math.cos(v)) * Math.sin(u)).toFixed(3) + " " + (12 * Math.sin(v)).toFixed(3) + "\n";
}
const parsed = def.onFile(txt);
if (parsed.pts3.length !== 3000) die("parser: expected 3000 pts, got " + parsed.pts3.length);
const node = { data: { svg: parsed } };
const run = (o) => def.compute([undefined], P(o), CTX, node);
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));
const inB = (ps) => ps.paths.every((pa) => pa.pts.every(([x, y]) => x >= 14.5 && x <= 285.5 && y >= 14.5 && y <= 185.5));

/* parsers */
{
  const ply = "ply\nformat ascii 1.0\nelement vertex 4\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n10 0 0\n0 10 0\n0 0 10\n";
  if (def.onFile(ply).pts3.length !== 4) die("PLY parser broken");
  let threw = false;
  try { def.onFile("ply\nformat binary_little_endian 1.0\nend_header\n"); } catch (e) { threw = true; }
  if (!threw) die("binary PLY should throw");
}
/* File source: dots determinism, bounds, count */
{
  const a = run({ source: "File", output: "Dots", maxPts: 1500 });
  if (JSON.stringify(a) !== JSON.stringify(run({ source: "File", output: "Dots", maxPts: 1500 }))) die("file dots non-deterministic");
  if (!finiteAll(a) || !inB(a)) die("file dots invalid/out of margin box");
  if (a.paths.length !== 1500) die("file dots: expected 1500, got " + a.paths.length);
}
/* built-in shapes: each valid, deterministic, correct count, mutually distinct */
{
  const shapes = def.params.find((q) => q.key === "source").options.filter((s) => s !== "File");
  if (shapes.length !== 13) die("expected 13 built-in shapes, got " + shapes.length);
  const sigs = new Set();
  for (const source of shapes) {
    const a = run({ source, output: "Dots", maxPts: 900 });
    if (!finiteAll(a) || !inB(a)) die(source + " invalid");
    if (a.paths.length !== 900) die(source + ": expected 900 dots, got " + a.paths.length);
    if (JSON.stringify(a) !== JSON.stringify(run({ source, output: "Dots", maxPts: 900 }))) die(source + " non-deterministic");
    sigs.add(JSON.stringify(a));
    const w = run({ source, output: "Wire (3D mesh)", maxPts: 700 });
    if (!w.paths.length || !w.paths.every((pa) => pa.pts.length === 2) || !finiteAll(w)) die(source + " wire broken");
  }
  if (sigs.size !== shapes.length) die("some shapes draw identical output (" + sigs.size + "/" + shapes.length + ")");
}
/* wire mechanics on Torus source: k live, maxEdge filters, endpoints on dots */
{
  const dots = run({ source: "Torus", output: "Dots", maxPts: 1200, dot: 0.6 });
  const centers = dots.paths.map((pa) => {
    let sx = 0, sy2 = 0;
    for (const q of pa.pts) { sx += q[0]; sy2 += q[1]; }
    return [sx / pa.pts.length, sy2 / pa.pts.length];
  });
  const w = run({ source: "Torus", output: "Wire (3D mesh)", maxPts: 1200 });
  if (!finiteAll(w) || !inB(w)) die("wire invalid");
  const near = ([x, y]) => centers.some(([cx, cy2]) => Math.hypot(x - cx, y - cy2) < 0.5);
  for (const pa of w.paths.slice(0, 200)) for (const q of pa.pts) if (!near(q)) die("edge endpoint not on a projected point");
  const k1 = run({ source: "Torus", output: "Wire (3D mesh)", maxPts: 1200, k: 1 }).paths.length;
  const k5 = run({ source: "Torus", output: "Wire (3D mesh)", maxPts: 1200, k: 5 }).paths.length;
  if (!(k5 > k1 * 1.8)) die("k has no effect (" + k1 + " vs " + k5 + ")");
  const e3 = run({ source: "Torus", output: "Wire (3D mesh)", maxPts: 1200, maxEdge: 3 }).paths.length;
  const e0 = run({ source: "Torus", output: "Wire (3D mesh)", maxPts: 1200, maxEdge: 0 }).paths.length;
  if (!(e0 >= e3)) die("maxEdge filter not reducing");
}
/* rotation + depth pens + both */
{
  if (JSON.stringify(run({ yaw: 0 })) === JSON.stringify(run({ yaw: 80 }))) die("yaw has no effect");
  if (JSON.stringify(run({ pitch: 0 })) === JSON.stringify(run({ pitch: 60 }))) die("pitch has no effect");
  const dp = run({ output: "Dots", depthPens: 4, layer: 2 });
  const layers = [...new Set(dp.paths.map((pa) => pa.layer))].sort((a, b) => a - b);
  if (layers.join(",") !== "2,3,4,5") die("depth pens wrong: " + layers.join(","));
  const both = run({ output: "Dots + wire", maxPts: 800 });
  if (!both.paths.some((pa) => pa.closed) || !both.paths.some((pa) => pa.pts.length === 2)) die("both mode missing a component");
}
/* bitcrush */
{
  const base = run({ source: "Sphere", output: "Dots", maxPts: 6000, crush: 0 }).paths.length;
  const c60 = run({ source: "Sphere", output: "Dots", maxPts: 6000, crush: 60, crushSeed: 7 });
  const ratio = c60.paths.length / base;
  if (ratio < 0.3 || ratio > 0.5) die("crush 60% kept " + (ratio * 100).toFixed(0) + "% (expected ~40%)");
  if (JSON.stringify(c60) !== JSON.stringify(run({ source: "Sphere", output: "Dots", maxPts: 6000, crush: 60, crushSeed: 7 }))) die("crush non-deterministic");
  if (JSON.stringify(c60) === JSON.stringify(run({ source: "Sphere", output: "Dots", maxPts: 6000, crush: 60, crushSeed: 8 }))) die("crush seed has no effect");
  const q5 = run({ source: "Sphere", output: "Dots", maxPts: 6000, quant: 5 }).paths.length;
  if (!(q5 < base * 0.7)) die("quantize 5% did not collapse points (" + q5 + "/" + base + ")");
}
/* keep size: cube keeps constant scale under rotation (projected bbox widens ~sqrt2
   at yaw 45); fit mode fills the limiting dimension; Size % is linear */
{
  const bboxW = (ps) => {
    let a = Infinity, b = -Infinity;
    for (const pa of ps.paths) for (const [x] of pa.pts) { if (x < a) a = x; if (x > b) b = x; }
    return b - a;
  };
  const k0 = bboxW(run({ source: "Cube", output: "Dots", keepSize: true, yaw: 0, pitch: 0 }));
  const k45 = bboxW(run({ source: "Cube", output: "Dots", keepSize: true, yaw: 45, pitch: 0 }));
  if (!(k45 > k0 * 1.25)) die("keepSize: cube should widen ~sqrt2 at yaw 45 (" + k0.toFixed(1) + " -> " + k45.toFixed(1) + ")");
  const fill = (o) => {
    const ps = run({ source: "Cube", output: "Dots", keepSize: false, ...o });
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const pa of ps.paths) for (const [x, y] of pa.pts) {
      if (x < a) a = x; if (x > b) b = x;
      if (y < c) c = y; if (y > d) d = y;
    }
    return Math.max((b - a) / 270, (d - c) / 170); /* margin box 270x170 */
  };
  if (fill({ yaw: 0, pitch: 0 }) < 0.93 || fill({ yaw: 45, pitch: 0 }) < 0.93) die("fit mode regression: limiting dimension should fill the margin box");
  const ks = run({ source: "Klein bottle", output: "Dots", keepSize: true, yaw: 137, pitch: -50 });
  for (const pa of ks.paths) for (const [x, y] of pa.pts) {
    if (x < 14 || x > 286 || y < 14 || y > 186) die("keepSize leaks outside margin box at odd angles");
  }
  const s40 = bboxW(run({ source: "Sphere", output: "Dots", keepSize: true, size: 40 }));
  const s80 = bboxW(run({ source: "Sphere", output: "Dots", keepSize: true, size: 80 }));
  if (!(Math.abs(s80 / s40 - 2) < 0.1)) die("size slider not linear (" + s40.toFixed(1) + " -> " + s80.toFixed(1) + ")");
}
console.log("pointcloud OK: parsers, 13 built-in shapes distinct, dots/wire/both, k+maxEdge, rotation, depth pens, crush+quantize, keep size + size slider");