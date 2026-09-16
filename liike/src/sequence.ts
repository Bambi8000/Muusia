import { frameNumberIssue } from './frame-number.ts';

export type SequenceOrder = 'Original' | 'Frame number' | 'Reverse' | 'Ping-pong' | 'Manual';
export type SequenceSettings = { order: SequenceOrder; manual: string[]; excluded: string[]; fps: number; loop: boolean };
export const INITIAL_SEQUENCE: SequenceSettings = { order: 'Original', manual: [], excluded: [], fps: 12, loop: true };

type SequenceFrame = { id: string; frameNumber?: number; captureMode?: string };
const usesNumbers = (frames: SequenceFrame[], settings: SequenceSettings) => settings.order === 'Frame number' || (frames.some(f => f.captureMode === 'frames') && ['Reverse', 'Ping-pong'].includes(settings.order));
export function sequenceOrderIssue(frames: SequenceFrame[], settings: SequenceSettings) {
  return usesNumbers(frames, settings) ? frameNumberIssue(frames.filter(f => !settings.excluded.includes(f.id))) : '';
}

export function orderedFrames<T extends SequenceFrame>(frames: T[], settings: SequenceSettings): T[] {
  const base = usesNumbers(frames, settings) ? [...frames].sort((a, b) => (a.frameNumber ?? Infinity) - (b.frameNumber ?? Infinity)) : frames;
  if (settings.order === 'Reverse') return [...base].reverse();
  if (settings.order === 'Manual') {
    const byId = new Map(frames.map(frame => [frame.id, frame]));
    const order = [...new Set([...settings.manual, ...frames.map(f => f.id)])];
    return order.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  }
  return base;
}

/** The same timeline will feed playback and the later exporters. */
export function timelineFrames<T extends SequenceFrame>(frames: T[], settings: SequenceSettings): T[] {
  const excluded = new Set(settings.excluded);
  const included = orderedFrames(frames, settings).filter(f => !excluded.has(f.id));
  return settings.order === 'Ping-pong' ? [...included, ...included.slice(1, -1).reverse()] : included;
}

export function moveFrame(ids: string[], from: string, to: string): string[] {
  const a = ids.indexOf(from), b = ids.indexOf(to);
  if (a < 0 || b < 0 || a === b) return ids;
  const next = [...ids]; next.splice(a, 1); next.splice(b, 0, from); return next;
}

export function playbackPosition(start: number, elapsedMs: number, fps: number, length: number, loop: boolean) {
  if (length === 0) return { index: 0, ended: true };
  const advance = Math.floor(Math.max(0, elapsedMs) * fps / 1000);
  const index = Math.max(0, Math.min(start, length - 1)) + advance;
  return { index: loop ? index % length : Math.min(index, length - 1), ended: !loop && index >= length };
}
