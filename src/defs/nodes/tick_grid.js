import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  /* Tick Grid — minimal chaos on a regular lattice. Every lattice node can
   * hold one short pen tick; every attribute of every tick is its own
   * seeded decision: Density picks the occupied share, Jitter slides the
   * centre within its cell, Angle ± Scatter sets direction, Length (% of
   * cell) ± Length variation sets size, and Bend bows the stroke by hand.
   * Cell sets the pitch in millimetres, centred inside Margin; an optional
   * Accent share draws in a second pen for a two-ink look. All randomness
   * is hashed per lattice node, so a fixed seed always plots the same
   * drawing. If a very fine lattice would exceed the point budget the
   * effective cell quietly grows so the whole sheet stays complete rather
   * than being cut off, and marks that wander past the paper edge are
   * clipped to the sheet instead of leaving it. */
  key: "tick_grid",
  name: "Tick Grid",
  cat: "gen",
  group: "geometric",
  desc: "Minimal chaos on a regular lattice: every grid intersection can hold one short pen tick, each with its own seeded position, angle, length and bend. Density runs from a handful of floating marks to a dense woven texture; Jitter, Angle scatter, Length variation and Bend dial in the amount of disorder, and an optional second Accent pen adds a two-ink look without moving any geometry. The grid is centred inside Margin, random numbers are hashed per node so a fixed seed always plots the same drawing, and a lattice finer than the point budget allows grows its cells instead of cutting the sheet off. Chain into Warp, Ripple or Brush downstream, or Merge with a plain Grid for structure plus noise.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "cell", label: "Cell mm", type: "slider", min: 2, max: 40, step: 0.5, def: 10 },
    { key: "density", label: "Density", type: "slider", min: 0.02, max: 1, step: 0.02, def: 0.6 },
    { key: "length", label: "Length % of cell", type: "slider", min: 10, max: 250, step: 5, def: 80 },
    { key: "lengthVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "angle", label: "Angle °", type: "slider", min: -180, max: 180, step: 5, def: 0 },
    { key: "scatter", label: "Angle scatter °", type: "slider", min: 0, max: 180, step: 5, def: 90 },
    { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "bend", label: "Bend", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "accent", label: "Accent %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "pen2", label: "Accent pen", type: "pen", def: 9, showIf: (p) => p.accent > 0 },
  ],
  _layout(p, c) {
    const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const W = Number.isFinite(+c?.W) ? +c.W : 297;
    const H = Number.isFinite(+c?.H) ? +c.H : 210;
    if (!(W > 8) || !(H > 8)) return null;
    const m = num(p.margin, 12, 0, Math.min(W, H) / 2 - 1);
    const aw = W - 2 * m, ah = H - 2 * m;
    if (aw < 2 || ah < 2) return null;
    const density = num(p.density, 0.6, 0, 1);
    const bendOn = num(p.bend, 0.2, 0, 1) > 0.001;
    // Worst-case POINT estimate (a bent tick emits samples+1 points); grow
    // the effective cell until the whole lattice fits the budget, so the
    // sheet is never cut off mid-way.
    let cell = num(p.cell, 10, 1, 1e6);
    let est = Infinity;
    for (let k = 0; k < 64; k++) {
      const cols = Math.max(1, Math.floor(aw / cell));
      const rows = Math.max(1, Math.floor(ah / cell));
      est = cols * rows * density * (bendOn ? Math.min(12, Math.max(4, Math.ceil(num(p.length, 80, 1, 1e5) / 100 * cell / 1.5) + 1)) + 1 : 2);
      if (est <= 110000) break;
      cell *= 1.15;
    }
    const cols = Math.max(1, Math.floor(aw / cell));
    const rows = Math.max(1, Math.floor(ah / cell));
    const fc = Math.min(cell, aw / cols, ah / rows);
    const w = cols * fc, h = rows * fc;
    return { W, H, m, aw, ah, cell: fc, cols, rows, ox: (W - w) / 2, oy: (H - h) / 2 };
  },
  overlay(p, ctx) {
    try {
      const L = this._layout(p, ctx);
      if (!L) return [];
      return [
        { kind: "rect", x: L.m, y: L.m, w: L.W - 2 * L.m, h: L.H - 2 * L.m },
        { kind: "rect", x: L.ox, y: L.oy, w: L.cols * L.cell, h: L.rows * L.cell },
      ];
    } catch (e) {
      return [];
    }
  },
  compute(ins, p, ctx) {
    const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const L = this._layout(p, ctx);
    if (!L) return applyStyle(EMPTY, ins[0]);
    const { W, H, cell, cols, rows, ox, oy } = L;
    const seed = Math.round(num(p.seed, 5, -2147483648, 2147483647));
    const density = num(p.density, 0.6, 0, 1);
    const lenPct = num(p.length, 80, 1, 1e5) / 100;
    const lenVar = num(p.lengthVar, 0.5, 0, 1);
    const ang = num(p.angle, 0, -3600, 3600) * Math.PI / 180;
    const scat = num(p.scatter, 90, 0, 360) * Math.PI / 180;
    const jit = num(p.jitter, 0.35, 0, 10);
    const bend = num(p.bend, 0.2, 0, 1);
    const accentF = num(p.accent, 0, 0, 100) / 100;
    const layer = Math.max(0, Math.min(11, Math.round(num(p.layer, 0, 0, 11))));
    const layer2 = Math.max(0, Math.min(11, Math.round(num(p.pen2, 9, 0, 11))));
    const paths = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cellSeed = (seed ^ Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) | 0;
        const rng = mulberry32(cellSeed);
        if (rng() >= density) continue;
        const nx = ox + (i + 0.5) * cell + (rng() * 2 - 1) * jit * cell;
        const ny = oy + (j + 0.5) * cell + (rng() * 2 - 1) * jit * cell;
        const a = ang + (rng() * 2 - 1) * scat;
        const len = Math.max(0.5, lenPct * cell * (1 - 0.7 * lenVar * rng()));
        const pen = accentF > 0 && rng() < accentF ? layer2 : layer;
        const ca = Math.cos(a), sa = Math.sin(a);
        const sx = nx - ca * len / 2, sy = ny - sa * len / 2;
        const ex = nx + ca * len / 2, ey = ny + sa * len / 2;
        let minX = Math.min(sx, ex), maxX = Math.max(sx, ex);
        let minY = Math.min(sy, ey), maxY = Math.max(sy, ey);
        let pts;
        if (bend > 0.001) {
          const bow = bend * (rng() * 2 - 1) * len * 0.45;
          const mx = (sx + ex) / 2 - sa * bow * 2;
          const my = (sy + ey) / 2 + ca * bow * 2;
          const n = Math.min(12, Math.max(4, Math.ceil(len / 1.5) + 1));
          pts = new Array(n + 1);
          for (let s = 0; s <= n; s++) {
            const t = s / n, u = 1 - t;
            const x = u * u * sx + 2 * u * t * mx + t * t * ex;
            const y = u * u * sy + 2 * u * t * my + t * t * ey;
            pts[s] = [x, y];
            if (x < minX) minX = x; else if (x > maxX) maxX = x;
            if (y < minY) minY = y; else if (y > maxY) maxY = y;
          }
        } else {
          pts = [[sx, sy], [ex, ey]];
        }
        if (minX >= -1e-4 && minY >= -1e-4 && maxX <= W + 1e-4 && maxY <= H + 1e-4) {
          paths.push({ pts, closed: false, layer: pen });
        } else {
          const cp = [];
          for (let s = 0; s < pts.length; s++) {
            const x = Math.min(W, Math.max(0, pts[s][0]));
            const y = Math.min(H, Math.max(0, pts[s][1]));
            const last = cp[cp.length - 1];
            if (!last || (x - last[0]) * (x - last[0]) + (y - last[1]) * (y - last[1]) > 1e-6) cp.push([x, y]);
          }
          if (cp.length >= 2) paths.push({ pts: cp, closed: false, layer: pen });
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
