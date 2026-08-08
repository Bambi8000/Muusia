import { Pin, PENS, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "smoke_mesh",
  name: "Smoke Mesh",
  cat: "gen",
  group: "organic",
  desc: "Floating smoke veils in 3D: each sheet is a ribbon surface swept along a noise-wandering spine while the sheet direction slowly rotates (Twist) and folds back on itself (Folds) - drawn as hundreds of parallel filaments, so a face-on veil reads pale and an edge-on fold turns into a dark seam, like long-exposure smoke. Width shapes the veil with a pinch-and-flare profile, Ripple rumples it like cloth, Sheets layers 1-4 independent veils in one shared camera. Filaments sets the line count (= ink density) and Pens spreads them across the palette as a gradient across the sheet. Rotate with View yaw and pitch; wire Frame into Yaw and the smoke drifts through an animation. Every filament is one continuous stroke.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "sheets", label: "Sheets", type: "slider", min: 1, max: 4, step: 1, def: 2 },
    { key: "filaments", label: "Filaments / sheet", type: "slider", min: 20, max: 300, step: 5, def: 140 },
    { key: "detail", label: "Detail (samples)", type: "slider", min: 60, max: 260, step: 10, def: 160 },
    { key: "sweep", label: "Sweep length", type: "slider", min: 0.2, max: 2, step: 0.05, def: 1 },
    { key: "width", label: "Sheet width", type: "slider", min: 0.1, max: 1.5, step: 0.05, def: 0.65 },
    { key: "twist", label: "Twist", type: "slider", min: 0, max: 4, step: 0.1, def: 1.2 },
    { key: "folds", label: "Folds", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "ripple", label: "Ripple", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "pens", label: "Pens", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "yaw", label: "View yaw deg (wire Frame)", type: "slider", min: 0, max: 360, step: 1, def: 20 },
    { key: "pitch", label: "View pitch deg", type: "slider", min: -60, max: 60, step: 1, def: 8 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
    { key: "seed", label: "Seed", type: "seed", def: 14 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(2, p.margin);
    const bw = W - 2 * m, bh = H - 2 * m;
    if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
    const rng = mulberry32(p.seed * 1481 + 27);
    const L = Math.round(p.layer);
    const NP = Math.max(1, Math.min(PENS.length, Math.round(p.pens)));
    const nSh = Math.max(1, Math.min(4, Math.round(p.sheets)));
    const nF = Math.max(4, Math.min(300, Math.round(p.filaments)));
    /* keep the whole cloud inside the point budget by shrinking sample count */
    let nU = Math.max(24, Math.min(260, Math.round(p.detail)));
    const BUDGET = 118000;
    if (nSh * nF * (nU + 1) > BUDGET) nU = Math.max(24, Math.floor(BUDGET / (nSh * nF)) - 1);

    /* ---- build filaments in 3D world space ---- */
    const fil = []; /* { pts3: [[x,y,z]...], pen } */
    for (let s = 0; s < nSh; s++) {
      /* per-sheet: noise offsets, a random sweep direction, an orthonormal pair
         (N0, N1) the sheet direction rotates in, plus N2 for out-of-plane fold */
      const o1 = rng() * 80 + 5, o2 = rng() * 80 + 91, o3 = rng() * 80 + 177;
      const o4 = rng() * 80 + 263, o5 = rng() * 80 + 349, o6 = rng() * 80 + 431;
      const sc = 0.75 + rng() * 0.5;
      const base = [(rng() - 0.5) * 0.8, (rng() - 0.5) * 0.8, (rng() - 0.5) * 0.8];
      let sw = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
      let d0 = Math.hypot(sw[0], sw[1], sw[2]) || 1;
      sw = [sw[0] / d0, sw[1] / d0, sw[2] / d0];
      /* orthonormal frame from the sweep direction */
      const ref = Math.abs(sw[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let N0 = [
        sw[1] * ref[2] - sw[2] * ref[1],
        sw[2] * ref[0] - sw[0] * ref[2],
        sw[0] * ref[1] - sw[1] * ref[0]
      ];
      d0 = Math.hypot(N0[0], N0[1], N0[2]) || 1;
      N0 = [N0[0] / d0, N0[1] / d0, N0[2] / d0];
      const N1 = [
        sw[1] * N0[2] - sw[2] * N0[1],
        sw[2] * N0[0] - sw[0] * N0[2],
        sw[0] * N0[1] - sw[1] * N0[0]
      ];
      const phase = rng() * Math.PI * 2;
      /* spine + rotating sheet direction, sampled once per u */
      const spine = [], dir = [], wid = [];
      for (let i = 0; i <= nU; i++) {
        const u = i / nU;
        const c = [0, 1, 2].map((a) => {
          const off = [o1, o2, o3][a];
          return base[a] + sw[a] * (u - 0.5) * 1.6 * p.sweep * sc +
            ((noise2(u * 1.7, off, p.seed * 3 + a) - 0.5) * 0.9 +
             (noise2(u * 4.2, off + 31, p.seed * 5 + a) - 0.5) * 0.3) * sc;
        });
        spine.push(c);
        const ph = phase + p.twist * u * Math.PI * 2 +
          (noise2(u * 2.3, o4, p.seed * 7 + s) - 0.5) * p.folds * 9;
        const tilt = (noise2(u * 1.9, o5, p.seed * 9 + s) - 0.5) * p.folds * 1.6;
        const cph = Math.cos(ph), sph = Math.sin(ph);
        dir.push([
          N0[0] * cph + N1[0] * sph + sw[0] * tilt,
          N0[1] * cph + N1[1] * sph + sw[1] * tilt,
          N0[2] * cph + N1[2] * sph + sw[2] * tilt
        ]);
        wid.push(p.width * sc *
          (0.15 + 0.85 * Math.pow(Math.sin(Math.PI * u), 0.7)) *
          (1 + (noise2(u * 2.8, o6, p.seed * 11 + s) - 0.5) * 0.8));
      }
      for (let f = 0; f < nF; f++) {
        const v = nF > 1 ? (f / (nF - 1)) * 2 - 1 : 0;
        const pts3 = [];
        for (let i = 0; i <= nU; i++) {
          const u = i / nU;
          const rip = p.ripple * 0.06 *
            (noise2(u * 7 + v * 2.4, o4 + 57 + v * 3, p.seed * 13 + s) - 0.5) * 2;
          pts3.push([
            spine[i][0] + dir[i][0] * wid[i] * v + sw[0] * rip,
            spine[i][1] + dir[i][1] * wid[i] * v + sw[1] * rip,
            spine[i][2] + dir[i][2] * wid[i] * v + sw[2] * rip
          ]);
        }
        fil.push({ pts3, pen: (L + Math.floor((f / nF) * NP)) % PENS.length });
      }
    }

    /* ---- project (yaw around vertical, pitch, perspective) ---- */
    const ya = (p.yaw * Math.PI) / 180, pa = (p.pitch * Math.PI) / 180;
    const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
    const cp2 = Math.cos(pa), sp2 = Math.sin(pa);
    let ext = 0.5;
    for (const q of fil) for (const v of q.pts3) {
      ext = Math.max(ext, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
    }
    const FOC = ext * 2 * (0.8 + 6 * (1 - p.persp));
    const proj = ([x, y, z]) => {
      const X = x * cy2 + z * sy2;
      let Z = -x * sy2 + z * cy2;
      const Y = y * cp2 - Z * sp2;
      Z = y * sp2 + Z * cp2;
      const sc2 = FOC / Math.max(FOC * 0.12, FOC + Z);
      return [X * sc2, -Y * sc2];
    };
    const flat = fil.map((q) => ({ pts: q.pts3.map(proj), pen: q.pen }));

    /* ---- fit to the margin box ---- */
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of flat) for (const v of q.pts) {
      if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0];
      if (v[1] < y0) y0 = v[1]; if (v[1] > y1) y1 = v[1];
    }
    const sc3 = Math.min(bw / Math.max(1e-6, x1 - x0), bh / Math.max(1e-6, y1 - y0));
    const ox = W / 2 - ((x0 + x1) / 2) * sc3;
    const oy = H / 2 - ((y0 + y1) / 2) * sc3;
    const paths = flat.map((q) => ({
      pts: q.pts.map(([x, y]) => [x * sc3 + ox, y * sc3 + oy]),
      closed: false,
      layer: q.pen
    }));
    return applyStyle({ paths }, ins[0]);
  }
};
