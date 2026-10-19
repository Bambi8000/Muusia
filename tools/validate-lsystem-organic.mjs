import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import N from '../src/defs/nodes/lsystem.js';
import F from '../src/defs/nodes/frame.js';
import M from '../src/defs/nodes/matem.js';
import { EMPTY, pathLength, PENS } from '../src/defs/helpers.js';

const defaults = Object.fromEntries(N.params.map(p => [p.key, p.def]));
const ctx = { W: 420, H: 297 };
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const points = v => v.paths.reduce((n, p) => n + p.pts.length, 0);
const length = v => v.paths.reduce((n, p) => n + pathLength(p.pts, p.closed), 0);
let cases = 0;
function run(params = {}, context = ctx, style) {
  const p = { ...defaults, ...params }, before = hash({ p, context, style });
  const v = N.compute([style], p, context);
  assert.equal(hash({ p, context, style }), before, 'compute is pure');
  for (const path of v.paths) {
    assert.ok(path.pts.length >= 2 && !path.closed);
    assert.ok(Number.isInteger(path.layer) && path.layer >= 0 && path.layer < PENS.length);
    for (const [x, y] of path.pts) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      if (p.preset !== 'Lightning') {
        assert.ok(x >= p.margin - 1e-7 && x <= context.W - p.margin + 1e-7);
        assert.ok(y >= p.margin - 1e-7 && y <= context.H - p.margin + 1e-7);
      }
    }
  }
  cases++;
  return v;
}

// Snapshots were captured from the original built-in node before this extension.
const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/lsystem-legacy.json', import.meta.url)));
for (const f of fixtures) assert.equal(hash(run(f.params, f.ctx)), f.sha256, 'legacy ' + JSON.stringify(f.params));

const tree = { preset: 'Sparse tree', iter: 6, stochastic: true, continueWeight: 25,
  branchWeight: 70, endWeight: 5, branchScale: 75, angleVariation: 20, lengthVariation: 15 };
const full = run(tree);
assert.ok(full.paths.length > 100);
assert.equal(hash(full), hash(run(tree)));
assert.notEqual(hash(full), hash(run({ ...tree, seed: 38 })));
for (const key of ['branchAngle', 'branchScale', 'angleVariation', 'lengthVariation', 'jitter', 'continueWeight', 'branchWeight', 'endWeight']) {
  const values = { branchAngle: 55, branchScale: 40, angleVariation: 45, lengthVariation: 50,
    jitter: .3, continueWeight: 90, branchWeight: 20, endWeight: 70 };
  assert.notEqual(hash(full), hash(run({ ...tree, [key]: values[key] })), key + ' has an effect');
}
for (const preset of ['Plant', 'Sparse tree', 'Bush', 'Fern']) {
  for (const stochastic of [false, true]) for (const seed of [3, 7, 37]) {
    const v = run({ ...tree, preset, stochastic, seed });
    assert.ok(v.paths.length > 0 && points(v) <= 118000);
  }
}

// Independent geometry oracle: nested brackets scale lengths, then restore parent length.
const nested = run({ preset: 'Custom', axiom: 'F[+F[+F]]F', rules: '', branchScale: 50 });
const segments = nested.paths.flatMap(p => p.pts.slice(1).map((q, i) => Math.hypot(q[0] - p.pts[i][0], q[1] - p.pts[i][1])));
assert.equal(segments.length, 4);
for (let i = 0; i < 4; i++) assert.ok(Math.abs(segments[i] / segments[0] - [1, .5, .25, 1][i]) < 1e-8);

// Weighted rule selection is structural; jitter and variations stay zero here.
const custom = { preset: 'Custom', axiom: 'X', rules: 'X=100:F+F|0:F-F', iter: 1, stochastic: true };
const positive = run(custom), negative = run({ ...custom, rules: 'X=0:F+F|100:F-F' });
assert.notEqual(hash(positive), hash(negative));
assert.equal(hash(positive), hash(run({ ...custom, stochastic: false })));
assert.equal(hash(positive), hash(run({ ...custom, rules: 'X=F+F' })));
const mixed = { ...custom, axiom: 'XXXXXXXXXXXX', rules: 'X=1:F+F|1:F-F' };
assert.notEqual(hash(run(mixed)), hash(run({ ...mixed, seed: 38 })));
assert.equal(hash(run({ ...mixed, rules: 'X=F+F;X=F-F' })), hash(run(mixed)));
const allZero = run({ ...tree, angleVariation: 0, lengthVariation: 0, continueWeight: 0, branchWeight: 0, endWeight: 0 });
const endOnly = run({ ...tree, angleVariation: 0, lengthVariation: 0, continueWeight: 0, branchWeight: 0, endWeight: 100 });
assert.equal(hash(allZero), hash(endOnly));
assert.equal(allZero.paths.length, 1);

// A forest has one complete independently fitted system inside every requested cell.
const forest = { ...tree, mode: 'Forest', count: 12, columns: 6, spacing: 8, heightVariation: 35 };
const forestFull = run(forest), guides = N.overlay({ ...defaults, ...forest }, ctx).slice(1);
assert.equal(guides.length, 12);
for (const g of guides) {
  const paths = forestFull.paths.filter(p => p.pts.every(([x, y]) => x >= g.x - 1e-7 && x <= g.x + g.w + 1e-7 && y >= g.y - 1e-7 && y <= g.y + g.h + 1e-7));
  assert.ok(paths.length > 0, 'every plant survives');
  assert.ok(Math.abs(Math.max(...paths.flatMap(p => p.pts.map(q => q[1]))) - (g.y + g.h)) < 1e-7, 'baseline fit');
}
for (const count of [1, 7, 36]) for (const preset of ['Bush', 'Fern', 'Hilbert']) {
  const v = run({ ...forest, count, columns: 6, preset, iter: 8 });
  assert.ok(v.paths.length > 0 && points(v) <= 118000, 'dense forest stays whole and bounded');
}
for (const key of ['count', 'columns', 'spacing', 'heightVariation']) {
  assert.notEqual(hash(forestFull), hash(run({ ...forest, [key]: { count: 9, columns: 4, spacing: 2, heightVariation: 0 }[key] })));
}

// Switching presets must not leave hidden plant controls affecting fractal forests.
for (const preset of ['Koch', 'Dragon', 'Hilbert', 'Sierpinski']) {
  const p = { preset, mode: 'Forest' };
  assert.equal(hash(run(p)), hash(run({ ...p, stochastic: true, branchAngle: 77,
    branchScale: 20, angleVariation: 90, lengthVariation: 80 })));
}

// Reveal uses the final placement and exact drawn length, independent of evaluation order.
for (const p of [{}, tree, forest, { preset: 'Lightning' }]) {
  const mature = run(p);
  assert.deepEqual(run({ ...p, growth: 0 }), EMPTY);
  for (const growth of [12, 50, 86, 33, 100]) {
    const v = run({ ...p, growth });
    assert.ok(Math.abs(length(v) / length(mature) - growth / 100) < 1e-7);
    assert.equal(hash(v), hash(run({ ...p, growth })));
    if (v.paths.length) assert.deepEqual(v.paths[0].pts[0], mature.paths[0].pts[0]);
  }
}
const halfwayForest = run({ ...forest, growth: 50 });
for (const g of guides) assert.ok(halfwayForest.paths.some(p => p.pts.every(([x, y]) => x >= g.x - 1e-7 && x <= g.x + g.w + 1e-7 && y >= g.y - 1e-7 && y <= g.y + g.h + 1e-7)), 'each plant grows');

for (const style of [
  { kind: 'style', mode: 'Dashed', dash: 2, gap: 2, vary: 0, phase: 0, seed: 9 },
  { kind: 'style', mode: 'Dots', dash: .1, gap: .1, vary: 0, phase: 0, seed: 9 },
]) assert.ok(points(run(forest, ctx, style)) <= 118000);
for (const context of [{ W: 297, H: 210 }, { W: 594, H: 420 }, { W: 50, H: 40 }]) run(tree, context);
for (const params of [{ margin: 60 }, { mode: 'Forest', count: 36, columns: 12, spacing: 40 }]) assert.deepEqual(N.compute([], { ...defaults, ...params }, { W: 100, H: 100 }), EMPTY);
for (const W of [0, NaN, Infinity, -20]) assert.deepEqual(N.compute([], defaults, { W, H: 210 }), EMPTY);
for (const preset of ['Custom', 'Lightning', 'Bush']) {
  const v = N.compute([], { ...defaults, preset, iter: Infinity, seed: NaN, angle: NaN, branchScale: Infinity, layer: 500 }, ctx);
  assert.ok(v.paths.every(p => p.layer === 11 && p.pts.every(q => q.every(Number.isFinite))));
}

const visible = (key, p) => { const d = N.params.find(d => d.key === key); return !d.showIf || !!d.showIf({ ...defaults, ...p }); };
assert.ok(!visible('continueWeight', {}) && visible('continueWeight', { stochastic: true }));
assert.ok(!visible('count', {}) && visible('count', { mode: 'Forest' }));
assert.ok(!visible('branchScale', { preset: 'Koch' }) && !visible('mode', { preset: 'Lightning' }));
assert.ok(!visible('axiom', {}) && visible('axiom', { preset: 'Custom' }));

if (process.argv.includes('--browser-dir')) {
  const dir = process.argv[process.argv.indexOf('--browser-dir') + 1];
  const patch = JSON.parse(fs.readFileSync(dir + '/forest.muusia.json'));
  const out = run(patch.root.nodes[0].params, patch.canvas);
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  const exporter = app.slice(app.indexOf('function toSVG(ps, ctx)'), app.indexOf('/* --- DXF R12 export'));
  const toSVG = Function('PENS', exporter + ';return toSVG;')(PENS);
  assert.equal(fs.readFileSync(dir + '/forest.svg', 'utf8'), toSVG(out, patch.canvas), 'real browser SVG exact');
  const code = fs.readFileSync(dir + '/forest.gcode', 'utf8');
  const moves = code.split('\n').filter(l => /^G[01] X/.test(l)).map(l => l.match(/^G[01] X([\d.-]+) Y([\d.-]+)/).slice(1).map(Number));
  assert.deepEqual(moves.pop(), [0, 0]);
  const expected = out.paths.flatMap(p => p.pts);
  assert.equal(moves.length, expected.length);
  for (let i = 0; i < moves.length; i++) for (let k = 0; k < 2; k++) assert.ok(Math.abs(moves[i][k] - expected[i][k]) <= .005001);
  console.log(`Real browser SVG/G-code: ${out.paths.length} paths, ${expected.length} points match; route off, origin 0, Flip Y off. No hardware.`);
  const { unzipSync, strFromU8 } = await import('fflate');
  const zip = unzipSync(fs.readFileSync(dir + '/fern-animation.zip'));
  assert.equal(Object.keys(zip).length, 48);
  const fern = JSON.parse(fs.readFileSync(dir + '/growing-fern.muusia.json'));
  const [frame, math, plant] = fern.root.nodes;
  // Use the actual Frame and Math nodes, then compare every browser-exported frame.
  for (let frameIdx = 0; frameIdx < 48; frameIdx++) {
    const clock = F.compute([], frame.params, { ...fern.canvas, frameIdx, frameCount: 48 });
    const growth = M.compute([clock[0]], math.params);
    const v = run({ ...plant.params, growth }, fern.canvas);
    const name = Object.keys(zip).find(k => k.endsWith(`-f${String(frameIdx).padStart(3, '0')}.svg`));
    assert.ok(name);
    assert.equal(strFromU8(zip[name]), toSVG(v, fern.canvas), 'real animation frame ' + frameIdx);
  }
  console.log('Real 48-frame SVG ZIP matches the Frame → Math ×100 → Growth graph, including empty first and complete last frame.');
}
console.log(`PASS: ${fixtures.length} original snapshots; ${cases} geometry cases, seeded productions, branch-length oracle, Forest cells/baselines, stable-framing Growth, styles, limits and conditional controls.`);
