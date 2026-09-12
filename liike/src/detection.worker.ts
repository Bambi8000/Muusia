import { detectMarkers } from './detection';
import type { DetectionSettings } from './detection';
import type { Raster } from './sampling';

self.onmessage = (event: MessageEvent<{ raster: Raster; settings: DetectionSettings }>) => {
  try { self.postMessage(detectMarkers(event.data.raster, event.data.settings)); }
  catch { self.postMessage({ status: 'not-found', points: null, candidates: 0, message: 'Automatic detection could not finish. Place the four marker centers manually.' }); }
};
