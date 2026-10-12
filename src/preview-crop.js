// Preview-only sampling: clip the evaluated drawing, never resize its canvas.
export const DEFAULT_TEST_MARGIN = 10;
export const TEST_PAPERS = [
  { id: "a4-portrait", label: "A4 portrait", w: 210, h: 297 },
  { id: "a4-landscape", label: "A4 landscape", w: 297, h: 210 },
  { id: "a3-portrait", label: "A3 portrait", w: 297, h: 420 },
  { id: "a3-landscape", label: "A3 landscape", w: 420, h: 297 },
];

export function testCropRect(settings, W, H) {
  const paper = TEST_PAPERS.find(p => p.id === settings?.paper) || TEST_PAPERS[0];
  const clamp = (v, max, fallback) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : fallback));
  const maxX = Math.max(0, W - paper.w), maxY = Math.max(0, H - paper.h);
  const maxMargin = (Math.min(paper.w, paper.h) - 1) / 2;
  const margin = clamp(settings?.margin, maxMargin, DEFAULT_TEST_MARGIN);
  return { ...paper, x: clamp(settings?.x, maxX, maxX / 2), y: clamp(settings?.y, maxY, maxY / 2), margin, maxMargin, fits: paper.w <= W && paper.h <= H };
}

const EPS = 1e-8;
const same = (a, b) => Math.abs(a[0] - b[0]) <= EPS && Math.abs(a[1] - b[1]) <= EPS;
const inside = (q, r) => q[0] >= r.x - EPS && q[0] <= r.x + r.w + EPS && q[1] >= r.y - EPS && q[1] <= r.y + r.h + EPS;
const lerp = (a, b, t) => a.map((v, i) => typeof v === "number" && typeof b[i] === "number" ? v + (b[i] - v) * t : v);

function clipSegment(a, b, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let lo = 0, hi = 1;
  for (const [p, q] of [[-dx, a[0] - r.x], [dx, r.x + r.w - a[0]], [-dy, a[1] - r.y], [dy, r.y + r.h - a[1]]]) {
    if (Math.abs(p) <= EPS) { if (q < -EPS) return null; }
    else if (p < 0) lo = Math.max(lo, q / p);
    else hi = Math.min(hi, q / p);
    if (lo > hi + EPS) return null;
  }
  return [lerp(a, b, lo), lerp(a, b, hi)];
}

export function cropTestPiece(ps, rect) {
  if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0) throw new Error("Invalid test crop");
  const margin = rect.margin ?? 0;
  if (!Number.isFinite(margin) || margin < 0 || 2 * margin >= Math.min(rect.w, rect.h)) throw new Error("Invalid test margin");
  const ink = { x: rect.x + margin, y: rect.y + margin, w: rect.w - 2 * margin, h: rect.h - 2 * margin };
  const paths = [];
  // Keep full paper coordinates: clipped lines begin at the inset, not zero.
  const local = q => [q[0] - rect.x, q[1] - rect.y, ...q.slice(2)];
  for (const path of ps.paths || []) {
    if (path.pts.length < 2) continue;
    if (path.pts.every(q => inside(q, ink))) {
      paths.push({ ...path, pts: path.pts.map(local) });
      continue;
    }
    const pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
    const runs = [];
    let run = [];
    const flush = () => { if (run.length > 1) runs.push(run); run = []; };
    for (let i = 1; i < pts.length; i++) {
      const clipped = clipSegment(pts[i - 1], pts[i], ink);
      if (!clipped || same(...clipped)) { if (!clipped) flush(); continue; }
      const [a, b] = clipped;
      if (run.length && !same(run.at(-1), a)) flush();
      if (!run.length) run.push(a);
      if (!same(run.at(-1), b)) run.push(b);
      if (!inside(pts[i], ink)) flush();
    }
    flush();
    // Avoid an extra pen lift at the original seam of a partly clipped loop.
    if (path.closed && runs.length > 1 && same(runs.at(-1).at(-1), runs[0][0])) {
      const last = runs.pop();
      runs[0] = last.concat(runs[0].slice(1));
    }
    runs.forEach((points, i) => {
      const fragment = { ...path, pts: points.map(local), closed: false };
      if (i) delete fragment.__stop; // A path's maintenance marker is emitted once.
      paths.push(fragment);
    });
  }
  return { paths };
}
