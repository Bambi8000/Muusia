// Keep visual generator output on the selected sheet without changing its pen order.
// Explicit-coordinate and calibration nodes do not use this helper.
export function fitCanvasPathSets(sets, ctx, { center = false, margin = 0.06, minFill = 0 } = {}) {
  const W = +ctx?.W, H = +ctx?.H;
  if (!(W > 0 && H > 0)) return sets;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const paths of sets) for (const path of paths) for (const pt of path.pts || []) {
    const [x, y] = pt;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return sets;
  const inset = Math.min(12, Math.min(W, H) * margin);
  const usableW = Math.max(1, W - 2 * inset), usableH = Math.max(1, H - 2 * inset);
  const width = Math.max(1e-9, maxX - minX), height = Math.max(1e-9, maxY - minY);
  const maxScale = Math.min(usableW / width, usableH / height);
  const targetScale = minFill > 0 && Math.min(W, H) >= 350
    ? minFill * Math.min(W, H) / Math.max(width, height) : 1;
  const scale = Math.min(maxScale, Math.max(Math.min(1, maxScale), targetScale));
  const outside = minX < inset || minY < inset || maxX > W - inset || maxY > H - inset;
  if (!outside && Math.abs(scale - 1) < 1e-9) return sets;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const halfW = width * scale / 2, halfH = height * scale / 2;
  const targetX = center ? W / 2 : Math.max(inset + halfW, Math.min(W - inset - halfW, cx));
  const targetY = center ? H / 2 : Math.max(inset + halfH, Math.min(H - inset - halfH, cy));
  const tx = targetX - cx * scale;
  const ty = targetY - cy * scale;
  return sets.map(paths => paths.map(path => ({ ...path,
    pts: path.pts.map(pt => [pt[0] * scale + tx, pt[1] * scale + ty, ...pt.slice(2)]),
  })));
}

export function fitCanvasPaths(paths, ctx, options) {
  return fitCanvasPathSets([paths], ctx, options)[0];
}
