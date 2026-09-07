import { formatNumber } from "./emitter.js";
import { parseGcode } from "./parser.js";
import { splitStroke } from "./model.js";

const line = (raw, ending) => ({ raw, ending, dirty: true, op: null });
const sourceOf = (lines) => lines.map((item) => `${item.raw}${item.ending}`).join("");

function penCommand(profile, down, note = "") {
  if (profile.zMode === "bed") return `G1 Z${formatNumber(down ? profile.penDown : profile.penUp)} F${profile.zFeed}${note ? ` ; ${note}` : ""}`;
  return `SET_SERVO SERVO=${profile.servoName || "pen"} ANGLE=${formatNumber(down ? profile.servoDown : profile.servoUp)}${note ? ` ; ${note}` : ""}`;
}

function penBlock(profile, down) {
  const result = [penCommand(profile, down, down ? "pen down" : "pen up")];
  const delay = down ? profile.penDelayDown : profile.penDelayUp;
  if (delay > 0) result.push(`G4 P${Math.round(delay)} ; ${down ? "settle before draw" : "settle after lift"}`);
  return result;
}

function fillTemplate(template, values) {
  return String(template || "").replace(/\{([A-Z_]+)\}/g, (_, key) => values[key] ?? "");
}

export function eventTemplate(kind, profile, params = {}) {
  const pause = profile.pauseCmd || "M0";
  if (kind === "pitstop") return [`${pause} ; TRAVEL STOP: ${params.message || "service"}`];
  if (kind === "pen-change") return [`${pause} ; CHANGE PEN -> ${params.penIndex ?? 0}: ${params.penName || `Pen ${params.penIndex ?? 0}`}`];
  if (kind === "pen-up") return penBlock(profile, false);
  if (kind === "pen-down") return penBlock(profile, true);
  if (kind === "dip") return [
    "; --- dip ---", penCommand(profile, false),
    `G0 X${formatNumber(profile.dipX)} Y${formatNumber(profile.dipY)} F${profile.feedTravel}`,
    profile.zMode === "bed" ? `G1 Z${formatNumber(profile.dipZ)} F${profile.zFeed} ; plunge` : penCommand(profile, true, "plunge"),
    `G4 P${Math.round(params.ms ?? profile.dipDwell)} ; dwell ms`, penCommand(profile, false), "; --- dip done ---",
  ];
  if (kind === "maintenance") {
    const rows = ["; --- maintenance pause ---", ...penBlock(profile, false)];
    if (profile.maintPark) rows.push("SAVE_GCODE_STATE NAME=maint ; remember position", `G0 X${formatNumber(profile.maintX)} Y${formatNumber(profile.maintY)} F${profile.feedTravel}`);
    rows.push(`${pause} ; MAINTENANCE: ${params.message || profile.maintMsg || "service tool"}`);
    if (profile.maintPark) rows.push("RESTORE_GCODE_STATE NAME=maint MOVE=1 ; return to work");
    rows.push("; --- resume ---"); return rows;
  }
  if (kind === "dose") {
    if (params.variant === "raw") return [`G1 E${formatNumber(params.value ?? 10)} F${formatNumber(params.rate ?? 120)}`, `G1 E-${formatNumber(params.retract ?? .5)} F${formatNumber(params.rate ?? 120)} ; anti-drip`];
    return fillTemplate(profile.doseTemplate || "INK_DOSE UL={UL}", { UL: formatNumber(params.value ?? 10) }).split("\n");
  }
  if (kind === "air") {
    let rows;
    if (params.variant === "raw" || params.sweep) {
      rows = [`SET_PIN PIN=${params.pin || "air_valve"} VALUE=1`, `G4 P${Math.round(params.ms ?? 250)}`];
      if (params.sweep) rows.push(`MANUAL_STEPPER STEPPER=${profile.rotStepper || "nozzle"} MOVE=${formatNumber(params.sweepTo ?? 45)} SPEED=${formatNumber(params.rate ?? 30)} ; sweep during pulse`);
      rows.push(`SET_PIN PIN=${params.pin || "air_valve"} VALUE=0`);
    } else rows = fillTemplate(profile.airTemplate || "AIR_PULSE MS={MS}", { MS: Math.round(params.ms ?? 250) }).split("\n");
    if (params.aim) rows.unshift(`MANUAL_STEPPER STEPPER=${profile.rotStepper || "nozzle"} MOVE=${formatNumber(params.aimAngle ?? 0)} SPEED=${formatNumber(params.rate ?? 30)} ; pre-aim`);
    return rows;
  }
  if (kind === "rotation") return [`MANUAL_STEPPER STEPPER=${profile.rotStepper || "pen_rotate"} MOVE=${formatNumber(params.value ?? 0)} SPEED=${formatNumber(params.rate ?? 30)}`];
  if (kind === "laser-on") return String(profile.laserOnCmd || "SET_PIN PIN=laser VALUE=1").split("\n");
  if (kind === "laser-off") return String(profile.laserOffCmd || "SET_PIN PIN=laser VALUE=0").split("\n");
  if (kind === "snippet") return fillTemplate(params.snippet || "", { X: formatNumber(params.x ?? 0), Y: formatNumber(params.y ?? 0), PEN: params.penIndex ?? 0 }).split("\n").filter(Boolean);
  return [];
}

const AUTO_LIFT = new Set(["pitstop", "pen-change", "dip", "maintenance"]);

export function insertEvent(doc, profile, options) {
  let working = doc;
  const mode = options.wrap === "auto" ? (AUTO_LIFT.has(options.kind) ? "lift" : "keep") : options.wrap;
  const selectedStroke = doc.strokes.find((stroke) => options.lineIndex >= stroke.lineStart && options.lineIndex < stroke.lineEnd);
  if (selectedStroke && mode === "lift") working = parseGcode(splitStroke(doc, selectedStroke.id, options.lineIndex), profile);
  let insertAt;
  const preceding = working.strokes.find((stroke) => options.lineIndex >= stroke.lineStart && options.lineIndex <= stroke.lineEnd);
  if (selectedStroke && mode === "keep") insertAt = options.lineIndex + 1;
  else if (preceding) insertAt = preceding.blockEnd + 1;
  else if (Number.isInteger(options.lineIndex)) insertAt = Math.min(working.lines.length, options.lineIndex + 1);
  else insertAt = working.strokes.length ? working.strokes.at(-1).blockEnd + 1 : working.lines.length;
  const state = working.lines[Math.max(0, insertAt - 1)]?.op?.stateAfter || "unknown";
  let rows = eventTemplate(options.kind, profile, options.params);
  if (mode === "lift" && state === "down") rows = [...penBlock(profile, false), ...rows, ...penBlock(profile, true)];
  const ending = working.lines[0]?.ending || "\n";
  const lines = working.lines.map((item) => ({ ...item }));
  lines.splice(insertAt, 0, ...rows.map((raw) => line(raw, ending)));
  if (rows.some((raw) => /^\s*G1\s+E/i.test(raw)) && !lines.some((item) => /^\s*M83\b/i.test(item.raw))) {
    const g90 = lines.findIndex((item) => /^\s*G90\b/i.test(item.raw));
    lines.splice(g90 >= 0 ? g90 + 1 : 0, 0, line("M83 ; relative extrusion for LATU dose", ending));
  }
  return sourceOf(lines);
}

function setOrAppendWord(raw, letter, value) {
  const re = new RegExp(`(\\b${letter}\\s*=?\\s*)([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))`, "i");
  if (re.test(raw)) return raw.replace(re, `$1${formatNumber(value)}`);
  const commentAt = raw.indexOf(";");
  const before = commentAt < 0 ? raw : raw.slice(0, commentAt).trimEnd();
  const after = commentAt < 0 ? "" : ` ${raw.slice(commentAt)}`;
  const feed = before.match(/\s+F[-+.\d]+/i);
  return feed ? before.replace(feed[0], ` E${formatNumber(value)}${feed[0]}`) + after : `${before} E${formatNumber(value)}${after}`;
}

export function applyContinuousFeed(doc, strokeIds, ulPerMm) {
  const lines = doc.lines.map((item) => ({ ...item }));
  for (const stroke of doc.strokes.filter((item) => strokeIds.includes(item.id))) {
    for (let i = 1; i < stroke.pts.length; i += 1) {
      const length = Math.hypot(stroke.pts[i][0] - stroke.pts[i - 1][0], stroke.pts[i][1] - stroke.pts[i - 1][1]);
      lines[stroke.pointLines[i]].raw = setOrAppendWord(lines[stroke.pointLines[i]].raw, "E", length * ulPerMm);
      lines[stroke.pointLines[i]].dirty = true;
    }
  }
  if (!lines.some((item) => /^\s*M83\b/i.test(item.raw))) {
    const g90 = lines.findIndex((item) => /^\s*G90\b/i.test(item.raw));
    lines.splice(g90 >= 0 ? g90 + 1 : 0, 0, line("M83 ; relative extrusion for LATU continuous feed", lines[0]?.ending || "\n"));
  }
  return sourceOf(lines);
}

export function removeContinuousFeed(doc, strokeIds) {
  const lines = doc.lines.map((item) => ({ ...item }));
  for (const stroke of doc.strokes.filter((item) => strokeIds.includes(item.id))) for (let i = 1; i < stroke.pointLines.length; i += 1) {
    lines[stroke.pointLines[i]].raw = lines[stroke.pointLines[i]].raw.replace(/\s+E\s*=?\s*[-+]?(?:\d+(?:\.\d*)?|\.\d+)/i, "");
  }
  if (!lines.some((item) => /^\s*G0?1\b.*\sE\s*=?\s*[-+.\d]/i.test(item.raw))) {
    const m83 = lines.findIndex((item) => /^\s*M83\b.*LATU continuous feed/i.test(item.raw));
    if (m83 >= 0) lines.splice(m83, 1);
  }
  return sourceOf(lines);
}
