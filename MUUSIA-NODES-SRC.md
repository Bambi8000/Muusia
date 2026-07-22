# MUUSIA v2.29 — Node Sources (167 files, generated)

All built-in node definitions from `src/defs/nodes/`. Engine, UI and the
`group`/`reititys` entries live in `src/App.jsx`; shared helpers in `src/defs/helpers.js`.

## aaltoilu.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "aaltoilu",
    name: "Wave", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amp", label: "Amplitude mm", type: "slider", min: 0, max: 20, step: 0.25, def: 3 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 2, max: 120, step: 1, def: 30 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.05, def: 0 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.8, p.wl / 14));
        let d = 0;
        const out = pts.map((pt, i) => {
          if (i > 0) d += Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]);
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          const off = Math.sin((d / Math.max(0.5, p.wl)) * Math.PI * 2 + p.phase) * p.amp;
          return [pt[0] + (-ty / tl) * off, pt[1] + (tx / tl) * off];
        });
        return { ...path, pts: out };
      });
      return { paths };
    },
  
};
```

## adsr.js

```js
import { Pin } from "../helpers.js";

export default {
  key: "adsr",
    name: "ADSR",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "a", label: "Attack", type: "slider", min: 0, max: 1, step: 0.01, def: 0.1 },
      { key: "d", label: "Decay", type: "slider", min: 0, max: 1, step: 0.01, def: 0.2 },
      { key: "s", label: "Sustain level", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: "r", label: "Release", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const u = Math.max(0, Math.min(1, raw));
      let a = Math.max(0, p.a), d = Math.max(0, p.d), r = Math.max(0, p.r);
      const sum = a + d + r;
      if (sum > 1) { a /= sum; d /= sum; r /= sum; } /* squeeze to fit; sustain -> 0 */
      const sus = Math.max(0, Math.min(1, p.s));
      const relStart = 1 - r;
      let v;
      if (u < a) v = a > 0 ? u / a : 1;
      else if (u < a + d) v = d > 0 ? 1 - (1 - sus) * ((u - a) / d) : sus;
      else if (u < relStart) v = sus;
      else v = r > 0 ? sus * (1 - (u - relStart) / r) : 0;
      return p.min + v * (p.max - p.min);
    }
  
};
```

## aggregate.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "aggregate",
    name: "Aggregate",
    cat: "gen",
    group: "structural",
    desc: "WASP-style discrete aggregation: copies of a module snap together at connector points (bounding-box edge midpoints), growing a crystal-like assembly one part at a time with collision checks. Wire your own Module in, or use the built-in part. Wire a value into Iterations to animate the growth.",
    ins: [Pin("paths", "Module (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 1, max: 400, step: 1, def: 60 },
      { key: "scale", label: "Module scale %", type: "slider", min: 20, max: 300, step: 5, def: 100 },
      { key: "rot", label: "Random 90deg rotations", type: "check", def: true },
      { key: "gap", label: "Gap mm", type: "slider", min: -1, max: 6, step: 0.25, def: 0.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen (built-in part)", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[1]);
      /* module: wired paths, or a built-in open U part */
      let mod;
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        mod = ins[0].paths.map((pa) => ({ pts: pa.pts.map((q) => q.slice()), closed: pa.closed, layer: pa.layer }));
      } else {
        const L = Math.round(p.layer);
        mod = [
          { pts: [[-5, 5], [-5, -5], [5, -5], [5, 5]], closed: false, layer: L },
          { pts: [[-2.5, 0], [2.5, 0]], closed: false, layer: L }
        ];
      }
      /* center + measure the module */
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const pa of mod) for (const [x, y] of pa.pts) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const sc = Math.max(0.05, p.scale / 100);
      const mcx = (bx0 + bx1) / 2, mcy = (by0 + by1) / 2;
      const mw = Math.max(1, (bx1 - bx0)) * sc, mh = Math.max(1, (by1 - by0)) * sc;
      const gap = p.gap;
      /* placements: {x, y, rot(0-3), w, h} — 90deg rotations swap w/h */
      const placed = [];
      const rng = mulberry32(p.seed * 5741 + 19);
      const dims = (rot) => (rot % 2 === 0 ? [mw, mh] : [mh, mw]);
      const collides = (x, y, w, h) => {
        const tol = -0.2; /* slight touch allowed */
        if (x - w / 2 < x0 || x + w / 2 > x1 || y - h / 2 < y0 || y + h / 2 > y1) return true;
        for (const pl of placed) {
          const [pw, ph] = dims(pl.rot);
          if (Math.abs(x - pl.x) < (w + pw) / 2 + tol && Math.abs(y - pl.y) < (h + ph) / 2 + tol) return true;
        }
        return false;
      };
      const open = []; /* connectors: {x, y, dir 0=N 1=E 2=S 3=W} on placed parts */
      const addConnectors = (pl) => {
        const [w, h] = dims(pl.rot);
        open.push({ x: pl.x, y: pl.y - h / 2, dir: 0 });
        open.push({ x: pl.x + w / 2, y: pl.y, dir: 1 });
        open.push({ x: pl.x, y: pl.y + h / 2, dir: 2 });
        open.push({ x: pl.x - w / 2, y: pl.y, dir: 3 });
      };
      const first = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rot: 0 };
      placed.push(first);
      addConnectors(first);
      const target = Math.max(1, Math.min(500, Math.round(p.iters)));
      let guard = target * 30;
      while (placed.length < target && open.length && guard-- > 0) {
        const ci = Math.floor(rng() * open.length);
        const c = open[ci];
        const rot = p.rot ? Math.floor(rng() * 4) : 0;
        const [w, h] = dims(rot);
        /* new part sits beyond the connector, opposite side facing it */
        let nx = c.x, ny = c.y;
        if (c.dir === 0) ny -= h / 2 + gap;
        else if (c.dir === 1) nx += w / 2 + gap;
        else if (c.dir === 2) ny += h / 2 + gap;
        else nx -= w / 2 + gap;
        if (collides(nx, ny, w, h)) {
          open.splice(ci, 1);
          continue;
        }
        const pl = { x: nx, y: ny, rot };
        placed.push(pl);
        addConnectors(pl);
        open.splice(ci, 1);
      }
      /* render: module transformed to each placement */
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      for (const pl of placed) {
        const a = (pl.rot * Math.PI) / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (const pa of mod) {
          if (total + pa.pts.length > BUDGET) return applyStyle({ paths }, ins[1]);
          total += pa.pts.length;
          paths.push({
            pts: pa.pts.map(([x, y]) => {
              const lx = (x - mcx) * sc, ly = (y - mcy) * sc;
              return [pl.x + lx * ca - ly * sa, pl.y + lx * sa + ly * ca];
            }),
            closed: pa.closed, layer: pa.layer
          });
        }
      }
      return applyStyle({ paths }, ins[1]);
    }
  
};
```

## align.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "align",
      name: "Align",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "hor", label: "Horizontal", type: "select", options: ["None", "Left", "Center", "Right"], def: "Center" },
      { key: "ver", label: "Vertical", type: "select", options: ["None", "Top", "Middle", "Bottom"], def: "Middle" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 80, step: 1, def: 10 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const path of src.paths) for (const [x, y] of path.pts) {
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
      let dx = 0, dy = 0;
      if (p.hor === "Left") dx = p.margin - x0;
      else if (p.hor === "Center") dx = (ctx.W - (x1 - x0)) / 2 - x0;
      else if (p.hor === "Right") dx = ctx.W - p.margin - x1;
      if (p.ver === "Top") dy = p.margin - y0;
      else if (p.ver === "Middle") dy = (ctx.H - (y1 - y0)) / 2 - y0;
      else if (p.ver === "Bottom") dy = ctx.H - p.margin - y1;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [x + dx, y + dy]),
      }));
      return { paths };
    }
  
};
```

## array.js

```js
import { Pin, EMPTY, PENS, mulberry32 } from "../helpers.js";

export default {
  key: "array",
    name: "Array", cat: "duo", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Copies", type: "slider", min: 2, max: 8, step: 1, def: 3 },
      { key: "dx", label: "Δ X mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 2 },
      { key: "dy", label: "Δ Y mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 0 },
      { key: "drot", label: "Δ Rotate ° / copy", type: "slider", min: -45, max: 45, step: 0.5, def: 0 },
      { key: "dscale", label: "Δ Scale % / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 0 },
      { key: "penPer", label: "Pen change per copy", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 16 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const n = Math.round(p.count);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const paths = [];
      for (let i = 0; i < n; i++) {
        const rng = mulberry32(p.seed * 77 + i * 991 + 3);
        const jx = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const jy = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const tx = p.dx * i + jx, ty = p.dy * i + jy;
        const rad = ((p.drot * i) * Math.PI) / 180;
        const sc = 1 + (p.dscale * i) / 100;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        for (const path of src.paths) {
          paths.push({
            pts: path.pts.map(([x, y]) => {
              const dx0 = (x - cx) * sc, dy0 = (y - cy) * sc;
              return [cx + dx0 * ca - dy0 * sa + tx, cy + dx0 * sa + dy0 * ca + ty];
            }),
            closed: path.closed,
            layer: p.penPer ? i % PENS.length : path.layer,
          });
        }
      }
      return { paths };
    },
  
};
```

## arvo.js

```js
import { Pin } from "../helpers.js";

export default {
  key: "arvo",
    name: "Value", cat: "math", ins: [], outs: [Pin("value")],
    params: [{ key: "v", label: "Value", type: "slider", min: -100, max: 100, step: 0.5, def: 4 }],
    compute(_ins, p) { return p.v; },
  
};
```

## asteroids.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "asteroids",
    name: "Asteroids", cat: "gen", group: "space",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Asteroids", type: "slider", min: 1, max: 40, step: 1, def: 10 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 90, step: 1, def: 28 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "verts", label: "Vertices", type: "slider", min: 6, max: 16, step: 1, def: 10 },
      { key: "jag", label: "Jaggedness", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.4 },
      { key: "ship", label: "Player ship", type: "check", def: true },
      { key: "bullets", label: "Bullets", type: "slider", min: 0, max: 12, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 175 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8747 + 83);
      const paths = [];
      /* klassinen vektoriasteroidi: epasaannollinen monikulmio jossa sisaan/ulos-piikkeja */
      const oneRock = (cx, cy, sz, sd) => {
        const rr = mulberry32(sd);
        const nV = Math.round(p.verts);
        const pts = [];
        for (let i = 0; i < nV; i++) {
          const a = (i / nV) * Math.PI * 2;
          /* piikit: osa pisteista sisaan, osa ulos -> Asteroids-siluetti */
          const spike = rr() < 0.4 ? 1 - p.jag : 1 + p.jag * 0.5;
          const r = sz * 0.5 * spike;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        paths.push({ pts, closed: true, layer: L });
      };
      const n = Math.round(p.count);
      const placed = [];
      let guard = 0;
      for (let i = 0; i < n && guard < n * 40; ) {
        guard++;
        const sz = p.size * (1 - p.sizeVar * rng());
        const cx = m + sz / 2 + rng() * (W - 2 * m - sz);
        const cy = m + sz / 2 + rng() * (H - 2 * m - sz);
        let ok = true;
        for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * 0.5) { ok = false; break; }
        if (!ok) continue;
        placed.push([cx, cy, sz]);
        oneRock(cx, cy, sz, p.seed + i * 37);
        i++;
      }
      /* alus: klassinen kolmio + peräliekki-viiri */
      if (p.ship) {
        const sx = W / 2, sy = H * 0.7, ss = p.size * 0.6;
        const dir = -Math.PI / 2 + (rng() - 0.5) * 0.6;
        const tip = [sx + Math.cos(dir) * ss, sy + Math.sin(dir) * ss];
        const l = [sx + Math.cos(dir + 2.4) * ss * 0.8, sy + Math.sin(dir + 2.4) * ss * 0.8];
        const r = [sx + Math.cos(dir - 2.4) * ss * 0.8, sy + Math.sin(dir - 2.4) * ss * 0.8];
        const bl = [sx + Math.cos(dir + Math.PI) * ss * 0.35, sy + Math.sin(dir + Math.PI) * ss * 0.35];
        paths.push({ pts: [tip, l, bl, r, tip], closed: true, layer: L });
      }
      /* ammukset: pienet viivanpätkät */
      for (let b = 0; b < Math.round(p.bullets); b++) {
        const bx = m + rng() * (W - 2 * m), by = m + rng() * (H - 2 * m);
        const a = rng() * Math.PI * 2;
        paths.push({ pts: [[bx, by], [bx + Math.cos(a) * 2, by + Math.sin(a) * 2]], closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## attractor.js

```js
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
```

## barcode.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "barcode",
    name: "Barcode", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "orient", label: "Orientation", type: "select", options: ["Vertical bars", "Horizontal bars"], def: "Vertical bars" },
      { key: "barMin", label: "Bar min mm", type: "slider", min: 0.3, max: 20, step: 0.1, def: 0.8 },
      { key: "barMax", label: "Bar max mm", type: "slider", min: 0.5, max: 40, step: 0.1, def: 8 },
      { key: "gapMin", label: "Gap min mm", type: "slider", min: 0.3, max: 20, step: 0.1, def: 1 },
      { key: "gapMax", label: "Gap max mm", type: "slider", min: 0.5, max: 40, step: 0.1, def: 6 },
      { key: "fill", label: "Fill spacing mm", type: "slider", min: 0.2, max: 5, step: 0.05, def: 0.6 },
      { key: "hJit", label: "Height jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 719 + 29);
      const vert = p.orient === "Vertical bars";
      const along0 = p.margin, along1 = vert ? H - p.margin : W - p.margin; /* viivan suunta */
      const across0 = p.margin, across1 = vert ? W - p.margin : H - p.margin; /* palkkien etenemissuunta */
      const bMin = Math.min(p.barMin, p.barMax), bMax = Math.max(p.barMin, p.barMax);
      const gMin = Math.min(p.gapMin, p.gapMax), gMax = Math.max(p.gapMin, p.gapMax);
      const L = Math.round(p.layer);
      const paths = [];
      let x = across0;
      let flip = false; /* boustrophedon: joka toinen viiva vastakkaiseen suuntaan */
      let guard = 0;
      while (x < across1 - bMin && guard++ < 4000) {
        const w = Math.min(bMin + rng() * (bMax - bMin), across1 - x);
        /* korkeusjitter per palkki */
        const a0 = along0 + rng() * p.hJit * (along1 - along0) * 0.35;
        const a1 = along1 - rng() * p.hJit * (along1 - along0) * 0.35;
        const n = Math.max(1, Math.round(w / Math.max(0.2, p.fill)));
        const sp = n > 0 ? w / n : w;
        for (let k = 0; k <= n; k++) {
          const c = x + k * sp;
          const A = flip ? a1 : a0, B = flip ? a0 : a1;
          paths.push({
            pts: vert ? [[c, A], [c, B]] : [[A, c], [B, c]],
            closed: false, layer: L,
          });
          flip = !flip;
        }
        x += w + gMin + rng() * (gMax - gMin);
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## bitcrush.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "bitcrush",
    name: "Bitcrush",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "rate", label: "Sample rate mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 4 },
      { key: "depth", label: "Bit depth grid mm (0=off)", type: "slider", min: 0, max: 12, step: 0.25, def: 2 },
      { key: "axis", label: "Quantize axis", type: "select", options: ["Both", "X only", "Y only"], def: "Both" }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const rate = Math.max(0.3, p.rate);
      const q = Math.max(0, p.depth);
      const qx = p.axis !== "Y only", qy = p.axis !== "X only";
      const snap = (v) => q > 0.01 ? Math.round(v / q) * q : v;
      const paths = [];
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, rate).map(([x, y]) => [
          qx ? snap(x) : x, qy ? snap(y) : y
        ]);
        /* quantizing can stack identical points: dedupe (no zero-length marks) */
        const clean = [];
        for (const pt of pts) {
          const last = clean[clean.length - 1];
          if (!last || Math.abs(last[0] - pt[0]) > 1e-6 || Math.abs(last[1] - pt[1]) > 1e-6) clean.push(pt);
        }
        if (path.closed && clean.length > 2) {
          const a = clean[0], b = clean[clean.length - 1];
          if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) clean.pop();
        }
        if (clean.length > 1) paths.push({ pts: clean, closed: path.closed && clean.length > 2, layer: path.layer });
      });
      return { paths };
    }
  
};
```

## bluesprig.js

```js
import { Pin, mulberry32, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "bluesprig",
    name: "Blueberry Sprig",
    cat: "gen",
    group: "nature",
    desc: "Hand-drawn blueberry sprigs after an embroidered original: a wandering main stem with sharp little kinks, sparse side branches, berries as small circles on stalk tips (sometimes clustered), and loose open cup flowers. Tip mix balances berries against cups; Leaves adds pointed ovals along the branches. A light ink wobble is baked in - chain into Hand Drawn for more.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "sprigs", label: "Sprigs", type: "slider", min: 1, max: 5, step: 1, def: 1 },
      { key: "height", label: "Height mm", type: "slider", min: 40, max: 240, step: 5, def: 150 },
      { key: "branches", label: "Branches", type: "slider", min: 1, max: 7, step: 1, def: 4 },
      { key: "tipMix", label: "Tips: berries - cups", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "leaves", label: "Leaves", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "wobble", label: "Ink wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 14 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 30) return applyStyle({ paths: [] }, ins[0]);
      const L = Math.round(p.layer);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer: L
        });
      };
      const NS = Math.max(1, Math.min(5, Math.round(p.sprigs)));
      const HT = Math.min(p.height, y1 - y0 - 6);
      for (let s = 0; s < NS; s++) {
        const sd = (p.seed * 733 + s * 419) | 0;
        const rng = mulberry32(sd);
        const wob = (x, y, k) => (noise2(x * 0.09 + k * 7, y * 0.09, sd + k) - 0.5) * 2 * p.wobble * 1.1;
        const jig = (pts) => pts.map(([x, y], i) => [x + wob(x, y, 1), y + wob(x, y, 2)]);
        /* base position: sprigs spread horizontally, tails clear of margins */
        const bx = x0 + ((s + 0.5) / NS) * (x1 - x0) + (rng() - 0.5) * (x1 - x0) * 0.1 / NS;
        const by = y1 - 2;
        /* --- main stem: upward wander with sharp little kinks --- */
        const segLen = HT / 15;
        let x = bx, y = by;
        let ang = -Math.PI / 2 + (rng() - 0.5) * 0.2;
        const stem = [[x, y]];
        const nSeg = 15;
        for (let i = 0; i < nSeg; i++) {
          /* smooth wander + occasional sharp kink like the stitched original */
          ang += (rng() - 0.5) * 0.28;
          if (rng() < 0.22) ang += (rng() < 0.5 ? 1 : -1) * (0.5 + rng() * 0.5);
          /* pull back upright and inside */
          ang = ang * 0.82 + (-Math.PI / 2) * 0.18;
          if (x < x0 + 14) ang = ang * 0.7 + (-Math.PI / 3) * 0.3;
          if (x > x1 - 14) ang = ang * 0.7 + (-Math.PI * 2 / 3) * 0.3;
          x += Math.cos(ang) * segLen;
          y += Math.sin(ang) * segLen;
          stem.push([x, y]);
        }
        /* interpolate stem finer for drawing */
        const fine = resample(stem, false, 1.6);
        push(jig(fine), false);
        /* --- tips: stem top + branch ends carry berries or cups --- */
        const tipAt = (tx, ty, dirAng) => {
          const roll = rng();
          if (roll < 1 - p.tipMix) {
            /* berry cluster: 1-3 circles on short fanning stalklets */
            const nb = 1 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
            for (let b = 0; b < nb; b++) {
              const fa = dirAng + (b - (nb - 1) / 2) * 0.55 + (rng() - 0.5) * 0.25;
              const sl = 4 + rng() * 5;
              const ex = tx + Math.cos(fa) * sl, ey = ty + Math.sin(fa) * sl;
              push(jig([[tx, ty], [ex, ey]]), false);
              const r = 1.4 + rng() * 1.1;
              const cx2 = ex + Math.cos(fa) * r, cy2 = ey + Math.sin(fa) * r;
              const nn = 10 + Math.round(rng() * 3);
              const c = [];
              for (let k = 0; k < nn; k++) {
                const a = (k / nn) * Math.PI * 2;
                c.push([cx2 + Math.cos(a) * r, cy2 + Math.sin(a) * r]);
              }
              push(jig(c), true);
            }
          } else {
            /* loose open cup flower: irregular arc from ~210deg to ~-30deg, open at the mouth */
            const sl = 3 + rng() * 4;
            const ex = tx + Math.cos(dirAng) * sl, ey = ty + Math.sin(dirAng) * sl;
            push(jig([[tx, ty], [ex, ey]]), false);
            const cw = 5 + rng() * 4, ch = 6 + rng() * 4;
            const rot = dirAng + Math.PI / 2 + (rng() - 0.5) * 0.4;
            const cup = [];
            const nn = 9 + Math.round(rng() * 3);
            const a0 = Math.PI * 1.18, a1 = -Math.PI * 0.18;
            const cr = rot - Math.PI / 2;
            const cc = Math.cos(cr), cs = Math.sin(cr);
            for (let k = 0; k <= nn; k++) {
              const a = a0 + (k / nn) * (a1 - a0);
              const rr = 1 + (rng() - 0.5) * 0.22;
              const px = Math.cos(a) * cw * 0.5 * rr;
              const py = Math.sin(a) * ch * 0.55 * rr + ch * 0.4;
              cup.push([ex + px * cc - py * cs, ey + px * cs + py * cc]);
            }
            push(jig(cup), false);
          }
        };
        /* stem top tip */
        const tip = fine[fine.length - 1];
        const tipPrev = fine[Math.max(0, fine.length - 4)];
        tipAt(tip[0], tip[1], Math.atan2(tip[1] - tipPrev[1], tip[0] - tipPrev[0]));
        /* --- branches --- */
        const NB = Math.round(p.branches);
        for (let b = 0; b < NB; b++) {
          const t = 0.25 + (b / Math.max(1, NB - 1)) * 0.6 + (rng() - 0.5) * 0.06;
          const idx = Math.min(fine.length - 2, Math.max(1, Math.round(t * fine.length)));
          const bp = fine[idx];
          const sd2 = Math.atan2(fine[idx + 1][1] - fine[idx - 1][1], fine[idx + 1][0] - fine[idx - 1][0]);
          const side = rng() < 0.5 ? 1 : -1;
          let ba = sd2 + side * (0.5 + rng() * 0.55);
          const blen = HT * (0.12 + rng() * 0.16) * (1 - t * 0.4);
          const bSegs = 4 + Math.round(rng() * 3);
          let bx2 = bp[0], by2 = bp[1];
          const br = [[bx2, by2]];
          for (let i = 0; i < bSegs; i++) {
            ba += (rng() - 0.5) * 0.35;
            ba = ba * 0.85 + (-Math.PI / 2) * 0.15; /* branches also reach up */
            bx2 += Math.cos(ba) * (blen / bSegs);
            by2 += Math.sin(ba) * (blen / bSegs);
            br.push([bx2, by2]);
          }
          const bf = resample(br, false, 1.6);
          push(jig(bf), false);
          tipAt(bx2, by2, ba);
          /* leaves along the branch */
          if (rng() < p.leaves * 1.6) {
            const li = Math.max(1, Math.round(bf.length * (0.3 + rng() * 0.4)));
            const lp = bf[Math.min(bf.length - 2, li)];
            const la = ba + (rng() < 0.5 ? 1 : -1) * (0.9 + rng() * 0.4);
            const ll = 5 + rng() * 4;
            const leaf = [];
            const half = 7;
            const lw = ll * 0.32;
            for (let k = 0; k <= half; k++) {          /* base -> tip, one side */
              const t2 = k / half;
              const along = t2 * ll, w2 = Math.sin(t2 * Math.PI) * lw;
              leaf.push([lp[0] + Math.cos(la) * along - Math.sin(la) * w2,
                         lp[1] + Math.sin(la) * along + Math.cos(la) * w2]);
            }
            for (let k = half - 1; k > 0; k--) {       /* tip -> base, other side */
              const t2 = k / half;
              const along = t2 * ll, w2 = -Math.sin(t2 * Math.PI) * lw;
              leaf.push([lp[0] + Math.cos(la) * along - Math.sin(la) * w2,
                         lp[1] + Math.sin(la) * along + Math.cos(la) * w2]);
            }
            push(jig(leaf), true);
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## bridges.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "bridges",
  name: "Bridges",
  cat: "mod",
  group: "pathops",
  desc: "Connects points of the input with bridge lines. Source picks the points: Vertices (resampled at a spacing), Path centers (one point per path - Polka Dots or Phyllotaxis circles become nodes), or Endpoints of open paths. Rules: k-nearest, Within distance, Chain (one continuous nearest-neighbour stroke; Max bridge splits it at long jumps) or Delaunay edges. Trim ends stops each bridge short of its points so lines never pierce the dots.",
  ins: [Pin("paths", "Source")],
  outs: [Pin("paths")],
  params: [
    { key: "source", label: "Points from", type: "select", options: ["Path centers", "Vertices", "Endpoints"], def: "Path centers" },
    { key: "spacing", label: "Vertex spacing mm (0=raw)", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
    { key: "rule", label: "Connect", type: "select", options: ["k-nearest", "Within distance", "Chain", "Delaunay"], def: "k-nearest" },
    { key: "k", label: "k (nearest)", type: "slider", min: 1, max: 8, step: 1, def: 3 },
    { key: "dist", label: "Within mm", type: "slider", min: 2, max: 120, step: 1, def: 30 },
    { key: "maxPer", label: "Max per point", type: "slider", min: 1, max: 12, step: 1, def: 6 },
    { key: "minLen", label: "Min bridge mm", type: "slider", min: 0, max: 60, step: 1, def: 0 },
    { key: "maxLen", label: "Max bridge mm (0=off)", type: "slider", min: 0, max: 250, step: 1, def: 0 },
    { key: "trim", label: "Trim ends mm", type: "slider", min: 0, max: 12, step: 0.25, def: 0 },
    { key: "keep", label: "Keep source", type: "check", def: true },
    { key: "layer", label: "Bridge pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const L = Math.round(p.layer);
    const out = p.keep ? src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) : [];

    /* ---- gather points ---- */
    let pts = [];
    if (p.source === "Path centers") {
      for (const pa of src.paths) {
        if (pa.pts.length < 1) continue;
        let sx = 0, sy = 0;
        for (const q of pa.pts) { sx += q[0]; sy += q[1]; }
        pts.push([sx / pa.pts.length, sy / pa.pts.length]);
      }
    } else if (p.source === "Endpoints") {
      for (const pa of src.paths) {
        if (pa.closed || pa.pts.length < 2) continue;
        pts.push(pa.pts[0].slice(), pa.pts[pa.pts.length - 1].slice());
      }
    } else {
      for (const pa of src.paths) {
        const list = p.spacing > 0.01 ? resample(pa.pts, pa.closed, Math.max(1, p.spacing)) : pa.pts;
        for (const q of list) pts.push([q[0], q[1]]);
      }
    }
    /* dedupe near-identical */
    const seen = new Set();
    pts = pts.filter(([x, y]) => {
      const k2 = Math.round(x * 10) + "," + Math.round(y * 10);
      if (seen.has(k2)) return false;
      seen.add(k2);
      return true;
    });
    const CAP = p.rule === "Delaunay" ? 600 : 1500;
    if (pts.length > CAP) {
      const stride = pts.length / CAP;
      const dec = [];
      for (let i = 0; i < CAP; i++) dec.push(pts[Math.floor(i * stride)]);
      pts = dec;
    }
    const n = pts.length;
    if (n < 2) return { paths: out };
    const dOf = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
    const minL = Math.max(0, p.minLen);
    const maxL = p.maxLen > 0.5 ? p.maxLen : Infinity;
    const lenOk = (d) => d >= minL && d <= maxL;

    /* ---- build edges ---- */
    const edges = []; /* [a, b, d] */
    if (p.rule === "Chain") {
      const visited = new Uint8Array(n);
      let cur = 0;
      visited[0] = 1;
      let run = [pts[0].slice()];
      const flush = () => { if (run.length > 1) out.push({ pts: run, closed: false, layer: L }); run = []; };
      for (let step = 1; step < n; step++) {
        let best = -1, bd = Infinity;
        for (let j = 0; j < n; j++) {
          if (visited[j]) continue;
          const d = dOf(cur, j);
          if (d < bd - 1e-9) { bd = d; best = j; }
        }
        visited[best] = 1;
        if (bd > maxL) { flush(); run = [pts[best].slice()]; }
        else run.push(pts[best].slice());
        cur = best;
      }
      flush();
      return { paths: out };
    }
    if (p.rule === "Delaunay") {
      const big = Math.max(ctx.W, ctx.H) * 10;
      const P = pts.concat([[ctx.W / 2 - big, ctx.H / 2 - big], [ctx.W / 2 + big, ctx.H / 2 - big], [ctx.W / 2, ctx.H / 2 + big]]);
      let tris = [[n, n + 1, n + 2]];
      const circum = (i, j, k2) => {
        const [ax, ay] = P[i], [bx, by] = P[j], [cx, cy] = P[k2];
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) < 1e-12) return null;
        const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
        const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
        const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
        return [ux, uy, (ux - ax) * (ux - ax) + (uy - ay) * (uy - ay)];
      };
      const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
      for (let pi = 0; pi < n; pi++) {
        const [px, py] = P[pi];
        const bad = [];
        for (let t = 0; t < tris.length; t++) {
          const cc = circum(tris[t][0], tris[t][1], tris[t][2]);
          if (!cc) continue;
          const dx = px - cc[0], dy = py - cc[1];
          if (dx * dx + dy * dy < cc[2] - 1e-9) bad.push(t);
        }
        const edgeCount = new Map();
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            const k2 = ek(u, v);
            edgeCount.set(k2, (edgeCount.get(k2) || 0) + 1);
          }
        }
        const boundary = [];
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            if (edgeCount.get(ek(u, v)) === 1) boundary.push([u, v]);
          }
        }
        for (let i = bad.length - 1; i >= 0; i--) tris.splice(bad[i], 1);
        for (const [u, v] of boundary) tris.push([u, v, pi]);
      }
      const eseen = new Set();
      for (const [a, b, c] of tris) {
        if (a >= n || b >= n || c >= n) continue;
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const k2 = ek(u, v);
          if (eseen.has(k2)) continue;
          eseen.add(k2);
          const d = dOf(u, v);
          if (lenOk(d)) edges.push([u, v, d]);
        }
      }
    } else {
      /* candidate pairs: k-nearest sets, or all pairs within dist */
      const cand = [];
      const ekSeen = new Set();
      const addCand = (a, b) => {
        const k2 = a < b ? a + "_" + b : b + "_" + a;
        if (ekSeen.has(k2)) return;
        ekSeen.add(k2);
        const d = dOf(a, b);
        if (lenOk(d) && (p.rule === "k-nearest" || d <= p.dist)) cand.push([a, b, d]);
      };
      if (p.rule === "k-nearest") {
        const kk = Math.max(1, Math.round(p.k));
        for (let i = 0; i < n; i++) {
          const ds = [];
          for (let j = 0; j < n; j++) if (j !== i) ds.push([dOf(i, j), j]);
          ds.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
          for (let q = 0; q < Math.min(kk, ds.length); q++) addCand(i, ds[q][1]);
        }
      } else {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          if (dOf(i, j) <= p.dist) addCand(i, j);
        }
      }
      /* greedy by ascending length under per-point cap */
      cand.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
      const deg = new Uint16Array(n);
      const cap = Math.max(1, Math.round(p.maxPer));
      for (const [a, b, d] of cand) {
        if (deg[a] >= cap || deg[b] >= cap) continue;
        deg[a]++; deg[b]++;
        edges.push([a, b, d]);
      }
    }

    /* ---- emit with trim ---- */
    const tr = Math.max(0, p.trim);
    for (const [a, b, d] of edges) {
      let [ax, ay] = pts[a], [bx, by] = pts[b];
      if (tr > 0.01) {
        if (d <= tr * 2 + 0.4) continue;
        const ux = (bx - ax) / d, uy = (by - ay) / d;
        ax += ux * tr; ay += uy * tr;
        bx -= ux * tr; by -= uy * tr;
      }
      out.push({ pts: [[ax, ay], [bx, by]], closed: false, layer: L });
    }
    return { paths: out };
  },
};
```

## cables.js

```js
import { Pin, PENS, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "cables",
    name: "Cables", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Cables", type: "slider", min: 1, max: 40, step: 1, def: 9 },
      { key: "length", label: "Length mm", type: "slider", min: 50, max: 2000, step: 10, def: 600 },
      { key: "waviness", label: "Waviness", type: "slider", min: 0.05, max: 1.5, step: 0.05, def: 0.45 },
      { key: "wscale", label: "Turn scale", type: "slider", min: 0.2, max: 5, step: 0.1, def: 1.5 },
      { key: "startMode", label: "Layout", type: "select", options: ["Edges (in & out)", "Pile (inside)"], def: "Edges (in & out)" },
      { key: "penPer", label: "Pen per cable", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 63 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const paths = [];
      for (let c = 0; c < Math.round(p.count); c++) {
        const rng = mulberry32(p.seed * 1447 + c * 331 + 17);
        let x, y, heading;
        if (p.startMode === "Pile (inside)") {
          x = W * (0.3 + rng() * 0.4);
          y = H * (0.3 + rng() * 0.4);
          heading = rng() * Math.PI * 2;
        } else {
          /* aloitus satunnaiselta reunalta, suunta sisaanpain */
          const edge = Math.floor(rng() * 4);
          if (edge === 0) { x = m + rng() * (W - 2 * m); y = m; heading = Math.PI / 2; }
          else if (edge === 1) { x = W - m; y = m + rng() * (H - 2 * m); heading = Math.PI; }
          else if (edge === 2) { x = m + rng() * (W - 2 * m); y = H - m; heading = -Math.PI / 2; }
          else { x = m; y = m + rng() * (H - 2 * m); heading = 0; }
          heading += (rng() - 0.5) * 0.8;
        }
        const pts = [[x, y]];
        const step = 1.2;
        const nSteps = Math.min(4000, Math.round(p.length / step));
        for (let i = 0; i < nSteps; i++) {
          /* pehmea kohinaohjattu kaantyminen (johdon jaykkyys = inertia) */
          const turn = (noise2(i * 0.02 * p.wscale, c * 13.7, p.seed) - 0.5) * 2 * p.waviness * 0.35;
          heading += turn;
          /* pehmea tyonto reunoilta sisaanpain */
          const edgeD = 22;
          let steer = 0;
          const toCenter = Math.atan2(H / 2 - y, W / 2 - x);
          const dEdge = Math.min(x - m, W - m - x, y - m, H - m - y);
          if (dEdge < edgeD) {
            let dA = toCenter - heading;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            steer = dA * (1 - dEdge / edgeD) * 0.25;
          }
          heading += steer;
          x += Math.cos(heading) * step;
          y += Math.sin(heading) * step;
          x = Math.max(m, Math.min(W - m, x));
          y = Math.max(m, Math.min(H - m, y));
          pts.push([x, y]);
        }
        paths.push({
          pts, closed: false,
          layer: p.penPer ? (Math.round(p.layer) + c) % PENS.length : Math.round(p.layer),
        });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## cagewarp.js

```js
import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "cagewarp",
    name: "Cage Warp",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "grid", label: "Cage cells", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "amount", label: "Amount mm", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "pin", label: "Pin edges", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.5 },
      { key: "seed", label: "Seed", type: "seed", def: 23 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const G = Math.max(1, Math.min(8, Math.round(p.grid)));
      const amt = Math.max(0, p.amount);
      /* seeded control-point displacements on a (G+1)x(G+1) lattice */
      const dxs = [], dys = [];
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          const border = i === 0 || j === 0 || i === G || j === G;
          const k = p.pin && border ? 0 : 1;
          dxs.push((hash2(i * 7 + 1, j * 7 + 2, p.seed) - 0.5) * 2 * amt * k);
          dys.push((hash2(i * 7 + 3, j * 7 + 4, p.seed + 99) - 0.5) * 2 * amt * k);
        }
      }
      const at = (arr, i, j) => arr[j * (G + 1) + i];
      const ss = (t) => t * t * (3 - 2 * t);
      const disp = (x, y) => {
        const u = Math.max(0, Math.min(0.9999, x / W)) * G;
        const v = Math.max(0, Math.min(0.9999, y / H)) * G;
        const i = Math.floor(u), j = Math.floor(v);
        const fu = ss(u - i), fv = ss(v - j);
        const bl = (arr) =>
          at(arr, i, j) * (1 - fu) * (1 - fv) + at(arr, i + 1, j) * fu * (1 - fv) +
          at(arr, i, j + 1) * (1 - fu) * fv + at(arr, i + 1, j + 1) * fu * fv;
        return [bl(dxs), bl(dys)];
      };
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.3, p.res)).map(([x, y]) => {
          const [dx, dy] = disp(x, y);
          return [clampX(x + dx), clampY(y + dy)];
        })
      }));
      return { paths };
    }
  
};
```

## carve.js

```js
import { Pin, EMPTY, pathLength } from "../helpers.js";

export default {
  key: "carve",
    name: "Carve",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "t0", label: "Start t (0-1)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "t1", label: "End t (0-1, wire Frame)", type: "slider", min: 0, max: 1, step: 0.001, def: 1 },
      { key: "invert", label: "Keep outside", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      let a = Math.max(0, Math.min(1, Math.min(p.t0, p.t1)));
      let b = Math.max(0, Math.min(1, Math.max(p.t0, p.t1)));
      const paths = [];
      const extract = (pts, s0, s1, layer) => {
        /* substring of a polyline by arc length, interpolated cut points */
        if (s1 - s0 < 0.01) return;
        const out = [];
        let acc = 0, started = false;
        for (let i = 1; i < pts.length; i++) {
          const ax = pts[i - 1][0], ay = pts[i - 1][1];
          const bx = pts[i][0], by = pts[i][1];
          const seg = Math.hypot(bx - ax, by - ay);
          if (seg < 1e-9) continue;
          const e0 = acc, e1 = acc + seg;
          if (e1 > s0 && e0 < s1) {
            const f0 = Math.max(0, (s0 - e0) / seg);
            const f1 = Math.min(1, (s1 - e0) / seg);
            if (!started) {
              out.push([ax + (bx - ax) * f0, ay + (by - ay) * f0]);
              started = true;
            }
            out.push([ax + (bx - ax) * f1, ay + (by - ay) * f1]);
          }
          acc = e1;
          if (e1 >= s1) break;
        }
        if (out.length > 1) paths.push({ pts: out, closed: false, layer });
      };
      src.paths.forEach((path) => {
        const raw = path.closed ? [...path.pts, path.pts[0]] : path.pts;
        const total = pathLength(raw, false);
        if (total < 0.01 || raw.length < 2) return;
        if (!p.invert && a <= 0.0005 && b >= 0.9995) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        if (!p.invert) {
          extract(raw, a * total, b * total, path.layer);
        } else if (path.closed) {
          /* complement of the window wraps around a closed path */
          const dbl = [...raw.slice(0, -1), ...raw];
          extract(dbl, b * total, (a + 1) * total, path.layer);
        } else {
          extract(raw, 0, a * total, path.layer);
          extract(raw, b * total, total, path.layer);
        }
      });
      return { paths };
    }
  
};
```

## caustics.js

```js
import { Pin, EMPTY, noise2, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "caustics",
    name: "Caustics",
    cat: "gen",
    group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cell", label: "Sample cell mm", type: "slider", min: 1, max: 8, step: 0.25, def: 3 },
      { key: "scale", label: "Ripple scale", type: "slider", min: 0.01, max: 0.12, step: 0.005, def: 0.045 },
      { key: "octaves", label: "Detail octaves", type: "slider", min: 1, max: 4, step: 1, def: 3 },
      { key: "focus", label: "Focus / caustic gain", type: "slider", min: 0.2, max: 4, step: 0.05, def: 1.4 },
      { key: "thresh", label: "Brightness threshold", type: "slider", min: 0.1, max: 0.9, step: 0.02, def: 0.5 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "stretch", label: "Depth stretch", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "minlen", label: "Min line mm", type: "slider", min: 0, max: 30, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 5 || y1 - y0 < 5) return EMPTY;

      const cell = Math.max(0.6, p.cell);
      const cols = Math.max(2, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.max(2, Math.round((y1 - y0) / cell) + 1);
      const sc = Math.max(0.001, p.scale);
      const oct = Math.max(1, Math.min(4, Math.round(p.octaves)));
      const seed = p.seed;

      /* --- water-surface height as multi-octave value noise ---
         Two slightly offset noise fields stand in for two crossing
         wave trains; their interference makes the polygonal net. */
      const stretchY = 1 - Math.max(0, Math.min(1, p.stretch)) * 0.6; /* squash y => elongated ripples toward viewer */
      const surf = (x, y) => {
        let v = 0, amp = 1, fq = 1, norm = 0;
        for (let o = 0; o < oct; o++) {
          const sx = x * sc * fq;
          const sy = y * sc * fq * stretchY;
          const a = noise2(sx, sy, seed + o * 17);
          const b = noise2(sy * 1.3 + 11, sx * 1.3 + 5, seed + 100 + o * 17);
          v += amp * (a + b) * 0.5;
          norm += amp;
          amp *= 0.5; fq *= 2;
        }
        return v / norm; /* [0,1) */
      };

      /* --- caustic brightness ≈ curvature (Laplacian) of the surface.
         Where the wavy "lens" surface converges, light focuses -> bright.
         We rectify and gamma it so only the crests read as lines. */
      const h = cell; /* finite-difference step in mm */
      const bright = (x, y) => {
        const c = surf(x, y);
        const lap =
          surf(x + h, y) + surf(x - h, y) +
          surf(x, y + h) + surf(x, y - h) - 4 * c;
        /* positive curvature = focusing; scale by cell^2 to normalize */
        let b = -lap * (1 / (sc * sc * h * h)) * 0.00004 * p.focus;
        b = 0.5 + b; /* center around mid so threshold band works both ways */
        return b;
      };

      /* --- sample the field on the grid --- */
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const field = new Float64Array(cols * rows);
      let fmin = Infinity, fmax = -Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = bright(gx(c), gy(r));
          field[r * cols + c] = v;
          if (v < fmin) fmin = v;
          if (v > fmax) fmax = v;
        }
      }
      const span = (fmax - fmin) || 1;
      const at = (c, r) => (field[r * cols + c] - fmin) / span; /* normalized [0,1] */

      /* --- marching squares iso-contours at one or more levels --- */
      const paths = [];
      const nb = Math.max(1, Math.min(12, Math.round(p.bands)));
      const base = Math.max(0.02, Math.min(0.98, p.thresh));
      const minLen = Math.max(0, p.minlen);

      const interp = (va, vb, lvl) => {
        const d = vb - va;
        if (Math.abs(d) < 1e-9) return 0.5;
        return (lvl - va) / d;
      };

      for (let bi = 0; bi < nb; bi++) {
        /* spread bands around the base threshold */
        const level = nb === 1 ? base
          : base + (bi - (nb - 1) / 2) * (0.9 / nb) * 0.5;
        const lvl = Math.max(0.01, Math.min(0.99, level));

        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = at(c, r), tr = at(c + 1, r);
            const bl = at(c, r + 1), br = at(c + 1, r + 1);
            let idx = 0;
            if (tl > lvl) idx |= 8;
            if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2;
            if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;

            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eLf = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];

            const seg = (a, b) => {
              paths.push({ pts: [a, b], closed: false, layer: L });
            };

            switch (idx) {
              case 1: seg(eLf(), eB()); break;
              case 2: seg(eB(), eR()); break;
              case 3: seg(eLf(), eR()); break;
              case 4: seg(eT(), eR()); break;
              case 5: seg(eLf(), eT()); seg(eB(), eR()); break; /* saddle */
              case 6: seg(eT(), eB()); break;
              case 7: seg(eLf(), eT()); break;
              case 8: seg(eLf(), eT()); break;
              case 9: seg(eT(), eB()); break;
              case 10: seg(eLf(), eB()); seg(eT(), eR()); break; /* saddle */
              case 11: seg(eT(), eR()); break;
              case 12: seg(eLf(), eR()); break;
              case 13: seg(eB(), eR()); break;
              case 14: seg(eLf(), eB()); break;
            }
          }
        }
      }

      /* --- stitch touching segments into longer polylines so the pen
         draws flowing caustic threads instead of thousands of dashes --- */
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map(); /* endpoint key -> list of {seg, end} */
      const segs = paths.map((pa) => ({ a: pa.pts[0], b: pa.pts[1], used: false }));
      const push = (key, ref) => {
        let a = map.get(key); if (!a) { a = []; map.set(key, a); } a.push(ref);
      };
      segs.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });

      const chains = [];
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].used) continue;
        segs[i].used = true;
        const chain = [segs[i].a, segs[i].b];
        /* extend forward */
        let grow = true;
        while (grow) {
          grow = false;
          const tail = chain[chain.length - 1];
          const cands = map.get(kk(tail)) || [];
          for (const ref of cands) {
            const s = segs[ref.i];
            if (s.used) continue;
            const other = ref.end === "a" ? s.b : s.a;
            chain.push(other); s.used = true; grow = true; break;
          }
        }
        /* extend backward */
        grow = true;
        while (grow) {
          grow = false;
          const head = chain[0];
          const cands = map.get(kk(head)) || [];
          for (const ref of cands) {
            const s = segs[ref.i];
            if (s.used) continue;
            const other = ref.end === "a" ? s.b : s.a;
            chain.unshift(other); s.used = true; grow = true; break;
          }
        }
        chains.push(chain);
      }

      const out = [];
      let acc = 0;
      const BUDGET = 110000;
      for (const chain of chains) {
        if (chain.length < 2) continue;
        if (minLen > 0 && pathLength(chain, false) < minLen) continue;
        if (acc + chain.length > BUDGET) break;
        acc += chain.length;
        out.push({ pts: chain, closed: false, layer: L });
      }

      return applyStyle({ paths: out }, ins[0]);
    },
  
};
```

## cellular_mosaic.js

```js
import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "cellular_mosaic",
    name: "Cellular Mosaic Displace",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 719 },
      { key: "scale", label: "Cell Size (mm)", type: "slider", min: 3, max: 40, step: 0.5, def: 12 },
      { key: "shatter", label: "Shatter Explode", type: "slider", min: 0, max: 25, step: 0.5, def: 8 },
      { key: "quantize", label: "Snap to Grid", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      const cellSize = Math.max(1, p.scale);
      const q = cellSize / 4; /* sub-lattice pitch for quantize mode */

      const flushSeg = (pts, layer) => {
        /* drop consecutive duplicates; a path of identical points is a
           zero-length pen mark */
        const clean = [];
        for (const pt of pts) {
          const last = clean[clean.length - 1];
          if (!last || Math.abs(last[0] - pt[0]) > 1e-6 || Math.abs(last[1] - pt[1]) > 1e-6) {
            clean.push(pt);
          }
        }
        if (clean.length > 1) paths.push({ pts: clean, closed: false, layer });
      };

      src.paths.forEach((path) => {
        const densified = resample(path.pts, path.closed, 0.5);
        if (densified.length < 2) return;
        let currentPts = [];
        let lastCellKey = "";
        for (let i = 0; i < densified.length; i++) {
          const [x, y] = densified[i];
          const gx = Math.floor(x / cellSize);
          const gy = Math.floor(y / cellSize);
          const hx = hash2(gx, gy, p.seed);
          const hy = hash2(gx, gy, p.seed + 555);
          const cellKey = gx + "_" + gy;
          if (cellKey !== lastCellKey && currentPts.length > 0) {
            flushSeg(currentPts, path.layer);
            currentPts = [];
          }
          const dx = (hx - 0.5) * p.shatter;
          const dy = (hy - 0.5) * p.shatter;
          let nx = x + dx;
          let ny = y + dy;
          if (p.quantize) {
            /* snap the point to a sub-lattice INSIDE the cell.
               (Snapping every point to one cell corner collapsed whole
               segments into zero-length stacks of identical points.) */
            nx = Math.round(x / q) * q + dx;
            ny = Math.round(y / q) * q + dy;
          }
          currentPts.push([nx, ny]);
          lastCellKey = cellKey;
        }
        flushSeg(currentPts, path.layer);
      });
      return { paths };
    }
  
};
```

## chop.js

```js
import { Pin, EMPTY, PENS, mulberry32, resample } from "../helpers.js";

export default {
  key: "chop",
    name: "Chop", cat: "mod", group: "cutsplit", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "length", label: "Piece length mm", type: "slider", min: 1, max: 80, step: 0.5, def: 12 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 20, step: 0.25, def: 0 },
      { key: "pens", label: "Pens to use", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "start", label: "Start pen", type: "pen", def: 0 },
      { key: "assign", label: "Assign", type: "select", options: ["Cycle", "Random"], def: "Cycle" },
      { key: "seed", label: "Seed", type: "seed", def: 61 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const nP = Math.round(p.pens);
      const paths = [];
      let globalIdx = 0;
      src.paths.forEach((path, pi) => {
        const rng = mulberry32(p.seed * 379 + pi * 149 + 7);
        const pts = resample(path.pts, path.closed, 0.5);
        const closedPts = path.closed ? [...pts, pts[0]] : pts;
        const cum = [0];
        for (let i = 1; i < closedPts.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(closedPts[i][0] - closedPts[i - 1][0], closedPts[i][1] - closedPts[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 0.5) return;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          return [closedPts[lo][0] + (closedPts[hi][0] - closedPts[lo][0]) * f,
                  closedPts[lo][1] + (closedPts[hi][1] - closedPts[lo][1]) * f, lo];
        };
        let s = 0;
        while (s < total - 0.3) {
          const pieceLen = Math.max(0.5, p.length * (1 - p.lenVar * rng()));
          const s0 = s + p.gap / 2;
          const s1 = Math.min(total, s + pieceLen - p.gap / 2);
          if (s1 - s0 > 0.3) {
            const [ax, ay, aIdx] = at(s0);
            const [bx, by, bIdx] = at(s1);
            const piece = [[ax, ay]];
            for (let i = aIdx + 1; i <= bIdx; i++) piece.push([closedPts[i][0], closedPts[i][1]]);
            piece.push([bx, by]);
            const pen = p.assign === "Random"
              ? Math.floor(rng() * nP)
              : globalIdx % nP;
            paths.push({ pts: piece, closed: false, layer: (Math.round(p.start) + pen) % PENS.length });
            globalIdx++;
          }
          s += pieceLen;
        }
      });
      return { paths };
    },
  
};
```

## circpack.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "circpack",
    name: "Circle Packing", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "attempts", label: "Attempts", type: "slider", min: 50, max: 3000, step: 50, def: 800 },
      { key: "minR", label: "Min R mm", type: "slider", min: 0.5, max: 15, step: 0.25, def: 1.5 },
      { key: "maxR", label: "Max R mm", type: "slider", min: 2, max: 60, step: 0.5, def: 18 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 14 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 271 + 91);
      const circles = [];
      for (let a = 0; a < p.attempts; a++) {
        const x = p.margin + rng() * (W - 2 * p.margin);
        const y = p.margin + rng() * (H - 2 * p.margin);
        let r = Math.min(p.maxR, x - p.margin, W - p.margin - x, y - p.margin, H - p.margin - y);
        for (const c of circles) {
          const d = Math.hypot(x - c[0], y - c[1]) - c[2];
          if (d < r) r = d;
          if (r < p.minR) break;
        }
        if (r >= p.minR) circles.push([x, y, r]);
      }
      const paths = circles.map(([x, y, r]) => {
        const n = Math.min(64, Math.max(12, Math.ceil(r * 2.5)));
        const pts = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        return { pts, closed: true, layer: Math.round(p.layer) };
      });
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## clouds.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "clouds",
  name: "Clouds",
  cat: "gen",
  group: "nature",
  desc: "Old-etching cumulus: each cloud is a row of overlapping lobe circles plus a few stacked on top, drawn as scalloped visible arcs. Inner creases lets each arc continue a little way behind its neighbour, like an engraver's line; Hatch shading adds horizontal rows that thin upward plus a dashed drop shadow under the flat base.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Clouds", type: "slider", min: 1, max: 12, step: 1, def: 4 },
    { key: "size", label: "Size mm", type: "slider", min: 20, max: 220, step: 1, def: 90 },
    { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "lobes", label: "Lobes", type: "slider", min: 3, max: 14, step: 1, def: 7 },
    { key: "flat", label: "Flat base", type: "check", def: true },
    { key: "crease", label: "Inner creases", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "shade", label: "Hatch shading", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
    { key: "zone", label: "Sky zone %", type: "slider", min: 20, max: 100, step: 1, def: 55 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 33 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "shadePen", label: "Shade pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 24 || H - 2 * m < 24) return applyStyle({ paths: [] }, ins[0]);
    const rng = mulberry32(p.seed * 6089 + 17);
    const L = Math.round(p.layer), SP = Math.round(p.shadePen);
    const paths = [];

    const drawCloud = (ccx, baseY, w, h, sd) => {
      const rr = mulberry32(sd);
      const nL = Math.max(3, Math.round(p.lobes));
      const nB = Math.max(2, Math.round(nL * 0.6));
      const nT = Math.max(0, nL - nB);
      const lobes = [];
      for (let i = 0; i < nB; i++) {
        const t = nB === 1 ? 0.5 : i / (nB - 1);
        const prof = 0.55 + 0.45 * Math.sin(Math.PI * (0.1 + 0.8 * t));
        const r = h * 0.52 * prof * (0.8 + 0.4 * rr());
        const x = ccx + (t - 0.5) * (w - h * 0.5) + (rr() - 0.5) * h * 0.12;
        lobes.push({ x, y: baseY - r * 0.72, r });
      }
      for (let i = 0; i < nT; i++) {
        const t = nT === 1 ? 0.5 : i / (nT - 1);
        const r = h * (0.3 + 0.22 * rr());
        const x = ccx + (t - 0.5) * w * 0.45 + (rr() - 0.5) * h * 0.15;
        lobes.push({ x, y: baseY - h * (0.72 + 0.28 * rr()), r });
      }
      /* scalloped outline: hide points deeper inside a neighbour than the crease depth */
      for (let i = 0; i < lobes.length; i++) {
        const c = lobes[i];
        const n = Math.max(24, Math.round((Math.PI * 2 * c.r) / 0.8));
        const vis = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = c.x + Math.cos(a) * c.r, y = c.y + Math.sin(a) * c.r;
          let v = !(p.flat && y > baseY + 0.01);
          if (v) {
            for (let j = 0; j < lobes.length; j++) {
              if (j === i) continue;
              const o = lobes[j];
              const depth = o.r - Math.hypot(x - o.x, y - o.y);
              const allow = 0.15 + p.crease * Math.min(o.r, c.r) * 0.35;
              if (depth > allow) { v = false; break; }
            }
          }
          vis.push(v ? [x, y] : null);
        }
        const s0 = vis.findIndex((q) => q === null);
        if (s0 < 0) {
          paths.push({ pts: vis.map((q) => q.slice()), closed: true, layer: L });
          continue;
        }
        let run = [];
        const flush = () => { if (run.length > 2) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        for (let k = 1; k <= n; k++) {
          const q = vis[(s0 + k) % n];
          if (q) run.push([q[0], q[1]]); else flush();
        }
        flush();
      }
      /* flat base: merged chords where lobes span the base line */
      if (p.flat) {
        const iv = [];
        for (const c of lobes) {
          const dy = baseY - c.y;
          if (Math.abs(dy) < c.r) {
            const dx = Math.sqrt(c.r * c.r - dy * dy);
            iv.push([c.x - dx, c.x + dx]);
          }
        }
        iv.sort((a, b) => a[0] - b[0]);
        let cur = null;
        const spans = [];
        for (const s of iv) {
          if (!cur || s[0] > cur[1] + 0.2) { cur = [s[0], s[1]]; spans.push(cur); }
          else cur[1] = Math.max(cur[1], s[1]);
        }
        for (const s of spans) paths.push({ pts: [[s[0], baseY], [s[1], baseY]], closed: false, layer: L });
      }
      /* hatch shading: horizontal rows thinning upward, inset from the silhouette */
      if (p.shade > 0.02) {
        const inside = (x, y) => {
          if (p.flat && y > baseY - 0.4) return false;
          for (const c of lobes) if (Math.hypot(x - c.x, y - c.y) < c.r - 0.7) return true;
          return false;
        };
        let y = baseY - 1.1, sp2 = 1.25, row = 0;
        const maxRows = Math.round(2 + p.shade * 10);
        const step = 0.8;
        while (row < maxRows && y > baseY - h * 1.05) {
          let runS = null;
          for (let x = ccx - w * 0.7; x <= ccx + w * 0.7 + step; x += step) {
            const on = inside(x, y) && noise2(x * 0.35, y * 0.35, sd + row * 13) > 0.18 + row * 0.03;
            if (on && runS === null) runS = x;
            else if (!on && runS !== null) {
              if (x - runS > 1.6) paths.push({ pts: [[runS, y], [x - step, y]], closed: false, layer: SP });
              runS = null;
            }
          }
          row++;
          sp2 *= 1.28;
          y -= sp2;
        }
        /* dashed drop shadow under the base */
        if (p.flat && p.shade > 0.15) {
          for (let s = 0; s < 2; s++) {
            const yy = baseY + 2 + s * 2.4;
            const half = w * (0.34 - s * 0.09);
            const dr = mulberry32(sd * 53 + s);
            let x = ccx - half;
            while (x < ccx + half) {
              const len = 2 + dr() * 4;
              if (dr() < 0.75) paths.push({ pts: [[x, yy], [Math.min(x + len, ccx + half), yy]], closed: false, layer: SP });
              x += len + 1.4 + dr() * 2.2;
            }
          }
        }
      }
    };

    const zoneH = Math.max(20, (H - 2 * m) * (p.zone / 100));
    const nC = Math.max(1, Math.round(p.count));
    const placed = [];
    let guard = 0;
    while (placed.length < nC && guard++ < nC * 60) {
      const w = Math.max(14, p.size * (1 - p.sizeVar * rng()));
      const h = w * 0.42;
      const we = w * 1.3; /* lobes + creases can poke past w/2, reserve room */
      if (W - 2 * m < we + 2) continue;
      const cx = m + we / 2 + rng() * (W - 2 * m - we);
      const yLo = m + h * 1.45;
      const yHi = Math.min(H - m - 7, m + zoneH);
      if (yHi <= yLo) continue;
      const cy = yLo + rng() * (yHi - yLo);
      let ok = true;
      for (const q of placed) {
        if (Math.abs(cx - q[0]) < (w + q[2]) * 0.55 && Math.abs(cy - q[1]) < (h + q[3]) * 0.85) { ok = false; break; }
      }
      if (!ok) continue;
      placed.push([cx, cy, w, h]);
      drawCloud(cx, cy, w, h, p.seed * 197 + placed.length * 131);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
```

## coil.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "coil",
    name: "Coil", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "radius", label: "Radius mm", type: "slider", min: 0.5, max: 15, step: 0.1, def: 3 },
      { key: "pitch", label: "Pitch mm / loop", type: "slider", min: 0.5, max: 25, step: 0.1, def: 4 },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "layer", label: "Coil pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        const base = resample(path.pts, path.closed, 0.5);
        if (base.length < 3) continue;
        const cum = [0];
        for (let i = 1; i < base.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 1) continue;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = base[lo][0] + (base[hi][0] - base[lo][0]) * f;
          const y = base[lo][1] + (base[hi][1] - base[lo][1]) * f;
          const tx = base[hi][0] - base[lo][0], ty = base[hi][1] - base[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };
        /* trokoidi: ympyraliike etenevan pisteen ymparilla -> silmukat kun pitch < 2*pi*r */
        const loops = total / Math.max(0.2, p.pitch);
        const stepsPerLoop = Math.max(12, Math.ceil((Math.PI * 2 * p.radius) / 0.7));
        const nSteps = Math.min(60000, Math.ceil(loops * stepsPerLoop));
        const pts = [];
        for (let i = 0; i <= nSteps; i++) {
          const th = (i / nSteps) * loops * Math.PI * 2;
          const s = (th / (Math.PI * 2)) * p.pitch;
          const [x, y, tx, ty] = at(s);
          const cr = p.radius * Math.cos(th), sr = p.radius * Math.sin(th);
          pts.push([x + tx * cr - ty * sr, y + ty * cr + tx * sr]);
        }
        paths.push({ pts, closed: false, layer: p.keepCol ? path.layer : Math.round(p.layer) });
      }
      return { paths };
    },
  
};
```

## comets.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "comets",
    name: "Comets",
    cat: "gen",
    group: "nature",
    desc: "Comets with a nucleus and a sweeping tail. Detailed style draws the ball with coma arcs and a fan of curved tail streamlines; Minimal is just a dot and a single line. Body and tail on separate pens for two-color plots. Tails all point away from the sun direction with a little natural scatter.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "style", label: "Style", type: "select", options: ["Detailed", "Minimal"], def: "Detailed" },
      { key: "count", label: "Comets", type: "slider", min: 1, max: 12, step: 1, def: 3 },
      { key: "size", label: "Ball size mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "tailLen", label: "Tail length mm", type: "slider", min: 10, max: 160, step: 2, def: 70 },
      { key: "tailLines", label: "Tail lines", type: "slider", min: 1, max: 9, step: 1, def: 5 },
      { key: "curve", label: "Tail curve", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "sunAng", label: "Sun direction deg", type: "slider", min: 0, max: 360, step: 5, def: 315 },
      { key: "bodyPen", label: "Ball pen", type: "pen", def: 0 },
      { key: "tailPen", label: "Tail pen", type: "pen", def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 2 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 6113 + 41);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      const circle = (cx, cy, r) => {
        const nn = Math.max(10, Math.round(r * 5));
        const c = [];
        for (let k = 0; k < nn; k++) {
          const a = (k / nn) * Math.PI * 2;
          c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return c;
      };
      const bodyPen = Math.round(p.bodyPen), tailPen = Math.round(p.tailPen);
      const N = Math.round(p.count);
      const K = p.style === "Minimal" ? 1 : Math.round(p.tailLines);
      for (let i = 0; i < N; i++) {
        const r = (p.size / 2) * (0.6 + rng() * 0.6);
        const tl = p.tailLen * (0.6 + rng() * 0.5);
        const ta = ((p.sunAng + 180) * Math.PI) / 180 + (rng() - 0.5) * 0.35; /* tail away from sun */
        /* keep ball + tail box inside margins */
        const pad = r * 2 + 2;
        const ex = Math.cos(ta) * tl, ey = Math.sin(ta) * tl;
        const lo = (v, e) => v + Math.min(0, e) - pad, hi = (v, e) => v + Math.max(0, e) + pad;
        let cx = 0, cy = 0, ok = false;
        for (let t2 = 0; t2 < 40 && !ok; t2++) {
          cx = x0 + pad + rng() * (x1 - x0 - 2 * pad);
          cy = y0 + pad + rng() * (y1 - y0 - 2 * pad);
          ok = lo(cx, ex) >= x0 - 0.5 && hi(cx, ex) <= x1 + 0.5 && lo(cy, ey) >= y0 - 0.5 && hi(cy, ey) <= y1 + 0.5;
        }
        if (!ok) continue;
        if (p.style === "Minimal") {
          if (p.size < 1.2) push([[cx, cy], [cx + 0.1, cy]], false, bodyPen);
          else push(circle(cx, cy, r), true, bodyPen);
          push([[cx + Math.cos(ta) * r, cy + Math.sin(ta) * r], [cx + ex, cy + ey]], false, tailPen);
          continue;
        }
        /* Detailed: nucleus + coma arcs + fan of curved streamlines */
        push(circle(cx, cy, r), true, bodyPen);
        for (const cr of [1.5, 2.1]) {
          const arc = [];
          const nn = 16;
          for (let k = 0; k <= nn; k++) {
            const a = ta + Math.PI + (-0.9 + (k / nn) * 1.8); /* arc on the sun side */
            arc.push([cx + Math.cos(a) * r * cr, cy + Math.sin(a) * r * cr]);
          }
          push(arc, false, bodyPen);
        }
        const perp = ta + Math.PI / 2;
        const bendDir = rng() < 0.5 ? 1 : -1;
        for (let k = 0; k < K; k++) {
          const f = K > 1 ? (k / (K - 1) - 0.5) : 0;
          const spread = f * r * 1.6;
          const sxp = cx + Math.cos(ta) * r * 0.9 + Math.cos(perp) * spread;
          const syp = cy + Math.sin(ta) * r * 0.9 + Math.sin(perp) * spread;
          const len = tl * (0.55 + (1 - Math.abs(f) * 1.2) * 0.45) * (0.9 + rng() * 0.2);
          const line = [];
          const nn = Math.max(8, Math.round(len / 2.5));
          for (let s = 0; s <= nn; s++) {
            const t2 = s / nn;
            const bend = p.curve * bendDir * t2 * t2 * len * 0.35;
            const fan = spread * t2 * 1.6;
            line.push([
              sxp + Math.cos(ta) * len * t2 + Math.cos(perp) * (bend + fan),
              syp + Math.sin(ta) * len * t2 + Math.sin(perp) * (bend + fan)
            ]);
          }
          push(line, false, tailPen);
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## concrete.js

```js
import { Pin, EMPTY, mulberry32, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "concrete",
    name: "Concrete Poetry", cat: "gen", group: "textimg",
    ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text (| = line, space = word)", type: "text", def: "WORD IS IMAGE" },
      { key: "mode", label: "Layout", type: "select", options: ["Fill region", "Spiral", "Wave", "Scatter words"], def: "Fill region" },
      { key: "size", label: "Size mm", type: "slider", min: 2, max: 40, step: 0.5, def: 7 },
      { key: "sizeVar", label: "Size variation (scatter)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "track", label: "Tracking", type: "slider", min: 0.6, max: 2.5, step: 0.05, def: 1 },
      { key: "lineh", label: "Line height ×", type: "slider", min: 0.9, max: 3, step: 0.05, def: 1.35 },
      { key: "turns", label: "Turns (spiral)", type: "slider", min: 1, max: 14, step: 0.5, def: 5 },
      { key: "waveAmp", label: "Wave amp mm", type: "slider", min: 0, max: 60, step: 1, def: 16 },
      { key: "waveLen", label: "Wave length mm", type: "slider", min: 20, max: 400, step: 5, def: 130 },
      { key: "count", label: "Words (scatter)", type: "slider", min: 5, max: 400, step: 5, def: 80 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 151 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const text = String(p.text || "").toUpperCase();
      const paths = [];
      /* alue: suljetut sisaantulopolut tai marginaalilaatikko */
      const regions = ins[0] && ins[0].paths ? ins[0].paths.filter((q) => q.closed && q.pts.length > 2) : [];
      const inside = (x, y) => {
        if (!regions.length) return x >= m && x <= W - m && y >= m && y <= H - m;
        let cnt = 0;
        for (const path of regions) {
          const pts = path.pts;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
                (x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0])) cnt++;
          }
        }
        return cnt % 2 === 1;
      };
      let bx0 = m, by0 = m, bx1 = W - m, by1 = H - m;
      if (regions.length) {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
        for (const path of regions) for (const [x, y] of path.pts) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      }
      /* glyyfin piirto: sijainti + rotaatio + skaala; palauttaa etenemismitan */
      const drawGlyph = (ch, x, y, size, ang, guard) => {
        const g = SFONT[ch] || SFONT[" "];
        const sc = size / 10;
        const adv = (g.w + 2) * sc * p.track;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        /* guard: piirra vain jos glyyfin keskikohta on alueen sisalla */
        const gcx = x + (adv / 2) * ca - (size / 2) * -sa;
        const gcy = y + (adv / 2) * sa + (size / 2) * -ca;
        if (guard && !inside(x + (adv / 2) * ca, y + (adv / 2) * sa - (size * 0.4) * ca * 0)) return adv;
        if (guard && !inside(gcx, gcy)) return adv;
        for (const stroke of g.s) {
          if (stroke.length < 2) continue;
          paths.push({
            pts: stroke.map(([gx, gy]) => {
              const lx = gx * sc, ly = (gy - 10) * sc; /* baseline y=0 */
              return [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
            }),
            closed: false, layer: L,
          });
        }
        return adv;
      };
      const lineText = text.replace(/\|/g, " ");
      if (p.mode === "Fill region") {
        /* rivit toistuvaa tekstia; glyyfi piirtyy vain alueen sisalla */
        const src2 = lineText + "  ";
        let row = 0;
        for (let y = by0 + p.size; y <= by1; y += p.size * p.lineh, row++) {
          /* rivioffset ettei sama sana pinoudu */
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, 0, true);
          }
        }
      } else if (p.mode === "Spiral") {
        /* arkhimedeen spiraali ulkoa sisaan, teksti toistuu */
        const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const maxR = Math.min(bx1 - bx0, by1 - by0) / 2 - p.size;
        const loopGap = Math.max(p.size * p.lineh, maxR / Math.max(1, p.turns));
        const rAt = (th) => maxR - (th / (Math.PI * 2)) * loopGap;
        let th = 0, ci = 0;
        const srcT = lineText + " \u00B7 ";
        let guardCount = 0;
        while (rAt(th) > p.size && guardCount++ < 3000) {
          const r = rAt(th);
          const x = cx + Math.cos(th) * r;
          const y = cy + Math.sin(th) * r;
          const ch = srcT[ci % srcT.length];
          ci++;
          const g = SFONT[ch] || SFONT[" "];
          const adv = (g.w + 2) * (p.size / 10) * p.track;
          /* tangentin suunta + kaarevuuskorjattu kulma-askel */
          drawGlyph(ch, x, y, p.size, th + Math.PI / 2, false);
          th += adv / Math.max(2, r);
        }
      } else if (p.mode === "Wave") {
        const src2 = lineText + "  ";
        let row = 0;
        for (let y0 = by0 + p.size; y0 <= by1; y0 += p.size * p.lineh, row++) {
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ph = (x / p.waveLen) * Math.PI * 2 + row * 0.7;
            const y = y0 + Math.sin(ph) * p.waveAmp * 0.5;
            /* kulma seuraa aallon derivaattaa */
            const slope = Math.cos(ph) * p.waveAmp * 0.5 * (Math.PI * 2 / p.waveLen);
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, Math.atan(slope), true) * Math.cos(Math.atan(slope) * 0.5);
          }
        }
      } else {
        /* Scatter: sanat hajallaan alueen sisalla */
        const words = lineText.split(/\s+/).filter(Boolean);
        if (!words.length) return EMPTY;
        const rng = mulberry32(p.seed * 6689 + 127);
        let placed = 0, guard = 0;
        while (placed < Math.round(p.count) && guard++ < p.count * 25) {
          const word = words[Math.floor(rng() * words.length)];
          const size = p.size * (1 - p.sizeVar * rng());
          const ang = (rng() - 0.5) * 1.1;
          const x0 = bx0 + rng() * (bx1 - bx0);
          const y0 = by0 + rng() * (by1 - by0);
          if (!inside(x0, y0)) continue;
          let x = x0;
          for (const ch of word) {
            x += drawGlyph(ch, x, y0 + (x - x0) * Math.tan(ang) * 0, size, ang, true);
          }
          placed++;
        }
      }
      return applyStyle({ paths }, ins[1]);
    },
  
};
```

## conway.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "conway",
    name: "Conway",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Grid columns", type: "slider", min: 10, max: 80, step: 1, def: 40 },
      { key: "fill", label: "Initial fill", type: "slider", min: 0.05, max: 0.8, step: 0.05, def: 0.35 },
      { key: "gens", label: "Generations (wire LFO/Frame)", type: "slider", min: 0, max: 200, step: 1, def: 20 },
      { key: "wrap", label: "Wrap edges", type: "check", def: true },
      { key: "style", label: "Cell style", type: "select", options: ["Squares", "Dots", "Diamonds"], def: "Squares" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 19 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
      const cols = Math.max(4, Math.min(100, Math.round(p.cols)));
      const cell = bw / cols;
      const rows = Math.max(4, Math.floor(bh / cell));
      /* deterministic replay: seed the board, run N generations from scratch.
         Stateless per compute -> wire a value into Generations to animate growth */
      const rng = mulberry32(p.seed * 7477 + 3);
      let grid = new Uint8Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = rng() < p.fill ? 1 : 0;
      const gens = Math.max(0, Math.min(400, Math.floor(p.gens)));
      const wrap = !!p.wrap;
      let next = new Uint8Array(cols * rows);
      for (let g = 0; g < gens; g++) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                let xx = x + dx, yy = y + dy;
                if (wrap) { xx = (xx + cols) % cols; yy = (yy + rows) % rows; }
                else if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
                n += grid[yy * cols + xx];
              }
            }
            const alive = grid[y * cols + x];
            next[y * cols + x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
          }
        }
        const t = grid; grid = next; next = t;
      }
      const paths = [];
      const L = Math.round(p.layer);
      const pad = cell * 0.12;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!grid[y * cols + x]) continue;
          const x0 = m + x * cell + pad, y0 = m + y * cell + pad;
          const x1 = m + (x + 1) * cell - pad, y1 = m + (y + 1) * cell - pad;
          const cxx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
          if (p.style === "Dots") {
            const r = cell * 0.28;
            const pts = [];
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              pts.push([cxx + Math.cos(a) * r, cyy + Math.sin(a) * r]);
            }
            paths.push({ pts, closed: true, layer: L });
          } else if (p.style === "Diamonds") {
            paths.push({ pts: [[cxx, y0], [x1, cyy], [cxx, y1], [x0, cyy]], closed: true, layer: L });
          } else {
            paths.push({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## copypoints.js

```js
import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "copypoints",
    name: "Copy to Points",
    cat: "duo",
    ins: [Pin("paths", "Points"), Pin("paths", "Motif")],
    outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Point spacing mm (0=vertices)", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
      { key: "scale", label: "Scale %", type: "slider", min: 5, max: 300, step: 1, def: 100 },
      { key: "sjit", label: "Scale jitter %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
      { key: "rmode", label: "Rotation", type: "select", options: ["None", "Along tangent", "Random"], def: "None" },
      { key: "rjit", label: "Rotation jitter deg", type: "slider", min: 0, max: 180, step: 1, def: 0 },
      { key: "prob", label: "Probability", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
      { key: "seed", label: "Seed", type: "seed", def: 31 }
    ],
    compute(ins, p, ctx) {
      const ptsIn = ins[0], motifIn = ins[1];
      if (!ptsIn || !ptsIn.paths || !ptsIn.paths.length) return EMPTY;
      if (!motifIn || !motifIn.paths || !motifIn.paths.length) return EMPTY;
      /* motif centered on its bounding-box center */
      let mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
      for (const pa of motifIn.paths) for (const [x, y] of pa.pts) {
        if (x < mx0) mx0 = x; if (x > mx1) mx1 = x;
        if (y < my0) my0 = y; if (y > my1) my1 = y;
      }
      const mcx = (mx0 + mx1) / 2, mcy = (my0 + my1) / 2;
      const paths = [];
      const BUDGET = 100000;
      let total = 0, idx = 0;
      for (const host of ptsIn.paths) {
        const pts = p.spacing > 0.01
          ? resample(host.pts, host.closed, Math.max(0.5, p.spacing))
          : host.pts;
        for (let i = 0; i < pts.length; i++) {
          idx++;
          if (p.prob < 1 && hash2(idx * 3 + 1, 5, p.seed) >= p.prob) continue;
          const sc = (p.scale / 100) *
            (1 + (hash2(idx * 3 + 2, 7, p.seed) - 0.5) * 2 * (p.sjit / 100));
          if (sc <= 0.001) continue;
          let ang = 0;
          if (p.rmode === "Along tangent") {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          } else if (p.rmode === "Random") {
            ang = hash2(idx * 3 + 3, 9, p.seed) * Math.PI * 2;
          }
          ang += (hash2(idx * 3 + 4, 11, p.seed) - 0.5) * 2 * (p.rjit * Math.PI / 180);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const [px, py] = pts[i];
          for (const mp of motifIn.paths) {
            if (total + mp.pts.length > BUDGET) return { paths };
            total += mp.pts.length;
            paths.push({
              pts: mp.pts.map(([x, y]) => {
                const lx = (x - mcx) * sc, ly = (y - mcy) * sc;
                return [px + lx * ca - ly * sa, py + lx * sa + ly * ca];
              }),
              closed: mp.closed, layer: mp.layer
            });
          }
        }
      }
      return { paths };
    }
  
};
```

## crop.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "crop",
      name: "Crop",
    cat: "mod", group: "cutsplit",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "x", label: "X mm", type: "slider", min: -100, max: 400, step: 1, def: 40 },
      { key: "y", label: "Y mm", type: "slider", min: -100, max: 400, step: 1, def: 30 },
      { key: "w", label: "Width mm", type: "slider", min: 5, max: 400, step: 1, def: 220 },
      { key: "h", label: "Height mm", type: "slider", min: 5, max: 400, step: 1, def: 140 },
      { key: "keep", label: "Keep", type: "select", options: ["Inside", "Outside"], def: "Inside" },
    ],
    overlay(p) {
      return [{ kind: "rect", x: p.x, y: p.y, w: p.w, h: p.h }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const insideRect = ([x, y]) =>
        x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      const want = (pt) => (p.keep === "Inside" ? insideRect(pt) : !insideRect(pt));
      /* rajanylityksen tarkennus bisektiolla (a haluttu, b ei) */
      const cross = (a, b) => {
        let lo = a, hi = b;
        for (let i = 0; i < 10; i++) {
          const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
          if (want(mid)) lo = mid; else hi = mid;
        }
        return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
      };
      const paths = [];
      for (const path of src.paths) {
        const pts = resample(path.pts, path.closed, 0.8);
        const seq = path.closed && pts.length > 1 ? [...pts, pts[0]] : pts;
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer: path.layer });
          run = [];
        };
        for (let i = 0; i < seq.length; i++) {
          const cur = seq[i];
          const inW = want(cur);
          if (inW) {
            if (run.length === 0 && i > 0 && !want(seq[i - 1])) run.push(cross(cur, seq[i - 1]));
            run.push(cur);
          } else {
            if (run.length > 0) {
              run.push(cross(seq[i - 1], cur));
              flush();
            }
          }
        }
        /* kokonaan sisalla pysynyt suljettu polku sailyy suljettuna */
        if (path.closed && run.length === seq.length) {
          run.pop();
          paths.push({ pts: run, closed: true, layer: path.layer });
        } else flush();
      }
      return { paths };
    }
  
};
```

## cull.js

```js
import { Pin, EMPTY, hash2, pathLength } from "../helpers.js";

export default {
  key: "cull",
    name: "Cull",
    cat: "mod",
    group: "penout",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Criterion", type: "select", options: ["Random", "Every Nth", "Shorter than", "Longer than"], def: "Random" },
      { key: "keep", label: "Keep probability", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "nth", label: "N (Every Nth)", type: "slider", min: 2, max: 20, step: 1, def: 2 },
      { key: "len", label: "Length mm", type: "slider", min: 0, max: 200, step: 1, def: 20 },
      { key: "invert", label: "Invert selection", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 61 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      src.paths.forEach((path, i) => {
        let drop;
        if (p.mode === "Every Nth") {
          drop = (i % Math.max(2, Math.round(p.nth))) === 0;
        } else if (p.mode === "Shorter than") {
          drop = pathLength(path.pts, path.closed) < p.len;
        } else if (p.mode === "Longer than") {
          drop = pathLength(path.pts, path.closed) > p.len;
        } else {
          drop = hash2(i * 13 + 5, 3, p.seed) >= Math.max(0, Math.min(1, p.keep));
        }
        if (p.invert) drop = !drop;
        if (!drop) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
      });
      return { paths };
    }
  
};
```

## cycloidm.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "cycloidm",
    name: "Cycloid Machine", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "gearDist", label: "Gear distance", type: "slider", min: 20, max: 150, step: 1, def: 60 },
      { key: "gearY", label: "Gears offset Y", type: "slider", min: 20, max: 160, step: 1, def: 85 },
      { key: "r1", label: "Crank 1 radius", type: "slider", min: 2, max: 50, step: 0.5, def: 15 },
      { key: "f1", label: "Crank 1 speed", type: "slider", min: -20, max: 20, step: 0.01, def: 3 },
      { key: "r2", label: "Crank 2 radius", type: "slider", min: 2, max: 50, step: 0.5, def: 21 },
      { key: "f2", label: "Crank 2 speed", type: "slider", min: -20, max: 20, step: 0.01, def: 5.02 },
      { key: "L1", label: "Rod 1 length", type: "slider", min: 20, max: 200, step: 0.5, def: 95 },
      { key: "L2", label: "Rod 2 length", type: "slider", min: 20, max: 200, step: 0.5, def: 82 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 0.8 },
      { key: "table", label: "Table speed", type: "slider", min: -4, max: 4, step: 0.01, def: 0.13 },
      { key: "turns", label: "Duration (turns)", type: "slider", min: 2, max: 200, step: 1, def: 40 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* Cycloid Drawing Machine: kaksi kampea, kaksi nivelivartta -> kyna on
         varsiympyroiden leikkauspiste; paperi pyorii omalla poydallaan. */
      const G1 = [-p.gearDist / 2, p.gearY];
      const G2 = [p.gearDist / 2, p.gearY];
      const N = Math.min(40000, Math.round(p.turns * 420));
      const raw = [];
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns;
        const a1 = 2 * Math.PI * p.f1 * t;
        const a2 = 2 * Math.PI * p.f2 * t + p.phase;
        const P1 = [G1[0] + Math.cos(a1) * p.r1, G1[1] + Math.sin(a1) * p.r1];
        const P2 = [G2[0] + Math.cos(a2) * p.r2, G2[1] + Math.sin(a2) * p.r2];
        /* ympyroiden (P1,L1) ja (P2,L2) leikkaus */
        const dx = P2[0] - P1[0], dy = P2[1] - P1[1];
        const d = Math.hypot(dx, dy) || 1e-9;
        let pen;
        if (d >= p.L1 + p.L2) {
          /* varret suorassa: piste janan jatkeella suhteessa */
          const f = p.L1 / (p.L1 + p.L2);
          pen = [P1[0] + dx * f, P1[1] + dy * f];
        } else if (d <= Math.abs(p.L1 - p.L2)) {
          const f = p.L1 / Math.max(0.01, d);
          pen = [P1[0] + dx * f, P1[1] + dy * f];
        } else {
          const a = (p.L1 * p.L1 - p.L2 * p.L2 + d * d) / (2 * d);
          const h = Math.sqrt(Math.max(0, p.L1 * p.L1 - a * a));
          const mx = P1[0] + (dx / d) * a, my = P1[1] + (dy / d) * a;
          const c1 = [mx - (dy / d) * h, my + (dx / d) * h];
          const c2 = [mx + (dy / d) * h, my - (dx / d) * h];
          /* jatkuvuus: valitse edellista lahempi haara (alussa ylempi = kyna poydan puolella) */
          if (prev) {
            pen = Math.hypot(c1[0] - prev[0], c1[1] - prev[1]) <= Math.hypot(c2[0] - prev[0], c2[1] - prev[1]) ? c1 : c2;
          } else {
            pen = c1[1] < c2[1] ? c1 : c2;
          }
        }
        prev = pen;
        /* pyoriva poyta origossa: kyna paperin koordinaatistoon */
        const ta = -2 * Math.PI * p.table * t;
        const ca = Math.cos(ta), sa = Math.sin(ta);
        raw.push([pen[0] * ca - pen[1] * sa, pen[0] * sa + pen[1] * ca]);
      }
      /* sovita canvasille */
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  
};
```

## dazzle.js

```js
import { Pin, mulberry32, hash2, applyStyle, signedArea } from "../helpers.js";

export default {
  key: "dazzle",
    name: "Dazzle Camouflage",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "patches", label: "Patches", type: "slider", min: 2, max: 60, step: 1, def: 14 },
      { key: "spacing", label: "Stripe spacing mm", type: "slider", min: 1, max: 12, step: 0.25, def: 3 },
      { key: "jitter", label: "Angle jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "blank", label: "Blank patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "cross", label: "Cross-hatch patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
      { key: "wavy", label: "Wavy patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
      { key: "outline", label: "Patch outlines", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 17 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);

      const rng = mulberry32((p.seed | 0) * 2654435761 + 7);
      const target = Math.max(1, Math.min(80, Math.round(p.patches)));
      const sp = Math.max(0.8, p.spacing);
      const MINAREA = Math.max(60, sp * sp * 6);

      /* --- recursive BSP: split the largest convex patch with a random chord --- */
      const area = (poly) => Math.abs(signedArea(poly));
      const centroid = (poly) => {
        let cx = 0, cy = 0;
        for (const q of poly) { cx += q[0]; cy += q[1]; }
        return [cx / poly.length, cy / poly.length];
      };
      const splitConvex = (poly, px, py, ang) => {
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        const d = nx * px + ny * py;
        const A = [], B = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          const a = poly[i], b = poly[(i + 1) % n];
          const da = nx * a[0] + ny * a[1] - d;
          const db = nx * b[0] + ny * b[1] - d;
          if (da >= -1e-9) A.push(a);
          if (da <= 1e-9) B.push(a);
          if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
            const t = da / (da - db);
            const ip = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            A.push(ip); B.push(ip);
          }
        }
        return [A, B];
      };

      let polys = [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
      let guard = 0;
      while (polys.length < target && guard++ < 400) {
        /* pick largest patch */
        let bi = 0, ba = -1;
        for (let i = 0; i < polys.length; i++) {
          const a = area(polys[i]);
          if (a > ba) { ba = a; bi = i; }
        }
        if (ba < MINAREA * 2.2) break; /* nothing big enough left to split */
        const poly = polys[bi];
        const [ccx, ccy] = centroid(poly);
        const px = ccx + (rng() - 0.5) * Math.sqrt(ba) * 0.4;
        const py = ccy + (rng() - 0.5) * Math.sqrt(ba) * 0.4;
        const ang = rng() * Math.PI;
        const [A, B] = splitConvex(poly, px, py, ang);
        if (A.length >= 3 && B.length >= 3 && area(A) > MINAREA && area(B) > MINAREA) {
          polys.splice(bi, 1, A, B);
        }
        /* else: retry with new random point/angle next iteration */
      }

      /* --- per-patch styling: clashing quantized angles --- */
      const paths = [];
      const clampRect = (q) => [
        Math.max(x0, Math.min(x1, q[0])),
        Math.max(y0, Math.min(y1, q[1])),
      ];
      const angleSteps = [0, 30, 60, 90, 120, 150];
      let prevIdx = -1;

      const hatch = (poly, phi, spacing, wavyAmp, wavePhase) => {
        const dx = Math.cos(phi), dy = Math.sin(phi);
        const nx = -dy, ny = dx;
        let cmin = Infinity, cmax = -Infinity;
        for (const q of poly) {
          const c = nx * q[0] + ny * q[1];
          if (c < cmin) cmin = c;
          if (c > cmax) cmax = c;
        }
        let rev = false;
        for (let c = cmin + spacing / 2; c < cmax; c += spacing) {
          /* intersect infinite line (n·q = c) with convex polygon edges */
          const hits = [];
          const n = poly.length;
          for (let i = 0; i < n; i++) {
            const a = poly[i], b = poly[(i + 1) % n];
            const da = nx * a[0] + ny * a[1] - c;
            const db = nx * b[0] + ny * b[1] - c;
            if ((da > 0 && db <= 0) || (da <= 0 && db > 0)) {
              const t = da / (da - db);
              hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
          }
          if (hits.length < 2) continue;
          hits.sort((u, v) => (u[0] * dx + u[1] * dy) - (v[0] * dx + v[1] * dy));
          let A = hits[0], B = hits[hits.length - 1];
          const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
          if (len < 0.6) continue;
          if (rev) { const t = A; A = B; B = t; } /* serpentine: pen-friendly */
          rev = !rev;
          if (wavyAmp > 0.05 && len > 4) {
            const K = Math.max(3, Math.round(len / 2));
            const pts = [];
            for (let k = 0; k <= K; k++) {
              const u = k / K;
              const bx = A[0] + (B[0] - A[0]) * u;
              const by = A[1] + (B[1] - A[1]) * u;
              const off = Math.sin(u * len * 0.9 + wavePhase + c * 0.3) * wavyAmp;
              pts.push(clampRect([bx + nx * off, by + ny * off]));
            }
            paths.push({ pts, closed: false, layer: L });
          } else {
            paths.push({ pts: [A, B], closed: false, layer: L });
          }
        }
      };

      for (let i = 0; i < polys.length; i++) {
        const poly = polys[i];
        if (poly.length < 3 || area(poly) < 1) continue;
        if (p.outline) {
          paths.push({ pts: poly.map((q) => q.slice()), closed: true, layer: L });
        }
        const h1 = hash2(i * 7 + 1, 3, p.seed);
        if (h1 < Math.max(0, Math.min(1, p.blank))) { prevIdx = -1; continue; }
        /* clashing angle: quantized palette, never repeat the previous patch */
        let ai = Math.floor(hash2(i * 7 + 2, 9, p.seed) * angleSteps.length) % angleSteps.length;
        if (ai === prevIdx) ai = (ai + 2) % angleSteps.length;
        prevIdx = ai;
        const jit = (hash2(i * 7 + 3, 11, p.seed) - 0.5) * 24 * Math.max(0, Math.min(1, p.jitter));
        const phi = ((angleSteps[ai] + jit) * Math.PI) / 180;
        const spLocal = sp * (0.75 + 0.5 * hash2(i * 7 + 4, 13, p.seed));
        const isWavy = hash2(i * 7 + 5, 15, p.seed) < Math.max(0, Math.min(1, p.wavy));
        const amp = isWavy ? Math.min(spLocal * 0.32, 1.6) : 0;
        const phase = hash2(i * 7 + 6, 17, p.seed) * Math.PI * 2;
        hatch(poly, phi, spLocal, amp, phase);
        if (hash2(i * 7 + 8, 19, p.seed) < Math.max(0, Math.min(1, p.cross))) {
          hatch(poly, phi + Math.PI / 2 + 0.12, spLocal * 1.4, 0, 0);
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## delaunay.js

```js
import { Pin, mulberry32, resample, applyStyle } from "../helpers.js";

export default {
  key: "delaunay",
    name: "Delaunay",
    cat: "gen",
    group: "geometric",
    ins: [Pin("paths", "Points (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "points", label: "Points (if unwired)", type: "slider", min: 3, max: 400, step: 1, def: 60 },
      { key: "spacing", label: "Input spacing mm (0=vertices)", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 43 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[1]);
      /* points: from wired paths (resampled/vertices) or seeded random */
      let pts = [];
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        if (p.spacing > 0.01) {
          /* escalate spacing until under the triangulation budget so the
             slider has a visible effect at every value */
          let sp = Math.max(1, p.spacing);
          const gather = (s) => {
            const out = [];
            for (const pa of ins[0].paths) for (const q of resample(pa.pts, pa.closed, s)) out.push([q[0], q[1]]);
            return out;
          };
          pts = gather(sp);
          let g2 = 0;
          while (pts.length > 600 && g2++ < 14) { sp *= 1.3; pts = gather(sp); }
        } else {
          for (const pa of ins[0].paths) for (const q of pa.pts) pts.push([q[0], q[1]]);
        }
      } else {
        const rng = mulberry32(p.seed * 3803 + 27);
        const N = Math.max(3, Math.min(400, Math.round(p.points)));
        for (let i = 0; i < N; i++) {
          pts.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
        }
      }
      /* dedupe near-identical points (degenerate circumcircles) */
      const seenP = new Set();
      pts = pts.filter(([x, y]) => {
        const k = Math.round(x * 10) + "," + Math.round(y * 10);
        if (seenP.has(k)) return false;
        seenP.add(k);
        return true;
      });
      if (pts.length > 600) {
        const stride = pts.length / 600;
        const dec = [];
        for (let i = 0; i < 600; i++) dec.push(pts[Math.floor(i * stride)]);
        pts = dec;
      }
      if (pts.length < 3) return applyStyle({ paths: [] }, ins[1]);
      /* Bowyer-Watson triangulation */
      const n = pts.length;
      const big = Math.max(W, H) * 10;
      const P = pts.concat([[W / 2 - big, H / 2 - big], [W / 2 + big, H / 2 - big], [W / 2, H / 2 + big]]);
      let tris = [[n, n + 1, n + 2]];
      const circum = (i, j, k) => {
        const [ax, ay] = P[i], [bx, by] = P[j], [cx2, cy2] = P[k];
        const d = 2 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by));
        if (Math.abs(d) < 1e-12) return null;
        const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx2 * cx2 + cy2 * cy2;
        const ux = (a2 * (by - cy2) + b2 * (cy2 - ay) + c2 * (ay - by)) / d;
        const uy = (a2 * (cx2 - bx) + b2 * (ax - cx2) + c2 * (bx - ax)) / d;
        return [ux, uy, (ux - ax) * (ux - ax) + (uy - ay) * (uy - ay)];
      };
      for (let pi = 0; pi < n; pi++) {
        const [px, py] = P[pi];
        const bad = [];
        for (let t = 0; t < tris.length; t++) {
          const cc = circum(tris[t][0], tris[t][1], tris[t][2]);
          if (!cc) { continue; }
          const dx = px - cc[0], dy = py - cc[1];
          if (dx * dx + dy * dy < cc[2] - 1e-9) bad.push(t);
        }
        /* boundary polygon = edges of bad triangles not shared by two bad ones */
        const edgeCount = new Map();
        const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            const k = ek(u, v);
            edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
          }
        }
        const boundary = [];
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            if (edgeCount.get(ek(u, v)) === 1) boundary.push([u, v]);
          }
        }
        for (let i = bad.length - 1; i >= 0; i--) tris.splice(bad[i], 1);
        for (const [u, v] of boundary) tris.push([u, v, pi]);
      }
      /* unique edges, skipping the super-triangle */
      const L = Math.round(p.layer);
      const paths = [];
      const seen = new Set();
      for (const [a, b, c] of tris) {
        if (a >= n || b >= n || c >= n) continue;
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const k = u < v ? u + "_" + v : v + "_" + u;
          if (seen.has(k)) continue;
          seen.add(k);
          paths.push({ pts: [[P[u][0], P[u][1]], [P[v][0], P[v][1]]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[1]);
    }
  
};
```

## diffgrowth.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "diffgrowth",
    name: "Differential Growth",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 400, step: 5, def: 150 },
      { key: "repel", label: "Repulsion radius mm", type: "slider", min: 2, max: 15, step: 0.5, def: 6 },
      { key: "edge", label: "Edge length mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5 },
      { key: "chaos", label: "Chaos", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "r0", label: "Seed circle mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 17 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const R = Math.max(1.5, p.repel);
      const edge = Math.max(0.8, p.edge);
      const MAXP = 2600;
      /* seed circle */
      const rng = mulberry32(p.seed * 4241 + 13);
      const cx = W / 2, cy = H / 2;
      let pts = [];
      const N0 = 40;
      for (let i = 0; i < N0; i++) {
        const a = (i / N0) * Math.PI * 2;
        const rr = Math.max(3, p.r0) * (1 + (rng() - 0.5) * 0.1);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      const gens = Math.max(0, Math.min(500, Math.floor(p.iters)));
      const STEP = 0.55;
      for (let g = 0; g < gens; g++) {
        const n = pts.length;
        /* spatial buckets for repulsion */
        const bs = R;
        const grid = new Map();
        const bk = (x, y) => Math.floor(x / bs) + "," + Math.floor(y / bs);
        for (let i = 0; i < n; i++) {
          const k = bk(pts[i][0], pts[i][1]);
          let a = grid.get(k);
          if (!a) { a = []; grid.set(k, a); }
          a.push(i);
        }
        const nxt = new Array(n);
        for (let i = 0; i < n; i++) {
          const [x, y] = pts[i];
          let fx = 0, fy = 0;
          /* attraction: springs to ring neighbours */
          const pa = pts[(i - 1 + n) % n], pb = pts[(i + 1) % n];
          fx += (pa[0] + pb[0] - 2 * x) * 0.28;
          fy += (pa[1] + pb[1] - 2 * y) * 0.28;
          /* repulsion from everything nearby (bucket search) */
          const bxc = Math.floor(x / bs), byc = Math.floor(y / bs);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const cellA = grid.get((bxc + dx) + "," + (byc + dy));
              if (!cellA) continue;
              for (const j of cellA) {
                if (j === i) continue;
                const ox = x - pts[j][0], oy = y - pts[j][1];
                const d = Math.hypot(ox, oy);
                if (d > 1e-6 && d < R) {
                  const f = ((R - d) / R) * 0.9;
                  fx += (ox / d) * f;
                  fy += (oy / d) * f;
                }
              }
            }
          }
          /* position-hashed chaos: deterministic even as points split */
          if (p.chaos > 0) {
            const a = noise2(x * 0.11 + 31.7, y * 0.11 + 8.3, p.seed) * Math.PI * 4;
            fx += Math.cos(a) * p.chaos * 0.4;
            fy += Math.sin(a) * p.chaos * 0.4;
          }
          /* soft walls: repel from the margin box */
          if (x - x0 < R) fx += ((R - (x - x0)) / R) * 1.2;
          if (x1 - x < R) fx -= ((R - (x1 - x)) / R) * 1.2;
          if (y - y0 < R) fy += ((R - (y - y0)) / R) * 1.2;
          if (y1 - y < R) fy -= ((R - (y1 - y)) / R) * 1.2;
          const fl = Math.hypot(fx, fy);
          const s = fl > 1 ? STEP / fl : STEP;
          nxt[i] = [
            Math.max(x0, Math.min(x1, x + fx * s)),
            Math.max(y0, Math.min(y1, y + fy * s))
          ];
        }
        pts = nxt;
        /* growth: split edges that stretched past the threshold */
        if (pts.length < MAXP) {
          const grown = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            grown.push(a);
            if (grown.length + (pts.length - i) < MAXP &&
                Math.hypot(b[0] - a[0], b[1] - a[1]) > edge) {
              grown.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
            }
          }
          pts = grown;
        }
      }
      if (pts.length < 3) return applyStyle({ paths: [] }, ins[0]);
      return applyStyle({ paths: [{ pts, closed: true, layer: Math.round(p.layer) }] }, ins[0]);
    }
  
};
```

## diffpens.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "diffpens",
    name: "Diff Pens",
    cat: "duo",
    desc: "Compares Modified against Original and recolors only what changed: paths that exist in both keep their pen, anything NEW in Modified moves to the Diff pen. Feed a sprig to Original, the same sprig through Fur to Modified - the sprig stays one color and the fur gets another. Exact match is fast for add-only modifiers; Distance match tolerates wobble and splits (Hand Drawn etc.) within the tolerance.",
    ins: [Pin("paths", "Original"), Pin("paths", "Modified")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Match", type: "select", options: ["Exact", "Distance"], def: "Exact" },
      { key: "tol", label: "Tolerance mm (Distance)", type: "slider", min: 0.2, max: 6, step: 0.1, def: 1.5 },
      { key: "cover", label: "Match coverage", type: "slider", min: 0.5, max: 1, step: 0.05, def: 0.9 },
      { key: "diffPen", label: "Diff pen (new parts)", type: "pen", def: 1 },
      { key: "recolorKept", label: "Recolor kept parts too", type: "check", def: false },
      { key: "keptPen", label: "Kept pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const A = ins[0] || EMPTY, B = ins[1] || EMPTY;
      if (!B.paths.length) return EMPTY;
      const copy = (pa, layer) => ({ ...pa, pts: pa.pts.map((q) => q.slice()), layer });
      if (!A.paths.length) {
        /* nothing to compare against: pass through untouched */
        return { paths: B.paths.map((pa) => copy(pa, pa.layer)) };
      }
      const diffPen = Math.round(p.diffPen);
      const keptOf = (pa) => (p.recolorKept ? Math.round(p.keptPen) : pa.layer);
      const out = [];
      if (p.mode === "Exact") {
        const q = (v) => Math.round(v * 100) / 100;
        const sig = (pa) => (pa.closed ? "C" : "O") + pa.pts.map(([x, y]) => q(x) + "," + q(y)).join(";");
        const set = new Set(A.paths.map(sig));
        for (const pa of B.paths) out.push(copy(pa, set.has(sig(pa)) ? keptOf(pa) : diffPen));
        return { paths: out };
      }
      /* Distance: a B path is "original" if >= coverage of its samples lie within tol of A's geometry */
      const tol = Math.max(0.05, p.tol);
      const segs = [];
      for (const pa of A.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
      }
      const bs = Math.max(3, tol * 2 + 1);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const sx0 = Math.min(s[0], s[2]) - tol, sx1 = Math.max(s[0], s[2]) + tol;
        const sy0 = Math.min(s[1], s[3]) - tol, sy1 = Math.max(s[1], s[3]) + tol;
        for (let by = Math.floor(sy0 / bs); by <= Math.floor(sy1 / bs); by++)
          for (let bx = Math.floor(sx0 / bs); bx <= Math.floor(sx1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k); if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
      });
      const nearA = (x, y) => {
        const a = buckets.get(Math.floor(x / bs) + "," + Math.floor(y / bs));
        if (!a) return false;
        for (const i of a) {
          const s = segs[i];
          const dx = s[2] - s[0], dy = s[3] - s[1];
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const ddx = x - (s[0] + dx * t), ddy = y - (s[1] + dy * t);
          if (ddx * ddx + ddy * ddy <= tol * tol) return true;
        }
        return false;
      };
      for (const pa of B.paths) {
        const pts = resample(pa.pts, pa.closed, Math.max(0.5, tol * 0.6));
        let hit = 0;
        for (const [x, y] of pts) if (nearA(x, y)) hit++;
        const matched = pts.length > 0 && hit / pts.length >= p.cover;
        out.push(copy(pa, matched ? keptOf(pa) : diffPen));
      }
      return { paths: out };
    }
  
};
```

## displaceimg.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "displaceimg",
    name: "Displace by Image",
    cat: "mod",
    group: "deform",
    fileImage: true,
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "amount", label: "Amount mm", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
      { key: "mode", label: "Mode", type: "select", options: ["Darkness along angle", "Gradient (emboss)"], def: "Darkness along angle" },
      { key: "angle", label: "Angle deg", type: "slider", min: 0, max: 360, step: 1, def: 90 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1 },
      { key: "margin", label: "Image fit margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 }
    ],
    compute(ins, p, ctx, node) {
      const src = ins[0] || EMPTY;
      const img = node && node.data && node.data.img;
      if (!img) {
        return { paths: src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const boxW = W - 2 * m, boxH = H - 2 * m;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ox = (W - iw) / 2, oy = (H - ih) / 2;
      const darkAt = (x, y) => {
        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;
        const iu = Math.floor(u), iv = Math.floor(v);
        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];
        const fu = u - iu, fv = v - iv;
        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +
                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;
        return p.invert ? 1 - d : d;
      };
      const a = (p.angle * Math.PI) / 180;
      const adx = Math.cos(a), ady = Math.sin(a);
      const amt = Math.max(0, p.amount);
      const eps = Math.max(0.8, sc);
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.3, p.res)).map(([x, y]) => {
          let dx, dy;
          if (p.mode === "Gradient (emboss)") {
            dx = (darkAt(x + eps, y) - darkAt(x - eps, y)) * amt * 2;
            dy = (darkAt(x, y + eps) - darkAt(x, y - eps)) * amt * 2;
          } else {
            const d = darkAt(x, y) * amt;
            dx = adx * d; dy = ady * d;
          }
          return [clampX(x + dx), clampY(y + dy)];
        })
      }));
      return { paths };
    }
  
};
```

## echo.js

```js
import { Pin, EMPTY, PENS } from "../helpers.js";

export default {
  key: "echo",
    name: "Echo",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "copies", label: "Echo copies", type: "slider", min: 1, max: 12, step: 1, def: 4 },
      { key: "dx", label: "Move X mm / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 4 },
      { key: "dy", label: "Move Y mm / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 4 },
      { key: "rot", label: "Rotate deg / copy", type: "slider", min: -90, max: 90, step: 0.5, def: 0 },
      { key: "scale", label: "Scale % / copy", type: "slider", min: 50, max: 150, step: 1, def: 100 },
      { key: "pivot", label: "Pivot", type: "select", options: ["Canvas center", "Path centroid"], def: "Canvas center" },
      { key: "orig", label: "Include original", type: "check", def: true },
      { key: "cycle", label: "Cycle pens", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const K = Math.max(1, Math.min(20, Math.round(p.copies)));
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      src.paths.forEach((path) => {
        if (p.orig) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
        let pcx = W / 2, pcy = H / 2;
        if (p.pivot === "Path centroid") {
          pcx = 0; pcy = 0;
          for (const [x, y] of path.pts) { pcx += x; pcy += y; }
          pcx /= path.pts.length; pcy /= path.pts.length;
        }
        for (let k = 1; k <= K; k++) {
          const ang = (p.rot * Math.PI / 180) * k;
          const sc = Math.pow(p.scale / 100, k);
          if (sc < 0.005) break;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const ox = p.dx * k, oy = p.dy * k;
          const layer = p.cycle ? ((path.layer + k) % PENS.length) : path.layer;
          paths.push({
            pts: path.pts.map(([x, y]) => {
              const lx = (x - pcx) * sc, ly = (y - pcy) * sc;
              return clamp([pcx + lx * ca - ly * sa + ox, pcy + lx * sa + ly * ca + oy]);
            }),
            closed: path.closed, layer
          });
        }
      });
      return { paths };
    }
  
};
```

## endcaps.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "endcaps",
    name: "End Caps", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "where", label: "Where", type: "select", options: ["End", "Start", "Both"], def: "End" },
      { key: "style", label: "Style", type: "select", options: ["Arrow", "Dot", "Circle", "Tick"], def: "Arrow" },
      { key: "size", label: "Size mm", type: "slider", min: 0.5, max: 15, step: 0.25, def: 3 },
      { key: "host", label: "Include host path", type: "check", def: true },
      { key: "layer", label: "Cap pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      const cap = (pt, dirIn, layer) => {
        /* dirIn = polun kulkusuunta paatepisteessa (osoittaa ulos polusta) */
        const a = Math.atan2(dirIn[1], dirIn[0]);
        if (p.style === "Arrow") {
          const w = (25 * Math.PI) / 180;
          for (const s of [1, -1]) {
            paths.push({
              pts: [[pt[0], pt[1]], [pt[0] - Math.cos(a + s * w) * p.size, pt[1] - Math.sin(a + s * w) * p.size]],
              closed: false, layer,
            });
          }
        } else if (p.style === "Tick") {
          const h = p.size / 2;
          paths.push({
            pts: [[pt[0] - Math.sin(a) * h, pt[1] + Math.cos(a) * h], [pt[0] + Math.sin(a) * h, pt[1] - Math.cos(a) * h]],
            closed: false, layer,
          });
        } else {
          const n = p.style === "Dot" ? 8 : 16;
          const r = p.style === "Dot" ? p.size / 4 : p.size / 2;
          const c = [];
          for (let k = 0; k < n; k++) {
            const aa = (k / n) * Math.PI * 2;
            c.push([pt[0] + Math.cos(aa) * r, pt[1] + Math.sin(aa) * r]);
          }
          paths.push({ pts: c, closed: true, layer });
        }
      };
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        if (path.closed || path.pts.length < 2) continue;
        const L = p.keepCol ? path.layer : Math.round(p.layer);
        const n = path.pts.length;
        if (p.where !== "Start") {
          const d = [path.pts[n - 1][0] - path.pts[n - 2][0], path.pts[n - 1][1] - path.pts[n - 2][1]];
          cap(path.pts[n - 1], d, L);
        }
        if (p.where !== "End") {
          const d = [path.pts[0][0] - path.pts[1][0], path.pts[0][1] - path.pts[1][1]];
          cap(path.pts[0], d, L);
        }
      }
      return { paths };
    },
  
};
```

## explosion.js

```js
import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "explosion",
      name: "Explosion",
    cat: "mod", group: "cutsplit",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "zone", label: "Zone", type: "select", options: ["Circle", "Rectangle"], def: "Circle" },
      { key: "cx", label: "Center X mm", type: "slider", min: -100, max: 500, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: -100, max: 500, step: 1, def: 100 },
      { key: "zw", label: "Zone Ø / width mm", type: "slider", min: 10, max: 500, step: 1, def: 240 },
      { key: "zh", label: "Zone height mm", type: "slider", min: 10, max: 500, step: 1, def: 150 },
      { key: "axis", label: "Axis (rectangle)", type: "select", options: ["Horizontal", "Vertical"], def: "Horizontal" },
      { key: "strength", label: "Strength mm", type: "slider", min: 0, max: 300, step: 1, def: 60 },
      { key: "dir", label: "Direction", type: "select", options: ["Outward", "Inward", "Directional"], def: "Outward" },
      { key: "angle", label: "Angle ° (directional)", type: "slider", min: -180, max: 180, step: 1, def: -90 },
      { key: "falloff", label: "Falloff", type: "select", options: ["Uniform", "Near stronger", "Far stronger"], def: "Near stronger" },
      { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "spread", label: "Spread °", type: "slider", min: 0, max: 90, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 103 },
    ],
    overlay(p) {
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.zone === "Circle") {
        g.push({ kind: "circle", cx: p.cx, cy: p.cy, r: p.zw / 2 });
      } else {
        g.push({ kind: "rect", x: p.cx - p.zw / 2, y: p.cy - p.zh / 2, w: p.zw, h: p.zh });
      }
      const L = Math.max(15, Math.min(p.strength, 70));
      if (p.dir === "Directional") {
        const a = (p.angle * Math.PI) / 180;
        g.push({ kind: "arrow", x1: p.cx, y1: p.cy, x2: p.cx + Math.cos(a) * L, y2: p.cy + Math.sin(a) * L });
      } else if (p.zone === "Rectangle") {
        /* suuntanuolet akselia pitkin molempiin suuntiin */
        const s = p.dir === "Inward" ? -1 : 1;
        if (p.axis === "Horizontal") {
          g.push({ kind: "arrow", x1: p.cx + 6 * s, y1: p.cy, x2: p.cx + (6 + L) * s, y2: p.cy });
          g.push({ kind: "arrow", x1: p.cx - 6 * s, y1: p.cy, x2: p.cx - (6 + L) * s, y2: p.cy });
        } else {
          g.push({ kind: "arrow", x1: p.cx, y1: p.cy + 6 * s, x2: p.cx, y2: p.cy + (6 + L) * s });
          g.push({ kind: "arrow", x1: p.cx, y1: p.cy - 6 * s, x2: p.cx, y2: p.cy - (6 + L) * s });
        }
      }
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* jaykka siirto per polku: muoto sailyy, vain sijainti muuttuu.
         Vaikutusalue rajaa: alueen ulkopuoliset kappaleet eivat liiku. */
      const paths = src.paths.map((path, pi) => {
        const rng = mulberry32(p.seed * 419 + pi * 233 + 13);
        let sx = 0, sy = 0;
        for (const [x, y] of path.pts) { sx += x; sy += y; }
        const cx0 = sx / path.pts.length, cy0 = sy / path.pts.length;
        const dx = cx0 - p.cx, dy = cy0 - p.cy;
        let inZone, d, baseDir;
        if (p.zone === "Circle") {
          d = Math.hypot(dx, dy) || 0.001;
          inZone = d <= p.zw / 2;
          baseDir = Math.atan2(dy, dx);
        } else {
          inZone = Math.abs(dx) <= p.zw / 2 && Math.abs(dy) <= p.zh / 2;
          if (p.axis === "Horizontal") {
            d = Math.abs(dx) || 0.001;
            baseDir = dx >= 0 ? 0 : Math.PI;
          } else {
            d = Math.abs(dy) || 0.001;
            baseDir = dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        if (!inZone) return path;
        let f;
        if (p.falloff === "Uniform") f = 1;
        else if (p.falloff === "Near stronger") f = 80 / (30 + d);
        else f = d / 90;
        let amt = p.strength * f * (1 - p.jitter * rng());
        if (p.dir === "Inward") amt = -Math.min(amt, d * 0.95); /* ei ylity keskilinjan yli */
        /* suuntahajonta */
        const dev = ((rng() - 0.5) * 2 * p.spread * Math.PI) / 180;
        const A = (p.dir === "Directional" ? (p.angle * Math.PI) / 180 : baseDir) + dev;
        const mx = Math.cos(A) * amt;
        const my = Math.sin(A) * amt;
        return {
          ...path,
          pts: path.pts.map(([x, y]) => [x + mx, y + my]),
        };
      });
      return { paths };
    }
  
};
```

## fabric.js

```js
import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "fabric",
    name: "Fabric", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Drape", type: "select", options: ["Curtain (folds)", "Flag (wave)", "Silk (flow)"], def: "Curtain (folds)" },
      { key: "warp", label: "Warp lines (vert)", type: "slider", min: 0, max: 80, step: 1, def: 34 },
      { key: "weft", label: "Weft lines (horiz)", type: "slider", min: 0, max: 80, step: 1, def: 18 },
      { key: "folds", label: "Folds", type: "slider", min: 1, max: 16, step: 0.5, def: 5 },
      { key: "depth", label: "Fold depth mm", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "sag", label: "Sag mm", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
      { key: "noiseAmt", label: "Rumple mm", type: "slider", min: 0, max: 25, step: 0.25, def: 4 },
      { key: "nscale", label: "Rumple scale", type: "slider", min: 0.5, max: 6, step: 0.1, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 67 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const w = W - 2 * m, h = H - 2 * m;
      if (w < 10 || h < 10) return EMPTY;
      const L = Math.round(p.layer);
      /* yhtenainen siirtymakentta molemmille lankasuunnille -> kudos pysyy koherenttina */
      const disp = (u, t) => {
        const nA = noise2(u * p.nscale * 3, t * p.nscale * 3, p.seed) - 0.5;
        const nB = noise2(u * p.nscale * 3 + 31, t * p.nscale * 3 + 17, p.seed + 5) - 0.5;
        let dx = 0, dy = 0;
        if (p.mode === "Curtain (folds)") {
          const ph = 3 * (noise2(u * 1.6, 0.3, p.seed + 9) - 0.5);
          dx = p.depth * (0.2 + 0.8 * t) * Math.sin(Math.PI * 2 * p.folds * u + ph);
          dy = p.sag * Math.sin(Math.PI * u) * t;
        } else if (p.mode === "Flag (wave)") {
          dx = p.depth * 0.4 * Math.sin(Math.PI * 2 * (p.folds * 0.5 * t + u * 0.6));
          dy = p.sag * u * Math.sin(Math.PI * 2 * (p.folds * u - t * 0.8));
        } else {
          dx = p.depth * 2 * nA;
          dy = p.sag * 2 * nB;
        }
        dx += p.noiseAmt * 2 * nA;
        dy += p.noiseAmt * 2 * nB;
        return [dx, dy];
      };
      const paths = [];
      const nS = 90;
      for (let i = 0; i <= Math.round(p.warp); i++) {
        if (p.warp === 0) break;
        const u = i / Math.round(p.warp);
        const pts = [];
        for (let k = 0; k <= nS; k++) {
          const t = k / nS;
          const [dx, dy] = disp(u, t);
          pts.push([m + u * w + dx, m + t * h + dy]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      for (let j = 0; j <= Math.round(p.weft); j++) {
        if (p.weft === 0) break;
        const t = j / Math.round(p.weft);
        const pts = [];
        for (let k = 0; k <= nS; k++) {
          const u = k / nS;
          const [dx, dy] = disp(u, t);
          pts.push([m + u * w + dx, m + t * h + dy]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## fan.js

```js
import { Pin, mulberry32 } from "../helpers.js";

export default {
  key: "fan",
    name: "Fan", cat: "math",
    ins: [Pin("value", "Value")],
    outs: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 3 }, (_, i) => Pin("value", String(i + 1))),
    params: [
      { key: "count", label: "Outputs", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "base", label: "Value (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 3 },
      { key: "mode", label: "Spread", type: "select", options: ["Same", "Step +", "Factor ×", "Random"], def: "Step +" },
      { key: "step", label: "Step", type: "slider", min: -50, max: 50, step: 0.25, def: 2 },
      { key: "seed", label: "Seed", type: "seed", def: 8 },
    ],
    compute(ins, p) {
      const v = typeof ins[0] === "number" ? ins[0] : p.base;
      const n = Math.round(p.count);
      const rng = mulberry32(p.seed * 613 + 29);
      const outs = [];
      for (let i = 0; i < n; i++) {
        if (p.mode === "Same") outs.push(v);
        else if (p.mode === "Step +") outs.push(v + p.step * i);
        else if (p.mode === "Factor ×") outs.push(v * Math.pow(p.step === 0 ? 1 : p.step, i));
        else outs.push(v + (rng() - 0.5) * 2 * p.step);
      }
      return outs;
    },
  
};
```

## fit_canvas.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "fit_canvas",
      name: "Fit to Canvas",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 80, step: 1, def: 15 },
      { key: "mode", label: "Mode", type: "select", options: ["Fit (contain)", "Stretch (fill)", "Fit width", "Fit height"], def: "Fit (contain)" },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const path of src.paths) for (const [x, y] of path.pts) {
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
      const bw = Math.max(0.01, x1 - x0), bh = Math.max(0.01, y1 - y0);
      const aw = Math.max(1, ctx.W - 2 * p.margin), ah = Math.max(1, ctx.H - 2 * p.margin);
      let sx, sy;
      if (p.mode === "Stretch (fill)") { sx = aw / bw; sy = ah / bh; }
      else if (p.mode === "Fit width") { sx = sy = aw / bw; }
      else if (p.mode === "Fit height") { sx = sy = ah / bh; }
      else { sx = sy = Math.min(aw / bw, ah / bh); }
      const ox = (ctx.W - bw * sx) / 2, oy = (ctx.H - bh * sy) / 2;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [ox + (x - x0) * sx, oy + (y - y0) * sy]),
      }));
      return { paths };
    }
  
};
```

## flow.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "flow",
    name: "Flow Field", cat: "gen", group: "organic", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Trails", type: "slider", min: 5, max: 300, step: 5, def: 80 },
      { key: "steps", label: "Length", type: "slider", min: 10, max: 300, step: 5, def: 90 },
      { key: "scale", label: "Field scale", type: "slider", min: 0.005, max: 0.08, step: 0.005, def: 0.02 },
      { key: "curl", label: "Curl", type: "slider", min: 0.5, max: 4, step: 0.25, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 2 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1013 + 77);
      const paths = [];
      for (let k = 0; k < p.count; k++) {
        let x = p.margin + rng() * (W - 2 * p.margin);
        let y = p.margin + rng() * (H - 2 * p.margin);
        const pts = [[x, y]];
        for (let s = 0; s < p.steps; s++) {
          const a = noise2(x * p.scale, y * p.scale, p.seed) * Math.PI * 2 * p.curl;
          x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6;
          if (x < p.margin || x > W - p.margin || y < p.margin || y > H - p.margin) break;
          pts.push([x, y]);
        }
        if (pts.length > 3) paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## fmrose.js

```js
import { Pin, PENS, applyStyle } from "../helpers.js";

export default {
  key: "fmrose",
  name: "FM Rose",
  cat: "gen",
  group: "geometric",
  desc: "FM synthesis as a polar curve: a modulator warps the carrier that shapes the radius. Low index gives rosettes, high index chaotic flowers; Rings stacks scaled copies with per-ring rotation, and Ring pens cycles successive rings through that many pens starting from Pen.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "fc", label: "Carrier", type: "slider", min: 1, max: 16, step: 1, def: 5 },
    { key: "fm", label: "Modulator", type: "slider", min: 1, max: 16, step: 1, def: 3 },
    { key: "index", label: "FM index", type: "slider", min: 0, max: 10, step: 0.1, def: 2 },
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 1, step: 0.02, def: 0.5 },
    { key: "rings", label: "Rings", type: "slider", min: 1, max: 16, step: 1, def: 1 },
    { key: "pens", label: "Ring pens (cycle)", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "rot", label: "Rotate deg / ring", type: "slider", min: 0, max: 90, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const R = Math.min(W, H) / 2 - m;
    if (R < 5) return applyStyle({ paths: [] }, ins[0]);
    const cx = W / 2, cy = H / 2;
    const fc = Math.max(1, Math.round(p.fc)), fm = Math.max(1, Math.round(p.fm));
    const depth = Math.max(0, Math.min(1, p.depth));
    const K = Math.max(1, Math.min(24, Math.round(p.rings)));
    const NP = Math.max(1, Math.min(PENS.length, Math.round(p.pens)));
    const paths = [];
    const NPTS = 720;
    for (let k = 0; k < K; k++) {
      const scale = (K - k) / K;
      const off = (p.rot * Math.PI / 180) * k;
      const pts = [];
      for (let i = 0; i < NPTS; i++) {
        const th = (i / NPTS) * Math.PI * 2;
        /* FM synthesis as a polar curve: r follows the modulated carrier */
        const r = (1 + depth * Math.sin(fc * th + p.index * Math.sin(fm * th))) / (1 + depth);
        const rr = R * scale * Math.max(0.02, r);
        pts.push([cx + Math.cos(th + off) * rr, cy + Math.sin(th + off) * rr]);
      }
      paths.push({ pts, closed: true, layer: (Math.round(p.layer) + (k % NP)) % PENS.length });
    }
    return applyStyle({ paths }, ins[0]);
  }
};
```

## fold.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "fold",
    name: "Fold",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "gain", label: "Gain (drive)", type: "slider", min: 1, max: 4, step: 0.05, def: 1.5 },
      { key: "wx", label: "Window width mm", type: "slider", min: 20, max: 220, step: 1, def: 120 },
      { key: "wy", label: "Window height mm", type: "slider", min: 20, max: 300, step: 1, def: 160 },
      { key: "axis", label: "Fold axis", type: "select", options: ["Both", "X only", "Y only"], def: "Both" },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const hx = Math.max(5, p.wx / 2), hy = Math.max(5, p.wy / 2);
      const gain = Math.max(0.1, p.gain);
      /* wavefolder: reflect back into the window, repeatedly (triangle fold) */
      const fold1 = (v, half) => {
        const period = 4 * half;
        let u = ((v + half) % period + period) % period;
        return (u < 2 * half ? u - half : 3 * half - u);
      };
      const doX = p.axis !== "Y only", doY = p.axis !== "X only";
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.25, p.res)).map(([x, y]) => {
          /* drive: scale outward from center before folding, like input gain */
          let lx = (x - cx) * gain, ly = (y - cy) * gain;
          if (doX) lx = fold1(lx, hx);
          if (doY) ly = fold1(ly, hy);
          return [cx + lx, cy + ly];
        })
      }));
      return { paths };
    }
  
};
```

## followlines.js

```js
import { Pin, PENS, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "followlines",
      name: "Follow Lines",
    cat: "gen", group: "organic",
    ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "bands", label: "Bands (no spine)", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "count", label: "Lines per band", type: "slider", min: 3, max: 150, step: 1, def: 50 },
      { key: "step", label: "Line spacing mm", type: "slider", min: 0.3, max: 6, step: 0.05, def: 0.9 },
      { key: "drift", label: "Drift (pinch/fan)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "dscale", label: "Drift scale", type: "slider", min: 0.2, max: 5, step: 0.1, def: 1.2 },
      { key: "smooth", label: "Relax (straighten)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "side", label: "Side", type: "select", options: ["Right", "Left", "Both"], def: "Right" },
      { key: "angle", label: "Base angle ° (no spine)", type: "slider", min: -180, max: 180, step: 1, def: 60 },
      { key: "wave", label: "Base waviness (no spine)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "penPer", label: "Pen per band", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8 },
      { key: "seed", label: "Seed", type: "seed", def: 127 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const paths = [];
      /* --- selkarangat: sisaantulo tai generoidut aaltopohjat --- */
      let spines = [];
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        spines = ins[0].paths.map((q) => resample(q.pts, false, 1.2));
      } else {
        const a = (p.angle * Math.PI) / 180;
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const diag = Math.hypot(W, H) * 1.3;
        const nB = Math.round(p.bands);
        for (let b = 0; b < nB; b++) {
          /* pohjakayrat jaettu poikittaissuunnassa */
          const off = (nB === 1 ? 0 : (b / (nB - 1) - 0.5)) * Math.hypot(W, H) * 0.75;
          const pts = [];
          const nS = Math.round(diag / 1.2);
          for (let i = 0; i <= nS; i++) {
            const t = (i / nS - 0.5) * diag;
            const wob = (noise2(t * 0.012, b * 9.1, p.seed + 17) - 0.5) * p.wave * 90;
            pts.push([
              W / 2 + dx * t + px * (off + wob),
              H / 2 + dy * t + py * (off + wob),
            ]);
          }
          spines.push(pts);
        }
      }
      /* --- leikkaus marginaalisuorakaiteeseen ajossa --- */
      const inside = ([x, y]) => x >= m && x <= W - m && y >= m && y <= H - m;
      const emit = (pts, layer) => {
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer });
          run = [];
        };
        for (const pt of pts) {
          if (inside(pt)) run.push(pt);
          else flush();
        }
        flush();
      };
      /* --- myotailevat viivat: iteratiivinen vaihteleva offset + rentoutus --- */
      const sides = p.side === "Both" ? [1, -1] : p.side === "Left" ? [-1] : [1];
      const nPer = Math.min(200, Math.round(p.count));
      let budget = 120000;
      spines.forEach((base, bi) => {
        const layer = p.penPer ? (Math.round(p.layer) + bi) % PENS.length : Math.round(p.layer);
        for (const s of sides) {
          let cur = base.map((q) => q.slice());
          for (let it = 0; it < nPer && budget > 0; it++) {
            if (it > 0 || s === sides[0]) emit(cur, layer);
            budget -= cur.length;
            const N = cur.length;
            if (N < 3) break;
            /* normaalit */
            const next = new Array(N);
            for (let j = 0; j < N; j++) {
              const jn = Math.min(j + 1, N - 1), jp = Math.max(j - 1, 0);
              const tx = cur[jn][0] - cur[jp][0], ty = cur[jn][1] - cur[jp][1];
              const tl = Math.hypot(tx, ty) || 1;
              /* offset vaihtelee matkalla + iteraatioittain -> nipistykset ja viuhkat */
              const mod = 1 + p.drift * 1.7 * (noise2(j * 0.02 * p.dscale, it * 0.13 + bi * 5, p.seed + 5) - 0.5) * 2;
              const off = p.step * Math.max(0.08, mod) * s;
              next[j] = [cur[j][0] + (-ty / tl) * off, cur[j][1] + (tx / tl) * off];
            }
            /* rentoutus: viivat suoristuvat vahitellen pohjasta poispain */
            if (p.smooth > 0) {
              for (let j = 1; j < N - 1; j++) {
                next[j] = [
                  next[j][0] * (1 - p.smooth * 0.5) + (next[j - 1][0] + next[j + 1][0]) * 0.25 * p.smooth,
                  next[j][1] * (1 - p.smooth * 0.5) + (next[j - 1][1] + next[j + 1][1]) * 0.25 * p.smooth,
                ];
              }
            }
            /* kaanteisten segmenttien siivous (offset-cuspit) */
            const clean = [next[0]];
            for (let j = 1; j < N; j++) {
              const odx = cur[j][0] - cur[j - 1][0], ody = cur[j][1] - cur[j - 1][1];
              const fdx = next[j][0] - clean[clean.length - 1][0], fdy = next[j][1] - clean[clean.length - 1][1];
              if (odx * fdx + ody * fdy > 0) clean.push(next[j]);
            }
            if (clean.length < 3) break;
            /* tasavali sailyy: uudelleennaytteista muutaman iteraation valein */
            cur = it % 4 === 3 ? resample(clean, false, 1.2) : clean;
          }
        }
      });
      return applyStyle({ paths }, ins[1]);
    }
  
};
```

## fourier.js

```js
import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
  key: "fourier",
    name: "Fourier",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "harm", label: "Harmonics (wire Frame/LFO)", type: "slider", min: 1, max: 64, step: 1, def: 8 },
      { key: "epi", label: "Draw epicycles", type: "check", def: false },
      { key: "keepOpen", label: "Pass open paths through", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const M = 256;
      const H = Math.max(1, Math.min(Math.floor(M / 2) - 1, Math.floor(p.harm)));
      const paths = [];
      src.paths.forEach((path) => {
        if (!path.closed || path.pts.length < 3) {
          if (p.keepOpen) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        /* uniform M samples of the closed contour */
        const total = pathLength([...path.pts, path.pts[0]], false);
        if (total < 1) return;
        const smp = resample(path.pts, true, total / M);
        const zs = smp.slice(0, M);
        while (zs.length < M) zs.push(zs[zs.length - 1]);
        /* DFT coefficients for n in [-H..H] (elliptic Fourier reconstruction) */
        const coef = [];
        for (let n = -H; n <= H; n++) {
          let re = 0, im = 0;
          for (let k = 0; k < M; k++) {
            const ang = (-2 * Math.PI * n * k) / M;
            const c = Math.cos(ang), s = Math.sin(ang);
            re += zs[k][0] * c - zs[k][1] * s;
            im += zs[k][0] * s + zs[k][1] * c;
          }
          coef.push({ n, re: re / M, im: im / M });
        }
        /* rebuild with the kept harmonics: shape morphs circle -> original */
        const out = [];
        for (let k = 0; k < M; k++) {
          let x = 0, y = 0;
          for (const { n, re, im } of coef) {
            const ang = (2 * Math.PI * n * k) / M;
            const c = Math.cos(ang), s = Math.sin(ang);
            x += re * c - im * s;
            y += re * s + im * c;
          }
          out.push([x, y]);
        }
        paths.push({ pts: out, closed: true, layer: path.layer });
        /* optional epicycle ghost circles: largest terms chained from the center */
        if (p.epi) {
          const terms = coef.filter((t) => t.n !== 0)
            .sort((a, b) => (b.re * b.re + b.im * b.im) - (a.re * a.re + a.im * a.im))
            .slice(0, Math.min(10, 2 * H));
          const c0 = coef.find((t) => t.n === 0) || { re: 0, im: 0 };
          let cxx = c0.re, cyy = c0.im;
          for (const t of terms) {
            const r = Math.hypot(t.re, t.im);
            if (r < 0.5) break;
            const ring = [];
            for (let a = 0; a < 16; a++) {
              const th = (a / 16) * Math.PI * 2;
              ring.push([cxx + Math.cos(th) * r, cyy + Math.sin(th) * r]);
            }
            paths.push({ pts: ring, closed: true, layer: path.layer });
            cxx += t.re; cyy += t.im;
          }
        }
      });
      return { paths };
    }
  
};
```

## frame.js

```js
import { Pin } from "../helpers.js";

export default {
  key: "frame",
    name: "Frame", cat: "math", ins: [],
    outs: [Pin("value", "t 0\u21921"), Pin("value", "frame #"), Pin("value", "wave loop"), Pin("value", "ping-pong")],
    params: [],
    compute(ins, p, ctx) {
      /* animaatioaika: t = lineaarinen ramppi (viim. freimi = 1),
         wave & ping-pong = saumattomat luupit (freimi N == freimi 0) */
      const n = Math.max(1, ctx.frameCount || 1);
      const i = Math.min(n - 1, Math.max(0, ctx.frameIdx || 0));
      const t = n > 1 ? i / (n - 1) : 0;
      const tl = i / n;
      const wave = 0.5 - 0.5 * Math.cos(tl * Math.PI * 2);
      const pp = tl < 0.5 ? tl * 2 : 2 - tl * 2;
      return [t, i, wave, pp];
    },
  
};
```

## fresnel.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "fresnel",
    name: "Fresnel Lens", cat: "mod", group: "fillstyle", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Lens", type: "select", options: ["Circular", "Linear"], def: "Circular" },
      { key: "cx", label: "Center X mm", type: "slider", min: -100, max: 500, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: -100, max: 500, step: 1, def: 100 },
      { key: "angle", label: "Angle ° (linear)", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "radius", label: "Lens Ø mm", type: "slider", min: 20, max: 500, step: 1, def: 180 },
      { key: "zoneW", label: "Groove pitch mm", type: "slider", min: 2, max: 60, step: 0.5, def: 14 },
      { key: "strength", label: "Strength (− expand)", type: "slider", min: -0.85, max: 0.85, step: 0.05, def: 0.5 },
      { key: "curve", label: "Groove profile", type: "select", options: ["Lens (smooth)", "Prism (linear)"], def: "Lens (smooth)" },
      { key: "edge", label: "Edge falloff", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    ],
    overlay(p) {
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.mode === "Circular") {
        g.push({ kind: "circle", cx: p.cx, cy: p.cy, r: p.radius / 2 });
        /* pari uraa nakyviin */
        for (let r = p.zoneW; r < p.radius / 2; r += p.zoneW * 2) {
          g.push({ kind: "circle", cx: p.cx, cy: p.cy, r });
        }
      } else {
        const a = (p.angle * Math.PI) / 180;
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const R = p.radius / 2;
        g.push({
          kind: "poly",
          pts: [
            [p.cx - dx * R - px * R, p.cy - dy * R - py * R],
            [p.cx + dx * R - px * R, p.cy + dy * R - py * R],
            [p.cx + dx * R + px * R, p.cy + dy * R + py * R],
            [p.cx - dx * R + px * R, p.cy - dy * R + py * R],
          ],
        });
      }
      return g;
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      /* fresnel: linssin taittuma vyohykkeittain — siirtyma nollautuu joka uran
         reunalla -> samankeskiset leikkaus-epajatkuvuudet kuten oikeassa linssissa.
         Vyohykkeen sisainen kartoitus on monotoninen -> ei laskoksia uran sisalla. */
      const R = p.radius / 2;
      const dirA = (p.angle * Math.PI) / 180;
      const dux = Math.cos(dirA), duy = Math.sin(dirA);
      const remapU = (u, f) => {
        const s = p.strength * f;
        if (p.curve === "Prism (linear)") {
          /* lineaarinen puristus vyohykkeen alkuun/loppuun */
          const k = 1 + s * 1.6;
          const v = Math.pow(u, k);
          return v;
        }
        /* sileä linssikayra: eksponenttikartoitus (monotoninen) */
        return Math.pow(u, 1 + s * 2.2);
      };
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 0.7).map(([x, y]) => {
          let d, ux, uy;
          if (p.mode === "Circular") {
            const dx = x - p.cx, dy = y - p.cy;
            d = Math.hypot(dx, dy);
            if (d < 0.001 || d > R) return [x, y];
            ux = dx / d; uy = dy / d;
          } else {
            const rx = x - p.cx, ry = y - p.cy;
            const v = -rx * duy + ry * dux;
            if (Math.abs(v) > R) return [x, y];
            d = rx * dux + ry * duy;
            if (Math.abs(d) > R) return [x, y];
            ux = dux; uy = duy;
          }
          /* reunahaivytys */
          const dd = Math.abs(d);
          const t = dd / R;
          let f = 1;
          if (p.edge > 0 && t > 1 - p.edge) {
            const e = (1 - t) / p.edge;
            f = e * e * (3 - 2 * e);
          }
          const sign = d >= 0 ? 1 : -1;
          const zone = Math.floor(dd / p.zoneW);
          const u = (dd - zone * p.zoneW) / p.zoneW;
          const nd = (zone + remapU(u, f)) * p.zoneW * sign;
          return [x + ux * (nd - d), y + uy * (nd - d)];
        }),
      }));
      return { paths };
    },
  
};
```

## fur.js

```js
import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "fur",
    name: "Fur", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 3 },
      { key: "length", label: "Length mm", type: "slider", min: 0.5, max: 30, step: 0.25, def: 5 },
      { key: "lenJit", label: "Length jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "angJit", label: "Angle jitter °", type: "slider", min: 0, max: 80, step: 1, def: 25 },
      { key: "side", label: "Side", type: "select", options: ["Both (alternate)", "Both (random)", "Left", "Right"], def: "Left" },
      { key: "host", label: "Include host path", type: "check", def: true },
      { key: "seed", label: "Seed", type: "seed", def: 43 },
      { key: "layer", label: "Hair pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      src.paths.forEach((path, pi) => {
        if (p.host) paths.push(path);
        const rng = mulberry32(p.seed * 883 + pi * 127 + 5);
        const pts = resample(path.pts, path.closed, Math.max(0.4, p.spacing));
        let alt = false;
        pts.forEach((pt, i) => {
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          let s;
          if (p.side === "Left") s = 1;
          else if (p.side === "Right") s = -1;
          else if (p.side === "Both (alternate)") { s = alt ? 1 : -1; alt = !alt; }
          else s = rng() > 0.5 ? 1 : -1;
          const baseA = Math.atan2(tx, -ty) + (s < 0 ? Math.PI : 0); /* normaalin suunta */
          const a = baseA + ((rng() - 0.5) * 2 * p.angJit * Math.PI) / 180;
          const len = Math.max(0.2, p.length * (1 - p.lenJit * rng()));
          paths.push({
            pts: [[pt[0], pt[1]], [pt[0] + Math.cos(a) * len, pt[1] + Math.sin(a) * len]],
            closed: false,
            layer: p.keepCol ? path.layer : Math.round(p.layer),
          });
        });
      });
      return { paths };
    },
  
};
```

## girih.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "girih",
    name: "Girih",
    cat: "gen",
    group: "geometric",
    desc: "Islamic star patterns by Hankin's method: a polygon tiling where two rays leave every edge midpoint at a contact angle and meet inside the tile, weaving a continuous star-and-polygon lattice. One angle slider morphs through the whole pattern family (54 deg is the classic); hexagon and square tilings.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tiling", label: "Tiling", type: "select", options: ["Hexagons", "Squares"], def: "Hexagons" },
      { key: "cell", label: "Tile size mm", type: "slider", min: 8, max: 60, step: 1, def: 24 },
      { key: "angle", label: "Contact angle deg (wire LFO)", type: "slider", min: 15, max: 85, step: 0.5, def: 54 },
      { key: "tileLines", label: "Draw tile edges", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);
      const s = Math.max(4, p.cell);
      const tiles = [];
      if (p.tiling === "Squares") {
        for (let y = y0; y + s <= y1 + 0.01; y += s) {
          for (let x = x0; x + s <= x1 + 0.01; x += s) {
            tiles.push([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]);
          }
        }
      } else {
        /* pointy-top hexagons in axial rows */
        const r = s / 2;
        const w = Math.sqrt(3) * r, h = 1.5 * r;
        for (let row = 0; ; row++) {
          const cy = y0 + r + row * h;
          if (cy + r > y1) break;
          const off = (row % 2) * (w / 2);
          for (let col = 0; ; col++) {
            const cx = x0 + w / 2 + off + col * w;
            if (cx + w / 2 > x1) break;
            const hex = [];
            for (let k = 0; k < 6; k++) {
              const a = (Math.PI / 3) * k + Math.PI / 6;
              hex.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
            }
            tiles.push(hex);
          }
        }
      }
      const th = (p.angle * Math.PI) / 180;
      const paths = [];
      const L = Math.round(p.layer);
      for (const poly of tiles) {
        const n = poly.length;
        /* per edge: midpoint + the two Hankin ray directions into the tile */
        const mids = [], d1 = [], d2 = [];
        let cx2 = 0, cy2 = 0;
        for (const [x, y] of poly) { cx2 += x; cy2 += y; }
        cx2 /= n; cy2 /= n;
        for (let i = 0; i < n; i++) {
          const A = poly[i], B = poly[(i + 1) % n];
          const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
          let ex = B[0] - A[0], ey = B[1] - A[1];
          const el = Math.hypot(ex, ey) || 1;
          ex /= el; ey /= el;
          /* inward normal */
          let nx = -ey, ny = ex;
          if ((cx2 - mx) * nx + (cy2 - my) * ny < 0) { nx = -nx; ny = -ny; }
          mids.push([mx, my]);
          d1.push([Math.cos(th) * ex + Math.sin(th) * nx, Math.cos(th) * ey + Math.sin(th) * ny]);
          d2.push([-Math.cos(th) * ex + Math.sin(th) * nx, -Math.cos(th) * ey + Math.sin(th) * ny]);
        }
        /* ray from edge i (dir d1) meets ray from edge i+1 (dir d2) */
        const ring = [];
        let ok = true;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const P = mids[i], D = d1[i], Q = mids[j], E = d2[j];
          const den = D[0] * E[1] - D[1] * E[0];
          let X;
          if (Math.abs(den) < 1e-9) {
            X = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
          } else {
            const t = ((Q[0] - P[0]) * E[1] - (Q[1] - P[1]) * E[0]) / den;
            if (t < 0 || t > s * 2) { ok = false; break; }
            X = [P[0] + D[0] * t, P[1] + D[1] * t];
          }
          ring.push(mids[i].slice(), X);
        }
        if (!ok || ring.length < 4) continue;
        paths.push({ pts: ring, closed: true, layer: L });
        if (p.tileLines) paths.push({ pts: poly.map((q) => q.slice()), closed: true, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## glitch.js

```js
import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "glitch",
    name: "Glitch", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amount", label: "Amount %", type: "slider", min: 0, max: 100, step: 1, def: 20 },
      { key: "amp", label: "Displacement mm", type: "slider", min: 0, max: 30, step: 0.5, def: 6 },
      { key: "skip", label: "Drop strokes %", type: "slider", min: 0, max: 90, step: 1, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rng = mulberry32(p.seed * 7919 + 13);
      const paths = [];
      for (const path of src.paths) {
        if (rng() * 100 < p.skip) continue;
        const pts = path.pts.map((pt) => pt.slice());
        const segs = Math.max(1, Math.floor((pts.length * p.amount) / 400));
        for (let g = 0; g < segs; g++) {
          if (rng() * 100 > p.amount) continue;
          const i0 = Math.floor(rng() * pts.length);
          const len = 1 + Math.floor(rng() * Math.max(2, pts.length / 10));
          const dx = (rng() - 0.5) * 2 * p.amp, dy = (rng() - 0.5) * 2 * p.amp;
          for (let i = i0; i < Math.min(pts.length, i0 + len); i++) { pts[i][0] += dx; pts[i][1] += dy; }
        }
        paths.push({ ...path, pts });
      }
      return { paths };
    },
  
};
```

## glitch3d.js

```js
import { Pin, EMPTY, mulberry32, noise2, resample } from "../helpers.js";

export default {
  key: "glitch3d",
    name: "3D Glitch",
    cat: "mod",
    group: "deform",
    desc: "Throws the 2D drawing into 3D space and corrupts it: the sheet undulates with noise relief, tilts with yaw and pitch under perspective, then glitches in screen space - horizontal bands tear loose and shift sideways, some quantize into blocky steps. Color split adds a displaced duplicate on another pen (plotter chromatic aberration). Wire Drift to Frame and the corruption crawls through an animation.",
    ins: [Pin("paths", "Paths")],
    outs: [Pin("paths")],
    params: [
      { key: "relief", label: "3D relief", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "scale", label: "Relief scale mm", type: "slider", min: 10, max: 120, step: 1, def: 50 },
      { key: "yaw", label: "Yaw deg", type: "slider", min: -60, max: 60, step: 1, def: 18 },
      { key: "pitch", label: "Pitch deg", type: "slider", min: -60, max: 60, step: 1, def: 22 },
      { key: "glitch", label: "Glitch", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "bands", label: "Glitch bands", type: "slider", min: 3, max: 40, step: 1, def: 14 },
      { key: "split", label: "Color split", type: "check", def: false },
      { key: "splitPen", label: "Split pen", type: "pen", def: 1 },
      { key: "drift", label: "Drift (wire Frame)", type: "slider", min: 0, max: 10, step: 0.05, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 9 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      /* content bbox: distorted result is fitted back into it */
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const pa of src.paths) for (const [x, y] of pa.pts) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const bw = Math.max(1, bx1 - bx0), bh = Math.max(1, by1 - by0);
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const D = p.drift * 2.9;
      const f = 1 / Math.max(4, p.scale);
      const zAmp = p.relief * Math.min(bw, bh) * 0.35;
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cyw = Math.cos(ya), syw = Math.sin(ya);
      const cpw = Math.cos(pa2), spw = Math.sin(pa2);
      const FOC = Math.max(bw, bh) * 2.2;
      const proj = (x, y) => {
        const ox = x - cx, oy = y - cy;
        const z = (noise2(x * f + D, y * f + D * 0.7, p.seed) - 0.5) * 2 * zAmp;
        /* yaw around vertical, pitch around horizontal */
        let X = ox * cyw + z * syw;
        let Z = -ox * syw + z * cyw;
        let Y = oy * cpw - Z * spw;
        Z = oy * spw + Z * cpw;
        const sc = FOC / Math.max(FOC * 0.15, FOC + Z);
        return [X * sc, Y * sc];
      };
      /* project all paths, track projected bbox */
      const step = 1.2;
      const proj2 = [];
      let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
      for (const pa of src.paths) {
        const pts = resample(pa.pts, pa.closed, step).map(([x, y]) => proj(x, y));
        for (const [x, y] of pts) {
          if (x < px0) px0 = x; if (x > px1) px1 = x;
          if (y < py0) py0 = y; if (y > py1) py1 = y;
        }
        proj2.push({ pts, closed: pa.closed, layer: pa.layer });
      }
      const sc2 = Math.min(bw / ((px1 - px0) || 1), bh / ((py1 - py0) || 1));
      const ox2 = bx0 + (bw - (px1 - px0) * sc2) / 2 - px0 * sc2;
      const oy2 = by0 + (bh - (py1 - py0) * sc2) / 2 - py0 * sc2;
      /* glitch bands in screen space: seeded shifts + blocky x-quantize, paths split at band edges */
      const NB = Math.max(1, Math.round(p.bands));
      const bandH = bh / NB;
      const rng = mulberry32(p.seed * 811 + 7 + Math.floor(D * 13.7));
      const bandDx = [], bandQ = [];
      for (let b = 0; b < NB + 2; b++) {
        const hit = rng() < p.glitch * 0.75;
        bandDx.push(hit ? (rng() - 0.5) * bw * 0.22 * p.glitch : 0);
        bandQ.push(hit && rng() < 0.35 ? 1.5 + rng() * 5 : 0); /* quantize block mm */
      }
      const bandOf = (y) => Math.max(0, Math.min(NB + 1, Math.floor((y - by0) / bandH)));
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const emit = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        out.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      const glitched = [];
      for (const pa of proj2) {
        const pts = pa.pts.map(([x, y]) => [x * sc2 + ox2, y * sc2 + oy2]);
        if (p.glitch < 0.01) { glitched.push({ pts, closed: pa.closed, layer: pa.layer }); continue; }
        let run = [];
        let curB = -1;
        for (const [x, y] of pts) {
          const b = bandOf(y);
          if (b !== curB && run.length) {
            if (run.length > 1) glitched.push({ pts: run, closed: false, layer: pa.layer });
            run = [];
          }
          curB = b;
          let gx = x + bandDx[b];
          if (bandQ[b] > 0) gx = Math.round(gx / bandQ[b]) * bandQ[b];
          run.push([gx, y]);
        }
        if (run.length > 1) glitched.push({ pts: run, closed: curB === bandOf(pts[0][1]) && pa.closed && glitched.length === 0 ? false : false, layer: pa.layer });
      }
      for (const g of glitched) emit(g.pts, g.closed, g.layer);
      if (p.split) {
        const dx = 0.6 + p.glitch * 1.6, dy = -0.3 - p.glitch * 0.5;
        const sp = Math.round(p.splitPen);
        for (const g of glitched) emit(g.pts.map(([x, y]) => [x + dx, y + dy]), g.closed, sp);
      }
      return { paths: out };
    }
  
};
```

## glitch_loom.js

```js
import { Pin, EMPTY, mulberry32, hash2, noise2, resample } from "../helpers.js";

export default {
  key: "glitch_loom",
    name: "Glitch Loom",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 42 },
      { key: "pitch", label: "Loom Pitch (mm)", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "shift", label: "Max Warp Shift", type: "slider", min: 0, max: 60, step: 1, def: 20 },
      { key: "fray", label: "Fray Probability", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "fray_len", label: "Fray Length", type: "slider", min: 2, max: 40, step: 1, def: 12 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 48611 + 12345);
      const paths = [];
      const pitchVal = Math.max(0.5, p.pitch);
      const stepSize = Math.max(0.2, pitchVal / 6);
      /* the app does not clip out-of-canvas geometry, so the mod must:
         shifted rows and frayed threads are clamped to the sheet */
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));

      src.paths.forEach((path) => {
        const resampled = resample(path.pts, path.closed, stepSize);
        if (resampled.length < 2) return;
        let currentSegment = [];
        let lastRow = Math.floor(resampled[0][1] / pitchVal);
        const flush = (row) => {
          if (currentSegment.length < 2) { currentSegment = []; return; }
          const rowSeed = hash2(0, row, p.seed);
          const dx = (rowSeed - 0.5) * 2 * p.shift;
          const shiftedPts = currentSegment.map(([sx, sy]) => [clampX(sx + dx), sy]);
          paths.push({ pts: shiftedPts, closed: false, layer: path.layer });
          if (rng() < p.fray) {
            const lastPt = shiftedPts[shiftedPts.length - 1];
            const frayPts = [lastPt.slice()];
            const steps = 6;
            for (let k = 1; k <= steps; k++) {
              const t = k / steps;
              const fx = clampX(lastPt[0] + (noise2(lastPt[0] * 0.08, t * 3, p.seed + row) - 0.5) * 6);
              const fy = clampY(lastPt[1] + t * p.fray_len);
              frayPts.push([fx, fy]);
            }
            paths.push({ pts: frayPts, closed: false, layer: path.layer });
          }
          currentSegment = [];
        };
        for (let i = 0; i < resampled.length; i++) {
          const [x, y] = resampled[i];
          const currentRow = Math.floor(y / pitchVal);
          if (currentRow !== lastRow && currentSegment.length > 0) flush(lastRow);
          currentSegment.push([x, y]);
          lastRow = currentRow;
        }
        flush(lastRow);
      });
      return { paths };
    }
  
};
```

## granulate.js

```js
import { Pin, EMPTY, hash2, resample } from "../helpers.js";

export default {
  key: "granulate",
    name: "Granulate",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "grain", label: "Grain length mm", type: "slider", min: 1, max: 25, step: 0.5, def: 6 },
      { key: "density", label: "Density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.9 },
      { key: "jitter", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 2 },
      { key: "rotate", label: "Rotate ± deg", type: "slider", min: 0, max: 90, step: 1, def: 12 },
      { key: "sjit", label: "Scale jitter %", type: "slider", min: 0, max: 80, step: 1, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 37 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const gl = Math.max(0.8, p.grain);
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      let gid = 0;
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.min(0.6, gl / 4));
        if (pts.length < 2) return;
        let start = 0, acc = 0;
        const flushGrain = (a, b) => {
          gid++;
          if (b - a < 1) return;
          if (hash2(gid * 5 + 1, 3, p.seed) >= Math.max(0, Math.min(1, p.density))) return;
          const grainPts = pts.slice(a, b + 1);
          /* transform the grain around its own centroid */
          let gx = 0, gy = 0;
          for (const [x, y] of grainPts) { gx += x; gy += y; }
          gx /= grainPts.length; gy /= grainPts.length;
          const jx = (hash2(gid * 5 + 2, 7, p.seed) - 0.5) * 2 * p.jitter;
          const jy = (hash2(gid * 5 + 3, 9, p.seed) - 0.5) * 2 * p.jitter;
          const ang = (hash2(gid * 5 + 4, 11, p.seed) - 0.5) * 2 * (p.rotate * Math.PI / 180);
          const sc = 1 + (hash2(gid * 5 + 5, 13, p.seed) - 0.5) * 2 * (p.sjit / 100);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          paths.push({
            pts: grainPts.map(([x, y]) => {
              const lx = (x - gx) * sc, ly = (y - gy) * sc;
              return clamp([gx + lx * ca - ly * sa + jx, gy + lx * sa + ly * ca + jy]);
            }),
            closed: false, layer: path.layer
          });
        };
        for (let i = 1; i < pts.length; i++) {
          acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (acc >= gl) { flushGrain(start, i); start = i; acc = 0; }
        }
        flushGrain(start, pts.length - 1);
      });
      return { paths };
    }
  
};
```

## gravity_cascade.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "gravity_cascade",
  name: "Gravity Cascade",
  cat: "gen",
  group: "scientific",
  desc: "Particles launched into a field of gravity wells trace decaying orbits. Wells layout places the attractors (Triangle is the classic three; Line, Ring, Center + ring and Random use the Wells count). Launch picks the start: Ring around the center, Top rain falling from the upper edge, or Spiral with staggered radii. Paths end at the sheet edge.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 888 },
    { key: "wells", label: "Wells layout", type: "select", options: ["Triangle", "Line", "Ring", "Center + ring", "Random"], def: "Triangle" },
    { key: "wellN", label: "Wells (non-triangle)", type: "slider", min: 1, max: 6, step: 1, def: 3 },
    { key: "launch", label: "Launch", type: "select", options: ["Ring", "Top rain", "Spiral"], def: "Ring" },
    { key: "orbits", label: "Orbit Count", type: "slider", min: 5, max: 80, step: 1, def: 35 },
    { key: "steps", label: "Steps per Orbit", type: "slider", min: 100, max: 2000, step: 50, def: 800 },
    { key: "pull", label: "Gravity Strength", type: "slider", min: 0.1, max: 3.0, step: 0.1, def: 1.2 },
    { key: "damping", label: "Friction Decay", type: "slider", min: 0.0, max: 0.02, step: 0.001, def: 0.003 },
    { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 8 },
    { key: "layer", label: "Pen Index", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
    const rng = mulberry32(p.seed * 4321 + 93);
    const paths = [];
    const L = Math.round(p.layer);

    /* wells: Triangle keeps the classic layout AND rng call order (old patches
       render identically); other layouts use the Wells count */
    const jit = () => (rng() - 0.5) * Math.min(W, H) * 0.08;
    const NW = Math.max(1, Math.round(p.wellN));
    let centers;
    if (p.wells === "Line") {
      centers = [];
      for (let i = 0; i < NW; i++) {
        const u = NW === 1 ? 0.5 : 0.2 + 0.6 * (i / (NW - 1));
        centers.push([W * u + jit() * 0.5, H * 0.5 + jit() * 0.5]);
      }
    } else if (p.wells === "Ring") {
      centers = [];
      const rr = Math.min(W, H) * 0.22;
      for (let i = 0; i < NW; i++) {
        const a = (i / NW) * Math.PI * 2 + rng() * 0.4;
        centers.push([W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr]);
      }
    } else if (p.wells === "Center + ring") {
      centers = [[W / 2 + jit() * 0.3, H / 2 + jit() * 0.3]];
      const rr = Math.min(W, H) * 0.27;
      for (let i = 0; i < Math.max(0, NW - 1); i++) {
        const a = (i / Math.max(1, NW - 1)) * Math.PI * 2 + rng() * 0.4;
        centers.push([W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr]);
      }
    } else if (p.wells === "Random") {
      centers = [];
      for (let i = 0; i < NW; i++) {
        centers.push([W * (0.25 + rng() * 0.5), H * (0.25 + rng() * 0.5)]);
      }
    } else {
      centers = [
        [W * 0.5 + jit(), H * 0.3 + jit()],
        [W * 0.35 + jit(), H * 0.65 + jit()],
        [W * 0.65 + jit(), H * 0.65 + jit()]
      ];
    }

    const orbitCount = Math.round(p.orbits);
    const maxSteps = Math.round(p.steps);
    const dt = 0.4;
    const BUDGET = 110000;
    let totalPts = 0;
    const inside = (x, y) => x >= m && x <= W - m && y >= m && y <= H - m;

    for (let o = 0; o < orbitCount && totalPts < BUDGET; o++) {
      let px, py, vx, vy;
      if (p.launch === "Top rain") {
        const u = orbitCount === 1 ? 0.5 : o / (orbitCount - 1);
        px = m + 4 + u * (W - 2 * m - 8) + (rng() - 0.5) * 4;
        py = m + 3 + rng() * Math.min(20, H * 0.06);
        const speed = 1.2 * (0.85 + rng() * 0.3);
        vx = (rng() - 0.5) * 0.6;
        vy = speed;
      } else if (p.launch === "Spiral") {
        const angle = (o / orbitCount) * Math.PI * 6;
        const shell = Math.min(W, H) * (0.1 + 0.3 * (o / orbitCount)) * (0.9 + rng() * 0.2);
        px = W * 0.5 + Math.cos(angle) * shell;
        py = H * 0.5 + Math.sin(angle) * shell;
        const speed = 1.8 * (0.85 + rng() * 0.3);
        vx = -Math.sin(angle) * speed;
        vy = Math.cos(angle) * speed;
      } else {
        /* Ring: classic launch, classic rng order */
        const angle = (o / orbitCount) * Math.PI * 2;
        const shell = Math.min(W, H) * 0.25 * (0.85 + rng() * 0.3);
        px = W * 0.5 + Math.cos(angle) * shell;
        py = H * 0.5 + Math.sin(angle) * shell;
        const speed = 1.8 * (0.85 + rng() * 0.3);
        vx = -Math.sin(angle) * speed;
        vy = Math.cos(angle) * speed;
      }

      const pts = [[px, py]];
      let lastX = px, lastY = py;
      for (let s = 0; s < maxSteps; s++) {
        let ax = 0, ay = 0;
        for (let c = 0; c < centers.length; c++) {
          const dx = centers[c][0] - px;
          const dy = centers[c][1] - py;
          const distSq = dx * dx + dy * dy + 15.0;
          const dist = Math.sqrt(distSq);
          const force = p.pull / distSq;
          ax += (dx / dist) * force;
          ay += (dy / dist) * force;
        }
        vx += ax * dt; vy += ay * dt;
        vx *= (1.0 - p.damping); vy *= (1.0 - p.damping);
        px += vx * dt; py += vy * dt;
        /* end the path AT the sheet: out-of-canvas points must not be emitted */
        if (!inside(px, py)) break;
        /* decimation: tight orbits crawl; only emit once the pen has moved */
        if (Math.hypot(px - lastX, py - lastY) >= 0.35) {
          pts.push([px, py]);
          lastX = px; lastY = py;
          totalPts++;
          if (totalPts >= BUDGET) break;
        }
      }
      if (pts.length > 2) paths.push({ pts, closed: false, layer: L });
    }
    return applyStyle({ paths }, ins[0]);
  }
};
```

## grid.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "grid",
    name: "Grid", cat: "gen", group: "geometric", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "vlines", label: "Vertical lines", type: "slider", min: 0, max: 60, step: 1, def: 13 },
      { key: "hlines", label: "Horizontal lines", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "res", label: "Resolution mm", type: "slider", min: 0.5, max: 10, step: 0.5, def: 2 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const x0 = p.margin, y0 = p.margin, x1 = W - p.margin, y1 = H - p.margin;
      const paths = [];
      const line = (ax, ay, bx, by) => {
        const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / p.res));
        const pts = [];
        for (let i = 0; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
        paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      };
      const hN = Math.round(p.hlines), vN = Math.round(p.vlines);
      for (let r = 0; r < hN; r++) {
        const y = hN === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * r) / (hN - 1);
        line(x0, y, x1, y);
      }
      for (let c = 0; c < vN; c++) {
        const x = vN === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * c) / (vN - 1);
        line(x, y0, x, y1);
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## growth.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "growth",
    name: "Growth", cat: "gen", group: "organic",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations", type: "slider", min: 20, max: 600, step: 5, def: 220 },
      { key: "repelR", label: "Repel radius mm", type: "slider", min: 1, max: 15, step: 0.25, def: 4 },
      { key: "repelF", label: "Repulsion", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "attract", label: "Cohesion", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "maxEdge", label: "Split edge mm", type: "slider", min: 0.6, max: 6, step: 0.1, def: 2 },
      { key: "growRate", label: "Growth rate", type: "slider", min: 0, max: 10, step: 1, def: 3 },
      { key: "startR", label: "Start radius mm", type: "slider", min: 3, max: 80, step: 1, def: 22 },
      { key: "bound", label: "Bounds", type: "select", options: ["Canvas margin", "Circle"], def: "Circle" },
      { key: "boundR", label: "Circle bound Ø mm", type: "slider", min: 20, max: 400, step: 1, def: 170 },
      { key: "rings", label: "History rings", type: "check", def: true },
      { key: "ringEvery", label: "Ring every N iters", type: "slider", min: 5, max: 100, step: 1, def: 24 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 149 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    overlay(p, ctx) {
      return p.bound === "Circle"
        ? [{ kind: "circle", cx: p.cx, cy: p.cy, r: p.boundR / 2 }]
        : [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
    },
    compute(ins, p, ctx) {
      /* differential growth: silmukka kasvaa — naapurivetovoima pitaa kasassa,
         lahitorjunta tyontaa erilleen, pitkat sarmat halkeavat -> poimuttuva kayra */
      const { W, H } = ctx;
      const MAXP = 2400;
      const rng = mulberry32(p.seed * 6091 + 113);
      let pts = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const r = p.startR * (1 + 0.08 * (rng() - 0.5));
        pts.push([p.cx + Math.cos(a) * r, p.cy + Math.sin(a) * r]);
      }
      const clampB = (q) => {
        if (p.bound === "Circle") {
          const dx = q[0] - p.cx, dy = q[1] - p.cy;
          const d = Math.hypot(dx, dy);
          const R = p.boundR / 2 - 1;
          if (d > R) return [p.cx + (dx / d) * R, p.cy + (dy / d) * R];
          return q;
        }
        return [Math.max(p.margin, Math.min(W - p.margin, q[0])), Math.max(p.margin, Math.min(H - p.margin, q[1]))];
      };
      const paths = [];
      const L = Math.round(p.layer);
      const rr = p.repelR, rr2 = rr * rr;
      const nIters = Math.round(p.iters);
      for (let it = 0; it < nIters; it++) {
        const N = pts.length;
        /* spatiaalinen hila naapurihakuun */
        const cellS = rr;
        const grid = new Map();
        for (let i = 0; i < N; i++) {
          const key = Math.floor(pts[i][0] / cellS) + "," + Math.floor(pts[i][1] / cellS);
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(i);
        }
        const next = new Array(N);
        for (let i = 0; i < N; i++) {
          const [x, y] = pts[i];
          let rx = 0, ry = 0;
          const gx = Math.floor(x / cellS), gy = Math.floor(y / cellS);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const lst = grid.get((gx + ox) + "," + (gy + oy));
            if (!lst) continue;
            for (const j of lst) {
              /* ohita kayran valittomat naapurit — muuten torjunta kumoaa koheesion */
              const ringD = Math.min((i - j + N) % N, (j - i + N) % N);
              if (ringD <= 2) continue;
              const dx = x - pts[j][0], dy = y - pts[j][1];
              const d2 = dx * dx + dy * dy;
              if (d2 > rr2 || d2 < 1e-9) continue;
              const d = Math.sqrt(d2);
              const f = (1 - d / rr) / d;
              rx += dx * f; ry += dy * f;
            }
          }
          const ip = (i - 1 + N) % N, inx = (i + 1) % N;
          const ax = (pts[ip][0] + pts[inx][0]) / 2 - x;
          const ay = (pts[ip][1] + pts[inx][1]) / 2 - y;
          let mx = rx * p.repelF * 0.55 + ax * p.attract * 0.55;
          let my = ry * p.repelF * 0.55 + ay * p.attract * 0.55;
          const ml = Math.hypot(mx, my);
          if (ml > 0.9) { mx = (mx / ml) * 0.9; my = (my / ml) * 0.9; }
          next[i] = clampB([x + mx, y + my]);
        }
        /* sarmien halkaisu: pitkat sarmat + kasvupaine (satunnaiset halkaisut) */
        const forceSplit = new Set();
        for (let k = 0; k < Math.round(p.growRate); k++) forceSplit.add(Math.floor(rng() * N));
        const grown = [];
        for (let i = 0; i < N; i++) {
          const a = next[i], b = next[(i + 1) % N];
          grown.push(a);
          const eLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (grown.length < MAXP && (eLen > p.maxEdge || (forceSplit.has(i) && eLen > 0.5))) {
            grown.push([(a[0] + b[0]) / 2 + (rng() - 0.5) * 0.15, (a[1] + b[1]) / 2 + (rng() - 0.5) * 0.15]);
          }
        }
        pts = grown;
        if (p.rings && it > 0 && it % Math.round(p.ringEvery) === 0) {
          paths.push({ pts: pts.map((q) => q.slice()), closed: true, layer: L });
        }
      }
      paths.push({ pts, closed: true, layer: L });
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## hairs.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "hairs",
    name: "Hairs", cat: "gen", group: "organic", ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Hairs", type: "slider", min: 20, max: 4000, step: 10, def: 700 },
      { key: "length", label: "Length mm", type: "slider", min: 1, max: 40, step: 0.5, def: 7 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "curl", label: "Curl", type: "slider", min: 0, max: 3, step: 0.05, def: 0.8 },
      { key: "dirMode", label: "Direction", type: "select", options: ["Flow (noise)", "Fixed angle", "Radial out"], def: "Flow (noise)" },
      { key: "angle", label: "Angle ° (fixed)", type: "slider", min: -180, max: 180, step: 1, def: 90 },
      { key: "fscale", label: "Flow scale", type: "slider", min: 0.002, max: 0.05, step: 0.001, def: 0.01 },
      { key: "droop", label: "Gravity droop", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "margin", label: "Margin mm (no region)", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 71 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      /* alue: suljetut sisaantulopolut (even-odd) tai koko canvas */
      const regions = ins[0] && ins[0].paths ? ins[0].paths.filter((q) => q.closed && q.pts.length > 2) : [];
      const inside = (x, y) => {
        if (!regions.length) {
          return x >= p.margin && x <= W - p.margin && y >= p.margin && y <= H - p.margin;
        }
        let cnt = 0;
        for (const path of regions) {
          const pts = path.pts;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
                (x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0])) cnt++;
          }
        }
        return cnt % 2 === 1;
      };
      /* alueen bbox naytteistysta varten */
      let bx0 = p.margin, by0 = p.margin, bx1 = W - p.margin, by1 = H - p.margin;
      if (regions.length) {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
        for (const path of regions) for (const [x, y] of path.pts) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      }
      const rng = mulberry32(p.seed * 1721 + 29);
      const paths = [];
      let guard = 0;
      const target = Math.round(p.count);
      while (paths.length < target && guard++ < target * 30) {
        const x0 = bx0 + rng() * (bx1 - bx0);
        const y0 = by0 + rng() * (by1 - by0);
        if (!inside(x0, y0)) continue;
        let a;
        if (p.dirMode === "Fixed angle") a = (p.angle * Math.PI) / 180 + (rng() - 0.5) * 0.4;
        else if (p.dirMode === "Radial out") a = Math.atan2(y0 - H / 2, x0 - W / 2) + (rng() - 0.5) * 0.3;
        else a = noise2(x0 * p.fscale, y0 * p.fscale, p.seed + 3) * Math.PI * 4;
        const len = Math.max(0.5, p.length * (1 - p.lenVar * rng()));
        const nSeg = 6;
        const step = len / nSeg;
        const curlDir = rng() > 0.5 ? 1 : -1;
        const pts = [[x0, y0]];
        let x = x0, y = y0, ha = a;
        for (let s = 0; s < nSeg; s++) {
          /* kihara + painovoima: suunta taipuu alaspain matkalla */
          ha += (p.curl * curlDir * 0.25) + (rng() - 0.5) * 0.1;
          const down = Math.PI / 2;
          let dA = down - ha;
          while (dA > Math.PI) dA -= Math.PI * 2;
          while (dA < -Math.PI) dA += Math.PI * 2;
          ha += dA * p.droop * 0.12;
          x += Math.cos(ha) * step;
          y += Math.sin(ha) * step;
          pts.push([x, y]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[1]);
    },
  
};
```

## halftone.js

```js
import { Pin, noise2, applyStyle } from "../helpers.js";

export default {
  key: "halftone",
    name: "Halftone", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "cell", label: "Cell mm", type: "slider", min: 3, max: 25, step: 0.5, def: 8 },
      { key: "maxK", label: "Max dots / side", type: "slider", min: 1, max: 6, step: 1, def: 4 },
      { key: "dotR", label: "Dot size mm", type: "slider", min: 0.2, max: 4, step: 0.1, def: 0.7 },
      { key: "scale", label: "Field scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 29 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const fbm = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < 3; o++) {
          v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
          tot += amp; amp *= 0.5; fq *= 2;
        }
        return v / tot;
      };
      const paths = [];
      const cols = Math.floor((W - 2 * p.margin) / p.cell);
      const rows = Math.floor((H - 2 * p.margin) / p.cell);
      const ox = (W - cols * p.cell) / 2, oy = (H - rows * p.cell) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cx = ox + c * p.cell + p.cell / 2, cy = oy + r * p.cell + p.cell / 2;
        let v = fbm(cx, cy);
        if (p.invert) v = 1 - v;
        const k = Math.round(v * p.maxK);
        if (k <= 0) continue;
        const sp = p.cell / k;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
          const dx = ox + c * p.cell + sp * (i + 0.5), dy = oy + r * p.cell + sp * (j + 0.5);
          const pts = [];
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * Math.PI * 2;
            pts.push([dx + Math.cos(a) * (p.dotR / 2), dy + Math.sin(a) * (p.dotR / 2)]);
          }
          paths.push({ pts, closed: true, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## handdrawn.js

```js
import { Pin, EMPTY, mulberry32, noise2, resample } from "../helpers.js";

export default {
  key: "handdrawn",
    name: "Hand Drawn",
    cat: "mod",
    group: "deform",
    desc: "Makes any line look drawn by hand: smooth low-frequency wobble across the stroke, fine tremor on top, optional ink breaks (the pen skips), and end overshoot / fall-short so strokes don't stop exactly where they should. Every path wobbles differently (own sub-seed), so parallel lines live like a real sketch. Unlike Jitter (raw point noise), the wobble runs along the stroke's own arc length.",
    ins: [Pin("paths", "Paths")],
    outs: [Pin("paths")],
    params: [
      { key: "wobble", label: "Wobble mm", type: "slider", min: 0, max: 8, step: 0.1, def: 1.2 },
      { key: "waveLen", label: "Wave length mm", type: "slider", min: 5, max: 120, step: 1, def: 30 },
      { key: "tremor", label: "Tremor mm", type: "slider", min: 0, max: 2, step: 0.05, def: 0.15 },
      { key: "breaks", label: "Ink breaks", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "gap", label: "Break gap mm", type: "slider", min: 0.5, max: 12, step: 0.5, def: 2.5 },
      { key: "ends", label: "End overshoot mm", type: "slider", min: -6, max: 10, step: 0.5, def: 1.5 },
      { key: "seed", label: "Seed", type: "seed", def: 3 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const WL = Math.max(3, p.waveLen);
      const step = Math.max(0.6, Math.min(2, WL / 8));
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const cl = (x, lim) => Math.max(0.5, Math.min(lim - 0.5, x));
      src.paths.forEach((pa, pi) => {
        if (pa.pts.length < 2) return;
        const sd = (p.seed * 977 + pi * 131) | 0;
        const rng = mulberry32(sd);
        let pts = resample(pa.pts, pa.closed, step);
        if (pts.length < 2) return;
        const closed = !!pa.closed;
        /* ends: extend or shorten open strokes (each end its own amount) */
        if (!closed && Math.abs(p.ends) > 0.01) {
          const extend = (arr, head) => {
            const amt = p.ends * (0.35 + rng() * 0.65);
            if (amt > 0.05) {
              const a = head ? arr[0] : arr[arr.length - 1];
              const b = head ? arr[1] : arr[arr.length - 2];
              const dx = a[0] - b[0], dy = a[1] - b[1];
              const L = Math.hypot(dx, dy) || 1;
              const n = Math.max(1, Math.round(amt / step));
              for (let k = 1; k <= n; k++) {
                const q = [a[0] + (dx / L) * step * k, a[1] + (dy / L) * step * k];
                head ? arr.unshift(q) : arr.push(q);
              }
            } else if (amt < -0.05) {
              const drop = Math.min(arr.length - 2, Math.round(-amt / step));
              for (let k = 0; k < drop; k++) head ? arr.shift() : arr.pop();
            }
          };
          extend(pts, false);
          extend(pts, true);
        }
        const n = pts.length;
        /* arclength per point */
        const S = new Float32Array(n);
        for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const totalLen = S[n - 1] || 1;
        const ph = rng() * 100; /* per-path noise phase */
        /* displaced points: wobble + tremor along the local normal */
        const disp = [];
        for (let i = 0; i < n; i++) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
          let tx = pts[i1][0] - pts[i0][0], ty = pts[i1][1] - pts[i0][1];
          const tl = Math.hypot(tx, ty) || 1;
          const nx = -ty / tl, ny = tx / tl;
          const u = S[i] / WL + ph;
          let w = (noise2(u, ph, sd) - 0.5) * 2 * p.wobble;
          w += (noise2(u * 6.3, ph + 7, sd + 1) - 0.5) * 2 * p.tremor;
          /* closed seam continuity: crossfade the last stretch toward the start value */
          if (closed && totalLen > 0) {
            const t = S[i] / totalLen;
            if (t > 0.85) {
              const u0 = 0 / WL + ph;
              let w0 = (noise2(u0, ph, sd) - 0.5) * 2 * p.wobble;
              w0 += (noise2(u0 * 6.3, ph + 7, sd + 1) - 0.5) * 2 * p.tremor;
              const f = (t - 0.85) / 0.15;
              w = w * (1 - f) + w0 * f;
            }
          }
          disp.push([cl(pts[i][0] + nx * w, W), cl(pts[i][1] + ny * w, H)]);
        }
        /* ink breaks: split into dashes with gaps */
        if (p.breaks > 0.001 && p.gap > 0.05) {
          const runs = [];
          let run = [disp[0]];
          /* expected breaks: up to ~1 per 25mm at breaks=1 */
          let nextBreak = 15 + rng() * 60 / (p.breaks + 0.05);
          let sAcc = 0, gapLeft = 0;
          for (let i = 1; i < n; i++) {
            const ds = S[i] - S[i - 1];
            sAcc += ds;
            if (gapLeft > 0) {
              gapLeft -= ds;
              if (gapLeft <= 0) run = [disp[i]];
              continue;
            }
            run.push(disp[i]);
            if (sAcc >= nextBreak) {
              if (run.length > 1) runs.push(run);
              gapLeft = p.gap * (0.5 + rng());
              nextBreak = sAcc + gapLeft + (8 + rng() * 55) / (p.breaks + 0.05);
              run = [];
            }
          }
          if (run.length > 1) runs.push(run);
          for (const r of runs) {
            if (total + r.length > BUDGET) break;
            total += r.length;
            out.push({ pts: r, closed: false, layer: pa.layer });
          }
        } else {
          if (total + disp.length > BUDGET) return;
          total += disp.length;
          out.push({ pts: disp, closed, layer: pa.layer });
        }
      });
      return { paths: out };
    }
  
};
```

## harmonograph.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "harmonograph",
    name: "Harmonograph",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "fx", label: "Freq X", type: "slider", min: 1, max: 12, step: 1, def: 3 },
      { key: "fy", label: "Freq Y", type: "slider", min: 1, max: 12, step: 1, def: 2 },
      { key: "detune", label: "Detune", type: "slider", min: 0, max: 0.05, step: 0.001, def: 0.008 },
      { key: "damp", label: "Damping", type: "slider", min: 0.001, max: 0.1, step: 0.001, def: 0.015 },
      { key: "dur", label: "Duration (swings)", type: "slider", min: 5, max: 80, step: 1, def: 40 },
      { key: "mix", label: "Pendulum 2 mix", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed (phases)", type: "seed", def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const ax = (W - 2 * m) / 2, ay = (H - 2 * m) / 2;
      if (ax < 5 || ay < 5) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 2833 + 41);
      const p1 = rng() * Math.PI * 2, p2 = rng() * Math.PI * 2;
      const p3 = rng() * Math.PI * 2, p4 = rng() * Math.PI * 2;
      const TWO = Math.PI * 2;
      const fx = Math.max(1, Math.round(p.fx)), fy = Math.max(1, Math.round(p.fy));
      const mix = Math.max(0, Math.min(1, p.mix));
      const damp = Math.max(0.0005, p.damp);
      const dur = Math.max(2, p.dur);
      /* two damped pendulums per axis: the classic twin-pendulum machine */
      const xAt = (t) => {
        const e1 = Math.exp(-damp * t), e2 = Math.exp(-damp * 1.35 * t);
        return (Math.sin(TWO * fx * t + p1) * e1 * (1 - mix * 0.5) +
                Math.sin(TWO * (fx + p.detune * fx + 1) * t + p2) * e2 * mix * 0.5);
      };
      const yAt = (t) => {
        const e1 = Math.exp(-damp * t), e2 = Math.exp(-damp * 1.35 * t);
        return (Math.sin(TWO * fy * t + p3) * e1 * (1 - mix * 0.5) +
                Math.sin(TWO * (fy + p.detune * fy + 1) * t + p4) * e2 * mix * 0.5);
      };
      const n = Math.min(30000, Math.max(2000, Math.round(dur * 400)));
      const pts = [];
      let lastX = 1e9, lastY = 1e9;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * dur;
        const x = W / 2 + xAt(t) * ax;
        const y = H / 2 + yAt(t) * ay;
        /* decimate: only emit once the pen has moved */
        if (Math.hypot(x - lastX, y - lastY) >= 0.15 || i === 0 || i === n) {
          pts.push([x, y]);
          lastX = x; lastY = y;
        }
      }
      if (pts.length < 2) return applyStyle({ paths: [] }, ins[0]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    }
  
};
```

## hatch.js

```js
import { Pin, EMPTY, resample, signedArea } from "../helpers.js";

export default {
  key: "hatch",
    name: "Hatch Fill", cat: "mod", group: "fillstyle", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "region", label: "Region", type: "select", options: ["Inside shapes", "Outside (invert)"], def: "Inside shapes" },
      { key: "invMargin", label: "Invert margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8 },
      { key: "angle", label: "Angle °", type: "slider", min: 0, max: 180, step: 1, def: 45 },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.3, max: 15, step: 0.1, def: 2 },
      { key: "inset", label: "Inset from edge mm", type: "slider", min: 0, max: 10, step: 0.1, def: 0 },
      { key: "cross", label: "Cross hatch", type: "check", def: false },
      { key: "outlines", label: "Keep outlines", type: "check", def: true },
      { key: "keepCol", label: "Keep shape colors", type: "check", def: true },
      { key: "layer", label: "Hatch pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      let closedPaths = src.paths.filter((pa) => pa.closed && pa.pts.length > 2);
      /* invert: lisaa canvas-kehys uloimmaksi renkaaksi -> even-odd viivoittaa muotojen ULKOpuolen */
      if (p.region === "Outside (invert)") {
        const m = p.invMargin;
        closedPaths = [
          {
            pts: [[m, m], [ctx.W - m, m], [ctx.W - m, ctx.H - m], [m, ctx.H - m]],
            closed: true, layer: Math.round(p.layer),
          },
          ...closedPaths,
        ];
      }
      /* inset: siirrä reunaa täyttöalueen sisään — myös reikien reunat (parity) */
      if (p.inset > 0) {
        const ringContains = (ring, x, y) => {
          let ins = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
          }
          return ins;
        };
        closedPaths = closedPaths.map((pa, pi) => {
          const pts = resample(pa.pts, true, 1);
          const N = pts.length;
          /* montako MUUTA rengasta sisältää tämän? pariton = reiän reuna -> offset ulospäin */
          let cnt = 0;
          for (let k = 0; k < closedPaths.length; k++) {
            if (k === pi) continue;
            if (ringContains(closedPaths[k].pts, pts[0][0], pts[0][1])) cnt++;
          }
          const hole = cnt % 2 === 1;
          const inward = (signedArea(pts) > 0 ? 1 : -1) * (hole ? -1 : 1);
          return {
            ...pa,
            pts: pts.map((pt, i) => {
              const nI = (i + 1) % N, pI = (i - 1 + N) % N;
              const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
              const tl = Math.hypot(tx, ty) || 1;
              return [pt[0] + (-ty / tl) * p.inset * inward, pt[1] + (tx / tl) * p.inset * inward];
            }),
          };
        });
      }
      for (const path of src.paths) if (p.outlines || !path.closed) paths.push(path);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const angles = p.cross ? [p.angle, p.angle + 90] : [p.angle];
      for (const angDeg of angles) {
        const a = (angDeg * Math.PI) / 180;
        const ca = Math.cos(-a), sa = Math.sin(-a);
        const caB = Math.cos(a), saB = Math.sin(a);
        /* kierrä muodot viivoituskulman avaruuteen */
        const rot = closedPaths.map((pa) => ({
          layer: pa.layer,
          pts: pa.pts.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
          }),
        }));
        let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
        for (const pa of rot) for (const [x, y] of pa.pts) {
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
        }
        if (minY === Infinity) continue;
        let row = 0;
        for (let y = minY + p.spacing / 2; y < maxY; y += p.spacing, row++) {
          /* leikkauspisteet per muoto, even-odd */
          const xs = [];
          const xLayer = [];
          for (const pa of rot) {
            const pts = pa.pts;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const [xi, yi] = pts[i], [xj, yj] = pts[j];
              if ((yi > y) !== (yj > y)) {
                xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
                xLayer.push(pa.layer);
              }
            }
          }
          const order = xs.map((x, i) => i).sort((i, j) => xs[i] - xs[j]);
          for (let k = 0; k + 1 < order.length; k += 2) {
            let xA = xs[order[k]], xB = xs[order[k + 1]];
            if (xB - xA < 0.2) continue;
            if (row % 2 === 1) { const t = xA; xA = xB; xB = t; } // boustrophedon: suunta vuorotellen
            const back = ([x, yy]) => {
              const dx = x - cx, dy = yy - cy;
              return [cx + dx * caB - dy * saB, cy + dx * saB + dy * caB];
            };
            paths.push({
              pts: [back([xA, y]), back([xB, y])],
              closed: false,
              layer: p.keepCol ? xLayer[order[k]] : Math.round(p.layer),
            });
          }
        }
      }
      return { paths };
    },
  
};
```

## hersheytext.js

```js
import { Pin, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "hersheytext",
    name: "Text", cat: "gen", group: "textimg", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text (| = new line)", type: "text", def: "MUUSIA" },
      { key: "size", label: "Size mm (cap height)", type: "slider", min: 2, max: 80, step: 0.5, def: 20 },
      { key: "track", label: "Tracking %", type: "slider", min: 50, max: 250, step: 1, def: 100 },
      { key: "lineh", label: "Line height %", type: "slider", min: 90, max: 300, step: 1, def: 150 },
      { key: "align", label: "Align", type: "select", options: ["Left", "Center", "Right"], def: "Center" },
      { key: "centerC", label: "Center on canvas", type: "check", def: true },
      { key: "px", label: "Pos X mm", type: "slider", min: 0, max: 400, step: 1, def: 20 },
      { key: "py", label: "Pos Y mm", type: "slider", min: 0, max: 400, step: 1, def: 40 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* Oma yksiviivafontti: ruudukko x 0..~9, y 0 = versaalin ylareuna, 10 = peruslinja */
      const F = SFONT;
      const sc = p.size / 10;
      const tr = p.track / 100;
      const lines = String(p.text || "").toUpperCase().split("|");
      const lineWidth = (line) => {
        let w = 0;
        for (const ch of line) w += ((F[ch] || F[" "]).w + 2) * sc * tr;
        return w;
      };
      const totalH = p.size + (lines.length - 1) * p.size * (p.lineh / 100);
      const maxW = Math.max(...lines.map(lineWidth), 1);
      let ox, oy;
      if (p.centerC) {
        ox = (ctx.W - maxW) / 2;
        oy = (ctx.H - totalH) / 2;
      } else { ox = p.px; oy = p.py; }
      const paths = [];
      lines.forEach((line, li) => {
        const lw = lineWidth(line);
        let x = ox + (p.align === "Center" ? (maxW - lw) / 2 : p.align === "Right" ? maxW - lw : 0);
        const y = oy + li * p.size * (p.lineh / 100);
        for (const ch of line) {
          const g = F[ch] || F[" "];
          for (const stroke of g.s) {
            if (stroke.length < 2) continue;
            paths.push({
              pts: stroke.map(([gx, gy]) => [x + gx * sc, y + gy * sc]),
              closed: false, layer: Math.round(p.layer),
            });
          }
          x += (g.w + 2) * sc * tr;
        }
      });
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## himmeli.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "himmeli",
    name: "Himmeli",
    cat: "gen",
    group: "structural",
    desc: "Traditional Finnish straw mobile in 3D: octahedral straw units built into classic forms - Single crystal, Column (units tip to tip on threads), Chandelier (center with hanging side units), or Cluster (a two-layer cloud with pendants swinging on threads at seeded lengths and angles). Rotate with View yaw and pitch; wire Frame into Yaw and the mobile spins through the animation.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "model", label: "Model", type: "select", options: ["Single", "Column", "Chandelier", "Cluster"], def: "Cluster" },
      { key: "size", label: "Unit size mm", type: "slider", min: 10, max: 60, step: 1, def: 28 },
      { key: "elong", label: "Elongation", type: "slider", min: 0.8, max: 2.2, step: 0.05, def: 1.35 },
      { key: "complexity", label: "Complexity", type: "slider", min: 1, max: 5, step: 1, def: 3 },
      { key: "pendants", label: "Hanging pendants", type: "check", def: true },
      { key: "threads", label: "Draw threads", type: "check", def: true },
      { key: "yaw", label: "View yaw deg (wire Frame)", type: "slider", min: 0, max: 360, step: 1, def: 28 },
      { key: "pitch", label: "View pitch deg", type: "slider", min: -30, max: 60, step: 1, def: 12 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 8 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 419 + 3);
      const S = Math.max(4, p.size);
      const EL = p.elong;
      const C = Math.max(1, Math.min(5, Math.round(p.complexity)));
      const segs = [];    /* 3D straw segments: [x1,y1,z1,x2,y2,z2] */
      const threads = []; /* 3D thread segments */
      /* one octahedral unit: center (cx,cy,cz), width w, own yaw rotation ry.
         y axis points UP in model space. */
      const unit = (cx, cy, cz, w, ry) => {
        const hw = w / 2, hh = (w * EL) / 2;
        const ca = Math.cos(ry), sa = Math.sin(ry);
        const rot = (x, z) => [x * ca + z * sa, -x * sa + z * ca];
        const eq = [];
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          const [rx, rz] = rot(Math.cos(a) * hw, Math.sin(a) * hw);
          eq.push([cx + rx, cy, cz + rz]);
        }
        const top = [cx, cy + hh, cz], bot = [cx, cy - hh, cz];
        for (let k = 0; k < 4; k++) {
          const nk = (k + 1) % 4;
          segs.push([...eq[k], ...eq[nk]]);
          segs.push([...top, ...eq[k]]);
          segs.push([...bot, ...eq[k]]);
        }
        return { top, bot, eq, hh };
      };
      const thread = (a, b) => threads.push([...a, ...b]);

      if (p.model === "Single") {
        const u = unit(0, 0, 0, S, Math.PI / 4);
        if (C >= 3) unit(0, 0, 0, S * 0.5, 0); /* nested inner crystal */
        if (p.threads) thread([0, u.hh + S * 0.5, 0], u.top);
      } else if (p.model === "Column") {
        /* pitkähimmeli: units tip to tip with short thread gaps, sizes easing */
        const n = C + 1;
        const gap = S * 0.14;
        let y = 0;
        let prevBot = null;
        for (let i = 0; i < n; i++) {
          const w = S * (1 - 0.13 * i);
          const hh = (w * EL) / 2;
          const cy = y - hh;
          const u = unit(0, cy, 0, w, (i % 2) * (Math.PI / 4));
          if (p.threads) {
            if (prevBot) thread(prevBot, u.top);
            else thread([0, y + S * 0.4, 0], u.top);
          }
          prevBot = u.bot;
          y = cy - hh - gap;
        }
      } else if (p.model === "Chandelier") {
        const u = unit(0, 0, 0, S, Math.PI / 4);
        if (p.threads) thread([0, u.hh + S * 0.5, 0], u.top);
        if (p.pendants) {
          const sides = Math.min(6, C + 1);
          for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2;
            const px = Math.cos(a) * S * 0.72, pz = Math.sin(a) * S * 0.72;
            const drop = S * (0.55 + rng() * 0.35);
            const pw = S * (0.42 + rng() * 0.18);
            const pu = unit(px, -drop - (pw * EL) / 2, pz, pw, rng() * Math.PI);
            if (p.threads) thread([Math.cos(a) * S * 0.5, 0, Math.sin(a) * S * 0.5], pu.top);
          }
          const bw2 = S * 0.5;
          const bu = unit(0, -u.hh - S * 0.45 - (bw2 * EL) / 2, 0, bw2, 0);
          if (p.threads) thread(u.bot, bu.top);
        }
      } else {
        /* Cluster: two stacked grid layers + swinging pendants (the photo) */
        const g = Math.max(2, C);
        const w = S, hh = (w * EL) / 2;
        const bots = [];
        for (let gz = 0; gz < g; gz++) {
          for (let gxi = 0; gxi < g; gxi++) {
            const x = (gxi - (g - 1) / 2) * w;
            const z = (gz - (g - 1) / 2) * w;
            unit(x, 0, z, w, Math.PI / 4);
          }
        }
        for (let gz = 0; gz < g - 1; gz++) {
          for (let gxi = 0; gxi < g - 1; gxi++) {
            const x = (gxi - (g - 2) / 2) * w;
            const z = (gz - (g - 2) / 2) * w;
            const u = unit(x, -hh * 1.02, z, w, 0);
            bots.push(u);
          }
        }
        if (p.threads) thread([0, hh + S * 0.5, 0], [0, hh, 0]);
        if (p.pendants && bots.length) {
          const nP = Math.min(bots.length, 3 + C * 2);
          /* pick spread-out parents deterministically */
          const order = bots.map((u, i) => [rng(), i]).sort((a, b) => a[0] - b[0]);
          for (let k = 0; k < nP; k++) {
            const u = bots[order[k][1]];
            const drop = S * (0.5 + rng() * 1.1);
            const pw = S * (0.45 + rng() * 0.4);
            const px = u.bot[0] + (rng() - 0.5) * S * 0.15;
            const pz = u.bot[2] + (rng() - 0.5) * S * 0.15;
            const pu = unit(px, u.bot[1] - drop - (pw * EL) / 2, pz, pw, rng() * Math.PI);
            if (p.threads) thread(u.bot, pu.top);
          }
        }
      }

      /* project: yaw around vertical, pitch, perspective; y up -> screen y down */
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      let ext = S;
      for (const s of segs) ext = Math.max(ext, Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2]), Math.abs(s[3]), Math.abs(s[4]), Math.abs(s[5]));
      const FOC = ext * 2 * (0.8 + 6 * (1 - p.persp));
      const proj = (x, y, z) => {
        const X = x * cy2 + z * sy2;
        let Z = -x * sy2 + z * cy2;
        const Y = y * cp2 - Z * sp2;
        Z = y * sp2 + Z * cp2;
        const sc = FOC / Math.max(FOC * 0.12, FOC + Z);
        return [X * sc, -Y * sc];
      };
      /* dedupe identical straws (shared between touching units) */
      const seen = new Set();
      const q = (v) => Math.round(v * 10) / 10;
      const out2 = [];
      const addSeg = (s, isThread) => {
        const A = proj(s[0], s[1], s[2]), B = proj(s[3], s[4], s[5]);
        const k1 = q(A[0]) + "," + q(A[1]) + "|" + q(B[0]) + "," + q(B[1]);
        const k2 = q(B[0]) + "," + q(B[1]) + "|" + q(A[0]) + "," + q(A[1]);
        if (seen.has(k1) || seen.has(k2)) return;
        seen.add(k1);
        out2.push({ A, B, isThread });
      };
      for (const s of segs) addSeg(s, false);
      if (p.threads) for (const s of threads) addSeg(s, true);
      /* fit */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const o of out2) {
        for (const P of [o.A, o.B]) {
          if (P[0] < fx0) fx0 = P[0]; if (P[0] > fx1) fx1 = P[0];
          if (P[1] < fy0) fy0 = P[1]; if (P[1] > fy1) fy1 = P[1];
        }
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const L = Math.round(p.layer);
      const cl = (v, lim) => Math.max(0.5, Math.min(lim - 0.5, v));
      const paths = out2.map((o) => ({
        pts: [[cl(o.A[0] * sc + ox, W), cl(o.A[1] * sc + oy, H)], [cl(o.B[0] * sc + ox, W), cl(o.B[1] * sc + oy, H)]],
        closed: false, layer: L
      }));
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## hyperbolic_truchet.js

```js
import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  key: "hyperbolic_truchet",
  name: "Hyperbolic Truchet Maze",
  cat: "gen",
  group: "geometric",
  desc: "Truchet arcs on a polar grid whose rings crowd toward the center or the rim (Ring Crowding), so the maze reads as a hyperbolic disc. Arc strands connect seamlessly across cells. Solve traces the strand network and recolors one strand running from the center to the outer rim onto the Solve pen (the longest strand if no full crossing exists; Arcs style only).",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 2026 },
    { key: "rings", label: "Concentric Rings", type: "slider", min: 4, max: 40, step: 1, def: 18 },
    { key: "segments", label: "Ray Segments", type: "slider", min: 8, max: 120, step: 2, def: 48 },
    { key: "curvature", label: "Ring Crowding (- center / + edge)", type: "slider", min: -1, max: 1, step: 0.05, def: -0.5 },
    { key: "style", label: "Tile Style", type: "select", options: ["Arcs (Truchet)", "Diagonals"], def: "Arcs (Truchet)" },
    { key: "solve", label: "Solve (mark one strand)", type: "check", def: false },
    { key: "solvePen", label: "Solve pen", type: "pen", def: 2 },
    { key: "layer", label: "Pen Index", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const cx = W / 2, cy = H / 2;
    const maxRadius = Math.min(W, H) * 0.45;
    const L = Math.round(p.layer);
    const ringCount = Math.max(1, Math.round(p.rings));
    const segCount = Math.max(4, Math.round(p.segments));
    const TWO = Math.PI * 2;

    /* ring distribution: exponential mapping, sign of curvature picks
       whether rings crowd toward the center (event horizon) or the rim */
    const k = Math.max(-1, Math.min(1, p.curvature)) * 3;
    const remap = (t) => Math.abs(k) < 0.01 ? t : (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
    const radii = [];
    for (let r = 0; r <= ringCount; r++) {
      radii.push(maxRadius * remap(r / ringCount));
    }

    const P = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    /* quarter-ellipse in (angle, radius) space: enters/leaves cell edges
       perpendicular-ish so strands connect seamlessly across cells */
    const arcMid = (aFrom, rFrom, aTo, rTo) => {
      const chord = Math.hypot(P(aTo, rTo)[0] - P(aFrom, rFrom)[0], P(aTo, rTo)[1] - P(aFrom, rFrom)[1]);
      const K = Math.max(4, Math.min(24, Math.round(chord / 1.1) + 3));
      const pts = [];
      for (let j = 0; j <= K; j++) {
        const u = j / K;
        const a = aFrom + (aTo - aFrom) * Math.sin(u * Math.PI / 2);
        const rr = rFrom + (rTo - rFrom) * (1 - Math.cos(u * Math.PI / 2));
        pts.push(P(a, rr));
      }
      return pts;
    };

    const arcs = []; /* { pts, n1, n2 } - node keys for strand tracing */
    for (let r = 0; r < ringCount; r++) {
      const rIn = radii[r], rOut = radii[r + 1];
      const rMid = (rIn + rOut) / 2;
      if (rOut - rIn < 0.4) continue;
      for (let s = 0; s < segCount; s++) {
        const a1 = (s / segCount) * TWO;
        const a2 = ((s + 1) / segCount) * TWO;
        const aMid = (a1 + a2) / 2;
        const cellHash = hash2(r, s, p.seed);
        const rayL = "y" + r + "_" + s;
        const rayR = "y" + r + "_" + ((s + 1) % segCount);
        const inner = "c" + r + "_" + s;
        const outer = "c" + (r + 1) + "_" + s;
        if (p.style === "Diagonals") {
          /* original behavior: corner-to-corner spiral diagonals */
          const from = cellHash > 0.5 ? a1 : a2;
          const to = cellHash > 0.5 ? a2 : a1;
          const arr = [];
          for (let j = 0; j <= 8; j++) {
            const u = j / 8;
            arr.push(P(from + (to - from) * u, rIn + (rOut - rIn) * u));
          }
          arcs.push({ pts: arr, n1: null, n2: null });
        } else {
          if (cellHash > 0.5) {
            arcs.push({ pts: arcMid(a1, rMid, aMid, rIn), n1: rayL, n2: inner });
            arcs.push({ pts: arcMid(aMid, rOut, a2, rMid), n1: outer, n2: rayR });
          } else {
            arcs.push({ pts: arcMid(a1, rMid, aMid, rOut), n1: rayL, n2: outer });
            arcs.push({ pts: arcMid(aMid, rIn, a2, rMid), n1: inner, n2: rayR });
          }
        }
      }
    }

    /* ---- solve: trace strands through shared edge midpoints ---- */
    const solveSet = new Set();
    if (p.solve && p.style !== "Diagonals" && arcs.length) {
      const adj = new Map(); /* node -> [arcIdx] */
      arcs.forEach((a, i) => {
        for (const nkey of [a.n1, a.n2]) {
          if (!adj.has(nkey)) adj.set(nkey, []);
          adj.get(nkey).push(i);
        }
      });
      const used = new Uint8Array(arcs.length);
      const chains = [];
      const trace = (startNode, firstArc) => {
        const chain = [];
        let node = startNode, ai = firstArc;
        let guard = 0;
        while (ai !== undefined && !used[ai] && guard++ < arcs.length + 2) {
          used[ai] = 1;
          chain.push(ai);
          node = arcs[ai].n1 === node ? arcs[ai].n2 : arcs[ai].n1;
          ai = (adj.get(node) || []).find((j) => !used[j]);
        }
        return { chain, endA: startNode, endB: node };
      };
      for (const [nkey, list] of adj) {
        if (list.length !== 1) continue; /* open ends live at boundaries */
        const ai = list.find((j) => !used[j]);
        if (ai !== undefined) chains.push(trace(nkey, ai));
      }
      const isCenter = (nk) => typeof nk === "string" && nk.startsWith("c0_");
      const isRim = (nk) => typeof nk === "string" && nk.startsWith("c" + ringCount + "_");
      let pick = chains.find((ch) =>
        (isCenter(ch.endA) && isRim(ch.endB)) || (isCenter(ch.endB) && isRim(ch.endA)));
      if (!pick && chains.length) {
        pick = chains.reduce((best, ch) => ch.chain.length > best.chain.length ? ch : best, chains[0]);
      }
      if (pick) for (const i of pick.chain) solveSet.add(i);
    }

    const SP = Math.round(p.solvePen);
    const paths = arcs.map((a, i) => ({
      pts: a.pts, closed: false, layer: solveSet.has(i) ? SP : L
    }));
    return applyStyle({ paths }, ins[0]);
  },
};
```

## image.js

```js
import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "image",
    name: "Image", cat: "gen", group: "textimg", fileImage: true,
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "mode", label: "Render", type: "select", options: ["Scanline wave", "Halftone dots", "Hatch levels", "Flow shade"], def: "Scanline wave" },
      { key: "cell", label: "Cell / spacing mm", type: "slider", min: 0.8, max: 12, step: 0.1, def: 2.4 },
      { key: "strength", label: "Strength", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.8 },
      { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
      { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.06 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 139 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx, node) {
      const img = node && node.data && node.data.img;
      if (!img) return EMPTY;
      const { W, H } = ctx;
      const m = p.margin;
      /* sovita kuva marginaalilaatikkoon mittasuhteet sailyttaen */
      const boxW = W - 2 * m, boxH = H - 2 * m;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const x0 = (W - iw) / 2, y0 = (H - ih) / 2;
      const darkAt = (x, y) => {
        /* bilineaarinen naytteistys; kuvan ulkopuolella valkoista */
        const u = (x - x0) / sc, v = (y - y0) / sc;
        if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
        const ui = Math.floor(u), vi = Math.floor(v);
        const fu = u - ui, fv = v - vi;
        const g = img.g;
        const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
        const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
        let d = a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
        if (p.invert) d = 1 - d;
        return Math.pow(Math.max(0, d), p.gamma);
      };
      const L = Math.round(p.layer);
      const paths = [];
      if (p.mode === "Scanline wave") {
        /* klassikko: vaakarivit, tummuus kasvattaa amplitudia JA taajuutta */
        for (let y = y0; y <= y0 + ih; y += p.cell) {
          let run = [], phase = 0;
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (let x = x0; x <= x0 + iw; x += 0.35) {
            const d = darkAt(x, y);
            if (d < p.cutoff) { flush(); continue; }
            phase += 0.5 + d * 2.6;
            run.push([x, y + Math.sin(phase) * d * p.cell * 0.48 * p.strength]);
          }
          flush();
        }
      } else if (p.mode === "Halftone dots") {
        for (let y = y0 + p.cell / 2; y < y0 + ih; y += p.cell) {
          for (let x = x0 + p.cell / 2; x < x0 + iw; x += p.cell) {
            const d = darkAt(x, y);
            if (d < p.cutoff) continue;
            const r = d * p.cell * 0.46 * p.strength;
            if (r < 0.16) continue;
            const pts = [];
            const n = r < 0.8 ? 6 : 10;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
            }
            paths.push({ pts, closed: true, layer: L });
          }
        }
      } else if (p.mode === "Hatch levels") {
        /* 4 viivoitustasoa: tummempi alue saa useamman suunnan */
        const angles = [45, -45, 0, 90];
        const levels = [0.2, 0.42, 0.62, 0.82];
        const diag = Math.hypot(iw, ih);
        const cxm = x0 + iw / 2, cym = y0 + ih / 2;
        for (let k = 0; k < 4; k++) {
          const a = (angles[k] * Math.PI) / 180;
          const dx = Math.cos(a), dy = Math.sin(a);
          const px = -dy, py = dx;
          for (let o = -diag / 2; o <= diag / 2; o += p.cell) {
            let run = [];
            const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
            for (let t = -diag / 2; t <= diag / 2; t += 0.5) {
              const x = cxm + dx * t + px * o, y = cym + dy * t + py * o;
              if (darkAt(x, y) * p.strength >= levels[k]) run.push([x, y]);
              else flush();
            }
            flush();
          }
        }
      } else {
        /* Flow shade: virtausviivat joiden tiheys ja pituus seuraavat tummuutta */
        const rng = mulberry32(p.seed * 5479 + 101);
        const attempts = Math.round((iw * ih) / (p.cell * p.cell) * 1.6);
        let budget = 60000;
        for (let i = 0; i < attempts && budget > 0; i++) {
          const sx = x0 + rng() * iw, sy = y0 + rng() * ih;
          const d0 = darkAt(sx, sy);
          if (d0 < p.cutoff || rng() > d0) continue;
          const len = 2 + d0 * 14 * p.strength;
          let x = sx, y = sy;
          const pts = [[x, y]];
          const steps = Math.round(len / 0.8);
          for (let s = 0; s < steps; s++) {
            const a = noise2(x * 0.02, y * 0.02, p.seed + 9) * Math.PI * 4;
            x += Math.cos(a) * 0.8;
            y += Math.sin(a) * 0.8;
            pts.push([x, y]);
          }
          budget -= pts.length;
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## interference.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "interference",
    name: "Contours", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "field", label: "Field", type: "select", options: ["Terrain (fBm)", "Waves"], def: "Terrain (fBm)" },
      { key: "scale", label: "Terrain scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
      { key: "octaves", label: "Octaves", type: "slider", min: 1, max: 5, step: 1, def: 4 },
      { key: "sources", label: "Wave sources", type: "slider", min: 2, max: 5, step: 1, def: 2 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 5, max: 80, step: 1, def: 24 },
      { key: "levels", label: "Contour levels", type: "slider", min: 2, max: 24, step: 1, def: 12 },
      { key: "res", label: "Resolution mm", type: "slider", min: 1, max: 5, step: 0.5, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 5 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 433 + 17);
      let f;
      if (p.field === "Waves") {
        const srcs = [];
        const nS = Math.round(p.sources);
        for (let i = 0; i < nS; i++) {
          srcs.push([p.margin + rng() * (W - 2 * p.margin), p.margin + rng() * (H - 2 * p.margin)]);
        }
        f = (x, y) => {
          let v = 0;
          for (const [sx, sy] of srcs) v += Math.sin((Math.hypot(x - sx, y - sy) / p.wl) * Math.PI * 2);
          return v;
        };
      } else {
        /* fBm-maasto: oktaaveittain summattu kohina -> korkeuskartta */
        const oct = Math.round(p.octaves);
        f = (x, y) => {
          let v = 0, amp = 1, fq = 1, tot = 0;
          for (let o = 0; o < oct; o++) {
            v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
            tot += amp; amp *= 0.5; fq *= 2;
          }
          return v / tot;
        };
      }
      /* marching squares + ketjutus */
      const step = Math.max(1, p.res);
      const x0 = p.margin, y0 = p.margin, x1 = W - p.margin, y1 = H - p.margin;
      const nx = Math.floor((x1 - x0) / step), ny = Math.floor((y1 - y0) / step);
      const grid = [];
      let vMin = Infinity, vMax = -Infinity;
      for (let j = 0; j <= ny; j++) {
        const row = [];
        for (let i = 0; i <= nx; i++) {
          const v = f(x0 + i * step, y0 + j * step);
          if (v < vMin) vMin = v;
          if (v > vMax) vMax = v;
          row.push(v);
        }
        grid.push(row);
      }
      const paths = [];
      for (let L = 1; L <= Math.round(p.levels); L++) {
        const iso = vMin + ((vMax - vMin) * L) / (Math.round(p.levels) + 1);
        const segs = [];
        const lerp = (va, vb, pa, pb) => {
          const t = (iso - va) / (vb - va || 1e-9);
          return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
        };
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const ax = x0 + i * step, ay = y0 + j * step;
          const v = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
          const P = [[ax, ay], [ax + step, ay], [ax + step, ay + step], [ax, ay + step]];
          let idx = 0;
          for (let k = 0; k < 4; k++) if (v[k] > iso) idx |= 1 << k;
          if (idx === 0 || idx === 15) continue;
          const E = (k) => lerp(v[k], v[(k + 1) % 4], P[k], P[(k + 1) % 4]);
          const CASES = {
            1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]],
            6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]],
            11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]],
          };
          for (const [ea, eb] of CASES[idx] || []) segs.push([E(ea), E(eb)]);
        }
        /* ketjuta segmentit polyviivoiksi */
        const key = (pt) => Math.round(pt[0] * 20) + "," + Math.round(pt[1] * 20);
        const adj = {};
        segs.forEach((s, i) => {
          for (const end of [0, 1]) {
            const k = key(s[end]);
            (adj[k] = adj[k] || []).push([i, end]);
          }
        });
        const used = new Array(segs.length).fill(false);
        for (let i = 0; i < segs.length; i++) {
          if (used[i]) continue;
          used[i] = true;
          let chain = [segs[i][0], segs[i][1]];
          let grow = true;
          while (grow) {
            grow = false;
            const k = key(chain[chain.length - 1]);
            for (const [si, se] of adj[k] || []) {
              if (used[si]) continue;
              used[si] = true;
              chain.push(segs[si][se === 0 ? 1 : 0]);
              grow = true;
              break;
            }
          }
          if (chain.length > 1) paths.push({ pts: chain, closed: false, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## jitter.js

```js
import { Pin, EMPTY, noise2 } from "../helpers.js";

export default {
  key: "jitter",
    name: "Jitter", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amp", label: "Strength mm", type: "slider", min: 0, max: 15, step: 0.25, def: 2 },
      { key: "scale", label: "Noise scale", type: "slider", min: 0.01, max: 0.5, step: 0.01, def: 0.08 },
      { key: "seed", label: "Seed", type: "seed", def: 1 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [
          x + (noise2(x * p.scale, y * p.scale, p.seed) - 0.5) * 2 * p.amp,
          y + (noise2(x * p.scale + 91, y * p.scale + 37, p.seed) - 0.5) * 2 * p.amp,
        ]),
      }));
      return { paths };
    },
  
};
```

## joinends.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "joinends",
    name: "Join Ends", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "gap", label: "Max gap mm", type: "slider", min: 0.1, max: 40, step: 0.1, def: 5 },
      { key: "arc", label: "Arc", type: "slider", min: 0, max: 1.5, step: 0.05, def: 0.5 },
      { key: "angTol", label: "Angle tolerance °", type: "slider", min: 5, max: 180, step: 1, def: 60 },
      { key: "samePen", label: "Same pen only", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const out = src.paths.filter((pa) => pa.closed || pa.pts.length < 2);
      let items = src.paths.filter((pa) => !pa.closed && pa.pts.length >= 2)
        .map((pa) => ({ pts: pa.pts.map((q) => q.slice()), layer: pa.layer }));
      const tol = (p.angTol * Math.PI) / 180;
      const outDir = (pts, end) => {
        const a = end === 1 ? pts[pts.length - 1] : pts[0];
        const b = end === 1 ? pts[pts.length - 2] : pts[1];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        return [(a[0] - b[0]) / d, (a[1] - b[1]) / d];
      };
      const endPt = (pts, end) => (end === 1 ? pts[pts.length - 1] : pts[0]);
      const angBetween = (ax, ay, bx, by) => Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by)));
      const bezier = (A, dA, B, dB, d) => {
        const h = d * p.arc;
        const c1 = [A[0] + dA[0] * h, A[1] + dA[1] * h];
        const c2 = [B[0] + dB[0] * h, B[1] + dB[1] * h];
        const n = Math.max(4, Math.min(24, Math.ceil(d / 1.2)));
        const pts = [];
        for (let i = 1; i < n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([
            u * u * u * A[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * B[0],
            u * u * u * A[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * B[1],
          ]);
        }
        return pts;
      };
      /* kierroksittain: pisteytä kaikki kelvolliset päät (etäisyys + kulmasakko),
         yhdistä paras joukko ristiriidattomasti, toista */
      for (let round = 0; round < 60 && items.length > 1; round++) {
        const ends = [];
        items.forEach((it, ii) => {
          for (const e of [0, 1]) {
            ends.push({ ii, e, pt: endPt(it.pts, e), dir: outDir(it.pts, e), layer: it.layer });
          }
        });
        const cands = [];
        for (let a = 0; a < ends.length; a++) {
          for (let b = a + 1; b < ends.length; b++) {
            const A = ends[a], B = ends[b];
            if (A.ii === B.ii) continue;
            if (p.samePen && A.layer !== B.layer) continue;
            const dx = B.pt[0] - A.pt[0], dy = B.pt[1] - A.pt[1];
            const d = Math.hypot(dx, dy);
            if (d > p.gap) continue;
            const L = d || 1;
            const angA = angBetween(A.dir[0], A.dir[1], dx / L, dy / L);
            const angB = angBetween(B.dir[0], B.dir[1], -dx / L, -dy / L);
            if (angA > tol || angB > tol) continue;
            /* pisteytys: etäisyys + kulmien sileyssakko */
            cands.push({ a, b, d, score: d * (1 + (angA + angB) / Math.max(0.15, tol)) });
          }
        }
        if (!cands.length) break;
        cands.sort((x, y) => x.score - y.score);
        const usedItem = new Set();
        const joins = [];
        for (const c of cands) {
          const A = ends[c.a], B = ends[c.b];
          if (usedItem.has(A.ii) || usedItem.has(B.ii)) continue;
          usedItem.add(A.ii); usedItem.add(B.ii);
          joins.push(c);
        }
        if (!joins.length) break;
        const remove = new Set();
        const added = [];
        for (const c of joins) {
          const A = ends[c.a], B = ends[c.b];
          let pi = items[A.ii].pts, pj = items[B.ii].pts;
          if (A.e === 0) pi = [...pi].reverse();
          if (B.e === 1) pj = [...pj].reverse();
          const Ap = pi[pi.length - 1], Bp = pj[0];
          const conn = bezier(Ap, outDir(pi, 1), Bp, outDir(pj, 0), c.d);
          added.push({ pts: [...pi, ...conn, ...pj], layer: items[A.ii].layer });
          remove.add(A.ii); remove.add(B.ii);
        }
        items = items.filter((_, k) => !remove.has(k)).concat(added);
      }
      /* sulje itsensä kohtaavat silmukat */
      for (const it of items) {
        const A = endPt(it.pts, 1), B = endPt(it.pts, 0);
        const d = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (d <= p.gap && it.pts.length > 3) {
          const dA = outDir(it.pts, 1), dB = outDir(it.pts, 0);
          const dx = B[0] - A[0], dy = B[1] - A[1];
          const L = d || 1;
          if (angBetween(dA[0], dA[1], dx / L, dy / L) <= tol &&
              angBetween(dB[0], dB[1], -dx / L, -dy / L) <= tol) {
            it.pts = [...it.pts, ...bezier(A, dA, B, dB, d)];
            it.closed = true;
          }
        }
        out.push({ pts: it.pts, closed: !!it.closed, layer: it.layer });
      }
      return { paths: out };
    },
  
};
```

## julia.js

```js
import { Pin, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "julia",
    name: "Julia",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Set", type: "select", options: ["Julia", "Mandelbrot"], def: "Julia" },
      { key: "cre", label: "c real (wire LFO)", type: "slider", min: -1.5, max: 1.5, step: 0.005, def: -0.7 },
      { key: "cim", label: "c imag", type: "slider", min: -1.5, max: 1.5, step: 0.005, def: 0.27 },
      { key: "zoom", label: "Zoom", type: "slider", min: 0.5, max: 8, step: 0.1, def: 1 },
      { key: "iters", label: "Max iterations", type: "slider", min: 20, max: 200, step: 5, def: 60 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "cell", label: "Cell mm", type: "slider", min: 0.8, max: 4, step: 0.2, def: 1.6 },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
      const cell = Math.max(0.6, p.cell);
      const cols = Math.min(240, Math.max(10, Math.round(bw / cell)));
      const rows = Math.min(320, Math.max(10, Math.round(bh / cell)));
      const julia = p.mode === "Julia";
      const zoom = Math.max(0.1, p.zoom);
      const span = 3.2 / zoom;
      const cx0 = julia ? 0 : -0.5;
      const aspect = bh / bw;
      const maxIt = Math.max(10, Math.min(400, Math.round(p.iters)));
      /* smooth escape-time field, normalized 0..1 */
      const field = (fx, fyv) => {
        let zr, zi, cr, ci2;
        if (julia) { zr = fx; zi = fyv; cr = p.cre; ci2 = p.cim; }
        else { zr = 0; zi = 0; cr = fx; ci2 = fyv; }
        let i = 0;
        let r2 = zr * zr + zi * zi;
        while (i < maxIt && r2 < 16) {
          const nr = zr * zr - zi * zi + cr;
          zi = 2 * zr * zi + ci2;
          zr = nr;
          r2 = zr * zr + zi * zi;
          i++;
        }
        if (i >= maxIt) return 1;
        const sm = i + 1 - Math.log2(Math.max(1.0001, Math.log(Math.sqrt(r2))));
        return Math.max(0, Math.min(1, sm / maxIt));
      };
      const gx = (c) => m + (c / (cols - 1)) * bw;
      const gy = (r) => m + (r / (rows - 1)) * bh;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fx = cx0 + (c / (cols - 1) - 0.5) * span;
          const fyv = (r / (rows - 1) - 0.5) * span * aspect;
          F[r * cols + c] = field(fx, fyv);
        }
      }
      const segs = [];
      const NB = Math.max(1, Math.min(8, Math.round(p.bands)));
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let bi = 0; bi < NB; bi++) {
        const lvl = (bi + 1) / (NB + 1);
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A2, B2) => segs.push([A2, B2]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## kaleidoscope.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "kaleidoscope",
    name: "Kaleidoscope",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "sectors", label: "Sectors", type: "slider", min: 2, max: 24, step: 1, def: 6 },
      { key: "mirror", label: "Mirror alternate", type: "check", def: true },
      { key: "rot", label: "Rotate offset deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const N = Math.max(2, Math.min(32, Math.round(p.sectors)));
      const wedge = (Math.PI * 2) / N;
      const base = (p.rot * Math.PI) / 180;
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      /* 1) clip the source to one wedge, 2) replicate the runs N times,
         mirroring every other copy when Mirror is on */
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        const inWedge = pts.map(([x, y]) => {
          let a = Math.atan2(y - cy, x - cx) - base;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          return a < wedge;
        });
        const runs = [];
        let run = [];
        for (let i = 0; i < pts.length; i++) {
          if (inWedge[i]) run.push(pts[i]);
          else { if (run.length > 1) runs.push(run); run = []; }
        }
        if (run.length > 1) runs.push(run);
        for (const r of runs) {
          /* run in wedge-local polar coordinates */
          const local = r.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            let a = Math.atan2(dy, dx) - base;
            a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            return [Math.hypot(dx, dy), a];
          });
          for (let k = 0; k < N; k++) {
            const flip = p.mirror && (k % 2 === 1);
            paths.push({
              pts: local.map(([rad, a]) => {
                const aa = base + k * wedge + (flip ? wedge - a : a);
                return clamp([cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad]);
              }),
              closed: false, layer: path.layer
            });
          }
        }
      });
      return { paths };
    }
  
};
```

## kierto.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "kierto",
    name: "Rotate", cat: "mod", group: "transform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "deg", label: "Angle °", type: "slider", min: -180, max: 180, step: 1, def: 15 },
      { key: "per", label: "Per path (centroid)", type: "check", def: false },
      { key: "grad", label: "Progressive (Molnár)", type: "check", def: false },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const rot = (pts, cx, cy, rad) =>
        pts.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
        });
      const n = src.paths.length || 1;
      const paths = src.paths.map((path, i) => {
        const f = p.grad ? i / n : 1;
        const rad = ((p.deg * Math.PI) / 180) * f;
        let cx = ctx.W / 2, cy = ctx.H / 2;
        if (p.per) {
          cx = path.pts.reduce((s, q) => s + q[0], 0) / path.pts.length;
          cy = path.pts.reduce((s, q) => s + q[1], 0) / path.pts.length;
        }
        return { ...path, pts: rot(path.pts, cx, cy, rad) };
      });
      return { paths };
    },
  
};
```

## lace.js

```js
import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  key: "lace",
    name: "Lace",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Pattern", type: "select", options: ["Doily", "Edging", "Mesh ground"], def: "Doily" },
      { key: "rings", label: "Rings (doily)", type: "slider", min: 1, max: 10, step: 1, def: 5 },
      { key: "sectors", label: "Sectors / scallops", type: "slider", min: 4, max: 40, step: 1, def: 16 },
      { key: "detail", label: "Detail", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "picots", label: "Picots", type: "check", def: true },
      { key: "depth", label: "Depth mm (edging)", type: "slider", min: 10, max: 80, step: 1, def: 30 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 7 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const S = Math.max(4, Math.min(64, Math.round(p.sectors)));
      const det = Math.max(0, Math.min(1, p.detail));
      const TWO = Math.PI * 2;
      const paths = [];
      const circleAt = (cx, cy, r, n) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TWO;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        paths.push({ pts, closed: true, layer: L });
      };

      /* ============================ DOILY ============================ */
      if (p.mode === "Doily") {
        const cx = W / 2, cy = H / 2;
        const maxR = Math.min(W, H) / 2 - m;
        if (maxR < 12) return applyStyle({ paths: [] }, ins[0]);
        const P = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        const picotR = p.picots ? Math.min(2.4, Math.max(1, maxR * 0.028)) : 0;
        const scH = Math.max(4, Math.min(15, maxR * 0.15));
        const outerBase = maxR - 2 * picotR - scH;

        /* --- center flower --- */
        const fR = maxR * 0.2;
        const np = Math.min(16, Math.max(5, Math.round(S / 2)));
        const NN = 9;
        for (let j = 0; j < np; j++) {
          const a = (j / np) * TWO;
          const ca = Math.cos(a), sa = Math.sin(a);
          const wid = fR * 0.5;
          const pts = [];
          for (let i = 0; i <= NN; i++) {
            const u = i / NN, t = u * fR, rad = Math.sin(Math.PI * u) * wid * 0.5;
            pts.push([cx + ca * t - sa * rad, cy + sa * t + ca * rad]);
          }
          for (let i = NN - 1; i >= 1; i--) {
            const u = i / NN, t = u * fR, rad = -Math.sin(Math.PI * u) * wid * 0.5;
            pts.push([cx + ca * t - sa * rad, cy + sa * t + ca * rad]);
          }
          paths.push({ pts, closed: true, layer: L });
        }
        circleAt(cx, cy, fR * 0.22, 12);

        /* --- ring bands with hashed classic motifs --- */
        const rIn = fR * 1.3;
        const availB = outerBase - rIn - 2;
        const K = Math.max(0, Math.min(10, Math.round(p.rings)));
        if (availB > 6 && K > 0) {
          const bh = availB / K;
          for (let k = 0; k < K; k++) {
            const r0 = rIn + k * bh + 0.8;
            const r1 = rIn + (k + 1) * bh - 0.8;
            if (r1 - r0 < 1.5) continue;
            const rm = (r0 + r1) / 2;
            const pick = hash2(k * 13 + 2, 5, p.seed);
            if (pick < 0.16) {
              /* plain ring */
              circleAt(cx, cy, rm, Math.max(48, S * 5));
            } else if (pick < 0.32) {
              /* double ring */
              circleAt(cx, cy, r0 + (r1 - r0) * 0.25, Math.max(48, S * 5));
              circleAt(cx, cy, r0 + (r1 - r0) * 0.75, Math.max(48, S * 5));
            } else if (pick < 0.56) {
              /* zigzag mesh: two opposite-phase rings -> diamonds */
              const M = S * 2;
              for (let ph = 0; ph < 2; ph++) {
                const pts = [];
                for (let i = 0; i < M; i++) {
                  const r = (i + ph) % 2 ? r1 : r0;
                  pts.push(P(r, (i / M) * TWO));
                }
                paths.push({ pts, closed: true, layer: L });
              }
            } else if (pick < 0.8) {
              /* fans: per-sector spokes + outer arc */
              const st = TWO / S;
              const nf = 3 + Math.round(det * 4);
              for (let s = 0; s < S; s++) {
                const a0 = s * st, ac = a0 + st / 2;
                const piv = P(r0, ac);
                for (let j = 0; j < nf; j++) {
                  const aj = a0 + (0.12 + 0.76 * (nf === 1 ? 0.5 : j / (nf - 1))) * st;
                  paths.push({ pts: [piv.slice(), P(r1 - 0.3, aj)], closed: false, layer: L });
                }
                const arc = [];
                for (let j = 0; j <= 8; j++) {
                  arc.push(P(r1 - 0.3, a0 + (0.12 + 0.76 * (j / 8)) * st));
                }
                paths.push({ pts: arc, closed: false, layer: L });
              }
            } else {
              /* picot ring: circle with tiny outward loops */
              circleAt(cx, cy, rm, Math.max(48, S * 5));
              let pr = Math.min(2.2, Math.max(0.8, (r1 - r0) * 0.3));
              pr = Math.min(pr, (r1 - rm) / 2);
              if (pr > 0.4) {
                for (let s = 0; s < S; s++) {
                  const a = ((s + 0.5) / S) * TWO;
                  const c = P(rm + pr, a);
                  circleAt(c[0], c[1], pr, 8);
                }
              }
            }
          }
        }

        /* --- outer scalloped edge (classic finish) --- */
        circleAt(cx, cy, outerBase, Math.max(48, S * 5));
        const J = 10;
        const sc = [];
        for (let s = 0; s < S; s++) {
          for (let j = 0; j < J; j++) {
            const u = j / J;
            const a = ((s + u) / S) * TWO;
            const rad = outerBase + scH * Math.pow(Math.sin(Math.PI * u), 1.15);
            sc.push(P(rad, a));
          }
        }
        paths.push({ pts: sc, closed: true, layer: L });
        if (picotR > 0) {
          for (let s = 0; s < S; s++) {
            const a = ((s + 0.5) / S) * TWO;
            const c = P(maxR - picotR, a);
            circleAt(c[0], c[1], picotR, 10);
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ============================ EDGING ============================ */
      if (p.mode === "Edging") {
        const x0 = m, x1 = W - m;
        if (x1 - x0 < 20) return applyStyle({ paths: [] }, ins[0]);
        const y0 = m;
        const Dmax = H - 2 * m;
        let pr = p.picots ? 2 : 0;
        let D = Math.min(Math.max(10, p.depth), Dmax) - 2 * pr;
        if (D < 10) { pr = 0; D = Math.min(Math.max(8, p.depth), Dmax); }
        if (D < 8) return applyStyle({ paths: [] }, ins[0]);

        /* header lines */
        paths.push({ pts: [[x0, y0], [x1, y0]], closed: false, layer: L });
        paths.push({ pts: [[x0, y0 + 1.8], [x1, y0 + 1.8]], closed: false, layer: L });

        /* mesh strip: two opposite-phase zigzags */
        const yA = y0 + 3.5;
        const yB = yA + Math.max(4, D * 0.25);
        const M2 = S * 2;
        for (let ph = 0; ph < 2; ph++) {
          const pts = [];
          for (let i = 0; i <= M2; i++) {
            const x = x0 + (i / M2) * (x1 - x0);
            pts.push([x, (i + ph) % 2 ? yB : yA]);
          }
          paths.push({ pts, closed: false, layer: L });
        }

        /* scallops with fans + picots */
        const yb = yB + 2;
        const ybot = y0 + 3.5 + D;
        if (ybot - yb > 4) {
          const wSc = (x1 - x0) / S;
          const J = 12;
          const chain = [];
          for (let s = 0; s < S; s++) {
            for (let j = 0; j <= (s === S - 1 ? J : J - 1); j++) {
              const u = j / J;
              const x = x0 + ((s + u) / S) * (x1 - x0);
              const y = yb + (ybot - yb) * Math.pow(Math.sin(Math.PI * u), 1.1);
              chain.push([x, y]);
            }
          }
          paths.push({ pts: chain, closed: false, layer: L });
          const nf = 3 + Math.round(det * 4);
          for (let s = 0; s < S; s++) {
            const xs = x0 + s * wSc;
            const piv = [xs + wSc / 2, yb + 0.5];
            for (let j = 0; j < nf; j++) {
              const u = 0.15 + 0.7 * (nf === 1 ? 0.5 : j / (nf - 1));
              const x = xs + u * wSc;
              const y = yb + (ybot - yb) * Math.pow(Math.sin(Math.PI * u), 1.1);
              paths.push({ pts: [piv.slice(), [x, y - 0.4]], closed: false, layer: L });
            }
            if (pr > 0) {
              const cxp = xs + wSc / 2;
              circleAt(cxp, ybot + pr, pr, 10);
            }
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ========================= MESH GROUND ========================= */
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const g = 3.5 + (1 - det) * 9;
      const cs = g * Math.SQRT2;
      /* diagonal families clipped to rect */
      const clipLine = (sign) => {
        /* sign +1: x + y = c ; sign -1: x - y = c */
        const cMin = sign > 0 ? x0 + y0 : x0 - y1;
        const cMax = sign > 0 ? x1 + y1 : x1 - y0;
        for (let c = cMin + cs / 2; c < cMax; c += cs) {
          const cand = [];
          const tryPt = (x, y) => {
            if (x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6) cand.push([x, y]);
          };
          if (sign > 0) {
            tryPt(x0, c - x0); tryPt(x1, c - x1); tryPt(c - y0, y0); tryPt(c - y1, y1);
          } else {
            tryPt(x0, x0 - c); tryPt(x1, x1 - c); tryPt(c + y0, y0); tryPt(c + y1, y1);
          }
          /* dedupe + take extremes */
          const uniq = [];
          for (const q of cand) {
            if (!uniq.some((u) => Math.abs(u[0] - q[0]) < 1e-6 && Math.abs(u[1] - q[1]) < 1e-6)) uniq.push(q);
          }
          if (uniq.length >= 2) {
            uniq.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const a = uniq[0], b = uniq[uniq.length - 1];
            if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) {
              paths.push({ pts: [a, b], closed: false, layer: L });
            }
          }
        }
      };
      clipLine(1); clipLine(-1);
      /* torchon spiders */
      const nx = Math.floor((x1 - x0) / cs), ny = Math.floor((y1 - y0) / cs);
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          if (hash2(i * 3 + 1, j * 3 + 2, p.seed) >= det * 0.45) continue;
          const cxx = x0 + (i + 0.5) * cs, cyy = y0 + (j + 0.5) * cs;
          const d = g * 0.42;
          if (cxx - d < x0 || cxx + d > x1 || cyy - d < y0 || cyy + d > y1) continue;
          paths.push({
            pts: [[cxx + d, cyy], [cxx, cyy + d], [cxx - d, cyy], [cxx, cyy - d]],
            closed: true, layer: L,
          });
          paths.push({ pts: [[cxx - d * 0.55, cyy], [cxx + d * 0.55, cyy]], closed: false, layer: L });
          paths.push({ pts: [[cxx, cyy - d * 0.55], [cxx, cyy + d * 0.55]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## lathe.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "lathe",
    name: "Lathe", cat: "gen", group: "structural", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "sheds", label: "Sheds (skirts)", type: "slider", min: 1, max: 20, step: 1, def: 6 },
      { key: "depth", label: "Shed depth mm", type: "slider", min: 0, max: 50, step: 0.5, def: 16 },
      { key: "shape", label: "Shed shape", type: "select", options: ["Skirt (insulator)", "Round wave", "Sharp zigzag"], def: "Skirt (insulator)" },
      { key: "coreR", label: "Core radius mm", type: "slider", min: 2, max: 60, step: 0.5, def: 13 },
      { key: "height", label: "Height mm", type: "slider", min: 20, max: 300, step: 1, def: 150 },
      { key: "rings", label: "Rings", type: "slider", min: 10, max: 300, step: 2, def: 110 },
      { key: "tilt", label: "View tilt", type: "slider", min: 0.05, max: 1, step: 0.05, def: 0.32 },
      { key: "mode", label: "Render", type: "select", options: ["Rings", "Profile", "Both"], def: "Rings" },
      { key: "px", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const L = Math.round(p.layer);
      const paths = [];
      /* pyorahdysprofiili r(t), t = 0 ylhaalla .. 1 alhaalla */
      const rAt = (t) => {
        const u = (t * p.sheds) % 1;
        let bump;
        if (p.shape === "Skirt (insulator)") bump = Math.pow(u, 0.65);          /* kasvaa, pudotus poimun lopussa */
        else if (p.shape === "Sharp zigzag") bump = 1 - Math.abs(u * 2 - 1);
        else bump = 0.5 + 0.5 * Math.sin((t * p.sheds) * Math.PI * 2 - Math.PI / 2);
        /* paat kapenevat hieman (kaula & kanta) */
        const env = Math.min(1, Math.min(t, 1 - t) * 8 + 0.35);
        return (p.coreR + p.depth * bump) * env + p.coreR * (1 - env) * 0.6;
      };
      const y0 = p.py - p.height / 2;
      if (p.mode !== "Profile") {
        const nR = Math.round(p.rings);
        for (let i = 0; i <= nR; i++) {
          const t = i / nR;
          const r = rAt(t);
          const cy = y0 + t * p.height;
          const pts = [];
          for (let k = 0; k < 48; k++) {
            const a = (k / 48) * Math.PI * 2;
            pts.push([p.px + Math.cos(a) * r, cy + Math.sin(a) * r * p.tilt]);
          }
          paths.push({ pts, closed: true, layer: L });
        }
      }
      if (p.mode !== "Rings") {
        const nP = 400;
        const left = [], right = [];
        for (let i = 0; i <= nP; i++) {
          const t = i / nP;
          const r = rAt(t);
          const cy = y0 + t * p.height;
          left.push([p.px - r, cy]);
          right.push([p.px + r, cy]);
        }
        paths.push({ pts: left, closed: false, layer: L });
        paths.push({ pts: right, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## lens.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "lens",
    name: "Lens", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "useCenter", label: "Use canvas center", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "radius", label: "Radius mm", type: "slider", min: 10, max: 300, step: 1, def: 90 },
      { key: "strength", label: "Strength (− pinch, + bulge)", type: "slider", min: -0.9, max: 0.9, step: 0.05, def: 0.4 },
    ],
    overlay(p, ctx) {
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      return [{ kind: "circle", cx, cy, r: p.radius }, { kind: "point", x: cx, y: cy }];
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d >= p.radius || d < 0.001) return [x, y];
          const t = 1 - d / p.radius;
          const f = 1 + p.strength * t * t;
          return [cx + dx * f, cy + dy * f];
        }),
      }));
      return { paths };
    },
  
};
```

## lfo.js

```js
import { Pin, noise2 } from "../helpers.js";

export default {
  key: "lfo",
    name: "LFO",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "wave", label: "Waveform", type: "select", options: ["Sine", "Triangle", "Saw", "Square", "Noise loop"], def: "Sine" },
      { key: "cycles", label: "Cycles / loop", type: "slider", min: 1, max: 16, step: 1, def: 1 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed (noise)", type: "seed", def: 8 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const cyc = Math.max(1, Math.round(p.cycles)); /* integer -> loop stays seamless */
      const u = ((raw * cyc + p.phase) % 1 + 1) % 1;
      let v;
      if (p.wave === "Triangle") v = 1 - Math.abs(u * 2 - 1);
      else if (p.wave === "Saw") v = u;
      else if (p.wave === "Square") v = u < 0.5 ? 1 : 0;
      else if (p.wave === "Noise loop") {
        const a = u * Math.PI * 2;
        v = noise2(Math.cos(a) * 1.5 + 7.3, Math.sin(a) * 1.5 + 2.9, p.seed);
      } else v = 0.5 + 0.5 * Math.sin(u * Math.PI * 2);
      return p.min + v * (p.max - p.min);
    }
  
};
```

## lichen.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "lichen",
    name: "Lichen",
    cat: "gen",
    group: "textimg",
    desc: "Map-lichen and crustose growth after the real thing: Map builds polygon patches split by continuous wandering cracks, each patch grain clipped to its own cell; Rosettes grows ringed circular thalli with dark centers and pale rims (target-lichen); Colony scatters mixed-age patches across bare rock. Pens splits species across the palette; fill style (mosaic / rings / stipple) is seed-mixed; sizes follow a natural small-to-large distribution.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "style", label: "Style", type: "select", options: ["Map", "Rosettes", "Colony"], def: "Map" },
      { key: "density", label: "Density", type: "slider", min: 0.2, max: 1, step: 0.05, def: 0.6 },
      { key: "scale", label: "Feature size mm", type: "slider", min: 4, max: 40, step: 1, def: 14 },
      { key: "detail", label: "Fill detail", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "crackWidth", label: "Crack width", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "pens", label: "Pens (species split)", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "crackPen", label: "Crack / center pen", type: "pen", def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 12 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 2749 + 13);
      const S = Math.max(2, p.scale);
      const NPENS = Math.max(1, Math.min(6, Math.round(p.pens)));
      const crackPen = Math.round(p.crackPen);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const clampPt = (x, y) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      const push = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return false;
        total += pts.length;
        paths.push({ pts: pts.map(([x, y]) => clampPt(x, y)), closed, layer });
        return true;
      };
      /* natural size: many small, few large (power law) */
      const sizeRoll = () => Math.pow(rng(), 1.7);
      /* wobbly blob outline */
      const blob = (cx, cy, r, wob, sd, res) => {
        const pts = [];
        const nn = Math.max(14, Math.round(r * (res || 1.4)));
        for (let i = 0; i < nn; i++) {
          const a = (i / nn) * Math.PI * 2;
          const rr = r * (1 + (noise2(Math.cos(a) * 1.6 + sd, Math.sin(a) * 1.6 + sd * 0.7, sd | 0) - 0.5) * 2 * wob);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        return pts;
      };
      const inBlob = (px, py, cx, cy, r, wob, sd) => {
        const dx = px - cx, dy = py - cy;
        const d = Math.hypot(dx, dy);
        if (d > r * (1 + wob)) return false;
        const a = Math.atan2(dy, dx);
        const rr = r * (1 + (noise2(Math.cos(a) * 1.6 + sd, Math.sin(a) * 1.6 + sd * 0.7, sd | 0) - 0.5) * 2 * wob);
        return d <= rr;
      };
      /* fill a region, clipped by a test function inside(px,py) */
      const fillRegion = (cx, cy, r, layer, kind, inside) => {
        const det = p.detail;
        if (det < 0.05) return;
        if (kind === 1) {
          /* concentric wobble rings */
          const rings = Math.max(1, Math.round((r / (S * 0.16)) * det));
          for (let k = 1; k <= rings; k++) {
            const rr = r * (k / (rings + 1));
            const ring = blob(cx, cy, rr, 0.05, cx + cy + k * 7);
            if (ring.every(([x, y]) => inside(x, y))) push(ring, true, layer);
          }
        } else if (kind === 2) {
          /* stipple: denser toward center */
          const nd = Math.round(r * r * 0.07 * det);
          for (let i = 0; i < nd; i++) {
            const a = rng() * Math.PI * 2;
            const rr = Math.pow(rng(), 0.6) * r;
            const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
            if (!inside(px, py)) continue;
            const len = 0.35 + rng() * 0.7;
            const da = rng() * Math.PI;
            push([[px, py], [px + Math.cos(da) * len, py + Math.sin(da) * len]], false, layer);
          }
        } else {
          /* mosaic: jittered-grid cellular polygons, each tested against the region */
          const step = Math.max(1.1, S * 0.15 * (1.3 - det));
          for (let gy = -r; gy <= r; gy += step) {
            for (let gx = -r; gx <= r; gx += step) {
              const px = cx + gx + (rng() - 0.5) * step;
              const py = cy + gy + (rng() - 0.5) * step;
              if (!inside(px, py)) continue;
              if (rng() > det) continue;
              const cs = step * (0.26 + rng() * 0.2);
              const nn = 4 + Math.floor(rng() * 2);
              const cell = [];
              const rot = rng() * Math.PI;
              for (let i = 0; i < nn; i++) {
                const a = rot + (i / nn) * Math.PI * 2;
                cell.push([px + Math.cos(a) * cs, py + Math.sin(a) * cs]);
              }
              push(cell, true, layer);
            }
          }
        }
      };
      const penOf = (i) => i % NPENS;

      /* ---------- Rosettes / Colony ---------- */
      if (p.style === "Rosettes" || p.style === "Colony") {
        const placed = [];
        const area = (x1 - x0) * (y1 - y0);
        const tries = Math.round((area / (S * S)) * p.density * 4);
        for (let t = 0; t < tries; t++) {
          const r = S * (0.28 + sizeRoll() * 0.9);
          const pad = r * 1.15;
          if (x1 - x0 < pad * 2 || y1 - y0 < pad * 2) continue;
          const cx = x0 + pad + rng() * (x1 - x0 - pad * 2);
          const cy = y0 + pad + rng() * (y1 - y0 - pad * 2);
          let ok = true;
          for (const q of placed) {
            if (Math.hypot(cx - q[0], cy - q[1]) < (r + q[2]) * 0.9) { ok = false; break; }
          }
          if (!ok) continue;
          if (p.style === "Colony" && rng() > p.density) continue;
          placed.push([cx, cy, r]);
          const layer = penOf(Math.floor(rng() * NPENS));
          const wob = 0.1 + rng() * 0.08;
          const sd = (cx * 7 + cy * 13) % 997;
          const inside = (x, y) => inBlob(x, y, cx, cy, r, wob, sd);
          push(blob(cx, cy, r, wob, sd), true, layer);
          const kind = Math.floor(rng() * 3);
          if (p.style === "Rosettes") {
            /* target-lichen: pale rim (thin outer ring) + dark center on the crack/center pen */
            push(blob(cx, cy, r * 0.82, wob * 0.8, sd + 3), true, layer);
            fillRegion(cx, cy, r * 0.6, crackPen, kind === 1 ? 1 : 2, inside); /* dark textured center */
            if (rng() < 0.4) push(blob(cx, cy, r * 0.34, 0.08, sd + 9), true, crackPen);
          } else {
            fillRegion(cx, cy, r * 0.9, layer, kind, inside);
            if (rng() < 0.35) push(blob(cx, cy, r * 0.5, 0.1, sd + 5), true, crackPen);
          }
          if (total > BUDGET) break;
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---------- Map lichen ---------- */
      const sites = [];
      const nSites = Math.max(4, Math.round(((x1 - x0) * (y1 - y0)) / (S * S)));
      for (let i = 0; i < nSites; i++) {
        sites.push([
          x0 + rng() * (x1 - x0),
          y0 + rng() * (y1 - y0),
          penOf(Math.floor(rng() * NPENS)),
          rng(),                    /* bare-rock roll */
          Math.floor(rng() * 3)     /* fill kind */
        ]);
      }
      const cell = Math.max(1.0, S * 0.12);
      const cols = Math.min(340, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.min(460, Math.round((y1 - y0) / cell) + 1);
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const warp = 0.35 + p.crackWidth * 0.5;
      const idAt = (x, y) => {
        let best = Infinity, bi = -1;
        const wx = (noise2(x * 0.035, y * 0.035, p.seed) - 0.5) * warp;
        const wy = (noise2(x * 0.035 + 40, y * 0.035 + 40, p.seed) - 0.5) * warp;
        for (let i = 0; i < sites.length; i++) {
          const dx = x - sites[i][0], dy = y - sites[i][1];
          const d = (dx * dx + dy * dy) * (1 + wx) + dx * dy * wy;
          if (d < best) { best = d; bi = i; }
        }
        return bi;
      };
      const owner = new Int16Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) owner[r * cols + c] = idAt(gx(c), gy(r));

      /* borders as a set of edge segments, then chained into continuous cracks */
      const segKey = new Map(); /* "x,y" -> list of {to:"x,y"} adjacency for border edges */
      const q = (v) => Math.round(v * 4) / 4;
      const nodeKey = (x, y) => q(x) + "," + q(y);
      const addEdge = (ax, ay, bx, by) => {
        const ka = nodeKey(ax, ay), kb = nodeKey(bx, by);
        if (ka === kb) return;
        if (!segKey.has(ka)) segKey.set(ka, []);
        if (!segKey.has(kb)) segKey.set(kb, []);
        segKey.get(ka).push(kb);
        segKey.get(kb).push(ka);
      };
      /* a border runs between two cells that differ: emit the shared edge (a grid crossing) */
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const id = owner[r * cols + c];
          if (owner[r * cols + c + 1] !== id) {
            const x = (gx(c) + gx(c + 1)) / 2;
            addEdge(x, gy(r), x, gy(r + 1));
          }
          if (owner[(r + 1) * cols + c] !== id) {
            const y = (gy(r) + gy(r + 1)) / 2;
            addEdge(gx(c), y, gx(c + 1), y);
          }
        }
      }
      /* chain adjacency into polylines: walk from odd-degree/unused nodes */
      const coord = (k) => k.split(",").map(Number);
      const usedEdge = new Set();
      const ekey = (a, b) => a < b ? a + "|" + b : b + "|" + a;
      const walk = (start) => {
        const line = [start];
        let cur = start;
        while (true) {
          const nbrs = segKey.get(cur) || [];
          let nxt = null;
          for (const nb of nbrs) {
            if (!usedEdge.has(ekey(cur, nb))) { nxt = nb; break; }
          }
          if (!nxt) break;
          usedEdge.add(ekey(cur, nxt));
          line.push(nxt);
          cur = nxt;
        }
        return line;
      };
      if (p.crackWidth > 0.001) {
        for (const k of segKey.keys()) {
          if ((segKey.get(k) || []).length === 0) continue;
          let hasFree = false;
          for (const nb of segKey.get(k)) if (!usedEdge.has(ekey(k, nb))) { hasFree = true; break; }
          if (!hasFree) continue;
          const line = walk(k);
          if (line.length >= 3) push(line.map(coord), false, crackPen);
          if (total > BUDGET) break;
        }
      }

      /* fills: each site clipped to its OWN cell via the owner grid */
      const insideCell = (i) => (px, py) => {
        if (px < x0 || px > x1 || py < y0 || py > y1) return false;
        const c = Math.round(((px - x0) / (x1 - x0)) * (cols - 1));
        const r = Math.round(((py - y0) / (y1 - y0)) * (rows - 1));
        if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
        return owner[r * cols + c] === i;
      };
      for (let i = 0; i < sites.length; i++) {
        if (sites[i][3] > p.density) continue; /* bare rock */
        fillRegion(sites[i][0], sites[i][1], S * 0.85, sites[i][2], sites[i][4], insideCell(i));
        if (total > BUDGET) break;
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## lissajous.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "lissajous",
    name: "Lissajous", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "fx", label: "Freq X", type: "slider", min: 1, max: 16, step: 1, def: 3 },
      { key: "fy", label: "Freq Y", type: "slider", min: 1, max: 16, step: 1, def: 4 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 1.57 },
      { key: "turns", label: "Turns", type: "slider", min: 1, max: 60, step: 1, def: 8 },
      { key: "damp", label: "Damping", type: "slider", min: 0, max: 0.05, step: 0.001, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 1 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const Ax = W / 2 - p.margin, Ay = H / 2 - p.margin;
      const cx = W / 2, cy = H / 2;
      const N = Math.min(12000, Math.round(p.turns * 220));
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns * Math.PI * 2;
        const e = Math.exp(-p.damp * t);
        pts.push([cx + Ax * Math.sin(p.fx * t + p.phase) * e, cy + Ay * Math.sin(p.fy * t) * e]);
      }
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  
};
```

## lsystem.js

```js
import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "lsystem",
    name: "L-System", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "preset", label: "Preset", type: "select", options: ["Koch", "Dragon", "Plant", "Sierpinski", "Hilbert", "Lightning", "Custom"], def: "Plant" },
      { key: "axiom", label: "Axiom (custom)", type: "text", def: "F" },
      { key: "rules", label: "Rules (custom)", type: "text", def: "F=F+F--F+F" },
      { key: "iter", label: "Iterations / detail", type: "slider", min: 1, max: 8, step: 1, def: 4 },
      { key: "angle", label: "Angle ° (custom/branch)", type: "slider", min: 1, max: 120, step: 0.5, def: 60 },
      { key: "jitter", label: "Jitter / roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "branches", label: "Branches (lightning)", type: "slider", min: 0, max: 15, step: 1, def: 6 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 37 },
      { key: "layer", label: "Pen", type: "pen", def: 3 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1889 + 7);

      /* ---- Lightning: keskipiste-siirto + haarautuva salama ---- */
      if (p.preset === "Lightning") {
        const rough = Math.max(0.05, p.jitter || 0.35);
        const bolt = (x0, y0, x1, y1, detail) => {
          let pts = [[x0, y0], [x1, y1]];
          for (let d = 0; d < detail; d++) {
            const next = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
              const dx = b[0] - a[0], dy = b[1] - a[1];
              const len = Math.hypot(dx, dy) || 1;
              const off = (rng() - 0.5) * 2 * len * rough * 0.55;
              next.push([mx + (-dy / len) * off, my + (dx / len) * off]);
              next.push(b);
            }
            pts = next;
          }
          return pts;
        };
        const detail = Math.min(8, Math.max(3, Math.round(p.iter) + 2));
        const topX = W * (0.35 + rng() * 0.3);
        const botX = W * (0.25 + rng() * 0.5);
        const main = bolt(topX, p.margin, botX, H - p.margin, detail);
        const paths = [{ pts: main, closed: false, layer: Math.round(p.layer) }];
        const nBr = Math.round(p.branches);
        for (let b = 0; b < nBr; b++) {
          /* haara ylemmästä 2/3:sta, suunta paakolarin mukaan +- kulma */
          const i = 2 + Math.floor(rng() * (main.length * 0.66));
          if (i >= main.length - 1) continue;
          const S = main[i];
          const dx = main[i + 1][0] - main[i - 1][0], dy = main[i + 1][1] - main[i - 1][1];
          const base = Math.atan2(dy, dx);
          const sign = rng() > 0.5 ? 1 : -1;
          const a = base + sign * ((p.angle + (rng() - 0.5) * 20) * Math.PI) / 180;
          const len = (H - p.margin - S[1]) * (0.2 + rng() * 0.35);
          if (len < 5) continue;
          const E = [S[0] + Math.cos(a) * len, S[1] + Math.sin(a) * Math.abs(len)];
          const br = bolt(S[0], S[1], E[0], E[1], Math.max(2, detail - 2));
          paths.push({ pts: br, closed: false, layer: Math.round(p.layer) });
          /* pieni ala-haara puolella todennakoisyydella */
          if (rng() > 0.5 && br.length > 4) {
            const j = 1 + Math.floor(rng() * (br.length - 2));
            const S2 = br[j];
            const a2 = a + (rng() > 0.5 ? 1 : -1) * ((p.angle * 0.7) * Math.PI) / 180;
            const len2 = len * (0.25 + rng() * 0.3);
            if (len2 > 4) {
              const E2 = [S2[0] + Math.cos(a2) * len2, S2[1] + Math.sin(a2) * Math.abs(len2)];
              paths.push({ pts: bolt(S2[0], S2[1], E2[0], E2[1], Math.max(2, detail - 3)), closed: false, layer: Math.round(p.layer) });
            }
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---- tavalliset L-systeemit (jitter = stokastinen turtle) ---- */
      const PRESETS = {
        Koch: { axiom: "F", rules: "F=F+F--F+F", angle: 60 },
        Dragon: { axiom: "FX", rules: "X=X+YF+;Y=-FX-Y", angle: 90 },
        Plant: { axiom: "X", rules: "X=F+[[X]-X]-F[-FX]+X;F=FF", angle: 25 },
        Sierpinski: { axiom: "F-G-G", rules: "F=F-G+F+G-F;G=GG", angle: 120 },
        Hilbert: { axiom: "A", rules: "A=-BF+AFA+FB-;B=+AF-BFB-FA+", angle: 90 },
      };
      const cfg = p.preset === "Custom"
        ? { axiom: p.axiom || "F", rules: p.rules || "", angle: p.angle }
        : PRESETS[p.preset];
      const ruleMap = {};
      for (const r of String(cfg.rules).split(";")) {
        const [k, v] = r.split("=");
        if (k && v !== undefined) ruleMap[k.trim()] = v.trim();
      }
      let s = cfg.axiom;
      for (let i = 0; i < Math.round(p.iter); i++) {
        let next = "";
        for (const ch of s) next += ruleMap[ch] !== undefined ? ruleMap[ch] : ch;
        if (next.length > 200000) break;
        s = next;
      }
      const rad0 = (cfg.angle * Math.PI) / 180;
      let x = 0, y = 0, a = -Math.PI / 2;
      const stack = [];
      const rawPaths = [];
      let cur = [[0, 0]];
      for (const ch of s) {
        if (ch === "F" || ch === "G") {
          const step = 1 + (p.jitter ? (rng() - 0.5) * p.jitter * 0.7 : 0);
          x += Math.cos(a) * step; y += Math.sin(a) * step;
          cur.push([x, y]);
        } else if (ch === "f") {
          if (cur.length > 1) rawPaths.push(cur);
          x += Math.cos(a); y += Math.sin(a);
          cur = [[x, y]];
        } else if (ch === "+" || ch === "-") {
          const jit = p.jitter ? 1 + (rng() - 0.5) * 2 * p.jitter : 1;
          a += (ch === "+" ? 1 : -1) * rad0 * jit;
        } else if (ch === "[") stack.push([x, y, a]);
        else if (ch === "]") {
          if (cur.length > 1) rawPaths.push(cur);
          const st = stack.pop();
          if (st) { x = st[0]; y = st[1]; a = st[2]; }
          cur = [[x, y]];
        }
      }
      if (cur.length > 1) rawPaths.push(cur);
      if (!rawPaths.length) return EMPTY;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pa of rawPaths) for (const [px, py] of pa) {
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const paths = rawPaths.map((pa) => ({
        pts: pa.map(([px, py]) => [px * sc + ox, py * sc + oy]),
        closed: false, layer: Math.round(p.layer),
      }));
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## magnet.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "magnet",
    name: "Magnet", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "px", label: "Point X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Point Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "radius", label: "Radius mm", type: "slider", min: 5, max: 250, step: 1, def: 70 },
      { key: "strength", label: "Strength mm (− attract)", type: "slider", min: -40, max: 40, step: 0.5, def: 12 },
      { key: "falloff", label: "Falloff", type: "select", options: ["Linear", "Smooth"], def: "Smooth" },
    ],
    overlay(p) {
      return [{ kind: "circle", cx: p.px, cy: p.py, r: p.radius }, { kind: "point", x: p.px, y: p.py }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const dx = x - p.px, dy = y - p.py;
          const d = Math.hypot(dx, dy);
          if (d >= p.radius || d < 0.001) return [x, y];
          let t = 1 - d / p.radius;
          if (p.falloff === "Smooth") t = t * t * (3 - 2 * t);
          const f = p.strength * t;
          return [x + (dx / d) * f, y + (dy / d) * f];
        }),
      }));
      return { paths };
    },
  
};
```

## mask.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "mask",
    name: "Mask", cat: "duo", ins: [Pin("paths", "Target"), Pin("paths", "Mask")], outs: [Pin("paths")],
    params: [{ key: "keep", label: "Keep", type: "select", options: ["Outside", "Inside"], def: "Outside" }],
    compute(ins, p) {
      const src = ins[0] || EMPTY, msk = ins[1] || EMPTY;
      if (!msk.paths.length) return src;
      const wantInside = p.keep === "Inside";
      const paths = [];
      for (const path of src.paths) {
        const pts = resample(path.pts, path.closed, 1.5);
        let run = [];
        for (const pt of pts) {
          const keep = pointInMask(msk, pt[0], pt[1]) === wantInside;
          if (keep) run.push(pt);
          else if (run.length > 1) { paths.push({ pts: run, closed: false, layer: path.layer }); run = []; }
          else run = [];
        }
        if (run.length > 1) paths.push({ pts: run, closed: false, layer: path.layer });
      }
      return { paths };
    },
  
};
```

## matem.js

```js
import { Pin } from "../helpers.js";

export default {
  key: "matem",
    name: "Math", cat: "math", ins: [Pin("value", "A"), Pin("value", "B")], outs: [Pin("value")],
    params: [
      { key: "op", label: "Operation", type: "select", options: ["A + B", "A − B", "A × B", "A ÷ B", "min", "max", "A ^ B", "A mod B"], def: "A + B" },
      { key: "a", label: "A (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 1 },
      { key: "b", label: "B (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 1 },
    ],
    compute(ins, p) {
      const A = typeof ins[0] === "number" ? ins[0] : p.a;
      const B = typeof ins[1] === "number" ? ins[1] : p.b;
      switch (p.op) {
        case "A + B": return A + B;
        case "A − B": return A - B;
        case "A × B": return A * B;
        case "A ÷ B": return B === 0 ? 0 : A / B;
        case "min": return Math.min(A, B);
        case "max": return Math.max(A, B);
        case "A ^ B": return Math.pow(A, B);
        case "A mod B": return B === 0 ? 0 : A % B;
        default: return A;
      }
    },
  
};
```

## mathknot.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "mathknot",
  name: "Knot",
  cat: "gen",
  group: "geometric",
  desc: "A torus knot p·q drawn flat with real over/under crossings: at every planar self-intersection the strand that passes underneath is cut with a gap, so the knot reads as woven. p and q set the winding frequencies (coprime values give true knots), Tube the torus thickness.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "fp", label: "p (freq 1)", type: "slider", min: 1, max: 12, step: 1, def: 2 },
    { key: "fq", label: "q (freq 2)", type: "slider", min: 1, max: 12, step: 1, def: 3 },
    { key: "tube", label: "Tube", type: "slider", min: 0.1, max: 0.9, step: 0.05, def: 0.5 },
    { key: "gap", label: "Crossing gap mm", type: "slider", min: 0, max: 8, step: 0.1, def: 2.2 },
    { key: "step", label: "Sample step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
    { key: "rot", label: "Rotate °", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const m = Math.max(0, p.margin);
    const availW = W - 2 * m, availH = H - 2 * m;
    if (availW < 10 || availH < 10) return applyStyle({ paths: [] }, ins[0]);

    const fp = Math.max(1, Math.min(12, Math.round(p.fp)));
    const fq = Math.max(1, Math.min(12, Math.round(p.fq)));
    const tube = Math.max(0.05, Math.min(0.95, p.tube));
    const step = Math.max(0.25, p.step);
    const n = Math.max(240, Math.min(1600, Math.round(720 / step)));
    const TWO = Math.PI * 2;

    /* --- sample the 3D curve --- */
    const rr = p.rot * Math.PI / 180;
    const cr = Math.cos(rr), sr = Math.sin(rr);
    const xs = new Float64Array(n), ys = new Float64Array(n), zs = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * TWO;
      const rad = 1 + tube * Math.cos(fq * t);
      const x = rad * Math.cos(fp * t);
      const y = rad * Math.sin(fp * t);
      const z = tube * Math.sin(fq * t);
      xs[i] = x * cr - y * sr;
      ys[i] = x * sr + y * cr;
      zs[i] = z;
    }

    /* --- fit to canvas --- */
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (let i = 0; i < n; i++) {
      if (xs[i] < bx0) bx0 = xs[i]; if (xs[i] > bx1) bx1 = xs[i];
      if (ys[i] < by0) by0 = ys[i]; if (ys[i] > by1) by1 = ys[i];
    }
    const bw = (bx1 - bx0) || 1, bh = (by1 - by0) || 1;
    const sc = Math.min(availW / bw, availH / bh);
    const ox = m + (availW - bw * sc) / 2 - bx0 * sc;
    const oy = m + (availH - bh * sc) / 2 - by0 * sc;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([xs[i] * sc + ox, ys[i] * sc + oy]);

    /* --- arc-length table --- */
    const segLen = new Float64Array(n);
    const cum = new Float64Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      cum[i] = total;
      const j = (i + 1) % n;
      segLen[i] = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
      total += segLen[i];
    }
    if (total < 2) return applyStyle({ paths: [] }, ins[0]);

    /* --- find planar self-intersections, cut the strand that is UNDER --- */
    const gapHalf = Math.max(0, p.gap) / 2;
    const cuts = [];
    if (gapHalf > 0.01) {
      for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;
        const ax = pts[i][0], ay = pts[i][1];
        const bx = pts[i2][0], by = pts[i2][1];
        const ix0 = Math.min(ax, bx), ix1 = Math.max(ax, bx);
        const iy0 = Math.min(ay, by), iy1 = Math.max(ay, by);
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue; /* adjacent around the wrap */
          const j2 = (j + 1) % n;
          const cx = pts[j][0], cy = pts[j][1];
          const dx = pts[j2][0], dy = pts[j2][1];
          /* bbox reject */
          if (Math.max(cx, dx) < ix0 || Math.min(cx, dx) > ix1) continue;
          if (Math.max(cy, dy) < iy0 || Math.min(cy, dy) > iy1) continue;
          const rX = bx - ax, rY = by - ay;
          const sX = dx - cx, sY = dy - cy;
          const den = rX * sY - rY * sX;
          if (Math.abs(den) < 1e-12) continue;
          const qpX = cx - ax, qpY = cy - ay;
          const t = (qpX * sY - qpY * sX) / den;
          const u = (qpX * rY - qpY * rX) / den;
          if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
          const za = zs[i] + (zs[i2] - zs[i]) * t;
          const zb = zs[j] + (zs[j2] - zs[j]) * u;
          if (Math.abs(za - zb) < 1e-9) continue; /* grazing: leave uncut */
          const s = za < zb ? cum[i] + t * segLen[i] : cum[j] + u * segLen[j];
          cuts.push(s);
        }
      }
    }

    if (!cuts.length) {
      return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);
    }

    /* --- drop vertices within gap/2 (arc distance) of each under-cut --- */
    const kept = new Uint8Array(n).fill(1);
    const circD = (a, b) => {
      let d = Math.abs(a - b);
      return Math.min(d, total - d);
    };
    for (const s of cuts) {
      /* binary search: lo = last vertex with cum <= s */
      let lo = 0, hi = n - 1;
      if (cum[hi] <= s) { lo = hi; hi = 0; }
      else {
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1;
          if (cum[mid] <= s) lo = mid; else hi = mid;
        }
      }
      /* walk forward from the vertex after s */
      let j = (lo + 1) % n, guard = 0;
      while (guard++ < n && circD(cum[j], s) < gapHalf) { kept[j] = 0; j = (j + 1) % n; }
      /* walk backward from the vertex before/at s */
      j = lo; guard = 0;
      while (guard++ < n && circD(cum[j], s) < gapHalf) { kept[j] = 0; j = (j - 1 + n) % n; }
    }

    /* --- collect circular runs of kept vertices --- */
    let allKept = true, noneKept = true;
    for (let i = 0; i < n; i++) {
      if (kept[i]) noneKept = false; else allKept = false;
    }
    if (noneKept) return applyStyle({ paths: [] }, ins[0]);
    if (allKept) return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);

    const paths = [];
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      if (!kept[i] || kept[prev]) continue; /* run starts where prev was cut */
      const run = [];
      let j = i, guard = 0;
      while (kept[j] && guard <= n) {
        run.push(pts[j].slice());
        j = (j + 1) % n; guard++;
      }
      if (run.length >= 2) paths.push({ pts: run, closed: false, layer: L });
    }
    return applyStyle({ paths }, ins[0]);
  },
};
```

## merge.js

```js
import { Pin, EMPTY, PENS } from "../helpers.js";

export default {
  key: "merge",
    name: "Merge", cat: "duo",
    ins: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 2 }, (_, i) => Pin("paths", String(i + 1))),
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Inputs", type: "slider", min: 2, max: 6, step: 1, def: 2 },
      { key: "penPer", label: "Pen change per input", type: "check", def: false },
    ],
    compute(ins, p) {
      const paths = [];
      for (let i = 0; i < Math.round(p.count); i++) {
        const src = ins[i] || EMPTY;
        if (!src.paths) continue;
        for (const path of src.paths) paths.push(p.penPer ? { ...path, layer: i % PENS.length } : path);
      }
      return { paths };
    },
  
};
```

## mesh.js

```js
import { Pin, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "mesh",
    name: "Mesh", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Cols", type: "slider", min: 2, max: 40, step: 1, def: 14 },
      { key: "rows", label: "Rows", type: "slider", min: 2, max: 40, step: 1, def: 10 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 20, step: 0.25, def: 4 },
      { key: "diag", label: "Diagonals", type: "select", options: ["None", "\\", "/", "Alternating", "Random"], def: "Alternating" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 25 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cols = Math.round(p.cols), rows = Math.round(p.rows);
      const rng = mulberry32(p.seed * 577 + 11);
      const pts = [];
      for (let j = 0; j <= rows; j++) {
        const row = [];
        for (let i = 0; i <= cols; i++) {
          const edge = i === 0 || j === 0 || i === cols || j === rows;
          const jx = edge ? 0 : (rng() - 0.5) * 2 * p.jit;
          const jy = edge ? 0 : (rng() - 0.5) * 2 * p.jit;
          row.push([
            p.margin + ((W - 2 * p.margin) * i) / cols + jx,
            p.margin + ((H - 2 * p.margin) * j) / rows + jy,
          ]);
        }
        pts.push(row);
      }
      const paths = [];
      const L = Math.round(p.layer);
      for (let j = 0; j <= rows; j++) paths.push({ pts: pts[j].map((q) => q.slice()), closed: false, layer: L });
      for (let i = 0; i <= cols; i++) paths.push({ pts: pts.map((row) => row[i].slice()), closed: false, layer: L });
      if (p.diag !== "None") {
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          let d = p.diag;
          if (d === "Alternating") d = (i + j) % 2 === 0 ? "\\" : "/";
          else if (d === "Random") d = hash2(i, j, p.seed + 3) > 0.5 ? "\\" : "/";
          paths.push(d === "\\"
            ? { pts: [pts[j][i].slice(), pts[j + 1][i + 1].slice()], closed: false, layer: L }
            : { pts: [pts[j][i + 1].slice(), pts[j + 1][i].slice()], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## metaballs.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "metaballs",
    name: "Metaballs",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "blobs", label: "Blobs", type: "slider", min: 2, max: 30, step: 1, def: 6 },
      { key: "size", label: "Blob size mm", type: "slider", min: 5, max: 60, step: 1, def: 22 },
      { key: "spread", label: "Spread", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.55 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 5, step: 1, def: 2 },
      { key: "cell", label: "Cell mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 29 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const L = Math.round(p.layer);
      const NB = Math.max(1, Math.min(40, Math.round(p.blobs)));
      const rng = mulberry32(p.seed * 8837 + 5);
      const cx = W / 2, cy = H / 2;
      const rx = (x1 - x0) / 2 * p.spread, ry = (y1 - y0) / 2 * p.spread;
      const blobs = [];
      for (let i = 0; i < NB; i++) {
        blobs.push({
          x: cx + (rng() * 2 - 1) * rx,
          y: cy + (rng() * 2 - 1) * ry,
          r: Math.max(2, p.size) * (0.55 + rng() * 0.9)
        });
      }
      const field = (x, y) => {
        let v = 0;
        for (const b of blobs) {
          const dx = x - b.x, dy = y - b.y;
          v += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        return v;
      };
      const cell = Math.max(0.8, p.cell);
      const cols = Math.max(2, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.max(2, Math.round((y1 - y0) / cell) + 1);
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = field(gx(c), gy(r));
      const segs = [];
      const NBands = Math.max(1, Math.min(6, Math.round(p.bands)));
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let bi = 0; bi < NBands; bi++) {
        const lvl = 1 * Math.pow(1.6, bi); /* nested iso levels */
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segs.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      /* stitch segments into contour loops */
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s, i) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## minicanvas.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "minicanvas",
    name: "Mini Canvas",
    cat: "duo",
    desc: "Lays out miniatures of full-canvas compositions on one sheet. Auto grid packs each wired input (A-F) into its own cell - a contact sheet. Fixed size makes production runs: set one mini size (e.g. postcard 148 x 105) and a count, and copies fill the sheet, cycling through the wired inputs. L cut marks at every mini's corners and T fold marks (position in mm from the card's left/top edge, vertical/horizontal/both) go on their own Mark pen - plot them in pencil and erase after cutting. Fit preserves aspect; Stretch fills.",
    ins: [Pin("paths", "A"), Pin("paths", "B"), Pin("paths", "C"), Pin("paths", "D"), Pin("paths", "E"), Pin("paths", "F")],
    outs: [Pin("paths")],
    params: [
      { key: "layout", label: "Layout", type: "select", options: ["Auto grid", "Fixed size"], def: "Auto grid" },
      { key: "miniW", label: "Mini width mm", type: "slider", min: 20, max: 400, step: 1, def: 148 },
      { key: "miniH", label: "Mini height mm", type: "slider", min: 20, max: 400, step: 1, def: 105 },
      { key: "count", label: "Copies (Fixed)", type: "slider", min: 1, max: 64, step: 1, def: 12 },
      { key: "cols", label: "Columns (Auto)", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "mode", label: "Scaling", type: "select", options: ["Fit", "Stretch"], def: "Fit" },
      { key: "cutMarks", label: "L cut marks", type: "check", def: false },
      { key: "fold", label: "T fold marks", type: "select", options: ["None", "Vertical", "Horizontal", "Both"], def: "None" },
      { key: "foldMM", label: "Fold at mm (from left/top)", type: "slider", min: 1, max: 400, step: 0.5, def: 74 },
      { key: "markPen", label: "Mark pen (pencil)", type: "pen", def: 1 },
      { key: "frames", label: "Cell frames", type: "check", def: false },
      { key: "framepen", label: "Frame pen", type: "pen", def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const wired = [];
      for (let i = 0; i < 6; i++) if (ins[i] && ins[i].paths) wired.push(ins[i]);
      if (!wired.length) return EMPTY;
      const m = Math.max(0, p.margin);
      const gap = Math.max(0, p.gap);
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const emit = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        out.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      /* place one composition into cell (cx0,cy0,cw,ch) */
      const place = (src, cx0, cy0, cw, ch) => {
        let sx = cw / W, sy = ch / H, ox = cx0, oy = cy0;
        if (p.mode === "Fit") {
          const s = Math.min(sx, sy);
          ox = cx0 + (cw - W * s) / 2;
          oy = cy0 + (ch - H * s) / 2;
          sx = sy = s;
        }
        for (const pa of src.paths) {
          emit(pa.pts.map(([x, y]) => [ox + x * sx, oy + y * sy]), pa.closed, pa.layer);
        }
      };
      const mk = Math.round(p.markPen);
      const ML = 5; /* mark stroke mm */
      const cellMarks = (x0, y0, cw, ch) => {
        if (p.frames) {
          emit([[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]], true, Math.round(p.framepen));
        }
        if (p.cutMarks) {
          const L2 = Math.min(ML, cw / 3, ch / 3);
          for (const [cx, cy, dx, dy] of [
            [x0, y0, 1, 1], [x0 + cw, y0, -1, 1],
            [x0 + cw, y0 + ch, -1, -1], [x0, y0 + ch, 1, -1]
          ]) {
            emit([[cx, cy], [cx + dx * L2, cy]], false, mk);
            emit([[cx, cy], [cx, cy + dy * L2]], false, mk);
          }
        }
        if (p.fold !== "None") {
          const T = Math.min(4, cw / 4, ch / 4);
          const tee = (cx, cy, inward) => { /* crossbar along edge + stem inward */
            if (inward === "down" || inward === "up") {
              emit([[cx - T, cy], [cx + T, cy]], false, mk);
              emit([[cx, cy], [cx, cy + (inward === "down" ? T : -T)]], false, mk);
            } else {
              emit([[cx, cy - T], [cx, cy + T]], false, mk);
              emit([[cx, cy], [cx + (inward === "right" ? T : -T), cy]], false, mk);
            }
          };
          if (p.fold === "Vertical" || p.fold === "Both") {
            const fx = x0 + Math.min(Math.max(p.foldMM, 1), cw - 1);
            tee(fx, y0, "down");
            tee(fx, y0 + ch, "up");
          }
          if (p.fold === "Horizontal" || p.fold === "Both") {
            const fy = y0 + Math.min(Math.max(p.foldMM, 1), ch - 1);
            tee(x0, fy, "right");
            tee(x0 + cw, fy, "left");
          }
        }
      };

      if (p.layout === "Fixed size") {
        const mw = Math.max(5, p.miniW), mh = Math.max(5, p.miniH);
        const cols = Math.max(1, Math.floor((W - 2 * m + gap) / (mw + gap)));
        const rows = Math.max(1, Math.floor((H - 2 * m + gap) / (mh + gap)));
        const cap = cols * rows;
        const n = Math.min(Math.round(p.count), cap);
        const usedCols = Math.min(cols, n);
        const usedRows = Math.ceil(n / cols);
        const blockW = usedCols * mw + (usedCols - 1) * gap;
        const blockH = usedRows * mh + (usedRows - 1) * gap;
        const bx = m + (W - 2 * m - blockW) / 2;
        const by = m + (H - 2 * m - blockH) / 2;
        for (let i = 0; i < n; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          const x0 = bx + c * (mw + gap), y0 = by + r * (mh + gap);
          place(wired[i % wired.length], x0, y0, mw, mh);
          cellMarks(x0, y0, mw, mh);
        }
        return { paths: out };
      }
      /* Auto grid: each wired input its own cell (original behavior) */
      const cols = Math.max(1, Math.min(6, Math.round(p.cols)));
      const rows = Math.ceil(wired.length / cols);
      const cw = (W - 2 * m - (cols - 1) * gap) / cols;
      const ch = (H - 2 * m - (rows - 1) * gap) / rows;
      if (cw <= 2 || ch <= 2) return EMPTY;
      for (let i = 0; i < wired.length; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x0 = m + c * (cw + gap), y0 = m + r * (ch + gap);
        place(wired[i], x0, y0, cw, ch);
        cellMarks(x0, y0, cw, ch);
      }
      return { paths: out };
    }
  
};
```

## mirror8.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "mirror8",
      name: "Mirror",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Left-right (2)", "Up-down (2)", "Quad (4)", "8-way (8)"], def: "Left-right (2)" },
      { key: "cx", label: "Mirror X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Mirror Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    overlay(p, ctx) {
      const LEN = (ctx.W + ctx.H);
      const axis = (aDeg) => {
        const a = (aDeg * Math.PI) / 180;
        const dx = Math.cos(a) * LEN, dy = Math.sin(a) * LEN;
        return { kind: "poly", pts: [[p.cx - dx, p.cy - dy], [p.cx + dx, p.cy + dy]] };
      };
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.mode === "Left-right (2)") g.push(axis(90));
      else if (p.mode === "Up-down (2)") g.push(axis(0));
      else if (p.mode === "Quad (4)") g.push(axis(0), axis(90));
      else g.push(axis(0), axis(45), axis(90), axis(135));
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* muunnokset keskipisteen ymparilla:
         heijastus suoran (kulma a) yli: M = [[cos2a, sin2a],[sin2a,-cos2a]] */
      const refl = (aDeg) => {
        const a2 = (2 * aDeg * Math.PI) / 180;
        const c = Math.cos(a2), s = Math.sin(a2);
        return ([x, y]) => [c * x + s * y, s * x - c * y];
      };
      const rot = (aDeg) => {
        const a = (aDeg * Math.PI) / 180;
        const c = Math.cos(a), s = Math.sin(a);
        return ([x, y]) => [c * x - s * y, s * x + c * y];
      };
      const I = ([x, y]) => [x, y];
      let T;
      if (p.mode === "Left-right (2)") T = [I, refl(90)];
      else if (p.mode === "Up-down (2)") T = [I, refl(0)];
      else if (p.mode === "Quad (4)") T = [I, refl(0), refl(90), rot(180)];
      else T = [I, rot(90), rot(180), rot(270), refl(0), refl(45), refl(90), refl(135)];
      const paths = [];
      for (const f of T) {
        for (const path of src.paths) {
          paths.push({
            ...path,
            pts: path.pts.map(([x, y]) => {
              const [nx, ny] = f([x - p.cx, y - p.cy]);
              return [nx + p.cx, ny + p.cy];
            }),
          });
        }
      }
      return { paths };
    }
  
};
```

## mooncraters.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "mooncraters",
    name: "Moon Craters",
    cat: "gen",
    group: "nature",
    desc: "Cratered lunar terrain from a heightfield of bowl-and-rim craters (natural size mix). Top view draws rim and floor outlines or a relief-displaced mesh; 3D view looks across the plain to a horizon (not a sphere) - rotate with Yaw, raise the camera with Pitch. 3D Mesh uses classic silhouette occlusion (near ridges hide far ones); 3D Outlines drapes the crater rings over the terrain.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "view", label: "View", type: "select", options: ["Top", "3D"], def: "Top" },
      { key: "style", label: "Style", type: "select", options: ["Outlines", "Mesh"], def: "Mesh" },
      { key: "craters", label: "Craters", type: "slider", min: 3, max: 60, step: 1, def: 18 },
      { key: "size", label: "Max crater mm", type: "slider", min: 8, max: 70, step: 1, def: 34 },
      { key: "depth", label: "Relief", type: "slider", min: 0.1, max: 1.5, step: 0.05, def: 0.7 },
      { key: "density", label: "Mesh density", type: "slider", min: 0.3, max: 1, step: 0.05, def: 0.6 },
      { key: "yaw", label: "Yaw deg (wire Frame)", type: "slider", min: 0, max: 360, step: 1, def: 20 },
      { key: "pitch", label: "Pitch deg (3D)", type: "slider", min: 8, max: 55, step: 1, def: 20 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 11 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 5077 + 29);
      const L = Math.round(p.layer);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer: L
        });
      };
      /* terrain: square patch side S in model units, craters with bowl + raised rim */
      const S = Math.max(bw, bh);
      const craters = [];
      const NC = Math.round(p.craters);
      for (let i = 0; i < NC; i++) {
        const R = (p.size / 2) * (0.18 + Math.pow(rng(), 1.8) * 0.82);
        craters.push({
          x: (rng() - 0.5) * S * 0.92,
          y: (rng() - 0.5) * S * 0.92,
          R, d: R * 0.5
        });
      }
      const heightAt = (x, y) => {
        let h = (noise2(x * 0.02 + 30, y * 0.02 + 30, p.seed) - 0.5) * p.size * 0.12; /* gentle rolling base */
        for (const c of craters) {
          const r = Math.hypot(x - c.x, y - c.y);
          if (r < c.R) h += c.d * ((r / c.R) * (r / c.R) - 1);        /* parabolic bowl */
          const dr = (r - c.R) / (c.R * 0.22);
          if (dr > -3 && dr < 3) h += c.d * 0.35 * Math.exp(-dr * dr); /* raised rim */
        }
        return h * p.depth;
      };
      const circle3 = (cx, cy, r, nn) => {
        const c = [];
        for (let k = 0; k < nn; k++) {
          const a = (k / nn) * Math.PI * 2;
          c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return c;
      };

      if (p.view === "Top") {
        const fit = ([x, y]) => [m + ((x / S) + 0.5) * bw, m + ((y / S) + 0.5) * bh];
        if (p.style === "Outlines") {
          for (const c of craters) {
            const nn = Math.max(12, Math.round(c.R * 1.6));
            push(circle3(c.x, c.y, c.R, nn).map(fit), true);            /* rim crest */
            push(circle3(c.x, c.y, c.R * 0.55, nn).map(fit), true);     /* floor */
            if (c.R > p.size * 0.28) push(circle3(c.x, c.y, c.R * 0.8, nn).map(fit), true); /* terrace */
          }
        } else {
          /* relief-displaced mesh: grid lines pushed by the height gradient */
          const n = Math.round(26 + p.density * 44);
          const eps = S / n;
          const disp = (x, y) => {
            const gx = (heightAt(x + eps, y) - heightAt(x - eps, y)) / (2 * eps);
            const gy = (heightAt(x, y + eps) - heightAt(x, y - eps)) / (2 * eps);
            const k = S * 0.045;
            return [x + gx * k, y + gy * k];
          };
          for (let r = 0; r <= n; r++) {
            const row = [];
            for (let c2 = 0; c2 <= n; c2++) row.push(fit(disp(-S / 2 + (c2 / n) * S, -S / 2 + (r / n) * S)));
            push(row, false);
          }
          for (let c2 = 0; c2 <= n; c2++) {
            const col = [];
            for (let r = 0; r <= n; r++) col.push(fit(disp(-S / 2 + (c2 / n) * S, -S / 2 + (r / n) * S)));
            push(col, false);
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---- 3D: look across the plain to the horizon ---- */
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      const rowSpread = S * 0.62 * Math.min(1, Math.max(0.15, Math.tan(pa2)) * 1.2);
      const hMul = 1.2 + p.depth * 1.6;
      const nRows = Math.round(28 + p.density * 42);
      const nCols = Math.round(60 + p.density * 60);
      /* precompute projected rows near->far */
      const rowsP = [];
      for (let r = 0; r <= nRows; r++) {
        const y = -S / 2 + (r / nRows) * S;     /* model y; will be depth after yaw... sample in ROTATED space */
        const row = [];
        for (let c2 = 0; c2 <= nCols; c2++) {
          const x = -S / 2 + (c2 / nCols) * S;
          /* sample terrain in world coords rotated INTO view: inverse-rotate view grid */
          const wx = x * cy2 - y * sy2;
          const wy = x * sy2 + y * cy2;
          const h = heightAt(wx, wy);
          const t = (y / S + 0.5);
          const persp = 1 / (0.55 + t * 1.6 * (0.35 / Math.max(0.15, Math.tan(pa2))));
          row.push([x * persp, -t * rowSpread - h * persp * hMul, t]);
        }
        rowsP.push(row);
      }
      /* fit to box */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const row of rowsP) for (const [x, y] of row) {
        if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const toScreen = ([x, y]) => [x * sc + ox, y * sc + oy];

      if (p.style === "Mesh") {
        /* silhouette occlusion, near rows drawn first hide far rows */
        const BK = 900;
        const minY = new Float32Array(BK).fill(Infinity);
        const bucket = (x) => Math.max(0, Math.min(BK - 1, Math.round(((x - (fx0 * sc + ox)) / ((fx1 - fx0) * sc || 1)) * (BK - 1))));
        for (let r = 0; r < rowsP.length; r++) {
          const row = rowsP[r].map(toScreen);
          /* visibility against the silhouette of nearer rows */
          let run = [];
          for (const q of row) {
            if (q[1] < minY[bucket(q[0])] - 0.15) run.push(q);
            else {
              if (run.length > 1) push(run, false);
              run = [];
            }
          }
          if (run.length > 1) push(run, false);
          /* rasterize this row's FULL profile into the silhouette (it is in front of all later rows) */
          for (let i = 1; i < row.length; i++) {
            const b0 = bucket(row[i - 1][0]), b1 = bucket(row[i][0]);
            const lo2 = Math.min(b0, b1), hi2 = Math.max(b0, b1);
            for (let b = lo2; b <= hi2; b++) {
              const t2 = hi2 > lo2 ? (b - b0) / (b1 - b0 || 1) : 0;
              const yv = row[i - 1][1] + (row[i][1] - row[i - 1][1]) * Math.max(0, Math.min(1, t2));
              if (yv < minY[b]) minY[b] = yv;
            }
          }
        }
      } else {
        /* Outlines: crater rim + floor rings draped over the terrain, plus the horizon line */
        const drape = (cx0, cy0, r) => {
          const nn = Math.max(16, Math.round(r * 2));
          const ring = [];
          for (let k = 0; k <= nn; k++) {
            const a = (k / nn) * Math.PI * 2;
            const wx = cx0 + Math.cos(a) * r, wy = cy0 + Math.sin(a) * r;
            /* world -> view rotated coords */
            const vx = wx * cy2 + wy * sy2;
            const vy = -wx * sy2 + wy * cy2;
            if (vy < -S / 2 || vy > S / 2 || vx < -S / 2 || vx > S / 2) { if (ring.length > 1) { push(ring.map(toScreen), false); ring.length = 0; } continue; }
            const t = (vy / S + 0.5);
            const persp = 1 / (0.55 + t * 1.6 * (0.35 / Math.max(0.15, Math.tan(pa2))));
            const h = heightAt(wx, wy);
            ring.push([vx * persp, -t * rowSpread - h * persp * hMul]);
          }
          if (ring.length > 1) push(ring.map(toScreen), false);
        };
        for (const c of craters) {
          drape(c.x, c.y, c.R);
          drape(c.x, c.y, c.R * 0.55);
        }
        /* horizon = far edge row */
        push(rowsP[rowsP.length - 1].map(toScreen), false);
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## mountains.js

```js
import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "mountains",
    name: "Mountains", cat: "gen", group: "nature", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "rows", label: "Ridge lines", type: "slider", min: 8, max: 90, step: 1, def: 36 },
      { key: "height", label: "Height mm", type: "slider", min: 5, max: 150, step: 1, def: 55 },
      { key: "depth", label: "Depth mm", type: "slider", min: 20, max: 300, step: 1, def: 110 },
      { key: "scale", label: "Terrain scale", type: "slider", min: 0.004, max: 0.06, step: 0.001, def: 0.015 },
      { key: "octaves", label: "Octaves", type: "slider", min: 1, max: 5, step: 1, def: 4 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "skew", label: "Skew mm (oblique)", type: "slider", min: -80, max: 80, step: 1, def: 0 },
      { key: "fade", label: "Fade edges (island)", type: "check", def: true },
      { key: "cross", label: "Cross lines (mesh)", type: "check", def: false },
      { key: "res", label: "Resolution mm", type: "slider", min: 0.5, max: 4, step: 0.25, def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 51 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rows = Math.round(p.rows);
      const x0 = p.margin + Math.max(0, -p.skew), x1 = W - p.margin - Math.max(0, p.skew);
      const width = x1 - x0;
      if (width < 10) return EMPTY;
      const nx = Math.max(8, Math.floor(width / Math.max(0.4, p.res)));
      const oct = Math.round(p.octaves);
      const fbm = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < oct; o++) {
          v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
          tot += amp; amp *= 0.5; fq *= 2;
        }
        return v / tot;
      };
      const baseY = H - p.margin - 2;
      const L = Math.round(p.layer);
      const centerX = (x0 + x1) / 2;
      /* korkeus + reunahaivytys */
      const hAt = (u, rowT) => {
        let h = fbm(u * width * 2, rowT * p.depth * 2);
        h = Math.pow(h, 1.3);
        if (p.fade) {
          const ex = Math.min(1, Math.min(u, 1 - u) * 5);
          const ey = Math.min(1, Math.min(rowT, 1 - rowT) * 5);
          h *= ex * ex * (3 - 2 * ex) * (ey * ey * (3 - 2 * ey));
        }
        return h * p.height;
      };
      /* perspektiivi: rivit kapenevat ja tihenevat syvyyteen */
      const rowScale = (t) => 1 - 0.62 * p.persp * t;
      const rowYOff = (t) => p.depth * (t / (1 + p.persp * t * 1.15));
      /* piilotettu viiva: horisonttipuskuri RUUDUN x-sarakkeittain
         (toimii myos skew + perspektiivi -siirtymilla) */
      const binW = Math.max(0.4, p.res);
      const nBins = Math.ceil(W / binW) + 2;
      const horizon = new Array(nBins).fill(Infinity);
      const binOf = (sx) => Math.max(0, Math.min(nBins - 1, Math.round(sx / binW)));
      const rowPts = [];
      const paths = [];
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        const rowT = rIdx / Math.max(1, rows - 1);       /* 0 = edessa */
        const rs = rowScale(rowT);
        const sy0 = baseY - rowYOff(rowT);
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        const rowRec = [];
        for (let i = 0; i <= nx; i++) {
          const u = i / nx;
          const sx = centerX + (u - 0.5) * width * rs + p.skew * rowT;
          const sy = sy0 - hAt(u, rowT) * rs;
          const b = binOf(sx);
          const vis = sy < horizon[b] - 0.05;
          rowRec.push([sx, sy, vis]);
          if (vis) {
            run.push([sx, sy]);
            if (sy < horizon[b]) horizon[b] = sy;
          } else flush();
        }
        flush();
        rowPts.push(rowRec);
      }
      if (p.cross) {
        for (let i = 0; i <= nx; i += Math.max(2, Math.round(nx / 60))) {
          let run = [];
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (let rIdx = 0; rIdx < rows; rIdx++) {
            const [sx, sy, vis] = rowPts[rIdx][i];
            if (vis) run.push([sx, sy]);
            else flush();
          }
          flush();
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## move_scale.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "move_scale",
      name: "Move / Scale",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "dx", label: "Move X mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "dy", label: "Move Y mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "scale", label: "Scale %", type: "slider", min: 5, max: 400, step: 1, def: 100 },
      { key: "scaleY", label: "Scale Y % (0 = same)", type: "slider", min: 0, max: 400, step: 1, def: 0 },
      { key: "origin", label: "Scale origin", type: "select", options: ["Content center", "Canvas center", "Custom point"], def: "Content center" },
      { key: "ox", label: "Origin X mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "oy", label: "Origin Y mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    overlay(p, ctx) {
      if (p.origin === "Custom point") return [{ kind: "point", x: p.ox, y: p.oy }];
      if (p.origin === "Canvas center") return [{ kind: "point", x: ctx.W / 2, y: ctx.H / 2 }];
      return [];
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let ox, oy;
      if (p.origin === "Canvas center") { ox = ctx.W / 2; oy = ctx.H / 2; }
      else if (p.origin === "Custom point") { ox = p.ox; oy = p.oy; }
      else {
        /* sisallon bbox-keskipiste */
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const path of src.paths) for (const [x, y] of path.pts) {
          if (x < x0) x0 = x; if (y < y0) y0 = y;
          if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
        ox = (x0 + x1) / 2; oy = (y0 + y1) / 2;
      }
      const sx = p.scale / 100;
      const sy = p.scaleY > 0 ? p.scaleY / 100 : sx;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [
          ox + (x - ox) * sx + p.dx,
          oy + (y - oy) * sy + p.dy,
        ]),
      }));
      return { paths };
    }
  
};
```

## murmuration.js

```js
import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "murmuration",
    name: "Murmuration",
    cat: "gen",
    group: "creatures",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "birds", label: "Birds", type: "slider", min: 10, max: 600, step: 1, def: 220 },
      { key: "time", label: "Time (wire Frame t)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "travel", label: "Travel range", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "path", label: "Flock path", type: "select", options: ["Wander", "Oval", "Figure-8", "Lissajous 2:3", "Trefoil"], def: "Wander" },
      { key: "wander", label: "Wander mix (guide paths)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "spread", label: "Flock radius mm", type: "slider", min: 10, max: 150, step: 1, def: 55 },
      { key: "pulse", label: "Pulse (breathing)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "swirl", label: "Swirl turns / loop", type: "slider", min: -3, max: 3, step: 1, def: 1 },
      { key: "scatter", label: "Scatter mm", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "stretch", label: "Stretch along travel", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "shape", label: "Bird shape", type: "select", options: ["Dash", "Chevron", "Dot"], def: "Chevron" },
      { key: "size", label: "Bird size mm", type: "slider", min: 0.5, max: 6, step: 0.1, def: 1.8 },
      { key: "trail", label: "Trail mm", type: "slider", min: 0, max: 25, step: 0.5, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);

      const TWO = Math.PI * 2;
      const seed = p.seed;
      const N = Math.max(1, Math.min(800, Math.round(p.birds)));
      const tt = ((p.time % 1) + 1) % 1; /* wrap so Frame frame# also animates */
      const spread = Math.max(1, p.spread);
      const scatter = Math.max(0, p.scatter);
      const turns = Math.round(Math.max(-6, Math.min(6, p.swirl))); /* integer -> seamless loop */
      const travel = Math.max(0, Math.min(1, p.travel));
      const stretchAmt = Math.max(0, Math.min(1, p.stretch));

      /* All time-varying terms sample noise on a circle: cos/sin(2πt).
         Anything periodic in t by construction => t=0 and t=1 identical
         => seamless animation loops. */
      const cW = (W / 2), cH = (H / 2);
      const travX = Math.max(0, (x1 - x0) / 2 - spread * 0.35) * travel;
      const travY = Math.max(0, (y1 - y0) / 2 - spread * 0.35) * travel;

      const flockCenter = (t) => {
        const a = TWO * t, c = Math.cos(a), s = Math.sin(a);
        /* loop-noise wander (periodic in t by circular sampling) */
        const nx = (noise2(c * 1.7 + 3.1, s * 1.7 + 7.7, seed + 11) - 0.5) * 2;
        const ny = (noise2(c * 1.7 + 13.9, s * 1.7 + 2.3, seed + 29) - 0.5) * 2;
        if (p.path === "Oval" || p.path === "Figure-8" || p.path === "Lissajous 2:3" || p.path === "Trefoil") {
          /* closed guide curves, all 2π-periodic => loop stays seamless */
          let gx, gy;
          if (p.path === "Oval") { gx = c; gy = s; }
          else if (p.path === "Figure-8") { gx = c; gy = Math.sin(2 * a) * 0.9; }
          else if (p.path === "Lissajous 2:3") { gx = Math.sin(2 * a); gy = Math.sin(3 * a); }
          else { const r3 = (1 + 0.38 * Math.cos(3 * a)) / 1.38; gx = c * r3; gy = s * r3; }
          const wmix = 0.35 * Math.max(0, Math.min(1, p.wander));
          return [cW + (gx * (1 - wmix) + nx * wmix) * travX,
                  cH + (gy * (1 - wmix) + ny * wmix) * travY];
        }
        /* Wander: original behavior, unchanged for existing patches */
        return [cW + nx * travX, cH + ny * travY];
      };

      /* per-bird stable hashes */
      const birdsArr = [];
      for (let i = 0; i < N; i++) {
        birdsArr.push({
          a0: hash2(i, 3, seed) * TWO,
          r0: Math.sqrt(hash2(i, 5, seed)),        /* sqrt -> uniform disc */
          sz: Math.max(0.2, p.size) * (0.55 + 0.9 * hash2(i, 21, seed)), /* depth illusion */
          o1: hash2(i, 11, seed) * 47, o2: hash2(i, 12, seed) * 47,
          o3: hash2(i, 13, seed) * 47, o4: hash2(i, 14, seed) * 47,
          o5: hash2(i, 15, seed) * 47, o6: hash2(i, 16, seed) * 47,
        });
      }

      const posAt = (t, h) => {
        const a = TWO * t, c = Math.cos(a), s = Math.sin(a);
        const fc = flockCenter(t);
        /* flock travel direction (for elongation) */
        const pA = flockCenter(t - 0.012), pB = flockCenter(t + 0.012);
        let vx = pB[0] - pA[0], vy = pB[1] - pA[1];
        const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
        /* swirling polar offset + global breathing pulse */
        const ang = h.a0 + turns * TWO * t
          + (noise2(c * 1.1 + h.o1, s * 1.1 + h.o2, seed + 5) - 0.5) * 2.5;
        const pul = 1 + p.pulse * 0.7 * ((noise2(c * 0.9 + 31, s * 0.9 + 17, seed + 41) - 0.5) * 2);
        const rad = h.r0 * spread * pul;
        let ox = Math.cos(ang) * rad, oy = Math.sin(ang) * rad;
        /* elongate along travel, squash across it */
        const along = ox * vx + oy * vy;
        const perp = -ox * vy + oy * vx;
        const stA = 1 + stretchAmt * 0.9, stP = 1 / (1 + stretchAmt * 0.45);
        ox = vx * along * stA - vy * perp * stP;
        oy = vy * along * stA + vx * perp * stP;
        /* individual wander */
        ox += (noise2(c * 2.3 + h.o3, s * 2.3 + h.o4, seed + 7) - 0.5) * 2 * scatter;
        oy += (noise2(c * 2.3 + h.o5, s * 2.3 + h.o6, seed + 9) - 0.5) * 2 * scatter;
        return [fc[0] + ox, fc[1] + oy];
      };

      const inside = (q) => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
      /* glyph reach beyond the bird position, per shape */
      const reachOf = (sz) => p.shape === "Chevron" ? sz * 1.4 : p.shape === "Dash" ? sz * 0.55 : Math.max(0.25, sz * 0.28) + 0.05;
      const insideR = (q, r) => q[0] >= x0 + r && q[0] <= x1 - r && q[1] >= y0 + r && q[1] <= y1 - r;
      const paths = [];
      const trailMm = Math.max(0, p.trail);

      for (const h of birdsArr) {
        const pos = posAt(tt, h);
        if (!insideR(pos, reachOf(h.sz))) continue;
        /* heading from the closed-form derivative (periodic, so loop-safe) */
        const e = 0.002;
        const pA = posAt(tt - e, h), pB = posAt(tt + e, h);
        let dx = pB[0] - pA[0], dy = pB[1] - pA[1];
        const dl = Math.hypot(dx, dy);
        if (dl > 1e-9) { dx /= dl; dy /= dl; } else { dx = 1; dy = 0; }

        /* trail: flight history, oldest -> head so pen travels in flight direction */
        if (trailMm > 0.5) {
          const tp = [pos];
          let tcur = tt, acc = 0, guard = 0;
          const dt = 0.0035;
          while (acc < trailMm && guard++ < 36) {
            const prev = posAt(tcur - dt, h);
            if (!inside(prev)) break;
            acc += Math.hypot(prev[0] - tp[0][0], prev[1] - tp[0][1]);
            tp.unshift(prev);
            tcur -= dt;
          }
          if (tp.length >= 2) paths.push({ pts: tp, closed: false, layer: L });
        }

        const sz = h.sz;
        if (p.shape === "Dash") {
          paths.push({
            pts: [[pos[0] - dx * sz / 2, pos[1] - dy * sz / 2], [pos[0] + dx * sz / 2, pos[1] + dy * sz / 2]],
            closed: false, layer: L,
          });
        } else if (p.shape === "Dot") {
          const r = Math.max(0.25, sz * 0.28);
          const pts = [];
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * TWO;
            pts.push([pos[0] + Math.cos(a) * r, pos[1] + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: true, layer: L });
        } else {
          /* Chevron: tiny V opening backwards -- the classic distant-starling glyph.
             One 3-point stroke: wingtip -> head -> wingtip (single pen-down). */
          const hx = pos[0] + dx * sz * 0.35, hy = pos[1] + dy * sz * 0.35;
          const wa = 2.65; /* ~152 deg back from heading */
          const c1 = Math.cos(wa), s1 = Math.sin(wa);
          const w1 = [hx + (dx * c1 - dy * s1) * sz, hy + (dx * s1 + dy * c1) * sz];
          const w2 = [hx + (dx * c1 + dy * s1) * sz, hy + (-dx * s1 + dy * c1) * sz];
          paths.push({ pts: [w1, [hx, hy], w2], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## myceliumfill.js

```js
import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "myceliumfill",
  name: "Mycelium Fill",
  cat: "mod",
  group: "fillstyle",
  desc: "Grows organic flesh along a line network: parallel strands follow each input line, and the width swells near junctions (places where 3+ path ends meet, or where different paths cross) so joints read thicker - a slime-mould / mycelium look on a Voronoi or Network input. Strands that would invade a neighbouring strut's territory are cut, except near junctions where they merge. Waviness adds hyphal wobble; Taper thins the open ends.",
  ins: [Pin("paths", "Network")],
  outs: [Pin("paths")],
  params: [
    { key: "strands", label: "Strands per side", type: "slider", min: 1, max: 8, step: 1, def: 2 },
    { key: "width", label: "Base width mm", type: "slider", min: 0.5, max: 24, step: 0.5, def: 4 },
    { key: "boost", label: "Junction boost", type: "slider", min: 0, max: 3, step: 0.05, def: 1.2 },
    { key: "wav", label: "Waviness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "taper", label: "Taper ends mm", type: "slider", min: 0, max: 30, step: 1, def: 6 },
    { key: "keep", label: "Keep source", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 21 },
    { key: "layer", label: "Strand pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const L = Math.round(p.layer);
    const out = p.keep ? src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) : [];
    const BUDGET = 120000;
    let total = out.reduce((s, pa) => s + pa.pts.length, 0);

    /* ---- segment soup + spatial grid (for territory queries) ---- */
    const segs = []; /* [x1,y1,x2,y2,owner] */
    const spines = [];
    src.paths.forEach((pa, id) => {
      if (pa.pts.length < 2) return;
      const pts = resample(pa.pts, pa.closed, 1);
      if (pts.length < 3) return;
      spines.push({ pts, closed: pa.closed, id });
      const coarse = resample(pa.pts, pa.closed, 2.5);
      const M = pa.closed ? coarse.length : coarse.length - 1;
      for (let i = 0; i < M; i++) {
        const a = coarse[i], b = coarse[(i + 1) % coarse.length];
        segs.push([a[0], a[1], b[0], b[1], id]);
      }
    });
    if (!spines.length) return { paths: out };
    const CELL = 6;
    const grid = new Map();
    const gk = (x, y) => x + "," + y;
    segs.forEach((s, i) => {
      const x0 = Math.floor(Math.min(s[0], s[2]) / CELL), x1 = Math.floor(Math.max(s[0], s[2]) / CELL);
      const y0 = Math.floor(Math.min(s[1], s[3]) / CELL), y1 = Math.floor(Math.max(s[1], s[3]) / CELL);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        const k = gk(gx, gy);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    });
    const segDist = (x, y, s) => {
      const dx = s[2] - s[0], dy = s[3] - s[1];
      const L2 = dx * dx + dy * dy || 1e-9;
      let t = ((x - s[0]) * dx + (y - s[1]) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
    };
    const nearestOther = (x, y, owner, maxR) => {
      const r = Math.max(1, Math.ceil(maxR / CELL));
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      let best = Infinity;
      for (let gx = cx - r; gx <= cx + r; gx++) for (let gy = cy - r; gy <= cy + r; gy++) {
        for (const i of grid.get(gk(gx, gy)) || []) {
          if (segs[i][4] === owner) continue;
          const d = segDist(x, y, segs[i]);
          if (d < best) best = d;
        }
      }
      return best;
    };

    /* ---- junctions: endpoint clusters (deg >= 3) + cross-owner intersections ---- */
    const junctions = [];
    {
      const endMap = new Map();
      for (const pa of src.paths) {
        if (pa.closed || pa.pts.length < 2) continue;
        for (const q of [pa.pts[0], pa.pts[pa.pts.length - 1]]) {
          const k = Math.round(q[0]) + "," + Math.round(q[1]);
          if (!endMap.has(k)) endMap.set(k, { x: 0, y: 0, n: 0 });
          const e = endMap.get(k);
          e.x += q[0]; e.y += q[1]; e.n++;
        }
      }
      for (const e of endMap.values()) if (e.n >= 3) junctions.push([e.x / e.n, e.y / e.n]);
      /* crossings between different owners sharing a grid cell */
      const segInt = (A, B) => {
        const d1x = A[2] - A[0], d1y = A[3] - A[1], d2x = B[2] - B[0], d2y = B[3] - B[1];
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 1e-9) return null;
        const t = ((B[0] - A[0]) * d2y - (B[1] - A[1]) * d2x) / den;
        const u = ((B[0] - A[0]) * d1y - (B[1] - A[1]) * d1x) / den;
        if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
        return [A[0] + d1x * t, A[1] + d1y * t];
      };
      let tests = 0;
      const cSeen = new Set();
      outer: for (const arr of grid.values()) {
        for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) {
          if (tests++ > 20000) break outer;
          const A = segs[arr[a]], B = segs[arr[b]];
          if (A[4] === B[4]) continue;
          const ix = segInt(A, B);
          if (ix) {
            const k = Math.round(ix[0]) + "," + Math.round(ix[1]);
            if (!cSeen.has(k)) { cSeen.add(k); junctions.push(ix); }
          }
        }
      }
    }
    const jr = p.width * 2.5 + 4;
    const jlist = junctions.slice(0, 500);
    const Jat = (x, y) => {
      let s = 0;
      for (const [jx, jy] of jlist) {
        const d = Math.hypot(x - jx, y - jy);
        if (d < jr * 2.2) s += Math.exp(-(d * d) / (jr * jr * 0.35));
      }
      return Math.min(1.5, s);
    };

    /* ---- strands ---- */
    const K = Math.max(1, Math.round(p.strands));
    for (const sp of spines) {
      const pts = sp.pts;
      const N = pts.length;
      const dArr = [0];
      for (let i = 1; i < N; i++) dArr.push(dArr[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const totalLen = dArr[N - 1];
      const normals = pts.map((pt, i) => {
        const nI = sp.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
        const pI = sp.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
        const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        return [-ty / tl, tx / tl];
      });
      const Jcache = pts.map((q) => Jat(q[0], q[1]));
      for (const side of [-1, 1]) {
        for (let k = 1; k <= K; k++) {
          if (total > BUDGET) break;
          const frac = k / K;
          const sd = p.seed * 7919 + sp.id * 613 + k * 97 + (side > 0 ? 31 : 0);
          const qpts = new Array(N);
          const vis = new Array(N);
          for (let i = 0; i < N; i++) {
            const J = Jcache[i];
            let w = p.width * (1 + p.boost * J);
            if (!sp.closed && p.taper > 0.5) {
              const edge = Math.min(dArr[i], totalLen - dArr[i]);
              let tE = Math.min(1, edge / p.taper);
              tE = tE * tE * (3 - 2 * tE);
              w *= tE;
            }
            const wob = (noise2(dArr[i] * 0.08, k * 3.1, sd) - 0.5) * p.wav * p.width * 0.8 * frac;
            const off = side * frac * (w / 2) + wob;
            const q = [pts[i][0] + normals[i][0] * off, pts[i][1] + normals[i][1] * off];
            qpts[i] = q;
            const oAbs = Math.abs(off);
            if (J >= 0.15 || oAbs < 0.3) vis[i] = true;
            else vis[i] = !(nearestOther(q[0], q[1], sp.id, oAbs + 1.5) < oAbs * 0.95);
          }
          /* emit runs, wrap-aware for closed spines */
          const cutIdx = vis.findIndex((v) => !v);
          if (sp.closed && cutIdx < 0) {
            if (total + N <= BUDGET) { out.push({ pts: qpts.map((q) => q.slice()), closed: true, layer: L }); total += N; }
            continue;
          }
          const start = sp.closed ? cutIdx : 0;
          const M = sp.closed ? N : N;
          let run = [];
          const flush = () => {
            if (run.length > 2 && total + run.length <= BUDGET) { out.push({ pts: run, closed: false, layer: L }); total += run.length; }
            run = [];
          };
          for (let s2 = 0; s2 <= (sp.closed ? M : M - 1); s2++) {
            const i = sp.closed ? (start + s2) % N : s2;
            if (vis[i]) run.push(qpts[i].slice());
            else flush();
          }
          flush();
        }
      }
    }
    return { paths: out };
  },
};
```

## myco_net.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "myco_net",
    name: "Root Web",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 9999 },
      { key: "hyphae", label: "Initial Spores", type: "slider", min: 1, max: 30, step: 1, def: 6 },
      { key: "length", label: "Growth Cycles", type: "slider", min: 10, max: 400, step: 10, def: 120 },
      { key: "branching", label: "Split Rate", type: "slider", min: 0.01, max: 0.25, step: 0.01, def: 0.06 },
      { key: "wander", label: "Wander", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "step", label: "Internode (mm)", type: "slider", min: 0.5, max: 6, step: 0.1, def: 2.0 },
      { key: "spawn", label: "Spawn Radius (mm)", type: "slider", min: 0, max: 80, step: 1, def: 8 },
      { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 6 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 19 + 7);
      const paths = [];
      const queue = [];
      const L = Math.round(p.layer);
      const stepLen = Math.max(0.2, p.step);

      const count = Math.max(1, Math.round(p.hyphae));
      const spawnR = Math.min(Math.max(0, p.spawn), Math.min(W, H) / 2 - m - 1);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const sx = W / 2 + Math.cos(angle) * spawnR;
        const sy = H / 2 + Math.sin(angle) * spawnR;
        queue.push({ x: sx, y: sy, angle, pts: [[sx, sy]] });
      }
      let steps = 0;
      const maxSteps = Math.round(p.length);
      const pointBudget = 60000;
      let generatedPoints = 0;
      /* incremental steering: turn by a noise-driven delta each step.
         (Blending raw angle VALUES with a 0..4pi field is not angle math
         and biases every tip toward the field's absolute magnitude.) */
      const turnRate = 0.25 + 1.1 * Math.max(0, Math.min(1, p.wander));

      while (queue.length > 0 && steps < maxSteps && generatedPoints < pointBudget) {
        const levelSize = queue.length;
        steps++;
        for (let i = 0; i < levelSize; i++) {
          const tip = queue.shift();
          if (!tip) continue;
          const drift = (noise2(tip.x * 0.012, tip.y * 0.012, p.seed) - 0.5) * 2;
          const nextAngle = tip.angle + drift * turnRate;
          const nx = tip.x + Math.cos(nextAngle) * stepLen;
          const ny = tip.y + Math.sin(nextAngle) * stepLen;
          if (nx < m || nx > W - m || ny < m || ny > H - m) {
            if (tip.pts.length > 1) paths.push({ pts: tip.pts, closed: false, layer: L });
            continue;
          }
          tip.pts.push([nx, ny]);
          generatedPoints++;
          if (rng() < p.branching && queue.length < 75) {
            const splitLeft = nextAngle + (rng() * 0.4 + 0.15);
            const splitRight = nextAngle - (rng() * 0.4 + 0.15);
            queue.push({ x: nx, y: ny, angle: splitLeft, pts: [[nx, ny]] });
            queue.push({ x: nx, y: ny, angle: splitRight, pts: [[nx, ny]] });
            paths.push({ pts: tip.pts, closed: false, layer: L });
          } else {
            queue.push({ x: nx, y: ny, angle: nextAngle, pts: tip.pts });
          }
        }
      }
      queue.forEach(tip => {
        if (tip.pts.length > 1) paths.push({ pts: tip.pts, closed: false, layer: L });
      });
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## negspace.js

```js
import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
  key: "negspace",
    name: "Negative Space",
    cat: "duo",
    desc: "Clips Fill into the space a Shape does NOT use: the shape's lines (plus a clearance band) and the inside of its closed paths count as occupied, and the fill flows around them - draw a background behind Tubes without touching them. Inverse mode keeps the fill only INSIDE the used space instead. Works with any geometry, open or closed, unlike Mask.",
    ins: [Pin("paths", "Shape (occupies)"), Pin("paths", "Fill")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Keep", type: "select", options: ["Background (outside)", "Inside (inverse)"], def: "Background (outside)" },
      { key: "clearance", label: "Clearance mm", type: "slider", min: 0, max: 20, step: 0.25, def: 2.5 },
      { key: "interior", label: "Closed interiors occupy", type: "check", def: true },
      { key: "res", label: "Cut precision mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "minlen", label: "Min piece mm", type: "slider", min: 0, max: 20, step: 0.5, def: 2 }
    ],
    compute(ins, p, ctx) {
      const A = ins[0] || EMPTY, B = ins[1] || EMPTY;
      if (!B.paths.length) return EMPTY;
      if (!A.paths.length) {
        return p.mode === "Background (outside)"
          ? { paths: B.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) }
          : EMPTY;
      }
      /* segment buckets of A for distance queries */
      const segs = [];
      for (const pa of A.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
      }
      const clr = Math.max(0, p.clearance);
      const bs = Math.max(3, clr * 1.5 + 2);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const sx0 = Math.min(s[0], s[2]) - clr, sx1 = Math.max(s[0], s[2]) + clr;
        const sy0 = Math.min(s[1], s[3]) - clr, sy1 = Math.max(s[1], s[3]) + clr;
        for (let by = Math.floor(sy0 / bs); by <= Math.floor(sy1 / bs); by++) {
          for (let bx = Math.floor(sx0 / bs); bx <= Math.floor(sx1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k);
            if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
        }
      });
      const nearLine = (x, y) => {
        const a = buckets.get(Math.floor(x / bs) + "," + Math.floor(y / bs));
        if (!a) return false;
        for (const i of a) {
          const s = segs[i];
          const dx = s[2] - s[0], dy = s[3] - s[1];
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const ddx = x - (s[0] + dx * t), ddy = y - (s[1] + dy * t);
          if (ddx * ddx + ddy * ddy <= clr * clr) return true;
        }
        return false;
      };
      /* closed interiors */
      const polys = p.interior ? A.paths.filter((pa) => pa.closed && pa.pts.length >= 3).map((pa) => {
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (const [x, y] of pa.pts) {
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
          if (y < by0) by0 = y; if (y > by1) by1 = y;
        }
        return { poly: pa.pts, bx0, by0, bx1, by1 };
      }) : [];
      const insidePoly = (x, y) => {
        for (const cp of polys) {
          if (x < cp.bx0 || x > cp.bx1 || y < cp.by0 || y > cp.by1) continue;
          let c = false;
          const poly = cp.poly;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const yi = poly[i][1], yj = poly[j][1];
            if ((yi > y) !== (yj > y)) {
              const xi = poly[i][0], xj = poly[j][0];
              if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
            }
          }
          if (c) return true;
        }
        return false;
      };
      const wantOccupied = p.mode !== "Background (outside)";
      const keep = (x, y) => ((nearLine(x, y) || insidePoly(x, y)) === wantOccupied);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      for (const pa of B.paths) {
        const pts = resample(pa.pts, pa.closed, Math.max(0.2, p.res));
        let run = [];
        const flush = () => {
          if (run.length > 1 && (p.minlen <= 0 || pathLength(run, false) >= p.minlen)) {
            if (total + run.length <= BUDGET) {
              total += run.length;
              paths.push({ pts: run, closed: false, layer: pa.layer });
            }
          }
          run = [];
        };
        let allKept = true;
        for (const [x, y] of pts) {
          if (keep(x, y)) run.push([x, y]);
          else { allKept = false; flush(); }
        }
        if (allKept && pa.closed && run.length > 2) {
          if (total + run.length <= BUDGET) { total += run.length; paths.push({ pts: run, closed: true, layer: pa.layer }); }
          run = [];
        } else flush();
        if (total > BUDGET) break;
      }
      return { paths };
    }
  
};
```

## net.js

```js
import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "net",
      name: "Net",
    cat: "gen", group: "structural",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "pattern", label: "Mesh type", type: "select", options: ["Diamond", "Square", "Triangle", "Hexagon"], def: "Diamond" },
      { key: "cell", label: "Cell size mm", type: "slider", min: 2, max: 60, step: 0.5, def: 14 },
      { key: "sag", label: "Sag mm (hanging)", type: "slider", min: 0, max: 60, step: 0.5, def: 12 },
      { key: "jit", label: "Irregularity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 109 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const w = W - 2 * m, h = H - 2 * m;
      if (w < 5 || h < 5) return EMPTY;
      /* verkon roikkuminen + epasaannollisyys yhtenaisena kenttana:
         koko verkko painuu keskelta, solmut varisevat kohinalla */
      const disp = (x, y) => {
        const u = (x - m) / w;
        const dy = p.sag * Math.sin(Math.PI * Math.max(0, Math.min(1, u))) * (0.25 + 0.75 * (y - m) / h);
        const jx = (noise2(x * 0.05, y * 0.05, p.seed) - 0.5) * p.jit * p.cell * 0.9;
        const jy = (noise2(x * 0.05 + 40, y * 0.05 + 40, p.seed + 3) - 0.5) * p.jit * p.cell * 0.9;
        return [x + jx, y + dy + jy];
      };
      const paths = [];
      const seg = (a, b) => {
        /* piirra saie hienojakoisena jotta sag/jitter taipuu sulavasti */
        const n = 6;
        const pts = [];
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          pts.push(disp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
        }
        paths.push({ pts, closed: false, layer: L });
      };
      const poly = (raw) => {
        /* jatkuva polyline solmupisteista, valit hienonnettuna */
        const pts = [];
        for (let i = 0; i < raw.length - 1; i++) {
          const a = raw[i], b = raw[i + 1];
          const n = 4;
          for (let k = i === 0 ? 0 : 1; k <= n; k++) {
            const t = k / n;
            pts.push(disp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
          }
        }
        if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
      };
      const c = p.cell;
      if (p.pattern === "Square") {
        for (let y = m; y <= m + h + 0.01; y += c) poly([[m, y], [m + w, y]]);
        for (let x = m; x <= m + w + 0.01; x += c) poly([[x, m], [x, m + h]]);
      } else if (p.pattern === "Diamond") {
        /* diagonaalit molempiin suuntiin — kalastusverkko */
        for (let s = -h; s <= w + h; s += c) {
          poly([[m + s, m], [m + s + h, m + h]]);
          poly([[m + s, m], [m + s - h, m + h]]);
        }
      } else if (p.pattern === "Triangle") {
        for (let y = m; y <= m + h + 0.01; y += c) poly([[m, y], [m + w, y]]);
        for (let s = -h; s <= w + h; s += c) {
          poly([[m + s, m], [m + s + h, m + h]]);
          poly([[m + s, m], [m + s - h, m + h]]);
        }
      } else {
        /* Hexagon: hunajakenno siksak-riveina + pystylinkit -> ei tuplavetoja */
        const hw = c / 2, hh = (c * Math.sqrt(3)) / 2;
        let rowI = 0;
        for (let y = m; y <= m + h - hh * 0.5; y += hh, rowI++) {
          const off = rowI % 2 === 0 ? 0 : 0;
          /* siksak: /\/\/\ */
          const raw = [];
          let up = rowI % 2 === 0;
          for (let x = m; x <= m + w + 0.01; x += hw) {
            raw.push([x, up ? y : y + hh * 0.5]);
            up = !up;
          }
          poly(raw);
          /* pystylinkit siksakin alapisteista seuraavan rivin ylapisteisiin */
          let up2 = rowI % 2 === 0;
          for (let x = m; x <= m + w + 0.01; x += hw) {
            if (!up2 && y + hh * 0.5 + hh * 0.5 <= m + h) {
              seg([x, y + hh * 0.5], [x, y + hh]);
            }
            up2 = !up2;
          }
        }
      }
      /* rajaa marginaaliin: sag voi tyontaa alle — kevyt leikkaus */
      const paths2 = paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [Math.max(m - 1, Math.min(m + w + 1, x)), Math.min(H - 2, y)]),
      }));
      return applyStyle({ paths: paths2 }, ins[0]);
    }
  
};
```

## network.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "network",
    name: "Network",
    cat: "gen",
    group: "structural",
    desc: "A seeded graph laid out by force simulation (nodes repel, edges pull), replayed deterministically for N iterations - wire a value into Iterations to watch it untangle. Nearest-neighbour links plus a few long-range ones give constellation diagrams; node circles can scale by connection count.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "nodes", label: "Nodes", type: "slider", min: 5, max: 120, step: 1, def: 40 },
      { key: "links", label: "Links per node", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "longp", label: "Long links", type: "slider", min: 0, max: 0.3, step: 0.01, def: 0.06 },
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 300, step: 5, def: 120 },
      { key: "dots", label: "Draw nodes", type: "check", def: true },
      { key: "degsize", label: "Size by connections", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const N2 = Math.max(3, Math.min(150, Math.round(p.nodes)));
      const rng = mulberry32(p.seed * 9013 + 3);
      const pos = [];
      for (let i = 0; i < N2; i++) {
        pos.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
      }
      /* edges: k nearest at start + seeded long-range links */
      const edges = new Set();
      const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
      const kNear = Math.max(1, Math.min(6, Math.round(p.links)));
      for (let i = 0; i < N2; i++) {
        const d = pos.map((q, j) => [Math.hypot(q[0] - pos[i][0], q[1] - pos[i][1]), j])
          .sort((a, b) => a[0] - b[0]);
        for (let k = 1; k <= kNear && k < d.length; k++) edges.add(ek(i, d[k][1]));
        if (rng() < p.longp * 3) {
          const j = Math.floor(rng() * N2);
          if (j !== i) edges.add(ek(i, j));
        }
      }
      const E = [...edges].map((k) => k.split("_").map(Number));
      const deg = new Array(N2).fill(0);
      for (const [a, b] of E) { deg[a]++; deg[b]++; }
      /* force layout: repulsion all pairs, springs on edges, deterministic */
      const gens = Math.max(0, Math.min(400, Math.floor(p.iters)));
      const ideal = Math.sqrt(((x1 - x0) * (y1 - y0)) / N2) * 0.9;
      for (let g = 0; g < gens; g++) {
        const fx = new Float64Array(N2), fy = new Float64Array(N2);
        for (let i = 0; i < N2; i++) {
          for (let j = i + 1; j < N2; j++) {
            let ox = pos[i][0] - pos[j][0], oy = pos[i][1] - pos[j][1];
            let d = Math.hypot(ox, oy);
            if (d < 0.01) { ox = 0.01 * ((i % 3) - 1); oy = 0.01; d = 0.014; }
            const f = (ideal * ideal) / (d * d) * 0.5;
            fx[i] += (ox / d) * f; fy[i] += (oy / d) * f;
            fx[j] -= (ox / d) * f; fy[j] -= (oy / d) * f;
          }
        }
        for (const [a, b] of E) {
          const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
          const d = Math.hypot(ox, oy) || 0.01;
          const f = (d - ideal) * 0.05;
          fx[a] += (ox / d) * f; fy[a] += (oy / d) * f;
          fx[b] -= (ox / d) * f; fy[b] -= (oy / d) * f;
        }
        const cool = 1 - g / (gens + 1);
        for (let i = 0; i < N2; i++) {
          const fl = Math.hypot(fx[i], fy[i]) || 1;
          const s = Math.min(3 * cool + 0.2, fl) / fl;
          pos[i][0] = Math.max(x0, Math.min(x1, pos[i][0] + fx[i] * s));
          pos[i][1] = Math.max(y0, Math.min(y1, pos[i][1] + fy[i] * s));
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      const rOf = (i) => p.degsize ? 1 + Math.min(4, deg[i] * 0.5) : 1.6;
      for (const [a, b] of E) {
        /* trim edge lines so they stop at the node circles */
        const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
        const d = Math.hypot(ox, oy);
        if (d < 0.5) continue;
        const ra = p.dots ? rOf(a) + 0.4 : 0, rb = p.dots ? rOf(b) + 0.4 : 0;
        if (ra + rb >= d) continue;
        paths.push({
          pts: [
            [pos[a][0] + (ox / d) * ra, pos[a][1] + (oy / d) * ra],
            [pos[b][0] - (ox / d) * rb, pos[b][1] - (oy / d) * rb]
          ],
          closed: false, layer: L
        });
      }
      if (p.dots) {
        for (let i = 0; i < N2; i++) {
          const r = rOf(i);
          const c = [];
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            c.push([pos[i][0] + Math.cos(a) * r, pos[i][1] + Math.sin(a) * r]);
          }
          paths.push({ pts: c, closed: true, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## occlude.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "occlude",
    name: "Occlude",
    cat: "mod",
    group: "occlusion",
    ins: [Pin("paths", "Lines"), Pin("paths", "Occluders (closed)")],
    outs: [Pin("paths")],
    params: [
      { key: "gap", label: "Gap mm (+grow / -shrink)", type: "slider", min: -5, max: 8, step: 0.25, def: 0.8 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 },
      { key: "drawOcc", label: "Draw occluders", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const twoInput = !!(ins[1] && ins[1].paths && ins[1].paths.length);
      const step = Math.max(0.25, p.res);
      const gap = p.gap;
      const paths = [];

      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const edgeDist = (x, y, poly) => {
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const ax = poly[j][0], ay = poly[j][1];
          const bx = poly[i][0], by = poly[i][1];
          const dx = bx - ax, dy = by - ay;
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
          if (d < best) best = d;
        }
        return best;
      };
      const prepOcc = (path) => {
        const poly = path.pts;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of poly) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const pad = Math.max(0, gap);
        return { poly, x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
      };
      const hidden = (x, y, occ) => {
        if (x < occ.x0 || x > occ.x1 || y < occ.y0 || y > occ.y1) return false;
        const inside = pip(x, y, occ.poly);
        if (gap >= 0) {
          return inside || (gap > 0 && edgeDist(x, y, occ.poly) < gap);
        }
        /* negative gap: occlusion shrinks inward */
        return inside && edgeDist(x, y, occ.poly) > -gap;
      };
      const emitVisible = (path, occs) => {
        if (!occs.length) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        const pts = resample(path.pts, path.closed, step);
        const vis = pts.map(([x, y]) => !occs.some((o) => hidden(x, y, o)));
        const runs = [];
        let run = [];
        for (let i = 0; i < pts.length; i++) {
          if (vis[i]) run.push(pts[i]);
          else { if (run.length > 1) runs.push(run); run = []; }
        }
        if (run.length > 1) runs.push(run);
        /* closed source with visible wrap: merge last run into first */
        if (path.closed && runs.length > 1 && vis[0] && vis[pts.length - 1]) {
          const last = runs.pop();
          runs[0] = last.concat(runs[0]);
        }
        if (path.closed && runs.length === 1 && vis.every(Boolean)) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        for (const r of runs) paths.push({ pts: r, closed: false, layer: path.layer });
      };

      if (twoInput) {
        const occs = ins[1].paths.filter((pa) => pa.closed && pa.pts.length >= 3).map(prepOcc);
        src.paths.forEach((path) => emitVisible(path, occs));
        if (p.drawOcc) {
          ins[1].paths.forEach((pa) => paths.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }));
        }
      } else {
        /* painter mode: within the set, LATER closed shapes occlude EARLIER paths */
        const all = src.paths;
        const occAfter = all.map((pa, i) =>
          all.slice(i + 1).filter((o) => o.closed && o.pts.length >= 3).map(prepOcc));
        all.forEach((path, i) => emitVisible(path, occAfter[i]));
      }
      return { paths };
    }
  
};
```

## offset.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "offset",
    name: "Offset", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "copies", label: "Copies", type: "slider", min: 1, max: 8, step: 1, def: 2 },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.1, max: 10, step: 0.05, def: 0.5 },
      { key: "side", label: "Side", type: "select", options: ["Both", "Left", "Right"], def: "Both" },
      { key: "orig", label: "Include original", type: "check", def: true },
      { key: "clean", label: "Clean corners", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const sides = p.side === "Both" ? [1, -1] : p.side === "Left" ? [1] : [-1];
      const paths = [];
      for (const path of src.paths) {
        if (p.orig) paths.push(path);
        const pts = resample(path.pts, path.closed, Math.max(0.8, p.spacing));
        if (pts.length < 2) continue;
        const N = pts.length;
        const normals = pts.map((pt, i) => {
          const nI = path.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
          const pI = path.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [-ty / tl, tx / tl];
        });
        for (const s of sides) {
          for (let k = 1; k <= Math.round(p.copies); k++) {
            const off = s * k * p.spacing;
            let out = pts.map((pt, i) => [pt[0] + normals[i][0] * off, pt[1] + normals[i][1] * off]);
            if (p.clean) {
              /* poista kaantyneet segmentit: offset-segmentti vs alkuperainen suunta */
              const keep = new Array(out.length).fill(true);
              for (let i = 1; i < out.length; i++) {
                const oi = path.closed ? i % N : i;
                const opi = path.closed ? (i - 1) % N : i - 1;
                const odx = pts[oi][0] - pts[opi][0], ody = pts[oi][1] - pts[opi][1];
                const fdx = out[i][0] - out[i - 1][0], fdy = out[i][1] - out[i - 1][1];
                if (odx * fdx + ody * fdy < 0) keep[i] = false; /* cusp: segmentti kaantyi */
              }
              out = out.filter((_, i) => keep[i]);
              /* siivoa jaljelle jaaneet mikroluupit: pisteet liian lahella toisiaan */
              const out2 = [];
              for (const q of out) {
                const last = out2[out2.length - 1];
                if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.08) out2.push(q);
              }
              out = out2;
            }
            if (out.length > 1) paths.push({ pts: out, closed: path.closed, layer: path.layer });
          }
        }
      }
      return { paths };
    },
  
};
```

## origami.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "origami",
    name: "Origami", cat: "gen", group: "structural", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "splits", label: "Splits", type: "slider", min: 1, max: 80, step: 1, def: 16 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 23 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 941 + 5);
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      let polys = [[[p.margin, p.margin], [W - p.margin, p.margin], [W - p.margin, H - p.margin], [p.margin, H - p.margin]]];
      for (let s = 0; s < Math.round(p.splits); s++) {
        const idx = Math.floor(rng() * polys.length);
        const poly = polys[idx];
        const n = poly.length;
        if (n < 3) continue;
        const a = Math.floor(rng() * n);
        const b = (a + 1 + Math.floor(rng() * (n - 1))) % n;
        if (a === b) continue;
        const Pa = lerp(poly[a], poly[(a + 1) % n], 0.2 + rng() * 0.6);
        const Pb = lerp(poly[b], poly[(b + 1) % n], 0.2 + rng() * 0.6);
        const polyA = [Pa], polyB = [Pb];
        for (let i = (a + 1) % n; ; i = (i + 1) % n) { polyA.push(poly[i]); if (i === b) break; }
        polyA.push(Pb);
        for (let i = (b + 1) % n; ; i = (i + 1) % n) { polyB.push(poly[i]); if (i === a) break; }
        polyB.push(Pa);
        polys[idx] = polyA;
        polys.push(polyB);
      }
      const paths = polys.map((poly) => ({ pts: poly.map((q) => q.slice()), closed: true, layer: Math.round(p.layer) }));
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## origami_glitch_fold.js

```js
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
      { key: "offset", label: "Axis Position", type: "slider", min: -100, max: 100, step: 1, def: 0 },
      { key: "distortion", label: "Crease Warp", type: "slider", min: -0.5, max: 0.5, step: 0.01, def: 0.15 },
      { key: "keep", label: "Keep Original", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const rad = (p.angle * Math.PI) / 180;
      const nx = Math.cos(rad);
      const ny = Math.sin(rad);
      const cx = W / 2 + nx * p.offset;
      const cy = H / 2 + ny * p.offset;
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
```

## outline.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "outline",
    name: "Outline", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "width", label: "Width mm", type: "slider", min: 0.4, max: 12, step: 0.1, def: 2 },
      { key: "clean", label: "Clean corners", type: "check", def: true },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "layer", label: "Outline pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const r = p.width / 2;
      const paths = [];
      const cleanSide = (out, orig, closed) => {
        if (!p.clean) return out;
        const keep = new Array(out.length).fill(true);
        for (let i = 1; i < out.length; i++) {
          const odx = orig[i][0] - orig[i - 1][0], ody = orig[i][1] - orig[i - 1][1];
          const fdx = out[i][0] - out[i - 1][0], fdy = out[i][1] - out[i - 1][1];
          if (odx * fdx + ody * fdy < 0) keep[i] = false;
        }
        const res = [];
        for (let i = 0; i < out.length; i++) {
          if (!keep[i]) continue;
          const last = res[res.length - 1];
          if (!last || Math.hypot(out[i][0] - last[0], out[i][1] - last[1]) > 0.06) res.push(out[i]);
        }
        return res;
      };
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        const L = p.keepCol ? path.layer : Math.round(p.layer);
        const pts = resample(path.pts, path.closed, Math.max(0.5, r / 2));
        if (pts.length < 2) continue;
        const N = pts.length;
        const nl = pts.map((pt, i) => {
          const nI = path.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
          const pI = path.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [-ty / tl, tx / tl];
        });
        if (path.closed) {
          /* suljettu polku -> kaksi rengasta (nauha) */
          for (const s of [1, -1]) {
            const out = cleanSide(pts.map((pt, i) => [pt[0] + nl[i][0] * r * s, pt[1] + nl[i][1] * r * s]), pts, true);
            if (out.length > 2) paths.push({ pts: out, closed: true, layer: L });
          }
          continue;
        }
        /* avoin polku -> kapseli: vasen kylki + paatykaari + oikea kylki + alkukaari */
        const left = cleanSide(pts.map((pt, i) => [pt[0] + nl[i][0] * r, pt[1] + nl[i][1] * r]), pts, false);
        const rightFwd = cleanSide(pts.map((pt, i) => [pt[0] - nl[i][0] * r, pt[1] - nl[i][1] * r]), pts, false);
        const right = [...rightFwd].reverse();
        const capArc = (center, fromV) => {
          /* puoliympyra: fromV-suunnasta 180 astetta myotapaivaan */
          const a0 = Math.atan2(fromV[1], fromV[0]);
          const out = [];
          for (let k = 1; k < 10; k++) {
            const a = a0 - (Math.PI * k) / 10;
            out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]);
          }
          return out;
        };
        const capsule = [
          ...left,
          ...capArc(pts[N - 1], nl[N - 1]),
          ...right,
          ...capArc(pts[0], [-nl[0][0], -nl[0][1]]),
        ];
        if (capsule.length > 3) paths.push({ pts: capsule, closed: true, layer: L });
      }
      return { paths };
    },
  
};
```

## pcbtracks.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "pcbtracks",
    name: "PCB Tracks",
    cat: "gen",
    group: "structural",
    desc: "Printed circuit board copper: octilinear tracks (45-degree bends only) routed between round pads, IC footprints as twin rows of pads feeding tracks outward, and via dots along the runs. One pen - classic single-layer copper look.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tracks", label: "Tracks", type: "slider", min: 4, max: 60, step: 1, def: 24 },
      { key: "chips", label: "IC footprints", type: "slider", min: 0, max: 6, step: 1, def: 2 },
      { key: "grid", label: "Grid mm", type: "slider", min: 1.5, max: 8, step: 0.5, def: 3 },
      { key: "pad", label: "Pad size mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5 },
      { key: "vias", label: "Vias", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 4231 + 17);
      const G = Math.max(1, p.grid);
      const L = Math.round(p.layer);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer: L
        });
      };
      const circle = (cx, cy, r) => {
        const nn = Math.max(8, Math.round(r * 5));
        const c = [];
        for (let k = 0; k < nn; k++) {
          const a = (k / nn) * Math.PI * 2;
          c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return c;
      };
      const pad = (cx, cy) => {
        push(circle(cx, cy, p.pad / 2), true);
        push(circle(cx, cy, p.pad * 0.2), true);
      };
      const snap = (v) => Math.round(v / G) * G;
      const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      /* track sources: chip pins + loose pads */
      const sources = [];
      const nch = Math.round(p.chips);
      for (let c = 0; c < nch; c++) {
        const pins = 3 + Math.floor(rng() * 3);
        const horiz = rng() < 0.5;
        const wpx = (pins - 1) * G * 2, wpy = G * 4;
        const cx = snap(x0 + p.pad + rng() * (x1 - x0 - wpx - 2 * p.pad)) ;
        const cy = snap(y0 + p.pad + rng() * (y1 - y0 - (horiz ? wpy : wpx) - 2 * p.pad));
        for (let k = 0; k < pins; k++) {
          for (const side of [0, 1]) {
            const px = horiz ? cx + k * G * 2 : cx + side * wpy;
            const py = horiz ? cy + side * wpy : cy + k * G * 2;
            pad(px, py);
            const dirOut = horiz ? (side ? 2 : 6) : (side ? 0 : 4);
            sources.push([px, py, dirOut]);
          }
        }
        /* chip body outline */
        const bx0 = horiz ? cx - G : cx + G * 0.8, by0 = horiz ? cy + G * 0.8 : cy - G;
        const bx1 = horiz ? cx + wpx + G : cx + wpy - G * 0.8, by1 = horiz ? cy + wpy - G * 0.8 : cy + wpx + G;
        push([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], true);
      }
      const NT = Math.round(p.tracks);
      /* octilinear routed tracks: prefer long straights, 45-degree bends */
      for (let t = 0; t < NT; t++) {
        let sx, sy, d;
        if (t < sources.length) { [sx, sy, d] = sources[t]; }
        else {
          sx = snap(x0 + p.pad + rng() * (x1 - x0 - 2 * p.pad));
          sy = snap(y0 + p.pad + rng() * (y1 - y0 - 2 * p.pad));
          d = Math.floor(rng() * 8);
          pad(sx, sy);
        }
        const pts = [[sx, sy]];
        let x = sx, y = sy;
        const steps = 6 + Math.floor(rng() * Math.max(6, (x1 - x0) / G * 0.5));
        let run = 0;
        for (let i = 0; i < steps; i++) {
          const fits = (dd) => {
            const nx = x + DIR[dd][0] * G, ny = y + DIR[dd][1] * G;
            return nx >= x0 + p.pad && nx <= x1 - p.pad && ny >= y0 + p.pad && ny <= y1 - p.pad;
          };
          if (!fits(d)) {
            const sgn = rng() < 0.5 ? 1 : -1;
            let found = -1;
            for (const tr of [sgn, -sgn, 2 * sgn, -2 * sgn, 3 * sgn, -3 * sgn]) {
              const dd = ((d + tr) % 8 + 8) % 8;
              if (fits(dd)) { found = dd; break; }
            }
            if (found < 0) break;
            d = found;
          }
          x += DIR[d][0] * G; y += DIR[d][1] * G;
          pts.push([x, y]);
          run++;
          if (run >= 3 && rng() < 0.22) {
            d = ((d + (rng() < 0.5 ? 1 : 7)) % 8 + 8) % 8;
            run = 0;
          }
        }
        /* collapse spikes */
        for (let i = pts.length - 2; i >= 1; i--) {
          if (Math.abs(pts[i - 1][0] - pts[i + 1][0]) < 0.01 && Math.abs(pts[i - 1][1] - pts[i + 1][1]) < 0.01) pts.splice(i, 2);
        }
        if (pts.length < 2) continue;
        push(pts, false);
        pad(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        /* vias along the run */
        if (p.vias > 0.01) {
          for (let i = 2; i < pts.length - 2; i++) {
            if (rng() < p.vias * 0.12) push(circle(pts[i][0], pts[i][1], p.pad * 0.22), true);
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## pencycle.js

```js
import { Pin, EMPTY, PENS, mulberry32 } from "../helpers.js";

export default {
  key: "pencycle",
    name: "Pen Cycle", cat: "mod", group: "penout", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "group", label: "Paths per pen", type: "slider", min: 1, max: 20, step: 1, def: 1 },
      { key: "pens", label: "Pens to use", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "start", label: "Start pen", type: "pen", def: 0 },
      { key: "mode", label: "Mode", type: "select", options: ["Cycle", "Random"], def: "Cycle" },
      { key: "seed", label: "Seed", type: "seed", def: 35 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const g = Math.max(1, Math.round(p.group));
      const nP = Math.round(p.pens);
      const rng = mulberry32(p.seed * 449 + 13);
      let rndMap = null;
      if (p.mode === "Random") {
        rndMap = {};
      }
      const paths = src.paths.map((path, i) => {
        const grp = Math.floor(i / g);
        let pen;
        if (p.mode === "Random") {
          if (rndMap[grp] === undefined) rndMap[grp] = Math.floor(rng() * nP);
          pen = rndMap[grp];
        } else {
          pen = grp % nP;
        }
        return { ...path, layer: (Math.round(p.start) + pen) % PENS.length };
      });
      return { paths };
    },
  
};
```

## pendulum.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "pendulum",
    name: "Pendulum", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "arms", label: "Arms", type: "slider", min: 1, max: 3, step: 1, def: 2 },
      { key: "r1", label: "Arm 1 radius", type: "slider", min: 1, max: 100, step: 0.5, def: 50 },
      { key: "f1", label: "Arm 1 freq", type: "slider", min: 0.1, max: 20, step: 0.01, def: 2 },
      { key: "r2", label: "Arm 2 radius", type: "slider", min: 0, max: 100, step: 0.5, def: 22 },
      { key: "f2", label: "Arm 2 freq", type: "slider", min: 0.1, max: 40, step: 0.01, def: 5.03 },
      { key: "r3", label: "Arm 3 radius", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
      { key: "f3", label: "Arm 3 freq", type: "slider", min: 0.1, max: 60, step: 0.01, def: 11.1 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 1.2 },
      { key: "couple", label: "Coupling", type: "slider", min: 0, max: 2, step: 0.02, def: 0.4 },
      { key: "damp", label: "Damping", type: "slider", min: 0, max: 1.2, step: 0.01, def: 0.25 },
      { key: "table", label: "Table rotation (rev)", type: "slider", min: -4, max: 4, step: 0.05, def: 0.5 },
      { key: "turns", label: "Duration (turns)", type: "slider", min: 2, max: 120, step: 1, def: 30 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* ketjutetut vaimenevat heilurivarret; kytkenta: varren taajuutta
         moduloi edellisen varren kulma -> aito vuorovaikutus.
         Pyoriva poyta kuten oikeissa piirtokoneissa. */
      const nArms = Math.round(p.arms);
      const R = [p.r1, p.r2, p.r3];
      const F = [p.f1, p.f2, p.f3];
      const N = Math.min(30000, Math.round(p.turns * 400));
      const raw = [];
      const th = [0, 0, 0];
      const dt = p.turns / N;
      let t = 0;
      for (let i = 0; i <= N; i++) {
        const e = Math.exp(-p.damp * t);
        let x = 0, y = 0, prevAng = 0;
        for (let a = 0; a < nArms; a++) {
          /* taajuusmodulaatio edellisen varren kulmalla */
          const fEff = F[a] * (a === 0 ? 1 : 1 + p.couple * Math.sin(prevAng) * 0.5);
          th[a] += 2 * Math.PI * fEff * dt;
          const ang = th[a] + (a === 1 ? p.phase : a === 2 ? p.phase / 2 : 0);
          x += R[a] * e * Math.cos(ang);
          y += R[a] * e * Math.sin(ang);
          prevAng = ang;
        }
        /* poydan pyoriminen */
        const ta = 2 * Math.PI * p.table * (t / p.turns);
        const ca = Math.cos(ta), sa = Math.sin(ta);
        raw.push([x * ca - y * sa, x * sa + y * ca]);
        t += dt;
      }
      /* sovita canvasille */
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  
};
```

## phyllo.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "phyllo",
    name: "Phyllotaxis", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Count", type: "slider", min: 10, max: 1500, step: 10, def: 400 },
      { key: "c", label: "Spacing c", type: "slider", min: 0.5, max: 8, step: 0.1, def: 2.5 },
      { key: "angle", label: "Angle °", type: "slider", min: 100, max: 180, step: 0.1, def: 137.5 },
      { key: "mode", label: "Mode", type: "select", options: ["Dots", "Spiral"], def: "Dots" },
      { key: "dotR", label: "Dot size mm", type: "slider", min: 0.2, max: 6, step: 0.1, def: 1 },
      { key: "layer", label: "Pen", type: "pen", def: 2 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) / 2 - 8;
      const golden = (p.angle * Math.PI) / 180;
      const paths = [];
      const centers = [];
      for (let i = 0; i < p.count; i++) {
        const r = p.c * Math.sqrt(i);
        if (r > maxR) break;
        const a = i * golden;
        centers.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      if (p.mode === "Spiral") {
        if (centers.length > 1) paths.push({ pts: centers, closed: false, layer: Math.round(p.layer) });
      } else {
        for (const [x, y] of centers) {
          const pts = [];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            pts.push([x + Math.cos(a) * (p.dotR / 2), y + Math.sin(a) * (p.dotR / 2)]);
          }
          paths.push({ pts, closed: true, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## polkadots.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "polkadots",
    name: "Polka Dots",
    cat: "gen",
    group: "geometric",
    desc: "Plain dots or circles on a grid: Square rows, Hex (net-like offset rows), or Random with even spacing. Dot size 0 plots a bare pen touch; larger sizes draw circles. Size variation makes the field breathe.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "layout", label: "Layout", type: "select", options: ["Square", "Hex", "Random"], def: "Hex" },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 3, max: 40, step: 0.5, def: 10 },
      { key: "size", label: "Dot size mm", type: "slider", min: 0, max: 20, step: 0.25, def: 3 },
      { key: "vary", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 1 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 5 || y1 - y0 < 5) return applyStyle({ paths: [] }, ins[0]);
      const sp = Math.max(1.5, p.spacing);
      const rng = mulberry32(p.seed * 613 + 11);
      const pts = [];
      if (p.layout === "Square") {
        for (let y = y0 + sp / 2; y <= y1 - sp / 4; y += sp) {
          for (let x = x0 + sp / 2; x <= x1 - sp / 4; x += sp) pts.push([x, y]);
        }
      } else if (p.layout === "Hex") {
        const rh = sp * Math.sqrt(3) / 2;
        let row = 0;
        for (let y = y0 + sp / 2; y <= y1 - sp / 4; y += rh, row++) {
          const off = (row % 2) * (sp / 2);
          for (let x = x0 + sp / 2 + off; x <= x1 - sp / 4; x += sp) pts.push([x, y]);
        }
      } else {
        /* random with even-ish spacing: dart throwing with min distance */
        const target = Math.round(((x1 - x0) * (y1 - y0)) / (sp * sp));
        const minD = sp * 0.62;
        let guard = target * 40;
        while (pts.length < target && guard-- > 0) {
          const x = x0 + sp * 0.3 + rng() * (x1 - x0 - sp * 0.6);
          const y = y0 + sp * 0.3 + rng() * (y1 - y0 - sp * 0.6);
          let ok = true;
          for (const q of pts) {
            if (Math.abs(x - q[0]) < minD && Math.abs(y - q[1]) < minD && Math.hypot(x - q[0], y - q[1]) < minD) { ok = false; break; }
          }
          if (ok) pts.push([x, y]);
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      const BUDGET = 120000;
      let total = 0;
      for (const [x, y] of pts) {
        const r = Math.max(0, p.size / 2) * (p.vary > 0 ? 1 + (rng() - 0.5) * 2 * p.vary * 0.9 : 1);
        if (r < 0.3) {
          /* bare pen touch: a minimal down-up dab */
          if (total + 2 > BUDGET) break;
          total += 2;
          paths.push({ pts: [[x, y], [x + 0.1, y]], closed: false, layer: L });
        } else {
          const n = Math.max(8, Math.min(48, Math.round(r * 4)));
          if (total + n > BUDGET) break;
          total += n;
          const c = [];
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            c.push([
              Math.max(0.5, Math.min(W - 0.5, x + Math.cos(a) * r)),
              Math.max(0.5, Math.min(H - 0.5, y + Math.sin(a) * r))
            ]);
          }
          paths.push({ pts: c, closed: true, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## potato.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "potato",
      name: "Potato",
    cat: "gen", group: "nature",
    desc: "Asymmetric blobs (low-frequency harmonics + random squash) with optional eye texture as dots or curved arcs. Placement: No overlap keeps every potato fully separated using its true extent (fewer may fit on a tight sheet); Loose allows touching and light overlap.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Potatoes", type: "slider", min: 1, max: 60, step: 1, def: 9 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 120, step: 1, def: 38 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "irr", label: "Irregularity", type: "slider", min: 0, max: 0.6, step: 0.02, def: 0.22 },
      { key: "place", label: "Placement", type: "select", options: ["No overlap", "Loose (may overlap)"], def: "No overlap" },
      { key: "eyes", label: "Eyes (texture)", type: "select", options: ["None", "Dots", "Arcs (eyes)"], def: "Arcs (eyes)" },
      { key: "eyeCount", label: "Eyes per potato", type: "slider", min: 1, max: 30, step: 1, def: 7 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 73 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 2311 + 41);
      const L = Math.round(p.layer);
      const paths = [];
      const placed = []; /* [cx, cy, rMax, R] */
      const noOv = p.place !== "Loose (may overlap)";
      const target = Math.round(p.count);
      let guard = 0;
      while (placed.length < target && guard++ < target * 80) {
        const R = (p.size / 2) * (1 - p.sizeVar * rng());
        /* shape FIRST so the true extent is known before placement */
        const nH = 3;
        const amps = [], phs = [];
        for (let h = 0; h < nH; h++) {
          amps.push((p.irr * R * (0.4 + 0.6 * rng())) / (h + 1));
          phs.push(rng() * Math.PI * 2);
        }
        const squash = 0.75 + 0.2 * rng();
        const sqA = rng() * Math.PI;
        const rAt = (th) => {
          let r = R;
          for (let h = 0; h < nH; h++) r += amps[h] * Math.sin((h + 2) * th + phs[h]);
          return Math.max(R * 0.3, r);
        };
        const ca = Math.cos(sqA), sa = Math.sin(sqA);
        const shape = [];
        let rMax = 0;
        for (let k = 0; k < 72; k++) {
          const th = (k / 72) * Math.PI * 2;
          const r = rAt(th);
          let x = Math.cos(th) * r, y = Math.sin(th) * r;
          const u = x * ca + y * sa, v = -x * sa + y * ca;
          x = u * ca - v * squash * sa;
          y = u * sa + v * squash * ca;
          shape.push([x, y]);
          const d = Math.hypot(x, y);
          if (d > rMax) rMax = d;
        }
        const pad = noOv ? rMax : R;
        if (W - 2 * p.margin < 2 * pad || H - 2 * p.margin < 2 * pad) continue;
        const cx = p.margin + pad + rng() * (W - 2 * p.margin - 2 * pad);
        const cy = p.margin + pad + rng() * (H - 2 * p.margin - 2 * pad);
        let ok = true;
        for (const q of placed) {
          const d = Math.hypot(cx - q[0], cy - q[1]);
          if (noOv ? d < rMax + q[2] + 0.8 : d < (R + q[3]) * 0.75) { ok = false; break; }
        }
        if (!ok && (noOv || guard < target * 40)) continue;
        placed.push([cx, cy, rMax, R]);
        paths.push({ pts: shape.map(([x, y]) => [cx + x, cy + y]), closed: true, layer: L });
        /* silmat */
        if (p.eyes !== "None") {
          for (let e = 0; e < Math.round(p.eyeCount); e++) {
            const th = rng() * Math.PI * 2;
            const rr = Math.sqrt(rng()) * 0.62 * rAt(th) * squash;
            const ex = cx + Math.cos(th) * rr;
            const ey = cy + Math.sin(th) * rr;
            if (p.eyes === "Dots") {
              const er = 0.5 + rng() * 0.9;
              const dot = [];
              for (let q = 0; q < 7; q++) {
                const a = (q / 7) * Math.PI * 2;
                dot.push([ex + Math.cos(a) * er, ey + Math.sin(a) * er]);
              }
              paths.push({ pts: dot, closed: true, layer: L });
            } else {
              const ea = rng() * Math.PI * 2;
              const el = 1 + rng() * 2.2;
              const eca = Math.cos(ea), esa = Math.sin(ea);
              const arc = [[-el, -el * 0.25], [-el * 0.35, el * 0.28], [el * 0.35, el * 0.28], [el, -el * 0.25]];
              paths.push({
                pts: arc.map(([ax, ay]) => [ex + ax * eca - ay * esa, ey + ax * esa + ay * eca]),
                closed: false, layer: L,
              });
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## powerpole.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "powerpole",
    name: "Power Pole",
    cat: "gen",
    group: "structural",
    desc: "Wireframe 3D utility poles: Finnish Wood (single pole, crossarm, pin insulators, guy wire), US Utility (double crossarm, cylinder transformer), Japanese Concrete (stacked arms, transformer drums). The Wires toggle hangs catenary cables from the insulators. Rotate with Yaw and Pitch - wire Frame into Yaw to orbit.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "model", label: "Model", type: "select", options: ["Finnish Wood", "US Utility", "Japanese Concrete"], def: "Finnish Wood" },
      { key: "height", label: "Height mm", type: "slider", min: 60, max: 260, step: 5, def: 180 },
      { key: "wires", label: "Wires", type: "check", def: true },
      { key: "sag", label: "Wire sag", type: "slider", min: 0.02, max: 0.3, step: 0.01, def: 0.1 },
      { key: "yaw", label: "Yaw deg (wire Frame)", type: "slider", min: 0, max: 360, step: 1, def: 25 },
      { key: "pitch", label: "Pitch deg", type: "slider", min: -10, max: 40, step: 1, def: 8 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 4 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 911 + 5);
      const HT = p.height;
      const segs = [];   /* [x1,y1,z1,x2,y2,z2] , y up */
      const rings = [];  /* horizontal circles: {x,y,z,r,n} */
      const line = (a, b) => segs.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
      const ring = (x, y, z, r, n) => rings.push({ x, y, z, r, n: n || Math.max(8, Math.round(r * 3)) });
      /* tapered square post: 4 corner edges + top square (+optional base square) */
      const post = (cx, cz, y0, y1, r0, r1, topSquare) => {
        const c0 = [[-r0, -r0], [r0, -r0], [r0, r0], [-r0, r0]];
        const c1 = [[-r1, -r1], [r1, -r1], [r1, r1], [-r1, r1]];
        for (let k = 0; k < 4; k++) line([cx + c0[k][0], y0, cz + c0[k][1]], [cx + c1[k][0], y1, cz + c1[k][1]]);
        if (topSquare) for (let k = 0; k < 4; k++) {
          const nk = (k + 1) % 4;
          line([cx + c1[k][0], y1, cz + c1[k][1]], [cx + c1[nk][0], y1, cz + c1[nk][1]]);
        }
      };
      /* round wooden pole: 2 front/back edges + a couple of rings (light wireframe) */
      const wood = (cx, cz, y0, y1, r0, r1) => {
        line([cx - r0, y0, cz], [cx - r1, y1, cz]);
        line([cx + r0, y0, cz], [cx + r1, y1, cz]);
        ring(cx, y1, cz, r1);
        ring(cx, y0 + (y1 - y0) * 0.5, cz, (r0 + r1) / 2);
      };
      /* pin insulator: stub up + small disc */
      const pin = (x, y, z) => {
        line([x, y, z], [x, y + HT * 0.03, z]);
        ring(x, y + HT * 0.03, z, HT * 0.012, 8);
        return [x, y + HT * 0.03, z];
      };
      /* hanging insulator string: vertical + 3 discs, returns bottom attach point */
      const stringIns = (x, y, z) => {
        const len = HT * 0.07;
        line([x, y, z], [x, y - len, z]);
        for (let k = 1; k <= 3; k++) ring(x, y - (len * k) / 3.5, z, HT * 0.012, 8);
        return [x, y - len, z];
      };
      /* transformer cylinder mounted at side: axis vertical */
      const transformer = (x, y, z, r, h) => {
        ring(x, y, z, r); ring(x, y + h, z, r);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          line([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r]);
        }
      };
      const attach = []; /* wire attachment points */
      const M = p.model;

      if (M === "Finnish Wood") {
        wood(0, 0, 0, HT, HT * 0.018, HT * 0.011);
        const ay = HT * 0.93, aw = HT * 0.18;
        line([-aw, ay, 0], [aw, ay, 0]);                       /* crossarm */
        line([-aw, ay - HT * 0.006, 0], [aw, ay - HT * 0.006, 0]);
        line([-aw * 0.55, ay, 0], [0, ay - HT * 0.08, 0]);     /* brackets */
        line([aw * 0.55, ay, 0], [0, ay - HT * 0.08, 0]);
        attach.push(pin(-aw * 0.85, ay, 0), pin(0, HT, 0), pin(aw * 0.85, ay, 0));
        /* guy wire to ground */
        line([0, HT * 0.85, 0], [HT * 0.32, 0, HT * 0.1]);
      } else if (M === "US Utility") {
        wood(0, 0, 0, HT, HT * 0.02, HT * 0.012);
        for (const [ay, aw] of [[HT * 0.95, HT * 0.2], [HT * 0.85, HT * 0.17]]) {
          line([-aw, ay, 0], [aw, ay, 0]);
          line([-aw, ay - HT * 0.006, 0], [aw, ay - HT * 0.006, 0]);
          line([-aw * 0.5, ay, 0], [0, ay - HT * 0.06, 0]);
          line([aw * 0.5, ay, 0], [0, ay - HT * 0.06, 0]);
          for (const fx of [-0.85, -0.4, 0.4, 0.85]) attach.push(pin(aw * fx, ay, 0));
        }
        transformer(HT * 0.05, HT * 0.62, HT * 0.05, HT * 0.045, HT * 0.1);
        /* telecom line lower: simple attachment both sides */
        attach.push([0, HT * 0.45, 0]);
      } else if (M === "Japanese Concrete") {
        wood(0, 0, 0, HT, HT * 0.022, HT * 0.013);
        ring(0, HT * 0.3, 0, HT * 0.02); ring(0, HT * 0.6, 0, HT * 0.017);
        for (const [ay, aw, nz] of [[HT * 0.97, HT * 0.13, 0], [HT * 0.9, HT * 0.11, HT * 0.02], [HT * 0.82, HT * 0.12, -HT * 0.02], [HT * 0.74, HT * 0.1, 0]]) {
          line([-aw, ay, nz], [aw, ay, nz]);
          attach.push(pin(-aw * 0.8, ay, nz), pin(aw * 0.8, ay, nz));
        }
        transformer(HT * 0.07, HT * 0.55, 0, HT * 0.05, HT * 0.11);
        transformer(-HT * 0.07, HT * 0.42, HT * 0.03, HT * 0.045, HT * 0.1);
      }

      /* wires: catenary along +-Z from each attach point */
      const wires3 = [];
      if (p.wires) {
        const span = HT * 0.95;
        for (const a of attach) {
          for (const dir of [-1, 1]) {
            const sagAmt = span * p.sag * (0.8 + rng() * 0.4);
            const wpts = [];
            const n = 14;
            for (let k = 0; k <= n; k++) {
              const t = k / n;
              const dy = -sagAmt * (1 - (2 * t - 1) * (2 * t - 1));
              wpts.push([a[0], a[1] + dy + t * t * 0, a[2] + dir * t * span]);
            }
            wires3.push(wpts);
          }
        }
      }
      /* project: yaw around vertical, pitch, perspective; fit */
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      const FOC = HT * 2 * (0.8 + 6 * (1 - p.persp));
      const proj = (x, y, z) => {
        const X = x * cy2 + z * sy2;
        let Z = -x * sy2 + z * cy2;
        const Y = y * cp2 - Z * sp2;
        Z = y * sp2 + Z * cp2;
        const sc = FOC / Math.max(FOC * 0.12, FOC + Z);
        return [X * sc, -Y * sc];
      };
      const polys = [];
      for (const s of segs) polys.push({ pts: [proj(s[0], s[1], s[2]), proj(s[3], s[4], s[5])], closed: false });
      for (const r of rings) {
        const c = [];
        for (let k = 0; k < r.n; k++) {
          const a = (k / r.n) * Math.PI * 2;
          c.push(proj(r.x + Math.cos(a) * r.r, r.y, r.z + Math.sin(a) * r.r));
        }
        polys.push({ pts: c, closed: true });
      }
      for (const wpts of wires3) polys.push({ pts: wpts.map((q) => proj(q[0], q[1], q[2])), closed: false });
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const pl of polys) for (const [x, y] of pl.pts) {
        if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const L = Math.round(p.layer);
      const paths = polys.map((pl) => ({
        pts: pl.pts.map(([x, y]) => [
          Math.max(0.5, Math.min(W - 0.5, x * sc + ox)),
          Math.max(0.5, Math.min(H - 0.5, y * sc + oy))
        ]),
        closed: pl.closed, layer: L
      }));
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## radat.js

```js
import { Pin, noise2, applyStyle } from "../helpers.js";

export default {
  key: "radat",
    name: "Tracks", cat: "gen", group: "geometric", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "rings", label: "Loops", type: "slider", min: 1, max: 30, step: 1, def: 10 },
      { key: "gap", label: "Gap mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "wob", label: "Shape noise", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "drift", label: "Drift", type: "slider", min: 0, max: 20, step: 0.5, def: 4 },
      { key: "seed", label: "Seed", type: "seed", def: 7 },
      { key: "layer", label: "Pen", type: "pen", def: 1 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) / 2 - 8;
      const paths = [];
      for (let r = 0; r < p.rings; r++) {
        const base = maxR - r * p.gap;
        if (base < 3) break;
        const ox = (noise2(r * 0.7, 0.3, p.seed) - 0.5) * 2 * p.drift * (r / Math.max(1, p.rings));
        const oy = (noise2(0.3, r * 0.7, p.seed + 9) - 0.5) * 2 * p.drift * (r / Math.max(1, p.rings));
        const N = Math.max(24, Math.floor(base * 1.2));
        const pts = [];
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          const wob = (noise2(Math.cos(a) * 1.3 + r * 0.31, Math.sin(a) * 1.3, p.seed + 40) - 0.5) * 2 * p.wob;
          const rr = base + wob;
          pts.push([cx + ox + Math.cos(a) * rr * (W / Math.min(W, H)) * 0.9, cy + oy + Math.sin(a) * rr]);
        }
        paths.push({ pts, closed: true, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## randlines.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "randlines",
    name: "Random Lines", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Lines", type: "slider", min: 2, max: 600, step: 1, def: 80 },
      { key: "mode", label: "Mode", type: "select", options: ["Free (2 random points)", "Fixed length"], def: "Fixed length" },
      { key: "length", label: "Length mm", type: "slider", min: 2, max: 200, step: 1, def: 30 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "angles", label: "Angles", type: "select", options: ["Any", "Horizontal + Vertical", "Diagonals", "Quantized 45°"], def: "Any" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 53 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 997 + 3);
      const L = Math.round(p.layer);
      const m = p.margin;
      const paths = [];
      const rx = () => m + rng() * (W - 2 * m);
      const ry = () => m + rng() * (H - 2 * m);
      const clampP = (q) => [Math.max(m, Math.min(W - m, q[0])), Math.max(m, Math.min(H - m, q[1]))];
      for (let i = 0; i < Math.round(p.count); i++) {
        if (p.mode === "Free (2 random points)") {
          paths.push({ pts: [[rx(), ry()], [rx(), ry()]], closed: false, layer: L });
        } else {
          const cx = rx(), cy = ry();
          let a;
          if (p.angles === "Horizontal + Vertical") a = rng() > 0.5 ? 0 : Math.PI / 2;
          else if (p.angles === "Diagonals") a = rng() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
          else if (p.angles === "Quantized 45°") a = Math.floor(rng() * 4) * (Math.PI / 4);
          else a = rng() * Math.PI;
          const len = Math.max(1, p.length * (1 - p.lenVar * rng()));
          const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
          paths.push({ pts: [clampP([cx - dx, cy - dy]), clampP([cx + dx, cy + dy])], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## raydrape.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "raydrape",
    name: "Ray",
    cat: "duo",
    desc: "Houdini-style Ray: every point of A is cast along a direction until it hits B's lines, so A drapes over B like fabric or rain. Points that miss keep their place (or drop). Offset lands the line slightly before the surface.",
    ins: [Pin("paths", "A (to project)"), Pin("paths", "B (targets)")],
    outs: [Pin("paths")],
    params: [
      { key: "angle", label: "Direction deg (90=down)", type: "slider", min: 0, max: 360, step: 1, def: 90 },
      { key: "maxd", label: "Max distance mm (0=inf)", type: "slider", min: 0, max: 300, step: 5, def: 0 },
      { key: "offset", label: "Offset from surface mm", type: "slider", min: 0, max: 10, step: 0.25, def: 0.5 },
      { key: "misses", label: "Keep misses in place", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 }
    ],
    compute(ins, p, ctx) {
      const A = ins[0] || EMPTY, B = ins[1] || EMPTY;
      if (!B.paths || !B.paths.length) {
        return { paths: A.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      const segs = [];
      for (const pa of B.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
        }
      }
      const a = (p.angle * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);
      const maxd = p.maxd > 0 ? p.maxd : 1e9;
      /* ray (px,py)+t(dx,dy) vs segment: standard 2x2 solve */
      const cast = (px, py) => {
        let best = Infinity;
        for (const s of segs) {
          const ex = s[2] - s[0], ey = s[3] - s[1];
          const den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-12) continue;
          const qx = s[0] - px, qy = s[1] - py;
          const t = (qx * ey - qy * ex) / den;
          const u = (qx * dy - qy * dx) / den;
          if (t >= 0 && t <= maxd && u >= 0 && u <= 1 && t < best) best = t;
        }
        return best;
      };
      const paths = [];
      A.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        const out = [];
        for (const [px, py] of pts) {
          const t = cast(px, py);
          if (t === Infinity) {
            if (p.misses) out.push([px, py]);
            else { if (out.length > 1) paths.push({ pts: out.slice(), closed: false, layer: path.layer }); out.length = 0; }
          } else {
            const tt = Math.max(0, t - p.offset);
            out.push([px + dx * tt, py + dy * tt]);
          }
        }
        if (out.length > 1) paths.push({ pts: out, closed: path.closed && p.misses, layer: path.layer });
      });
      return { paths };
    }
  
};
```

## rectcollage.js

```js
import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "rectcollage",
    name: "Rect Collage",
    cat: "mod",
    group: "cutsplit",
    desc: "Cuts random rectangles of different sizes out of the input and rearranges the pieces at random positions (optionally rotated in 90-degree steps). Unlike Tile Shuffle's regular grid, pieces vary in size and land anywhere. Keep rest passes the uncut remainder through underneath.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "pieces", label: "Pieces", type: "slider", min: 1, max: 24, step: 1, def: 8 },
      { key: "minSize", label: "Min size mm", type: "slider", min: 5, max: 80, step: 1, def: 15 },
      { key: "maxSize", label: "Max size mm", type: "slider", min: 10, max: 160, step: 1, def: 60 },
      { key: "rotate", label: "Rotate 90 steps", type: "check", def: true },
      { key: "keepRest", label: "Keep rest", type: "check", def: false },
      { key: "res", label: "Cut step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 8 },
      { key: "seed", label: "Seed", type: "seed", def: 6 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const rng = mulberry32(p.seed * 7213 + 3);
      const lo = Math.min(p.minSize, p.maxSize), hi2 = Math.max(p.minSize, p.maxSize);
      const NP = Math.round(p.pieces);
      /* source rects + target placements */
      const rects = [];
      for (let i = 0; i < NP; i++) {
        const rw = lo + rng() * (hi2 - lo);
        const rh = lo + rng() * (hi2 - lo);
        const sx = rng() * Math.max(1, W - rw);
        const sy = rng() * Math.max(1, H - rh);
        const rot = p.rotate ? Math.floor(rng() * 4) : 0;
        const tw = rot % 2 ? rh : rw, th = rot % 2 ? rw : rh;
        const tx = m + rng() * Math.max(1, W - 2 * m - tw);
        const ty = m + rng() * Math.max(1, H - 2 * m - th);
        rects.push({ sx, sy, rw, rh, rot, tx, ty });
      }
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const emit = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        out.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      const step = Math.max(0.2, p.res);
      /* per piece: clip source runs inside rect, map to target with rotation */
      for (const R of rects) {
        const inR = (x, y) => x >= R.sx && x <= R.sx + R.rw && y >= R.sy && y <= R.sy + R.rh;
        const map = (x, y) => {
          let u = x - R.sx, v = y - R.sy; /* 0..rw, 0..rh */
          let a, b2;
          if (R.rot === 0) { a = u; b2 = v; }
          else if (R.rot === 1) { a = R.rh - v; b2 = u; }
          else if (R.rot === 2) { a = R.rw - u; b2 = R.rh - v; }
          else { a = v; b2 = R.rw - u; }
          return [R.tx + a, R.ty + b2];
        };
        for (const pa of src.paths) {
          const pts = resample(pa.pts, pa.closed, step);
          let run = [];
          let all = true;
          for (const [x, y] of pts) {
            if (inR(x, y)) run.push(map(x, y));
            else {
              all = false;
              if (run.length > 1) emit(run, false, pa.layer);
              run = [];
            }
          }
          if (all && pa.closed && run.length > 2) emit(run, true, pa.layer);
          else if (run.length > 1) emit(run, false, pa.layer);
        }
      }
      /* keep the uncut remainder */
      if (p.keepRest) {
        for (const pa of src.paths) {
          const pts = resample(pa.pts, pa.closed, step);
          let run = [];
          let all = true;
          for (const [x, y] of pts) {
            const cut = rects.some((R) => x >= R.sx && x <= R.sx + R.rw && y >= R.sy && y <= R.sy + R.rh);
            if (!cut) run.push([x, y]);
            else {
              all = false;
              if (run.length > 1) emit(run, false, pa.layer);
              run = [];
            }
          }
          if (all && pa.closed && run.length > 2) emit(run, true, pa.layer);
          else if (run.length > 1) emit(run, false, pa.layer);
        }
      }
      return { paths: out };
    }
  
};
```

## regmarks.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "regmarks",
      name: "Reg Marks",
    cat: "gen", group: "structural",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "style", label: "Style", type: "select", options: ["Cross +", "Registration (circle + cross)", "Corner L"], def: "Cross +" },
      { key: "size", label: "Size mm", type: "slider", min: 2, max: 30, step: 0.5, def: 8 },
      { key: "insetX", label: "Inset X mm", type: "slider", min: 0, max: 100, step: 0.5, def: 10 },
      { key: "insetY", label: "Inset Y mm", type: "slider", min: 0, max: 100, step: 0.5, def: 10 },
      { key: "tl", label: "Top left", type: "check", def: true },
      { key: "tr", label: "Top right", type: "check", def: true },
      { key: "bl", label: "Bottom left", type: "check", def: true },
      { key: "br", label: "Bottom right", type: "check", def: true },
      { key: "center", label: "Center mark", type: "check", def: false },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const r = p.size / 2;
      const paths = [];
      const cross = (x, y) => {
        paths.push({ pts: [[x - r, y], [x + r, y]], closed: false, layer: L });
        paths.push({ pts: [[x, y - r], [x, y + r]], closed: false, layer: L });
      };
      const circle = (x, y, cr) => {
        const pts = [];
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * Math.PI * 2;
          pts.push([x + Math.cos(a) * cr, y + Math.sin(a) * cr]);
        }
        paths.push({ pts, closed: true, layer: L });
      };
      /* L-merkki: kulman suuntainen — sx/sy kertovat mihin suuntaan viivat osoittavat */
      const cornerL = (x, y, sx, sy) => {
        paths.push({ pts: [[x, y], [x + sx * p.size, y]], closed: false, layer: L });
        paths.push({ pts: [[x, y], [x, y + sy * p.size]], closed: false, layer: L });
      };
      const mark = (x, y, sx, sy) => {
        if (p.style === "Cross +") cross(x, y);
        else if (p.style === "Registration (circle + cross)") {
          cross(x, y);
          circle(x, y, r * 0.62);
        } else cornerL(x, y, sx, sy);
      };
      if (p.tl) mark(p.insetX, p.insetY, 1, 1);
      if (p.tr) mark(W - p.insetX, p.insetY, -1, 1);
      if (p.bl) mark(p.insetX, H - p.insetY, 1, -1);
      if (p.br) mark(W - p.insetX, H - p.insetY, -1, -1);
      if (p.center) mark(W / 2, H / 2, 1, 1);
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## reverse.js

```js
import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "reverse",
      name: "Reverse",
    cat: "mod", group: "pathops",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Which paths", type: "select", options: ["All", "Every 2nd", "Random"], def: "All" },
      { key: "seed", label: "Seed (random)", type: "seed", def: 83 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rng = mulberry32(p.seed * 431 + 3);
      const paths = src.paths.map((path, i) => {
        let flip;
        if (p.mode === "All") flip = true;
        else if (p.mode === "Every 2nd") flip = i % 2 === 1;
        else flip = rng() > 0.5;
        return flip ? { ...path, pts: [...path.pts].reverse() } : path;
      });
      return { paths };
    }
  
};
```

## ribbon.js

```js
import { Pin, noise2, applyStyle } from "../helpers.js";

export default {
  key: "ribbon",
    name: "Ribbon", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "wander", label: "Wander mm", type: "slider", min: 0, max: 120, step: 1, def: 45 },
      { key: "wscale", label: "Wander scale", type: "slider", min: 0.2, max: 4, step: 0.1, def: 1 },
      { key: "width", label: "Width mm", type: "slider", min: 2, max: 80, step: 0.5, def: 28 },
      { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8 },
      { key: "lines", label: "Lines", type: "slider", min: 1, max: 60, step: 1, def: 24 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 27 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      /* selkäranka: vasemmalta oikealle, pystysuuntainen kohinavaellus */
      const N = 160;
      const bb = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = p.margin + (W - 2 * p.margin) * t;
        const y = H / 2 + (noise2(t * 4 * p.wscale, 3.3, p.seed) - 0.5) * 2 * p.wander;
        bb.push([x, Math.max(p.margin, Math.min(H - p.margin, y))]);
      }
      /* leveys(t): kohina, pinch lähelle nollaa */
      const widthAt = (t) => {
        const v = noise2(t * 5 * p.wscale + 40, 8.8, p.seed + 9);
        const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
        return Math.max(0.3, w);
      };
      const normals = bb.map((pt, i) => {
        const nI = Math.min(i + 1, bb.length - 1), pI = Math.max(i - 1, 0);
        const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        return [-ty / tl, tx / tl];
      });
      const K = Math.round(p.lines);
      const paths = [];
      for (let k = 0; k < K; k++) {
        const f = K === 1 ? 0 : k / (K - 1) - 0.5;
        const pts = bb.map((pt, i) => {
          const w = widthAt(i / N);
          return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
        });
        paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## ruler.js

```js
import { Pin, resample, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "ruler",
    name: "Ruler", cat: "gen", group: "scientific", ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "scale", label: "Scale", type: "select", options: ["Linear", "Logarithmic (slide rule)"], def: "Linear" },
      { key: "spacing", label: "Tick spacing mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 2 },
      { key: "decades", label: "Decades (log)", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "minor", label: "Minor tick mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 3 },
      { key: "major", label: "Major tick mm", type: "slider", min: 1, max: 40, step: 0.25, def: 8 },
      { key: "side", label: "Ticks side", type: "select", options: ["Up", "Down", "Both"], def: "Up" },
      { key: "baseline", label: "Draw baseline", type: "check", def: true },
      { key: "labels", label: "Every 10th tick", type: "select", options: ["None", "Numbers", "Symbols"], def: "Numbers" },
      { key: "lsize", label: "Label size mm", type: "slider", min: 1, max: 15, step: 0.25, def: 4 },
      { key: "lstep", label: "Number step", type: "slider", min: 1, max: 100, step: 1, def: 1 },
      { key: "margin", label: "Margin mm (no spine)", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const spines = ins[0] && ins[0].paths && ins[0].paths.length
        ? ins[0].paths
        : [{ pts: [[p.margin, H / 2], [W - p.margin, H / 2]], closed: false, layer: L }];
      const paths = [];
      const SYMS = ["circle", "triangle", "square", "plus", "cross"];
      const symbolAt = (kind, x, y, r, ca, sa, layer) => {
        const T = ([lx, ly]) => [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
        if (kind === "circle") {
          const pts = [];
          for (let q = 0; q < 12; q++) {
            const a = (q / 12) * Math.PI * 2;
            pts.push(T([Math.cos(a) * r, Math.sin(a) * r]));
          }
          paths.push({ pts, closed: true, layer });
        } else if (kind === "triangle") {
          const pts = [0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2 - Math.PI / 2;
            return T([Math.cos(a) * r, Math.sin(a) * r]);
          });
          paths.push({ pts, closed: true, layer });
        } else if (kind === "square") {
          paths.push({ pts: [T([-r, -r]), T([r, -r]), T([r, r]), T([-r, r])], closed: true, layer });
        } else if (kind === "plus") {
          paths.push({ pts: [T([-r, 0]), T([r, 0])], closed: false, layer });
          paths.push({ pts: [T([0, -r]), T([0, r])], closed: false, layer });
        } else {
          paths.push({ pts: [T([-r, -r]), T([r, r])], closed: false, layer });
          paths.push({ pts: [T([r, -r]), T([-r, r])], closed: false, layer });
        }
      };
      for (const spine of spines) {
        const base = resample(spine.pts, spine.closed, 0.6);
        if (base.length < 2) continue;
        const closed = !!spine.closed;
        const pts2 = closed ? [...base, base[0]] : base;
        const cum = [0];
        for (let i = 1; i < pts2.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts2[i][0] - pts2[i - 1][0], pts2[i][1] - pts2[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 2) continue;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = pts2[lo][0] + (pts2[hi][0] - pts2[lo][0]) * f;
          const y = pts2[lo][1] + (pts2[hi][1] - pts2[lo][1]) * f;
          const tx = pts2[hi][0] - pts2[lo][0], ty = pts2[hi][1] - pts2[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };
        if (p.baseline) paths.push({ pts: base.map((q) => q.slice()), closed, layer: spine.layer !== undefined ? spine.layer : L });
        /* tick-lista: [s, rank(0=minor,1=medium,2=major), labelValue] */
        const ticks = [];
        if (p.scale === "Linear") {
          const n = Math.floor(total / Math.max(0.3, p.spacing));
          for (let k = 0; k <= n; k++) {
            if (closed && k === n && (k * p.spacing) >= total - 0.01) break;
            ticks.push([k * p.spacing, k % 10 === 0 ? 2 : k % 5 === 0 ? 1 : 0, (k / 10) * p.lstep]);
          }
        } else {
          const D = Math.round(p.decades);
          const unit = total / D;
          for (let d = 0; d < D; d++) {
            for (let v = 10; v < 100; v++) {
              const s = (d + Math.log10(v / 10)) * unit;
              ticks.push([s, v % 10 === 0 ? 2 : v % 5 === 0 ? 1 : 0, v / 10]);
            }
          }
          ticks.push([total, 2, 10]);
        }
        let majorIdx = 0;
        for (const [s, rank, val] of ticks) {
          const [x, y, tx, ty] = at(s);
          const nx = -ty, ny = tx;
          const len = rank === 2 ? p.major : rank === 1 ? (p.minor + p.major) / 2 : p.minor;
          let a0 = 0, a1 = 0;
          if (p.side === "Up") { a0 = 0; a1 = -len; }
          else if (p.side === "Down") { a0 = 0; a1 = len; }
          else { a0 = -len / 2; a1 = len / 2; }
          paths.push({
            pts: [[x + nx * a0, y + ny * a0], [x + nx * a1, y + ny * a1]],
            closed: false, layer: L,
          });
          if (rank === 2 && p.labels !== "None") {
            const off = (p.side === "Down" ? len : -len) + (p.side === "Down" ? 1.5 : -1.5);
            const lx = x + nx * off, ly = y + ny * off;
            if (p.labels === "Symbols") {
              symbolAt(SYMS[majorIdx % SYMS.length], lx + nx * (p.side === "Down" ? p.lsize / 2 : -p.lsize / 2), ly + ny * (p.side === "Down" ? p.lsize / 2 : -p.lsize / 2) * 1, p.lsize / 2, tx, ty, L);
            } else {
              const label = p.scale === "Linear"
                ? String(Math.round(val * 100) / 100)
                : String(Math.round(val * 10) / 10);
              const fs = fontStrokes(label, p.lsize, 1);
              /* keskita tekstin leveys tickin kohdalle, ylareuna tickin karjesta poispain */
              const bx = -fs.width / 2;
              const by = p.side === "Down" ? 0 : -p.lsize;
              for (const stroke of fs.strokes) {
                paths.push({
                  pts: stroke.map(([gx, gy]) => {
                    const ox = bx + gx, oy = by + gy;
                    return [lx + ox * tx + oy * nx, ly + ox * ty + oy * ny];
                  }),
                  closed: false, layer: L,
                });
              }
            }
            majorIdx++;
          }
        }
      }
      return applyStyle({ paths }, ins[1]);
    },
  
};
```

## runes.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "runes",
    name: "Runes",
    cat: "gen",
    group: "textimg",
    desc: "Asemic writing: a seeded alphabet of invented angular glyphs, laid out in words and lines like real text. Because letters repeat from a finite alphabet, it reads as language. Complexity sets strokes per glyph; every seed is a new script.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "size", label: "Glyph height mm", type: "slider", min: 3, max: 20, step: 0.5, def: 7 },
      { key: "alphabet", label: "Alphabet size", type: "slider", min: 6, max: 30, step: 1, def: 16 },
      { key: "complexity", label: "Strokes per glyph", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "linesp", label: "Line spacing", type: "slider", min: 1.2, max: 3, step: 0.1, def: 1.8 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "seed", label: "Seed", type: "seed", def: 77 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const gh = Math.max(2, p.size);
      const gw = gh * 0.62;
      /* build a seeded alphabet: glyphs = strokes on a 3x4 lattice */
      const K = Math.max(4, Math.min(40, Math.round(p.alphabet)));
      const CPX = Math.max(1, Math.min(8, Math.round(p.complexity)));
      const rng = mulberry32(p.seed * 3323 + 7);
      const LX = 3, LY = 4;
      const alphabet = [];
      for (let g = 0; g < K; g++) {
        const strokes = [];
        const nStrokes = 1 + Math.floor(rng() * CPX);
        for (let s = 0; s < nStrokes; s++) {
          /* each stroke: 2-3 lattice points, no zero-length hops */
          const nPts = 2 + (rng() < 0.4 ? 1 : 0);
          const pts = [];
          let last = -1;
          for (let i = 0; i < nPts; i++) {
            let pt;
            do { pt = Math.floor(rng() * LX * LY); } while (pt === last);
            last = pt;
            pts.push([(pt % LX) / (LX - 1), Math.floor(pt / LX) / (LY - 1)]);
          }
          strokes.push(pts);
        }
        /* every glyph gets a baseline anchor stroke sometimes (stability) */
        if (rng() < 0.35) strokes.push([[0, 1], [1, 1]]);
        alphabet.push(strokes);
      }
      /* text stream: seeded glyph sequence with Zipf-ish letter frequency + words */
      const paths = [];
      const L = Math.round(p.layer);
      const lineH = gh * Math.max(1.1, p.linesp);
      const step = gw * 1.28;
      const space = gw * 0.9;
      const zipf = () => {
        /* low indices much more common, like real letters */
        const r = rng();
        return Math.min(K - 1, Math.floor(K * r * r));
      };
      let y = y0;
      while (y + gh <= y1) {
        let x = x0;
        let word = 2 + Math.floor(rng() * 7);
        while (x + gw <= x1) {
          if (word <= 0) {
            x += space;
            word = 2 + Math.floor(rng() * 7);
            continue;
          }
          const strokes = alphabet[zipf()];
          for (const st of strokes) {
            const pts = st.map(([u, v]) => [x + u * gw, y + v * gh]);
            paths.push({ pts, closed: false, layer: L });
          }
          x += step;
          word--;
        }
        y += lineH;
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## sand_line_hatch.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "sand_line_hatch",
    name: "Sand Line Hatch",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 1337 },
      { key: "lines", label: "Line Count", type: "slider", min: 10, max: 200, step: 1, def: 80 },
      { key: "density", label: "Max Density", type: "slider", min: 0.1, max: 1.0, step: 0.05, def: 0.7 },
      { key: "freq", label: "Noise Frequency", type: "slider", min: 0.001, max: 0.05, step: 0.001, def: 0.015 },
      { key: "grain_len", label: "Grain Length (mm)", type: "slider", min: 0.5, max: 5.0, step: 0.1, def: 1.5 },
      { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      if (W - 2 * m < 5 || H - 2 * m < 5) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 997 + 11);
      const paths = [];
      const L = Math.round(p.layer);
      const count = Math.round(p.lines);
      const grainSize = Math.max(0.2, p.grain_len);
      const dens = Math.max(0, Math.min(1, p.density));

      for (let i = 0; i < count; i++) {
        const y = m + ((H - 2 * m) * (i / (count - 1 || 1)));
        const lineSegs = [];
        let x = m;
        let runStart = null;
        while (x < W - m) {
          const noiseVal = noise2(x * p.freq, y * p.freq, p.seed);
          /* darkness = noise * density: density now scales ink amount correctly
             (the old rng()*density threshold was inverted: low density = MORE ink) */
          if (rng() < noiseVal * dens) {
            if (runStart === null) runStart = x;
            x = Math.min(x + grainSize, W - m);
          } else {
            if (runStart !== null && x - runStart > 0.1) {
              lineSegs.push([[runStart, y], [x, y]]); /* runs are collinear: 2 pts suffice */
            }
            runStart = null;
            x += grainSize * (0.5 + rng() * 0.5);
          }
        }
        if (runStart !== null && x - runStart > 0.1) {
          lineSegs.push([[runStart, y], [Math.min(x, W - m), y]]);
        }
        /* serpentine: alternate line direction so the pen never shuttles back empty */
        if (i % 2 === 1) {
          lineSegs.reverse();
          for (const seg of lineSegs) seg.reverse();
        }
        for (const seg of lineSegs) paths.push({ pts: seg, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## satunnainen.js

```js
import { Pin, mulberry32 } from "../helpers.js";

export default {
  key: "satunnainen",
    name: "Random", cat: "math", ins: [], outs: [Pin("value")],
    params: [
      { key: "min", label: "Min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 11 },
    ],
    compute(_ins, p) {
      const rng = mulberry32(p.seed * 2749 + 331);
      return p.min + rng() * (p.max - p.min);
    },
  
};
```

## scan.js

```js
import { Pin, mulberry32, noise2, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "scan",
    name: "Seismic", cat: "gen", group: "scientific",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "size", label: "Size mm", type: "slider", min: 30, max: 300, step: 1, def: 150 },
      { key: "detail", label: "Detail / density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "annotate", label: "Annotations (ticks, scale)", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "annPen", label: "Annotation pen", type: "pen", def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 157 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const L = Math.round(p.layer);
      const AP = Math.round(p.annPen);
      const rng = mulberry32(p.seed * 7127 + 131);
      const S = p.size;
      const paths = [];
      const line = (a, b, ly) => paths.push({ pts: [a, b], closed: false, layer: ly === undefined ? L : ly });
      const poly = (pts, closed, ly) => paths.push({ pts, closed: !!closed, layer: ly === undefined ? L : ly });
      const circle = (x, y, r, n, ly) => {
        const pts = [];
        for (let k = 0; k < (n || 32); k++) {
          const a = (k / (n || 32)) * Math.PI * 2;
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        poly(pts, true, ly);
      };
      const blob = (x, y, r, wob, sd) => {
        const rr = mulberry32(sd);
        const nH = 3, amps = [], phs = [];
        for (let h = 0; h < nH; h++) { amps.push(wob * r * rr() / (h + 1)); phs.push(rr() * 6.28); }
        const pts = [];
        for (let k = 0; k < 40; k++) {
          const th = (k / 40) * Math.PI * 2;
          let rad = r;
          for (let h = 0; h < nH; h++) rad += amps[h] * Math.sin((h + 2) * th + phs[h]);
          pts.push([x + Math.cos(th) * rad, y + Math.sin(th) * rad]);
        }
        return pts;
      };
      const label = (str, x, y, sz, ly) => {
        const fs = fontStrokes(str, sz, 1);
        for (const st of fs.strokes) {
          poly(st.map(([gx, gy]) => [x + gx, y + gy - sz]), false, ly);
        }
        return fs.width;
      };
              /* EEG / Seismic: kanavarivit, rauhallista pohjaa + purskeet */
        const nCh = Math.round(5 + p.detail * 9);
        const w = S * 1.4, h = S;
        const x0 = p.cx - w / 2, y0 = p.cy - h / 2;
        const chH = h / nCh;
        for (let c = 0; c < nCh; c++) {
          const by = y0 + (c + 0.5) * chH;
          /* purskeet: 1-3 tapahtumaa satunnaisin kohdin */
          const rngC = mulberry32(p.seed * 331 + c * 71);
          const nEv = 1 + Math.floor(rngC() * 3);
          const evs = [];
          for (let e = 0; e < nEv; e++) evs.push([rngC() * 0.8 + 0.05, 0.04 + rngC() * 0.12, 0.4 + rngC() * 0.6]);
          const pts = [];
          for (let x = 0; x <= w; x += 0.5) {
            const u = x / w;
            let amp = 0.06;
            let fq = 0.8;
            for (const [eu, ew, ea] of evs) {
              const d = Math.abs(u - eu) / ew;
              if (d < 1) {
                const env = (1 - d) * (1 - d);
                amp += ea * env;
                fq += 3 * env;
              }
            }
            const y = by
              + (noise2(x * 0.15 * fq, c * 9.7, p.seed) - 0.5) * chH * amp * 1.6
              + Math.sin(x * 0.9 * fq + c * 2) * chH * amp * 0.5;
            pts.push([x0 + x, y]);
          }
          poly(pts, false);
        }
        if (p.annotate) {
          for (let c = 0; c < nCh; c++) {
            line([x0 - 5, y0 + (c + 0.5) * chH], [x0 - 2, y0 + (c + 0.5) * chH], AP);
          }
          for (let t = 0; t <= 10; t++) {
            line([x0 + (t / 10) * w, y0 + h + 3], [x0 + (t / 10) * w, y0 + h + 6], AP);
          }
          label("1 S/DIV", x0, y0 + h + 13, 3.5, AP);
        }

      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## scatter.js

```js
import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "scatter",
    name: "Scatter", cat: "mod", group: "cutsplit", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Gradient", type: "select", options: ["Top → Bottom", "Bottom → Top", "Left → Right", "Right → Left", "Radial", "Uniform"], def: "Top → Bottom" },
      { key: "offset", label: "Max offset mm", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
      { key: "rot", label: "Max rotate °", type: "slider", min: 0, max: 90, step: 1, def: 25 },
      { key: "seed", label: "Seed", type: "seed", def: 33 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const paths = src.paths.map((path, i) => {
        const cx = path.pts.reduce((s, q) => s + q[0], 0) / path.pts.length;
        const cy = path.pts.reduce((s, q) => s + q[1], 0) / path.pts.length;
        let f;
        switch (p.mode) {
          case "Top → Bottom": f = cy / H; break;
          case "Bottom → Top": f = 1 - cy / H; break;
          case "Left → Right": f = cx / W; break;
          case "Right → Left": f = 1 - cx / W; break;
          case "Radial": f = Math.hypot(cx - W / 2, cy - H / 2) / (Math.hypot(W, H) / 2); break;
          default: f = 1;
        }
        f = Math.max(0, Math.min(1, f));
        const rng = mulberry32(p.seed * 613 + i * 89 + 7);
        const ang = rng() * Math.PI * 2;
        const dist = rng() * p.offset * f;
        const tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist;
        const rad = ((rng() - 0.5) * 2 * p.rot * f * Math.PI) / 180;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        return {
          ...path,
          pts: path.pts.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            return [cx + dx * ca - dy * sa + tx, cy + dx * sa + dy * ca + ty];
          }),
        };
      });
      return { paths };
    },
  
};
```

## sdfcontours.js

```js
import { Pin, EMPTY, pathLength } from "../helpers.js";

export default {
  key: "sdfcontours",
    name: "SDF Contours",
    cat: "mod",
    group: "deform",
    desc: "Distance-field isolines around ALL input geometry: unlike per-path Offset, nearby shapes merge into one smooth halo, like metaballs. Start/step/count set the contour distances; Inside adds negative offsets within closed shapes. Cell controls field resolution.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "start", label: "First contour mm", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
      { key: "step", label: "Contour step mm", type: "slider", min: 0.5, max: 15, step: 0.5, def: 3 },
      { key: "count", label: "Contours", type: "slider", min: 1, max: 8, step: 1, def: 3 },
      { key: "inside", label: "Inside contours too", type: "check", def: false },
      { key: "cell", label: "Field cell mm", type: "slider", min: 1, max: 4, step: 0.25, def: 1.8 },
      { key: "keep", label: "Keep source", type: "check", def: true },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
      { key: "layer", label: "Contour pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const maxD = p.start + p.step * Math.max(0, p.count - 1) + p.cell * 2;
      /* segments of all paths, bucketed for nearest-distance queries */
      const segs = [];
      for (const pa of src.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
        }
      }
      if (!segs.length) return EMPTY;
      const bs = Math.max(4, p.cell * 3);
      const bkey = (x, y) => Math.floor(x / bs) + "," + Math.floor(y / bs);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]);
        const y0 = Math.min(s[1], s[3]), y1 = Math.max(s[1], s[3]);
        for (let by = Math.floor(y0 / bs); by <= Math.floor(y1 / bs); by++) {
          for (let bx = Math.floor(x0 / bs); bx <= Math.floor(x1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k);
            if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
        }
      });
      const segDist = (x, y, s) => {
        const dx = s[2] - s[0], dy = s[3] - s[1];
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
      };
      const distAt = (x, y) => {
        /* expanding ring search over buckets, bounded by maxD */
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        let best = maxD + 1;
        const maxR = Math.ceil(maxD / bs) + 1;
        for (let r = 0; r <= maxR; r++) {
          if ((r - 1) * bs > best) break;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const a = buckets.get((bx + dx) + "," + (by + dy));
              if (!a) continue;
              for (const i of a) {
                const d = segDist(x, y, segs[i]);
                if (d < best) best = d;
              }
            }
          }
        }
        return best;
      };
      /* sign: inside any closed path -> negative, ALWAYS (so default contours
         are outside-only; the Inside option merely adds negative levels) */
      const closedPolys = src.paths.filter((pa) => pa.closed && pa.pts.length >= 3).map((pa) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of pa.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        return { poly: pa.pts, x0, y0, x1, y1 };
      });
      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const signAt = (x, y) => {
        for (const cp of closedPolys) {
          if (x < cp.x0 || x > cp.x1 || y < cp.y0 || y > cp.y1) continue;
          if (pip(x, y, cp.poly)) return -1;
        }
        return 1;
      };
      const cell = Math.max(0.8, p.cell);
      const cols = Math.min(260, Math.max(4, Math.round(W / cell) + 1));
      const rows = Math.min(380, Math.max(4, Math.round(H / cell) + 1));
      const gx = (c) => (c / (cols - 1)) * W;
      const gy = (r) => (r / (rows - 1)) * H;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gx(c), y = gy(r);
          F[r * cols + c] = distAt(x, y) * (closedPolys.length ? signAt(x, y) : 1);
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      if (p.keep) src.paths.forEach((pa) => paths.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }));
      const segsOut = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      const levels = [];
      for (let k = 0; k < Math.max(1, Math.round(p.count)); k++) {
        const d = p.start + p.step * k;
        levels.push(d);
        if (p.inside) levels.push(-d);
      }
      for (const lvl of levels) {
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segsOut.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segsOut.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return { paths };
    }
  
};
```

## setpen.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "setpen",
    name: "Set Pen",
    cat: "mod",
    group: "penout",
    desc: "Recolors the input onto another pen. All moves everything to the target pen; Single remaps only one source pen and leaves the rest untouched - handy for swapping a single color in a multi-pen patch, or forcing any generator onto the pen you are about to load.",
    ins: [Pin("paths", "Paths")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Recolor", type: "select", options: ["All", "Single"], def: "All" },
      { key: "from", label: "From pen (Single)", type: "pen", def: 0 },
      { key: "layer", label: "To pen", type: "pen", def: 1 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const to = Math.round(p.layer);
      const from = Math.round(p.from);
      const all = p.mode === "All";
      return {
        paths: src.paths.map((pa) => ({
          ...pa,
          pts: pa.pts.map((q) => q.slice()),
          layer: all || pa.layer === from ? to : pa.layer
        }))
      };
    }
  
};
```

## shaper.js

```js
import { Pin } from "../helpers.js";

export default {
  key: "shaper",
    name: "Shaper",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "curve", label: "Curve", type: "select", options: ["Linear", "Smoothstep", "Ease in", "Ease out", "Ease in-out", "Bounce", "Reverse", "Triangle"], def: "Smoothstep" },
      { key: "repeat", label: "Repeat / loop", type: "slider", min: 1, max: 8, step: 1, def: 1 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const rep = Math.max(1, Math.round(p.repeat));
      /* end-inclusive wrap: t=1 lands on the END of the last cycle, so a
         write-on driven by Frame does not snap back on its final frame.
         (For a seamless LOOP use Triangle, whose endpoints match anyway.) */
      let u = ((raw * rep) % 1 + 1) % 1;
      if (u === 0 && raw * rep > 0) u = 1;
      switch (p.curve) {
        case "Linear": return u;
        case "Ease in": return u * u * u;
        case "Ease out": { const w = 1 - u; return 1 - w * w * w; }
        case "Ease in-out": return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        case "Bounce": {
          const n1 = 7.5625, d1 = 2.75;
          let x = u;
          if (x < 1 / d1) return n1 * x * x;
          if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
          if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
          x -= 2.625 / d1; return n1 * x * x + 0.984375;
        }
        case "Reverse": return 1 - u;
        case "Triangle": return 1 - Math.abs(u * 2 - 1);
        default: return u * u * (3 - 2 * u);
      }
    }
  
};
```

## simplify.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "simplify",
    name: "Simplify", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "tol", label: "Tolerance mm", type: "slider", min: 0.05, max: 3, step: 0.05, def: 0.2 }],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rdp = (pts, tol) => {
        if (pts.length < 3) return pts;
        const keep = new Array(pts.length).fill(false);
        keep[0] = keep[pts.length - 1] = true;
        const stack = [[0, pts.length - 1]];
        while (stack.length) {
          const [a, b] = stack.pop();
          const [ax, ay] = pts[a], [bx, by] = pts[b];
          const dx = bx - ax, dy = by - ay;
          const len = Math.hypot(dx, dy) || 1e-9;
          let maxD = 0, maxI = -1;
          for (let i = a + 1; i < b; i++) {
            const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
            if (d > maxD) { maxD = d; maxI = i; }
          }
          if (maxD > tol && maxI > 0) {
            keep[maxI] = true;
            stack.push([a, maxI], [maxI, b]);
          }
        }
        return pts.filter((_, i) => keep[i]);
      };
      const paths = src.paths.map((path) => ({ ...path, pts: rdp(path.pts, p.tol) }));
      return { paths };
    },
  
};
```

## skew.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "skew",
      name: "Skew",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "skx", label: "Skew X °", type: "slider", min: -60, max: 60, step: 0.5, def: 15 },
      { key: "sky", label: "Skew Y °", type: "slider", min: -60, max: 60, step: 0.5, def: 0 },
      { key: "origin", label: "Origin", type: "select", options: ["Content center", "Canvas center"], def: "Content center" },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let ox, oy;
      if (p.origin === "Canvas center") { ox = ctx.W / 2; oy = ctx.H / 2; }
      else {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const path of src.paths) for (const [x, y] of path.pts) {
          if (x < x0) x0 = x; if (y < y0) y0 = y;
          if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
        ox = (x0 + x1) / 2; oy = (y0 + y1) / 2;
      }
      const tx = Math.tan((p.skx * Math.PI) / 180);
      const ty = Math.tan((p.sky * Math.PI) / 180);
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const rx = x - ox, ry = y - oy;
          return [ox + rx + ry * tx, oy + ry + rx * ty];
        }),
      }));
      return { paths };
    }
  
};
```

## skyline.js

```js
import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "skyline",
      name: "Skyline",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Forest", "City"], def: "Forest" },
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 10, max: 400, step: 1, def: 85 },
      { key: "height", label: "Height mm", type: "slider", min: 5, max: 150, step: 1, def: 38 },
      { key: "layers", label: "Layers (depth)", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "rough", label: "Hill roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "detail", label: "Detail (trees/buildings)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "texture", label: "Texture (trunks/windows)", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 97 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const w = W - 2 * m;
      if (w < 20) return EMPTY;
      const paths = [];
      const nL = Math.round(p.layers);
      for (let ly = 0; ly < nL; ly++) {
        /* kerros 0 = etummainen (korkein, horisontissa), taaemmat nousevat ylos ja madaltuvat */
        const back = ly / Math.max(1, nL - 1 || 1);
        const hgt = p.height * (1 - 0.45 * back);
        const yBase = p.horizon - back * p.height * 0.55;
        const lseed = p.seed + ly * 137;
        const rng = mulberry32(lseed * 761 + 5);
        if (p.mode === "Forest") {
          /* kukkulasiluetti fBm + havupiikit paalle */
          const hillAt = (x) => {
            const u = (x - m) / w;
            let v = 0, a = 1, f = 1, tot = 0;
            for (let o = 0; o < 3; o++) {
              v += a * noise2(u * (2 + p.rough * 5) * f, ly * 7.7, lseed);
              tot += a; a *= 0.5; f *= 2;
            }
            return yBase - (v / tot) * hgt;
          };
          const pts = [];
          let x = m;
          while (x <= W - m) {
            const hy = hillAt(x);
            /* kuusenlatva: piikki ylos ja alas takaisin, korkeus satunnainen */
            const spikeH = (0.5 + rng() * 1) * (1.5 + p.detail * 4) * (1 - 0.4 * back);
            const spikeW = 0.8 + rng() * (2.5 - p.detail * 1.2);
            if (p.detail > 0.02) {
              pts.push([x, hy]);
              pts.push([x + spikeW / 2, hy - spikeH]);
              pts.push([x + spikeW, hy]);
            } else {
              pts.push([x, hy]);
            }
            x += Math.max(0.6, spikeW);
          }
          paths.push({ pts, closed: false, layer: L });
          /* tekstuuri: runkoviiruja siluetista alaspain (vain etukerros) */
          if (p.texture && ly === 0) {
            const nT = Math.round(w / 6);
            for (let k = 0; k < nT; k++) {
              const tx = m + rng() * w;
              const ty = hillAt(tx);
              const tl = (2 + rng() * 6) * (0.5 + p.detail);
              paths.push({ pts: [[tx, ty + 1], [tx + (rng() - 0.5) * 0.8, ty + 1 + tl]], closed: false, layer: L });
            }
          }
        } else {
          /* CITY: porrastettu talosiluetti yhtena polylinena */
          const pts = [[m, yBase]];
          let x = m;
          let prevH = 0;
          const bldgs = [];
          while (x < W - m) {
            const bw = Math.min(W - m - x, (4 + rng() * 26) * (1 - p.detail * 0.5) + 2);
            /* korkeusjakauma: enimmakseen matalia, joskus torni */
            const tall = rng() < 0.14 ? 1 + rng() * 0.8 : 0.25 + rng() * 0.6;
            const bh = hgt * tall * (1 - 0.3 * back);
            pts.push([x, yBase - bh]);
            pts.push([x + bw, yBase - bh]);
            pts.push([x + bw, yBase]);
            bldgs.push([x, bw, bh]);
            /* antenni satunnaisesti korkeimpiin */
            if (tall > 1.2 && rng() < 0.6) {
              paths.push({ pts: [[x + bw / 2, yBase - bh], [x + bw / 2, yBase - bh - hgt * 0.18]], closed: false, layer: L });
            }
            x += bw;
          }
          paths.push({ pts, closed: false, layer: L });
          /* ikkunat: pienia vaakaviiruja rakennusten sisalla (etukerros) */
          if (p.texture && ly === 0) {
            for (const [bx, bw, bh] of bldgs) {
              if (bw < 5 || bh < 8) continue;
              const cols = Math.max(1, Math.floor(bw / 3.5));
              const rows = Math.max(1, Math.floor(bh / 4.5));
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  if (rng() < 0.45) continue;   /* osa ikkunoista pimeana */
                  const wx = bx + 1.6 + c * ((bw - 3.2) / Math.max(1, cols - 1 || 1));
                  const wy = yBase - bh + 2.5 + r * ((bh - 5) / Math.max(1, rows - 1 || 1));
                  paths.push({ pts: [[wx - 0.7, wy], [wx + 0.7, wy]], closed: false, layer: L });
                }
              }
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## smear.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "smear",
  name: "Smear",
  cat: "mod",
  group: "deform",
  desc: "Pixel-stretch for lines inside a rectangular zone. Vertical and Horizontal replace zone content with straight axis-aligned streaks at boundary crossings; Free (bridge) joins each path's entry and exit with one straight chord so the line continues unbroken. From edge picks which zone edge feeds the effect: with e.g. Right selected, only right-edge crossings continue - seamlessly attached to their outside line, straight along their own tangent, through the zone - while crossings on other edges are simply cut at the border. Streak length 0 runs to the far zone edge; Keep zone content overlays the original inside the zone.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Streaks", type: "select", options: ["Vertical", "Horizontal", "Free (bridge)"], def: "Vertical" },
    { key: "edge", label: "From edge", type: "select", options: ["All", "Left", "Right", "Top", "Bottom"], def: "All" },
    { key: "zx", label: "Zone X mm", type: "slider", min: 0, max: 400, step: 1, def: 20 },
    { key: "zy", label: "Zone Y mm", type: "slider", min: 0, max: 400, step: 1, def: 15 },
    { key: "zw", label: "Zone W mm", type: "slider", min: 5, max: 400, step: 1, def: 260 },
    { key: "zh", label: "Zone H mm", type: "slider", min: 5, max: 400, step: 1, def: 95 },
    { key: "len", label: "Streak length mm (0 = zone edge)", type: "slider", min: 0, max: 400, step: 1, def: 0 },
    { key: "keep", label: "Keep zone content", type: "check", def: false },
  ],
  overlay(p) {
    return [{ kind: "rect", x: p.zx, y: p.zy, w: p.zw, h: p.zh }];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const x0 = p.zx, y0 = p.zy;
    const x1 = p.zx + Math.max(1, p.zw), y1 = p.zy + Math.max(1, p.zh);
    const inZ = (q) => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
    const bridge = p.mode === "Free (bridge)";
    const fromEdge = p.edge || "All";
    const out = [];
    const cross = (a, b) => {
      let lo = a, hi = b;
      if (inZ(a)) { lo = b; hi = a; }
      for (let k = 0; k < 24; k++) {
        const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
        if (inZ(m)) hi = m; else lo = m;
      }
      return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    };
    const edgeOf = (c) => {
      const d = [
        [Math.abs(c[0] - x0), "Left"], [Math.abs(c[0] - x1), "Right"],
        [Math.abs(c[1] - y0), "Top"], [Math.abs(c[1] - y1), "Bottom"],
      ].sort((a, b) => a[0] - b[0]);
      return d[0][1];
    };
    const edgeOk = (c) => fromEdge === "All" || edgeOf(c) === fromEdge;
    const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
    const rayEnd = (c, d) => {
      let t = Infinity;
      if (d[0] > 1e-9) t = Math.min(t, (x1 - c[0]) / d[0]);
      if (d[0] < -1e-9) t = Math.min(t, (x0 - c[0]) / d[0]);
      if (d[1] > 1e-9) t = Math.min(t, (y1 - c[1]) / d[1]);
      if (d[1] < -1e-9) t = Math.min(t, (y0 - c[1]) / d[1]);
      if (!isFinite(t)) t = 0;
      if (p.len > 0.5) t = Math.min(t, p.len);
      return [c[0] + d[0] * t, c[1] + d[1] * t];
    };
    const streakDir = (tan) => {
      const [ux, uy] = unit(tan);
      if (p.mode === "Horizontal") return [ux >= 0 ? 1 : -1, 0];
      return [0, uy >= 0 ? 1 : -1];
    };
    for (const pa of src.paths) {
      const pts = resample(pa.pts, pa.closed, 1);
      const N = pts.length;
      if (N < 2) { out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }); continue; }
      const anyIn = pts.some(inZ);
      if (!anyIn) { out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }); continue; }
      const seq = pa.closed ? pts.concat([pts[0]]) : pts;
      const L = pa.layer;
      let run = [];
      let insideRun = [];
      let rayDone = false;
      const flushOut = () => { if (run.length > 1) out.push({ pts: run, closed: false, layer: L }); run = []; };
      const flushIn = () => {
        if (p.keep && insideRun.length > 1) out.push({ pts: insideRun, closed: false, layer: L });
        insideRun = [];
      };
      let inside = inZ(seq[0]);
      if (!inside) run.push(seq[0].slice()); else insideRun.push(seq[0].slice());
      for (let i = 1; i < seq.length; i++) {
        const q = seq[i], prev = seq[i - 1];
        const nowIn = inZ(q);
        if (nowIn === inside) {
          if (inside) insideRun.push(q.slice()); else run.push(q.slice());
          continue;
        }
        const c = cross(prev, q);
        const inward = unit(nowIn ? [q[0] - prev[0], q[1] - prev[1]] : [prev[0] - q[0], prev[1] - q[1]]);
        if (!inside && nowIn) {
          /* -------- entering the zone -------- */
          run.push(c.slice());
          if (bridge && fromEdge === "All") {
            /* chord: keep the run open, it continues at the exit crossing */
          } else if (bridge) {
            if (edgeOk(c)) {
              const e = rayEnd(c, inward);
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) run.push(e);
            }
            flushOut();
          } else {
            flushOut();
            if (edgeOk(c)) {
              const e = rayEnd(c, streakDir(inward));
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) out.push({ pts: [c.slice(), e], closed: false, layer: L });
              rayDone = true;
            }
          }
          insideRun = [c.slice(), q.slice()];
        } else {
          /* -------- leaving the zone -------- */
          insideRun.push(c.slice());
          if (bridge && fromEdge === "All") {
            run.push(c.slice());
            run.push(q.slice());
          } else if (bridge) {
            run = [];
            if (edgeOk(c)) {
              const e = rayEnd(c, inward);
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) run.push(e);
            }
            run.push(c.slice());
            run.push(q.slice());
          } else {
            const wantExit = fromEdge === "All" ? !rayDone : edgeOk(c);
            if (wantExit) {
              const e = rayEnd(c, streakDir(inward));
              if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 0.4) out.push({ pts: [c.slice(), e], closed: false, layer: L });
            }
            run = [c.slice(), q.slice()];
          }
          flushIn();
          rayDone = false;
        }
        inside = nowIn;
      }
      flushOut();
      flushIn();
    }
    return { paths: out };
  },
};
```

## smoke.js

```js
import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "smoke",
    name: "Smoke",
    cat: "gen",
    group: "organic",
    desc: "Incense smoke in 3D: a laminar stream rises smoothly, then breaks into turbulent curls past the break height. The line is a ribbon of parallel filaments that twist around the stream and fold like real smoke sheets. Wind bends the column; View yaw orbits it; wire Drift to Frame and the smoke flows through an animation. Each filament is one continuous pen stroke.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "streams", label: "Streams", type: "slider", min: 1, max: 4, step: 1, def: 1 },
      { key: "rise", label: "Rise mm", type: "slider", min: 60, max: 300, step: 5, def: 200 },
      { key: "laminar", label: "Laminar fraction", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.3 },
      { key: "turb", label: "Turbulence", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "swirl", label: "Swirl size mm", type: "slider", min: 8, max: 80, step: 1, def: 30 },
      { key: "windAng", label: "Wind direction deg", type: "slider", min: 0, max: 360, step: 5, def: 20 },
      { key: "wind", label: "Wind strength", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "filaments", label: "Ribbon filaments", type: "slider", min: 1, max: 9, step: 1, def: 5 },
      { key: "width", label: "Ribbon width mm", type: "slider", min: 1, max: 25, step: 0.5, def: 8 },
      { key: "yaw", label: "View yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "drift", label: "Drift (wire Frame)", type: "slider", min: 0, max: 10, step: 0.05, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 4 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const NS = Math.max(1, Math.min(4, Math.round(p.streams)));
      const K = Math.max(1, Math.min(12, Math.round(p.filaments)));
      const ds = 1.1;
      const steps = Math.min(500, Math.round(Math.max(20, p.rise) / ds));
      const f = 1 / Math.max(4, p.swirl);
      const wa = (p.windAng * Math.PI) / 180;
      const windX = Math.cos(wa) * p.wind, windZ = Math.sin(wa) * p.wind;
      const breakH = p.laminar * p.rise;
      const D = p.drift * 3.7;
      const L = Math.round(p.layer);
      const rawStreams = [];
      for (let s = 0; s < NS; s++) {
        const sd = p.seed * 131 + s * 977;
        /* centerline: integrate with directional inertia for flowing curves */
        const C = [], T = [];
        let px = (s - (NS - 1) / 2) * p.rise * 0.18, py = 0, pz = (hash2(s, 3, p.seed) - 0.5) * 10;
        let dx = 0, dy = 1, dz = 0;
        for (let i = 0; i < steps; i++) {
          C.push([px, py, pz]);
          T.push([dx, dy, dz]);
          const h = py;
          /* turbulence ramps in after the break height; a whisper of wobble before */
          const ramp = breakH >= p.rise ? 0 : Math.max(0, Math.min(1, (h - breakH) / (p.rise * 0.18 + 1)));
          const amp = p.turb * 2.4 * ramp + 0.06;
          const tx = (noise2(py * f + D, pz * f + s * 7, sd + 1) - 0.5) * amp;
          const ty = (noise2(px * f + D, pz * f + s * 7, sd + 2) - 0.5) * amp * 0.45;
          const tz = (noise2(px * f, py * f + D, sd + 3) - 0.5) * amp;
          let vx = windX * 0.9 + tx, vy = 1 + ty, vz = windZ * 0.9 + tz;
          /* inertia: blend previous direction for smooth curls */
          vx = dx * 0.78 + vx * 0.22; vy = dy * 0.78 + vy * 0.22; vz = dz * 0.78 + vz * 0.22;
          const vl = Math.hypot(vx, vy, vz) || 1;
          dx = vx / vl; dy = vy / vl; dz = vz / vl;
          px += dx * ds; py += dy * ds; pz += dz * ds;
        }
        /* rotation-minimizing frames */
        const N = [], B = [];
        for (let i = 0; i < C.length; i++) {
          const t = T[i];
          if (i === 0) {
            let nx = -t[1], ny = t[0], nz = 0;
            const nl = Math.hypot(nx, ny, nz) || 1;
            N.push([nx / nl, ny / nl, nz / nl]);
          } else {
            const pn = N[i - 1];
            const d = pn[0] * t[0] + pn[1] * t[1] + pn[2] * t[2];
            let nx = pn[0] - d * t[0], ny = pn[1] - d * t[1], nz = pn[2] - d * t[2];
            const nl = Math.hypot(nx, ny, nz) || 1;
            N.push([nx / nl, ny / nl, nz / nl]);
          }
          const n = N[i];
          B.push([
            t[1] * n[2] - t[2] * n[1],
            t[2] * n[0] - t[0] * n[2],
            t[0] * n[1] - t[1] * n[0]
          ]);
        }
        rawStreams.push({ C, N, B, sd });
      }
      /* filaments in 3D: twist around the tangent + width envelope + sheet folding */
      const pts3 = []; /* per filament: array of [x,y,z] */
      for (const st of rawStreams) {
        for (let k = 0; k < K; k++) {
          const e = K > 1 ? (k / (K - 1) - 0.5) : 0;
          const fil = [];
          for (let i = 0; i < st.C.length; i++) {
            const h = st.C[i][1];
            const env = 0.12 + 0.88 * Math.min(1, h / (p.rise * 0.25 + 1));
            const fold = 1 + 0.8 * (noise2(h * 0.025 + k * 0.7, D + 9.3, st.sd + 4) - 0.5);
            const tw = (noise2(h * 0.014 + D * 0.5, k * 0.31, st.sd + 5) - 0.5) * Math.PI * 2.2;
            const off = e * p.width * env * fold;
            const ca = Math.cos(tw) * off, sa = Math.sin(tw) * off;
            fil.push([
              st.C[i][0] + st.N[i][0] * ca + st.B[i][0] * sa,
              st.C[i][1] + st.N[i][1] * ca + st.B[i][1] * sa,
              st.C[i][2] + st.N[i][2] * ca + st.B[i][2] * sa
            ]);
          }
          pts3.push(fil);
        }
      }
      /* project: yaw around the vertical axis, mild perspective, y up -> screen y down */
      const ya = (p.yaw * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const FOC = p.rise * 2.5;
      const proj = ([x, y, z]) => {
        const X = x * cy2 + z * sy2;
        const Z = -x * sy2 + z * cy2;
        const sc = FOC / Math.max(FOC * 0.15, FOC + Z);
        return [X * sc, -y * sc];
      };
      const proj2 = pts3.map((fil) => fil.map(proj));
      /* fit into the margin box */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const fil of proj2) for (const [x, y] of fil) {
        if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const paths = proj2.map((fil) => ({
        pts: fil.map(([x, y]) => [
          Math.max(0.5, Math.min(W - 0.5, x * sc + ox)),
          Math.max(0.5, Math.min(H - 0.5, y * sc + oy))
        ]),
        closed: false, layer: L
      }));
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## smooth.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "smooth",
    name: "Smooth", cat: "mod", group: "pathops",
    desc: "Smooths paths. Relax runs an arc-length moving average (Radius mm) over the line - visible on typical densely sampled Muusia geometry; endpoints stay pinned and closed paths wrap. Round corners is classic Chaikin corner-cutting, useful on sparse polylines like Random Lines or Delaunay edges.",
    ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Relax", "Round corners"], def: "Relax" },
      { key: "radius", label: "Radius mm (Relax)", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
      { key: "iter", label: "Iterations", type: "slider", min: 1, max: 5, step: 1, def: 2 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const it = Math.max(1, Math.min(8, Math.round(p.iter)));
      if (p.mode === "Round corners") {
        const chaikin = (pts, closed) => {
          if (pts.length < 3) return pts;
          const out = [];
          const N = pts.length;
          const last = closed ? N : N - 1;
          if (!closed) out.push(pts[0].slice());
          for (let i = 0; i < last; i++) {
            const a = pts[i], b = pts[(i + 1) % N];
            out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
            out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
          }
          if (!closed) out.push(pts[N - 1].slice());
          return out;
        };
        const paths = src.paths.map((path) => {
          let pts = path.pts;
          for (let i = 0; i < it; i++) pts = chaikin(pts, path.closed);
          return { ...path, pts };
        });
        return { paths };
      }
      /* Relax: moving average over a Radius-mm arc-length window */
      const R = Math.max(0.2, p.radius);
      const step = Math.max(0.4, Math.min(1.5, R / 4));
      const w = Math.max(1, Math.round(R / step));
      const paths = src.paths.map((path) => {
        if (path.pts.length < 3) return path;
        let pts = resample(path.pts, path.closed, step);
        const N = pts.length;
        if (N < 5) return path;
        for (let n = 0; n < it; n++) {
          const out = new Array(N);
          for (let i = 0; i < N; i++) {
            if (!path.closed && (i === 0 || i === N - 1)) { out[i] = pts[i]; continue; }
            let sx = 0, sy = 0, cnt = 0;
            for (let k = -w; k <= w; k++) {
              let j = i + k;
              if (path.closed) j = ((j % N) + N) % N;
              else { if (j < 0) j = 0; else if (j > N - 1) j = N - 1; }
              sx += pts[j][0]; sy += pts[j][1]; cnt++;
            }
            out[i] = [sx / cnt, sy / cnt];
          }
          pts = out;
        }
        return { ...path, pts };
      });
      return { paths };
    },
  
};
```

## solids.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "solids",
    name: "Solids", cat: "gen", group: "space", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Shape", type: "select", options: ["Sphere", "Cube", "Tetrahedron", "Octahedron", "Icosahedron", "Dodecahedron"], def: "Sphere" },
      { key: "size", label: "Size mm", type: "slider", min: 10, max: 250, step: 1, def: 120 },
      { key: "rx", label: "Rotate X °", type: "slider", min: -180, max: 180, step: 1, def: -20 },
      { key: "ry", label: "Rotate Y °", type: "slider", min: -180, max: 180, step: 1, def: 30 },
      { key: "rz", label: "Rotate Z °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "lat", label: "Latitudes (sphere)", type: "slider", min: 3, max: 24, step: 1, def: 9 },
      { key: "lon", label: "Longitudes (sphere)", type: "slider", min: 4, max: 24, step: 1, def: 12 },
      { key: "sstyle", label: "Sphere style", type: "select", options: ["Solid (hide back)", "Transparent"], def: "Solid (hide back)" },
      { key: "px", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const r = p.size / 2;
      const cx = p.px, cy = p.py;
      /* rotaatio ZYX */
      const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180, az = (p.rz * Math.PI) / 180;
      const cX = Math.cos(ax), sX = Math.sin(ax);
      const cY = Math.cos(ay), sY = Math.sin(ay);
      const cZ = Math.cos(az), sZ = Math.sin(az);
      const rot = ([x, y, z]) => {
        let y1 = y * cX - z * sX, z1 = y * sX + z * cX;                 /* X */
        let x2 = x * cY + z1 * sY, z2 = -x * sY + z1 * cY;             /* Y */
        return [x2 * cZ - y1 * sZ, x2 * sZ + y1 * cZ, z2];             /* Z */
      };
      const camD = r * (6 - 4.8 * p.persp);
      const proj = ([x, y, z]) => {
        const f = p.persp > 0 ? camD / Math.max(camD * 0.2, camD + z) : 1;
        return [cx + x * f, cy + y * f];
      };
      const L = Math.round(p.layer);
      const paths = [];
      const PHI = (1 + Math.sqrt(5)) / 2;
      if (p.shape === "Sphere") {
        const emit = (ring3d) => {
          /* jaa nakyviin kaariin (takapinta piiloon) */
          let run = [];
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (const v of ring3d) {
            const R = rot(v);
            const visible = p.sstyle === "Transparent" || R[2] <= r * 0.02;
            if (visible) run.push(proj(R));
            else flush();
          }
          if (run.length === ring3d.length) paths.push({ pts: run, closed: true, layer: L });
          else flush();
        };
        const N = 72;
        for (let la = 1; la < Math.round(p.lat); la++) {
          const phi = (la / Math.round(p.lat)) * Math.PI;
          const rr = Math.sin(phi) * r, zz = Math.cos(phi) * r;
          const ring = [];
          for (let i = 0; i < N; i++) {
            const th = (i / N) * Math.PI * 2;
            ring.push([Math.cos(th) * rr, zz, Math.sin(th) * rr]);
          }
          emit(ring);
        }
        for (let lo = 0; lo < Math.round(p.lon); lo++) {
          const th = (lo / Math.round(p.lon)) * Math.PI;
          const ring = [];
          for (let i = 0; i < N; i++) {
            const phi = (i / N) * Math.PI * 2;
            ring.push([Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(th) * r]);
          }
          emit(ring);
        }
      } else {
        let V;
        if (p.shape === "Cube") {
          V = [];
          for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
        } else if (p.shape === "Tetrahedron") {
          V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
        } else if (p.shape === "Octahedron") {
          V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        } else if (p.shape === "Icosahedron") {
          V = [];
          for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
            V.push([0, s1, s2 * PHI]);
            V.push([s1, s2 * PHI, 0]);
            V.push([s2 * PHI, 0, s1]);
          }
        } else {
          V = [];
          for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
          for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
            V.push([0, s1 / PHI, s2 * PHI]);
            V.push([s1 / PHI, s2 * PHI, 0]);
            V.push([s2 * PHI, 0, s1 / PHI]);
          }
        }
        /* normalisoi sateeseen r */
        const maxL = Math.max(...V.map((v) => Math.hypot(v[0], v[1], v[2])));
        V = V.map((v) => [v[0] / maxL * r, v[1] / maxL * r, v[2] / maxL * r]);
        /* sarmat = lyhimman etaisyyden parit */
        let minD = Infinity;
        for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
          const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
          if (d < minD - 0.001) minD = d;
        }
        for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
          const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
          if (d < minD * 1.08) {
            paths.push({ pts: [proj(rot(V[i])), proj(rot(V[j]))], closed: false, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## spiro.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "spiro",
    name: "Spirograph", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "R", label: "Ring R", type: "slider", min: 10, max: 100, step: 1, def: 60 },
      { key: "r", label: "Gear r", type: "slider", min: 2, max: 90, step: 1, def: 21 },
      { key: "d", label: "Pen offset d", type: "slider", min: 0, max: 90, step: 0.5, def: 30 },
      { key: "kind", label: "Kind", type: "select", options: ["Hypotrochoid", "Epitrochoid"], def: "Hypotrochoid" },
      { key: "turns", label: "Turns", type: "slider", min: 1, max: 120, step: 1, def: 40 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 4 },
    ],
    compute(ins, p, ctx) {
      const N = Math.min(14000, Math.round(p.turns * 160));
      const raw = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns * Math.PI * 2;
        let x, y;
        if (p.kind === "Hypotrochoid") {
          const k = (p.R - p.r) / p.r;
          x = (p.R - p.r) * Math.cos(t) + p.d * Math.cos(k * t);
          y = (p.R - p.r) * Math.sin(t) - p.d * Math.sin(k * t);
        } else {
          const k = (p.R + p.r) / p.r;
          x = (p.R + p.r) * Math.cos(t) - p.d * Math.cos(k * t);
          y = (p.R + p.r) * Math.sin(t) - p.d * Math.sin(k * t);
        }
        raw.push([x, y]);
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  
};
```

## split.js

```js
import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "split",
    name: "Split", cat: "duo",
    ins: [Pin("paths")],
    outs: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 3 }, (_, i) => Pin("paths", String(i + 1))),
    params: [
      { key: "count", label: "Outputs", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "dx", label: "Δ X mm / output", type: "slider", min: -30, max: 30, step: 0.25, def: 2 },
      { key: "dy", label: "Δ Y mm / output", type: "slider", min: -30, max: 30, step: 0.25, def: 0 },
      { key: "drot", label: "Δ Rotate ° / output", type: "slider", min: -45, max: 45, step: 0.5, def: 0 },
      { key: "dscale", label: "Δ Scale % / output", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 6 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const n = Math.round(p.count);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const outs = [];
      for (let i = 0; i < n; i++) {
        const rng = mulberry32(p.seed * 77 + i * 991 + 3);
        const jx = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const jy = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const tx = p.dx * i + jx, ty = p.dy * i + jy;
        const rad = ((p.drot * i) * Math.PI) / 180;
        const sc = 1 + (p.dscale * i) / 100;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        outs.push({
          paths: src.paths.map((path) => ({
            ...path,
            pts: path.pts.map(([x, y]) => {
              const dx0 = (x - cx) * sc, dy0 = (y - cy) * sc;
              return [cx + dx0 * ca - dy0 * sa + tx, cy + dx0 * sa + dy0 * ca + ty];
            }),
          })),
        });
      }
      return outs;
    },
  
};
```

## stamp.js

```js
import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "stamp",
    name: "Stamp", cat: "dec", ins: [Pin("paths", "Host path"), Pin("paths", "Motif")], outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Spacing mm", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
      { key: "size", label: "Size mm", type: "slider", min: 0.5, max: 25, step: 0.25, def: 3 },
      { key: "sizeMod", label: "Size modulation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "pathVar", label: "Per-path variation", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
      { key: "motif", label: "Motif (if unwired)", type: "select", options: ["Circle", "Square", "Triangle", "Line"], def: "Circle" },
      { key: "orientMode", label: "Orientation", type: "select", options: ["Fixed", "Along path", "Perpendicular"], def: "Fixed" },
      { key: "angle", label: "Angle °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "keepCol", label: "Keep motif colors", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 2 },
      { key: "layer", label: "Motif pen", type: "pen", def: 3 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const motifIn = ins[1];
      const useCustom = motifIn && motifIn.paths && motifIn.paths.length;
      /* normalisoi custom-motiivi: keskitä ja skaalaa yksikkökokoon */
      let motifNorm = null;
      if (useCustom) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const mp of motifIn.paths) for (const [x, y] of mp.pts) {
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        }
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const dim = Math.max(maxX - minX, maxY - minY) || 1;
        motifNorm = motifIn.paths.map((mp) => ({
          pts: mp.pts.map(([x, y]) => [(x - cx) / dim, (y - cy) / dim]),
          closed: mp.closed, layer: mp.layer,
        }));
      }
      const paths = [];
      const corners = p.motif === "Circle" ? 20 : p.motif === "Square" ? 4 : 3;
      const rotOff = p.motif === "Square" ? Math.PI / 4 : -Math.PI / 2;
      src.paths.forEach((path, pIdx) => {
        if (p.host) paths.push(path);
        const pts = resample(path.pts, path.closed, Math.max(0.5, p.spacing));
        pts.forEach((pt, i) => {
          const m = 1 + (noise2(
            pt[0] * 0.05 + pIdx * 7.31 * p.pathVar,
            pt[1] * 0.05 + pIdx * 3.77 * p.pathVar,
            p.seed) - 0.5) * 2 * p.sizeMod;
          const S = Math.max(0.2, p.size * m);
          let ang = (p.angle * Math.PI) / 180;
          if (p.orientMode !== "Fixed" && pts.length > 1) {
            const nb = pts[Math.min(i + 1, pts.length - 1)], pb = pts[Math.max(i - 1, 0)];
            const tang = Math.atan2(nb[1] - pb[1], nb[0] - pb[0]);
            ang += p.orientMode === "Perpendicular" ? tang + Math.PI / 2 : tang;
          }
          const ca = Math.cos(ang), sa = Math.sin(ang);
          if (motifNorm) {
            for (const mp of motifNorm) {
              const out = mp.pts.map(([x, y]) => {
                const xs = x * S, ys = y * S;
                return [pt[0] + xs * ca - ys * sa, pt[1] + xs * sa + ys * ca];
              });
              paths.push({ pts: out, closed: mp.closed, layer: p.keepCol ? mp.layer : Math.round(p.layer) });
            }
          } else if (p.motif === "Line") {
            /* viivamotiivi: pituus = Size, suunta orientaation mukaan */
            const h = S / 2;
            paths.push({
              pts: [[pt[0] - h * ca, pt[1] - h * sa], [pt[0] + h * ca, pt[1] + h * sa]],
              closed: false, layer: Math.round(p.layer),
            });
          } else {
            const r = S / 2;
            const mp = [];
            for (let k = 0; k < corners; k++) {
              const a = (k / corners) * Math.PI * 2 + rotOff + ang;
              mp.push([pt[0] + Math.cos(a) * r, pt[1] + Math.sin(a) * r]);
            }
            paths.push({ pts: mp, closed: true, layer: Math.round(p.layer) });
          }
        });
      });
      return { paths };
    },
  
};
```

## starfield.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "starfield",
    name: "Starfield", cat: "gen", group: "space", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Stars", type: "slider", min: 10, max: 800, step: 5, def: 160 },
      { key: "dist", label: "Distribution", type: "select", options: ["Uniform", "Clustered"], def: "Clustered" },
      { key: "drawStars", label: "Draw stars", type: "check", def: true },
      { key: "starSize", label: "Star size mm", type: "slider", min: 0.2, max: 5, step: 0.1, def: 0.8 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "connect", label: "Connect", type: "select", options: ["None", "Near pairs (distance)", "K nearest", "Constellations"], def: "Constellations" },
      { key: "connDist", label: "Connect distance mm", type: "slider", min: 3, max: 100, step: 1, def: 28 },
      { key: "k", label: "K (nearest)", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "starPen", label: "Star pen", type: "pen", def: 0 },
      { key: "linePen", label: "Line pen", type: "pen", def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 57 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1201 + 11);
      const m = p.margin;
      /* tahdet */
      const stars = [];
      let guard = 0;
      while (stars.length < Math.round(p.count) && guard++ < p.count * 40) {
        const x = m + rng() * (W - 2 * m);
        const y = m + rng() * (H - 2 * m);
        if (p.dist === "Clustered") {
          const n = noise2(x * 0.012, y * 0.012, p.seed + 99);
          if (rng() > 0.08 + 0.92 * n * n) continue;
        }
        stars.push([x, y, 1 - p.sizeVar * rng()]);
      }
      const paths = [];
      const SP = Math.round(p.starPen), LP = Math.round(p.linePen);
      /* yhdysviivat */
      const seg = (a, b) => paths.push({ pts: [[stars[a][0], stars[a][1]], [stars[b][0], stars[b][1]]], closed: false, layer: LP });
      const d2 = (a, b) => {
        const dx = stars[a][0] - stars[b][0], dy = stars[a][1] - stars[b][1];
        return dx * dx + dy * dy;
      };
      if (p.connect === "Near pairs (distance)") {
        const lim = p.connDist * p.connDist;
        let nSeg = 0;
        for (let i = 0; i < stars.length && nSeg < 6000; i++) {
          for (let j = i + 1; j < stars.length && nSeg < 6000; j++) {
            if (d2(i, j) <= lim) { seg(i, j); nSeg++; }
          }
        }
      } else if (p.connect === "K nearest") {
        const done = new Set();
        for (let i = 0; i < stars.length; i++) {
          const near = stars.map((_, j) => j).filter((j) => j !== i)
            .sort((a, b) => d2(i, a) - d2(i, b)).slice(0, Math.round(p.k));
          for (const j of near) {
            const key = i < j ? i + "|" + j : j + "|" + i;
            if (!done.has(key)) { done.add(key); seg(i, j); }
          }
        }
      } else if (p.connect === "Constellations") {
        /* ketjuta: satunnainen aloitus, lahin vapaa naapuri sateella, 3-9 tahden kuvio */
        const used = new Set();
        const lim = p.connDist * p.connDist;
        const order = stars.map((_, i) => i).sort(() => rng() - 0.5);
        for (const start of order) {
          if (used.has(start)) continue;
          const chainLen = 3 + Math.floor(rng() * 7);
          const chain = [[stars[start][0], stars[start][1]]];
          used.add(start);
          let cur = start;
          for (let c = 1; c < chainLen; c++) {
            let best = -1, bd = lim;
            for (let j = 0; j < stars.length; j++) {
              if (used.has(j)) continue;
              const dd = d2(cur, j);
              if (dd <= bd) { bd = dd; best = j; }
            }
            if (best < 0) break;
            used.add(best);
            chain.push([stars[best][0], stars[best][1]]);
            cur = best;
          }
          if (chain.length > 1) paths.push({ pts: chain, closed: false, layer: LP });
        }
      }
      /* tahtipisteet paalle (piirtojarjestys: viivat ensin) */
      if (p.drawStars) {
        for (const [x, y, sz] of stars) {
          const r = Math.max(0.1, (p.starSize / 2) * sz);
          const pts = [];
          for (let q = 0; q < 8; q++) {
            const a = (q / 8) * Math.PI * 2;
            pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: true, layer: SP });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## stencil.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "stencil",
    name: "Stencil",
    cat: "duo",
    ins: [Pin("paths", "Regions (closed)"), Pin("paths", "Content")],
    outs: [Pin("paths")],
    params: [
      { key: "region", label: "Region index (next/prev, wire Steps)", type: "slider", min: 0, max: 63, step: 1, def: 0 },
      { key: "all", label: "All regions", type: "check", def: false },
      { key: "inset", label: "Edge inset mm", type: "slider", min: -5, max: 8, step: 0.25, def: 1 },
      { key: "outline", label: "Show region outline", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const regsIn = ins[0], contentIn = ins[1];
      if (!regsIn || !regsIn.paths || !regsIn.paths.length) return EMPTY;

      /* collect closed loops, ordered deterministically top-left -> bottom-right
         so the index slider steps through them predictably */
      const loops = regsIn.paths
        .filter((pa) => pa.closed && pa.pts.length >= 3)
        .map((pa) => {
          let cx = 0, cy = 0;
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const [x, y] of pa.pts) {
            cx += x; cy += y;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          cx /= pa.pts.length; cy /= pa.pts.length;
          return { pa, cx, cy, x0, y0, x1, y1 };
        })
        .sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
      if (!loops.length) return EMPTY;

      /* selection: index wraps modulo count -> any slider/wired value is valid */
      const idx = ((Math.floor(p.region) % loops.length) + loops.length) % loops.length;
      const active = p.all ? loops : [loops[idx]];

      const inset = p.inset;
      const pad = Math.max(0, -inset);
      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const edgeDist = (x, y, poly) => {
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const ax = poly[j][0], ay = poly[j][1];
          const bx = poly[i][0], by = poly[i][1];
          const dx = bx - ax, dy = by - ay;
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
          if (d < best) best = d;
        }
        return best;
      };
      /* point is kept if it lies in ANY active region, respecting the inset */
      const keepPt = (x, y) => {
        for (const lo of active) {
          if (x < lo.x0 - pad || x > lo.x1 + pad || y < lo.y0 - pad || y > lo.y1 + pad) continue;
          const inside = pip(x, y, lo.pa.pts);
          if (inset > 0) {
            if (inside && edgeDist(x, y, lo.pa.pts) >= inset) return true;
          } else if (inset < 0) {
            if (inside || edgeDist(x, y, lo.pa.pts) <= -inset) return true;
          } else if (inside) return true;
        }
        return false;
      };

      const paths = [];
      if (p.outline) {
        for (const lo of active) {
          paths.push({ ...lo.pa, pts: lo.pa.pts.map((q) => q.slice()) });
        }
      }
      if (contentIn && contentIn.paths && contentIn.paths.length) {
        const step = Math.max(0.25, p.res);
        contentIn.paths.forEach((path) => {
          if (path.pts.length < 2) return;
          const pts = resample(path.pts, path.closed, step);
          const vis = pts.map(([x, y]) => keepPt(x, y));
          const runs = [];
          let run = [];
          for (let i = 0; i < pts.length; i++) {
            if (vis[i]) run.push(pts[i]);
            else { if (run.length > 1) runs.push(run); run = []; }
          }
          if (run.length > 1) runs.push(run);
          if (path.closed && runs.length > 1 && vis[0] && vis[pts.length - 1]) {
            const last = runs.pop();
            runs[0] = last.concat(runs[0]);
          }
          if (path.closed && runs.length === 1 && vis.every(Boolean)) {
            paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
            return;
          }
          for (const r of runs) paths.push({ pts: r, closed: false, layer: path.layer });
        });
      }
      return { paths };
    }
  
};
```

## steps.js

```js
import { Pin, hash2 } from "../helpers.js";

export default {
  key: "steps",
    name: "Steps",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "steps", label: "Steps", type: "slider", min: 2, max: 16, step: 1, def: 4 },
      { key: "mode", label: "Pattern", type: "select", options: ["Ramp up", "Ramp down", "Ping-pong", "Random"], def: "Ramp up" },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed (random)", type: "seed", def: 4 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const N = Math.max(2, Math.min(64, Math.round(p.steps)));
      const u = ((raw % 1) + 1) % 1;
      const i = Math.min(N - 1, Math.floor(u * N));
      let f;
      if (p.mode === "Ramp down") f = 1 - i / (N - 1);
      else if (p.mode === "Ping-pong") {
        const half = Math.ceil((N - 1) / 2);
        f = (i <= half ? i : (N - 1 - i)) / Math.max(1, half);
      }
      else if (p.mode === "Random") f = hash2(i * 17 + 3, 7, p.seed);
      else f = i / (N - 1);
      return p.min + f * (p.max - p.min);
    }
  
};
```

## stone.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "stone",
    name: "Stone", cat: "gen", group: "nature",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Stones", type: "slider", min: 1, max: 40, step: 1, def: 8 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 100, step: 1, def: 30 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "facets", label: "Facets", type: "slider", min: 5, max: 24, step: 1, def: 11 },
      { key: "angular", label: "Angularity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "shade", label: "Interior facets", type: "check", def: true },
      { key: "hatch", label: "Hatch shading", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "layout", label: "Layout", type: "select", options: ["Scatter", "Pile", "Wall"], def: "Scatter" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 173 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
      { key: "shadePen", label: "Shade pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer), SP = Math.round(p.shadePen);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8419 + 71);
      const paths = [];
      const oneStone = (cx, cy, sz, sd) => {
        const rr = mulberry32(sd);
        const nF = Math.round(p.facets);
        const outline = [];
        const radii = [];
        for (let i = 0; i < nF; i++) {
          const a = (i / nF) * Math.PI * 2 + (rr() - 0.5) * 0.2;
          /* angularity: satunnainen sade -> rosoinen; sileampi kun pieni */
          const r = sz * 0.5 * (1 - p.angular * 0.5 * rr());
          radii.push(r);
          outline.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82]);
        }
        paths.push({ pts: outline, closed: true, layer: L });
        /* sisafasetit: muutama viiva reunapisteista sisaan -> kolmiulotteinen lohkare */
        if (p.shade) {
          const hi = [cx - sz * 0.12, cy - sz * 0.12];
          const nEdge = Math.min(nF, 3 + Math.floor(rr() * 3));
          for (let k = 0; k < nEdge; k++) {
            const idx = Math.floor(rr() * nF);
            paths.push({ pts: [outline[idx], hi], closed: false, layer: L });
          }
        }
        /* viivoitusvarjo alaoikealla */
        if (p.hatch > 0.05) {
          const nH = Math.round(p.hatch * 10);
          for (let s = 0; s < nH; s++) {
            const t = s / (nH + 1);
            const y = cy + sz * 0.1 + t * sz * 0.32;
            const half = sz * 0.4 * (1 - t) * 0.6;
            paths.push({ pts: [[cx + sz * 0.05, y], [cx + sz * 0.05 + half, y - half * 0.4]], closed: false, layer: SP });
          }
        }
      };
      const n = Math.round(p.count);
      const placed = [];
      let guard = 0;
      for (let i = 0; i < n && guard < n * 50; ) {
        guard++;
        const sz = p.size * (1 - p.sizeVar * rng());
        let cx, cy;
        if (p.layout === "Wall") {
          const cols = Math.ceil(Math.sqrt(n * (W / H)));
          const rows = Math.ceil(n / cols);
          const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
          const c = i % cols, r = Math.floor(i / cols);
          cx = m + (c + 0.5) * cw + (rng() - 0.5) * cw * 0.2;
          cy = m + (r + 0.5) * ch + (rng() - 0.5) * ch * 0.2;
        } else if (p.layout === "Pile") {
          cx = W / 2 + (rng() - 0.5) * (W - 2 * m) * 0.7;
          cy = H - m - sz * 0.5 - rng() * rng() * (H - 2 * m) * 0.8;
        } else {
          cx = m + sz / 2 + rng() * (W - 2 * m - sz);
          cy = m + sz / 2 + rng() * (H - 2 * m - sz);
        }
        let ok = true;
        for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * 0.44) { ok = false; break; }
        if (!ok && p.layout !== "Pile") continue;
        placed.push([cx, cy, sz]);
        oneStone(cx, cy, sz, p.seed + i * 29);
        i++;
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## stretch.js

```js
import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "stretch",
    name: "Stretch", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Point (perspective)", "Directional"], def: "Directional" },
      { key: "cx", label: "Band center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Band center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "zw", label: "Band length mm (along)", type: "slider", min: 5, max: 300, step: 1, def: 40 },
      { key: "zh", label: "Band height mm (across)", type: "slider", min: 10, max: 400, step: 1, def: 120 },
      { key: "vpx", label: "Vanish point X mm", type: "slider", min: -300, max: 600, step: 1, def: 20 },
      { key: "vpy", label: "Vanish point Y mm", type: "slider", min: -300, max: 600, step: 1, def: 100 },
      { key: "angle", label: "Angle ° (directional)", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "amount", label: "Stretch mm (− compress)", type: "slider", min: -250, max: 250, step: 1, def: 90 },
      { key: "falloff", label: "Edge falloff", type: "select", options: ["Smooth", "Linear", "Spike"], def: "Smooth" },
      { key: "jit", label: "Per-path jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 47 },
    ],
    overlay(p) {
      let ux, uy;
      if (p.mode === "Directional") {
        const a = (p.angle * Math.PI) / 180;
        ux = Math.cos(a); uy = Math.sin(a);
      } else {
        const dx = p.cx - p.vpx, dy = p.cy - p.vpy;
        const d = Math.hypot(dx, dy) || 1;
        ux = dx / d; uy = dy / d;
      }
      const px = -uy, py = ux;
      const hw = p.zw / 2, hh = p.zh / 2;
      const g = [{
        kind: "poly",
        pts: [
          [p.cx - ux * hw - px * hh, p.cy - uy * hw - py * hh],
          [p.cx + ux * hw - px * hh, p.cy + uy * hw - py * hh],
          [p.cx + ux * hw + px * hh, p.cy + uy * hw + py * hh],
          [p.cx - ux * hw + px * hh, p.cy - uy * hw + py * hh],
        ],
      }];
      if (p.mode !== "Directional") g.push({ kind: "point", x: p.vpx, y: p.vpy });
      const L = Math.max(20, Math.min(Math.abs(p.amount), 80)) * Math.sign(p.amount || 1);
      g.push({ kind: "arrow", x1: p.cx, y1: p.cy, x2: p.cx + ux * L, y2: p.cy + uy * L });
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* monotoninen kaista-remap: kaistan sisalla u venyy lineaarisesti,
         kaistan jalkeen kaikki siirtyy amountin verran -> ei laskoksia, viivat suoriksi */
      const shape = (t) => {
        if (t <= 0) return 0;
        t = Math.min(1, t);
        if (p.falloff === "Linear") return t;
        if (p.falloff === "Spike") return Math.pow(t, 2.5);
        return t * t * (3 - 2 * t);
      };
      const half = p.zw / 2;
      const dirAngle = (p.angle * Math.PI) / 180;
      const dux = Math.cos(dirAngle), duy = Math.sin(dirAngle);
      const cdx = p.cx - p.vpx, cdy = p.cy - p.vpy;
      const rc = Math.hypot(cdx, cdy) || 1;
      const angC = Math.atan2(cdy, cdx);
      const angHalf = Math.atan(Math.max(0.01, (p.zh / 2) / rc));
      const paths = src.paths.map((path, pi) => {
        const rng = mulberry32(p.seed * 733 + pi * 271 + 9);
        const amt0 = p.amount * (1 - p.jit * rng());
        return {
          ...path,
          pts: resample(path.pts, path.closed, 0.8).map(([x, y]) => {
            let ux, uy, u, vF;
            if (p.mode === "Directional") {
              ux = dux; uy = duy;
              const rx = x - p.cx, ry = y - p.cy;
              u = rx * ux + ry * uy;
              const v = -rx * uy + ry * ux;
              vF = shape(1 - Math.abs(v) / (p.zh / 2));
            } else {
              const dx = x - p.vpx, dy = y - p.vpy;
              const r = Math.hypot(dx, dy) || 1;
              ux = dx / r; uy = dy / r;
              u = r - rc;
              let dA = Math.atan2(dy, dx) - angC;
              while (dA > Math.PI) dA -= Math.PI * 2;
              while (dA < -Math.PI) dA += Math.PI * 2;
              vF = shape(1 - Math.abs(dA) / angHalf);
            }
            if (vF <= 0) return [x, y];
            const amt = Math.max(-(p.zw * 0.95), amt0 * vF);
            let du;
            if (u <= -half) du = 0;
            else if (u >= half) du = amt;
            else du = ((u + half) / p.zw) * amt;
            return [x + ux * du, y + uy * du];
          }),
        };
      });
      return { paths };
    },
  
};
```

## subway.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "subway",
    name: "Subway Map",
    cat: "gen",
    group: "structural",
    desc: "A transit map in classic Massimo Vignelli style: octilinear routes (0/45/90 degrees only), lines bundling into shared corridors with even spacing and splitting off at 45, station dots on each line's own pen, larger interchange rings where lines meet, and terminal bars at route ends. Lines cycle through your pens - one color per route.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "lines", label: "Lines", type: "slider", min: 1, max: 8, step: 1, def: 5 },
      { key: "grid", label: "Grid step mm", type: "slider", min: 6, max: 24, step: 1, def: 12 },
      { key: "gap", label: "Line gap mm", type: "slider", min: 1, max: 4, step: 0.25, def: 2 },
      { key: "length", label: "Route length", type: "slider", min: 0.3, max: 1, step: 0.05, def: 0.7 },
      { key: "bend", label: "Bendiness", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.4 },
      { key: "stations", label: "Stations", type: "check", def: true },
      { key: "statEvery", label: "Station every mm", type: "slider", min: 12, max: 60, step: 1, def: 26 },
      { key: "statPen", label: "Interchange pen", type: "pen", def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 7 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 30 || y1 - y0 < 30) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 3181 + 7);
      const G = Math.max(4, p.grid);
      const N = Math.max(1, Math.min(8, Math.round(p.lines)));
      const GAP = p.gap;
      const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      /* octilinear walk inside the margin box */
      const walk = (sx, sy, d, steps) => {
        const pts = [[sx, sy]];
        let x = sx, y = sy;
        let sinceTurn = 0;
        for (let i = 0; i < steps; i++) {
          /* steer back inside if next step exits — never a full reversal */
          const fits = (dd) => {
            const nx = x + DIR[dd][0] * G, ny = y + DIR[dd][1] * G;
            return nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
          };
          if (!fits(d)) {
            const sgn = rng() < 0.5 ? 1 : -1;
            let found = -1;
            for (const t of [sgn, -sgn, 2 * sgn, -2 * sgn, 3 * sgn, -3 * sgn]) {
              const dd = ((d + t) % 8 + 8) % 8;
              if (fits(dd)) { found = dd; break; }
            }
            if (found < 0) break;
            d = found;
          }
          x += DIR[d][0] * G; y += DIR[d][1] * G;
          pts.push([x, y]);
          sinceTurn++;
          if (sinceTurn >= 2 && rng() < p.bend * 0.45) {
            d = (d + (rng() < 0.5 ? 1 : 7)) % 8;
            sinceTurn = 0;
          }
        }
        /* collapse spikes (A-B-A) so offsets can't tear them open */
        for (let i = pts.length - 2; i >= 1; i--) {
          if (Math.abs(pts[i - 1][0] - pts[i + 1][0]) < 0.01 && Math.abs(pts[i - 1][1] - pts[i + 1][1]) < 0.01) {
            pts.splice(i, 2);
            if (i > pts.length - 1) i = pts.length - 1;
          }
        }
        return pts;
      };
      /* lateral offset with 45/90-degree miters (bisector) */
      const offsetPoly = (pts, off) => {
        if (Math.abs(off) < 0.01 || pts.length < 2) return pts.map((q) => q.slice());
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const b = pts[i];
          /* endpoints: pure segment normal, no miter */
          if (i === 0 || i === pts.length - 1) {
            const q = i === 0 ? pts[1] : pts[pts.length - 2];
            let dx = i === 0 ? q[0] - b[0] : b[0] - q[0];
            let dy = i === 0 ? q[1] - b[1] : b[1] - q[1];
            const l = Math.hypot(dx, dy) || 1;
            out.push([b[0] + (-dy / l) * off, b[1] + (dx / l) * off]);
            continue;
          }
          const a = pts[i - 1], c = pts[i + 1];
          let d1x = b[0] - a[0], d1y = b[1] - a[1];
          let d2x = c[0] - b[0], d2y = c[1] - b[1];
          const l1 = Math.hypot(d1x, d1y) || 1, l2 = Math.hypot(d2x, d2y) || 1;
          d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
          const n1x = -d1y, n1y = d1x, n2x = -d2y, n2y = d2x;
          let bx = n1x + n2x, by = n1y + n2y;
          const bl = Math.hypot(bx, by);
          if (bl < 0.01) { bx = n1x; by = n1y; }
          else {
            bx /= bl; by /= bl;
            const dot = bx * n1x + by * n1y;
            const miter = Math.min(3.0, 1 / Math.max(0.3, dot));
            bx *= miter; by *= miter;
          }
          out.push([b[0] + bx * off, b[1] + by * off]);
        }
        return out;
      };
      /* trunks: shared corridors */
      const T = Math.max(1, Math.round(N / 3));
      const trunks = [];
      const area = Math.min(x1 - x0, y1 - y0);
      const trunkSteps = Math.round((area / G) * 2.2 * p.length);
      for (let t = 0; t < T; t++) {
        const sx = x0 + G + Math.round(rng() * ((x1 - x0 - 2 * G) / G)) * G;
        const sy = y0 + G + Math.round(rng() * ((y1 - y0 - 2 * G) / G)) * G;
        trunks.push({ pts: walk(sx, sy, Math.floor(rng() * 8), trunkSteps), slots: 0 });
      }
      /* lines: follow a span of a trunk at their slot offset + own 45-degree tails */
      const linePolys = [];
      for (let i = 0; i < N; i++) {
        const tr = trunks[i % T];
        const slot = tr.slots++;
        const off = (slot - (Math.ceil(N / T) - 1) / 2) * GAP;
        const M2 = tr.pts.length;
        if (M2 < 6) continue;
        const a = Math.floor(rng() * M2 * 0.25);
        const b = M2 - 1 - Math.floor(rng() * M2 * 0.25);
        const span = tr.pts.slice(a, b + 1);
        /* tails: continue from span ends, first step turns off the corridor */
        const tail = (end) => {
          const e = end ? span[span.length - 1] : span[0];
          const e2 = end ? span[span.length - 2] : span[1];
          let dx = e[0] - e2[0], dy = e[1] - e2[1];
          let d = DIR.findIndex(([qx, qy]) => Math.abs(qx * G - dx) < 0.5 && Math.abs(qy * G - dy) < 0.5);
          if (d < 0) d = 0;
          d = (d + (rng() < 0.5 ? 1 : 7)) % 8;
          const tl = walk(e[0], e[1], d, Math.round(trunkSteps * (0.15 + rng() * 0.3)));
          return tl.slice(1);
        };
        const tEnd = tail(true), tStart = tail(false).reverse();
        const full = [...tStart, ...span, ...tEnd];
        const poly = offsetPoly(full, off);
        linePolys.push({ poly, layer: i, off });
        push(poly, false, i);
      }
      /* terminal bars: short perpendicular tick at each end */
      for (const L of linePolys) {
        const P = L.poly;
        for (const end of [0, 1]) {
          const a = end ? P[P.length - 1] : P[0];
          const b = end ? P[P.length - 2] : P[1];
          let dx = a[0] - b[0], dy = a[1] - b[1];
          const l = Math.hypot(dx, dy) || 1;
          const nx = -dy / l, ny = dx / l;
          const r = GAP * 1.1;
          push([[a[0] - nx * r, a[1] - ny * r], [a[0] + nx * r, a[1] + ny * r]], false, L.layer);
        }
      }
      /* stations */
      if (p.stations) {
        const segD = (x, y, s) => {
          const dx = s[2] - s[0], dy = s[3] - s[1];
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
        };
        const lineSegs = linePolys.map((L) => {
          const segs = [];
          for (let i = 1; i < L.poly.length; i++) segs.push([L.poly[i - 1][0], L.poly[i - 1][1], L.poly[i][0], L.poly[i][1]]);
          return segs;
        });
        const circle = (cx, cy, r) => {
          const nn = Math.max(10, Math.round(r * 6));
          const c = [];
          for (let k = 0; k < nn; k++) {
            const a = (k / nn) * Math.PI * 2;
            c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
          return c;
        };
        for (let li = 0; li < linePolys.length; li++) {
          const P = linePolys[li].poly;
          let acc = p.statEvery * 0.5;
          for (let i = 1; i < P.length; i++) {
            const ds = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
            let s = 0;
            while (acc + (ds - s) >= p.statEvery) {
              const need = p.statEvery - acc;
              s += need;
              const t = s / ds;
              const sx = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t;
              const sy = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t;
              /* interchange? close to another line */
              let inter = false;
              for (let lj = 0; lj < lineSegs.length && !inter; lj++) {
                if (lj === li) continue;
                for (const sg of lineSegs[lj]) {
                  if (segD(sx, sy, sg) < GAP * 1.8) { inter = true; break; }
                }
              }
              if (inter) push(circle(sx, sy, GAP * 1.3), true, Math.round(p.statPen));
              else push(circle(sx, sy, 1.0), true, linePolys[li].layer);
              acc = 0;
            }
            acc += ds - s;
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## superformula.js

```js
import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "superformula",
    name: "Superformula",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "m", label: "Symmetry m", type: "slider", min: 0, max: 24, step: 1, def: 6 },
      { key: "n1", label: "n1", type: "slider", min: 0.1, max: 40, step: 0.1, def: 3 },
      { key: "n2", label: "n2", type: "slider", min: 0.1, max: 40, step: 0.1, def: 6 },
      { key: "n3", label: "n3", type: "slider", min: 0.1, max: 40, step: 0.1, def: 6 },
      { key: "asym", label: "a/b asymmetry", type: "slider", min: 0.2, max: 5, step: 0.05, def: 1 },
      { key: "rings", label: "Rings", type: "slider", min: 1, max: 24, step: 1, def: 1 },
      { key: "twist", label: "Twist deg / ring", type: "slider", min: 0, max: 45, step: 0.5, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m2 = Math.max(0, p.margin);
      const Rmax = Math.min(W, H) / 2 - m2;
      if (Rmax < 5) return applyStyle({ paths: [] }, ins[0]);
      const cx = W / 2, cy = H / 2;
      const mm = Math.max(0, Math.round(p.m));
      const n1 = Math.max(0.05, p.n1), n2 = Math.max(0.05, p.n2), n3 = Math.max(0.05, p.n3);
      const a = 1, b = Math.max(0.05, p.asym);
      const NPTS = 720;
      /* Gielis superformula, guarded against zero base */
      const rBase = new Float64Array(NPTS);
      let rMax = 0;
      for (let i = 0; i < NPTS; i++) {
        const th = (i / NPTS) * Math.PI * 2;
        const t1 = Math.pow(Math.abs(Math.cos((mm * th) / 4) / a), n2);
        const t2 = Math.pow(Math.abs(Math.sin((mm * th) / 4) / b), n3);
        const base = Math.max(1e-9, t1 + t2);
        const r = Math.pow(base, -1 / n1);
        rBase[i] = Number.isFinite(r) ? r : 0;
        if (rBase[i] > rMax) rMax = rBase[i];
      }
      if (rMax < 1e-9) return applyStyle({ paths: [] }, ins[0]);
      const K = Math.max(1, Math.min(32, Math.round(p.rings)));
      const paths = [];
      for (let k = 0; k < K; k++) {
        const scale = (K - k) / K;
        const off = (p.twist * Math.PI / 180) * k;
        const pts = [];
        for (let i = 0; i < NPTS; i++) {
          const th = (i / NPTS) * Math.PI * 2;
          const rr = (rBase[i] / rMax) * Rmax * scale;
          pts.push([cx + Math.cos(th + off) * rr, cy + Math.sin(th + off) * rr]);
        }
        paths.push({ pts, closed: true, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## svgimport.js

```js
import { Pin, EMPTY, PENS, applyStyle, signedArea, parseSVG } from "../helpers.js";

export default {
  key: "svgimport",
    name: "Import SVG", cat: "gen", group: "textimg", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "filename", label: "SVG file", type: "file", def: "" },
      { key: "fit", label: "Fit", type: "select", options: ["Fit to canvas", "Scale %"], def: "Fit to canvas" },
      { key: "scale", label: "Scale %", type: "slider", min: 1, max: 400, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "offx", label: "Offset X mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "offy", label: "Offset Y mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "dirs", label: "Directions", type: "select", options: ["Original", "Closed clockwise", "Closed counter-clockwise"], def: "Original" },
      { key: "colmode", label: "Colors", type: "select", options: ["From SVG colors", "Single pen"], def: "From SVG colors" },
      { key: "layer", label: "Pen (if single)", type: "pen", def: 0 },
    ],
    onFile(text) { return parseSVG(text); },
    compute(ins, p, ctx, node) {
      const svg = node && node.data && node.data.svg;
      if (!svg) return EMPTY;
      const { W, H } = ctx;
      let s, ox, oy;
      if (p.fit === "Fit to canvas") {
        s = Math.min((W - 2 * p.margin) / svg.bbox.w, (H - 2 * p.margin) / svg.bbox.h);
        ox = (W - svg.bbox.w * s) / 2 - svg.bbox.x * s;
        oy = (H - svg.bbox.h * s) / 2 - svg.bbox.y * s;
      } else {
        s = p.scale / 100;
        ox = p.margin - svg.bbox.x * s;
        oy = p.margin - svg.bbox.y * s;
      }
      const paths = svg.paths.map((sp) => {
        let pts = sp.pts.map(([x, y]) => [x * s + ox + p.offx, y * s + oy + p.offy]);
        if (sp.closed && p.dirs !== "Original") {
          const cw = signedArea(pts) > 0; // y-alas -koordinaatistossa
          const wantCw = p.dirs === "Closed clockwise";
          if (cw !== wantCw) pts = [...pts].reverse();
        }
        return {
          pts, closed: sp.closed,
          layer: p.colmode === "Single pen" ? Math.round(p.layer) : sp.colorIdx % PENS.length,
        };
      });
      return applyStyle({ paths }, ins[0]);
    },
  
};
```

## switch.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "switch",
    name: "Switch",
    cat: "duo",
    ins: [Pin("value", "Select"), Pin("paths", "A"), Pin("paths", "B"), Pin("paths", "C")],
    outs: [Pin("paths")],
    params: [
      { key: "sel", label: "Select (if unwired, wire Steps)", type: "slider", min: 0, max: 2, step: 1, def: 0 }
    ],
    compute(ins, p) {
      const val = typeof ins[0] === "number" ? ins[0] : p.sel;
      const wired = [];
      for (let i = 1; i <= 3; i++) {
        if (ins[i] && ins[i].paths && ins[i].paths.length) wired.push(ins[i]);
      }
      if (!wired.length) return EMPTY;
      const idx = ((Math.floor(val) % wired.length) + wired.length) % wired.length;
      const pick = wired[idx];
      return { paths: pick.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
    }
  
};
```

## symmetry.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "symmetry",
    name: "Symmetry", cat: "mod", group: "transform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "folds", label: "Folds", type: "slider", min: 1, max: 12, step: 1, def: 6 },
      { key: "mirror", label: "Mirror", type: "check", def: false },
      { key: "useCenter", label: "Use canvas center", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      const folds = Math.max(1, Math.round(p.folds));
      const paths = [];
      const variants = p.mirror
        ? [(x, y) => [x, y], (x, y) => [2 * cx - x, y]]
        : [(x, y) => [x, y]];
      for (const path of src.paths) {
        for (const v of variants) {
          const base = path.pts.map(([x, y]) => v(x, y));
          for (let k = 0; k < folds; k++) {
            const a = (k / folds) * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            paths.push({
              pts: base.map(([x, y]) => {
                const dx = x - cx, dy = y - cy;
                return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
              }),
              closed: path.closed, layer: path.layer,
            });
          }
        }
      }
      return { paths };
    },
  
};
```

## tangle.js

```js
import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "tangle",
    name: "Tangle Zone", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Zone", type: "select", options: ["Rectangle", "Circle"], def: "Rectangle" },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "zw", label: "Width / Ø mm", type: "slider", min: 10, max: 300, step: 1, def: 120 },
      { key: "zh", label: "Height mm", type: "slider", min: 10, max: 300, step: 1, def: 90 },
      { key: "strength", label: "Strength mm", type: "slider", min: 0, max: 80, step: 0.5, def: 25 },
      { key: "scale", label: "Noise scale", type: "slider", min: 0.01, max: 0.3, step: 0.005, def: 0.05 },
      { key: "seed", label: "Seed", type: "seed", def: 31 },
    ],
    overlay(p) {
      return p.shape === "Circle"
        ? [{ kind: "circle", cx: p.cx, cy: p.cy, r: p.zw / 2 }]
        : [{ kind: "rect", x: p.cx - p.zw / 2, y: p.cy - p.zh / 2, w: p.zw, h: p.zh }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* voimakkuus 0 reunalla -> ankkurit pysyvat; kasvaa keskustaa kohti */
      const fall = (x, y) => {
        let t;
        if (p.shape === "Circle") {
          const d = Math.hypot(x - p.cx, y - p.cy);
          t = 1 - d / (p.zw / 2);
        } else {
          const fx = 1 - Math.abs(x - p.cx) / (p.zw / 2);
          const fy = 1 - Math.abs(y - p.cy) / (p.zh / 2);
          t = Math.min(fx, fy);
        }
        if (t <= 0) return 0;
        t = Math.min(1, t * 1.6);
        return t * t * (3 - 2 * t);
      };
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 1).map(([x, y]) => {
          const f = fall(x, y);
          if (f === 0) return [x, y];
          const dx = (noise2(x * p.scale, y * p.scale, p.seed) - 0.5) * 2;
          const dy = (noise2(x * p.scale + 77, y * p.scale + 31, p.seed) - 0.5) * 2;
          return [x + dx * p.strength * f, y + dy * p.strength * f];
        }),
      }));
      return { paths };
    },
  
};
```

## testcard.js

```js
import { Pin, PENS, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "testcard",
  name: "Test Card",
  cat: "gen",
  group: "structural",
  desc: "Calibration sheets for pen and machine: line weight sweep (repeat passes), converging line spacing, hatch density squares, arcs and tight circles, pen-lift dot grid, fill swatches, registration marks, a speed-ramp zigzag - and a Pen palette that draws one labelled swatch per pen (all 12) for ink checks. The grid auto-shrinks its cells to fit the current canvas.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "tests", label: "Tests", type: "multi", options: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches", "Registration", "Speed ramp", "Pen palette (12)"], def: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches"] },
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 4, step: 1, def: 2 },
    { key: "cell", label: "Cell size mm", type: "slider", min: 30, max: 120, step: 1, def: 62 },
    { key: "gap", label: "Cell gap mm", type: "slider", min: 4, max: 30, step: 1, def: 12 },
    { key: "labels", label: "Labels", type: "check", def: true },
    { key: "labelPen", label: "Label pen", type: "pen", def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const AP = Math.round(p.labelPen);
    const m = p.margin;
    const paths = [];
    const line = (a, b, ly) => paths.push({ pts: [a, b], closed: false, layer: ly === undefined ? L : ly });
    const poly = (pts, closed, ly) => paths.push({ pts, closed: !!closed, layer: ly === undefined ? L : ly });
    const arc = (cx, cy, r, a0, a1, n) => {
      const pts = [];
      const N = n || 40;
      for (let k = 0; k <= N; k++) {
        const a = a0 + (a1 - a0) * (k / N);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      poly(pts, false);
    };
    const label = (str, x, y, sz, ly) => {
      const fs = fontStrokes(String(str), sz || 3.2, 1);
      for (const st of fs.strokes) paths.push({ pts: st.map(([gx, gy]) => [x + gx, y + gy]), closed: false, layer: ly === undefined ? AP : ly });
    };
    /* --- yksittaiset testit; kukin piirtaa soluun (x0,y0,cs) --- */
    const drawTest = (name, x0, y0, cs) => {
      if (p.labels) label(name, x0, y0 - 3, Math.min(3.4, cs * 0.055));
      const pad = 3;
      const ix = x0 + pad, iy = y0 + pad, iw = cs - pad * 2, ih = cs - pad * 2;
      if (name === "Line weight sweep") {
        /* sama viiva monta kertaa: yksi veto, 2, 3... paallekkain -> nakyva paksuus/peitto.
           plotterilla toistoveto tummentaa; nakee myos kohdistustarkkuuden. */
        const rows = 6;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const passes = r + 1;
          for (let q = 0; q < passes; q++) {
            line([ix, y + (q - passes / 2) * 0.15], [ix + iw * 0.8, y + (q - passes / 2) * 0.15]);
          }
          if (p.labels) label(passes + "x", ix + iw * 0.84, y + 1.2, 2.6);
        }
      } else if (name === "Line spacing") {
        /* tihenevat pystyviivat: nakee milloin viivat sulautuvat / kynan leveys */
        const gaps = [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25];
        let x = ix;
        for (let g = 0; g < gaps.length && x < ix + iw; g++) {
          const grp = ix + (g / gaps.length) * iw;
          for (let k = 0; k < 5; k++) {
            const xx = grp + k * gaps[g];
            if (xx < ix + iw) line([xx, iy], [xx, iy + ih * 0.82]);
          }
          if (p.labels) label(gaps[g] + "", grp, iy + ih * 0.9, 2.2);
        }
      } else if (name === "Hatch density") {
        /* nelja ruutua kasvavalla viivoitustiheydella + ristikko */
        const dens = [2.5, 1.5, 1, 0.6];
        for (let i = 0; i < 4; i++) {
          const qx = ix + (i % 2) * (iw / 2), qy = iy + Math.floor(i / 2) * (ih / 2);
          const qw = iw / 2 - 2, qh = ih / 2 - 2;
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true);
          for (let y = qy + dens[i]; y < qy + qh; y += dens[i]) line([qx, y], [qx + qw, y]);
          if (i >= 2) for (let x = qx + dens[i]; x < qx + qw; x += dens[i]) line([x, qy], [x, qy + qh]);
          if (p.labels) label(dens[i] + "", qx + 1, qy + qh - 1, 2.2);
        }
      } else if (name === "Arcs & circles") {
        /* sisakkaiset ympyrat + kaaria eri sateilla: nakee pyoreyden ja nykimisen */
        const cx = ix + iw / 2, cy = iy + ih / 2;
        for (let r = ih * 0.08; r < ih * 0.48; r += ih * 0.09) arc(cx, cy, r, 0, Math.PI * 2, Math.max(24, r * 3));
        /* pienet kaaret kulmassa: tiukka kaarre = nykiva jos kiihtyvyys liian iso */
        for (let i = 0; i < 4; i++) arc(ix + iw * 0.5, iy + ih * 0.5, 2 + i * 1.2, 0, Math.PI * 1.5, 20);
      } else if (name === "Pen-lift dots") {
        /* pisteruudukko: jokainen = nosto+lasku+minimiveto. testaa noston toistettavuutta
           ja settle-viivetta (jos kyna vetaa hannan -> viive liian pieni). */
        const n = 8;
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          const x = ix + (c + 0.5) * (iw / n), y = iy + (r + 0.5) * (ih / n);
          /* minimiveto: pieni risti, paljastaa hannat molempiin suuntiin */
          line([x - 0.6, y], [x + 0.6, y]);
          line([x, y - 0.6], [x, y + 0.6]);
        }
        if (p.labels) label("lift x" + (n * n), ix, iy + ih + 0.5, 2.4);
      } else if (name === "Fill swatches") {
        /* kolme taytto-tyylia: vaaka, ristikko, spiraali -> kynan peittavyys */
        const sw = iw / 3 - 1;
        /* 1 vaakatäytto */
        for (let y = iy; y < iy + ih * 0.7; y += 0.8) line([ix, y], [ix + sw, y]);
        /* 2 ristikko */
        const x2 = ix + iw / 3;
        for (let y = iy; y < iy + ih * 0.7; y += 1) line([x2, y], [x2 + sw, y]);
        for (let x = x2; x < x2 + sw; x += 1) line([x, iy], [x, iy + ih * 0.7]);
        /* 3 spiraali */
        const cx = ix + iw * 0.83, cy = iy + ih * 0.35, sp = [];
        for (let t = 0; t < Math.PI * 12; t += 0.25) {
          const rr = t * 0.28;
          if (rr > sw / 2) break;
          sp.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
        }
        poly(sp, false);
        if (p.labels) { label("flat", ix, iy + ih * 0.78, 2.4); label("grid", x2, iy + ih * 0.78, 2.4); label("spir", cx - sw / 3, iy + ih * 0.78, 2.4); }
      } else if (name === "Registration") {
        /* kohdistusristi + neliot: monikynatoiston tarkkuus */
        const cx = ix + iw / 2, cy = iy + ih / 2;
        line([cx - iw * 0.4, cy], [cx + iw * 0.4, cy]);
        line([cx, cy - ih * 0.4], [cx, cy + ih * 0.4]);
        for (const r of [iw * 0.12, iw * 0.24, iw * 0.36]) poly([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], true);
        arc(cx, cy, iw * 0.06, 0, Math.PI * 2, 24);
      } else if (name === "Speed ramp") {
        /* siksak jonka amplitudi/tiheys kasvaa: nopeat suunnanvaihdot paljastavat
           kiihtyvyysrajan (pyoristyvat kulmat / helinä). */
        const rows = 5;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const teeth = 4 + r * 4;
          const amp = ih / rows * 0.35;
          const pts = [];
          for (let k = 0; k <= teeth; k++) {
            pts.push([ix + (k / teeth) * iw, y + (k % 2 ? amp : -amp)]);
          }
          poly(pts, false);
          if (p.labels) label(teeth + "", ix + iw + 0.5, y + 1, 2.4);
        }
      } else if (name === "Pen palette (12)") {
        /* 12 ruutua, kukin OMALLA kynallaan: mustesavyt, paksuudet ja
           kynanvaihtojen kohdistus yhdella arkilla. label-kaista ruudun alla. */
        const pc = 4, pr = 3;
        const labH = p.labels ? 5 : 1.5;
        for (let i = 0; i < PENS.length; i++) {
          const c = i % pc, r = Math.floor(i / pc);
          const cellW = iw / pc, cellH = ih / pr;
          const qw = cellW - 2.5, qh = cellH - labH - 1;
          const qx = ix + c * cellW, qy = iy + r * cellH;
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true, i);
          for (let y = qy + 1; y < qy + qh - 0.4; y += 1.1) line([qx + 0.8, y], [qx + qw - 0.8, y], i);
          if (p.labels) label(i + "", qx + qw / 2 - 1.2, qy + qh + 1.2, 2.4, i);
        }
      }
    };
    /* --- ruudukkoasettelu: solukoko kutistuu jos ruudukko ei mahdu arkille --- */
    const sel = (p.tests && p.tests.length ? p.tests : ["Line weight sweep"]);
    const cols = Math.round(p.cols);
    const gap = p.gap;
    const rowsN = Math.ceil(sel.length / cols);
    let cs = p.cell;
    const fitW = (W - 2 * m - (cols - 1) * gap) / cols;
    const fitH = (H - 2 * m - 6 - (rowsN - 1) * (gap + 6) - 6) / rowsN;
    cs = Math.max(24, Math.min(cs, fitW, fitH));
    const gridW = cols * cs + (cols - 1) * gap;
    const startX = m + Math.max(0, (W - 2 * m - gridW) / 2);
    let startY = m + 6;
    sel.forEach((name, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x0 = startX + c * (cs + gap);
      const y0 = startY + r * (cs + gap + 6);
      drawTest(name, x0, y0, cs);
    });
    return applyStyle({ paths }, ins[0]);
  },
};
```

## textpath.js

```js
import { Pin, resample, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "textpath",
    name: "Text on Path",
    cat: "gen",
    group: "textimg",
    ins: [Pin("paths", "Path"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text", type: "text", def: "MUUSIA" },
      { key: "size", label: "Size mm (cap height)", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
      { key: "track", label: "Tracking %", type: "slider", min: 50, max: 300, step: 1, def: 100 },
      { key: "align", label: "Align on path", type: "select", options: ["Start", "Center", "End"], def: "Center" },
      { key: "startPct", label: "Start offset %", type: "slider", min: -50, max: 100, step: 1, def: 0 },
      { key: "baseline", label: "Baseline offset mm", type: "slider", min: -40, max: 40, step: 0.5, def: 0 },
      { key: "side", label: "Side", type: "select", options: ["Along", "Flip (read other side)"], def: "Along" },
      { key: "repeat", label: "Repeat to fill", type: "check", def: false },
      { key: "gap", label: "Repeat gap mm", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
      { key: "res", label: "Curve sample mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.6 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const F = SFONT; /* baked-in: module scope */
      const sc = Math.max(0.01, p.size) / 10;
      const tr = Math.max(0.1, p.track / 100);
      const flip = p.side === "Flip (read other side)";

      /* fallback spine: straight horizontal line if nothing wired */
      const spines = ins[0] && ins[0].paths && ins[0].paths.length
        ? ins[0].paths
        : [{ pts: [[15, H / 2], [W - 15, H / 2]], closed: false, layer: L }];

      /* advance width of one glyph including inter-letter gap */
      const glyphW = (ch) => ((F[ch] || F[" "]).w + 2) * sc * tr;
      const strForWidth = (s) => {
        let w = 0;
        for (const ch of s) w += glyphW(ch);
        return w;
      };

      const chars = String(p.text || "").toUpperCase().split("");
      const oneW = strForWidth(chars);
      if (oneW <= 0) return applyStyle({ paths: [] }, ins[1]);

      const paths = [];

      for (const spine of spines) {
        const base = resample(spine.pts, spine.closed, Math.max(0.2, p.res));
        if (base.length < 2) continue;
        const closed = !!spine.closed;
        const pts2 = closed ? [...base, base[0]] : base;

        /* arc-length table */
        const cum = [0];
        for (let i = 1; i < pts2.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts2[i][0] - pts2[i - 1][0], pts2[i][1] - pts2[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 1) continue;

        /* position + unit tangent at arc-length s */
        const at = (s) => {
          if (closed) { s = ((s % total) + total) % total; }
          else { s = Math.max(0, Math.min(total, s)); }
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = pts2[lo][0] + (pts2[hi][0] - pts2[lo][0]) * f;
          const y = pts2[lo][1] + (pts2[hi][1] - pts2[lo][1]) * f;
          let tx = pts2[hi][0] - pts2[lo][0], ty = pts2[hi][1] - pts2[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };

        /* one pass lays out chars starting at arc-length s0 */
        const layout = (s0) => {
          let cursor = s0;
          for (const ch of chars) {
            const g = F[ch] || F[" "];
            const adv = glyphW(ch);
            /* place glyph centered on its own advance so rotation looks even */
            const glyphCenter = cursor + adv / 2;
            const [cx, cy, tx, ty] = at(glyphCenter);
            /* tangent (reading direction) and normal */
            let dx = tx, dy = ty, nx = -ty, ny = tx;
            if (flip) { dx = -dx; dy = -dy; nx = -nx; ny = -ny; }
            /* glyph local origin: left edge of glyph body, baseline at y=10*sc.
               We want the glyph's own left edge at (cursor) along the path and
               its baseline shifted by p.baseline along the normal. Local x measured
               from glyph left; recenter so text advance aligns with path arc-length. */
            const halfAdv = adv / 2;
            for (const stroke of g.s) {
              if (stroke.length < 2) continue;
              const outPts = stroke.map(([gx, gy]) => {
                /* local coords in mm: lx along reading dir (0..adv), ly up/down.
                   baseline of font is gy=10 (bottom); shift so baseline sits on path. */
                const lx = gx * sc - halfAdv;              /* center glyph on its advance */
                const ly = (gy * sc - 10 * sc) + p.baseline; /* 0 at baseline, negative = up */
                return [
                  cx + dx * lx + nx * ly,
                  cy + dy * lx + ny * ly,
                ];
              });
              paths.push({ pts: outPts, closed: false, layer: L });
            }
            cursor += adv;
          }
          return cursor;
        };

        if (p.repeat) {
          const stride = oneW + Math.max(0, p.gap);
          let s = (p.startPct / 100) * total;
          /* how many fit */
          const room = closed ? total : (total - s);
          let n = Math.max(1, Math.floor((room + Math.max(0, p.gap)) / stride));
          if (closed) n = Math.max(1, Math.floor(total / stride));
          for (let k = 0; k < n; k++) layout(s + k * stride);
        } else {
          let s0;
          if (p.startPct !== 0) {
            s0 = (p.startPct / 100) * total;
          } else if (p.align === "Center") {
            s0 = (total - oneW) / 2;
          } else if (p.align === "End") {
            s0 = total - oneW;
          } else {
            s0 = 0;
          }
          layout(s0);
        }
      }

      return applyStyle({ paths }, ins[1]);
    },
  
};
```

## tiles.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "tiles",
  name: "Tiles",
  cat: "gen",
  group: "geometric",
  desc: "Grid of tiles, each a separate closed path: parametric Superellipse, Circle, Triangle, Hexagon, Star, Reuleaux or Cross, with per-tile rotation and jitter. Layout: Grid, Brick (odd rows offset half a cell) or Hex pack (offset rows at 0.866 pitch - circles and hexagons at Size 100 touch their neighbours). Alternate flip rotates every other tile 180 degrees so triangles tessellate. The natural Explosion input.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 40, step: 1, def: 10 },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 40, step: 1, def: 7 },
    { key: "layout", label: "Layout", type: "select", options: ["Grid", "Brick (offset rows)", "Hex pack"], def: "Grid" },
    { key: "flipAlt", label: "Alternate flip (triangles)", type: "check", def: false },
    { key: "shape", label: "Shape", type: "select", options: ["Superellipse", "Circle", "Triangle", "Hexagon", "Star", "Reuleaux", "Cross"], def: "Superellipse" },
    { key: "superN", label: "Superellipse N", type: "slider", min: 0.4, max: 8, step: 0.05, def: 2.5 },
    { key: "sizeX", label: "Size X %", type: "slider", min: 10, max: 100, step: 1, def: 78 },
    { key: "sizeY", label: "Size Y % (0 = same)", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "starPts", label: "Star points", type: "slider", min: 3, max: 12, step: 1, def: 5 },
    { key: "starIn", label: "Star inner %", type: "slider", min: 10, max: 90, step: 1, def: 45 },
    { key: "rot", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "rotJit", label: "Rotation jitter °", type: "slider", min: 0, max: 180, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 101 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const m = p.margin;
    const cols = Math.round(p.cols), rows = Math.round(p.rows);
    const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
    const rng = mulberry32(p.seed * 3169 + 61);
    const a = (cw / 2) * (p.sizeX / 100);
    const b = (ch / 2) * ((p.sizeY > 0 ? p.sizeY : p.sizeX) / 100);
    /* muodon pisteet yksikkokoossa (a,b sisaan skaalattuna) */
    const shapePts = () => {
      const pts = [];
      if (p.shape === "Superellipse") {
        /* |x/a|^n + |y/b|^n = 1 : N 1 = timantti, 2 = ellipsi, iso = suorakulmio, <1 = astroidi */
        const e = 2 / Math.max(0.05, p.superN);
        for (let k = 0; k < 64; k++) {
          const t = (k / 64) * Math.PI * 2;
          const c = Math.cos(t), s = Math.sin(t);
          pts.push([
            a * Math.sign(c) * Math.pow(Math.abs(c), e),
            b * Math.sign(s) * Math.pow(Math.abs(s), e),
          ]);
        }
      } else if (p.shape === "Circle") {
        for (let k = 0; k < 48; k++) {
          const t = (k / 48) * Math.PI * 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Triangle") {
        for (let k = 0; k < 3; k++) {
          const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Hexagon") {
        for (let k = 0; k < 6; k++) {
          const t = (k / 6) * Math.PI * 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Star") {
        const n = Math.round(p.starPts);
        for (let k = 0; k < n * 2; k++) {
          const t = (k / (n * 2)) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? 1 : p.starIn / 100;
          pts.push([a * rr * Math.cos(t), b * rr * Math.sin(t)]);
        }
      } else if (p.shape === "Reuleaux") {
        /* kolme kaarta, keskukset kolmion vastakkaisissa karjissa */
        const V = [0, 1, 2].map((k) => {
          const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
          return [Math.cos(t), Math.sin(t)];
        });
        const R = Math.hypot(V[1][0] - V[0][0], V[1][1] - V[0][1]);
        for (let k = 0; k < 3; k++) {
          const c = V[k];
          const a1 = Math.atan2(V[(k + 1) % 3][1] - c[1], V[(k + 1) % 3][0] - c[0]);
          const a2 = Math.atan2(V[(k + 2) % 3][1] - c[1], V[(k + 2) % 3][0] - c[0]);
          let d = a2 - a1;
          while (d < 0) d += Math.PI * 2;
          for (let q = 0; q < 12; q++) {
            const t = a1 + (q / 12) * d;
            pts.push([(c[0] + Math.cos(t) * R) * a * 0.62, (c[1] + Math.sin(t) * R) * b * 0.62]);
          }
        }
      } else {
        /* Cross: risti */
        const t = 0.36;
        const cr = [
          [-t, -1], [t, -1], [t, -t], [1, -t], [1, t], [t, t],
          [t, 1], [-t, 1], [-t, t], [-1, t], [-1, -t], [-t, -t],
        ];
        for (const [x, y] of cr) pts.push([x * a, y * b]);
      }
      return pts;
    };
    const base = shapePts();
    const hexPack = p.layout === "Hex pack";
    const brick = p.layout === "Brick (offset rows)";
    const pitch = hexPack ? ch * 0.866 : ch;
    const totalH = (rows - 1) * pitch + ch;
    const oy0 = hexPack ? m + Math.max(0, (H - 2 * m - totalH) / 2) : m;
    const paths = [];
    for (let r = 0; r < rows; r++) {
      const off = (brick || hexPack) && r % 2 === 1;
      const nC = off ? Math.max(1, cols - 1) : cols;
      for (let c = 0; c < nC; c++) {
        const cx = m + (c + 0.5) * cw + (off ? cw / 2 : 0);
        const cy = oy0 + (hexPack ? r * pitch + ch / 2 : (r + 0.5) * ch);
        let ang = ((p.rot + (rng() - 0.5) * 2 * p.rotJit) * Math.PI) / 180;
        if (p.flipAlt && (r + c) % 2 === 1) ang += Math.PI;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        paths.push({
          pts: base.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]),
          closed: true,
          layer: L,
        });
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
```

## tileshuffle.js

```js
import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "tileshuffle",
    name: "Tile Shuffle",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Columns", type: "slider", min: 2, max: 12, step: 1, def: 4 },
      { key: "rows", label: "Rows", type: "slider", min: 2, max: 12, step: 1, def: 5 },
      { key: "amount", label: "Shuffle amount", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "flips", label: "Random flips / 180", type: "check", def: true },
      { key: "res", label: "Cut step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "seed", label: "Seed", type: "seed", def: 47 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const C = Math.max(1, Math.min(16, Math.round(p.cols)));
      const R = Math.max(1, Math.min(16, Math.round(p.rows)));
      const tw = W / C, th = H / R;
      const NT = C * R;
      /* seeded permutation over a subset chosen by Amount */
      const rng = mulberry32(p.seed * 5501 + 9);
      const inShuffle = [];
      for (let i = 0; i < NT; i++) if (rng() < p.amount) inShuffle.push(i);
      const perm = new Array(NT);
      for (let i = 0; i < NT; i++) perm[i] = i;
      const pool = inShuffle.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      inShuffle.forEach((tile, k) => { perm[tile] = pool[k]; });
      /* per-tile flip/rotation (bounds-safe: flips + 180 only) */
      const mode = new Array(NT).fill(0);
      if (p.flips) {
        for (let i = 0; i < NT; i++) {
          if (perm[i] !== i || rng() < p.amount * 0.3) mode[i] = Math.floor(rng() * 4); /* 0=none 1=flipX 2=flipY 3=180 */
        }
      }
      const paths = [];
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        let run = [], lastTile = -1, prev = null;
        const flushRun = () => {
          if (run.length > 1) {
            const tile = lastTile;
            const dst = perm[tile];
            const sx = (tile % C) * tw, sy = Math.floor(tile / C) * th;
            const dx = (dst % C) * tw, dy = Math.floor(dst / C) * th;
            const mo = mode[tile];
            paths.push({
              pts: run.map(([x, y]) => {
                let lx = x - sx, ly = y - sy;
                if (mo === 1 || mo === 3) lx = tw - lx;
                if (mo === 2 || mo === 3) ly = th - ly;
                return [dx + lx, dy + ly];
              }),
              closed: false, layer: path.layer
            });
          }
          run = [];
        };
        for (const pt of pts) {
          const tx = Math.min(C - 1, Math.max(0, Math.floor(pt[0] / tw)));
          const ty = Math.min(R - 1, Math.max(0, Math.floor(pt[1] / th)));
          const tile = ty * C + tx;
          if (tile !== lastTile && run.length && prev) {
            /* exact cut: intersect the crossing segment with the tile border
               and give the boundary point to BOTH runs (no ink lost at seams) */
            const px = prev[0], py = prev[1];
            const dx = pt[0] - px, dy = pt[1] - py;
            const ptx = Math.floor(px / tw), pty = Math.floor(py / th);
            let t = 1;
            if (tx !== ptx && Math.abs(dx) > 1e-12) {
              const xb = tw * Math.max(ptx, tx);
              t = Math.min(t, (xb - px) / dx);
            }
            if (ty !== pty && Math.abs(dy) > 1e-12) {
              const yb = th * Math.max(pty, ty);
              t = Math.min(t, (yb - py) / dy);
            }
            t = Math.max(0, Math.min(1, t));
            const bp = [px + dx * t, py + dy * t];
            run.push(bp);
            flushRun();
            run = [bp.slice()];
          }
          lastTile = tile;
          run.push(pt);
          prev = pt;
        }
        flushRun();
      });
      return { paths };
    }
  
};
```

## topolar.js

```js
import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "topolar",
    name: "To Polar",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "rin", label: "Inner radius mm", type: "slider", min: 0, max: 80, step: 1, def: 15 },
      { key: "turns", label: "Turns", type: "slider", min: 0.25, max: 3, step: 0.05, def: 1 },
      { key: "start", label: "Start angle deg", type: "slider", min: 0, max: 360, step: 1, def: 270 },
      { key: "flip", label: "Top of canvas", type: "select", options: ["Outer edge", "Inner edge"], def: "Outer edge" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const rOut = Math.min(W, H) / 2 - m;
      const rIn = Math.max(0, Math.min(p.rin, rOut - 2));
      if (rOut - rIn < 2) return { paths: [] };
      const cx = W / 2, cy = H / 2;
      const a0 = (p.start * Math.PI) / 180;
      const TWO = Math.PI * 2;
      const outerTop = p.flip === "Outer edge";
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      /* cartesian canvas wrapped onto a ring: x -> angle, y -> radius */
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.25, p.res)).map(([x, y]) => {
          const u = x / W;
          const v = y / H;
          const ang = a0 + u * p.turns * TWO;
          const frac = outerTop ? 1 - v : v;
          const rr = rIn + frac * (rOut - rIn);
          return clamp([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
        })
      }));
      return { paths };
    }
  
};
```

## traceimg.js

```js
import { Pin, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "traceimg",
    name: "Trace Image",
    cat: "gen",
    group: "textimg",
    fileImage: true,
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "levels", label: "Threshold levels", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "low", label: "Lowest threshold", type: "slider", min: 0.05, max: 0.9, step: 0.05, def: 0.25 },
      { key: "high", label: "Highest threshold", type: "slider", min: 0.1, max: 0.95, step: 0.05, def: 0.75 },
      { key: "cell", label: "Cell mm", type: "slider", min: 0.8, max: 6, step: 0.2, def: 1.6 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx, node) {
      const img = node && node.data && node.data.img;
      if (!img) return applyStyle({ paths: [] }, ins[0]);
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const boxW = W - 2 * m, boxH = H - 2 * m;
      if (boxW < 10 || boxH < 10) return applyStyle({ paths: [] }, ins[0]);
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ox = (W - iw) / 2, oy = (H - ih) / 2;
      const darkAt = (x, y) => {
        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;
        const iu = Math.floor(u), iv = Math.floor(v);
        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];
        const fu = u - iu, fv = v - iv;
        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +
                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;
        return p.invert ? 1 - d : d;
      };
      const cell = Math.max(0.5, p.cell);
      const cols = Math.max(2, Math.round(iw / cell) + 1);
      const rows = Math.max(2, Math.round(ih / cell) + 1);
      const gx = (c) => ox + (c / (cols - 1)) * iw;
      const gy = (r) => oy + (r / (rows - 1)) * ih;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = darkAt(gx(c), gy(r));
      const NL = Math.max(1, Math.min(8, Math.round(p.levels)));
      const lo = Math.min(p.low, p.high), hi = Math.max(p.low, p.high);
      const segs = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let li = 0; li < NL; li++) {
        const lvl = NL === 1 ? (lo + hi) / 2 : lo + (li / (NL - 1)) * (hi - lo);
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segs.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## travelsort.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "travelsort",
    name: "Travel Sort",
    cat: "mod",
    group: "penout",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "reverse", label: "Allow reversing", type: "check", def: true },
      { key: "rotate", label: "Rotate closed starts", type: "check", def: true },
      { key: "bypen", label: "Group by pen", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (src.paths.length < 3) {
        return { paths: src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      /* group by pen (preserving order of first appearance), sort within groups */
      const groups = [];
      const byLayer = new Map();
      src.paths.forEach((pa) => {
        const key = p.bypen ? pa.layer : 0;
        if (!byLayer.has(key)) { byLayer.set(key, []); groups.push(byLayer.get(key)); }
        byLayer.get(key).push(pa);
      });
      const out = [];
      let cur = [0, 0];
      for (const group of groups) {
        const items = group.map((pa) => ({
          pa,
          start: pa.pts[0],
          end: pa.pts[pa.pts.length - 1],
          used: false
        }));
        const HARD = 3000; /* O(n^2) guard: beyond this, pass through unsorted */
        if (items.length > HARD) {
          for (const it of items) out.push({ ...it.pa, pts: it.pa.pts.map((q) => q.slice()) });
          continue;
        }
        for (let n = 0; n < items.length; n++) {
          let best = -1, bestD = Infinity, bestRev = false;
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.used) continue;
            const d1 = Math.hypot(cur[0] - it.start[0], cur[1] - it.start[1]);
            if (d1 < bestD) { bestD = d1; best = i; bestRev = false; }
            if (p.reverse && !it.pa.closed) {
              const d2 = Math.hypot(cur[0] - it.end[0], cur[1] - it.end[1]);
              if (d2 < bestD) { bestD = d2; best = i; bestRev = true; }
            }
          }
          const it = items[best];
          it.used = true;
          let pts = it.pa.pts.map((q) => q.slice());
          if (it.pa.closed && p.rotate) {
            /* enter a closed loop at its vertex nearest the pen */
            let bi = 0, bd = Infinity;
            for (let k = 0; k < pts.length; k++) {
              const d = Math.hypot(cur[0] - pts[k][0], cur[1] - pts[k][1]);
              if (d < bd) { bd = d; bi = k; }
            }
            if (bi > 0) pts = pts.slice(bi).concat(pts.slice(0, bi));
          } else if (bestRev) {
            pts.reverse();
          }
          out.push({ ...it.pa, pts });
          cur = it.pa.closed ? pts[0] : pts[pts.length - 1];
        }
      }
      return { paths: out };
    }
  
};
```

## travelstop.js

```js
import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "travelstop",
    name: "Travel Stop", cat: "mod", group: "penout",
    ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "every", label: "Distance mm", type: "slider", min: 100, max: 8000, step: 50, def: 2000 },
      { key: "mode", label: "Action", type: "select", options: ["Pause (M0)", "Pen change"], def: "Pause (M0)" },
      { key: "msg", label: "Message", type: "text", def: "Advance chalk / refill" },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* jaetaan polut peräkkäin ja lisataan stop-merkki kun kertyma ylittaa rajan.
         merkki kulkee polun kentassa __stop; G-code-generaattori lukee sen ja
         lisaa noston + M0/pen-change ennen ko. polkua. matka lasketaan piirretysta. */
      let acc = 0;
      const out = [];
      const plen = (pts, closed) => {
        let d = 0;
        for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (closed && pts.length > 1) d += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
        return d;
      };
      for (const path of src.paths) {
        const L = plen(path.pts, path.closed);
        if (acc + L > p.every && acc > 0) {
          out.push({ ...path, __stop: { mode: p.mode, msg: p.msg } });
          acc = L;
        } else {
          out.push({ ...path });
          acc += L;
        }
      }
      return { paths: out };
    },
  
};
```

## trimext.js

```js
import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
  key: "trimext",
    name: "Trim/Extend", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "ends", label: "Ends mm (− trim, + extend)", type: "slider", min: -20, max: 20, step: 0.25, def: 2 }],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      for (const path of src.paths) {
        if (path.closed || path.pts.length < 2 || p.ends === 0) { paths.push(path); continue; }
        if (p.ends > 0) {
          const pts = path.pts.map((q) => q.slice());
          const s0 = pts[0], s1 = pts[1];
          const e1 = pts[pts.length - 2], e0 = pts[pts.length - 1];
          const dl = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1;
          const el = Math.hypot(e0[0] - e1[0], e0[1] - e1[1]) || 1;
          pts.unshift([s0[0] - ((s1[0] - s0[0]) / dl) * p.ends, s0[1] - ((s1[1] - s0[1]) / dl) * p.ends]);
          pts.push([e0[0] + ((e0[0] - e1[0]) / el) * p.ends, e0[1] + ((e0[1] - e1[1]) / el) * p.ends]);
          paths.push({ ...path, pts });
        } else {
          const trim = -p.ends;
          const fine = resample(path.pts, false, 0.5);
          const L = pathLength(fine, false);
          if (L <= trim * 2 + 0.5) continue;
          const start = Math.ceil(trim / 0.5), end = fine.length - Math.ceil(trim / 0.5);
          const pts = fine.slice(start, Math.max(start + 2, end));
          if (pts.length > 1) paths.push({ ...path, pts });
        }
      }
      return { paths };
    },
  
};
```

## truchet.js

```js
import { Pin, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "truchet",
  name: "Truchet",
  cat: "gen",
  group: "geometric",
  desc: "Tiled quarter-circle patterns. Tiles mode draws arc or diagonal tiles; Tile fill leaves a seeded share of tiles empty; Separate clamps arc radii and forces an edge gap so strands never meet or cross. Loop mode grows a spanning tree and emits one single closed line that fills the canvas - a maze you can plot without lifting the pen.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Pattern", type: "select", options: ["Tiles", "Loop"], def: "Tiles" },
    { key: "ttype", label: "Tile type", type: "select", options: ["Arcs", "Diagonals"], def: "Arcs" },
    { key: "fill", label: "Tile fill % (Tiles)", type: "slider", min: 10, max: 100, step: 1, def: 100 },
    { key: "sep", label: "Lines", type: "select", options: ["Connected", "Separate (never meet)"], def: "Connected" },
    { key: "tile", label: "Tile mm", type: "slider", min: 4, max: 60, step: 1, def: 15 },
    { key: "scale", label: "Scale %", type: "slider", min: 10, max: 400, step: 1, def: 100 },
    { key: "lines", label: "Lines per tile", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "spread", label: "Line spread %", type: "slider", min: 10, max: 100, step: 1, def: 100 },
    { key: "gapmm", label: "Arc gap mm", type: "slider", min: 0, max: 8, step: 0.1, def: 0 },
    { key: "round", label: "Corner radius % (loop)", type: "slider", min: 10, max: 100, step: 1, def: 100 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 9 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const t = Math.max(1.5, p.tile * (p.scale / 100));
    const L = Math.round(p.layer);

    /* ---------- LOOP: yksi suljettu kieppi (virittävä puu -> kiertoreitti) ---------- */
    if (p.mode === "Loop") {
      const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
      const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
      const s = t / 2; /* alihilan askel */
      const ox = (W - cols * t) / 2 + t / 4;
      const oy = (H - rows * t) / 2 + t / 4;
      const rng = mulberry32(p.seed * 811 + 3);
      /* virittava puu solujen ylitse (satunnainen DFS) */
      const visited = new Set();
      const treeH = new Set(); /* "i,j" = reuna (i,j)-(i+1,j) */
      const treeV = new Set(); /* "i,j" = reuna (i,j)-(i,j+1) */
      const stack = [[Math.floor(rng() * cols), Math.floor(rng() * rows)]];
      visited.add(stack[0][0] + "," + stack[0][1]);
      while (stack.length) {
        const [ci, cj] = stack[stack.length - 1];
        const nbrs = [];
        if (ci > 0 && !visited.has((ci - 1) + "," + cj)) nbrs.push([ci - 1, cj, "H", ci - 1, cj]);
        if (ci < cols - 1 && !visited.has((ci + 1) + "," + cj)) nbrs.push([ci + 1, cj, "H", ci, cj]);
        if (cj > 0 && !visited.has(ci + "," + (cj - 1))) nbrs.push([ci, cj - 1, "V", ci, cj - 1]);
        if (cj < rows - 1 && !visited.has(ci + "," + (cj + 1))) nbrs.push([ci, cj + 1, "V", ci, cj]);
        if (!nbrs.length) { stack.pop(); continue; }
        const [ni, nj, kind, ei, ej] = nbrs[Math.floor(rng() * nbrs.length)];
        (kind === "H" ? treeH : treeV).add(ei + "," + ej);
        visited.add(ni + "," + nj);
        stack.push([ni, nj]);
      }
      /* alihilan reunat: joka solu pieni rengas, puun reunat leikkaa+liittaa renkaat yhdeksi */
      const edges = new Set();
      const ek = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
      const vk = (x, y) => x + "," + y;
      const addE = (x1, y1, x2, y2) => edges.add(ek(vk(x1, y1), vk(x2, y2)));
      const delE = (x1, y1, x2, y2) => edges.delete(ek(vk(x1, y1), vk(x2, y2)));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = [2 * i, 2 * j], b = [2 * i + 1, 2 * j], c = [2 * i, 2 * j + 1], d = [2 * i + 1, 2 * j + 1];
        addE(...a, ...b); addE(...b, ...d); addE(...d, ...c); addE(...c, ...a);
      }
      for (const key of treeH) {
        const [i, j] = key.split(",").map(Number);
        delE(2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1);
        delE(2 * i + 2, 2 * j, 2 * i + 2, 2 * j + 1);
        addE(2 * i + 1, 2 * j, 2 * i + 2, 2 * j);
        addE(2 * i + 1, 2 * j + 1, 2 * i + 2, 2 * j + 1);
      }
      for (const key of treeV) {
        const [i, j] = key.split(",").map(Number);
        delE(2 * i, 2 * j + 1, 2 * i + 1, 2 * j + 1);
        delE(2 * i, 2 * j + 2, 2 * i + 1, 2 * j + 2);
        addE(2 * i, 2 * j + 1, 2 * i, 2 * j + 2);
        addE(2 * i + 1, 2 * j + 1, 2 * i + 1, 2 * j + 2);
      }
      /* jokaisen pisteen aste on 2 -> seuraa sykli */
      const adj = {};
      for (const e of edges) {
        const [a, b] = e.split("|");
        (adj[a] = adj[a] || []).push(b);
        (adj[b] = adj[b] || []).push(a);
      }
      const startK = vk(0, 0);
      const loop = [];
      let cur = startK, prev = null;
      for (let guard = 0; guard < edges.size + 2; guard++) {
        loop.push(cur);
        const nb = adj[cur] || [];
        const nxt = nb[0] === prev ? nb[1] : nb[0];
        if (nxt === undefined) break;
        prev = cur; cur = nxt;
        if (cur === startK) break;
      }
      const V = loop.map((k) => {
        const [x, y] = k.split(",").map(Number);
        return [ox + x * s, oy + y * s];
      });
      /* pyorista kulmat neljanneskaarilla -> truchet-ilme */
      const r = (s / 2) * (p.round / 100);
      const pts = [];
      const N = V.length;
      for (let i = 0; i < N; i++) {
        const v = V[i], pr = V[(i - 1 + N) % N], nx = V[(i + 1) % N];
        const d1 = [v[0] - pr[0], v[1] - pr[1]];
        const d2 = [nx[0] - v[0], nx[1] - v[1]];
        const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
        const u1 = [d1[0] / l1, d1[1] / l1], u2 = [d2[0] / l2, d2[1] / l2];
        const cross = u1[0] * u2[1] - u1[1] * u2[0];
        if (Math.abs(cross) < 0.01) { pts.push([v[0], v[1]]); continue; } /* suora jatkuu */
        const P1 = [v[0] - u1[0] * r, v[1] - u1[1] * r];
        const C = [P1[0] + u2[0] * r, P1[1] + u2[1] * r];
        const a1 = Math.atan2(P1[1] - C[1], P1[0] - C[0]);
        const sweep = (cross > 0 ? 1 : -1) * (Math.PI / 2);
        for (let k = 0; k <= 6; k++) {
          const a = a1 + (k / 6) * sweep;
          pts.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]);
        }
      }
      return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);
    }

    /* ---------- TILES: perinteinen truchet-laatoitus ---------- */
    const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
    const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
    const ox = (W - cols * t) / 2, oy = (H - rows * t) / 2;
    const paths = [];
    const nL = Math.round(p.lines);
    const spread = p.spread / 100;
    const sep = p.sep === "Separate (never meet)";
    const gmm = sep ? Math.max(1, p.gapmm) : p.gapmm;
    const fillP = Math.max(0.05, Math.min(1, p.fill / 100));
    const arc = (cx, cy, a0) => {
      const seen = new Set();
      for (let m = 0; m < nL; m++) {
        let rr = t / 2 + ((m + 0.5) / nL - 0.5) * t * spread;
        if (sep) rr = Math.min(rr, t * 0.7); /* opposite-corner families cannot cross */
        if (rr <= 0.3) continue;
        const rk = Math.round(rr * 20);
        if (seen.has(rk)) continue; /* clamp may collapse radii */
        seen.add(rk);
        const dA = Math.min(0.55, (gmm / 2) / rr);
        const a1 = a0 + dA, a2 = a0 + Math.PI / 2 - dA;
        if (a2 <= a1) continue;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const a = a1 + (i / 12) * (a2 - a1);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
    };
    const diag = (x0, y0, kind) => {
      for (let m = 0; m < nL; m++) {
        const o = ((m + 0.5) / nL - 0.5) * t * spread;
        let A, B;
        if (kind === "\\") {
          A = o >= 0 ? [x0 + o, y0] : [x0, y0 - o];
          B = o >= 0 ? [x0 + t, y0 + t - o] : [x0 + t + o, y0 + t];
        } else {
          A = o >= 0 ? [x0 + t - o, y0] : [x0 + t, y0 - o];
          B = o >= 0 ? [x0, y0 + t - o] : [x0 - o, y0 + t];
        }
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy);
        const g2 = gmm / 2;
        if (len > gmm + 0.5) {
          A = [A[0] + (dx / len) * g2, A[1] + (dy / len) * g2];
          B = [B[0] - (dx / len) * g2, B[1] - (dy / len) * g2];
          paths.push({ pts: [A, B], closed: false, layer: L });
        }
      }
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (fillP < 0.999 && hash2(c * 7 + 3, r * 13 + 5, p.seed + 77) > fillP) continue;
      const x0 = ox + c * t, y0 = oy + r * t;
      const flip = hash2(c, r, p.seed) > 0.5;
      if (p.ttype === "Arcs") {
        if (flip) { arc(x0, y0, 0); arc(x0 + t, y0 + t, Math.PI); }
        else { arc(x0 + t, y0, Math.PI / 2); arc(x0, y0 + t, -Math.PI / 2); }
      } else {
        diag(x0, y0, flip ? "\\" : "/");
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
```

## trunks.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "trunks",
      name: "Trunks",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Trunks", type: "slider", min: 1, max: 30, step: 1, def: 7 },
      { key: "width", label: "Width mm", type: "slider", min: 2, max: 60, step: 0.5, def: 16 },
      { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "smooth", label: "Smoothness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65 },
      { key: "lean", label: "Lean", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "artifacts", label: "Artifacts (bark)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "taper", label: "Taper", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "markPen", label: "Bark pen", type: "pen", def: 0 },
      { key: "sameAsTrunk", label: "Bark = trunk pen", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 79 },
      { key: "layer", label: "Trunk pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const MP = p.sameAsTrunk ? L : Math.round(p.markPen);
      const paths = [];
      const rngG = mulberry32(p.seed * 2903 + 53);
      /* rungot jaettuna leveydelle kevyella jitterilla */
      const n = Math.round(p.count);
      const slots = [];
      for (let i = 0; i < n; i++) slots.push((i + 0.5) / n + (rngG() - 0.5) * (0.5 / n));
      for (let c = 0; c < n; c++) {
        const rng = mulberry32(p.seed * 2903 + c * 419 + 7);
        const w0 = p.width * (1 - p.widthVar * rng());
        const cx0 = p.margin + slots[c] * (W - 2 * p.margin);
        const leanAmt = (rng() - 0.5) * 2 * p.lean * w0 * 2.5;
        /* reunojen vaellus: smoothness pienentaa amplitudia ja hidastaa taajuutta */
        const amp = (1 - p.smooth) * w0 * 0.45;
        const fq = 2 + (1 - p.smooth) * 6;
        const nS = 110;
        const left = [], right = [];
        const edgeAt = (t) => {
          const cx = cx0 + leanAmt * t + (noise2(t * 1.2, c * 7.3, p.seed) - 0.5) * w0 * 0.7 * (1 - p.smooth);
          const w = (w0 / 2) * (1 - p.taper * (1 - t));   /* kapenee ylospain */
          const wl = (noise2(t * fq, c * 11.1, p.seed + 2) - 0.5) * 2 * amp;
          const wr = (noise2(t * fq, c * 11.1 + 50, p.seed + 3) - 0.5) * 2 * amp;
          return [cx - w + wl, cx + w + wr, cx, w * 2];
        };
        for (let i = 0; i <= nS; i++) {
          const t = i / nS;
          const y = p.margin + t * (H - 2 * p.margin);
          const [xl, xr] = edgeAt(t);
          left.push([xl, y]);
          right.push([xr, y]);
        }
        paths.push({ pts: left, closed: false, layer: L });
        paths.push({ pts: right, closed: false, layer: L });
        /* koivun kaarnamerkit: vaakasuuntaisia kaaria rungon sisalla,
           satunnainen osuus leveydesta, kevyt kaarevuus alaspain */
        const nMarks = Math.round(p.artifacts * 26 * (H / 200));
        for (let m = 0; m < nMarks; m++) {
          const t = 0.03 + rng() * 0.94;
          const y = p.margin + t * (H - 2 * p.margin);
          const [xl, xr] = edgeAt(t);
          const wSpan = xr - xl;
          if (wSpan < 1.5) continue;
          const a = rng() * 0.55;
          const b = a + 0.15 + rng() * Math.min(0.8, 1 - a - 0.15);
          const x0 = xl + wSpan * a, x1 = xl + wSpan * Math.min(0.97, b);
          const sagY = (0.3 + rng() * 0.9);
          const mid = [(x0 + x1) / 2, y + sagY];
          paths.push({ pts: [[x0, y], mid, [x1, y]], closed: false, layer: MP });
          /* osa merkeista kaksinkertaisia (paksu kaarnaviiru) */
          if (rng() < 0.3) {
            paths.push({ pts: [[x0, y + 1], [(x0 + x1) / 2, y + 1 + sagY], [x1, y + 1]], closed: false, layer: MP });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## tubes.js

```js
import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "tubes",
    name: "Tubes",
    cat: "gen",
    group: "structural",
    desc: "Tubes wandering and crossing in 3D, projected with perspective and drawn with real hidden lines: tubes break cleanly where they pass behind each other, and their own back side is hidden. Surface is one continuous spiral per tube (single pen-down) or a ring+line wireframe mesh. Radius is noise-modulated; wire Drift to make the tubes move over an animation.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tubes", label: "Tubes", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "radius", label: "Radius mm", type: "slider", min: 2, max: 20, step: 0.5, def: 8 },
      { key: "rmod", label: "Radius modulation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "wander", label: "Wander", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.5 },
      { key: "length", label: "Tube length mm", type: "slider", min: 80, max: 400, step: 10, def: 220 },
      { key: "surface", label: "Surface", type: "select", options: ["Spiral", "Mesh"], def: "Spiral" },
      { key: "density", label: "Spiral turns / ring gap", type: "slider", min: 1, max: 10, step: 0.5, def: 4 },
      { key: "longs", label: "Mesh longitudinals", type: "slider", min: 3, max: 10, step: 1, def: 6 },
      { key: "hidden", label: "Hidden lines", type: "check", def: true },
      { key: "drift", label: "Drift (wire Frame)", type: "slider", min: 0, max: 10, step: 0.05, def: 0 },
      { key: "yaw", label: "View yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 25 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 9 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const NT = Math.max(1, Math.min(8, Math.round(p.tubes)));
      const R0 = Math.max(1, p.radius);
      const DEPTH = Math.min(bw, bh) * 1.2;
      const box = { x: bw / 2, y: bh / 2, z: DEPTH / 2 };
      /* --- 1) center curves: smooth bouncing walks in a 3D box --- */
      const STEP = 1.4;
      const tubesC = [];
      for (let tI = 0; tI < NT; tI++) {
        const s = p.seed * 131 + tI * 977;
        let x = (hash2(tI * 3 + 1, 1, p.seed) - 0.5) * box.x * 1.4;
        let y = (hash2(tI * 3 + 2, 2, p.seed) - 0.5) * box.y * 1.4;
        let z = (hash2(tI * 3 + 3, 3, p.seed) - 0.5) * box.z * 1.4;
        let th = hash2(tI * 3 + 4, 4, p.seed) * Math.PI * 2;
        let ph = (hash2(tI * 3 + 5, 5, p.seed) - 0.5) * Math.PI * 0.8;
        const pts = [];
        const nSteps = Math.round(Math.max(40, p.length) / STEP);
        for (let i = 0; i <= nSteps; i++) {
          pts.push([x, y, z]);
          const u = i * STEP * 0.02;
          th += (noise2(u + tI * 7.3, p.drift + 11.1, s) - 0.5) * p.wander * 0.9;
          ph += (noise2(u + tI * 7.3, p.drift + 53.7, s + 1) - 0.5) * p.wander * 0.7;
          ph = Math.max(-1.1, Math.min(1.1, ph));
          x += Math.cos(th) * Math.cos(ph) * STEP;
          y += Math.sin(th) * Math.cos(ph) * STEP;
          z += Math.sin(ph) * STEP;
          /* bounce off the box walls to stay composed */
          if (x > box.x || x < -box.x) { th = Math.PI - th; x = Math.max(-box.x, Math.min(box.x, x)); }
          if (y > box.y || y < -box.y) { th = -th; y = Math.max(-box.y, Math.min(box.y, y)); }
          if (z > box.z || z < -box.z) { ph = -ph; z = Math.max(-box.z, Math.min(box.z, z)); }
        }
        tubesC.push(pts);
      }
      /* radius along each tube: noise-modulated */
      const rAt = (tI, i, n) => {
        const u = (i / n) * 6;
        const taper = Math.min(1, Math.min(i, n - i) / (n * 0.12));
        return R0 * (1 + (noise2(u + tI * 3.1, p.drift + 29.5, p.seed + 7 + tI) - 0.5) * 2 * p.rmod * 0.6) * (0.35 + 0.65 * taper);
      };
      /* --- 2) rotation-minimizing frames --- */
      const frames = tubesC.map((pts) => {
        const T = [], Nn = [], B = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
          const tl = Math.hypot(tx, ty, tz) || 1;
          tx /= tl; ty /= tl; tz /= tl;
          T.push([tx, ty, tz]);
          if (i === 0) {
            let nx = -ty, ny = tx, nz = 0;
            const nl = Math.hypot(nx, ny, nz) || 1;
            if (nl < 0.1) { nx = 1; ny = 0; nz = 0; }
            Nn.push([nx / nl, ny / nl, nz / nl]);
          } else {
            /* project previous normal off the new tangent */
            const pn = Nn[i - 1];
            const d = pn[0] * tx + pn[1] * ty + pn[2] * tz;
            let nx = pn[0] - d * tx, ny = pn[1] - d * ty, nz = pn[2] - d * tz;
            const nl = Math.hypot(nx, ny, nz) || 1;
            Nn.push([nx / nl, ny / nl, nz / nl]);
          }
          const t2 = T[i], n2 = Nn[i];
          B.push([
            t2[1] * n2[2] - t2[2] * n2[1],
            t2[2] * n2[0] - t2[0] * n2[2],
            t2[0] * n2[1] - t2[1] * n2[0]
          ]);
        }
        return { T, N: Nn, B };
      });
      /* --- 3) view: yaw around Y + slight pitch, perspective --- */
      const ya = (p.yaw * Math.PI) / 180, pa2 = 0.25;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      const FOC = DEPTH * 2.2;
      const proj = (x, y, z) => {
        let X = x * cy2 + z * sy2;
        let Z = -x * sy2 + z * cy2;
        let Y = y * cp2 - Z * sp2;
        Z = y * sp2 + Z * cp2;
        const s = FOC / (FOC + Z);
        return [X * s, Y * s, Z, s];
      };
      /* projected center samples per tube (occlusion buffer) */
      const centers = tubesC.map((pts, tI) => pts.map((q, i) => {
        const [X, Y, Z, s] = proj(q[0], q[1], q[2]);
        return { X, Y, Z, rp: rAt(tI, i, pts.length - 1) * s };
      }));
      /* --- 4) surface geometry (projected, with depth + occlusion info) --- */
      const rawPaths = []; /* { pts: [[X,Y,Z,tI]], layer } split later */
      const TWO = Math.PI * 2;
      for (let tI = 0; tI < NT; tI++) {
        const C = tubesC[tI], Fp = frames[tI];
        const n = C.length - 1;
        const surfPt = (i, ang) => {
          const r = rAt(tI, i, n);
          const Nv = Fp.N[i], Bv = Fp.B[i];
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const x = C[i][0] + (Nv[0] * ca + Bv[0] * sa) * r;
          const y = C[i][1] + (Nv[1] * ca + Bv[1] * sa) * r;
          const z = C[i][2] + (Nv[2] * ca + Bv[2] * sa) * r;
          const [X, Y, Z] = proj(x, y, z);
          return [X, Y, Z];
        };
        if (p.surface === "Spiral") {
          const turnsPer = Math.max(0.5, p.density);
          const pts = [];
          /* substep so the helix stays smooth */
          const SUB = 6;
          for (let i = 0; i < n; i++) {
            for (let ss = 0; ss < SUB; ss++) {
              const fi = i + ss / SUB;
              const i0 = Math.floor(fi);
              const ang = (fi * STEP / 10) * turnsPer * TWO;
              pts.push([...surfPt(i0, ang), tI, i0]);
            }
          }
          rawPaths.push({ pts, tI });
        } else {
          /* rings */
          const gap = Math.max(1.5, 12 / Math.max(0.5, p.density));
          const every = Math.max(1, Math.round(gap / STEP));
          for (let i = 0; i <= n; i += every) {
            const ring = [];
            for (let k = 0; k <= 24; k++) {
              ring.push([...surfPt(i, (k / 24) * TWO), tI, i]);
            }
            rawPaths.push({ pts: ring, tI });
          }
          /* longitudinals */
          const NL = Math.max(2, Math.min(12, Math.round(p.longs)));
          for (let l = 0; l < NL; l++) {
            const ang = (l / NL) * TWO;
            const line = [];
            for (let i = 0; i <= n; i++) line.push([...surfPt(i, ang), tI, i]);
            rawPaths.push({ pts: line, tI });
          }
        }
      }
      /* --- 5) fit to sheet --- */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const rp of rawPaths) for (const q of rp.pts) {
        if (q[0] < fx0) fx0 = q[0]; if (q[0] > fx1) fx1 = q[0];
        if (q[1] < fy0) fy0 = q[1]; if (q[1] > fy1) fy1 = q[1];
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      /* occlusion buffer in sheet coords, bucketed */
      const occ = [];
      centers.forEach((cs, tI) => cs.forEach((c, i) => occ.push({
        x: c.X * sc + ox, y: c.Y * sc + oy, z: c.Z, r: c.rp * sc, tI, i
      })));
      const bs = Math.max(4, R0 * sc * 1.5);
      const grid = new Map();
      occ.forEach((o, k) => {
        const key = Math.floor(o.x / bs) + "," + Math.floor(o.y / bs);
        let a = grid.get(key);
        if (!a) { a = []; grid.set(key, a); }
        a.push(k);
      });
      const isHidden = (x, y, z, tI, ci) => {
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const a = grid.get((bx + dx) + "," + (by + dy));
            if (!a) continue;
            for (const k of a) {
              const o = occ[k];
              if (o.tI === tI && Math.abs(o.i - ci) < 14) continue; /* not our own neighbourhood */
              if (o.z < z - o.r * 0.4 && Math.hypot(x - o.x, y - o.y) < o.r * 0.96) return true;
            }
          }
        }
        return false;
      };
      /* back side of the own tube: sample z behind own center z */
      const centerZ = (tI, i) => centers[tI][Math.min(centers[tI].length - 1, i)].Z;
      const paths = [];
      const L = Math.round(p.layer);
      for (const rp of rawPaths) {
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        for (const q of rp.pts) {
          const x = q[0] * sc + ox, y = q[1] * sc + oy, z = q[2];
          const tI = q[3], ci = q[4];
          let vis = true;
          if (p.hidden) {
            if (z > centerZ(tI, ci) + 0.6) vis = false; /* own back side */
            else if (isHidden(x, y, z, tI, ci)) vis = false;
          }
          if (vis) run.push([Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]);
          else flush();
        }
        flush();
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## turtle.js

```js
import { Pin, applyStyle } from "../helpers.js";

const PRESETS = {
  "Hex flower": "12[6[F14 R60] R30]",
  "Pentagram": "5[F40 R144]",
  "Spun squares": "18[4[F30 R90] R20]",
  "Rose window": "36[F30 R170]",
  "Radial burst": "36[F30 B30 R10]",
  "Turning square": "100[F40 R91]",
  "Branch tree": "F30 [L30 F20 [L25 F12] [R25 F12]] [R30 F20 [L25 F12] [R25 F12]] F10",
  "Zigzag ribbon": "24[F12 R60 F12 L60]",
};

export default {
  key: "turtle",
  name: "Turtle",
  cat: "gen",
  group: "geometric",
  desc: "Classic turtle graphics from a command string: F/B move drawing, M moves pen-up, R/L turn in degrees, U/D pen up/down, [ ] branch (push/pop), and N[...] repeats a block N times. Preset picks a ready-made program (Hex flower 12[6[F14 R60] R30], Pentagram 5[F40 R144], Spun squares 18[4[F30 R90] R20], Rose window 36[F30 R170], Radial burst 36[F30 B30 R10], Turning square 100[F40 R91], Branch tree, Zigzag ribbon 24[F12 R60 F12 L60]); Custom uses the Program field. Auto-fits to the sheet. Deterministic - no seed needed.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "preset", label: "Preset", type: "select", options: ["Custom (edit Program)", "Hex flower", "Pentagram", "Spun squares", "Rose window", "Radial burst", "Turning square", "Branch tree", "Zigzag ribbon"], def: "Custom (edit Program)" },
    { key: "prog", label: "Program (Custom)", type: "text", def: "12[6[F14 R60] R30]" },
    { key: "startAng", label: "Start angle deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "fit", label: "Fit to sheet", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    /* parse into an op tree: {op, val} or {rep, body} or {branch, body} */
    const src = String(PRESETS[p.preset] || p.prog || "");
    let pos = 0;
    const parseBlock = (depth) => {
      const ops = [];
      while (pos < src.length) {
        const ch = src[pos];
        if (ch === "]") { pos++; return ops; }
        if (/\s|,/.test(ch)) { pos++; continue; }
        if (ch === "[") { pos++; ops.push({ branch: parseBlock(depth + 1) }); continue; }
        if (/[0-9]/.test(ch)) {
          let num = "";
          while (pos < src.length && /[0-9.]/.test(src[pos])) num += src[pos++];
          while (pos < src.length && /\s/.test(src[pos])) pos++;
          if (src[pos] === "[") { pos++; ops.push({ rep: Math.min(200, Math.max(0, Math.round(+num))), body: parseBlock(depth + 1) }); }
          continue; /* bare numbers are ignored */
        }
        const op = ch.toUpperCase();
        pos++;
        if ("FBMRL".includes(op)) {
          let num = "";
          while (pos < src.length && /\s/.test(src[pos])) pos++;
          while (pos < src.length && /[0-9.\-]/.test(src[pos])) num += src[pos++];
          ops.push({ op, val: num === "" ? (op === "R" || op === "L" ? 90 : 10) : +num });
        } else if (op === "U" || op === "D") {
          ops.push({ op });
        } /* unknown chars ignored */
        if (depth > 24) return ops;
      }
      return ops;
    };
    const tree = parseBlock(0);
    /* execute */
    const paths = [];
    let cur = null;
    const st = { x: 0, y: 0, ang: (p.startAng - 90) * Math.PI / 180, pen: true };
    const stack = [];
    let steps = 0;
    const endPath = () => { if (cur && cur.length > 1) paths.push({ pts: cur, closed: false, layer: L }); cur = null; };
    const moveTo = (nx, ny, draw) => {
      if (draw && st.pen) {
        if (!cur) cur = [[st.x, st.y]];
        cur.push([nx, ny]);
      } else endPath();
      st.x = nx; st.y = ny;
    };
    const run = (ops) => {
      for (const o of ops) {
        if (steps++ > 40000) return;
        if (o.rep !== undefined) { for (let i = 0; i < o.rep; i++) { run(o.body); if (steps > 40000) return; } }
        else if (o.branch) {
          stack.push({ ...st });
          endPath();
          run(o.branch);
          endPath();
          const back = stack.pop();
          st.x = back.x; st.y = back.y; st.ang = back.ang; st.pen = back.pen;
        }
        else if (o.op === "F") moveTo(st.x + Math.cos(st.ang) * o.val, st.y + Math.sin(st.ang) * o.val, true);
        else if (o.op === "B") moveTo(st.x - Math.cos(st.ang) * o.val, st.y - Math.sin(st.ang) * o.val, true);
        else if (o.op === "M") moveTo(st.x + Math.cos(st.ang) * o.val, st.y + Math.sin(st.ang) * o.val, false);
        else if (o.op === "R") st.ang += (o.val * Math.PI) / 180;
        else if (o.op === "L") st.ang -= (o.val * Math.PI) / 180;
        else if (o.op === "U") { st.pen = false; endPath(); }
        else if (o.op === "D") st.pen = true;
      }
    };
    run(tree);
    endPath();
    if (!paths.length) return applyStyle({ paths: [] }, ins[0]);
    /* place: fit to margin box or center as-is */
    const m = Math.max(0, p.margin);
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const pa of paths) for (const [x, y] of pa.pts) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    const bw = W - 2 * m, bh = H - 2 * m;
    const sc = p.fit ? Math.min(bw / ((bx1 - bx0) || 1), bh / ((by1 - by0) || 1)) : 1;
    const ox = m + (bw - (bx1 - bx0) * sc) / 2 - bx0 * sc;
    const oy = m + (bh - (by1 - by0) * sc) / 2 - by0 * sc;
    const out = paths.map((pa) => ({
      ...pa,
      pts: pa.pts.map(([x, y]) => [
        Math.max(0.5, Math.min(W - 0.5, x * sc + ox)),
        Math.max(0.5, Math.min(H - 0.5, y * sc + oy))
      ])
    }));
    return applyStyle({ paths: out }, ins[0]);
  }
};
```

## tvnoise.js

```js
import { Pin, EMPTY, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "tvnoise",
      name: "Noise",
    cat: "gen", group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Pixel shape", type: "select", options: ["Square", "Circle", "Dash (scanline)"], def: "Square" },
      { key: "cell", label: "Cell size mm", type: "slider", min: 0.8, max: 15, step: 0.1, def: 3 },
      { key: "density", label: "Density", type: "slider", min: 0.02, max: 1, step: 0.02, def: 0.3 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "posJit", label: "Position jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "bands", label: "Interference bands", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 107 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const cell = Math.max(0.5, p.cell);
      const cols = Math.min(400, Math.floor((W - 2 * m) / cell));
      const rows = Math.min(400, Math.floor((H - 2 * m) / cell));
      if (cols < 1 || rows < 1) return EMPTY;
      const paths = [];
      let budget = 9000; /* max pikselia */
      for (let r = 0; r < rows && budget > 0; r++) {
        /* hairintajuovat: tiheys aaltoilee riveittain kuin huono signaali */
        const band = p.bands > 0
          ? 1 - p.bands * (0.5 + 0.5 * Math.sin(r * 0.7 + noise2(0.3, r * 0.13, p.seed + 7) * 6))
          : 1;
        for (let c = 0; c < cols && budget > 0; c++) {
          const h = hash2(c, r, p.seed);
          if (h > p.density * band) continue;
          budget--;
          const rng = mulberry32((r * 7919 + c) * 31 + p.seed);
          const sz = (cell / 2) * 0.85 * (1 - p.sizeVar * rng());
          const x = m + (c + 0.5) * cell + (rng() - 0.5) * cell * p.posJit;
          const y = m + (r + 0.5) * cell + (rng() - 0.5) * cell * p.posJit;
          if (p.shape === "Square") {
            paths.push({ pts: [[x - sz, y - sz], [x + sz, y - sz], [x + sz, y + sz], [x - sz, y + sz]], closed: true, layer: L });
          } else if (p.shape === "Circle") {
            const pts = [];
            const n = sz < 1 ? 6 : 10;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              pts.push([x + Math.cos(a) * sz, y + Math.sin(a) * sz]);
            }
            paths.push({ pts, closed: true, layer: L });
          } else {
            /* scanline: vaakaviiru, pituus vaihtelee */
            const len = sz * (1.5 + rng() * 3);
            paths.push({ pts: [[x - len, y], [x + len, y]], closed: false, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## tyylita.js

```js
import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "tyylita",
    name: "Apply Style", cat: "mod", group: "fillstyle", ins: [Pin("paths"), Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [],
    compute(ins) { return applyStyle(ins[0] || EMPTY, ins[1]); },
  
};
```

## view3d.js

```js
import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "view3d",
    name: "3D View",
    cat: "mod",
    group: "deform",
    desc: "Puts the drawing into 3D space and views it from any angle: yaw/pitch/roll with adjustable perspective (0 = isometric, 1 = dramatic). Z source: Flat tilts the sheet like paper; Pens stacked gives each pen layer its own depth (parallax when rotated); Noise relief bends the drawing over a heightfield. Wire Frame into Yaw for a spinning-drawing animation.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "yaw", label: "Yaw deg (wire Frame x360)", type: "slider", min: 0, max: 360, step: 1, def: 30 },
      { key: "pitch", label: "Pitch deg", type: "slider", min: -90, max: 90, step: 1, def: 30 },
      { key: "roll", label: "Roll deg", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.02, def: 0.5 },
      { key: "zsource", label: "Z source", type: "select", options: ["Flat", "Pens stacked", "Noise relief"], def: "Flat" },
      { key: "gap", label: "Pen layer gap mm", type: "slider", min: 1, max: 40, step: 0.5, def: 10 },
      { key: "relief", label: "Relief height mm", type: "slider", min: 0, max: 60, step: 1, def: 25 },
      { key: "rscale", label: "Relief scale", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.5 },
      { key: "fit", label: "Fit to sheet", type: "check", def: true },
      { key: "res", label: "Relief sample mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.2 },
      { key: "seed", label: "Seed (relief)", type: "seed", def: 3 },
      { key: "margin", label: "Fit margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const D2R = Math.PI / 180;
      const ya = p.yaw * D2R, pi2 = p.pitch * D2R, ro = p.roll * D2R;
      const cyaw = Math.cos(ya), syaw = Math.sin(ya);
      const cpit = Math.cos(pi2), spit = Math.sin(pi2);
      const crol = Math.cos(ro), srol = Math.sin(ro);
      /* perspective: exponential focal curve — 0 is genuinely isometric
         (focal ~60x canvas), 0.5 pleasant, 1 dramatic */
      const span = Math.max(W, H);
      const FOC = span * 0.7 * Math.pow(85, 1 - Math.max(0, Math.min(1, p.persp)));
      const zOf = (x, y, layer) => {
        if (p.zsource === "Pens stacked") return -(layer || 0) * Math.max(0, p.gap);
        if (p.zsource === "Noise relief") {
          return (noise2(x * 0.012 * p.rscale + 5.7, y * 0.012 * p.rscale + 2.3, p.seed) - 0.5) * 2 * Math.max(0, p.relief);
        }
        return 0;
      };
      const proj = (x, y, layer) => {
        let X = x - cx, Y = y - cy, Z = zOf(x, y, layer);
        /* roll (Z axis) */
        let X1 = X * crol - Y * srol, Y1 = X * srol + Y * crol;
        /* yaw (Y axis) */
        let X2 = X1 * cyaw + Z * syaw;
        let Z2 = -X1 * syaw + Z * cyaw;
        /* pitch (X axis) */
        const Y3 = Y1 * cpit - Z2 * spit;
        const Z3 = Y1 * spit + Z2 * cpit;
        const s = FOC / Math.max(FOC * 0.1, FOC + Z3);
        return [X2 * s, Y3 * s];
      };
      /* straight lines stay straight under perspective, so resampling is only
         needed when the relief bends the plane itself */
      const needResample = p.zsource === "Noise relief";
      const projected = src.paths.map((path) => ({
        layer: path.layer, closed: path.closed,
        pts: (needResample ? resample(path.pts, path.closed, Math.max(0.4, p.res)) : path.pts)
          .map(([x, y]) => proj(x, y, path.layer))
      }));
      /* fit or clamp */
      const m = Math.max(0, p.margin);
      let paths;
      if (p.fit) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const pa of projected) for (const [x, y] of pa.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const bw = W - 2 * m, bh = H - 2 * m;
        const sc = Math.min(bw / ((x1 - x0) || 1), bh / ((y1 - y0) || 1));
        const ox = m + (bw - (x1 - x0) * sc) / 2 - x0 * sc;
        const oy = m + (bh - (y1 - y0) * sc) / 2 - y0 * sc;
        paths = projected.map((pa) => ({
          ...pa, pts: pa.pts.map(([x, y]) => [x * sc + ox, y * sc + oy])
        }));
      } else {
        paths = projected.map((pa) => ({
          ...pa,
          pts: pa.pts.map(([x, y]) => [
            Math.max(0.5, Math.min(W - 0.5, x + cx)),
            Math.max(0.5, Math.min(H - 0.5, y + cy))
          ])
        }));
      }
      return { paths };
    }
  
};
```

## viiva.js

```js
import { Pin } from "../helpers.js";

export default {
  key: "viiva",
    name: "Stroke", cat: "gen", group: "textimg", ins: [], outs: [Pin("style")],
    params: [
      { key: "mode", label: "Type", type: "select", options: ["Solid", "Dashed", "Dots", "Dash-dot"], def: "Dashed" },
      { key: "dash", label: "Dash mm", type: "slider", min: 0.5, max: 30, step: 0.25, def: 4 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0.3, max: 30, step: 0.25, def: 3 },
      { key: "vary", label: "Variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "phase", label: "Phase mm", type: "slider", min: 0, max: 30, step: 0.5, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 4 },
    ],
    compute(_ins, p) {
      return { kind: "style", mode: p.mode, dash: p.dash, gap: p.gap, vary: p.vary, phase: p.phase, seed: p.seed };
    },
  
};
```

## voronoi.js

```js
import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "voronoi",
    name: "Voronoi",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cells", label: "Cells", type: "slider", min: 3, max: 300, step: 1, def: 40 },
      { key: "relax", label: "Relax (Lloyd)", type: "slider", min: 0, max: 3, step: 1, def: 1 },
      { key: "sites", label: "Draw sites", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 13 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const N = Math.max(2, Math.min(400, Math.round(p.cells)));
      const rng = mulberry32(p.seed * 6151 + 17);
      let sites = [];
      for (let i = 0; i < N; i++) {
        sites.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
      }
      /* cell of site i = margin rect clipped by bisector half-planes vs all others */
      const cellOf = (i) => {
        let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        const [sx, sy] = sites[i];
        for (let j = 0; j < sites.length && poly.length >= 3; j++) {
          if (j === i) continue;
          const [ox, oy] = sites[j];
          /* keep side of the bisector closer to site i */
          const nx = ox - sx, ny = oy - sy;
          const d = (nx * (sx + ox) + ny * (sy + oy)) / 2;
          const out = [];
          for (let k = 0; k < poly.length; k++) {
            const A = poly[k], B = poly[(k + 1) % poly.length];
            const da = nx * A[0] + ny * A[1] - d;
            const db = nx * B[0] + ny * B[1] - d;
            if (da <= 0) out.push(A);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
              const t = da / (da - db);
              out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
            }
          }
          poly = out;
        }
        return poly;
      };
      const relaxN = Math.max(0, Math.min(3, Math.round(p.relax)));
      for (let r = 0; r < relaxN; r++) {
        sites = sites.map((_, i) => {
          const poly = cellOf(i);
          if (poly.length < 3) return sites[i];
          let cx = 0, cy = 0;
          for (const [x, y] of poly) { cx += x; cy += y; }
          return [cx / poly.length, cy / poly.length];
        });
      }
      /* emit shared edges once (each edge belongs to two cells) */
      const L = Math.round(p.layer);
      const paths = [];
      const seen = new Set();
      const q = (v) => Math.round(v * 20) / 20;
      for (let i = 0; i < sites.length; i++) {
        const poly = cellOf(i);
        for (let k = 0; k < poly.length; k++) {
          const A = poly[k], B = poly[(k + 1) % poly.length];
          if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 0.05) continue;
          const ka = q(A[0]) + "," + q(A[1]), kb = q(B[0]) + "," + q(B[1]);
          const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
          if (seen.has(key)) continue;
          seen.add(key);
          paths.push({ pts: [[A[0], A[1]], [B[0], B[1]]], closed: false, layer: L });
        }
        if (p.sites) {
          const [sx, sy] = sites[i];
          paths.push({ pts: [[sx - 1, sy], [sx + 1, sy]], closed: false, layer: L });
          paths.push({ pts: [[sx, sy - 1], [sx, sy + 1]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## warp.js

```js
import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "warp",
    name: "Warp", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["4 corners", "Grid lattice"], def: "4 corners" },
      { key: "tlx", label: "TL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "tly", label: "TL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trx", label: "TR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trY", label: "TR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "brx", label: "BR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bry", label: "BR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "blx", label: "BL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bly", label: "BL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "cells", label: "Grid cells", type: "slider", min: 2, max: 12, step: 1, def: 4 },
      { key: "amp", label: "Grid amp mm", type: "slider", min: 0, max: 60, step: 0.5, def: 15 },
      { key: "seed", label: "Grid seed", type: "seed", def: 21 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      let disp;
      if (p.mode === "4 corners") {
        disp = (x, y) => {
          const u = Math.max(0, Math.min(1, x / W)), v = Math.max(0, Math.min(1, y / H));
          const topX = p.tlx + (p.trx - p.tlx) * u, botX = p.blx + (p.brx - p.blx) * u;
          const topY = p.tly + (p.trY - p.tly) * u, botY = p.bly + (p.bry - p.bly) * u;
          return [topX + (botX - topX) * v, topY + (botY - topY) * v];
        };
      } else {
        const n = Math.round(p.cells);
        const rng = mulberry32(p.seed * 359 + 41);
        const lat = [];
        for (let j = 0; j <= n; j++) {
          const row = [];
          for (let i = 0; i <= n; i++) {
            /* reunat paikoillaan, sisäpisteet satunnaisesti */
            const edge = i === 0 || j === 0 || i === n || j === n;
            row.push(edge ? [0, 0] : [(rng() - 0.5) * 2 * p.amp, (rng() - 0.5) * 2 * p.amp]);
          }
          lat.push(row);
        }
        const sm = (t) => t * t * (3 - 2 * t);
        disp = (x, y) => {
          const fx = Math.max(0, Math.min(n - 0.0001, (x / W) * n));
          const fy = Math.max(0, Math.min(n - 0.0001, (y / H) * n));
          const i = Math.floor(fx), j = Math.floor(fy);
          const tx = sm(fx - i), ty = sm(fy - j);
          const a = lat[j][i], b = lat[j][i + 1], c = lat[j + 1][i], d = lat[j + 1][i + 1];
          return [
            (a[0] + (b[0] - a[0]) * tx) * (1 - ty) + (c[0] + (d[0] - c[0]) * tx) * ty,
            (a[1] + (b[1] - a[1]) * tx) * (1 - ty) + (c[1] + (d[1] - c[1]) * tx) * ty,
          ];
        };
      }
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 1.2).map(([x, y]) => {
          const [dx, dy] = disp(x, y);
          return [x + dx, y + dy];
        }),
      }));
      return { paths };
    },
  
};
```

## water.js

```js
import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "water",
      name: "Water",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 0, max: 400, step: 1, def: 85 },
      { key: "lines", label: "Ripple lines", type: "slider", min: 5, max: 150, step: 1, def: 55 },
      { key: "amp", label: "Wave amp mm", type: "slider", min: 0.2, max: 12, step: 0.1, def: 1.6 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 3, max: 80, step: 0.5, def: 16 },
      { key: "swell", label: "Swell mm", type: "slider", min: 0, max: 20, step: 0.25, def: 2.5 },
      { key: "chop", label: "Choppiness (gaps)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 89 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const y0 = p.horizon, y1 = H - m;
      if (y1 - y0 < 5) return EMPTY;
      const paths = [];
      const n = Math.round(p.lines);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;                       /* 0 = horisontissa, 1 = edessa */
        /* perspektiivi: rivit pakkautuvat horisonttiin, aallot pienenevat kauas */
        const g = 1 + p.persp * 1.6;
        const y = y0 + Math.pow(t, g) * (y1 - y0);
        const sc = 0.22 + 0.78 * Math.pow(t, 0.8 + p.persp);
        const amp = p.amp * sc;
        const wl = Math.max(1.5, p.wl * sc);
        const ph = mulberry32(p.seed * 613 + i * 97)() * Math.PI * 2;
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer: L });
          run = [];
        };
        const step = 0.9;
        for (let x = m; x <= W - m; x += step) {
          /* aalto: paa-aalto + hitaampi maininki + kohinarikkonaisuus */
          const wave = Math.sin((x / wl) * Math.PI * 2 + ph) * amp * 0.5
            + Math.sin((x / (wl * 3.7)) * Math.PI * 2 + ph * 1.7) * p.swell * sc * 0.5
            + (noise2(x * 0.15, i * 3.1, p.seed) - 0.5) * amp * 0.8;
          /* katkonta: kimallus rikkoo viivan; tuulenvireet kohinakentasta */
          const gate = noise2(x * (0.05 + 0.1 / sc), i * 1.9, p.seed + 31);
          if (gate > p.chop * 0.85) run.push([x, y + wave]);
          else flush();
        }
        flush();
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## wood.js

```js
import { Pin, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "wood",
      name: "Wood Rings",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Cut", type: "select", options: ["Rings (cross-cut)", "Grain (split face)"], def: "Rings (cross-cut)" },
      { key: "rings", label: "Rings (years)", type: "slider", min: 4, max: 90, step: 1, def: 30 },
      { key: "spacing", label: "Ring spacing mm", type: "slider", min: 0.5, max: 10, step: 0.1, def: 2.6 },
      { key: "yearVar", label: "Growth variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.14 },
      { key: "ecc", label: "Eccentricity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "eccAng", label: "Eccentricity angle °", type: "slider", min: -180, max: 180, step: 1, def: 40 },
      { key: "cracks", label: "Cracks", type: "slider", min: 0, max: 8, step: 1, def: 3 },
      { key: "bark", label: "Bark", type: "check", def: true },
      { key: "flame", label: "Flame (grain mode)", type: "slider", min: 0.2, max: 3, step: 0.05, def: 1 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "seed", label: "Seed", type: "seed", def: 131 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const rng = mulberry32(p.seed * 4271 + 83);
      const nR = Math.round(p.rings);
      const paths = [];
      /* kasvuvuodet: leveys vaihtelee (kuivat vuodet kapeita, hyvat leveita),
         hitaalla kohinalla jotta vuodet ryhmittyvat jaksoiksi */
      const widths = [];
      let radius = 0;
      for (let i = 0; i < nR; i++) {
        const w = p.spacing * (1 - p.yearVar * 0.85 * noise2(i * 0.35, 3.7, p.seed + 11));
        widths.push(Math.max(p.spacing * 0.12, w));
        radius += widths[i];
      }
      if (p.mode === "Rings (cross-cut)") {
        /* jaettu kulmakohina: renkaat samanmuotoisia -> eivat leikkaa toisiaan */
        const angNoise = (th, i) => {
          const x = Math.cos(th) * 1.6, y = Math.sin(th) * 1.6;
          const shared = noise2(x + 40, y + 40, p.seed) - 0.5;
          const evolve = (noise2(x * 2.3 + i * 0.06, y * 2.3, p.seed + 7) - 0.5) * 0.3;
          return shared + evolve;
        };
        const eA = (p.eccAng * Math.PI) / 180;
        let r = 0;
        /* ydin */
        const pith = [];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          pith.push([p.cx + Math.cos(a) * 0.7, p.cy + Math.sin(a) * 0.7]);
        }
        paths.push({ pts: pith, closed: true, layer: L });
        const ringPt = (th, rr, i) => {
          /* epakeskisyys: rengas venyy yhteen suuntaan (reaktiopuu) */
          const stretch = 1 + p.ecc * 0.55 * Math.cos(th - eA);
          const rad = rr * stretch * (1 + p.wobble * 2 * angNoise(th, i));
          return [p.cx + Math.cos(th) * rad, p.cy + Math.sin(th) * rad];
        };
        for (let i = 0; i < nR; i++) {
          r += widths[i];
          const nS = Math.max(40, Math.min(160, Math.round(r * 2.2)));
          const pts = [];
          for (let k = 0; k < nS; k++) {
            pts.push(ringPt((k / nS) * Math.PI * 2, r, i));
          }
          paths.push({ pts, closed: true, layer: L });
        }
        /* kaarna: rosoinen kaksoiskeha uloimman ulkopuolella */
        if (p.bark) {
          for (const extra of [0.35, 0.75]) {
            const rr = r + p.spacing * extra + 0.6;
            const nS = Math.max(60, Math.round(rr * 2.5));
            const pts = [];
            for (let k = 0; k < nS; k++) {
              const th = (k / nS) * Math.PI * 2;
              const rough = (hash2(k, Math.round(extra * 10), p.seed + 23) - 0.5) * p.spacing * 0.8;
              const [x, y] = ringPt(th, rr, nR);
              const d = Math.hypot(x - p.cx, y - p.cy) || 1;
              pts.push([x + ((x - p.cx) / d) * rough, y + ((y - p.cy) / d) * rough]);
            }
            paths.push({ pts, closed: true, layer: L });
          }
        }
        /* halkeamat: sateittaiset kapenevat kiilat sahalaidalla */
        const nC = Math.round(p.cracks);
        for (let c = 0; c < nC; c++) {
          const th = rng() * Math.PI * 2;
          const rIn = r * (0.15 + rng() * 0.25);
          const rOut = r * (0.85 + rng() * 0.14);
          const wid = 0.02 + rng() * 0.035; /* kiilan kulmapuolikas juuressa */
          for (const s of [1, -1]) {
            const pts = [];
            const nS = 14;
            for (let k = 0; k <= nS; k++) {
              const t = k / nS;
              const rr = rIn + (rOut - rIn) * t;
              const jag = (hash2(k, c * 7 + (s > 0 ? 0 : 50), p.seed + 31) - 0.5) * 0.04;
              const a = th + s * wid * (1 - t) + jag;
              pts.push(ringPt(a, rr, 0));
            }
            paths.push({ pts, closed: false, layer: L });
          }
        }
      } else {
        /* GRAIN: halkaistu pinta — sisakkaiset liekkikaaret.
           Rengas i leikkaa pinnan paraabelina: pieni i = tiukka katedraalikaari,
           iso i = loivenee lankun reunoja kohti. */
        const bw = Math.min(W - 20, radius * 3.2);
        const x0 = p.cx - bw / 2, x1 = p.cx + bw / 2;
        const apexY = p.cy - radius * 0.9;
        let a = 0;
        for (let i = 0; i < nR; i++) {
          a += widths[i];
          const focal = p.flame * (a * 0.9 + 6);
          const pts = [];
          const step = 1.4;
          for (let x = x0; x <= x1 + 0.01; x += step) {
            const u = x - p.cx;
            let y = apexY + a + (u * u) / (4 * focal);
            /* syykuvion elava varina, hitaasti kaarta pitkin */
            y += (noise2(x * 0.03, i * 0.4, p.seed + 3) - 0.5) * p.wobble * 26;
            /* pysty-epakeskisyys: kaaret kallistuvat */
            y += p.ecc * u * 0.12 * Math.sin(i * 0.3);
            if (y > apexY - 2 && y < H - 4 && y > 4) pts.push([x, y]);
            else if (pts.length > 1) {
              paths.push({ pts: pts.slice(), closed: false, layer: L });
              pts.length = 0;
            } else pts.length = 0;
          }
          if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
        }
        /* halkeamat grain-pinnalla: pitkia kapeita pystyviiruja */
        const nC = Math.round(p.cracks);
        for (let c = 0; c < nC; c++) {
          const x = x0 + rng() * bw;
          const y0c = apexY + radius * (0.3 + rng() * 0.8);
          const len = 8 + rng() * 30;
          const pts = [];
          for (let k = 0; k <= 10; k++) {
            const t = k / 10;
            pts.push([x + (hash2(k, c * 11, p.seed + 41) - 0.5) * 1.6, y0c + len * t]);
          }
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## worm.js

```js
import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "worm",
      name: "Worm",
    cat: "gen", group: "creatures",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Worms", type: "slider", min: 1, max: 12, step: 1, def: 2 },
      { key: "length", label: "Length mm", type: "slider", min: 30, max: 500, step: 5, def: 170 },
      { key: "width", label: "Body width mm", type: "slider", min: 2, max: 30, step: 0.5, def: 9 },
      { key: "segs", label: "Segment rings", type: "slider", min: 6, max: 120, step: 1, def: 40 },
      { key: "wander", label: "Wander", type: "slider", min: 0.05, max: 1.5, step: 0.05, def: 0.5 },
      { key: "legs", label: "Legs", type: "select", options: ["None (worm)", "Centipede"], def: "Centipede" },
      { key: "legLen", label: "Leg length mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "legEvery", label: "Legs every Nth ring", type: "slider", min: 1, max: 6, step: 1, def: 1 },
      { key: "antennae", label: "Antennae", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 137 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin + p.width;
      const paths = [];
      for (let c = 0; c < Math.round(p.count); c++) {
        const rng = mulberry32(p.seed * 4967 + c * 373 + 91);
        /* selkaranka: inertiavaellus pehmealla reunaohjauksella */
        let x = m + rng() * (W - 2 * m);
        let y = m + rng() * (H - 2 * m);
        let heading = rng() * Math.PI * 2;
        const spine = [[x, y]];
        const step = 1.2;
        const nSteps = Math.round(p.length / step);
        for (let i = 0; i < nSteps; i++) {
          heading += (noise2(i * 0.03, c * 17.3, p.seed) - 0.5) * 2 * p.wander * 0.3;
          const dEdge = Math.min(x - m, W - m - x, y - m, H - m - y);
          if (dEdge < 25) {
            const toC = Math.atan2(H / 2 - y, W / 2 - x);
            let dA = toC - heading;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            heading += dA * (1 - dEdge / 25) * 0.2;
          }
          x += Math.cos(heading) * step;
          y += Math.sin(heading) * step;
          spine.push([x, y]);
        }
        /* runko: renkaat selkarankaa pitkin, paksuusprofiili kapenee paihin
           -> putkimainen 3D-vaikutelma pelkilla vanteilla */
        const nSeg = Math.round(p.segs);
        const N = spine.length;
        const frameAt = (t) => {
          const idx = Math.min(N - 2, Math.max(0, Math.floor(t * (N - 1))));
          const f = t * (N - 1) - idx;
          const a = spine[idx], b = spine[idx + 1];
          const px = a[0] + (b[0] - a[0]) * f, py = a[1] + (b[1] - a[1]) * f;
          const tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1;
          return [px, py, tx / tl, ty / tl];
        };
        const prof = (t) => {
          /* paa pyorea, hanta suippo */
          const head = Math.min(1, t * 6);
          const tail = Math.min(1, (1 - t) * 3);
          return (p.width / 2) * Math.sqrt(head) * Math.pow(tail, 0.8);
        };
        for (let s = 0; s < nSeg; s++) {
          const t = s / Math.max(1, nSeg - 1);
          const [px, py, tx, ty] = frameAt(t);
          const r = prof(t);
          if (r < 0.3) continue;
          /* rengas = litistetty ellipsi rungon poikki (nakyy vanteena) */
          const pts = [];
          const nP = 18;
          for (let k = 0; k < nP; k++) {
            const a = (k / nP) * Math.PI * 2;
            const u = Math.cos(a) * r;          /* poikittain */
            const v = Math.sin(a) * r * 0.34;   /* pitkin runkoa (litistys) */
            pts.push([px + (-ty) * u + tx * v, py + tx * u + ty * v]);
          }
          paths.push({ pts, closed: true, layer: L });
          /* jalat: parit molemmin puolin, askelrytmi vuorottelee */
          if (p.legs === "Centipede" && s % Math.round(p.legEvery) === 0 && t > 0.06 && t < 0.94) {
            const gait = (s % 2 === 0 ? 1 : -1) * 0.5;
            for (const side of [1, -1]) {
              const bx = px + (-ty) * r * side, by = py + tx * r * side;
              const baseA = Math.atan2(tx * side, -ty * side); /* ulospain */
              const a1 = baseA + gait * 0.55 * side;
              const midx = bx + Math.cos(a1) * p.legLen * 0.55;
              const midy = by + Math.sin(a1) * p.legLen * 0.55;
              const a2 = a1 + 0.5 * side;
              paths.push({
                pts: [
                  [bx, by],
                  [midx, midy],
                  [midx + Math.cos(a2) * p.legLen * 0.5, midy + Math.sin(a2) * p.legLen * 0.5],
                ],
                closed: false, layer: L,
              });
            }
          }
        }
        /* tuntosarvet paahan */
        if (p.antennae) {
          const [px, py, tx, ty] = frameAt(1);
          for (const side of [1, -1]) {
            const a = Math.atan2(ty, tx) + side * 0.5;
            const len = p.width * 0.9;
            const mx = px + Math.cos(a) * len * 0.6, my = py + Math.sin(a) * len * 0.6;
            paths.push({
              pts: [[px, py], [mx, my], [mx + Math.cos(a + side * 0.5) * len * 0.5, my + Math.sin(a + side * 0.5) * len * 0.5]],
              closed: false, layer: L,
            });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
```

## zigzag.js

```js
import { Pin, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "zigzag",
  name: "Zigzag",
  cat: "gen",
  group: "geometric",
  desc: "Rows of zigzag, sine or square waves. Skew tilts the zigzag toward a sawtooth; Envelope modulates amplitude with a seeded noise envelope (bursts and quiet passages, tape-saturation style); Row phase offsets successive rows for interference patterns. Wire any path into Spine and the waves follow it as parallel offset rows instead of straight lines.",
  ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "wave", label: "Wave", type: "select", options: ["Zigzag", "Sine", "Square"], def: "Zigzag" },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 40, step: 1, def: 8 },
    { key: "amp", label: "Amplitude mm", type: "slider", min: 0.5, max: 40, step: 0.5, def: 6 },
    { key: "period", label: "Period mm", type: "slider", min: 2, max: 60, step: 0.5, def: 12 },
    { key: "skew", label: "Skew (zigzag/square)", type: "slider", min: 0.05, max: 0.95, step: 0.05, def: 0.5 },
    { key: "phase", label: "Row phase", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "envelope", label: "Envelope", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "envScale", label: "Envelope size mm", type: "slider", min: 10, max: 200, step: 5, def: 60 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed (envelope)", type: "seed", def: 5 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const L = Math.round(p.layer);
    const amp = Math.max(0.1, p.amp);
    const T = Math.max(1, p.period);
    const rows = Math.max(1, Math.round(p.rows));
    const sk = Math.min(0.95, Math.max(0.05, p.skew));
    const paths = [];
    const wave = (u) => {
      if (p.wave === "Sine") return Math.sin(u * Math.PI * 2);
      if (p.wave === "Square") return u < sk ? -1 : 1;
      return u < sk ? -1 + (2 * u) / sk : 1 - (2 * (u - sk)) / (1 - sk);
    };
    const envAt = (d, row) => {
      if (p.envelope <= 0.001) return 1;
      const e = noise2(d / Math.max(5, p.envScale), row * 7.3 + 0.5, p.seed);
      let s2 = Math.min(1, Math.max(0, (e - 0.2) / 0.6));
      s2 = s2 * s2 * (3 - 2 * s2);
      return (1 - p.envelope) + p.envelope * s2;
    };
    /* sample distances: dense grid + exact cycle breakpoints (crisp peaks / jumps) */
    const sampleDs = (len, row) => {
      const ph = (((row * p.phase) % 1) + 1) % 1;
      const ds = Math.max(0.25, Math.min(0.8, T / 8));
      const marks = [];
      for (let d = 0; d < len; d += ds) marks.push(d);
      marks.push(len);
      if (p.wave !== "Sine") {
        const k0 = Math.floor(ph - 1), k1 = Math.ceil(len / T + ph + 1);
        for (let k = k0; k <= k1; k++) {
          for (const uo of [0, sk]) {
            const d = (k + uo - ph) * T;
            if (d < 1e-9 || d > len - 1e-9) continue;
            if (p.wave === "Square") { marks.push(d - 1e-3); marks.push(d + 1e-3); }
            else marks.push(d);
          }
        }
      }
      marks.sort((a, b) => a - b);
      const uAt = (d) => { const u = d / T + ph; return u - Math.floor(u); };
      return marks.map((d) => [d, wave(uAt(d))]);
    };

    const spine = ins[0];
    if (spine && spine.paths && spine.paths.length) {
      for (const pa of spine.paths) {
        const base = resample(pa.pts, pa.closed, 0.7);
        if (base.length < 3) continue;
        const N = base.length;
        const dArr = [0];
        for (let i = 1; i < N; i++) dArr.push(dArr[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
        const normals = base.map((pt, i) => {
          const nI = pa.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
          const pI = pa.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
          const tx = base[nI][0] - base[pI][0], ty = base[nI][1] - base[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [-ty / tl, tx / tl];
        });
        for (let r = 0; r < rows; r++) {
          const ph = (((r * p.phase) % 1) + 1) % 1;
          const off0 = (r - (rows - 1) / 2) * amp * 2.4;
          const pts = base.map((pt, i) => {
            const u0 = dArr[i] / T + ph;
            const w = wave(u0 - Math.floor(u0));
            const off = off0 + w * amp * envAt(dArr[i], r);
            return [pt[0] + normals[i][0] * off, pt[1] + normals[i][1] * off];
          });
          paths.push({ pts, closed: pa.closed, layer: L });
        }
      }
      return applyStyle({ paths }, ins[1]);
    }
    /* straight rows across the margin box */
    const x0 = m, x1 = W - m;
    const len = x1 - x0;
    if (len < 4 || H - 2 * m < 2 * amp + 2) return applyStyle({ paths }, ins[1]);
    const yLo = m + amp, yHi = H - m - amp;
    for (let r = 0; r < rows; r++) {
      const y = rows === 1 ? (yLo + yHi) / 2 : yLo + ((yHi - yLo) * r) / (rows - 1);
      const s = sampleDs(len, r);
      const pts = s.map(([d, w]) => [x0 + d, y + w * amp * envAt(d, r)]);
      paths.push({ pts, closed: false, layer: L });
    }
    return applyStyle({ paths }, ins[1]);
  },
};
```
