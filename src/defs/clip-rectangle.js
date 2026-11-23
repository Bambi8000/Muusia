// Clip polyline segments, preserving visible runs rather than projecting
// off-sheet points onto the border. A cut closed curve becomes open arcs.
export function clipPolylineToRect(pts, closed, x0, y0, x1, y1) {
  if (pts.length < 2) return [];
  const inside = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (pts.every(inside)) return [{ pts, closed }];
  const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const runs = [];
  let run = [];
  const flush = () => { if (run.length > 1) runs.push({ pts: run, closed: false }); run = []; };
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let lo = 0, hi = 1;
    for (const [v, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
      if (Math.abs(v) < 1e-12) { if (q < 0) { hi = -1; break; } continue; }
      const t = q / v;
      if (v < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
      if (lo > hi) break;
    }
    if (lo >= hi) { flush(); continue; }
    const at = (t) => [clamp(a[0] + t * dx, x0, x1), clamp(a[1] + t * dy, y0, y1)];
    const start = at(lo), end = at(hi);
    if (same(start, end)) continue;
    if (run.length && !same(run[run.length - 1], start)) flush();
    if (!run.length) run.push(start);
    run.push(end);
    if (hi < 1) flush();
  }
  flush();
  // Join the visible arc across the original closed curve's arbitrary seam.
  if (closed && runs.length > 1 && same(runs[runs.length - 1].pts.at(-1), runs[0].pts[0])) {
    runs[0].pts = [...runs.pop().pts, ...runs[0].pts.slice(1)];
  }
  return runs;
}
