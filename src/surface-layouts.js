import { createStrip, stripCorners } from "./surface-composer.js";

export const COMPOSITION_DEFAULTS = Object.freeze({ sheetWidthMm: 300, sheetHeightMm: 200, columns: 2, rows: 2, rollWidthMm: 530, rollLengthMm: 2400, rollCount: 2, pieceLengthMm: 800, seamMm: 5, join: "Overlap", marks: true, markPen: 0, labels: false });
export function compositionSettings(input = {}) {
  const p = { ...COMPOSITION_DEFAULTS, ...input }, out = {};
  for (const [key, max] of [["sheetWidthMm", 100000], ["sheetHeightMm", 100000], ["rollWidthMm", 1200], ["rollLengthMm", 30000], ["pieceLengthMm", 30000]]) {
    if (!Number.isFinite(p[key]) || p[key] <= 0 || p[key] > max) throw new Error(`Check ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
    out[key] = p[key];
  }
  for (const [key, max, min] of [["columns", 6, 1], ["rows", 8, 1], ["rollCount", 12, 1], ["markPen", 255, 0]]) {
    if (!Number.isSafeInteger(p[key]) || p[key] < min || p[key] > max) throw new Error(`Check ${key}.`);
    out[key] = p[key];
  }
  if (!Number.isFinite(p.seamMm) || p.seamMm < 0 || p.seamMm > 40 || !["Overlap", "Gap"].includes(p.join)) throw new Error("Check the seam width and joining mode.");
  if (typeof p.marks !== "boolean" || typeof p.labels !== "boolean") throw new Error("Invalid production marks.");
  return { ...out, seamMm: p.seamMm, join: p.join, marks: p.marks, labels: p.labels };
}
export function readComposition(input) {
  if (!input || !["Sheets", "Roll"].includes(input.family)) throw new Error("Unknown paper layout.");
  const composition = { family: input.family, settings: compositionSettings(input.settings), generated: compositionSettings(input.generated ?? input.settings) };
  compositionGeometry(composition.family, composition.generated);
  return composition;
}

/** Preview objects describe the SAME grid pitches used by sliceMega/sliceRoll.
 * Roll objects are full continuous papers; machine pieces are never papers. */
export function compositionGeometry(family, input) {
  const p = compositionSettings(input), roll = family === "Roll";
  if (!roll && family !== "Sheets") throw new Error("Unknown paper layout.");
  const width = roll ? p.rollWidthMm : p.sheetWidthMm, length = roll ? p.rollLengthMm : p.sheetHeightMm;
  if (p.join === "Overlap" && (p.seamMm >= width || !roll && p.seamMm >= length)) throw new Error("Overlap must be smaller than the paper dimensions.");
  const dx = width + (p.join === "Gap" ? p.seamMm : -p.seamMm);
  const dy = roll ? length : length + (p.join === "Gap" ? p.seamMm : -p.seamMm);
  const cols = roll ? p.rollCount : p.columns, rows = roll ? 1 : p.rows;
  const strips = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) strips.push(createStrip({
    id: `${roll ? "roll" : "sheet"}-${String(strips.length + 1).padStart(3, "0")}`,
    centerXmm: c * dx + width / 2, centerYmm: r * dy + length / 2,
    physicalWidthMm: width, printableWidthMm: width, printableOffsetMm: 0, lengthMm: length,
    zIndex: strips.length, printOrder: strips.length + 1,
  }));
  return { widthMm: width + (cols - 1) * dx, heightMm: length + (rows - 1) * dy, strips };
}
export function generateComposition(session, family = session.composition?.family, settings = session.composition?.settings) {
  const p = compositionSettings(settings), geometry = compositionGeometry(family, p), first = geometry.strips[0];
  return { ...session, ...geometry, mode: "tiling", selectedId: first.id, nextId: geometry.strips.length + 1,
    composition: { family, settings: p, generated: p },
    layout: { ...session.layout, physicalWidthMm: first.physicalWidthMm, printableWidthMm: first.printableWidthMm, printableOffsetMm: 0, lengthMm: first.lengthMm, rotationDeg: 0, count: null, gapMm: p.join === "Gap" ? p.seamMm : 0 },
    production: { ...session.production, fromMm: 0, toMm: null },
  };
}
export function updateComposition(session, patch) {
  return { ...session, composition: { ...session.composition, settings: compositionSettings({ ...session.composition.settings, ...patch }) } };
}
export function compositionPieces(session, strip) {
  const segment = session.composition?.family === "Roll" ? session.composition.settings.pieceLengthMm : strip.lengthMm;
  const count = Math.ceil(strip.lengthMm / segment);
  if (count > 8192) throw new Error("Too many machine pieces; increase the piece length.");
  return Array.from({ length: count }, (_, i) => ({ index: i, fromMm: i * segment, lengthMm: Math.min(segment, strip.lengthMm - i * segment), widthMm: strip.physicalWidthMm }));
}
export function regularCompositionMatches(session) {
  if (!session.composition || session.mode !== "tiling") return false;
  const expected = compositionGeometry(session.composition.family, session.composition.generated);
  if (Math.abs(expected.widthMm - session.widthMm) > 1e-7 || Math.abs(expected.heightMm - session.heightMm) > 1e-7 || expected.strips.length !== session.strips.length) return false;
  return expected.strips.every((strip, i) => {
    const actual = session.strips[i];
    return actual.contentMode === "image-mapping" && actual.visible && actual.id === strip.id && actual.rotationDeg === 0 && actual.printOrder === strip.printOrder && actual.printableOffsetMm === 0 && actual.printableWidthMm === strip.physicalWidthMm && stripCorners(strip).every((p, j) => p.every((n, k) => Math.abs(n - stripCorners(actual)[j][k]) < 1e-7));
  });
}
