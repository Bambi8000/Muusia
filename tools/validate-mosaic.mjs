/* Validator for the Mosaic node (key mosaic).
   Run from the repo root: node tools/validate-mosaic.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "mosaic";

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

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const CTX = { W: 297, H: 210 };
const run = (p, shape, ctx) => def.compute([shape, undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const byPen = (r, pen) => r.paths.filter((q) => q.layer === pen);
const circ = (cx, cy, r, n = 96) => { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
const RING = { cx: 148, cy: 105, ro: 55, ri: 26 };
const ring = { paths: [{ pts: circ(RING.cx, RING.cy, RING.ro), closed: true, layer: 0 }, { pts: circ(RING.cx, RING.cy, RING.ri), closed: true, layer: 0 }] };
const disc = { paths: [{ pts: circ(148, 105, 40), closed: true, layer: 0 }] };
const centroid = (pts) => [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
const area = (pts) => { let A = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) A += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return Math.abs(A) / 2; };
const F0 = def._frame(p0, CTX);
const fc = Math.max(0.3, Math.min(1, p0.tile / 8));
const tol = fc * 1.5;

/* ---------------------------------------------------------- universal (no input) */
const r0 = run(p0, undefined), r0b = run(p0, undefined);
ok(JSON.stringify(r0) === JSON.stringify(r0b), "deterministic (double run byte-identical)");
ok(r0.paths.length > 0, "non-empty with nothing wired (" + r0.paths.length + " tiles, " + npts(r0) + " pts)");
ok(finiteAll(r0), "all coordinates finite");
ok(r0.paths.every((q) => q.pts.length >= 3 && q.closed), "Tiles: every path is a closed polygon with >= 3 points");
ok(r0.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r0) < 120000, "point budget with nothing wired");
const inMargin = (r, m, W, Hh, t) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - t && x <= W - m + t && y >= m - t && y <= Hh - m + t));
ok(inMargin(r0, p0.margin, 297, 210, 0.01), "everything inside the margin box");
ok(inMargin(run(p0, ring), p0.margin, 297, 210, 0.01), "with a figure: still inside the margin box");
ok(inMargin(run(p0, ring, { W: 210, H: 297 }), p0.margin, 210, 297, 0.01), "A4 tall: inside the margin box");

/* ---------------------------------------------------------- ground grid */
{
  ok(r0.paths.length === F0.nx * F0.ny, "no input: one tile per grid cell (" + F0.nx + " x " + F0.ny + " = " + r0.paths.length + ")");
  const outer = byPen(r0, p0.penOuter).length, inner = byPen(r0, p0.penInner).length, ground = byPen(r0, p0.penGround).length;
  ok(outer === 2 * (F0.nx + F0.ny) - 4, "outer border row = perimeter cells (" + outer + ")");
  ok(inner === 2 * (F0.nx - 2 + F0.ny - 2) - 4, "inner border row = second ring (" + inner + ")");
  ok(ground === (F0.nx - 4) * (F0.ny - 4), "ground tiles = the rest (" + ground + ")");
  /* grid fit: the tiles span the whole box less half a grout each side */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of r0.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  ok(Math.abs(x0 - (p0.margin + p0.grout / 2)) < tol && Math.abs(x1 - (297 - p0.margin - p0.grout / 2)) < tol && Math.abs(y0 - (p0.margin + p0.grout / 2)) < tol && Math.abs(y1 - (210 - p0.margin - p0.grout / 2)) < tol, "Grid fit: tiles reach the box edges less Grout/2 on every side");
  /* every ground tile is a near-square of (tx - grout) x (ty - grout) */
  const areas = r0.paths.map((q) => area(q.pts)).sort((a, b) => a - b);
  const med = areas[areas.length >> 1], expect = (F0.tx - p0.grout) * (F0.ty - p0.grout);
  ok(Math.abs(med - expect) / expect < 0.15 && areas[0] > expect * 0.6, "tile areas match (Tile - Grout)^2 (median " + med.toFixed(2) + " vs " + expect.toFixed(2) + " mm2, min " + areas[0].toFixed(2) + ")");
  ok(run({ ...p0, borderRows: 0 }, undefined).paths.every((q) => q.layer === p0.penGround), "Border rows 0: everything on the ground pen");
  const r1b = run({ ...p0, borderRows: 1 }, undefined);
  ok(byPen(r1b, p0.penOuter).length === outer && byPen(r1b, p0.penInner).length === 0, "Border rows 1: outer row only");
  const rNo = run({ ...p0, ground: "None" }, ring);
  ok(rNo.paths.length > 0 && rNo.paths.every((q) => q.layer === p0.penFig), "Ground None: figure tiles only");
  ok(run({ ...p0, ground: "None" }, undefined).paths.length === 0, "Ground None with nothing wired -> EMPTY");
  ok(run({ ...p0, fcell: 0.4 }, undefined).paths.length === run({ ...p0, fcell: 0.9 }, undefined).paths.length, "tile count is independent of the raster resolution");
  const nf = run({ ...p0, gridFit: false }, undefined);
  ok(nf.paths.length !== r0.paths.length || JSON.stringify(nf) !== JSON.stringify(r0), "Grid fit off changes the layout");
}

/* ---------------------------------------------------------- figure: contour rows on a ring */
const rr = run(p0, ring);
{
  const fig = byPen(rr, p0.penFig), gnd = rr.paths.filter((q) => q.layer !== p0.penFig);
  const dist = ([x, y]) => Math.hypot(x - RING.cx, y - RING.cy);
  ok(fig.length > 100, "figure tiles present (" + fig.length + ")");
  ok(fig.every((q) => q.pts.every((P) => dist(P) <= RING.ro + tol && dist(P) >= RING.ri - tol)), "every figure tile lies inside the ring");
  ok(gnd.every((q) => q.pts.every((P) => dist(P) >= RING.ro - tol || dist(P) <= RING.ri + tol)), "every ground tile lies outside the ring (also inside the hole)");
  ok(gnd.some((q) => q.pts.every((P) => dist(P) < RING.ri)), "ground grid continues inside the hole");
  /* grout gap: no figure vertex within grout*0.3 of the outline, no ground vertex either */
  const gz = p0.grout * 0.3;
  ok(fig.every((q) => q.pts.every((P) => dist(P) < RING.ro - gz && dist(P) > RING.ri + gz)) && gnd.every((q) => q.pts.every((P) => dist(P) > RING.ro + gz || dist(P) < RING.ri - gz)), "grout gap kept on both sides of the outline");
  /* rows: figure tile centroids fall into bands of Tile from either boundary */
  const radii = fig.map((q) => dist(centroid(q.pts)));
  const bandsOuter = new Set(radii.filter((d) => RING.ro - d < (RING.ro - RING.ri) / 2).map((d) => Math.floor((RING.ro - d) / p0.tile)));
  const bandsInner = new Set(radii.filter((d) => d - RING.ri < (RING.ro - RING.ri) / 2).map((d) => Math.floor((d - RING.ri) / p0.tile)));
  ok(bandsOuter.size >= 3 && bandsInner.size >= 3, "rows counted from both the outer and the hole boundary (" + bandsOuter.size + " + " + bandsInner.size + " bands)");
  /* pitch: in band 0 of the outer rim the number of tiles ~ perimeter / pitch */
  const rim = fig.filter((q) => RING.ro - dist(centroid(q.pts)) < p0.tile);
  const expectRim = Math.round((2 * Math.PI * RING.ro - 2 * Math.PI * 0.5 * p0.tile) / (p0.tile * p0.aspect));
  ok(Math.abs(rim.length - expectRim) <= 2, "outer row tile count = perimeter / pitch (" + rim.length + " vs " + expectRim + ")");
  const medA = fig.map((q) => area(q.pts)).sort((a, b) => a - b)[fig.length >> 1];
  const expA = (p0.tile - p0.grout) * (p0.tile * p0.aspect - p0.grout);
  ok(Math.abs(medA - expA) / expA < 0.35, "figure tile median area near (Tile - Grout) x (Pitch - Grout) (" + medA.toFixed(2) + " vs " + expA.toFixed(2) + ")");
  /* aspect: longer tiles -> fewer tiles in the rim */
  const rA = run({ ...p0, aspect: 2 }, ring);
  const rimA = byPen(rA, p0.penFig).filter((q) => RING.ro - dist(centroid(q.pts)) < p0.tile).length;
  ok(rimA < rim.length * 0.65, "Aspect 2 halves the rim tile count (" + rimA + " vs " + rim.length + ")");
  /* no two tiles overlap: centroid of each tile is not inside any other tile */
  const pip = (x, y, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const yi = poly[a][1], yj = poly[b][1]; if ((yi > y) !== (yj > y)) { const xi = poly[a][0], xj = poly[b][0]; if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } } return c; };
  let overlaps = 0;
  const cents = fig.map((q) => centroid(q.pts));
  for (let i = 0; i < fig.length; i++) for (let j = 0; j < fig.length; j++) { if (i === j) continue; if (Math.hypot(cents[i][0] - cents[j][0], cents[i][1] - cents[j][1]) > p0.tile * 3) continue; if (pip(cents[i][0], cents[i][1], fig[j].pts)) overlaps++; }
  ok(overlaps === 0, "figure tiles do not overlap (no centroid inside another tile)");
}

/* ---------------------------------------------------------- figure styles */
{
  const dist = ([x, y]) => Math.hypot(x - RING.cx, y - RING.cy);
  const rf = run({ ...p0, figStyle: "Fan" }, ring);
  const fig = byPen(rf, p0.penFig);
  ok(fig.length > 100 && fig.every((q) => q.pts.every((P) => dist(P) <= RING.ro + tol && dist(P) >= RING.ri - tol)), "Fan: figure tiles inside the ring (" + fig.length + ")");
  /* Fan rings are concentric about the centre: centroid radii cluster at (k + 0.5) Tile */
  const off = fig.map((q) => { const d = dist(centroid(q.pts)); return Math.abs(d / p0.tile - Math.floor(d / p0.tile) - 0.5); });
  const good = off.filter((o) => o < 0.25).length;
  ok(good / off.length > 0.8, "Fan: tile centroids sit at ring centres (" + Math.round(100 * good / off.length) + " %)");
  const rg = run({ ...p0, figStyle: "Grid" }, ring);
  const gfig = byPen(rg, p0.penFig);
  ok(gfig.length > 100 && gfig.every((q) => q.pts.every((P) => dist(P) <= RING.ro + tol && dist(P) >= RING.ri - tol)), "Grid: figure tiles inside the ring, clipped (" + gfig.length + ")");
  /* Grid figure tiles align with the ground grid: interior tiles share x-edges with ground tiles */
  const xs = new Set(byPen(rg, p0.penGround).flatMap((q) => q.pts.map((P) => Math.round(P[0] * 2) / 2)));
  const aligned = gfig.filter((q) => q.pts.every((P) => xs.has(Math.round(P[0] * 2) / 2) || dist(P) > RING.ro - p0.tile || dist(P) < RING.ri + p0.tile)).length;
  ok(aligned / gfig.length > 0.7, "Grid: figure tiles align with the ground grid (" + Math.round(100 * aligned / gfig.length) + " %)");
  const rn = run({ ...p0, figStyle: "None" }, ring);
  const nfig = byPen(rn, p0.penFig);
  ok(nfig.length === 2 && nfig.every((q) => q.closed), "None: the figure is one blank tile (outer + hole outline)");
  ok(JSON.stringify(rf) !== JSON.stringify(rr) && JSON.stringify(rg) !== JSON.stringify(rr), "styles differ");
  const rd = run(p0, disc);
  ok(byPen(rd, p0.penFig).length > 50 && byPen(rd, p0.penFig).every((q) => q.pts.every((P) => Math.hypot(P[0] - 148, P[1] - 105) <= 40 + tol)), "disc without hole: rows collide in the middle, all inside");
}

/* ---------------------------------------------------------- render modes */
{
  const rs = run({ ...p0, render: "Seams" }, ring), rt = rr, rb = run({ ...p0, render: "Both" }, ring);
  const len = (r) => r.paths.reduce((a, q) => a + H.pathLength(q.pts, q.closed), 0);
  const ratio = len(rs) / len(rt);
  ok(rs.paths.length > 0 && ratio > 0.4 && ratio < 0.8, "Seams plot roughly half the ink of Tiles (ratio " + ratio.toFixed(2) + ")");
  ok(rb.paths.length === rs.paths.length + rt.paths.length, "Both = Tiles + Seams");
  ok(rs.paths.some((q) => q.layer === p0.penFig) && rs.paths.some((q) => q.layer === p0.penGround), "Seams carry figure and ground pens");
  const s0 = run({ ...p0, render: "Seams", smooth: 0 }, undefined);
  ok(JSON.stringify(run({ ...p0, render: "Seams", smooth: 0 }, ring)) !== JSON.stringify(run({ ...p0, render: "Seams", smooth: 2 }, ring)), "Smooth changes curved seam geometry");
  const s2 = run({ ...p0, render: "Seams", smooth: 2 }, undefined);
  ok(s2.paths.every((q) => q.pts.length <= 3) && Math.abs(s2.paths.reduce((a, q) => a + H.pathLength(q.pts, false), 0) - s0.paths.reduce((a, q) => a + H.pathLength(q.pts, false), 0)) < 1, "Smooth leaves straight grid seams straight (same total length)");
  /* smooth 0 on a plain grid: seams are straight lines -> tiny point counts */
  ok(s0.paths.every((q) => q.pts.length <= 3), "Smooth 0 straight grid seams simplify to 2-3 points");
}

/* ---------------------------------------------------------- irregularity / seed */
{
  ok(JSON.stringify(run({ ...p0, seed: 1 }, ring)) === JSON.stringify(run({ ...p0, seed: 99 }, ring)), "Irregularity 0: seed-independent");
  const a = run({ ...p0, irregular: 0.6, seed: 1 }, ring), b = run({ ...p0, irregular: 0.6, seed: 99 }, ring);
  ok(JSON.stringify(a) !== JSON.stringify(b), "Irregularity 0.6: seed changes the cuts");
  ok(Math.abs(a.paths.length - rr.paths.length) < rr.paths.length * 0.25, "irregular layout keeps roughly the same tile count (" + a.paths.length + " vs " + rr.paths.length + ")");
  ok(inMargin(a, p0.margin, 297, 210, 0.01) && finiteAll(a), "irregular output finite and inside the box");
}

/* ---------------------------------------------------------- pens / params */
{
  const rp = run({ ...p0, penFig: 4, penGround: 5, penOuter: 6, penInner: 7 }, ring);
  ok(new Set(rp.paths.map((q) => q.layer)).size === 4 && [4, 5, 6, 7].every((v) => rp.paths.some((q) => q.layer === v)), "four pens route correctly");
  const bJ = JSON.stringify(rr);
  const diff = (patch, label, shape = ring) => ok(JSON.stringify(run({ ...p0, ...patch }, shape)) !== bJ, "param live: " + label);
  diff({ tile: 6 }, "tile");
  diff({ aspect: 1.5 }, "aspect");
  diff({ grout: 1.2 }, "grout");
  diff({ figStyle: "Fan" }, "figStyle");
  diff({ stagger: false }, "stagger");
  diff({ ground: "None" }, "ground");
  diff({ gridFit: false }, "gridFit");
  diff({ borderRows: 0 }, "borderRows");
  diff({ irregular: 0.5 }, "irregular");
  diff({ render: "Seams" }, "render");
  diff({ smooth: 3 }, "smooth");
  diff({ fcell: 0.9 }, "fcell");
  diff({ minTile: 3 }, "minTile");
  diff({ margin: 20 }, "margin");
  diff({ irregular: 0.5, seed: 3 }, "seed (with irregularity)");
  diff({ penFig: 1 }, "penFig");
  diff({ penGround: 1 }, "penGround");
  diff({ penOuter: 1 }, "penOuter");
  diff({ penInner: 1 }, "penInner");
  for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt }, ring);
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
  ok(byPen(run({ ...p0, minTile: 3 }, ring), p0.penFig).length < byPen(rr, p0.penFig).length, "Min tile drops small figure tiles");
}

/* ---------------------------------------------------------- degenerate / extreme */
ok(finiteAll(run({ ...p0, tile: 0, grout: -1, aspect: 0, borderRows: -2, irregular: 5, smooth: 9, fcell: -1, minTile: -1, margin: -5 }, ring)), "degenerate params produce no NaN");
ok(run(p0, { paths: [{ pts: [[10, 10], [50, 10]], closed: false, layer: 0 }] }).paths.length === r0.paths.length, "open input paths are ignored (ground only)");
{
  const t0 = Date.now(); run(p0, ring); const d = Date.now() - t0;
  ok(d < 2500, "defaults with a figure compute in " + d + " ms");
  const t1 = Date.now();
  const ext = run({ ...p0, tile: 3, borderRows: 3, irregular: 0.5, render: "Both", smooth: 3 }, ring, { W: 594, H: 420 });
  const d1 = Date.now() - t1;
  ok(finiteAll(ext) && npts(ext) <= 120000 && inMargin(ext, p0.margin, 594, 420, 0.01), "A2 / 3 mm tiles / Both: finite, on-sheet, budget held (" + npts(ext) + " pts)");
  ok(d1 < 12000, "A2 case computes in " + d1 + " ms");
}
{
  const huge = { paths: [{ pts: circ(148, 105, 400, 64), closed: true, layer: 0 }] };
  const rh = run(p0, huge);
  ok(rh.paths.length > 100 && rh.paths.every((q) => q.layer === p0.penFig) && finiteAll(rh), "outline entirely off-sheet: the figure fills the box with contour rows (" + rh.paths.length + " tiles)");
  /* band wobble: with Irregularity the centroid radii leave the band centres */
  const dist = ([x, y]) => Math.hypot(x - RING.cx, y - RING.cy);
  const frac = (r) => { const fig = byPen(r, p0.penFig).filter((q) => RING.ro - dist(centroid(q.pts)) < p0.tile * 2.5); const n = fig.filter((q) => { const d = RING.ro - dist(centroid(q.pts)); return Math.abs(d / p0.tile - Math.floor(d / p0.tile) - 0.5) < 0.15; }).length; return n / fig.length; };
  ok(frac(rr) > frac(run({ ...p0, irregular: 0.8 }, ring)) + 0.1, "Irregularity wobbles the rows (band-centre fraction " + frac(rr).toFixed(2) + " -> " + frac(run({ ...p0, irregular: 0.8 }, ring)).toFixed(2) + ")");
}
ok(finiteAll(run(p0, undefined, { W: 20, H: 20 })), "20 x 20 mm canvas: finite");
ok(run(p0, ring, { W: 20, H: 20 }).paths.length >= 1, "tiny canvas still yields tiles");

/* ---------------------------------------------------------- showIf / overlay */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(vis(p0).includes("stagger") && !vis({ ...p0, figStyle: "Grid" }).includes("stagger"), "Stagger only for Contour rows / Fan");
  ok(!vis({ ...p0, borderRows: 0 }).includes("penOuter") && !vis({ ...p0, borderRows: 1 }).includes("penInner"), "border pens follow Border rows");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "hidden params carry defaults");
  const g = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g) && g.length === 2 && g[0].kind === "rect" && g[1].w < g[0].w, "overlay: margin box + inner box after the border rows");
  ok(def.overlay({ ...p0, borderRows: 0 }, CTX).length === 1, "no border rows -> margin box only");
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }); def.overlay.call(undefined, p0, CTX); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
