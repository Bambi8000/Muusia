import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { fontStrokes } from "../src/defs/helpers.js";
import { createSurfaceSession, readSurfaceSession, readSurfaceLayouts, updateSurfaceStrip } from "../src/surface-session.js";
import { stripTransform, stripCorners } from "../src/surface-composer.js";
import { compositionSettings, compositionGeometry, generateComposition, updateComposition, regularCompositionMatches, compositionPieces } from "../src/surface-layouts.js";
import { surfaceVectorTiles, surfaceVectorFiles } from "../src/surface-vector-export.js";
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
function slicer(name) {
  const start = app.indexOf(`function ${name}(`), brace = app.indexOf("{", start);
  let end = brace, depth = 0;
  for (; end < app.length; end++) { if (app[end] === "{") depth++; else if (app[end] === "}" && !--depth) break; }
  return new Function("fontStrokes", `return (${app.slice(start, end + 1)})`)(fontStrokes);
}
const services = { sliceMega: slicer("sliceMega"), sliceRoll: slicer("sliceRoll"), fontStrokes };
const scene = { paths: [{ pts: [[0, 20], [4000, 1800]], closed: false, layer: 2 }, { pts: [[100, 0], [100, 4000]], layer: 1 }] };

test("sheet/roll objects follow actual legacy dimensions and separate physical roll from pieces", () => {
  for (const family of ["Sheets", "Roll"]) for (const join of ["Overlap", "Gap"]) {
    const p = compositionSettings({ join, rollLengthMm: 2000, pieceLengthMm: 700 });
    const g = compositionGeometry(family, p), roll = family === "Roll", sign = join === "Gap" ? 1 : -1;
    assert.equal(g.widthMm, roll ? 2 * 530 + sign * 5 : 2 * 300 + sign * 5);
    assert.equal(g.heightMm, roll ? 2000 : 2 * 200 + sign * 5);
    assert.equal(g.strips.length, roll ? 2 : 4);
    if (roll) assert.ok(g.strips.every(s => s.lengthMm === 2000));
    assert.deepEqual(stripCorners(g.strips[0])[0], [0, 0]);
  }
});

test("regular vector output delegates byte-equivalent path geometry to actual sliceMega/sliceRoll", () => {
  for (const family of ["Sheets", "Roll"]) for (const join of ["Overlap", "Gap"]) for (const marks of [false, true]) {
    const s = generateComposition(createSurfaceSession(), family, { join, marks, labels: true, rollLengthMm: 2000, pieceLengthMm: 700 });
    const p = s.composition.settings, tiles = surfaceVectorTiles(s, scene, services);
    const old = family === "Sheets" ? services.sliceMega(scene, 300, 200, 2, 2, 5, join, marks, 0, true) : services.sliceRoll(scene, 530, 700, 2, 2000, 5, join, marks, 0, true);
    assert.equal(tiles.length, old.length);
    tiles.forEach((t, i) => assert.deepEqual(t.paths, old[i].paths));
    assert.equal(p.join, join);
  }
});

test("generator drafts preserve manual papers until Generate; regeneration is a separate snapshot", () => {
  const initial = generateComposition(createSurfaceSession(), "Sheets");
  const moved = updateSurfaceStrip(initial, initial.strips[0].id, { centerXmm: 410, rotationDeg: 45 });
  assert.equal(moved.mode, "freeform"); assert.equal(regularCompositionMatches(moved), false);
  const draft = updateComposition(moved, { columns: 3, seamMm: 8 });
  assert.deepEqual(draft.strips, moved.strips); assert.deepEqual(draft.composition.generated, initial.composition.generated);
  const regenerated = generateComposition(draft);
  assert.equal(regenerated.strips.length, 6); assert.equal(regenerated.mode, "tiling"); assert.ok(regularCompositionMatches(regenerated));
  assert.equal(moved.strips[0].rotationDeg, 45, "Previous snapshot remains available to Undo");
});

test("independent sheet/roll project slots retain freeform geometry and old projects get empty slots", () => {
  let sheets = generateComposition(createSurfaceSession(), "Sheets"), roll = generateComposition(createSurfaceSession(), "Roll");
  sheets = updateSurfaceStrip(sheets, sheets.selectedId, { rotationDeg: 137 });
  roll = updateSurfaceStrip(roll, roll.selectedId, { rotationDeg: 45, lengthMm: 2100 });
  const layouts = { version: 1, Sheets: sheets, Roll: roll };
  assert.deepEqual(readSurfaceLayouts(JSON.parse(JSON.stringify(layouts))), layouts);
  assert.deepEqual(readSurfaceLayouts(), { version: 1, Sheets: null, Roll: null });
  assert.throws(() => readSurfaceLayouts({ ...layouts, Roll: sheets }), /family/);
  assert.throws(() => readSurfaceLayouts({ version: 99 }));
  assert.throws(() => readSurfaceLayouts({ ...layouts, Sheets: { ...sheets, composition: { ...sheets.composition, generated: { ...sheets.composition.generated, sheetWidthMm: 4, seamMm: 5 } } } }), /Overlap/);
  const inconsistent = { ...sheets, mode: "tiling" };
  assert.equal(readSurfaceSession(inconsistent).mode, "freeform", "A stale grid flag cannot silently use regular exports");
});

test("freeform sheets preserve global mapping, depth, pen and maintenance in local exports", () => {
  for (const angle of [0, 45, 90, 137]) {
    let s = generateComposition(createSurfaceSession(), "Sheets", { marks: false });
    const paper = { ...s.strips[0], centerXmm: 500, centerYmm: 500, rotationDeg: angle };
    s = { ...s, mode: "freeform", strips: [paper], selectedId: paper.id };
    const transform = stripTransform(paper), pts = [[20, 30, -1], [250, 160, -2]];
    const global = { paths: [{ pts: pts.map(transform.toGlobal), layer: 4, closed: false, maintain: true }] };
    const [tile] = surfaceVectorTiles(s, global, services);
    tile.paths[0].pts.forEach((p, i) => p.forEach((n, k) => assert.ok(Math.abs(n - pts[i][k]) < 1e-8)));
    assert.equal(tile.paths[0].layer, 4); assert.equal(tile.paths[0].maintain, true);
  }
});

test("rotated freeform roll is cut only in local Y, with continuous joins and a short last piece", () => {
  let s = generateComposition(createSurfaceSession(), "Roll", { rollWidthMm: 80, rollLengthMm: 2300, pieceLengthMm: 800, marks: false });
  const paper = { ...s.strips[0], centerXmm: 1500, centerYmm: 1500, rotationDeg: 37 };
  s = { ...s, mode: "freeform", strips: [paper], selectedId: paper.id };
  const transform = stripTransform(paper), global = { paths: [{ pts: [[40, 0, -1], [40, 2300, -2]].map(transform.toGlobal), layer: 2 }] };
  const tiles = surfaceVectorTiles(s, global, services);
  assert.deepEqual(tiles.map(t => t.H), [800, 800, 700]); assert.deepEqual(tiles.map(t => t.fromMm), [0, 800, 1600]);
  assert.equal(compositionPieces(s, paper).length, 3);
  const lengths = tiles.map(t => Math.hypot(...t.paths[0].pts.at(-1).slice(0, 2).map((n, i) => n - t.paths[0].pts[0][i])));
  assert.ok(Math.abs(lengths.reduce((a, b) => a + b, 0) - 2300) < 1e-7);
  for (const tile of tiles) for (const point of tile.paths[0].pts) { assert.ok(Math.abs(point[0] - 40) < 1e-8); assert.equal(point.length, 3); }
});

test("freeform ordering/hidden/selected filtering and marks use the physical paper ID", () => {
  let s = generateComposition(createSurfaceSession(), "Roll", { labels: true, marks: true, rollLengthMm: 1700 });
  s.mode = "freeform"; s.strips[0].visible = false; s.selectedId = s.strips[1].id;
  const tiles = surfaceVectorTiles(s, { paths: [] }, services, { selectedOnly: true });
  assert.equal(tiles.length, 3); assert.ok(tiles.every(t => t.stripId === s.selectedId && t.number === 2));
  assert.ok(tiles[0].paths.some(p => p.pts.every(([x]) => x >= 6) && p.pts.some(([, y]) => y > 780)), "Actual S2/P label strokes exist");
  assert.ok(tiles[0].paths.some(p => p.pts[0][0] === 0 && p.pts[0][1] === 800));
});

test("file export uses actual per-piece dimensions and rejects raster/vector confusion and excessive pieces", async () => {
  const s = generateComposition(createSurfaceSession(), "Roll", { rollLengthMm: 1700 }); s.mode = "freeform";
  const calls = [];
  const runtime = { ...services, evaluateGraph: () => ({ paths: [] }), exportText: (kind, ps, W, H) => { calls.push([kind, W, H]); return `${kind} ${W} ${H}`; } };
  const result = await surfaceVectorFiles(s, "svg", { selectedOnly: true, projectName: "test" }, runtime);
  assert.deepEqual(calls.map(c => c[2]), [800, 800, 100]); assert.equal(result.files.length, 3);
  s.source.kind = "image"; await assert.rejects(surfaceVectorFiles(s, "svg", {}, runtime), /graph output/);
  s.source.kind = "graph"; s.mode = "tiling"; s.composition.settings.pieceLengthMm = .1;
  await assert.rejects(surfaceVectorFiles(s, "svg", {}, runtime), /Too many/);
  assert.throws(() => compositionGeometry("Sheets", { sheetWidthMm: 4, seamMm: 5 }), /Overlap/);
});
