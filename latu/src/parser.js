import { classifyEventComment, eventLabel, KNOWN_MACROS, namedArgs, PEN_COLORS, splitComment, words } from "./dialect.js";

const finite = (value) => Number.isFinite(value);
const near = (a, b, tolerance = 0.001) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance;

function physicalLines(source) {
  if (!source) return [];
  const lines = [];
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== "\n" && source[i] !== "\r") continue;
    const width = source[i] === "\r" && source[i + 1] === "\n" ? 2 : 1;
    lines.push({ raw: source.slice(start, i), ending: source.slice(i, i + width), dirty: false, op: null });
    i += width - 1;
    start = i + 1;
  }
  if (start < source.length) lines.push({ raw: source.slice(start), ending: "", dirty: false, op: null });
  return lines;
}

function parseHeader(raw, meta) {
  let match;
  if ((match = raw.match(/^;\s*Muusia\s+v([^\s—]+)/i))) meta.muusiaVersion = match[1];
  if ((match = raw.match(/^;\s*Machine:\s*(.*?)\s*—\s*work area\s*([-+.\d]+)\s*x\s*([-+.\d]+)\s*mm/i))) {
    Object.assign(meta, { machineName: match[1], workW: Number(match[2]), workH: Number(match[3]) });
  }
  if ((match = raw.match(/^;\s*Canvas\s*([-+.\d]+)\s*x\s*([-+.\d]+)\s*mm at origin X([-+.\d]+)\s+Y([-+.\d]+)/i))) {
    Object.assign(meta, { canvasW: Number(match[1]), canvasH: Number(match[2]), originX: Number(match[3]), originY: Number(match[4]), flipY: /Y flipped/i.test(raw) });
  }
  if ((match = raw.match(/^;\s*Z mode:\s*SERVO\s+"([^"]+)"\s*—\s*up\s*([-+.\d]+)°\s*\/\s*down\s*([-+.\d]+)°/i))) {
    Object.assign(meta, { zMode: "servo", servoName: match[1], servoUp: Number(match[2]), servoDown: Number(match[3]) });
  }
  if ((match = raw.match(/^;\s*Z-hop travel lift:\s*([-+.\d]+)\s*mm/i))) meta.travelZ = Number(match[1]);
  if ((match = raw.match(/^;\s*Pen settle:\s*down\s*(\d+)ms\s*\/\s*up\s*(\d+)ms/i))) {
    Object.assign(meta, { penDelayDown: Number(match[1]), penDelayUp: Number(match[2]) });
  }
  if ((match = raw.match(/^;\s*Pen\s+(\d+)\s*:\s*(.+?)\s*$/i))) meta.penNames[Number(match[1])] = match[2];
  return /^;\s*(?:Muusia|Machine:|Canvas |Draw |Z mode:|Z-hop travel lift:|Pen settle:|Pen \d+:)/i.test(raw);
}

function parseLine(line, meta, profile) {
  const { raw } = line;
  const { code, comment } = splitComment(raw);
  if (!code) return { kind: raw.trim().startsWith(";") ? (parseHeader(raw, meta) ? "header" : "comment") : "blank", comment };
  const command = code.split(/\s+/)[0].toUpperCase();
  const params = words(code);
  const args = namedArgs(code);

  if (command === "G0" || command === "G00" || command === "G1" || command === "G01") {
    const hasXY = finite(params.X) || finite(params.Y);
    const hasZ = finite(params.Z);
    const hasE = finite(params.E);
    if (hasXY) return { kind: "move", command: command.startsWith("G0") && !command.startsWith("G01") ? "G0" : "G1", params, comment };
    if (hasZ) return { kind: "zmove", command: "G1", params, comment };
    if (hasE) return { kind: "macro", macro: "EXTRUDER_MOVE", eventKind: "dose", params, comment };
    return { kind: "other", command, params, comment };
  }
  if (command === "G4" || command === "G04") return { kind: "dwell", ms: params.P ?? ((params.S ?? 0) * 1000), params, comment };
  if (command === "G90" || command === "G91" || command === "G20" || command === "G21") return { kind: "modal", command, comment };
  if (command === "SET_SERVO") return { kind: "servo", servo: args.SERVO, angle: Number(args.ANGLE), args, comment };

  const pauseCommands = new Set(["M0", "M00", "M1", "M01", "PAUSE", String(profile?.pauseCmd || "").trim().toUpperCase()]);
  if (pauseCommands.has(command)) return { kind: "pause", command, eventKind: classifyEventComment(comment), comment };
  if (KNOWN_MACROS.has(command)) {
    let eventKind = null;
    if (command === "MANUAL_STEPPER") eventKind = "rotation";
    if (command === "SET_PIN") eventKind = "pin";
    if (command === "CANVAS_CHECK") eventKind = "canvas-check";
    if (command === "INK_DOSE") eventKind = "dose";
    if (command === "AIR_PULSE") eventKind = "pin";
    return { kind: "macro", macro: command, eventKind, args, comment };
  }
  return { kind: "other", command, params, args, comment };
}

function servoState(op, meta, profile) {
  const tag = op.comment.toLowerCase();
  if (/pen\s*up|lift|stays up/.test(tag)) return "up";
  if (/pen\s*down|plunge/.test(tag)) return "down";
  const up = meta.servoUp ?? profile?.servoUp;
  const down = meta.servoDown ?? profile?.servoDown;
  if (near(op.angle, up, 2)) return "up";
  if (near(op.angle, down, 2)) return "down";
  return null;
}

function zState(op, meta, profile, inferred) {
  const z = op.params.Z;
  const up = profile?.penUp ?? inferred.at(-1);
  const down = profile?.penDown ?? inferred[0];
  const travel = meta.travelZ ?? (profile?.zHopOn ? (profile.penDown + profile.zHop) : undefined) ?? (inferred.length === 3 ? inferred[1] : undefined);
  if (near(z, up, 0.02)) return "up";
  if (near(z, travel, 0.02)) return "travelUp";
  if (finite(down) && z <= down + 0.02) return "down";
  return null;
}

function penFromComment(comment) {
  const match = comment.match(/(?:CHANGE\s+PEN\s*->|Pen)\s*(\d+)\s*:\s*(.*)/i);
  return match ? { index: Number(match[1]), name: match[2].trim() } : null;
}

function buildBlocks(lines) {
  const blocks = [];
  let open = null;
  lines.forEach((line, index) => {
    if (/^\s*;\s*---\s*dip\s*---/i.test(line.raw)) open = { kind: "dip", lineStart: index, lineEnd: index };
    else if (/^\s*;\s*---\s*dip done\s*---/i.test(line.raw) && open?.kind === "dip") { open.lineEnd = index; blocks.push(open); open = null; }
    else if (/^\s*;\s*---\s*maintenance pause\s*---/i.test(line.raw)) open = { kind: "maintenance", lineStart: index, lineEnd: index };
    else if (/^\s*;\s*---\s*resume\s*---/i.test(line.raw) && open?.kind === "maintenance") { open.lineEnd = index; blocks.push(open); open = null; }
  });
  if (open) blocks.push({ ...open, unbalanced: true, lineEnd: lines.length - 1 });
  return blocks;
}

export function parseGcode(source, profile = {}) {
  const meta = { penNames: {} };
  const lines = physicalLines(source);
  for (const line of lines) line.op = parseLine(line, meta, profile);
  const inferredZ = [...new Set(lines.filter((line) => line.op.kind === "zmove").map((line) => line.op.params.Z))].sort((a, b) => a - b);
  if (!meta.zMode && inferredZ.length) meta.zMode = "bed";

  let absolute = true;
  let millimeters = true;
  let penState = "unknown";
  let x = 0, y = 0, z = null, feed = null, positionLine = null;
  let penIndex = 0;
  let sectionId = 0;
  let activeStroke = null;
  let drawLength = 0, travelLength = 0, drawMinutes = 0, travelMinutes = 0, dwellMs = 0;
  const strokes = [], travels = [], events = [], sections = [];
  const blocks = buildBlocks(lines);
  const blockAt = new Map();
  for (const block of blocks) for (let i = block.lineStart; i <= block.lineEnd; i += 1) blockAt.set(i, block);

  const section = () => {
    if (!sections[sectionId]) sections[sectionId] = { id: sectionId, penIndex, name: meta.penNames[penIndex] || `Pen ${penIndex}`, strokeIds: [], eventIds: [] };
    sections[sectionId].penIndex = penIndex;
    sections[sectionId].name = meta.penNames[penIndex] || sections[sectionId].name;
    return sections[sectionId];
  };
  section();
  const finishStroke = () => {
    if (activeStroke && activeStroke.pts.length >= 2) {
      activeStroke.id = strokes.length;
      strokes.push(activeStroke);
      section().strokeIds.push(activeStroke.id);
    }
    activeStroke = null;
  };
  const addEvent = (kind, lineStart, lineEnd = lineStart, comment = "") => {
    const block = blockAt.get(lineStart);
    const event = {
      id: events.length, kind, label: eventLabel(kind), lineStart: block?.lineStart ?? lineStart,
      lineEnd: block?.lineEnd ?? lineEnd, x, y, comment, sectionId,
    };
    if (!events.some((item) => item.lineStart === event.lineStart && item.lineEnd === event.lineEnd && item.kind === event.kind)) {
      events.push(event); section().eventIds.push(event.id);
    }
  };

  lines.forEach((line, lineIndex) => {
    const op = line.op;
    op.lineIndex = lineIndex;
    op.stateBefore = penState;
    op.xBefore = x; op.yBefore = y;
    if (op.kind === "modal") {
      if (op.command === "G90") absolute = true;
      if (op.command === "G91") absolute = false;
      if (op.command === "G21") millimeters = true;
      if (op.command === "G20") millimeters = false;
    } else if (op.kind === "servo") {
      const next = servoState(op, meta, profile);
      if (next) { if (next !== "down") finishStroke(); penState = next; }
    } else if (op.kind === "zmove") {
      z = op.params.Z;
      const next = zState(op, meta, profile, inferredZ);
      if (next) { if (next !== "down") finishStroke(); penState = next; }
    } else if (op.kind === "macro" && (op.macro === "PEN_UP" || op.macro === "PEN_DOWN")) {
      const next = op.macro === "PEN_UP" ? "up" : "down";
      if (next !== "down") finishStroke();
      penState = next;
    } else if (op.kind === "move") {
      const nx = finite(op.params.X) ? (absolute ? op.params.X : x + op.params.X) : x;
      const ny = finite(op.params.Y) ? (absolute ? op.params.Y : y + op.params.Y) : y;
      const nz = finite(op.params.Z) ? (absolute || z == null ? op.params.Z : z + op.params.Z) : z;
      const nextFeed = finite(op.params.F) ? op.params.F : feed;
      const length = Math.hypot(nx - x, ny - y);
      const drawing = op.command === "G1" && penState === "down";
      op.motionKind = drawing ? "draw" : "travel";
      op.x = nx; op.y = ny; op.z = nz; op.feed = nextFeed;
      if (drawing) {
        if (!activeStroke) activeStroke = { lineStart: lineIndex, lineEnd: lineIndex, pts: [[x, y, z]], pointLines: [positionLine ?? lineIndex], penIndex, sectionId, color: PEN_COLORS[penIndex % PEN_COLORS.length] };
        activeStroke.pts.push([nx, ny, nz]);
        activeStroke.pointLines.push(lineIndex);
        activeStroke.lineEnd = lineIndex;
        drawLength += length;
        if (nextFeed > 0) drawMinutes += length / nextFeed;
      } else {
        finishStroke();
        if (length > 0) {
          travels.push({ id: travels.length, lineIndex, from: [x, y], to: [nx, ny], sectionId });
          travelLength += length;
          if (nextFeed > 0) travelMinutes += length / nextFeed;
        }
      }
      x = nx; y = ny; z = nz; feed = nextFeed; positionLine = lineIndex;
    } else if (op.kind === "dwell") {
      dwellMs += op.ms || 0;
    }

    if (op.kind === "header") {
      const pen = penFromComment(op.comment);
      if (pen) { penIndex = pen.index; meta.penNames[pen.index] = pen.name; section().penIndex = penIndex; section().name = pen.name; }
    }
    if (op.kind === "pause") {
      finishStroke();
      addEvent(op.eventKind, lineIndex, lineIndex, op.comment);
      if (op.eventKind === "pen-change") {
        const pen = penFromComment(op.comment);
        sectionId += 1;
        if (pen) { penIndex = pen.index; meta.penNames[pen.index] = pen.name; }
        section();
      }
    } else if (op.eventKind) addEvent(op.eventKind, lineIndex, lineIndex, op.comment);
    const block = blockAt.get(lineIndex);
    if (block && lineIndex === block.lineStart) addEvent(block.kind, block.lineStart, block.lineEnd);
    op.stateAfter = penState;
  });
  finishStroke();

  const unknownCount = lines.filter((line) => line.op.kind === "other").length;
  const unsafeModal = lines.some((line) => line.op.kind === "modal" && (line.op.command === "G91" || line.op.command === "G20"));
  const boundsPts = strokes.flatMap((stroke) => stroke.pts);
  const bounds = boundsPts.length ? {
    minX: Math.min(...boundsPts.map((point) => point[0])), minY: Math.min(...boundsPts.map((point) => point[1])),
    maxX: Math.max(...boundsPts.map((point) => point[0])), maxY: Math.max(...boundsPts.map((point) => point[1])),
  } : null;
  return {
    source, lines, meta, strokes, travels, events, sections: sections.filter(Boolean), blocks, bounds,
    warnings: { unknownCount, unsafeModal, inferredZ: meta.zMode === "bed" && !profile.penUp ? inferredZ : null },
    stats: { drawLength, travelLength, drawMinutes, travelMinutes, dwellMs, totalMinutes: drawMinutes + travelMinutes + dwellMs / 60000 },
  };
}
