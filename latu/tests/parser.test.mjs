import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseGcode } from "../src/parser.js";

const servoUrl = new URL("./fixtures/servo-z.gcode", import.meta.url);

test("servo state creates strokes, sections, travels, and a PAUSE pen change", async () => {
  const doc = parseGcode(await readFile(servoUrl, "utf8"));
  assert.equal(doc.meta.zMode, "servo");
  assert.equal(doc.strokes.length, 2);
  assert.equal(doc.sections.length, 2);
  assert.equal(doc.sections[1].penIndex, 7);
  assert.ok(doc.travels.length >= 2);
  assert.equal(doc.events.find((event) => event.kind === "pen-change")?.comment, "CHANGE PEN -> 7: Magenta");
  assert.equal(Math.round(doc.stats.drawLength), 60);
});

test("patch 21 servo-Z fixture has the expected program structure", async () => {
  const source = await readFile(new URL("./fixtures/servo-z-patch-21.gcode", import.meta.url), "utf8");
  const doc = parseGcode(source);
  assert.equal(doc.strokes.length, 51);
  assert.deepEqual(doc.sections.map((section) => [section.penIndex, section.strokeIds.length]), [[0, 46], [7, 5]]);
  assert.deepEqual(doc.events.map((event) => event.kind), ["pen-change"]);
  assert.equal(doc.warnings.unknownCount, 0);
});

test("flipping servo up/down metadata inverts the state-machine result", async () => {
  const source = await readFile(servoUrl, "utf8");
  const untagged = source.replace(/(SET_SERVO[^\n;]+)\s*;[^\n]*/g, "$1");
  const flipped = untagged.replace("up 135° / down 80°", "up 80° / down 135°");
  assert.equal(parseGcode(flipped).strokes.length, 0);
});

test("bed-Z brush pressure stays attached to points", async () => {
  const source = await readFile(new URL("./fixtures/bed-z.gcode", import.meta.url), "utf8");
  const doc = parseGcode(source, { zMode: "bed", penUp: 3, penDown: 0, zHop: 1.5, zHopOn: true });
  assert.equal(doc.strokes.length, 1);
  assert.deepEqual(doc.strokes[0].pts.map((point) => point[2]), [0, -0.5, 0.2]);
});

test("dip delimiters form one atomic event block", async () => {
  const source = await readFile(new URL("./fixtures/events.gcode", import.meta.url), "utf8");
  const doc = parseGcode(source);
  const dip = doc.events.find((event) => event.kind === "dip");
  assert.ok(dip);
  assert.ok(dip.lineEnd > dip.lineStart);
  assert.equal(doc.blocks.find((block) => block.kind === "dip")?.unbalanced, undefined);
});
