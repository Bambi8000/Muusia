import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseAst } from 'rolldown/parseAst';
import { DEFAULT_NEEDLE_MACHINE as profile, DEFAULT_MACHINE, DEFAULT_MACHINE_B, needleExportError, normalizeMachine, writeMachineFile, readMachineFile } from '../src/machine.js';
import { PENS, pathLength } from '../src/defs/helpers.js';
import node from '../src/defs/nodes/needlepunch.js';
import needleTest from '../src/defs/nodes/needletest.js';

// Exercise the actual exporter, including every call site using this function.
const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parseAst(source, { lang: 'jsx' });
const fn = name => { const n = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); return source.slice(n.start, n.end); };
const exportJob = new Function('needleExportError', 'PENS', 'pathLength', 'APP_VERSION', fn('toGcode') + '; return toGcode;')(needleExportError, PENS, pathLength, 'test');
const jig = new Function(fn('jigGcode') + '; return jigGcode;')();
const ctx = { W: 100, H: 100 };
const punch = (depth, x = 10, y = 20, layer = 0) => ({ pts: [[x, y, depth], [x, y, depth]], layer, closed: false });
const ps = (...paths) => ({ paths });
const blocked = (paths, changes = {}) => {
  const result = exportJob(paths, ctx, { ...profile, ...changes });
  assert.ok(result.includes('export blocked'), result);
  assert.ok(result.trim().split('\n').every(l => l.startsWith(';')), 'Rejected files have no runnable commands');
};
for (const d of [2.001, 3, 6, 0, -1, NaN, Infinity, undefined, '2']) blocked(ps(punch(d)));
blocked(ps({ pts: [[10, 20], [30, 20]], layer: 0 }));
blocked(ps({ pts: [[10, 20, 1], [30, 20, 1]], layer: 0 }));
blocked(ps({ ...punch(1), __stop: { mode: 'Pause' } }));
blocked(ps(punch(1), punch(1, 20, 30, 1)));
for (const changes of [{ zMode: 'servo' }, { penDown: -1 }, { penUp: 1 }, { zHopOn: true }, { dipOn: true }, { rotOn: true }, { maintOn: true }, { canvasCheckOn: true }, { startG: 'G1 Z-3' }, { endG: 'PLOT_START' }, { zFeed: NaN }]) blocked(ps(punch(1)), changes);
blocked(ps(punch(1, NaN)));
blocked(ps(punch(1, 500)));
for (const depth of [0.5, 1, 2]) {
  const result = exportJob(ps(punch(depth), punch(depth, 40, 50)), ctx, profile);
  assert.ok(result.includes('NEEDLE_BEGIN'));
  assert.ok(!/SET_SERVO|PEN_DOWN|G28|PLOT_GO|PLOT_START/.test(result));
  assert.ok(result.includes(`G1 Z-${depth} F120`));
  let x = 0, y = 0, z = 3, plunges = 0;
  for (const line of result.split('\n')) {
    const code = line.split(';')[0].trim();
    if (!/^G[01]\s/.test(code)) continue;
    const word = key => { const m = code.match(new RegExp(`(?:^|\\s)${key}(-?[\\d.]+)`)); return m ? Number(m[1]) : undefined; };
    const nx = word('X') ?? x, ny = word('Y') ?? y, nz = word('Z') ?? z;
    if (nx !== x || ny !== y) assert.ok(z >= 3 && nz >= 3, 'All XY travel occurs with needle lifted');
    assert.ok(nz >= -2 && nz <= 3);
    if (nz < 0 && z >= 0) plunges++;
    [x, y, z] = [nx, ny, nz];
  }
  assert.equal(plunges, 2);
  assert.equal(z, 3);
}
// Generated node geometry, not just hand-crafted fixtures.
const params = Object.fromEntries(node.params.map(p => [p.key, p.def]));
const input = [{ paths: [{ pts: [[10, 10], [20, 10]], layer: 0 }] }];
assert.equal(params.depth, 0.5);
const geometry = node.compute(input, params, ctx);
assert.equal(needleExportError(geometry, profile), '');
blocked(node.compute(input, { ...params, depth: 3 }, ctx));
const normalized = normalizeMachine(profile).prof;
assert.deepEqual(readMachineFile(JSON.parse(writeMachineFile(normalized))).prof, normalized);
assert.equal(JSON.parse(writeMachineFile(profile)).minApp, '2.133');
assert.ok(jig([], profile, 100, 100, 'test').text.split('\n').filter(Boolean).every(l => l.startsWith(';')));
for (const legacy of [DEFAULT_MACHINE, DEFAULT_MACHINE_B]) {
  const result = exportJob(ps(punch(3)), ctx, legacy);
  assert.ok(!result.includes('export blocked'), 'Legacy brush jobs keep their existing depth behavior');
}
console.log('Needle export: all depth, lift, refusal, node and profile checks passed.');

// A full calibration sheet must retain every row's depth through the real exporter.
const testParams = Object.fromEntries(needleTest.params.map(p => [p.key, p.def]));
const sheetCtx = { W: 148, H: 148 };
const sheet = needleTest.compute([], { ...testParams, maxDepth: 2 }, sheetCtx);
const gcode = exportJob(sheet, sheetCtx, profile);
assert.ok(!gcode.includes('export blocked'));
const plunges = [...gcode.matchAll(/^G1 Z-([\d.]+) F120/gm)].map(m => +m[1]);
assert.equal(plunges.length, 500);
for (const depth of [.4, .8, 1.2, 1.6, 2]) assert.equal(plunges.filter(d => d === depth).length, 100);
assert.ok((gcode.match(/^G1 Z3(?:\s|$)/gm) || []).length >= 500);
let sheetZ = 3;
let sheetX = 0, sheetY = 0;
for (const line of gcode.split('\n')) {
  if (!/^G[01]\s/.test(line)) continue;
  const x = line.match(/(?:^|\s)X(-?[\d.]+)/), y = line.match(/(?:^|\s)Y(-?[\d.]+)/);
  const nx = x ? +x[1] : sheetX, ny = y ? +y[1] : sheetY;
  if (nx !== sheetX || ny !== sheetY) assert.equal(sheetZ, 3, 'Every sheet travel starts with a full lift');
  [sheetX, sheetY] = [nx, ny];
  const z = line.match(/(?:^|\s)Z(-?[\d.]+)/);
  if (z) sheetZ = +z[1];
}
assert.equal(sheetZ, 3);
console.log('Needle Test export: all 500 punches retain their depth and lift.');
