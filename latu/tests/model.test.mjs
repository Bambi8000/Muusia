import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { addStroke, auditDocument, copyStrokes, deletePoint, deleteSelection, finalizeForSave, insertMidpoint, joinAdjacentStrokes, movePoint, optimizeRoute, pasteAfterSelection, reverseStrokes, rotateStrokes, scaleStrokes, splitStroke, translateStrokes } from "../src/model.js";
import { parseGcode } from "../src/parser.js";

const fixture = await readFile(new URL("./fixtures/servo-z.gcode", import.meta.url), "utf8");

test("translate changes only the selected stroke geometry", () => {
  const before = parseGcode(fixture);
  const after = parseGcode(translateStrokes(before, [0], 5, -2));
  assert.deepEqual(after.strokes[0].pts[0].slice(0, 2), [15, 18]);
  assert.deepEqual(after.strokes[1].pts, before.strokes[1].pts);
});

test("reverse flips point order and preserves the stroke count", () => {
  const before = parseGcode(fixture);
  const after = parseGcode(reverseStrokes(before, [0]));
  assert.deepEqual(after.strokes[0].pts.map((point) => point.slice(0, 2)), [...before.strokes[0].pts].reverse().map((point) => point.slice(0, 2)));
  assert.equal(after.strokes.length, before.strokes.length);
});

test("delete removes an entire safe stroke block", () => {
  const after = parseGcode(deleteSelection(parseGcode(fixture), [0]));
  assert.equal(after.strokes.length, 1);
  assert.equal(after.sections[1].strokeIds.length, 1);
});

test("copy and paste duplicate complete stroke blocks", () => {
  const before = parseGcode(fixture);
  const fragment = copyStrokes(before, [0]);
  const after = parseGcode(pasteAfterSelection(before, fragment, [0]));
  assert.equal(after.strokes.length, 3);
});

test("insert midpoint and split remain valid servo programs", () => {
  const before = parseGcode(fixture);
  const withPoint = parseGcode(insertMidpoint(before, 0, before.strokes[0].pointLines[1]));
  assert.equal(withPoint.strokes[0].pts.length, before.strokes[0].pts.length + 1);
  const split = parseGcode(splitStroke(withPoint, 0, withPoint.strokes[0].pointLines[1]));
  assert.equal(split.strokes.length, before.strokes.length + 1);
});

test("fit-to-size preserves aspect ratio", () => {
  const before = parseGcode(fixture);
  const result = scaleStrokes(before, [0], { mode: "fit", width: 100, height: 50, margin: 0, preserveAspect: true, anchor: "origin" });
  const after = parseGcode(result.source);
  const xs = after.strokes[0].pts.map((point) => point[0]), ys = after.strokes[0].pts.map((point) => point[1]);
  assert.equal(Math.round(Math.max(...xs) - Math.min(...xs)), 50);
  assert.equal(Math.round(Math.max(...ys) - Math.min(...ys)), 50);
});

test("new stroke uses the active servo dialect", () => {
  const before = parseGcode(fixture);
  const after = parseGcode(addStroke(before, [[80, 80], [90, 90]], 0));
  assert.equal(after.strokes.length, before.strokes.length + 1);
  assert.deepEqual(after.strokes[1].pts.map((point) => point.slice(0, 2)), [[80, 80], [90, 90]]);
});

test("join removes the lift/travel/plunge gap between adjacent strokes", () => {
  const source = `; Z mode: SERVO "pen" — up 135° / down 80° (bed-Z untouched)\nSET_SERVO SERVO=pen ANGLE=135\nG0 X0 Y0 F3000\nSET_SERVO SERVO=pen ANGLE=80\nG1 X10 Y0 F1800\nSET_SERVO SERVO=pen ANGLE=135\nG0 X10 Y0 F3000\nSET_SERVO SERVO=pen ANGLE=80\nG1 X20 Y0 F1800\nSET_SERVO SERVO=pen ANGLE=135\n`;
  const before = parseGcode(source);
  const result = joinAdjacentStrokes(before, [0, 1]);
  assert.equal(result.error, null);
  assert.equal(parseGcode(result.source).strokes.length, 1);
});

test("join reverses the second stroke when its far end is the closest", () => {
  const source = `; Z mode: SERVO "pen" — up 135° / down 80° (bed-Z untouched)\nSET_SERVO SERVO=pen ANGLE=135\nG0 X0 Y0 F3000\nSET_SERVO SERVO=pen ANGLE=80\nG1 X10 Y0 F1800\nSET_SERVO SERVO=pen ANGLE=135\nG0 X20 Y0 F3000\nSET_SERVO SERVO=pen ANGLE=80\nG1 X10 Y0 F1800\nSET_SERVO SERVO=pen ANGLE=135\n`;
  const before = parseGcode(source); const result = joinAdjacentStrokes(before, [0, 1]); const after = parseGcode(result.source);
  assert.equal(result.error, null); assert.equal(after.strokes.length, 1); assert.deepEqual(after.strokes[0].pts.map((point) => point[0]), [0, 10, 20]);
});

test("route optimization preserves every stroke", async () => {
  const source = await readFile(new URL("./fixtures/servo-z-patch-21.gcode", import.meta.url), "utf8");
  const before = parseGcode(source); const result = optimizeRoute(before, before.sections[0].strokeIds); const after = parseGcode(result.source);
  assert.equal(result.error, null); assert.equal(after.strokes.length, before.strokes.length); assert.equal(after.warnings.unknownCount, 0);
});

test("scaling continuous E keeps dose proportional to segment length", () => {
  const source = `; Z mode: SERVO "pen" — up 135° / down 80° (bed-Z untouched)\nSET_SERVO SERVO=pen ANGLE=135\nG0 X0 Y0 F3000\nSET_SERVO SERVO=pen ANGLE=80\nG1 X10 Y0 E2 F1800\nSET_SERVO SERVO=pen ANGLE=135\n`;
  const before = parseGcode(source); const after = parseGcode(scaleStrokes(before, [0], { mode: "factor", sx: 2, sy: 2, anchor: "origin" }).source);
  assert.equal(after.lines[after.strokes[0].pointLines[1]].op.params.E, 4);
});

test("safety audit reports out-of-bounds geometry", () => {
  const doc = parseGcode(fixture); doc.meta.workW = 20; doc.meta.workH = 20;
  assert.ok(auditDocument(doc).some((warning) => warning.kind === "bounds"));
});

test("save finalization refreshes stats and adds one LATU marker", () => {
  const edited = parseGcode(translateStrokes(parseGcode(fixture), [0], 10, 0));
  const once = finalizeForSave(edited, "Servo A"), twice = finalizeForSave(parseGcode(once), "Servo A");
  assert.match(once, /^; edited with LATU v0\.1$/m);
  assert.equal((twice.match(/edited with LATU/g) || []).length, 1);
  assert.match(once, /^; Draw \d+\.\d{2} m, travel \d+\.\d{2} m/m);
  assert.match(once, /^; LATU profile: Servo A$/m);
});

test("numeric rotation uses the selection center", () => {
  const before = parseGcode(fixture); const after = parseGcode(rotateStrokes(before, [0], 90));
  const rounded = after.strokes[0].pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
  assert.deepEqual(rounded, [[30, 20], [30, 40], [10, 40]]);
});

test("point move and deletion relink a stroke", () => {
  const before = parseGcode(fixture);
  const moved = parseGcode(movePoint(before, 0, 1, 2, 3));
  assert.deepEqual(moved.strokes[0].pts[1].slice(0, 2), [32, 23]);
  const deleted = parseGcode(deletePoint(moved, 0, 1));
  assert.equal(deleted.strokes[0].pts.length, before.strokes[0].pts.length - 1);
});
