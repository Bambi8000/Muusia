#!/usr/bin/env node
/* validate-mega-roll.mjs — oracles for the sliceRoll wallpaper slicer.
   sliceRoll lives inside src/App.jsx (engine-bound, next to sliceMega), so the
   validator extracts the function source by brace matching and instantiates it
   with the real fontStrokes from src/defs/helpers.js. Run from the repo root:
     node tools/validate-mega-roll.mjs */
import fs from "node:fs";
import { fontStrokes } from "../src/defs/helpers.js";

const src = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const start = src.indexOf("function sliceRoll(");
if (start < 0) { console.error("FAIL: function sliceRoll not found in src/App.jsx"); process.exitCode = 1; process.exit(); }
let depth = 0, end = -1;
for (let i = start; i < src.length; i++) {
  const ch = src[i];
  if (ch === "{") depth++;
  else if (ch === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
const fnSrc = src.slice(start, end);
const sliceRoll = new Function("fontStrokes", `return (${fnSrc.replace("function sliceRoll", "function")});`)(fontStrokes);

let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
};
const len = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };

/* geometry under test: rollW 530, seam 20, 2 strips, pieces of 800 mm, total 2000 mm */
const RW = 530, SEAM = 20, C = 2, SEG = 800, LEN = 2000;
const R = Math.ceil(LEN / SEG); /* 3, last piece 400 */
const strideX = RW - SEAM;      /* Overlap */
const megaW = C * RW - (C - 1) * SEAM;

/* 1. determinism */
{
  const ps = { paths: [{ pts: [[0, 0], [megaW, LEN]], closed: false, layer: 2 }] };
  const a = JSON.stringify(sliceRoll(ps, RW, SEG, C, LEN, SEAM, "Overlap", true, 3, true));
  const b = JSON.stringify(sliceRoll(ps, RW, SEG, C, LEN, SEAM, "Overlap", true, 3, true));
  check("determinism (double run identical)", a === b);
}

/* 2. tile grid: count, per-tile dims, last piece height */
{
  const tiles = sliceRoll({ paths: [] }, RW, SEG, C, LEN, SEAM, "Overlap", false, 0, false);
  check("tile count = strips × pieces", tiles.length === C * R, `${tiles.length} vs ${C * R}`);
  const okDims = tiles.every((t, i) => t.W === RW && t.H === (Math.floor(i / C) === R - 1 ? LEN - (R - 1) * SEG : SEG));
  check("per-tile W/H incl. short last piece", okDims);
}

/* 3. diagonal continuity: every clipped point lies on the original mega-space line,
      and pieces butt exactly at y boundaries (no seam in Y) */
{
  const ps = { paths: [{ pts: [[0, 0], [megaW, LEN]], closed: false, layer: 0 }] };
  const tiles = sliceRoll(ps, RW, SEG, C, LEN, SEAM, "Overlap", false, 0, false);
  let onLine = true, finite = true, inBounds = true;
  tiles.forEach((t, i) => {
    const rr = Math.floor(i / C), cc = i % C;
    for (const pa of t.paths) for (const [x, y] of pa.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < -1e-9 || x > t.W + 1e-9 || y < -1e-9 || y > t.H + 1e-9) inBounds = false;
      const gx = cc * strideX + x, gy = rr * SEG + y;
      if (Math.abs(gy - gx * (LEN / megaW)) > 1e-9 * LEN) onLine = false;
    }
  });
  check("all clipped points finite", finite);
  check("all clipped points in piece bounds", inBounds);
  check("diagonal maps back onto the mega line", onLine);
  /* exact butt joint per strip: bottom endpoint of piece r meets top endpoint of r+1 */
  let butt = true;
  for (let cc = 0; cc < C; cc++) {
    for (let rr = 0; rr + 1 < R; rr++) {
      const below = tiles[rr * C + cc].paths.flatMap((p) => p.pts).filter(([, y]) => Math.abs(y - SEG) < 1e-9);
      const above = tiles[(rr + 1) * C + cc].paths.flatMap((p) => p.pts).filter(([, y]) => Math.abs(y) < 1e-9);
      if (below.length !== 1 || above.length !== 1) continue; /* line may not cross this strip at this y */
      if (Math.abs(below[0][0] - above[0][0]) > 1e-9) butt = false;
    }
  }
  check("pieces butt exactly at boundaries (x continuity)", butt);
}

/* 4. length conservation: vertical line inside strip 0 spans the full roll length
      with zero loss and zero duplication across pieces */
{
  const ps = { paths: [{ pts: [[200, 0], [200, LEN]], closed: false, layer: 0 }] };
  const tiles = sliceRoll(ps, RW, SEG, C, LEN, SEAM, "Overlap", false, 0, false);
  let total = 0;
  tiles.forEach((t) => t.paths.forEach((p) => (total += len(p.pts))));
  check("vertical line: Σ clipped = total length (seamless Y)", Math.abs(total - LEN) < 1e-6, `${total} vs ${LEN}`);
}

/* 5. horizontal line: Overlap duplicates exactly the seam strip, Gap keeps rw per strip */
{
  const ps = { paths: [{ pts: [[0, 137], [megaW, 137]], closed: false, layer: 0 }] };
  const tiles = sliceRoll(ps, RW, SEG, C, LEN, SEAM, "Overlap", false, 0, false);
  let total = 0;
  tiles.forEach((t) => t.paths.forEach((p) => (total += len(p.pts))));
  check("horizontal line, Overlap: Σ = strips × rollW", Math.abs(total - C * RW) < 1e-6, `${total} vs ${C * RW}`);
  const megaWG = C * RW + (C - 1) * SEAM;
  const psG = { paths: [{ pts: [[0, 137], [megaWG, 137]], closed: false, layer: 0 }] };
  const tilesG = sliceRoll(psG, RW, SEG, C, LEN, SEAM, "Gap", false, 0, false);
  let totalG = 0;
  tilesG.forEach((t) => t.paths.forEach((p) => (totalG += len(p.pts))));
  check("horizontal line, Gap: Σ = strips × rollW (gap strip skipped)", Math.abs(totalG - C * RW) < 1e-6, `${totalG} vs ${C * RW}`);
}

/* 6. registration ticks: internal boundaries only, both edges, mark pen, 4 mm */
{
  const MP = 3;
  const tiles = sliceRoll({ paths: [] }, RW, SEG, C, LEN, SEAM, "Overlap", true, MP, false);
  let ok = true;
  tiles.forEach((t, i) => {
    const rr = Math.floor(i / C);
    const expected = (rr > 0 ? 2 : 0) + (rr < R - 1 ? 2 : 0);
    if (t.paths.length !== expected) ok = false;
    for (const p of t.paths) {
      if (p.layer !== MP) ok = false;
      if (Math.abs(len(p.pts) - 4) > 1e-9) ok = false;
      const y = p.pts[0][1];
      if (!(Math.abs(y) < 1e-9 || Math.abs(y - t.H) < 1e-9)) ok = false;
      const xs = p.pts.map(([x]) => x);
      const onEdge = Math.min(...xs) < 1e-9 || Math.max(...xs) > RW - 1e-9;
      if (!onEdge) ok = false;
    }
  });
  check("registration ticks: internal boundaries, both edges, mark pen, 4 mm", ok);
}

/* 7. labels: S/P strokes present on mark pen for every piece */
{
  const MP = 5;
  const tiles = sliceRoll({ paths: [] }, RW, SEG, C, LEN, SEAM, "Overlap", false, MP, true);
  const ok = tiles.every((t) => t.paths.length > 0 && t.paths.every((p) => p.layer === MP && p.pts.length >= 2));
  check("labels: S/P strokes on mark pen in every piece", ok);
}

/* 8. closed path split: a closed square straddling a piece boundary comes back
      as open runs whose summed length equals the square's clipped perimeter */
{
  const sq = [[100, 700], [300, 700], [300, 900], [100, 900]];
  const ps = { paths: [{ pts: sq, closed: true, layer: 1 }] };
  const tiles = sliceRoll(ps, RW, SEG, C, LEN, SEAM, "Overlap", false, 0, false);
  let total = 0, anyClosed = false;
  tiles.forEach((t) => t.paths.forEach((p) => { total += len(p.pts); if (p.closed) anyClosed = true; }));
  check("closed square across a boundary: perimeter preserved", Math.abs(total - 800) < 1e-6, `${total} vs 800`);
  check("straddling square emitted as open runs", !anyClosed);
}

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
