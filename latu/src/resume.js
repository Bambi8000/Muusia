import { parseGcode } from "./parser.js";
import { finalizeForSave } from "./model.js";

const finite = Number.isFinite;
// Do not use the geometry editor's two-decimal formatter here: a cut may be
// inside a short segment or at a pressure-Z position needing more precision.
const formatNumber = (value) => String(Number(value.toFixed(6)));
const commandOf = (line) => line.raw.split(";")[0].trim().split(/\s+/)[0].toUpperCase();
const STARTUP = new Set(["G28", "PLOT_GO", "PLOT_HEIGHT"]);
const ORIGIN = new Set(["G92", "SET_GCODE_OFFSET"]);
const SETTINGS = new Set(["M204", "M220", "SET_VELOCITY_LIMIT", "_GENTLE_JOB_ON", "GENTLE_ON", "GENTLE_OFF"]);
const PASSIVE = new Set(["M400", "M117", "RESPOND", "CLEAR_PAUSE", "CANVAS_CHECK"]);
const penControl = (op) => op.kind === "servo" || op.kind === "zmove" || ["PEN_UP", "PEN_DOWN"].includes(op.macro);
const copyHeader = ({ raw }) => !/^;\s*(?:Pen\s+\d+:|LATU GROUP|LATU continuation|LATU original startup|LATU PEN COLOR|Keep the original paper XY zero\.|No homing or paper-offset setup is replayed by LATU\.)/i.test(raw);
const xyOrigin = (line) => ORIGIN.has(commandOf(line)) && /\s[XY](?:=|[-+\d.])/i.test(line.raw.split(";")[0]);

// The prefix ends before the first pen-down, not before the selected move.
// This retains setup and initial travel without replaying any earlier drawing.
export function continuationStartup(doc) {
  const firstDraw = doc.strokes[0]?.lineStart ?? 0;
  const firstCode = doc.lines.findIndex(({ op }) => !["blank", "header", "comment"].includes(op.kind));
  const lower = doc.lines.findIndex(({ op }, index) => index < firstDraw && penControl(op) && op.stateAfter === "down");
  const end = lower < 0 ? firstDraw : lower;
  const lines = doc.lines.map((line, lineIndex) => ({ ...line, lineIndex }))
    .slice(Math.max(0, firstCode), end).filter(copyHeader);
  return { lines, end, firstCode, hasOrigin: lines.some((line) => commandOf(line) === "PLOT_GO" || xyOrigin(line)) };
}

// Only explicit absolute offsets can be replayed reliably. Incremental offsets
// would accumulate when restarting a job on an already configured machine.
function supportedOrigin(line) {
  const command = commandOf(line), tokens = line.raw.split(";")[0].trim().split(/\s+/).slice(1);
  const number = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
  if (command === "G92") return tokens.length > 0 && tokens.every((token) => new RegExp(`^[XYZ]${number}$`, "i").test(token) && finite(Number(token.slice(1))));
  if (command !== "SET_GCODE_OFFSET" || !tokens.length) return false;
  const args = Object.fromEntries(tokens.map((token) => token.toUpperCase().split("=")));
  return tokens.every((token) => new RegExp(`^(?:X|Y|Z|MOVE|MOVE_SPEED)=${number}$`, "i").test(token) && finite(Number(token.split("=")[1])))
    && ["X", "Y", "Z"].some((axis) => axis in args)
    && (!("MOVE" in args) || [0, 1].includes(Number(args.MOVE)))
    && (!("MOVE_SPEED" in args) || Number(args.MOVE_SPEED) > 0);
}

function unanchoredG92(startup) {
  const homed = new Set();
  return startup.lines.find((line) => {
    if (commandOf(line) === "G28") {
      const axes = [...line.raw.split(";")[0].toUpperCase().matchAll(/\s([XYZ])(?:[-+\d.]+)?(?=\s|$)/g)].map((match) => match[1]);
      for (const axis of axes.length ? axes : ["X", "Y", "Z"]) homed.add(axis);
    }
    // G92 defines zero at the current physical position. Without a homing
    // reference in this prefix it would redefine zero wherever the job stopped.
    return commandOf(line) === "G92" && Object.keys(line.op.params).some((axis) => axis !== "G" && !homed.has(axis));
  });
}

export function continuationFilename(name) {
  return `${String(name || "drawing").replace(/\.(?:gcode|gc|nc)$/i, "").replace(/-resume$/, "")}-resume.gcode`;
}

// A text row starts BEFORE its move. A selected canvas point starts AT that
// point, after the incoming segment. The preview always states this explicitly.
export function resumeTargetForSelection(doc, lineIndex, points = []) {
  if (points.length === 1) {
    const { strokeId, pointIndex } = points[0];
    const stroke = doc.strokes[strokeId];
    if (stroke?.pts[pointIndex]) return { lineIndex: stroke.pointLines[Math.max(1, pointIndex)], fraction: pointIndex ? 1 : 0 };
  }
  const stroke = doc.strokes.find((item) => item.pointLines.includes(lineIndex));
  return { lineIndex: stroke && lineIndex === stroke.approachLine ? stroke.lineStart : lineIndex, fraction: 0 };
}

export function resumeLocation(doc, target) {
  const { lineIndex, fraction } = target || {};
  if (!Number.isInteger(lineIndex) || !finite(fraction) || fraction < 0 || fraction > 1) return null;
  const stroke = doc.strokes.find((item) => item.pointLines.slice(1).includes(lineIndex));
  if (!stroke) return null;
  const index = stroke.pointLines.indexOf(lineIndex), a = stroke.pts[index - 1], b = stroke.pts[index];
  const position = a.map((value, axis) => finite(value) && finite(b[axis]) ? value + (b[axis] - value) * fraction : null);
  return { stroke, position, lineIndex, fraction };
}

function penSetup(doc, location, profile) {
  const before = doc.lines.slice(0, location.lineIndex);
  const controls = before.filter(({ op }) => penControl(op));
  const last = controls.at(-1)?.op;
  if (!last || last.stateAfter !== "down") return { error: "The pen-down state at this point cannot be reconstructed." };
  if (last.macro === "PEN_DOWN") return { up: "PEN_UP", down: "PEN_DOWN" };
  if (last.kind === "servo") {
    const up = controls.findLast(({ op }) => op.kind === "servo" && op.servo === last.servo && op.stateAfter === "up")?.op;
    if (!up || !finite(up.angle) || !finite(last.angle) || !/^[\w-]+$/.test(last.servo || "")) return { error: "No matching servo pen-up command was found before this point." };
    return { up: `SET_SERVO SERVO=${last.servo} ANGLE=${formatNumber(up.angle)} ; pen up`, down: `SET_SERVO SERVO=${last.servo} ANGLE=${formatNumber(last.angle)} ; pen down` };
  }
  const up = controls.findLast(({ op }) => op.kind === "zmove" && op.stateAfter === "up")?.op
    || controls.findLast(({ op }) => op.kind === "zmove" && op.stateAfter === "travelUp")?.op;
  const z = location.position[2], zFeed = Number(last.params.F || up?.params.F || profile.zFeed);
  if (!up || !finite(z) || !(up.params.Z > z) || !finite(zFeed) || !(zFeed > 0)) return { error: "The bed-Z lift, pressure or Z speed cannot be reconstructed. Check the machine profile." };
  return { up: `G1 Z${formatNumber(up.params.Z)} F${formatNumber(zFeed)} ; pen up`, down: `G1 Z${formatNumber(z)} F${formatNumber(zFeed)} ; pen down at continuation pressure` };
}

// Fail closed for opaque machine state: a line cut must never silently lose
// offsets, extrusion state, laser output, tool rotation or saved macro state.
function unsupportedLine(doc, profile, startup, replayStartup) {
  return doc.lines.findIndex((line, index) => {
    const { op } = line, command = commandOf(line);
    if (["blank", "comment", "header", "dwell", "pause"].includes(op.kind)) return false;
    if (op.kind === "modal") return !["G90", "G21"].includes(op.command);
    if (op.kind === "move" || op.kind === "zmove" || op.kind === "feed") {
      if (Object.keys(op.params).some((key) => !["G", "X", "Y", "Z", "F"].includes(key))) return true;
      return (doc.meta.zMode === "servo" && finite(op.params.Z)) || (finite(op.params.F) && op.params.F <= 0);
    }
    if (op.kind === "servo") return !finite(op.angle) || !["up", "down"].includes(op.stateAfter)
      || !(/pen\s*up|pen\s*down|lift|plunge|stays up/i.test(op.comment) || [doc.meta.servoUp ?? profile.servoUp, doc.meta.servoDown ?? profile.servoDown].some((angle) => finite(angle) && Math.abs(angle - op.angle) <= 2))
      || op.servo !== (doc.meta.servoName || doc.lines.find((item) => item.op.kind === "servo")?.op.servo);
    if (["PEN_UP", "PEN_DOWN"].includes(command)) return line.raw.split(";")[0].trim().toUpperCase() !== command;
    if (STARTUP.has(command)) return index >= startup.end;
    if (ORIGIN.has(command)) return !replayStartup || index >= startup.end || !supportedOrigin(line);
    return !SETTINGS.has(command) && !PASSIVE.has(command);
  });
}

export function buildContinuation(doc, target, profile = {}, { replayStartup = false } = {}) {
  const fail = (error) => ({ error, source: null });
  const location = resumeLocation(doc, target);
  if (!location) return fail("Choose a drawing move (G1) on the canvas or enter its G-code line number.");
  if (doc.warnings.unsafeModal) return fail("Continuation supports absolute millimetre coordinates only (G90 / G21).");
  if (doc.blocks.some((block) => block.unbalanced || target.lineIndex >= block.lineStart && target.lineIndex <= block.lineEnd)) return fail("Choose a point outside a dip or maintenance block. Unfinished blocks must be fixed first.");
  const startup = continuationStartup(doc);
  if (replayStartup && doc.blocks.some((block) => block.lineStart < startup.end && block.lineEnd >= startup.end)) return fail("The original startup ends inside a dip or maintenance block and cannot be replayed separately.");
  const unsupported = unsupportedLine(doc, profile, startup, replayStartup);
  if (unsupported >= 0 && !replayStartup && unsupported < startup.end && supportedOrigin(doc.lines[unsupported])) return fail(`Paper-origin setup on line ${unsupported + 1} must be retained. Choose “Run original startup” to include it.`);
  if (unsupported >= 0) return fail(`Cannot safely resume this file: unsupported machine state on line ${unsupported + 1} (${commandOf(doc.lines[unsupported])}). Extrusion, lasers, rotation, offsets and opaque macros need manual preparation.`);
  const unanchored = replayStartup && unanchoredG92(startup);
  if (unanchored) return fail(`G92 on line ${unanchored.lineIndex + 1} sets zero at the current position, but this startup does not home those axes first. The original paper origin cannot be recovered from this file.`);
  const before = doc.lines.slice(0, target.lineIndex);
  // The parser displays job coordinates. After an origin/homing macro, both
  // coordinates must be re-established explicitly before the first draw.
  const coordinateReset = before.findLastIndex((line) => xyOrigin(line) || ["G28", "PLOT_GO"].includes(commandOf(line)));
  const positioned = before.slice(coordinateReset + 1, doc.strokes[0].lineStart);
  if (!["X", "Y"].every((axis) => positioned.some(({ op }) => op.kind === "move" && finite(op.params[axis])))) return fail("The X/Y position before drawing is not fully defined after the last startup or paper-origin command.");
  const setup = penSetup(doc, location, profile);
  if (setup.error) return fail(setup.error);
  const { stroke, position, lineIndex, fraction } = location;
  const firstKept = lineIndex + (fraction === 1 ? 1 : 0);
  const remaining = doc.lines.slice(firstKept);
  if (!remaining.some(({ op }) => op.motionKind === "draw" && Math.hypot(op.x - op.xBefore, op.y - op.yBefore) > 0)) return fail("There is no drawing left after this point.");
  const feed = doc.lines[lineIndex].op.feed;
  let travelFeed = null;
  for (const { op } of before) if (op.motionKind === "travel" && op.feed > 0) travelFeed = op.feed;
  travelFeed ??= profile.feedTravel;
  if (!(feed > 0) || !finite(feed) || !(travelFeed > 0) || !finite(travelFeed)) return fail("Drawing and travel speeds must be known and positive before continuing.");
  const ending = doc.lines.find((line) => line.ending)?.ending || "\n";
  const header = doc.lines.slice(0, Math.max(0, startup.firstCode)).filter(copyHeader).map((line) => line.raw);
  const penName = doc.sections[stroke.sectionId]?.name || `Pen ${stroke.penIndex}`;
  const rows = [...header,
    `; LATU continuation: original line ${lineIndex + 1}, ${(fraction * 100).toFixed(2)}% through move`,
    replayStartup ? "; LATU continuation setup: original startup is replayed below." : "; Keep the original paper XY zero. Confirm homing, pen and plot height before running.",
    replayStartup ? "; LATU continuation setup: keep the paper in place and load the continuation pen." : "; No homing or paper-offset setup is replayed by LATU.",
    ...Object.entries(doc.meta.penColors).map(([index, color]) => `; LATU PEN COLOR ${index} ${color}`),
    ...(replayStartup ? ["; LATU original startup begin", ...startup.lines.map((line) => line.raw), "; LATU original startup end"] : []),
    `; Pen ${stroke.penIndex}: ${penName}`, "G21 ; mm", "G90 ; absolute",
  ];
  const upDelay = Number(doc.meta.penDelayUp ?? profile.penDelayUp ?? 0);
  const downDelay = Number(doc.meta.penDelayDown ?? profile.penDelayDown ?? 0);
  if (![upDelay, downDelay].every((delay) => finite(delay) && delay >= 0)) return fail("Pen settle times must be finite, non-negative numbers. Check the machine profile.");
  // Already replayed settings must not run twice; later settings still apply.
  rows.push(...before.slice(replayStartup ? startup.end : 0).filter((line) => SETTINGS.has(commandOf(line)) || commandOf(line) === "CLEAR_PAUSE").map((line) => line.raw));
  // For bed-Z, homing and paper-height setup must precede this absolute lift.
  rows.push(setup.up);
  if (upDelay > 0) rows.push(`G4 P${Math.round(upDelay)} ; settle after lift`);
  if (stroke.groupId) rows.push(`; LATU GROUP ${stroke.groupId} BEGIN ${stroke.groupName || stroke.groupId}`);
  rows.push(`G0 X${formatNumber(position[0])} Y${formatNumber(position[1])} F${formatNumber(travelFeed)} ; travel to continuation start, pen up`, setup.down);
  if (downDelay > 0) rows.push(`G4 P${Math.round(downDelay)} ; settle before draw`);
  rows.push(`G1 F${formatNumber(feed)} ; restore drawing feed`);
  const source = rows.join(ending) + ending + remaining.map((line) => line.raw + line.ending).join("");
  const parsed = parseGcode(source, profile);
  if (!parsed.strokes.length || !(parsed.stats.drawLength > 0)) return fail("No valid drawing remains at this point.");
  const removedLength = Math.max(0, doc.stats.drawLength - parsed.stats.drawLength);
  return {
    error: null, source: finalizeForSave(parsed, profile.name), ...location,
    penName, removedLength, remainingLength: parsed.stats.drawLength, remainingStrokes: parsed.strokes.length,
    replayStartup,
    omittedStartup: replayStartup ? [] : before.map((line, index) => ({ line: index + 1, command: commandOf(line) })).filter((item) => STARTUP.has(item.command)),
  };
}
