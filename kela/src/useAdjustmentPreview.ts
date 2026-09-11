import { useEffect, useMemo, useRef, useState } from 'react';
import PreviewWorker from './adjustment-preview.worker?worker&inline';
import type { AdjustmentPreviewResult } from './adjustment-preview.worker';
import type { Adjustments } from './adjustments';
import type { Photo } from './photos';
import type { Rect, SheetSettings } from './layout';
import type { Matrix } from './homography';

type Preview = { before: string; after: string; width: number; height: number; note: string; supported: boolean; sourceKey: string; id: number };
export function useAdjustmentPreview(photo: Photo, settings: SheetSettings, h: Matrix | null, rect: Rect, adjustments: Adjustments) {
  const analysisSettings = useMemo<SheetSettings>(() => ({ W: settings.W, H: settings.H, cols: settings.cols, rows: settings.rows, margin: settings.margin, gap: settings.gap, markSize: settings.markSize, total: 1, order: 'Row-major', crop: 'Frame window', pad: 0 }), [settings.W, settings.H, settings.cols, settings.rows, settings.margin, settings.gap, settings.markSize]);
  const sourceKey = JSON.stringify([photo.id, analysisSettings, h]);
  const rectKey = JSON.stringify(rect);
  const stableRect = useMemo<Rect>(() => JSON.parse(rectKey), [rectKey]);
  const renderKey = JSON.stringify([sourceKey, stableRect, adjustments]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null), owned = useRef<string[]>([]), latest = useRef(0);
  useEffect(() => {
    setPreview(null); setError('');
    if (!h) return;
    let current: Worker;
    try {
      current = new PreviewWorker(); worker.current = current;
      current.onmessage = (event: MessageEvent<AdjustmentPreviewResult>) => {
        if (event.data.id !== latest.current || worker.current !== current) return;
        const result = event.data;
        setBusy(false);
        if ('error' in result) { setError(result.error); return; }
        const before = URL.createObjectURL(result.before), after = URL.createObjectURL(result.after);
        const old = owned.current; owned.current = [before, after];
        setPreview({ ...result, before, after, sourceKey }); setError('');
        old.forEach(url => URL.revokeObjectURL(url));
      };
      current.onerror = () => { setBusy(false); setError('Could not render the preview. Try reopening Adjust.'); };
      current.postMessage({ type: 'init', raster: photo.working, original: { width: photo.width, height: photo.height }, h, settings: analysisSettings });
    } catch { setError('Image workers are unavailable in this browser.'); }
    return () => { current?.terminate(); worker.current = null; owned.current.forEach(url => URL.revokeObjectURL(url)); owned.current = []; };
  }, [sourceKey, photo.working, photo.width, photo.height, h, analysisSettings]);
  useEffect(() => {
    const id = ++latest.current;
    setBusy(Boolean(worker.current));
    if (!worker.current) return;
    const timer = window.setTimeout(() => worker.current?.postMessage({ type: 'render', id, rect: stableRect, adjustments }), 80);
    return () => clearTimeout(timer);
  }, [renderKey, stableRect, adjustments]);
  return { preview: preview?.sourceKey === sourceKey ? preview : null, error, busy };
}
