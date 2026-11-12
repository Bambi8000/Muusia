// Run: node tools/validate-surface-render.mjs. Actual RGBA bytes and analytic mm
// oracles; no DOM stubs, canvas mocks, printer or browser required.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createStrip, clipPathsToStrip, stripTransform } from "../src/surface-composer.js";
import {
  createContentPlacement, contentTransform, placePathsOnSurface,
  createRasterSampler, createStripRasterPlan, createStripRasterizer,
  MAX_RASTER_WIDTH, MAX_RASTER_BLOCK_PIXELS,
} from "../src/surface-render.js";

const close = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
function pointClose(a, b) { assert.equal(a.length, b.length); a.forEach((x, i) => close(x, b[i])); }
const placement = (w, h, extra = {}) => createContentPlacement({ sourceWidth: w, sourceHeight: h, widthMm: w, heightMm: h, ...extra });
const strip = (extra = {}) => createStrip({ id: "s", centerXmm: 5, centerYmm: 5, physicalWidthMm: 2, printableWidthMm: 2, printableOffsetMm: 0, lengthMm: 4, ...extra });
function image(width, height, pixel = (x, y) => [x, y, 0, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
}
const pixel = (raster, x, y) => [...raster.data.slice((y * raster.width + x) * 4, (y * raster.width + x + 1) * 4)];
const solid = (w, h, color = [0, 0, 0, 255]) => image(w, h, () => color);
const canvas = { widthMm: 20, heightMm: 20 };

test("contain and cover fit only once and preserve source aspect ratio", () => {
  const contain = contentTransform(placement(10, 5, { widthMm: 20, heightMm: 20 }));
  assert.equal(contain.scaleMmPerUnit, 2);
  pointClose(contain.sourceToGlobal([0, 0]), [0, 5]);
  pointClose(contain.sourceToGlobal([10, 5]), [20, 15]);
  const cover = contentTransform({ ...contain.placement, fit: "cover" });
  assert.equal(cover.scaleMmPerUnit, 4);
  pointClose(cover.sourceToGlobal([0, 0]), [-10, 0]);
  pointClose(cover.sourceToGlobal([10, 5]), [30, 20]);
  assert.deepEqual(JSON.parse(JSON.stringify(contain.placement)), contain.placement);
});

test("content rotation uses a fixed centre and preserves extra coordinates", () => {
  for (const rotationDeg of [0, 45, 90, 137, 360, -45]) {
    const t = contentTransform(placement(10, 5, { widthMm: 20, heightMm: 20, rotationDeg, centerXmm: 23, centerYmm: -7 }));
    pointClose(t.sourceToGlobal([5, 2.5, -3]), [23, -7, -3]);
    for (const q of [[0, 0, -3], [1.2, 4.8, -5], [10, 5, 0]]) pointClose(t.globalToSource(t.sourceToGlobal(q)), q);
    close(Math.hypot(...t.sourceToGlobal([0, 0]).map((x, i) => x - t.sourceToGlobal([10, 0])[i])), 20);
  }
});

test("path placement clips the source and surface, keeping depth, pen and metadata", () => {
  const paths = { paths: [{ pts: [[-5, 2.5, 0], [15, 2.5, 20]], layer: 7, closed: false, __stop: "wash", speed: 12 }], thermalText: [{}] };
  const before = JSON.stringify(paths);
  const out = placePathsOnSurface(paths, placement(10, 5, { widthMm: 20, heightMm: 20, fit: "cover" }), canvas);
  assert.equal(out.paths.length, 1);
  pointClose(out.paths[0].pts[0], [0, 10, 7.5]);
  pointClose(out.paths[0].pts[1], [20, 10, 12.5]);
  assert.equal(out.paths[0].layer, 7);
  assert.equal(out.paths[0].__stop, "wash");
  assert.equal(out.paths[0].speed, 12);
  assert.equal(out.thermalText, undefined);
  assert.equal(JSON.stringify(paths), before);
});

test("one global vector placement feeds arbitrarily rotated strips without refitting", () => {
  const p = placement(20, 20);
  const global = placePathsOnSurface({ paths: [{ pts: [[0, 10], [20, 10]], layer: 2, closed: false }] }, p, canvas);
  const s = strip({ centerXmm: 10, centerYmm: 10, lengthMm: 10, rotationDeg: 45 });
  const out = clipPathsToStrip(global, s);
  assert.equal(out.paths.length, 1);
  const mapped = out.paths[0].pts.map(stripTransform(s).toGlobal);
  pointClose(mapped[0], [10 - Math.SQRT2, 10]);
  pointClose(mapped[1], [10 + Math.SQRT2, 10]);
});

test("raster samples are pixel-centred and transparent pixels flatten over white", () => {
  const src = image(2, 1, x => x === 0 ? [255, 0, 0, 255] : [0, 0, 255, 0]);
  const s = createRasterSampler(src, placement(2, 1), { widthMm: 2, heightMm: 1 });
  assert.deepEqual([...s.sampleGlobal(.5, .5)], [255, 0, 0, 255]);
  assert.deepEqual([...s.sampleGlobal(1.5, .5)], [255, 255, 255, 255]);
  assert.deepEqual([...s.sampleGlobal(1, .5)], [255, 128, 128, 255]);
  assert.deepEqual([...s.sampleGlobal(0, .5)], [255, 0, 0, 255]);
});

test("bilinear interpolation follows a known four-colour field", () => {
  const src = image(2, 2, (x, y) => [x * 200, y * 200, 0, 255]);
  const s = createRasterSampler(src, placement(2, 2), { widthMm: 2, heightMm: 2 });
  assert.deepEqual([...s.sampleGlobal(1, 1)], [100, 100, 0, 255]);
  assert.deepEqual([...s.sampleGlobal(.75, 1.25)], [50, 150, 0, 255]);
  assert.deepEqual([...s.sampleGlobal(1.99, 1.99)], [200, 200, 0, 255]);
});

test("canvas and source-image overhang sample white without stretching the image", () => {
  const src = solid(2, 1, [0, 100, 0, 255]);
  const s = createRasterSampler(src, placement(2, 1, { widthMm: 4, heightMm: 4 }), { widthMm: 4, heightMm: 4 });
  for (const [x, y] of [[1, 0], [1, 3.9], [-1, 2], [4, 2], [1, 4]]) assert.deepEqual([...s.sampleGlobal(x, y)], [255, 255, 255, 255]);
  assert.deepEqual([...s.sampleGlobal(1, 2)], [0, 100, 0, 255]);
  const shifted = createRasterSampler(src, placement(2, 1, { centerXmm: 0 }), { widthMm: 4, heightMm: 4 });
  assert.deepEqual([...shifted.sampleGlobal(-.5, .5)], [255, 255, 255, 255]);
});

test("rotated content gives the same global source location to paths and raster", () => {
  const p = placement(4, 2, { widthMm: 8, heightMm: 8, rotationDeg: 90 });
  const t = contentTransform(p);
  pointClose(t.sourceToGlobal([.5, .5]), [5, 1]);
  const s = createRasterSampler(image(4, 2), p, { widthMm: 8, heightMm: 8 }, { interpolation: "nearest" });
  assert.deepEqual([...s.sampleGlobal(5, 1)], [0, 0, 0, 255]);
  assert.deepEqual([...s.sampleGlobal(3, 7)], [3, 1, 0, 255]);
});

test("90- and 45-degree strip rasters have analytically known source pixels", () => {
  const src = image(20, 20), p = placement(20, 20), opts = { dotsPerMmX: 1, interpolation: "nearest" };
  const horizontal = createStripRasterizer(src, p, canvas, strip({ rotationDeg: 90 }), opts).renderBlock(0, 4);
  assert.equal(horizontal.width, 2);
  assert.deepEqual(pixel(horizontal, 0, 0), [6, 4, 0, 255]);
  assert.deepEqual(pixel(horizontal, 1, 0), [6, 5, 0, 255]);
  assert.deepEqual(pixel(horizontal, 0, 3), [3, 4, 0, 255]);
  const diagonal = createStripRasterizer(src, p, canvas, strip({ rotationDeg: 45 }), opts).renderBlock(0, 4);
  assert.deepEqual(pixel(diagonal, 0, 0), [5, 3, 0, 255]);
  assert.deepEqual(pixel(diagonal, 1, 0), [6, 4, 0, 255]);
});

test("paper rasters preserve blank physical margins, printable rasters start at the ink offset", () => {
  const src = solid(20, 20), p = placement(20, 20);
  const s = strip({ physicalWidthMm: 6, printableWidthMm: 3, printableOffsetMm: 1, centerXmm: 10 });
  const paper = createStripRasterizer(src, p, canvas, s, { dotsPerMmX: 1, area: "paper" }).renderBlock(0, 4);
  assert.equal(paper.width, 6);
  for (const x of [0, 4, 5]) assert.deepEqual(pixel(paper, x, 1), [255, 255, 255, 255]);
  for (const x of [1, 2, 3]) assert.deepEqual(pixel(paper, x, 1), [0, 0, 0, 255]);
  const ink = createStripRasterizer(src, p, canvas, s, { dotsPerMmX: 1 });
  assert.equal(ink.plan.width, 3);
  assert.equal(ink.plan.localXmm, 1);
  assert.deepEqual(pixel(ink.renderBlock(0, 4), 0, 0), [0, 0, 0, 255]);
});

test("pixel density is explicit, anisotropic and not changed by rounding a physical size", () => {
  const plan = createStripRasterPlan(strip({ lengthMm: 4.1 }), { dotsPerMmX: 2, dotsPerMmY: 3 });
  assert.equal(plan.width, 4); assert.equal(plan.height, 13);
  assert.equal(plan.heightMm, 4.1); assert.equal(plan.rasterHeightMm, 13 / 3);
  assert.equal(plan.dotsPerMmY, 3);
  const r = createStripRasterizer(solid(20, 20), placement(20, 20), canvas, strip({ lengthMm: 4.1 }), { dotsPerMmX: 2, dotsPerMmY: 3 });
  assert.deepEqual(pixel(r.renderBlock(12, 1), 0, 0), [255, 255, 255, 255], "A centre beyond the physical end stays white");
  assert.throws(() => { plan.strip.lengthMm = 8; }, TypeError);
});

test("block boundaries and out-of-order block requests reproduce identical bytes", () => {
  const src = image(40, 40, (x, y) => [(x * 17) % 256, (y * 29) % 256, (x * y) % 256, (x + y) % 3 ? 255 : 120]);
  const p = placement(40, 40), frame = { widthMm: 40, heightMm: 40 };
  const r = createStripRasterizer(src, p, frame, strip({ centerXmm: 20, centerYmm: 20, physicalWidthMm: 16, printableWidthMm: 12, printableOffsetMm: 2, lengthMm: 31, rotationDeg: 137 }), { dotsPerMmX: 2.3, dotsPerMmY: 3.7 });
  const full = r.renderBlock(0, r.plan.height);
  const assembled = new Uint8ClampedArray(full.data.length);
  const starts = [];
  for (let row = 0; row < r.plan.height; row += 7) starts.push(row);
  for (const row of starts.reverse()) assembled.set(r.renderBlock(row, Math.min(7, r.plan.height - row)).data, row * r.plan.width * 4);
  assert.deepEqual(assembled, full.data);
});

test("overlapping strips each receive the same underlying pixels regardless of Z-order", () => {
  const src = image(20, 20), p = placement(20, 20), opts = { dotsPerMmX: 1, interpolation: "nearest" };
  const a = createStripRasterizer(src, p, canvas, strip({ zIndex: 1 }), opts);
  const b = createStripRasterizer(src, p, canvas, strip({ id: "b", centerXmm: 6, zIndex: 10 }), opts);
  const aa = a.renderBlock(0, 4), bb = b.renderBlock(0, 4);
  for (let y = 0; y < 4; y++) assert.deepEqual(pixel(aa, 1, y), pixel(bb, 0, y));
});

test("two-metre strips use the measured density and bounded blocks beyond receipt limits", () => {
  const dotsPerMmX = 400 / 56.6;
  const s = createStrip({ id: "long", centerXmm: 40, centerYmm: 1000, printableWidthMm: 72.448, printableOffsetMm: 4.38775, lengthMm: 2000 });
  const p = placement(2, 2, { widthMm: 80, heightMm: 2000, fit: "cover" });
  const r = createStripRasterizer(solid(2, 2), p, { widthMm: 80, heightMm: 2000 }, s, { dotsPerMmX });
  assert.equal(r.plan.width, 512);
  assert.equal(r.plan.height, 14135);
  const tail = r.renderBlock(14000, 135);
  assert.equal(tail.rowStart, 14000);
  assert.equal(tail.data.length, 512 * 135 * 4);
  assert.deepEqual(pixel(tail, 100, 0), [0, 0, 0, 255]);
  assert.equal(r.plan.dotsPerMmX, dotsPerMmX);
  assert.throws(() => r.renderBlock(0, r.plan.height), /memory budget/);
});

test("renderers snapshot geometry without mutating input paths, placement or source pixels", () => {
  const src = image(20, 20), pixels = src.data.slice(), p = placement(20, 20), s = strip();
  const saved = JSON.stringify([p, s]);
  const r = createStripRasterizer(src, p, canvas, s, { dotsPerMmX: 1 });
  const before = r.renderBlock(0, 4);
  assert.equal(JSON.stringify([p, s]), saved);
  p.centerXmm = 900; s.rotationDeg = 137; s.lengthMm = 50;
  assert.deepEqual(r.renderBlock(0, 4), before);
  assert.deepEqual(src.data, pixels);
});

test("invalid content, coordinates, density, formats and raster blocks fail explicitly", () => {
  for (const extra of [{ sourceWidth: 0 }, { sourceHeight: Infinity }, { widthMm: -1 }, { centerXmm: NaN }, { fit: "stretch" }, { rotationDeg: "90" }]) assert.throws(() => placement(2, 2, extra));
  const p = placement(2, 2), src = image(2, 2);
  for (const bad of [{ ...src, data: [] }, { ...src, data: new Uint8Array(3) }, { ...src, width: 2.5 }]) assert.throws(() => createRasterSampler(bad, p, canvas));
  assert.throws(() => createRasterSampler(src, placement(3, 2), canvas));
  assert.throws(() => createRasterSampler(src, p, canvas, { interpolation: "cubic" }));
  assert.throws(() => createRasterSampler(src, p, canvas).sampleGlobal(NaN, 0));
  assert.throws(() => contentTransform(p).sourceToGlobal([0, Infinity]));
  assert.throws(() => placePathsOnSurface({ paths: [{ pts: [[NaN, 0]] }] }, p, canvas));
  assert.throws(() => placePathsOnSurface({}, p, canvas));
  for (const opts of [{}, { dotsPerMmX: 0 }, { dotsPerMmX: Infinity }, { dotsPerMmX: Number.MIN_VALUE }, { dotsPerMmX: 1, area: "unknown" }, { dotsPerMmX: MAX_RASTER_WIDTH }]) assert.throws(() => createStripRasterPlan(strip(), opts));
  assert.throws(() => createStripRasterPlan(strip({ contentMode: "independent" }), { dotsPerMmX: 1 }));
  const r = createStripRasterizer(src, p, canvas, strip(), { dotsPerMmX: 1 });
  for (const [start, count] of [[-1, 1], [0, 0], [0, .5], [4, 1], [2, 3], [NaN, 1], [0, MAX_RASTER_BLOCK_PIXELS]]) assert.throws(() => r.renderBlock(start, count));
});
