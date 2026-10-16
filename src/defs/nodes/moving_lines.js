import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
  key: "moving_lines", name: "Moving Lines", cat: "gen", group: "organic",
  desc: "A field of moving open lines. Streaks sends repeated line segments along parallel tracks; Continuous draws complete tracks. Wave amplitude 0 keeps every track perfectly straight. Raise it for travelling waves; Wavelength sets their spacing and Row phase staggers neighbouring tracks. Angle turns the entire field before clipping to the paper margin. Direction selects forward, reverse or alternating rows. Length variation and Stagger use a fixed Seed, so the same tracks and offsets return on every loop. Time source Timeline follows ANIMATE Play directly; Cycles is an integer number of loops in the exported sequence. Manual ignores ANIMATE and uses Phase degrees, which also accepts Frame rot degrees through its green port. The final frame is one step before the first, without a duplicated endpoint. Line length and Gap are measured along each curved track. Every output path is open: no circles, eyes or filled shapes. Pen applies to all lines. Dense requests adapt sampling, wavelength and segment spacing across the whole field within a fixed work budget, rather than dropping the last rows. Margin clips every frame without refitting it. Try 48 frames, 90 lines, Length 45 mm, Gap 18 mm and Amplitude 0 for a straight moving field.",
  ins: [], outs: [Pin("paths")],
  params: [
    { key: "lineStyle", label: "Lines", type: "select", options: ["Streaks", "Continuous"], def: "Streaks" },
    { key: "rows", label: "Tracks", type: "slider", min: 4, max: 240, step: 1, def: 90 },
    { key: "angle", label: "Angle °", type: "slider", min: 0, max: 180, step: 1, def: 0 },
    { key: "length", label: "Line length mm", type: "slider", min: 2, max: 400, step: 1, def: 45, showIf: p => p.lineStyle !== "Continuous" },
    { key: "gap", label: "Gap mm", type: "slider", min: 1, max: 100, step: .5, def: 18, showIf: p => p.lineStyle !== "Continuous" },
    { key: "variation", label: "Length variation %", type: "slider", min: 0, max: 80, step: 1, def: 40, showIf: p => p.lineStyle !== "Continuous" },
    { key: "stagger", label: "Stagger %", type: "slider", min: 0, max: 100, step: 1, def: 100, showIf: p => p.lineStyle !== "Continuous" },
    { key: "amplitude", label: "Wave amplitude mm", type: "slider", min: 0, max: 30, step: .1, def: 0 },
    { key: "wavelength", label: "Wavelength mm", type: "slider", min: 10, max: 300, step: 1, def: 90, showIf: p => p.amplitude > 0 },
    { key: "rowPhase", label: "Row phase °", type: "slider", min: -180, max: 180, step: 1, def: 6, showIf: p => p.amplitude > 0 },
    { key: "direction", label: "Direction", type: "select", options: ["Forward", "Reverse", "Alternating"], def: "Forward", showIf: p => p.lineStyle !== "Continuous" || p.amplitude > 0 },
    { key: "clock", label: "Time source", type: "select", options: ["Timeline", "Manual"], def: "Timeline", showIf: p => p.lineStyle !== "Continuous" || p.amplitude > 0 },
    { key: "cycles", label: "Cycles", type: "slider", min: 1, max: 12, step: 1, def: 1, showIf: p => (p.lineStyle !== "Continuous" || p.amplitude > 0) && p.clock !== "Manual" },
    { key: "phase", label: "Phase °", type: "slider", min: 0, max: 360, step: .5, def: 0, showIf: p => p.lineStyle !== "Continuous" || p.amplitude > 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "seed", label: "Seed", type: "seed", def: 61, showIf: p => p.lineStyle !== "Continuous" && (p.variation > 0 || p.stagger > 0) },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const W = Number.isFinite(+ctx.W) ? Math.max(0, Math.min(10000, +ctx.W)) : 0;
    const H = Number.isFinite(+ctx.H) ? Math.max(0, Math.min(10000, +ctx.H)) : 0;
    const m = Math.max(0, Math.min(Number.isFinite(+p.margin) ? +p.margin : 15, Math.min(W, H) / 2));
    return W > 2 * m && H > 2 * m ? [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }] : [];
  },
  compute(ins, p, ctx) {
    const num = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback));
    const W = num(ctx.W, 0, 0, 10000), H = num(ctx.H, 0, 0, 10000);
    const m = num(p.margin, 15, 0, Math.min(W, H) / 2), w = W - 2 * m, h = H - 2 * m;
    if (w < .01 || h < .01) return EMPTY;
    const rows = Math.round(num(p.rows, 90, 4, 240)), amp = num(p.amplitude, 0, 0, 30);
    const angle = num(p.angle, 0, -1e9, 1e9) % 360 * Math.PI / 180;
    const snap = v => Math.abs(v) < 1e-12 ? 0 : v;
    const cs = snap(Math.cos(angle)), sn = snap(Math.sin(angle));
    const U = (Math.abs(cs) * w + Math.abs(sn) * h) / 2, V = (Math.abs(sn) * w + Math.abs(cs) * h) / 2;
    const maxSeg = Math.max(16, Math.floor(40000 / rows) - 1);
    const wavelength = Math.max(num(p.wavelength, 90, 10, 300), 2 * U * 16 / maxSeg);
    const segments = amp > 0 ? Math.min(maxSeg, Math.max(16, Math.ceil(Math.max(2 * U / 1.5, 2 * U / wavelength * 24)))) : 1;
    const frames = Math.floor(num(ctx.frameCount, 1, 1, 100000)), index = Math.floor(num(ctx.frameIdx, 0, 0, frames - 1));
    const cycles = p.clock === "Manual" ? 0 : Math.round(num(p.cycles, 1, 1, 12));
    const phase = ((num(p.phase, 0, -1e9, 1e9) / 360 + cycles * index / frames) % 1 + 1) % 1;
    const rowPhase = num(p.rowPhase, 6, -180, 180) * Math.PI / 180;
    const rng = mulberry32(Math.round(num(p.seed, 61, -2147483648, 2147483647)) | 0);
    const layer = Math.round(num(p.layer, 0, 0, 11)), paths = [];
    // Liang–Barsky clips rotated/wavy pieces exactly, without changing scale.
    const clip = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1]; let lo = 0, hi = 1;
      for (const [v, q] of [[-dx, a[0] - m], [dx, W - m - a[0]], [-dy, a[1] - m], [dy, H - m - a[1]]]) {
        if (Math.abs(v) < 1e-14) { if (q < -1e-9) return null; }
        else { const t = q / v; if (v < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); if (lo > hi) return null; }
      }
      return [lo, hi].map(t => [Math.max(m, Math.min(W - m, a[0] + dx * t)), Math.max(m, Math.min(H - m, a[1] + dy * t))]);
    };
    const emit = pts => {
      let run = [];
      const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer }); run = []; };
      for (let i = 1; i < pts.length; i++) {
        const q = clip(pts[i - 1], pts[i]);
        if (!q || Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) < 1e-9) { flush(); continue; }
        if (run.length && Math.hypot(run.at(-1)[0] - q[0][0], run.at(-1)[1] - q[0][1]) > 1e-7) flush();
        if (!run.length) run.push(q[0]); run.push(q[1]);
      }
      flush();
    };
    const lengthBound = 2 * U * Math.sqrt(1 + (amp * Math.PI * 2 / wavelength) ** 2);
    const minimumPeriod = lengthBound / Math.max(1, Math.floor(10000 / rows));
    for (let row = 0; row < rows; row++) {
      const r1 = rng(), r2 = rng(), dir = p.direction === "Reverse" || p.direction === "Alternating" && row % 2 ? -1 : 1;
      const v = -V + (row + .5) / rows * 2 * V, pts = [], cum = [0];
      for (let j = 0; j <= segments; j++) {
        const u = -U + j / segments * 2 * U;
        const off = amp * snap(Math.sin(u / wavelength * Math.PI * 2 + row * rowPhase - phase * Math.PI * 2 * dir));
        const point = [W / 2 + u * cs - (v + off) * sn, H / 2 + u * sn + (v + off) * cs];
        if (j) cum.push(cum.at(-1) + Math.hypot(point[0] - pts.at(-1)[0], point[1] - pts.at(-1)[1]));
        pts.push(point);
      }
      if (p.lineStyle === "Continuous") { emit(pts); continue; }
      const dash = num(p.length, 45, 2, 400) * (1 + (r1 * 2 - 1) * num(p.variation, 40, 0, 80) / 100);
      const requested = dash + num(p.gap, 18, 1, 100), period = Math.max(requested, minimumPeriod), on = dash / requested * period;
      const offset = ((r2 * num(p.stagger, 100, 0, 100) / 100 + phase * dir) % 1 + 1) % 1 * period;
      const at = d => {
        let a = 0, b = cum.length - 1;
        while (b - a > 1) { const c = (a + b) >> 1; if (cum[c] <= d) a = c; else b = c; }
        const t = (d - cum[a]) / (cum[b] - cum[a] || 1);
        return pts[a].map((v, k) => v + (pts[b][k] - v) * t);
      };
      for (let start = offset - period; start < cum.at(-1); start += period) {
        const a = Math.max(0, start), b = Math.min(cum.at(-1), start + on);
        if (b - a < 1e-8) continue;
        const piece = [at(a)];
        for (let j = 1; j < pts.length - 1; j++) if (cum[j] > a && cum[j] < b) piece.push(pts[j]);
        piece.push(at(b)); emit(piece);
      }
    }
    return { paths };
  },
};
