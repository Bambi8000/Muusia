import type { CaptureMode } from './layout';

export const MAX_FRAME_NUMBER = 999999;
export type NumberedPhoto = { frameNumber?: number };
export const validFrameNumber = (value: number) => Number.isInteger(value) && value >= 1 && value <= MAX_FRAME_NUMBER;

/** A photo's position is not a number read from the paper. */
export function photoLabel(photo: NumberedPhoto, index: number, mode?: CaptureMode) {
  if (mode !== 'frames') return `Sheet ${index + 1}`;
  return photo.frameNumber === undefined ? `Photo ${index + 1} · number not set` : `Frame ${photo.frameNumber} · Photo ${index + 1}`;
}

export function frameLabel(frame: NumberedPhoto & { captureMode?: CaptureMode; sheet: number; frame: number }) {
  if (frame.captureMode !== 'frames') return `Source frame ${frame.frame + 1}`;
  return frame.frameNumber === undefined ? `Photo ${frame.sheet + 1}` : `Frame ${frame.frameNumber}`;
}

export function frameNumberIssue(photos: NumberedPhoto[]) {
  if (photos.some(p => p.frameNumber === undefined || !validFrameNumber(p.frameNumber))) return 'Set the number printed on each frame before sorting.';
  const seen = new Set<number>();
  for (const photo of photos) {
    if (seen.has(photo.frameNumber!)) return `Frame number ${photo.frameNumber} is used more than once. Check the numbers before sorting.`;
    seen.add(photo.frameNumber!);
  }
  return '';
}

export function sortByFrameNumber<T extends NumberedPhoto>(photos: T[]): T[] {
  const issue = frameNumberIssue(photos);
  if (issue) throw new Error(issue);
  return [...photos].sort((a, b) => a.frameNumber! - b.frameNumber!);
}
