import type { Raster } from './sampling';
import type { Rect } from './layout';
import type { Point } from './homography';

export type DrawingPosition = { center: Point; bounds: Rect };

function mean(input: Float32Array, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(input.length), output = new Float32Array(input.length);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x <= Math.min(width - 1, radius); x++) sum += input[y * width + x]!;
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / (Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1);
      if (x >= radius) sum -= input[y * width + x - radius]!;
      if (x + radius + 1 < width) sum += input[y * width + x + radius + 1]!;
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(height - 1, radius); y++) sum += horizontal[y * width + x]!;
    for (let y = 0; y < height; y++) {
      output[y * width + x] = sum / (Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1);
      if (y >= radius) sum -= horizontal[(y - radius) * width + x]!;
      if (y + radius + 1 < height) sum += horizontal[(y + radius + 1) * width + x]!;
    }
  }
  return output;
}
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** The hull's area center is stable under rotation. A bounding-box center
 * follows the changing silhouette extrema and introduces its own wobble. */
function hullCenter(points: Point[]): Point | null {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (input: Point[]) => {
    const result: Point[] = [];
    for (const point of input) {
      while (result.length >= 2 && cross(result[result.length - 2]!, result[result.length - 1]!, point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  const hull = [...half(points), ...half([...points].reverse())];
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!, b = hull[(i + 1) % hull.length]!, weight = a.x * b.y - b.x * a.y;
    area += weight; x += (a.x + b.x) * weight; y += (a.y + b.y) * weight;
  }
  return area > 4 ? { x: x / (3 * area), y: y / (3 * area) } : null;
}

/** Identify one isolated ink drawing on paper, before any tone adjustments.
 * Return normalized coordinates. Ambiguous/edge-clipped artwork is rejected. */
export function drawingPosition(raster: Raster): DrawingPosition | null {
  const { width, height, data } = raster, count = width * height;
  const gray = new Float32Array(count);
  for (let i = 0; i < count; i++) gray[i] = (data[i * 4]! * .299 + data[i * 4 + 1]! * .587 + data[i * 4 + 2]! * .114) * data[i * 4 + 3]! / 255 + 255 - data[i * 4 + 3]!;
  const smooth = mean(gray, width, height, 1), background = mean(smooth, width, height, Math.max(6, Math.round(Math.max(width, height) / 32)));
  const ink = new Uint8Array(count), connected = new Uint8Array(count);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (background[i]! - smooth[i]! < Math.max(8, background[i]! * .04)) continue;
    ink[i] = 1;
    // Join small pen gaps for component selection, but measure original ink.
    for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++) connected[yy * width + xx] = 1;
  }
  const queue = new Int32Array(count), groups: Point[][] = [];
  for (let start = 0; start < count; start++) {
    if (!connected[start]) continue;
    let head = 0, tail = 1;
    const points: Point[] = [];
    queue[0] = start; connected[start] = 0;
    while (head < tail) {
      const i = queue[head++]!, x = i % width, y = Math.floor(i / width);
      if (ink[i]) points.push({ x: x + .5, y: y + .5 });
      for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (xx! < 0 || xx! >= width || yy! < 0 || yy! >= height) continue;
        const next = yy! * width + xx!;
        if (connected[next]) { connected[next] = 0; queue[tail++] = next; }
      }
    }
    if (points.length >= 12) groups.push(points);
  }
  groups.sort((a, b) => b.length - a.length);
  const points = groups[0];
  if (!points || points.length < 24 || groups.slice(1).some(group => group.length > points.length * .12)) return null;
  let left = width, top = height, right = 0, bottom = 0;
  for (const p of points) { left = Math.min(left, p.x); top = Math.min(top, p.y); right = Math.max(right, p.x); bottom = Math.max(bottom, p.y); }
  if (left < 4 || top < 4 || right > width - 4 || bottom > height - 4 || right - left < 5 || bottom - top < 5) return null;
  const center = hullCenter(points);
  if (!center) return null;
  return { center: { x: center.x / width, y: center.y / height }, bounds: { x: left / width, y: top / height, w: (right - left) / width, h: (bottom - top) / height } };
}

/** Shift the sampling rectangle in sheet mm, preserving size and perspective.
 * Extraction still samples the original photograph exactly once at full size. */
export function centeredCrop(crop: Rect, position: DrawingPosition): Rect | null {
  const dx = position.center.x - .5, dy = position.center.y - .5, b = position.bounds;
  if (Math.abs(dx) > .25 || Math.abs(dy) > .25 || b.x - dx < .01 || b.y - dy < .01 || b.x + b.w - dx > .99 || b.y + b.h - dy > .99) return null;
  return { ...crop, x: crop.x + dx * crop.w, y: crop.y + dy * crop.h };
}
