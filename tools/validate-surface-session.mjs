import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { parseAst } from "rolldown/parseAst";
import grid from "../src/defs/nodes/grid.js";
import arvo from "../src/defs/nodes/arvo.js";
import { EMPTY, Pin } from "../src/defs/helpers.js";
import { createSurfaceSession, readSurfaceSession, updateSurfaceLayout, updateSurfaceStrip, regenerateSurface, addSurfaceStrip, removeSurfaceStrip, evaluateSurfaceGraph, surfaceGraphLevel } from "../src/surface-session.js";

test("new sessions start with nominal 80 mm paper and physically checked 4.6 mm margins", () => {
  const s = createSurfaceSession();
  assert.equal(s.strips.length, 23);
  assert.equal(s.layout.physicalWidthMm, 80);
  assert.equal(s.layout.printableWidthMm, 70.8);
  assert.equal(s.layout.printableOffsetMm, 4.6);
  assert.deepEqual(readSurfaceSession(JSON.parse(JSON.stringify(s))), s);
  assert.notEqual(createSurfaceSession().strips, s.strips);
});

test("manual geometry, visibility and print order survive a project round trip", () => {
  const initial = createSurfaceSession(), before = JSON.stringify(initial);
  const edited = updateSurfaceStrip(initial, initial.strips[0].id, { centerXmm: -123, rotationDeg: 137, lengthMm: 3210, zIndex: 7, printOrder: 9, visible: false });
  assert.equal(edited.mode, "freeform");
  assert.equal(JSON.stringify(initial), before);
  const restored = readSurfaceSession(JSON.parse(JSON.stringify(edited)));
  assert.deepEqual(restored, edited);
  assert.equal(restored.strips[0].lengthMm, 3210);
});

test("generator settings do not replace manually edited objects until regeneration", () => {
  let s = createSurfaceSession();
  s = updateSurfaceStrip(s, s.strips[0].id, { rotationDeg: 137 });
  const strips = s.strips;
  s = updateSurfaceLayout(s, { rotationDeg: 90, gapMm: 12, count: 4, lengthMm: 5000 });
  assert.equal(s.strips, strips);
  assert.equal(s.strips[0].rotationDeg, 137);
  const next = regenerateSurface(s);
  assert.equal(next.mode, "tiling");
  assert.equal(next.strips.length, 4);
  assert.ok(next.strips.every(x => x.lengthMm === 5000 && x.rotationDeg === 90));
  assert.deepEqual(readSurfaceSession(JSON.parse(JSON.stringify(next))), next);
});

test("mode switches preserve objects, and invalid generator edits cannot enter project state", () => {
  const s = createSurfaceSession();
  const changed = { ...s, mode: "freeform" };
  assert.deepEqual(readSurfaceSession(changed).strips, s.strips);
  for (const patch of [{ physicalWidthMm: 60 }, { printableOffsetMm: -1 }, { count: 1.5 }, { gapMm: -2 }, { lengthMm: 0 }]) assert.throws(() => updateSurfaceLayout(s, patch));
  assert.equal(s.layout.physicalWidthMm, 80);
});

test("duplicate and add use persistent unique IDs independent of layer/print order", () => {
  const s = createSurfaceSession(), target = s.strips[0];
  const duplicated = addSurfaceStrip(s, target.id), copy = duplicated.strips.at(-1);
  assert.notEqual(copy.id, target.id);
  assert.equal(copy.centerXmm, target.centerXmm + 20);
  assert.equal(copy.centerYmm, target.centerYmm + 20);
  assert.equal(copy.zIndex, 23); assert.equal(copy.printOrder, 24);
  const collision = addSurfaceStrip({ ...duplicated, nextId: 1 });
  assert.equal(new Set(collision.strips.map(x => x.id)).size, collision.strips.length);
  assert.deepEqual(readSurfaceSession(JSON.parse(JSON.stringify(collision))), collision);
});

test("remove selects a remaining strip; an empty session can add a new strip", () => {
  let s = createSurfaceSession();
  for (const strip of s.strips) s = removeSurfaceStrip(s, strip.id);
  assert.equal(s.strips.length, 0); assert.equal(s.selectedId, null);
  assert.deepEqual(readSurfaceSession(s), s);
  s = addSurfaceStrip(s);
  assert.equal(s.strips.length, 1); assert.equal(s.selectedId, s.strips[0].id);
});

test("legacy projects reset surface state; malformed versions, geometry and IDs fail", () => {
  const s = createSurfaceSession();
  assert.deepEqual(readSurfaceSession(undefined), createSurfaceSession());
  for (const bad of [{ ...s, version: 99 }, { ...s, widthMm: 0 }, { ...s, mode: "unknown" }, { ...s, strips: [s.strips[0], s.strips[0]] }, { ...s, source: { ...s.source, graphPath: [null] } }]) assert.throws(() => readSurfaceSession(bad));
  assert.throws(() => updateSurfaceStrip(s, "missing", {}));
  assert.throws(() => updateSurfaceStrip(s, s.strips[0].id, { id: "other" }));
  assert.throws(() => addSurfaceStrip(s, "missing"));
  assert.throws(() => addSurfaceStrip({ ...s, nextId: Number.MAX_SAFE_INTEGER }), /exhausted/);
});

test("embedded image source persists at original dimensions and rejects remote/executable payloads", () => {
  const s = createSurfaceSession();
  const image = { width: 800, height: 600, name: "Original image", src: "data:image/png;base64,AA==" };
  const withImage = { ...s, source: { ...s.source, kind: "image", fit: "cover", image } };
  assert.deepEqual(readSurfaceSession(withImage).source.image, image);
  for (const img of [{ ...image, src: "https://example.org/image.png" }, { ...image, src: "data:image/svg+xml;base64,AA==" }, { ...image, width: 30000, height: 30000 }]) assert.throws(() => readSurfaceSession({ ...withImage, source: { ...withImage.source, image: img } }));
});

// Use the ACTUAL App evaluator and its pin/binding helpers, plus actual built-in
// node definitions. This verifies the integration contract without a mock engine.
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parseAst(app, { lang: "jsx" }, "src/App.jsx");
const functions = ["bindingType", "groupOutType", "defIns", "defOuts", "numericParams", "defaultFor", "evalLevel"];
const code = functions.map(name => {
  const fn = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name);
  assert.ok(fn, name); return app.slice(fn.start, fn.end);
}).join("\n");
const defs = ast.body.filter(n => n.type === "VariableDeclaration").flatMap(n => n.declarations).find(n => n.id.name === "DEFS");
const group = defs.init.properties.find(p => p.key?.name === "group").value;
const evaluate = new Function("NODES", "EMPTY", "Pin", `const SOLID_STYLE = {kind:'style',mode:'Solid'}; const DEFS = {...NODES, group: ${app.slice(group.start, group.end)}}; ${code}; return evalLevel;`)({ grid, arvo }, EMPTY, Pin);
const defaults = node => Object.fromEntries(node.params.map(p => [p.key, p.def]));

test("shared surface re-evaluates a real graph at full dimensions instead of scaling small output", () => {
  const root = { nodes: [{ id: 1, type: "grid", params: defaults(grid) }], edges: [] };
  const original = JSON.stringify(root);
  const { result } = evaluateSurfaceGraph(root, [], { W: 2000, H: 1000 }, evaluate);
  const pts = result.out[1][0].paths.flatMap(p => p.pts);
  assert.equal(Math.min(...pts.map(p => p[0])), 15);
  assert.equal(Math.max(...pts.map(p => p[0])), 1985);
  assert.equal(Math.max(...pts.map(p => p[1])), 985);
  assert.equal(JSON.stringify(root), original);
});

test("bound numeric inputs reach real nodes inside a selected group", () => {
  const data = { nodes: [{ id: 11, type: "grid", params: defaults(grid) }], edges: [], bindings: [{ nodeId: 11, port: "p:margin" }], outputId: 11 };
  const root = { nodes: [{ id: 1, type: "arvo", params: { v: 37 } }, { id: 2, type: "group", params: {}, data }], edges: [{ from: 1, fromPort: 0, to: 2, toPort: 0 }] };
  const { level, result } = evaluateSurfaceGraph(root, [2], { W: 2000, H: 1000 }, evaluate);
  assert.equal(level, data); assert.equal(result.pvals[11].margin, 37);
  assert.deepEqual(result.out[11][0].paths[0].pts[0], [37, 37]);
  assert.equal(surfaceGraphLevel(root, [2]), data);
  assert.equal(surfaceGraphLevel(root, [999]), null);
  assert.throws(() => evaluateSurfaceGraph(root, [999], { W: 2000, H: 1000 }, evaluate), /no longer exists/);
});
