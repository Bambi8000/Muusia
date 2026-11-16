/* Full-disc geometry, continuity, paper retracing, and real exporter checks.
   node tools/validate-double_pendulum-disc.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseAst } from 'rolldown/parseAst';
import { createHash } from 'node:crypto';
import N from '../src/defs/nodes/double_pendulum.js';
import { fullDiscFrame } from '../src/defs/double-pendulum-disc.js';
import { PENS, pathLength, applyStyle } from '../src/defs/helpers.js';
import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, needleExportError } from '../src/machine.js';
const defaults = Object.fromEntries(N.params.map(p => [p.key, p.def]));
const ctx = { W: 210, H: 297 };
const run = (over = {}, context = ctx, style) => N.compute([style], { ...defaults, motion: 'Full disc', ...over }, context);
const hash = r => createHash('sha256').update(JSON.stringify(r)).digest('hex');
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
function valid(result, over = {}, context = ctx) {
  const p = { ...defaults, ...over }, frame = fullDiscFrame(p, context);
  ok(result.paths.length === 1, 'one continuous stroke');
  const path = result.paths[0];
  ok(path.closed === false && path.pts.length > 1 && path.pts.length <= 112000, 'open, bounded route');
  ok(Number.isInteger(path.layer) && path.layer >= 0 && path.layer < PENS.length, 'valid single pen');
  ok(path.pts.every(q => q.length === 2 && q.every(Number.isFinite)), 'finite 2D points');
  ok(path.pts.every(([x, y]) => Math.hypot(x - frame.x, y - frame.y) <= frame.radius + 1e-7), 'complete route stays in the circular guide');
  ok(path.pts.every((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-7), 'no zero-length segments');
  if (p.fitCanvas !== false) ok(path.pts.every(([x, y]) => x >= 0 && x <= context.W && y >= 0 && y <= context.H), 'all ink inside paper');
}
const start = performance.now(), base = run(); valid(base);
ok(hash(base) === hash(run()), 'deterministic route');
ok(defaults.motion === 'Gravity', 'original default preserved');
ok(hash(N.compute([], { ...defaults, motion: undefined }, ctx)) === hash(N.compute([], defaults, ctx)), 'missing mode keeps original gravity behavior');
const frame = fullDiscFrame(defaults, ctx), points = base.paths[0].pts;
const sectors = new Set(points.filter(q => Math.hypot(q[0] - frame.x, q[1] - frame.y) > frame.radius * .7).map(q => Math.floor((Math.atan2(q[1] - frame.y, q[0] - frame.x) + Math.PI) / (Math.PI * 2) * 16) % 16));
ok(sectors.size === 16, 'outer drawing reaches every angular sector, including the upper half');
const occupied = new Set(points.map(q => [Math.floor((q[0] - frame.x + frame.radius) / (frame.radius / 8)), Math.floor((q[1] - frame.y + frame.radius) / (frame.radius / 8))].join(',')));
ok(occupied.size > 150, 'route visits the disc interior rather than only a circumference');
const minRadius = (result, p) => Math.min(...result.paths[0].pts.map(q => Math.hypot(q[0] - p.x, q[1] - p.y)));
ok(minRadius(base, frame) < frame.radius * .02, 'centre is reached');
const unequal = { l1: 70, l2: 25 }, uf = fullDiscFrame({ ...defaults, ...unequal }, ctx);
const filled = run(unequal), hollow = run({ ...unequal, fillCentre: false });
valid(filled, unequal); valid(hollow, unequal);
ok(minRadius(filled, uf) < uf.radius * .03, 'unequal arm lengths can still fill the centre');
ok(minRadius(hollow, uf) > uf.radius * .3, 'disabling centre fill preserves the unequal-arm hole');
for (const over of [{ time: 120 }, { lineGap: .2 }, { lineGap: 3 }, { detail: .3 }, { detail: 2 }, { l1: 80, l2: 80, time: 120, detail: .3 }, { l1: 10, l2: 80 }, { grav: 3, m2: 5 }, { a1: 0, a2: 0, damp: .5 }, { layer: -1 }, { fitCanvas: false }, { noRetrace: false }, { cx: 0, cy: 0 }, { cx: 100, cy: 100 }]) valid(run(over), over);
for (const context of [{ W: 297, H: 210 }, { W: 841, H: 594 }, { W: 35, H: 45 }]) valid(run({}, context), {}, context);
for (const over of [{ l1: 60 }, { l2: 25 }, { m2: 3 }, { a1: 80 }, { a2: 70 }, { grav: 2 }, { damp: .2 }, { time: 5 }, { detail: 1.5 }, { cx: 40 }, { cy: 60 }, { lineGap: 1 }, { noRetrace: false }]) ok(hash(base) !== hash(run(over)), 'active control: ' + JSON.stringify(over));
ok(hash(base) === hash(run({ trace: 'Both', penEach: true })), 'full disc ignores hidden trace and per-pen controls');
for (const key of ['traces', 'perturb']) {
  const control = N.params.find(p => p.key === key);
  ok(!control.showIf || control.showIf({ ...defaults, motion: 'Full disc' }), key + ' visible in Full disc');
}
ok(hash(base) === hash(run({ traces: undefined })), 'older full-disc patches default to one run');
const dense2 = run({ traces: 2 }), dense4 = run({ traces: 4 }), dense8 = run({ traces: 8 });
valid(dense2, { traces: 2 }); valid(dense4, { traces: 4 }); valid(dense8, { traces: 8 });
const length = r => pathLength(r.paths[0].pts);
ok(length(dense2) > length(base) * 1.2, 'two runs produce materially more ink');
ok(length(dense4) > length(base) * 1.5, 'four runs visibly thicken the default drawing');
ok(length(dense4) >= length(dense2) && length(dense8) >= length(dense4), 'additional requested runs keep the accepted route until crowding or budget');
ok(hash(dense4) === hash(run({ traces: 4 })), 'multi-run route is deterministic');
ok(hash(dense4) !== hash(run({ traces: 4, perturb: 2 })), 'multi-run perturbation changes later motion');
ok(hash(dense4) === hash(run({ traces: 4, trace: 'Both', penEach: true })), 'many runs retain one pen and one connected path');
valid(run({ traces: 8, time: 120, l1: 80, l2: 80, detail: .3 }), { traces: 8, time: 120, l1: 80, l2: 80, detail: .3 });
valid(run({ traces: 8, noRetrace: false, time: 120, detail: .3 }), { traces: 8, noRetrace: false, time: 120, detail: .3 });
// Strong Bounce must actually move radially rather than only look noisy.
const bouncing = run({ bounce: 100, seed: 1, traces: 3 });
valid(bouncing, { bounce: 100, seed: 1, traces: 3 });
ok(hash(bouncing) === hash(run({ bounce: 100, seed: 1, traces: 3 })), 'seeded bouncing is repeatable');
ok(hash(bouncing) !== hash(run({ bounce: 100, seed: 2, traces: 3 })), 'Seed changes the bouncing route');
ok(hash(base) === hash(run({ bounce: undefined, seed: 99 })), 'missing Bounce retains old Full disc');
ok(hash(base) === hash(run({ bounce: 0, seed: 99 })), 'zero Bounce ignores Seed');
const bounceControl = N.params.find(p => p.key === 'bounce'), seedControl = N.params.find(p => p.key === 'seed');
ok(bounceControl.showIf({ motion: 'Full disc' }) && !bounceControl.showIf({ motion: 'Gravity' }), 'Bounce visible only in Full disc');
ok(seedControl.showIf({ motion: 'Full disc', bounce: 80 }) && !seedControl.showIf({ motion: 'Full disc', bounce: 0 }), 'Seed visible with bouncing');
function radialStats(result) {
  let radial = 0, distance = 0, excursions = 0, atRim = false;
  const ps = result.paths[0].pts;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1], b = ps[i], ra = Math.hypot(a[0] - frame.x, a[1] - frame.y), rb = Math.hypot(b[0] - frame.x, b[1] - frame.y);
    radial += Math.abs(rb - ra); distance += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (rb > frame.radius * .75) atRim = true;
    if (atRim && rb < frame.radius * .3) { excursions++; atRim = false; }
  }
  return { ratio: radial / distance, excursions };
}
const orbitRadial = radialStats(base), bounceRadial = radialStats(bouncing);
ok(bounceRadial.ratio > .65 && bounceRadial.ratio > orbitRadial.ratio * 2, 'strong bouncing has substantially more radial travel than orbiting');
ok(bounceRadial.excursions >= 12, 'repeated rim-to-centre flights');
ok(minRadius(bouncing, frame) < frame.radius * .03, 'bouncing reaches centre without a central hole');
for (const over of [{ bounce: 1 }, { bounce: 50 }, { bounce: 80 }, { bounce: 100, seed: 0 }, { bounce: 100, seed: 2 }, { bounce: 100, seed: -1 }, { bounce: 100, seed: 7 }, { bounce: 100, lineGap: 3 }, { bounce: 100, lineGap: .2 }, { bounce: 100, noRetrace: false }, { bounce: 100, traces: 8, time: 120, detail: .3 }]) valid(run(over), over);
const bounceHollow = { bounce: 100, ...unequal, fillCentre: false };
valid(run(bounceHollow), bounceHollow);
ok(minRadius(run(bounceHollow), uf) > uf.radius * .3, 'unequal-arm centre exclusion retained with bouncing');
const guides = N.overlay({ ...defaults, motion: 'Full disc' }, ctx);
ok(guides.filter(g => g.kind === 'circle').length === 1, 'only outer circle guide; no inner arm-circle guide');
ok(guides.some(g => g.kind === 'circle' && g.r === frame.radius), 'guide uses actual fitted circle');
// Independent fine spatial sampling, with unoriented tangent comparison:
// brief crossings are accepted, following an older line is measured as repeat.
function repeatRatio(result, gap) {
  const bins = new Map(), step = gap * .4, threshold2 = (gap * .7) ** 2, cos = Math.cos(Math.PI / 10);
  let arc = 0, hits = 0, total = 0;
  const pts = result.paths[0].pts;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / length, uy = (b[1] - a[1]) / length;
    const n = Math.max(1, Math.ceil(length / step));
    for (let k = 1; k <= n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, at = arc + length * k / n;
      const cx = Math.floor(x / gap), cy = Math.floor(y / gap); let repeat = false;
      for (let dy = -1; dy <= 1 && !repeat; dy++) for (let dx = -1; dx <= 1 && !repeat; dx++) for (const q of bins.get((cx + dx) + ',' + (cy + dy)) || []) {
        if (at - q.arc <= gap * 4 || Math.abs(ux * q.ux + uy * q.uy) < cos) continue;
        if ((x - q.x) ** 2 + (y - q.y) ** 2 < threshold2) { repeat = true; break; }
      }
      total += length / n; if (repeat) hits += length / n;
      const key = cx + ',' + cy; if (!bins.has(key)) bins.set(key, []); bins.get(key).push({ x, y, ux, uy, arc: at });
    }
    arc += length;
  }
  return hits / total;
}
const raw = run({ noRetrace: false }), rawRepeat = repeatRatio(raw, .6), safeRepeat = repeatRatio(base, .6);
ok(safeRepeat < rawRepeat * .35, 'protection substantially reduces measured near-parallel retracing');
const denseRepeat = repeatRatio(dense4, .6);
ok(denseRepeat < .01, 'all additional runs share the prior-ink check');
const bounceRepeat = repeatRatio(bouncing, .6);
ok(bounceRepeat < .01, 'bouncing flights and their detours respect older near-parallel ink');
const style = { kind: 'style', mode: 'Dashed', dash: 4, gap: 2, vary: 0, seed: 1 };
ok(hash(run({}, ctx, style)) === hash(applyStyle(base, style)), 'Style contract retained');
const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), ast = parseAst(source, { lang: 'jsx' });
const fn = name => { const n = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); return source.slice(n.start, n.end); };
const svg = new Function('PENS', fn('toSVG') + ';return toSVG;')(PENS)(bouncing, ctx);
ok((svg.match(/<path /g) || []).length === 1, 'actual SVG exporter writes one path');
const exportGcode = new Function('PENS', 'pathLength', 'needleExportError', 'APP_VERSION', fn('toGcode') + ';return toGcode;')(PENS, pathLength, needleExportError, 'test');
for (const profile of [DEFAULT_MACHINE, DEFAULT_MACHINE_B]) {
  const code = exportGcode(bouncing, ctx, { ...profile, workW: 400, workH: 400 }), lines = code.split('\n');
  const down = profile.zMode === 'servo' ? l => l.includes(`ANGLE=${profile.servoDown} ; pen down`) : l => l === `G1 Z${profile.penDown} F${profile.zFeed}`;
  ok(lines.filter(down).length === 1, profile.zMode + ': lowers once');
  const tail = lines.slice(lines.findIndex(down) + 1), lift = tail.findIndex(l => profile.zMode === 'servo' ? l.startsWith('SET_SERVO') : /^G1 Z/.test(l));
  ok(tail.slice(0, lift).filter(l => /^G1 X/.test(l)).length === bouncing.paths[0].pts.length - 1, profile.zMode + ': every segment is drawn before any lift');
  ok(!tail.slice(0, lift).some(l => /^G0|^M0|^SET_SERVO|^G1 Z/.test(l)), profile.zMode + ': no travel, pauses or lifts inside drawing');
  ok(!code.includes('OUT OF BOUNDS'), profile.zMode + ': fitted page matches illustrative test work area');
}
console.log(`${checks} Full disc checks passed; ${points.length} points; measured near-retrace ${(rawRepeat * 100).toFixed(2)}% → ${(safeRepeat * 100).toFixed(2)}%; dense four-run ${dense4.paths[0].pts.length} points / ${(length(dense4) / 1000).toFixed(2)} m / repeat ${(denseRepeat * 100).toFixed(2)}%; bounce radial ${bounceRadial.ratio.toFixed(2)} / ${bounceRadial.excursions} rim-centre flights / repeat ${(bounceRepeat * 100).toFixed(2)}%; ${Math.round(performance.now() - start)} ms`);
