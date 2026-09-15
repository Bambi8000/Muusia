import { boxMean } from './detection.ts';
import type { DetectionResult } from './detection';
import { project, solveHomography } from './homography.ts';
import type { Point, Quad } from './homography';
import { analysisLight } from './paper.ts';
import type { PaperTone } from './paper';
import type { Raster } from './sampling';

type Settings = { cw: number; ch: number; paperTone?: PaperTone };
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const area = (points: Point[]) => Math.abs(points.reduce((sum, a, i) => {
  const b = points[(i + 1) % points.length]!;
  return sum + a.x * b.y - a.y * b.x;
}, 0)) / 2;

function hull(points: Point[]): Point[] {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (values: Point[]) => {
    const result: Point[] = [];
    for (const p of values) {
      while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, p) <= 0) result.pop();
      result.push(p);
    }
    result.pop(); return result;
  };
  return [...half(points), ...half([...points].reverse())];
}

function toQuad(polygon: Point[]): Quad | null {
  const points = [...polygon];
  while (points.length > 4) {
    let best = 0, loss = Infinity;
    for (let i = 0; i < points.length; i++) {
      const cost = Math.abs(cross(points[(i + points.length - 1) % points.length]!, points[i]!, points[(i + 1) % points.length]!));
      if (cost < loss) { loss = cost; best = i; }
    }
    points.splice(best, 1);
  }
  if (points.length !== 4 || area(points) < area(polygon) * .93) return null;
  return points as Quad;
}

/** Fit each long frame edge using all of its ink pixels, not the wobbly corner extremum. */
function refine(quad: Quad, pixels: Int32Array, width: number): Quad | null {
  const lines = quad.map((a, i) => {
    const b = quad[(i + 1) % 4]!, dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    const band = Math.max(3, length * .007), samples: Point[] = [];
    const coverage = new Uint8Array(32);
    for (const index of pixels) {
      const x = index % width + .5, y = Math.floor(index / width) + .5;
      const t = ((x - a.x) * dx + (y - a.y) * dy) / (length * length);
      if (t < .04 || t > .96 || Math.abs((x - a.x) * dy - (y - a.y) * dx) / length > band) continue;
      samples.push({ x, y }); coverage[Math.min(31, Math.floor(t * 32))] = 1;
    }
    if (samples.length < length * .5 || coverage.reduce((s, v) => s + v, 0) < 28) return null;
    const x = samples.reduce((s, p) => s + p.x, 0) / samples.length, y = samples.reduce((s, p) => s + p.y, 0) / samples.length;
    let xx = 0, xy = 0, yy = 0;
    for (const p of samples) { xx += (p.x - x) ** 2; xy += (p.x - x) * (p.y - y); yy += (p.y - y) ** 2; }
    const angle = .5 * Math.atan2(2 * xy, xx - yy), nx = -Math.sin(angle), ny = Math.cos(angle);
    const residual = samples.reduce((s, p) => s + Math.abs(nx * (p.x - x) + ny * (p.y - y)), 0) / samples.length;
    return residual > Math.max(2, length * .003) ? null : { nx, ny, c: nx * x + ny * y };
  });
  if (lines.some(l => !l)) return null;
  const result = lines.map((line, i) => {
    const a = lines[(i + 3) % 4]!, b = line!, determinant = a.nx * b.ny - a.ny * b.nx;
    return { x: (a.c * b.ny - a.ny * b.c) / determinant, y: (a.nx * b.c - a.c * b.nx) / determinant };
  }) as Quad;
  return result.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) ? result : null;
}

function ringScore(quad: Quad, gray: Float32Array, w: number, h: number, settings: Settings): number {
  const transform = solveHomography([{ x: 0, y: 0 }, { x: settings.cw, y: 0 }, { x: settings.cw, y: settings.ch }, { x: 0, y: settings.ch }], quad);
  const read = (x: number, y: number) => {
    const p = project(transform, x, y), px = Math.floor(p.x), py = Math.floor(p.y);
    return px < 0 || py < 0 || px >= w || py >= h ? null : gray[py * w + px]!;
  };
  let best = 0;
  for (const ox of [-.35, 0, .35]) for (const oy of [-.35, 0, .35]) {
    const cx = -2.5 + ox, cy = -2.5 + oy;
    const center = read(cx, cy);
    if (center === null) continue;
    let count = 0, contrast = 0;
    for (let i = 0; i < 40; i++) {
      const angle = i * Math.PI / 20;
      let ink = 255;
      for (const radius of [1.2, 1.35, 1.5, 1.65, 1.8]) {
        const v = read(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        if (v !== null) ink = Math.min(ink, v);
      }
      if (center - ink > 30) count++;
      contrast += Math.max(0, center - ink);
    }
    if (count >= 28) best = Math.max(best, contrast / 40);
  }
  return best;
}

/** Detect a complete plotted cell outline and its external 3 mm orientation ring.
 * Partial neighboring cells and the drawing itself are rejected by edge coverage.
 * All coordinates use pixel centers and clockwise TL → TR → BR → BL order. */
export function detectCloseup(raster: Raster, settings: Settings): DetectionResult {
  const { width: w, height: h, data } = raster, n = w * h;
  const failure = (message: string, candidates = 0, status: DetectionResult['status'] = 'not-found'): DetectionResult => ({ status, points: null, candidates, message });
  if (w < 80 || h < 80 || data.length !== n * 4 || ![settings.cw, settings.ch].every(v => Number.isFinite(v) && v > 1)) return failure('Check the frame dimensions, or place its four corners manually.');
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) gray[i] = analysisLight(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!, settings.paperTone);
  const blurred = boxMean(gray, w, h, 1), local = boxMean(blurred, w, h, Math.max(12, Math.round(Math.max(w, h) / 70)));
  const mask = new Uint8Array(n), queue = new Int32Array(n);
  for (let i = 0; i < n; i++) mask[i] = blurred[i]! < local[i]! - 16 ? 1 : 0;
  const candidates: { points: Quad; area: number; ring: number }[] = [];
  let rectangles = 0;
  for (let start = 0; start < n; start++) {
    if (!mask[start]) continue;
    let head = 0, tail = 1, x0 = w, y0 = h, x1 = 0, y1 = 0;
    queue[0] = start; mask[start] = 0;
    while (head < tail) {
      const index = queue[head++]!, x = index % w, y = Math.floor(index / w);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, next = yy * w + xx;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[next]) { mask[next] = 0; queue[tail++] = next; }
      }
    }
    if (x0 < 2 || y0 < 2 || x1 > w - 3 || y1 > h - 3 || (x1 - x0) * (y1 - y0) < n * .12 || tail < 200) continue;
    const left = new Int32Array(h).fill(w), right = new Int32Array(h).fill(-1);
    const pixels = queue.subarray(0, tail);
    for (const index of pixels) { const x = index % w, y = Math.floor(index / w); left[y] = Math.min(left[y]!, x); right[y] = Math.max(right[y]!, x); }
    const extremes: Point[] = [];
    for (let y = y0; y <= y1; y++) if (right[y]! >= 0) extremes.push({ x: left[y]! + .5, y: y + .5 }, { x: right[y]! + .5, y: y + .5 });
    const rough = toQuad(hull(extremes));
    if (!rough || area(rough) < n * .12) continue;
    const quad = refine(rough, pixels, w);
    if (!quad || quad.some(p => p.x < 1 || p.y < 1 || p.x > w - 1 || p.y > h - 1)) continue;
    rectangles++;
    for (let rotation = 0; rotation < 4; rotation++) {
      const points = [...quad.slice(rotation), ...quad.slice(0, rotation)] as Quad;
      const ring = ringScore(points, blurred, w, h, settings);
      if (ring > 30) candidates.push({ points, area: area(points), ring });
    }
  }
  candidates.sort((a, b) => b.area - a.area);
  const best = candidates[0];
  if (!best) return failure(rectangles ? 'A frame was found, but its top-left circle is unclear. Place the four frame corners manually, starting beside the circle.' : 'No complete frame was found. Keep all four corners in view, or place them manually.', rectangles, rectangles ? 'ambiguous' : 'not-found');
  if (candidates.slice(1).some(c => c.area > best.area * .75)) return failure('More than one frame or orientation looks plausible. Place the intended frame corners manually.', rectangles, 'ambiguous');
  return { status: 'found', points: best.points, candidates: rectangles, message: 'Frame and top-left circle found. Check the crop and drag any corner to refine it.' };
}
