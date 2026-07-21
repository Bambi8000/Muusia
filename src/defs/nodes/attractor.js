import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "attractor",
  name: "Attractor",
  cat: "gen",
  group: "scientific",
  desc: "Clifford / De Jong maps or the Lorenz system iterated thousands of times, fitted to the sheet. In Lorenz mode the four sliders map to the system: a shifts rho (28+5a), b shifts sigma (10+3b), c shifts beta (8/3+0.8c), d scales integration speed; Plane picks the projection. Polyline is one chaotic thread, Dashes the classic attractor dust.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "type", label: "Type", type: "select", options: ["Clifford", "De Jong", "Lorenz"], def: "Clifford" },
    { key: "plane", label: "Plane (Lorenz)", type: "select", options: ["x-z", "x-y", "y-z"], def: "x-z" },
    { key: "a", label: "a", type: "slider", min: -3, max: 3, step: 0.01, def: -1.4 },
    { key: "b", label: "b", type: "slider", min: -3, max: 3, step: 0.01, def: 1.6 },
    { key: "c", label: "c", type: "slider", min: -3, max: 3, step: 0.01, def: 1.0 },
    { key: "d", label: "d", type: "slider", min: -3, max: 3, step: 0.01, def: 0.7 },
    { key: "iters", label: "Iterations", type: "slider", min: 1000, max: 30000, step: 500, def: 8000 },
    { key: "mode", label: "Draw as", type: "select", options: ["Polyline", "Dashes"], def: "Polyline" },
    { key: "dash", label: "Dash mm", type: "slider", min: 0.4, max: 3, step: 0.1, def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "seed", label: "Seed (start jitter)", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const bw = W - 2 * m, bh = H - 2 * m;
    if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
    const rng = mulberry32(p.seed * 911 + 3);
    const iters = Math.max(500, Math.min(40000, Math.round(p.iters)));
    const raw = [];
    if (String(p.type).startsWith("Lorenz")) {
      let x = 1 + rng() * 0.1, y = 1 + rng() * 0.1, z = 20 + rng();
      const rho = 28 + p.a * 5;
      const sigma = Math.max(1, 10 + p.b * 3);
      const beta = Math.max(0.4, 8 / 3 + p.c * 0.8);
      const dt = 0.006 * Math.max(0.25, 1 + 0.5 * p.d);
      for (let i = 0; i < iters + 200; i++) {
        const dx = sigma * (y - x);
        const dy = x * (rho - z) - y;
        const dz = x * y - beta * z;
        x += dx * dt; y += dy * dt; z += dz * dt;
        if (i >= 200) raw.push(p.plane === "x-y" ? [x, y] : p.plane === "y-z" ? [y, z] : [x, z]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) break;
      }
    } else {
      let x = rng() * 0.2, y = rng() * 0.2;
      for (let i = 0; i < iters + 100; i++) {
        let nx, ny;
        if (p.type === "De Jong") {
          nx = Math.sin(p.a * y) - Math.cos(p.b * x);
          ny = Math.sin(p.c * x) - Math.cos(p.d * y);
        } else {
          nx = Math.sin(p.a * y) + p.c * Math.cos(p.a * x);
          ny = Math.sin(p.b * x) + p.d * Math.cos(p.b * y);
        }
        x = nx; y = ny;
        if (i >= 100) raw.push([x, y]);
      }
    }
    if (raw.length < 10) return applyStyle({ paths: [] }, ins[0]);
    /* fit to the margin box */
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [x, y] of raw) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    const sc = Math.min(bw / ((bx1 - bx0) || 1), bh / ((by1 - by0) || 1));
    const ox = m + (bw - (bx1 - bx0) * sc) / 2 - bx0 * sc;
    const oy = m + (bh - (by1 - by0) * sc) / 2 - by0 * sc;
    const map = ([x, y]) => [x * sc + ox, y * sc + oy];
    const L = Math.round(p.layer);
    const paths = [];
    if (p.mode === "Dashes") {
      /* the classic attractor-dust look; stride-capped for the pen's sake */
      const MAXD = 6000;
      const stride = Math.max(1, Math.floor(raw.length / MAXD));
      for (let i = 0; i + stride < raw.length; i += stride) {
        const A = map(raw[i]), B = map(raw[i + 1]);
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const dl = Math.hypot(dx, dy) || 1;
        const hx = (dx / dl) * p.dash / 2, hy = (dy / dl) * p.dash / 2;
        paths.push({ pts: [[A[0] - hx, A[1] - hy], [A[0] + hx, A[1] + hy]], closed: false, layer: L });
      }
    } else {
      /* one continuous chaotic thread, decimated */
      const pts = [];
      let lx = 1e9, ly = 1e9;
      for (const q of raw) {
        const [x, y] = map(q);
        if (Math.hypot(x - lx, y - ly) >= 0.2) {
          pts.push([x, y]);
          lx = x; ly = y;
        }
        if (pts.length >= 100000) break;
      }
      if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
    }
    return applyStyle({ paths }, ins[0]);
  }
};