import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EXAMPLES } from '../src/examples.js';
import { evaluate, generate } from './preview-word-shape.mjs';
import { parseAst } from 'rolldown/parseAst';
import N from '../src/defs/nodes/word_shape.js';
import { PENS, pathLength, applyStyle, Pin, EMPTY, SFONT } from '../src/defs/helpers.js';
import { DEFAULT_MACHINE, DEFAULT_MACHINE_B, needleExportError } from '../src/machine.js';
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const p = Object.fromEntries(N.params.map(q => [q.key, q.def])), ctx = { W: 210, H: 297 };
const run = (over = {}, input, canvas = ctx, style) => N.compute([input, style], { ...p, ...over }, canvas);
const layout = (over = {}, input, canvas = ctx) => N._layout({ ...p, ...over }, canvas, input);
const shape = (...rings) => ({ paths: rings.map(pts => ({ pts, closed: true, layer: 3 })) });
const rect = (a, b, c, d) => [[a, b], [c, b], [c, d], [a, d]];
const inside = (q, rings) => { let hit = false; for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < a[0] + (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1])) hit = !hit; } return hit; };
const hash = JSON.stringify;
function valid(r, over = {}, canvas = ctx, nonempty = true) {
  const params = { ...p, ...over }, pts = r.paths.flatMap(path => path.pts);
  if (nonempty) ok(r.paths.length > 0, 'nonempty drawing ' + hash(over));
  ok(pts.length <= 100000, 'point budget');
  ok(r.paths.every(path => typeof path.closed === 'boolean' && path.pts.length >= (path.closed ? 3 : 2) && path.layer === params.layer), 'real paths on selected pen');
  ok(pts.every(q => q.length === 2 && q.every(Number.isFinite) && q[0] >= params.margin - 1e-7 && q[0] <= canvas.W - params.margin + 1e-7 && q[1] >= params.margin - 1e-7 && q[1] <= canvas.H - params.margin + 1e-7), 'finite geometry within margin');
  ok(r.paths.filter(q => q.closed).every(q => hash(q.pts[0]) !== hash(q.pts.at(-1))), 'closed font loops have implicit closure');
  ok(r.paths.every(path => path.pts.every((q, i) => !i || Math.hypot(q[0] - path.pts[i - 1][0], q[1] - path.pts[i - 1][1]) > 1e-8)), 'no zero length drawing segments');
}
const base = run(); valid(base);
ok(hash(run()) === hash(base), 'pure deterministic default');
assert.deepEqual(layout().lines.map(l => l.text), ['ABRACADABRA', 'ABRACADABR', 'ABRACADAB', 'ABRACADA', 'ABRACAD', 'ABRACA', 'ABRAC', 'ABRA', 'ABR', 'AB', 'A']); checks++;
assert.deepEqual(layout({ shape: 'Triangle up' }).lines.map(l => l.text), [...layout().lines.map(l => l.text)].reverse()); checks++;
assert.deepEqual(layout({ shape: 'Diamond' }).lines.map(l => l.text.length), [1,2,3,4,5,6,7,8,9,10,11,10,9,8,7,6,5,4,3,2,1]); checks++;
assert.deepEqual(layout({ shape: 'Hourglass' }).lines.map(l => l.text.length), [11,10,9,8,7,6,5,4,3,2,1,2,3,4,5,6,7,8,9,10,11]); checks++;
ok(layout({ trim: 'Start' }).lines[1].text === 'BRACADABRA', 'remove leading letters');
ok(layout({ text: 'ABCDE', trim: 'Both sides' }).lines[2].text === 'BCD', 'remove both sides');
ok(layout({ shape: 'Heart' }).lines.filter(l => l.row === 0).length === 2, 'heart has two separate top lobes');
const variants = new Set();
for (const shape of N.params.find(p => p.key === 'shape').options) {
  const r = run({ shape }); valid(r, { shape }); variants.add(hash(r));
  for (const mode of ['Repeat text', 'Whole words']) {
    const over = { shape, mode, text: 'TYPE ART', autoRows: false, rows: 24, size: 5, tracking: 1.2, clearance: .3 };
    valid(run(over), over);
  }
}
ok(variants.size === 8, 'all eight preset silhouettes distinct');
for (const over of [{ text: 'SANAT MUODOSTAVAT' }, { font: 'Plotter' }, { width: 95 }, { height: 140 }, { autoRows: false, rows: 8 }, { size: 4 }, { tracking: 1.8 }, { lineSpacing: 2 }, { align: 'Left' }, { align: 'Right' }, { layer: 7 }, { clearance: 8 }]) {
  const r = run(over); valid(r, over); ok(hash(r) !== hash(base), 'live control ' + hash(over));
}
valid(run({ text: 'YÖ ÅÄÖ, Q?' }), { text: 'YÖ ÅÄÖ, Q?' });
ok(hash(run({ text: 'ä' })) === hash(run({ text: 'a\u0308' })), 'normalise composed accents');
ok(hash(run({ text: '❄' })) === hash(run({ text: '?' })), 'visible unsupported-character fallback');
const hollow = shape(rect(28, 35, 182, 262), rect(78, 95, 132, 205));
const concave = shape([[24,30],[186,30],[186,95],[100,95],[100,205],[186,205],[186,267],[24,267]]);
const islands = shape(rect(20,35,91,260),rect(119,35,190,260));
const overlapping = shape(rect(25,35,125,220),rect(85,85,185,265));
const tinyHole = shape(rect(25,35,185,265),rect(90,141,91,142));
const regionParams = { source: 'Wired shape', text: 'TYPE ART', mode: 'Repeat text', autoRows: false, rows: 34, size: 5, tracking: 1.15, lineSpacing: 1.2, clearance: 1, fit: true };
for (const input of [hollow, concave, islands, overlapping, tinyHole]) for (const placement of ['Inside', 'Outside']) {
  const over = { ...regionParams, placement }, r = run(over, input), L = layout(over, input); valid(r, over);
  const rings = input.paths.map(p => p.pts);
  for (const s of r.paths) for (let i = 1; i < s.pts.length; i++) for (const t of [0,.2,.4,.6,.8,1]) {
    const a = s.pts[i - 1], b = s.pts[i], q = [a[0] + (b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    assert.equal(inside(q, rings), placement === 'Inside', 'every segment remains in chosen region');
  }
  checks++;
  // Sample entire reserved glyph rectangles, independently of stroke geometry.
  for (const g of L.placements.filter(g => g.c !== ' ')) for (const u of [0,.25,.5,.75,1]) for (const v of [0,.25,.5,.75,1]) assert.equal(inside([g.x + u*g.w,g.y + v*g.h],rings), placement === 'Inside');
  checks++;
}
const words = layout({ ...regionParams, mode: 'Whole words', text: 'ONE TWO THREE' }, hollow);
ok(words.lines.length > 0 && words.lines.every(l => l.text.split(' ').every(w => ['ONE','TWO','THREE'].includes(w))), 'all words remain intact');
const untouched = hash(hollow); run(regionParams, hollow); ok(hash(hollow) === untouched, 'input geometry immutable');
ok(hash(run({ ...regionParams, source: 'Auto' }, hollow)) === hash(run(regionParams, hollow)), 'Auto uses incoming closed paths');
ok(hash(run({ source: 'Built-in' }, hollow)) === hash(base), 'explicit Built-in ignores input');
ok(hash(run({}, {paths:[]})) === hash(base), 'empty Auto uses preset');
for (const input of [undefined, {paths:[]}, {paths:[{closed:false,pts:[[20,20],[100,100]]}]}, shape([[0,0],[NaN,2],[10,10]])]) ok(!run({source:'Wired shape'},input).paths.length, 'invalid wired input empty');
for (const over of [{text:''},{text:'   '},{margin:200},{source:'Wired shape'},{text:'A'.repeat(241)},{fit:false,size:100},{autoRows:false,rows:160,mode:'Repeat text',fit:false,size:.2,tracking:1}]) ok(!run(over).paths.length,'empty/impossible/dense request refused whole '+hash(over));
for (const canvas of [{W:0,H:100},{W:NaN,H:100},{W:20,H:20}]) ok(!run({},null,canvas).paths.length,'invalid or too small page empty');
valid(run({autoRows:false,rows:1}),{autoRows:false,rows:1});
ok(layout({rows:88}).rows === 11,'hidden Rows inactive');
const style={kind:'style',mode:'Dashed',dash:2,gap:1,vary:0,seed:2};
ok(hash(run({},null,ctx,style))===hash(applyStyle(base,style)),'Style input applied last');
ok(N.overlay({ ...p,source:'Wired shape'},ctx,[hollow]).filter(g=>g.kind==='poly').length===2,'guides include hole');
ok(N.overlay(p,ctx).length===1,'stepped silhouette has fitting-box guide');
// The importable expression and built-in must compute the same result.
const source=fs.readFileSync(new URL('../src/defs/nodes/word_shape.js',import.meta.url),'utf8');
const defSource=source.split('export default ')[1].replace(/;\s*$/,'');
const imported=new Function('Pin','EMPTY','applyStyle','SFONT','return ('+defSource+');')(Pin,EMPTY,applyStyle,SFONT);
ok(hash(imported.compute([],p,ctx))===hash(base),'portable definition equals built-in');
// Export through the actual app functions, including all closed glyph loops.
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'), ast=parseAst(app,{lang:'jsx'});
const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return app.slice(n.start,n.end);};
const svg=new Function('PENS',fn('toSVG')+';return toSVG;')(PENS);
const gcode=new Function('PENS','pathLength','needleExportError','APP_VERSION',fn('toGcode')+';return toGcode;')(PENS,pathLength,needleExportError,'test');
for(const r of [base,run(regionParams,hollow),run({...regionParams,placement:'Outside'},hollow)]) {
  ok((svg(r,ctx).match(/<path /g)||[]).length===r.paths.length,'SVG preserves every stroke');
  for(const prof of [DEFAULT_MACHINE,DEFAULT_MACHINE_B]) {
    const code=gcode(r,ctx,{...prof,workW:400,workH:400}), lines=code.split('\n');
    const down=prof.zMode==='servo'?l=>l.includes(`ANGLE=${prof.servoDown} ; pen down`):l=>l===`G1 Z${prof.penDown} F${prof.zFeed}`;
    ok(lines.filter(down).length===r.paths.length,'one pen lower per stroke');
    ok(lines.filter(l=>/^G1 X/.test(l)).length===r.paths.reduce((n,p)=>n+p.pts.length-(p.closed?0:1),0),'all glyph segments exported');
    ok(!code.includes('OUT OF BOUNDS'),'machine bounds');
  }
}
for (const ex of EXAMPLES.filter(e => e.name.startsWith('Word Shape · '))) {
  const { graph, result } = evaluate(ex), last = graph.nodes.at(-1); valid(result, last.params, ex.canvas);
  ok((svg(result, ex.canvas).match(/<path /g) || []).length === result.paths.length, 'complete actual example export');
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'word-shape-'));
try {
  generate(temp);
  for (let i = 1; i <= 6; i++) {
    const project = JSON.parse(fs.readFileSync(path.join(temp, 'word-shape-' + i + '.muusia.json'), 'utf8'));
    ok(project.app === 'muusia' && project.v === 1 && project.root.nodes.at(-1).type === 'word_shape', 'native project envelope');
    ok(project.customNodes[0].source.includes('_layout'), 'portable project includes its node');
  }
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log('Word Shape: '+checks+' checks passed; exact ABRACADABRA rows, eight shapes, complete words, wired holes/concavity/islands/overlap, inside/outside and actual SVG/G-code.');
