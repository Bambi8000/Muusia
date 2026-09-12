import { project, solveHomography } from './homography.ts';
import type { Point, Quad } from './homography';
import type { Raster } from './sampling';

export type DetectionSettings = { W: number; H: number; markSize: number };
export type DetectionResult = {
  status: 'found' | 'not-found' | 'ambiguous' | 'mirrored';
  points: Quad | null;
  message: string;
  candidates: number;
};
type Candidate = Point & { width: number; height: number; area: number; hole: number };

/** Separable box mean with clipped image edges, O(width × height). */
function boxMean(input: Float32Array, w: number, h: number, radius: number): Float32Array {
  const intermediate = new Float32Array(input.length), result = new Float32Array(input.length);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = 0; x <= Math.min(w - 1, radius); x++) sum += input[row + x]!;
    for (let x = 0; x < w; x++) {
      intermediate[row + x] = sum / (Math.min(w - 1, x + radius) - Math.max(0, x - radius) + 1);
      if (x - radius >= 0) sum -= input[row + x - radius]!;
      if (x + radius + 1 < w) sum += input[row + x + radius + 1]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(h - 1, radius); y++) sum += intermediate[y * w + x]!;
    for (let y = 0; y < h; y++) {
      result[y * w + x] = sum / (Math.min(h - 1, y + radius) - Math.max(0, y - radius) + 1);
      if (y - radius >= 0) sum -= intermediate[(y - radius) * w + x]!;
      if (y + radius + 1 < h) sum += intermediate[(y + radius + 1) * w + x]!;
    }
  }
  return result;
}

function holeContrast(gray: Float32Array, w: number, h: number, cx: number, cy: number, size: number) {
  let core = 0, ring = 0, coreCount = 0, ringCount = 0;
  const outer = size * .32, inner = size * .24, center = size * .10;
  for (let y = Math.max(0, Math.floor(cy - outer)); y <= Math.min(h - 1, Math.ceil(cy + outer)); y++) {
    for (let x = Math.max(0, Math.floor(cx - outer)); x <= Math.min(w - 1, Math.ceil(cx + outer)); x++) {
      const r = Math.hypot(x + .5 - cx, y + .5 - cy), value = gray[y * w + x]!;
      if (r <= center) { core += value; coreCount++; }
      else if (r >= inner && r <= outer) { ring += value; ringCount++; }
    }
  }
  return coreCount && ringCount ? core / coreCount - ring / ringCount : 0;
}

function components(gray: Float32Array, local: Float32Array, w: number, h: number): Candidate[] {
  const n = w * h, mask = new Uint8Array(n), queue = new Int32Array(n);
  for (let i = 0; i < n; i++) mask[i] = gray[i]! < local[i]! - 8 ? 1 : 0;
  const candidates: Candidate[] = [];
  let brightest = 0;
  for (const value of gray) brightest = Math.max(brightest, value);
  for (let start = 0; start < n; start++) {
    if (!mask[start]) continue;
    let head = 0, tail = 1, x0 = w, y0 = h, x1 = 0, y1 = 0, wx = 0, wy = 0, weight = 0;
    queue[0] = start; mask[start] = 0;
    while (head < tail) {
      const index = queue[head++]!, x = index % w, y = Math.floor(index / w);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      const ink = Math.max(0, local[index]! - gray[index]!);
      wx += (x + .5) * ink; wy += (y + .5) * ink; weight += ink;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const next = yy * w + xx;
        if (mask[next]) { mask[next] = 0; queue[tail++] = next; }
      }
    }
    if (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1 || tail < n * .00012 || tail > n * .035 || weight === 0) continue;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, aspect = bw / bh, fill = tail / (bw * bh);
    if (aspect < .55 || aspect > 1.8 || fill < .42) continue;
    // Adaptive means near the paper edge bias a local-contrast centroid toward
    // the sheet interior. Refine against one paper level over the whole marker.
    const pad = Math.max(2, Math.round(Math.max(w, h) / 300));
    const left = Math.max(0, x0 - pad), right = Math.min(w - 1, x1 + pad), top = Math.max(0, y0 - pad), bottom = Math.min(h - 1, y1 + pad);
    let paper = 0;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) paper = Math.max(paper, gray[y * w + x]!);
    if (paper < brightest * .55) continue;
    // Fit a local paper plane using bright pixels around the marker. A single
    // maximum paper value gives slanted illumination a spurious ink centroid.
    const cx = (left + right + 1) / 2, cy = (top + bottom + 1) / 2;
    let count = 0, sx = 0, sy = 0, sz = 0, xx = 0, xy = 0, yy = 0, xz = 0, yz = 0;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const value = gray[y * w + x]!;
      if (value < paper - 12) continue;
      const dx = x + .5 - cx, dy = y + .5 - cy;
      count++; sx += dx; sy += dy; sz += value; xx += dx * dx; xy += dx * dy; yy += dy * dy; xz += dx * value; yz += dy * value;
    }
    const sampleCount = Math.max(1, count), cxx = xx - sx * sx / sampleCount, cyy = yy - sy * sy / sampleCount, cxy = xy - sx * sy / sampleCount;
    const cxz = xz - sx * sz / sampleCount, cyz = yz - sy * sz / sampleCount, determinant = cxx * cyy - cxy * cxy;
    const slopeX = determinant > 1e-6 ? (cxz * cyy - cyz * cxy) / determinant : 0;
    const slopeY = determinant > 1e-6 ? (cyz * cxx - cxz * cxy) / determinant : 0;
    const level = count ? (sz - slopeX * sx - slopeY * sy) / sampleCount : paper;
    wx = 0; wy = 0; weight = 0;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const ink = Math.max(0, level + slopeX * (x + .5 - cx) + slopeY * (y + .5 - cy) - gray[y * w + x]! - 2);
      wx += (x + .5) * ink; wy += (y + .5) * ink; weight += ink;
    }
    if (!weight) continue;
    const x = wx / weight, y = wy / weight;
    if (x > w * .3 && x < w * .7 && y > h * .3 && y < h * .7) continue;
    candidates.push({ x, y, width: bw, height: bh, area: tail, hole: holeContrast(gray, w, h, x, y, Math.min(bw, bh)) });
  }
  return candidates.sort((a, b) => b.area - a.area).slice(0, 24);
}

function shapeError(points: Candidate[], settings: DetectionSettings, halo: number): number {
  const { W, H, markSize: size } = settings;
  const source: Quad = [{ x: 20, y: 20 }, { x: W - 20, y: 20 }, { x: W - 20, y: H - 20 }, { x: 20, y: H - 20 }];
  try {
    const h = solveHomography(source, [points[0]!, points[1]!, points[2]!, points[3]!]);
    let error = 0;
    for (let i = 0; i < 4; i++) {
      const center = source[i]!, actual = points[i]!;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => project(h, center.x + x! * size / 2, center.y + y! * size / 2));
      const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
      const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
      // Thresholding the box blur expands the square by approximately one
      // blur radius on each side; account for it at small marker sizes too.
      error += Math.abs(Math.log(Math.max(1, actual.width - halo) / bw)) + Math.abs(Math.log(Math.max(1, actual.height - halo) / bh));
    }
    return error / 8;
  } catch { return Infinity; }
}

/** Detect only the four fiducials. Cell geometry is never inferred from artwork. */
export function detectMarkers(raster: Raster, settings: DetectionSettings): DetectionResult {
  const { width: w, height: h, data } = raster;
  const failure = (message: string, status: DetectionResult['status'] = 'not-found', candidates = 0): DetectionResult => ({ status, points: null, message, candidates });
  if (w < 80 || h < 80 || data.length !== w * h * 4 || ![settings.W, settings.H, settings.markSize].every(Number.isFinite) || settings.W <= 40 || settings.H <= 40 || settings.markSize <= 0) return failure('Check the photo and sheet settings, or place the four markers manually.');
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = (data[i * 4]! * .299 + data[i * 4 + 1]! * .587 + data[i * 4 + 2]! * .114) * data[i * 4 + 3]! / 255 + 255 - data[i * 4 + 3]!;
  const blurRadius = Math.max(1, Math.round(Math.max(w, h) / 600));
  const blurred = boxMean(gray, w, h, blurRadius);
  const local = boxMean(blurred, w, h, Math.max(12, Math.round(Math.max(w, h) / 30)));
  const candidates = components(blurred, local, w, h);
  if (candidates.length < 4) return failure('Could not find four clear markers. Keep all four in view, or place their centers manually.', 'not-found', candidates.length);
  const matches: { points: Candidate[]; error: number; mirroredError: number; score: number; hole: number; holeGap: number }[] = [];
  for (let a = 0; a < candidates.length - 3; a++) for (let b = a + 1; b < candidates.length - 2; b++) for (let c = b + 1; c < candidates.length - 1; c++) for (let d = c + 1; d < candidates.length; d++) {
    const group = [candidates[a]!, candidates[b]!, candidates[c]!, candidates[d]!];
    if (Math.max(...group.map(q => q.area)) / Math.min(...group.map(q => q.area)) > 4) continue;
    const cx = group.reduce((v, q) => v + q.x, 0) / 4, cy = group.reduce((v, q) => v + q.y, 0) / 4;
    group.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
    let area = 0, convex = true;
    for (let i = 0; i < 4; i++) {
      const p = group[i]!, q = group[(i + 1) % 4]!, r = group[(i + 2) % 4]!;
      area += p.x * q.y - p.y * q.x;
      if ((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) <= 0 || Math.hypot(p.x - q.x, p.y - q.y) < Math.max(p.width, p.height, q.width, q.height) * 2) convex = false;
    }
    area /= 2;
    if (!convex || area < w * h * .08) continue;
    const holes = [...group].sort((p, q) => q.hole - p.hole);
    const anchor = group.indexOf(holes[0]!);
    const ordered = [...group.slice(anchor), ...group.slice(0, anchor)];
    const error = shapeError(ordered, settings, blurRadius * 2);
    const mirroredError = shapeError([ordered[0]!, ordered[3]!, ordered[2]!, ordered[1]!], settings, blurRadius * 2);
    matches.push({ points: ordered, error, mirroredError, score: Math.min(error, mirroredError) - area / (w * h) * .08, hole: holes[0]!.hole, holeGap: holes[0]!.hole - holes[1]!.hole });
  }
  matches.sort((a, b) => a.score - b.score);
  const best = matches[0];
  if (!best || Math.min(best.error, best.mirroredError) > .24) return failure('The detected shapes do not match this sheet and marker size. Check Sheet settings or place markers manually.', 'not-found', candidates.length);
  if (best.hole < 12 || best.holeGap < 8) return failure('The white-hole marker is unclear. Place TL on the marker with the hole, then continue clockwise.', 'ambiguous', candidates.length);
  if (best.mirroredError + .08 < best.error) return failure('The marker geometry suggests a mirrored photo or swapped sheet dimensions. Check the image and Sheet settings; no automatic flip was applied.', 'mirrored', candidates.length);
  if (Math.abs(best.error - best.mirroredError) < .04) return failure('The sheet orientation is ambiguous. Place the white-hole marker and remaining corners manually.', 'ambiguous', candidates.length);
  const runnerUp = matches.find((m, i) => i > 0 && m.hole >= 12 && m.holeGap >= 8 && Math.abs(m.score - best.score) < .025 && m.points.some(p => !best.points.includes(p)));
  if (runnerUp) return failure('More than one marker group looks plausible. Place the four centers manually.', 'ambiguous', candidates.length);
  return { status: 'found', points: best.points.map(({ x, y }) => ({ x, y })) as Quad, candidates: candidates.length, message: 'Four markers found. Check the frame windows and drag any marker to refine it.' };
}
