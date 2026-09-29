/** Reproducible Muusia Learn examples. Geometry is evaluated by the real nodes. */
import grid from '../../src/defs/nodes/grid.js';
import aaltoilu from '../../src/defs/nodes/aaltoilu.js';
import radat from '../../src/defs/nodes/radat.js';
import viiva from '../../src/defs/nodes/viiva.js';
import stamp from '../../src/defs/nodes/stamp.js';
import setpen from '../../src/defs/nodes/setpen.js';
import merge from '../../src/defs/nodes/merge.js';
import arvo from '../../src/defs/nodes/arvo.js';
import frame from '../../src/defs/nodes/frame.js';
import image from '../../src/defs/nodes/image.js';
import polystudio from '../../src/defs/nodes/polystudio.js';
import travelsort from '../../src/defs/nodes/travelsort.js';
import moveScale from '../../src/defs/nodes/move_scale.js';
import rotate from '../../src/defs/nodes/kierto.js';
import hatch from '../../src/defs/nodes/hatch.js';
import container from '../../src/defs/nodes/container.js';
import random from '../../src/defs/nodes/satunnainen.js';
import math from '../../src/defs/nodes/matem.js';

export const DEFINITIONS = Object.fromEntries([grid, aaltoilu, radat, viiva, stamp, setpen, merge, arvo, frame, image, polystudio, travelsort, moveScale, rotate, hatch, container, random, math].map(def => [def.key, def]));
export const PILOT_KEYS = Object.keys(DEFINITIONS);
export const CANVAS = { W: 297, H: 210 };
export const defaults = key => Object.fromEntries(DEFINITIONS[key].params.map(param => [param.key, param.def]));
export const ports = (node, kind) => typeof DEFINITIONS[node.type][kind] === 'function'
  ? DEFINITIONS[node.type][kind](node) : DEFINITIONS[node.type][kind] || [];

const node = (id, type, params = {}, x = 30, y = 30, data) => ({
  id, type, x, y, params: { ...defaults(type), ...params }, ...(data ? { data } : {}),
});
const edge = (from, to, toPort = 0, fromPort = 0) => ({ id: `e${from}${to}${String(toPort).replace(':', '')}`, from, fromPort, to, toPort });
const example = (title, nodes, edges, outputId, extra = {}) => ({
  title, outputId, ...extra,
  patch: { app: 'muusia', v: 1, name: title, canvas: { ...CANVAS }, root: { nodes, edges } },
});

export const GRID_SETTINGS = { vlines: 0, hlines: 24, margin: 24, res: 2, layer: 0 };
export const WAVE_SETTINGS = { amp: 4, wl: 45, phase: 0 };
export const TRACK_SETTINGS = { rings: 12, gap: 6, wob: 4, drift: 2, seed: 7, layer: 1 };
export const STROKE_SETTINGS = { mode: 'Dashed', dash: 16, gap: 5, vary: 0, phase: 0, seed: 4 };
export const STAMP_SETTINGS = { motif: 'Triangle', spacing: 18, size: 2.5, sizeMod: 0, pathVar: 1, orientMode: 'Along path', angle: 0, host: true, keepCol: false, seed: 6727, layer: 3 };

/** Original tonal study; g follows Muusia's 0=white, 1=black convention. */
export function makeTonalImage() {
  const w = 128, h = 90, g = [], rgb = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5) / w, ny = (y + 0.5) / h;
    const r = Math.hypot((nx - 0.34) / 0.24, (ny - 0.43) / 0.34);
    let dark = r < 1 ? 0.2 + 0.72 * (1 - r * 0.65) : 0;
    if (nx > 0.59 && nx < 0.87 && ny > 0.17 && ny < 0.71) dark = Math.max(dark, 0.18 + 0.72 * ((ny - 0.17) / 0.54));
    if (ny > 0.77 && ny < 0.85 && nx > 0.12 && nx < 0.87) dark = Math.max(dark, 0.22 + 0.7 * ((nx - 0.12) / 0.75));
    const byte = 255 - Math.round(dark * 255);
    g.push((255 - byte) / 255);
    rgb.push(byte, byte, byte);
  }
  return { w, h, g, rgb };
}

const first = example('Your first Muusia drawing', [
  node(9001, 'grid', GRID_SETTINGS, 30, 30),
  node(9002, 'aaltoilu', WAVE_SETTINGS, 350, 30),
], [edge(9001, 9002)], 9002);

const stamps = example('Style and stamp a pattern', [
  node(9001, 'viiva', STROKE_SETTINGS, 30, 30),
  node(9002, 'radat', TRACK_SETTINGS, 350, 30),
  node(9003, 'stamp', STAMP_SETTINGS, 670, 30),
], [edge(9001, 9002), edge(9002, 9003)], 9003);

const twoPens = example('Build a two-pen composition', [
  node(9001, 'grid', { ...GRID_SETTINGS, layer: 1 }, 30, 30),
  node(9002, 'aaltoilu', WAVE_SETTINGS, 350, 30),
  node(9004, 'radat', { ...TRACK_SETTINGS, layer: 2 }, 350, 520),
  node(9006, 'merge', { count: 2, penPer: false }, 670, 270),
], [edge(9001, 9002), edge(9002, 9006, 0), edge(9004, 9006, 1)], 9006);

const singlePen = example('Set Pen — combine all pen layers onto one pen', [
  ...structuredClone(twoPens.patch.root.nodes),
  node(9007, 'setpen', { mode: 'All', layer: 0 }, 990, 270),
], [...structuredClone(twoPens.patch.root.edges), edge(9006, 9007)], 9007);

const transformFill = example('Transform, crop and fill shapes', [
  node(9001, 'radat', { rings: 1, gap: 6, wob: 8, drift: 0, seed: 7, layer: 1 }, 30, 30),
  node(9002, 'move_scale', { dx: 20, dy: -5, scale: 70, scaleY: 45, origin: 'Content center' }, 350, 30),
  node(9003, 'kierto', { deg: 25, per: true, grad: false }, 670, 30),
  node(9004, 'hatch', { region: 'Inside shapes', angle: 90, spacing: 2.5, inset: 0, cross: false, outlines: true, keepCol: true }, 990, 30),
  node(9005, 'container', { shape: 'Rectangle', cx: 148.5, cy: 105, rw: 150, rh: 90, rot: 0, keep: 'Inside', gap: 0, draw: true, regionPen: 0 }, 1310, 30),
], [edge(9001, 9002), edge(9002, 9003), edge(9003, 9004), edge(9004, 9005)], 9005);
const transformPrefix = (title, count) => example(title,
  structuredClone(transformFill.patch.root.nodes.slice(0, count)),
  structuredClone(transformFill.patch.root.edges.slice(0, count - 1)), 9000 + count);

const numbers = example('Control a patch with numbers', [
  node(9001, 'grid', { ...GRID_SETTINGS, layer: 1 }, 350, 30),
  node(9002, 'arvo', { v: 4 }, 30, 30),
  node(9003, 'satunnainen', { min: 1, max: 2, seed: 11 }, 30, 240),
  node(9004, 'matem', { op: 'A × B', a: 1, b: 2 }, 350, 530),
  node(9005, 'aaltoilu', WAVE_SETTINGS, 670, 150),
], [edge(9001, 9005), edge(9002, 9004, 0), edge(9003, 9004, 1), edge(9004, 9005, 'p:amp')], 9005);

const physicalPlot = example('Prepare your first physical plot', [
  { ...node(9001, 'container', { shape: 'Rectangle', cx: 30, cy: 30, rw: 20, rh: 20, rot: 0, draw: true, regionPen: 0 }, 30, 30), collapsed: true },
  { ...node(9002, 'container', { shape: 'Triangle', cx: 70, cy: 30, cr: 8, rot: 90, draw: true, regionPen: 0 }, 30, 240), collapsed: true },
  node(9003, 'grid', { vlines: 0, hlines: 3, margin: 0, res: 2, layer: 0 }, 30, 460),
  node(9004, 'move_scale', { dx: 50, dy: 50, scale: 10, scaleY: 5, origin: 'Custom point', ox: 0, oy: 0 }, 350, 460),
  node(9005, 'merge', { count: 3, penPer: false }, 670, 180),
], [edge(9003, 9004), edge(9001, 9005, 0), edge(9002, 9005, 1), edge(9004, 9005, 2)], 9005);

export const examples = {
  'tutorial-first': first,
  'tutorial-stamps': stamps,
  'tutorial-two-pens': twoPens,
  'tutorial-svg-workflow': { ...structuredClone(twoPens), title: 'Export a two-colour SVG set' },
  'tutorial-transform-fill': transformFill,
  'tutorial-numbers': numbers,
  'tutorial-physical-plot': physicalPlot,
  satunnainen: example('Random — repeatable control of Wave amplitude', [
    node(9001, 'grid', { ...GRID_SETTINGS, layer: 1 }, 30, 30),
    node(9003, 'satunnainen', { min: 2, max: 8, seed: 11 }, 30, 530),
    node(9005, 'aaltoilu', WAVE_SETTINGS, 350, 150),
  ], [edge(9001, 9005), edge(9003, 9005, 'p:amp')], 9005),
  matem: example('Math — multiply a value before it reaches Wave', [
    node(9001, 'grid', { ...GRID_SETTINGS, layer: 1 }, 350, 30),
    node(9002, 'arvo', { v: 4 }, 30, 30),
    node(9004, 'matem', { op: 'A × B', a: 1, b: 2 }, 350, 530),
    node(9005, 'aaltoilu', WAVE_SETTINGS, 670, 150),
  ], [edge(9001, 9005), edge(9002, 9004, 0), edge(9004, 9005, 'p:amp')], 9005),
  move_scale: transformPrefix('Move / Scale — position and resize a shape', 2),
  kierto: transformPrefix('Rotate — turn a shape around its own center', 3),
  hatch: transformPrefix('Hatch Fill — turn a closed shape into pen strokes', 4),
  container: transformPrefix('Container — crop a filled shape to a rectangle', 5),
  grid: example('Grid — evenly spaced lines', [node(9001, 'grid', GRID_SETTINGS)], [], 9001),
  aaltoilu: { ...structuredClone(first), title: 'Wave — bend paths into waves' },
  radat: example('Tracks — nested organic loops', [node(9001, 'radat', TRACK_SETTINGS)], [], 9001),
  viiva: example('Stroke — a style applied to Grid', [node(9001, 'viiva', STROKE_SETTINGS), node(9002, 'grid', { ...GRID_SETTINGS, hlines: 14 }, 350, 30)], [edge(9001, 9002)], 9002),
  stamp: { ...structuredClone(stamps), title: 'Stamp — repeat a motif along paths' },
  setpen: singlePen,
  merge: { ...structuredClone(twoPens), title: 'Merge — combine two branches' },
  arvo: example('Value — drive Wave amplitude', [
    node(9001, 'grid', GRID_SETTINGS), node(9002, 'arvo', { v: 4 }, 30, 540), node(9003, 'aaltoilu', WAVE_SETTINGS, 350, 30),
  ], [edge(9001, 9003), edge(9002, 9003, 'p:amp')], 9003),
  frame: example('Frame — rotate a polyhedron', [
    node(9001, 'frame'), node(9002, 'polystudio', { shape: 'Cube', size: 145, fill: 'Concentric inset', step: 3, layer: 1 }, 350, 30),
  ], [edge(9001, 9002, 'p:ry', 4)], 9002, { frameCount: 12, frameIdx: 1, frameNote: 'Set Frames to 12 in the animation controls. The patch file does not save animation settings. Frame 2 of 12 is pictured.' }),
  image: example('Image — translate tones into pen paths', [node(9001, 'image', { file: 'tonal-shapes.png', mode: 'Scanline wave', cell: 2.4, strength: 0.8, margin: 20 }, 30, 30, { img: makeTonalImage() })], [], 9001),
  polystudio: example('Polyhedron Studio — fills that follow faces', [node(9001, 'polystudio', { shape: 'Icosahedron', size: 150, layer: 1, pen2: 0 })], [], 9001),
  travelsort: example('Travel Sort — shorten pen-up moves', [
    node(9001, 'grid', { ...GRID_SETTINGS, hlines: 16 }), node(9002, 'travelsort', {}, 350, 30),
  ], [edge(9001, 9002)], 9002),
};
for (const value of Object.values(examples)) value.patch.name = value.title;

export const blankPatch = { app: 'muusia', v: 1, name: 'Muusia Learn — blank A4 landscape', canvas: { ...CANVAS }, root: { nodes: [], edges: [] } };

/** Mirrors the app's port and numeric-parameter evaluation, without thumbnail truncation. */
export function evaluateExample(value, options = {}) {
  const { nodes, edges } = value.patch.root;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out = {}, params = {}, visiting = new Set();
  const ctx = { ...value.patch.canvas, frameIdx: options.frameIdx ?? value.frameIdx ?? 0, frameCount: options.frameCount ?? value.frameCount ?? 12 };
  function evaluate(id) {
    if (out[id]) return out[id];
    if (visiting.has(id)) throw new Error(`Cycle at node ${id}`);
    const n = byId.get(id);
    if (!n) throw new Error(`Missing node ${id}`);
    visiting.add(id);
    const p = { ...n.params };
    for (const parameter of DEFINITIONS[n.type].params.filter(param => ['slider', 'number', 'seed'].includes(param.type))) {
      const wire = edges.find(e => e.to === id && e.toPort === `p:${parameter.key}`);
      if (wire) {
        const v = evaluate(wire.from)[wire.fromPort || 0];
        if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Invalid value at ${id}.${parameter.key}`);
        p[parameter.key] = v;
      }
    }
    params[id] = p;
    const ins = ports(n, 'ins').map((_, index) => {
      const wire = edges.find(e => e.to === id && e.toPort === index);
      return wire ? evaluate(wire.from)[wire.fromPort || 0] : undefined;
    });
    const result = DEFINITIONS[n.type].compute(ins, p, ctx, n);
    out[id] = ports(n, 'outs').length > 1 ? result : [result];
    visiting.delete(id);
    return out[id];
  }
  for (const n of nodes) evaluate(n.id);
  return { output: out[value.outputId][value.outputPort || 0], out, params, ctx };
}

export function withParams(value, type, changes) {
  const copy = structuredClone(value);
  const n = copy.patch.root.nodes.find(n => n.type === type);
  if (!n) throw new Error(`Missing ${type} in ${value.title}`);
  Object.assign(n.params, changes);
  return copy;
}
