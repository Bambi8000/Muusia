import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseGcode } from "../src/parser.js";
import { combineGcodeSources, updatePenColor } from "../src/model.js";
import { buildContinuation, continuationFilename, continuationStartup, resumeTargetForSelection } from "../src/resume.js";
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

test("original startup replays homing, paper setup and entry travel once, before the continuation", () => {
  const input = fixture.replace("G21 ; mm", "G21 ; mm\nG28 ; home\nCLEAR_PAUSE\n_GENTLE_JOB_ON\nPLOT_GO\nPLOT_HEIGHT\nCANVAS_CHECK X_MIN=0 X_MAX=100 Y_MIN=0 Y_MAX=100");
  const doc = parseGcode(input, profile), target = { lineIndex: doc.strokes[0].lineEnd, fraction: 0.5 };
  const startup = continuationStartup(doc);
  const result = buildContinuation(doc, target, { ...profile, startG: "CUSTOM_PROFILE_SETUP" }, { replayStartup: true });
  assert.equal(result.error, null);
  assert.deepEqual(result.omittedStartup, []);
  assert.equal(startup.hasOrigin, true);
  const prefix = result.source.split("; LATU original startup begin\n")[1].split("; LATU original startup end")[0];
  assert.ok(prefix.endsWith(startup.lines.map((line) => line.raw).join("\n") + "\n"), "startup stays verbatim after LATU's generated editor/profile comments");
  for (const command of ["G28", "PLOT_GO", "PLOT_HEIGHT", "CLEAR_PAUSE", "_GENTLE_JOB_ON", "CANVAS_CHECK"]) assert.equal((result.source.match(new RegExp(`^${command}\\b`, "gm")) || []).length, 1, command);
  assert.doesNotMatch(prefix, /ANGLE=80|^G1 X/m);
  assert.match(prefix, /G0 X10 Y20 F3000/);
  assert.doesNotMatch(result.source, /CUSTOM_PROFILE_SETUP|No homing or paper-offset/);
  const resumed = parseGcode(result.source, profile);
  assert.deepEqual(resumed.strokes[0].pts[0], [30, 30, null]);
  const firstDraw = resumed.strokes[0].lineStart;
  assert.ok(resumed.lines.slice(0, firstDraw).filter(({ op }) => op.kind === "move").every(({ op }) => op.stateBefore === "up"));
  assert.equal(resumed.stats.drawLength, 30);
});

test("patch-21 original startup keeps the exact remaining geometry at every cut", () => {
  const doc = parseGcode(patch, profile);
  for (const segment of drawing(doc)) for (const fraction of [0, 0.37, 1]) {
    const target = { lineIndex: segment.line, fraction };
    const manual = buildContinuation(doc, target, profile);
    const replayed = buildContinuation(doc, target, profile, { replayStartup: true });
    assert.equal(replayed.error, manual.error);
    if (manual.error) continue;
    assert.match(replayed.source, /^PLOT_HEIGHT$/m);
    assert.deepEqual(drawing(parseGcode(replayed.source, profile)).map(({ from, to, pen }) => ({ from, to, pen })), drawing(parseGcode(manual.source, profile)).map(({ from, to, pen }) => ({ from, to, pen })));
    assert.ok(replayed.source.endsWith(doc.lines.slice(segment.line + (fraction === 1 ? 1 : 0)).map((line) => line.raw + line.ending).join("")));
  }
});

test("explicit paper offsets require startup replay and preserve original job coordinates", () => {
  for (const origin of ["G92 X0 Y0", "SET_GCODE_OFFSET X=42 Y=20 Z=0 MOVE=0", "SET_GCODE_OFFSET X=42 Y=20 MOVE=1 MOVE_SPEED=20"]) {
    const input = fixture.replace("G90 ; absolute", `G90 ; absolute\nG28\n${origin}`);
    const doc = parseGcode(input, profile), target = { lineIndex: doc.strokes[0].lineStart, fraction: 0.5 };
    assert.match(buildContinuation(doc, target, profile).error, /Run original startup/);
    const result = buildContinuation(doc, target, profile, { replayStartup: true });
    assert.equal(result.error, null, origin);
    assert.ok(result.source.includes(`\n${origin}\n`));
    assert.deepEqual(parseGcode(result.source, profile).strokes[0].pts[0], [20, 20, null]);
    assert.equal(parseGcode(result.source, profile).meta.originX, 0, "canvas origin is not applied as another machine offset");
  }
});

test("startup replay refuses accumulating offsets, opaque macros and state changes after drawing starts", () => {
  for (const code of ["SET_GCODE_OFFSET X_ADJUST=10", "SET_GCODE_OFFSET X=10 MOVE=2", "SET_GCODE_OFFSET X=10 MOVE_SPEED=-1", "SET_GCODE_OFFSET X=NaN", "G92 E0", "G92 XNaN", "CUSTOM_SETUP", "SET_PIN PIN=laser VALUE=1", "RESTORE_GCODE_STATE NAME=work MOVE=1", "G91"]) {
    const doc = parseGcode(fixture.replace("G21 ; mm", `${code}\nG21 ; mm`), profile);
    const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0.5 }, profile, { replayStartup: true });
    assert.ok(result.error, code); assert.equal(result.source, null, code);
  }
  for (const code of ["G92 X0 Y0", "SET_GCODE_OFFSET X=10 Y=20", "PLOT_GO", "G28"]) {
    const doc = parseGcode(fixture.replace("G1 X30 Y40 F1800", `${code}\nG1 X30 Y40 F1800`), profile);
    for (const target of [doc.strokes[0].lineStart, doc.strokes.at(-1).lineStart]) {
      assert.ok(buildContinuation(doc, { lineIndex: target, fraction: 0 }, profile, { replayStartup: true }).error, code);
    }
  }
});

test("coordinates from before a paper-origin reset cannot be used for a continuation", () => {
  const input = fixture.replace("G21 ; mm", "G21 ; mm\nG28").replace("G0 X10 Y20 F3000", "G0 X10 Y20 F3000\nG92 X0 Y0\nG0 X10 F3000");
  const doc = parseGcode(input, profile);
  assert.match(buildContinuation(doc, { lineIndex: doc.strokes[1].lineStart, fraction: 0 }, profile, { replayStartup: true }).error, /X\/Y position/);
});

test("plot-height setup does not invalidate an already known XY approach", () => {
  for (const code of ["PLOT_HEIGHT", "G92 Z0", "SET_GCODE_OFFSET Z=1 MOVE=0"]) {
    const doc = parseGcode(fixture.replace("G21 ; mm", "G21 ; mm\nG28").replace("G0 X10 Y20 F3000", `G0 X10 Y20 F3000\n${code}`), profile);
    const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0.5 }, profile, { replayStartup: true });
    assert.equal(result.error, null, code);
    assert.equal(continuationStartup(doc).hasOrigin, false, "height alone does not restore paper XY");
    assert.deepEqual(parseGcode(result.source, profile).strokes[0].pts[0], [20, 20, null]);
  }
});

test("G92 cannot redefine paper zero at the arbitrary position where the previous run stopped", () => {
  for (const startup of ["G92 X0 Y0", "G28 X\nG92 X0 Y0", "G28 X Y\nG92 Z0"]) {
    const doc = parseGcode(fixture.replace("G21 ; mm", `G21 ; mm\n${startup}`), profile);
    const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0 }, profile, { replayStartup: true });
    assert.match(result.error, /does not home those axes/);
    assert.equal(result.source, null);
  }
  const doc = parseGcode(fixture.replace("G21 ; mm", "G21 ; mm\nG28 X Y\nG92 X0 Y0"), profile);
  assert.equal(buildContinuation(doc, { lineIndex: doc.strokes[0].lineStart, fraction: 0 }, profile, { replayStartup: true }).error, null);
});

test("bed-Z startup homes before lifting and still resumes at the interpolated pressure", () => {
  const bedProfile = { ...profile, zMode: "bed" };
  const doc = parseGcode(bed.replace("G90", "G90\nG28\nSET_GCODE_OFFSET X=10 Y=20 Z=1 MOVE=0"), bedProfile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes[0].lineEnd, fraction: 0.5 }, bedProfile, { replayStartup: true });
  assert.equal(result.error, null);
  assert.ok(result.source.indexOf("\nG28\n") < result.source.indexOf("\nG1 Z3"));
  assert.ok(result.source.indexOf("\nSET_GCODE_OFFSET") < result.source.indexOf("\nG1 Z3"));
  assert.deepEqual(point(parseGcode(result.source, bedProfile).strokes[0].pts[0]), [15, 10, -0.15]);
});

test("startup replay restores later limits and current pen without past pen changes", () => {
  const input = fixture.replace("G21 ; mm", "G21 ; mm\nM220 S50").replace("PAUSE ; CHANGE PEN", "M220 S75\nPAUSE ; CHANGE PEN");
  const doc = parseGcode(input, profile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes[1].lineStart, fraction: 0.5 }, profile, { replayStartup: true });
  assert.equal(result.error, null);
  assert.ok(result.source.indexOf("M220 S50") < result.source.indexOf("M220 S75"));
  assert.equal((result.source.match(/^M220 /gm) || []).length, 2);
  const resumed = parseGcode(result.source, profile);
  assert.equal(resumed.strokes[0].penIndex, 7);
  assert.equal(resumed.sections[0].name, "Magenta");
  assert.equal(resumed.events.filter((event) => event.kind === "pen-change").length, 0);
});

test("startup replay preserves CRLF, macro pen controls and combined group boundaries", () => {
  const source = fixture.replaceAll("SET_SERVO SERVO=pen ANGLE=135", "PEN_UP ;").replaceAll("SET_SERVO SERVO=pen ANGLE=80", "PEN_DOWN ;");
  const combined = combineGcodeSources(parseGcode(source, profile), [{ name: "second.gcode", source }], profile, "first.gcode");
  const doc = parseGcode(combined.source.trimEnd().replaceAll("\n", "\r\n"), profile);
  const result = buildContinuation(doc, { lineIndex: doc.strokes.at(-1).lineStart, fraction: 0.5 }, profile, { replayStartup: true });
  assert.equal(result.error, null);
  assert.doesNotMatch(result.source, /(?<!\r)\n/);
  const resumed = parseGcode(result.source, profile);
  assert.equal(resumed.groups.length, 1);
  assert.equal(resumed.groups[0].name, "second.gcode");
  assert.equal((result.source.match(/^; LATU GROUP .* BEGIN/gm) || []).length, (result.source.match(/^; LATU GROUP .* END/gm) || []).length);
  assert.match(result.source, /^PEN_UP$/m);
  assert.match(result.source, /^PEN_DOWN$/m);
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
