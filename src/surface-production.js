import { createStrip, stripTransform, stripsInPrintOrder, surfaceSummary } from "./surface-composer.js";

export const DEFAULT_PRODUCTION = Object.freeze({ rollLengthM: 80, usedOnRollM: 0, reserveM: 1, allowanceMm: 20, fromMm: 0, toMm: null, cut: true, serverUrl: "http://127.0.0.1:8633", lastJob: null });
const nonnegative = (n, label) => {
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must not be negative.`);
  return n;
};
export function productionSettings(input = {}) {
  const p = { ...DEFAULT_PRODUCTION, ...input };
  nonnegative(p.rollLengthM, "Roll length"); nonnegative(p.usedOnRollM, "Used paper"); nonnegative(p.reserveM, "Roll reserve"); nonnegative(p.allowanceMm, "Feed/cut allowance"); nonnegative(p.fromMm, "Start position");
  if (!p.rollLengthM || p.reserveM >= p.rollLengthM || p.usedOnRollM > p.rollLengthM) throw new Error("Check the roll length, used paper and reserve.");
  if (p.toMm !== null) nonnegative(p.toMm, "End position");
  if (typeof p.cut !== "boolean") throw new Error("Cut must be a boolean.");
  if (typeof p.serverUrl !== "string" || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(p.serverUrl)) throw new Error("Use the local Print tunnel address.");
  let lastJob = null;
  if (p.lastJob !== null) {
    const j = p.lastJob;
    if (!j || !/^[a-f0-9]{32}$/.test(j.id) || typeof j.stripId !== "string" || !["queued", "printing", "done", "failed", "cancelled", "unknown"].includes(j.status)) throw new Error("Invalid strip print record.");
    nonnegative(j.fromMm, "Print start"); nonnegative(j.toMm, "Print end");
    if (j.toMm <= j.fromMm) throw new Error("Invalid printed range.");
    lastJob = { id: j.id, stripId: j.stripId, fromMm: j.fromMm, toMm: j.toMm, status: j.status };
  }
  return { rollLengthM: p.rollLengthM, usedOnRollM: p.usedOnRollM, reserveM: p.reserveM, allowanceMm: p.allowanceMm, fromMm: p.fromMm, toMm: p.toMm, cut: p.cut, serverUrl: p.serverUrl.replace(/\/$/, ""), lastJob };
}

export function paperBudget(strips, settings) {
  const p = productionSettings(settings), summary = surfaceSummary(strips);
  const allowanceM = summary.stripCount * p.allowanceMm / 1000;
  const totalM = summary.totalLengthM + allowanceM;
  const availableM = Math.max(0, p.rollLengthM - p.usedOnRollM - p.reserveM);
  const extraM = Math.max(0, totalM - availableM);
  const newRollCapacityM = p.rollLengthM - p.reserveM;
  return { artworkM: summary.totalLengthM, allowanceM, totalM, availableM, fits: extraM < 1e-9, shortfallM: extraM, rollsNeeded: totalM === 0 ? 0 : 1 + Math.ceil(Math.max(0, extraM - 1e-9) / newRollCapacityM), stripCount: summary.stripCount };
}

/** A range is a rigid sub-strip. Moving its centre keeps the selected global
 *  artwork fixed; it never restarts or fits the image at the requested offset. */
export function stripPrintRange(input, fromMm = 0, toMm = null) {
  const original = createStrip(input);
  if (!original.visible) throw new Error("Show this strip before printing it.");
  if (original.contentMode !== "image-mapping") throw new Error("Choose Image Mapping content.");
  nonnegative(fromMm, "Start position");
  const endMm = toMm ?? original.lengthMm;
  if (!Number.isFinite(endMm) || fromMm >= endMm || endMm > original.lengthMm) throw new Error(`Choose a range within this ${original.lengthMm.toFixed(1)} mm strip.`);
  const centre = stripTransform(original).toGlobal([original.physicalWidthMm / 2, (fromMm + endMm) / 2]);
  const strip = createStrip({ ...original, centerXmm: centre[0], centerYmm: centre[1], lengthMm: endMm - fromMm });
  return { strip, originalId: original.id, fromMm, toMm: endMm, lengthMm: endMm - fromMm };
}

/** Consecutive is always an explicit, transient UI choice; never auto-restored. */
export function productionPlan(session, { consecutive = false } = {}) {
  const settings = productionSettings(session.production);
  const ordered = stripsInPrintOrder(session.strips);
  const index = ordered.findIndex(s => s.id === session.selectedId);
  if (index < 0) throw new Error("Select a visible strip to print.");
  const items = consecutive ? ordered.slice(index) : ordered.slice(index, index + 1);
  const ranges = items.map((strip, i) => stripPrintRange(strip, i ? 0 : settings.fromMm, consecutive ? null : settings.toMm));
  return { ranges, totalM: ranges.reduce((n, r) => n + r.lengthMm / 1000 + settings.allowanceMm / 1000, 0) };
}

export function advanceProduction(session, range) {
  const original = session.strips.find(s => s.id === range.originalId);
  if (!original) return session;
  const settings = productionSettings(session.production);
  const production = { ...settings, toMm: null };
  if (range.toMm < original.lengthMm - 1e-7) return { ...session, selectedId: original.id, production: { ...production, fromMm: range.toMm } };
  const ordered = stripsInPrintOrder(session.strips), index = ordered.findIndex(s => s.id === original.id);
  const next = ordered[index + 1];
  return { ...session, selectedId: next?.id ?? original.id, production: { ...production, fromMm: next ? 0 : original.lengthMm } };
}
