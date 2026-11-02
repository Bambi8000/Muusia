import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseGcode } from "../src/parser.js";
import { combineGcodeSources, updatePenColor } from "../src/model.js";
import { buildContinuation, continuationFilename, resumeTargetForSelection } from "../src/resume.js";
import { DEFAULT_PROFILE } from "../src/profile.js";

const fixture = await readFile(new URL("./fixtures/servo-z.gcode", import.meta.url), "utf8");
const patch = await readFile(new URL("./fixtures/servo-z-patch-21.gcode", import.meta.url), "utf8");
const bed = await readFile(new URL("./fixtures/bed-z.gcode", import.meta.url), "utf8");
const profile = { ...DEFAULT_PROFILE, workW: 793, workH: 813 };
const point = (p) => p.map((value) => value == null ? value : Math.round(value * 1e6) / 1e6);
const drawing = (doc) => doc.strokes.flatMap((stroke) => stroke.pts.slice(1).map((end, i) => ({ from: stroke.pts[i], to: end, pen: stroke.penIndex, line: stroke.pointLines[i + 1] })));

test("continuation at every patch-21 segment keeps exactly the remaining drawing", () => {
  const doc = parseGcode(patch, profile), original = drawing(doc);
  for (const segment of original) for (const fraction of [0, 0.37, 1]) {
    const result = buildContinuation(doc, { lineIndex: segment.line, fraction }, profile);
    const expected = original.filter((item) => item.line > segment.line || item.line === segment.line && fraction < 1)
      .map((item) => ({ from: point(item.line === segment.line ? item.from.map((v, i) => v == null ? null : v + (item.to[i] - v) * fraction) : item.from), to: point(item.to), pen: item.pen }));
    if (!expected.length) { assert.match(result.error, /no drawing left/); continue; }
    assert.equal(result.error, null, `L${segment.line + 1} at ${fraction}: ${result.error}`);
    const resumed = parseGcode(result.source, profile);
    assert.deepEqual(drawing(resumed).map(({ from, to, pen }) => ({ from: point(from), to: point(to), pen })), expected);
    const firstXY = resumed.lines.find(({ op }) => op.kind === "move");
    assert.equal(firstXY.op.stateBefore, "up");
    assert.equal(firstXY.op.motionKind, "travel");
    assert.ok(resumed.lines.findIndex(({ op }) => op.kind === "servo" && op.stateAfter === "up") < resumed.lines.indexOf(firstXY));
    assert.ok(result.source.endsWith(doc.lines.slice(segment.line + (fraction === 1 ? 1 : 0)).map((line) => line.raw + line.ending).join("")), "suffix is unchanged");
  }
  assert.equal(doc.source, patch);
});

test("a text row includes its move, a canvas vertex skips its incoming segment", () => {
  const doc = parseGcode(fixture, profile), stroke = doc.strokes[0];
  assert.deepEqual(resumeTargetForSelection(doc, stroke.lineStart), { lineIndex: stroke.lineStart, fraction: 0 });
  assert.deepEqual(resumeTargetForSelection(doc, stroke.approachLine, [{ strokeId: 0, pointIndex: 0 }]), { lineIndex: stroke.lineStart, fraction: 0 });
  assert.deepEqual(resumeTargetForSelection(doc, stroke.lineStart, [{ strokeId: 0, pointIndex: 1 }]), { lineIndex: stroke.lineStart, fraction: 1 });
});

test("starting after a pen change restores the current pen without repeating the pause", () => {
  let doc = parseGcode(fixture, profile);
  doc = parseGcode(updatePenColor(doc, 7, "#ec4899"), profile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes[1].lineStart, fraction: 0 }, profile);
  assert.equal(result.error, null);
  const resumed = parseGcode(result.source, profile);
  assert.equal(resumed.strokes[0].penIndex, 7);
  assert.equal(resumed.sections[0].name, "Magenta");
  assert.equal(resumed.strokes[0].color, "#ec4899");
  assert.equal(resumed.events.filter((event) => event.kind === "pen-change").length, 0);
  assert.equal(resumed.meta.canvasW, 420);
});

test("future pen changes and end commands remain untouched", () => {
  const doc = parseGcode(fixture, profile), lineIndex = doc.strokes[0].lineStart;
  const result = buildContinuation(doc, { lineIndex, fraction: 0.5 }, profile);
  assert.equal(result.error, null);
  assert.equal(parseGcode(result.source, profile).events.filter((event) => event.kind === "pen-change").length, 1);
  assert.ok(result.source.endsWith("G0 X0 Y0\n; done\n"));
});

test("startup motion and arbitrary profile start code are not replayed", () => {
  const input = fixture.replace("G21 ; mm", "G28 ; home\nPLOT_GO\nPLOT_HEIGHT\n_GENTLE_JOB_ON\nG21 ; mm");
  const doc = parseGcode(input, profile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0 }, { ...profile, startG: "G28\nG92 X0 Y0" });
  assert.equal(result.error, null);
  assert.doesNotMatch(result.source, /^(?:G28|PLOT_GO|PLOT_HEIGHT|G92)\b/m);
  assert.match(result.source, /^_GENTLE_JOB_ON$/m);
  assert.deepEqual(result.omittedStartup.map((item) => item.command), ["G28", "PLOT_GO", "PLOT_HEIGHT"]);
});

test("source servo calibration takes precedence over a mismatched active profile", () => {
  const doc = parseGcode(fixture, profile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0.5 }, profile);
  assert.match(result.source, /SET_SERVO SERVO=pen ANGLE=135 ; pen up/);
  assert.match(result.source, /SET_SERVO SERVO=pen ANGLE=80 ; pen down/);
  assert.doesNotMatch(result.source, /ANGLE=(90|35)\b/);
});

test("hardware-agnostic PEN_UP/DOWN files keep their macros", () => {
  const input = fixture.replace(/SET_SERVO SERVO=pen ANGLE=135[^\n]*/g, "PEN_UP").replace(/SET_SERVO SERVO=pen ANGLE=80[^\n]*/g, "PEN_DOWN");
  const doc = parseGcode(input, profile), result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0.25 }, profile);
  assert.equal(result.error, null);
  assert.match(result.source, /^PEN_UP$/m); assert.match(result.source, /^PEN_DOWN$/m);
  assert.doesNotMatch(result.source, /^SET_SERVO/m);
});

test("bed-Z restart lifts first and restores interpolated pressure and drawing feed", () => {
  const bedProfile = { ...profile, zMode: "bed" }, doc = parseGcode(bed, bedProfile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineEnd, fraction: 0.5 }, bedProfile);
  assert.equal(result.error, null);
  const resumed = parseGcode(result.source, bedProfile);
  assert.match(result.source, /G1 Z3 F600 ; pen up/);
  assert.match(result.source, /G1 Z-0.15 F600 ; pen down/);
  assert.deepEqual(point(resumed.strokes[0].pts[0]), [15, 10, -0.15]);
  assert.equal(resumed.lines[resumed.strokes[0].lineStart].op.feed, 1800);
});

test("feed-only and Z moves update the modal feed used by continuation", () => {
  const input = fixture.replace("G1 X30 Y20 F1800", "G1 F1234\nG1 X30 Y20");
  const doc = parseGcode(input, profile), result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0.5 }, profile);
  assert.equal(result.error, null);
  assert.match(result.source, /G1 F1234 ; restore drawing feed/);
  const bedDoc = parseGcode(bed.replace("G1 X15 Y5 Z-0.5 F1800", "G1 X15 Y5 Z-0.5"), { ...profile, zMode: "bed" });
  assert.equal(bedDoc.lines[bedDoc.strokes[0].lineStart].op.feed, 600);
});

test("bed-Z continuation preserves positive and negative pressure along every move", () => {
  const bedProfile = { ...profile, zMode: "bed" }, doc = parseGcode(bed, bedProfile);
  for (const segment of drawing(doc)) for (const fraction of [0, 0.37, 0.9]) {
    const result = buildContinuation(doc, { lineIndex: segment.line, fraction }, bedProfile);
    assert.equal(result.error, null);
    const expected = segment.from.map((v, i) => v + (segment.to[i] - v) * fraction);
    assert.deepEqual(point(parseGcode(result.source, bedProfile).strokes[0].pts[0]), point(expected));
  }
});

test("file groups stay balanced when starting inside a combined file", () => {
  const combined = combineGcodeSources(parseGcode(fixture, profile), [{ name: "second.gcode", source: fixture }], profile, "first.gcode");
  const doc = parseGcode(combined.source, profile), lastGroup = doc.groups.at(-1);
  const target = { lineIndex: doc.strokes[lastGroup.strokeIds[0]].lineStart, fraction: 0.5 };
  const result = buildContinuation(doc, target, profile);
  assert.equal(result.error, null);
  const after = parseGcode(result.source, profile);
  assert.equal(after.groups.length, 1); assert.equal(after.groups[0].name, "second.gcode");
  assert.equal((result.source.match(/^; LATU GROUP .* BEGIN/gm) || []).length, (result.source.match(/^; LATU GROUP .* END/gm) || []).length);
});

test("CRLF and missing terminal newline survive the cut", () => {
  const doc = parseGcode(fixture.trimEnd().replaceAll("\n", "\r\n"), profile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0.5 }, profile);
  assert.equal(result.error, null); assert.doesNotMatch(result.source, /(?<!\r)\n/); assert.ok(result.source.endsWith("; done"));
});

test("unsafe or opaque machine state fails closed", () => {
  for (const command of ["G91", "G20", "M83", "G92 X0", "SET_GCODE_OFFSET X=10", "MANUAL_STEPPER STEPPER=pen MOVE=30", "SET_PIN PIN=laser VALUE=1", "RESTORE_GCODE_STATE NAME=work MOVE=1", "NEEDLE_BEGIN", "CUSTOM_SETUP", "G2 X10 Y20 I1 J1", "T1", "G1 E10 F100", "SET_SERVO SERVO=pen ANGLE=110"]) {
    const doc = parseGcode(fixture.replace("G21 ; mm", `${command}\nG21 ; mm`), profile);
    const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0.5 }, profile);
    assert.ok(result.error, command); assert.equal(result.source, null, command);
  }
});

test("invalid, non-drawing and final endpoint selections cannot create empty copies", () => {
  const doc = parseGcode(fixture, profile), last = doc.strokes.at(-1);
  for (const target of [{ lineIndex: null, fraction: 0 }, { lineIndex: 0, fraction: 0 }, { lineIndex: doc.strokes[0].lineStart, fraction: NaN }, { lineIndex: last.lineEnd, fraction: 1 }, { lineIndex: last.lineEnd, fraction: -1 }]) {
    assert.ok(buildContinuation(doc, target, profile).error);
  }
});

test("continuation requires known coordinates, feeds and a matching lift", () => {
  for (const input of [fixture.replace("G0 X10 Y20 F3000", "G0 X10 F3000"), fixture.replaceAll("F1800", "F0"), fixture.replace("SET_SERVO SERVO=pen ANGLE=135 ; pen up (servo)\n", "")]) {
    const doc = parseGcode(input, profile);
    assert.ok(buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0 }, profile).error);
  }
});

test("a cut inside a dip or an unbalanced block is refused", () => {
  for (const input of [fixture.replace("G0 X10 Y20 F3000", "; --- dip ---\nG0 X10 Y20 F3000").replace("PAUSE ; CHANGE", "; --- dip done ---\nPAUSE ; CHANGE"), `${fixture}; --- dip ---\n`]) {
    const doc = parseGcode(input, profile);
    assert.match(buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0 }, profile).error, /block/);
  }
});

test("continuation uses a new filename and does not accumulate suffixes", () => {
  assert.equal(continuationFilename("patch (21).gcode"), "patch (21)-resume.gcode");
  assert.equal(continuationFilename("patch-resume.gcode"), "patch-resume.gcode");
  assert.equal(continuationFilename("part.NC"), "part-resume.gcode");
});
