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