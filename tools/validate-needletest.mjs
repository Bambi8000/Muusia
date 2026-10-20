import assert from 'node:assert/strict';
import node from '../src/defs/nodes/needletest.js';
import { DEFAULT_NEEDLE_MACHINE, needleExportError } from '../src/machine.js';

const defaults = Object.fromEntries(node.params.map(p => [p.key, p.def]));
const ctx = { W: 148, H: 148 };
const run = (p = {}, canvas = ctx) => node.compute([], { ...defaults, ...p }, canvas);
const job = run({ maxDepth: 2 });
assert.equal(job.paths.length, 500);
assert.equal(needleExportError(job, DEFAULT_NEEDLE_MACHINE), '');
const unique = new Set();
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
  const cell = job.paths.slice((r * 5 + c) * 20, (r * 5 + c + 1) * 20);
  const spacing = .5 + 2.5 * c / 4;
  assert.ok(Math.abs(cell[1].pts[0][0] - cell[0].pts[0][0] - spacing) < 1e-9);
  assert.equal(cell.length, 20);
  assert.ok(cell.every(p => p.pts[0][1] === cell[0].pts[0][1]), "Each setting occupies a single horizontal row");
  assert.ok(cell.every((p, i) => Math.abs(p.pts[0][0] - cell[0].pts[0][0] - i * spacing) < 1e-9));
  for (const path of cell) {
    const [x, y, z] = path.pts[0];
    assert.deepEqual(path.pts[0], path.pts[1], 'Every path is a stationary punch');
    assert.equal(z, 2 * (r + 1) / 5);
    assert.ok(x >= 12 && y >= 12 && x <= ctx.W - 12 && y <= ctx.H - 12);
    assert.ok(!unique.has(`${x},${y}`), 'No repeated holes');
    unique.add(`${x},${y}`);
  }
}
assert.equal(Math.max(...run().paths.map(p => p.pts[0][2])), .5);
assert.equal(Math.max(...run({ maxDepth: 100 }).paths.map(p => p.pts[0][2])), 2);
for (const maxDepth of [0, .001, -1, NaN, Infinity, undefined]) assert.equal(run({ maxDepth }).paths.length, 0);
assert.equal(run({}, { W: 50, H: 50 }).paths.length, 0, 'An undersized canvas never scales or truncates tests');
assert.ok(node.overlay(defaults, { W: 50, H: 50 })[0].text.includes('canvas'));
assert.deepEqual(run({ minSpacing: 3, maxSpacing: .5 }), run());
const single = run({ depthSteps: 1, spacingSteps: 1, maxDepth: 1.7, layer: 4 });
assert.equal(single.paths.length, 20);
assert.equal(single.paths[0].pts[0][2], 1.7);
assert.equal(single.paths[1].pts[0][0] - single.paths[0].pts[0][0], 3);
assert.ok(single.paths.every(p => p.layer === 4));
const dense = run({ depthSteps: 10, spacingSteps: 10, dots: 100, minSpacing: .1, maxSpacing: .1, gap: 2 }, { W: 300, H: 300 });
assert.equal(dense.paths.length, 10000);
assert.equal(needleExportError(dense, DEFAULT_NEEDLE_MACHINE), '');
assert.deepEqual(run(), run(), 'Deterministic geometry');
const labels = node.overlay({ ...defaults, maxDepth: 2 }, ctx).filter(g => g.kind === 'text');
assert.ok(labels.some(g => g.text.includes('D 2 mm')));
assert.ok(labels.some(g => g.text.includes('S 0.5 mm')));

assert.equal(run({ dots: 1 }).paths.length, 500, "Wires and old projects cannot reduce a row below 20 punches");
assert.equal(run({ dots: 30 }, { W: 210, H: 297 }).paths.length, 750);

console.log('Needle Test: constant depth and spacing per row, minimum 20 punches, bounds and profile checks passed.');
