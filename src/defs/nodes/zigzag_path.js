import { Pin, noise2, resample, pathLength } from "../helpers.js";

export default {
  /* Zigzag Path — a deform modifier that redraws every input path as a
     zigzag, sine or serpentine coil stroke following the original spine.
     The wave rides an integrated phase (so Vary wavelength stretches and
     squeezes periods smoothly via seeded noise along the arc length, never
     jumping), Vary amp breathes the width the same way, and Fade mm ramps
     open strokes smoothly in and out at both ends - in Coil the runs shrink
     toward the tips. On closed paths the drift is sampled on a noise-space
     circle so it wraps without a seam. Zigzag apex points
     are inserted analytically at exact phase crossings so the corners stay
     sharp regardless of sampling. Coil builds perpendicular runs joined by
     semicircular U-turns (pitch = half the wavelength), like a tight
     serpentine fill along the line. Closed paths snap to whole periods so
     the pattern wraps seamlessly. Output inherits each path's pen. */
  key: "zigzag_path",
  name: "Zigzag Path",
  cat: "mod",
  group: "deform",
  desc: "Redraws every input path as a patterned stroke that follows the original line. Mode: Zigzag (sharp triangle wave, apexes exact), Sine (smooth wave) or Coil (dense serpentine - straight perpendicular runs joined by rounded U-turns, pitch = half the Wavelength). Amplitude is the half-width in mm. Vary amp and Vary wavelength add seeded organic drift, smoothly along the line over the Vary length scale - never per-vertex jitter, so the result reads as hand movement rather than noise. Phase shifts the pattern along the path, Fade mm ramps open strokes smoothly in and out at both ends (in Coil the runs shrink toward the tips), and closed paths snap to whole periods with seamlessly wrapping drift - no seam, no jump. Each path keeps its own pen; Keep source draws the original spine too. Chain tip: Grid or Parallel Lines through Coil gives dense woven fills; Zen Garden rings through Zigzag turn into rippling gravel.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Zigzag", "Sine", "Coil"], def: "Zigzag" },
    { key: "wl", label: "Wavelength mm", type: "slider", min: 1, max: 30, step: 0.5, def: 5 },
    { key: "amp", label: "Amplitude mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 4 },
    { key: "varyamp", label: "Vary amp", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "varywl", label: "Vary wavelength", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "varylen", label: "Vary length mm", type: "slider", min: 5, max: 150, step: 5, def: 40 },
    { key: "phase", label: "Phase", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "fade", label: "Fade mm", type: "slider", min: 0, max: 40, step: 1, def: 8 },
    { key: "keepsrc", label: "Keep source", type: "check", def: false },
    { key: "seed", label: "Seed", type: "seed", def: 5 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] && ins[0].paths ? ins[0].paths : [];
    const out = [];
    const BUDGET = 110000;
    let budget = BUDGET;
    const wl = Math.max(1, p.wl);

    src.forEach((path, pi) => {
      if (budget <= 0) return;
      if (path.pts.length < 2) { out.push({ pts: path.pts.map((q) => q.slice()), closed: path.closed, layer: path.layer }); return; }
      const L = pathLength(path.pts, path.closed);
      if (L < 0.5) { out.push({ pts: path.pts.map((q) => q.slice()), closed: path.closed, layer: path.layer }); return; }
      const step = Math.max(0.3, Math.min(1, wl / 12));
      const pts = resample(path.pts, path.closed, step);
      const n = pts.length;
      if (n < 3) { out.push({ pts: path.pts.map((q) => q.slice()), closed: path.closed, layer: path.layer }); return; }
      /* arc positions + unit normals per sample */
      const S = new Float64Array(n);
      for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const Ltot = path.closed ? S[n - 1] + Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : S[n - 1];
      if (Ltot < 0.5) { out.push({ pts: path.pts.map((q) => q.slice()), closed: path.closed, layer: path.layer }); return; }
      const NX = new Float64Array(n), NY = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const a = pts[path.closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
        const b2 = pts[path.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        const tx = b2[0] - a[0], ty = b2[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        NX[i] = -ty / tl; NY[i] = tx / tl;
      }
      /* organic drift: open paths sample noise along the arc, closed paths
         sample it on a circle in noise space so the drift wraps seamlessly */
      const loopQ = Ltot / (2 * Math.PI * Math.max(5, p.varylen));
      const drift = (sm, row) => {
        if (!path.closed) return noise2(sm / p.varylen, row, p.seed) * 2 - 1;
        const u = (2 * Math.PI * sm) / Ltot;
        return noise2(100 + Math.cos(u) * loopQ, row + Math.sin(u) * loopQ, p.seed) * 2 - 1;
      };
      /* smoothstep fade envelope at open-path ends */
      const env = (sv) => {
        if (path.closed || p.fade <= 0) return 1;
        const e = (d2) => { const u = Math.max(0, Math.min(1, d2 / p.fade)); return u * u * (3 - 2 * u); };
        return e(sv) * e(Ltot - sv);
      };
      /* integrated phase with smooth wavelength drift, amp envelope */
      const PH = new Float64Array(n);
      const AM = new Float64Array(n);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        if (i > 0) {
          const sm = (S[i] + S[i - 1]) / 2;
          const wloc = wl * (1 + p.varywl * 0.55 * drift(sm, pi * 7.31 + 11));
          ph += (S[i] - S[i - 1]) / Math.max(0.5, wloc);
        }
        PH[i] = ph;
        const a = 1 + p.varyamp * 0.8 * drift(S[i], pi * 3.17 + 5);
        AM[i] = Math.max(0, p.amp * a * env(S[i]));
      }
      /* closed paths: snap to whole periods for a seamless wrap */
      let phEnd = PH[n - 1];
      if (path.closed) {
        const wrap = phEnd + (Ltot - S[n - 1]) / wl;
        const snap = Math.max(1, Math.round(wrap)) / (wrap || 1);
        for (let i = 0; i < n; i++) PH[i] *= snap;
        phEnd = PH[n - 1];
      }
      const P = p.phase;
      const emit = (arr, closed) => {
        if (arr.length < 2) return;
        budget -= arr.length;
        if (budget < 0) return;
        out.push({ pts: arr, closed, layer: path.layer });
      };

      if (p.mode === "Sine" || p.mode === "Zigzag") {
        const zig = p.mode === "Zigzag";
        const wave = (u) => {
          if (!zig) return Math.sin(2 * Math.PI * u);
          const f = u - Math.floor(u);
          return f < 0.25 ? f * 4 : f < 0.75 ? 2 - f * 4 : f * 4 - 4;
        };
        const o = [];
        let apex = Math.floor(PH[0] + P + 0.25) + 0.25; /* next apex phase (zigzag) */
        for (let i = 0; i < n; i++) {
          if (zig && i > 0) {
            /* insert exact apex points where the phase crosses k+-0.25 */
            while (apex <= PH[i] + P) {
              if (apex > PH[i - 1] + P) {
                const t = (apex - (PH[i - 1] + P)) / ((PH[i] + P) - (PH[i - 1] + P) || 1);
                const ax = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
                const ay = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
                const nx2 = NX[i - 1] + (NX[i] - NX[i - 1]) * t, ny2 = NY[i - 1] + (NY[i] - NY[i - 1]) * t;
                const am = AM[i - 1] + (AM[i] - AM[i - 1]) * t;
                const w2 = wave(apex);
                o.push([ax + nx2 * am * w2, ay + ny2 * am * w2]);
              }
              apex += 0.5;
            }
          }
          const w2 = wave(PH[i] + P);
          const px2 = pts[i][0] + NX[i] * AM[i] * w2, py2 = pts[i][1] + NY[i] * AM[i] * w2;
          const lp = o[o.length - 1];
          if (!lp || Math.abs(lp[0] - px2) > 1e-9 || Math.abs(lp[1] - py2) > 1e-9) o.push([px2, py2]);
        }
        emit(o, path.closed);
      } else {
        /* Coil: perpendicular runs at every half period, semicircular caps */
        const at = (s) => {
          const sc = Math.max(0, Math.min(S[n - 1], s));
          let lo = 0, hi = n - 1;
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= sc) lo = mid; else hi = mid; }
          const t = (sc - S[lo]) / (S[hi] - S[lo] || 1);
          return [
            pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t,
            pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t,
            NX[lo] + (NX[hi] - NX[lo]) * t,
            NY[lo] + (NY[hi] - NY[lo]) * t,
          ];
        };
        const ampAt = (s) => {
          const a = 1 + p.varyamp * 0.8 * drift(s, pi * 3.17 + 5);
          return Math.max(0.08, p.amp * a * env(s));
        };
        /* run positions: phase crossings of k*0.5 (integrated => vary-wl drifts the pitch) */
        const runs = [];
        let k2 = Math.ceil((PH[0] + P) * 2) / 2;
        for (let i = 1; i < n && runs.length < 4000; i++) {
          while (k2 <= PH[i] + P) {
            if (k2 > PH[i - 1] + P) {
              const t = (k2 - (PH[i - 1] + P)) / ((PH[i] + P) - (PH[i - 1] + P) || 1);
              runs.push(S[i - 1] + (S[i] - S[i - 1]) * t);
            }
            k2 += 0.5;
          }
        }
        if (runs.length >= 2) {
          const o = [];
          const put = (s, off) => {
            const [x, y, nx2, ny2] = at(s);
            o.push([x + nx2 * off, y + ny2 * off]);
          };
          for (let ri = 0; ri < runs.length; ri++) {
            const sA = runs[ri];
            const up = ri % 2 === 0 ? 1 : -1;
            const A = ampAt(sA);
            const d = ri + 1 < runs.length ? runs[ri + 1] - sA : 0;
            const r = Math.min(d / 2, A * 0.6);
            put(sA, -up * A);
            put(sA, up * (A - (ri + 1 < runs.length ? r : 0)));
            if (ri + 1 < runs.length && r > 0.05) {
              const B = ampAt(runs[ri + 1]);
              const r2 = Math.min(d / 2, B * 0.6);
              const capSegs = 7;
              for (let cs = 1; cs < capSegs; cs++) {
                const a = (cs / capSegs) * Math.PI;
                const t = cs / capSegs;
                const rr = r + (r2 - r) * t;
                const hh = (A - r) + ((B - r2) - (A - r)) * t;
                put(sA + d / 2 - Math.cos(a) * (d / 2), up * (hh + Math.sin(a) * rr));
              }
            }
            if (budget - o.length < 0) break;
          }
          emit(o, false);
        } else {
          out.push({ pts: path.pts.map((q) => q.slice()), closed: path.closed, layer: path.layer });
        }
      }
      if (p.keepsrc && budget > 0) {
        budget -= path.pts.length;
        if (budget >= 0) out.push({ pts: path.pts.map((q) => q.slice()), closed: path.closed, layer: path.layer });
      }
    });
    return { paths: out };
  },
};
