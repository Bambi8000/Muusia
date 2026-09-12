import test from 'node:test';
import assert from 'node:assert/strict';
import { planFrames, outputSize } from '../src/frames.ts';
import { sampleRect } from '../src/sampling.ts';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';

function photo(id, settings, scale = 1) {
  return { id, width: settings.W * scale, height: settings.H * scale, points: [[20, 20], [settings.W - 20, 20], [settings.W - 20, settings.H - 20], [20, settings.H - 20]].map(([x, y]) => ({ x: x * scale, y: y * scale })) };
}

test('multi-sheet extraction samples occupied cells in each traversal order and skips surplus photos', () => {
  const orders = {
    'Row-major': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'Column-major': [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11],
    Boustrophedon: [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11],
  };
  for (const [order, expected] of Object.entries(orders)) {
    const settings = { ...REFERENCE_SETTINGS, total: 14, order };
    const plans = planFrames(settings, [photo('one', settings, 4), photo('two', settings, 4), photo('extra', settings)], 64);
    assert.equal(plans.length, 2);
    assert.deepEqual(plans[0].frames.map(f => f.cell), expected);
    assert.deepEqual(plans[1].frames.map(f => f.cell), expected.slice(0, 2));
    assert.deepEqual(plans.flatMap(p => p.frames).map(f => f.frame), Array.from({ length: 14 }, (_, i) => i));
    for (const [sheet, plan] of plans.entries()) {
      // Distinct red/green spatial ramps and a blue sheet code catch wrong cells/photos.
      const source = { width: 1188, height: 840, data: new Uint8ClampedArray(1188 * 840 * 4) };
      for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) source.data.set([(x + .5) / source.width * 255, (y + .5) / source.height * 255, sheet * 90 + 30, 255], (y * source.width + x) * 4);
      for (const [i, spec] of plan.frames.entries()) {
        const raster = sampleRect(source, source, plan.h, spec.crop, spec.width, spec.height);
        const c = expected[i] % 4, r = Math.floor(expected[i] / 4);
        // Independent handoff geometry: cw=53.25, ch=134/3, window=53.25×37.6515…
        const windowHeight = 53.25 * 210 / 297;
        const left = 30 + c * 61.25, top = 30 + r * (134 / 3 + 8) + (134 / 3 - windowHeight) / 2;
        for (const [x, y] of [[0, 0], [31, 22], [63, 44]]) {
          const offset = (y * raster.width + x) * 4;
          const red = (left + (x + .5) / raster.width * 53.25) / 297 * 255;
          const green = (top + (y + .5) / raster.height * windowHeight) / 210 * 255;
          assert.ok(Math.abs(raster.data[offset] - red) < 1);
          assert.ok(Math.abs(raster.data[offset + 1] - green) < 1);
          assert.equal(raster.data[offset + 2], sheet * 90 + 30);
        }
      }
    }
  }
});

test('extraction retains original pixel detail that a working preview cannot contain', () => {
  const settings = { ...REFERENCE_SETTINGS, W: 100, H: 80, cols: 1, rows: 1, total: 1, margin: 30 };
  const [plan] = planFrames(settings, [photo('detail', settings, 10)], 250);
  const spec = plan.frames[0];
  const source = { width: 1000, height: 800, data: new Uint8ClampedArray(1000 * 800 * 4) };
  for (let y = 0; y < 800; y++) for (let x = 0; x < 1000; x++) source.data.set([x % 2 * 255, x % 2 * 255, x % 2 * 255, 255], (y * 1000 + x) * 4);
  const raster = sampleRect(source, source, plan.h, spec.crop, spec.width, spec.height);
  assert.deepEqual([raster.width, raster.height], [250, 200]);
  for (let x = 0; x < 250; x++) assert.equal(raster.data[x * 4], (375 + x) % 2 * 255);
});

test('full-cell crops and padding keep their actual aspect ratio at the selected resolution', () => {
  const settings = { ...REFERENCE_SETTINGS, crop: 'Full cell', pad: 10 };
  const spec = planFrames(settings, [photo('crop', settings)], 1080)[0].frames[0];
  assert.ok(Math.abs(spec.crop.w - 63.9) < 1e-9);
  assert.ok(Math.abs(spec.crop.h - 53.6) < 1e-9);
  assert.ok(Math.abs(spec.crop.x - 24.675) < 1e-9);
  assert.deepEqual([spec.width, spec.height], [1080, 906]);
  assert.deepEqual(outputSize({ x: 0, y: 0, w: 210, h: 297 }, 1080), { width: 764, height: 1080 });
  assert.throws(() => outputSize(spec.crop, 4000), /resolution/);
});

test('incomplete, invalid or still-detecting sheets cannot create a partial animation', () => {
  const settings = { ...REFERENCE_SETTINGS, total: 13 };
  const one = photo('one', settings), two = photo('two', settings);
  assert.throws(() => planFrames(settings, [one], 1080), /Add 1 more/);
  assert.throws(() => planFrames(settings, [one, { ...two, points: [null, ...two.points.slice(1)] }], 1080), /Sheet 2: place all four/);
  assert.throws(() => planFrames(settings, [one, { ...two, points: [...two.points].reverse() }], 1080), /Sheet 2:.*mirrored/);
  assert.throws(() => planFrames(settings, [one, { ...two, detection: { status: 'running' } }], 1080), /wait for marker detection/);
  assert.throws(() => planFrames(settings, [one, { ...two, points: [{ x: -1, y: 20 }, ...two.points.slice(1)] }], 1080), /inside the photo/);
});

test('unregistered extras are ignored until included by frame count or photo order', () => {
  const settings = { ...REFERENCE_SETTINGS };
  const one = photo('one', settings), extra = { ...photo('extra', settings), points: [null, null, null, null] };
  const plans = planFrames(settings, [one, extra], 1080);
  assert.deepEqual(plans.map(plan => plan.photoId), ['one']);
  assert.equal(plans[0].frames.length, 12);
  assert.throws(() => planFrames({ ...settings, total: 24 }, [one, extra], 1080), /Sheet 2: place all four/);
  assert.throws(() => planFrames(settings, [extra, one], 1080), /Sheet 1: place all four/);
});
