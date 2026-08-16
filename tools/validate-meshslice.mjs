/* validate-meshslice.mjs — Mesh Slice node validator.
   Uses the REAL src/defs/helpers.js. Auto-switches lab/baked. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as H from "../src/defs/helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const labPath = join(root, "nodes-lab", "meshslice.plotternode.js");
const bakedPath = join(root, "src", "defs", "nodes", "meshslice.js");

const NAMES = ["noise2", "mulberry32", "hash2", "resample", "pathLength", "applyStyle", "isStyle", "signedArea", "EMPTY", "PENS", "Pin", "SFONT", "fontStrokes", "parseSVG"];
const VALS = NAMES.map((n) => H[n]);

let def, tag;
if (existsSync(bakedPath)) {
  tag = "[baked]";
  let src = readFileSync(bakedPath, "utf8");
  src = src.replace(/^import[^\n]*\n/m, "").replace("export default", "return");
  def = new Function(...NAMES, '"use strict";' + src)(...VALS);
} else {
  tag = "[lab]";
  const src = readFileSync(labPath, "utf8");
  def = new Function(...NAMES, '"use strict"; return (' + src + ");")(...VALS);
}
console.log(tag + " meshslice");

let nOK = 0, nFail = 0;
const ok = (name, cond) => {
  if (cond) { nOK++; console.log("  OK  " + name); }
  else { nFail++; console.log("FAIL  " + name); }
};

/* ---------- synthetic STL builders ---------- */
function binSTL(tris) {
  const n = tris.length;
  const buf = Buffer.alloc(84 + 50 * n);
  buf.writeUInt32LE(n, 80);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12;
    for (let k = 0; k < 9; k++) buf.writeFloatLE(tris[t][k], o + k * 4);
  }
  return "data:application/octet-stream;base64," + buf.toString("base64");
}
function quad(a, b, c, d) { return [[...a, ...b, ...c], [...a, ...c, ...d]]; }
function boxTris(w, d, h) {
  const [x, y, z] = [w / 2, d / 2, h / 2];
  const v = (sx, sy, sz) => [sx * x, sy * y, sz * z];
  const T = [];
  T.push(...quad(v(-1, -1, -1), v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1)));
  T.push(...quad(v(-1, -1, 1), v(-1, 1, 1), v(1, 1, 1), v(1, -1, 1)));
  T.push(...quad(v(-1, -1, -1), v(-1, 1, -1), v(-1, 1, 1), v(-1, -1, 1)));
  T.push(...quad(v(1, -1, -1), v(1, -1, 1), v(1, 1, 1), v(1, 1, -1)));
  T.push(...quad(v(-1, -1, -1), v(-1, -1, 1), v(1, -1, 1), v(1, -1, -1)));
  T.push(...quad(v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)));
  return T;
}
function sphereTris(r, seg, ring) {
  const P = (i, j) => {
    const th = (j / seg) * 2 * Math.PI, ph = (i / ring) * Math.PI;
    return [r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)];
  };
  const T = [];
  for (let i = 0; i < ring; i++) for (let j = 0; j < seg; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    T.push([...a, ...b, ...c]);
    if (i > 0) T.push([...a, ...c, ...d]);
  }
  return T;
}
const asciiTetra = () => {
  const V = [[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10]];
  const F = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
  let s = "solid t\n";
  for (const f of F) {
    s += " facet normal 0 0 0\n  outer loop\n";
    for (const i of f) s += "   vertex " + V[i].join(" ") + "\n";
    s += "  endloop\n endfacet\n";
  }
  s += "endsolid t\n";
  return "data:application/octet-stream;base64," + Buffer.from(s).toString("base64");
};

/* ---------- shared fixtures ---------- */
const cubeData = def.onFile(binSTL(boxTris(10, 10, 10)));
const boxData = def.onFile(binSTL(boxTris(20, 10, 10)));
const sphData = def.onFile(binSTL(sphereTris(8, 32, 16)));
const nodeOf = (d) => ({ data: { svg: d } });
const CTX = { W: 297, H: 210 };
const P0 = {};
for (const pr of def.params) P0[pr.key] = pr.def;
const run = (over, node, ctx) => def.compute([undefined], { ...P0, ...over }, ctx === undefined ? CTX : ctx, node === undefined ? nodeOf(cubeData) : node);
const allPts = (r) => r.paths.flatMap((q) => q.pts);
const totPts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finite = (r) => allPts(r).every((q) => isFinite(q[0]) && isFinite(q[1]));
const J = (r) => JSON.stringify(r);
const bboxOf = (pts) => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of pts) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
};
const perim = (pts, closed) => H.pathLength(closed ? [...pts, pts[0]] : pts);

/* ---------- 1. onFile parsing ---------- */
ok("onFile binary cube: 12 tris", cubeData.tri === 12 && cubeData.v.length === 108);
ok("onFile normalizes to unit box", Math.max(...cubeData.dims) === 1 && cubeData.dims.every((d) => Math.abs(d - 1) < 1e-3));
ok("onFile box dims 1 x 0.5 x 0.5", Math.abs(boxData.dims[0] - 1) < 1e-3 && Math.abs(boxData.dims[1] - 0.5) < 1e-3);
const tetraData = def.onFile(asciiTetra());
ok("onFile ASCII tetra: 4 tris", tetraData.tri === 4 && tetraData.v.length === 36);
let threw = "";
try { def.onFile("data:x;base64," + Buffer.from("garbage here").toString("base64")); } catch (e) { threw = String(e); }
ok("onFile rejects non-STL", /not an STL/.test(threw));
threw = "";
try {
  const big = Buffer.alloc(84 + 50 * 120001);
  big.writeUInt32LE(120001, 80);
  def.onFile("data:x;base64," + big.toString("base64"));
} catch (e) { threw = String(e); }
ok("onFile rejects >120k tris with decimate hint", /decimate/.test(threw));

/* ---------- 2. guards ---------- */
ok("no node -> empty", run({}, {}).paths.length === 0);
ok("no data -> empty", run({}, { data: {} }).paths.length === 0);
ok("garbage payload -> empty", run({}, { data: { svg: { foo: 1 } } }).paths.length === 0);
ok("bad v length -> empty", run({}, { data: { svg: { kind: "mesh", v: [1, 2, 3, 4] } } }).paths.length === 0);

/* ---------- 3. cube slicing geometry ---------- */
const single = run({ mode: "Single slice", slice: 12, slices: 24, size: 100 });
ok("single slice: one closed loop", single.paths.length === 1 && single.paths[0].closed === true);
const per = perim(single.paths[0].pts, true);
ok("cube mid slice perimeter ~400mm (" + per.toFixed(1) + ")", Math.abs(per - 400) < 6);
const ar = Math.abs(H.signedArea(single.paths[0].pts));
ok("cube mid slice area ~10000mm2 (" + ar.toFixed(0) + ")", Math.abs(ar - 10000) < 250);
const bb1 = bboxOf(single.paths[0].pts);
ok("slice centered on canvas", Math.abs((bb1[0] + bb1[2]) / 2 - 148.5) < 0.5 && Math.abs((bb1[1] + bb1[3]) / 2 - 105) < 0.5);

const all10 = run({ mode: "All contours", slices: 10, size: 100 });
ok("All mode, 10 slices -> 10 loops", all10.paths.length === 10 && all10.paths.every((q) => q.closed));
const thick20 = run({ mode: "All contours", sliceBy: "Sheet thickness", thick: 5, size: 100 });
ok("thickness 5mm on 100mm -> 20 slices", thick20.paths.length === 20);
ok("finite + on A4 landscape", finite(all10) && allPts(all10).every(([x, y]) => x >= 0 && x <= 297 && y >= 0 && y <= 210));
const port = run({ mode: "All contours", slices: 10, size: 100 }, undefined, { W: 210, H: 297 });
ok("on A4 portrait", finite(port) && allPts(port).every(([x, y]) => x >= 0 && x <= 210 && y >= 0 && y <= 297));

/* ---------- 4. frames mode ---------- */
const fr3 = run({ mode: "Frames (ANIMATE)", slices: 24, size: 100 }, undefined, { W: 297, H: 210, frameIdx: 11 });
ok("frames idx 11 == single slice 12", J(fr3.paths) === J(single.paths));
const frBig = run({ mode: "Frames (ANIMATE)", slices: 24, size: 100 }, undefined, { W: 297, H: 210, frameIdx: 999 });
const last = run({ mode: "Single slice", slice: 24, slices: 24, size: 100 });
ok("frameIdx clamps to last slice", J(frBig.paths) === J(last.paths));
const frNull = def.compute([undefined], { ...P0, mode: "Frames (ANIMATE)", size: 100 }, null, nodeOf(cubeData));
ok("null ctx tolerated (slice 0)", frNull.paths.length >= 1 && finite(frNull));

/* ---------- 5. determinism + no mutation ---------- */
const snapA = J(cubeData);
const d1 = run({ mode: "All contours", slices: 16, negN: 2, rodHole: "M5" });
const d2 = run({ mode: "All contours", slices: 16, negN: 2, rodHole: "M5" });
ok("deterministic", J(d1) === J(d2));
ok("input mesh not mutated", J(cubeData) === snapA);

/* ---------- 6. negative primitives ---------- */
const hole1 = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, negN: 1, negType1: "Sphere", negS1: 50, negX1: 0, negY1: 0, negZ1: 0 });
ok("inner sphere: 2 closed loops", hole1.paths.length === 2 && hole1.paths.every((q) => q.closed));
const circ = hole1.paths[1];
const cper = perim(circ.pts, true);
ok("hole circumference ~pi*50 (" + cper.toFixed(1) + ")", Math.abs(cper - Math.PI * 50) < 5);

const poke = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, negN: 1, negType1: "Sphere", negS1: 50, negX1: 50, negY1: 0, negZ1: 0 });
ok("poking sphere opens the shell (open runs)", poke.paths.some((q) => !q.closed) && poke.paths.length >= 2);
const cx = 148.5, cy = 105;
const okGeom = allPts(poke).every(([x, y]) => {
  const inSq = x >= cx - 50 - 0.75 && x <= cx + 50 + 0.75 && y >= cy - 50 - 0.75 && y <= cy + 50 + 0.75;
  const dHole = Math.hypot(x - (cx + 50), y - cy);
  return inSq && dHole > 25 - 0.75;
});
ok("clip: no point inside hole, none outside shell", okGeom);

const cubeHole = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, negN: 1, negType1: "Cube", negS1: 50 });
const chLoop = cubeHole.paths[1];
const chb = bboxOf(chLoop.pts);
ok("cube hole mid section ~50x50", Math.abs(chb[2] - chb[0] - 50) < 1 && Math.abs(chb[3] - chb[1] - 50) < 1);

const dodeHole = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, negN: 1, negType1: "Dodecahedron", negS1: 50 });
ok("dodecahedron hole present + closed", dodeHole.paths.length === 2 && dodeHole.paths[1].closed);
const dr = dodeHole.paths[1].pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
ok("dodeca section radius sane (<=25, >=12)", Math.max(...dr) <= 25.2 && Math.min(...dr) >= 12);

const twoHoles = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, negN: 2, negType1: "Sphere", negS1: 60, negX1: -15, negType2: "Sphere", negS2: 60, negX2: 15, negZ2: 0, negY2: 0 });
const openBits = twoHoles.paths.filter((q) => !q.closed);
ok("overlapping holes: arcs mutually clipped", openBits.length >= 2 && finite(twoHoles));

/* ---------- 7. rod hole ---------- */
const rod = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, rodHole: "M5", rodX: 20, rodY: 0 });
const rodLoop = rod.paths.find((q) => { const b = bboxOf(q.pts); return b[2] - b[0] < 8 && q.closed; });
ok("M5 rod hole loop exists", !!rodLoop);
if (rodLoop) {
  const b = bboxOf(rodLoop.pts);
  ok("M5 clearance ~5.5mm at rodX 20%", Math.abs(b[2] - b[0] - 5.5) < 0.25 && Math.abs((b[0] + b[2]) / 2 - (cx + 20)) < 0.3);
} else ok("M5 clearance ~5.5mm at rodX 20%", false);
const rodInHole = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, negN: 1, negS1: 50, rodHole: "M5", rodX: 0, rodY: 0 });
ok("rod inside a carved void is dropped", rodInHole.paths.length === 2);

/* ---------- 8. grid layout ---------- */
const grid = run({ mode: "Grid layout", slices: 6, size: 60, gridNum: false, gridGap: 5 });
ok("grid 6 slices -> 6 loops", grid.paths.length === 6);
const gb = grid.paths.map((q) => bboxOf(q.pts));
let disjoint = true;
for (let i = 0; i < gb.length; i++) for (let j = i + 1; j < gb.length; j++) {
  const A = gb[i], B = gb[j];
  if (A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) disjoint = false;
}
ok("grid cells disjoint", disjoint);
const gPer = perim(grid.paths[2].pts, true);
const sPer = perim(run({ mode: "Single slice", slice: 3, slices: 6, size: 60 }).paths[0].pts, true);
ok("grid is true scale (perimeters match)", Math.abs(gPer - sPer) < 0.5);
const gridN = run({ mode: "Grid layout", slices: 6, size: 60, gridNum: true, markPen: 3 });
const marks = gridN.paths.filter((q) => q.layer === 3);
ok("sheet numbers on mark pen", marks.length >= 6 && gridN.paths.some((q) => q.layer === 0));
const cols3 = run({ mode: "Grid layout", slices: 6, size: 60, gridNum: false, gridCols: 3 });
const cols2 = run({ mode: "Grid layout", slices: 6, size: 60, gridNum: false, gridCols: 2 });
ok("gridCols live", J(cols3) !== J(cols2));

/* ---------- 8b. grid pages ---------- */
const PG = { mode: "Grid pages (ANIMATE)", slices: 50, size: 60, gridGap: 5, bedMargin: 10, gridNum: false };
const pg = (f) => def.compute([undefined], { ...P0, ...PG }, { W: 297, H: 210, frameIdx: f }, nodeOf(cubeData));
const p0 = pg(0), p1 = pg(1);
const cellsOf = (r) => r.paths.filter((q) => q.closed).length;
ok("pages: 297x210 bed, 60mm sheets -> 4x3 = 12 per page", cellsOf(p0) === 12);
ok("pages: page 2 differs from page 1", J(p0) !== J(p1));
const inBed = (r) => allPts(r).every(([x, y]) => x >= 9.9 && x <= 287.1 && y >= 9.9 && y <= 200.1);
ok("pages: page 1 inside bed margins", inBed(p0));
ok("pages: page 2 inside bed margins", inBed(p1));
const pLast = pg(4);
ok("pages: last page holds the remainder (50 - 4*12 = 2)", cellsOf(pLast) === 2);
ok("pages: frameIdx clamps past the last page", J(pg(99)) === J(pLast));
let seen = 0;
for (let f = 0; f < 5; f++) seen += cellsOf(pg(f));
ok("pages: 5 pages cover all 50 sheets exactly", seen === 50);
const pgN = def.compute([undefined], { ...P0, ...PG, gridNum: true, markPen: 2 }, { W: 297, H: 210, frameIdx: 1 }, nodeOf(cubeData));
ok("pages: page header + sheet numbers on mark pen", pgN.paths.filter((q) => q.layer === 2).length > 12);
const gl = run({ mode: "Grid layout", slices: 50, size: 60, gridGap: 5, bedMargin: 10, gridNum: false });
ok("Grid layout: still emits the whole run (50)", cellsOf(gl) === 50);
ok("Grid layout: columns fit the bed width", allPts(gl).every(([x]) => x >= 9.9 && x <= 287.1));
const glm = run({ mode: "Grid layout", slices: 6, size: 60, gridNum: false, bedMargin: 30 });
ok("live: bedMargin", J(glm) !== J(run({ mode: "Grid layout", slices: 6, size: 60, gridNum: false, bedMargin: 5 })));

/* ---------- 8c. multiple rod holes ---------- */
const rodRing = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, rodHole: "M5", rodN: 4, rodR: 30, rodA: 45 });
const smallLoops = (r) => r.paths.filter((q) => { const b = bboxOf(q.pts); return q.closed && b[2] - b[0] < 8; });
const ring4 = smallLoops(rodRing);
ok("4 rod holes present", ring4.length === 4);
const ringC = ring4.map((q) => { const b = bboxOf(q.pts); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; });
ok("ring radius 30% of 100mm = 30mm from center", ringC.every(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - 30) < 0.3));
const angs = ringC.map(([x, y]) => Math.atan2(y - cy, x - cx)).sort((a, b) => a - b);
let even = true;
for (let i = 1; i < angs.length; i++) if (Math.abs(angs[i] - angs[i - 1] - Math.PI / 2) > 0.02) even = false;
ok("ring holes evenly spaced 90 deg apart", even);
ok("ring angle 45 deg honored", ringC.some(([x, y]) => Math.abs(x - cx - 30 * Math.cos(Math.PI / 4)) < 0.3));
const rod1 = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, rodHole: "M5", rodN: 1, rodR: 30, rodX: 15 });
const c1 = smallLoops(rod1);
ok("rodN 1 ignores ring radius, sits at center offset", c1.length === 1 && Math.abs((bboxOf(c1[0].pts)[0] + bboxOf(c1[0].pts)[2]) / 2 - (cx + 15)) < 0.3);
const manual = run({ mode: "Single slice", slice: 12, slices: 24, size: 100, rodHole: "M4", rodN: 3, rodLayout: "Manual", rodX1: -20, rodY1: -20, rodX2: 20, rodY2: -20, rodX3: 0, rodY3: 25 });
const mc = smallLoops(manual);
ok("manual layout: 3 holes at given coords", mc.length === 3 && mc.some((q) => { const b = bboxOf(q.pts); return Math.abs((b[0] + b[2]) / 2 - (cx - 20)) < 0.3 && Math.abs((b[1] + b[3]) / 2 - (cy - 20)) < 0.3; }));
const m4 = bboxOf(mc[0].pts);
ok("M4 clearance 4.5mm", Math.abs(m4[2] - m4[0] - 4.5) < 0.25);
ok("live: rodN", J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 1 })) !== J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 4 })));
ok("live: rodLayout", J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 3, rodLayout: "Ring" })) !== J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 3, rodLayout: "Manual" })));
ok("live: rodR", J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 4, rodR: 20 })) !== J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 4, rodR: 40 })));
ok("live: rodA", J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 4, rodA: 0 })) !== J(run({ mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 4, rodA: 30 })));
for (let i = 1; i <= 4; i++) {
  const b = { mode: "Single slice", slice: 12, slices: 24, rodHole: "M5", rodN: 4, rodLayout: "Manual" };
  ok("live: rodX" + i, J(run({ ...b, ["rodX" + i]: -40 })) !== J(run({ ...b, ["rodX" + i]: 40 })));
  ok("live: rodY" + i, J(run({ ...b, ["rodY" + i]: -40 })) !== J(run({ ...b, ["rodY" + i]: 40 })));
}

/* ---------- 8d. preview modes ---------- */
const PREV = { slices: 40, size: 400, gridNum: false, bedMargin: 10, negN: 1, negS1: 60, negX1: 25 };
const cs = run({ ...PREV, mode: "Contact sheet (preview)" });
ok("contact sheet: fits the canvas even at 400mm size", allPts(cs).every(([x, y]) => x >= -0.1 && x <= 297.1 && y >= -0.1 && y <= 210.1));
const csPlain = run({ ...PREV, mode: "Contact sheet (preview)", negN: 0 });
ok("contact sheet: all 40 sheets survive the budget (no truncation)", csPlain.paths.filter((q) => q.closed).length === 40);
const cellsSeen = new Set(allPts(cs).map(([x, y]) => Math.round(x / 20) + ":" + Math.round(y / 20))).size;
ok("contact sheet with holes: geometry spread over the whole tiling", cellsSeen > 40);
const csTrunc = run({ ...PREV, mode: "Contact sheet (preview)", slices: 200, negN: 0 });
ok("contact sheet: 200 sheets also all present (adaptive step)", csTrunc.paths.filter((q) => q.closed).length === 200);
const csBig = run({ ...PREV, mode: "Contact sheet (preview)", size: 40 });
ok("contact sheet: Size does not change what you see (both fit)", allPts(csBig).every(([x, y]) => x >= -0.1 && x <= 297.1 && y >= -0.1 && y <= 210.1));
const glBig = run({ ...PREV, mode: "Grid layout" });
ok("Grid layout still overflows at 400mm (preview differs from cut file)", allPts(glBig).some(([x, y]) => x > 297 || y > 210));
const iso = run({ ...PREV, mode: "Isometric stack (preview)" });
ok("iso stack: fits the canvas", allPts(iso).every(([x, y]) => x >= -0.1 && x <= 297.1 && y >= -0.1 && y <= 210.1));
ok("iso stack: taller than one slice (layers separated)", (() => { const b = bboxOf(allPts(iso)); return b[3] - b[1] > 60; })());
const isoFlat = run({ ...PREV, mode: "Isometric stack (preview)", isoSpread: 0 });
ok("iso spread 0 collapses the stack", (() => { const b = bboxOf(allPts(isoFlat)); return b[3] - b[1] < bboxOf(allPts(iso))[3] - bboxOf(allPts(iso))[1]; })());
ok("live: isoAz", J(run({ ...PREV, mode: "Isometric stack (preview)", isoAz: 0 })) !== J(run({ ...PREV, mode: "Isometric stack (preview)", isoAz: 60 })));
ok("live: isoEl", J(run({ ...PREV, mode: "Isometric stack (preview)", isoEl: 20 })) !== J(run({ ...PREV, mode: "Isometric stack (preview)", isoEl: 70 })));
ok("live: isoSpread", J(iso) !== J(isoFlat));
const pens = new Set(iso.paths.map((q) => q.layer));
ok("preview banner drawn on the mark pen", pens.size >= 2);
const csN = run({ ...PREV, mode: "Contact sheet (preview)", gridNum: true, markPen: 4 });
ok("contact sheet numbers on mark pen", csN.paths.some((q) => q.layer === 4));
ok("preview modes stay within budget", totPts(iso) <= 120000 && totPts(cs) <= 120000);

/* ---------- 9. budget ---------- */
const heavy = def.compute([undefined], { ...P0, mode: "All contours", slices: 200, size: 400, step: 0.2, rodHole: "M5" }, { W: 600, H: 600 }, nodeOf(sphData));
ok("200-slice sphere respects budget (" + totPts(heavy) + " pts)", totPts(heavy) <= 120000 && finite(heavy));

/* ---------- 10. open (non-watertight) mesh ---------- */
const holed = boxTris(10, 10, 10).slice(0, 11);
const holedData = def.onFile(binSTL(holed));
const openRes = def.compute([undefined], { ...P0, mode: "Single slice", slice: 12, slices: 24, size: 100 }, CTX, nodeOf(holedData));
ok("non-watertight mesh: no throw, output finite", openRes.paths.length >= 1 && finite(openRes));

/* ---------- 11. rotation ---------- */
const r0 = def.compute([undefined], { ...P0, mode: "Single slice", slice: 12, slices: 24, size: 100 }, CTX, nodeOf(boxData));
const r90 = def.compute([undefined], { ...P0, mode: "Single slice", slice: 12, slices: 24, size: 100, rotY: 90 }, CTX, nodeOf(boxData));
const w0 = bboxOf(r0.paths[0].pts), w9 = bboxOf(r90.paths[0].pts);
ok("rotY 90 swaps box footprint (" + (w0[2] - w0[0]).toFixed(0) + " -> " + (w9[2] - w9[0]).toFixed(0) + ")", (w0[2] - w0[0]) > (w9[2] - w9[0]) + 20);

/* ---------- 12. parameter liveness ---------- */
const live = [
  ["mode", {}, { mode: "All contours" }, { mode: "Grid layout", gridNum: false }],
  ["slice", { mode: "Single slice" }, { slice: 3 }, { slice: 9 }],
  ["sliceBy", { mode: "All contours", slices: 10, thick: 7 }, { sliceBy: "Count" }, { sliceBy: "Sheet thickness" }],
  ["slices", { mode: "All contours" }, { slices: 6 }, { slices: 9 }],
  ["thick", { mode: "All contours", sliceBy: "Sheet thickness" }, { thick: 5 }, { thick: 9 }],
  ["size", { mode: "Single slice", slice: 5, slices: 10 }, { size: 80 }, { size: 120 }],
  ["rotZ", { mode: "Single slice", slice: 5, slices: 10 }, { rotZ: 0 }, { rotZ: 45 }],
  ["step", { mode: "Single slice", slice: 5, slices: 10 }, { step: 0.6 }, { step: 1.5 }],
  ["negN", { mode: "Single slice", slice: 12, slices: 24 }, { negN: 0 }, { negN: 1 }],
  ["negType1", { mode: "Single slice", slice: 12, slices: 24, negN: 1, negS1: 50 }, { negType1: "Sphere" }, { negType1: "Cube" }],
  ["negX1", { mode: "Single slice", slice: 12, slices: 24, negN: 1, negS1: 40 }, { negX1: 0 }, { negX1: 20 }],
  ["negY1", { mode: "Single slice", slice: 12, slices: 24, negN: 1, negS1: 40 }, { negY1: 0 }, { negY1: 20 }],
  ["negZ1", { mode: "Single slice", slice: 12, slices: 24, negN: 1, negS1: 40 }, { negZ1: 0 }, { negZ1: 30 }],
  ["negS1", { mode: "Single slice", slice: 12, slices: 24, negN: 1 }, { negS1: 30 }, { negS1: 60 }],
  ["negS2", { mode: "Single slice", slice: 12, slices: 24, negN: 2, negS1: 12, negX1: -40, negX2: 0, negZ2: 0 }, { negS2: 20 }, { negS2: 45 }],
  ["negS3", { mode: "Single slice", slice: 12, slices: 24, negN: 3, negS1: 12, negX1: -40, negS2: 12, negX2: 40, negX3: 0, negZ3: 0 }, { negS3: 20 }, { negS3: 45 }],
  ["rodHole", { mode: "Single slice", slice: 12, slices: 24 }, { rodHole: "None" }, { rodHole: "M8" }],
  ["rodDia", { mode: "Single slice", slice: 12, slices: 24, rodHole: "Custom" }, { rodDia: 6 }, { rodDia: 12 }],
  ["rodX", { mode: "Single slice", slice: 12, slices: 24, rodHole: "M5" }, { rodX: 0 }, { rodX: 25 }],
  ["rodY", { mode: "Single slice", slice: 12, slices: 24, rodHole: "M5" }, { rodY: 0 }, { rodY: 25 }],
  ["gridGap", { mode: "Grid layout", slices: 4, size: 50, gridNum: false }, { gridGap: 2 }, { gridGap: 10 }],
  ["gridNum", { mode: "Grid layout", slices: 4, size: 50 }, { gridNum: false }, { gridNum: true }],
  ["numSize", { mode: "Grid layout", slices: 4, size: 50, gridNum: true }, { numSize: 4 }, { numSize: 8 }],
  ["markPen", { mode: "Grid layout", slices: 4, size: 50, gridNum: true }, { markPen: 1 }, { markPen: 5 }],
  ["layer", { mode: "Single slice", slice: 5, slices: 10 }, { layer: 0 }, { layer: 7 }],
];
for (const [k, base, A, B] of live) {
  const ra = run({ ...base, ...A }), rb = run({ ...base, ...B });
  ok("live: " + k, J(ra) !== J(rb));
}
ok("live: rotX/rotY (box)", J(r0) !== J(r90));

/* ---------- 13. every select option renders ---------- */
for (const pr of def.params) {
  if (pr.type !== "select") continue;
  ok("select '" + pr.key + "' uses options[]", Array.isArray(pr.options) && pr.options.length >= 2);
  for (const o of pr.options) {
    const over = { [pr.key]: o, negN: 3, rodHole: pr.key === "rodHole" ? o : "M5", mode: pr.key === "mode" ? o : "Single slice", slice: 12, slices: 24 };
    let good = true;
    try { const r = run(over); good = finite(r); } catch (e) { good = false; }
    ok("option " + pr.key + "=" + o, good);
  }
}

/* ---------- 13b. file intake wiring ---------- */
const fileParams = def.params.filter((pr) => pr.type === "file");
ok("has exactly one file param (the picker row)", fileParams.length === 1);
ok("file param is first in the list", def.params[0] && def.params[0].type === "file");
ok("fileBinary + onFile + fileAccept declared at definition level", def.fileBinary === true && typeof def.onFile === "function" && /stl/i.test(String(def.fileAccept)));
ok("fileLabel set", typeof def.fileLabel === "string" && def.fileLabel.length > 0);

/* ---------- 14. showIf predicates ---------- */
let sOK = true;
for (const pr of def.params) if (pr.showIf) { if (typeof pr.showIf !== "function" || typeof pr.showIf(P0) !== "boolean") sOK = false; }
ok("showIf predicates callable -> boolean", sOK);

/* ---------- 15. extreme / wired values ---------- */
const ext = [
  { size: 0 }, { size: 1e6 }, { slices: 0 }, { slices: 9999 }, { step: 0.001 }, { step: 99 },
  { thick: 0, sliceBy: "Sheet thickness" }, { negN: 99, negS1: 0, negS2: 0, negS3: 0 }, { slice: -5, mode: "Single slice" },
  { rodHole: "Custom", rodDia: 0 }, { gridCols: 999, mode: "Grid layout", gridNum: false }, { mode: "Grid pages (ANIMATE)", size: 5000, bedMargin: 200 }, { rodHole: "M5", rodN: 9, rodR: -50 }, { mode: "Isometric stack (preview)", isoEl: 0, isoSpread: 99 }, { mode: "Contact sheet (preview)", bedMargin: 200, gridCols: 999 },
];
let eOK = true;
for (const o of ext) {
  try { const r = run(o); if (!finite(r)) eOK = false; } catch (e) { eOK = false; }
}
ok("extreme values: no throw, no NaN", eOK);

/* ---------- 16. overlay ---------- */
const KINDS = new Set(["rect", "circle", "point", "arrow", "poly"]);
let oOK = true;
for (const m of ["Single slice", "Frames (ANIMATE)", "All contours", "Grid layout", "Grid pages (ANIMATE)", "Contact sheet (preview)", "Isometric stack (preview)"]) {
  const g = def.overlay({ ...P0, mode: m, negN: 2, rodHole: "M5" }, CTX, [undefined], nodeOf(cubeData));
  if (!Array.isArray(g) || !g.length || !g.every((q) => KINDS.has(q.kind))) oOK = false;
}
ok("overlay: valid guides in every mode", oOK);
let oG = true;
try {
  const a = def.overlay(P0, CTX, [undefined], undefined);
  const b = def.overlay(P0, CTX, [undefined], { data: { svg: { kind: "mesh", v: "garbage" } } });
  if (!Array.isArray(a) || !Array.isArray(b)) oG = false;
} catch (e) { oG = false; }
ok("overlay: never throws (no node / garbage data)", oG);

/* ---------- 17. style passthrough contract ---------- */
ok("returns {paths} shape", Array.isArray(run({}).paths));
ok("valid integer pen layers", run({ mode: "Grid layout", slices: 4, size: 50 }).paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11));

console.log(nFail === 0 ? "ALL OK (" + nOK + " checks)" : "FAILURES: " + nFail + " / " + (nOK + nFail));
process.exit(nFail === 0 ? 0 : 1);
