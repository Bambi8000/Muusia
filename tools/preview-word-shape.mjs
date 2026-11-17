// Actual node outputs and portable projects, using the app's SVG exporter.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';
import N from '../src/defs/nodes/word_shape.js';
import L from '../src/defs/nodes/lettering.js';
import D from '../src/defs/nodes/drawn_path.js';
import { PENS } from '../src/defs/helpers.js';
import { EXAMPLES } from '../src/examples.js';
export const defs = { word_shape: N, lettering: L, drawn_path: D };
export const defaults = key => Object.fromEntries(defs[key].params.map(p => [p.key, p.def]));
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), ast = parseAst(app, { lang: 'jsx' });
const fn = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'toSVG');
export const toSVG = new Function('PENS', app.slice(fn.start, fn.end) + ';return toSVG;')(PENS);
export function evaluate(ex) {
  const graph = ex.make(defaults), outputs = new Map();
  for (const n of graph.nodes) {
    const ins = [];
    for (const e of graph.edges.filter(e => e.to === n.id)) ins[e.toPort] = outputs.get(e.from);
    outputs.set(n.id, defs[n.type].compute(ins, n.params, ex.canvas));
  }
  return { graph, result: outputs.get(graph.nodes.at(-1).id) };
}
export function generate(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const code = fs.readFileSync(new URL('../src/defs/nodes/word_shape.js', import.meta.url), 'utf8');
  const customSource = '(' + code.slice(code.indexOf('export default ') + 15).trim().replace(/;$/, '') + ')\n';
  fs.writeFileSync(path.join(dir, 'word_shape.plotternode.js'), customSource);
  const cards = [], records = [];
  for (const [i, ex] of EXAMPLES.filter(e => e.name.startsWith('Word Shape · ')).entries()) {
    const { graph, result } = evaluate(ex), name = 'word-shape-' + (i + 1);
    if (!result.paths.length) throw Error('Empty example: ' + ex.name);
    fs.writeFileSync(path.join(dir, name + '.svg'), toSVG(result, ex.canvas));
    fs.writeFileSync(path.join(dir, name + '.muusia.json'), JSON.stringify({ app: 'muusia', v: 1, name: ex.name, canvas: ex.canvas, customNodes: [{ key: N.key, source: customSource }], root: graph }, null, 2));
    fs.writeFileSync(path.join(dir, name + '.paths.json'), JSON.stringify({ canvas: ex.canvas, paths: result.paths, pens: PENS }));
    records.push({ name: ex.name, paths: result.paths.length, points: result.paths.reduce((n, p) => n + p.pts.length, 0) });
    cards.push(`<article><h2>${ex.name.replace('Word Shape · ', '')}</h2><img src="${name}.svg"><p>${records.at(-1).paths} strokes</p></article>`);
  }
  fs.writeFileSync(path.join(dir, 'checks.json'), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Muusia · Word Shape</title><style>body{font:14px/1.5 system-ui;background:#e8e5de;color:#252827;margin:24px}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}article{background:#f8f6ee;padding:14px}img{width:100%;height:320px;object-fit:contain;background:#fff}h2{font-size:16px}</style><h1>Word Shape</h1><p>Actual plottable strokes · stepped words · closed shapes · inside / outside</p><main>${cards.join('')}</main>`);
  console.log(JSON.stringify(records, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generate(path.resolve(process.argv[2] || 'output/word-shape'));
