import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  /* Guilloché — banknote fine-line patterns, one node, five styles. Rosette
   * stacks rotated copies of a wavy ring; Rings serra concentric circles; Fan
   * lays seeded chords in a rotated fan; Weave interleaves two out-of-phase
   * rosette families into a moiré lattice; Spiral winds one shrinking coil.
   * Every copy gets its own seeded phase, rotation nudge and radial wobble, so
   * the sheets look hand-cut rather than machined. The pattern centres on the
   * sheet inside Margin, clips to the paper edge like real security printing,
   * honours the point budget by thinning samples instead of cutting the sheet,
   * and can draw part of the family in a second Accent pen. */
  key: "guilloche",
  name: "Guilloché",
  cat: "gen",
  group: "geometric",
  desc: "Banknote fine-line patterns in five selectable styles: Rosette (rotated wavy-ring stack), Rings (concentric serrations), Fan (seeded chord fan), Weave (two out-of-phase moiré families) and Spiral (one long coil). Waves set the lobe count, Copies the family size, Amplitude the wave depth, Growth the radial step between copies, Jitter the seeded hand-cut wobble, Angle the whole-pattern rotation, and an optional Accent share draws part of the family in a second pen. The family centres on the sheet, clips to the paper edge, and thins its sampling under the point budget so every run stays complete. Chain into Brush or Warp downstream; compare with the single-curve Spirograph node.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "mode", label: "Mode", type: "select", options: ["Rosette", "Rings", "Fan", "Weave", "Spiral"], def: "Rosette" },
    { key: "radius", label: "Radius mm", type: "slider", min: 20, max: 800, step: 5, def: 240 },
    { key: "waves", label: "Waves", type: "slider", min: 8, max: 360, step: 1, def: 96 },
    { key: "copies", label: "Copies", type: "slider", min: 2, max: 96, step: 1, def: 24 },
    { key: "amplitude", label: "Amplitude", type: "slider", min: 0.02, max: 0.6, step: 0.01, def: 0.18 },
    { key: "growth", label: "Growth", type: "slider", min: 0, max: 0.06, step: 0.002, def: 0.012 },
    { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
    { key: "angle", label: "Angle °", type: "slider", min: -180, max: 180, step: 5, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "accent", label: "Accent %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "pen2", label: "Accent pen", type: "pen", def: 3, showIf: (p) => p.accent > 0 },
  ],
  _layout(p, c) {
    const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const W = c && Number.isFinite(+c.W) ? +c.W : 0;
    const H = c && Number.isFinite(+c.H) ? +c.H : 0;
    if (!(W > 8) || !(H > 8)) return null;
    const m = num(p.margin, 10, 0, Math.min(W, H) / 2 - 1);
    // Cap the radius for the wave's full radial excursion (Amplitude × Jitter
    // wobble) so the base family sits on-sheet; Growth can still carry outer
    // copies past the edge, which then clips like real security printing.
    const e = num(p.amplitude, 0.18, 0, 2);
    const j = num(p.jitter, 0.15, 0, 5);
    const fit = (Math.min(W, H) / 2 - m - 1) / (1 + e * (1 + 0.5 * j));
    const R = Math.min(num(p.radius, 240, 1, 1e6), fit);
    if (!(R > 1)) return null;
    return { W, H, m, R, cx: W / 2, cy: H / 2 };
  },
  overlay(p, ctx) {
    try {
      const L = this._layout(p, ctx);
      if (!L) return [];
      const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
      const g = num(p.growth, 0.012, 0, 1);
      const e = num(p.amplitude, 0.18, 0, 1);
      const N = Math.round(num(p.copies, 24, 1, 1000));
      const ext = L.R * (1 + Math.max(0, N - 1) * g) + L.R * e * 0.6 + 2;
      return [
        { kind: "rect", x: L.m, y: L.m, w: L.W - 2 * L.m, h: L.H - 2 * L.m },
        { kind: "rect", x: L.cx - ext, y: L.cy - ext, w: ext * 2, h: ext * 2 },
      ];
    } catch (e2) {
      return [];
    }
  },
  compute(ins, p, ctx) {
    const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const L = this._layout(p, ctx);
    if (!L) return applyStyle(EMPTY, ins[0]);
    const { W, H, R, cx, cy } = L;
    const seed = Math.round(num(p.seed, 7, -2147483648, 2147483647));
    const mode = typeof p.mode === "string" && p.mode ? p.mode : "Rosette";
    const k = Math.round(num(p.waves, 96, 2, 4000));
    const N = Math.round(num(p.copies, 24, 1, 4000));
    const e = num(p.amplitude, 0.18, 0, 2);
    const g = num(p.growth, 0.012, 0, 1);
    const jit = num(p.jitter, 0.15, 0, 5);
    const rot = num(p.angle, 0, -3600, 3600) * Math.PI / 180;
    const accentF = num(p.accent, 0, 0, 100) / 100;
    const layer = Math.max(0, Math.min(11, Math.round(num(p.layer, 0, 0, 11))));
    const layer2 = Math.max(0, Math.min(11, Math.round(num(p.pen2, 3, 0, 11))));

    // Sampling steps per curve, with a hard ceiling per style.
    let S;
    if (mode === "Fan") S = Math.min(161, Math.max(16, Math.round(2 * Math.sqrt(2 * k) + 1)));
    else if (mode === "Spiral") {
      const turns = Math.max(2, Math.min(60, Math.round(N * 0.5)));
      S = Math.min(60000, Math.max(128, Math.round(k * turns * 2)));
    } else S = Math.min(720, Math.max(64, Math.round(2 * k)));

    const paths = [];
    const pushCurve = (pts, closed, pen, outside) => {
      // Clip to the sheet like real security printing: keep what is inside,
      // clamp stray samples onto the edge, drop degenerate stubs.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) {
        if (x < minX) minX = x; else if (x > maxX) maxX = x;
        if (y < minY) minY = y; else if (y > maxY) maxY = y;
      }
      if (minX >= -1e-6 && minY >= -1e-6 && maxX <= W + 1e-6 && maxY <= H + 1e-6) {
        paths.push({ pts, closed, layer: pen });
        return;
      }
      const cp = [];
      for (let s = 0; s < pts.length; s++) {
        const x = Math.min(W, Math.max(0, pts[s][0]));
        const y = Math.min(H, Math.max(0, pts[s][1]));
        const last = cp[cp.length - 1];
        if (!last || (x - last[0]) * (x - last[0]) + (y - last[1]) * (y - last[1]) > 1e-6) cp.push([x, y]);
      }
      if (cp.length >= 2) paths.push({ pts: cp, closed, layer: pen });
      else if (!outside) { /* fully off-sheet curve: dropped on purpose */ }
    };

    const copyMeta = [];
    for (let i = 0; i < N; i++) {
      const rng = mulberry32((seed ^ Math.imul(i + 1, 0x9e3779b9) | 0) >>> 0);
      copyMeta.push({ phi: rng() * Math.PI * 2, delta: (rng() * 2 - 1) * jit * (Math.PI / N) * 0.5, pick: rng() });
    }
    const wob = (theta, i) => jit * e * R * 0.5 * (noise2(theta * 1.7 + i * 6.17, i * 2.31, seed) * 2 - 1);

    if (mode === "Fan") {
      for (let i = 0; i < N; i++) {
        const beta = rot + (Math.PI * 2 * i) / N + copyMeta[i].delta * 2;
        const d = R * (0.25 + 0.65 * mulberry32((seed ^ Math.imul(i + 1, 0x51ed270b) | 0) >>> 0)());
        const dd = Math.min(d, R * 0.92);
        const half = Math.sqrt(Math.max(0, R * R - dd * dd)) * 0.9;
        const ux = -Math.sin(beta), uy = Math.cos(beta);
        const bx = cx + Math.cos(beta) * dd, by = cy + Math.sin(beta) * dd;
        const pts = [];
        for (let s = 0; s <= S; s++) {
          const t = s / S * 2 - 1;
          const w = e * R * 0.35 * Math.sin(k * Math.PI * t + copyMeta[i].phi) + wob(t * Math.PI, i) * 0.5;
          pts.push([bx + ux * t * half + ux * w, by + uy * t * half + uy * w]);
        }
        pushCurve(pts, false, accentF > 0 && copyMeta[i].pick < accentF ? layer2 : layer, false);
      }
    } else if (mode === "Spiral") {
      const turns = Math.max(2, Math.min(60, Math.round(N * 0.5)));
      const m0 = copyMeta[0];
      const pts = [];
      for (let s = 0; s <= S; s++) {
        const th = (s / S) * turns * Math.PI * 2;
        const shrink = 1 - (th / (turns * Math.PI * 2)) * 0.88;
        const r = R * shrink * (1 - e * Math.cos(k * th + m0.phi)) + wob(th, 0);
        const a = th + rot;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      pushCurve(pts, false, layer, false);
    } else {
      const weave = mode === "Weave";
      const rings = mode === "Rings";
      for (let i = 0; i < N; i++) {
        const fam = weave ? (i % 2 === 1 ? 1 : -1) : 1;
        const scale = (1 + i * g) * (weave && fam === 1 ? 1.04 : 1);
        const a0 = rot + (Math.PI * 2 * i) / N + copyMeta[i].delta + (weave && fam === 1 ? Math.PI / k : 0);
        const pen = accentF > 0 && copyMeta[i].pick < accentF ? layer2 : layer;
        const pts = new Array(S);
        for (let s = 0; s < S; s++) {
          const th = (s / S) * Math.PI * 2;
          const base = rings ? (1 + 0.6 * e * Math.cos(k * th + copyMeta[i].phi)) : (1 - e * fam * Math.cos(k * th + copyMeta[i].phi));
          const r = R * scale * base + wob(th, i);
          const a = th + a0;
          pts[s] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        }
        pushCurve(pts, true, pen, false);
      }
    }

    // Point budget: thin the densest curves before any other compromise.
    const total = () => paths.reduce((n, pa) => n + pa.pts.length, 0);
    for (let pass = 0; pass < 8 && total() > 110000; pass++) {
      for (const pa of paths) {
        if (pa.pts.length > 3) {
          const out = [pa.pts[0]];
          for (let s = 2; s < pa.pts.length - 1; s += 2) out.push(pa.pts[s]);
          out.push(pa.pts[pa.pts.length - 1]);
          pa.pts = out;
        }
      }
    }
    while (total() > 110000 && paths.length > 2) paths.pop();

    return applyStyle({ paths }, ins[0]);
  },
};
