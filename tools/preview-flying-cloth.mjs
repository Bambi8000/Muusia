// Reproducible renders of actual Drape output, not screenshots or reference media.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';
import gifenc from 'gifenc';
import D from '../src/defs/nodes/drape.js';
import W from '../src/defs/nodes/word_shape.js';
import S from '../src/defs/nodes/spiro.js';
import { PENS } from '../src/defs/helpers.js';
import { EXAMPLES } from '../src/examples.js';

export const defs = { drape: D, word_shape: W, spiro: S };
export const defaults = key => Object.fromEntries(defs[key].params.map(p => [p.key, p.def]));
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parseAst(app, { lang: 'jsx' });
const fn = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'toSVG');
export const toSVG = new Function('PENS', app.slice(fn.start, fn.end) + ';return toSVG;')(PENS);
export const examples = EXAMPLES.filter(e => e.name.startsWith('Drape · Flying'));
export function evaluate(ex, frameIdx = 0, frameCount = 48) {
  const graph = ex.make(defaults), outputs = new Map();
  const ctx = { ...ex.canvas, frameIdx, frameCount };
  for (const n of graph.nodes) {
    const ins = [];
    for (const e of graph.edges.filter(e => e.to === n.id)) ins[e.toPort] = outputs.get(e.from);
    outputs.set(n.id, defs[n.type].compute(ins, n.params, ctx, n));
  }
  return { graph, result: outputs.get(graph.nodes.at(-1).id) };
}
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const expression = s => s.slice(s.indexOf('export default ') + 15).trim().replace(/;$/, '');
export function customSources() {
  const helper = read('src/defs/flying-cloth.js').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  return [
    { key: 'drape', source: '(()=>{\n' + helper + '\nreturn ' + expression(read('src/defs/nodes/drape.js')) + ';\n})()' },
    { key: 'word_shape', source: '(' + expression(read('src/defs/nodes/word_shape.js')) + ')' },
  ];
}
export function generate(dir, animate = true) {
  fs.mkdirSync(dir, { recursive: true });
  const customNodes = customSources(), records = [];
  for (const [i, ex] of examples.entries()) {
    const { graph, result } = evaluate(ex), stem = 'flying-cloth-' + (i + 1);
    if (!result.paths.length) throw Error('Empty starter: ' + ex.name);
    fs.writeFileSync(path.join(dir, stem + '.svg'), toSVG(result, ex.canvas));
    fs.writeFileSync(path.join(dir, stem + '.muusia.json'), JSON.stringify({ app: 'muusia', v: 1, name: ex.name, canvas: ex.canvas, customNodes, root: graph }, null, 2));
    records.push({ name: ex.name, paths: result.paths.length, points: result.paths.reduce((n, p) => n + p.pts.length, 0) });
  }
  if (animate) for (const ex of [examples[0], ...examples.slice(3)]) {
    const width = 960, height = Math.round(width * 210 / 297), frames = 48;
    const gif = gifenc.GIFEncoder(), palette = [[250, 248, 241], [35, 40, 39]];
    for (let frame = 0; frame < frames; frame++) {
      const { result } = evaluate(ex, frame, frames), pixels = new Uint8Array(width * height);
      const dot = (x, y) => { if (x >= 0 && y >= 0 && x < width && y < height) pixels[y * width + x] = 1; };
      const line = (a, b) => {
        const dx = (b[0] - a[0]) / 297 * width, dy = (b[1] - a[1]) / 210 * height;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 1.5));
        for (let j = 0; j <= steps; j++) dot(Math.round(a[0] / 297 * width + dx * j / steps), Math.round(a[1] / 210 * height + dy * j / steps));
      };
      for (const p of result.paths) for (let j = 0; j < p.pts.length - (p.closed ? 0 : 1); j++) line(p.pts[j], p.pts[(j + 1) % p.pts.length]);
      gif.writeFrame(pixels, width, height, { palette, delay: 80, repeat: 0 });
    }
    gif.finish(); fs.writeFileSync(path.join(dir, ex === examples[0] ? 'flying-typography.gif' : 'flying-' + ex.name.split(' ').at(-1) + '.gif'), gif.bytes());
  }
  fs.writeFileSync(path.join(dir, 'checks.json'), JSON.stringify(records, null, 2) + '\n');
  return records;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(generate(path.resolve(process.argv[2] || 'output/flying-cloth')));
