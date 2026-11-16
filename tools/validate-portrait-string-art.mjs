/* Portrait String art: geometry, continuous route, tonal fidelity and compatibility.
   Run: node tools/validate-portrait-string-art.mjs. No browser, ML or network. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { parseAst } from 'rolldown/parseAst';
import N from '../src/defs/nodes/portrait.js';
import { applyStyle, PENS, pathLength } from '../src/defs/helpers.js';
import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, needleExportError } from '../src/machine.js';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const defaults = Object.fromEntries(N.params.map(p => [p.key, p.def]));
const ctx = { W: 210, H: 297 };
const image = (fn, w = 96, h = 128) => ({ w, h, g: Array.from({ length: w * h }, (_, i) => fn(i % w, Math.floor(i / w), w, h)) });
const img = image((x, y, w, h) => {
  const ex = (x - w / 2) / (w * .35), ey = (y - h / 2) / (h * .43);
  if (ex * ex + ey * ey > 1) return 0;
  if (y < 30 || Math.abs(ex) > .75) return .9;
  if (y > 47 && y < 55 && Math.abs(ex) > .13 && Math.abs(ex) < .65) return .95;
  if (y > 80 && y < 86 && Math.abs(ex) < .45) return .85;
  return .22 + .18 * (x / w);
});
const run = (over = {}, im = img, context = ctx, style, analysis) => N.compute([style], { ...defaults, mode: 'String art', ...over }, context, { data: { img: im, analysis } });
const hash = r => createHash('sha256').update(JSON.stringify(r)).digest('hex');
function valid(r, count = defaults.stringNails, context = ctx, margin = 12, limit = defaults.stringLines) {
  ok(r.paths.length === 1, 'one continuous path');
  const path = r.paths[0], r0 = Math.min(context.W, context.H) / 2 - margin;
  ok(path.closed === false && Number.isInteger(path.layer) && path.layer >= 0 && path.layer < 12, 'open path with valid pen');
  ok(path.pts.length > 2 && path.pts.length <= limit + 1, 'bounded thread count');
  ok(path.pts.every(q => q.length === 2 && q.every(Number.isFinite)), 'finite points');
  ok(path.pts.every(([x, y]) => Math.abs(Math.hypot(x - context.W / 2, y - context.H / 2) - r0) < 1e-8), 'every endpoint on the circle');
  ok(path.pts.every(([x, y]) => {
    const index = (Math.atan2(y - context.H / 2, x - context.W / 2) + Math.PI / 2) * count / (Math.PI * 2);
    return Math.abs(index - Math.round(index)) < 1e-8;
  }), 'every endpoint on a discrete nail');
  ok(path.pts.every((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-8), 'no zero-length chords');
}
const photoFixture = JSON.parse(fs.readFileSync(new URL('../fixtures/portrait-string-art-tone.json', import.meta.url)));
const photo = { w: photoFixture.w, h: photoFixture.h, g: Array.from(Buffer.from(photoFixture.darknessBase64, 'base64'), v => v / 255) };
const portraitPhoto = run({}, photo);
valid(portraitPhoto);
ok(portraitPhoto.paths[0].pts.length > 2000, 'real portrait fixture retains thousands of fine chords');
const start = performance.now(), base = run();
valid(base);
ok(base.paths[0].pts.length > 2500, 'thin thread builds thousands of chords rather than stopping after a few hundred');
ok(base.paths[0].strokeWidth === defaults.stringWidth, 'thread width attached to continuous path');
ok(run({stringWidth:.07}).paths[0].pts.length < base.paths[0].pts.length, 'wider threads need fewer chords');
ok(hash(base) === hash(run()), 'deterministic');
ok(hash(base) !== hash(run({ seed: 78 })), 'seed changes route');
ok(hash(base) === hash(run({}, img, ctx, undefined, { v: 999, faces: 'invalid' })), 'independent of face analysis');
for (const count of [24, 60, 120, 300, 400]) valid(run({ stringNails: count }), count);
for (const context of [{ W: 297, H: 210 }, { W: 841, H: 594 }, { W: 45, H: 60 }]) valid(run({}, img, context), defaults.stringNails, context);
for (const im of [image(() => .9, 2, 2), image(() => .8, 180, 20), image(() => .8, 20, 180)]) valid(run({}, im));
valid(run({ stringNails: 2 }), 24);
valid(run({ stringNails: 999 }), 400);
valid(run({ stringNails: 400, stringLines: 999999, detail: 1, stringWidth: .02, ink: .2 }), 400, ctx, 12, 20000);
ok(run({}, null).paths.length === 0, 'missing image empty');
ok(run({}, image(() => 0)).paths.length === 0, 'white image empty');
ok(run({ cutoff: .8 }, image(() => .6)).paths.length === 0, 'cutoff suppresses tone');
ok(run({ margin: 60 }, img, { W: 80, H: 100 }).paths.length === 0, 'empty margin box');
// Changes outside the circular crop must not influence the output.
const cropped = image((x, y, w, h) => {
  const dx = x - w / 2, dy = y - h / 2;
  return Math.hypot(dx, dy) > w / 2 + 3 ? 1 : img.g[y * w + x];
});
ok(hash(base) === hash(run({}, cropped)), 'ignores image outside the centre circular crop');
const short = run({ stringLines: 100, ink: .2 }), longer = run({ stringLines: 500, ink: .2 });
ok(short.paths[0].pts.length === 101, '100-line cap respected');
ok(longer.paths[0].pts.length > short.paths[0].pts.length, 'higher cap adds chords');
ok(JSON.stringify(short.paths[0].pts) === JSON.stringify(longer.paths[0].pts.slice(0, 101)), 'thread count reveals exact route prefix');
for (const over of [{ stringWidth: .02 }, { ink: .2 }, { quality: 1 }, { detail: 1 }, { gamma: 3 }, { focusBoost: 3 }, { cutoff: .3 }]) {
  const r = run(over); valid(r); ok(hash(r) !== hash(base), 'active control: ' + JSON.stringify(over));
}
ok(run({ layer: 7 }).paths.every(p => p.layer === 7), 'selected pen only');
ok(hash(run({ rounds: 8, penW: 2, hatch: 'Mix', penAssign: 'Same', economy: 0, nerve: 1, glassesOn: false })) === hash(base), 'hidden legacy controls have no effect');
const guides = N.overlay({ ...defaults, mode: 'String art', stringNails: 60 }, ctx, [], { data: { img } });
ok(guides.filter(g => g.kind === 'circle' && g.r === .45).length === 60, 'guide shows the exact nail count');
ok(!guides.some(g => g.kind === 'rect'), 'no misleading rectangular guide');
for (const key of ['stringNails', 'stringLines', 'stringWidth']) {
  const p = N.params.find(p => p.key === key);
  ok(p.showIf({ mode: 'String art' }) && !p.showIf({ mode: 'Tonal' }), 'mode-specific control: ' + key);
}
for (const key of ['rounds', 'hatch', 'penAssign', 'economy', 'nerve', 'glassesOn', 'penW', 'scribbleDensity']) ok(!N.params.find(p => p.key === key).showIf({ mode: 'String art' }), 'hide unused control: ' + key);
const style = { kind: 'style', mode: 'Dashed', dash: 4, gap: 2, vary: 0, phase: 0, seed: 1 };
ok(hash(run({}, img, ctx, style)) === hash({paths:applyStyle(base, style).paths.map(p=>({...p,strokeWidth:defaults.stringWidth}))}), 'Style contract');
// Independent segment sampling: dark half must receive more ink per unit area.
const bands = run({ stringNails: 200 }, image((x, y, w) => x < w / 2 ? .9 : .12));
let dark = 0, light = 0;
for (const path of bands.paths) for (let i = 1; i < path.pts.length; i++) {
  const a = path.pts[i - 1], b = path.pts[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let k = 0; k < 100; k++) {
    if (a[0] + (b[0] - a[0]) * (k + .5) / 100 < ctx.W / 2) dark += length / 100;
    else light += length / 100;
  }
}
ok(dark > light * 2, 'chords reproduce darkness rather than a uniform web');
// Exercise the actual app exporters: one pen-down for the entire thread.
const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parseAst(appSource, { lang: 'jsx' });
const fn = name => { const n = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); return appSource.slice(n.start, n.end); };
const gcode = new Function('needleExportError', 'PENS', 'pathLength', 'APP_VERSION', fn('toGcode') + '; return toGcode;')(needleExportError, PENS, pathLength, 'test');
const svg = new Function('PENS', fn('toSVG') + '; return toSVG;')(PENS)(base, ctx);
ok(svg.includes('stroke-width="'+defaults.stringWidth+'"'), 'SVG preserves physical thread width');
const invalidWidth = { paths: [{ ...base.paths[0], strokeWidth: NaN }] };
const makeSVG = new Function('PENS', fn('toSVG') + '; return toSVG;')(PENS);
ok(!makeSVG(invalidWidth, ctx).includes('NaN'), 'invalid optional width falls back to legacy appearance');
ok(makeSVG({paths:[{...base.paths[0],strokeWidth:99}]},ctx).includes('stroke-width="10"'), 'optional width is bounded');
ok((svg.match(/<path /g) || []).length === 1 && (svg.match(/d="M/g) || []).length === 1, 'SVG has one unbroken path');
for (const profile of [DEFAULT_MACHINE, DEFAULT_MACHINE_B]) {
  const code = gcode(base, ctx, { ...profile, workW: 330, workH: 330 });
  const lines = code.split('\n');
  const isDown = profile.zMode === 'servo' ? l => l.includes(`ANGLE=${profile.servoDown} ; pen down`) : l => l === `G1 Z${profile.penDown} F${profile.zFeed}`;
  ok(lines.filter(isDown).length === 1, profile.zMode + ': lowers exactly once');
  const drawing = lines.slice(lines.findIndex(isDown) + 1);
  const end = drawing.findIndex(l => profile.zMode === 'servo' ? l.startsWith('SET_SERVO') : /^G1 Z/.test(l));
  ok(end > 0, profile.zMode + ': final lift exists');
  ok(drawing.slice(0, end).filter(l => /^G1 X/.test(l)).length === base.paths[0].pts.length - 1, profile.zMode + ': all chords drawn before first lift');
  ok(!drawing.slice(0, end).some(l => /^G0|^SET_SERVO|^G1 Z|^M0/.test(l)), profile.zMode + ': no travel, lifts or pauses between chords');
}
// No old mode may change as a side effect of adding String art.
const legacyImage = image(x => x / 48 * .8, 48, 64);
const legacyHashes = {
  Tonal: 'b34de3fb8ee705f7878cb11786b15aba4058de14c51b9208283a4c231ada2cb9',
  'Features+tonal': 'b34de3fb8ee705f7878cb11786b15aba4058de14c51b9208283a4c231ada2cb9',
  'Features only': 'b34de3fb8ee705f7878cb11786b15aba4058de14c51b9208283a4c231ada2cb9',
  'One line': '4ce95370e221ea0a3ef42ee0992d28ac44cbae9b311b7e310061d35b819bb093',
  Scribble: '7c51ab8453213db39d4231db18f23c119bbb36bce9a2c311ea570bd662d8efc6',
  Spiral: 'f30d8edd65bc3175d91511b3633e7254cd20b0b3c66eaf4b647809bf59ba5ace',
  TSP: '52fd0dc46041800f6349f43ff8757a0f5e607994545cc8481dce2033cbbf27da',
};
for (const [mode, expected] of Object.entries(legacyHashes)) ok(hash(run({ mode }, legacyImage)) === expected, 'unchanged legacy geometry: ' + mode);
ok(defaults.mode === 'Tonal', 'existing default preserved');
console.log(`${checks} Portrait String art checks passed; ${base.paths[0].pts.length - 1} chords, shadow/light ${(dark / light).toFixed(1)}×; ${Math.round(performance.now() - start)} ms`);
