import { Pin, mulberry32, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "snowflake",
  name: "Snowflake",
  cat: "gen",
  group: "nature",
  desc: "Snow crystals with true six-fold symmetry: one arm is grown from the seed and copied round the centre, so every flake is perfectly symmetric like the real thing while no two flakes in a sheet match. Styles: Dendrite (a main arm with mirrored side branches and sub-branches), Fern (dense feathery branching), Stellar (few branches, hexagonal plates on every tip, a large core plate), Plate (a big sectored hexagonal plate with short dendrites from its corners) and Paper (a child's cut-paper flake: a jagged mirrored silhouette with cut-out holes, shaken by Wobble). Arms sets the symmetry (6 is snow; 3, 4, 5, 8 and 12 are for art), Branches, Depth, Branch angle and Falloff shape the growth, Tip caps every arm with a needle, a plate, a fan or an arrow, Core sets the centre plate and Width turns centre lines into outlined rods that taper to the tips. Layout Rows fills a grid; Scatter drops a seeded flurry of different sizes and spins.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Lines")],
  params: [
    { key: "style", label: "Style", type: "select", options: ["Dendrite", "Fern", "Stellar", "Plate", "Paper"], def: "Dendrite" },
    { key: "arms", label: "Arms", type: "select", options: ["6", "3", "4", "5", "8", "12"], def: "6" },
    { key: "branches", label: "Branches", type: "slider", min: 0, max: 12, step: 1, def: 5, showIf: (p) => p.style !== "Paper" },
    { key: "depth", label: "Depth", type: "slider", min: 1, max: 3, step: 1, def: 2, showIf: (p) => p.style !== "Paper" && p.style !== "Plate" },
    { key: "angle", label: "Branch angle °", type: "slider", min: 30, max: 90, step: 1, def: 60, showIf: (p) => p.style !== "Paper" },
    { key: "falloff", label: "Falloff", type: "slider", min: 0.2, max: 1, step: 0.05, def: 0.6, showIf: (p) => p.style !== "Paper" },
    { key: "core", label: "Core", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.14, showIf: (p) => p.style !== "Paper" },
    { key: "tip", label: "Tip", type: "select", options: ["Plate", "Needle", "Fan", "Arrow"], def: "Plate", showIf: (p) => p.style !== "Paper" && p.style !== "Plate" },
    { key: "width", label: "Width mm", type: "slider", min: 0, max: 3, step: 0.05, def: 0, showIf: (p) => p.style !== "Paper" },
    { key: "rime", label: "Rime", type: "check", def: false, showIf: (p) => p.style !== "Paper" },
    { key: "holes", label: "Holes", type: "slider", min: 0, max: 4, step: 1, def: 2, showIf: (p) => p.style === "Paper" },
    { key: "wobble", label: "Wobble %", type: "slider", min: 0, max: 100, step: 1, def: 50, showIf: (p) => p.style === "Paper" },
    { key: "layout", label: "Layout", type: "select", options: ["Rows", "Scatter"], def: "Rows" },
    { key: "count", label: "Count", type: "slider", min: 1, max: 60, step: 1, def: 3 },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 12, step: 1, def: 2, showIf: (p) => p.layout === "Rows" },
    { key: "size", label: "Size mm", type: "slider", min: 5, max: 250, step: 1, def: 70 },
    { key: "vary", label: "Size vary", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "spin", label: "Spin vary °", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "jitter", label: "Jitter %", type: "slider", min: 0, max: 100, step: 1, def: 15, showIf: (p) => p.layout === "Rows" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const seed = Math.round(Number(p.seed) || 0);
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const style = p.style;
    const ARMS = clamp(Math.round(Number(p.arms) || 6), 3, 12);
    const nBr = clamp(Math.round(Number(p.branches) || 0), 0, 12);
    const depth = clamp(Math.round(Number(p.depth) || 1), 1, 3);
    const angle = clamp(Number(p.angle) || 60, 10, 90) * Math.PI / 180;
    const falloff = clamp(Number(p.falloff) || 0.6, 0.05, 1);
    const core = clamp(Number(p.core) || 0, 0, 0.5);
    const widthMM = Math.max(0, Number(p.width) || 0);
    const wobble = clamp(Number(p.wobble) || 0, 0, 100) / 100;
    const margin = Math.max(0, Number(p.margin) || 0);
    const vary = clamp(Number(p.vary) || 0, 0, 1);
    const spin = clamp(Number(p.spin) || 0, 0, 180) * Math.PI / 180;
    const holes = clamp(Math.round(Number(p.holes) || 0), 0, 4);
    const BUDGET = 112000;

    /* ------------------------------------------------------------- helpers */
    const hexagon = (cx, cy, r, rot) => { const o = []; for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
    const rot2 = (q, a) => { const c = Math.cos(a), s = Math.sin(a); return [q[0] * c - q[1] * s, q[0] * s + q[1] * c]; };
    const wob = (pts, closed, amp, k, step) => {
      if (amp <= 0.001 || pts.length < 2) return pts;
      const dense = resample(pts, closed, step);
      if (closed && dense.length > 2) { const a = dense[0], b = dense[dense.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < step * 0.25) dense.pop(); }
      if (!closed) { const e = pts[pts.length - 1], d = dense[dense.length - 1]; if (Math.hypot(e[0] - d[0], e[1] - d[1]) > step * 0.2) dense.push([e[0], e[1]]); }
      if (dense.length < 2) return pts.map((q) => [q[0], q[1]]);
      const f = 0.35 / Math.max(0.5, amp * 12);
      return dense.map(([x, y]) => [x + (noise2(x * f + k * 3.1, y * f, seed + k) - 0.5) * 2 * amp, y + (noise2(x * f + 57.3, y * f + 19.7 + k * 2.3, seed + k + 101) - 0.5) * 2 * amp]);
    };
    /* outline a polyline as a tapering rod: width w0 at the start, w0*tipK at the end */
    const rod = (pts, w0, tipK) => {
      if (pts.length < 2) return null;
      const L = [], R = [];
      let total = 0; const cum = [0];
      for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(total); }
      if (total < 1e-9) return null;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl, ny = tx / tl;
        const w = (w0 * (1 - (1 - tipK) * (cum[i] / total))) / 2;
        L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
        R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
      }
      const e = pts[pts.length - 1], a = pts[pts.length - 2];
      const tx = e[0] - a[0], ty = e[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      const wEnd = (w0 * tipK) / 2;
      const tip = [e[0] + (tx / tl) * wEnd * 0.9, e[1] + (ty / tl) * wEnd * 0.9];   /* pointed cap */
      const s0 = pts[0], b0 = pts[1];
      const bx = s0[0] - b0[0], by = s0[1] - b0[1], bl = Math.hypot(bx, by) || 1;
      const base = [s0[0] + (bx / bl) * (w0 / 2) * 0.5, s0[1] + (by / bl) * (w0 / 2) * 0.5];
      return L.concat([tip], R.reverse(), [base]);
    };

    /* ---------------------------------------------------- one arm, unit radius */
    /* The arm runs along +x from the core edge to x = 1. Everything is generated for this one arm
       (branches in mirrored pairs), then the flake is assembled by rotating it ARMS times. */
    const growArm = (rng, st) => {
      const strokes = [], shapes = [], dots = [];
      const sideAng = angle;
      const coreR = st === "Stellar" ? Math.max(core, 0.22) : st === "Plate" ? 0 : core;
      const armStart = st === "Plate" ? 0.62 : coreR * 0.9;
      const sub = (x, y, dir, len, level, wk) => {
        if (len < 0.012 || level > depth) return;
        const ex = x + Math.cos(dir) * len, ey = y + Math.sin(dir) * len;
        strokes.push({ pts: [[x, y], [ex, ey]], w: level });
        if (level < depth) {
          const n = Math.max(1, Math.round((st === "Fern" ? 3 : 2) * (1 + rng() * 0.6)));
          for (let i = 0; i < n; i++) {
            const s = 0.3 + 0.6 * (i + rng() * 0.6) / n;
            const bl = len * (0.42 - 0.22 * s) * (0.8 + rng() * 0.5) * falloff;
            for (const sg of [-1, 1]) sub(x + Math.cos(dir) * len * s, y + Math.sin(dir) * len * s, dir + sg * sideAng, bl, level + 1, wk + 7);
          }
        }
        if (st === "Stellar" && level === 1) shapes.push(hexagon(ex, ey, len * 0.16, dir));
      };
      /* main arm */
      strokes.push({ pts: [[armStart, 0], [1, 0]], w: 0 });
      /* side branches: positions spread along the arm, longer near the middle, shorter toward the tip */
      const count = st === "Fern" ? Math.round(nBr * 1.6 + 2) : st === "Stellar" ? Math.min(nBr, 3) : st === "Plate" ? Math.min(nBr, 2) : nBr;
      const lo = st === "Plate" ? 0.7 : Math.max(armStart + 0.06, 0.22), hi = 0.94;
      for (let i = 0; i < count; i++) {
        const s = lo + (hi - lo) * ((i + 0.5 + (rng() - 0.5) * 0.5) / count);
        const room = 1 - s;
        const bl = clamp((0.55 * (1 - Math.pow(s, 1.4)) + 0.08) * falloff * (0.75 + rng() * 0.5), 0.02, room / Math.max(0.35, Math.cos(sideAng)) * 1.2);
        for (const sg of [-1, 1]) sub(s, 0, sg * sideAng, bl, 1, i * 13);
      }
      /* tip */
      const tip = st === "Plate" ? "Needle" : p.tip;
      if (tip === "Plate") shapes.push(hexagon(1 - 0.05, 0, 0.06, 0));
      else if (tip === "Fan") { for (const a of [-sideAng * 0.7, 0, sideAng * 0.7]) strokes.push({ pts: [[0.97, 0], [0.97 + Math.cos(a) * 0.07, Math.sin(a) * 0.07]], w: 1 }); }
      else if (tip === "Arrow") { for (const sg of [-1, 1]) strokes.push({ pts: [[1, 0], [1 - 0.07, sg * 0.05]], w: 1 }); }
      /* rime: dots along the arm and branches */
      if (p.rime) { const n = 3 + Math.floor(rng() * 4); for (let i = 0; i < n; i++) { const s = armStart + (0.98 - armStart) * rng(); const off = (rng() - 0.5) * 0.03; dots.push([s, off]); } }
      return { strokes, shapes, dots, coreR };
    };

    /* --------------------------------------------------- assemble one flake */
    /* returns paths in unit coords (R = 1), rotated by ARMS symmetry */
    const flake = (rng, fi) => {
      const out = [];
      const emit = (pts, closed) => { if (pts.length >= 2) out.push({ pts, closed }); };
      const unitW = widthMM / (baseSizeFor(fi) / 2);   /* rod width in unit coords */
      if (style === "Paper") {
        /* one wedge of the cut profile, mirrored round: 2*ARMS wedges */
        const wedge = Math.PI / ARMS;
        const m = 5 + Math.floor(rng() * 4);
        const prof = [];
        for (let j = 0; j <= m; j++) {
          const t = j / m;
          const th = wedge * t;
          let r;
          if (j === 0) r = 1; else if (j === m) r = 0.45 + rng() * 0.2; else r = 0.5 + rng() * 0.5;
          if (j > 0 && j < m && rng() < 0.3) r *= 0.75;      /* deep notch */
          prof.push([Math.cos(th) * r, Math.sin(th) * r]);
        }
        const outline = [];
        for (let k = 0; k < ARMS; k++) {
          const base = (k / ARMS) * Math.PI * 2;
          for (let j = 0; j < prof.length; j++) outline.push(rot2(prof[j], base));
          for (let j = prof.length - 1; j >= 1; j--) { const q = prof[j]; outline.push(rot2([q[0], -q[1]], base + 2 * wedge)); }
        }
        emit(outline, true);
        /* cut-out holes: mirrored shapes inside each wedge */
        for (let h = 0; h < holes; h++) {
          const r = 0.15 + rng() * 0.4, th = wedge * (0.15 + rng() * 0.7), hs = 0.035 + rng() * 0.06;
          const kind = rng();
          const centre = [Math.cos(th) * r, Math.sin(th) * r];
          let shape;
          if (kind < 0.4) shape = [[hs, 0], [0, hs * 0.7], [-hs, 0], [0, -hs * 0.7]];
          else if (kind < 0.7) shape = [[hs, 0], [-hs * 0.6, hs * 0.7], [-hs * 0.6, -hs * 0.7]];
          else shape = hexagon(0, 0, hs * 0.8, 0);
          const rotA = th + rng() * Math.PI;
          const placed = shape.map((q) => { const w = rot2(q, rotA); return [centre[0] + w[0], centre[1] + w[1]]; });
          if (placed.some((q) => Math.hypot(q[0], q[1]) > 0.66)) continue;
          for (let k = 0; k < ARMS; k++) {
            const base = (k / ARMS) * Math.PI * 2;
            emit(placed.map((q) => rot2(q, base)), true);
            emit(placed.map((q) => rot2([q[0], -q[1]], base + 2 * wedge)).reverse(), true);
          }
        }
        /* centre mark, like the pin hole */
        if (rng() < 0.5) emit(hexagon(0, 0, 0.05 + rng() * 0.04, 0), true);
        return out;
      }

      const A = growArm(rng, style);
      /* core plate */
      if (A.coreR > 0.02) {
        emit(hexagon(0, 0, A.coreR, Math.PI / 2), true);
        if (style === "Stellar" || A.coreR > 0.2) { emit(hexagon(0, 0, A.coreR * 0.55, Math.PI / 2 + Math.PI / 6), true); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 2; emit([[Math.cos(a) * A.coreR * 0.55, Math.sin(a) * A.coreR * 0.55], [Math.cos(a) * A.coreR, Math.sin(a) * A.coreR]], false); } }
      }
      /* plate style: big sectored hexagon */
      if (style === "Plate") {
        const R = 0.62, rot = Math.PI / 2;      /* vertices point along the arms */
        emit(hexagon(0, 0, R, rot), true);
        emit(hexagon(0, 0, R * 0.72, rot), true);
        emit(hexagon(0, 0, R * 0.36, rot + Math.PI / 6), true);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + rot;
          emit([[Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36], [Math.cos(a) * R, Math.sin(a) * R]], false);
          /* sector windows: a small V in every sector */
          const am = a + Math.PI / 6, r1 = R * 0.45, r2 = R * 0.66;
          const c1 = [Math.cos(am) * r1, Math.sin(am) * r1], c2 = [Math.cos(am) * r2, Math.sin(am) * r2];
          const nx = -Math.sin(am) * R * 0.1, ny = Math.cos(am) * R * 0.1;
          emit([[c1[0] + nx, c1[1] + ny], c2, [c1[0] - nx, c1[1] - ny]], false);
        }
      }
      /* the arm, ARMS times */
      for (let k = 0; k < ARMS; k++) {
        const a = (k / ARMS) * Math.PI * 2 + Math.PI / 2;
        const R = (q) => rot2(q, a);
        for (const s of A.strokes) {
          if (unitW > 0.0005) {
            const w0 = unitW * (s.w === 0 ? 1 : s.w === 1 ? 0.6 : 0.4);
            const r = rod(s.pts, w0, 0.3);
            if (r) emit(r.map(R), true);
          } else emit(s.pts.map(R), false);
        }
        for (const sh of A.shapes) emit(sh.map(R), true);
        for (const d of A.dots) { const c = R(d); emit(hexagon(c[0], c[1], 0.012, 0), true); }
      }
      return out;
    };

    /* ------------------------------------------------------------ placement */
    const cols = clamp(Math.round(Number(p.count) || 1), 1, 60), rowsN = clamp(Math.round(Number(p.rows) || 1), 1, 12);
    const baseSize = Math.max(2, Number(p.size) || 70);
    const rngG = mulberry32(seed * 7919 + 5);
    const placements = [];
    if (p.layout === "Rows") {
      const cw = (W - 2 * margin) / cols, ch = (H - 2 * margin) / rowsN;
      const Lfit = Math.min(baseSize, cw * 0.92, ch * 0.92);
      const jit = clamp(Number(p.jitter) || 0, 0, 100) / 100;
      for (let r = 0; r < rowsN; r++) for (let c = 0; c < cols; c++) {
        const L = Math.max(0.5, Lfit * (1 - vary * 0.55 * rngG()));
        const fx = (cw - L) / 2 * jit * (rngG() * 2 - 1), fy = (ch - L) / 2 * jit * (rngG() * 2 - 1);
        placements.push({ cx: margin + cw * (c + 0.5) + fx, cy: margin + ch * (r + 0.5) + fy, L, ang: (rngG() * 2 - 1) * spin, box: [margin + cw * c + cw * 0.02, margin + ch * r + ch * 0.02, margin + cw * (c + 1) - cw * 0.02, margin + ch * (r + 1) - ch * 0.02] });
      }
    } else {
      const N = cols;
      const avail = Math.min(W, H) - 2 * margin;
      const Lmax = Math.min(baseSize, Math.max(2, avail * 0.9));
      for (let i = 0; i < N; i++) {
        const L = Math.max(0.5, Lmax * (1 - vary * 0.7 * rngG()));
        const R = L * 0.52;
        let best = null, bestD = -Infinity;
        for (let a = 0; a < 30; a++) {
          const cx = margin + R + rngG() * Math.max(0, W - 2 * margin - 2 * R);
          const cy = margin + R + rngG() * Math.max(0, H - 2 * margin - 2 * R);
          let d = 1e9;
          for (const q of placements) d = Math.min(d, Math.hypot(q.cx - cx, q.cy - cy) - (q.L + L) * 0.5);
          if (d > bestD) { bestD = d; best = [cx, cy]; }
          if (d > 0) break;
        }
        placements.push({ cx: best[0], cy: best[1], L, ang: (rngG() * 2 - 1) * spin + (spin > 0 ? rngG() * Math.PI * 2 / ARMS : 0), box: [margin, margin, W - margin, H - margin] });
      }
    }
    const baseSizeFor = (fi) => placements[fi] ? placements[fi].L : baseSize;

    /* ------------------------------------------------------------ assemble */
    const paths = [];
    let total = 0;
    for (let i = 0; i < placements.length; i++) {
      if (total > BUDGET) break;
      const pl = placements[i];
      const rng = mulberry32(seed * 104729 + i * 131 + 17);
      const F = flake(rng, i);
      const half = pl.L / 2;
      const amp = style === "Paper" ? pl.L * 0.012 * wobble * 1.5 : 0;
      const step = Math.max(0.5, pl.L * 0.02);
      const c = Math.cos(pl.ang), s = Math.sin(pl.ang);
      let items = F.map((q, qi) => {
        let pts = q.pts.map(([x, y]) => [pl.cx + (x * c - y * s) * half, pl.cy + (x * s + y * c) * half]);
        if (amp > 0) pts = wob(pts, q.closed, amp, i * 31 + qi, step);
        return { pts, closed: q.closed };
      });
      /* fit: shrink only, then slide inside the box */
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const q of items) for (const [x, y] of q.pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
      if (!items.length || !Number.isFinite(x0)) continue;
      const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
      const [bx0, by0, bx1, by1] = pl.box;
      const k = Math.min(1, (bx1 - bx0) / bw, (by1 - by0) / bh);
      const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2;
      const hw = bw * k / 2, hh = bh * k / 2;
      const ncx = Math.min(bx1 - hw, Math.max(bx0 + hw, cxm)), ncy = Math.min(by1 - hh, Math.max(by0 + hh, cym));
      if (k < 0.9999 || Math.abs(ncx - cxm) > 1e-9 || Math.abs(ncy - cym) > 1e-9) items.forEach((q) => { q.pts = q.pts.map(([x, y]) => [ncx + (x - cxm) * k, ncy + (y - cym) * k]); });
      for (const q of items) { if (total > BUDGET) break; if (q.pts.length < 2) continue; paths.push({ pts: q.pts, closed: q.closed, layer: pen }); total += q.pts.length; }
    }
    return applyStyle({ paths }, ins[0]);
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      const g = [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
      if (p.layout === "Rows") {
        const cols = Math.max(1, Math.round(Number(p.count) || 1)), rows = Math.max(1, Math.round(Number(p.rows) || 1));
        if (cols * rows > 1 && cols * rows <= 96) { const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.push({ kind: "rect", x: m + cw * c, y: m + ch * r, w: cw, h: ch }); }
      }
      return g;
    } catch (e) { return []; }
  },
};
