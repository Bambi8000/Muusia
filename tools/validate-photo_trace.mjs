/* Validator for photo_trace.
   Synthesizes a photo of the A4 marker sheet (3 solid + 1 donut marker)
   with a known ellipse "stone" under a known perspective homography,
   then proves the node recovers the ellipse outline in sheet millimetres.
   Run from the repo root: node tools/validate-photo_trace.mjs */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "photo_trace";

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

/* ---------- synthetic photo builder ---------- */
/* Scene in A4 sheet mm (210x297): markers at 20mm corners, 15mm; TL is donut
   (6mm hole). Ellipse stone at (105, 150), rx=32, ry=22, rotated 20 deg.
   A ground-truth homography Ht maps sheet mm -> photo px; the raster samples
   the inverse. 2x2 supersampling gives soft edges so Threshold is live. */
const SHEET = [210, 297];
const MK = [[20, 20], [190, 20], [190, 277], [20, 277]];
const ELL = { cx: 105, cy: 150, rx: 28, ry: 18, rot: (20 * Math.PI) / 180 };

function solveH(srcPts, dstPts) {
  const A = [];
  for (let k = 0; k < 4; k++) {
    const [x, y] = srcPts[k], [u, v] = dstPts[k];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let piv = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    const t = A[piv]; A[piv] = A[col]; A[col] = t;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c < 9; c++) A[r][c] -= f * A[col][c];
    }
  }
  const Hm = [];
  for (let r = 0; r < 8; r++) Hm.push(A[r][8] / A[r][r]);
  Hm.push(1);
  return Hm;
}
const applyH = (Hm, x, y) => {
  const d = Hm[6] * x + Hm[7] * y + 1;
  return [(Hm[0] * x + Hm[1] * y + Hm[2]) / d, (Hm[3] * x + Hm[4] * y + Hm[5]) / d];
};

function sceneDark(mx, my) {
  for (let k = 0; k < 4; k++) {
    const [cx, cy] = MK[k];
    if (Math.abs(mx - cx) <= 7.5 && Math.abs(my - cy) <= 7.5) {
      if (k === 0 && Math.abs(mx - cx) <= 3 && Math.abs(my - cy) <= 3) return 0; /* donut hole */
      return 1;
    }
  }
  /* scale bar + ticks + a text row, as printed on the real sheet: the node
     must reject all of these as markers and as the object */
  if (my >= 289 && my <= 290 && mx >= 55 && mx <= 155) return 1;
  if (my >= 286.5 && my <= 292.5 && ((mx >= 55 && mx <= 56) || (mx >= 154 && mx <= 155))) return 1;
  if (my >= 282 && my <= 285 && mx >= 39 && mx <= 171) {
    const u = (mx - 39) % 3.3;
    if (u <= 2.2) return 1; /* letter-ish 2.2x3mm boxes with gaps */
  }
  const dx = mx - ELL.cx, dy = my - ELL.cy;
  const c = Math.cos(-ELL.rot), s = Math.sin(-ELL.rot);
  const ux = (dx * c - dy * s) / ELL.rx, uy = (dx * s + dy * c) / ELL.ry;
  return ux * ux + uy * uy <= 1 ? 1 : 0;
}

/* photo corners of the sheet: mild perspective, sheet fills most of the frame */
function makePhoto(W, Hh, quad) {
  const Ht = solveH([[0, 0], [SHEET[0], 0], [SHEET[0], SHEET[1]], [0, SHEET[1]]], quad);
  const inv = solveH(quad, [[0, 0], [SHEET[0], 0], [SHEET[0], SHEET[1]], [0, SHEET[1]]]);
  const g = new Array(W * Hh).fill(0);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    let acc = 0;
    for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const [mx, my] = applyH(inv, x + ox, y + oy);
      if (mx < 0 || my < 0 || mx > SHEET[0] || my > SHEET[1]) continue; /* white table */
      acc += sceneDark(mx, my);
    }
    g[y * W + x] = acc / 4;
  }
  return { img: { w: W, h: Hh, g }, Ht };
}

function rot90(img) { /* rotate raster 90 deg CW: simulates a rotated camera */
  const { w, h, g } = img;
  const ng = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ng[x * h + (h - 1 - y)] = g[y * w + x];
  return { w: h, h: w, g: ng };
}

const QUAD = [[62, 48], [758, 76], [742, 1058], [50, 1024]];
const { img: IMG } = makePhoto(800, 1100, QUAD);

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const CTX = { W: 210, H: 297 };
const run = (p, ctx, img) => def.compute([undefined], p, ctx || CTX, { data: { img: img || IMG } });
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = { ...defaults(), grow: 0, smooth: 0, simplify: 0.3 };

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length === 1 && r1.paths[0].closed === true, "exactly one closed path");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget (" + npts(r1) + " pts)");
ok(npts(r1) >= 24, "contour has real detail (" + npts(r1) + " pts)");

/* --- homography oracle: outline matches the true ellipse --- */
function ellipseErr(pts) {
  let maxErr = 0;
  for (const [x, y] of pts) {
    const dx = x - ELL.cx, dy = y - ELL.cy;
    const c = Math.cos(-ELL.rot), s = Math.sin(-ELL.rot);
    const ux = (dx * c - dy * s) / ELL.rx, uy = (dx * s + dy * c) / ELL.ry;
    const rr = Math.hypot(ux, uy); /* 1.0 on the true edge */
    const localR = Math.hypot(dx, dy) / (rr || 1);
    maxErr = Math.max(maxErr, Math.abs(rr - 1) * localR);
  }
  /* area centroid (vertex mean is biased by RDP's uneven spacing) */
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const cr = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a2 += cr; cx += (pts[j][0] + pts[i][0]) * cr; cy += (pts[j][1] + pts[i][1]) * cr;
  }
  cx /= 3 * a2; cy /= 3 * a2;
  return { maxErr, cx, cy };
}
{
  const e = ellipseErr(r1.paths[0].pts);
  ok(e.maxErr <= 0.8, "outline within 0.8mm of true ellipse (max " + e.maxErr.toFixed(3) + "mm)");
  ok(Math.hypot(e.cx - ELL.cx, e.cy - ELL.cy) <= 0.5,
    "centroid within 0.5mm of true center (" + Math.hypot(e.cx - ELL.cx, e.cy - ELL.cy).toFixed(3) + "mm)");
}

/* --- orientation: rotated photos recover the same sheet-frame outline --- */
{
  let img = IMG;
  for (let k = 1; k <= 3; k++) {
    img = rot90(img);
    const r = run(p0, CTX, img);
    ok(r.paths.length === 1, "photo rotated " + k * 90 + "deg: outline found");
    if (r.paths.length === 1) {
      const e = ellipseErr(r.paths[0].pts);
      ok(e.maxErr <= 0.9 && Math.hypot(e.cx - ELL.cx, e.cy - ELL.cy) <= 0.6,
        "photo rotated " + k * 90 + "deg: same sheet-frame outline (max " + e.maxErr.toFixed(3) + "mm)");
    }
  }
}

/* --- parameter liveness --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ thr: 0.2 }, "thr");
diff({ simplify: 1.5 }, "simplify");
diff({ smooth: 2 }, "smooth");
diff({ grow: 3 }, "grow");
diff({ rot: "90\u00b0 CW" }, "rot");
diff({ layer: 3 }, "layer");
diff({ place: "Centered" }, "place (A5 canvas)", true);
ok(JSON.stringify(run({ ...p0, place: "Centered" }, { W: 148, H: 210 })) !== bJ, "param live: place");
ok(run({ ...p0, minarea: 2000 }).paths.length === 0, "param live: minarea (huge -> empty)");
diff({ sheet: "A3" }, "sheet (wrong sheet -> wrong scale, different coords)");
{
  const inv = { ...IMG, g: IMG.g.map((v) => 1 - v) };
  ok(run({ ...p0, invert: true }, CTX, inv).paths.length === 1, "param live: invert (negative photo)");
}

/* --- grow really offsets outward --- */
{
  const g3 = run({ ...p0, grow: 3 });
  const e = ellipseErr(g3.paths[0].pts);
  ok(e.maxErr >= 2.0 && e.maxErr <= 4.2, "grow 3mm pushes outline ~3mm out (max dev " + e.maxErr.toFixed(2) + "mm)");
}

/* --- rot mapping geometry --- */
{
  const r = run({ ...p0, rot: "90\u00b0 CW" }, { W: 297, H: 210 });
  ok(r.paths.length === 1 && finiteAll(r), "rot 90 CW renders");
  if (r.paths.length === 1) {
    let sx = 0, sy = 0;
    for (const q of r.paths[0].pts) { sx += q[0]; sy += q[1]; }
    sx /= r.paths[0].pts.length; sy /= r.paths[0].pts.length;
    ok(Math.hypot(sx - (SHEET[1] - ELL.cy), sy - ELL.cx) <= 2.5,
      "rot 90 CW lands at (Hs-y, x) +-2.5mm vertex-mean (" + sx.toFixed(1) + "," + sy.toFixed(1) + ")");
  }
}

/* --- every select option renders finite (on matching inputs) --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(finiteAll(r), pd.key + " '" + opt + "' finite (" + r.paths.length + " paths)");
  }
}

/* --- guards and degenerates --- */
ok(def.compute([undefined], p0, CTX, {}).paths.length === 0, "no image -> empty, no throw");
ok(def.compute([undefined], p0, CTX, { data: {} }).paths.length === 0, "empty data -> empty");
ok(run({ ...p0, thr: 0.9 }).paths.length === 0 || finiteAll(run({ ...p0, thr: 0.9 })), "thr 0.9 no NaN");
ok(finiteAll(run({ ...p0, thr: 0.1 })), "thr 0.1 no NaN");
{
  const blank = { w: 64, h: 64, g: new Array(64 * 64).fill(0) };
  ok(run(p0, CTX, blank).paths.length === 0, "blank photo -> empty");
  const noisy = { w: 64, h: 64, g: new Array(64 * 64).fill(0).map((_, i) => (i * 2654435761 % 97) / 97) };
  ok(run(p0, CTX, noisy).paths.length === 0 || finiteAll(run(p0, CTX, noisy)), "noise photo: no throw, no NaN");
}
{
  const ext = run({ ...p0, simplify: 0.1, smooth: 3, grow: 10 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget (" + npts(ext) + " pts)");
}

/* --- overlay never throws, matches rot --- */
{
  const gds = def.overlay({ ...p0 }, CTX);
  ok(Array.isArray(gds) && gds.length === 5, "overlay: poly + 4 marker rects");
  ok(Array.isArray(def.overlay({ ...p0, rot: "90\u00b0 CCW", sheet: "A3" }, CTX)), "overlay: rot/A3 no throw");
}

/* --- proof dump for the render step --- */
try {
  writeFileSync("/tmp/photo_trace_proof.json", JSON.stringify({
    outline: r1.paths[0].pts,
    grown: run({ ...p0, grow: 3, smooth: 1 }).paths[0].pts,
    ell: ELL, mk: MK, sheet: SHEET,
  }));
} catch (e) { /* proof dump is optional */ }

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
