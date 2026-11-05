import { Pin, mulberry32, applyStyle, signedArea } from "../helpers.js";

export default {
  key: "reaction_labyrinth",
  name: "Reaction Labyrinth",
  cat: "gen",
  group: "organic",
  desc: "A circular reaction-diffusion drawing in two plotter modes. Continuous path winds one uninterrupted, field-guided line from the rim towards the centre. Separate contours traces the actual closed boundaries of a seeded Gray-Scott field, lifting the pen between loops. Evolution and Pattern scale change the simulated growth; Seed reproduces it. Turns and Meander shape the continuous path; Threshold and Contour bands shape the separate loops. Size and centre place the drawing on the paper. The output is vector pen paths, not a raster effect.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Drawing", type: "select", options: ["Continuous path", "Separate contours"], def: "Continuous path" },
    { key: "diameter", label: "Diameter mm", type: "slider", min: 20, max: 500, step: 1, def: 175 },
    { key: "cx", label: "Centre X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Centre Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "scale", label: "Pattern scale", type: "slider", min: 10, max: 30, step: 1, def: 20 },
    { key: "evolution", label: "Evolution", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65 },
    { key: "turns", label: "Turns", type: "slider", min: 3, max: 18, step: 1, def: 9, showIf: p => p.mode === "Continuous path" },
    { key: "meander", label: "Meander", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8, showIf: p => p.mode === "Continuous path" },
    { key: "threshold", label: "Threshold", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5, showIf: p => p.mode === "Separate contours" },
    { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 3, step: 1, def: 1, showIf: p => p.mode === "Separate contours" },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 29 },
  ],
  _clamp(x, a, b) { return Math.max(a, Math.min(b, x)); },
  _number(x, fallback, a, b) {
    const n = Number(x);
    return this._clamp(Number.isFinite(n) ? n : fallback, a, b);
  },
  _region(p, ctx) {
    const W = this._number(ctx?.W, 210, 0, 100000), H = this._number(ctx?.H, 297, 0, 100000);
    const m = this._number(p.margin, 10, 0, Math.min(W, H) / 2);
    const R = Math.min(this._number(p.diameter, 175, 1, 1000) / 2, Math.max(0, Math.min(W, H) / 2 - m));
    const cx = this._clamp(W * this._number(p.cx, 50, 0, 100) / 100, m + R, W - m - R);
    const cy = this._clamp(H * this._number(p.cy, 50, 0, 100) / 100, m + R, H - m - R);
    return { R, cx, cy };
  },
  overlay(p, ctx) {
    const { R, cx, cy } = this._region(p, ctx);
    return R > 0 ? [{ kind: "circle", cx, cy, r: R }, { kind: "point", x: cx, y: cy }] : [];
  },
  _field(p) {
    const N = Math.round(this._number(p.scale, 20, 10, 30)) * 6 + 34;
    const seed = Math.round(this._number(p.seed, 29, -2147483648, 2147483647));
    const evolution = this._number(p.evolution, 0.65, 0, 1);
    const key = `${N}:${seed}:${evolution}`;
    if (this._memo?.key === key) return this._memo.field;
    const count = N * N, rng = mulberry32(seed);
    let A = new Float32Array(count).fill(1), B = new Float32Array(count);
    let nextA = new Float32Array(count), nextB = new Float32Array(count);
    for (let j = 0; j < Math.round(count / 65); j++) {
      const x = 3 + rng() * (N - 6), y = 3 + rng() * (N - 6), radius = 0.9 + rng() * 1.4;
      for (let iy = Math.floor(y - radius); iy <= Math.ceil(y + radius); iy++)
        for (let ix = Math.floor(x - radius); ix <= Math.ceil(x + radius); ix++) {
          if (ix <= 0 || iy <= 0 || ix >= N - 1 || iy >= N - 1) continue;
          if ((ix - x) ** 2 + (iy - y) ** 2 < radius ** 2) {
            const k = iy * N + ix;
            A[k] = 0; B[k] = 0.8 + rng() * 0.2;
          }
        }
    }
    const feed = 0.035, kill = 0.06, steps = Math.round(350 + 900 * evolution);
    for (let t = 0; t < steps; t++) {
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        const k = y * N + x, a = A[k], b = B[k], reaction = a * b * b;
        const la = -a + 0.2 * (A[k-1] + A[k+1] + A[k-N] + A[k+N]) +
          0.05 * (A[k-N-1] + A[k-N+1] + A[k+N-1] + A[k+N+1]);
        const lb = -b + 0.2 * (B[k-1] + B[k+1] + B[k-N] + B[k+N]) +
          0.05 * (B[k-N-1] + B[k-N+1] + B[k+N-1] + B[k+N+1]);
        nextA[k] = this._clamp(a + 0.25 * la - reaction + feed * (1 - a), 0, 1);
        nextB[k] = this._clamp(b + 0.125 * lb + reaction - (kill + feed) * b, 0, 1);
      }
      for (let i = 0; i < N; i++) {
        nextA[i] = nextA[(N-1)*N+i] = nextA[i*N] = nextA[i*N+N-1] = 1;
        nextB[i] = nextB[(N-1)*N+i] = nextB[i*N] = nextB[i*N+N-1] = 0;
      }
      [A, nextA] = [nextA, A]; [B, nextB] = [nextB, B];
    }
    // Fade the finite square reservoir outside the circular plotted region.
    const span = N - 33;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const radial = Math.hypot(2*x-(N-1), 2*y-(N-1)) / span;
      const fade = this._clamp((0.98 - radial) / 0.035, 0, 1);
      B[y*N+x] *= fade * fade * (3 - 2 * fade);
    }
    const field = { N, span, values: B };
    this._memo = { key, field };
    return field;
  },
  _sample(field, x, y) {
    const { N, span, values: v } = field;
    const gx = this._clamp((x * span + N - 1) / 2, 0, N - 1.001);
    const gy = this._clamp((y * span + N - 1) / 2, 0, N - 1.001);
    const ix = Math.floor(gx), iy = Math.floor(gy), tx = gx - ix, ty = gy - iy;
    const k = iy * N + ix;
    return (1-ty) * ((1-tx)*v[k] + tx*v[k+1]) + ty*((1-tx)*v[k+N] + tx*v[k+N+1]);
  },
  _contours(field, level) {
    const { N, values: v } = field, points = new Map(), links = new Map();
    const join = (a,b) => {
      if (!links.has(a)) links.set(a, []);
      if (!links.has(b)) links.set(b, []);
      links.get(a).push(b); links.get(b).push(a);
    };
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
      const k = y * N + x, vals = [v[k], v[k+1], v[k+N+1], v[k+N]];
      const corners = [[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
      const keys = [2*k, 2*(k+1)+1, 2*(k+N), 2*k+1], hits = [];
      for (let e = 0; e < 4; e++) {
        const j = (e + 1) % 4, a = vals[e], b = vals[j];
        if ((a > level) === (b > level)) continue;
        const id = keys[e], f = (level - a) / (b - a);
        if (!points.has(id)) points.set(id, [corners[e][0] + f*(corners[j][0]-corners[e][0]), corners[e][1] + f*(corners[j][1]-corners[e][1])]);
        hits.push(id);
      }
      if (hits.length === 2) join(hits[0], hits[1]);
      else if (hits.length === 4) {
        const q = (vals[0]-level)*(vals[2]-level) - (vals[1]-level)*(vals[3]-level);
        if (q >= 0) { join(hits[0], hits[1]); join(hits[2], hits[3]); }
        else { join(hits[0], hits[3]); join(hits[1], hits[2]); }
      }
    }
    const seen = new Set(), paths = [];
    for (const start of links.keys()) {
      if (seen.has(start)) continue;
      const pts = []; let cur = start, prev = -1;
      while (!seen.has(cur)) {
        seen.add(cur); pts.push(points.get(cur));
        const next = links.get(cur).find(id => id !== prev);
        if (next === undefined) break;
        prev = cur; cur = next;
      }
      if (cur === start && pts.length >= 5) paths.push(pts);
    }
    return paths;
  },
  compute(ins, p, ctx) {
    const { R, cx, cy } = this._region(p, ctx);
    if (R < 1) return { paths: [] };
    const field = this._field(p), layer = Math.round(this._number(p.layer, 0, 0, 11));
    const paths = [];
    if (p.mode === "Separate contours") {
      const bands = Math.round(this._number(p.bands, 1, 1, 3));
      const level = 0.08 + 0.26 * this._number(p.threshold, 0.5, 0, 1);
      const loops = [];
      for (let band = 0; band < bands; band++) loops.push(...this._contours(field, level + 0.025 * band));
      // If very fine fields produce too many tiny islands, retain them evenly.
      const routeStride = Math.max(1, Math.ceil(loops.length * 10 / 100000));
      const kept = loops.filter((_, i) => i % routeStride === 0);
      let stride = 1;
      const estimated = s => kept.reduce((n, q) => n + 2 * Math.min(q.length, Math.max(5, Math.ceil(q.length / s))), 0);
      while (estimated(stride) > 110000) stride++;
      for (const raw of kept) {
        const count = Math.min(raw.length, Math.max(5, Math.ceil(raw.length / stride)));
        const sampled = Array.from({ length: count }, (_, i) => raw[Math.floor(i * raw.length / count)]);
        const pts = [];
        for (let i = 0; i < sampled.length; i++) {
          const a = sampled[i], b = sampled[(i+1) % sampled.length];
          for (const f of [0.25, 0.75]) {
            const x = (a[0]*(1-f)+b[0]*f-(field.N-1)/2)*2/field.span;
            const y = (a[1]*(1-f)+b[1]*f-(field.N-1)/2)*2/field.span;
            pts.push([cx + R*x, cy + R*y]);
          }
        }
        if (signedArea(pts) < 0) pts.reverse();
        paths.push({ pts, closed: true, layer });
      }
    } else {
      const turns = Math.round(this._number(p.turns, 9, 3, 18));
      const meander = this._number(p.meander, 0.8, 0, 1);
      const outer = R * 0.96, inner = R * 0.12, spacing = (outer - inner) / turns;
      const samples = Math.min(26000, Math.max(1200, Math.ceil(2*Math.PI*turns*outer/0.65)));
      const pts = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples, a = -Math.PI/2 + turns * 2*Math.PI*t;
        const base = outer + (inner - outer)*t;
        const sx = base*Math.cos(a)/R, sy = base*Math.sin(a)/R;
        const b = this._sample(field, sx, sy);
        const wave = Math.sin(11*a + 1.3*Math.sin(2*a + p.seed*0.01) + 4*t + 2*b);
        const offset = spacing * meander * (0.38*wave + 0.15*(2*this._clamp(b*3,0,1)-1));
        const r = base + offset;
        pts.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]);
      }
      paths.push({ pts, closed: false, layer });
    }
    return applyStyle({ paths }, ins[0]);
  },
};
