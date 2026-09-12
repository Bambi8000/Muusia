import type { Point } from './homography';
import type { Raster } from './sampling';
import type { DetectionResult } from './detection';

export type MarkerPoints = [Point | null, Point | null, Point | null, Point | null];
export type Photo = {
  id: string; name: string; width: number; height: number;
  bitmap: ImageBitmap; working: Raster; url: string; points: MarkerPoints;
  detection?: { status: DetectionResult['status'] | 'running' | 'edited'; message: string; settingsKey: string };
  previousPoints?: MarkerPoints;
};
export const emptyPoints = (): MarkerPoints => [null, null, null, null];

export function photoFileError(file: { name: string; type: string }): string | null {
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) return 'HEIC is not supported. Export the photo as JPEG and add it again.';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !(file.type === '' && /\.(jpe?g|png|webp)$/i.test(file.name))) return 'Choose a JPEG, PNG or WebP photo.';
  return null;
}

export async function loadPhoto(file: File): Promise<Photo> {
  const error = photoFileError(file);
  if (error) throw new Error(error);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('This photo could not be opened. Try exporting it as a new JPEG or PNG.'); }
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Image processing is unavailable in this browser.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const working = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Photo preview could not be created.')), 'image/jpeg', .92));
    return { id: crypto.randomUUID(), name: file.name, width: bitmap.width, height: bitmap.height, bitmap, working, url: URL.createObjectURL(blob), points: emptyPoints() };
  } catch (error) { bitmap.close(); throw error; }
}

export function disposePhoto(photo: Photo) { photo.bitmap.close(); URL.revokeObjectURL(photo.url); }
