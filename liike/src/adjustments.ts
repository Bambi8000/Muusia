import { buildLayout } from './layout.ts';
import type { Rect, SheetSettings } from './layout';
import type { Matrix } from './homography';
import { sampleRect } from './sampling.ts';
import type { Raster } from './sampling';
import { sharpenRaster } from './sharpen.ts';

export type Adjustments = { flatten: boolean; whiteBalance: boolean; autoAdjust: boolean; sharpenEnabled: boolean; sharpen: number; black: number; white: number; gamma: number; saturation: number; thresholdEnabled: boolean; threshold: number };
export const DEFAULT_ADJUSTMENTS: Readonly<Adjustments> = Object.freeze({ flatten: true, whiteBalance: true, autoAdjust: false, sharpenEnabled: false, sharpen: 40, black: 0, white: 255, gamma: 1, saturation: 100, thresholdEnabled: false, threshold: 128 });
export type PaperModel = { W: number; H: number; h: Matrix; photoWidth: number; photoHeight: number; paper: number[]; coefficients: number[][]; samples: number; supported: boolean; note: string; autoLevels?: { black: number; white: number } };
type PaperSample = { x: number; y: number; rgb: number[] };
const clamp = (value: number, low = 0, high = 255) => Math.max(low, Math.min(high, value));
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? 255; };
const basis = (x: number, y: number) => [1, x, y, x * x, x * y, y * y];
const evaluate = (coefficients: number[], terms: number[]) => coefficients.reduce((sum, coefficient, i) => sum + coefficient * terms[i]!, 0);

export function validateAdjustments(a: Adjustments) {
  if (![a.black, a.white, a.gamma, a.saturation, a.threshold, a.sharpen].every(Number.isFinite) || a.black < 0 || a.black > 120 || a.white < 135 || a.white > 255 || a.gamma < .3 || a.gamma > 3 || a.saturation < 0 || a.saturation > 200 || a.threshold < 0 || a.threshold > 255 || a.sharpen < 0 || a.sharpen > 100) throw new Error('Check the color adjustment values.');
}

function paperValue(value: number, c: number, nx: number, ny: number, model: PaperModel, flatten: boolean, whiteBalance: boolean) {
  const peak = Math.max(...model.paper);
  if (flatten) {
    const k = model.coefficients[c]!;
    const field = k[0]! + k[1]! * nx + k[2]! * ny + k[3]! * nx * nx + k[4]! * nx * ny + k[5]! * ny * ny;
    value *= clamp(model.paper[c]! * 245 / peak / Math.max(20, field), .25, 4);
  }
  if (whiteBalance) value *= peak / Math.max(20, model.paper[c]!);
  return value;
}

function quantile(histogram: Uint32Array, fraction: number, fallback: number) {
  const total = histogram.reduce((sum, value) => sum + value, 0);
  if (total < 20) return fallback;
  let count = 0;
  for (let i = 0; i < histogram.length; i++) { count += histogram[i]!; if (count >= total * fraction) return i; }
  return fallback;
}

function fit(samples: PaperSample[], channel: number) {
  const matrix = Array.from({ length: 6 }, () => new Array<number>(7).fill(0));
  for (const sample of samples) {
    const terms = basis(sample.x, sample.y);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) matrix[row]![col]! += terms[row]! * terms[col]!;
      matrix[row]![6]! += terms[row]! * sample.rgb[channel]!;
    }
  }
  // A weak regularizer keeps poorly observed interiors bounded without fitting ink.
  for (let i = 0; i < 6; i++) matrix[i]![i]! += 1e-5;
  for (let col = 0; col < 6; col++) {
    let pivot = col;
    for (let row = col + 1; row < 6; row++) if (Math.abs(matrix[row]![col]!) > Math.abs(matrix[pivot]![col]!)) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot]!, matrix[col]!];
    const divisor = matrix[col]![col]!;
    if (Math.abs(divisor) < 1e-10) return [median(samples.map(s => s.rgb[channel]!)), 0, 0, 0, 0, 0];
    for (let i = col; i < 7; i++) matrix[col]![i]! /= divisor;
    for (let row = 0; row < 6; row++) {
      if (row === col) continue;
      const factor = matrix[row]![col]!;
      for (let i = col; i < 7; i++) matrix[row]![i]! -= factor * matrix[col]![i]!;
    }
  }
  return matrix.map(row => row[6]!);
}

function inPhoto(h: Matrix, x: number, y: number, width: number, height: number) {
  const d = h[6] * x + h[7] * y + h[8];
  if (d <= 1e-8) return false;
  const px = (h[0] * x + h[1] * y + h[2]) / d, py = (h[3] * x + h[4] * y + h[5]) / d;
  return px >= 0 && py >= 0 && px <= width && py <= height;
}

/** One model per photographed sheet, independent of crop, frame content and output size.
 * Only margins/gaps outside the full cells are paper references. Local bright
 * quantiles suppress labels and dirt; a smooth field avoids following drawn marks. */
export function estimatePaper(source: Raster, original: { width: number; height: number }, h: Matrix, settings: SheetSettings): PaperModel {
  const { W, H } = settings, layout = buildLayout(settings);
  const scale = 540 / Math.max(W, H);
  const raster = sampleRect(source, original, h, { x: 0, y: 0, w: W, h: H }, Math.max(1, Math.round(W * scale)), Math.max(1, Math.round(H * scale)));
  const cols = Math.min(28, Math.max(6, Math.ceil(W / 14))), rows = Math.min(28, Math.max(6, Math.ceil(H / 14)));
  const bins: { x: number; y: number; rgb: number[]; light: number }[][] = Array.from({ length: cols * rows }, () => []);
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    const mx = (x + .5) * W / raster.width, my = (y + .5) * H / raster.height;
    if (mx < 4 || my < 4 || mx > W - 4 || my > H - 4 || !inPhoto(h, mx, my, original.width, original.height)) continue;
    if (layout.markers.some(m => Math.abs(mx - m.x) < settings.markSize / 2 + 2 && Math.abs(my - m.y) < settings.markSize / 2 + 2)) continue;
    if (layout.cells.some(({ cell }) => mx >= cell.x - 1 && my >= cell.y - 1 && mx <= cell.x + cell.w + 1 && my <= cell.y + cell.h + 1)) continue;
    const i = (y * raster.width + x) * 4;
    const rgb = [raster.data[i]!, raster.data[i + 1]!, raster.data[i + 2]!];
    const light = .2126 * rgb[0]! + .7152 * rgb[1]! + .0722 * rgb[2]!;
    if (light < 30) continue;
    const bin = Math.floor(my / H * rows) * cols + Math.floor(mx / W * cols);
    bins[bin]!.push({ x: mx / W * 2 - 1, y: my / H * 2 - 1, rgb, light });
  }
  let samples: PaperSample[] = bins.filter(bin => bin.length >= 8).map(bin => {
    bin.sort((a, b) => a.light - b.light);
    const bright = bin.slice(Math.floor(bin.length * .65), Math.max(Math.floor(bin.length * .9), Math.floor(bin.length * .65) + 1));
    return { x: bright.reduce((sum, p) => sum + p.x, 0) / bright.length, y: bright.reduce((sum, p) => sum + p.y, 0) / bright.length, rgb: [0, 1, 2].map(c => median(bright.map(p => p.rgb[c]!))) };
  });
  const supported = samples.length >= 12 && Math.max(...samples.map(s => s.x)) - Math.min(...samples.map(s => s.x)) > 1 && Math.max(...samples.map(s => s.y)) - Math.min(...samples.map(s => s.y)) > 1;
  if (!supported) return { W, H, h, photoWidth: original.width, photoHeight: original.height, paper: [255, 255, 255], coefficients: [[255, 0, 0, 0, 0, 0], [255, 0, 0, 0, 0, 0], [255, 0, 0, 0, 0, 0]], samples: samples.length, supported: false, note: 'Not enough blank paper is visible to estimate lighting. Automatic corrections are skipped for this sheet; global sliders still apply.' };
  let coefficients = [0, 1, 2].map(c => fit(samples, c));
  // Remove isolated contaminated reference tiles, keeping broad illumination changes.
  const residuals = samples.map(s => Math.abs(s.rgb[1]! - evaluate(coefficients[1]!, basis(s.x, s.y))));
  const limit = Math.max(12, median(residuals) * 4);
  const clean = samples.filter((_, i) => residuals[i]! <= limit);
  if (clean.length >= samples.length * .75 && clean.length >= 12) { samples = clean; coefficients = [0, 1, 2].map(c => fit(samples, c)); }
  const model: PaperModel = { W, H, h, photoWidth: original.width, photoHeight: original.height, paper: [0, 1, 2].map(c => median(samples.map(s => s.rgb[c]!))), coefficients, samples: samples.length, supported: true, note: 'Lighting estimated from blank paper across this sheet. The same correction is used for every frame.' };
  // Analyze all physical cells together, independent of playback, crop, total
  // frame count and output size. Never auto-level individual animation frames.
  const ink = new Uint32Array(256), paper = new Uint32Array(256);
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    const mx = (x + .5) * W / raster.width, my = (y + .5) * H / raster.height;
    if (mx < 4 || my < 4 || mx > W - 4 || my > H - 4 || !inPhoto(h, mx, my, original.width, original.height)) continue;
    if (layout.markers.some(m => Math.abs(mx - m.x) < settings.markSize / 2 + 2 && Math.abs(my - m.y) < settings.markSize / 2 + 2)) continue;
    const rgb = [0, 1, 2].map(c => paperValue(raster.data[(y * raster.width + x) * 4 + c]!, c, mx / W * 2 - 1, my / H * 2 - 1, model, true, true));
    const light = Math.round(clamp(.2126 * rgb[0]! + .7152 * rgb[1]! + .0722 * rgb[2]!));
    const inCell = layout.cells.some(({ cell }) => mx >= cell.x - 1 && my >= cell.y - 1 && mx <= cell.x + cell.w + 1 && my <= cell.y + cell.h + 1);
    if (inCell && light < 180) ink[light]!++;
    if (!inCell && light >= 190) paper[light]!++;
  }
  model.autoLevels = { black: clamp(quantile(ink, .1, 0) - 5, 0, 60), white: clamp(quantile(paper, .1, 245) - 8, 215, 245) };
  return model;
}

/** Correct an already sampled crop in sheet coordinates, without modifying the source. */
export function adjustRaster(source: Raster, rect: Rect, model: PaperModel, adjustments: Adjustments): Raster {
  validateAdjustments(adjustments);
  const a = adjustments, data = new Uint8ClampedArray(source.data.length);
  const sharpen = a.sharpenEnabled && a.sharpen > 0;
  const auto = a.autoAdjust && model.supported ? model.autoLevels : undefined;
  const flatten = (a.flatten || a.autoAdjust) && model.supported, whiteBalance = (a.whiteBalance || a.autoAdjust) && model.supported;
  for (let y = 0; y < source.height; y++) {
    const my = rect.y + (y + .5) * rect.h / source.height, ny = my / model.H * 2 - 1;
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4, mx = rect.x + (x + .5) * rect.w / source.width, nx = mx / model.W * 2 - 1;
      const valid = mx >= 0 && my >= 0 && mx <= model.W && my <= model.H && inPhoto(model.h, mx, my, model.photoWidth, model.photoHeight);
      const rgb = [0, 1, 2].map(c => {
        const alpha = source.data[i + 3]! / 255;
        let value = source.data[i + c]! * alpha + 255 * (1 - alpha);
        if (valid) value = paperValue(value, c, nx, ny, model, flatten, whiteBalance);
        if (valid && auto) value = clamp((value - auto.black) / (auto.white - auto.black), 0, 1) * 255;
        return Math.pow(clamp((value - a.black) / (a.white - a.black), 0, 1), 1 / a.gamma) * 255;
      });
      const light = .2126 * rgb[0]! + .7152 * rgb[1]! + .0722 * rgb[2]!;
      for (let c = 0; c < 3; c++) data[i + c] = a.thresholdEnabled && !sharpen ? (light < a.threshold ? 0 : 255) : clamp(light + (rgb[c]! - light) * a.saturation / 100);
      data[i + 3] = 255;
    }
  }
  const toned = { width: source.width, height: source.height, data };
  // Threshold is the final operation, so two-tone exports remain exactly binary.
  // It uses pre-saturation light when sharpening is off, preserving old behavior.
  const result = sharpen ? sharpenRaster(toned, rect, a.sharpen) : toned;
  if (a.thresholdEnabled && sharpen) {
    for (let i = 0; i < result.data.length; i += 4) {
      const light = .2126 * result.data[i]! + .7152 * result.data[i + 1]! + .0722 * result.data[i + 2]!;
      const value = light < a.threshold ? 0 : 255;
      result.data[i] = result.data[i + 1] = result.data[i + 2] = value;
    }
  }
  return result;
}
