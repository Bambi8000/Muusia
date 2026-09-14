import { Pin, mulberry32, hash2, noise2, applyStyle, fontStrokes } from "../helpers.js";

export default {
  /* Star Chart - a scientific coordinate graticule buried under thousands
     of observation hits, after Roland Kayn's Galaxis chart. Ring bundles,
     radial spokes, degree labels, seeded wear gaps, and a patchy density
     field driving the dots. */
  key: "starchart",
  name: "Star Chart",
  cat: "gen",
  group: "scientific",
  desc: "A coordinate chart drowning in observations. System Polar draws concentric ring bundles (every ring is 1..Band close-set lines with seeded spacing jitter), radial spokes, rim ticks and degree labels around the outer edge, with a clean center Hole for a title; Cartesian rules a banded graph grid with axis numbers instead. Wear breaks the graticule lines into worn seeded fragments and Wobble gives them a drafting hand. Hits scatters up to thousands of dots over the chart through a density field: Patchiness clumps them into drifts and voids, Falloff pulls them outward (+) or toward the center (-), and every dot is a tiny filled polygon between Dot min and Dot max (small ones common, big ones rare). Grid pen and Hit pen split the two layers for a two-colour plot. All placement is seeded and deterministic.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "system", label: "System", type: "select", options: ["Polar", "Cartesian"], def: "Polar" },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "rings", label: "Rings", type: "slider", min: 4, max: 24, step: 1, def: 12 },
    { key: "band", label: "Band", type: "slider", min: 1, max: 5, step: 1, def: 3 },
    { key: "bandgap", label: "Band gap", type: "slider", min: 0.3, max: 2, step: 0.05, def: 0.7 },
    { key: "spokes", label: "Spokes", type: "slider", min: 4, max: 36, step: 1, def: 12, showIf: (p) => p.system === "Polar" },
    { key: "hole", label: "Hole", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.18, showIf: (p) => p.system === "Polar" },
    { key: "labels", label: "Labels", type: "check", def: true },
    { key: "wear", label: "Wear", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "hits", label: "Hits", type: "slider", min: 0, max: 8000, step: 50, def: 3000 },
    { key: "dotmin", label: "Dot min", type: "slider", min: 0.2, max: 2, step: 0.05, def: 0.35 },
    { key: "dotmax", label: "Dot max", type: "slider", min: 0.2, max: 2.5, step: 0.05, def: 0.9 },
    { key: "patchiness", label: "Patchiness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "falloff", label: "Falloff", type: "slider", min: -1, max: 1, step: 0.05, def: 0.15 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "gpen", label: "Grid pen", type: "pen", def: 0 },
    { key: "hpen", label: "Hit pen", type: "pen", def: 0 },
  ],

  overlay(p, ctx, ins, node) {
    const guides = [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
    try {
      if (p.system === "Polar") {
        const R = Math.max(5, Math.min(ctx.W, ctx.H) / 2 - p.margin - (p.labels ? 6 : 0));
        guides.push({ kind: "circle", cx: ctx.W / 2, cy: ctx.H / 2, r: R });
        if (p.hole > 0.01) guides.push({ kind: "circle", cx: ctx.W / 2, cy: ctx.H / 2, r: R * p.hole });
      }
    } catch (e) { /* never throw */ }
    return guides;
  },

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const TAU = Math.PI * 2;
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || used > BUDGET) return;
      used += pts.length;
      paths.push({ pts, closed, layer });
    };
    const gpen = Math.max(0, Math.min(11, Math.round(p.gpen)));
    const hpen = Math.max(0, Math.min(11, Math.round(p.hpen)));
    const kSeed = (p.seed >>> 0) * 101 + 17;
    const rng = mulberry32((p.seed >>> 0) * 7919 + 13);
    const wear = Math.max(0, Math.min(1, p.wear));
    const wob = Math.max(0, p.wobble);
    const cx = W / 2, cy = H / 2;
    const polar = p.system === "Polar";
    const labelPad = p.labels ? 6 : 0;

    const text = (str, tx, ty, h, ang, layer) => {
      const fs = fontStrokes(String(str).toUpperCase(), Math.max(1.5, h), 1);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ox = -fs.width / 2, oy = h / 2;
      for (const st of fs.strokes) {
        if (st.length < 2) continue;
        push(st.map(([sx, sy]) => [tx + (sx + ox) * ca - (sy - oy) * sa, ty + (sx + ox) * sa + (sy - oy) * ca]), false, layer);
      }
    };

    /* draw a parametric graticule line f(t) -> [x,y], t in 0..1, with
       wobble and seeded wear gaps */
    const worn = (f, lenMm, wid, layer, closed) => {
      const n = Math.max(6, Math.ceil(lenMm / 2.2));
      let seg = [];
      let gapUntil = -1;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (i > gapUntil && wear > 0 && hash2(wid, i, kSeed + 31) < wear * 0.05) {
          gapUntil = i + 1 + Math.floor(hash2(wid, i, kSeed + 37) * (2 + wear * 6));
        }
        if (i > gapUntil) {
          const q = f(t);
          const wq = wob > 0.01 ? (noise2(t * 9 + wid * 0.7, wid * 1.9, kSeed + 7) - 0.5) * 2 * wob * 0.5 : 0;
          seg.push([q[0] + wq * q[2], q[1] + wq * q[3]]);
        } else if (seg.length > 1) { push(seg.splice(0), false, layer); }
        else seg.length = 0;
        if (used > BUDGET) break;
      }
      if (seg.length > 1) push(seg, false, closed && seg.length > n * 0.98 ? layer : layer);
    };

    const nRings = Math.max(2, Math.round(p.rings));
    const nBand = Math.max(1, Math.min(5, Math.round(p.band)));
    const bgap = Math.max(0.2, p.bandgap);
    let wid = 0;

    /* density field for hits, in normalized chart coords */
    const dens = (nx, ny, rr) => {
      let d = 1;
      if (p.patchiness > 0) {
        const nv = noise2(nx * 5.2 + 3.3, ny * 5.2 + 8.1, kSeed + 51)
          + 0.5 * noise2(nx * 13.1 + 21.2, ny * 13.1 + 4.4, kSeed + 53);
        d *= Math.max(0, 1 + p.patchiness * (nv / 1.5 - 0.5) * 2.6);
      }
      d *= Math.max(0.02, 1 + p.falloff * (rr - 0.5) * 1.8);
      return Math.min(1, d * 0.72);
    };
    const dot = (x, y) => {
      const t = rng();
      const r = p.dotmin + Math.max(0, p.dotmax - p.dotmin) * t * t;
      const nseg = r > 0.7 ? 7 : 5;
      const pts = [];
      const a0 = rng() * TAU;
      for (let k2 = 0; k2 < nseg; k2++) {
        const a = a0 + (k2 / nseg) * TAU;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      push(pts, true, hpen);
    };

    if (polar) {
      const R = Math.max(5, Math.min(W, H) / 2 - Math.max(0, p.margin) - labelPad);
      const holeR = R * Math.max(0, Math.min(0.9, p.hole));
      /* ring bundles with seeded spacing jitter */
      const radii = [];
      for (let i = 0; i <= nRings; i++) {
        const jr = (rng() - 0.5) * 0.35;
        radii.push(holeR + ((i + (i > 0 && i < nRings ? jr : 0)) / nRings) * (R - holeR));
      }
      for (const r0 of radii) {
        for (let bi = 0; bi < nBand; bi++) {
          if (nBand > 1 && hash2(wid, bi, kSeed + 41) < wear * 0.35) continue;
          const rb = r0 + (bi - (nBand - 1) / 2) * bgap;
          if (rb < 1 || rb > R + bgap) continue;
          const w2 = wid * 7 + bi;
          worn((t) => {
            const a = t * TAU;
            return [cx + Math.cos(a) * rb, cy + Math.sin(a) * rb, Math.cos(a), Math.sin(a)];
          }, TAU * rb, w2, gpen, true);
        }
        wid++;
      }
      /* spokes + rim ticks + labels */
      const nSp = Math.max(2, Math.round(p.spokes));
      for (let si = 0; si < nSp; si++) {
        const a = (si / nSp) * TAU;
        const ca = Math.cos(a), sa = Math.sin(a);
        worn((t) => {
          const r = holeR + t * (R - holeR);
          return [cx + ca * r, cy + sa * r, -sa, ca];
        }, R - holeR, 1000 + si, gpen, false);
        push([[cx + ca * R, cy + sa * R], [cx + ca * (R + 2), cy + sa * (R + 2)]], false, gpen);
        if (p.labels) {
          const deg = Math.round((si / nSp) * 360);
          text(String(deg), cx + ca * (R + 4.2), cy + sa * (R + 4.2), 2.4, a + Math.PI / 2, gpen);
        }
      }
      /* hits in the annulus */
      const nH = Math.max(0, Math.round(p.hits));
      for (let i = 0; i < nH; i++) {
        const rr = Math.sqrt(rng());
        const r = Math.sqrt(holeR * holeR + rr * rr * (R * R - holeR * holeR));
        const a = rng() * TAU;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const keep = rng() < dens(x / W, y / H, (r - holeR) / Math.max(1, R - holeR));
        if (!keep) continue;
        if (r < holeR + p.dotmax + 0.3 || r > R - 0.2) continue;
        dot(x, y);
        if (used > BUDGET) break;
      }
    } else {
      /* Cartesian: banded rules both ways + axis numbers + hits in the box */
      const x0 = Math.max(0, p.margin) + labelPad, y0 = Math.max(0, p.margin) + 2;
      const x1 = W - Math.max(0, p.margin) - 2, y1 = H - Math.max(0, p.margin) - labelPad;
      const cols = Math.max(2, Math.round((nRings * (x1 - x0)) / Math.max(1, y1 - y0)));
      for (let i = 0; i <= nRings; i++) {
        const jy = i > 0 && i < nRings ? (rng() - 0.5) * 0.3 : 0;
        const yy = y0 + ((i + jy) / nRings) * (y1 - y0);
        for (let bi = 0; bi < nBand; bi++) {
          if (nBand > 1 && hash2(wid, bi, kSeed + 41) < wear * 0.35) continue;
          const yb = yy + (bi - (nBand - 1) / 2) * bgap;
          if (yb < y0 - bgap || yb > y1 + bgap) continue;
          worn((t) => [x0 + t * (x1 - x0), yb, 0, 1], x1 - x0, wid * 7 + bi, gpen, false);
        }
        wid++;
        if (p.labels && i < nRings) text(String((nRings - i) * 10), x0 - 4, y0 + (i / nRings) * (y1 - y0), 2.2, 0, gpen);
      }
      for (let i = 0; i <= cols; i++) {
        const jx = i > 0 && i < cols ? (rng() - 0.5) * 0.3 : 0;
        const xx = x0 + ((i + jx) / cols) * (x1 - x0);
        for (let bi = 0; bi < nBand; bi++) {
          if (nBand > 1 && hash2(wid, bi, kSeed + 43) < wear * 0.35) continue;
          const xb = xx + (bi - (nBand - 1) / 2) * bgap;
          if (xb < x0 - bgap || xb > x1 + bgap) continue;
          worn((t) => [xb, y0 + t * (y1 - y0), 1, 0], y1 - y0, wid * 7 + bi, gpen, false);
        }
        wid++;
        if (p.labels && i > 0) text(String(i * 10), x0 + (i / cols) * (x1 - x0), y1 + 4, 2.2, 0, gpen);
      }
      const nH = Math.max(0, Math.round(p.hits));
      for (let i = 0; i < nH; i++) {
        const x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0);
        const rr = Math.hypot(x - (x0 + x1) / 2, y - (y0 + y1) / 2) / (Math.hypot(x1 - x0, y1 - y0) / 2);
        const keep = rng() < dens(x / W, y / H, Math.min(1, rr));
        if (!keep) continue;
        if (x < x0 + p.dotmax || x > x1 - p.dotmax || y < y0 + p.dotmax || y > y1 - p.dotmax) continue;
        dot(x, y);
        if (used > BUDGET) break;
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
