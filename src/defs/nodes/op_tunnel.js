import { Pin, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "op_tunnel",
  name: "Op Tunnel",
  cat: "gen",
  group: "geometric",
  desc: "Op-art perspective tunnel: an (optionally irregular) polygon is split into wedge sectors from a vanishing point, and each sector is striped parallel to its outer edge with geometrically shrinking spacing - the stripes rush toward the center. Edge gap sets the stripe period at the rim in mm, Depth % the size of the center hole, VP X/Y % place the vanishing point (off-center = asymmetric pull). Fill step > 0 hatches every second band solid for the full painted op-art look (0 = boundary lines only). Glitches punch rectangular patches where the stripes shift half a period inward, flipping the apparent color - count and size are seeded. Irregular jitters the polygon vertices. Tip: pen 1 (blue) on cream paper nails the classic look; wire Rotate to the frame clock for a spinning tunnel.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "sides", label: "Sides", type: "slider", min: 3, max: 12, step: 1, def: 6 },
    { key: "irregular", label: "Irregular", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "rotate", label: "Rotate", type: "slider", min: -180, max: 180, step: 1, def: -8 },
    { key: "vpx", label: "VP X %", type: "slider", min: 5, max: 95, step: 1, def: 55 },
    { key: "vpy", label: "VP Y %", type: "slider", min: 5, max: 95, step: 1, def: 42 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "edgeGap", label: "Edge gap (mm)", type: "slider", min: 1, max: 12, step: 0.1, def: 3.5 },
    { key: "depth", label: "Depth %", type: "slider", min: 0.1, max: 20, step: 0.1, def: 1 },
    { key: "fillStep", label: "Fill step (mm)", type: "slider", min: 0, max: 3, step: 0.1, def: 0 },
    { key: "glitches", label: "Glitches", type: "slider", min: 0, max: 40, step: 1, def: 14 },
    { key: "glitchSize", label: "Glitch size %", type: "slider", min: 2, max: 25, step: 1, def: 8 },
    { key: "layer", label: "Pen", type: "pen", def: 1 },
  ],
  overlay(p, ctx) {
    /* same vertex/vp math as compute, inlined (this-binding pitfall, v2.51) */
    const W = ctx.W, H = ctx.H;
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const n = Math.max(3, Math.min(24, Math.round(+p.sides || 6)));
    const irr = Math.max(0, Math.min(1, +p.irregular || 0));
    const rot = ((+p.rotate || 0) * Math.PI) / 180;
    const S = Math.round(+p.seed || 0);
    const rng = mulberry32(S * 7919 + 13);
    const raw = [];
    for (let i = 0; i < n; i++) {
      const ja = irr > 0 ? (rng() - 0.5) * irr * 0.7 : (rng(), 0);
      const jr = irr > 0 ? irr * 0.45 * rng() : (rng(), 0);
      const a = rot + ((i + ja) / n) * Math.PI * 2;
      raw.push([Math.cos(a) * (1 - jr), Math.sin(a) * (1 - jr)]);
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of raw) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const bw = W - 2 * mg, bh = H - 2 * mg;
    const sc = Math.min(bw / Math.max(1e-9, x1 - x0), bh / Math.max(1e-9, y1 - y0));
    const ox = mg + (bw - (x1 - x0) * sc) / 2 - x0 * sc;
    const oy = mg + (bh - (y1 - y0) * sc) / 2 - y0 * sc;
    const V = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
    const C = [(W * Math.max(0, Math.min(100, +p.vpx || 50))) / 100, (H * Math.max(0, Math.min(100, +p.vpy || 50))) / 100];
    return [
      { kind: "poly", pts: V },
      { kind: "point", x: C[0], y: C[1] },
    ];
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const n = Math.max(3, Math.min(24, Math.round(+p.sides || 6)));
    const irr = Math.max(0, Math.min(1, +p.irregular || 0));
    const rot = ((+p.rotate || 0) * Math.PI) / 180;
    const S = Math.round(+p.seed || 0);
    const rng = mulberry32(S * 7919 + 13);
    const raw = [];
    for (let i = 0; i < n; i++) {
      const ja = irr > 0 ? (rng() - 0.5) * irr * 0.7 : (rng(), 0);
      const jr = irr > 0 ? irr * 0.45 * rng() : (rng(), 0);
      const a = rot + ((i + ja) / n) * Math.PI * 2;
      raw.push([Math.cos(a) * (1 - jr), Math.sin(a) * (1 - jr)]);
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of raw) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const bw = W - 2 * mg, bh = H - 2 * mg;
    const sc = Math.min(bw / Math.max(1e-9, x1 - x0), bh / Math.max(1e-9, y1 - y0));
    const ox = mg + (bw - (x1 - x0) * sc) / 2 - x0 * sc;
    const oy = mg + (bh - (y1 - y0) * sc) / 2 - y0 * sc;
    const V = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
    const C = [(W * Math.max(0, Math.min(100, +p.vpx || 50))) / 100, (H * Math.max(0, Math.min(100, +p.vpy || 50))) / 100];
    const layer = Math.round(+p.layer || 0);
    const edgeGap = Math.max(0.5, +p.edgeGap || 3.5);
    const tmin = Math.max(0.001, Math.min(0.5, (+p.depth || 1) / 100));
    const fillStep = Math.max(0, +p.fillStep || 0);
    const nGl = Math.max(0, Math.min(80, Math.round(+p.glitches || 0)));
    const gSize = Math.max(1, Math.min(50, +p.glitchSize || 8)) / 100;

    // per-sector stripe ratio q from the perpendicular distance vp -> outer edge
    const sect = [];
    for (let i = 0; i < n; i++) {
      const A = V[i], B = V[(i + 1) % n];
      const ex = B[0] - A[0], ey = B[1] - A[1];
      const el = Math.hypot(ex, ey) || 1e-9;
      const h = Math.abs((C[0] - A[0]) * (ey / el) - (C[1] - A[1]) * (ex / el));
      const q = Math.max(0.3, Math.min(0.995, 1 - edgeGap / Math.max(edgeGap * 1.05, h)));
      sect.push({ A, B, q, glitch: [] });
    }

    // seeded glitch patches: {s0,s1} along the stripe, {tLo,tHi} in depth
    for (let g = 0; g < nGl; g++) {
      const r = (k) => hash2(g * 7 + k, 17, S * 104729 + 3);
      const si = Math.floor(r(1) * n) % n;
      const sw = gSize * (0.6 + 0.8 * r(2));
      const s0 = r(3) * Math.max(0.001, 1 - sw);
      const tHi = tmin + Math.pow(r(4), 0.7) * (1 - tmin);
      const tLo = tHi * Math.pow(sect[si].q, Math.max(2, Math.round(2 + gSize * 60 * r(5))));
      sect[si].glitch.push({ s0, s1: s0 + sw, tLo, tHi });
    }

    const paths = [];
    const pt = (sec, t, s) => [
      C[0] + (sec.A[0] + (sec.B[0] - sec.A[0]) * s - C[0]) * t,
      C[1] + (sec.A[1] + (sec.B[1] - sec.A[1]) * s - C[1]) * t,
    ];
    // draw one stripe at depth t, splitting it at glitch patches (shifted half a period inward)
    const stripe = (sec, t) => {
      const hits = sec.glitch.filter((g) => t <= g.tHi && t >= g.tLo)
        .map((g) => [Math.max(0, g.s0), Math.min(1, g.s1)])
        .sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const iv of hits) {
        if (merged.length && iv[0] <= merged[merged.length - 1][1]) {
          merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
        } else merged.push(iv.slice());
      }
      const tg = t * Math.sqrt(sec.q);
      let s = 0;
      for (const [a, b] of merged) {
        if (a - s > 1e-4) paths.push({ pts: [pt(sec, t, s), pt(sec, t, a)], closed: false, layer });
        if (b - a > 1e-4) paths.push({ pts: [pt(sec, tg, a), pt(sec, tg, b)], closed: false, layer });
        s = b;
      }
      if (1 - s > 1e-4) paths.push({ pts: [pt(sec, t, s), pt(sec, t, 1)], closed: false, layer });
    };

    for (const sec of sect) {
      const ts = [];
      let t = 1;
      let guard = 0;
      while (t >= tmin && guard++ < 600) { ts.push(t); t *= sec.q; }
      for (const tk of ts) stripe(sec, tk);
      if (fillStep > 0) {
        // hatch every second band with evenly spaced sub-stripes
        const AB = Math.hypot(sec.B[0] - sec.A[0], sec.B[1] - sec.A[1]);
        const h = Math.abs((C[0] - sec.A[0]) * ((sec.B[1] - sec.A[1]) / AB) - (C[1] - sec.A[1]) * ((sec.B[0] - sec.A[0]) / AB));
        for (let k = 0; k + 1 < ts.length; k += 2) {
          const gapMM = h * (ts[k] - ts[k + 1]);
          const m = Math.min(60, Math.floor(gapMM / fillStep));
          for (let u = 1; u <= m; u++) stripe(sec, ts[k] - (ts[k] - ts[k + 1]) * (u / (m + 1)));
        }
      }
    }
    // budget guard: thin out fills if a pathological combo explodes (deterministic)
    let total = 0;
    for (const q of paths) total += q.pts.length;
    if (total > 115000) {
      const keep = Math.floor(paths.length * (115000 / total));
      paths.length = keep;
    }
    return applyStyle({ paths }, ins[0]);
  },
};
