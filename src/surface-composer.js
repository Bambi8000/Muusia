// Surface geometry in millimetres. Reuses the existing exact path clipper;
// no browser, printer, canvas evaluation or export state belongs in this module.
import { cropTestPiece } from "./preview-crop.js";

export const DEFAULT_STRIP_MATERIAL = Object.freeze({
  physicalWidthMm: 80,
  printableWidthMm: 72,
});
export const DEFAULT_STRIP_GAP_MM = 8;
// Allocation guard only: physical strip length is not restricted to sheet sizes.
export const MAX_GENERATED_STRIPS = 4096;
const EPS = 1e-8;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}
function positive(value, name) {
  if (finite(value, name) <= 0) throw new Error(`${name} must be greater than zero.`);
  return value;
}
function integer(value, name, min = Number.MIN_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${name} must be a safe integer of at least ${min}.`);
  return value;
}
function identifier(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value;
}
function point(value) {
  if (!Array.isArray(value) || value.length < 2 || !value.every(Number.isFinite)) {
    throw new Error("A point must contain finite X/Y coordinates and optional numeric depth.");
  }
  return value;
}
function angle(value) {
  const result = finite(value, "Rotation") % 360;
  return result < 0 ? result + 360 : result === 0 ? 0 : result;
}
function axes(rotationDeg) {
  const radians = rotationDeg * Math.PI / 180;
  // Exact cardinal axes keep a 90-degree layout from acquiring an extra strip.
  const snap = n => Math.abs(n) < 1e-14 ? 0 : Math.abs(1 - Math.abs(n)) < 1e-14 ? Math.sign(n) : n;
  return { c: snap(Math.cos(radians)), s: snap(Math.sin(radians)) };
}

/** Create a plain, serializable strip. Position is the physical paper centre;
 *  local (0, 0) is its top-left corner, +Y is its length, +rotation is clockwise.
 *  Printable offset is measured from the physical paper's left edge. */
export function createStrip(input) {
  if (!input || typeof input !== "object") throw new Error("Strip settings are required.");
  const physicalWidthMm = positive(input.physicalWidthMm ?? DEFAULT_STRIP_MATERIAL.physicalWidthMm, "Physical width");
  const printableWidthMm = positive(input.printableWidthMm ?? DEFAULT_STRIP_MATERIAL.printableWidthMm, "Printable width");
  const printableOffsetMm = finite(input.printableOffsetMm ?? (physicalWidthMm - printableWidthMm) / 2, "Printable offset");
  if (printableOffsetMm < 0 || printableWidthMm > physicalWidthMm || printableOffsetMm > physicalWidthMm - printableWidthMm) {
    throw new Error("The printable area must fit inside the physical paper.");
  }
  const visible = input.visible ?? true;
  if (typeof visible !== "boolean") throw new Error("Visibility must be a boolean.");
  const contentMode = input.contentMode ?? "image-mapping";
  if (!["image-mapping", "independent"].includes(contentMode)) throw new Error("Unknown strip content mode.");
  return {
    id: identifier(input.id, "Strip ID"),
    centerXmm: finite(input.centerXmm ?? 0, "Centre X"),
    centerYmm: finite(input.centerYmm ?? 0, "Centre Y"),
    rotationDeg: angle(input.rotationDeg ?? 0),
    physicalWidthMm,
    printableWidthMm,
    printableOffsetMm,
    lengthMm: positive(input.lengthMm ?? 2000, "Strip length"),
    zIndex: integer(input.zIndex ?? 0, "Z-order"),
    visible,
    printOrder: integer(input.printOrder ?? 1, "Print order", 1),
    contentMode,
  };
}

/** Compile once per strip, then reuse the same rigid transform for every point.
 *  Additional coordinates (e.g. pen depth) pass through without modification. */
export function stripTransform(input) {
  const strip = createStrip(input);
  const { c, s } = axes(strip.rotationDeg);
  const halfWidth = strip.physicalWidthMm / 2, halfLength = strip.lengthMm / 2;
  return {
    strip,
    toGlobal(value) {
      const [u, v, ...rest] = point(value);
      const x = u - halfWidth, y = v - halfLength;
      return [finite(strip.centerXmm + c * x - s * y, "Global X"), finite(strip.centerYmm + s * x + c * y, "Global Y"), ...rest];
    },
    toLocal(value) {
      const [x, y, ...rest] = point(value);
      const dx = x - strip.centerXmm, dy = y - strip.centerYmm;
      return [finite(c * dx + s * dy + halfWidth, "Local X"), finite(-s * dx + c * dy + halfLength, "Local Y"), ...rest];
    },
  };
}

/** Physical or printable corners, in global mm and clockwise from local TL. */
export function stripCorners(input, area = "paper") {
  const transform = stripTransform(input), strip = transform.strip;
  if (area !== "paper" && area !== "printable") throw new Error("Area must be paper or printable.");
  const left = area === "paper" ? 0 : strip.printableOffsetMm;
  const right = area === "paper" ? strip.physicalWidthMm : left + strip.printableWidthMm;
  return [[left, 0], [right, 0], [right, strip.lengthMm], [left, strip.lengthMm]].map(transform.toGlobal);
}

/** Image Mapping for paths. The result stays in FULL PAPER local coordinates,
 *  including the unprintable left margin. It is never fitted or resized.
 *  Raster/thermal-text payloads are deliberately not copied to the path result. */
export function clipPathsToStrip(ps, input, { accountForBezels = true } = {}) {
  if (!ps || !Array.isArray(ps.paths)) throw new Error("A path set is required.");
  const transform = stripTransform(input), strip = transform.strip;
  const local = {
    paths: ps.paths.map(path => {
      if (!path || !Array.isArray(path.pts)) throw new Error("Every path must have a points array.");
      return { ...path, pts: path.pts.map(transform.toLocal) };
    }),
  };
  if (!accountForBezels) for (const path of local.paths) path.pts = path.pts.map(([x,y,...rest]) => [strip.printableOffsetMm + x * strip.printableWidthMm / strip.physicalWidthMm,y,...rest]);
  const clipped = cropTestPiece(local, {
    x: strip.printableOffsetMm, y: 0,
    w: strip.printableWidthMm, h: strip.lengthMm, margin: 0,
  });
  return {
    paths: clipped.paths.map(path => ({
      ...path,
      pts: path.pts.map(([x, y, ...rest]) => [x + strip.printableOffsetMm, y, ...rest]),
    })),
  };
}

/** Parallel physical strips centred on a fixed global canvas. 0 = vertical,
 *  90 = horizontal; other angles use the same projected-corner construction.
 *  Auto count/length cover the canvas projection, including intentional gaps.
 *  Explicit count/length may leave uncovered canvas; paper can overhang it. */
export function generateStripTiling(settings = {}) {
  const widthMm = positive(settings.widthMm, "Canvas width");
  const heightMm = positive(settings.heightMm, "Canvas height");
  const gapMm = finite(settings.gapMm ?? DEFAULT_STRIP_GAP_MM, "Paper gap");
  if (gapMm < 0) throw new Error("Paper gap must not be negative.");
  const prototype = createStrip({ ...settings, id: "prototype" });
  const { c, s } = axes(prototype.rotationDeg);
  const spanAcross = finite(Math.abs(c) * widthMm + Math.abs(s) * heightMm, "Projected width");
  const spanAlong = finite(Math.abs(s) * widthMm + Math.abs(c) * heightMm, "Projected length");
  const pitch = positive(finite(prototype.physicalWidthMm + gapMm, "Strip pitch"), "Strip pitch");
  const autoCount = Math.max(1, Math.ceil((spanAcross + gapMm) / pitch - 1e-12));
  const count = integer(settings.count ?? autoCount, "Strip count", 1);
  if (count > MAX_GENERATED_STRIPS) throw new Error(`A layout can generate at most ${MAX_GENERATED_STRIPS} strips. Increase width/gap or reduce count.`);
  const lengthMm = positive(settings.lengthMm ?? spanAlong, "Strip length");
  const prefix = identifier(settings.idPrefix ?? "strip", "Strip ID prefix");
  return Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * pitch;
    const strip = createStrip({
      ...prototype,
      id: `${prefix}-${String(i + 1).padStart(3, "0")}`,
      centerXmm: widthMm / 2 + c * offset,
      centerYmm: heightMm / 2 + s * offset,
      lengthMm, zIndex: i, printOrder: i + 1,
    });
    stripCorners(strip); // Refuse derived coordinate overflow before returning.
    return strip;
  });
}

function stripList(inputs) {
  if (!Array.isArray(inputs)) throw new Error("A strip array is required.");
  const ids = new Set();
  return inputs.map(input => {
    const strip = createStrip(input);
    if (ids.has(strip.id)) throw new Error(`Duplicate strip ID: ${strip.id}`);
    ids.add(strip.id);
    return strip;
  });
}
function boundsFor(strips) {
  if (!strips.length) return null;
  let minXmm = Infinity, minYmm = Infinity, maxXmm = -Infinity, maxYmm = -Infinity;
  for (const strip of strips) for (const [x, y] of stripCorners(strip)) {
    minXmm = Math.min(minXmm, x); minYmm = Math.min(minYmm, y);
    maxXmm = Math.max(maxXmm, x); maxYmm = Math.max(maxYmm, y);
  }
  return { minXmm, minYmm, maxXmm, maxYmm, widthMm: finite(maxXmm - minXmm, "Paper envelope width"), heightMm: finite(maxYmm - minYmm, "Paper envelope height") };
}

/** Assembly bounds use physical paper, including overhang, never printable ink. */
export function surfaceBounds(inputs, { includeHidden = false } = {}) {
  return boundsFor(stripList(inputs).filter(strip => includeHidden || strip.visible));
}

/** Stable print order is independent of Z-order. Ties retain input order. */
export function stripsInPrintOrder(inputs, { includeHidden = false } = {}) {
  return stripList(inputs).filter(strip => includeHidden || strip.visible).sort((a, b) => a.printOrder - b.printOrder);
}

/** Pick the topmost visible PAPER, including its blank margins. Later objects
 *  win a tied Z-order, matching painter's order in a future SVG preview. */
export function hitTestStrip(inputs, globalPoint) {
  point(globalPoint);
  let hit = null;
  for (const strip of stripList(inputs)) {
    if (!strip.visible || (hit && strip.zIndex < hit.zIndex)) continue;
    const [x, y] = stripTransform(strip).toLocal(globalPoint);
    if (x >= -EPS && x <= strip.physicalWidthMm + EPS && y >= -EPS && y <= strip.lengthMm + EPS) hit = strip;
  }
  return hit?.id ?? null;
}

/** Paper consumption excludes hidden objects by default. Feed/cut/label waste
 *  and print-time estimates belong to the later calibrated production layer. */
export function surfaceSummary(inputs, options = {}) {
  const strips = stripsInPrintOrder(inputs, options);
  const totalLengthMm = finite(strips.reduce((sum, strip) => sum + strip.lengthMm, 0), "Total paper length");
  return {
    stripCount: strips.length,
    totalLengthMm,
    totalLengthM: totalLengthMm / 1000,
    bounds: boundsFor(strips),
    strips: strips.map(({ id, lengthMm, printOrder }) => ({ id, lengthMm, printOrder })),
  };
}


/** World-space counterpart of fitting paper-local X into the ink width.
 * Physical paper/placement and length remain fixed. Used by the SVG preview. */
export function paperBezelMatrix(paper, accountForBezels = true) {
  if (accountForBezels) return [1,0,0,1,0,0];
  const t=stripTransform(paper),o=t.toGlobal([0,0]),x=t.toGlobal([1,0]);
  const c=x[0]-o[0],s=x[1]-o[1],k=paper.printableWidthMm/paper.physicalWidthMm;
  const a=k*c*c+s*s,b=(k-1)*c*s,d=k*s*s+c*c;
  return [a,b,b,d,o[0]+c*paper.printableOffsetMm-a*o[0]-b*o[1],o[1]+s*paper.printableOffsetMm-b*o[0]-d*o[1]];
}
