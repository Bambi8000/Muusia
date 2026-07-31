({
  key: "gyroid",
  name: "Gyroid",
  cat: "gen",
  group: "geometric",
  desc: "The gyroid \u2014 the triply periodic minimal surface sin x cos y + sin y cos z + sin z cos x = iso \u2014 drawn as stacked slice contours in true perspective, Retro Mesh style (transparent, no hidden-line removal). Slices cuts the surface with horizontal planes stacked along the up axis — each cross-section projects as a tilted ring wrapping the 3D forms, like contour lines on a sculpture — and Cross slices adds vertical cuts for a woven cage. Surface: Transparent overprints everything retro-style, Solid ray-marches the field for exact hidden lines — the front shells occlude the back while the holes still see through. Cells sets how many periods fit the volume, Iso slides through the level-set family (shells swell and pinch, \u00b10.9 dissolves into droplets), Warp bends the field with seeded noise for an organic mutant. Shape clips the volume to a Cube, Sphere (the classic orb) or Cylinder. Perspective runs from near-orthographic to wide-angle, Rot X tilts, Rot Y spins, Detail scales the contour resolution. Tip: drive Iso or Rot Y with the frame clock \u2014 the surface morphs like breathing coral.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "shape", label: "Shape", type: "select", options: ["Sphere", "Cube", "Cylinder"], def: "Sphere" },
    { key: "surface", label: "Surface", type: "select", options: ["Transparent", "Solid"], def: "Transparent" },
    { key: "size", label: "Size", type: "slider", min: 20, max: 280, step: 1, def: 170 },
    { key: "slices", label: "Slices", type: "slider", min: 3, max: 40, step: 1, def: 14 },
    { key: "cross", label: "Cross slices", type: "slider", min: 0, max: 40, step: 1, def: 0 },
    { key: "cells", label: "Cells", type: "slider", min: 1, max: 6, step: 0.25, def: 2 },
    { key: "iso", label: "Iso", type: "slider", min: -0.9, max: 0.9, step: 0.01, def: 0 },
    { key: "warp", label: "Warp", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "detail", label: "Detail", type: "slider", min: 0.5, max: 2, step: 0.05, def: 1 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "rx", label: "Rot X", type: "slider", min: -90, max: 90, step: 1, def: 18 },
    { key: "ry", label: "Rot Y", type: "slider", min: -180, max: 180, step: 1, def: 25 },
    { key: "seed", label: "Seed", type: "seed", def: 6 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const size = Math.max(10, p.size);
    const nSl = Math.max(2, Math.round(p.slices));
    const nCr = Math.max(0, Math.round(p.cross));
    const k = Math.PI * Math.max(0.25, p.cells); // frequency: Cells periods across [-1,1]
    const iso = p.iso;
    const layer = Math.round(p.layer) % PENS.length;
    const TAU = Math.PI * 2;

    const F = (x, y, z) => {
      let f = Math.sin(k * x) * Math.cos(k * y) +
              Math.sin(k * y) * Math.cos(k * z) +
              Math.sin(k * z) * Math.cos(k * x);
      if (p.warp > 0)
        f += (noise2(x * 1.7 + z * 0.9 + 4, y * 1.7 - z * 0.6 + 4, seed) - 0.5) *
             2 * p.warp * 0.8;
      return f - iso;
    };
    const inside = (x, y, z) =>
      p.shape === "Sphere" ? x * x + y * y + z * z <= 1
      : p.shape === "Cylinder" ? x * x + y * y <= 1
      : true;

    /* marching squares on a slice; axis: "y" (horizontal plane y=c, grid
       over x,z — the topo-ring stack that reads 3D from a side camera) or
       "x" (vertical plane x=c, grid over y,z). Returns 3D chained polylines. */
    const G = Math.max(24, Math.min(96, Math.round(30 * p.detail * Math.max(1, p.cells * 0.8))));
    const contoursAt = (axis, c) => {
      const V = new Float64Array((G + 1) * (G + 1));
      for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
        const u = -1 + (2 * i) / G, v = -1 + (2 * j) / G;
        V[j * (G + 1) + i] = axis === "y" ? F(u, c, v) : F(c, u, v);
      }
      const cell = 2 / G;
      const key = (x, y) => Math.round(x * 4096) + ":" + Math.round(y * 4096);
      const segs = [];
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const a = V[j * (G + 1) + i], b = V[j * (G + 1) + i + 1];
        const d = V[(j + 1) * (G + 1) + i], cc = V[(j + 1) * (G + 1) + i + 1];
        const idx = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (cc > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = -1 + i * cell, y0 = -1 + j * cell;
        const it = (va, vb) => va / (va - vb);
        const T = [x0 + it(a, b) * cell, y0];
        const R = [x0 + cell, y0 + it(b, cc) * cell];
        const B = [x0 + it(d, cc) * cell, y0 + cell];
        const Lp = [x0, y0 + it(a, d) * cell];
        const avg = (a + b + cc + d) / 4;
        const add = (u2, v2) => segs.push([u2, v2]);
        if (idx === 1 || idx === 14) add(Lp, B);
        else if (idx === 2 || idx === 13) add(B, R);
        else if (idx === 3 || idx === 12) add(Lp, R);
        else if (idx === 4 || idx === 11) add(T, R);
        else if (idx === 6 || idx === 9) add(T, B);
        else if (idx === 7 || idx === 8) add(T, Lp);
        else if (idx === 5) { if (avg > 0) { add(T, Lp); add(B, R); } else { add(T, R); add(Lp, B); } }
        else if (idx === 10) { if (avg > 0) { add(T, R); add(Lp, B); } else { add(T, Lp); add(B, R); } }
      }
      // chain
      const map = new Map();
      segs.forEach((s, si) => {
        for (const end of [0, 1]) {
          const kk = key(s[end][0], s[end][1]);
          if (!map.has(kk)) map.set(kk, []);
          map.get(kk).push([si, end]);
        }
      });
      const used = new Array(segs.length).fill(false);
      const chains = [];
      for (let si = 0; si < segs.length; si++) {
        if (used[si]) continue;
        used[si] = true;
        const chain = [segs[si][0], segs[si][1]];
        for (const dir of [1, -1]) {
          for (;;) {
            const tail = dir === 1 ? chain[chain.length - 1] : chain[0];
            let grew = false;
            for (const [oj, end] of map.get(key(tail[0], tail[1])) || []) {
              if (used[oj]) continue;
              used[oj] = true;
              const q = segs[oj][1 - end];
              if (dir === 1) chain.push(q); else chain.unshift(q);
              grew = true;
              break;
            }
            if (!grew) break;
          }
        }
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0],
                                  chain[0][1] - chain[chain.length - 1][1]) < cell * 0.6;
        if (closed) chain.pop();
        if (chain.length >= 3 || (!closed && chain.length >= 2))
          chains.push({ uv: chain, closed });
      }
      // lift to 3D + clip by the volume shape
      const to3 = ([u, v]) => (axis === "y" ? [u, c, v] : [c, u, v]);
      const out = [];
      for (const ch of chains) {
        const P = ch.uv.map(to3);
        const ok = P.map((q) => inside(q[0], q[1], q[2]));
        if (ch.closed && ok.every(Boolean)) { out.push({ pts: P, closed: true }); continue; }
        let start = 0;
        if (ch.closed) { start = ok.findIndex((v2) => !v2); if (start < 0) start = 0; }
        let run = [];
        const flush = () => { if (run.length >= 2) out.push({ pts: run, closed: false }); run = []; };
        const n = P.length;
        for (let s2 = 0; s2 < n; s2++) {
          const i2 = ch.closed ? (start + s2) % n : s2;
          if (ok[i2]) run.push(P[i2]); else flush();
        }
        flush();
      }
      return out;
    };

    let lines = [];
    for (let j = 0; j < nSl; j++) {
      const c = -1 + ((j + 0.5) / nSl) * 2;
      for (const L2 of contoursAt("y", c)) lines.push(L2);
    }
    for (let j = 0; j < nCr; j++) {
      const c = -1 + ((j + 0.5) / nCr) * 2;
      for (const L2 of contoursAt("x", c)) lines.push(L2);
    }
    const allLines = lines; // full set: fit framing + regression-stable scale

    /* ---- rotate, perspective-project, cull, fit (Retro Mesh style) ---- */
    const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180;
    const cX = Math.cos(ax), sX = Math.sin(ax), cY = Math.cos(ay), sY = Math.sin(ay);
    const persp = Math.max(0, Math.min(1, p.persp));
    const camD = 2.2 + (1 - persp) * 7;
    const fl = camD;

    /* ---- Solid: exact hidden-line by ray-marching the implicit field ----
       A contour point hides when the ray toward the camera crosses F=0 again
       inside the clip volume (the gyroid is no heightfield, so a literal
       float-horizon would also block its see-through holes; marching the
       field is the correct generalisation of the Volcano technique). */
    if (p.surface === "Solid") {
      const toView = (v) => {
        const x = v[0] * cY + v[2] * sY, y = v[1], z = -v[0] * sY + v[2] * cY;
        return [x, y * cX - z * sX, y * sX + z * cX];
      };
      const toWorldDir = (d) => {
        // inverse rotation: Ry(-ay) then Rx(-ax) transposed order
        const y = d[1] * cX + d[2] * sX, z = -d[1] * sX + d[2] * cX;
        return [d[0] * cY - z * sY, y, d[0] * sY + z * cY];
      };
      const stepT = Math.min(0.06, 1.4 / k);
      const visible = (q) => {
        const vp = toView(q);
        const dv = [-vp[0], -vp[1], -camD - vp[2]];
        const L2 = Math.hypot(dv[0], dv[1], dv[2]) || 1;
        const dw = toWorldDir([dv[0] / L2, dv[1] / L2, dv[2] / L2]);
        let prev = null;
        for (let t = stepT * 1.5; t < 3.6; t += stepT) {
          const x = q[0] + dw[0] * t, y = q[1] + dw[1] * t, z = q[2] + dw[2] * t;
          // material exists only inside the clip shape AND the [-1,1]^3 box
          // (Cube's inside() is unbounded; the periodic field outside the box
          // must never occlude)
          if (Math.abs(x) > 1 || Math.abs(y) > 1 || Math.abs(z) > 1 ||
              !inside(x, y, z)) { prev = null; continue; }
          const f = F(x, y, z);
          if (prev !== null && ((f > 0) !== (prev > 0))) return false;
          prev = f;
        }
        return true;
      };
      const cut = [];
      for (const ln of lines) {
        const ok = ln.pts.map(visible);
        if (ln.closed && ok.every(Boolean)) { cut.push(ln); continue; }
        let start = 0;
        if (ln.closed) { start = ok.findIndex((v2) => !v2); if (start < 0) start = 0; }
        let run = [];
        const flush = () => { if (run.length >= 2) cut.push({ pts: run, closed: false }); run = []; };
        const n = ln.pts.length;
        for (let s2 = 0; s2 < n; s2++) {
          const i2 = ln.closed ? (start + s2) % n : s2;
          if (ok[i2]) run.push(ln.pts[i2]); else flush();
        }
        flush();
      }
      lines = cut;
    }
    const proj = (v) => {
      const x = v[0] * cY + v[2] * sY, y = v[1], z = -v[0] * sY + v[2] * cY;
      const y2 = y * cX - z * sX, z2 = y * sX + z * cX;
      const zc = z2 + camD;
      if (zc < 0.15) return null;
      return [(x * fl) / zc, (y2 * fl) / zc];
    };
    const runs = [];
    for (const ln of lines) {
      const P = ln.closed ? [...ln.pts, ln.pts[0]] : ln.pts;
      let cur = [];
      let all = true;
      for (const q of P) {
        const pr = proj(q);
        if (pr) cur.push(pr);
        else {
          all = false;
          if (cur.length >= 2) runs.push({ pts: cur, closed: false });
          cur = [];
        }
      }
      if (cur.length >= 2) {
        if (ln.closed && all) { cur.pop(); runs.push({ pts: cur, closed: true }); }
        else runs.push({ pts: cur, closed: false });
      }
    }
    if (!runs.length) return applyStyle(EMPTY, ins[0]);
    // fit from the FULL line set so Solid and Transparent share framing
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const ln of allLines) for (const q of (ln.closed ? [...ln.pts, ln.pts[0]] : ln.pts)) {
      const pr = proj(q);
      if (!pr) continue;
      if (pr[0] < x0) x0 = pr[0]; if (pr[0] > x1) x1 = pr[0];
      if (pr[1] < y0) y0 = pr[1]; if (pr[1] > y1) y1 = pr[1];
    }
    const s = size / Math.max(x1 - x0, y1 - y0, 1e-6);
    const ox = W / 2 - (s * (x0 + x1)) / 2, oy = H / 2 - (s * (y0 + y1)) / 2;
    const clampP = (v, lim) => Math.min(lim - 0.2, Math.max(0.2, v));
    let budget = 112000;
    const paths = [];
    for (const r of runs) {
      if (budget <= 0) break;
      const pts = r.pts.map(([x, y]) => [clampP(x * s + ox, W), clampP(y * s + oy, H)]);
      if (pts.length < 2) continue;
      budget -= pts.length;
      paths.push({ pts, closed: !!r.closed, layer });
    }
    return applyStyle({ paths }, ins[0]);
  },
})
