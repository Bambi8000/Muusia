({
  key: "squiggle",
  name: "Squiggle",
  cat: "mod",
  group: "deform",
  desc: "Replaces each line with a waveform travelling along it in the path's own frame. Loops draws overlapping pen coils (trochoid - loops appear when Amplitude x 2pi exceeds Period); Sine, Triangle and Square are classic waves; Seismic is seeded noise bursts between calm stretches; Glitch holds quantized offset steps that jump every period. On closed paths the period snaps so whole cycles fit and the seam stays continuous. Compare Zigzag's Spine input: that draws wave ROWS around a path, this rewrites the line itself.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Waveform", type: "select", options: ["Loops", "Sine", "Triangle", "Square", "Seismic", "Glitch"], def: "Loops" },
    { key: "amp", label: "Amplitude mm", type: "slider", min: 0.3, max: 15, step: 0.1, def: 2.5 },
    { key: "period", label: "Period mm", type: "slider", min: 1.5, max: 60, step: 0.5, def: 7 },
    { key: "levels", label: "Levels (Glitch)", type: "slider", min: 2, max: 9, step: 1, def: 4 },
    { key: "seed", label: "Seed (Seismic/Glitch)", type: "seed", def: 17 },
  ],
  compute(ins, p) {
    const src = ins[0] || EMPTY;
    if (!src.paths.length) return EMPTY;
    const A = Math.max(0.05, p.amp);
    const lam0 = Math.max(1, p.period);
    const TWO = Math.PI * 2;
    const out = [];
    const BUDGET = 118000;
    let total = 0;
    src.paths.forEach((pa, pi) => {
      const L = pathLength(pa.pts, pa.closed);
      if (pa.pts.length < 2 || L < lam0 * 0.6) {
        out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) });
        return;
      }
      let lam = lam0;
      if (pa.closed) lam = L / Math.max(1, Math.round(L / lam0));
      const step = Math.max(0.25, Math.min(1.2, lam / 14));
      const pts = resample(pa.pts, pa.closed, step);
      const N = pts.length;
      if (N < 4 || total + N > BUDGET) {
        out.push({ ...pa, pts: pa.pts.map((q) => q.slice()) });
        return;
      }
      const dArr = [0];
      for (let i = 1; i < N; i++) dArr.push(dArr[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const qpts = new Array(N);
      for (let i = 0; i < N; i++) {
        const nI = pa.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
        const pI = pa.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
        let tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        const nx = -ty, ny = tx;
        const s = dArr[i];
        const ph = ((s / lam) % 1 + 1) % 1;
        let along = 0, across = 0;
        if (p.mode === "Loops") {
          const t = ph * TWO;
          along = A * Math.sin(t);
          across = A * Math.cos(t);
        } else if (p.mode === "Sine") {
          across = A * Math.sin(ph * TWO);
        } else if (p.mode === "Triangle") {
          across = A * (1 - 4 * Math.abs(ph - 0.5));
        } else if (p.mode === "Square") {
          across = A * (ph < 0.5 ? -1 : 1);
        } else if (p.mode === "Seismic") {
          const raw = (noise2(s / (lam * 0.35), pi * 5.13 + 1.7, p.seed) - 0.5) * 2;
          let burst = (noise2(s / (lam * 5), pi * 11.7 + 2.3, p.seed + 31) - 0.42) / 0.58;
          burst = Math.max(0, Math.min(1, burst));
          burst = burst * burst * (3 - 2 * burst);
          across = A * raw * burst * 1.8;
        } else {
          const seg = Math.floor(s / lam);
          const r = hash2(seg * 7 + 3, pi * 13 + 5, p.seed);
          const lv = Math.max(2, Math.round(p.levels));
          across = A * ((Math.floor(r * lv) / (lv - 1)) * 2 - 1);
        }
        qpts[i] = [pts[i][0] + tx * along + nx * across, pts[i][1] + ty * along + ny * across];
      }
      out.push({ pts: qpts, closed: pa.closed, layer: pa.layer });
      total += N;
    });
    return { paths: out };
  },
})