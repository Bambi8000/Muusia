import type { Matrix, Point } from './homography';
import type { ReceiptAspect, Rect } from './layout';

type RegisteredImage = { h: Matrix; width: number; height: number };
type Plane = { a: number; b: number; c: number };

/** Half-planes of the original photo, expressed in L-mark coordinates. */
function photoPlanes(image: RegisteredImage): Plane[] {
  const [a, b, c, d, e, f, g, h, i] = image.h;
  const left = 2, top = 2, right = image.width - 2, bottom = image.height - 2;
  return [
    { a: a - left * g, b: b - left * h, c: c - left * i },
    { a: right * g - a, b: right * h - b, c: right * i - c },
    { a: d - top * g, b: e - top * h, c: f - top * i },
    { a: bottom * g - d, b: bottom * h - e, c: bottom * i - f },
    { a: g, b: h, c: i - 1e-8 },
  ];
}

function clip(polygon: Point[], plane: Plane): Point[] {
  const value = (p: Point) => plane.a * p.x + plane.b * p.y + plane.c;
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i]!, next = polygon[(i + 1) % polygon.length]!;
    const v0 = value(current), v1 = value(next);
    if (v0 >= -1e-8) result.push(current);
    if ((v0 < -1e-8 && v1 > 1e-8) || (v0 > 1e-8 && v1 < -1e-8)) {
      const t = v0 / (v0 - v1);
      result.push({ x: current.x + t * (next.x - current.x), y: current.y + t * (next.y - current.y) });
    }
  }
  return result;
}

/** Largest common area that includes all four L marks, with no blank photo edges. */
export function sharedPhotoCrop(images: RegisteredImage[], frameWidth: number, frameHeight: number, aspect: ReceiptAspect): Rect {
  if (!images.length) throw new Error('Add receipt photographs before aligning them.');
  const ratio = aspect === '9:16' ? 9 / 16 : 3 / 4;
  const planes = images.flatMap(photoPlanes);
  const feasible = (height: number): Point[] => {
    const width = height * ratio;
    if (height < frameHeight || width < frameWidth) return [];
    let polygon: Point[] = [
      { x: frameWidth - width, y: frameHeight - height }, { x: 0, y: frameHeight - height },
      { x: 0, y: 0 }, { x: frameWidth - width, y: 0 },
    ];
    for (const plane of planes) {
      // The minimum of a linear function on a rectangle occurs at a corner.
      polygon = clip(polygon, { a: plane.a, b: plane.b, c: plane.c + height * (Math.min(0, plane.a * ratio) + Math.min(0, plane.b)) });
      if (!polygon.length) return [];
    }
    return polygon;
  };
  const minimum = Math.max(frameHeight, frameWidth / ratio);
  if (!feasible(minimum).length) throw new Error(`The photos do not share enough space for ${aspect} around all four L marks. Choose the other output shape or retake the tightest photo.`);
  let low = minimum, high = Math.max(frameWidth, frameHeight) * 10;
  for (let i = 0; i < 42; i++) {
    const mid = (low + high) / 2;
    if (feasible(mid).length) low = mid;
    else high = mid;
  }
  const height = Math.max(minimum, low * .997);
  const polygon = feasible(height);
  if (!polygon.length) throw new Error('Could not find a shared photo area. Check the L-mark positions.');
  const x = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
  const y = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
  return { x, y, w: height * ratio, h: height };
}
