// PDF.js operator lists are vector instructions. Raster images and glyph outlines
// are deliberately excluded: this node imports drawn page geometry only.
const MM_PER_POINT = 25.4 / 72;
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const point = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const curve = (a, b, c, d, out) => {
  const len = Math.hypot(d[0] - a[0], d[1] - a[1]) + Math.hypot(b[0] - a[0], b[1] - a[1])
    + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(d[0] - c[0], d[1] - c[1]);
  const steps = Math.max(4, Math.min(128, Math.ceil(len / 1.2)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*d[0],
      u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*d[1]]);
  }
};

export function pathsFromOperatorList(list, OPS, viewport) {
  const paths = [], stack = [];
  let ctm = [1, 0, 0, 1, 0, 0], colorIdx = 0;
  let pointCount = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (pts, closed) => {
    if (pts.length < 2) return;
    pointCount += pts.length;
    if (paths.length >= 120000 || pointCount > 250000) throw new Error("PDF page contains too many vector points");
    if (!pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) return;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    paths.push({ pts, closed, colorIdx });
  };
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i], args = list.argsArray[i];
    if (fn === OPS.save) stack.push([ctm, colorIdx]);
    else if (fn === OPS.restore) { const prev = stack.pop(); if (prev) [ctm, colorIdx] = prev; }
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.setStrokeRGBColor || fn === OPS.setFillRGBColor) {
      const rgb = typeof args[0] === "string" && /^#[0-9a-f]{6}$/i.test(args[0])
        ? [1, 3, 5].map(k => parseInt(args[0].slice(k, k + 2), 16))
        : args.slice(0, 3).map(v => Math.round(v * 255));
      colorIdx = (rgb[0] * 3 + rgb[1] * 5 + rgb[2] * 7) % 12;
    } else if (fn === OPS.constructPath) {
      if (args[0] < OPS.stroke || args[0] > OPS.closeEOFillStroke) continue;
      // Current PDF.js: [painting operator, [compact draw ops], bounds].
      // Older PDF.js: [[path operators], coordinates].
      const draw = Array.isArray(args[1]) && args[1].length === 1 && (Array.isArray(args[1][0]) || ArrayBuffer.isView(args[1][0])) ? args[1][0] : args[1];
      if (!Array.isArray(draw) && !ArrayBuffer.isView(draw)) continue;
      const matrix = mul(viewport.transform, ctm);
      let pts = [], start = null;
      const flush = (closed = false) => { add(pts, closed); pts = []; start = null; };
      for (let j = 0; j < draw.length;) {
        const op = draw[j++];
        if (op === 0) { flush(); const p = point(matrix, draw[j++], draw[j++]); pts = [p]; start = p; }
        else if (op === 1) pts.push(point(matrix, draw[j++], draw[j++]));
        else if (op === 2) {
          const b = point(matrix, draw[j++], draw[j++]), c = point(matrix, draw[j++], draw[j++]), d = point(matrix, draw[j++], draw[j++]);
          if (pts.length) curve(pts.at(-1), b, c, d, pts);
        } else if (op === 3) {
          const b = point(matrix, draw[j++], draw[j++]), d = point(matrix, draw[j++], draw[j++]);
          if (pts.length) curve(pts.at(-1), b, b, d, pts);
        } else if (op === 4) flush(true);
        else break;
      }
      flush();
    }
  }
  return {
    paths,
    bbox: paths.length ? { x: minX, y: minY, w: Math.max(0.01, maxX - minX), h: Math.max(0.01, maxY - minY) }
      : { x: 0, y: 0, w: viewport.width, h: viewport.height },
    width: viewport.width, height: viewport.height,
  };
}

export async function extractPdfVectors(pdfjs, bytes) {
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true });
  const doc = await task.promise;
  const pages = [];
  let totalPoints = 0;
  try {
    if (doc.numPages > 100) throw new Error("PDF has more than 100 pages");
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: MM_PER_POINT });
      const list = await page.getOperatorList();
      const parsed = pathsFromOperatorList(list, pdfjs.OPS, viewport);
      totalPoints += parsed.paths.reduce((n, p) => n + p.pts.length, 0);
      if (totalPoints > 500000) throw new Error("PDF contains too many vector points");
      pages.push(parsed);
      page.cleanup();
    }
    if (!pages.some(p => p.paths.length)) throw new Error("PDF has no vector paths (images and text are not converted)");
    return { pages };
  } finally { await doc.destroy(); }
}
