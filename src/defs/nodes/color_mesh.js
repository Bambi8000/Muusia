import { Pin, mulberry32, hash2, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "color_mesh",
  name: "Color Mesh",
  cat: "gen",
  group: "geometric",
  desc: "Crumpled-paper facet field filled with fine cross-hatch mesh. The sheet is fractured into convex facets by random straight cuts; each facet gets its own hatch angle and a line-spacing gradient aligned to a global Light angle, so facets shade like folded paper. Facets take pens from a coarse noise field (First pen + Pens used) forming large color regions. Mode 3D lifts every facet corner to a deterministic height (Relief) and tilts the whole sheet (Tilt): hatch lines bend over the folds, facets facing away from the Light get a denser mesh (true Lambert shading), and the result is refit to the margin box. Spacing sets fineness, Shading the in-facet gradient, Angle spread the per-facet twist. Outline draws facet borders (folded too in 3D).",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Flat", "3D"], def: "Flat" },
    { key: "cuts", label: "Facets", type: "slider", min: 0, max: 60, step: 1, def: 16 },
    { key: "spacing", label: "Spacing (mm)", type: "slider", min: 0.3, max: 3, step: 0.05, def: 0.7 },
    { key: "contrast", label: "Shading", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "cross", label: "Cross hatch", type: "check", def: true },
    { key: "angle", label: "Angle", type: "slider", min: 0, max: 180, step: 1, def: 30 },
    { key: "spread", label: "Angle spread", type: "slider", min: 0, max: 90, step: 1, def: 30 },
    { key: "light", label: "Light angle", type: "slider", min: 0, max: 360, step: 1, def: 315 },
    { key: "relief", label: "Relief (mm)", type: "slider", min: 0, max: 40, step: 0.5, def: 14 },
    { key: "tilt", label: "Tilt", type: "slider", min: 0, max: 75, step: 1, def: 35 },
    { key: "pensn", label: "Pens used", type: "slider", min: 1, max: 6, step: 1, def: 3 },
    { key: "pen", label: "First pen", type: "pen", def: 0 },
    { key: "patch", label: "Color patch (mm)", type: "slider", min: 20, max: 150, step: 1, def: 70 },
    { key: "outline", label: "Outline facets", type: "check", def: false },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const margin = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 2));
    const seed = Math.round(p.seed);
    const rng = mulberry32(seed * 7919 + 13);
    const spacing = Math.max(0.2, p.spacing);
    const contrast = Math.max(0, Math.min(1, p.contrast));
    const cuts = Math.max(0, Math.min(200, Math.round(p.cuts)));
    const spread = (Math.max(0, Math.min(180, p.spread)) * Math.PI) / 180;
    const baseA = (p.angle * Math.PI) / 180;
    const lightA = (p.light * Math.PI) / 180;
    const Lx = Math.cos(lightA), Ly = Math.sin(lightA);
    const pensn = Math.max(1, Math.min(12, Math.round(p.pensn)));
    const pen0 = ((Math.round(p.pen) % 12) + 12) % 12;
    const patch = Math.max(5, p.patch);
    const is3D = p.mode === "3D";
    const relief = is3D ? Math.max(0, Math.min(80, p.relief)) : 0;
    const tilt = is3D ? (Math.max(0, Math.min(85, p.tilt)) * Math.PI) / 180 : 0;

    const area = (poly) => {
      let a = 0;
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        a += x1 * y2 - x2 * y1;
      }
      return Math.abs(a) / 2;
    };
    const centroid = (poly) => {
      let cx = 0, cy = 0;
      for (const [x, y] of poly) { cx += x; cy += y; }
      return [cx / poly.length, cy / poly.length];
    };
    const clipHalf = (poly, px, py, nx, ny, keepPos) => {
      const out = [];
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        const da = (a[0] - px) * nx + (a[1] - py) * ny;
        const db = (b[0] - px) * nx + (b[1] - py) * ny;
        const ain = keepPos ? da >= 0 : da <= 0;
        const bin = keepPos ? db >= 0 : db <= 0;
        if (ain) out.push(a);
        if (ain !== bin) {
          const t = da / (da - db);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      return out;
    };

    let facets = [[[margin, margin], [W - margin, margin], [W - margin, H - margin], [margin, H - margin]]];
    for (let c = 0; c < cuts; c++) {
      let bi = 0, ba = -1;
      for (let i = 0; i < facets.length; i++) {
        const a = area(facets[i]);
        if (a > ba) { ba = a; bi = i; }
      }
      if (ba < 30) break;
      const poly = facets[bi];
      const [cx, cy] = centroid(poly);
      const jx = cx + (rng() - 0.5) * Math.sqrt(ba) * 0.5;
      const jy = cy + (rng() - 0.5) * Math.sqrt(ba) * 0.5;
      const ca = rng() * Math.PI;
      const nx = Math.cos(ca), ny = Math.sin(ca);
      const A = clipHalf(poly, jx, jy, nx, ny, true);
      const B = clipHalf(poly, jx, jy, nx, ny, false);
      if (A.length < 3 || B.length < 3 || area(A) < 4 || area(B) < 4) continue;
      facets.splice(bi, 1, A, B);
    }

    const zof = (x, y) => relief * (hash2(x * 53.17 + 400000, y * 53.17 + 400000, seed + 7) - 0.5);
    const ELEV = (50 * Math.PI) / 180;
    const L3 = [Math.cos(lightA) * Math.cos(ELEV), Math.sin(lightA) * Math.cos(ELEV), Math.sin(ELEV)];
    const b0 = Math.sin(ELEV);
    const innerArea = area(facets.length ? [[margin, margin], [W - margin, margin], [W - margin, H - margin], [margin, H - margin]] : []) || 1;
    const fam = p.cross ? 2 : 1;
    const lenEst = (fam * innerArea) / spacing;
    const step3 = Math.max(2.2, Math.min(6, lenEst / 90000 * 2.2 > 2.2 ? lenEst / 90000 * 2.2 : 2.2));

    const paths = [];
    let ptCount = 0;
    const hatchFacet = (poly, th, s0, s1, flip, layer, lift) => {
      const cu = Math.cos(th), su = Math.sin(th);
      const uv = poly.map(([x, y]) => [x * cu + y * su, -x * su + y * cu]);
      let vMin = Infinity, vMax = -Infinity;
      for (const [, v] of uv) { if (v < vMin) vMin = v; if (v > vMax) vMax = v; }
      const span = vMax - vMin;
      if (span < s0 * 0.5) return;
      let v = vMin, dir = 0;
      for (let guard = 0; guard < 4000; guard++) {
        const t0 = (v - vMin) / span;
        const tt = flip ? 1 - t0 : t0;
        v += s0 + (s1 - s0) * Math.max(0, Math.min(1, tt));
        if (v >= vMax - 1e-9) break;
        const hits = [];
        const n = uv.length;
        for (let i = 0; i < n; i++) {
          const a = uv[i], b = uv[(i + 1) % n];
          const da = a[1] - v, db = b[1] - v;
          if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
            const t = da / (da - db);
            hits.push(a[0] + (b[0] - a[0]) * t);
          }
        }
        if (hits.length < 2) continue;
        hits.sort((a, b) => a - b);
        let u0 = hits[0], u1 = hits[hits.length - 1];
        if (u1 - u0 < 0.3) continue;
        if (dir % 2 === 1) { const t = u0; u0 = u1; u1 = t; }
        dir++;
        let pts = [
          [u0 * cu - v * su, u0 * su + v * cu],
          [u1 * cu - v * su, u1 * su + v * cu],
        ];
        if (lift) pts = lift(pts, false);
        ptCount += pts.length;
        paths.push({ pts, closed: false, layer });
      }
    };

    const s0g = spacing * (1 - 0.72 * contrast);
    const s1g = spacing * (1 + 2.4 * contrast);
    for (const poly of facets) {
      if (area(poly) < 4) continue;
      if (ptCount > 112000) break;
      const [cx, cy] = centroid(poly);
      const r = mulberry32(seed * 7919 + Math.round(cx * 7) * 613 + Math.round(cy * 7) * 31 + 5);
      const th = baseA + (r() - 0.5) * spread;
      const zn = noise2(cx / patch + 41.3, cy / patch + 17.9, seed + 101);
      const layer = (pen0 + Math.min(pensn - 1, Math.floor(zn * pensn))) % 12;

      let lift = null;
      let m = 1;
      if (is3D) {
        const C = [cx, cy, zof(cx, cy)];
        const V = poly.map(([x, y]) => [x, y, zof(x, y)]);
        let nx3 = 0, ny3 = 0, nz3 = 0;
        for (let i = 0; i < V.length; i++) {
          const a = V[i], b = V[(i + 1) % V.length];
          const ax = a[0] - C[0], ay = a[1] - C[1], az = a[2] - C[2];
          const bx = b[0] - C[0], by = b[1] - C[1], bz = b[2] - C[2];
          nx3 += ay * bz - az * by;
          ny3 += az * bx - ax * bz;
          nz3 += ax * by - ay * bx;
        }
        if (nz3 < 0) { nx3 = -nx3; ny3 = -ny3; nz3 = -nz3; }
        const nl = Math.hypot(nx3, ny3, nz3) || 1;
        const bLam = Math.max(0, (nx3 * L3[0] + ny3 * L3[1] + nz3 * L3[2]) / nl);
        m = Math.max(0.4, Math.min(2.2, (0.45 + 1.1 * bLam) / (0.45 + 1.1 * b0)));
        const tris = V.map((a, i) => [C, a, V[(i + 1) % V.length]]);
        const zAt = (x, y) => {
          for (const [A, B2, D] of tris) {
            const d = (B2[1] - D[1]) * (A[0] - D[0]) + (D[0] - B2[0]) * (A[1] - D[1]);
            if (Math.abs(d) < 1e-12) continue;
            const l1 = ((B2[1] - D[1]) * (x - D[0]) + (D[0] - B2[0]) * (y - D[1])) / d;
            const l2 = ((D[1] - A[1]) * (x - D[0]) + (A[0] - D[0]) * (y - D[1])) / d;
            const l3 = 1 - l1 - l2;
            if (l1 >= -1e-7 && l2 >= -1e-7 && l3 >= -1e-7) return l1 * A[2] + l2 * B2[2] + l3 * D[2];
          }
          return C[2];
        };
        lift = (pts, closed) => resample(pts, closed, step3).map(([x, y]) => [x, y, zAt(x, y)]);
      }

      const fams = p.cross ? [th, th + Math.PI / 2] : [th];
      for (const fa of fams) {
        const pvx = -Math.sin(fa), pvy = Math.cos(fa);
        const flip = pvx * Lx + pvy * Ly < 0;
        hatchFacet(poly, fa, Math.max(0.18, s0g * m), Math.max(0.2, s1g * m), flip, layer, lift);
      }
      if (p.outline) {
        let opts = poly.map((q) => [q[0], q[1]]);
        if (lift) opts = lift(opts, true);
        ptCount += opts.length;
        paths.push({ pts: opts, closed: true, layer });
      }
      if (paths.length > 58000) break;
    }

    if (is3D) {
      const cy0 = H / 2, cT = Math.cos(tilt), sT = Math.sin(tilt);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const path of paths) {
        path.pts = path.pts.map(([x, y, z]) => {
          const py2 = cy0 + (y - cy0) * cT - (z || 0) * sT;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (py2 < y0) y0 = py2;
          if (py2 > y1) y1 = py2;
          return [x, py2];
        });
      }
      const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
      const sc = Math.min((W - 2 * margin) / bw, (H - 2 * margin) / bh);
      const ox = (W - bw * sc) / 2 - x0 * sc;
      const oy = (H - bh * sc) / 2 - y0 * sc;
      for (const path of paths) {
        path.pts = path.pts.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
