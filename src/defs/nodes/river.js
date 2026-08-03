import { Pin, noise2, resample, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "river",
  name: "River",
  cat: "gen",
  group: "nature",
  desc: "Meander-migration solver: a river centerline is resampled, its per-point curvature is measured with an upstream flow-memory lag, and every point migrates toward the outer bank a little each step - bends grow, wander downstream, and when a loop folds back on itself the neck is cut and the abandoned arc is left behind as a closed oxbow lake. All simulated steps stack into one drawing: Steps sets the simulation length, Draw every picks which intermediate channels are inked (the final channel always draws with its own pen). Migration is the erosion speed, Flow memory shifts meanders downstream, Channel width is the neck-cutoff distance, Confinement pulls the river back toward the valley axis. Chain tip: wire Steps or Migration from the Frame clock to animate the river carving itself.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "steps", label: "Steps", type: "slider", min: 10, max: 1200, step: 10, def: 500 },
    { key: "drawEvery", label: "Draw every Nth", type: "slider", min: 1, max: 100, step: 1, def: 12 },
    { key: "skip", label: "Skip first %", type: "slider", min: 0, max: 90, step: 1, def: 0 },
    { key: "rate", label: "Migration", type: "slider", min: 0.1, max: 3, step: 0.05, def: 0.8 },
    { key: "memory", label: "Flow memory", type: "slider", min: 2, max: 60, step: 1, def: 16 },
    { key: "width", label: "Channel width", type: "slider", min: 2, max: 20, step: 0.5, def: 6 },
    { key: "confine", label: "Confinement", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "wobble", label: "Initial wobble", type: "slider", min: 0, max: 12, step: 0.5, def: 2.5 },
    { key: "dir", label: "Direction", type: "select", options: ["Horizontal", "Vertical"], def: "Horizontal" },
    { key: "oxbows", label: "Oxbows", type: "check", def: true },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "History pen", type: "pen", def: 0 },
    { key: "penFinal", label: "Final pen", type: "pen", def: 1 },
    { key: "penOx", label: "Oxbow pen", type: "pen", def: 2 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const vertical = p.dir === "Vertical";
    const W = vertical ? ctx.H : ctx.W;
    const H = vertical ? ctx.W : ctx.H;
    const m = Math.min(Math.max(0, p.margin), Math.min(W, H) / 2 - 4);
    const steps = Math.max(1, Math.min(5000, Math.round(p.steps)));
    const stride = Math.max(1, Math.round(p.drawEvery));
    const width = Math.max(1, p.width);
    const ds = Math.min(3, Math.max(1.2, width / 3));
    const lambda = Math.max(1, p.memory);
    const rate = Math.max(0, p.rate);
    const confine = Math.max(0, Math.min(1, p.confine)) * 0.012;
    const kmax = 1 / Math.max(1.5, width * 0.5);
    const seed = Math.round(p.seed) | 0;

    // --- initial centerline: straight valley axis + seeded wobble ---
    let pts = [];
    const span = Math.max(10, W - 2 * m);
    const n0 = Math.max(8, Math.round(span / ds));
    for (let i = 0; i <= n0; i++) {
      const t = i / n0;
      const edge = Math.min(1, Math.min(t, 1 - t) * 8); // pin wobble at ends
      const w1 = noise2(i * ds * 0.024 + 3.7, seed * 0.618, seed) - 0.5;
      const w2 = noise2(i * ds * 0.009 + 41.2, seed * 1.13 + 9, seed + 101) - 0.5;
      pts.push([m + span * t, H / 2 + (w1 + w2) * 2 * p.wobble * edge]);
    }
    pts = resample(pts, false, ds);

    // upstream exponential kernel (flow memory)
    const L = Math.max(1, Math.min(400, Math.round((lambda * 3) / ds)));
    const wts = [];
    let wsum = 0;
    for (let j = 0; j <= L; j++) { const w = Math.exp((-j * ds) / lambda); wts.push(w); wsum += w; }

    const snapshots = [];
    const oxArcs = [];
    const maxPts = 3000; // river length safety valve

    for (let s = 0; s < steps; s++) {
      const n = pts.length;
      if (n < 5) break;

      // --- signed Menger curvature per point ---
      const k = new Array(n).fill(0);
      for (let i = 1; i < n - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const abx = b[0] - a[0], aby = b[1] - a[1];
        const bcx = c[0] - b[0], bcy = c[1] - b[1];
        const den = Math.hypot(abx, aby) * Math.hypot(bcx, bcy) * Math.hypot(c[0] - a[0], c[1] - a[1]);
        k[i] = den > 1e-9 ? (2 * (abx * bcy - aby * bcx)) / den : 0;
      }

      // --- upstream-weighted curvature (lag shifts meanders downstream) ---
      const kw = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let acc = 0, ws = 0;
        const jm = Math.min(L, i);
        for (let j = 0; j <= jm; j++) { acc += k[i - j] * wts[j]; ws += wts[j]; }
        let v = acc / (ws || wsum);
        if (v > kmax) v = kmax; else if (v < -kmax) v = -kmax;
        kw[i] = v;
      }

      // --- migrate toward the outer bank, taper at pinned ends ---
      const edgeN = Math.max(4, Math.round(26 / ds));
      const cap = ds * 0.8;
      const next = pts.map((q) => q.slice());
      for (let i = 1; i < n - 1; i++) {
        const a = pts[i - 1], c = pts[i + 1];
        let tx = c[0] - a[0], ty = c[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        const e = Math.min(i, n - 1 - i) / edgeN;
        const tpr = e >= 1 ? 1 : e * e * (3 - 2 * e);
        let off = -rate * 5 * kw[i] * tpr;
        if (off > cap) off = cap; else if (off < -cap) off = -cap;
        let x = pts[i][0] - ty * off;
        let y = pts[i][1] + tx * off;
        y += (H / 2 - y) * confine;
        if (x < m) x = m; else if (x > W - m) x = W - m;
        if (y < m) y = m; else if (y > H - m) y = H - m;
        next[i] = [x, y];
      }
      // light diffusion keeps the bank stable
      for (let i = 1; i < n - 1; i++) {
        pts[i] = [
          next[i][0] * 0.98 + (next[i - 1][0] + next[i + 1][0]) * 0.01,
          next[i][1] * 0.98 + (next[i - 1][1] + next[i + 1][1]) * 0.01,
        ];
      }
      pts[0] = next[0]; pts[n - 1] = next[n - 1];
      pts = resample(pts, false, ds);
      if (pts.length > maxPts) pts = resample(pts, false, (pathLength(pts, false) / maxPts) * 1.01);

      // --- neck cutoff via uniform grid (shortest-path step) ---
      const neckArc = Math.max(width * 4, 16);
      const minSep = Math.ceil(neckArc / ds);
      let cutAgain = true;
      while (cutAgain) {
        cutAgain = false;
        const cell = Math.max(width, 1);
        const grid = new Map();
        for (let i = 0; i < pts.length; i++) {
          const gk = Math.floor(pts[i][0] / cell) * 100003 + Math.floor(pts[i][1] / cell);
          const b = grid.get(gk); if (b) b.push(i); else grid.set(gk, [i]);
        }
        let ci = -1, cj = -1, best = width;
        for (let i = 0; i < pts.length; i++) {
          const gx = Math.floor(pts[i][0] / cell), gy = Math.floor(pts[i][1] / cell);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const b = grid.get((gx + ox) * 100003 + (gy + oy));
            if (!b) continue;
            for (const j of b) {
              if (j - i < minSep) continue;
              const d = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
              if (d < best) { best = d; ci = i; cj = j; }
            }
          }
        }
        if (ci >= 0) {
          const arc = pts.slice(ci, cj + 1).map((q) => q.slice());
          oxArcs.push({ s, pts: arc });
          pts = pts.slice(0, ci + 1).concat(pts.slice(cj));
          pts = resample(pts, false, ds);
          cutAgain = pts.length >= minSep + 2;
        }
      }

      const skipTo = steps * Math.max(0, Math.min(95, p.skip)) / 100;
      if (s >= skipTo && s % stride === 0 && s < steps - 1) snapshots.push(pts.map((q) => q.slice()));
    }

    // --- assemble ---
    const mapPt = vertical ? (q) => [q[1], q[0]] : (q) => q.slice();
    const paths = [];
    for (const snap of snapshots) {
      if (snap.length > 1) paths.push({ pts: snap.map(mapPt), closed: false, layer: Math.round(p.layer) });
    }
    if (p.oxbows) {
      for (const ox of oxArcs) {
        if (ox.pts.length > 3) paths.push({ pts: ox.pts.map(mapPt), closed: true, layer: Math.round(p.penOx) });
      }
    }
    if (pts.length > 1) paths.push({ pts: pts.map(mapPt), closed: false, layer: Math.round(p.penFinal) });
    return applyStyle({ paths }, ins[0]);
  },
};
