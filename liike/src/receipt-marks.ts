import { frameRegistration, project } from './homography.ts';
import type { Matrix, Point, Quad } from './homography.ts';
import { sampleRect } from './sampling.ts';
import type { Raster } from './sampling.ts';

type Mark = { x: number; y: number; score: number };
const light = (data: Uint8ClampedArray, i: number) => .2126 * data[i]! + .7152 * data[i + 1]! + .0722 * data[i + 2]!;

/** Locate the four short horizontal ticks that Muusia prints at the artwork corners. */
export function detectReceiptMarks(raster: Raster): Quad | null {
  const { width: w, height: h, data } = raster;
  if (w < 80 || h < 80 || data.length !== w * h * 4) return null;
  const samples: number[] = [];
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 70))) for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 70))) samples.push(light(data, 4 * (y * w + x)));
  samples.sort((a, b) => a - b);
  const paper = samples[Math.floor(samples.length * .8)]!;
  const threshold = Math.min(175, paper - 42);
  if (threshold < 45) return null;
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && light(data, 4 * (y * w + x)) < threshold;
  const sides: [Mark[], Mark[]] = [[], []];
  const minRun = Math.max(3, Math.round(w * .007)), maxRun = Math.max(16, Math.round(w * .09));
  for (let y = 2; y < h - 2; y++) {
    for (let side = 0; side < 2; side++) {
      const from = side ? Math.floor(w * .70) : 0, to = side ? w : Math.ceil(w * .30);
      for (let x = from; x < to;) {
        if (!dark(x, y)) { x++; continue; }
        const start = x;
        while (x < to && dark(x, y)) x++;
        const length = x - start;
        if (length < minRun || length > maxRun) continue;
        const inner = side ? start : x - 1;
        const outer = side ? x - 1 : start;
        // The tick has white immediately beyond its inner tip. This rejects
        // long artwork lines that happen to pass through the search strip.
        if (dark(inner + (side ? -2 : 2), y)) continue;
        const verticalX = outer + (side ? -1 : 1);
        let vertical = 0;
        for (let dy = -Math.max(2, Math.round(length * .55)); dy <= Math.max(2, Math.round(length * .55)); dy++) if (dy && dark(verticalX, y + dy)) vertical++;
        sides[side]!.push({ x: outer, y, score: length + vertical * .3 });
      }
    }
  }
  const group = (marks: Mark[]) => {
    const groups: Mark[][] = [];
    for (const mark of marks.sort((a, b) => a.y - b.y || a.x - b.x)) {
      const last = groups.at(-1);
      if (last && Math.abs(mark.y - last.at(-1)!.y) <= 2 && Math.abs(mark.x - last.at(-1)!.x) < maxRun) last.push(mark);
      else groups.push([mark]);
    }
    return groups.map(g => ({ x: g.reduce((s, v) => s + v.x, 0) / g.length, y: g.reduce((s, v) => s + v.y, 0) / g.length, score: Math.max(...g.map(v => v.score)) + Math.min(g.length, 5) }))
      .sort((a, b) => b.score - a.score).slice(0, 32);
  };
  const left = group(sides[0]), right = group(sides[1]);
  let best: { quad: Quad; score: number } | null = null;
  for (const tl of left) for (const tr of right) {
    const width = tr.x - tl.x, slope = Math.abs(tr.y - tl.y);
    if (width < w * .22 || slope > width * .12) continue;
    for (const bl of left) for (const br of right) {
      const bottomWidth = br.x - bl.x, height = ((bl.y - tl.y) + (br.y - tr.y)) / 2;
      if (height < width * .25 || height > width * 8 || Math.abs(bottomWidth / width - 1) > .1) continue;
      if (Math.abs(bl.y - br.y) > width * .12 || Math.abs(bl.x - tl.x) > width * .08 || Math.abs(br.x - tr.x) > width * .08) continue;
      const quad: Quad = [{ x: tl.x, y: tl.y }, { x: tr.x, y: tr.y }, { x: br.x, y: br.y }, { x: bl.x, y: bl.y }];
      const score = tl.score + tr.score + bl.score + br.score + width * .16 + height * .04 - (slope + Math.abs(bl.y - br.y)) * .2 - Math.abs(bottomWidth - width) * .2;
      if (!best || score > best.score) best = { quad, score };
    }
  }
  return best?.quad ?? null;
}

export function receiptHeight(points: Quad) {
  const width = (Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) + Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y)) / 2;
  const height = (Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y) + Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y)) / 2;
  return Math.max(64, Math.min(4096, Math.round(512 * height / width)));
}

/** For the surrounding-photo look, use a stable affine frame in photo space. */
export function receiptAffine(points: Quad, height: number): Matrix {
  const [tl, tr, br, bl] = points;
  const vx = { x: ((tr.x - tl.x) + (br.x - bl.x)) / 1024, y: ((tr.y - tl.y) + (br.y - bl.y)) / 1024 };
  const vy = { x: ((bl.x - tl.x) + (br.x - tr.x)) / (2 * height), y: ((bl.y - tl.y) + (br.y - tr.y)) / (2 * height) };
  const cx = (tl.x + tr.x + br.x + bl.x) / 4, cy = (tl.y + tr.y + br.y + bl.y) / 4;
  return [vx.x, vy.x, cx - vx.x * 256 - vy.x * height / 2, vx.y, vy.y, cy - vx.y * 256 - vy.y * height / 2, 0, 0, 1];
}

export function receiptFullExtent(points: Quad, height: number, photoWidth: number, photoHeight: number) {
  const h = receiptAffine(points, height), d = h[0] * h[4] - h[1] * h[3];
  if (Math.abs(d) < 1e-8) throw new Error('The receipt marks are too close together.');
  let radiusX = 256, radiusY = height / 2;
  for (const { x, y } of [{ x: 0, y: 0 }, { x: photoWidth, y: 0 }, { x: photoWidth, y: photoHeight }, { x: 0, y: photoHeight }]) {
    const px = x - h[2], py = y - h[5];
    const u = (h[4] * px - h[1] * py) / d, v = (-h[3] * px + h[0] * py) / d;
    radiusX = Math.max(radiusX, Math.abs(u - 256)); radiusY = Math.max(radiusY, Math.abs(v - height / 2));
  }
  return { x: 256 - radiusX, y: height / 2 - radiusY, w: radiusX * 2, h: radiusY * 2 };
}

/** Read Muusia's tiny Fnn/total label only when one template clearly wins. */
export function readReceiptNumber(raster: Raster, points: Quad, total: number): number | null {
  if (!Number.isInteger(total) || total < 1 || total > 99) return null;
  const height = receiptHeight(points), h = frameRegistration(512, height, points);
  const roi = sampleRect(raster, raster, h, { x: 220, y: -19, w: 72, h: 19 }, 144, 38);
  const canvas = document.createElement('canvas'); canvas.width = 144; canvas.height = 38;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return null;
  const source = new Uint8Array(roi.width * roi.height);
  let darkCount = 0;
  for (let i = 0; i < source.length; i++) { source[i] = light(roi.data, i * 4) < 165 ? 1 : 0; darkCount += source[i]!; }
  if (darkCount < 12 || darkCount > 450) return null;
  const scored: { number: number; score: number }[] = [];
  for (let number = 1; number <= total; number++) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 144, 38);
    ctx.fillStyle = '#000'; ctx.font = '16px monospace'; ctx.textAlign = 'center';
    const label = `F${String(number).padStart(String(total).length, '0')}/${total}`;
    ctx.fillText(label, 72, 22);
    const template = ctx.getImageData(0, 0, 144, 38).data;
    const ink: { x: number; y: number }[] = [];
    for (let y = 0; y < 38; y++) for (let x = 0; x < 144; x++) if (light(template, 4 * (y * 144 + x)) < 165) ink.push({ x, y });
    const charWidth = ctx.measureText('0').width;
    const digitStart = Math.floor(72 - ctx.measureText(label).width / 2 + charWidth) - 1;
    const digitEnd = Math.ceil(digitStart + String(total).length * charWidth) + 1;
    const digitInk = ink.filter(p => p.x >= digitStart && p.x < digitEnd);
    let score = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
      let overlap = 0, digitOverlap = 0, digitSource = 0;
      for (const p of ink) {
        const x = p.x + dx, y = p.y + dy;
        if (x >= 0 && y >= 0 && x < 144 && y < 38 && source[y * 144 + x]) { overlap++; if (p.x >= digitStart && p.x < digitEnd) digitOverlap++; }
      }
      for (let y = 0; y < 38; y++) for (let x = digitStart + dx; x < digitEnd + dx; x++) if (x >= 0 && x < 144 && source[y * 144 + x]) digitSource++;
      const full = 2 * overlap / (darkCount + ink.length), digits = 2 * digitOverlap / (digitSource + digitInk.length);
      score = Math.max(score, .35 * full + .65 * digits);
    }
    scored.push({ number, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.score > .75 && (scored.length === 1 || scored[0]!.score - scored[1]!.score > .012) ? scored[0]!.number : null;
}

export function receiptTransform(points: Quad, height: number, fullPhoto: boolean): Matrix {
  return fullPhoto ? receiptAffine(points, height) : frameRegistration(512, height, points);
}

export function mapReceiptPoint(h: Matrix, point: Point) { return project(h, point.x, point.y); }

/** Keep the entire photographed scene; extend edge colors into alignment gaps. */
export function sampleReceipt(source: Raster, h: Matrix, rect: { x: number; y: number; w: number; h: number }, width: number, height: number, fullPhoto: boolean): Raster {
  const result = sampleRect(source, source, h, rect, width, height, 255);
  if (!fullPhoto) return result;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = rect.x + (x + .5) * rect.w / width, v = rect.y + (y + .5) * rect.h / height;
    const p = project(h, u, v);
    if (p.x >= .5 && p.y >= .5 && p.x <= source.width - .5 && p.y <= source.height - .5) continue;
    const sx = Math.max(0, Math.min(source.width - 1, Math.round(p.x))), sy = Math.max(0, Math.min(source.height - 1, Math.round(p.y)));
    const from = (sy * source.width + sx) * 4, to = (y * width + x) * 4;
    const alpha = source.data[from + 3]! / 255;
    for (let channel = 0; channel < 3; channel++) result.data[to + channel] = source.data[from + channel]! * alpha + 255 * (1 - alpha);
  }
  return result;
}
