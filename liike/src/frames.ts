import { buildLayout, framesOnSheet } from './layout.ts';
import type { Rect, SheetSettings } from './layout';
import { registrationTransform } from './homography.ts';
import type { Matrix, Quad } from './homography';
import type { Photo } from './photos';

export type FrameSpec = { id: string; photoId: string; sheet: number; frame: number; cell: number; crop: Rect; width: number; height: number; stabilized?: boolean };
export type SheetPlan = { photoId: string; h: Matrix; frames: FrameSpec[] };
export type ExtractedFrame = FrameSpec & { url: string; thumbnailUrl: string; warning?: string };
type RegisteredPhoto = Pick<Photo, 'id' | 'width' | 'height' | 'points' | 'detection'>;

export function outputSize(crop: Rect, resolution: number) {
  if (!Number.isInteger(resolution) || resolution < 64 || resolution > 2160) throw new Error('Choose a resolution from 64 to 2160 pixels.');
  const scale = resolution / Math.max(crop.w, crop.h);
  return { width: Math.max(1, Math.round(crop.w * scale)), height: Math.max(1, Math.round(crop.h * scale)) };
}

/** The plan uses only occupied cells, in plot order, across all required photos. */
export function planFrames(settings: SheetSettings, photos: RegisteredPhoto[], resolution: number): SheetPlan[] {
  const layout = buildLayout(settings);
  outputSize(layout.cells[0]!.crop, resolution);
  if (photos.length < layout.sheets) throw new Error(`Add ${layout.sheets - photos.length} more sheet photo${layout.sheets - photos.length === 1 ? '' : 's'} in Photos.`);
  return photos.slice(0, layout.sheets).map((photo, sheet) => {
    const prefix = `Sheet ${sheet + 1}: `;
    if (photo.detection?.status === 'running') throw new Error(`${prefix}wait for marker detection to finish.`);
    if (photo.points.some(p => !p)) throw new Error(`${prefix}place all four markers in Register.`);
    const points = photo.points as Quad;
    if (points.some(p => p.x < 0 || p.y < 0 || p.x > photo.width || p.y > photo.height)) throw new Error(`${prefix}keep all marker centers inside the photo.`);
    let h: Matrix;
    try { h = registrationTransform(settings.W, settings.H, points); }
    catch (error) { throw new Error(prefix + (error instanceof Error ? error.message : 'Check the marker positions.')); }
    const frames = framesOnSheet(settings, sheet).map(f => {
      const q = f.crop;
      if ([[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h]].some(([x, y]) => h[6] * x! + h[7] * y! + h[8] <= 1e-8)) throw new Error(`${prefix}reduce padding or check the perspective before extracting frames.`);
      return { id: `${photo.id}:${f.index}`, photoId: photo.id, sheet, frame: f.frame, cell: f.index, crop: q, ...outputSize(q, resolution) };
    });
    return { photoId: photo.id, h, frames };
  });
}

export function releaseFrames(frames: ExtractedFrame[]) {
  for (const frame of frames) { URL.revokeObjectURL(frame.url); URL.revokeObjectURL(frame.thumbnailUrl); }
}
