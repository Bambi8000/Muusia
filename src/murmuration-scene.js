import { hash2 } from './defs/helpers.js';

export function sceneCamera(p, centre, animal, W, H) {
  const target = p.camera === 'Follow animal' ? animal || centre : centre;
  return p.camera === 'Follow group' || p.camera === 'Follow animal'
    ? [target[0] - W / 2, target[1] - H / 2] : [0, 0];
}
// Liang–Barsky: clipping changes visibility, not the world-space animation.
function segment(a, b, xmin, ymin, xmax, ymax) {
  let lo = 0, hi = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - xmin], [dx, xmax - a[0]], [-dy, a[1] - ymin], [dy, ymax - a[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
    if (lo > hi) return null;
  }
  if ((hi - lo) * Math.hypot(dx, dy) < 1e-8) return null;
  return [[a[0] + lo * dx, a[1] + lo * dy], [a[0] + hi * dx, a[1] + hi * dy]];
}
export function renderMurmurationScene(ps, p, ctx, camera) {
  const W = Number(ctx.W), H = Number(ctx.H), m = Math.max(0, Number(p.margin) || 0);
  if (!(W > 2 * m && H > 2 * m)) return { paths: [] };
  const moving = p.camera === 'Follow group' || p.camera === 'Follow animal';
  const ground = p.ground === 'Sparse dots' || p.ground === 'Short dashes';
  if (!moving && !ground) return ps; // old patches are byte-for-byte unchanged
  const paths = [];
  if (ground) {
    // The same world cell always owns the same mark. Camera translation alone
    // moves it on paper; newly visible cells are not reseeded each frame.
    const pitch = Math.max(3, Number(p.groundSpacing) || 14, Math.sqrt(W * H / 1800));
    const seed = (Number(p.seed) || 0) + 713;
    const layer = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    for (let y = Math.floor((m + camera[1]) / pitch) - 1; y <= Math.ceil((H - m + camera[1]) / pitch); y++) {
      for (let x = Math.floor((m + camera[0]) / pitch) - 1; x <= Math.ceil((W - m + camera[0]) / pitch); x++) {
        if (hash2(x, y, seed) > .57) continue;
        const cx = (x + .1 + .8 * hash2(x, y, seed + 1)) * pitch - camera[0];
        const cy = (y + .1 + .8 * hash2(x, y, seed + 2)) * pitch - camera[1];
        const r = p.ground === 'Short dashes' ? .45 + .55 * hash2(x, y, seed + 3) : .12;
        const a = hash2(x, y, seed + 4) * Math.PI;
        const pts = segment([cx - Math.cos(a) * r, cy - Math.sin(a) * r], [cx + Math.cos(a) * r, cy + Math.sin(a) * r], m, m, W - m, H - m);
        if (pts) paths.push({ pts, closed: false, layer });
      }
    }
  }
  if (!moving) return { ...ps, paths: [...paths, ...ps.paths] };
  const inside = q => q[0] >= m && q[0] <= W - m && q[1] >= m && q[1] <= H - m;
  for (const path of ps.paths) {
    const pts = path.pts.map(q => [q[0] - camera[0], q[1] - camera[1]]);
    if (pts.every(inside)) { paths.push({ ...path, pts }); continue; }
    const source = path.closed ? [...pts, pts[0]] : pts;
    let run = [];
    const flush = () => { if (run.length >= 2) paths.push({ ...path, pts: run, closed: false }); run = []; };
    for (let i = 1; i < source.length; i++) {
      const pair = segment(source[i - 1], source[i], m, m, W - m, H - m);
      if (!pair) { flush(); continue; }
      const last = run[run.length - 1];
      if (last && Math.hypot(last[0] - pair[0][0], last[1] - pair[0][1]) < 1e-8) run.push(pair[1]);
      else { flush(); run = pair; }
    }
    flush();
  }
  return { ...ps, paths };
}
