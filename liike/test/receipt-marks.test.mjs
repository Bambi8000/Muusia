import test from 'node:test';
import assert from 'node:assert/strict';
import { detectReceiptMarks, receiptAffine, receiptFullExtent, receiptHeight, sampleReceipt } from '../src/receipt-marks.ts';
import { project } from '../src/homography.ts';

function fixture(dx = 0, dy = 0) {
  const width = 720, height = 900, data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  const ink = (x, y) => { if (x >= 0 && y >= 0 && x < width && y < height) { const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 25; } };
  const left = 100 + dx, right = 612 + dx, top = 90 + dy, bottom = 801 + dy;
  for (const y of [top, bottom]) {
    for (let x = left; x < left + 12; x++) ink(x, y);
    for (let x = right - 11; x <= right; x++) ink(x, y);
  }
  for (let y = top - 6; y < top; y++) { ink(left + 1, y); ink(right - 1, y); }
  for (let y = bottom + 1; y <= bottom + 6; y++) { ink(left + 1, y); ink(right - 1, y); }
  for (let y = 200; y < 700; y++) for (let x = 180; x < 500; x += 50) ink(x, y);
  return { raster: { width, height, data }, expected: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }] };
}

test('finds the four Muusia receipt ticks among artwork', () => {
  const { raster, expected } = fixture();
  const marks = detectReceiptMarks(raster);
  assert.ok(marks);
  marks.forEach((p, i) => assert.ok(Math.hypot(p.x - expected[i].x, p.y - expected[i].y) < 4, `${i}: ${JSON.stringify(p)}`));
  assert.ok(Math.abs(receiptHeight(marks) - 711) < 2);
});

test('full-photo alignment centers the receipt and retains every image corner', () => {
  for (const [dx, dy] of [[0, 0], [24, -18]]) {
    const { raster } = fixture(dx, dy), marks = detectReceiptMarks(raster);
    assert.ok(marks);
    const height = receiptHeight(marks), transform = receiptAffine(marks, height), center = project(transform, 256, height / 2);
    const markCenter = marks.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
    assert.ok(Math.hypot(center.x - markCenter.x, center.y - markCenter.y) < 1);
    const extent = receiptFullExtent(marks, height, raster.width, raster.height);
    assert.ok(extent.x < 0 && extent.y < 0 && extent.w > 512 && extent.h > height);
  }
});

test('full-photo gaps extend the photo edge instead of turning white', () => {
  const source = { width: 2, height: 2, data: new Uint8ClampedArray([100, 120, 140, 255, 100, 120, 140, 255, 100, 120, 140, 255, 100, 120, 140, 255]) };
  const h = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const full = sampleReceipt(source, h, { x: -2, y: -2, w: 6, h: 6 }, 6, 6, true);
  assert.deepEqual([...full.data.slice(0, 4)], [100, 120, 140, 255]);
  const crop = sampleReceipt(source, h, { x: -2, y: -2, w: 6, h: 6 }, 6, 6, false);
  assert.deepEqual([...crop.data.slice(0, 4)], [255, 255, 255, 255]);
});
