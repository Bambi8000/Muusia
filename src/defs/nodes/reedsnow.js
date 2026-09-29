import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  /* Reeds in Snow — a charcoal-drawing study: tall thin stalks rising from a
     shallow ground band, each with its own weight (multi-pass parallel
     strokes that taper toward the tip), gentle bend and lean, a share of
     them fallen as long diagonals, some drawn as broken dotted lines; around
     them faint wind marks on the snow, a few scribbled tangles and long
     wispy sweeps on a light pen. The snow itself is left blank. */
  key: "reedsnow",
  name: "Reeds in Snow",
  cat: "gen",
  group: "nature",
  desc: "Winter reeds drawn like a charcoal sketch on white paper: Stalks rise from a shallow ground band (Ground and Ground depth) to varying heights, bending softly (Bend) and leaning with the wind (Lean, Lean variation) with a hand-drawn wobble (Roughness). Every stalk has its own weight - Weight and Weight variation set how many parallel passes it gets, and Taper makes the passes converge so the stalk thins toward its tip; Broken turns a share of them into dotted lines. Fallen tips a share over as long crossing diagonals. Wind marks are faint horizontal strokes across the snow surface, Tangles small scribbled knots at stalk tips or on the ground, Wisps long faint sweeps of the charcoal - all three on the Light pen. Stalks stay inside Margin.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Stalks", type: "slider", min: 1, max: 60, step: 1, def: 14 },
    { key: "height", label: "Height mm", type: "slider", min: 20, max: 400, step: 5, def: 170 },
    { key: "heightVar", label: "Height variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "bend", label: "Bend", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "lean", label: "Lean deg", type: "slider", min: -30, max: 30, step: 1, def: 4 },
    { key: "leanVar", label: "Lean variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    { key: "rough", label: "Roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    { key: "fallen", label: "Fallen", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "weight", label: "Weight mm", type: "slider", min: 0.15, max: 1.5, step: 0.05, def: 0.6 },
    { key: "weightVar", label: "Weight variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.7 },
    { key: "taper", label: "Taper", type: "check", def: true },
    { key: "broken", label: "Broken (dotted)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "windMarks", label: "Wind marks", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "tangles", label: "Tangles", type: "slider", min: 0, max: 8, step: 1, def: 2 },
    { key: "wisps", label: "Wisps", type: "slider", min: 0, max: 20, step: 1, def: 6 },
    { key: "ground", label: "Ground (0 = top, 1 = bottom)", type: "slider", min: 0.3, max: 1, step: 0.01, def: 0.86 },
    { key: "groundDepth", label: "Ground depth mm", type: "slider", min: 0, max: 80, step: 1, def: 22 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "seed", label: "Seed", type: "seed", def: 11 },
    { key: "layer", label: "Stalk pen", type: "pen", def: 0 },
    { key: "penLight", label: "Light pen", type: "pen", def: 9 },
  ],
  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const m = Math.max(0, Math.min(+(p && p.margin) || 0, Math.min(W, H) / 2 - 1));
      const gy = m + Math.max(0, Math.min(1, +(p && p.ground) || 0.86)) * (H - 2 * m);
      const gd = Math.max(0, +(p && p.groundDepth) || 0);
      return [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }, { kind: "rect", x: m, y: Math.max(m, gy - gd / 2), w: W - 2 * m, h: Math.min(gd, H - m - Math.max(m, gy - gd / 2)) }];
    } catch (e) { return []; }
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const m = Math.max(0, Math.min(cl(p.margin, 0, 1e4), Math.min(W, H) / 2 - 1));
    const seed = (Math.round(+p.seed) || 1) >>> 0;
    const rng = mulberry32(seed * 6151 + 3);
    const pen = Math.max(0, Math.min(11, Math.round(+p.layer || 0))), penL = Math.max(0, Math.min(11, Math.round(+p.penLight || 0)));
    const count = Math.max(1, Math.min(200, Math.round(+p.count || 1)));
    const Hmax = cl(p.height, 5, 5000), hVar = cl(p.heightVar, 0, 1);
    const bend = cl(p.bend, 0, 2), lean0 = cl(p.lean, -80, 80) * Math.PI / 180, leanVar = cl(p.leanVar, 0, 1);
    const rough = cl(p.rough, 0, 2), fallenF = cl(p.fallen, 0, 1), brokenF = cl(p.broken, 0, 1);
    const wMax = cl(p.weight, 0.05, 5), wVar = cl(p.weightVar, 0, 1);
    const PASS = 0.18;                         /* pen-width pitch between passes */
    const gy = m + cl(p.ground, 0, 1) * (H - 2 * m), gd = cl(p.groundDepth, 0, H);
    const paths = [];
    let budget = 115000;
    const emit = (pts, layer) => { if (pts.length < 2 || budget <= 0) return; budget -= pts.length; paths.push({ pts: pts.map(([x, y]) => [Math.max(m, Math.min(W - m, x)), Math.max(m, Math.min(H - m, y))]), closed: false, layer }); };
    const nz = (a, b, k) => noise2(a, b, seed + k) - 0.5;

    /* ---- one stalk centreline: base, direction, length -> sampled polyline + local normals ---- */
    const centreline = (bx, by, ang, len, bendAmt, wob, id) => {
      const n = Math.max(12, Math.min(160, Math.round(len / 2.2)));
      const pts = [];
      const bs = rng() < 0.5 ? -1 : 1;
      const ph = rng() * 100;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        /* base direction with a quadratic bend and a slow wobble */
        const a = ang + bs * bendAmt * 0.9 * t * t + wob * 0.25 * nz(t * 3 + ph, id * 0.37, 1);
        const s = len / n;
        const prev = pts.length ? pts[pts.length - 1] : [bx, by];
        pts.push(i === 0 ? [bx, by] : [prev[0] + Math.sin(a) * s, prev[1] - Math.cos(a) * s]);
      }
      /* fine hand tremor perpendicular to the line */
      const out = pts.map((q, i) => {
        const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(q1[1] - q0[1]), ny = q1[0] - q0[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const tr = wob * 0.7 * nz(i * 0.9 + ph, id * 0.91 + 7, 2) * Math.min(1, len / 60);
        return [q[0] + nx * tr, q[1] + ny * tr, nx, ny];
      });
      return out;
    };
    /* multi-pass ribbon with optional taper */
    const stroke = (cl2, wmm, taper, layer, dotted) => {
      const passes = Math.max(1, Math.min(12, Math.round(wmm / PASS)));
      for (let k = 0; k < passes; k++) {
        const off = (k - (passes - 1) / 2) * PASS;
        let pts = cl2.map((q, i) => { const t = i / (cl2.length - 1); const f = taper ? (1 - 0.85 * t) : 1; return [q[0] + q[2] * off * f, q[1] + q[3] * off * f]; });
        if (k % 2) pts.reverse();
        if (dotted) {
          /* break into short dashes with irregular gaps */
          let i = 0;
          while (i < pts.length - 1) {
            const dl = 1 + Math.round(rng() * 2), gl = 1 + Math.round(rng() * 1.5);
            const seg = pts.slice(i, i + dl + 1);
            if (seg.length >= 2) emit(seg, layer);
            i += dl + gl;
          }
        } else emit(pts, layer);
      }
    };

    /* ---- stalks ---- */
    const usableTop = m + 2;
    for (let i = 0; i < count; i++) {
      const bx = m + rng() * (W - 2 * m);
      const by = gy + (rng() - 0.5) * gd;
      const fallen = rng() < fallenF;
      const hRaw = Hmax * (1 - hVar * Math.pow(rng(), 0.8));
      let ang = lean0 + (rng() - 0.5) * 2 * leanVar * 0.35;
      let len = hRaw;
      if (fallen) { ang = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.55) + lean0 * 0.5; len = hRaw * (0.7 + rng() * 0.4); }
      /* keep the tip inside the margin box: shorten if it would leave */
      const reach = Math.max(0.05, Math.cos(ang));
      len = Math.min(len, (by - usableTop) / reach);
      const sx = Math.sin(ang);
      if (sx > 1e-6) len = Math.min(len, (W - m - 2 - bx) / sx); else if (sx < -1e-6) len = Math.min(len, (bx - m - 2) / -sx);
      if (len < 8) continue;
      const cl2 = centreline(bx, by, ang, len, bend, rough, i + 1);
      const wmm = Math.max(0.1, wMax * (1 - wVar * Math.pow(rng(), 0.6)));
      const dotted = rng() < brokenF;
      stroke(cl2, dotted ? Math.min(wmm, PASS * 2) : wmm, !!p.taper, pen, dotted);
    }

    /* ---- wind marks on the snow: faint, nearly horizontal ---- */
    const nWind = Math.max(0, Math.min(200, Math.round(+p.windMarks || 0)));
    for (let i = 0; i < nWind; i++) {
      const L = 12 + rng() * 60, x0 = m + rng() * (W - 2 * m - L), y0 = gy + (rng() - 0.5) * (gd + 20);
      const slope = (rng() - 0.5) * 0.12, ph = rng() * 50;
      const n = Math.max(6, Math.round(L / 3));
      const pts = [];
      for (let k = 0; k <= n; k++) { const t = k / n; pts.push([x0 + L * t, y0 + slope * L * t + 0.6 * nz(t * 4 + ph, i, 3)]); }
      emit(pts, penL);
    }
    /* ---- tangles: scribbled knots ---- */
    const nT = Math.max(0, Math.min(40, Math.round(+p.tangles || 0)));
    for (let i = 0; i < nT; i++) {
      const cx = m + 10 + rng() * (W - 2 * m - 20), cy = rng() < 0.5 ? gy + (rng() - 0.5) * gd : gy - (0.3 + rng() * 0.5) * Math.min(Hmax, gy - m);
      /* a scrawl: jittery random walk tethered to its centre, flattened like a mark made with the side of the hand */
      const R = 5 + rng() * 9, n = 40 + Math.round(rng() * 40);
      let x = cx, y = cy, a = rng() * Math.PI * 2;
      const pts = [[x, y]];
      for (let k = 1; k <= n; k++) {
        a += (rng() - 0.5) * 2.4;
        const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy);
        if (d > R) a = Math.atan2(dy, dx) + (rng() - 0.5) * 0.8;
        x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.0;
        pts.push([x, y]);
      }
      emit(pts, rng() < 0.6 ? pen : penL);
    }
    /* ---- wisps: long faint sweeps ---- */
    const nW = Math.max(0, Math.min(80, Math.round(+p.wisps || 0)));
    for (let i = 0; i < nW; i++) {
      let x = m + rng() * (W - 2 * m), y = m + rng() * (H - 2 * m);
      let a = rng() * Math.PI * 2;
      const L = 40 + rng() * 120, n = Math.round(L / 2.5), ph = rng() * 80;
      const pts = [[x, y]];
      for (let k = 1; k <= n; k++) { a += 0.35 * nz(k * 0.15 + ph, i * 0.5, 6); x += Math.cos(a) * 2.5; y += Math.sin(a) * 2.5; if (x < m || x > W - m || y < m || y > H - m) break; pts.push([x, y]); }
      emit(pts, penL);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
