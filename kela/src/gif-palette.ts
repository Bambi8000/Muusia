import { applyPalette } from './gif-codec.ts';
import type { Raster } from './sampling';

/** A shared palette and lookup table keep mapping stable throughout the reel. */
export function paletteMapper(palette: number[][], dither: boolean) {
  if (!dither) return (raster: Raster) => applyPalette(raster.data, palette, 'rgb565');
  const lookup = new Uint8Array(65536);
  for (let key = 0; key < lookup.length; key++) {
    const r = (key >> 11) * 255 / 31, g = ((key >> 5) & 63) * 255 / 63, b = (key & 31) * 255 / 31;
    let best = Infinity, index = 0;
    palette.forEach((p, i) => { const distance = (r - p[0]!) ** 2 + (g - p[1]!) ** 2 + (b - p[2]!) ** 2; if (distance < best) { best = distance; index = i; } });
    lookup[key] = index;
  }
  return ({ data, width, height }: Raster) => {
    const output = new Uint8Array(width * height);
    let current = new Float32Array((width + 2) * 3), next = new Float32Array((width + 2) * 3);
    for (let y = 0; y < height; y++) {
      const direction = y % 2 ? -1 : 1;
      for (let step = 0; step < width; step++) {
        const x = direction === 1 ? step : width - 1 - step, offset = (y * width + x) * 4, e = (x + 1) * 3;
        const rgb = [0, 1, 2].map(c => Math.max(0, Math.min(255, data[offset + c]! + current[e + c]!)));
        const key = (Math.round(rgb[0]! * 31 / 255) << 11) | (Math.round(rgb[1]! * 63 / 255) << 5) | Math.round(rgb[2]! * 31 / 255);
        const index = lookup[key]!; output[y * width + x] = index;
        for (let c = 0; c < 3; c++) {
          const error = rgb[c]! - palette[index]![c]!;
          current[e + direction * 3 + c]! += error * 7 / 16;
          next[e - direction * 3 + c]! += error * 3 / 16;
          next[e + c]! += error * 5 / 16;
          next[e + direction * 3 + c]! += error / 16;
        }
      }
      [current, next] = [next, current]; next.fill(0);
    }
    return output;
  };
}
