import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAnimationReceipt, renderReceipt, ANIMATION_RECEIPT } from '../../src/thermal-print.js';
import { detectLargeReceipt, readLargeReceiptNumber } from '../src/receipt-detection.ts';

function receipt(frame) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({
    getContext: () => ({ fillRect() {}, save() {}, translate() {}, scale() {}, restore() {}, getImageData: () => ({ data: new Uint8ClampedArray(512 * 711 * 4).fill(255) }) }),
  }) };
  try { return renderReceipt([], 72, 100, { number: frame, count: 12 }); }
  finally { globalThis.document = previous; }
}

function photograph(image, angle = 0, eraseCode = false, shadow = false) {
  const sideways = Math.abs(angle) % 180 === 90;
  const width = sideways ? 1200 : 840, height = sideways ? 960 : 1140, data = new Uint8ClampedArray(width * height * 4);
  const bytes = Uint8Array.from(atob(image.data), c => c.charCodeAt(0));
  const scale = 1.24, cx = width / 2, cy = height / 2, a = angle * Math.PI / 180;
  const offsetX = cx - 256 * scale, offsetY = cy - image.height / 2 * scale;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rx = (x - cx) * Math.cos(a) + (y - cy) * Math.sin(a) + cx;
    const ry = -(x - cx) * Math.sin(a) + (y - cy) * Math.cos(a) + cy;
    const sx = Math.floor((rx - offsetX) / scale), sy = Math.floor((ry - offsetY) / scale);
    const onPaper = sx >= 0 && sx < image.width && sy >= 0 && sy < image.height;
    const black = onPaper && !(eraseCode && sy >= 60 && sy <= 86 && sx >= 180 && sx <= 330)
      && Boolean(bytes[sy * 64 + (sx >> 3)] & (0x80 >> (sx & 7)));
    const shade = black ? 24 : onPaper ? shadow ? 246 - Math.round(sy / image.height * 95) : 246 : shadow ? 115 : 185;
    const o = (y * width + x) * 4;
    data[o] = shade; data[o + 1] = shade; data[o + 2] = shade; data[o + 3] = 255;
  }
  return { width, height, data };
}

for (const angle of [0, 5, 90, 180, 270]) test(`new receipt frame is detected from a ${angle}° photograph`, () => {
  const raster = photograph(receipt(7), angle);
  const result = detectLargeReceipt(raster);
  assert.equal(result.status, 'found', result.message);
  assert.equal(result.number?.value, 7, result.number?.message);
  assert.equal(readLargeReceiptNumber(raster, result.points).value, 7);
  const [tl, tr, , bl] = result.points;
  assert.ok((tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x) > 0);
});

test('the frame and number survive a dark wooden background and shadowed paper', () => {
  const result = detectLargeReceipt(photograph(receipt(4), 5, false, true));
  assert.equal(result.status, 'found', result.message);
  assert.equal(result.number?.value, 4);
});

test('without a readable strip, an orientation ambiguity is left for manual placement', () => {
  const raster = photograph(receipt(12), 0, true);
  const result = detectLargeReceipt(raster);
  assert.equal(result.status, 'ambiguous', result.message);
  assert.equal(result.points, null);
});

test('the new receipt has four separate outward L marks and a 16-cell number strip', () => {
  const image = receipt(12), bytes = Uint8Array.from(atob(image.data), c => c.charCodeAt(0));
  const dot = (x, y) => Boolean(bytes[y * 64 + (x >> 3)] & (0x80 >> (x & 7)));
  const { x, y, width, arm, codeX, codeY, codeCell } = ANIMATION_RECEIPT;
  assert.ok(dot(x - arm + 2, y) && dot(x, y - arm + 2));
  assert.ok(dot(x + width + arm - 2, y) && dot(x + width, y - arm + 2));
  assert.ok(dot(codeX + codeCell / 2 | 0, codeY + 9));
  assert.ok(dot(codeX + 15 * codeCell + 4, codeY + 9));
});

test('numbered receipts keep native Epson text alongside the larger marks', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, save() {}, translate() {}, scale() {}, restore() {}, getImageData: () => ({ data: new Uint8ClampedArray(512 * 711 * 4).fill(255) }) }) }) };
  try {
    const thermalText = [{ place: 'after', text: 'MUUSIA' }];
    const result = renderReceipt([], 72, 100, { number: 2, count: 12 }, thermalText);
    assert.deepEqual(result.thermalText, thermalText);
    assert.equal(result.height, renderAnimationReceipt([], 72, 100, 2, 12).height);
  } finally { globalThis.document = previous; }
});
