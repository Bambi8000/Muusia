import assert from 'node:assert/strict';
import N from '../src/defs/nodes/barbed_wire.js';
import Grid from '../src/defs/nodes/grid.js';

const defaults = Object.fromEntries(N.params.map(q => [q.key, q.def]));
const ctx = { W: 210, H: 297 };
const source = { paths: [
  { pts: [[10, 80], [200, 80]], closed: false, layer: 3 },
  { pts: [[55, 140], [145, 140], [145, 230], [55, 230]], closed: true, layer: 7 },
] };
const run = (params = {}, input = source, canvas = ctx) => N.compute([input], { ...defaults, ...params }, canvas);
const count = r => r.paths.reduce((n, q) => n + q.pts.length, 0);
const hash = r => JSON.stringify(r);
let checks = 0;
const ok = (yes, why) => { assert.ok(yes, why); checks++; };
const sourceBefore = hash(source);

for (const mode of ['Star barbs', 'Twisted pair', 'Alternating thorns', 'Razor blades']) {
  const r = run({ mode });
  ok(r.paths.length > 15, `${mode}: wire and barbs drawn`);
  ok(r.paths.every(q => q.pts.length >= 2 && q.pts.every(pt => pt.every(Number.isFinite))), `${mode}: finite paths`);
  ok(r.paths.every(q => q.pts.every(([x, y]) => x >= 0 && x <= ctx.W && y >= 0 && y <= ctx.H)), `${mode}: clipped to paper`);
  ok(new Set(r.paths.map(q => q.layer)).size === 2 && r.paths.some(q => q.layer === 3) && r.paths.some(q => q.layer === 7), `${mode}: source pens inherited`);
  ok(hash(r) === hash(run({ mode })), `${mode}: deterministic`);
  ok(count(r) < 115000, `${mode}: bounded`);
}
ok(hash(source) === sourceBefore, 'source is unchanged');
ok(run({ mode: 'Twisted pair' }).paths.filter(q => q.layer === 3 && q.pts.length > 100).length === 2, 'twisted pair has two continuous rails on open line');
ok(run({ mode: 'Twisted pair' }).paths.filter(q => q.layer === 7 && q.closed && q.pts.length > 100).length === 2, 'closed source has two seamless closed rails');
ok(run().paths.filter(q => q.layer === 3 && q.pts.length > 100).length === 2, 'star barbs have two continuous rails');
ok(run().paths.filter(q => q.layer === 7 && q.closed && q.pts.length > 100).length === 2, 'star barbs have seamless closed rails');
ok(run().paths.length > run({ mode: 'Twisted pair' }).paths.length, 'star barbs add individual spikes and knots');
ok(run({ arms: 3 }).paths.length > run().paths.length, 'spikes per side adds arms');
ok(run({ mode: 'Alternating thorns' }).paths.filter(q => q.layer === 7 && q.closed).length === 1, 'single wire remains closed');
ok(run({ mode: 'Razor blades' }).paths.some(q => q.closed && q.pts.length === 4), 'razor blades are closed four-point forms');
ok(hash(run({ mode: 'Razor blades' })) !== hash(run({ mode: 'Alternating thorns' })), 'types differ');
ok(hash(run({ spacing: 20 })) !== hash(run()), 'spacing changes pattern');
ok(hash(run({ length: 9 })) !== hash(run()), 'barb length changes pattern');
ok(hash(run({ angle: -35 })) !== hash(run()), 'lean changes pattern');
ok(hash(run({ side: 'Left' })) !== hash(run()), 'sides change pattern');
ok(hash(run({ twist: 16 })) !== hash(run()), 'twist pitch changes rails');
ok(hash(run({ gap: 3 })) !== hash(run()), 'strand gap changes rails');
ok(hash(run({ mode: 'Razor blades', blade: 5 })) !== hash(run({ mode: 'Razor blades' })), 'blade width changes blades');
ok(hash(run({ vary: 0 })) === hash(run({ vary: 0, seed: 99 })), 'seed has no geometric effect at zero variation');
ok(hash(run({ vary: 1 })) !== hash(run({ vary: 1, seed: 99 })), 'seed changes varied barbs');
ok(run({ inherit: false, layer: 5 }).paths.every(q => q.layer === 5), 'chosen pen overrides source pens');
ok(run({}, { paths: [] }).paths.length === 0, 'empty input stays empty');
ok(run({}, { paths: [{ pts: [[1, 1], [NaN, 2]], layer: 1 }] }).paths.length === 0, 'invalid geometry ignored');
const edge = run({ length: 15, spacing: 8 }, { paths: [{ pts: [[2, 2], [208, 2]], layer: 1 }] });
ok(edge.paths.every(q => q.pts.every(([x, y]) => x >= 0 && x <= 210 && y >= 0 && y <= 297)), 'barbs clipped exactly at sheet edge');
const gridParams = Object.fromEntries(Grid.params.map(q => [q.key, q.def]));
const grid = Grid.compute([], { ...gridParams, vlines: 0, hlines: 4 }, ctx);
ok(run({}, grid).paths.length > grid.paths.length, 'real Grid output converts to barbed wire');
for (const key of ['gap', 'twist', 'arms', 'blade', 'layer', 'margin']) {
  const q = N.params.find(x => x.key === key);
  ok(typeof q.showIf === 'function', `${key} is conditional`);
}
console.log(`${checks} Barbed Wire checks passed`);
