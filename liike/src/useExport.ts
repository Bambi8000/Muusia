import { useEffect, useRef, useState } from 'react';
import { probeVideo, startExport } from './export-client';
import type { ExportPlan } from './export-plan';
import type { ExportProgress } from './export-gif';
import type { ExportResult } from './export.worker';

type State = { key: string; busy: boolean; progress: ExportProgress | null; result: (ExportResult & { url: string }) | null; error: string };
export function useExport(plan: ExportPlan | null) {
  const key = JSON.stringify(plan);
  const empty: State = { key, busy: false, progress: null, result: null, error: '' };
  const [state, setState] = useState<State>(empty);
  const active = useRef<ReturnType<typeof startExport> | null>(null);
  const owned = useRef('');
  function clear() {
    active.current?.cancel(); active.current = null;
    if (owned.current) URL.revokeObjectURL(owned.current);
    owned.current = '';
  }
  useEffect(() => { clear(); setState({ key, busy: false, progress: null, result: null, error: '' }); return clear; }, [key]);
  async function create() {
    if (!plan || active.current) return;
    clear(); setState({ ...empty, busy: true });
    const job = startExport(plan, progress => { if (active.current === job) setState({ ...empty, busy: true, progress }); });
    active.current = job;
    try {
      const result = await job.promise;
      if (active.current !== job) return;
      if (!result || typeof result === 'string') throw new Error('No file was produced. Please try again.');
      owned.current = URL.createObjectURL(result.blob);
      active.current = null;
      setState({ ...empty, result: { ...result, url: owned.current } });
    } catch (error) {
      // A cancelled job must not overwrite a newer input's state.
      if (active.current !== job) return;
      active.current = null;
      setState({ ...empty, error: error instanceof Error ? error.message : 'Could not export this sequence.' });
    }
  }
  return { ...(state.key === key ? state : empty), create, cancel: () => { clear(); setState({ ...empty, error: 'Export cancelled. You can try again.' }); } };
}

export function useVideoSupport(plan: ExportPlan | null) {
  const key = plan?.options.format === 'video' ? JSON.stringify([plan.width, plan.height, plan.fps, plan.options.quality, plan.options.videoFormat]) : '';
  const [state, setState] = useState<{ key: string; format: 'mp4' | 'webm' | null }>({ key: '', format: null });
  useEffect(() => {
    if (!key || !plan) return;
    let current = true;
    const job = probeVideo(plan);
    job.promise.then(value => { if (current) setState({ key, format: value === 'mp4' || value === 'webm' ? value : null }); }, () => { if (current) setState({ key, format: null }); });
    return () => { current = false; job.cancel(); };
  }, [key, plan]);
  return { checking: Boolean(key) && state.key !== key, format: state.key === key ? state.format : null };
}
