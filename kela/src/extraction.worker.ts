import { sampleRect } from './sampling';
import type { SheetPlan, FrameSpec } from './frames';
import { estimatePaper, adjustRaster } from './adjustments';
import type { Adjustments } from './adjustments';
import type { SheetSettings } from './layout';
import type { Raster } from './sampling';
import { drawingPosition, centeredCrop } from './stabilization';

export type ExtractionMessage = { type: 'frame'; spec: FrameSpec; image: Blob; thumbnail: Blob; warning?: string } | { type: 'done' } | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<{ bitmap: ImageBitmap; plan: SheetPlan; working: Raster; settings: SheetSettings; adjustments: Adjustments; stabilize?: boolean }>) => {
  const { bitmap, plan, working, settings, adjustments, stabilize } = event.data;
  try {
    // Match the live preview's sheet-level estimate, independent of output resolution.
    const model = estimatePaper(working, bitmap, plan.h, settings);
    const sourceCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) throw new Error('Image processing is unavailable in this browser.');
    sourceContext.drawImage(bitmap, 0, 0);
    const source = sourceContext.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close(); sourceCanvas.width = sourceCanvas.height = 1;
    for (const planned of plan.frames) {
      let spec = planned;
      if (stabilize) {
        // The estimate is independent of the chosen output resolution.
        const scale = 480 / Math.max(spec.crop.w, spec.crop.h);
        const preview = sampleRect(source, source, plan.h, spec.crop, Math.max(1, Math.round(spec.crop.w * scale)), Math.max(1, Math.round(spec.crop.h * scale)));
        const position = drawingPosition(preview), crop = position && centeredCrop(spec.crop, position);
        if (!crop) throw new Error(`Source frame ${spec.frame + 1}: could not safely center one isolated drawing. Turn off Stabilize position to keep the plotted motion, or check the crop and photograph.`);
        spec = { ...planned, crop, stabilized: true };
      }
      // No downscaled or rectified sheet sits between the original and the crop.
      const sampled = sampleRect(source, source, plan.h, spec.crop, spec.width, spec.height);
      const raster = adjustRaster(sampled, spec.crop, model, adjustments);
      const canvas = new OffscreenCanvas(spec.width, spec.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Frame rendering is unavailable.');
      const data = context.createImageData(spec.width, spec.height); data.data.set(raster.data);
      context.putImageData(data, 0, 0);
      const scale = Math.min(1, 240 / Math.max(spec.width, spec.height));
      const thumbnailCanvas = new OffscreenCanvas(Math.max(1, Math.round(spec.width * scale)), Math.max(1, Math.round(spec.height * scale)));
      const thumbnailContext = thumbnailCanvas.getContext('2d');
      if (!thumbnailContext) throw new Error('Thumbnail rendering is unavailable.');
      thumbnailContext.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
      const image = await canvas.convertToBlob({ type: 'image/png' });
      const thumbnail = await thumbnailCanvas.convertToBlob({ type: 'image/jpeg', quality: .9 });
      const warning = !model.supported && (adjustments.flatten || adjustments.whiteBalance) ? `Sheet ${spec.sheet + 1}: ${model.note}` : undefined;
      self.postMessage({ type: 'frame', spec, image, thumbnail, warning } satisfies ExtractionMessage);
      canvas.width = canvas.height = thumbnailCanvas.width = thumbnailCanvas.height = 1;
    }
    self.postMessage({ type: 'done' } satisfies ExtractionMessage);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Could not extract this sheet.' } satisfies ExtractionMessage);
  } finally { bitmap.close(); }
};
