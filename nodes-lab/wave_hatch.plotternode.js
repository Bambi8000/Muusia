({
  key: "wave_hatch",
  name: "Wave Hatch",
  cat: "gen",
  group: "geometric",
  desc: "Wave bands of dense vertical strokes \u2014 the classic hand-hatched textile look where blank wavy seams divide the sheet and every band fills with tight upright lines running seam to seam. The seams are seeded non-crossing noise waves (Band height sets their spacing, Wave amount their swell, Wavelength their rhythm); the white seam channel is pure negative space (Seam gap). Strokes sit at Line pitch, Lean tilts them with the local seam slope so they fan through the crests, and Hand wobble bends each stroke and jitters the pitch for the drawn-by-hand read. Tip: pipe through Brush Z with a gentle sine \u2014 pressure variation across thousands of short strokes is what ink on fabric looks like.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 3 },
    { key: "band", label: "Band height", type: "slider", min: 10, max: 80, step: 0.5, def: 30 },
    { key: "amp", label: "Wave amount", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "wl", label: "Wavelength", type: "slider", min: 20, max: 200, step: 1, def: 75 },
    { key: "pitch", label: "Line pitch", type: "slider", min: 0.8, max: 4, step: 0.05, def: 1.5 },
    { key: "gap", label: "Seam gap", type: "slider", min: 0.4, max: 4, step: 0.05, def: 1.2 },
    { key: "lean", label: "Lean", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "wobble", label: "Hand wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed);
    const m = Math.max(0, p.margin);
    const lox = m, loy = m, hix = W - m, hiy = H - m;
    if (hix - lox < 10 || hiy - loy < 10) return EMPTY;
    const band = Math.max(6, p.band);
    const gap = Math.max(0.2, p.gap);
    const pitch = Math.max(0.6, p.pitch);
    const pen = Math.round(p.layer) % PENS.length;
    const wl = Math.max(10, p.wl);
    // amplitude capped below half spacing minus the channel -> seams never cross
    const A = p.amp * Math.max(0, band / 2 - gap - 0.6) * 0.92;
    const paths = [];
    let budget = 112000;
    const push = (pts) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed: false, layer: pen });
    };

    // seam k curve: stacked noise waves, k = 0 pinned above the top margin
    const nB = Math.ceil((hiy - loy) / band) + 1;
    const seamY = (k, x) =>
      loy + k * band +
      (k <= 0 || k >= nB ? 0
        : A * (noise2(x / wl + k * 4.71, k * 7.13, seed) - 0.5) * 2);
    const slope = (k, x) => (seamY(k, x + 2) - seamY(k, x - 2)) / 4;

    let flip = false;
    for (let k = 0; k < nB; k++) {
      const xJit = (x) => x + (hash2(Math.round(x * 4), k, seed + 5) - 0.5) * pitch * 0.5 * p.wobble;
      for (let x0 = lox + pitch / 2; x0 <= hix - pitch / 4; x0 += pitch) {
        if (budget <= 0) break;
        const x = xJit(x0);
        const yT = seamY(k, x), yB = seamY(k + 1, x);
        const h = yB - yT - 2 * gap;
        if (h < 1) continue;
        const sl = (slope(k, x) + slope(k + 1, x)) / 2;
        const dxT = p.lean * sl * h; // total x drift over the stroke
        const pts = [];
        const n = Math.max(3, Math.ceil(h / 1.0));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          let px = x + dxT * (t - 0.5) +
            (noise2((yT + t * h) * 0.09, x * 0.021 + k, seed + 9) - 0.5) *
              p.wobble * 1.3;
          let py = yT + gap + t * h;
          pts.push([px, py]);
        }
        // keep-test against the actual local seams (tilt and wobble move x,
        // so endpoints must re-clip to the channel at their own x)
        let run = [];
        const flush = () => {
          if (run.length >= 2 && pathLength(run, false) > 1)
            push(flip ? run.reverse() : run);
          run = [];
        };
        for (const q of pts) {
          const ok = q[0] >= lox && q[0] <= hix &&
            q[1] >= seamY(k, q[0]) + gap && q[1] <= seamY(k + 1, q[0]) - gap &&
            q[1] >= loy && q[1] <= hiy;
          if (ok) run.push(q); else flush();
        }
        flush();
        flip = !flip; // serpentine plotting order
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
