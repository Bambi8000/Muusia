import { Pin, PENS, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "followlines",
      name: "Follow Lines",
    cat: "gen", group: "organic",
    ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "bands", label: "Bands (no spine)", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "count", label: "Lines per band", type: "slider", min: 3, max: 150, step: 1, def: 50 },
      { key: "step", label: "Line spacing mm", type: "slider", min: 0.3, max: 6, step: 0.05, def: 0.9 },
      { key: "drift", label: "Drift (pinch/fan)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "dscale", label: "Drift scale", type: "slider", min: 0.2, max: 5, step: 0.1, def: 1.2 },
      { key: "smooth", label: "Relax (straighten)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "side", label: "Side", type: "select", options: ["Right", "Left", "Both"], def: "Right" },
      { key: "angle", label: "Base angle ° (no spine)", type: "slider", min: -180, max: 180, step: 1, def: 60 },
      { key: "wave", label: "Base waviness (no spine)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "penPer", label: "Pen per band", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8 },
      { key: "seed", label: "Seed", type: "seed", def: 127 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const paths = [];
      /* --- selkarangat: sisaantulo tai generoidut aaltopohjat --- */
      let spines = [];
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        spines = ins[0].paths.map((q) => resample(q.pts, false, 1.2));
      } else {
        const a = (p.angle * Math.PI) / 180;
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const diag = Math.hypot(W, H) * 1.3;
        const nB = Math.round(p.bands);
        for (let b = 0; b < nB; b++) {
          /* pohjakayrat jaettu poikittaissuunnassa */
          const off = (nB === 1 ? 0 : (b / (nB - 1) - 0.5)) * Math.hypot(W, H) * 0.75;
          const pts = [];
          const nS = Math.round(diag / 1.2);
          for (let i = 0; i <= nS; i++) {
            const t = (i / nS - 0.5) * diag;
            const wob = (noise2(t * 0.012, b * 9.1, p.seed + 17) - 0.5) * p.wave * 90;
            pts.push([
              W / 2 + dx * t + px * (off + wob),
              H / 2 + dy * t + py * (off + wob),
            ]);
          }
          spines.push(pts);
        }
      }
      /* --- leikkaus marginaalisuorakaiteeseen ajossa --- */
      const inside = ([x, y]) => x >= m && x <= W - m && y >= m && y <= H - m;
      const emit = (pts, layer) => {
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer });
          run = [];
        };
        for (const pt of pts) {
          if (inside(pt)) run.push(pt);
          else flush();
        }
        flush();
      };
      /* --- myotailevat viivat: iteratiivinen vaihteleva offset + rentoutus --- */
      const sides = p.side === "Both" ? [1, -1] : p.side === "Left" ? [-1] : [1];
      const nPer = Math.min(200, Math.round(p.count));
      let budget = 120000;
      spines.forEach((base, bi) => {
        const layer = p.penPer ? (Math.round(p.layer) + bi) % PENS.length : Math.round(p.layer);
        for (const s of sides) {
          let cur = base.map((q) => q.slice());
          for (let it = 0; it < nPer && budget > 0; it++) {
            if (it > 0 || s === sides[0]) emit(cur, layer);
            budget -= cur.length;
            const N = cur.length;
            if (N < 3) break;
            /* normaalit */
            const next = new Array(N);
            for (let j = 0; j < N; j++) {
              const jn = Math.min(j + 1, N - 1), jp = Math.max(j - 1, 0);
              const tx = cur[jn][0] - cur[jp][0], ty = cur[jn][1] - cur[jp][1];
              const tl = Math.hypot(tx, ty) || 1;
              /* offset vaihtelee matkalla + iteraatioittain -> nipistykset ja viuhkat */
              const mod = 1 + p.drift * 1.7 * (noise2(j * 0.02 * p.dscale, it * 0.13 + bi * 5, p.seed + 5) - 0.5) * 2;
              const off = p.step * Math.max(0.08, mod) * s;
              next[j] = [cur[j][0] + (-ty / tl) * off, cur[j][1] + (tx / tl) * off];
            }
            /* rentoutus: viivat suoristuvat vahitellen pohjasta poispain */
            if (p.smooth > 0) {
              for (let j = 1; j < N - 1; j++) {
                next[j] = [
                  next[j][0] * (1 - p.smooth * 0.5) + (next[j - 1][0] + next[j + 1][0]) * 0.25 * p.smooth,
                  next[j][1] * (1 - p.smooth * 0.5) + (next[j - 1][1] + next[j + 1][1]) * 0.25 * p.smooth,
                ];
              }
            }
            /* kaanteisten segmenttien siivous (offset-cuspit) */
            const clean = [next[0]];
            for (let j = 1; j < N; j++) {
              const odx = cur[j][0] - cur[j - 1][0], ody = cur[j][1] - cur[j - 1][1];
              const fdx = next[j][0] - clean[clean.length - 1][0], fdy = next[j][1] - clean[clean.length - 1][1];
              if (odx * fdx + ody * fdy > 0) clean.push(next[j]);
            }
            if (clean.length < 3) break;
            /* tasavali sailyy: uudelleennaytteista muutaman iteraation valein */
            cur = it % 4 === 3 ? resample(clean, false, 1.2) : clean;
          }
        }
      });
      return applyStyle({ paths }, ins[1]);
    }
  
};
