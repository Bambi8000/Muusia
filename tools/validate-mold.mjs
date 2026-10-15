import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as helpers from '../src/defs/helpers.js';
import { EXAMPLES } from '../src/examples.js';

const lab = process.argv.includes('--lab');
const N = lab
  ? Function(...Object.keys(helpers), 'return ' + fs.readFileSync('nodes-lab/mold.plotternode.js', 'utf8'))(...Object.values(helpers))
  : (await import(pathToFileURL(process.cwd() + '/src/defs/nodes/mold.js'))).default;
const base = Object.fromEntries(N.params.map(p => [p.key, p.def]));
const ctx = { W: 297, H: 210 };
const fingerprint = x => JSON.stringify(x);
const rounded = x => JSON.stringify(x, (_, v) => typeof v === 'number' ? Math.round(v * 1e8) / 1e8 : v);
const ink = o => o.paths.reduce((sum, pa) => sum + helpers.pathLength(pa.pts, pa.closed), 0);
let checks = 0;
function run(patch = {}, clock = {}, ins = []) {
  const p = { ...base, motion: 'Manual', growth: 100, ...patch }, c = { ...ctx, ...clock };
  const original = fingerprint({ p, c, ins });
  const result = N.compute(ins, p, c);
  assert.equal(fingerprint({ p, c, ins }), original, 'Do not mutate parameters, inputs or frame clock');
  assert.equal(fingerprint(result), fingerprint(N.compute(ins, p, c)), 'Repeatable frame evaluation');
  assert.ok(result.paths.reduce((n, pa) => n + pa.pts.length, 0) <= 95000, 'Bounded point budget');
  const margin = Math.max(0, Math.min(p.margin, Math.min(c.W, c.H) / 2));
  for (const pa of result.paths) {
    assert.ok(pa.pts.length >= 2);
    assert.ok(Number.isInteger(pa.layer) && pa.layer >= 0 && pa.layer <= 11);
    assert.equal(typeof pa.closed, 'boolean');
    for (const q of pa.pts) {
      assert.equal(q.length, 2); assert.ok(q.every(Number.isFinite));
      assert.ok(q[0] >= margin - 1e-8 && q[0] <= c.W - margin + 1e-8);
      assert.ok(q[1] >= margin - 1e-8 && q[1] <= c.H - margin + 1e-8);
    }
  }
  checks++; return result;
}
assert.equal(N.key, 'mold');
assert.deepEqual(N.ins.map(p => p.type), ['style']);
assert.deepEqual(N.outs.map(p => p.type), ['paths']);
for (const p of N.params) if (p.type === 'select') assert.ok(p.options.includes(p.def));
for (const mode of ['Mold', 'Mycelium']) {
  const full = run({ mode });
  assert.ok(full.paths.length > 50, mode + ' produces substantial geometry');
  assert.equal(run({ mode, growth: 0 }).paths.length, 0, 'Manual zero is empty');
  assert.notEqual(fingerprint(full), fingerprint(run({ mode, seed: 74 })), 'Seed changes the structure');
  assert.equal(fingerprint(run({ mode }, { frameIdx: 0, frameCount: 32 })), fingerprint(run({ mode }, { frameIdx: 31, frameCount: 32 })), 'Manual ignores clock');
  assert.equal(fingerprint(full), fingerprint(run({ mode, motion: 'Timeline' })), 'No clock shows mature drawing');
  assert.equal(fingerprint(full), fingerprint(run({ mode, motion: 'Timeline' }, { frameCount: 1, frameIdx: 0 })), 'One-frame output is mature');
  assert.equal(fingerprint(full), fingerprint(run({ mode, motion: 'Timeline' }, { frameCount: 32, frameIdx: 31 })), 'Last timeline frame is fully grown');
  for (const i of [0, 1, 13, 29, 4, 31, 0]) {
    const a = run({ mode, motion: 'Timeline', growth: 7 }, { frameCount: 32, frameIdx: i });
    const b = run({ mode, growth: (0.025 + 0.975 * i / 31) * 100 });
    assert.equal(rounded(a), rounded(b), 'Timeline equals explicit manual progress during out-of-order scrubbing');
  }
  for (const size of [{ W: 420, H: 594 }, { W: 594, H: 420 }, { W: 32, H: 25 }, { W: 4, H: 4 }])
    for (const growth of [2, 40, 100]) run({ mode, growth, margin: size.W < 100 ? 1 : 25 }, size);
  for (const seed of [0, -3, 419]) for (const placement of ['Center', 'Scattered']) run({ mode, seed, placement, colonies: 12 });
  assert.equal(run({ mode, margin: 60 }, { W: 100, H: 90 }).paths.length, 0, 'Collapsed drawing area is empty');
  for (const patch of [{ colonies: 1, spread: 5 }, { colonies: 12, spread: 300 }, { colonies: 1, placement: 'Center' }, { layer: 11 }]) run({ mode, ...patch });
}
// An analytic circle is an independent oracle for contour placement and closure.
for (const growth of [20, 50, 100]) {
  const p = { ...base, colonies: 1, placement: 'Center', spread: 60, roughness: 0, spores: false, rings: false };
  const guide = N.overlay(p, ctx)[1], o = run({ ...p, motion: 'Manual', growth });
  assert.equal(o.paths.length, 1); assert.equal(o.paths[0].closed, true);
  for (const q of o.paths[0].pts) assert.ok(Math.abs(Math.hypot(q[0] - guide.cx, q[1] - guide.cy) - guide.r * growth / 100) < 0.07, 'Marching front matches true circle');
}
// All mature geometry must stay inside the exact seeded circle guides.
for (const mode of ['Mold', 'Mycelium']) for (const placement of ['Center', 'Scattered']) {
  const p = { ...base, mode, placement, roughness: 1 }, guides = N.overlay(p, ctx).slice(1), o = run(p);
  for (const pa of o.paths) for (const q of pa.pts) assert.ok(guides.some(s => Math.hypot(q[0] - s.cx, q[1] - s.cy) <= s.r + 0.08), 'Guides match sampled roots and maximum extents');
}
// Existing hyphae retain every old segment at all later times (no frame-wise RNG or refit).
let previous = new Set(), previousInk = 0;
for (const growth of [5, 10, 25, 50, 75, 100]) {
  const o = run({ mode: 'Mycelium', growth }), fullSegments = new Set();
  for (const pa of o.paths) for (let i = 1; i < pa.pts.length - 1; i++) fullSegments.add(fingerprint([pa.pts[i - 1], pa.pts[i]]));
  const allSegments = new Set();
  for (const pa of o.paths) for (let i = 1; i < pa.pts.length; i++) allSegments.add(fingerprint([pa.pts[i - 1], pa.pts[i]]));
  for (const s of previous) assert.ok(allSegments.has(s), 'Every complete old segment is retained');
  assert.ok(ink(o) >= previousInk, 'Increasing growth never reduces hypha ink');
  previous = fullSegments; previousInk = ink(o);
}
// Mature spores never move; newly born spores can be added at other positions.
const centers = o => o.paths.filter(p => p.closed && p.pts.length === 9).map(p => p.pts.reduce((a, q) => [a[0] + q[0] / 9, a[1] + q[1] / 9], [0, 0]).map(x => x.toFixed(6)).join(','));
const early = new Set(centers(run({ growth: 30 }))), late = new Set(centers(run({ growth: 100 })));
assert.ok(early.size > 20 && late.size > early.size * 2);
for (const c of early) assert.ok(late.has(c), 'Spore positions persist through growth');
const myc = run({ mode: 'Mycelium' });
assert.equal(fingerprint(myc), fingerprint(run({ mode: 'Mycelium', roughness: 0, rings: false, bands: 8, spores: false, density: 1, sporeSize: 2 })), 'Mold controls are inactive in Mycelium');
assert.equal(fingerprint(run()), fingerprint(run({ branching: 25, spacing: 5, meander: 0 })), 'Mycelium controls are inactive in Mold');
for (const [key, value] of [['roughness', 0], ['rings', false], ['bands', 8], ['spores', false], ['density', 5], ['sporeSize', 1.5], ['spread', 40], ['colonies', 1]]) assert.notEqual(fingerprint(run()), fingerprint(run({ [key]: value })), key + ' has a visible effect');
for (const [key, value] of [['branching', 0], ['spacing', 3], ['meander', 0]]) assert.notEqual(fingerprint(myc), fingerprint(run({ mode: 'Mycelium', [key]: value })), key + ' affects hyphae');
const style = { kind: 'style', mode: 'Dashed', dash: 2, gap: 1, phase: 0, vary: 0, seed: 1 };
assert.equal(helpers.isStyle(style), true);
assert.notEqual(fingerprint(run({ mode: 'Mycelium' })), fingerprint(run({ mode: 'Mycelium' }, {}, [style])), 'Style wire is honored');
for (const p of N.params.filter(p => p.showIf)) {
  if (['roughness', 'rings', 'bands', 'spores', 'density', 'sporeSize'].includes(p.key)) assert.equal(p.showIf({ ...base, mode: 'Mycelium' }), false);
  if (['branching', 'spacing', 'meander'].includes(p.key)) assert.equal(p.showIf(base), false);
}
assert.equal(N.params.find(p => p.key === 'growth').showIf(base), false);
assert.equal(N.params.find(p => p.key === 'growth').showIf({ ...base, motion: 'Manual' }), true);
assert.equal(EXAMPLES.filter(e => e.name.startsWith('Mold ·')).length, 2);
for (const e of EXAMPLES.filter(e => e.name.startsWith('Mold ·'))) {
  const patch = e.make(() => base); assert.equal(patch.nodes[0].type, 'mold');
  run(patch.nodes[0].params, { ...e.canvas, frameCount: 32, frameIdx: 20 });
}
console.log(`Mold [${lab ? 'lab' : 'baked'}]: ${checks} growth/clock/geometry scenarios passed, plus stable-segment, spore, circle, mode-control and example invariants.`);
