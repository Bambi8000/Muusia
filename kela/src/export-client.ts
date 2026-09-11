import ExportWorker from './export.worker?worker&inline';
import type { ExportPlan } from './export-plan';
import type { ExportMessage, ExportResult } from './export.worker';
import type { ExportProgress } from './export-gif';

/** Each job owns a worker. Cancellation releases encoder and decoded pixels. */
function request(type: 'probe' | 'export', plan: ExportPlan, onProgress: (value: ExportProgress) => void = () => {}) {
  let stop: (error: Error) => void = () => {};
  const promise = new Promise<ExportResult | 'mp4' | 'webm' | null>((resolve, reject) => {
    const worker = new ExportWorker();
    let timer: ReturnType<typeof setTimeout>, finished = false;
    const finish = (error?: Error, value: ExportResult | 'mp4' | 'webm' | null = null) => {
      if (finished) return;
      finished = true; clearTimeout(timer); worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    stop = finish;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('Export took too long. Try a smaller size.')), 60000); };
    worker.onerror = () => finish(new Error('Export stopped unexpectedly. Try a smaller size or another format.'));
    worker.onmessage = (event: MessageEvent<ExportMessage>) => {
      const message = event.data;
      if (message.type === 'progress') { reset(); onProgress(message.progress); }
      else if (message.type === 'error') finish(new Error(message.message));
      else finish(undefined, message.type === 'support' ? message.format : message.result);
    };
    reset();
    try { worker.postMessage({ type, plan }); }
    catch { finish(new Error('Could not start export. Please try again.')); }
  });
  return { promise, cancel: () => stop(new Error('Export cancelled.')) };
}
export const probeVideo = (plan: ExportPlan) => request('probe', plan);
export const startExport = (plan: ExportPlan, onProgress: (value: ExportProgress) => void) => request('export', plan, onProgress);
