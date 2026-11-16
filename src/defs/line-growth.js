// Muusia adapter over Gilbert Chen's MIT Line Growth engine; see
// MUUSIA-LINE-GROWTH-NOTICE.md and the complete license in line-growth-engine.js.
import { Boundary, Grower, ellipseRing, flat, unflat, resample, pathLength, signedArea, validStrands } from './line-growth-engine.js';
import { PENS } from './helpers.js';
const EMPTY = { paths: [] }, cache = new Map();
const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : d));
const copyStrands = ss => ss.map(s => ({ closed: s.closed, points: s.points.slice() }));
export const clearLineGrowthCache = () => cache.clear();

function cleanPoints(pts, closed = false) {
  if (!Array.isArray(pts) || pts.some(q => !Array.isArray(q) || q.length < 2 || !q.slice(0, 2).every(Number.isFinite) || q.slice(0, 2).some(x => Math.abs(x) > 1e6))) return null;
  const out = [];
  for (const q of pts) if (!out.length || Math.hypot(q[0] - out.at(-1)[0], q[1] - out.at(-1)[1]) > 1e-8) out.push(q.slice(0, 2));
  if (closed && out.length > 2 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < 1e-8) out.pop();
  return out;
}

// Used by compute and the selected-node overlay; boundary guides never export.
export function lineGrowthRegion(p, ctx, input) {
  const raw = input?.paths || [];
  if (!Array.isArray(raw) || raw.length > 128) return null;
  const wired = p.boundary === 'Wired' || (p.boundary === 'Auto' && raw.length > 0);
  if (wired) {
    const closed = raw.filter(q => q?.closed === true);
    if (!closed.length || closed.reduce((n, q) => n + (q?.pts?.length || 0), 0) > 6000) return null;
    const rings = closed.map(q => cleanPoints(q.pts, true));
    return rings.some(r => !r || r.length < 3 || Math.abs(signedArea(r)) < 1e-6) ? null : rings;
  }
  const { W, H } = ctx, margin = num(p.margin, 15, 0, Math.min(W, H) / 2);
  if (![W, H].every(Number.isFinite) || W - 2 * margin < 2 || H - 2 * margin < 2) return null;
  return p.boundary === 'Canvas'
    ? [[[margin, margin], [W - margin, margin], [W - margin, H - margin], [margin, H - margin]]]
    : [ellipseRing(W / 2, H / 2, (Math.min(W, H) - 2 * margin) / 2, (Math.min(W, H) - 2 * margin) / 2, .03)];
}

function validRegion(rings) {
  const pts = rings.flat(), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const lo = Math.min(x1 - x0, y1 - y0), hi = Math.max(x1 - x0, y1 - y0);
  if (lo < .001 || hi / lo > 1e4) return false;
  const pad = Math.max(1, hi * .01), box = new Boundary([[[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x1 + pad, y1 + pad], [x0 - pad, y1 + pad]]]);
  return validStrands(rings.map(r => ({ closed: true, points: flat(r) })), box, hi / 40);
}

// Clip complete line segments, preserving continuity only across connected
// pieces. A hole splits an imported line into honest separate open strands.
function clippedStarts(raw, b, spacing, budget) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 64 || raw.reduce((n, q) => n + (q?.pts?.length || 0), 0) > 12000) return null;
  const strands = [];
  for (const path of raw) {
    const pts = cleanPoints(path?.pts, path?.closed === true);
    if (!pts || pts.length < (path?.closed ? 3 : 2)) return null;
    let run = [], all = true;
    const runs = [], finish = () => { if (run.length > 1) runs.push(run); run = []; };
    for (let i = 0; i < pts.length - (path.closed ? 0 : 1); i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length], spans = b.clipSegment(...a, ...c);
      if (spans.length !== 1 || spans[0][0] > 1e-8 || spans[0][1] < 1 - 1e-8) all = false;
      if (!spans.length) { finish(); continue; }
      for (const [t0, t1] of spans) {
        // Keep clipped ends just inside the boundary, with no join across holes.
        const eps = Math.min((t1 - t0) * .01, 1e-6 / Math.max(1e-9, Math.hypot(c[0] - a[0], c[1] - a[1])));
        const point = t => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
        const start = point(t0 > 0 ? t0 + eps : t0), end = point(t1 < 1 ? t1 - eps : t1);
        if (run.length && Math.hypot(run.at(-1)[0] - start[0], run.at(-1)[1] - start[1]) > 1e-7) finish();
        if (!run.length) run.push(start);
        run.push(end);
        if (t1 < 1 - 1e-8) finish();
      }
    }
    finish();
    if (path.closed && runs.length > 1) {
      const first = runs[0], last = runs.at(-1);
      if (Math.hypot(last.at(-1)[0] - first[0][0], last.at(-1)[1] - first[0][1]) < 1e-7) { runs[0] = [...last.slice(0, -1), ...first]; runs.pop(); }
    }
    for (const r of runs) {
      const closed = all && path.closed === true;
      if (closed && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 1e-7) r.pop();
      if (Math.ceil(pathLength(r, closed) / spacing) + r.length + strands.reduce((n, s) => n + s.points.length / 2, 0) > budget) return null;
      const sampled = resample(r, closed, spacing);
      if (sampled.length < (closed ? 3 : 2)) return null;
      strands.push({ closed, points: flat(sampled) });
    }
  }
  return strands;
}

export function boundedLineGrowth(ins, p, ctx) {
  const rings = lineGrowthRegion(p, ctx, ins[1]);
  if (!rings || !validRegion(rings)) return EMPTY;
  const boundary = new Boundary(rings), spacing = num(p.spacing, 3.9, .5, 15), target = spacing / 2.6;
  const maxNodes = Math.round(num(p.maxPoints, 3600, 200, 12000));
  const params = { maxNodes, segmentLength: target, repelRadius: spacing, repulsion: .95, attraction: .47, alignment: .48, stepSize: target * .09, randomness: num(p.chaos, .3, 0, 1), seed: Math.round(num(p.seed, 17, -2e9, 2e9)) };
  let starts;
  const inputStarts = ins[2]?.paths || [];
  if (p.start === 'Wired' || (p.start === 'Auto' && inputStarts.length)) starts = clippedStarts(inputStarts, boundary, target * 1.2, maxNodes);
  else {
    const [x, y] = boundary.roomiest(), edge = boundary.closest(x, y);
    const clear = Math.hypot(x - edge[0], y - edge[1]), radius = clear * num(p.startSize, 20, 1, 80) / 100;
    if (!boundary.contains(x, y) || radius < .02) return EMPTY;
    const pts = p.start === 'Line' ? [[x - radius, y], [x + radius, y]] : ellipseRing(x, y, radius, radius, Math.min(.03, radius * .005));
    const closed = p.start !== 'Line';
    const initialSpacing = Math.max(target * 1.2, pathLength(pts, closed) / (maxNodes - 1));
    let sampled = resample(pts, closed, initialSpacing);
    if (closed && sampled.length < 3) sampled = ellipseRing(x, y, radius, radius, radius * .05);
    starts = [{ closed, points: flat(sampled) }];
  }
  if (!starts?.length || starts.reduce((n, s) => n + s.points.length / 2, 0) > maxNodes || !validStrands(starts, boundary, spacing)) return EMPTY;
  const steps = Math.round(num(p.growth, 100, 0, 100) / 100 * num(p.steps, 2200, 0, 6000));
  const key = JSON.stringify([rings, starts.map(s => [s.closed, Array.from(s.points)]), params]);
  const checkpoint = Math.floor(steps / 100) * 100;
  let entry = cache.get(key);
  if (!entry || entry.grower.step > checkpoint) entry = { grower: new Grower(copyStrands(starts), 0, params, boundary), work: 0, stopped: false };
  cache.delete(key); cache.set(key, entry);
  while (cache.size > 2) cache.delete(cache.keys().next().value);
  // Cache only fixed checkpoints. A partial Growth request is simulated on a
  // copy, so scrubbing up/down produces the same geometry as a fresh evaluation.
  const advance = (g, until, work) => {
    while (g.step < until && work < 16000000) { work += g.nodes; g.stepOnce(); }
    return work;
  };
  while (entry.grower.step < checkpoint && !entry.stopped) {
    const previous = copyStrands(entry.grower.strands), oldStep = entry.grower.step;
    entry.work = advance(entry.grower, Math.min(checkpoint, oldStep + 100), entry.work);
    if (!validStrands(entry.grower.strands, boundary, spacing)) {
      entry.grower = new Grower(previous, oldStep, params, boundary);
      entry.stopped = true;
    }
    if (entry.work >= 16000000) entry.stopped = true;
  }
  let result = entry.grower.strands;
  if (steps > entry.grower.step && !entry.stopped) {
    const partial = new Grower(copyStrands(result), entry.grower.step, params, boundary);
    advance(partial, steps, entry.work);
    if (validStrands(partial.strands, boundary, spacing)) result = partial.strands;
  }
  const layer = ((Math.round(num(p.layer, 0, -1e6, 1e6)) % PENS.length) + PENS.length) % PENS.length;
  return { paths: result.map(s => ({ pts: unflat(s.points), closed: s.closed, layer })) };
}
