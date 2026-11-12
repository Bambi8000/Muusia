import { createStrip, stripCorners, stripsInPrintOrder } from "./surface-composer.js";
import { mulberry32 } from "./defs/helpers.js";

export const ARRANGEMENT_PATTERNS = ["fan", "radial", "progressive", "random"];
const angle = n => ((n % 360) + 360) % 360;

export function readArrangement(input) {
  if (!input || !ARRANGEMENT_PATTERNS.includes(input.pattern)) throw new Error("Choose a supported arrangement.");
  const p = { pattern: input.pattern };
  for (const key of ["pivotXmm", "pivotYmm", "angleDeg", "fanSpreadDeg", "radialSweepDeg", "radiusMm", "spacingMm", "stepDeg", "spreadWidthMm", "spreadHeightMm", "rotationRangeDeg", "minLengthMm", "maxLengthMm"]) {
    if (!Number.isFinite(input[key])) throw new Error(`Check ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
    p[key] = input[key];
  }
  for (const key of ["fanSpreadDeg", "radialSweepDeg", "rotationRangeDeg"]) if (p[key] < 0 || p[key] > 360) throw new Error("Angle ranges must be between 0 and 360 degrees.");
  for (const key of ["radiusMm", "spacingMm", "spreadWidthMm", "spreadHeightMm"]) if (p[key] < 0) throw new Error("Distances must not be negative.");
  if (p.stepDeg < -360 || p.stepDeg > 360) throw new Error("Rotation step must be between -360 and 360 degrees.");
  if (p.minLengthMm <= 0 || p.maxLengthMm < p.minLengthMm) throw new Error("Choose positive minimum and maximum lengths, with maximum at least minimum.");
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Seed must be a whole number between 0 and 4294967295.");
  if (typeof input.varyLength !== "boolean") throw new Error("Length variation must be on or off.");
  return { ...p, angleDeg: angle(p.angleDeg), seed: input.seed, varyLength: input.varyLength };
}

export function defaultArrangement(session, pattern = "fan") {
  const visible = session.strips.filter(p => p.visible);
  const length = visible[0]?.lengthMm ?? session.layout.lengthMm ?? session.heightMm;
  return readArrangement({ pattern, pivotXmm: session.widthMm / 2, pivotYmm: pattern === "fan" ? session.heightMm : session.heightMm / 2,
    angleDeg: pattern === "fan" ? 180 : 0, fanSpreadDeg: 90, radialSweepDeg: 360, radiusMm: 0,
    spacingMm: (visible[0]?.physicalWidthMm ?? session.layout.physicalWidthMm) + session.layout.gapMm, stepDeg: 12,
    spreadWidthMm: session.widthMm * .8, spreadHeightMm: session.heightMm * .8, rotationRangeDeg: 360,
    minLengthMm: length * .75, maxLengthMm: length * 1.25, seed: 1, varyLength: false,
  });
}

export function updateArrangement(session, patch) {
  const current = session.arrangement ?? defaultArrangement(session);
  return { ...session, arrangement: readArrangement({ ...current, ...patch }) };
}

// Stable per-paper seeds mean hiding another paper does not reshuffle Random.
function paperSeed(seed, id) {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}
function sweepAngle(i, count, sweep) {
  if (count < 2) return 0;
  return i * sweep / (sweep === 360 ? count : count - 1);
}

/** Apply to visible existing papers in print order. Only pose changes, unless
 * Random's explicit absolute-length range is enabled. The source never moves. */
export function arrangeSurface(session, settings = session.arrangement ?? defaultArrangement(session)) {
  const p = readArrangement(settings), ordered = stripsInPrintOrder(session.strips);
  if (!ordered.length) throw new Error("Show at least one paper before arranging.");
  const changes = new Map();
  ordered.forEach((paper, i) => {
    let rotationDeg, centerXmm, centerYmm, lengthMm = paper.lengthMm;
    if (p.pattern === "fan" || p.pattern === "radial") {
      const sweep = p.pattern === "fan" ? p.fanSpreadDeg : p.radialSweepDeg;
      rotationDeg = angle(p.angleDeg + (p.pattern === "fan" && ordered.length > 1 ? -sweep / 2 : 0) + sweepAngle(i, ordered.length, sweep));
      const radians = rotationDeg * Math.PI / 180, distance = p.radiusMm + paper.lengthMm / 2;
      centerXmm = p.pivotXmm - Math.sin(radians) * distance;
      centerYmm = p.pivotYmm + Math.cos(radians) * distance;
    } else if (p.pattern === "progressive") {
      centerXmm = p.pivotXmm + (i - (ordered.length - 1) / 2) * p.spacingMm;
      centerYmm = p.pivotYmm; rotationDeg = angle(p.angleDeg + i * p.stepDeg);
    } else {
      const random = mulberry32(paperSeed(p.seed, paper.id));
      centerXmm = p.pivotXmm + (random() - .5) * p.spreadWidthMm;
      centerYmm = p.pivotYmm + (random() - .5) * p.spreadHeightMm;
      rotationDeg = angle(p.angleDeg + (random() - .5) * p.rotationRangeDeg);
      const lengthSample = random();
      if (p.varyLength) lengthMm = p.minLengthMm + lengthSample * (p.maxLengthMm - p.minLengthMm);
    }
    const strip = createStrip({ ...paper, centerXmm, centerYmm, rotationDeg, lengthMm });
    stripCorners(strip); changes.set(paper.id, strip);
  });
  return { ...session, mode: "freeform", arrangement: p,
    strips: session.strips.map(paper => changes.get(paper.id) ?? paper),
    selectedId: changes.has(session.selectedId) ? session.selectedId : ordered[0].id,
    production: { ...session.production, fromMm: 0, toMm: null },
  };
}
