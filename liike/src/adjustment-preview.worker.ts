import { estimatePaper, adjustRaster } from './adjustments';
import type { Adjustments, PaperModel } from './adjustments';
import type { Rect, SheetSettings } from './layout';
import type { Matrix } from './homography';
import { sampleRect } from './sampling';
import type { Raster } from './sampling';
import { paperBackground } from './paper';

type Init = { type: 'init'; raster: Raster; file: File; original: { width: number; height: number }; h: Matrix; settings: SheetSettings };
type Render = { type: 'render'; id: number; rect: Rect; adjustments: Adjustments };
export type AdjustmentPreviewResult = { id: number; before: Blob; after: Blob; width: number; height: number; note: string; supported: boolean } | { id: number; error: string };
let input: Init | null = null, model: PaperModel | null = null, initError = '';
let fullSource: Raster | null = null, ready: Promise<void> = Promise.resolve();

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
    ready = (async () => {
      try {
        model = estimatePaper(message.raster, message.original, message.h, message.settings);
        const bitmap = await createImageBitmap(message.file, { imageOrientation: 'from-image' });
        try {
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) throw new Error('Preview rendering is unavailable in this browser.');
          context.drawImage(bitmap, 0, 0); fullSource = context.getImageData(0, 0, bitmap.width, bitmap.height);
          canvas.width = canvas.height = 1;
        } finally { bitmap.close(); }
      } catch (error) { initError = error instanceof Error ? error.message : 'Could not prepare the photo preview.'; }
    })();
    return;
  }
  try {
    await ready;
    if (!input || !model || !fullSource) throw new Error(initError || 'Preview is not ready.');
    const scale = 1080 / Math.max(message.rect.w, message.rect.h);
    const original = sampleRect(fullSource, fullSource, input.h, message.rect, Math.max(1, Math.round(message.rect.w * scale)), Math.max(1, Math.round(message.rect.h * scale)), paperBackground(input.settings.paperTone));
    const adjusted = adjustRaster(original, message.rect, model, message.adjustments);
    const [before, after] = await Promise.all([blob(original), blob(adjusted)]);
    self.postMessage({ id: message.id, before, after, width: original.width, height: original.height, note: model.note, supported: model.supported } satisfies AdjustmentPreviewResult);
  } catch (error) { self.postMessage({ id: message.id, error: error instanceof Error ? error.message : 'Could not create the preview.' } satisfies AdjustmentPreviewResult); }
};
