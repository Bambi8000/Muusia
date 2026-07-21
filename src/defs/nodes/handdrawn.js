import { Pin, EMPTY, mulberry32, noise2, resample } from "../helpers.js";

export default {
  key: "handdrawn",
    name: "Hand Drawn",
    cat: "mod",
    group: "deform",
    desc: "Makes any line look drawn by hand: smooth low-frequency wobble across the stroke, fine tremor on top, optional ink breaks (the pen skips), and end overshoot / fall-short so strokes don't stop exactly where they should. Every path wobbles differently (own sub-seed), so parallel lines live like a real sketch. Unlike Jitter (raw point noise), the wobble runs along the stroke's own arc length.",
    ins: [Pin("paths", "Paths")],
    outs: [Pin("paths")],
    params: [
      { key: "wobble", label: "Wobble mm", type: "slider", min: 0, max: 8, step: 0.1, def: 1.2 },
      { key: "waveLen", label: "Wave length mm", type: "slider", min: 5, max: 120, step: 1, def: 30 },
      { key: "tremor", label: "Tremor mm", type: "slider", min: 0, max: 2, step: 0.05, def: 0.15 },
      { key: "breaks", label: "Ink breaks", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "gap", label: "Break gap mm", type: "slider", min: 0.5, max: 12, step: 0.5, def: 2.5 },
      { key: "ends", label: "End overshoot mm", type: "slider", min: -6, max: 10, step: 0.5, def: 1.5 },
      { key: "seed", label: "Seed", type: "seed", def: 3 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const WL = Math.max(3, p.waveLen);
      const step = Math.max(0.6, Math.min(2, WL / 8));
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const cl = (x, lim) => Math.max(0.5, Math.min(lim - 0.5, x));
      src.paths.forEach((pa, pi) => {
        if (pa.pts.length < 2) return;
        const sd = (p.seed * 977 + pi * 131) | 0;
        const rng = mulberry32(sd);
        let pts = resample(pa.pts, pa.closed, step);
        if (pts.length < 2) return;
        const closed = !!pa.closed;
        /* ends: extend or shorten open strokes (each end its own amount) */
        if (!closed && Math.abs(p.ends) > 0.01) {
          const extend = (arr, head) => {
            const amt = p.ends * (0.35 + rng() * 0.65);
            if (amt > 0.05) {
              const a = head ? arr[0] : arr[arr.length - 1];
              const b = head ? arr[1] : arr[arr.length - 2];
              const dx = a[0] - b[0], dy = a[1] - b[1];
              const L = Math.hypot(dx, dy) || 1;
              const n = Math.max(1, Math.round(amt / step));
              for (let k = 1; k <= n; k++) {
                const q = [a[0] + (dx / L) * step * k, a[1] + (dy / L) * step * k];
                head ? arr.unshift(q) : arr.push(q);
              }
            } else if (amt < -0.05) {
              const drop = Math.min(arr.length - 2, Math.round(-amt / step));
              for (let k = 0; k < drop; k++) head ? arr.shift() : arr.pop();
            }
          };
          extend(pts, false);
          extend(pts, true);
        }
        const n = pts.length;
        /* arclength per point */
        const S = new Float32Array(n);
        for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const totalLen = S[n - 1] || 1;
        const ph = rng() * 100; /* per-path noise phase */
        /* displaced points: wobble + tremor along the local normal */
        const disp = [];
        for (let i = 0; i < n; i++) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
          let tx = pts[i1][0] - pts[i0][0], ty = pts[i1][1] - pts[i0][1];
          const tl = Math.hypot(tx, ty) || 1;
          const nx = -ty / tl, ny = tx / tl;
          const u = S[i] / WL + ph;
          let w = (noise2(u, ph, sd) - 0.5) * 2 * p.wobble;
          w += (noise2(u * 6.3, ph + 7, sd + 1) - 0.5) * 2 * p.tremor;
          /* closed seam continuity: crossfade the last stretch toward the start value */
          if (closed && totalLen > 0) {
            const t = S[i] / totalLen;
            if (t > 0.85) {
              const u0 = 0 / WL + ph;
              let w0 = (noise2(u0, ph, sd) - 0.5) * 2 * p.wobble;
              w0 += (noise2(u0 * 6.3, ph + 7, sd + 1) - 0.5) * 2 * p.tremor;
              const f = (t - 0.85) / 0.15;
              w = w * (1 - f) + w0 * f;
            }
          }
          disp.push([cl(pts[i][0] + nx * w, W), cl(pts[i][1] + ny * w, H)]);
        }
        /* ink breaks: split into dashes with gaps */
        if (p.breaks > 0.001 && p.gap > 0.05) {
          const runs = [];
          let run = [disp[0]];
          /* expected breaks: up to ~1 per 25mm at breaks=1 */
          let nextBreak = 15 + rng() * 60 / (p.breaks + 0.05);
          let sAcc = 0, gapLeft = 0;
          for (let i = 1; i < n; i++) {
            const ds = S[i] - S[i - 1];
            sAcc += ds;
            if (gapLeft > 0) {
              gapLeft -= ds;
              if (gapLeft <= 0) run = [disp[i]];
              continue;
            }
            run.push(disp[i]);
            if (sAcc >= nextBreak) {
              if (run.length > 1) runs.push(run);
              gapLeft = p.gap * (0.5 + rng());
              nextBreak = sAcc + gapLeft + (8 + rng() * 55) / (p.breaks + 0.05);
              run = [];
            }
          }
          if (run.length > 1) runs.push(run);
          for (const r of runs) {
            if (total + r.length > BUDGET) break;
            total += r.length;
            out.push({ pts: r, closed: false, layer: pa.layer });
          }
        } else {
          if (total + disp.length > BUDGET) return;
          total += disp.length;
          out.push({ pts: disp, closed, layer: pa.layer });
        }
      });
      return { paths: out };
    }
  
};
