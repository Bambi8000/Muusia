({
  key: "organicrings",
  name: "Organic Rings",
  cat: "gen",
  group: "organic",
  desc: "Concentric organic rings built from mixed strands — solid wavy lines, beaded dot rings, dashed rings and doubled lines — around a clean hollow center, like an agate slice or dot-art mandala. All rings deform in one shared noise field so they follow each other loosely and drift apart with radius; Bundling clumps rings into tight groups with gaps between. Dots share sets how many rings are beads/dashes vs lines, Merges adds strands that peel off one ring and join the next, Bulges plants knot-like eye distortions where a band of neighboring rings swells together and leaves lens-shaped pockets, and Halo scatters a clumpy dot mist dissolving outward past the outer edge. Pens used cycles ring colors from the base pen — four metallic pens on black paper is the classic. Hole is the empty center fraction.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "size", label: "Size", type: "slider", min: 30, max: 280, step: 1, def: 180 },
    { key: "hole", label: "Hole", type: "slider", min: 0, max: 0.8, step: 0.01, def: 0.3 },
    { key: "rings", label: "Rings", type: "slider", min: 5, max: 60, step: 1, def: 26 },
    { key: "wav", label: "Waviness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "bundling", label: "Bundling", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "dotshare", label: "Dots share", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "dotsize", label: "Dot size mm", type: "slider", min: 0.2, max: 1.2, step: 0.05, def: 0.5 },
    { key: "merges", label: "Merges", type: "slider", min: 0, max: 12, step: 1, def: 4 },
    { key: "bulges", label: "Bulges", type: "slider", min: 0, max: 8, step: 1, def: 3 },
    { key: "bulgesize", label: "Bulge size", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "halo", label: "Halo", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "pens", label: "Pens used", type: "slider", min: 1, max: 12, step: 1, def: 4 },
    { key: "seed", label: "Seed", type: "seed", def: 8 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const TAU = Math.PI * 2;
    const halfMin = Math.min(W, H) / 2 - 2;
    const haloAmt = Math.max(0, Math.min(1, p.halo));
    const nB = Math.max(0, Math.round(p.bulges));
    const bAmp = Math.max(0, Math.min(1.5, p.bulgesize));
    const rOutBase = Math.min(p.size / 2, halfMin / (1 + 0.28 * haloAmt + (nB > 0 ? 0.15 * bAmp : 0)));
    const rIn = rOutBase * Math.max(0, Math.min(0.85, p.hole));
    const wav = Math.max(0, Math.min(1.5, p.wav));
    const bund = Math.max(0, Math.min(1, p.bundling));
    const dotShare = Math.max(0, Math.min(1, p.dotshare));
    const dotR0 = Math.max(0.15, p.dotsize) / 2;
    const pensN = Math.max(1, Math.min(12, Math.round(p.pens)));
    const baseL = Math.round(p.layer);
    const cx = W / 2, cy = H / 2;
    const rng = mulberry32(seed * 7919 + 21);
    const fbm2 = (x, y, s) => noise2(x, y, s) * 0.6 + noise2(x * 2.3 + 5, y * 2.3 + 9, s + 7) * 0.4;

    /* shared coherent wobble: rings follow each other, drifting apart with radius */
    const wob = (a, r) =>
      (fbm2(Math.cos(a) * 2 + 10 + r * 0.012, Math.sin(a) * 2 + r * 0.012, seed * 3 + 1) - 0.5) * 2;
    /* knot bulges: eye distortions that part the rings — rings outside the focal
       radius push outward, rings inside push inward (odd profile dr·exp(-dr²)),
       so the lens opens in both directions. A<0 pinches instead of parting. */
    const brng = mulberry32(seed * 7919 + 77);
    const knots = [];
    for (let k = 0; k < nB; k++) knots.push({
      a: brng() * TAU,
      rho: rIn + (0.15 + brng() * 0.7) * (rOutBase - rIn),
      w: 0.25 + brng() * 0.45,
      h: (0.1 + brng() * 0.2) * (rOutBase - rIn),
      A: (brng() < 0.75 ? 1 : -1) * (0.06 + brng() * 0.08) * rOutBase * bAmp,
    });
    const bulge = (a, rBase) => {
      let d = 0;
      for (const K of knots) {
        let da = Math.abs(a - K.a) % TAU;
        if (da > Math.PI) da = TAU - da;
        const ga = Math.exp(-(da * da) / (K.w * K.w) * 3);
        if (ga < 0.01) continue;
        const dr = (rBase - K.rho) / K.h;
        d += K.A * ga * 2.6 * dr * Math.exp(-dr * dr * 1.25);
      }
      return d;
    };
    const ringR = (a, rBase, gain) =>
      Math.max(rIn * 0.6, rBase + wav * gain * rOutBase * 0.055 * wob(a, rBase) + bulge(a, rBase));

    /* radial placement with bundling */
    const nR = Math.max(2, Math.round(p.rings));
    const baseGap = (rOutBase - rIn) / nR;
    const ringDefs = [];
    let pos = rIn + baseGap * 0.4;
    while (pos < rOutBase && ringDefs.length < 200) {
      const t = rng();
      let type;
      if (t < dotShare) type = rng() < 0.7 ? "dots" : "dash";
      else type = rng() < 0.8 ? "line" : "double";
      const gain = (0.5 + rng()) * (rng() < 0.15 ? 2.2 : 1);
      ringDefs.push({ r: pos, type, gain, L: ((baseL + ringDefs.length % pensN) % 12 + 12) % 12, ph: rng() * TAU });
      let gap = baseGap * (0.35 + rng() * 1.3);
      if (rng() < bund * 0.55) gap *= 0.32;
      pos += Math.max(0.8, gap);
    }
    if (!ringDefs.length) return applyStyle(EMPTY, ins[0]);

    /* budget: scale angular sampling with total work */
    let stepA = 0.8;
    const estPts = ringDefs.reduce((s, rd) => s + (TAU * rd.r) / stepA, 0) + haloAmt * 2500 * 7;
    if (estPts > 105000) stepA *= estPts / 105000;

    const paths = [];
    const dot = (x, y, r, L) => {
      const pts = [];
      for (let q = 0; q < 7; q++) { const a = (q / 7) * TAU; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
      paths.push({ pts, closed: true, layer: L });
    };

    for (const rd of ringDefs) {
      const n = Math.max(24, Math.ceil((TAU * rd.r) / stepA));
      const P = (k) => {
        const a = (k / n) * TAU + rd.ph;
        const r = ringR(a, rd.r, rd.gain);
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, a];
      };
      if (rd.type === "line" || rd.type === "double") {
        const offs = rd.type === "double" ? [-0.4, 0.4] : [0];
        for (const off of offs) {
          const pts = [];
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU + rd.ph;
            const r = ringR(a, rd.r, rd.gain) + off;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: true, layer: rd.L });
        }
      } else if (rd.type === "dots") {
        const dr = dotR0 * (0.8 + rng() * 0.5);
        const nd = Math.max(8, Math.floor((TAU * rd.r) / (dr * 2 * 2.2)));
        for (let k = 0; k < nd; k++) {
          const a = (k / nd) * TAU + rd.ph;
          const r = ringR(a, rd.r, rd.gain);
          dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dr, rd.L);
        }
      } else { /* dash */
        const dashA = (rng() * 4 + 5) * (stepA / rd.r), gapA = dashA * (0.5 + rng() * 0.6);
        let a0 = rd.ph;
        while (a0 < rd.ph + TAU) {
          const a1 = Math.min(rd.ph + TAU, a0 + dashA * 3);
          const pts = [];
          const m = Math.max(2, Math.ceil(((a1 - a0) * rd.r) / stepA));
          for (let k = 0; k <= m; k++) {
            const a = a0 + ((a1 - a0) * k) / m;
            const r = ringR(a, rd.r, rd.gain);
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: false, layer: rd.L });
          a0 = a1 + gapA * 3;
        }
      }
    }

    /* merge strands: peel off ring i, join ring i+1 */
    const nM = Math.max(0, Math.round(p.merges));
    for (let k = 0; k < nM && ringDefs.length > 1; k++) {
      const i = Math.floor(rng() * (ringDefs.length - 1));
      const A = ringDefs[i], B = ringDefs[i + 1];
      const a0 = rng() * TAU, span = 0.35 + rng() * 0.6;
      const pts = [];
      const m = Math.max(8, Math.ceil((span * B.r) / stepA));
      for (let q = 0; q <= m; q++) {
        const t = q / m, a = a0 + span * t;
        const s = t * t * (3 - 2 * t);
        const r = ringR(a, A.r, A.gain) * (1 - s) + ringR(a, B.r, B.gain) * s;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      paths.push({ pts, closed: false, layer: rng() < 0.5 ? A.L : B.L });
    }

    /* halo: clumpy dot mist dissolving outward */
    if (haloAmt > 0) {
      const rTop = ringDefs[ringDefs.length - 1].r;
      const nH = Math.min(3000, Math.round(haloAmt * 2200 * Math.pow(rOutBase / 100, 2)));
      for (let k = 0; k < nH; k++) {
        const a = rng() * TAU, t = Math.pow(rng(), 2.2);
        const clump = noise2(Math.cos(a) * 2.5 + 7 + t, Math.sin(a) * 2.5, seed * 11 + 3);
        if (clump < 0.32 + t * 0.45) continue;
        const r = rTop + 1.5 + t * rOutBase * 0.26 * haloAmt + wob(a, rTop) * 2;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (x < 1 || x > W - 1 || y < 1 || y > H - 1) continue;
        dot(x, y, dotR0 * (0.5 + rng() * 0.6), ((baseL + Math.floor(rng() * pensN)) % 12 + 12) % 12);
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
