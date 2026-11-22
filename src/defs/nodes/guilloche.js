import { Pin, EMPTY, applyStyle } from "../helpers.js";
import { guillocheFamily } from "../guilloche-family.js";

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

    // Complete unclipped family from the shared banknote mathematics, then the
    // node's own sheet clipping, pen mapping and budget policy on top.
    const fam = guillocheFamily({ mode, waves: k, copies: N, amplitude: e, growth: g, jitter: jit, angle: rot, seed, R, cx, cy, accent: accentF });
    for (const f of fam) {
      pushCurve(f.pts, f.closed, f.slot === 1 ? layer2 : layer, false);
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
