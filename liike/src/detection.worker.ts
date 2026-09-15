import { detectMarkers } from './detection';
import { detectCloseup } from './closeup-detection';
import type { DetectionSettings } from './detection';
import type { Raster } from './sampling';

self.onmessage = (event: MessageEvent<{ raster: Raster; settings: DetectionSettings }>) => {
  try {
    const { raster, settings } = event.data;
    const cols = settings.cols ?? 0, rows = settings.rows ?? 0, margin = settings.margin ?? NaN, gap = settings.gap ?? NaN;
    self.postMessage(settings.captureMode === 'frames' ? detectCloseup(raster, {
      cw: (settings.W - 2 * margin - (cols - 1) * gap) / cols,
      ch: (settings.H - 2 * margin - (rows - 1) * gap) / rows,
      paperTone: settings.paperTone,
    }) : detectMarkers(raster, settings));
  }
  catch { self.postMessage({ status: 'not-found', points: null, candidates: 0, message: 'Automatic detection could not finish. Place the four marker centers manually.' }); }
};
