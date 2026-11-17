import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseAst } from 'rolldown/parseAst';
import N from '../src/defs/nodes/drape.js';
import { flyingSurface } from '../src/defs/flying-cloth.js';
import * as H from '../src/defs/helpers.js';
import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, needleExportError } from '../src/machine.js';
import { defaults, examples, evaluate, customSources, toSVG, generate } from './preview-flying-cloth.mjs';

let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const hash = JSON.stringify, ctx = { W: 297, H: 210 };
const p0 = { ...defaults('drape'), physicsMode: 'Flying' };
const art = { paths: [
  { pts: [[25, 30], [272, 30], [272, 180], [25, 180]], closed: true, layer: 2 },
  { pts: [[0, 105], [297, 105]], closed: false, layer: 4 },
  ...Array.from({ length: 20 }, (_, i) => ({ pts: [[8, 10 + i * 10], [289, 10 + i * 10]], closed: false, layer: 1 })),
] };
const run = (over = {}, input = art, c = ctx, style) => N.compute([style, undefined, undefined, input], { ...p0, ...over }, c, {});
const pts = r => r.paths.reduce((n, q) => n + q.pts.length, 0);
const length = r => r.paths.reduce((n, q) => n + H.pathLength(q.pts, q.closed), 0);
function valid(r, c = ctx, m = 10, nonempty = true) {
  if (nonempty) ok(r.paths.length > 0, 'nonempty complete drawing');
  ok(pts(r) <= 118000, 'point budget');
  ok(r.paths.every(q => q.pts.length >= (q.closed ? 3 : 2) && typeof q.closed === 'boolean' && Number.isInteger(q.layer) && q.layer >= 0 && q.layer < 12), 'pen/path contract');
  ok(r.paths.every(q => q.pts.every(a => a.length === 2 && a.every(Number.isFinite) && a[0] >= m - 1e-6 && a[0] <= c.W - m + 1e-6 && a[1] >= m - 1e-6 && a[1] <= c.H - m + 1e-6)), 'finite bounded XY only');
  ok(r.paths.every(q => q.pts.every((a, i) => !i || Math.hypot(a[0] - q.pts[i - 1][0], a[1] - q.pts[i - 1][1]) > 1e-10)), 'no zero-length segments');
}
const base = run(); valid(base);
ok(hash(base) === hash(run()), 'deterministic');
ok(!run({}, null).paths.length, 'Artwork without input empty, no invented grid');
ok(run({ flightContent: 'Grid' }, null).paths.length > 0, 'explicit grid without art');
ok(run({ flightContent: 'Threads' }, null).paths.length < run({ flightContent: 'Grid' }, null).paths.length, 'one-family Threads');
for (const patch of [{ waveHeight: 30 }, { wavelength: 70 }, { waveDirection: 115 }, { twist: -160 }, { edgeCurl: -240 }, { yaw: 90 }, { pitch: 25 }, { persp: 0 }, { clothDensity: 12 }, { phase: 87 }, { margin: 25 }, { flightPin: 'Centre' }]) {
  const r = run(patch); valid(r, ctx, patch.margin ?? 10); ok(hash(r) !== hash(base), 'live setting ' + hash(patch));
}
ok(hash(run({ flightSpeed: 6 })) === hash(base), 'speed does not affect Manual');
ok(hash(run({ clothGravity: 0, damping: 80, wind: 100, pin: 'Left edge', shapes: 'Boxes', seed: 92 })) === hash(base), 'inactive physics settings ignored');
ok(new Set(base.paths.map(q => q.layer)).size === 3, 'artwork preserves three pens');
const snapshot = hash(art); run(); ok(snapshot === hash(art), 'input immutable');

// Rest geometry is independently known. Test each attachment over full cycles.
const anchors = {
  Corners: [[0, 0], [1, 0], [1, 1], [0, 1]],
  'Top edge': [[0, 0], [.3, 0], [1, 0]],
  'Left edge': [[0, 0], [0, .4], [0, 1]],
  Centre: [[.5, .5]],
};
for (const [flightPin, uv] of Object.entries(anchors)) for (const phase of [0, 37, 90, 180, 275, 360]) {
  const s = flyingSurface({ ...p0, flightPin, phase }, ctx);
  ok(uv.every(([u, v]) => { const q = s.world(u, v); return Math.hypot(q[0] - (u - .5), q[1] - (.5 - v) * s.aspect, q[2]) < 1e-12; }), 'fixed anchors ' + flightPin + '/' + phase);
}
for (const flightPin of ['Free', ...Object.keys(anchors)]) valid(run({ flightPin }));
ok(hash(run({ flightPin: 'Free', phase: 0 })) !== hash(run({ flightPin: 'Free', phase: 90 })), 'free sheet moves');

for (const flightSpeed of [0, 1, 2, 5, 8]) {
  const patch = { motion: 'Timeline', flightSpeed, phase: 123 };
  const frame = i => run(patch, art, { ...ctx, frameCount: 48, frameIdx: i });
  ok(hash(frame(0)) === hash(frame(48)), 'exact loop ' + flightSpeed);
  ok((hash(frame(0)) !== hash(frame(7))) === (flightSpeed !== 0), 'speed/freeze ' + flightSpeed);
  const seven = hash(frame(7)); frame(30); ok(seven === hash(frame(7)), 'scrubbing order independent');
  const scales = [0, 7, 18, 35, 48].map(frameIdx => flyingSurface({ ...p0, ...patch }, { ...ctx, frameIdx, frameCount: 48 }).scale);
  ok(scales.every(n => n === scales[0]), 'fixed framing over timeline');
}
ok(hash(run({ phase: 123 })) === hash(run({ phase: 483 })), 'exact manual wrap');
const flat = { waveHeight: 0, twist: 0, edgeCurl: 0, yaw: 0, pitch: 90, persp: 0 };
const flatOut = run(flat);
ok(hash(flatOut) === hash(run({ ...flat, hidden: false })), 'no self-erasure on flat sheet');
ok(flatOut.paths[0].closed && flatOut.paths[0].pts[0][1] < flatOut.paths[0].pts.at(-1)[1], 'unoccluded closure and upright text orientation');
ok(hash(run({ ...flat, phase: 90 })) === hash(flatOut), 'neutral deformation static');
const fold = { edgeCurl: 265, twist: -45, waveHeight: 10, wavelength: 100, phase: 130, yaw: 12, pitch: 35, persp: .25 };
ok(length(run(fold)) < length(run({ ...fold, hidden: false })) * .95, 'folds occlude real strokes');
valid(run(fold));

// Independent world-space ray/triangle intersections validate both visible and
// occluded tiny marks, without using the renderer's screen-space visibility code.
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const s = flyingSurface({ ...p0, ...fold }, ctx), yaw = fold.yaw * Math.PI / 180, el = fold.pitch * Math.PI / 180;
const camera = [Math.sin(yaw) * Math.cos(el), -Math.cos(yaw) * Math.cos(el), Math.sin(el)].map(v => v / s.perspective);
function behind(q) {
  const direction = sub(camera, q), { nx, ny, vertices } = s;
  const hit = (A, B, C) => {
    const e1 = sub(B, A), e2 = sub(C, A), h = cross(direction, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const delta = sub(q, A), u = dot(delta, h) / det;
    if (u < 0 || u > 1) return false;
    const c = cross(delta, e1), v = dot(direction, c) / det, t = dot(e2, c) / det;
    return v >= 0 && u + v <= 1 && t > 1e-5 && t < 1;
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * (nx + 1) + i;
    if (hit(vertices[k], vertices[k + 1], vertices[k + nx + 2]) || hit(vertices[k], vertices[k + nx + 2], vertices[k + nx + 1])) return true;
  }
  return false;
}
let back = 0, front = 0;
for (const u of [.04, .12, .3, .5, .7, .88, .96]) for (const v of [.22, .53, .78]) {
  const i = Math.floor(u * s.nx), j = Math.floor(v * s.ny), k = j * (s.nx + 1) + i;
  const uu = (i + 2 / 3) / s.nx, vv = (j + 1 / 3) / s.ny;
  const centre = s.vertices[k].map((v, a) => (v + s.vertices[k + 1][a] + s.vertices[k + s.nx + 2][a]) / 3);
  const hidden = behind(centre);
  const mark = { paths: [{ pts: [[uu * ctx.W, vv * ctx.H], [(uu + 1e-5) * ctx.W, vv * ctx.H]], closed: false, layer: 0 }] };
  const markResult = run(fold, mark);
  ok((markResult.paths.length === 0) === hidden, 'independent occlusion probe ' + uu + '/' + vv);
  if (hidden) back++; else front++;
}
ok(back > 0 && front > 0, 'occlusion probes cover front and back');

// Whole-canvas UV: reject outside strokes, clip crossing strokes, preserve pen.
const outside = { paths: [{ pts: [[-100, -10], [400, -10]], closed: false, layer: 2 }] };
ok(!run(flat, outside).paths.length, 'outside art does not collect along the rim');
const crossing = { paths: [{ pts: [[-100, 105], [400, 105]], closed: false, layer: 8 }] };
const clipped = run(flat, crossing); valid(clipped);
const sf = flyingSurface({ ...p0, ...flat }, ctx);
ok(Math.hypot(...clipped.paths[0].pts[0].map((v, k) => v - sf.surface(0, .5)[k])) < 1e-8, 'crossing clips at u=0');
ok(clipped.paths.every(q => q.layer === 8), 'clipped source pen retained');
for (const invalid of [{ paths: null }, { paths: [{ pts: [[NaN, 0], [1, 1]] }] }, { paths: [{ pts: [[0, 0], [1e308, 0]] }] }, { paths: [{ pts: [[1, 1]] }] }, { paths: Array(12001).fill(art.paths[0]) }]) ok(!run({}, invalid).paths.length, 'invalid/dense input refused whole');
for (const c of [{ W: 0, H: 100 }, { W: NaN, H: 100 }, { W: 15, H: 15 }, {}]) ok(!run({}, art, c).paths.length, 'degenerate canvas empty');

for (const c of [{ W: 210, H: 297 }, { W: 420, H: 297 }, { W: 100, H: 600 }]) for (const phase of [0, 110, 270]) for (const perspective of [0, 1]) {
  const over = { ...fold, clothDensity: 45, waveHeight: 40, wavelength: 30, twist: 180, edgeCurl: -270, persp: perspective, phase, flightContent: 'Grid' };
  valid(run(over, null, c), c);
  const surface = flyingSurface({ ...p0, ...over }, c);
  ok(surface.vertices.map(surface.project).every(q => q[0] >= 10 - 1e-6 && q[0] <= c.W - 10 + 1e-6 && q[1] >= 10 - 1e-6 && q[1] <= c.H - 10 + 1e-6), 'conservative bound before any numerical clamp');
}
const dense = { paths: Array.from({ length: 3000 }, (_, i) => ({ pts: [[1, 1 + i % 200], [296, 1 + i % 200]], closed: false, layer: i % 3 })) };
const denseResult = run({ hidden: false }, dense); valid(denseResult);
ok(new Set(denseResult.paths.map(q => q.layer)).size === 3 && denseResult.paths.length === 3000, 'dense art coarsens uniformly without losing later strokes/pens');
valid(run({}, art, ctx, { kind: 'style', mode: 'Dashed', dash: 2, gap: 1, vary: 0, phase: 0, seed: 4 }));
const visible = p => N.params.filter(q => !q.showIf || q.showIf(p)).map(q => q.key);
ok(['waveHeight', 'wavelength', 'waveDirection', 'twist', 'edgeCurl', 'flightPin', 'phase'].every(k => visible(p0).includes(k)), 'Flying controls visible');
ok(!visible(p0).includes('clothGravity') && !visible(p0).includes('flightSpeed'), 'inactive controls hidden');
ok(visible({ ...p0, motion: 'Timeline' }).includes('flightSpeed'), 'timeline speed visible');
ok(!visible({ ...p0, physicsMode: 'Draped' }).includes('flightContent'), 'legacy controls separate');

// Existing solver outputs must remain EXACTLY the same as the actual parent.
const previous = execFileSync('git', ['show', '02288e3cfde73c80aecbcc69b52358be1a1c097e:src/defs/nodes/drape.js'], { encoding: 'utf8' });
const expr = previous.slice(previous.indexOf('export default ') + 15).trim().replace(/;$/, '');
const names = ['Pin', 'EMPTY', 'mulberry32', 'noise2', 'applyStyle', 'resample', 'pathLength'];
const old = new Function(...names, 'return (' + expr + ');')(...names.map(n => H[n]));
for (const mode of ['Draped', 'Hanging', 'Flag']) for (const over of [{}, { phase: 72, yaw: 90, hidden: false }, { clothContent: 'Artwork + grid', pin: 'Top corners', style: 'Weave' }]) {
  const p = { ...defaults('drape'), ...over, physicsMode: mode }, ins = [undefined, undefined, undefined, art];
  ok(hash(N.compute(ins, p, ctx, {})) === hash(old.compute(ins, p, ctx, {})), 'legacy byte parity ' + mode + '/' + hash(over));
}

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), ast = parseAst(app, { lang: 'jsx' });
const fn = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'toGcode');
const toGcode = new Function('PENS', 'pathLength', 'needleExportError', 'APP_VERSION', app.slice(fn.start, fn.end) + ';return toGcode;')(H.PENS, H.pathLength, needleExportError, 'test');
for (const ex of examples) {
  const { graph, result } = evaluate(ex); valid(result, ex.canvas);
  ok((toSVG(result, ex.canvas).match(/<path /g) || []).length === result.paths.length, 'actual SVG preserves all strokes');
  for (const prof of [DEFAULT_MACHINE, DEFAULT_MACHINE_B]) {
    const code = toGcode(result, ex.canvas, { ...prof, workW: 1000, workH: 1000 }), lines = code.split('\n');
    const down = prof.zMode === 'servo' ? l => l.includes(`ANGLE=${prof.servoDown} ; pen down`) : l => l === `G1 Z${prof.penDown} F${prof.zFeed}`;
    ok(lines.filter(down).length === result.paths.length, 'one lower per visible stroke');
    ok(lines.filter(l => /^G1 X/.test(l)).length === result.paths.reduce((n, q) => n + q.pts.length - (q.closed ? 0 : 1), 0), 'every draw move exported');
    ok(!code.includes('OUT OF BOUNDS'), 'no machine bounds warning');
  }
  ok(graph.edges[0].toPort === 3, 'artwork wired to fourth input');
}
const portable = new Function(...Object.keys(H), 'return ' + customSources()[0].source)(...Object.values(H));
ok(hash(portable.compute([undefined, undefined, undefined, art], p0, ctx, {})) === hash(base), 'self-contained portable definition parity');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flying-cloth-check-'));
try {
  ok(generate(dir, false).length === 3, 'three portable starters');
  const patch = JSON.parse(fs.readFileSync(path.join(dir, 'flying-cloth-1.muusia.json'), 'utf8'));
  ok(patch.customNodes.length === 2 && patch.customNodes[0].source.includes('renderFlyingCloth'), 'portable projects embed both new node definitions');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log(`Flying cloth: ${checks} checks passed; anchors, periodic framing, independent occlusion rays, UV clipping, budgets, legacy parity, portable projects and native SVG/G-code.`);
