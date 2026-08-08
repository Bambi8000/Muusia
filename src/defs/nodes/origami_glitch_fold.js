import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "origami_glitch_fold",
  name: "Origami Glitch Fold",
  cat: "mod",
  group: "deform",
  ins: [Pin("paths", "Source")],
  outs: [Pin("paths")],
  params: [
    { key: "angle", label: "Fold Angle (deg)", type: "slider", min: 0, max: 360, step: 1, def: 45 },
    { key: "useCenter", label: "Pivot at center", type: "check", def: true },
    { key: "px", label: "Pivot X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
    { key: "py", label: "Pivot Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    { key: "offset", label: "Axis Position", type: "slider", min: -100, max: 100, step: 1, def: 0 },
    { key: "distortion", label: "Crease Warp", type: "slider", min: -0.5, max: 0.5, step: 0.01, def: 0.15 },
    { key: "keep", label: "Keep Original", type: "check", def: false }
  ],
  overlay(p, ctx) {
    /* fold line + pivot + mirrored-side arrow; same math as compute */
    const { W, H } = ctx;
    const rad = (p.angle * Math.PI) / 180;
    const nx = Math.cos(rad);
    const ny = Math.sin(rad);
    const bx = p.useCenter ? W / 2 : p.px;
    const by = p.useCenter ? H / 2 : p.py;
    const cx = bx + nx * p.offset;
    const cy = by + ny * p.offset;
    const dx = -ny, dy = nx; /* fold line runs perpendicular to the normal */
    /* clip the infinite line to the sheet (Liang-Barsky on both axes) */
    let t0 = -1e9, t1 = 1e9, ok = true;
    const clip1 = (pos, dir, lo, hi) => {
      if (Math.abs(dir) < 1e-9) { if (pos < lo || pos > hi) ok = false; return; }
      let a = (lo - pos) / dir, b = (hi - pos) / dir;
      if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
    };
    clip1(cx, dx, 0, W);
    clip1(cy, dy, 0, H);
    const guides = [
      { kind: "point", x: cx, y: cy },
      { kind: "arrow", x1: cx, y1: cy, x2: cx + nx * 16, y2: cy + ny * 16 }
    ];
    if (ok && t0 <= t1) {
      guides.unshift({
        kind: "poly",
        pts: [[cx + dx * t0, cy + dy * t0], [cx + dx * t1, cy + dy * t1]]
      });
    }
    return guides;
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const { W, H } = ctx;
    const rad = (p.angle * Math.PI) / 180;
    const nx = Math.cos(rad);
    const ny = Math.sin(rad);
    /* pivot: canvas center (legacy behavior, default) or an explicit point;
       Axis Position still slides the fold line along its normal from the pivot */
    const bx = p.useCenter ? W / 2 : p.px;
    const by = p.useCenter ? H / 2 : p.py;
    const cx = bx + nx * p.offset;
    const cy = by + ny * p.offset;
    /* mirroring can fling points far off the sheet and the app does not clip */
    const clamp = ([x, y]) => [
      Math.max(0.5, Math.min(W - 0.5, x)),
      Math.max(0.5, Math.min(H - 0.5, y))
    ];
    const paths = [];
    src.paths.forEach((path) => {
      if (p.keep) {
        paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
      }
      const densified = resample(path.pts, path.closed, 1.0);
      const modifiedPts = densified.map(([x, y]) => {
        const dx = x - cx;
        const dy = y - cy;
        const distance = dx * nx + dy * ny;
        if (distance > 0) {
          let rx = x - 2 * distance * nx;
          let ry = y - 2 * distance * ny;
          const warpFactor = Math.abs(distance) * p.distortion;
          rx += -ny * warpFactor;
          ry += nx * warpFactor;
          return clamp([rx, ry]);
        }
        return [x, y];
      });
      paths.push({ ...path, pts: modifiedPts, closed: path.closed });
    });
    return { paths };
  }
};
