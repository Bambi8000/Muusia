import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCloseup } from '../src/closeup-detection.ts';
import { project, solveHomography } from '../src/homography.ts';

const CW = 84, CH = 73 + 2 / 3;
const corners = [{ x: 0, y: 0 }, { x: CW, y: 0 }, { x: CW, y: CH }, { x: 0, y: CH }];

function scene({ rotation = 0, dark = false, circle = true, frame = true, partial = false, extraCircle = false } = {}) {
  const width = 900, height = 900, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const noise = ((x * 31 + y * 73 + x * y) % 17) - 8;
    const light = dark ? 25 + 15 * x / width + noise : 235 - 35 * y / height + noise;
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = light; data[i + 3] = 255;
  }
  const transform = solveHomography(corners, [{ x: 160, y: 170 }, { x: 750, y: 190 }, { x: 715, y: 730 }, { x: 185, y: 755 }]);
  const point = (x, y) => {
    const p = project(transform, x, y), a = rotation * Math.PI / 180;
    return { x: 450 + (p.x - 450) * Math.cos(a) - (p.y - 450) * Math.sin(a), y: 450 + (p.x - 450) * Math.sin(a) + (p.y - 450) * Math.cos(a) };
  };
  function line(x0, y0, x1, y1) {
    const a = point(x0, y0), b = point(x1, y1), dx = b.x - a.x, dy = b.y - a.y;
    const n = Math.ceil(Math.hypot(dx, dy) * 3);
    for (let k = 0; k <= n; k++) {
      const cx = a.x + dx * k / n, cy = a.y + dy * k / n;
      for (let y = Math.floor(cy - 1.8); y <= Math.ceil(cy + 1.8); y++) for (let x = Math.floor(cx - 1.8); x <= Math.ceil(cx + 1.8); x++) {
        if (x < 0 || y < 0 || x >= width || y >= height || Math.hypot(x + .5 - cx, y + .5 - cy) > 1.8) continue;
        const i = (y * width + x) * 4;
        data[i] = dark ? 200 : 25; data[i + 1] = dark ? 245 : 25; data[i + 2] = dark ? 125 : 30;
      }
    }
  }
  function rectangle(x, y, w, h) { line(x, y, x + w, y); line(x + w, y, x + w, y + h); line(x + w, y + h, x, y + h); line(x, y + h, x, y); }
  function ring(cx, cy) {
    // A small break in the plotted ring must not prevent orientation recovery.
    for (let i = 2; i < 80; i++) {
      const a = i * Math.PI / 40, b = (i + 1) * Math.PI / 40;
      line(cx + 1.5 * Math.cos(a), cy + 1.5 * Math.sin(a), cx + 1.5 * Math.cos(b), cy + 1.5 * Math.sin(b));
    }
  }
  if (frame) rectangle(0, 0, CW, partial ? CH * 2 : CH);
  if (circle) ring(-2.5, -2.5);
  if (extraCircle) ring(CW + 2.5, -2.5);
  // Dense artwork and a clipped neighboring cell must not become the registration quad.
  for (let i = 0; i < 25; i++) { line(15 + i * 1.3, 12, 32 + i * 1.3, 58); line(12, 20 + i, 68, 8 + i * 1.8); }
  rectangle(0, CH + 8, CW, CH); ring(-2.5, CH + 5.5);
  return { raster: { width, height, data }, points: corners.map(p => point(p.x, p.y)) };
}

for (const dark of [false, true]) for (const rotation of [0, 90, 180, 270, 25]) {
  test(`close-up rectangle and open circle: ${dark ? 'dark' : 'light'} paper, ${rotation}°`, () => {
    const sample = scene({ rotation, dark });
    const result = detectCloseup(sample.raster, { cw: CW, ch: CH, paperTone: dark ? 'dark' : 'light' });
    assert.equal(result.status, 'found', JSON.stringify(result));
    const toCell = solveHomography(sample.points, corners);
    result.points.forEach((p, i) => {
      const recovered = project(toCell, p.x, p.y), expected = corners[i];
      assert.ok(Math.hypot(recovered.x - expected.x, recovered.y - expected.y) < .3, `corner ${i}: ${JSON.stringify(recovered)} vs ${JSON.stringify(expected)} mm`);
    });
  });
}

test('missing orientation circle keeps manual placement available', () => {
  const result = detectCloseup(scene({ circle: false }).raster, { cw: CW, ch: CH });
  assert.equal(result.status, 'ambiguous'); assert.equal(result.points, null);
});

test('two plausible corner circles do not silently rotate the frame', () => {
  const result = detectCloseup(scene({ extraCircle: true }).raster, { cw: CW, ch: CH });
  assert.equal(result.status, 'ambiguous'); assert.equal(result.points, null);
});

for (const options of [{ frame: false }, { partial: true }]) test(`artwork and incomplete frames are rejected: ${JSON.stringify(options)}`, () => {
  const result = detectCloseup(scene(options).raster, { cw: CW, ch: CH });
  assert.equal(result.status, 'not-found'); assert.equal(result.points, null);
});
