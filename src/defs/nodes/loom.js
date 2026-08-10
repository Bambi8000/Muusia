import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "loom",
  name: "Loom",
  cat: "gen",
  group: "structural",
  desc: "A dense woven mesh: warp (row) and weft (column) threads on a regular grid, optionally draped by low-frequency noise so the fabric bends and shimmers with moire. Density is the thread spacing in mm (auto-coarsened to stay inside the point budget), Drape the bend amplitude in mm. Shape noise adds finer rumple on top of the drape (Noise scale sets its feature size: higher = smaller wrinkles), and Drift drags the whole cloth toward Drift angle, ramping from zero at one edge to full mm at the other with a gentle seeded unevenness - all three are shared displacement fields, so warp and weft stay woven together. Threads picks both directions or one. The intact companion of the Torn modifier: wire Loom -> Torn (stack several Torn nodes for multiple rips) to tear the cloth open.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "density", label: "Density (mm)", type: "slider", min: 1, max: 8, step: 0.1, def: 2.2 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "drape", label: "Drape", type: "slider", min: 0, max: 40, step: 0.5, def: 14 },
    { key: "noiseAmt", label: "Shape noise", type: "slider", min: 0, max: 25, step: 0.25, def: 0 },
    { key: "noiseScale", label: "Noise scale", type: "slider", min: 0.5, max: 6, step: 0.1, def: 1.5 },
    { key: "drift", label: "Drift (mm)", type: "slider", min: 0, max: 60, step: 0.5, def: 0 },
    { key: "driftAngle", label: "Drift angle", type: "slider", min: -180, max: 180, step: 1, def: 90 },
    { key: "threads", label: "Threads", type: "select", options: ["Both", "Warp (rows)", "Weft (columns)"], def: "Both" },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(ctx.W, ctx.H) / 2 - 2));
    const g = [{ kind: "rect", x: mg, y: mg, w: ctx.W - 2 * mg, h: ctx.H - 2 * mg }];
    const drift = Math.max(0, +p.drift || 0);
    if (drift > 0) {
      const dA = ((+p.driftAngle || 0) * Math.PI) / 180;
      g.push({ kind: "arrow", x1: ctx.W / 2, y1: ctx.H / 2,
               x2: ctx.W / 2 + Math.cos(dA) * drift, y2: ctx.H / 2 + Math.sin(dA) * drift });
    }
    return g;
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const w = W - 2 * mg, h = H - 2 * mg;
    if (!(w > 4 && h > 4)) return EMPTY;
    const S = Math.round(+p.seed || 0);
    let step = Math.max(0.8, +p.density || 2);
    const minStep = Math.sqrt((2 * w * h) / 110000);
    if (step < minStep) step = minStep;
    const nx = Math.max(3, Math.round(w / step) + 1);
    const ny = Math.max(3, Math.round(h / step) + 1);
    const dxs = w / (nx - 1), dys = h / (ny - 1);
    const drape = Math.max(0, +p.drape || 0);
    const nAmt = Math.max(0, +p.noiseAmt || 0);
    const nScale = Math.max(0.1, +p.noiseScale || 1.5);
    const drift = Math.max(0, +p.drift || 0);
    const layer = Math.round(+p.layer || 0);

    // drift ramp: 0 at one edge of the margin box, 1 at the opposite edge
    const dA = ((+p.driftAngle || 0) * Math.PI) / 180;
    const ddx = Math.cos(dA), ddy = Math.sin(dA);
    let vmin = Infinity, vmax = -Infinity;
    for (const [cxx, cyy] of [[mg, mg], [mg + w, mg], [mg, mg + h], [mg + w, mg + h]]) {
      const v = cxx * ddx + cyy * ddy;
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
    const vspan = Math.max(1e-9, vmax - vmin);

    const P = new Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x0 = mg + i * dxs, y0 = mg + j * dys;
        let x = x0, y = y0;
        if (drape > 0) {
          x += (noise2(x * 0.013 + 40.7, y * 0.013, S * 17 + 3) - 0.5) * 2 * drape;
          y += (noise2(x * 0.013, y * 0.013 + 91.2, S * 17 + 7) - 0.5) * 2 * drape;
        }
        if (nAmt > 0) {
          const f = 0.03 * nScale;
          x += (noise2(x * f + 7.1, y * f, S * 23 + 5) - 0.5) * 2 * nAmt;
          y += (noise2(x * f, y * f + 53.9, S * 23 + 9) - 0.5) * 2 * nAmt;
        }
        if (drift > 0) {
          const t = Math.min(1, Math.max(0, (x0 * ddx + y0 * ddy - vmin) / vspan));
          const perp = -x0 * ddy + y0 * ddx;
          const mod = 0.7 + 0.6 * noise2(perp * 0.01, 5.5, S * 31 + 13);
          const disp = drift * t * t * mod;
          x += ddx * disp;
          y += ddy * disp;
        }
        P[j * nx + i] = [x, y];
      }
    }

    const paths = [];
    const mode = String(p.threads || "Both");
    if (mode === "Both" || mode === "Warp (rows)") {
      for (let j = 0; j < ny; j++) {
        const pts = new Array(nx);
        for (let i = 0; i < nx; i++) pts[i] = P[j * nx + i].slice();
        paths.push({ pts, closed: false, layer });
      }
    }
    if (mode === "Both" || mode === "Weft (columns)") {
      for (let i = 0; i < nx; i++) {
        const pts = new Array(ny);
        for (let j = 0; j < ny; j++) pts[j] = P[j * nx + i].slice();
        paths.push({ pts, closed: false, layer });
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
