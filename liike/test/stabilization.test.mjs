import test from 'node:test';
import assert from 'node:assert/strict';
import { drawingPosition, centeredCrop } from '../src/stabilization.ts';
import { sampleRect } from '../src/sampling.ts';

// A scalene triangle's area centroid is the mean of its three vertices.
// Its bounding-box center changes when it rotates: an independent wobble oracle.
function drawing({ angle = 0, x = 160, y = 120, extra = false, gap = false, blank = false } = {}) {
  const width = 320, height = 240, data = new Uint8ClampedArray(width * height * 4);
  const c = Math.cos(angle), s = Math.sin(angle);
  const triangle = [[-20, -15], [28, -7], [-8, 22]].map(([px, py]) => [x + c * px - s * py, y + s * px + c * py]);
  const polygons = extra ? [triangle, triangle.map(([px, py]) => [px + 75, py])] : [triangle];
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    let distance = Infinity;
    if (!blank) for (const points of polygons) for (let i = 0; i < 3; i++) {
      const a = points[i], b = points[(i + 1) % 3], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px + .5 - a[0]) * dx + (py + .5 - a[1]) * dy) / (dx * dx + dy * dy)));
      if (gap && i === 0 && t > .47 && t < .53) continue;
      distance = Math.min(distance, Math.hypot(px + .5 - a[0] - t * dx, py + .5 - a[1] - t * dy));
    }
    const paper = 220 - 45 * px / width + 10 * py / height + 2 * Math.sin(px * 31 + py * 9);
    const value = paper - 120 * Math.max(0, Math.min(1, 1.4 - distance));
    data.set([value, value * .95, value * .88, 255], (py * width + px) * 4);
  }
  return { width, height, data };
}

test('an asymmetric rotating drawing keeps its area center under translation, cast and shading', () => {
  for (let i = 0; i < 12; i++) {
    const x = 150 + 13 * Math.cos(i * 1.1), y = 125 + 18 * Math.sin(i * .7);
    const raster = drawing({ angle: i * Math.PI / 6, x, y, gap: i % 2 === 1 });
    const original = raster.data.slice(), position = drawingPosition(raster);
    assert.ok(position, `frame ${i + 1}`);
    assert.ok(Math.abs(position.center.x * raster.width - x) < .75, `x at frame ${i + 1}`);
    assert.ok(Math.abs(position.center.y * raster.height - y) < .75, `y at frame ${i + 1}`);
    assert.deepEqual(raster.data, original);
  }
});

test('stabilization translates the original sampling window, preserving crop dimensions and orientation', () => {
  const source = drawing({ angle: Math.PI / 5, x: 143, y: 138 });
  const base = { x: 40, y: 30, w: 240, h: 180 };
  const h = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const preview = sampleRect(source, source, h, base, 240, 180);
  const crop = centeredCrop(base, drawingPosition(preview));
  assert.ok(Math.abs(crop.x - 23) < .75);
  assert.ok(Math.abs(crop.y - 48) < .75);
  assert.equal(crop.w, 240); assert.equal(crop.h, 180);
  assert.deepEqual(base, { x: 40, y: 30, w: 240, h: 180 });
  const result = sampleRect(source, source, h, crop, 240, 180);
  const aligned = drawingPosition(result);
  assert.ok(Math.abs(aligned.center.x * 240 - 120) < .5);
  assert.ok(Math.abs(aligned.center.y * 180 - 90) < .5);
  // Sampling follows a translation, including asymmetric image detail away from ink.
  for (const [x, y] of [[150, 100], [120, 80], [185, 145]]) {
    const sx = Math.round(x + crop.x), sy = Math.round(y + crop.y);
    assert.ok(Math.abs(result.data[(y * 240 + x) * 4] - source.data[(sy * 320 + sx) * 4]) < 12);
  }
});

test('blank, multiple and edge-clipped drawings do not receive an arbitrary center', () => {
  assert.equal(drawingPosition(drawing({ blank: true })), null);
  assert.equal(drawingPosition(drawing({ extra: true })), null);
  assert.equal(drawingPosition(drawing({ x: 10 })), null);
  const crop = { x: 30, y: 40, w: 50, h: 35 };
  assert.equal(centeredCrop(crop, { center: { x: .9, y: .5 }, bounds: { x: .8, y: .3, w: .1, h: .2 } }), null);
  assert.equal(centeredCrop(crop, { center: { x: .6, y: .5 }, bounds: { x: .01, y: .3, w: .8, h: .2 } }), null);
});
