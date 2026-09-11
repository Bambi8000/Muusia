import ExtractionWorker from './extraction.worker?worker&inline';
import type { ExtractionMessage } from './extraction.worker';
import type { Photo } from './photos';
import type { ExtractedFrame, SheetPlan } from './frames';
import type { SheetSettings } from './layout';
import type { Adjustments } from './adjustments';

/** One full-resolution photo at a time; terminating a job releases worker memory. */
export function startExtraction(photos: Photo[], plans: SheetPlan[], settings: SheetSettings, adjustments: Adjustments, onFrame: (frame: ExtractedFrame) => void, stabilize = false) {
  let worker: Worker | undefined, stopped = false;
  let fail: (error: Error) => void = () => {};
  const cancel = () => { stopped = true; worker?.terminate(); fail(new Error('Extraction cancelled.')); };
  const promise = (async () => {
    try {
      for (const plan of plans) {
        if (stopped) throw new Error('Extraction cancelled.');
        const photo = photos.find(p => p.id === plan.photoId);
        if (!photo) throw new Error('A sheet photo is missing. Add it again in Photos.');
        const bitmap = await createImageBitmap(photo.bitmap);
        if (stopped) { bitmap.close(); throw new Error('Extraction cancelled.'); }
        try { worker = new ExtractionWorker(); }
        catch (error) { bitmap.close(); throw error; }
        const currentWorker = worker;
        await new Promise<void>((resolve, reject) => {
          let timer: ReturnType<typeof setTimeout>;
          const finish = (error?: Error) => { clearTimeout(timer); currentWorker.terminate(); fail = () => {}; if (error) reject(error); else resolve(); };
          const resetTimeout = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('This sheet took too long. Try a lower resolution.')), 60000); };
          fail = finish;
          currentWorker.onerror = () => finish(new Error('Could not process this photo. Try a lower resolution or a browser with image worker support.'));
          currentWorker.onmessage = (event: MessageEvent<ExtractionMessage>) => {
            if (stopped) return;
            const result = event.data;
            if (result.type === 'error') finish(new Error(result.message));
            else if (result.type === 'done') finish();
            else {
              onFrame({ ...result.spec, url: URL.createObjectURL(result.image), thumbnailUrl: URL.createObjectURL(result.thumbnail), warning: result.warning });
              resetTimeout();
            }
          };
          resetTimeout();
          try { currentWorker.postMessage({ bitmap, plan, working: photo.working, settings, adjustments, stabilize }, [bitmap]); }
          catch (error) { bitmap.close(); finish(error instanceof Error ? error : new Error('Could not open the photo for extraction.')); }
        });
        worker = undefined;
      }
    } finally { stopped = true; worker?.terminate(); }
  })();
  return { promise, cancel };
}
