import type { Raster } from './sampling';
import type { Rect } from './layout';

/** Luminance unsharp mask. A sheet-space radius keeps the effect comparable
 * across preview/export sizes. Local extrema limit new light/dark halos. */
export function sharpenRaster(source: Raster, rect: Rect, amount: number): Raster {
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) throw new Error('Check the sharpening strength.');
  if (amount === 0) return { ...source, data: new Uint8ClampedArray(source.data) };
  const { width, height } = source, count = width * height;
  const light = new Float32Array(count), horizontal = new Float32Array(count);
  for (let i = 0; i < count; i++) light[i] = .2126 * source.data[i * 4]! + .7152 * source.data[i * 4 + 1]! + .0722 * source.data[i * 4 + 2]!;
  const sigma = Math.max(.5, Math.min(3, .1 * Math.sqrt(width / rect.w * height / rect.h)));
  const radius = Math.ceil(3 * sigma), kernel = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-.5 * ((i - radius) / sigma) ** 2));
  const sum = kernel.reduce((a, b) => a + b, 0);
  for (let i = 0; i < kernel.length; i++) kernel[i]! /= sum;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = 0;
    for (let k = -radius; k <= radius; k++) value += light[y * width + Math.max(0, Math.min(width - 1, x + k))]! * kernel[k + radius]!;
    horizontal[y * width + x] = value;
  }
  const data = new Uint8ClampedArray(source.data), strength = amount / 50;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, original = light[i]!;
    let blurred = 0, low = original, high = original;
    for (let k = -radius; k <= radius; k++) blurred += horizontal[Math.max(0, Math.min(height - 1, y + k)) * width + x]! * kernel[k + radius]!;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
      const value = light[yy * width + xx]!; low = Math.min(low, value); high = Math.max(high, value);
    }
    const detail = original - blurred;
    // Leave low-contrast paper grain alone; soft threshold avoids a hard edge.
    if (high - low < 12 || Math.abs(detail) <= 2) continue;
    const target = Math.max(low, Math.min(high, original + Math.sign(detail) * (Math.abs(detail) - 2) * strength));
    const delta = target - original;
    for (let c = 0; c < 3; c++) data[i * 4 + c] = source.data[i * 4 + c]! + delta;
  }
  return { width, height, data };
}
