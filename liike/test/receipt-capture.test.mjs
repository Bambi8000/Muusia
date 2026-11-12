import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout } from '../src/layout.ts';
import { requiredPhotos } from '../src/capture.ts';
import { planFrames } from '../src/frames.ts';
import { sharedPhotoCrop } from '../src/aligned-photos.ts';
import { project } from '../src/homography.ts';
import { sampleRect } from '../src/sampling.ts';
import { INITIAL_SEQUENCE, timelineFrames } from '../src/sequence.ts';
import { DEFAULT_EXPORT, buildExportPlan, exportManifest } from '../src/export-plan.ts';
import { adjustRaster, DEFAULT_ADJUSTMENTS } from '../src/adjustments.ts';

test('twelve receipt photos align on L-mark corners and export in printed-number order', () => {
  const settings = { W: 72, H: 100, cols: 1, rows: 1, margin: 0, gap: 0, markSize: 8,
    order: 'Row-major', total: 12, crop: 'Full cell', pad: 0, paperTone: 'light',
    captureMode: 'receipts', clearance: 0, trim: 0, markerStyle: 'hatched' };
  const corners = [{ x: 80, y: 260 }, { x: 1080, y: 263 }, { x: 1075, y: 1640 }, { x: 85, y: 1638 }];
  const photos = Array.from({ length: 12 }, (_, i) => ({ id: `receipt${i}`, width: 1200, height: 1750,
    points: corners, registrationMode: 'receipts', frameNumber: 12 - i }));
  assert.equal(requiredPhotos(settings), 12);
  assert.equal(buildLayout(settings).cells[0].crop.w, 72);
  const plans = planFrames(settings, photos, 1080);
  assert.equal(plans.length, 12);
  assert.deepEqual(plans.map(p => p.frames[0].frameNumber), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  for (const plan of plans) {
    assert.deepEqual(plan.frames.map(f => [f.width, f.height]), [[778, 1080]]);
    for (const [i, p] of [[0, 0], [72, 0], [72, 100], [0, 100]].entries()) {
      const mapped = project(plan.h, p[0], p[1]);
      assert.ok(Math.hypot(mapped.x - corners[i].x, mapped.y - corners[i].y) < 0.01);
    }
  }
  const frames = plans.flatMap(p => p.frames).map(f => ({ ...f, url: 'blob:photo', thumbnailUrl: 'blob:thumb' }));
  const sequence = { ...INITIAL_SEQUENCE, order: 'Frame number' };
  assert.deepEqual(timelineFrames(frames, sequence).map(f => f.frameNumber), Array.from({ length: 12 }, (_, i) => i + 1));
  const manifest = exportManifest(buildExportPlan(frames, sequence, DEFAULT_EXPORT));
  assert.deepEqual(manifest.frames.map(f => [f.captureMode, f.sourceFrame, f.sourcePhoto]), Array.from({ length: 12 }, (_, i) => ['receipts', i + 1, 12 - i]));
});

test('receipt surroundings change while the marked frame stays at one fixed output position', () => {
  const settings = { W: 72, H: 100, cols: 1, rows: 1, margin: 0, gap: 0, markSize: 8,
    order: 'Row-major', total: 2, crop: 'Full cell', pad: 6, paperTone: 'light',
    captureMode: 'receipts', clearance: 0, trim: 0, markerStyle: 'hatched' };
  const photos = [
    { id: 'red', width: 500, height: 600, points: [{ x: 70, y: 70 }, { x: 358, y: 70 }, { x: 358, y: 470 }, { x: 70, y: 470 }], registrationMode: 'receipts', frameNumber: 1 },
    { id: 'blue', width: 500, height: 600, points: [{ x: 90, y: 90 }, { x: 378, y: 90 }, { x: 378, y: 490 }, { x: 90, y: 490 }], registrationMode: 'receipts', frameNumber: 2 },
  ];
  const plans = planFrames(settings, photos, 560);
  const crop = plans[0].frames[0].crop;
  assert.deepEqual(crop, { x: -4.32, y: -6, w: 80.64, h: 112 });
  assert.deepEqual(plans[0].frames[0].crop, plans[1].frames[0].crop);
  const raster = (photo, outside) => {
    const result = { width: photo.width, height: photo.height, data: new Uint8ClampedArray(photo.width * photo.height * 4) };
    const [left, top] = [photo.points[0].x, photo.points[0].y];
    for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) {
      const mx = (x - left) / 4, my = (y - top) / 4;
      const inside = mx >= 0 && mx <= 72 && my >= 0 && my <= 100;
      const artwork = inside && mx >= 30 && mx <= 42 && my >= 44 && my <= 56;
      result.data.set([...(artwork ? [20, 20, 20] : inside ? [255, 255, 255] : outside), 255], (y * result.width + x) * 4);
    }
    return result;
  };
  const first = raster(photos[0], [180, 30, 30]), second = raster(photos[1], [30, 30, 180]);
  const a = sampleRect(first, first, plans[0].h, crop, 403, 560);
  const b = sampleRect(second, second, plans[1].h, crop, 403, 560);
  const pixel = (image, x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 3)];
  assert.deepEqual(pixel(a, 201, 280), [20, 20, 20]);
  assert.deepEqual(pixel(b, 201, 280), [20, 20, 20]);
  assert.deepEqual(pixel(a, 5, 5), [180, 30, 30]);
  assert.deepEqual(pixel(b, 5, 5), [30, 30, 180]);
  assert.ok(pixel(a, 40, 45)[0] > 240 && pixel(b, 40, 45)[0] > 240, 'the marked frame moved in the output');
});

test('whole receipt photographs share one L-mark-aligned crop with no overlay', () => {
  const settings = { W: 72, H: 100, cols: 1, rows: 1, margin: 0, gap: 0, markSize: 8,
    order: 'Row-major', total: 2, crop: 'Full cell', pad: 0, paperTone: 'light',
    captureMode: 'receipts', clearance: 0, trim: 0, markerStyle: 'hatched',
    receiptView: 'photo', receiptAspect: '3:4' };
  const photos = ['a', 'b'].map((id, i) => ({ id, width: 1400, height: 1800,
    points: [{ x: 300 + i * 70, y: 300 - i * 40 }, { x: 1100 + i * 70, y: 300 - i * 40 }, { x: 1100 + i * 70, y: 1300 - i * 40 }, { x: 300 + i * 70, y: 1300 - i * 40 }],
    registrationMode: 'receipts', frameNumber: i + 1 }));
  const specs = planFrames(settings, photos, 1080).map(plan => plan.frames[0]);
  assert.deepEqual(specs.map(spec => [spec.width, spec.height]), [[810, 1080], [810, 1080]]);
  assert.deepEqual(specs[0].crop, specs[1].crop);
  assert.ok(specs[0].crop.x < 0 && specs[0].crop.y < 0);
  assert.ok(specs[0].crop.x + specs[0].crop.w > 72 && specs[0].crop.y + specs[0].crop.h > 100);
  const plans = planFrames(settings, photos, 1080);
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i], raster = { width: photo.width, height: photo.height, data: new Uint8ClampedArray(photo.width * photo.height * 4) };
    for (let j = 0; j < raster.data.length; j += 4) raster.data.set(i ? [30, 30, 180, 255] : [180, 30, 30, 255], j);
    const [left, top] = [photo.points[0].x, photo.points[0].y];
    for (let y = top + 450; y < top + 550; y++) for (let x = left + 350; x < left + 450; x++) raster.data.set([0, 0, 0, 255], (y * photo.width + x) * 4);
    const sampled = sampleRect(raster, raster, plans[i].h, specs[i].crop, 450, 600);
    const pixel = (x, y) => [...sampled.data.slice((y * 450 + x) * 4, (y * 450 + x) * 4 + 3)];
    const drawingX = Math.round((36 - specs[i].crop.x) / specs[i].crop.w * 450 - .5);
    const drawingY = Math.round((50 - specs[i].crop.y) / specs[i].crop.h * 600 - .5);
    assert.deepEqual(pixel(drawingX, drawingY), [0, 0, 0], 'the drawing shifted');
    assert.deepEqual(pixel(10, 10), i ? [30, 30, 180] : [180, 30, 30], 'the surrounding photo disappeared');
  }
  settings.receiptAspect = '9:16';
  assert.deepEqual(planFrames(settings, photos, 1080).map(plan => [plan.frames[0].width, plan.frames[0].height]), [[608, 1080], [608, 1080]]);
  assert.throws(() => sharedPhotoCrop([{ h: plans[0].h, width: 100, height: 100 }], 72, 100, '9:16'), /outside a photo|do not share enough space/);
});

test('full-photo crop follows the smallest image without stretching the background', () => {
  const settings = { W: 72, H: 100, cols: 1, rows: 1, margin: 0, gap: 0, markSize: 8,
    order: 'Row-major', total: 2, crop: 'Full cell', pad: 0, paperTone: 'light',
    captureMode: 'receipts', clearance: 0, trim: 0, markerStyle: 'hatched',
    receiptView: 'photo', receiptAspect: '3:4' };
  const photos = [
    { id: 'small', width: 600, height: 800, points: [{ x: 170, y: 240 }, { x: 430, y: 225 }, { x: 455, y: 600 }, { x: 150, y: 610 }], registrationMode: 'receipts' },
    { id: 'large', width: 1200, height: 1600, points: [{ x: 260, y: 400 }, { x: 900, y: 390 }, { x: 920, y: 1250 }, { x: 245, y: 1260 }], registrationMode: 'receipts' },
  ];
  const plans = planFrames(settings, photos, 1080);
  const crop = plans[0].frames[0].crop;
  assert.deepEqual(plans[1].frames[0].crop, crop);
  for (const [i, plan] of plans.entries()) {
    assert.deepEqual(plan.h.slice(6), [0, 0, 1], 'full-photo alignment must be affine');
    const photo = photos[i];
    for (const [x, y] of [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x + crop.w, crop.y + crop.h], [crop.x, crop.y + crop.h]]) {
      const p = project(plan.h, x, y);
      assert.ok(p.x >= 1 && p.x <= photo.width - 1 && p.y >= 1 && p.y <= photo.height - 1, 'crop leaves a source photo');
    }
    const left = project(plan.h, crop.x, crop.y + crop.h / 2);
    const center = project(plan.h, crop.x + crop.w / 2, crop.y + crop.h / 2);
    const right = project(plan.h, crop.x + crop.w, crop.y + crop.h / 2);
    assert.ok(Math.abs(center.x - (left.x + right.x) / 2) < 1e-8);
    assert.ok(Math.abs(center.y - (left.y + right.y) / 2) < 1e-8);
  }
});

test('whole-photo paper correction does not reveal the L-mark rectangle as a seam', () => {
  const source = { width: 9, height: 9, data: new Uint8ClampedArray(9 * 9 * 4) };
  for (let i = 0; i < source.data.length; i += 4) source.data.set([120, 120, 120, 255], i);
  const model = { W: 5, H: 5, h: [1, 0, 10, 0, 1, 10, 0, 0, 1], photoWidth: 100, photoHeight: 100,
    paper: [245, 245, 245], coefficients: Array.from({ length: 3 }, () => [245, 0, 0, 0, 0, 0]),
    samples: 30, supported: true, note: '', paperTone: 'light', autoLevels: { black: 0, white: 200 } };
  const adjusted = adjustRaster(source, { x: -2, y: -2, w: 9, h: 9 }, model, { ...DEFAULT_ADJUSTMENTS, autoAdjust: true }, true);
  const pixel = (x, y) => adjusted.data[(y * 9 + x) * 4];
  assert.equal(pixel(0, 0), pixel(4, 4));
  assert.equal(pixel(8, 8), pixel(4, 4));
});
