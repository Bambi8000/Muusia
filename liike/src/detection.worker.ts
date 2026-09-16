import { detectMarkers } from './detection';
import { detectCloseup } from './closeup-detection';
import type { DetectionSettings } from './detection';
import type { Raster } from './sampling';
import { detectFrameNumber } from './number-detection';
import type { Quad } from './homography';
import type { DetectionResult } from './detection';

self.onmessage = (event: MessageEvent<{ raster: Raster; settings: DetectionSettings; numberOnly?: boolean; points?: Quad }>) => {
  try {
    const { raster, settings } = event.data;
    const cols = settings.cols ?? 0, rows = settings.rows ?? 0, margin = settings.margin ?? NaN, gap = settings.gap ?? NaN;
    const geometry = {
      cw: (settings.W - 2 * margin - (cols - 1) * gap) / cols,
      ch: (settings.H - 2 * margin - (rows - 1) * gap) / rows,
      paperTone: settings.paperTone,
    };
    const result: DetectionResult = event.data.numberOnly
      ? { status: 'found', points: event.data.points ?? null, candidates: 0, message: '' }
      : settings.captureMode === 'frames' ? detectCloseup(raster, geometry) : detectMarkers(raster, settings);
    if (settings.captureMode === 'frames') {
      try {
        result.number = result.points ? detectFrameNumber(raster, result.points, geometry) : { status: 'unreadable', message: 'Place the frame corners before reading its printed number.' };
      } catch { result.number = { status: 'unreadable', message: 'Could not read the printed number. Check the corners or enter it manually.' }; }
    }
    self.postMessage(result);
  }
  catch { self.postMessage({ status: 'not-found', points: null, candidates: 0, message: 'Automatic detection could not finish. Place the four marker centers manually.' }); }
};
