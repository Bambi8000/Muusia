import { useEffect, useRef, useState } from 'react';
import { disposePhoto, loadPhoto } from './photos';
import type { Photo, MarkerPoints } from './photos';
import { detectionSettingsKey, startDetection } from './detection-client';
import type { DetectionSettings } from './detection';
import type { CaptureMode } from './layout';
import { sortByFrameNumber, validFrameNumber } from './frame-number';

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const current = useRef<Photo[]>([]);
  const generation = useRef(0);
  const loading = useRef(false);
  const jobs = useRef(new Map<string, ReturnType<typeof startDetection>>());
  const numberEdits = useRef(new Map<string, number>());
  useEffect(() => () => { generation.current++; for (const job of jobs.current.values()) job.cancel(); jobs.current.clear(); current.current.forEach(disposePhoto); }, []);
  function commit(next: Photo[]) { current.current = next; setPhotos(next); }
  function stopDetection(id: string) { jobs.current.get(id)?.cancel(); jobs.current.delete(id); }
  async function detect(id: string, settings: DetectionSettings, numberOnly = false) {
    const photo = current.current.find(p => p.id === id);
    if (!photo || jobs.current.has(id)) return;
    const settingsKey = detectionSettingsKey(settings);
    const edit = numberEdits.current.get(id);
    const job = startDetection(photo, settings, numberOnly); jobs.current.set(id, job);
    commit(current.current.map(p => p.id === id ? { ...p,
      ...(settings.captureMode === 'frames' ? { numberDetection: { status: 'running' as const, message: 'Reading the printed number…' } } : {}),
      ...(!numberOnly ? { detection: { status: 'running' as const, message: `Finding ${settings.captureMode === 'frames' ? 'frame corners' : 'markers'}… You can still place them manually.`, settingsKey } } : {}),
    } : p));
    const result = await job.promise;
    if (jobs.current.get(id) !== job) return;
    jobs.current.delete(id);
    const numberResult = result.number ?? { status: 'unreadable' as const, message: 'Could not read the number. Enter it manually or try again.' };
    const numberPatch = (p: Photo) => settings.captureMode !== 'frames' || numberEdits.current.get(id) !== edit ? {} : {
      numberDetection: numberResult,
      frameNumber: numberResult.status === 'found' && (numberOnly || p.frameNumber === undefined) ? numberResult.value : p.frameNumber,
    };
    if (numberOnly) { commit(current.current.map(p => p.id === id ? { ...p, ...numberPatch(p) } : p)); return; }
    // A late result must never overwrite marker edits made while the worker ran.
    commit(current.current.map(p => p.id !== id || p.points !== photo.points ? p : {
      ...p, ...numberPatch(p), points: result.points ?? ((p.registrationMode ?? 'sheet') === (settings.captureMode ?? 'sheet') ? p.points : [null, null, null, null]),
      registrationMode: settings.captureMode ?? 'sheet',
      previousPoints: result.points && p.points.some(Boolean) && (p.registrationMode ?? 'sheet') === (settings.captureMode ?? 'sheet') ? p.points : undefined,
      detection: { status: result.status, message: result.message, settingsKey },
    }));
  }
  async function add(files: File[], replaceId?: string, settings?: DetectionSettings) {
    if (loading.current) return;
    loading.current = true; setBusy(true); setErrors([]);
    const token = generation.current;
    const failures: string[] = [];
    for (const file of replaceId ? files.slice(0, 1) : files) {
      try {
        const photo = await loadPhoto(file);
        if (token !== generation.current) { disposePhoto(photo); return; }
        if (replaceId) {
          const old = current.current.find(p => p.id === replaceId);
          if (!old) { disposePhoto(photo); continue; }
          stopDetection(old.id);
          photo.frameNumber = old.frameNumber;
          commit(current.current.map(p => p.id === replaceId ? photo : p)); disposePhoto(old);
        } else commit([...current.current, photo]);
        if (settings) await detect(photo.id, settings);
      } catch (error) { failures.push(`${file.name}: ${error instanceof Error ? error.message : 'Could not load photo.'}`); }
    }
    if (token === generation.current) { setErrors(failures); setBusy(false); loading.current = false; }
  }
  function remove(id: string) {
    stopDetection(id);
    const photo = current.current.find(p => p.id === id);
    commit(current.current.filter(p => p.id !== id));
    if (photo) disposePhoto(photo);
  }
  function move(id: string, delta: number) {
    const next = [...current.current], index = next.findIndex(p => p.id === id), target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!]; commit(next);
  }
  function setFrameNumber(id: string, frameNumber: number | undefined) {
    if (frameNumber !== undefined && !validFrameNumber(frameNumber)) return;
    numberEdits.current.set(id, (numberEdits.current.get(id) ?? 0) + 1);
    commit(current.current.map(p => p.id === id ? { ...p, frameNumber, numberDetection: undefined } : p));
  }
  async function readMissingNumbers(settings: DetectionSettings) {
    if (loading.current) return;
    loading.current = true; setBusy(true);
    const token = generation.current;
    try {
      for (const photo of current.current.filter(p => p.frameNumber === undefined)) {
        if (token !== generation.current) return;
        await detect(photo.id, settings, true);
      }
    } finally { if (token === generation.current) { loading.current = false; setBusy(false); } }
  }
  function sortNumbers() { commit(sortByFrameNumber(current.current)); }
  function setPoints(id: string, points: MarkerPoints, registrationMode?: CaptureMode) {
    stopDetection(id);
    commit(current.current.map(p => p.id === id ? { ...p, points, numberDetection: undefined, registrationMode: registrationMode ?? p.registrationMode ?? 'sheet', previousPoints: undefined, detection: { status: 'edited', message: 'Manual corner positions. Run detection again whenever needed.', settingsKey: p.detection?.settingsKey ?? '' } } : p));
  }
  function undoDetection(id: string) {
    const photo = current.current.find(p => p.id === id);
    if (photo?.previousPoints) setPoints(id, photo.previousPoints);
  }
  function replaceAll(next: Photo[]) {
    generation.current++;
    for (const job of jobs.current.values()) job.cancel();
    jobs.current.clear();
    const old = current.current;
    commit(next); old.forEach(disposePhoto);
    loading.current = false; setBusy(false); setErrors([]);
  }
  return { photos, busy, errors, add, remove, move, setPoints, detect, undoDetection, replaceAll, setFrameNumber, sortNumbers, readMissingNumbers };
}
