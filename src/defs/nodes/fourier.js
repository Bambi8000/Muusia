import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
  key: "fourier",
    name: "Fourier",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "harm", label: "Harmonics (wire Frame/LFO)", type: "slider", min: 1, max: 64, step: 1, def: 8 },
      { key: "epi", label: "Draw epicycles", type: "check", def: false },
      { key: "keepOpen", label: "Pass open paths through", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const M = 256;
      const H = Math.max(1, Math.min(Math.floor(M / 2) - 1, Math.floor(p.harm)));
      const paths = [];
      src.paths.forEach((path) => {
        if (!path.closed || path.pts.length < 3) {
          if (p.keepOpen) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        /* uniform M samples of the closed contour */
        const total = pathLength([...path.pts, path.pts[0]], false);
        if (total < 1) return;
        const smp = resample(path.pts, true, total / M);
        const zs = smp.slice(0, M);
        while (zs.length < M) zs.push(zs[zs.length - 1]);
        /* DFT coefficients for n in [-H..H] (elliptic Fourier reconstruction) */
        const coef = [];
        for (let n = -H; n <= H; n++) {
          let re = 0, im = 0;
          for (let k = 0; k < M; k++) {
            const ang = (-2 * Math.PI * n * k) / M;
            const c = Math.cos(ang), s = Math.sin(ang);
            re += zs[k][0] * c - zs[k][1] * s;
            im += zs[k][0] * s + zs[k][1] * c;
          }
          coef.push({ n, re: re / M, im: im / M });
        }
        /* rebuild with the kept harmonics: shape morphs circle -> original */
        const out = [];
        for (let k = 0; k < M; k++) {
          let x = 0, y = 0;
          for (const { n, re, im } of coef) {
            const ang = (2 * Math.PI * n * k) / M;
            const c = Math.cos(ang), s = Math.sin(ang);
            x += re * c - im * s;
            y += re * s + im * c;
          }
          out.push([x, y]);
        }
        paths.push({ pts: out, closed: true, layer: path.layer });
        /* optional epicycle ghost circles: largest terms chained from the center */
        if (p.epi) {
          const terms = coef.filter((t) => t.n !== 0)
            .sort((a, b) => (b.re * b.re + b.im * b.im) - (a.re * a.re + a.im * a.im))
            .slice(0, Math.min(10, 2 * H));
          const c0 = coef.find((t) => t.n === 0) || { re: 0, im: 0 };
          let cxx = c0.re, cyy = c0.im;
          for (const t of terms) {
            const r = Math.hypot(t.re, t.im);
            if (r < 0.5) break;
            const ring = [];
            for (let a = 0; a < 16; a++) {
              const th = (a / 16) * Math.PI * 2;
              ring.push([cxx + Math.cos(th) * r, cyy + Math.sin(th) * r]);
            }
            paths.push({ pts: ring, closed: true, layer: path.layer });
            cxx += t.re; cyy += t.im;
          }
        }
      });
      return { paths };
    }
  
};
