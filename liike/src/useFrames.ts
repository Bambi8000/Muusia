import { useEffect, useRef, useState } from 'react';
import { planFrames, releaseFrames } from './frames';
import type { ExtractedFrame } from './frames';
import { startExtraction } from './extraction-client';
import type { SheetSettings } from './layout';
import type { Photo } from './photos';
import type { Adjustments } from './adjustments';
import { validateAdjustments } from './adjustments';

export function useFrames(photos: Photo[], settings: SheetSettings, resolution: number, adjustments: Adjustments, stabilize = false) {
  const key = JSON.stringify([settings, resolution, adjustments, stabilize, photos.map(p => [p.id, p.points])]);
  const [state, setState] = useState<{ key: string; frames: ExtractedFrame[]; busy: boolean; error: string; completed: boolean }>({ key: '', frames: [], busy: false, error: '', completed: false });
  const owned = useRef<ExtractedFrame[]>([]);
  const active = useRef<ReturnType<typeof startExtraction> | null>(null);
  useEffect(() => {
    active.current?.cancel(); active.current = null;
    releaseFrames(owned.current); owned.current = [];
    setState({ key, frames: [], busy: false, error: '', completed: false });
    return () => { active.current?.cancel(); active.current = null; releaseFrames(owned.current); owned.current = []; };
  }, [key]);

  async function extract() {
    if (active.current) return;
    releaseFrames(owned.current); owned.current = [];
    try {
      const plans = planFrames(settings, photos, resolution);
      validateAdjustments(adjustments);
      setState({ key, frames: [], busy: true, error: '', completed: false });
      const job = startExtraction(photos, plans, settings, adjustments, frame => {
        if (active.current !== job) { releaseFrames([frame]); return; }
        owned.current.push(frame);
        setState({ key, frames: [...owned.current], busy: true, error: '', completed: false });
      }, stabilize);
      active.current = job;
      try {
        await job.promise;
        if (active.current !== job) return;
        active.current = null;
        setState({ key, frames: [...owned.current], busy: false, error: '', completed: true });
      } catch (error) {
        if (active.current !== job) return;
        active.current = null; releaseFrames(owned.current); owned.current = [];
        setState({ key, frames: [], busy: false, error: error instanceof Error ? error.message : 'Could not extract frames.', completed: false });
      }
    } catch (error) {
      setState({ key, frames: [], busy: false, error: error instanceof Error ? error.message : 'Check the sheet settings.', completed: false });
    }
  }
  function cancel() {
    active.current?.cancel(); active.current = null;
    releaseFrames(owned.current); owned.current = [];
    setState({ key, frames: [], busy: false, error: 'Extraction cancelled. You can try again.', completed: false });
  }
  return { ...(state.key === key ? state : { frames: [], busy: false, error: '', completed: false }), extract, cancel };
}
