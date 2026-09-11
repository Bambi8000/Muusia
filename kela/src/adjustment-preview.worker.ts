import { estimatePaper, adjustRaster } from './adjustments';
import type { Adjustments, PaperModel } from './adjustments';
import type { Rect, SheetSettings } from './layout';
import type { Matrix } from './homography';
import { sampleRect } from './sampling';
import type { Raster } from './sampling';

type Init = { type: 'init'; raster: Raster; original: { width: number; height: number }; h: Matrix; settings: SheetSettings };
type Render = { type: 'render'; id: number; rect: Rect; adjustments: Adjustments };
export type AdjustmentPreviewResult = { id: number; before: Blob; after: Blob; width: number; height: number; note: string; supported: boolean } | { id: number; error: string };
let input: Init | null = null, model: PaperModel | null = null, initError = '';

async function blob(raster: Raster) {
  const canvas = new OffscreenCanvas(raster.width, raster.height), context = canvas.getContext('2d');
  if (!context) throw new Error('Preview rendering is unavailable in this browser.');
  const data = context.createImageData(raster.width, raster.height); data.data.set(raster.data); context.putImageData(data, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

self.onmessage = async (event: MessageEvent<Init | Render>) => {
  const message = event.data;
  if (message.type === 'init') {
    input = message; model = null; initError = '';
    try { model = estimatePaper(input.raster, input.original, input.h, input.settings); }
    catch (error) { initError = error instanceof Error ? error.message : 'Could not estimate the paper lighting.'; }
    return;
  }
  try {
    if (!input || !model) throw new Error(initError || 'Preview is not ready.');
    const scale = 640 / Math.max(message.rect.w, message.rect.h);
    const original = sampleRect(input.raster, input.original, input.h, message.rect, Math.max(1, Math.round(message.rect.w * scale)), Math.max(1, Math.round(message.rect.h * scale)));
    const adjusted = adjustRaster(original, message.rect, model, message.adjustments);
    const [before, after] = await Promise.all([blob(original), blob(adjusted)]);
    self.postMessage({ id: message.id, before, after, width: original.width, height: original.height, note: model.note, supported: model.supported } satisfies AdjustmentPreviewResult);
  } catch (error) { self.postMessage({ id: message.id, error: error instanceof Error ? error.message : 'Could not create the preview.' } satisfies AdjustmentPreviewResult); }
};
