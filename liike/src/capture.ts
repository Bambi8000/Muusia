import { buildLayout, framesOnSheet } from './layout.ts';
import type { SheetSettings } from './layout';
import { frameRegistration, registrationTransform } from './homography.ts';
import type { Quad } from './homography';
import type { Photo } from './photos';

export const individualFrames = (settings: SheetSettings) => settings.captureMode === 'frames';
export const requiredPhotos = (settings: SheetSettings) => individualFrames(settings) ? settings.total : buildLayout(settings).sheets;

/** Close-up photos use cell-local millimeters; sheet photos retain sheet coordinates. */
export function photoGeometry(settings: SheetSettings) {
  const layout = buildLayout(settings);
  if (!individualFrames(settings)) return { W: settings.W, H: settings.H, cells: layout.cells };
  const first = layout.cells[0]!;
  const local = (r: typeof first.cell) => ({ ...r, x: r.x - first.cell.x, y: r.y - first.cell.y });
  return { W: layout.cw, H: layout.ch, cells: [{ ...first, cell: local(first.cell), window: local(first.window), crop: local(first.crop) }] };
}

export function framesForPhoto(settings: SheetSettings, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= requiredPhotos(settings)) return [];
  return individualFrames(settings) ? [{ ...photoGeometry(settings).cells[0]!, frame: index }] : framesOnSheet(settings, index);
}

export function photoTransform(settings: SheetSettings, points: Quad) {
  if (!individualFrames(settings)) return registrationTransform(settings.W, settings.H, points);
  const { W, H } = photoGeometry(settings);
  return frameRegistration(W, H, points);
}

/** Never interpret sheet-marker centers as close-up rectangle corners or vice versa. */
export function photoForMode(photo: Photo, settings: SheetSettings): Photo {
  if ((photo.registrationMode ?? 'sheet') === (settings.captureMode ?? 'sheet')) return photo;
  return { ...photo, points: [null, null, null, null], previousPoints: undefined, detection: photo.detection?.status === 'running' ? photo.detection : { status: 'not-found', settingsKey: '', message: 'Capture mode changed. Run detection or place the four corners for this mode.' } };
}
