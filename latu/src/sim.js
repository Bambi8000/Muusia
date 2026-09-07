import { PEN_COLORS } from "./dialect.js";

const finite = (value) => Number.isFinite(value);
const secondsForMove = (distance, feed) => feed > 0 ? distance / feed * 60 : 0;

function penName(doc, penIndex) {
  return doc.meta.penNames[penIndex] || doc.sections.find((section) => section.penIndex === penIndex)?.name || `Pen ${penIndex}`;
}

function lineSections(doc) {
  const changes = doc.events.filter((event) => event.kind === "pen-change").sort((a, b) => a.lineStart - b.lineStart);
  let sectionIndex = 0;
  return doc.lines.map((_, lineIndex) => {
    while (sectionIndex < changes.length && lineIndex > changes[sectionIndex].lineEnd) sectionIndex += 1;
    return doc.sections[Math.min(sectionIndex, doc.sections.length - 1)] || { penIndex: 0, name: "Pen 0" };
  });
}

export function buildTimeline(doc, profile = {}) {
  const steps = [];
  const chapters = [];
  const perPen = new Map();
  const sectionsByLine = lineSections(doc);
  let time = 0;
  let position = [0, 0, null];
  const rotation = new Map();

  const add = (step) => {
    const duration = Math.max(0, Number(step.duration) || 0);
    const section = sectionsByLine[step.lineIndex] || { penIndex: 0 };
    const penIndex = section.penIndex ?? 0;
    const item = { ...step, penIndex, color: PEN_COLORS[penIndex % PEN_COLORS.length], start: time, end: time + duration, duration };
    steps.push(item);
    time = item.end;
    const totals = perPen.get(penIndex) || { penIndex, name: penName(doc, penIndex), color: PEN_COLORS[penIndex % PEN_COLORS.length], draw: 0, travel: 0, dwell: 0, settle: 0, other: 0, total: 0 };
    const bucket = Object.hasOwn(totals, item.kind) ? item.kind : "other";
    totals[bucket] += duration; totals.total += duration; perPen.set(penIndex, totals);
  };

  doc.lines.forEach((line, lineIndex) => {
    const op = line.op;
    if (op.kind === "pause") {
      chapters.push({ time, lineIndex, kind: op.eventKind || "pause", label: op.comment || op.eventKind || "Pause" });
      return;
    }
    if (op.kind === "move") {
      const from = [op.xBefore, op.yBefore, position[2]];
      const to = [op.x, op.y, finite(op.z) ? op.z : position[2]];
      const distance = Math.hypot(to[0] - from[0], to[1] - from[1], finite(to[2]) && finite(from[2]) ? to[2] - from[2] : 0);
      const kind = op.motionKind === "draw" ? "draw" : "travel";
      const feed = op.feed || (kind === "draw" ? profile.feedDraw : profile.feedTravel);
      add({ kind, lineIndex, from, to, duration: secondsForMove(distance, feed), feed });
      position = to;
      return;
    }
    if (op.kind === "zmove") {
      const nextZ = op.params.Z;
      const distance = finite(position[2]) ? Math.abs(nextZ - position[2]) : 0;
      add({ kind: "travel", lineIndex, from: [...position], to: [position[0], position[1], nextZ], duration: secondsForMove(distance, op.params.F || profile.zFeed), feed: op.params.F || profile.zFeed });
      position = [position[0], position[1], nextZ];
    }
    if (op.kind === "dwell") add({ kind: "dwell", lineIndex, from: [...position], to: [...position], duration: (op.ms || 0) / 1000 });
    if (op.kind === "macro" && op.macro === "EXTRUDER_MOVE") add({ kind: "other", lineIndex, from: [...position], to: [...position], duration: secondsForMove(Math.abs(op.params.E || 0), op.params.F || 0) });
    if (op.kind === "macro" && op.macro === "MANUAL_STEPPER") {
      const stepper = op.args.STEPPER || "stepper";
      const from = rotation.get(stepper) || 0;
      const to = Number(op.args.MOVE);
      const speed = Number(op.args.SPEED);
      add({ kind: "other", lineIndex, from: [...position], to: [...position], duration: finite(to) && speed > 0 ? Math.abs(to - from) / speed : 0 });
      if (finite(to)) rotation.set(stepper, to);
    }
    const stateChanged = op.stateBefore !== "unknown" && op.stateAfter && op.stateAfter !== op.stateBefore;
    const penStateOp = op.kind === "servo" || op.kind === "zmove" || op.kind === "macro" && (op.macro === "PEN_UP" || op.macro === "PEN_DOWN");
    const nextIsExplicitDwell = doc.lines[lineIndex + 1]?.op.kind === "dwell";
    if (stateChanged && penStateOp && !nextIsExplicitDwell) {
      const down = op.stateAfter === "down";
      const delay = down ? (doc.meta.penDelayDown ?? profile.penDelayDown) : (doc.meta.penDelayUp ?? profile.penDelayUp);
      if (delay > 0) add({ kind: "settle", lineIndex, from: [...position], to: [...position], duration: delay / 1000 });
    }
  });

  return { steps, chapters, perPen: [...perPen.values()], total: time, startPosition: steps[0]?.from || [0, 0, null] };
}

export function sampleTimeline(timeline, seconds) {
  const time = Math.max(0, Math.min(Number(seconds) || 0, timeline.total));
  if (!timeline.steps.length) return { time, lineIndex: null, position: timeline.startPosition, stepIndex: -1, progress: 0 };
  let low = 0, high = timeline.steps.length - 1, found = timeline.steps.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (timeline.steps[mid].end >= time) { found = mid; high = mid - 1; } else low = mid + 1;
  }
  const step = timeline.steps[found];
  const progress = step.duration ? Math.max(0, Math.min(1, (time - step.start) / step.duration)) : (time >= step.end ? 1 : 0);
  const position = step.from.map((value, index) => finite(value) && finite(step.to[index]) ? value + (step.to[index] - value) * progress : step.to[index] ?? value);
  return { time, lineIndex: step.lineIndex, position, stepIndex: found, progress, step };
}

export function formatPlaybackTime(seconds) {
  const value = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const secs = value % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}
