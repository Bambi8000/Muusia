import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePaper, adjustRaster, DEFAULT_ADJUSTMENTS } from '../src/adjustments.ts';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';
import { sampleRect } from '../src/sampling.ts';
import { framesOnSheet } from '../src/layout.ts';
import { renderSheet } from './synthetic-photo.mjs';

const settings = REFERENCE_SETTINGS;
const whole = { x: 0, y: 0, w: 297, h: 210 };
const h = [4, 0, 0, 0, 4, 0, 0, 0, 1];
const raw = { ...DEFAULT_ADJUSTMENTS, flatten: false, whiteBalance: false };
function litSheet({ tint = [1, .92, .78], offset = 0, ink = true } = {}) {
  const source = renderSheet();
  if (!ink) source.data.fill(255);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const nx = (x + .5) / source.width * 2 - 1, ny = (y + .5) / source.height * 2 - 1;
    // Independently generated smooth spatial illumination and per-photo cast.
    const light = .88 + offset + .07 * nx - .04 * ny - .13 * nx * nx - .07 * ny * ny + .02 * nx * ny;
    const i = (y * source.width + x) * 4;
    for (let c = 0; c < 3; c++) source.data[i + c] *= light * tint[c];
  }
  return source;
}
const stats = values => { const mean = values.reduce((a, b) => a + b, 0) / values.length; return { mean, spread: Math.max(...values) - Math.min(...values) }; };

test('sheet-level flatten and WB neutralize a cast and reduce uneven paper lighting without erasing ink', () => {
  const source = litSheet(), model = estimatePaper(source, source, h, settings);
  assert.ok(model.supported && model.samples > 50);
  const before = [], after = [];
  for (const frame of framesOnSheet(settings, 0)) {
    const sampled = sampleRect(source, source, h, frame.crop, 180, 127);
    const adjusted = adjustRaster(sampled, frame.crop, model, DEFAULT_ADJUSTMENTS);
    // Empty corners are independent of the centered reference drawings.
    for (const offset of [0, (sampled.width - 1) * 4, (sampled.width * (sampled.height - 1)) * 4]) {
      before.push(sampled.data[offset]); after.push(adjusted.data[offset]);
      assert.ok(Math.abs(adjusted.data[offset] - adjusted.data[offset + 1]) < 3);
      assert.ok(Math.abs(adjusted.data[offset] - adjusted.data[offset + 2]) < 3);
    }
    const centerInk = [];
    for (let y = 30; y < 97; y++) for (let x = 40; x < 140; x++) centerInk.push(adjusted.data[(y * 180 + x) * 4]);
    assert.ok(Math.min(...centerInk) < 120, `frame ${frame.frame + 1} lost its ink`);
  }
  assert.ok(stats(before).spread > 40);
  assert.ok(stats(after).spread < 5, JSON.stringify(stats(after)));
  assert.ok(Math.abs(stats(after).mean - 245) < 2);
});

test('reference estimation ignores artwork inside full cells and is independent of crop/order/total', () => {
  const source = litSheet(), altered = { ...source, data: new Uint8ClampedArray(source.data) };
  // Repaint the complete interior of each physical cell with dark colored ink.
  for (const f of framesOnSheet(settings, 0)) {
    for (let y = Math.ceil(f.cell.y * 4); y < (f.cell.y + f.cell.h) * 4; y++) for (let x = Math.ceil(f.cell.x * 4); x < (f.cell.x + f.cell.w) * 4; x++) altered.data.set([5, 30, 70, 255], (y * source.width + x) * 4);
  }
  const model = estimatePaper(source, source, h, settings);
  const other = estimatePaper(altered, altered, h, { ...settings, crop: 'Full cell', pad: 35, order: 'Column-major', total: 13 });
  assert.deepEqual(model, other);
});

test('each photo gets its own lighting model but identical frame colors receive identical global controls', () => {
  const colors = [];
  for (const options of [{ tint: [1, .92, .78] }, { tint: [.74, .86, 1], offset: -.18 }]) {
    const source = litSheet(options), model = estimatePaper(source, source, h, settings);
    const rect = { x: 35, y: 32, w: 5, h: 5 };
    const sampled = sampleRect(source, source, h, rect, 8, 8);
    const adjusted = adjustRaster(sampled, rect, model, { ...DEFAULT_ADJUSTMENTS, black: 20, white: 250, gamma: .8, saturation: 70 });
    colors.push([...adjusted.data.slice(0, 3)]);
  }
  colors[0].forEach((value, c) => assert.ok(Math.abs(value - colors[1][c]) < 3));
});

test('global controls have neutral defaults, predictable levels/gamma/saturation and a two-tone cutoff', () => {
  const sheet = litSheet(), model = estimatePaper(sheet, sheet, h, settings);
  const source = { width: 3, height: 1, data: new Uint8ClampedArray([0, 64, 128, 255, 80, 120, 160, 255, 255, 255, 255, 255]) };
  const rect = { x: 40, y: 40, w: 30, h: 10 };
  assert.deepEqual(adjustRaster(source, rect, model, raw).data, source.data);
  const levels = adjustRaster(source, rect, model, { ...raw, black: 64, white: 192 });
  assert.deepEqual([...levels.data.slice(0, 3)], [0, 0, 128]);
  const gamma = adjustRaster(source, rect, model, { ...raw, gamma: 2 });
  assert.equal(gamma.data[1], Math.round(Math.sqrt(64 / 255) * 255));
  const gray = adjustRaster(source, rect, model, { ...raw, saturation: 0 });
  for (let i = 0; i < gray.data.length; i += 4) assert.equal(gray.data[i], gray.data[i + 1]);
  const ink = adjustRaster(source, rect, model, { ...raw, thresholdEnabled: true, threshold: 128 });
  assert.deepEqual([...ink.data], [0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
  assert.deepEqual([...source.data.slice(0, 3)], [0, 64, 128]);
  assert.throws(() => adjustRaster(source, rect, model, { ...raw, gamma: NaN }), /adjustment/);
});

test('flatten and WB can be disabled separately; unsupported blank references preserve the photo', () => {
  const source = litSheet(), model = estimatePaper(source, source, h, settings);
  const crop = { x: 35, y: 32, w: 5, h: 5 }, sampled = sampleRect(source, source, h, crop, 8, 8);
  const flattenOnly = adjustRaster(sampled, crop, model, { ...raw, flatten: true });
  assert.ok(flattenOnly.data[0] - flattenOnly.data[2] > 30, 'flatten alone must retain the color cast');
  const wbOnly = adjustRaster(sampled, crop, model, { ...raw, whiteBalance: true });
  assert.ok(Math.abs(wbOnly.data[0] - wbOnly.data[2]) < 3);
  assert.ok(wbOnly.data[0] < 240, 'WB alone should not normalize paper brightness');
  const noMargins = { ...settings, margin: 0, gap: 0 };
  const unsupported = estimatePaper(source, source, h, noMargins);
  assert.equal(unsupported.supported, false);
  assert.match(unsupported.note, /skipped/);
  assert.deepEqual(adjustRaster(sampled, crop, unsupported, DEFAULT_ADJUSTMENTS).data, sampled.data);
});

test('crop preview and full-sheet correction agree at the same physical sample positions', () => {
  const source = litSheet(), model = estimatePaper(source, source, h, settings);
  const rect = { x: 40, y: 50, w: 20, h: 10 };
  const full = adjustRaster(source, whole, model, DEFAULT_ADJUSTMENTS);
  const crop = adjustRaster(sampleRect(source, source, h, rect, 80, 40), rect, model, DEFAULT_ADJUSTMENTS);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 80; x++) {
    const originalIndex = ((200 + y) * source.width + 160 + x) * 4, cropIndex = (y * 80 + x) * 4;
    assert.deepEqual(crop.data.slice(cropIndex, cropIndex + 4), full.data.slice(originalIndex, originalIndex + 4));
  }
  const outside = { x: -50, y: -50, w: 5, h: 5 };
  const blank = sampleRect(source, source, h, outside, 2, 2);
  assert.ok(adjustRaster(blank, outside, model, DEFAULT_ADJUSTMENTS).data.every(v => v === 255));
});
