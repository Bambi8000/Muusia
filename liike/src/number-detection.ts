import { NUMBER_GLYPHS } from './number-glyphs.ts';
import { frameRegistration, project } from './homography.ts';
import type { Quad } from './homography';
import { sampleRect } from './sampling.ts';
import type { Raster } from './sampling';
import { analysisLight, paperBackground } from './paper.ts';
import type { PaperTone } from './paper';

export type NumberReading = { status: 'found' | 'unreadable'; value?: number; message: string };
type Settings = { cw: number; ch: number; paperTone?: PaperTone };
const SCALE = 20, NW = 32, NH = 40;
type Pixel = { x: number; y: number };

function distances(mask: Uint8Array, w: number, h: number) {
  const d = Float32Array.from(mask, v => v ? 0 : 1000);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x) d[i] = Math.min(d[i]!, d[i - 1]! + 1);
    if (y) d[i] = Math.min(d[i]!, d[i - w]! + 1, x ? d[i - w - 1]! + Math.SQRT2 : 1000, x + 1 < w ? d[i - w + 1]! + Math.SQRT2 : 1000);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (x + 1 < w) d[i] = Math.min(d[i]!, d[i + 1]! + 1);
    if (y + 1 < h) d[i] = Math.min(d[i]!, d[i + w]! + 1, x ? d[i + w - 1]! + Math.SQRT2 : 1000, x + 1 < w ? d[i + w + 1]! + Math.SQRT2 : 1000);
  }
  return d;
}

const templates = Object.entries(NUMBER_GLYPHS).flatMap(([digit, glyph]) => {
  const maxX = Math.max(...glyph.s.flat().map(p => p[0]!));
  // Compare filled pen strokes at several widths, including their expanded bounds.
  return [.25, .4, .55, .7, .9, 1.1].map(radius => {
    const mask = new Uint8Array(NW * NH);
    for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
      const gx = -radius + (x + .5) / NW * (maxX + 2 * radius), gy = -radius + (y + .5) / NH * (10 + 2 * radius);
      for (const stroke of glyph.s) for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1]!, b = stroke[i]!, dx = b[0]! - a[0]!, dy = b[1]! - a[1]!;
        const t = Math.max(0, Math.min(1, ((gx - a[0]!) * dx + (gy - a[1]!) * dy) / (dx * dx + dy * dy)));
        if (Math.hypot(gx - a[0]! - t * dx, gy - a[1]! - t * dy) <= radius) mask[y * NW + x] = 1;
      }
    }
    return { digit, mask, distance: distances(mask, NW, NH), aspect: (maxX + 2 * radius) / (10 + 2 * radius) };
  });
});

function recognize(pixels: Pixel[], erasedRows: Set<number>) {
  const xs = pixels.map(p => p.x), ys = pixels.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < SCALE * 2.2 || y1 - y0 > SCALE * 3.9 || x1 - x0 < SCALE * .7 || x1 - x0 > SCALE * 3.5) return null;
  const mask = new Uint8Array(NW * NH);
  for (const { x, y } of pixels) mask[Math.round((y - y0) / (y1 - y0) * (NH - 1)) * NW + Math.round((x - x0) / (x1 - x0) * (NW - 1))] = 1;
  const ignored = Array.from({ length: NH }, (_, y) => erasedRows.has(Math.round(y0 + y / (NH - 1) * (y1 - y0))));
  const distance = distances(mask, NW, NH), aspect = (x1 - x0) / (y1 - y0);
  const scores = templates.map(template => {
    const reference = template.mask.map((v, i) => ignored[Math.floor(i / NW)] ? 0 : v);
    const referenceDistance = erasedRows.size ? distances(reference, NW, NH) : template.distance;
    let forward = 0, backward = 0, n = 0, m = 0, overlap = 0;
    for (let i = 0; i < mask.length; i++) {
      if (ignored[Math.floor(i / NW)]) continue;
      if (reference[i]) { forward += Math.min(10, distance[i]!); n++; }
      if (mask[i] && reference[i]) overlap++;
      if (mask[i]) { backward += Math.min(10, referenceDistance[i]!); m++; }
    }
    return { digit: template.digit, score: (forward / n + backward / m) * .6 + (1 - 2 * overlap / (n + m)) * 6 + Math.abs(Math.log(aspect / template.aspect)) };
  }).sort((a, b) => a.score - b.score);
  const best = scores[0]!, next = scores.find(s => s.digit !== best.digit)!;
  const margin = next.score - best.score;
  return (best.score < 2.2 && margin > .55) || (best.score < 1.3 && margin > .25) ? best.digit : null;
}

/** Read the label at this registered cell's bottom edge, never a neighbor. */
export function detectFrameNumber(raster: Raster, corners: Quad, settings: Settings): NumberReading {
  const unreadable = (message = 'The printed number is unclear. Enter it in Frame number on paper.'): NumberReading => ({ status: 'unreadable', message });
  const { cw, ch } = settings;
  const h = frameRegistration(cw, ch, corners);
  // Muusia uses 3 mm digits. A 24 mm band fits up to six digits plus side guards.
  const rect = { x: cw / 2 - 12, y: ch - 2, w: 24, h: 9.2 };
  const center = project(h, cw / 2, ch + 2.7), bottom = project(h, cw / 2, ch + 5.1);
  if (Math.hypot(center.x - bottom.x, center.y - bottom.y) < 12) return unreadable('The printed number is too small to read. Use a closer photo or enter it manually.');
  // Require the central label strip in the image; wide side guards may extend out.
  for (const x of [cw / 2 - 2, cw / 2 + 2]) for (const y of [ch + .6, ch + 4.9]) {
    const p = project(h, x, y);
    if (p.x < 1 || p.y < 1 || p.x >= raster.width - 1 || p.y >= raster.height - 1) return unreadable('The number below the frame is outside the photo. Enter it manually or include it in a new photo.');
  }
  const roi = sampleRect(raster, raster, h, rect, rect.w * SCALE, rect.h * SCALE, paperBackground(settings.paperTone));
  const w = roi.width, ht = roi.height, gray = new Float32Array(w * ht);
  for (let i = 0; i < gray.length; i++) gray[i] = analysisLight(roi.data[4 * i]!, roi.data[4 * i + 1]!, roi.data[4 * i + 2]!, roi.data[4 * i + 3]!, settings.paperTone);
  const levels = [...gray].sort((a, b) => a - b), paper = levels[Math.floor(levels.length * .85)]!, ink = levels[Math.floor(levels.length * .01)]!;
  if (paper - ink < 35) return unreadable();
  const threshold = paper - Math.max(35, (paper - ink) * .4);
  const mask = Uint8Array.from(gray, value => value < threshold ? 1 : 0), queue: number[] = [], components: Pixel[][] = [];
  // A plotted label can drift across the frame outline. Remove only long rows
  // around the registered bottom edge, and ignore that lost band when matching.
  const erasedRows = new Set<number>();
  for (let y = SCALE; y < SCALE * 3; y++) {
    let count = 0;
    for (let x = 0; x < w; x++) count += mask[y * w + x]!;
    if (count > w * .45) for (let dy = -1; dy <= 1; dy++) erasedRows.add(y + dy);
  }
  for (const y of erasedRows) mask.fill(0, y * w, (y + 1) * w);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start]) continue;
    queue.length = 0; queue.push(start); mask[start] = 0;
    const pixels: Pixel[] = [];
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head]!, x = index % w, y = Math.floor(index / w); pixels.push({ x, y });
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, i = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < ht && mask[i]) { mask[i] = 0; queue.push(i); }
      }
    }
    const xs = pixels.map(p => p.x), ys = pixels.map(p => p.y);
    if (pixels.length >= 8 && Math.max(...ys) - Math.min(...ys) >= 3 && Math.max(...xs) - Math.min(...xs) < 7 * SCALE) components.push(pixels);
  }
  const pixels = components.flat();
  if (!pixels.length || pixels.some(p => p.x <= 1 || p.x >= w - 2 || p.y <= 1 || p.y >= ht - 2)) return unreadable();
  const columns = new Uint8Array(w);
  for (const p of pixels) columns[p.x] = 1;
  const groups: { from: number; to: number }[] = [];
  for (let x = 0; x < w; x++) if (columns[x]) {
    const last = groups.at(-1);
    if (last && x - last.to <= 5) last.to = x; else groups.push({ from: x, to: x });
  }
  if (!groups.length || groups.length > 6) return unreadable();
  for (const pixel of pixels) {
    const p = project(h, rect.x + (pixel.x + .5) / SCALE, rect.y + (pixel.y + .5) / SCALE);
    if (p.x < 2 || p.y < 2 || p.x > raster.width - 3 || p.y > raster.height - 3) return unreadable('The printed number is cut off by the photo edge. Enter it manually.');
  }
  const chars = groups.map(g => recognize(pixels.filter(p => p.x >= g.from && p.x <= g.to), erasedRows));
  if (chars.some(c => c === null) || chars[0] === '0') return unreadable();
  // Centering is part of the plotting contract; reject stray marks in the margin.
  const expectedCenter = w / 2 - SCALE * (chars.at(-1) === '1' ? .375 : .45);
  if (Math.abs((groups[0]!.from + groups.at(-1)!.to) / 2 - expectedCenter) > SCALE * .9) return unreadable();
  const value = Number(chars.join(''));
  return { status: 'found', value, message: `Read frame ${value} from the paper. Check the number and correct it if needed.` };
}
