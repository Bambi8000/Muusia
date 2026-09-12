import test from 'node:test';
import assert from 'node:assert/strict';
import { sharpenRaster } from '../src/sharpen.ts';

function edge(width = 320, height = 24) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Independent soft photographed step, centered at 10 mm.
    const value = 35 + 195 / (1 + Math.exp(-((x + .5) * 20 / width - 10) / .13));
    data.set([value, value, value, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}
const rect = { x: 0, y: 0, w: 20, h: 1.5 };

test('sharpening improves a soft edge without shifting it or adding overshoot', () => {
  const source = edge(), snapshot = new Uint8ClampedArray(source.data);
  const output = sharpenRaster(source, rect, 70);
  let beforeError = 0, afterError = 0;
  for (let x = 0; x < source.width; x++) {
    const before = source.data[x * 4], after = output.data[x * 4], ideal = x < 160 ? 35 : 230;
    beforeError += (before - ideal) ** 2; afterError += (after - ideal) ** 2;
    assert.ok(after >= 35 && after <= 230, 'new light/dark halo');
    assert.equal(after < 132.5, x < 160, 'edge position moved');
    assert.equal(output.data[x * 4 + 3], 255);
  }
  assert.ok(afterError < beforeError * .96, `${beforeError} → ${afterError}`);
  assert.deepEqual(source.data, snapshot);
  assert.deepEqual(sharpenRaster(source, rect, 0).data, snapshot);
  assert.throws(() => sharpenRaster(source, rect, NaN), /strength/);
});

test('sharpening leaves flat paper and low-contrast grain unchanged', () => {
  const source = edge();
  for (let i = 0; i < source.data.length; i += 4) {
    const value = 242 + (i / 4 % 5);
    source.data.set([value, value - 4, value - 9, 255], i);
  }
  assert.deepEqual(sharpenRaster(source, rect, 100).data, source.data);
  const pixel = { width: 1, height: 1, data: new Uint8ClampedArray([120, 90, 70, 255]) };
  assert.deepEqual(sharpenRaster(pixel, rect, 100).data, pixel.data);
});

test('preview and export sharpening use a consistent physical edge radius', () => {
  const small = sharpenRaster(edge(160, 12), rect, 50);
  const large = sharpenRaster(edge(320, 24), rect, 50);
  let maxDifference = 0;
  for (let x = 0; x < 160; x++) {
    const averaged = (large.data[x * 8] + large.data[x * 8 + 4]) / 2;
    maxDifference = Math.max(maxDifference, Math.abs(small.data[x * 4] - averaged));
  }
  assert.ok(maxDifference <= 5, `preview/export difference ${maxDifference}`);
});
