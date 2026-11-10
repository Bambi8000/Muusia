import { frameRegistration, project } from './homography.ts';
import type { Point, Quad } from './homography';
import type { Raster } from './sampling';
import type { DetectionResult } from './detection';
import { boxMean } from './detection.ts';
import type { NumberReading } from './number-detection';

// Matches the 512-dot animation receipt furniture in src/thermal-print.js.
const PRINT = { x: 48, y: 112, width: 416, codeX: 184, codeY: 65, codeCell: 9, codeHeight: 18, bits: 16 };
type Marker = { point: Point; size: number; strength: number };
type Corner = 0 | 1 | 2 | 3;

function light(raster: Raster) {
  const gray = new Uint8Array(raster.width * raster.height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4, a = raster.data[o + 3]! / 255;
    gray[i] = Math.round((.2126 * raster.data[o]! + .7152 * raster.data[o + 1]! + .0722 * raster.data[o + 2]!) * a + 255 * (1 - a));
  }
  return gray;
}

function markerCandidates(gray: Uint8Array, w: number, h: number): Marker[][] {
  const local = boxMean(Float32Array.from(gray), w, h, Math.max(12, Math.round(Math.min(w, h) / 35)));
  const mask = Uint8Array.from(gray, (v, i) => local[i]! > 90 && v < local[i]! - 35 ? 1 : 0), queue = new Int32Array(mask.length);
  const result: Marker[][] = [[], [], [], []];
  const minSize = Math.max(12, Math.min(w, h) * .012), maxSize = Math.min(w, h) * .22;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start]) continue;
    let head = 0, tail = 1, x0 = w, x1 = 0, y0 = h, y1 = 0;
    queue[0] = start; mask[start] = 0;
    while (head < tail) {
      const i = queue[head++]!, x = i % w, y = (i / w) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const j = yy * w + xx;
        if (mask[j]) { mask[j] = 0; queue[tail++] = j; }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, size = (bw + bh) / 2, fill = tail / (bw * bh);
    if (bw < minSize || bh < minSize || bw > maxSize || bh > maxSize || bw / bh < .5 || bw / bh > 2 || fill < .08 || fill > .48) continue;
    // The inner L intersection is an extremum of a diagonal projection. This
    // also works when the receipt is slightly rotated in the photograph.
    const extrema = [-Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < tail; i++) {
      const p = queue[i]!, x = p % w, y = (p / w) | 0;
      extrema[0] = Math.max(extrema[0]!, x + y);
      extrema[1] = Math.max(extrema[1]!, y - x);
      extrema[2] = Math.min(extrema[2]!, x + y);
      extrema[3] = Math.max(extrema[3]!, x - y);
    }
    for (let corner = 0 as Corner; corner < 4; corner = (corner + 1) as Corner) {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < tail; i++) {
        const p = queue[i]!, x = p % w, y = (p / w) | 0;
        const diagonal = [x + y, y - x, x + y, x - y][corner]!;
        if ((corner === 2 ? diagonal - extrema[corner]! : extrema[corner]! - diagonal) > size * .085) continue;
        sx += x; sy += y; n++;
      }
      if (!n) continue;
      const x = sx / n, y = sy / n, rx = (x - x0) / bw, ry = (y - y0) / bh;
      const expectedX = corner === 0 || corner === 3 ? 1 : 0;
      const expectedY = corner < 2 ? 1 : 0;
      if (Math.abs(rx - expectedX) > .38 || Math.abs(ry - expectedY) > .38) continue;
      // An L is mostly empty inside its bounding box; require two long legs.
      const nearVertical = Math.abs(rx - expectedX) < .28, nearHorizontal = Math.abs(ry - expectedY) < .28;
      if (!nearVertical || !nearHorizontal) continue;
      const signX = expectedX ? -1 : 1, signY = expectedY ? -1 : 1;
      let horizontalInk = 0, verticalInk = 0;
      for (let i = 0; i < tail; i++) {
        const p = queue[i]!, px = p % w, py = (p / w) | 0;
        const u = (px - x) * signX, v = (py - y) * signY;
        if (u > size * .22 && u < size * .78 && Math.abs(v) < size * .18) horizontalInk++;
        if (v > size * .22 && v < size * .78 && Math.abs(u) < size * .18) verticalInk++;
      }
      if (horizontalInk < size * .7 || verticalInk < size * .7) continue;
      result[corner]!.push({ point: { x, y }, size, strength: size * (1 - Math.abs(bw / bh - 1) * .3) });
    }
  }
  return result.map(group => group.sort((a, b) => b.strength - a.strength).slice(0, 16));
}

function quality(points: Quad, markers: Marker[], w: number, h: number, expectedAspect?: number) {
  const [tl, tr, br, bl] = points;
  const top = Math.hypot(tr.x - tl.x, tr.y - tl.y), right = Math.hypot(br.x - tr.x, br.y - tr.y);
  const bottom = Math.hypot(br.x - bl.x, br.y - bl.y), left = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  if (Math.min(top, right, bottom, left) < Math.min(w, h) * .15) return Infinity;
  const area = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x);
  if (area < w * h * .07) return Infinity;
  const sizes = markers.map(m => m.size), spread = Math.max(...sizes) / Math.min(...sizes);
  if (spread > 2.3) return Infinity;
  const aspect = (top + bottom) / (left + right);
  if (aspect < .12 || aspect > 8 || (expectedAspect && Math.abs(Math.log(aspect / expectedAspect)) > .52)) return Infinity;
  const opposite = Math.abs(Math.log(top / bottom)) + Math.abs(Math.log(left / right));
  const angle = Math.abs(((tr.x - tl.x) * (bl.x - tl.x) + (tr.y - tl.y) * (bl.y - tl.y)) / (top * left));
  return (expectedAspect ? Math.abs(Math.log(aspect / expectedAspect)) * 2 : 0) + opposite + angle + Math.log(spread) * .5 - area / (w * h) * .2;
}

function heightFor(points: Quad, W: number) {
  const width = (Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) + Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y)) / 2;
  const height = (Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y) + Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y)) / 2;
  return Math.max(64, Math.min(4096, Math.round(W * height / width)));
}

function sample(gray: Uint8Array, w: number, h: number, x: number, y: number) {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h) return 255;
  return gray[iy * w + ix]!;
}

function readNumberFromGray(raster: Raster, gray: Uint8Array, points: Quad, W: number, H: number): NumberReading {
  const unreadable = (message = 'Could not read the receipt number. Enter the printed F number manually.'): NumberReading => ({ status: 'unreadable', message });
  try {
    const h = frameRegistration(W, H, points), values: number[] = [];
    for (let bit = 0; bit < PRINT.bits; bit++) {
      let sum = 0, count = 0;
      for (const dx of [-.18, 0, .18]) for (const dy of [-.24, 0, .24]) {
        const px = PRINT.codeX + (bit + .5 + dx) * PRINT.codeCell;
        const py = PRINT.codeY + (.5 + dy) * PRINT.codeHeight;
        const p = project(h, (px - PRINT.x) / PRINT.width * W, (py - PRINT.y) / PRINT.width * W);
        if (p.x < 1 || p.y < 1 || p.x >= raster.width - 1 || p.y >= raster.height - 1) return unreadable('The number strip is outside the photo. Include the top of the receipt or enter its number manually.');
        sum += sample(gray, raster.width, raster.height, p.x, p.y); count++;
      }
      values.push(sum / count);
    }
    const low = Math.min(...values), high = Math.max(...values);
    if (high - low < 55) return unreadable();
    const bits = values.map(v => v < (low + high) / 2 ? 1 : 0);
    if (bits[0] !== 1 || bits[15] !== 1) return unreadable();
    const value = bits.slice(1, 11).reduce<number>((n, bit) => n * 2 + bit, 0);
    const check = bits.slice(11, 15).reduce<number>((n, bit) => n * 2 + bit, 0);
    if (value < 1 || value > 999 || check !== ((value ^ (value >> 4) ^ (value >> 8) ^ 0b1010) & 15)) return unreadable();
    return { status: 'found', value, message: `Read frame ${value} from the receipt. Check it against the printed F number.` };
  } catch { return unreadable(); }
}

export function readLargeReceiptNumber(raster: Raster, points: Quad, W = 512, H = heightFor(points, W)): NumberReading {
  return readNumberFromGray(raster, light(raster), points, W, H);
}

export function detectLargeReceipt(raster: Raster, W = 512, H?: number): DetectionResult {
  const failure = (message: string, candidates = 0): DetectionResult => ({ status: 'not-found', points: null, candidates, message });
  if (raster.width < 160 || raster.height < 160 || raster.data.length !== raster.width * raster.height * 4 || !(W > 0) || (H !== undefined && !(H > 0))) return failure('Check the photo and crop dimensions, or place the L corners manually.');
  const gray = light(raster), groups = markerCandidates(gray, raster.width, raster.height), count = groups.reduce((n, g) => n + g.length, 0);
  if (groups.some(g => !g.length)) return failure('Could not find four large L marks. Keep the whole receipt in view, or place the corners manually.', count);
  const matches: { points: Quad; score: number; number?: NumberReading }[] = [];
  for (let rotation = 0; rotation < 4; rotation++) for (const tl of groups[rotation]!) for (const tr of groups[(rotation + 1) % 4]!) for (const br of groups[(rotation + 2) % 4]!) for (const bl of groups[(rotation + 3) % 4]!) {
    const markers = [tl, tr, br, bl], points = markers.map(m => m.point) as Quad;
    const score = quality(points, markers, raster.width, raster.height, H ? W / H : undefined);
    if (score > 2.3) continue;
    matches.push({ points, score });
  }
  matches.sort((a, b) => a.score - b.score);
  for (const match of matches.slice(0, 12)) {
    match.number = readNumberFromGray(raster, gray, match.points, W, H ?? heightFor(match.points, W));
    if (match.number.status === 'found') match.score -= 2;
  }
  matches.sort((a, b) => a.score - b.score);
  const best = matches[0];
  if (!best) return failure('The L marks could not be matched to one frame. Place the four inner corners manually.', count);
  const number = best.number ?? readNumberFromGray(raster, gray, best.points, W, H ?? heightFor(best.points, W));
  if (number.status !== 'found' && matches[1] && matches[1].score - best.score < .2) return { status: 'ambiguous', points: null, candidates: count, message: 'Several L-mark groups look possible. Place the four inner corners manually.' };
  return { status: 'found', points: best.points, candidates: count, number, message: number.status === 'found' ? `Four L marks and frame ${number.value} found. Check the crop and number.` : 'Four L marks found. Check the crop and enter the printed F number manually.' };
}
