import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGcode } from "../src/parser.js";
import { buildTimeline, formatPlaybackTime, sampleTimeline } from "../src/sim.js";

const profile = { zMode: "servo", servoName: "pen", servoUp: 90, servoDown: 30, penDelayDown: 200, penDelayUp: 100, feedDraw: 600, feedTravel: 600 };
const source = `G21
G90
SET_SERVO SERVO=pen ANGLE=90 ; pen up
G0 X0 Y0 F600
SET_SERVO SERVO=pen ANGLE=30 ; pen down
G1 X60 Y0 F600
G4 P1000
SET_SERVO SERVO=pen ANGLE=90 ; pen up
M0 ; CHANGE PEN -> 1: Blue
G0 X60 Y60 F600
SET_SERVO SERVO=pen ANGLE=30 ; pen down
G1 X0 Y60 F600
SET_SERVO SERVO=pen ANGLE=90 ; pen up
`;

test("timeline combines feed motion, dwell, implicit settle, and pause chapters", () => {
  const timeline = buildTimeline(parseGcode(source, profile), profile);
  assert.ok(Math.abs(timeline.total - 19.6) < 1e-9);
  assert.equal(timeline.chapters.length, 1);
  assert.ok(Math.abs(timeline.chapters[0].time - 7.3) < 1e-9);
  assert.deepEqual(timeline.perPen.map((pen) => [pen.penIndex, Number(pen.total.toFixed(1))]), [[0, 7.3], [1, 12.3]]);
});

test("explicit settle dwell is not doubled by the profile delay", () => {
  const doc = parseGcode(`SET_SERVO SERVO=pen ANGLE=90 ; pen up\nSET_SERVO SERVO=pen ANGLE=30 ; pen down\nG4 P200\n`, profile);
  assert.equal(buildTimeline(doc, profile).total, .2);
});

test("timeline sampling interpolates tool position and reports the active line", () => {
  const timeline = buildTimeline(parseGcode(source, profile), profile);
  const draw = timeline.steps.find((step) => step.kind === "draw");
  const sample = sampleTimeline(timeline, draw.start + draw.duration / 2);
  assert.deepEqual(sample.position.slice(0, 2), [30, 0]);
  assert.equal(sample.lineIndex, draw.lineIndex);
  assert.equal(sample.progress, .5);
});

test("playback time formatting supports minute and hour timelines", () => {
  assert.equal(formatPlaybackTime(65), "1:05");
  assert.equal(formatPlaybackTime(3661), "1:01:01");
});
