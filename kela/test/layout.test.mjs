import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, DEFAULTS, framesOnSheet, LAYOUTS, ORDERS, validateSettings } from '../src/layout.ts';
import frameGrid from '../../src/defs/nodes/frame_grid.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('A3 3×2 oracle: margin 30, gap 8, shared full-canvas scale', () => {
  const p = { ...DEFAULTS, cols: 3, rows: 2 };
  const l = buildLayout(p);
  close(l.cw, 344 / 3); close(l.ch, 114.5); close(l.scale, (344 / 3) / 420);
  const first = l.cells[0];
  close(first.cell.x, 30); close(first.cell.y, 30);
  close(first.window.w, 344 / 3); close(first.window.h, (344 / 3) / 420 * 297);
  close(first.window.y, 30 + (114.5 - first.window.h) / 2);
  for (const cell of l.cells) {
    close(cell.window.w / cell.window.h, 420 / 297);
    close(cell.window.x + cell.window.w / 2, cell.cell.x + cell.cell.w / 2);
    close(cell.window.y + cell.window.h / 2, cell.cell.y + cell.cell.h / 2);
    assert.deepEqual(cell.crop, cell.window);
  }
});

test('explicit traversal oracles keep reading positions separate from frame order', () => {
  const p = { ...DEFAULTS, cols: 3, rows: 2 };
  assert.deepEqual(buildLayout(p).frameToCell, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(buildLayout({ ...p, order: 'Column-major' }).frameToCell, [0, 3, 1, 4, 2, 5]);
  assert.deepEqual(buildLayout({ ...p, order: 'Boustrophedon' }).frameToCell, [0, 1, 2, 5, 4, 3]);
});

test('matches actual Muusia placement across paper sizes, layouts and orders', () => {
  for (const [W, H] of [[420, 297], [297, 420], [297, 210], [210, 297]]) {
    for (const [cols, rows] of [...LAYOUTS, [1, 1], [6, 6]]) for (const order of ORDERS) {
      const p = { ...DEFAULTS, W, H, cols, rows, order };
      const l = buildLayout(p);
      const expected = frameGrid._layout({ ...p, layout: 'Custom' }, { W, H });
      close(l.scale, expected.s);
      l.frameToCell.forEach((cellIndex, i) => {
        const q = l.cells[cellIndex].cell, e = expected.cells[i];
        for (const key of ['x', 'y', 'w', 'h']) close(q[key], e[key]);
      });
    }
  }
});

test('partial last sheets extract exactly total frames for every order', () => {
  for (const order of ORDERS) for (const total of [1, 6, 7, 12, 14]) {
    const p = { ...DEFAULTS, cols: 3, rows: 2, total, order };
    const layout = buildLayout(p);
    const frames = Array.from({ length: layout.sheets }, (_, sheet) => framesOnSheet(p, sheet)).flat();
    assert.deepEqual(frames.map(f => f.frame), Array.from({ length: total }, (_, i) => i));
    assert.equal(framesOnSheet(p, layout.sheets - 1).length, ((total - 1) % 6) + 1);
  }
  const p = { ...DEFAULTS, cols: 3, rows: 2, total: 14, order: 'Column-major' };
  assert.deepEqual(framesOnSheet(p, 2).map(f => f.index), [0, 3]);
  assert.throws(() => framesOnSheet(p, 3), RangeError);
  assert.throws(() => framesOnSheet(p, -1), RangeError);
  assert.throws(() => framesOnSheet(p, 0.5), RangeError);
});

test('fixed 20 mm marker centers and top-left orientation hole', () => {
  assert.deepEqual(buildLayout({ ...DEFAULTS, W: 297, H: 210 }).markers, [
    { x: 20, y: 20, hole: true }, { x: 277, y: 20, hole: false },
    { x: 277, y: 190, hole: false }, { x: 20, y: 190, hole: false },
  ]);
});

test('full-cell crop is distinct; padding expands symmetrically without shifting center', () => {
  const p = { ...DEFAULTS, crop: 'Full cell', pad: 10 };
  const { cell, crop, window } = buildLayout(p).cells[0];
  assert.notEqual(cell.w / cell.h, window.w / window.h);
  close(crop.w, cell.w * 1.2); close(crop.h, cell.h * 1.2);
  close(crop.x + crop.w / 2, cell.x + cell.w / 2);
  close(crop.y + crop.h / 2, cell.y + cell.h / 2);
});

test('invalid and collapsed settings fail before generating geometry', () => {
  for (const patch of [{ W: NaN }, { gap: Infinity }, { W: 0 }, { H: 41 }, { total: 0 },
    { total: 2.5 }, { total: Number.MAX_SAFE_INTEGER + 1 }, { cols: 7 }, { rows: 1.2 },
    { margin: -1 }, { margin: 150 }, { markSize: 16 }, { gap: -1 }, { pad: -1 },
    { crop: 'unknown' }, { order: 'unknown' }]) {
    assert.ok(validateSettings({ ...DEFAULTS, ...patch }).length);
    assert.throws(() => buildLayout({ ...DEFAULTS, ...patch }), RangeError);
  }
  assert.deepEqual(validateSettings({ ...DEFAULTS, margin: 0, gap: 0, cols: 1, rows: 1 }), []);
});
