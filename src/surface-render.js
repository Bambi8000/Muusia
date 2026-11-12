// One content placement for vector geometry and raster sampling. Source units
// are mm for evaluated paths and pixels for an original RGBA image.
import { cropTestPiece } from "./preview-crop.js";
import { createStrip, stripTransform, stripCorners } from "./surface-composer.js";

export const MAX_RASTER_WIDTH = 16384;
export const MAX_RASTER_BLOCK_PIXELS = 1048576;

function finite(n, name) {
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite.`);
  return n;
}
function positive(n, name) {
  if (finite(n, name) <= 0) throw new Error(`${name} must be greater than zero.`);
  return n;
}
function integer(n, name, min = 0) {
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`${name} must be a safe integer of at least ${min}.`);
  return n;
}
function frame(input) {
  if (!input) throw new Error("Surface dimensions are required.");
  return { widthMm: positive(input.widthMm, "Surface width"), heightMm: positive(input.heightMm, "Surface height") };
}
function xyPoint(value) {
  if (!Array.isArray(value) || value.length < 2 || !value.every(Number.isFinite)) throw new Error("Content points must contain finite coordinates.");
  return value;
}

/** A serializable placement, fitted ONCE to a global box. Contain preserves the
 *  entire source; cover can extend beyond the box, cropped by the surface.
 *  Rotation is about the box centre. Neither mode stretches the aspect ratio. */
export function createContentPlacement(input) {
  if (!input) throw new Error("Content placement is required.");
  const sourceWidth = positive(input.sourceWidth, "Source width");
  const sourceHeight = positive(input.sourceHeight, "Source height");
  const { widthMm, heightMm } = frame(input);
  const fit = input.fit ?? "contain";
  if (fit !== "contain" && fit !== "cover") throw new Error("Content fit must be contain or cover.");
  const scale = positive((fit === "contain" ? Math.min : Math.max)(widthMm / sourceWidth, heightMm / sourceHeight), "Content scale");
  const paper = createStrip({
    id: "content", centerXmm: input.centerXmm ?? widthMm / 2, centerYmm: input.centerYmm ?? heightMm / 2,
    rotationDeg: input.rotationDeg ?? 0,
    physicalWidthMm: sourceWidth * scale, printableWidthMm: sourceWidth * scale,
    printableOffsetMm: 0, lengthMm: sourceHeight * scale,
  });
  stripCorners(paper); // Check finite derived coordinates before accepting it.
  return {
    sourceWidth, sourceHeight, widthMm, heightMm, fit,
    centerXmm: paper.centerXmm, centerYmm: paper.centerYmm, rotationDeg: paper.rotationDeg,
  };
}

/** Same rigid transform as physical strips; only the content's uniform scale
 *  is added. Extra coordinates (e.g. physical pen depth) are never rescaled. */
export function contentTransform(input) {
  const placement = createContentPlacement(input);
  const { sourceWidth, sourceHeight, widthMm, heightMm } = placement;
  const scaleMmPerUnit = (placement.fit === "contain" ? Math.min : Math.max)(widthMm / sourceWidth, heightMm / sourceHeight);
  const transform = stripTransform({
    id: "content", ...placement,
    physicalWidthMm: sourceWidth * scaleMmPerUnit,
    printableWidthMm: sourceWidth * scaleMmPerUnit, printableOffsetMm: 0,
    lengthMm: sourceHeight * scaleMmPerUnit,
  });
  return {
    placement, scaleMmPerUnit,
    sourceToGlobal(point) {
      const [x, y, ...rest] = xyPoint(point);
      return transform.toGlobal([x * scaleMmPerUnit, y * scaleMmPerUnit, ...rest]);
    },
    globalToSource(point) {
      const [x, y, ...rest] = transform.toLocal(xyPoint(point));
      return [finite(x / scaleMmPerUnit, "Source X"), finite(y / scaleMmPerUnit, "Source Y"), ...rest];
    },
  };
}

/** Prepare evaluated paths once, then call clipPathsToStrip for each strip.
 *  Clip the source viewport and fixed surface without fitting per strip. */
export function placePathsOnSurface(ps, placement, surface) {
  if (!ps || !Array.isArray(ps.paths)) throw new Error("A path set is required.");
  const transform = contentTransform(placement), canvas = frame(surface);
  for (const path of ps.paths) {
    if (!path || !Array.isArray(path.pts)) throw new Error("Every path must have a points array.");
    path.pts.forEach(xyPoint);
  }
  const source = cropTestPiece(ps, { x: 0, y: 0, w: transform.placement.sourceWidth, h: transform.placement.sourceHeight, margin: 0 });
  const global = { paths: source.paths.map(path => ({ ...path, pts: path.pts.map(transform.sourceToGlobal) })) };
  return cropTestPiece(global, { x: 0, y: 0, w: canvas.widthMm, h: canvas.heightMm, margin: 0 });
}

function rasterSampler(image, placement, surface, interpolation) {
  if (!image) throw new Error("An RGBA image is required.");
  const width = integer(image.width, "Image width", 1), height = integer(image.height, "Image height", 1);
  const size = integer(width * height * 4, "Image byte count", 1);
  if (!(image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray) || image.data.length !== size) throw new Error("Image data must contain exactly four bytes per pixel.");
  const transform = contentTransform(placement), canvas = frame(surface);
  if (transform.placement.sourceWidth !== width || transform.placement.sourceHeight !== height) throw new Error("Raster dimensions must match the content placement.");
  if (interpolation !== "bilinear" && interpolation !== "nearest") throw new Error("Interpolation must be bilinear or nearest.");
  // Compile the affine inverse once, avoiding point-array allocation per pixel.
  const a = transform.globalToSource([0, 0]);
  const b = transform.globalToSource([1, 0]), c = transform.globalToSource([0, 1]);
  const xx = b[0] - a[0], xy = c[0] - a[0], yx = b[1] - a[1], yy = c[1] - a[1];
  const data = image.data;
  const flat = (index, channel) => 255 + (data[index + channel] - 255) * data[index + 3] / 255;
  function write(x, y, out, offset) {
    if (x < 0 || x >= canvas.widthMm || y < 0 || y >= canvas.heightMm) return;
    const u = a[0] + xx * x + xy * y, v = a[1] + yx * x + yy * y;
    if (u < 0 || u >= width || v < 0 || v >= height) return;
    if (interpolation === "nearest") {
      const index = (Math.floor(v) * width + Math.floor(u)) * 4;
      for (let channel = 0; channel < 3; channel++) out[offset + channel] = Math.round(flat(index, channel));
    } else {
      // Source coordinates describe pixel EDGES; samples sit at i + 0.5.
      const sx = Math.max(0, Math.min(width - 1, u - 0.5));
      const sy = Math.max(0, Math.min(height - 1, v - 0.5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * width + x0) * 4, i10 = (y0 * width + Math.min(width - 1, x0 + 1)) * 4;
      const i01 = (Math.min(height - 1, y0 + 1) * width + x0) * 4;
      const i11 = (Math.min(height - 1, y0 + 1) * width + Math.min(width - 1, x0 + 1)) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const top = flat(i00, channel) * (1 - fx) + flat(i10, channel) * fx;
        const bottom = flat(i01, channel) * (1 - fx) + flat(i11, channel) * fx;
        out[offset + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
    out[offset + 3] = 255;
  }
  return {
    write,
    sampleGlobal(x, y) {
      finite(x, "Global X"); finite(y, "Global Y");
      const out = new Uint8ClampedArray(4).fill(255);
      write(x, y, out, 0);
      return out;
    },
  };
}

/** Pixel-centred, aspect-preserving sampling; transparency flattens over white.
 *  Source data is shared read-only; the caller must not mutate it during a job. */
export function createRasterSampler(image, placement, surface, { interpolation = "bilinear" } = {}) {
  const { sampleGlobal } = rasterSampler(image, placement, surface, interpolation);
  return { sampleGlobal };
}

/** Pixel density is explicit and never fitted to a rounded output width.
 *  Ceil covers a final partial dot; physical target size and raster extent are
 *  reported separately. Long strips are described without allocating an image. */
export function createStripRasterPlan(input, { dotsPerMmX, dotsPerMmY = dotsPerMmX, area = "printable" } = {}) {
  const strip = createStrip(input);
  if (strip.contentMode !== "image-mapping") throw new Error("Raster mapping requires Image Mapping content mode.");
  positive(dotsPerMmX, "Horizontal pixel density"); positive(dotsPerMmY, "Vertical pixel density");
  positive(1 / dotsPerMmX, "Horizontal pixel pitch"); positive(1 / dotsPerMmY, "Vertical pixel pitch");
  if (area !== "paper" && area !== "printable") throw new Error("Raster area must be paper or printable.");
  stripCorners(strip);
  const widthMm = area === "paper" ? strip.physicalWidthMm : strip.printableWidthMm;
  const width = integer(Math.max(1, Math.ceil(widthMm * dotsPerMmX - 1e-9)), "Raster width", 1);
  const height = integer(Math.max(1, Math.ceil(strip.lengthMm * dotsPerMmY - 1e-9)), "Raster height", 1);
  if (width > MAX_RASTER_WIDTH) throw new Error(`Raster width exceeds ${MAX_RASTER_WIDTH} pixels; reduce pixel density.`);
  integer(width * height, "Raster pixel count", 1);
  return Object.freeze({
    strip: Object.freeze(strip), area, width, height, dotsPerMmX, dotsPerMmY,
    localXmm: area === "paper" ? 0 : strip.printableOffsetMm,
    widthMm, heightMm: strip.lengthMm,
    rasterWidthMm: width / dotsPerMmX, rasterHeightMm: height / dotsPerMmY,
    maxBlockRows: Math.floor(MAX_RASTER_BLOCK_PIXELS / width),
  });
}

/** A snapshot of one strip and content placement. All rows use absolute strip
 *  coordinates, so any sequence of bounded blocks reproduces a single image.
 *  The consumer controls scheduling/cancellation between synchronous blocks. */
export function createStripRasterizer(image, placement, surface, strip, options = {}) {
  const plan = createStripRasterPlan(strip, options);
  const sampler = rasterSampler(image, placement, surface, options.interpolation ?? "bilinear");
  const transform = stripTransform(plan.strip);
  const start = transform.toGlobal([plan.localXmm, 0]);
  const xStep = transform.toGlobal([plan.localXmm + 1, 0]);
  const yStep = transform.toGlobal([plan.localXmm, 1]);
  const xx = xStep[0] - start[0], xy = yStep[0] - start[0];
  const yx = xStep[1] - start[1], yy = yStep[1] - start[1];
  const left = plan.strip.printableOffsetMm, right = left + plan.strip.printableWidthMm;
  return {
    plan,
    renderBlock(rowStart, rowCount) {
      integer(rowStart, "First row"); integer(rowCount, "Row count", 1);
      if (rowStart >= plan.height || rowCount > plan.height - rowStart) throw new Error("Raster block is outside the strip.");
      if (rowCount > plan.maxBlockRows) throw new Error("Raster block exceeds the memory budget; request fewer rows.");
      const out = new Uint8ClampedArray(plan.width * rowCount * 4).fill(255);
      for (let row = 0; row < rowCount; row++) {
        const v = (rowStart + row + 0.5) / plan.dotsPerMmY;
        if (v >= plan.heightMm) continue;
        for (let col = 0; col < plan.width; col++) {
          const dx = (col + 0.5) / plan.dotsPerMmX, u = plan.localXmm + dx;
          if (dx >= plan.widthMm || u < left || u >= right) continue;
          sampler.write(start[0] + xx * dx + xy * v, start[1] + yx * dx + yy * v, out, (row * plan.width + col) * 4);
        }
      }
      return { width: plan.width, height: rowCount, rowStart, data: out };
    },
  };
}
