import { parseGcode } from "./parser.js";
import { finalizeForSave } from "./model.js";

const finite = Number.isFinite;
// Do not use the geometry editor's two-decimal formatter here: a cut may be
// inside a short segment or at a pressure-Z position needing more precision.
const formatNumber = (value) => String(Number(value.toFixed(6)));
const commandOf = (line) => line.raw.split(";")[0].trim().split(/\s+/)[0].toUpperCase();
const STARTUP = new Set(["G28", "PLOT_GO", "PLOT_HEIGHT"]);
const SETTINGS = new Set(["M204", "M220", "SET_VELOCITY_LIMIT", "_GENTLE_JOB_ON", "GENTLE_ON", "GENTLE_OFF"]);
const PASSIVE = new Set(["M400", "M117", "RESPOND", "CLEAR_PAUSE", "CANVAS_CHECK"]);

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
  const controls = before.filter(({ op }) => op.kind === "servo" || op.kind === "zmove" || ["PEN_UP", "PEN_DOWN"].includes(op.macro));
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
function unsupportedLine(doc, profile) {
  const firstDraw = doc.strokes[0]?.lineStart ?? 0;
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
    if (STARTUP.has(command)) return index >= firstDraw;
    return !SETTINGS.has(command) && !PASSIVE.has(command);
  });
}

export function buildContinuation(doc, target, profile = {}) {
  const fail = (error) => ({ error, source: null });
  const location = resumeLocation(doc, target);
  if (!location) return fail("Choose a drawing move (G1) on the canvas or enter its G-code line number.");
  if (doc.warnings.unsafeModal) return fail("Continuation supports absolute millimetre coordinates only (G90 / G21).");
  if (doc.blocks.some((block) => block.unbalanced || target.lineIndex >= block.lineStart && target.lineIndex <= block.lineEnd)) return fail("Choose a point outside a dip or maintenance block. Unfinished blocks must be fixed first.");
  const unsupported = unsupportedLine(doc, profile);
  if (unsupported >= 0) return fail(`Cannot safely resume this file: unsupported machine state on line ${unsupported + 1} (${commandOf(doc.lines[unsupported])}). Extrusion, lasers, rotation, offsets and opaque macros need manual preparation.`);
  const before = doc.lines.slice(0, target.lineIndex);
  if (!["X", "Y"].every((axis) => before.some(({ op }) => op.kind === "move" && finite(op.params[axis])))) return fail("The X/Y position before this move is not fully defined in the file.");
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
  const firstCode = doc.lines.findIndex(({ op }) => !["blank", "header", "comment"].includes(op.kind));
  const header = doc.lines.slice(0, Math.max(0, firstCode)).filter(({ raw }) => !/^;\s*(?:Pen\s+\d+:|LATU GROUP|LATU continuation|LATU PEN COLOR)/i.test(raw)).map((line) => line.raw);
  const penName = doc.sections[stroke.sectionId]?.name || `Pen ${stroke.penIndex}`;
  const rows = [...header,
    `; LATU continuation: original line ${lineIndex + 1}, ${(fraction * 100).toFixed(2)}% through move`,
    "; Keep the original paper XY zero. Confirm homing, pen and plot height before running.",
    "; No homing or paper-offset setup is replayed by LATU.",
    ...Object.entries(doc.meta.penColors).map(([index, color]) => `; LATU PEN COLOR ${index} ${color}`),
    `; Pen ${stroke.penIndex}: ${penName}`, "G21 ; mm", "G90 ; absolute", setup.up,
  ];
  const upDelay = Number(doc.meta.penDelayUp ?? profile.penDelayUp ?? 0);
  const downDelay = Number(doc.meta.penDelayDown ?? profile.penDelayDown ?? 0);
  if (![upDelay, downDelay].every((delay) => finite(delay) && delay >= 0)) return fail("Pen settle times must be finite, non-negative numbers. Check the machine profile.");
  if (upDelay > 0) rows.push(`G4 P${Math.round(upDelay)} ; settle after lift`);
  // Replay only explicit non-motion limits, not the user's startG or arbitrary
  // prefix macros. In particular G28 / PLOT_GO / PLOT_HEIGHT are omitted.
  rows.push(...before.filter((line) => SETTINGS.has(commandOf(line)) || commandOf(line) === "CLEAR_PAUSE").map((line) => line.raw));
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
    omittedStartup: before.map((line, index) => ({ line: index + 1, command: commandOf(line) })).filter((item) => STARTUP.has(item.command)),
  };
}
