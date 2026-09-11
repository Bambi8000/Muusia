import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLayout } from '../src/layout.ts';
import { REFERENCE_SETTINGS } from '../src/reference-settings.ts';

test('reference SVG matches confirmed A4/15 mm markers and 4×3 frame windows', () => {
  const svg = readFileSync(new URL('./animtest.svg', import.meta.url), 'utf8');
  assert.match(svg, /width="297mm" height="210mm" viewBox="0 0 297 210"/);
  assert.doesNotMatch(svg, /<metadata\b/);
  // This fixture uses only absolute M/L/Z polylines, with no transforms.
  assert.doesNotMatch(svg, /\btransform=/);
  const boxes = [...svg.matchAll(/<path d="([^"]+)"/g)].map(([, d]) => {
    assert.match(d, /^[MLZ\d.,\s-]+$/);
    const numbers = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0), ys = numbers.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  });
  const layout = buildLayout(REFERENCE_SETTINGS);
  for (const m of layout.markers) assert.ok(boxes.some(b => b.x === m.x - 7.5 && b.y === m.y - 7.5 && b.w === 15 && b.h === 15));
  const artwork = boxes.filter(b => b.x > 30 && b.y > 30 && b.x + b.w < 267 && b.y + b.h < 180);
  assert.equal(artwork.length, 12);
  for (const { window: q } of layout.cells) {
    assert.equal(artwork.filter(b => b.x >= q.x && b.y >= q.y && b.x + b.w <= q.x + q.w && b.y + b.h <= q.y + q.h).length, 1);
  }
});
