import { emitGcode, formatNumber } from "./emitter.js";
import { parseGcode } from "./parser.js";

const cloneLines = (doc) => doc.lines.map((line) => ({ ...line, op: line.op ? { ...line.op } : null }));
const finish = (lines) => lines.map((line) => `${line.raw}${line.ending}`).join("");

function replaceWord(raw, letter, value) {
  const re = new RegExp(`(\\b${letter}\\s*=?\\s*)([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))`, "i");
  return re.test(raw) ? raw.replace(re, `$1${formatNumber(value)}`) : raw;
}

function setPoint(raw, point) {
  let next = replaceWord(raw, "X", point[0]);
  next = replaceWord(next, "Y", point[1]);
  if (point[2] != null && /\bZ\s*=?\s*[-+.\d]/i.test(next)) next = replaceWord(next, "Z", point[2]);
  return next;
}

function mergeRanges(ranges) {
  const sorted = ranges.filter(Boolean).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1] + 1) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function sourceAfterTransform(doc, strokeIds, transform) {
  const wanted = new Set(strokeIds);
  const lines = cloneLines(doc);
  for (const stroke of doc.strokes) {
    if (!wanted.has(stroke.id)) continue;
    stroke.pts.forEach((point, index) => {
      const lineIndex = stroke.pointLines[index];
      if (lineIndex == null || !lines[lineIndex]) return;
      lines[lineIndex].raw = setPoint(lines[lineIndex].raw, transform(point, stroke, index));
      lines[lineIndex].dirty = true;
    });
  }
  return finish(lines);
}

export function translateStrokes(doc, strokeIds, dx, dy) {
  return sourceAfterTransform(doc, strokeIds, ([x, y, z]) => [x + dx, y + dy, z]);
}

export function rotateStrokes(doc, strokeIds, degrees, customCenter = null) {
  const points = doc.strokes.filter((stroke) => strokeIds.includes(stroke.id)).flatMap((stroke) => stroke.pts);
  if (!points.length) return doc.source;
  let center = customCenter;
  if (!center) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    center = [(minX + maxX) / 2, (minY + maxY) / 2];
  }
  const angle = Number(degrees) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return sourceAfterTransform(doc, strokeIds, ([x, y, z]) => {
    const dx = x - center[0], dy = y - center[1];
    return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos, z];
  });
}

export function scaleStrokes(doc, strokeIds, options) {
  const strokes = doc.strokes.filter((stroke) => strokeIds.includes(stroke.id));
  const points = strokes.flatMap((stroke) => stroke.pts);
  if (!points.length) return { source: doc.source, collapsed: 0 };
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const point of points) {
    bounds.minX = Math.min(bounds.minX, point[0]); bounds.minY = Math.min(bounds.minY, point[1]);
    bounds.maxX = Math.max(bounds.maxX, point[0]); bounds.maxY = Math.max(bounds.maxY, point[1]);
  }
  const width = Math.max(1e-9, bounds.maxX - bounds.minX), height = Math.max(1e-9, bounds.maxY - bounds.minY);
  let sx = Number(options.sx) || 1, sy = options.uniform ? sx : (Number(options.sy) || sx);
  if (options.mode === "fit") {
    sx = Math.max(0, Number(options.width) - 2 * (Number(options.margin) || 0)) / width;
    sy = Math.max(0, Number(options.height) - 2 * (Number(options.margin) || 0)) / height;
    if (options.preserveAspect !== false) sx = sy = Math.min(sx, sy);
  }
  const anchor = options.anchor === "origin" ? [bounds.minX, bounds.minY] : options.anchor === "custom" ? [Number(options.customX) || 0, Number(options.customY) || 0] : [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
  let source = sourceAfterTransform(doc, strokeIds, ([x, y, z]) => [anchor[0] + (x - anchor[0]) * sx, anchor[1] + (y - anchor[1]) * sy, z]);
  let scaled = parseGcode(source);
  let lines = cloneLines(scaled);
  for (const oldStroke of strokes) {
    const newStroke = scaled.strokes[oldStroke.id]; if (!newStroke) continue;
    for (let i = 1; i < oldStroke.pts.length; i += 1) {
      const e = doc.lines[oldStroke.pointLines[i]]?.op?.params?.E;
      if (!Number.isFinite(e)) continue;
      const oldLength = Math.hypot(oldStroke.pts[i][0] - oldStroke.pts[i - 1][0], oldStroke.pts[i][1] - oldStroke.pts[i - 1][1]);
      const newLength = Math.hypot(newStroke.pts[i][0] - newStroke.pts[i - 1][0], newStroke.pts[i][1] - newStroke.pts[i - 1][1]);
      lines[newStroke.pointLines[i]].raw = replaceWord(lines[newStroke.pointLines[i]].raw, "E", oldLength ? e * newLength / oldLength : e);
    }
  }
  source = finish(lines); scaled = parseGcode(source); lines = cloneLines(scaled);
  const duplicates = [];
  for (const stroke of scaled.strokes.filter((item) => strokeIds.includes(item.id))) {
    for (let i = 1; i < stroke.pts.length; i += 1) if (stroke.pts[i][0] === stroke.pts[i - 1][0] && stroke.pts[i][1] === stroke.pts[i - 1][1]) duplicates.push(stroke.pointLines[i]);
  }
  for (const lineIndex of [...new Set(duplicates)].sort((a, b) => b - a)) lines.splice(lineIndex, 1);
  source = finish(lines);
  if (strokeIds.length === doc.strokes.length) {
    scaled = parseGcode(source); lines = cloneLines(scaled);
    const canvas = lines.find((line) => /^;\s*Canvas\s+/i.test(line.raw));
    if (canvas) {
      const widthOut = options.mode === "fit" ? Number(options.width) : (doc.meta.canvasW || width) * sx;
      const heightOut = options.mode === "fit" ? Number(options.height) : (doc.meta.canvasH || height) * sy;
      canvas.raw = canvas.raw.replace(/^(;\s*Canvas\s*)[-+.\d]+(\s*x\s*)[-+.\d]+/i, `$1${formatNumber(widthOut)}$2${formatNumber(heightOut)}`);
    }
    const check = lines.find((line) => /^CANVAS_CHECK\b/i.test(line.raw));
    if (check && scaled.bounds) {
      check.raw = replaceWord(replaceWord(replaceWord(replaceWord(check.raw, "X_MIN", scaled.bounds.minX), "X_MAX", scaled.bounds.maxX), "Y_MIN", scaled.bounds.minY), "Y_MAX", scaled.bounds.maxY);
    }
    source = finish(lines);
  }
  return { source, collapsed: duplicates.length };
}

export function reverseStrokes(doc, strokeIds) {
  const wanted = new Set(strokeIds);
  const lines = cloneLines(doc);
  for (const stroke of doc.strokes) {
    if (!wanted.has(stroke.id)) continue;
    const reversed = [...stroke.pts].reverse();
    stroke.pointLines.forEach((lineIndex, index) => { lines[lineIndex].raw = setPoint(lines[lineIndex].raw, reversed[index]); lines[lineIndex].dirty = true; });
  }
  return finish(lines);
}

export function deleteSelection(doc, strokeIds = [], eventIds = []) {
  const ranges = [
    ...strokeIds.map((id) => doc.strokes[id] && [doc.strokes[id].blockStart, doc.strokes[id].blockEnd]),
    ...eventIds.map((id) => doc.events[id] && [doc.events[id].lineStart, doc.events[id].lineEnd]),
  ];
  const lines = cloneLines(doc);
  for (const [start, end] of mergeRanges(ranges).reverse()) lines.splice(start, end - start + 1);
  return finish(lines);
}

export function copyStrokes(doc, strokeIds) {
  const wanted = new Set(strokeIds);
  return doc.strokes.filter((stroke) => wanted.has(stroke.id)).sort((a, b) => a.blockStart - b.blockStart)
    .map((stroke) => doc.lines.slice(stroke.blockStart, stroke.blockEnd + 1).map((line) => `${line.raw}${line.ending}`).join(""))
    .join("");
}

export function pasteAfterSelection(doc, fragment, strokeIds) {
  if (!fragment) return doc.source;
  const selected = strokeIds.map((id) => doc.strokes[id]).filter(Boolean);
  const after = selected.length ? Math.max(...selected.map((stroke) => stroke.blockEnd)) : doc.lines.length - 1;
  const lines = cloneLines(doc);
  const parsed = parseGcode(fragment);
  lines.splice(after + 1, 0, ...parsed.lines.map((line) => ({ ...line, dirty: true })));
  return finish(lines);
}

export function insertMidpoint(doc, strokeId, lineIndex) {
  const stroke = doc.strokes[strokeId];
  if (!stroke) return doc.source;
  const pointIndex = stroke.pointLines.indexOf(lineIndex);
  if (pointIndex < 1) return doc.source;
  const a = stroke.pts[pointIndex - 1], b = stroke.pts[pointIndex];
  const point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] == null || b[2] == null ? (b[2] ?? a[2]) : (a[2] + b[2]) / 2];
  return insertPoint(doc, strokeId, lineIndex, point);
}

export function insertPoint(doc, strokeId, lineIndex, point) {
  const stroke = doc.strokes[strokeId];
  if (!stroke || stroke.pointLines.indexOf(lineIndex) < 1) return doc.source;
  const lines = cloneLines(doc);
  const template = { ...lines[lineIndex], raw: setPoint(lines[lineIndex].raw, point), dirty: true };
  lines.splice(lineIndex, 0, template);
  return finish(lines);
}

export function movePoint(doc, strokeId, pointIndex, dx, dy) {
  const stroke = doc.strokes[strokeId], point = stroke?.pts[pointIndex];
  if (!point) return doc.source;
  const lines = cloneLines(doc), lineIndex = stroke.pointLines[pointIndex];
  lines[lineIndex].raw = setPoint(lines[lineIndex].raw, [point[0] + dx, point[1] + dy, point[2]]);
  lines[lineIndex].dirty = true;
  return finish(lines);
}

export function deletePoint(doc, strokeId, pointIndex) {
  const stroke = doc.strokes[strokeId];
  if (!stroke) return doc.source;
  if (stroke.pts.length <= 2) return deleteSelection(doc, [strokeId]);
  const lines = cloneLines(doc);
  if (pointIndex === 0) {
    lines[stroke.approachLine].raw = setPoint(lines[stroke.approachLine].raw, stroke.pts[1]);
    lines.splice(stroke.pointLines[1], 1);
  } else lines.splice(stroke.pointLines[pointIndex], 1);
  return finish(lines);
}

export function splitStroke(doc, strokeId, lineIndex) {
  const stroke = doc.strokes[strokeId];
  if (!stroke) return doc.source;
  const pointIndex = stroke.pointLines.indexOf(lineIndex);
  if (pointIndex < 1 || pointIndex >= stroke.pts.length - 1) return doc.source;
  const lines = cloneLines(doc);
  const teardown = lines.slice(stroke.lineEnd + 1, stroke.blockEnd + 1).map((line) => ({ ...line, dirty: true }));
  const setup = lines.slice(stroke.blockStart, stroke.lineStart).map((line) => ({ ...line, dirty: true }));
  const approach = setup.find((line) => line.op?.kind === "move");
  if (approach) approach.raw = setPoint(approach.raw, stroke.pts[pointIndex]);
  lines.splice(lineIndex + 1, 0, ...teardown, ...setup);
  return finish(lines);
}

export function joinAdjacentStrokes(doc, strokeIds, tolerance = 1) {
  if (strokeIds.length !== 2) return { source: doc.source, error: "Select exactly two strokes." };
  let [a, b] = strokeIds.map((id) => doc.strokes[id]).sort((x, y) => x.blockStart - y.blockStart);
  if (!a || !b || a.sectionId !== b.sectionId) return { source: doc.source, error: "Strokes must be in the same section." };
  const between = doc.lines.slice(a.blockEnd + 1, b.blockStart).filter((line) => line.raw.trim());
  if (between.length) return { source: doc.source, error: "Only adjacent strokes can be joined safely." };
  const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const choices = [
    { reverse: [], distance: distance(a.pts.at(-1), b.pts[0]) },
    { reverse: [b.id], distance: distance(a.pts.at(-1), b.pts.at(-1)) },
    { reverse: [a.id], distance: distance(a.pts[0], b.pts[0]) },
    { reverse: [a.id, b.id], distance: distance(a.pts[0], b.pts.at(-1)) },
  ].sort((x, y) => x.distance - y.distance);
  const best = choices[0];
  if (best.distance > tolerance) return { source: doc.source, error: `Closest endpoints are ${best.distance.toFixed(2)} mm apart.` };
  const working = best.reverse.length ? parseGcode(reverseStrokes(doc, best.reverse)) : doc;
  [a, b] = [working.strokes[a.id], working.strokes[b.id]];
  const lines = cloneLines(working);
  lines.splice(a.lineEnd + 1, b.lineStart - a.lineEnd - 1);
  return { source: finish(lines), error: null };
}

export function reorderSection(doc, sectionId, orderedIds) {
  const strokes = orderedIds.map((id) => doc.strokes[id]).filter((stroke) => stroke?.sectionId === sectionId);
  if (strokes.length < 2) return doc.source;
  const slots = [...strokes].sort((a, b) => a.blockStart - b.blockStart);
  const chunks = new Map(strokes.map((stroke) => [stroke.id, doc.lines.slice(stroke.blockStart, stroke.blockEnd + 1).map((line) => ({ ...line, dirty: true }))]));
  const lines = cloneLines(doc);
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const slot = slots[i]; lines.splice(slot.blockStart, slot.blockEnd - slot.blockStart + 1, ...chunks.get(orderedIds[i]));
  }
  return finish(lines);
}

export function optimizeRoute(doc, strokeIds) {
  const remaining = strokeIds.map((id) => doc.strokes[id]).filter(Boolean);
  if (remaining.length < 2 || new Set(remaining.map((stroke) => stroke.sectionId)).size > 1) return { source: doc.source, error: "Route optimization stays within one pen section." };
  const ordered = [];
  let cursor = remaining[0].pts[0];
  while (remaining.length) {
    let bestIndex = 0, bestReverse = false, bestDistance = Infinity;
    remaining.forEach((stroke, index) => {
      const d0 = Math.hypot(cursor[0] - stroke.pts[0][0], cursor[1] - stroke.pts[0][1]);
      const d1 = Math.hypot(cursor[0] - stroke.pts.at(-1)[0], cursor[1] - stroke.pts.at(-1)[1]);
      if (Math.min(d0, d1) < bestDistance) { bestDistance = Math.min(d0, d1); bestIndex = index; bestReverse = d1 < d0; }
    });
    const stroke = remaining.splice(bestIndex, 1)[0];
    ordered.push({ id: stroke.id, reverse: bestReverse }); cursor = bestReverse ? stroke.pts[0] : stroke.pts.at(-1);
  }
  let source = doc.source;
  const reverseIds = ordered.filter((item) => item.reverse).map((item) => item.id);
  if (reverseIds.length) source = reverseStrokes(doc, reverseIds);
  const reparsed = parseGcode(source);
  const idsByOriginalStart = new Map(reparsed.strokes.map((stroke) => [stroke.lineStart, stroke.id]));
  const orderIds = ordered.map((item) => idsByOriginalStart.get(doc.strokes[item.id].lineStart));
  return { source: reorderSection(reparsed, remaining[0]?.sectionId ?? doc.strokes[strokeIds[0]].sectionId, orderIds), error: null };
}

export function finalizeForSave(doc, profileName = "") {
  const lines = cloneLines(doc);
  const statsRaw = `; Draw ${(doc.stats.drawLength / 1000).toFixed(2)} m, travel ${(doc.stats.travelLength / 1000).toFixed(2)} m — est. ${Math.ceil(doc.stats.drawMinutes + doc.stats.travelMinutes)} min (+ pen lifts & pauses)`;
  const statsLine = lines.find((line) => /^;\s*Draw\s+/i.test(line.raw));
  if (statsLine) statsLine.raw = statsRaw;
  else if (doc.meta.muusiaVersion) {
    const canvasIndex = lines.findIndex((line) => /^;\s*Canvas\s+/i.test(line.raw));
    lines.splice(canvasIndex >= 0 ? canvasIndex + 1 : 1, 0, { raw: statsRaw, ending: lines[0]?.ending || "\n", dirty: true, op: null });
  }
  if (!lines.some((line) => /^;\s*edited with LATU/i.test(line.raw))) {
    const headerEnd = lines.findIndex((line) => !line.raw.trim().startsWith(";"));
    const ending = lines[0]?.ending || "\n";
    lines.splice(headerEnd < 0 ? 0 : headerEnd, 0, { raw: "; edited with LATU v0.1", ending, dirty: true, op: null });
  }
  const profileLine = lines.find((line) => /^;\s*LATU profile:/i.test(line.raw));
  if (profileName && profileLine) profileLine.raw = `; LATU profile: ${profileName}`;
  else if (profileName) {
    const editedIndex = lines.findIndex((line) => /^;\s*edited with LATU/i.test(line.raw));
    lines.splice(editedIndex >= 0 ? editedIndex + 1 : 0, 0, { raw: `; LATU profile: ${profileName}`, ending: lines[0]?.ending || "\n", dirty: true, op: null });
  }
  return finish(lines);
}

export function addStroke(doc, points, sectionId = 0) {
  if (points.length < 2) return doc.source;
  const section = doc.sections.find((item) => item.id === sectionId) || doc.sections[0];
  const sectionStrokes = section?.strokeIds.map((id) => doc.strokes[id]).filter(Boolean) || [];
  const sample = sectionStrokes[0] || doc.strokes[0];
  const ending = doc.lines[0]?.ending || "\n";
  const feedTravel = sample ? doc.lines[sample.approachLine].op.feed || doc.lines[sample.approachLine].op.params.F : 3000;
  const feedDraw = sample ? doc.lines[sample.pointLines[1]]?.op.feed || doc.lines[sample.pointLines[1]]?.op.params.F : 1800;
  const created = [];
  const push = (raw) => created.push({ raw, ending, dirty: true, op: null });
  push(`G0 X${formatNumber(points[0][0])} Y${formatNumber(points[0][1])} F${feedTravel || 3000}`);
  if (doc.meta.zMode === "bed") push(`G1 Z${formatNumber(doc.meta.penDown ?? 0)} F600`);
  else push(`SET_SERVO SERVO=${doc.meta.servoName || "pen"} ANGLE=${formatNumber(doc.meta.servoDown ?? 80)} ; pen down`);
  if (doc.meta.penDelayDown) push(`G4 P${doc.meta.penDelayDown} ; settle before draw`);
  for (let i = 1; i < points.length; i += 1) push(`G1 X${formatNumber(points[i][0])} Y${formatNumber(points[i][1])} F${feedDraw || 1800}`);
  if (doc.meta.zMode === "bed") push(`G1 Z${formatNumber(doc.meta.travelZ ?? doc.meta.penUp ?? 3)} F600`);
  else push(`SET_SERVO SERVO=${doc.meta.servoName || "pen"} ANGLE=${formatNumber(doc.meta.servoUp ?? 135)}`);
  if (doc.meta.penDelayUp) push(`G4 P${doc.meta.penDelayUp} ; settle`);
  const lines = cloneLines(doc);
  const at = sectionStrokes.length ? Math.max(...sectionStrokes.map((stroke) => stroke.blockEnd)) + 1 : lines.length;
  lines.splice(at, 0, ...created);
  return finish(lines);
}

export function auditDocument(doc) {
  const warnings = [];
  let outside = 0;
  if (doc.meta.workW && doc.meta.workH) for (const stroke of doc.strokes) for (const [x, y] of stroke.pts) {
    if (x < 0 || y < 0 || x > doc.meta.workW || y > doc.meta.workH) outside += 1;
  }
  if (outside) warnings.push({ kind: "bounds", message: `${outside} points outside the work area` });
  const unsafeDraws = doc.lines.filter((line) => line.op.kind === "move" && line.op.command === "G1" && line.op.stateBefore !== "down" && (Number.isFinite(line.op.params.X) || Number.isFinite(line.op.params.Y))).length;
  if (unsafeDraws) warnings.push({ kind: "pen", message: `${unsafeDraws} G1 moves while the pen is not down` });
  const unbalanced = doc.blocks.filter((block) => block.unbalanced).length;
  if (unbalanced) warnings.push({ kind: "block", message: `${unbalanced} unbalanced atomic blocks` });
  const saves = doc.lines.filter((line) => line.op.kind === "macro" && line.op.macro === "SAVE_GCODE_STATE").length;
  const restores = doc.lines.filter((line) => line.op.kind === "macro" && line.op.macro === "RESTORE_GCODE_STATE").length;
  if (saves !== restores) warnings.push({ kind: "state", message: `${saves} SAVE and ${restores} RESTORE commands` });
  if (doc.warnings.unsafeModal) warnings.push({ kind: "modal", message: "Relative or inch mode: visual editing is disabled" });
  if (doc.warnings.unknownCount) warnings.push({ kind: "opaque", message: `${doc.warnings.unknownCount} opaque lines are pinned in place` });
  return warnings;
}

export { emitGcode };
