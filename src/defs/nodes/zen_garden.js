import { Pin, noise2, applyStyle } from "../helpers.js";

export default {
  /* Zen Garden — karesansui raked gravel. An exact euclidean distance field
     is computed from the closed shapes wired into Stones (Felzenszwalb 2-pass
     EDT over a mm grid, boundary-sampled seeds, signed by scanline fill).
     Each stone sits in a pool of Rings offset rings (iso-lines of the stone
     distance at clearance + k*spacing), and the background rake (straight /
     waves / circular iso-lines at the same spacing) is clipped to end cleanly
     at the pool boundary via bilinear field interpolation — the authentic
     look where rake grooves butt against the ring halo. Tines draws each
     groove as a comb of parallel lines like a real rake's teeth. Wobble is
     the only seeded term. No line ever enters a stone or its clearance. */
  key: "zen_garden",
  name: "Zen Garden",
  cat: "duo",
  desc: "Karesansui raked gravel around the closed shapes wired into Stones (one Photo Trace outline, several via Merge, or any closed shapes). Each stone sits in a pool of offset rings (Rings sets how many, starting at Clearance), and the background rake grooves end cleanly where they meet the outermost ring - the classic raked-gravel look. Rake: Straight (Direction), Waves (sine meander, Wave amp/len), Circular (rings from the canvas centre), Rings only (nothing but rings, expanding until they fill the sheet). Spacing is the groove pitch; Tines splits every groove into a comb of parallel lines with Tine gap between them, like the teeth of a real rake. Wobble adds seeded hand-raked imperfection. Detail is the field grid cell in mm - lower is crisper and slower. Keep stones passes the stone outlines through on Stone pen. Lines never enter a stone. Tip: Photo Trace stones with As photographed keep true position, so the raked field is plotted around the real objects.",
  ins: [Pin("paths", "Stones"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "rake", label: "Rake", type: "select", options: ["Straight", "Waves", "Circular", "Rings only"], def: "Straight" },
    { key: "dir", label: "Direction \u00b0", type: "slider", min: 0, max: 180, step: 1, def: 0, showIf: (p) => p.rake === "Straight" || p.rake === "Waves" },
    { key: "spacing", label: "Spacing mm", type: "slider", min: 0.8, max: 8, step: 0.1, def: 1.6 },
    { key: "tines", label: "Tines", type: "slider", min: 1, max: 4, step: 1, def: 1 },
    { key: "tinegap", label: "Tine gap mm", type: "slider", min: 0.4, max: 2, step: 0.1, def: 0.7, showIf: (p) => p.tines > 1 },
    { key: "clearance", label: "Clearance mm", type: "slider", min: 0, max: 12, step: 0.5, def: 2 },
    { key: "rings", label: "Rings", type: "slider", min: 1, max: 20, step: 1, def: 5, showIf: (p) => p.rake !== "Rings only" },
    { key: "wamp", label: "Wave amp mm", type: "slider", min: 0, max: 20, step: 0.5, def: 6, showIf: (p) => p.rake === "Waves" },
    { key: "wlen", label: "Wave len mm", type: "slider", min: 10, max: 200, step: 5, def: 60, showIf: (p) => p.rake === "Waves" },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "detail", label: "Detail mm", type: "slider", min: 0.6, max: 3, step: 0.1, def: 1.2 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "keep", label: "Keep stones", type: "check", def: true },
    { key: "stonepen", label: "Stone pen", type: "pen", def: 1 },
    { key: "layer", label: "Rake pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: Math.max(1, ctx.W - 2 * m), h: Math.max(1, ctx.H - 2 * m) }];
  },
  compute(ins, p, ctx) {
    const stonesIn = ins[0], st = ins[1];
    const m = Math.max(0, p.margin);
    const W = ctx.W, Hh = ctx.H;
    const bw = W - 2 * m, bh = Hh - 2 * m;
    if (bw < 4 || bh < 4) return applyStyle({ paths: [] }, st);
    const stones = (stonesIn && stonesIn.paths ? stonesIn.paths : []).filter(
      (q) => q.closed && q.pts.length >= 3);
    const out = [];
    const L = Math.round(p.layer);
    const BUDGET = 110000;
    let budget = BUDGET;

    /* ---- grid ---- */
    const cell = Math.max(0.6, p.detail);
    const nx = Math.max(4, Math.floor(bw / cell) + 2);
    const ny = Math.max(4, Math.floor(bh / cell) + 2);
    const gx = (i) => m + (i * bw) / (nx - 1);
    const gy = (j) => m + (j * bh) / (ny - 1);
    const sxm = bw / (nx - 1), sym = bh / (ny - 1);
    const N = nx * ny;

    /* ---- signed distance to stones: EDT of boundary samples + scanline sign ---- */
    const INF = 1e18;
    const f = new Float64Array(N).fill(INF); /* squared mm distance seeds */
    const inside = new Uint8Array(N);
    for (const s of stones) {
      /* boundary samples at ~cell/2 step seed the EDT with exact offsets */
      const pts = s.pts;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b2 = pts[(i + 1) % pts.length];
        const seg = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
        const steps = Math.max(1, Math.ceil(seg / (cell * 0.5)));
        for (let k2 = 0; k2 < steps; k2++) {
          const t = k2 / steps;
          const px = a[0] + (b2[0] - a[0]) * t, py = a[1] + (b2[1] - a[1]) * t;
          const gi = Math.round((px - m) / sxm), gj = Math.round((py - m) / sym);
          if (gi < 0 || gj < 0 || gi >= nx || gj >= ny) continue;
          const dx = px - gx(gi), dy = py - gy(gj);
          const d2 = dx * dx + dy * dy;
          const idx = gj * nx + gi;
          if (d2 < f[idx]) f[idx] = d2;
        }
      }
      /* scanline fill for the inside flag */
      let y0 = Infinity, y1 = -Infinity;
      for (const q of pts) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
      const j0 = Math.max(0, Math.ceil((y0 - m) / sym)), j1 = Math.min(ny - 1, Math.floor((y1 - m) / sym));
      for (let j = j0; j <= j1; j++) {
        const yy = gy(j);
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b2 = pts[(i + 1) % pts.length];
          if ((a[1] > yy) !== (b2[1] > yy)) xs.push(a[0] + ((yy - a[1]) / (b2[1] - a[1])) * (b2[0] - a[0]));
        }
        xs.sort((u, v) => u - v);
        for (let k2 = 0; k2 + 1 < xs.length; k2 += 2) {
          const i0 = Math.max(0, Math.ceil((xs[k2] - m) / sxm)), i1 = Math.min(nx - 1, Math.floor((xs[k2 + 1] - m) / sxm));
          for (let i = i0; i <= i1; i++) inside[j * nx + i] = 1;
        }
      }
    }
    /* Felzenszwalb 1D squared-distance transform, applied along rows then columns */
    const dt1 = (src, dst, n, stride, off, step2) => {
      const v = new Int32Array(n), z = new Float64Array(n + 1);
      let k2 = 0;
      v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        const fq = src[off + q * stride];
        let s2;
        while (true) {
          const vk = v[k2], fvk = src[off + vk * stride];
          s2 = (fq + q * q * step2 - (fvk + vk * vk * step2)) / (2 * step2 * (q - vk));
          if (s2 <= z[k2]) { k2--; if (k2 < 0) { k2 = 0; v[0] = q; z[0] = -INF; z[1] = INF; break; } }
          else break;
        }
        if (v[k2] !== q) { k2++; v[k2] = q; z[k2] = s2; z[k2 + 1] = INF; }
      }
      k2 = 0;
      for (let q = 0; q < n; q++) {
        while (z[k2 + 1] < q) k2++;
        const vk = v[k2];
        dst[off + q * stride] = (q - vk) * (q - vk) * step2 + src[off + vk * stride];
      }
    };
    const tmp = new Float64Array(N);
    for (let j = 0; j < ny; j++) dt1(f, tmp, nx, 1, j * nx, sxm * sxm);
    for (let i = 0; i < nx; i++) dt1(tmp, f, ny, nx, i, sym * sym);
    const hasStones = stones.length > 0;

    /* ---- fields: signed stone distance dS, background rake bg ---- */
    const cl = Math.max(0, p.clearance);
    const a = ((p.dir + 90) * Math.PI) / 180;
    const nX = Math.cos(a), nY = Math.sin(a);
    const tX = Math.cos((p.dir * Math.PI) / 180), tY = Math.sin((p.dir * Math.PI) / 180);
    const cxm = W / 2, cym = Hh / 2;
    const wob = p.wobble * p.spacing * 0.9;
    const ringsOnly = p.rake === "Rings only";
    const DS = new Float64Array(N);
    const BG = ringsOnly ? null : new Float64Array(N);
    let dMax = 0, bgLo = Infinity, bgHi = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      const x = gx(i), y = gy(j);
      const nz = wob > 0 ? wob * (noise2(x / 14, y / 14, p.seed) * 2 - 1) : 0;
      const dS = (inside[idx] ? -1 : 1) * Math.sqrt(f[idx]) + nz;
      DS[idx] = dS;
      if (dS > dMax) dMax = dS;
      if (!ringsOnly) {
        let bg;
        if (p.rake === "Straight") bg = (x - cxm) * nX + (y - cym) * nY;
        else if (p.rake === "Waves") bg = (x - cxm) * nX + (y - cym) * nY + p.wamp * Math.sin((2 * Math.PI * ((x - cxm) * tX + (y - cym) * tY)) / Math.max(5, p.wlen));
        else bg = Math.hypot(x - cxm, y - cym);
        bg += nz;
        BG[idx] = bg;
        if (bg < bgLo) bgLo = bg;
        if (bg > bgHi) bgHi = bg;
      }
    }

    /* ---- levels: groups at k*spacing, tines within each group ---- */
    const s = Math.max(0.5, p.spacing);
    const tines = Math.max(1, Math.round(p.tines));
    const tg = Math.min(p.tinegap, tines > 1 ? (s * 0.8) / (tines - 1) : p.tinegap);
    const tineW = (tines - 1) * tg;
    if (!hasStones && ringsOnly) return applyStyle({ paths: [] }, st);
    const ringsN = !hasStones ? 0 : ringsOnly ? Math.max(1, Math.ceil((dMax - cl) / s) + 1) : Math.max(1, Math.round(p.rings));
    const rOuter = cl + (ringsN - 1) * s + tineW + s * 0.5;
    const ringLevels = [];
    for (let k2 = 0; k2 < ringsN && ringLevels.length < 4000; k2++) for (let t2 = 0; t2 < tines; t2++) {
      const lv = cl + k2 * s + t2 * tg;
      if (lv <= dMax) ringLevels.push(lv);
    }
    const rakeLevels = [];
    if (!ringsOnly) {
      for (let k2 = Math.floor(bgLo / s); k2 * s <= bgHi + tineW; k2++) {
        for (let t2 = 0; t2 < tines; t2++) {
          const lv = k2 * s + t2 * tg;
          if (lv >= bgLo - s && lv <= bgHi + s) rakeLevels.push(lv);
        }
      }
    }

    /* ---- marching squares with segment chaining ---- */
    const qk = (x, y) => (Math.round(x * 64) * 131071 + Math.round(y * 64));
    const march = (FLD, lv) => {
      const segs = [];
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const i00 = j * nx + i, i10 = i00 + 1, i01 = i00 + nx, i11 = i01 + 1;
        if (hasStones && (inside[i00] || inside[i10] || inside[i01] || inside[i11])) continue;
        const v00 = FLD[i00], v10 = FLD[i10], v01 = FLD[i01], v11 = FLD[i11];
        let code = 0;
        if (v00 > lv) code |= 1;
        if (v10 > lv) code |= 2;
        if (v11 > lv) code |= 4;
        if (v01 > lv) code |= 8;
        if (code === 0 || code === 15) continue;
        const x0 = gx(i), x1 = gx(i + 1), y0 = gy(j), y1 = gy(j + 1);
        const ixT = [x0 + ((lv - v00) / (v10 - v00)) * (x1 - x0), y0];
        const ixB = [x0 + ((lv - v01) / (v11 - v01)) * (x1 - x0), y1];
        const ixL = [x0, y0 + ((lv - v00) / (v01 - v00)) * (y1 - y0)];
        const ixR = [x1, y0 + ((lv - v10) / (v11 - v10)) * (y1 - y0)];
        const EMIT = (A2, B2) => segs.push([A2, B2]);
        switch (code) {
          case 1: case 14: EMIT(ixL, ixT); break;
          case 2: case 13: EMIT(ixT, ixR); break;
          case 3: case 12: EMIT(ixL, ixR); break;
          case 4: case 11: EMIT(ixR, ixB); break;
          case 6: case 9: EMIT(ixT, ixB); break;
          case 7: case 8: EMIT(ixL, ixB); break;
          case 5: EMIT(ixL, ixT); EMIT(ixR, ixB); break;
          case 10: EMIT(ixT, ixR); EMIT(ixL, ixB); break;
        }
      }
      const paths = [];
      if (!segs.length) return paths;
      const byEnd = new Map();
      const addEnd = (key, rec) => {
        let arr = byEnd.get(key);
        if (!arr) { arr = []; byEnd.set(key, arr); }
        arr.push(rec);
      };
      segs.forEach((sg, si) => {
        addEnd(qk(sg[0][0], sg[0][1]), [si, 0]);
        addEnd(qk(sg[1][0], sg[1][1]), [si, 1]);
      });
      const usedSeg = new Uint8Array(segs.length);
      for (let si = 0; si < segs.length; si++) {
        if (usedSeg[si]) continue;
        usedSeg[si] = 1;
        const chain = [segs[si][0], segs[si][1]];
        for (const dir2 of [1, 0]) {
          while (true) {
            const tip = dir2 ? chain[chain.length - 1] : chain[0];
            const cands = byEnd.get(qk(tip[0], tip[1])) || [];
            let next = null;
            for (const [sj, endj] of cands) {
              if (!usedSeg[sj]) { next = [sj, endj]; break; }
            }
            if (!next) break;
            usedSeg[next[0]] = 1;
            const other = segs[next[0]][1 - next[1]];
            if (dir2) chain.push(other); else chain.unshift(other);
          }
        }
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < 1e-6;
        if (closed && chain.length > 3) chain.pop();
        let len2 = 0;
        for (let ci = 1; ci < chain.length; ci++) len2 += Math.hypot(chain[ci][0] - chain[ci - 1][0], chain[ci][1] - chain[ci - 1][1]);
        if (chain.length >= 2 && len2 > 0.05) paths.push({ pts: chain, closed });
      }
      return paths;
    };

    /* bilinear stone-distance sample for clipping rake at the pool edge */
    const dsAt = (x, y) => {
      let u = (x - m) / sxm, v = (y - m) / sym;
      u = Math.max(0, Math.min(nx - 1.001, u));
      v = Math.max(0, Math.min(ny - 1.001, v));
      const i = Math.floor(u), j = Math.floor(v);
      const fu = u - i, fv = v - j;
      const idx = j * nx + i;
      return DS[idx] * (1 - fu) * (1 - fv) + DS[idx + 1] * fu * (1 - fv) +
        DS[idx + nx] * (1 - fu) * fv + DS[idx + nx + 1] * fu * fv;
    };

    /* rings */
    for (const lv of ringLevels) {
      if (budget <= 0) break;
      for (const q of march(DS, lv)) {
        if (budget <= 0) break;
        budget -= q.pts.length;
        if (budget < 0) break;
        out.push({ pts: q.pts, closed: q.closed, layer: L });
      }
    }
    /* rake, clipped to end at the ring pool boundary */
    for (const lv of rakeLevels) {
      if (budget <= 0) break;
      for (const q of march(BG, lv)) {
        if (budget <= 0) break;
        const pts = q.closed ? [...q.pts, q.pts[0]] : q.pts;
        const vals = hasStones ? pts.map((pt) => dsAt(pt[0], pt[1]) - rOuter) : null;
        if (!hasStones) {
          budget -= q.pts.length;
          if (budget < 0) break;
          out.push({ pts: q.pts, closed: q.closed, layer: L });
          continue;
        }
        let run = [];
        const flush = () => {
          if (run.length >= 2) {
            budget -= run.length;
            if (budget >= 0) out.push({ pts: run, closed: false, layer: L });
          }
          run = [];
        };
        for (let i = 0; i < pts.length; i++) {
          const keepPt = vals[i] >= 0;
          if (i > 0) {
            const kPrev = vals[i - 1] >= 0;
            if (kPrev !== keepPt) {
              const t2 = vals[i - 1] / (vals[i - 1] - vals[i]);
              const xc = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t2;
              const yc = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t2;
              if (keepPt) run.push([xc, yc]);
              else { run.push([xc, yc]); flush(); }
            }
          }
          if (keepPt) run.push(pts[i]);
          if (budget < 0) break;
        }
        if (run.length >= 2 && q.closed && vals[0] >= 0 && vals.every((v2) => v2 >= 0)) {
          run.pop();
          budget -= run.length;
          if (budget >= 0) out.push({ pts: run, closed: true, layer: L });
        } else flush();
        if (budget < 0) break;
      }
    }

    /* ---- keep stones ---- */
    if (p.keep) {
      for (const s2 of stones) out.push({ pts: s2.pts.map((q) => [q[0], q[1]]), closed: true, layer: Math.round(p.stonepen) });
    }
    return applyStyle({ paths: out }, st);
  },
};
