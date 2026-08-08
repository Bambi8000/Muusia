import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "radial_burst",
  name: "Radial Burst",
  cat: "gen",
  group: "organic",
  desc: "Lines fleeing a center point: squiggly hairs radiate outward, and new hairs are born mid-flight wherever the gap between neighbours grows too wide, so the coat stays evenly dense from core to rim (ray count doubles every time the radius does). Hair spacing sets that density; Waveform picks the squiggle - Zigzag, Sine, Square, Saw, Seismic (quiet stretches broken by bursts) or Straight bare rays - shaped by Wave length / Wave amp, and Wobble lets each hair drift off its ray; Inner radius opens a hole at the core, Edge variation makes the silhouette an irregular blob and the tips end at slightly ragged lengths. Each hair is ONE continuous stroke drawn from the inside out - the pen travel direction radiates like the drawing does. Center is draggable via Center X/Y. Wire Frame into Seed for a shimmering animation.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "spacing", label: "Hair spacing mm", type: "slider", min: 1, max: 8, step: 0.1, def: 1.8 },
    { key: "waveLen", label: "Wave length mm", type: "slider", min: 1, max: 10, step: 0.1, def: 2.4 },
    { key: "waveAmp", label: "Wave amp mm", type: "slider", min: 0, max: 3, step: 0.05, def: 0.8 },
    { key: "waveform", label: "Waveform", type: "select", options: ["Zigzag", "Sine", "Square", "Saw", "Seismic", "Straight"], def: "Zigzag" },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "innerR", label: "Inner radius mm", type: "slider", min: 0, max: 80, step: 1, def: 2 },
    { key: "edgeVar", label: "Edge variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "useCenter", label: "Center of canvas", type: "check", def: true },
    { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
    { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 9 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  overlay(p, ctx) {
    const { W, H } = ctx;
    const CX = p.useCenter ? W / 2 : p.cx;
    const CY = p.useCenter ? H / 2 : p.cy;
    const m = Math.max(0, p.margin);
    const baseR = Math.max(10, Math.min(W - 2 * m, H - 2 * m) / 2);
    const guides = [
      { kind: "point", x: CX, y: CY },
      { kind: "circle", cx: CX, cy: CY, r: baseR }
    ];
    if (p.innerR > 0.5) guides.push({ kind: "circle", cx: CX, cy: CY, r: p.innerR });
    return guides;
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const CX = p.useCenter ? W / 2 : p.cx;
    const CY = p.useCenter ? H / 2 : p.cy;
    const baseR = Math.max(10, Math.min(W - 2 * m, H - 2 * m) / 2);
    const sp = Math.max(0.5, p.spacing);
    const inner = Math.max(0, Math.min(p.innerR, baseR * 0.8));
    const rng = mulberry32(p.seed * 3319 + 41);
    const L = Math.round(p.layer);
    const TAU = Math.PI * 2;
    const clampP = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];

    /* ---- ray set: gap-driven insertion - sweep the radius outward and give
       birth to a new hair wherever the arc gap between neighbours exceeds the
       spacing; children too close to their sector's own silhouette are skipped,
       so density stays uniform relative to the LOCAL edge at any Edge variation ---- */
    const silhouette = (ang) => {
      const eN = noise2(Math.cos(ang) * 1.9 + 5, Math.sin(ang) * 1.9 + 5, p.seed * 7 + 2);
      return baseR * (1 + p.edgeVar * 0.35 * (eN - 0.5) * 2);
    };
    const minHair = Math.max(2, p.waveLen * 0.6);
    const rBase = Math.max(inner, sp * 1.2);
    const N0 = Math.max(6, Math.round((TAU * rBase) / sp));
    let rays = [];
    for (let i = 0; i < N0; i++) {
      rays.push({ ang: (i / N0) * TAU + (rng() - 0.5) * (TAU / N0) * 0.5, birth: inner });
    }
    const maxR = baseR * (1 + p.edgeVar * 0.4) + 4;
    let rSweep = rBase;
    while (rSweep < maxR && rays.length < 5000) {
      rays.sort((a, b) => a.ang - b.ang);
      const born = [];
      for (let i = 0; i < rays.length; i++) {
        const a0 = rays[i].ang;
        const a1 = i + 1 < rays.length ? rays[i + 1].ang : rays[0].ang + TAU;
        if ((a1 - a0) * rSweep > sp * 1.4) {
          const ang = (a0 + a1) / 2 + (rng() - 0.5) * (a1 - a0) * 0.25;
          const birth = rSweep * (0.92 + rng() * 0.16);
          if (silhouette(ang) - birth >= minHair) born.push({ ang, birth });
        }
      }
      rays = rays.concat(born);
      rSweep *= 1.22;
    }

    /* ---- one continuous squiggle per ray, inside out ---- */
    const paths = [];
    const BUDGET = 118000;
    let total = 0;
    const STEP = 0.45;
    const tri = (x) => { const t = x / TAU - Math.floor(x / TAU); return 4 * Math.abs(t - 0.5) - 1; };
    rays.forEach((ray, ri) => {
      /* silhouette radius from the ray's base angle: shared low-freq noise = coherent blob */
      const Redge = silhouette(ray.ang) * (0.97 + rng() * 0.06);
      if (Redge - ray.birth < minHair) return; /* too short to bother */
      const ph = rng() * TAU;
      const oW = rng() * 70 + 9;
      const pts = [];
      for (let r = ray.birth; r <= Redge; r += STEP) {
        /* the hair drifts off its ray a little, then squiggles across it */
        const th = ray.ang + p.wobble * 0.22 * (noise2(r * 0.045, oW, p.seed * 5 + 3) - 0.5) * 2;
        const w = (r / p.waveLen) * TAU + ph;
        let base;
        if (p.waveform === "Straight") base = 0;
        else if (p.waveform === "Sine") base = Math.sin(w);
        else if (p.waveform === "Square") base = Math.sin(w) >= 0 ? 1 : -1;
        else if (p.waveform === "Saw") { const t2 = w / TAU - Math.floor(w / TAU); base = 2 * t2 - 1; }
        else if (p.waveform === "Seismic") {
          /* quiet stretches broken by violent bursts, like a seismogram */
          const env = Math.pow(noise2(r * 0.16, oW + 61, p.seed * 11 + 6), 2.5) * 3;
          base = Math.max(-1.4, Math.min(1.4, (noise2(r * 1.9, oW + 47, p.seed * 13 + 7) - 0.5) * 2 * (0.25 + env)));
        }
        else base = tri(w);
        const o = p.waveform === "Straight" ? 0 :
          p.waveAmp * base + p.waveAmp * 0.25 * (noise2(r * 0.3, oW + 31, p.seed * 9 + 4) - 0.5) * 2;
        pts.push([
          CX + Math.cos(th) * r - Math.sin(th) * o,
          CY + Math.sin(th) * r + Math.cos(th) * o
        ]);
      }
      if (pts.length < 2 || total + pts.length > BUDGET) return;
      total += pts.length;
      paths.push({ pts: pts.map(clampP), closed: false, layer: L });
    });
    return applyStyle({ paths }, ins[0]);
  }
};
