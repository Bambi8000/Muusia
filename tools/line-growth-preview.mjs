/* node tools/line-growth-preview.mjs [output-dir]
   Render real built-in Help graphs, with standalone plot SVGs and projects. */
import fs from 'node:fs';
import path from 'node:path';
import N from '../src/defs/nodes/diffgrowth.js';
import L from '../src/defs/nodes/lettering.js';
import D from '../src/defs/nodes/drawn_path.js';
import { EXAMPLES } from '../src/examples.js';
const defs = { diffgrowth: N, lettering: L, drawn_path: D };
const defaults = key => Object.fromEntries(defs[key].params.map(p => [p.key, p.def]));
const dir = path.resolve(process.argv[2] || '/tmp/muusia-bounded-growth');
fs.mkdirSync(dir, { recursive: true });
const cards = [], records = [];
for (const [i, ex] of EXAMPLES.filter(e => e.name.startsWith('Differential Growth')).entries()) {
  const graph = ex.make(defaults), outputs = new Map(), { W, H } = ex.canvas;
  for (const n of graph.nodes) {
    const ins = [];
    for (const e of graph.edges.filter(e => e.to === n.id)) ins[e.toPort] = outputs.get(e.from);
    outputs.set(n.id, defs[n.type].compute(ins, n.params, ex.canvas));
  }
  const result = outputs.get(graph.nodes.at(-1).id);
  if (!result.paths.length) throw new Error('Empty example: ' + ex.name);
  const strokes = result.paths.map(s => `<path fill="none" stroke="#24252a" stroke-width=".3" stroke-linejoin="round" stroke-linecap="round" d="M${s.pts.map(q => q.map(n => n.toFixed(9)).join(',')).join('L')}${s.closed ? 'Z' : ''}"/>`).join('');
  fs.writeFileSync(path.join(dir, `growth-${i + 1}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${strokes}</svg>`);
  fs.writeFileSync(path.join(dir, `growth-${i + 1}.muusia.json`), JSON.stringify({ app: 'muusia', v: 1, name: ex.name, canvas: ex.canvas, root: graph }));
  records.push({ name: ex.name, paths: result.paths.length, points: result.paths.reduce((n, s) => n + s.pts.length, 0) });
  cards.push(`<article><h2>${ex.name.replace('Differential Growth · ', '')}</h2><img src="growth-${i + 1}.svg"><p>${result.paths.length} continuous path · ${records.at(-1).points} points</p></article>`);
}
fs.writeFileSync(path.join(dir, 'checks.json'), JSON.stringify(records, null, 2));
fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Muusia · Bounded Differential Growth</title><style>body{background:#ece9e2;color:#252824;font:15px/1.5 system-ui;margin:28px}h1{font-size:25px}h2{font-size:17px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:16px 25px}article{background:#f7f5f0;padding:14px}img{width:100%;max-height:310px;background:white}p{font-size:13px;margin:8px 0}h2{margin:0 0 10px}</style><h1>Muusia · Bounded Differential Growth</h1><p>Real built-in node · Boundary and Start inputs · final grown strokes only · no guide outlines in the plot</p><main>${cards.join('')}</main>`);
console.log(dir + '/index.html');
