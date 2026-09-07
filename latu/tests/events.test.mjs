import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { applyContinuousFeed, eventTemplate, insertEvent, removeContinuousFeed } from "../src/events.js";
import { parseGcode } from "../src/parser.js";
import { DEFAULT_PROFILE, loadProfiles, saveProfiles } from "../src/profile.js";

const source = await readFile(new URL("./fixtures/servo-z.gcode", import.meta.url), "utf8");
const profile = { ...DEFAULT_PROFILE, servoUp: 135, servoDown: 80, pauseCmd: "PAUSE", penDelayDown: 200, penDelayUp: 150 };

test("auto-lift pitstop inserted mid-stroke splits it safely", () => {
  const before = parseGcode(source, profile), selectedLine = before.strokes[0].pointLines[1];
  const after = parseGcode(insertEvent(before, profile, { kind: "pitstop", wrap: "auto", params: { message: "inspect" }, lineIndex: selectedLine }), profile);
  assert.equal(after.strokes.length, before.strokes.length + 1);
  assert.equal(after.events.find((event) => event.kind === "pitstop")?.comment, "TRAVEL STOP: inspect");
});

test("keep-state dose stays inside one stroke", () => {
  const before = parseGcode(source, profile), selectedLine = before.strokes[0].pointLines[1];
  const after = parseGcode(insertEvent(before, profile, { kind: "dose", wrap: "keep", params: { value: 8 }, lineIndex: selectedLine }), profile);
  assert.equal(after.strokes.length, before.strokes.length);
  assert.match(after.source, /INK_DOSE UL=8/);
});

test("raw relative dose adds one M83 modal and remains a dose event", () => {
  const before = parseGcode(source, profile), selectedLine = before.strokes[0].pointLines[1];
  const inserted = insertEvent(before, profile, { kind: "dose", wrap: "keep", params: { variant: "raw", value: 3, rate: 90, retract: .2 }, lineIndex: selectedLine });
  assert.equal(inserted.match(/^M83\b/gm)?.length, 1);
  assert.match(inserted, /G1 E3 F90/);
  assert.match(inserted, /G1 E-0\.2 F90 ; anti-drip/);
  assert.ok(parseGcode(inserted, profile).events.some((event) => event.kind === "dose"));
});

test("air macro is parsed as an air event", () => {
  const inserted = `${source}AIR_PULSE MS=400\n`;
  assert.ok(parseGcode(inserted, profile).events.some((event) => event.kind === "air"));
});

test("bed-Z event templates use Z commands instead of servo commands", () => {
  const bed = { ...profile, zMode: "bed", penUp: 3, penDown: 0, zFeed: 600 };
  assert.deepEqual(eventTemplate("pen-up", bed), ["G1 Z3 F600 ; pen up", "G4 P150 ; settle after lift"]);
});

test("continuous feed adds M83 and proportional E words, then removes both", () => {
  const before = parseGcode(source, profile);
  const fedSource = applyContinuousFeed(before, [0], .25), fed = parseGcode(fedSource, profile);
  assert.match(fedSource, /^M83 ; relative extrusion/m); assert.equal(fed.lines[fed.strokes[0].pointLines[1]].op.params.E, 5);
  const clean = removeContinuousFeed(fed, [0]);
  assert.doesNotMatch(clean, /^M83 ; relative extrusion/m); assert.doesNotMatch(clean, /\sE[-+.\d]/);
});

test("profile storage round-trips normalized machines", () => {
  const values = new Map(); const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  saveProfiles([{ ...profile, id: "test", name: "Test" }], storage);
  const loaded = loadProfiles(storage);
  assert.equal(loaded[0].name, "Test"); assert.equal(loaded[0].doseTemplate, DEFAULT_PROFILE.doseTemplate);
});
