/* Focused tests against built-in node, independent segment checks, and actual exporters. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parseAst } from 'rolldown/parseAst';
import N from '../src/defs/nodes/diffgrowth.js';
import L from '../src/defs/nodes/lettering.js';
import D from '../src/defs/nodes/drawn_path.js';
import { boundedLineGrowth, clearLineGrowthCache, lineGrowthRegion } from '../src/defs/line-growth.js';
import { PENS, pathLength, applyStyle } from '../src/defs/helpers.js';
import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, needleExportError } from '../src/machine.js';
import { EXAMPLES } from '../src/examples.js';
const defs = { diffgrowth: N, lettering: L, drawn_path: D };
const defaults = k => Object.fromEntries(defs[k].params.map(p => [p.key, p.def]));
const base = defaults('diffgrowth'), ctx = { W: 210, H: 210 };
const run = (over = {}, ins = [], c = ctx) => N.compute(ins, { ...base, mode: 'Bounded', ...over }, c);
const hash = r => createHash('sha256').update(JSON.stringify(r)).digest('hex');
let checks = 0;
const ok = (x, message) => { assert.ok(x, message); checks++; };
const shape = pts => ({ paths: [{ pts, closed: true, layer: 0 }] });
const circle = (x, y, r) => Array.from({ length: 80 }, (_, i) => [x + r * Math.cos(i * Math.PI / 40), y + r * Math.sin(i * Math.PI / 40)]);
const outer = circle(105, 105, 90), hole = circle(105, 105, 28), holed = { paths: [...shape(outer).paths, ...shape(hole).paths] };
const orientation = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function crosses(a, b, c, d) {
  return orientation(a, b, c) * orientation(a, b, d) < -1e-16 && orientation(c, d, a) * orientation(c, d, b) < -1e-16;
}
function inside(q, rings) {
  let hit = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[j], b = r[i];
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < a[0] + (q[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) hit = !hit;
  }
  return hit;
}
function geometry(result, over = {}, ins = [], c = ctx, count) {
  const p = { ...base, mode: 'Bounded', ...over }, rings = lineGrowthRegion(p, c, ins[1]);
  ok(result.paths.length > 0 && (count == null || result.paths.length === count), 'expected complete strands');
  ok(result.paths.reduce((n, q) => n + q.pts.length, 0) <= p.maxPoints, 'shared point budget');
  const edges = [];
  for (const [si, s] of result.paths.entries()) {
    ok(typeof s.closed === 'boolean' && s.pts.length >= (s.closed ? 3 : 2), 'valid open/closed path');
    ok(Number.isInteger(s.layer) && s.layer >= 0 && s.layer < PENS.length, 'valid pen');
    ok(s.pts.every(q => q.length === 2 && q.every(Number.isFinite)), 'finite 2D points');
    for (let i = 0; i < s.pts.length - (s.closed ? 0 : 1); i++) {
      const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length];
      assert(Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-8, 'no zero-length segment');
      for (const t of [.01, .25, .5, .75, .99]) assert(inside([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t], rings), 'whole segment in boundary / outside holes');
      for (const r of rings) for (let j = 0; j < r.length; j++) assert(!crosses(a, b, r[j], r[(j + 1) % r.length]), 'no boundary shortcut');
      edges.push({ a, b, si, i, count: s.pts.length, closed: s.closed, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) });
    }
  }
  edges.sort((a, b) => a.x0 - b.x0);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length && edges[j].x0 <= edges[i].x1; j++) {
    const a = edges[i], b = edges[j];
    if (a.si === b.si && (Math.abs(a.i - b.i) === 1 || a.closed && Math.abs(a.i - b.i) === a.count - 1)) continue;
    if (a.y0 > b.y1 || b.y0 > a.y1) continue;
    assert(!crosses(a.a, a.b, b.a, b.b), 'no self/cross-strand crossing');
  }
  checks += 3;
}
const start = performance.now();
const disc = run(); geometry(disc, {}, [], ctx, 1);
ok(disc.paths[0].closed, 'circle remains one closed stroke');
clearLineGrowthCache(); ok(hash(disc) === hash(run()), 'cold-run deterministic');
ok(base.mode === 'Classic', 'Classic remains default');
ok(hash(N.compute([], base, ctx)) === hash(N.compute([], { ...base, mode: undefined }, ctx)), 'legacy missing mode');
ok(hash(N.compute([], base, ctx)) === hash(N.compute([null, holed, shape([[10, 10], [80, 80], [80, 10]])], { ...base, growth: 0, spacing: .5 }, ctx)), 'Classic ignores new inputs/controls');
const grownHole = run({}, [null, holed]); geometry(grownHole, {}, [null, holed], ctx, 1);
for (const growth of [0, 13, 48, 82, 35]) {
  const over = { growth, steps: 700, maxPoints: 1200 };
  const cached = run(over, [null, holed]); clearLineGrowthCache();
  ok(hash(cached) === hash(run(over, [null, holed])), 'scrubbing matches a fresh run at ' + growth);
  geometry(cached, over, [null, holed]);
}
const quick = { steps: 600, maxPoints: 1000 }, qbase = run(quick);
for (const over of [{ growth: 20 }, { seed: 99 }, { chaos: .8 }, { spacing: 2.5 }, { startSize: 35 }, { start: 'Line' }, { boundary: 'Canvas' }, { maxPoints: 400 }]) {
  const p = { ...quick, ...over }, r = run(p); geometry(r, p);
  ok(hash(r) !== hash(qbase), 'live control ' + JSON.stringify(over));
}
const line = { paths: [{ pts: [[-20, 105], [230, 105]], closed: false, layer: 6 }] };
const clipped = run({ ...quick, growth: 0, start: 'Wired' }, [null, holed, line]); geometry(clipped, { ...quick, growth: 0, start: 'Wired' }, [null, holed, line], ctx, 2);
ok(clipped.paths.every(s => !s.closed), 'hole splits a starting line into two honest open strokes');
const clippedGrown = run(quick, [null, holed, line]); geometry(clippedGrown, quick, [null, holed, line], ctx, 2);
const multi = { paths: [ { pts: circle(55, 105, 9), closed: true, layer: 0 }, { pts: circle(150, 105, 9), closed: true, layer: 1 } ] };
const multiCopy = JSON.stringify(multi); geometry(run(quick, [null, null, multi]), quick, [null, null, multi], ctx, 2);
ok(JSON.stringify(multi) === multiCopy, 'wired geometry is never mutated');
for (const [over, ins] of [
  [{ boundary: 'Wired' }, []], [{ start: 'Wired' }, []], [{}, [null, shape([[0, 0], [2, 2], [0, 2], [2, 0]])]],
  [{}, [null, { paths: [{ pts: [[1, 1], [2, 2]], closed: false }] }]],
  [{}, [null, shape([[1, 1], [2, 2], [NaN, 1]])]],
  [{}, [null, null, { paths: [{ pts: [[50, 50], [150, 150], [50, 150], [150, 50]], closed: false }] }]],
  [{}, [null, null, { paths: [{ pts: [[50, 105], [150, 105], [100, 105]], closed: false }] }]],
  [{}, [null, null, { paths: [{ pts: [[50, 50], [150, 150]], closed: false }, { pts: [[50, 150], [150, 50]], closed: false }] }]],
  [{}, [null, shape([[0, 0], [1e6, 0], [1e6, .00001], [0, .00001]])]],
  [{}, [null, null, { paths: [{ pts: [], closed: false }] }]],
]) ok(run({ ...quick, ...over }, ins).paths.length === 0, 'invalid/unsupported start or boundary rejected');
for (const over of [{ spacing: .5, maxPoints: 400, steps: 2000 }, { spacing: 15, steps: 1000 }, { steps: 6000, maxPoints: 12000, spacing: 2 }, { layer: -1, ...quick }]) geometry(run(over), over);
for (const c of [{ W: 297, H: 210 }, { W: 70, H: 100 }, { W: 841, H: 594 }]) geometry(run(quick, [], c), quick, [], c);
const guides = N.overlay({ ...base, mode: 'Bounded' }, ctx, [null, holed]);
ok(guides.length === 2 && guides.every(g => g.kind === 'poly'), 'outer/inner boundary guides');
ok(N.overlay(base, ctx).length === 0, 'Classic guide behavior preserved');
const style = { kind: 'style', mode: 'Dashed', dash: 4, gap: 2, vary: 0, seed: 1 };
ok(hash(run(quick, [style])) === hash(applyStyle(run(quick), style)), 'Style is applied last');
const examples = [];
for (const ex of EXAMPLES.filter(e => e.name.startsWith('Differential Growth'))) {
  const graph = ex.make(defaults), outputs = new Map(), nodeIns = new Map();
  for (const n of graph.nodes) { const ins = []; for (const e of graph.edges.filter(e => e.to === n.id)) ins[e.toPort] = outputs.get(e.from); nodeIns.set(n.id, ins); outputs.set(n.id, defs[n.type].compute(ins, n.params, ex.canvas)); }
  const n = graph.nodes.at(-1), result = outputs.get(n.id); geometry(result, n.params, nodeIns.get(n.id), ex.canvas, 1); examples.push({ name: ex.name, paths: result.paths.length, points: result.paths[0].pts.length });
}
const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), ast = parseAst(source, { lang: 'jsx' });
const fn = name => { const n = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); return source.slice(n.start, n.end); };
const svg = new Function('PENS', fn('toSVG') + ';return toSVG;')(PENS)(grownHole, ctx);
ok((svg.match(/<path /g) || []).length === 1 && !svg.includes('<circle'), 'actual SVG has one final path, no guides/history');
const exportGcode = new Function('PENS', 'pathLength', 'needleExportError', 'APP_VERSION', fn('toGcode') + ';return toGcode;')(PENS, pathLength, needleExportError, 'test');
for (const profile of [DEFAULT_MACHINE, DEFAULT_MACHINE_B]) {
  const code = exportGcode(grownHole, ctx, { ...profile, workW: 400, workH: 400 }), lines = code.split('\n');
  const down = profile.zMode === 'servo' ? l => l.includes(`ANGLE=${profile.servoDown} ; pen down`) : l => l === `G1 Z${profile.penDown} F${profile.zFeed}`;
  ok(lines.filter(down).length === 1, profile.zMode + ': single lower');
  const tail = lines.slice(lines.findIndex(down) + 1), lift = tail.findIndex(l => profile.zMode === 'servo' ? l.startsWith('SET_SERVO') : /^G1 Z/.test(l));
  ok(tail.slice(0, lift).filter(l => /^G1 X/.test(l)).length === grownHole.paths[0].pts.length, profile.zMode + ': all segments including closure before lift');
  ok(!tail.slice(0, lift).some(l => /^G0|^M0|^SET_SERVO|^G1 Z/.test(l)), profile.zMode + ': no mid-stroke lift/travel');
  ok(!code.includes('OUT OF BOUNDS'), profile.zMode + ': bounds');
}
ok(typeof boundedLineGrowth === 'function', 'plain ESM helper');
console.log(JSON.stringify({ checks, examples, elapsedMs: Math.round(performance.now() - start) }, null, 2));
