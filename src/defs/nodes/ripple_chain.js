import { Pin, EMPTY, mulberry32, noise2, resample, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "ripple_chain",
  name: "Ripple Chain",
  cat: "dec",
  ins: [Pin("paths", "Path"), Pin("paths", "Amplitude"), Pin("style", "Style")],
  outs: [Pin("paths")],
  desc: "Chains of concentric ring clusters strung along the input path like beads - the ripple-field look of overlapping circle stamps. The node walks each path by arc length and stamps a cluster every 2 x radius x Spacing (1 = neighbors touch, below 1 they overlap). Cluster size breathes three ways: a slow seeded Wave along the path (big pools alternating with chains of small rings), a long-tail per-cluster Variation, and - if anything is wired into Amplitude - an envelope sampled from that curve's deviation, so Sound Line's waveform (or any curve) drives the ring sizes along the path. Ring gap sets the spacing between concentric rings, Hollow core leaves the middle empty, Drift shifts each ring's center a touch for the hand-stamped feel, Scatter throws clusters off the path and Satellites sprinkles small companion rings beside the chain. Envelope floor keeps quiet passages visible. The point budget is shared between input paths by arc length, and a path that would overrun its share thins its chain evenly along the whole length - large radii never leave loops or tails blank. Tip: wire Sound Line (Envelope mode) into Amplitude and a Spiral or Wave into Path - the music literally beads onto the line.",
  params: [
    { key: "size", label: "Max radius mm", type: "slider", min: 1, max: 30, step: 0.1, def: 6 },
    { key: "minsize", label: "Min size", type: "slider", min: 0, max: 1, step: 0.01, def: 0.15 },
    { key: "vary", label: "Variation", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "wave", label: "Wave along path", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "spacing", label: "Spacing", type: "slider", min: 0.4, max: 2, step: 0.01, def: 0.85 },
    { key: "gap", label: "Ring gap mm", type: "slider", min: 0.3, max: 3, step: 0.05, def: 0.8 },
    { key: "fill", label: "Hollow core", type: "slider", min: 0, max: 1, step: 0.01, def: 0.1 },
    { key: "drift", label: "Ring drift mm", type: "slider", min: 0, max: 2, step: 0.05, def: 0.3 },
    { key: "scatter", label: "Scatter mm", type: "slider", min: 0, max: 10, step: 0.1, def: 1.5 },
    { key: "satellites", label: "Satellites", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "ampmin", label: "Envelope floor", type: "slider", min: 0, max: 1, step: 0.01, def: 0.1 },
    { key: "seed", label: "Seed", type: "seed", def: 1 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths || !src.paths.length) return applyStyle({ paths: [] }, ins[2]);
    const L = Math.round(p.layer);
    const seed = Math.round(p.seed);
    const size = Math.max(0.5, p.size);
    const minsize = Math.max(0, Math.min(1, p.minsize));
    const vary = Math.max(0, Math.min(1, p.vary));
    const wave = Math.max(0, Math.min(1, p.wave));
    const spacing = Math.max(0.3, p.spacing);
    const gap = Math.max(0.25, p.gap);
    const fill = Math.max(0, Math.min(1, p.fill));
    const drift = Math.max(0, p.drift);
    const scatter = Math.max(0, p.scatter);
    const sat = Math.max(0, Math.min(1, p.satellites));
    const ampmin = Math.max(0, Math.min(1, p.ampmin));

    /* ---- amplitude envelope from the second input: deviation of the longest
       path from its own mean, binned along its dominant axis -> lookup 0..1 ---- */
    let env = null;
    const ampIn = ins[1];
    if (ampIn && ampIn.paths && ampIn.paths.length) {
      let best = null, bestLen = -1;
      for (const ph of ampIn.paths) {
        const l = pathLength(ph.pts, false);
        if (l > bestLen) { bestLen = l; best = ph; }
      }
      if (best && best.pts.length >= 2) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, my = 0, mx = 0;
        for (const [x, y] of best.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          mx += x / best.pts.length; my += y / best.pts.length;
        }
        const horiz = (x1 - x0) >= (y1 - y0);
        const span = horiz ? x1 - x0 : y1 - y0;
        if (span > 1e-6) {
          const BINS = 256;
          env = new Array(BINS).fill(-1);
          let peak = 0;
          for (const [x, y] of best.pts) {
            const t = horiz ? (x - x0) / span : (y - y0) / span;
            const dev = Math.abs(horiz ? y - my : x - mx);
            const b = Math.max(0, Math.min(BINS - 1, Math.floor(t * BINS)));
            if (dev > env[b]) env[b] = dev;
            if (dev > peak) peak = dev;
          }
          if (peak > 1e-6) {
            let last = 0;
            for (let b = 0; b < BINS; b++) {
              if (env[b] < 0) env[b] = last; else { env[b] /= peak; last = env[b]; }
            }
          } else env = null;
        }
      }
    }
    const envAt = (t) => {
      if (!env) return 1;
      const b = Math.max(0, Math.min(env.length - 1, Math.floor(t * env.length)));
      return ampmin + (1 - ampmin) * env[b];
    };

    const out = [];
    const BUDGET = 115000;
    let total = 0;
    let EMIT = true, demand = 0;
    const ring = (cx, cy, r) => {
      if (r < 0.3) return;
      /* arc step grows with radius: big rings plot identically but cost far less */
      const ds = Math.min(1.3, Math.max(0.7, r / 14));
      const n = Math.max(8, Math.ceil((Math.PI * 2 * r) / ds));
      if (!EMIT) { demand += n; return; }
      if (total > BUDGET) return;
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      total += n;
      out.push({ pts, closed: true, layer: L });
    };
    /* one cluster: concentric rings outer->inner, each with its own tiny drift */
    const cluster = (cx, cy, r, rng) => {
      const rIn = Math.max(r * fill, 0.32);
      for (let rr = r; rr >= rIn; rr -= gap) {
        const dx = (rng() - 0.5) * 2 * drift;
        const dy = (rng() - 0.5) * 2 * drift;
        ring(cx + dx, cy + dy, rr);
      }
    };

    /* pre-measure every path so the point budget is shared by arc length -
       long inputs degrade to sparser chains instead of leaving later paths blank */
    const prepped = [];
    let lenAll = 0;
    for (let pi = 0; pi < src.paths.length; pi++) {
      const path = src.paths[pi];
      const pts = resample(path.pts, path.closed, 0.75);
      if (pts.length < 2) continue;
      const cum = [0];
      for (let i = 1; i < pts.length; i++)
        cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const totalLen = cum[cum.length - 1];
      if (totalLen < 1) continue;
      prepped.push({ pi, pts, cum, totalLen });
      lenAll += totalLen;
    }
    if (!lenAll) return applyStyle({ paths: out }, ins[2]);

    for (const { pi, pts, cum, totalLen } of prepped) {
      const myBudget = Math.max(600, Math.floor((BUDGET * totalLen) / lenAll));
      const at = (s) => {
        let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < s) lo = mid + 1; else hi = mid; }
        const i = Math.max(1, lo);
        const seg = cum[i] - cum[i - 1] || 1e-9;
        const t = (s - cum[i - 1]) / seg;
        const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
        const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
        let tx = pts[i][0] - pts[i - 1][0], ty = pts[i][1] - pts[i - 1][1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        return [x, y, tx, ty];
      };

      /* the walk, shared by the dry run and the emit pass; stretch widens the
         step so a path whose demand exceeds its budget share thins out EVENLY
         along its whole length instead of going blank at the tail */
      const walk = (stretch) => {
        let s = 0, ci = 0;
        while (s <= totalLen && total <= BUDGET && ci < 4000) {
          const rng = mulberry32(seed * 7919 + pi * 613 + ci * 31 + 11);
          const t = s / totalLen;
          const nm = (1 - wave) + wave * Math.pow(noise2(s * 0.02, pi * 3.7, seed + 5), 1.6);
          const baseR = size * (minsize + (1 - minsize) * envAt(t) * nm);
          const r = Math.max(0.4, baseR * (1 - vary * 0.85 * Math.pow(rng(), 1.5)));
          const [x, y, tx, ty] = at(Math.min(s, totalLen));
          const off = (rng() - 0.5) * 2 * scatter;
          const cx = x - ty * off, cy = y + tx * off;
          cluster(cx, cy, r, rng);
          if (rng() < sat * 0.4) {
            const sr = Math.max(0.35, r * (0.18 + rng() * 0.25));
            const side = rng() < 0.5 ? 1 : -1;
            const d = r + sr + 0.4 + rng() * 1.5;
            cluster(cx - ty * d * side, cy + tx * d * side, sr, rng);
          }
          s += Math.max(0.8, 2 * r * spacing * stretch);
          ci++;
        }
      };
      EMIT = false; demand = 0;
      walk(1);
      EMIT = true;
      walk(Math.max(1, demand / myBudget));
    }
    return applyStyle({ paths: out }, ins[2]);
  },
};
