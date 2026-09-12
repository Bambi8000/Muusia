import { useEffect, useRef, useState } from 'react';
import { disposePhoto, loadPhoto } from './photos';
import type { Photo, MarkerPoints } from './photos';
import { detectionSettingsKey, startDetection } from './detection-client';
import type { DetectionSettings } from './detection';

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const current = useRef<Photo[]>([]);
  const generation = useRef(0);
  const loading = useRef(false);
  const jobs = useRef(new Map<string, ReturnType<typeof startDetection>>());
  useEffect(() => () => { generation.current++; for (const job of jobs.current.values()) job.cancel(); jobs.current.clear(); current.current.forEach(disposePhoto); }, []);
  function commit(next: Photo[]) { current.current = next; setPhotos(next); }
  function stopDetection(id: string) { jobs.current.get(id)?.cancel(); jobs.current.delete(id); }
  async function detect(id: string, settings: DetectionSettings) {
    const photo = current.current.find(p => p.id === id);
    if (!photo || jobs.current.has(id)) return;
    const settingsKey = detectionSettingsKey(settings);
    const job = startDetection(photo, settings); jobs.current.set(id, job);
    commit(current.current.map(p => p.id === id ? { ...p, detection: { status: 'running', message: 'Finding markers… You can still place them manually.', settingsKey } } : p));
    const result = await job.promise;
    if (jobs.current.get(id) !== job) return;
    jobs.current.delete(id);
    // A late result must never overwrite marker edits made while the worker ran.
    commit(current.current.map(p => p.id !== id || p.points !== photo.points ? p : {
      ...p, points: result.points ?? p.points,
      previousPoints: result.points && p.points.some(Boolean) ? p.points : p.previousPoints,
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
  function setPoints(id: string, points: MarkerPoints) {
    stopDetection(id);
    commit(current.current.map(p => p.id === id ? { ...p, points, previousPoints: undefined, detection: { status: 'edited', message: 'Manual marker positions. Run detection again whenever needed.', settingsKey: p.detection?.settingsKey ?? '' } } : p));
  }
  function undoDetection(id: string) {
    const photo = current.current.find(p => p.id === id);
    if (photo?.previousPoints) setPoints(id, photo.previousPoints);
  }
  return { photos, busy, errors, add, remove, move, setPoints, detect, undoDetection };
}
