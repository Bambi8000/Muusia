({
  key: "spore_print",
  name: "Spore Print",
  cat: "gen",
  group: "nature",
  desc: "Mushroom spore prints: the radial gill pattern a cap leaves on paper overnight. Gills follow real lamellula anatomy \u2014 a few primaries run from the blank stem disc to the rim, and shorter tiers spawn in the widening gaps so line spacing stays even (Gap sets it, Primaries the innermost count). Wobble bends the lines hand-dusted, Swirl twists the whole print, Edge makes the cap rim irregular. Fade breaks lines into a dusty falloff that strengthens toward the rim, Dust scatters spore specks between the gills, and Rim band adds a dense tick ring at the very edge. Count drops several caps on one sheet with varied sizes, like a real spore-print collection. Tip: two overlapping prints on different pens with Transparent-style layering reads like a double drop.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Prints", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "size", label: "Cap radius", type: "slider", min: 15, max: 90, step: 1, def: 55 },
    { key: "hole", label: "Stem radius", type: "slider", min: 2, max: 30, step: 0.5, def: 7 },
    { key: "prim", label: "Primaries", type: "slider", min: 8, max: 60, step: 1, def: 24 },
    { key: "gap", label: "Gap", type: "slider", min: 1, max: 6, step: 0.1, def: 2.2 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "swirl", label: "Swirl", type: "slider", min: -60, max: 60, step: 1, def: 8 },
    { key: "edgeVar", label: "Edge", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "fade", label: "Fade", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "dust", label: "Dust", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "rim", label: "Rim band", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "seed", label: "Seed", type: "seed", def: 4 },
    { key: "cx", label: "Center X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Center Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "dustPen", label: "Dust pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const { W, H } = ctx;
    const n = Math.max(1, Math.round(p.count));
    const g = [];
    if (n === 1) {
      const X = (W * p.cx) / 100, Y = (H * p.cy) / 100;
      g.push({ kind: "circle", cx: X, cy: Y, r: Math.max(2, p.size) });
      g.push({ kind: "circle", cx: X, cy: Y, r: Math.max(1, Math.min(p.hole, p.size - 2)) });
    } else {
      const m = Math.max(0, p.margin);
      g.push({ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m });
    }
    return g;
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed);
    const nP = Math.max(1, Math.round(p.count));
    const m = Math.max(0, p.margin);
    const lox = m, loy = m, hix = W - m, hiy = H - m;
    if (hix - lox < 10 || hiy - loy < 10) return EMPTY;
    const pen = Math.round(p.layer) % PENS.length;
    const dustPen = Math.round(p.dustPen) % PENS.length;
    const paths = [];
    let budget = 112000;
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed, layer });
    };

    /* ---------- print placement ---------- */
    const rng = mulberry32(seed * 7919 + 13);
    const prints = [];
    if (nP === 1) {
      const R = Math.max(6, Math.min(p.size, (Math.min(hix - lox, hiy - loy) / 2) - 1));
      prints.push({
        x: Math.min(hix - R, Math.max(lox + R, (W * p.cx) / 100)),
        y: Math.min(hiy - R, Math.max(loy + R, (H * p.cy) / 100)),
        R, k: 0,
      });
    } else {
      for (let i = 0; i < nP; i++) {
        const R = Math.max(6, p.size * (0.55 + 0.4 * rng()));
        let best = null;
        for (let t = 0; t < 70; t++) {
          const x = lox + R + rng() * Math.max(1, hix - lox - 2 * R);
          const y = loy + R + rng() * Math.max(1, hiy - loy - 2 * R);
          let ok = true;
          for (const q of prints)
            if (Math.hypot(q.x - x, q.y - y) < (q.R + R) * 0.92) { ok = false; break; }
          if (ok) { best = [x, y]; break; }
          if (!best) best = [x, y];
        }
        prints.push({ x: best[0], y: best[1], R, k: i });
      }
    }

    /* ---------- one print ---------- */
    for (const P of prints) {
      if (budget <= 0) break;
      const R = P.R;
      const hole = Math.max(1.5, Math.min(p.hole * (R / Math.max(1, p.size)), R * 0.6));
      const swirl = (p.swirl * Math.PI) / 180;
      const sK = seed + P.k * 131;
      // irregular cap edge, smooth and periodic via circle-embedded noise
      const edgeR = (a) => R * (1 + (noise2(Math.cos(a) * 1.8 + 7, Math.sin(a) * 1.8 + 7, sK) - 0.5)
        * 0.3 * p.edgeVar);

      /* gills: binary lamellula hierarchy. generation g >= 1 starts where the
         arc gap of the previous generation reaches 2 x Gap. */
      const N0 = Math.max(4, Math.round(p.prim));
      const gills = [];
      for (let i = 0; i < N0; i++)
        gills.push({ a: (i / N0) * Math.PI * 2, r0: hole, gi: i });
      let gen = 1, total = N0;
      for (;;) {
        const rStart = (p.gap * N0 * Math.pow(2, gen - 1)) / Math.PI;
        if (rStart >= R * 1.05 || total > 4000) break;
        const cnt = N0 * Math.pow(2, gen - 1);
        const pitch = (Math.PI * 2) / cnt;
        for (let i = 0; i < cnt; i++) {
          const a = i * pitch + pitch / 2;
          const j = hash2(gen * 977 + i, P.k, sK);
          gills.push({ a, r0: Math.max(hole + 0.5, rStart * (0.85 + 0.3 * j)), gi: total + i });
        }
        total += cnt;
        gen++;
      }

      const latAmp = p.wobble * 1.3; // lateral waviness in mm
      for (const g of gills) {
        if (budget <= 0) break;
        const hEnd = hash2(g.gi, 3 + P.k, sK);
        const rEnd = Math.min(edgeR(g.a) * (1 - p.fade * 0.22 * hEnd), R * 1.2);
        if (rEnd - g.r0 < 1.5) continue;
        // walk outward in dropout chunks (fade strengthens toward the rim)
        let run = [];
        const flush = () => {
          if (run.length >= 2 && pathLength(run, false) > 0.9) push(run, false, pen);
          run = [];
        };
        let cPos = 0, cLen = 0, cKeep = true;
        for (let r = g.r0; r <= rEnd; r += 1.0) {
          if (cPos >= cLen) {
            const t = (r - hole) / Math.max(1, R - hole);
            const h = hash2(Math.round(r * 2), g.gi, sK + 51);
            cLen = 3 + Math.floor(h * 9);
            cKeep = hash2(g.gi, Math.round(r), sK + 77) >
              p.fade * (0.15 + 0.75 * t * t);
            cPos = 0;
            if (!cKeep) flush();
          }
          cPos++;
          if (!cKeep) continue;
          const t = (r - hole) / Math.max(1, R - hole);
          const th = g.a + swirl * t +
            ((noise2(r * 0.09, g.gi * 0.37, sK + 5) - 0.5) * 2 * latAmp) / Math.max(2, r);
          run.push([P.x + Math.cos(th) * r, P.y + Math.sin(th) * r]);
        }
        flush();
      }

      /* rim band: dense short ticks hugging the irregular edge */
      if (p.rim > 0.02) {
        const cnt = Math.round(((Math.PI * 2 * R) / (p.gap * 0.7)));
        for (let i = 0; i < cnt && budget > 0; i++) {
          if (hash2(i, 9 + P.k, sK) > p.rim) continue;
          const a = (i / cnt) * Math.PI * 2 + (hash2(i, 11, sK) - 0.5) * 0.02;
          const re = edgeR(a);
          const len = 2 + hash2(i, 13, sK) * 2.5;
          const pts = [];
          for (let r = re - len; r <= re; r += 0.8)
            pts.push([P.x + Math.cos(a + swirl) * r, P.y + Math.sin(a + swirl) * r]);
          push(pts, false, pen);
        }
      }

      /* spore dust: specks scattered between the gills, mid-to-outer biased */
      if (p.dust > 0.02) {
        const nd = Math.round(p.dust * 380 * (R / 55) * (R / 55));
        const rngD = mulberry32(sK * 419 + 7);
        for (let i = 0; i < nd && budget > 0; i++) {
          const a = rngD() * Math.PI * 2;
          const t = Math.pow(rngD(), 0.55); // bias outward
          const r = hole + 1 + t * (edgeR(a) * 1.04 - hole - 1);
          if (r < hole + 0.8) continue;
          const dx = P.x + Math.cos(a) * r, dy = P.y + Math.sin(a) * r;
          const dr = 0.12 + rngD() * 0.22;
          const pts = [];
          for (let k2 = 0; k2 < 6; k2++) {
            const aa = (k2 / 6) * Math.PI * 2;
            pts.push([dx + Math.cos(aa) * dr, dy + Math.sin(aa) * dr]);
          }
          push(pts, true, dustPen);
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
