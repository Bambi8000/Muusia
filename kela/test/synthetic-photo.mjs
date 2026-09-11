import { readFileSync } from 'node:fs';

export const SHEET = { W: 297, H: 210 };
export const MARKERS = [{ x: 20, y: 20 }, { x: 277, y: 20 }, { x: 277, y: 190 }, { x: 20, y: 190 }];

// Independent SVG polyline rasterizer for the actual Muusia fixture (M/L/Z).
export function renderSheet({ markSize = 15, holes = 1 } = {}) {
  const scale = 4, width = SHEET.W * scale, height = SHEET.H * scale;
  const data = new Uint8ClampedArray(width * height * 4); data.fill(255);
  const put = (x, y, coverage) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4, value = 255 - 220 * Math.max(0, Math.min(1, coverage));
    for (let c = 0; c < 3; c++) data[i + c] = Math.min(data[i + c], value);
  };
  const line = (a, b) => {
    const x0 = a[0] * scale, y0 = a[1] * scale, x1 = b[0] * scale, y1 = b[1] * scale;
    const dx = x1 - x0, dy = y1 - y0, length2 = dx * dx + dy * dy;
    for (let y = Math.floor(Math.min(y0, y1) - 1.2); y <= Math.ceil(Math.max(y0, y1) + 1.2); y++) for (let x = Math.floor(Math.min(x0, x1) - 1.2); x <= Math.ceil(Math.max(x0, x1) + 1.2); x++) {
      const t = length2 ? Math.max(0, Math.min(1, ((x + .5 - x0) * dx + (y + .5 - y0) * dy) / length2)) : 0;
      put(x, y, .3 * scale / 2 + .5 - Math.hypot(x + .5 - x0 - t * dx, y + .5 - y0 - t * dy));
    }
  };
  const svg = readFileSync(new URL('./animtest.svg', import.meta.url), 'utf8');
  for (const [, d] of svg.matchAll(/<path d="([^"]+)"/g)) {
    if (!/^[MLZ\d.,\s-]+$/.test(d)) throw new Error('Unsupported oracle SVG path.');
    const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    let points = Array.from({ length: n.length / 2 }, (_, i) => [n[i * 2], n[i * 2 + 1]]);
    const marker = MARKERS.find(m => points.every(([x, y]) => Math.abs(x - m.x) <= 7.6 && Math.abs(y - m.y) <= 7.6));
    if (marker) points = points.map(([x, y]) => [marker.x + (x - marker.x) * markSize / 15, marker.y + (y - marker.y) * markSize / 15]);
    for (let i = 1; i < points.length; i++) line(points[i - 1], points[i]);
    if (d.endsWith('Z')) line(points.at(-1), points[0]);
  }
  if (holes === 0) {
    // Repaint TL with the same horizontal hatch, filled through the center.
    const half = markSize / 2;
    for (let y = Math.floor((20 - half - .5) * scale); y <= (20 + half + .5) * scale; y++) for (let x = Math.floor((20 - half - .5) * scale); x <= (20 + half + .5) * scale; x++) data.set([255, 255, 255, 255], (y * width + x) * 4);
    const corners = [[20 - half, 20 - half], [20 + half, 20 - half], [20 + half, 20 + half], [20 - half, 20 + half]];
    corners.forEach((p, i) => line(p, corners[(i + 1) % 4]));
    for (let y = 20 - half + .3; y < 20 + half; y += .6) line([20 - half, y], [20 + half, y]);
  } else if (holes > 1) {
    const m = MARKERS[1], radius = markSize * .2 * scale;
    for (let y = Math.floor(m.y * scale - radius); y <= m.y * scale + radius; y++) for (let x = Math.floor(m.x * scale - radius); x <= m.x * scale + radius; x++) {
      if (Math.hypot(x + .5 - m.x * scale, y + .5 - m.y * scale) < radius) data.set([255, 255, 255, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data, scale };
}

const map = (m, x, y) => { const d = m[6] * x + m[7] * y + m[8]; return { x: (m[0] * x + m[1] * y + m[2]) / d, y: (m[3] * x + m[4] * y + m[5]) / d }; };
function inverse(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const adj = [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
  const determinant = a * adj[0] + b * adj[3] + c * adj[6];
  return adj.map(v => v / determinant);
}

/** Known algebraic warp, independent of the production DLT solver. */
export function syntheticPhoto({ rotation = 0, mirror = false, markSize = 15, holes = 1, noise = 5, vignette = .25, seed = 123, perspective = [.18, -.10], distractors = true } = {}) {
  const sheet = renderSheet({ markSize, holes });
  const width = 1100, height = 1000, scale = 2.55, angle = rotation * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle), p = perspective[0] / SHEET.W, q = perspective[1] / SHEET.H, r = 1 - (perspective[0] + perspective[1]) / 2;
  const cx = width / 2, cy = height / 2;
  let h = [scale * c + cx * p, -scale * s + cx * q, cx * r - scale * c * SHEET.W / 2 + scale * s * SHEET.H / 2,
    scale * s + cy * p, scale * c + cy * q, cy * r - scale * s * SHEET.W / 2 - scale * c * SHEET.H / 2, p, q, r];
  if (mirror) h = [width * h[6] - h[0], width * h[7] - h[1], width * h[8] - h[2], ...h.slice(3)];
  const inv = inverse(h), data = new Uint8ClampedArray(width * height * 4);
  let state = seed >>> 0;
  const rng = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const mm = map(inv, x + .5, y + .5), i = (y * width + x) * 4;
    let value = 68;
    if (mm.x >= 0 && mm.x < SHEET.W && mm.y >= 0 && mm.y < SHEET.H) {
      const sx = Math.max(0, Math.min(sheet.width - 1, mm.x * sheet.scale - .5)), sy = Math.max(0, Math.min(sheet.height - 1, mm.y * sheet.scale - .5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), dx = sx - x0, dy = sy - y0;
      const at = (xx, yy) => sheet.data[(Math.min(sheet.height - 1, yy) * sheet.width + Math.min(sheet.width - 1, xx)) * 4];
      value = at(x0, y0) * (1 - dx) * (1 - dy) + at(x0 + 1, y0) * dx * (1 - dy) + at(x0, y0 + 1) * (1 - dx) * dy + at(x0 + 1, y0 + 1) * dx * dy;
    }
    const light = .90 - vignette * Math.hypot((x - cx) / cx, (y - cy) / cy) + .08 * x / width;
    const jitter = (rng() - .5) * noise;
    data.set([value * light + jitter, value * light * .96 + jitter, value * light * .89 + jitter, 255], i);
  }
  if (distractors) for (const [x0, y0, side] of [[22, 30, 30], [1020, 60, 35], [40, 925, 24], [1000, 920, 42]]) {
    for (let y = y0; y < y0 + side; y++) for (let x = x0; x < x0 + side; x++) data.set([8, 8, 8, 255], (y * width + x) * 4);
  }
  return { raster: { width, height, data }, sheet, h, inverse: inv, points: MARKERS.map(m => map(h, m.x, m.y)), toSheet: point => map(inv, point.x, point.y) };
}
