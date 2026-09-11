import type { Matrix } from './homography';
import type { Rect } from './layout';

export type Raster = { width: number; height: number; data: Uint8ClampedArray };

/** Output pixel centers → sheet mm → original oriented photo → working pixels.
 * alpha is composited onto white, and out-of-image samples remain white. */
export function sampleRect(source: Raster, original: { width: number; height: number }, h: Matrix, rect: Rect, width: number, height: number): Raster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Invalid preview size.');
  const result = new Uint8ClampedArray(width * height * 4);
  result.fill(255);
  const scaleX = source.width / original.width, scaleY = source.height / original.height;
  for (let y = 0; y < height; y++) {
    const my = rect.y + (y + .5) * rect.h / height;
    for (let x = 0; x < width; x++) {
      const mx = rect.x + (x + .5) * rect.w / width;
      const d = h[6] * mx + h[7] * my + h[8];
      if (Math.abs(d) < 1e-12) continue;
      const sx = (h[0] * mx + h[1] * my + h[2]) / d * scaleX - .5;
      const sy = (h[3] * mx + h[4] * my + h[5]) / d * scaleY - .5;
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < -.5 || sy < -.5 || sx > source.width - .5 || sy > source.height - .5) continue;
      const px = Math.max(0, Math.min(source.width - 1, sx)), py = Math.max(0, Math.min(source.height - 1, sy));
      const x0 = Math.floor(px), y0 = Math.floor(py);
      const x1 = Math.min(x0 + 1, source.width - 1), y1 = Math.min(y0 + 1, source.height - 1);
      const dx = px - x0, dy = py - y0;
      const offsets = [(y0 * source.width + x0) * 4, (y0 * source.width + x1) * 4, (y1 * source.width + x0) * 4, (y1 * source.width + x1) * 4];
      const weights = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
      const out = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let value = 0;
        for (let i = 0; i < 4; i++) {
          const alpha = source.data[offsets[i]! + 3]! / 255;
          value += (source.data[offsets[i]! + channel]! * alpha + 255 * (1 - alpha)) * weights[i]!;
        }
        result[out + channel] = value;
      }
    }
  }
  return { width, height, data: result };
}
