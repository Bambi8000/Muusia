import { Pin, EMPTY, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "pebble",
  name: "Pebble",
  cat: "gen",
  group: "nature",
  desc: "A rock two ways. Spiral shells fills a pebble outline with continuous spirals that wind from the edge into 1–3 eye points — shells pack tight at the boundary (Edge packing) and Weave rotates each turn so the shells cross into a moiré net, like a woven stone; Rot Y spins the drawing and Rot X tilts it flat. Mesh renders the same rock as a 3D wireframe (quad mesh; Surface picks Solid with hidden faces removed, or Transparent to see the back through, Rot X/Y to spin). Round–Angular morphs the form from a smooth pebble to a faceted chunk: in 2D a blurred blob sharpens into a polygon, in 3D a noise boulder blends into a convex plane-cut rock. Facets sets the corner/plane count, Irregular the radius variance, Detail adds fine surface noise. Distinct from Stone (flat facet illustration): Pebble is about the shell/mesh line systems.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Render", type: "select", options: ["Spiral shells", "Mesh"], def: "Spiral shells" },
    { key: "size", label: "Size", type: "slider", min: 20, max: 280, step: 1, def: 170 },
    { key: "angular", label: "Round–Angular", type: "slider", min: 0, max: 1, step: 0.01, def: 0.2 },
    { key: "irregular", label: "Irregular", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "facets", label: "Facets", type: "slider", min: 5, max: 24, step: 1, def: 9 },
    { key: "detail", label: "Detail", type: "slider", min: 0, max: 1, step: 0.01, def: 0.15 },
    { key: "eyes", label: "Eyes", type: "slider", min: 1, max: 3, step: 1, def: 2 },
    { key: "turns", label: "Shell turns", type: "slider", min: 10, max: 120, step: 1, def: 45 },
    { key: "pack", label: "Edge packing", type: "slider", min: 0.5, max: 3, step: 0.05, def: 1.5 },
    { key: "weave", label: "Weave", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "density", label: "Mesh density", type: "slider", min: 6, max: 60, step: 1, def: 28 },
    { key: "sstyle", label: "Surface", type: "select", options: ["Solid (hide back)", "Transparent"], def: "Solid (hide back)" },
    { key: "rx", label: "Rot X", type: "slider", min: -180, max: 180, step: 1, def: -15 },
    { key: "ry", label: "Rot Y", type: "slider", min: -180, max: 180, step: 1, def: 20 },
    { key: "outline", label: "Outline", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 4 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const size = Math.max(10, p.size);
    const angular = Math.max(0, Math.min(1, p.angular));
    const irr = Math.max(0, Math.min(1.5, p.irregular));
    const M = Math.max(3, Math.min(40, Math.round(p.facets)));
    const detail = Math.max(0, p.detail);
    const layer = Math.round(p.layer);
    const TAU = Math.PI * 2;

    // ================= Spiral shells (2D) =================
    if (p.mode === "Spiral shells") {
      const rng = mulberry32(seed * 7919 + 3);
      // star-shaped polygon: sorted angle-jittered vertices with random radii
      const verts = [];
      for (let i = 0; i < M; i++) {
        const a = (i / M) * TAU + (rng() - 0.5) * (TAU / M) * 0.8;
        const r = 1 - irr * 0.4 + rng() * irr * 0.75;
        verts.push([a, r]);
      }
      verts.sort((u, v) => u[0] - v[0]);
      // ray-cast polygon radius per angle bin, then blur by roundness
      const NB = 512;
      let rLUT = new Float32Array(NB);
      for (let b = 0; b < NB; b++) {
        const th = (b / NB) * TAU;
        let ri = 1;
        for (let i = 0; i < M; i++) {
          const [a0, r0] = verts[i], [a1r, r1] = verts[(i + 1) % M];
          let a1 = a1r; if (a1 <= a0) a1 += TAU;
          let t = th; if (t < a0) t += TAU;
          if (t >= a0 && t <= a1) {
            const P0 = [Math.cos(a0) * r0, Math.sin(a0) * r0], P1 = [Math.cos(a1) * r1, Math.sin(a1) * r1];
            const dx = Math.cos(th), dy = Math.sin(th);
            const ex = P1[0] - P0[0], ey = P1[1] - P0[1];
            const den = dx * ey - dy * ex;
            if (Math.abs(den) > 1e-9) ri = (P0[0] * ey - P0[1] * ex) / den;
            break;
          }
        }
        rLUT[b] = Math.max(0.15, ri);
      }
      const win = Math.max(0, Math.round(Math.pow(1 - angular, 1.6) * 55));
      for (let pass = 0; pass < 3 && win > 0; pass++) {
        const out = new Float32Array(NB);
        for (let b = 0; b < NB; b++) {
          let s = 0;
          for (let k = -win; k <= win; k++) s += rLUT[(b + k + NB * 4) % NB];
          out[b] = s / (2 * win + 1);
        }
        rLUT = out;
      }
      if (detail > 0) for (let b = 0; b < NB; b++)
        rLUT[b] += (noise2(Math.cos((b / NB) * TAU) * 3 + 9, Math.sin((b / NB) * TAU) * 3, seed * 5 + 1) - 0.5) * 2 * detail * 0.06;
      let rMax = 0;
      for (let b = 0; b < NB; b++) rMax = Math.max(rMax, rLUT[b]);
      const B = (th) => {
        const f = (((th / TAU) % 1) + 1) % 1 * NB;
        const b0 = Math.floor(f) % NB, b1 = (b0 + 1) % NB, ft = f - Math.floor(f);
        return (rLUT[b0] + (rLUT[b1] - rLUT[b0]) * ft) / rMax;
      };
      const S = Math.min(size / 2, W / 2 - 2, H / 2 - 2), cx = W / 2, cy = H / 2;
      /* Rot Y spins the drawing in-plane; Rot X tilts it (vertical foreshortening) */
      const spin = (p.ry * Math.PI) / 180, cS = Math.cos(spin), sS = Math.sin(spin);
      const tilt = Math.max(0.12, Math.abs(Math.cos((p.rx * Math.PI) / 180)));
      const xf = ([x, y]) => {
        const dx = x - cx, dy = y - cy;
        return [cx + dx * cS - dy * sS, cy + (dx * sS + dy * cS) * tilt];
      };
      const pt = (th, t, ex, ey) => {
        const r = B(th) * S;
        const bx = cx + Math.cos(th) * r, by = cy + Math.sin(th) * r;
        return xf([bx + (ex - bx) * t, by + (ey - by) * t]);
      };
      const paths = [];
      // eyes inside the shape
      const nE = Math.max(1, Math.min(3, Math.round(p.eyes)));
      const eyes = [];
      for (let e = 0; e < nE; e++) {
        const a = rng() * TAU, f = 0.15 + rng() * 0.4;
        eyes.push([cx + Math.cos(a) * B(a) * S * f, cy + Math.sin(a) * B(a) * S * f, rng() * TAU]);
      }
      const turns = Math.max(3, Math.round(p.turns));
      const pack = Math.max(0.3, p.pack);
      const weave = Math.max(0, Math.min(1.5, p.weave));
      const perTurn = Math.max(48, Math.min(160, Math.round(1500 / Math.sqrt(turns))));
      const total = turns * perTurn;
      for (const [ex, ey, ph] of eyes) {
        const pts = [];
        for (let k = 0; k <= total; k++) {
          const u = k / total;
          const t = Math.pow(u, pack) * 0.995;
          const th = u * turns * TAU + ph + weave * t * 2.6;
          pts.push(pt(th, t, ex, ey));
        }
        paths.push({ pts, closed: false, layer });
      }
      if (p.outline) {
        const pts = [];
        for (let b = 0; b <= 360; b++) pts.push(pt((b / 360) * TAU, 0, 0, 0));
        pts.pop();
        paths.push({ pts, closed: true, layer });
      }
      return applyStyle({ paths }, ins[0]);
    }

    // ================= Mesh (3D rock) =================
    const dens = Math.max(4, Math.min(90, Math.round(p.density)));
    const transp = p.sstyle === "Transparent";
    const h3 = (xi, yi, zi) => hash2(xi * 3 + zi * 151, yi * 7 + zi * 89, seed * 7 + 13);
    const ss = (t) => t * t * (3 - 2 * t);
    const n3 = (x, y, z) => {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const u = ss(x - xi), v = ss(y - yi), w = ss(z - zi);
      const c000 = h3(xi, yi, zi), c100 = h3(xi + 1, yi, zi), c010 = h3(xi, yi + 1, zi), c110 = h3(xi + 1, yi + 1, zi);
      const c001 = h3(xi, yi, zi + 1), c101 = h3(xi + 1, yi, zi + 1), c011 = h3(xi, yi + 1, zi + 1), c111 = h3(xi + 1, yi + 1, zi + 1);
      const a = (c000 + (c100 - c000) * u) + ((c010 + (c110 - c010) * u) - (c000 + (c100 - c000) * u)) * v;
      const b = (c001 + (c101 - c001) * u) + ((c011 + (c111 - c011) * u) - (c001 + (c101 - c001) * u)) * v;
      return a + (b - a) * w;
    };
    const fbm = (x, y, z) => n3(x, y, z) * 0.55 + n3(x * 2.1 + 7, y * 2.1 + 3, z * 2.1 + 11) * 0.28 + n3(x * 4.3 + 31, y * 4.3, z * 4.3 + 5) * 0.17;
    // convex plane-cut rock: M random planes
    const rng = mulberry32(seed * 7919 + 3);
    const planes = [];
    for (let i = 0; i < M; i++) {
      const z = 2 * rng() - 1, a = rng() * TAU, r = Math.sqrt(Math.max(0, 1 - z * z));
      planes.push({ n: [r * Math.cos(a), z, r * Math.sin(a)], d: 0.72 + rng() * 0.45 * (0.4 + irr) });
    }
    const radius = (d) => {
      let rf = 2.2;
      for (const pl of planes) {
        const dn = d[0] * pl.n[0] + d[1] * pl.n[1] + d[2] * pl.n[2];
        if (dn > 1e-4) rf = Math.min(rf, pl.d / dn);
      }
      rf = Math.min(rf, 1.6);
      const rs = 1 + (fbm(d[0] * 1.4 + 9, d[1] * 1.4 + 4, d[2] * 1.4 + 2) - 0.5) * 2 * irr * 0.35;
      let r = rs + (rf - rs) * angular;
      if (detail > 0) r += (fbm(d[0] * 4.5 + 3, d[1] * 4.5 + 19, d[2] * 4.5 + 41) - 0.5) * 2 * detail * 0.1;
      return Math.max(0.2, r);
    };
    const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180;
    const cX = Math.cos(ax), sX = Math.sin(ax), cY = Math.cos(ay), sY = Math.sin(ay);
    const rot = (v) => {
      const y1 = v[1] * cX - v[2] * sX, z1 = v[1] * sX + v[2] * cX;
      return [v[0] * cY + z1 * sY, y1, -v[0] * sY + z1 * cY];
    };
    const QUADS = [
      { O: [-1, -1, -1], E1: [2, 0, 0], E2: [0, 2, 0] }, { O: [-1, -1, 1], E1: [0, 2, 0], E2: [2, 0, 0] },
      { O: [-1, -1, -1], E1: [0, 0, 2], E2: [2, 0, 0] }, { O: [-1, 1, -1], E1: [2, 0, 0], E2: [0, 0, 2] },
      { O: [-1, -1, -1], E1: [0, 2, 0], E2: [0, 0, 2] }, { O: [1, -1, -1], E1: [0, 0, 2], E2: [0, 2, 0] },
    ];
    const ev = (q, a, b) => {
      const P = [q.O[0] + q.E1[0] * a + q.E2[0] * b, q.O[1] + q.E1[1] * a + q.E2[1] * b, q.O[2] + q.E1[2] * a + q.E2[2] * b];
      const L = Math.hypot(P[0], P[1], P[2]) || 1;
      const d = [P[0] / L, P[1] / L, P[2] / L];
      const r = radius(d);
      return [d[0] * r, d[1] * r, d[2] * r];
    };
    const m = Math.max(3, Math.round(dens * 0.5));
    const runs3 = [];
    const e = 0.011;
    for (const q of QUADS) {
      const lines = [];
      const n = m * 2;
      for (let i = 0; i <= m; i++) {
        const s1 = [], s2 = [];
        for (let k = 0; k <= n; k++) { s1.push([i / m, k / n]); s2.push([k / n, i / m]); }
        lines.push(s1, s2);
      }
      for (const smp of lines) {
        let cur = [];
        for (const [a, b] of smp) {
          const F0 = ev(q, a, b), Fa = ev(q, a + e, b), Fb = ev(q, a, b + e);
          const u = [Fa[0] - F0[0], Fa[1] - F0[1], Fa[2] - F0[2]];
          const v = [Fb[0] - F0[0], Fb[1] - F0[1], Fb[2] - F0[2]];
          let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          if (nn[0] * F0[0] + nn[1] * F0[1] + nn[2] * F0[2] < 0) nn = [-nn[0], -nn[1], -nn[2]];
          const nr = rot(nn);
          if (transp || nr[2] < 0) cur.push(rot(F0));
          else { if (cur.length >= 2) runs3.push(cur); cur = []; }
        }
        if (cur.length >= 2) runs3.push(cur);
      }
    }
    if (!runs3.length) return applyStyle(EMPTY, ins[0]);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const r of runs3) for (const q of r) {
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (-q[1] < y0) y0 = -q[1]; if (-q[1] > y1) y1 = -q[1];
    }
    const s = size / Math.max(x1 - x0, y1 - y0, 1e-6);
    const ox = W / 2 - (s * (x0 + x1)) / 2, oy = H / 2 - (s * (y0 + y1)) / 2;
    const clampP = (x, lim) => Math.min(lim - 0.2, Math.max(0.2, x));
    const paths = runs3.map((r) => ({
      pts: r.map((q) => [clampP(q[0] * s + ox, W), clampP(-q[1] * s + oy, H)]),
      closed: false, layer,
    }));
    return applyStyle({ paths }, ins[0]);
  },
};
