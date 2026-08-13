import { Pin, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "ink_burst",
  name: "Ink Burst",
  cat: "gen",
  group: "organic",
  desc: "A decalcomania squash print - the radial ink burst you get pressing paint between two surfaces and pulling them apart. A dense striated core radiates fine wavy filaments around a blank center void; a coherent noise field bends neighboring filaments together into the classic suction channels, and Breakup tears them into lens-shaped gaps. Beyond the body, Tendrils launch outward with a long-tail length distribution (Reach), curling as they go (Curl), and every one ends in an ink droplet drawn as the SAME continuous stroke - the stem flows straight into an inward spiral fill, one pen-down per tendril. Beads sprinkles small droplets along the stems, and stray blobs spatter the mid ring. Aspect squeezes the burst into an oval, Edge roughens the outline. Everything is seeded and every filament, tendril and droplet is unique. Tip: this loves a thick pen; run two seeds on the same sheet with Transparent-style layering for a double-pull monotype look.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "radius", label: "Radius mm", type: "slider", min: 20, max: 140, step: 1, def: 70 },
    { key: "aspect", label: "Aspect (w/h)", type: "slider", min: 0.5, max: 1.5, step: 0.01, def: 0.85 },
    { key: "edge", label: "Edge roughness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "core", label: "Core void", type: "slider", min: 0.03, max: 0.5, step: 0.01, def: 0.12 },
    { key: "body", label: "Body fraction", type: "slider", min: 0.3, max: 0.85, step: 0.01, def: 0.55 },
    { key: "striae", label: "Filament density", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "wobble", label: "Filament wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "breakup", label: "Breakup", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "tendrils", label: "Tendrils", type: "slider", min: 10, max: 300, step: 1, def: 130 },
    { key: "reach", label: "Reach", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "curl", label: "Curl", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "blob", label: "Droplet size mm", type: "slider", min: 0.5, max: 6, step: 0.1, def: 2.6 },
    { key: "beads", label: "Beads", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "seed", label: "Seed", type: "seed", def: 1 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
  ],
  _geom(p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const a = Math.max(0.4, Math.min(2, p.aspect));
    const ax = a <= 1 ? a : 1;
    const ay = a <= 1 ? 1 : 1 / a;
    const body = Math.max(0.3, Math.min(0.85, p.body));
    const reach = Math.max(0, Math.min(1, p.reach));
    const blob = Math.max(0.2, p.blob);
    const edge = Math.max(0, Math.min(1, p.edge));
    /* farthest possible ink: tendril start (body*1.1*edge bulge) + stem + droplet spiral (1.8*blob) */
    const eMax = 1 + edge * 0.3;
    const F = body * 1.1 * eMax + 0.08 + reach * 0.9;
    const head = blob * 1.9 + 3.5;
    const Rlim = Math.min(
      (W / 2 - m - head) / (F * ax),
      (H / 2 - m - head) / (F * ay)
    );
    const R = Math.min(Math.max(1, p.radius), Rlim);
    return { cx: W / 2, cy: H / 2, R, ax, ay, body, reach, blob, F, m };
  },
  overlay(p, ctx) {
    const g = this._geom(p, ctx);
    if (g.R < 5) return [];
    const ell = (r) => {
      const pts = [];
      for (let k = 0; k < 64; k++) {
        const t = (k / 64) * Math.PI * 2;
        pts.push([g.cx + Math.cos(t) * r * g.ax, g.cy + Math.sin(t) * r * g.ay]);
      }
      return { kind: "poly", pts };
    };
    return [ell(g.R * g.F), ell(g.R * g.body), ell(g.R * Math.max(0.03, Math.min(0.5, p.core)))];
  },
  compute(ins, p, ctx) {
    const g = this._geom(p, ctx);
    if (g.R < 5) return applyStyle({ paths: [] }, ins[0]);
    const { cx, cy, R, ax, ay, body, reach, blob } = g;
    const L = Math.round(p.layer);
    const seed = Math.round(p.seed);
    const core = Math.max(0.03, Math.min(0.5, p.core));
    const edge = Math.max(0, Math.min(1, p.edge));
    const wobble = Math.max(0, Math.min(1, p.wobble));
    const breakup = Math.max(0, Math.min(1, p.breakup));
    const beads = Math.max(0, Math.min(1, p.beads));
    const curl = Math.max(0, Math.min(1, p.curl));
    const nT = Math.max(1, Math.min(400, Math.round(p.tendrils)));

    const paths = [];
    const BUDGET = 110000;
    let pts_total = 0;
    const push = (pts, closed) => {
      if (pts.length < 2 || pts_total > BUDGET) return;
      pts_total += pts.length;
      paths.push({ pts, closed: !!closed, layer: L });
    };
    const P = (th, r) => [cx + Math.cos(th) * r * ax, cy + Math.sin(th) * r * ay];
    /* seamless outline roughness sampled on a circle */
    const eAt = (th) => 1 + edge * 0.3 * (noise2(Math.cos(th) * 1.8 + 7, Math.sin(th) * 1.8 + 7, seed + 13) - 0.5) * 2;
    /* inward spiral droplet: continues an existing stroke from entry point pE toward center C */
    const spiral = (out, C, rb, dirx, diry) => {
      let a0 = Math.atan2(-diry, -dirx); /* outer start faces back toward the stem */
      let ang = a0, r = rb;
      const pitch = Math.max(0.42, rb / 10);
      let guard = 0;
      while (r > 0.15 && guard++ < 1200 && pts_total + out.length < BUDGET) {
        const da = 0.7 / Math.max(r, 0.35);
        ang += da;
        r = rb - (pitch * (ang - a0)) / (Math.PI * 2);
        if (r <= 0.15) break;
        out.push([C[0] + Math.cos(ang) * r, C[1] + Math.sin(ang) * r]);
      }
    };

    /* ---- 1. striated body: radial filaments through a coherent bend field ---- */
    const nS = Math.round(Math.max(0, Math.min(1, p.striae)) * 440);
    for (let i = 0; i < nS; i++) {
      const th = (i / nS) * Math.PI * 2 + (hash2(i, 7, seed + 3) - 0.5) * ((Math.PI * 2) / nS) * 0.8;
      const e = eAt(th);
      const rC = core * R * (0.85 + 0.3 * hash2(i, 11, seed + 5));
      const rB = body * R * e * (0.9 + 0.2 * hash2(i, 17, seed + 9));
      if (rB - rC < 2) continue;
      const ux0 = Math.cos(th) * ax, uy0 = Math.sin(th) * ay;
      const ul = Math.hypot(ux0, uy0), ux = ux0 / ul, uy = uy0 / ul;
      let run = [];
      for (let r = rC; r <= rB; r += 0.8) {
        const [x0, y0] = P(th, r);
        const gap = noise2(x0 * 0.12, y0 * 0.12, seed + 77);
        if (gap < breakup * 0.42) {
          if (run.length >= 2) push(run, false);
          run = [];
          continue;
        }
        const anchor = Math.min(1, (r - rC) / 4);
        const d = wobble * 2.4 * anchor * (noise2(x0 * 0.055, y0 * 0.055, seed + 31) - 0.5) * 2;
        run.push([x0 - uy * d, y0 + ux * d]);
      }
      if (run.length >= 2) push(run, false);
    }

    /* ---- 2. tendrils: curling stems that flow into an inward-spiral droplet ---- */
    for (let t = 0; t < nT; t++) {
      const rng = mulberry32(seed * 7919 + t * 613 + 101);
      const th = rng() * Math.PI * 2;
      const rS = body * R * eAt(th) * (0.85 + 0.25 * rng());
      const len = R * (0.08 + Math.pow(rng(), 1.6) * reach * 0.9);
      let [x, y] = P(th, rS);
      let dx = Math.cos(th) * ax, dy = Math.sin(th) * ay;
      const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
      const pts = [[x, y]];
      const n = Math.max(2, Math.ceil(len / 1.0));
      for (let k = 1; k <= n; k++) {
        const rot = curl * 0.28 * (noise2(k * 0.3, t * 7.7, seed + 41) - 0.5) * 2;
        const c = Math.cos(rot), s = Math.sin(rot);
        const ndx = dx * c - dy * s, ndy = dx * s + dy * c;
        dx = ndx; dy = ndy;
        x += dx; y += dy;
        pts.push([x, y]);
        /* beads: small detached droplets along the first 80% of the stem */
        if (k < n * 0.8 && rng() < beads * 0.1) {
          const br = blob * 0.18 * (0.5 + rng());
          const side = rng() < 0.5 ? 1 : -1;
          const B = [x - dy * side * (br + 0.6), y + dx * side * (br + 0.6)];
          const bpts = [[B[0] + br, B[1]]];
          spiral(bpts, B, br, -1, 0);
          push(bpts, false);
        }
      }
      const rb = blob * (0.2 + Math.pow(rng(), 1.8) * 0.8);
      const C = [x + dx * rb * 0.8, y + dy * rb * 0.8];
      spiral(pts, C, rb, dx, dy);
      push(pts, false);
    }

    /* ---- 3. stray spatter in the mid ring ---- */
    const nSp = Math.round(12 + nT * 0.18);
    for (let q = 0; q < nSp; q++) {
      const rng = mulberry32(seed * 7919 + q * 271 + 907);
      const th = rng() * Math.PI * 2;
      const r = R * (core * 1.4 + rng() * body);
      const rb = blob * (0.15 + Math.pow(rng(), 1.5) * 0.45);
      const [x, y] = P(th, r);
      const pts = [[x + rb, y]];
      spiral(pts, [x, y], rb, -1, 0);
      push(pts, false);
    }

    return applyStyle({ paths }, ins[0]);
  },
};
