import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as helpers from '../src/defs/helpers.js';

const baked = existsSync('src/defs/nodes/iris.js');
const def = baked ? (await import('../src/defs/nodes/iris.js')).default
  : new Function(...Object.keys(helpers), `return ${readFileSync('nodes-lab/iris.plotternode.js', 'utf8')}`)(...Object.values(helpers));
console.log(`${baked ? '[baked]' : '[lab]'} Iris — real helpers`);
const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const ctx = { W: 420, H: 297 };
const run = (p = {}, c = ctx, style) => def.compute([style], { ...defaults, ...p }, c);
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const count = r => r.paths.reduce((n, p) => n + p.pts.length, 0);
const insidePolygon = ([x,y], polygon) => {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if ((a[1]>y)!==(b[1]>y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
};
function valid(r, message) {
  check(count(r) <= 112000, `${message}: bounded point count`);
  check(r.paths.every(p => typeof p.closed === 'boolean' && p.pts.length >= (p.closed ? 3 : 2)), `${message}: valid polylines`);
  check(r.paths.every(p => Number.isInteger(p.layer) && p.layer >= 0 && p.layer < 12), `${message}: valid pen indices`);
  check(r.paths.every(p => p.pts.every(pt => pt.length === 2 && pt.every(Number.isFinite))), `${message}: finite coordinates`);
  check(r.paths.every(p => !p.closed || JSON.stringify(p.pts[0]) !== JSON.stringify(p.pts.at(-1))), `${message}: no duplicate closed endpoint`);
}
check(def.key === 'iris' && def.ins[0].type === 'style' && def.outs[0].type === 'paths', 'real pin contract');
check(new Set(def.params.map(p => p.key)).size === def.params.length, 'unique controls');
check(def.params.filter(p => p.type === 'select').every(p => p.options.includes(p.def)), 'select descriptors use options');
const baseline = run();
valid(baseline, 'defaults');
assert.deepEqual(run(), baseline); checks++;
check(JSON.stringify(run({ seed: 18 })) !== JSON.stringify(baseline), 'seed changes the drawing');
check(baseline.paths.length > 1000, 'fibres, pupil hatch and texture are present');
for (const species of ['Human', 'Cat', 'Goat', 'Gecko']) {
  const open = run({species,pupil:0.55,pupilFill:'Open',fibres:80,flow:1,texture:0});
  const polygon = open.paths.find(p=>p.closed).pts;
  check(open.paths.filter(p=>!p.closed).every(p=>p.pts.slice(1).every((pt,i)=>[0.25,0.5,0.75].every(t=>
    !insidePolygon([p.pts[i][0]+t*(pt[0]-p.pts[i][0]),p.pts[i][1]+t*(pt[1]-p.pts[i][1])],polygon)
  ))), `${species}: fibre segments leave the pupil empty even at maximum flow and pupil size`);
  for (const seed of [0, 17, -8]) {
    const p = { species, seed, pupilFill: 'Open' }, r = run(p);
    valid(r, `${species}/${seed}`);
    const outline = r.paths.find(p => p.closed), xs = outline.pts.map(p => p[0]), ys = outline.pts.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
    check(species === 'Human' ? Math.abs(width - height) < 1e-8 : species === 'Goat' ? width > 2 * height : height > 3 * width, `${species}: pupil silhouette`);
    const R = 277 / 2, hole = defaults.pupil * R;
    if (species === 'Human') check(r.paths.filter(q => !q.closed).every(q => q.pts.every(([x,y]) => Math.hypot(x-210, y-148.5) >= hole)), 'open human pupil stays empty');
  }
}
for (const c of [ctx, { W: 297, H: 420 }, { W: 210, H: 297 }, { W: 55, H: 80 }]) {
  const p = { diameter: 10000, cx: -200, cy: 900 }, r = run(p, c);
  valid(r, 'fit extremes');
  check(r.paths.every(q => q.pts.every(([x,y]) => x >= 10 - 1e-6 && y >= 10 - 1e-6 && x <= c.W - 10 + 1e-6 && y <= c.H - 10 + 1e-6)), 'fit mode obeys margin at off-centre extremes');
}
check(run({}, { W: 10, H: 10 }).paths.length === 0, 'too-small sheet returns empty');
const exact = def.overlay({ ...defaults, diameter: 420, sizing: 'Exact diameter' }, ctx)[0];
check(exact.r === 210, 'exact 420 mm diameter is not silently reduced');
const large = run({ diameter: 420 }, { W: 440, H: 440 });
valid(large, '420 mm iris');
check(def.overlay({ ...defaults, diameter: 420 }, { W: 440, H: 440 })[0].r === 210, '420 mm fits on 440 mm sheet');
const rays = run({ centre: 'Centre rays', texture: 0 });
check(rays.paths.length === defaults.fibres, 'centre rays has one path per fibre, no pupil');
check(rays.paths.every(p => Math.hypot(p.pts[0][0]-210, p.pts[0][1]-148.5) < 1e-8), 'every centre ray starts at centre');
assert.deepEqual(run({ centre: 'Centre rays', texture: 0, species: 'Gecko', pupil: 0.5, pupilFill: 'Open' }), rays); checks++;
const straight = run({ centre: 'Centre rays', texture: 0, flow: 0, fray: 0 });
check(straight.paths.every(p => p.pts.every(([x,y]) => Math.abs((x-210)*(p.pts.at(-1)[1]-148.5) - (y-148.5)*(p.pts.at(-1)[0]-210)) < 1e-7)), 'zero flow produces straight rays');
check(straight.paths.every(p => Math.abs(Math.hypot(p.pts.at(-1)[0]-210,p.pts.at(-1)[1]-148.5) - 138.5) < 1e-8), 'zero fray reaches exact radius');
const segments = r => r.paths.flatMap(p => p.pts.slice(1).map((pt,i) => JSON.stringify([p.pts[i],pt]))).sort();
for (const colours of ['Monochrome', 'Two pens', 'Three pens']) {
  const r = run({ colours, layer: 2, innerPen: 5, accentPen: 8 });
  valid(r, colours);
  const layers = [...new Set(r.paths.map(p => p.layer))].sort();
  assert.deepEqual(layers, colours === 'Monochrome' ? [2] : colours === 'Two pens' ? [2,5] : [2,5,8]); checks++;
  assert.deepEqual(segments(r), segments(baseline)); checks++;
}
for (const p of [
  { fibres: 1e9, texture: 1, diameter: 1200, sizing: 'Exact diameter', pupil: 0.55, hatchGap: 0 },
  { fibres: -20, flow: -2, fray: 5, layer: -8, innerPen: 999, colours: 'Three pens' },
  { fibres: NaN, diameter: Infinity, pupil: NaN, seed: NaN, margin: NaN, rotation: Infinity },
  { species: 'Gecko', fibres: 3000, texture: 1, pupil: 0.55, rotation: 180, colours: 'Three pens' },
]) valid(run(p), 'numeric wire extremes');
for (const [key,value] of Object.entries({ diameter: 200, pupil: 0.4, pupilFill: 'Open', hatchGap: 1.1, fibres: 500, flow: 0, texture: 0, fray: 1, rotation: 37, layer: 6 })) {
  check(JSON.stringify(run({ [key]: value })) !== JSON.stringify(baseline), `${key} changes output`);
}
const small = run({ diameter: 160, texture: 0 });
const moved = run({ diameter: 160, texture: 0, cx: 60 });
check(Math.abs(moved.paths[0].pts[0][0] - small.paths[0].pts[0][0] - 42) < 1e-8, 'centre X moves geometry in mm');
const inputStyle = { kind: 'style', mode: 'Dashed', dash: 3, gap: 2, vary: 0, phase: 0, seed: 1 };
const frozenStyle = JSON.stringify(inputStyle);
const styled = run({ fibres: 80, texture: 0 }, ctx, inputStyle);
check(JSON.stringify(styled) !== JSON.stringify(run({ fibres: 80, texture: 0 })), 'real Style input changes paths');
check(JSON.stringify(inputStyle) === frozenStyle, 'Style input is not mutated');
const times = [];
for (let i = 0; i < 5; i++) { const t = performance.now(); run(); times.push(performance.now() - t); }
console.log(`${checks} checks passed; ${baseline.paths.length} paths / ${count(baseline)} points; median ${times.sort((a,b)=>a-b)[2].toFixed(1)} ms`);
