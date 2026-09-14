import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMarkers } from '../src/detection.ts';
import { MARKERS, syntheticPhoto, renderSheet } from './synthetic-photo.mjs';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';
import { DEFAULTS, buildLayout, framesOnSheet, validateSettings } from '../src/layout.ts';
import { estimatePaper, adjustRaster, DEFAULT_ADJUSTMENTS } from '../src/adjustments.ts';
import { sampleRect } from '../src/sampling.ts';
import { drawingPosition } from '../src/stabilization.ts';
import { planFrames } from '../src/frames.ts';
import { buildExportPlan, exportManifest, DEFAULT_EXPORT } from '../src/export-plan.ts';
import { INITIAL_SEQUENCE } from '../src/sequence.ts';

const settings = { ...REFERENCE_SETTINGS, paperTone: 'dark' };
const h = [4, 0, 0, 0, 4, 0, 0, 0, 1];
const whole = { x: 0, y: 0, w: 297, h: 210 };
const raw = { ...DEFAULT_ADJUSTMENTS, flatten: false, whiteBalance: false };
function brightInk(raster) {
  const data = new Uint8ClampedArray(raster.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const ink = 255 - raster.data[i];
    data.set([10 + ink * .9, 12 + ink * .95, 18 + ink * .25, raster.data[i + 3]], i);
  }
  return { ...raster, data };
}

for (const rotation of [0, 90, 180, 270, 35]) test(`bright colored markers with a dark hole orient a ${rotation}° photo`, () => {
  const scene = syntheticPhoto({ rotation });
  const dark = brightInk(scene.raster), original = dark.data.slice();
  const result = detectMarkers(dark, settings);
  assert.equal(result.status, 'found', JSON.stringify(result));
  result.points.forEach((p, i) => {
    const actual = scene.toSheet(p), expected = MARKERS[i];
    assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < .5);
  });
  assert.deepEqual(dark.data, original);
});

test('dark paper still rejects missing holes and mirrored geometry', () => {
  for (const holes of [0, 2]) {
    const result = detectMarkers(brightInk(syntheticPhoto({ holes }).raster), settings);
    assert.equal(result.status, 'ambiguous');
    assert.equal(result.points, null);
  }
  assert.equal(detectMarkers(brightInk(syntheticPhoto({ mirror: true }).raster), settings).status, 'mirrored');
});

// Independent additive glare plus green pigment, from the real SVG's coverage.
function darkSheet({ black = false } = {}) {
  const source = renderSheet();
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const i = (y * source.width + x) * 4, ink = (255 - source.data[i]) / 220;
    const nx = (x + .5) / source.width * 2 - 1, ny = (y + .5) / source.height * 2 - 1;
    const glare = black ? 0 : 30 + 13 * nx + 8 * ny + 7 * nx * nx;
    for (let c = 0; c < 3; c++) source.data[i + c] = 10 + glare * [1, 1.2, 1.6][c] + ink * [130, 175, 30][c];
  }
  return source;
}

test('dark-paper flatten removes additive glare while preserving colored ink and source pixels', () => {
  const source = darkSheet(), original = source.data.slice(), model = estimatePaper(source, source, h, settings);
  assert.ok(model.supported && model.samples > 50);
  const result = adjustRaster(source, whole, model, DEFAULT_ADJUSTMENTS);
  const coverage = renderSheet();
  for (const frame of framesOnSheet(settings, 0)) {
    const blank = (Math.round(frame.crop.y * 4) * source.width + Math.round(frame.crop.x * 4)) * 4;
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(result.data[blank + c] - 10) <= 3);
    let inkAt = -1;
    for (let y = Math.ceil(frame.window.y * 4); y < (frame.window.y + frame.window.h) * 4 && inkAt < 0; y++) for (let x = Math.ceil(frame.window.x * 4); x < (frame.window.x + frame.window.w) * 4; x++) {
      const i = (y * source.width + x) * 4;
      if (coverage.data[i] === 35) { inkAt = i; break; }
    }
    assert.ok(inkAt >= 0);
    [140, 185, 40].forEach((value, c) => assert.ok(Math.abs(result.data[inkAt + c] - value) <= 3, `frame ${frame.frame + 1} color ${c}`));
  }
  assert.deepEqual(result.data, adjustRaster(source, whole, model, { ...DEFAULT_ADJUSTMENTS, whiteBalance: false }).data);
  assert.deepEqual(adjustRaster(source, whole, model, { ...raw, whiteBalance: true }).data, source.data, 'dark paper must never amplify channels as a white reference');
  assert.deepEqual(source.data, original);
});

test('auto adjust deepens dark paper consistently across crops, including almost-black references', () => {
  for (const black of [false, true]) {
    const source = darkSheet({ black }), model = estimatePaper(source, source, h, settings);
    assert.ok(model.supported);
    assert.ok(model.autoLevels.black >= 0 && model.autoLevels.black <= 45);
    assert.ok(model.autoLevels.white >= 150 && model.autoLevels.white <= 255);
    assert.deepEqual(model, estimatePaper(source, source, h, { ...settings, total: 24, order: 'Column-major', crop: 'Full cell', pad: 20 }));
    const options = { ...DEFAULT_ADJUSTMENTS, autoAdjust: true }, full = adjustRaster(source, whole, model, options);
    const rect = { x: 40, y: 50, w: 20, h: 10 };
    const crop = adjustRaster(sampleRect(source, source, h, rect, 80, 40, 0), rect, model, options);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 80; x++) {
      const at = ((200 + y) * source.width + 160 + x) * 4;
      assert.deepEqual(crop.data.slice((y * 80 + x) * 4, (y * 80 + x) * 4 + 4), full.data.slice(at, at + 4));
    }
    const empty = sampleRect(source, source, h, { x: 5, y: 40, w: 5, h: 5 }, 10, 10, 0);
    const adjusted = adjustRaster(empty, { x: 5, y: 40, w: 5, h: 5 }, model, options);
    assert.ok(adjusted.data.every((v, i) => i % 4 === 3 ? v === 255 : v < 5));
  }
});

test('sampling uses black for missing or transparent pixels and two-tone output keeps bright ink on black', () => {
  const source = { width: 3, height: 1, data: new Uint8ClampedArray([90, 120, 30, 0, 5, 5, 5, 255, 160, 210, 80, 255]) };
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1], rect = { x: 0, y: 0, w: 3, h: 1 };
  const sampled = sampleRect(source, source, identity, rect, 3, 1, 0);
  assert.deepEqual([...sampled.data.slice(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...sampleRect(source, source, identity, { ...rect, x: -10 }, 1, 1, 0).data], [0, 0, 0, 255]);
  assert.deepEqual([...sampleRect(source, source, identity, rect, 3, 1).data.slice(0, 4)], [255, 255, 255, 255]);
  const model = estimatePaper(darkSheet(), { width: 1188, height: 840 }, h, settings);
  const result = adjustRaster(source, rect, model, raw);
  assert.deepEqual(result.data, sampled.data);
  for (const sharpenEnabled of [false, true]) {
    const toned = adjustRaster(sampled, rect, model, { ...raw, thresholdEnabled: true, sharpenEnabled });
    assert.deepEqual([...toned.data], [0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
  }
});

test('bright drawing stabilization matches the same shape on white paper without changing source geometry', () => {
  const source = renderSheet(), crop = framesOnSheet(settings, 0)[0].crop;
  const light = sampleRect(source, source, h, crop, 480, 339), dark = brightInk(light), original = dark.data.slice();
  const a = drawingPosition(light), b = drawingPosition(dark, 'dark');
  assert.ok(a && b);
  assert.ok(Math.abs(a.center.x - b.center.x) * 480 < .5);
  assert.ok(Math.abs(a.center.y - b.center.y) * 339 < .5);
  assert.deepEqual(dark.data, original);
});

test('paper tone leaves layout unchanged and travels with every extracted/exported frame', () => {
  const dark = { ...DEFAULTS, paperTone: 'dark' };
  assert.deepEqual(buildLayout(dark), buildLayout(DEFAULTS));
  assert.ok(validateSettings({ ...dark, paperTone: 'invalid' }).length > 0);
  const photos = [{ id: 'first', width: 420, height: 297, points: [{ x: 20, y: 20 }, { x: 400, y: 20 }, { x: 400, y: 277 }, { x: 20, y: 277 }] }];
  const frames = planFrames(dark, photos, 1080)[0].frames;
  const plan = buildExportPlan(frames, INITIAL_SEQUENCE, { ...DEFAULT_EXPORT, format: 'video', longSide: 720 });
  assert.ok(plan.frames.every(f => f.paperTone === 'dark'));
  assert.ok(exportManifest(plan).frames.every(f => f.paperTone === 'dark'));
  assert.ok(planFrames(DEFAULTS, photos, 1080)[0].frames.every(f => f.paperTone === 'light'));
});
