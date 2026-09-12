import DetectionWorker from './detection.worker?worker&inline';
import type { DetectionResult, DetectionSettings } from './detection';
import type { Quad } from './homography';
import type { Photo } from './photos';

export const detectionSettingsKey = (settings: DetectionSettings) => `${settings.W}/${settings.H}/${settings.markSize}`;

/** Each job owns its worker; cancellation and completion release the copied raster. */
export function startDetection(photo: Photo, settings: DetectionSettings) {
  let finish: (result: DetectionResult) => void = () => {};
  const fallback: DetectionResult = { status: 'not-found', points: null, candidates: 0, message: 'Automatic detection is unavailable. Place the four marker centers manually.' };
  const promise = new Promise<DetectionResult>(resolve => {
    let worker: Worker | undefined, timer: ReturnType<typeof setTimeout> | undefined, done = false;
    finish = result => {
      if (done) return; done = true;
      if (timer) clearTimeout(timer); worker?.terminate();
      resolve(result);
    };
    try {
      worker = new DetectionWorker();
      worker.onmessage = (event: MessageEvent<DetectionResult>) => {
        const result = event.data;
        const points = result.points?.map(p => ({ x: p.x * photo.width / photo.working.width, y: p.y * photo.height / photo.working.height })) as Quad | undefined;
        finish({ ...result, points: points ?? null });
      };
      worker.onerror = () => finish(fallback);
      timer = setTimeout(() => finish({ ...fallback, message: 'Detection took too long. Try a clearer photo or place the centers manually.' }), 15000);
      // Structured cloning preserves the full working raster for preview/sampling.
      worker.postMessage({ raster: { width: photo.working.width, height: photo.working.height, data: photo.working.data }, settings });
    } catch { finish(fallback); }
  });
  return { promise, cancel: () => finish(fallback) };
}
