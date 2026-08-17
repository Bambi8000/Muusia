import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "videotest",
  name: "Video Test Card",
  cat: "gen",
  group: "scientific",
  desc: "A collection of broadcast and imaging test cards, redrawn as pen-plotter line art. Pattern picks the card: Philips circle (the PM5544 composite - 19 x 14 crosshatch, the big geometry circle, castellations, colour bar band, multiburst gratings, staircase and the two station-text boxes), EIA 1956 resolution (converging TVL wedges at the centre and in all four corners, concentric focus circles, greyscale steps, stripe boxes and the overscan border arrows), Monoscope grid, Convergence crosshatch, Convergence dots, Siemens star (spoke count sets the limiting frequency at the hub), Zone plate (true Fresnel spacing - ring radii follow the square root of the ring index, so every ring encloses the same area), Multiburst sweep (discrete frequency blocks plus a continuous sweep), Colour bars (the EBU seven over reversed castellations, a PLUGE step wedge and the white/black reference blocks), Greyscale staircase (stepped and continuous), Overscan frames (nested 95/90/80 percent safe boxes, castellated border, corner arrows), Focus chart (five clusters: hub star, slanted edge, nested boxes), Checkerboard, Line-pair ladder (bar groups doubling in frequency) and Circle geometry. Because a pen cannot lay down grey, every tone is hatched: Tone and Ink spacing set how dense the fill runs, and the greyscale steps ramp their hatch spacing instead of their darkness - the plotter's honest translation of a grey ramp. Aspect letterboxes the card into a true 4:3, 16:9 or 1:1 frame inside the margin, because a test card drawn at the wrong ratio tests nothing. Colour elements map onto the 12-pen palette (bars run Gray / Ochre / Sky / Green / Magenta / Red / Blue, the closest analogues of the EBU order) or collapse onto one pen. Two knobs turn the instrument back into an image: Warp barrels or pincushions the whole card like a mistuned CRT, and Jitter tears each scan line sideways with seeded noise - geometry charts that have themselves lost their geometry.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "pattern", label: "Pattern", type: "select", options: ["Philips circle", "EIA 1956 resolution", "Monoscope grid", "Convergence crosshatch", "Convergence dots", "Siemens star", "Zone plate", "Multiburst sweep", "Colour bars", "Greyscale staircase", "Overscan frames", "Focus chart", "Checkerboard", "Line-pair ladder", "Circle geometry"], def: "Philips circle" },
    { key: "aspect", label: "Aspect", type: "select", options: ["Canvas", "4:3", "16:9", "1:1"], def: "4:3" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "density", label: "Grid lines", type: "slider", min: 4, max: 32, step: 1, def: 14 },
    { key: "steps", label: "Steps / blocks", type: "slider", min: 3, max: 16, step: 1, def: 10 },
    { key: "spokes", label: "Spokes", type: "slider", min: 8, max: 144, step: 2, def: 48 },
    { key: "rings", label: "Rings", type: "slider", min: 4, max: 40, step: 1, def: 14 },
    { key: "tone", label: "Tone", type: "select", options: ["Outline", "Hatch", "Dense"], def: "Hatch" },
    { key: "ink", label: "Ink spacing mm", type: "slider", min: 0.4, max: 4, step: 0.1, def: 1.2 },
    { key: "circleOn", label: "Centre circle", type: "check", def: true },
    { key: "labels", label: "Numbers", type: "check", def: true },
    { key: "colorPens", label: "Colour pens", type: "check", def: true },
    { key: "warp", label: "CRT warp", type: "slider", min: -0.6, max: 0.6, step: 0.01, def: 0 },
    { key: "jitter", label: "Line jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "pen2", label: "Accent pen", type: "pen", def: 2 },
  ],

  overlay(p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 4, p.margin));
    let w = W - 2 * m, h = H - 2 * m;
    if (w < 8 || h < 8) return [];
    const R = p.aspect === "4:3" ? 4 / 3 : p.aspect === "16:9" ? 16 / 9 : p.aspect === "1:1" ? 1 : 0;
    if (R > 0) { if (w / h > R) w = h * R; else h = w / R; }
    const x0 = (W - w) / 2, y0 = (H - h) / 2;
    const g = [{ kind: "rect", x: x0, y: y0, w, h }];
    const round = ["Philips circle", "Siemens star", "Zone plate", "Circle geometry", "Monoscope grid", "EIA 1956 resolution"];
    if (round.indexOf(p.pattern) >= 0) g.push({ kind: "circle", cx: x0 + w / 2, cy: y0 + h / 2, r: Math.min(w, h) * 0.45 });
    return g;
  },

  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 4, p.margin));
    let w = W - 2 * m, h = H - 2 * m;
    if (w < 8 || h < 8) return EMPTY;
    const R = p.aspect === "4:3" ? 4 / 3 : p.aspect === "16:9" ? 16 / 9 : p.aspect === "1:1" ? 1 : 0;
    if (R > 0) { if (w / h > R) w = h * R; else h = w / R; }
    const x0 = (W - w) / 2, y0 = (H - h) / 2;
    const x1 = x0 + w, y1 = y0 + h;
    const cx = x0 + w / 2, cy = y0 + h / 2;
    const L = Math.round(p.layer), L2 = Math.round(p.pen2);
    const seed = Math.round(p.seed);
    const nGrid = Math.max(4, Math.round(p.density));
    const nStep = Math.max(3, Math.round(p.steps));
    const nSpoke = Math.max(8, Math.round(p.spokes));
    const nRing = Math.max(4, Math.round(p.rings));
    const ink = Math.max(0.4, p.ink);
    const tone = p.tone;
    const fillStep = tone === "Dense" ? ink : ink * 2.2;
    const filled = tone !== "Outline";
    const warp = Math.max(-0.6, Math.min(0.6, p.warp));
    const jit = Math.max(0, Math.min(1, p.jitter));
    /* EBU bar order mapped onto the 12-pen palette: white, yellow, cyan,
       green, magenta, red, blue -> Gray, Ochre, Sky, Green, Magenta, Red, Blue */
    const BARPENS = [9, 10, 11, 3, 7, 2, 1];
    const barPen = (i) => (p.colorPens ? BARPENS[i % BARPENS.length] : L);

    const paths = [];
    const BUDGET = 115000;
    let total = 0;
    const half = Math.max(w, h) / 2;
    /* warp pins the card corners, so a mistuned-CRT bulge never throws the
       pattern off the sheet: only the interior moves */
    const r2c = ((w * w) / 4 + (h * h) / 4) / (half * half);
    const xf = (q) => {
      let x = q[0], y = q[1];
      if (warp !== 0) {
        const u = (x - cx) / half, v = (y - cy) / half;
        const f = Math.max(0.3, Math.min(2.2, 1 + warp * (u * u + v * v - r2c) * 0.55));
        x = cx + u * half * f; y = cy + v * half * f;
      }
      if (jit > 0) x += jit * 3 * (noise2(0, y * 0.4, seed) - 0.5) * 2;
      return [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
    };
    const distort = warp !== 0 || jit > 0;
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || total > BUDGET) return;
      let src = pts;
      if (distort) {
        /* densify so straight runs actually bend / tear */
        src = [pts[0]];
        const seq = closed ? pts.concat([pts[0]]) : pts;
        for (let i = 1; i < seq.length; i++) {
          const a = seq[i - 1], b = seq[i];
          const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const n = Math.max(1, Math.min(120, Math.ceil(d / 2)));
          for (let k = 1; k <= n; k++) src.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
        }
        if (closed) src.pop();
      }
      const out = src.map(xf);
      total += out.length;
      paths.push({ pts: out, closed: !!closed, layer: layer == null ? L : layer });
    };
    const rect = (x, y, rw, rh, layer) => {
      if (rw <= 0.05 || rh <= 0.05) return;
      push([[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]], true, layer);
    };
    const circle = (ccx, ccy, r, layer) => {
      if (r < 0.2 || total > BUDGET) return;
      const n = Math.max(16, Math.ceil((Math.PI * 2 * r) / Math.min(1.2, Math.max(0.5, r / 12))));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([ccx + Math.cos(a) * r, ccy + Math.sin(a) * r]);
      }
      push(pts, true, layer);
    };
    const arc = (ccx, ccy, r, a0, a1, layer) => {
      if (r < 0.2) return;
      const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / 0.8));
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        pts.push([ccx + Math.cos(a) * r, ccy + Math.sin(a) * r]);
      }
      push(pts, false, layer);
    };
    /* serpentine hatch inside an axis-aligned box */
    const hatch = (x, y, bw, bh, step, vertical, layer) => {
      if (bw <= 0.2 || bh <= 0.2 || step <= 0.05) return;
      let i = 0;
      if (vertical) {
        for (let v = x + step / 2; v < x + bw; v += step, i++)
          push(i % 2 ? [[v, y + bh], [v, y]] : [[v, y], [v, y + bh]], false, layer);
      } else {
        for (let v = y + step / 2; v < y + bh; v += step, i++)
          push(i % 2 ? [[x + bw, v], [x, v]] : [[x, v], [x + bw, v]], false, layer);
      }
    };
    const box = (x, y, bw, bh, step, layer) => {
      rect(x, y, bw, bh, layer);
      if (filled && step > 0) hatch(x, y, bw, bh, step, false, layer);
    };
    /* single-stroke numerals on a 0.6 x 1.0 box */
    const GLYPH = {
      "0": [[[0, 0.12], [0.15, 0], [0.45, 0], [0.6, 0.12], [0.6, 0.88], [0.45, 1], [0.15, 1], [0, 0.88], [0, 0.12]]],
      "1": [[[0.1, 0.17], [0.3, 0], [0.3, 1]], [[0.08, 1], [0.52, 1]]],
      "2": [[[0, 0.17], [0.16, 0], [0.44, 0], [0.6, 0.17], [0.6, 0.34], [0, 0.86], [0, 1], [0.6, 1]]],
      "3": [[[0, 0], [0.6, 0], [0.26, 0.44], [0.48, 0.44], [0.6, 0.6], [0.6, 0.86], [0.44, 1], [0.14, 1], [0, 0.86]]],
      "4": [[[0.46, 1], [0.46, 0], [0, 0.72], [0.6, 0.72]]],
      "5": [[[0.6, 0], [0, 0], [0, 0.42], [0.42, 0.42], [0.6, 0.6], [0.6, 0.86], [0.44, 1], [0.12, 1], [0, 0.88]]],
      "6": [[[0.54, 0.06], [0.3, 0], [0.08, 0.18], [0, 0.58], [0.08, 0.92], [0.32, 1], [0.56, 0.9], [0.6, 0.66], [0.44, 0.48], [0.14, 0.5], [0, 0.66]]],
      "7": [[[0, 0], [0.6, 0], [0.26, 1]]],
      "8": [[[0.3, 0.48], [0.06, 0.38], [0.06, 0.1], [0.3, 0], [0.54, 0.1], [0.54, 0.38], [0.3, 0.48], [0.02, 0.62], [0.02, 0.9], [0.3, 1], [0.58, 0.9], [0.58, 0.62], [0.3, 0.48]]],
      "9": [[[0.06, 0.94], [0.3, 1], [0.52, 0.82], [0.6, 0.42], [0.52, 0.08], [0.28, 0], [0.04, 0.1], [0, 0.34], [0.16, 0.52], [0.46, 0.5], [0.6, 0.34]]],
      ".": [[[0.26, 0.94], [0.34, 0.94], [0.34, 1], [0.26, 1], [0.26, 0.94]]],
    };
    const text = (s, tx, ty, gh, layer, centre) => {
      if (!p.labels || gh < 1.2) return;
      const str = String(s);
      const gw = gh * 0.6, gap = gh * 0.18;
      const twid = str.length * gw + (str.length - 1) * gap;
      const sx = centre ? tx - twid / 2 : tx;
      for (let i = 0; i < str.length; i++) {
        for (const st of (GLYPH[str[i]] || [])) {
          push(st.map(([gx, gy]) => [sx + i * (gw + gap) + gx * gh, ty + gy * gh]), false, layer == null ? L2 : layer);
        }
      }
    };
    /* a converging resolution wedge: two lines closing to a point, filled with
       lines whose spacing shrinks with the wedge - the TVL measurement itself */
    const wedge = (wx, wy, len, wide, dir, lines, layer) => {
      /* dir: 0 right, 1 down, 2 left, 3 up. Apex at (wx,wy). */
      const ux = dir === 0 ? 1 : dir === 2 ? -1 : 0;
      const uy = dir === 1 ? 1 : dir === 3 ? -1 : 0;
      const nx = -uy, ny = ux;
      const P = (t, s) => [wx + ux * len * t + nx * s, wy + uy * len * t + ny * s];
      push([P(0, 0), P(1, wide / 2)], false, layer);
      push([P(0, 0), P(1, -wide / 2)], false, layer);
      push([P(1, -wide / 2), P(1, wide / 2)], false, layer);
      const n = Math.max(2, Math.round(lines));
      for (let i = 1; i < n; i++) {
        const s = (i / n - 0.5) * wide;
        const t0 = Math.abs(s) / (wide / 2);
        if (t0 >= 0.98) continue;
        push([P(t0, s), P(1, s)], false, layer);
      }
    };
    const cross = (px, py, r, layer) => {
      push([[px - r, py], [px + r, py]], false, layer);
      push([[px, py - r], [px, py + r]], false, layer);
    };
    const castellate = (x, y, bw, bh, n, layer) => {
      const cw = bw / n;
      for (let i = 0; i < n; i += 2) box(x + i * cw, y, cw, bh, fillStep, layer);
    };
    /* greyscale step: tone carried by hatch spacing, black = tightest */
    const greyBox = (x, y, bw, bh, level, layer) => {
      rect(x, y, bw, bh, layer);
      if (level <= 0.001 || !filled) return;
      const st = (tone === "Dense" ? ink : ink * 1.8) / Math.max(0.08, level);
      if (st < bh) hatch(x, y, bw, bh, st, false, layer);
    };

    const PAT = p.pattern;

    if (PAT === "Philips circle") {
      /* bands, top to bottom, in PM5544 order */
      const bandC = h * 0.038;                    /* castellation strips */
      const bandB = h * 0.10;                     /* colour bars */
      const bandM = h * 0.085;                    /* multiburst */
      const bandS = h * 0.085;                    /* staircase */
      rect(x0, y0, w, h, L);
      castellate(x0, y0, w, bandC, 20, L2);
      castellate(x0, y1 - bandC, w, bandC, 20, L2);
      const by = y0 + bandC;
      for (let i = 0; i < 7; i++) box(x0 + (i * w) / 7, by, w / 7, bandB, fillStep, barPen(i));
      const sy = y1 - bandC - bandS;
      for (let i = 0; i < 6; i++) greyBox(x0 + (i * w) / 6, sy, w / 6, bandS, i / 5, L);
      const my = sy - bandM;
      for (let i = 0; i < 5; i++) {
        const bx = x0 + (i * w) / 5;
        rect(bx, my, w / 5, bandM, L);
        hatch(bx, my, w / 5, bandM, Math.max(0.45, ink * (2.4 - i * 0.45)), true, L);
        text(String(i + 1), bx + w / 10, my + bandM * 0.25, bandM * 0.4, L2, true);
      }
      /* crosshatch across the picture area: 19 vertical, 14 horizontal */
      const gy0 = by + bandB, gy1 = my;
      for (let i = 0; i <= 18; i++) push([[x0 + (i * w) / 18, gy0], [x0 + (i * w) / 18, gy1]], false, L);
      for (let i = 0; i <= 13; i++) push([[x0, gy0 + (i * (gy1 - gy0)) / 13], [x1, gy0 + (i * (gy1 - gy0)) / 13]], false, L);
      const gcy = (gy0 + gy1) / 2;
      if (p.circleOn) {
        const r = Math.min(w * 0.46, (gy1 - gy0) * 0.49);
        circle(cx, gcy, r, L2);
        circle(cx, gcy, r * 0.985, L2);
        /* the two station-text boxes inside the circle */
        box(cx - r * 0.5, gcy - r * 0.42, r, r * 0.22, fillStep, L);
        box(cx - r * 0.5, gcy + r * 0.2, r, r * 0.22, fillStep, L);
      }
      for (const [qx, qy] of [[x0, gy0], [x1, gy0], [x1, gy1], [x0, gy1]]) circle(qx, qy, Math.min(w, h) * 0.045, L2);
    } else if (PAT === "EIA 1956 resolution") {
      rect(x0, y0, w, h, L);
      const r = Math.min(w, h) * 0.45;
      if (p.circleOn) { circle(cx, cy, r, L); circle(cx, cy, r * 0.62, L); circle(cx, cy, r * 0.3, L2); }
      /* centre wedge cross: four converging wedges, 200..1000 TVL labels */
      const wl = r * 0.55, ww = Math.min(w, h) * 0.11;
      const TVL = [200, 400, 600, 800];
      for (let d = 0; d < 4; d++) {
        wedge(cx, cy, wl, ww, d, Math.round(6 + nStep * 0.6), L);
        const lx = cx + (d === 0 ? wl * 1.2 : d === 2 ? -wl * 1.2 : 0);
        const ly = cy + (d === 1 ? wl * 1.22 : d === 3 ? -wl * 1.22 : 0);
        text(TVL[d], lx, ly - Math.min(w, h) * 0.02, Math.min(w, h) * 0.035, L2, true);
      }
      /* corner wedge clusters */
      const cwl = r * 0.3, cww = ww * 0.7;
      const ins2 = Math.min(w, h) * 0.11;
      const corners = [[x0 + ins2, y0 + ins2, 0, 1], [x1 - ins2, y0 + ins2, 2, 1], [x1 - ins2, y1 - ins2, 2, 3], [x0 + ins2, y1 - ins2, 0, 3]];
      for (const [qx, qy, dA, dB] of corners) {
        wedge(qx, qy, cwl, cww, dA, 6, L);
        wedge(qx, qy, cwl, cww, dB, 6, L);
        circle(qx, qy, cww * 0.22, L2);
      }
      /* stripe boxes left and right, greyscale strip at the bottom */
      const sbw = w * 0.1, sbh = h * 0.18;
      box(x0 + w * 0.02, cy - sbh / 2, sbw, sbh, 0, L);
      hatch(x0 + w * 0.02, cy - sbh / 2, sbw, sbh, ink * 1.6, true, L);
      box(x1 - w * 0.02 - sbw, cy - sbh / 2, sbw, sbh, 0, L);
      hatch(x1 - w * 0.02 - sbw, cy - sbh / 2, sbw, sbh, ink * 1.6, false, L);
      const gsh = h * 0.07, gsw = w * 0.6;
      for (let i = 0; i < nStep; i++) greyBox(cx - gsw / 2 + (i * gsw) / nStep, y1 - gsh * 1.4, gsw / nStep, gsh, i / (nStep - 1), L);
      /* border arrows for overscan */
      const ar = Math.min(w, h) * 0.035;
      for (const [qx, qy, dx, dy] of [[cx, y0, 0, 1], [cx, y1, 0, -1], [x0, cy, 1, 0], [x1, cy, -1, 0]])
        push([[qx - ar * (dy ? 1 : 0), qy - ar * (dx ? 1 : 0)], [qx + ar * dx * 1.6, qy + ar * dy * 1.6], [qx + ar * (dy ? 1 : 0), qy + ar * (dx ? 1 : 0)]], true, L2);
    } else if (PAT === "Monoscope grid" || PAT === "Convergence crosshatch") {
      const nx = nGrid, ny = Math.max(3, Math.round((nGrid * h) / w));
      rect(x0, y0, w, h, L);
      for (let i = 1; i < nx; i++) push([[x0 + (i * w) / nx, y0], [x0 + (i * w) / nx, y1]], false, L);
      for (let i = 1; i < ny; i++) push([[x0, y0 + (i * h) / ny], [x1, y0 + (i * h) / ny]], false, L);
      if (p.circleOn) circle(cx, cy, Math.min(w, h) * 0.45, L2);
      if (PAT === "Monoscope grid") {
        push([[x0, y0], [x1, y1]], false, L2);
        push([[x1, y0], [x0, y1]], false, L2);
        circle(cx, cy, Math.min(w, h) * 0.15, L2);
        const cr = Math.min(w, h) * 0.07;
        for (const [qx, qy] of [[x0 + cr * 1.4, y0 + cr * 1.4], [x1 - cr * 1.4, y0 + cr * 1.4], [x1 - cr * 1.4, y1 - cr * 1.4], [x0 + cr * 1.4, y1 - cr * 1.4]]) circle(qx, qy, cr, L2);
      }
      cross(cx, cy, Math.min(w, h) * 0.06, L2);
    } else if (PAT === "Convergence dots") {
      const nx = nGrid, ny = Math.max(3, Math.round((nGrid * h) / w));
      rect(x0, y0, w, h, L);
      const r = Math.min(w / nx, h / ny) * 0.16;
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
        const qx = x0 + (i * w) / nx, qy = y0 + (j * h) / ny;
        if (filled) circle(qx, qy, r, L); else cross(qx, qy, r, L);
      }
      if (p.circleOn) circle(cx, cy, Math.min(w, h) * 0.45, L2);
    } else if (PAT === "Siemens star") {
      const r = Math.min(w, h) * 0.46, rin = r * 0.06;
      rect(x0, y0, w, h, L);
      circle(cx, cy, r, L2);
      const N = Math.round(nSpoke / 2) * 2;
      for (let i = 0; i < N; i += 2) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const pts = [[cx + Math.cos(a0) * rin, cy + Math.sin(a0) * rin]];
        const n = Math.max(3, Math.ceil((r * (a1 - a0)) / 0.8));
        pts.push([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r]);
        for (let k = 1; k <= n; k++) {
          const a = a0 + ((a1 - a0) * k) / n;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        pts.push([cx + Math.cos(a1) * rin, cy + Math.sin(a1) * rin]);
        push(pts, true, L);
        if (filled) {
          for (let rr = rin + fillStep; rr < r; rr += fillStep) arc(cx, cy, rr, a0, a1, L);
        }
      }
      circle(cx, cy, rin, L2);
      if (p.labels) for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        text(N, cx + Math.cos(a) * r * 1.06, cy + Math.sin(a) * r * 1.06 - r * 0.03, Math.min(w, h) * 0.035, L2, true);
      }
    } else if (PAT === "Zone plate") {
      const r = Math.min(w, h) * 0.46;
      rect(x0, y0, w, h, L);
      /* Fresnel spacing: equal area per ring -> radius follows sqrt(k) */
      for (let k = 1; k <= nRing; k++) {
        const rk = r * Math.sqrt(k / nRing);
        circle(cx, cy, rk, L);
        if (filled && k % 2 === 0) {
          const rp = r * Math.sqrt((k - 1) / nRing);
          for (let rr = rp + fillStep; rr < rk; rr += fillStep) circle(cx, cy, rr, L);
        }
      }
      cross(cx, cy, r * 0.05, L2);
    } else if (PAT === "Multiburst sweep") {
      rect(x0, y0, w, h, L);
      const bh = h * 0.52, bw2 = w / Math.max(3, nStep);
      for (let i = 0; i < Math.max(3, nStep); i++) {
        const bx = x0 + i * bw2;
        rect(bx, y0, bw2, bh, L);
        const st = Math.max(0.35, ink * (3 - (i * 2.4) / Math.max(1, nStep - 1)));
        hatch(bx, y0, bw2, bh, st, true, L);
        text(i + 1, bx + bw2 / 2, y0 + bh + h * 0.02, h * 0.05, L2, true);
      }
      /* continuous sweep: spacing shrinks smoothly across the width */
      const sy2 = y0 + bh + h * 0.1, sh = y1 - sy2;
      rect(x0, sy2, w, sh, L);
      let x = x0 + 0.4;
      let i2 = 0;
      while (x < x1 - 0.2 && total < BUDGET) {
        const t = (x - x0) / w;
        push(i2 % 2 ? [[x, sy2 + sh], [x, sy2]] : [[x, sy2], [x, sy2 + sh]], false, L);
        x += Math.max(0.35, ink * (3 - 2.6 * t));
        i2++;
      }
    } else if (PAT === "Colour bars") {
      const topH = h * 0.63, midH = h * 0.09;
      for (let i = 0; i < 7; i++) box(x0 + (i * w) / 7, y0, w / 7, topH, fillStep, barPen(i));
      /* reversed castellation strip */
      for (let i = 0; i < 7; i++) box(x0 + (i * w) / 7, y0 + topH, w / 7, midH, fillStep, barPen(6 - i));
      const by2 = y0 + topH + midH, bh2 = y1 - by2;
      /* PLUGE: -4 / 0 / +4 steps in a black surround, then white and black refs */
      const plw = w * 0.34;
      rect(x0, by2, plw, bh2, L);
      hatch(x0, by2, plw, bh2, ink * 0.9, false, L);
      for (let i = 0; i < 3; i++) {
        const px = x0 + plw * (0.18 + i * 0.24);
        greyBox(px, by2 + bh2 * 0.15, plw * 0.16, bh2 * 0.7, [1, 0.55, 0.15][i], L2);
      }
      box(x0 + plw, by2, w * 0.2, bh2, 0, L);
      text(100, x0 + plw + w * 0.1, by2 + bh2 * 0.35, bh2 * 0.3, L2, true);
      greyBox(x0 + plw + w * 0.2, by2, w * 0.2, bh2, 1, L);
      const rest = x1 - (x0 + plw + w * 0.4);
      for (let i = 0; i < 4; i++) greyBox(x0 + plw + w * 0.4 + (i * rest) / 4, by2, rest / 4, bh2, i / 3, L);
      rect(x0, y0, w, h, L);
    } else if (PAT === "Greyscale staircase") {
      rect(x0, y0, w, h, L);
      const topH = h * 0.52;
      for (let i = 0; i < nStep; i++) {
        greyBox(x0 + (i * w) / nStep, y0, w / nStep, topH, i / (nStep - 1), L);
        text(Math.round((100 * i) / (nStep - 1)), x0 + ((i + 0.5) * w) / nStep, y0 + topH + h * 0.02, h * 0.045, L2, true);
      }
      /* continuous ramp underneath */
      const ry = y0 + topH + h * 0.11, rh = y1 - ry;
      rect(x0, ry, w, rh, L);
      let x = x0 + 0.3, i3 = 0;
      while (x < x1 - 0.2 && total < BUDGET) {
        const t = (x - x0) / w;
        push(i3 % 2 ? [[x, ry + rh], [x, ry]] : [[x, ry], [x, ry + rh]], false, L);
        x += Math.max(0.35, ink * (0.35 + 3 * (1 - t)));
        i3++;
      }
    } else if (PAT === "Overscan frames") {
      const pcts = [1, 0.95, 0.9, 0.8];
      for (let i = 0; i < pcts.length; i++) {
        const f = pcts[i];
        const fw = w * f, fh = h * f;
        rect(cx - fw / 2, cy - fh / 2, fw, fh, i === 0 ? L : L2);
        text(Math.round(f * 100), cx - fw / 2 + w * 0.02, cy - fh / 2 + h * 0.012, h * 0.035, L2, false);
      }
      castellate(x0, y0, w, h * 0.035, 24, L);
      castellate(x0, y1 - h * 0.035, w, h * 0.035, 24, L);
      const cbw = w * 0.035;
      for (let i = 0; i < 16; i += 2) {
        const bh3 = h / 16;
        box(x0, y0 + i * bh3, cbw, bh3, fillStep, L);
        box(x1 - cbw, y0 + i * bh3, cbw, bh3, fillStep, L);
      }
      cross(cx, cy, Math.min(w, h) * 0.08, L2);
      const ar = Math.min(w, h) * 0.05;
      for (const [qx, qy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) {
        push([[qx + dx * ar * 2.4, qy + dy * ar * 0.5], [qx + dx * ar * 0.4, qy + dy * ar * 0.4], [qx + dx * ar * 0.5, qy + dy * ar * 2.4]], false, L2);
      }
    } else if (PAT === "Focus chart") {
      rect(x0, y0, w, h, L);
      const cl = Math.min(w, h) * 0.17;
      const spots = [[cx, cy], [x0 + cl, y0 + cl], [x1 - cl, y0 + cl], [x1 - cl, y1 - cl], [x0 + cl, y1 - cl]];
      for (let s = 0; s < spots.length; s++) {
        const [qx, qy] = spots[s];
        const r = cl * 0.40;
        const N = Math.max(8, Math.round(nSpoke / 4) * 2);
        for (let i = 0; i < N; i += 2) {
          const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
          push([[qx, qy], [qx + Math.cos(a0) * r, qy + Math.sin(a0) * r], [qx + Math.cos(a1) * r, qy + Math.sin(a1) * r]], true, L);
        }
        circle(qx, qy, r * 1.12, L2);
        /* nested boxes + a slanted edge, the modern focus pair */
        for (let k = 1; k <= 3; k++) rect(qx - r * 0.3 * k, qy + r * 1.5, r * 0.6 * k, r * 0.32 * k, L2);
        const se = r * 0.55;
        push([[qx - se, qy - r * 1.95], [qx + se, qy - r * 1.62], [qx + se, qy - r * 1.18], [qx - se, qy - r * 1.51]], true, L);
        if (filled) for (let t = 0.15; t < 1; t += 0.2) {
          const yT = qy - r * 1.95 + t * (r * 0.44);
          push([[qx - se, yT], [qx + se, yT + r * 0.33]], false, L);
        }
        text(s + 1, qx, qy + r * 3.1, cl * 0.14, L2, true);
      }
    } else if (PAT === "Checkerboard") {
      const nx = nGrid, ny = Math.max(2, Math.round((nGrid * h) / w));
      rect(x0, y0, w, h, L);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        if ((i + j) % 2) continue;
        const bx = x0 + (i * w) / nx, by3 = y0 + (j * h) / ny;
        box(bx, by3, w / nx, h / ny, fillStep, L);
      }
    } else if (PAT === "Line-pair ladder") {
      rect(x0, y0, w, h, L);
      const rows = Math.max(3, nStep);
      const rh = h / rows;
      for (let r2 = 0; r2 < rows; r2++) {
        const y2 = y0 + r2 * rh;
        const step = Math.max(0.35, ink * 3 * Math.pow(0.82, r2));
        const bw3 = w * 0.62;
        rect(x0 + w * 0.04, y2 + rh * 0.15, bw3, rh * 0.7, L);
        hatch(x0 + w * 0.04, y2 + rh * 0.15, bw3, rh * 0.7, step, true, L);
        rect(x0 + w * 0.7, y2 + rh * 0.15, w * 0.18, rh * 0.7, L);
        hatch(x0 + w * 0.7, y2 + rh * 0.15, w * 0.18, rh * 0.7, step, false, L);
        text(Math.round(step * 10), x1 - w * 0.06, y2 + rh * 0.3, rh * 0.36, L2, true);
      }
    } else {
      /* Circle geometry */
      rect(x0, y0, w, h, L);
      const r = Math.min(w, h) * 0.46;
      for (let k = 1; k <= Math.min(nRing, 12); k++) circle(cx, cy, (r * k) / Math.min(nRing, 12), k % 2 ? L : L2);
      cross(cx, cy, r * 1.02, L2);
      const s2 = r / Math.SQRT2;
      rect(cx - s2, cy - s2, s2 * 2, s2 * 2, L2);
      rect(cx - r, cy - r, r * 2, r * 2, L);
      push([[cx - r, cy - r], [cx + r, cy + r]], false, L2);
      push([[cx + r, cy - r], [cx - r, cy + r]], false, L2);
    }

    return applyStyle({ paths }, ins[0]);
  },
};
