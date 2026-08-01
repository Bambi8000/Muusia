({
  key: "fadeout",
  name: "Fade Out",
  cat: "mod",
  group: "penout",
  desc: "Comet tails by lifting the pen SLOWLY while it still moves: the ink starves and the stroke fades out. Encodes a negative Z (millimetres of lift above pen-down) into the point third component; the G-code export turns it into simultaneous Z moves on bed-Z machines (requires the 2.42 export patch - servo profiles ignore it). Fade length ramps the lift inside the last millimetres of each stroke; Tail extension continues the stroke past its end along the exit tangent while lifting - the classic comet look. Ramp shapes: Linear, Soft (smoothstep), Long (pen hugs the paper and lets go late - longest visible tail) and Quick (releases early). Where applies tails to stroke ends, starts, or both; a start fade begins with a touch dot because the export plunges to contact before the first move. Variation jitters tail length and lift per stroke (seeded). Closed paths and strokes shorter than Min length pass through untouched. MUST be last in the chain - downstream modifiers strip the Z data. If Brush Z runs earlier, its pressure survives outside the tail zone; inside it the lift wins.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "where", label: "Where", type: "select", options: ["End", "Start", "Both"], def: "End" },
    { key: "fade", label: "Fade length mm", type: "slider", min: 0, max: 60, step: 0.5, def: 10 },
    { key: "ext", label: "Tail extension mm", type: "slider", min: 0, max: 60, step: 0.5, def: 10 },
    { key: "lift", label: "Lift height mm", type: "slider", min: 0.2, max: 6, step: 0.1, def: 2 },
    { key: "shape", label: "Ramp", type: "select", options: ["Linear", "Soft", "Long", "Quick"], def: "Long" },
    { key: "vary", label: "Variation", type: "slider", min: 0, max: 1, step: 0.01, def: 0.2 },
    { key: "minLen", label: "Min stroke length mm", type: "slider", min: 0, max: 60, step: 0.5, def: 5 },
    { key: "res", label: "Tail sample step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const ramp = (u) => {
      u = Math.max(0, Math.min(1, u));
      if (p.shape === "Soft") return u * u * (3 - 2 * u);
      if (p.shape === "Long") return u * u;
      if (p.shape === "Quick") return Math.sqrt(u);
      return u;
    };
    const rng = mulberry32((Math.round(p.seed) || 1) * 2654435761);
    const jit = () => 1 + (rng() - 0.5) * 2 * Math.max(0, Math.min(1, p.vary));
    const step = Math.max(0.2, p.res);
    const paths = [];

    for (const path of src.paths) {
      /* per-path jitter draws are consumed for EVERY path so toggling one
         parameter never reshuffles the rest (stable variation) */
      const jF = jit(), jE = jit(), jL = jit();
      if (path.closed || path.pts.length < 2) { paths.push(path); continue; }
      /* arc-length table over original points */
      const pts = path.pts;
      const cum = [0];
      for (let i = 1; i < pts.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      }
      const total = cum[cum.length - 1];
      if (total < p.minLen || total < 0.5) { paths.push(path); continue; }

      const fadeF = Math.max(0, p.fade * jF);
      const extF = Math.max(0, p.ext * jE);
      const liftF = Math.max(0.05, p.lift * jL);
      if (fadeF + extF < 0.05) { paths.push(path); continue; }

      const atArc = (s) => {
        s = Math.max(0, Math.min(total, s));
        let lo = 0, hi = cum.length - 1;
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1;
          if (cum[mid] <= s) lo = mid; else hi = mid;
        }
        const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
        return [
          pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f,
          pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f,
          /* carry interpolated Brush Z pressure if present */
          (typeof pts[lo][2] === "number" || typeof pts[hi][2] === "number")
            ? (pts[lo][2] || 0) + ((pts[hi][2] || 0) - (pts[lo][2] || 0)) * f
            : undefined,
        ];
      };
      const doEnd = p.where !== "Start";
      const doStart = p.where !== "End";
      const dom = fadeF + extF;
      const endFadeStart = doEnd ? Math.max(doStart ? total / 2 : 0, total - fadeF) : total;
      const startFadeEnd = doStart ? Math.min(doEnd ? total / 2 : total, fadeF) : 0;

      const out = [];
      const push = (x, y, z) => {
        const q = z === undefined || z === 0 ? [x, y] : [x, y, z];
        out.push(q);
      };
      /* leading extension (Start): approach in the air, land at pts[0] */
      if (doStart && extF > 0.05) {
        const [ax, ay] = pts[0];
        const [bx, by] = atArc(Math.min(total, 1));
        const tl = Math.hypot(bx - ax, by - ay) || 1;
        const ux = (bx - ax) / tl, uy = (by - ay) / tl;
        const nSt = Math.max(1, Math.ceil(extF / step));
        for (let k = nSt; k >= 1; k--) {
          const d = (k / nSt) * extF;
          const u = (startFadeEnd + d) / dom; /* farther out = more lift */
          push(ax - ux * d, ay - uy * d, -liftF * ramp(u));
        }
      }
      /* start fade inside the stroke */
      if (doStart && startFadeEnd > 0.05) {
        for (let s = 0; s < startFadeEnd - 1e-6; s += step) {
          const [x, y, bz] = atArc(s);
          const u = (startFadeEnd - s) / dom;
          push(x, y, -liftF * ramp(u));
        }
      }
      /* untouched middle: original points strictly inside (startFadeEnd, endFadeStart) */
      {
        const [mx, my, mz] = atArc(startFadeEnd);
        push(mx, my, mz);
        for (let i = 0; i < pts.length; i++) {
          if (cum[i] > startFadeEnd + 1e-6 && cum[i] < endFadeStart - 1e-6) out.push(pts[i].slice());
        }
      }
      /* end fade inside the stroke */
      if (doEnd) {
        for (let s = Math.max(startFadeEnd, endFadeStart); s <= total + 1e-6; s += step) {
          const [x, y, bz] = atArc(Math.min(total, s));
          const u = (Math.min(total, s) - endFadeStart) / dom;
          push(x, y, u > 1e-9 ? -liftF * ramp(u) : (bz === undefined ? undefined : bz));
        }
        /* exact original endpoint */
        {
          const u = (total - endFadeStart) / dom;
          push(pts[pts.length - 1][0], pts[pts.length - 1][1], u > 1e-9 ? -liftF * ramp(u) : undefined);
        }
        /* trailing extension along the exit tangent */
        if (extF > 0.05) {
          const [ax, ay] = atArc(Math.max(0, total - 1));
          const [bx, by] = pts[pts.length - 1];
          const tl = Math.hypot(bx - ax, by - ay) || 1;
          const ux = (bx - ax) / tl, uy = (by - ay) / tl;
          const nSt = Math.max(1, Math.ceil(extF / step));
          for (let k = 1; k <= nSt; k++) {
            const d = (k / nSt) * extF;
            const u = (total - endFadeStart + d) / dom;
            push(bx + ux * d, by + uy * d, -liftF * ramp(u));
          }
        }
      } else {
        /* Start-only: keep the original tail of the stroke verbatim */
        for (let i = 0; i < pts.length; i++) {
          if (cum[i] >= endFadeStart - 1e-6 && cum[i] > startFadeEnd + 1e-6) out.push(pts[i].slice());
        }
      }
      /* de-dup consecutive identical points */
      const clean = [out[0]];
      for (let i = 1; i < out.length; i++) {
        const a = clean[clean.length - 1], b = out[i];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6 || (b[2] || 0) !== (a[2] || 0)) clean.push(b);
      }
      paths.push({ pts: clean, closed: false, layer: path.layer });
    }
    return { paths };
  },
})
