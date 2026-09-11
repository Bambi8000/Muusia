import { GIFEncoder, quantize } from './gif-codec.ts';
import { paletteMapper } from './gif-palette.ts';
import { gifDelay } from './export-plan.ts';
import type { ExportPlan } from './export-plan';
import type { Raster } from './sampling';

export type ExportProgress = { phase: string; done: number; total: number };
export async function encodeGif(plan: ExportPlan, read: (index: number) => Promise<Raster>, progress: (value: ExportProgress) => void) {
  const unique = [...new Map(plan.frames.map((frame, i) => [frame.id, i])).values()];
  const perFrame = Math.max(1, Math.floor(200000 / unique.length));
  const count = Math.min(perFrame, plan.width * plan.height);
  const samples = new Uint8Array(unique.length * count * 4);
  for (let i = 0; i < unique.length; i++) {
    const raster = await read(unique[i]!);
    for (let sample = 0; sample < count; sample++) {
      const pixel = Math.floor((sample + .5) * raster.width * raster.height / count);
      samples.set(raster.data.subarray(pixel * 4, pixel * 4 + 4), (i * count + sample) * 4);
    }
    progress({ phase: 'Choosing GIF colors', done: i + 1, total: unique.length });
  }
  const palette = quantize(samples, 256, { format: 'rgb565' });
  const map = paletteMapper(palette, plan.options.dither), gif = GIFEncoder();
  for (let i = 0; i < plan.frames.length; i++) {
    const raster = await read(i);
    gif.writeFrame(map(raster), plan.width, plan.height, { palette: i === 0 ? palette : undefined, delay: gifDelay(i, plan.fps), repeat: plan.loop ? 0 : -1, dispose: 1 });
    progress({ phase: 'Encoding GIF', done: i + 1, total: plan.frames.length });
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
