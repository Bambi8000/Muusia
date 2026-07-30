({
  key: "perfmesh",
  name: "Perforated Mesh",
  cat: "gen",
  group: "geometric",
  desc: "A 3D wireframe solid — Sphere, Cube or Pyramid — as an organic quad mesh with hidden faces removed. The sphere is a pole-free cube-sphere; Mesh flow warps the grid with noise so the quads swim across the surface. Mountains raises 4-octave noise terrain radially from the center (continuous across edges), Terrain scale sets feature size. Holes punches funnel craters with a raised rim lip: the global mesh dives into the funnel, concentric collar rings and converging radials draw its curvature, and the center opening is cut through so you look into darkness. Rot X/Y spin the solid, Size fits the projection, Density is mesh lines per direction. Drive Rot Y with the animation clock for a spinning meteor.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "shape", label: "Shape", type: "select", options: ["Sphere", "Cube", "Pyramid"], def: "Sphere" },
    { key: "size", label: "Size", type: "slider", min: 20, max: 280, step: 1, def: 160 },
    { key: "density", label: "Density", type: "slider", min: 6, max: 60, step: 1, def: 30 },
    { key: "flow", label: "Mesh flow", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "mountains", label: "Mountains", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "terrain", label: "Terrain scale", type: "slider", min: 0.5, max: 4, step: 0.05, def: 1.6 },
    { key: "holes", label: "Holes", type: "slider", min: 0, max: 24, step: 1, def: 10 },
    { key: "holesize", label: "Hole size", type: "slider", min: 0.05, max: 0.5, step: 0.01, def: 0.18 },
    { key: "depth", label: "Funnel depth", type: "slider", min: 0, max: 1, step: 0.01, def: 0.65 },
    { key: "sstyle", label: "Surface", type: "select", options: ["Solid (hide back)", "Transparent"], def: "Solid (hide back)" },
    { key: "rx", label: "Rot X", type: "slider", min: -180, max: 180, step: 1, def: -18 },
    { key: "ry", label: "Rot Y", type: "slider", min: -180, max: 180, step: 1, def: 25 },
    { key: "seed", label: "Seed", type: "seed", def: 3 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const shape = p.shape;
    const size = Math.max(10, p.size);
    const dens = Math.max(4, Math.min(90, Math.round(p.density)));
    const flow = Math.max(0, Math.min(1.5, p.flow));
    const amp = Math.max(0, p.mountains) * 0.34;
    const tsc = Math.max(0.1, p.terrain);
    const nHoles = Math.max(0, Math.round(p.holes));
    const holeR = Math.max(0.02, p.holesize);
    const depth = Math.max(0, p.depth) * 0.55;
    const OPEN = 0.35;     // fraction of hole radius cut fully open
    const transp = p.sstyle === "Transparent";
    const LIPEND = 1.5;    // rim lip fades out at this multiple of holeR
    const layer = Math.round(p.layer);
    const clamp01 = (t) => Math.min(1, Math.max(0, t));
    const ss = (t) => t * t * (3 - 2 * t);

    // ---- deterministic 3D value noise on hash2 ----
    const h3 = (xi, yi, zi) => hash2(xi * 3 + zi * 151, yi * 7 + zi * 89, seed * 7 + 13);
    const n3 = (x, y, z) => {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const u = ss(x - xi), v = ss(y - yi), w = ss(z - zi);
      const c000 = h3(xi, yi, zi), c100 = h3(xi + 1, yi, zi), c010 = h3(xi, yi + 1, zi), c110 = h3(xi + 1, yi + 1, zi);
      const c001 = h3(xi, yi, zi + 1), c101 = h3(xi + 1, yi, zi + 1), c011 = h3(xi, yi + 1, zi + 1), c111 = h3(xi + 1, yi + 1, zi + 1);
      const a = (c000 + (c100 - c000) * u) + ((c010 + (c110 - c010) * u) - (c000 + (c100 - c000) * u)) * v;
      const b = (c001 + (c101 - c001) * u) + ((c011 + (c111 - c011) * u) - (c001 + (c101 - c001) * u)) * v;
      return a + (b - a) * w;
    };
    const fbm = (x, y, z) =>
      n3(x, y, z) * 0.5 + n3(x * 2.1 + 7, y * 2.1 + 3, z * 2.1 + 11) * 0.26 +
      n3(x * 4.3 + 31, y * 4.3, z * 4.3 + 5) * 0.15 + n3(x * 8.7 + 3, y * 8.7 + 19, z * 8.7 + 41) * 0.09;

    // ---- shape center, surface projection, hole placement ----
    const C = shape === "Pyramid" ? [0, 0.5, 0] : [0, 0, 0];
    const APEX = [0, -1, 0];
    const CORNERS = [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]];
    const pyrPlanes = (() => {
      const pl = [{ n: [0, 1, 0], p0: [0, 1, 0] }];
      for (let f = 0; f < 4; f++) {
        const C1 = CORNERS[f], C2 = CORNERS[(f + 1) % 4];
        const e = [C2[0] - C1[0], C2[1] - C1[1], C2[2] - C1[2]];
        const g = [APEX[0] - C1[0], APEX[1] - C1[1], APEX[2] - C1[2]];
        let n = [e[1] * g[2] - e[2] * g[1], e[2] * g[0] - e[0] * g[2], e[0] * g[1] - e[1] * g[0]];
        const toC = [C[0] - C1[0], C[1] - C1[1], C[2] - C1[2]];
        if (n[0] * toC[0] + n[1] * toC[1] + n[2] * toC[2] > 0) n = [-n[0], -n[1], -n[2]];
        pl.push({ n, p0: C1 });
      }
      return pl;
    })();
    const surfProject = (P) => {
      if (shape === "Sphere") { const L = Math.hypot(P[0], P[1], P[2]) || 1; return [P[0] / L, P[1] / L, P[2] / L]; }
      if (shape === "Cube") { const m = Math.max(Math.abs(P[0]), Math.abs(P[1]), Math.abs(P[2])) || 1; return [P[0] / m, P[1] / m, P[2] / m]; }
      const d = [P[0] - C[0], P[1] - C[1], P[2] - C[2]];
      let tBest = 1e9;
      for (const pl of pyrPlanes) {
        const dn = pl.n[0] * d[0] + pl.n[1] * d[1] + pl.n[2] * d[2];
        if (Math.abs(dn) < 1e-9) continue;
        const t = (pl.n[0] * (pl.p0[0] - C[0]) + pl.n[1] * (pl.p0[1] - C[1]) + pl.n[2] * (pl.p0[2] - C[2])) / dn;
        if (t > 1e-6 && t < tBest) tBest = t;
      }
      if (tBest > 1e8) return P;
      return [C[0] + d[0] * tBest, C[1] + d[1] * tBest, C[2] + d[2] * tBest];
    };
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const rng = mulberry32(seed * 7919 + 17);
    const surfPoint = () => {
      if (shape === "Sphere") {
        const z = 2 * rng() - 1, a = rng() * Math.PI * 2, r = Math.sqrt(Math.max(0, 1 - z * z));
        return [r * Math.cos(a), z, r * Math.sin(a)];
      }
      if (shape === "Cube") {
        const f = Math.floor(rng() * 6), a = -0.68 + rng() * 1.36, b = -0.68 + rng() * 1.36;
        return [[a, b, -1], [a, b, 1], [a, -1, b], [a, 1, b], [-1, a, b], [1, a, b]][f];
      }
      const f = Math.floor(rng() * 5);
      if (f === 4) { const a = -0.6 + rng() * 1.2, b = -0.6 + rng() * 1.2; return [a, 1, b]; }
      const C1 = CORNERS[f], C2 = CORNERS[(f + 1) % 4];
      const a = 0.2 + rng() * 0.6, b = 0.12 + rng() * 0.5;
      const E = [C1[0] + (C2[0] - C1[0]) * a, C1[1] + (C2[1] - C1[1]) * a, C1[2] + (C2[2] - C1[2]) * a];
      return [E[0] + (APEX[0] - E[0]) * b, E[1] + (APEX[1] - E[1]) * b, E[2] + (APEX[2] - E[2]) * b];
    };
    const holes = [];
    let tries = 0;
    while (holes.length < nHoles && tries < 400) {
      tries++;
      const q = surfPoint();
      if (holes.every((hc) => d3(q, hc) > 2.3 * holeR)) holes.push(q);
    }

    // ---- displaced surface: mountains + funnel with raised rim lip ----
    const disp = (P) => {
      const dx = P[0] - C[0], dy = P[1] - C[1], dz = P[2] - C[2];
      const L = Math.hypot(dx, dy, dz) || 1;
      let dmin = 1e9;
      for (const hc of holes) { const d = d3(P, hc); if (d < dmin) dmin = d; }
      const t = holes.length ? dmin / holeR : 1e9;
      let ds = 0;
      if (amp > 0) {
        const mask = ss(clamp01((t - 1.2) / 0.8));
        ds += amp * (fbm(P[0] * tsc + 9, P[1] * tsc + 4, P[2] * tsc + 2) - 0.45) * 2 * mask;
      }
      if (holes.length && depth > 0 && t < LIPEND) {
        const lip = depth * 0.32;
        if (t < 1) { const q = clamp01((t - OPEN) / (1 - OPEN)); ds += -depth * (1 - ss(q)) + lip * ss(q); }
        else { const q = (t - 1) / (LIPEND - 1); ds += lip * (1 - ss(q)); }
      }
      return { pt: [P[0] + (dx / L) * ds, P[1] + (dy / L) * ds, P[2] + (dz / L) * ds], dmin };
    };

    // ---- rotation ----
    const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180;
    const cx_ = Math.cos(ax), sx_ = Math.sin(ax), cy_ = Math.cos(ay), sy_ = Math.sin(ay);
    const rot = (v) => {
      const y1 = v[1] * cx_ - v[2] * sx_, z1 = v[1] * sx_ + v[2] * cx_;
      return [v[0] * cy_ + z1 * sy_, y1, -v[0] * sy_ + z1 * cy_];
    };

    // ---- patches: quad faces (sphere = projected cube-sphere) + crater collars ----
    const QUADS = [
      { O: [-1, -1, -1], E1: [2, 0, 0], E2: [0, 2, 0] }, { O: [-1, -1, 1], E1: [0, 2, 0], E2: [2, 0, 0] },
      { O: [-1, -1, -1], E1: [0, 0, 2], E2: [2, 0, 0] }, { O: [-1, 1, -1], E1: [2, 0, 0], E2: [0, 0, 2] },
      { O: [-1, -1, -1], E1: [0, 2, 0], E2: [0, 0, 2] }, { O: [1, -1, -1], E1: [0, 0, 2], E2: [0, 2, 0] },
    ];
    const patches = [];
    const quadEv = (q) => (a, b) => {
      const P = [q.O[0] + q.E1[0] * a + q.E2[0] * b, q.O[1] + q.E1[1] * a + q.E2[1] * b, q.O[2] + q.E1[2] * a + q.E2[2] * b];
      return shape === "Sphere" ? surfProject(P) : P;
    };
    if (shape === "Sphere" || shape === "Cube") {
      for (const q of QUADS) patches.push({ ev: quadEv(q), warp: 0.13, a0: 0, a1: 1, b0: 0, b1: 1, ea: 0.012, eb: 0.012, grid: true });
    } else {
      for (let f = 0; f < 4; f++) {
        const C1 = CORNERS[f], C2 = CORNERS[(f + 1) % 4];
        patches.push({
          ev: (a, b) => {
            const ex = C1[0] + (C2[0] - C1[0]) * a, ey = C1[1] + (C2[1] - C1[1]) * a, ez = C1[2] + (C2[2] - C1[2]) * a;
            return [ex + (APEX[0] - ex) * b, ey + (APEX[1] - ey) * b, ez + (APEX[2] - ez) * b];
          },
          warp: 0.11, a0: 0, a1: 1, b0: 0, b1: 0.94, ea: 0.012, eb: 0.01, grid: true,
        });
      }
      patches.push({ ev: (a, b) => [-1 + 2 * a, 1, -1 + 2 * b], warp: 0.13, a0: 0, a1: 1, b0: 0, b1: 1, ea: 0.012, eb: 0.012, grid: true });
    }
    // crater collar patches: local tangent frame at each hole, projected back on the surface
    for (const hc of holes) {
      const n0 = (() => { const d = [hc[0] - C[0], hc[1] - C[1], hc[2] - C[2]]; const L = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / L, d[1] / L, d[2] / L]; })();
      const ref = Math.abs(n0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let t1 = [n0[1] * ref[2] - n0[2] * ref[1], n0[2] * ref[0] - n0[0] * ref[2], n0[0] * ref[1] - n0[1] * ref[0]];
      const L1 = Math.hypot(t1[0], t1[1], t1[2]) || 1; t1 = [t1[0] / L1, t1[1] / L1, t1[2] / L1];
      const t2 = [n0[1] * t1[2] - n0[2] * t1[1], n0[2] * t1[0] - n0[0] * t1[2], n0[0] * t1[1] - n0[1] * t1[0]];
      patches.push({
        ev: (a, b) => surfProject([hc[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * b, hc[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * b, hc[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * b]),
        warp: 0, a0: 0, a1: Math.PI * 2, b0: holeR * (OPEN + 0.04), b1: holeR * 1.35, ea: 0.06, eb: holeR * 0.02, crater: true,
      });
    }

    // ---- lines per patch ----
    const m = Math.max(3, Math.round(dens * 0.5));
    const nRings = Math.max(4, Math.min(9, Math.round(dens / 5)));
    const nRad = Math.max(8, Math.min(28, Math.round(dens * 0.6)));
    for (const pa of patches) {
      pa.lines = [];
      if (pa.grid) {
        const n = m * 2;
        for (let i = 0; i <= m; i++) {
          const s1 = [], s2 = [];
          for (let k = 0; k <= n; k++) {
            s1.push([pa.a0 + (i / m) * (pa.a1 - pa.a0), pa.b0 + (k / n) * (pa.b1 - pa.b0)]);
            s2.push([pa.a0 + (k / n) * (pa.a1 - pa.a0), pa.b0 + (i / m) * (pa.b1 - pa.b0)]);
          }
          pa.lines.push({ smp: s1, closed: false }, { smp: s2, closed: false });
        }
      } else {
        const nA = Math.max(28, m * 2);
        for (let j = 0; j < nRings; j++) {
          const b = pa.b0 + (j / (nRings - 1)) * (pa.b1 - pa.b0);
          const smp = [];
          for (let k = 0; k < nA; k++) smp.push([(k / nA) * Math.PI * 2, b]);
          pa.lines.push({ smp, closed: true });
        }
        for (let j = 0; j < nRad; j++) {
          const a = (j / nRad) * Math.PI * 2;
          const smp = [];
          for (let k = 0; k <= 8; k++) smp.push([a, pa.b1 - (k / 8) * (pa.b1 - pa.b0)]);
          pa.lines.push({ smp, closed: false });
        }
      }
    }

    // ---- param-space flow warp (sampled on the 3D surface → seamless scale) ----
    const warpAB = (pa, a, b) => {
      if (flow <= 0 || !pa.warp) return [a, b];
      const P = pa.ev(a, b);
      const wa = (fbm(P[0] * 1.3 + 31, P[1] * 1.3 + 7, P[2] * 1.3 + 17) - 0.5) * 2 * flow * pa.warp;
      const wb = (fbm(P[0] * 1.3 + 5, P[1] * 1.3 + 43, P[2] * 1.3 + 29) - 0.5) * 2 * flow * pa.warp;
      return [Math.min(pa.a1, Math.max(pa.a0, a + wa)), Math.min(pa.b1, Math.max(pa.b0, b + wb))];
    };

    // ---- evaluate, cull hidden + openings, split into visible runs ----
    const F = (pa, a, b) => { const [wa, wb] = warpAB(pa, a, b); return disp(pa.ev(wa, wb)); };
    const sample = (pa, a, b) => {
      const F0 = F(pa, a, b);
      const Fa = F(pa, a + pa.ea, b).pt, Fb = F(pa, a, b + pa.eb).pt;
      const u = [Fa[0] - F0.pt[0], Fa[1] - F0.pt[1], Fa[2] - F0.pt[2]];
      const v = [Fb[0] - F0.pt[0], Fb[1] - F0.pt[1], Fb[2] - F0.pt[2]];
      let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const base = pa.ev(a, b);
      const rd = [base[0] - C[0], base[1] - C[1], base[2] - C[2]];
      if (nn[0] * rd[0] + nn[1] * rd[1] + nn[2] * rd[2] < 0) nn = [-nn[0], -nn[1], -nn[2]];
      const nr = rot(nn);
      const pt = rot(F0.pt);
      return { a, b, pt, vis: (transp || nr[2] < 0) && F0.dmin >= holeR * OPEN };
    };
    const THR = Math.max(0.05, holeR * 0.3); // refine chords longer than this (3D units)
    const refine = (pa, s0, s1, d, out) => {
      const dd = Math.hypot(s1.pt[0] - s0.pt[0], s1.pt[1] - s0.pt[1], s1.pt[2] - s0.pt[2]);
      if (d <= 0 || dd <= THR || (!s0.vis && !s1.vis)) { out.push(s1); return; }
      const sm = sample(pa, (s0.a + s1.a) / 2, (s0.b + s1.b) / 2);
      refine(pa, s0, sm, d - 1, out);
      refine(pa, sm, s1, d - 1, out);
    };
    const runs3 = [];
    for (const pa of patches) {
      for (const ln of pa.lines) {
        const N = ln.smp.length;
        let S = new Array(N);
        for (let k = 0; k < N; k++) S[k] = sample(pa, ln.smp[k][0], ln.smp[k][1]);
        if (ln.closed) {
          const s0 = S.findIndex((s) => !s.vis);
          if (s0 < 0) {
            // fully visible ring: refine wrap-aware, keep closed
            const seq = [S[0]];
            for (let k = 0; k < N; k++) {
              const nx = k + 1 < N ? S[k + 1] : { ...S[0], a: S[0].a + Math.PI * 2 };
              refine(pa, S[k], nx, 3, seq);
            }
            seq.pop(); // wrap duplicate of the first point
            runs3.push({ pts: seq.map((s) => s.pt), closed: true });
            continue;
          }
          // rotate start to an invisible sample, keep parameter a monotone across the wrap
          S = S.map((_, k) => {
            const src = S[(s0 + k) % N];
            return s0 + k >= N ? { ...src, a: src.a + Math.PI * 2 } : src;
          });
          S.push({ ...S[0], a: S[0].a + Math.PI * 2 });
        }
        const seq = [S[0]];
        for (let k = 1; k < S.length; k++) refine(pa, S[k - 1], S[k], 3, seq);
        let cur = [];
        for (const s of seq) {
          if (s.vis) cur.push(s.pt);
          else { if (cur.length >= 2) runs3.push({ pts: cur, closed: false }); cur = []; }
        }
        if (cur.length >= 2) runs3.push({ pts: cur, closed: false });
      }
    }
    if (!runs3.length) return applyStyle(EMPTY, ins[0]);

    // ---- orthographic projection, fit to Size, center on canvas ----
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const r of runs3) for (const q of r.pts) {
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (-q[1] < y0) y0 = -q[1]; if (-q[1] > y1) y1 = -q[1];
    }
    const s = size / Math.max(x1 - x0, y1 - y0, 1e-6);
    const ox = W / 2 - s * (x0 + x1) / 2, oy = H / 2 - s * (y0 + y1) / 2;
    const clampP = (x, lim) => Math.min(lim - 0.2, Math.max(0.2, x));
    const paths = runs3.map((r) => ({
      pts: r.pts.map((q) => [clampP(q[0] * s + ox, W), clampP(-q[1] * s + oy, H)]),
      closed: r.closed, layer,
    })).filter((pp) => pp.pts.length >= 2);
    return applyStyle({ paths }, ins[0]);
  },
})
