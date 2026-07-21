import { Pin, EMPTY, noise2, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "caustics",
    name: "Caustics",
    cat: "gen",
    group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cell", label: "Sample cell mm", type: "slider", min: 1, max: 8, step: 0.25, def: 3 },
      { key: "scale", label: "Ripple scale", type: "slider", min: 0.01, max: 0.12, step: 0.005, def: 0.045 },
      { key: "octaves", label: "Detail octaves", type: "slider", min: 1, max: 4, step: 1, def: 3 },
      { key: "focus", label: "Focus / caustic gain", type: "slider", min: 0.2, max: 4, step: 0.05, def: 1.4 },
      { key: "thresh", label: "Brightness threshold", type: "slider", min: 0.1, max: 0.9, step: 0.02, def: 0.5 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "stretch", label: "Depth stretch", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "minlen", label: "Min line mm", type: "slider", min: 0, max: 30, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 5 || y1 - y0 < 5) return EMPTY;

      const cell = Math.max(0.6, p.cell);
      const cols = Math.max(2, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.max(2, Math.round((y1 - y0) / cell) + 1);
      const sc = Math.max(0.001, p.scale);
      const oct = Math.max(1, Math.min(4, Math.round(p.octaves)));
      const seed = p.seed;

      /* --- water-surface height as multi-octave value noise ---
         Two slightly offset noise fields stand in for two crossing
         wave trains; their interference makes the polygonal net. */
      const stretchY = 1 - Math.max(0, Math.min(1, p.stretch)) * 0.6; /* squash y => elongated ripples toward viewer */
      const surf = (x, y) => {
        let v = 0, amp = 1, fq = 1, norm = 0;
        for (let o = 0; o < oct; o++) {
          const sx = x * sc * fq;
          const sy = y * sc * fq * stretchY;
          const a = noise2(sx, sy, seed + o * 17);
          const b = noise2(sy * 1.3 + 11, sx * 1.3 + 5, seed + 100 + o * 17);
          v += amp * (a + b) * 0.5;
          norm += amp;
          amp *= 0.5; fq *= 2;
        }
        return v / norm; /* [0,1) */
      };

      /* --- caustic brightness ≈ curvature (Laplacian) of the surface.
         Where the wavy "lens" surface converges, light focuses -> bright.
         We rectify and gamma it so only the crests read as lines. */
      const h = cell; /* finite-difference step in mm */
      const bright = (x, y) => {
        const c = surf(x, y);
        const lap =
          surf(x + h, y) + surf(x - h, y) +
          surf(x, y + h) + surf(x, y - h) - 4 * c;
        /* positive curvature = focusing; scale by cell^2 to normalize */
        let b = -lap * (1 / (sc * sc * h * h)) * 0.00004 * p.focus;
        b = 0.5 + b; /* center around mid so threshold band works both ways */
        return b;
      };

      /* --- sample the field on the grid --- */
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const field = new Float64Array(cols * rows);
      let fmin = Infinity, fmax = -Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = bright(gx(c), gy(r));
          field[r * cols + c] = v;
          if (v < fmin) fmin = v;
          if (v > fmax) fmax = v;
        }
      }
      const span = (fmax - fmin) || 1;
      const at = (c, r) => (field[r * cols + c] - fmin) / span; /* normalized [0,1] */

      /* --- marching squares iso-contours at one or more levels --- */
      const paths = [];
      const nb = Math.max(1, Math.min(12, Math.round(p.bands)));
      const base = Math.max(0.02, Math.min(0.98, p.thresh));
      const minLen = Math.max(0, p.minlen);

      const interp = (va, vb, lvl) => {
        const d = vb - va;
        if (Math.abs(d) < 1e-9) return 0.5;
        return (lvl - va) / d;
      };

      for (let bi = 0; bi < nb; bi++) {
        /* spread bands around the base threshold */
        const level = nb === 1 ? base
          : base + (bi - (nb - 1) / 2) * (0.9 / nb) * 0.5;
        const lvl = Math.max(0.01, Math.min(0.99, level));

        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = at(c, r), tr = at(c + 1, r);
            const bl = at(c, r + 1), br = at(c + 1, r + 1);
            let idx = 0;
            if (tl > lvl) idx |= 8;
            if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2;
            if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;

            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eLf = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];

            const seg = (a, b) => {
              paths.push({ pts: [a, b], closed: false, layer: L });
            };

            switch (idx) {
              case 1: seg(eLf(), eB()); break;
              case 2: seg(eB(), eR()); break;
              case 3: seg(eLf(), eR()); break;
              case 4: seg(eT(), eR()); break;
              case 5: seg(eLf(), eT()); seg(eB(), eR()); break; /* saddle */
              case 6: seg(eT(), eB()); break;
              case 7: seg(eLf(), eT()); break;
              case 8: seg(eLf(), eT()); break;
              case 9: seg(eT(), eB()); break;
              case 10: seg(eLf(), eB()); seg(eT(), eR()); break; /* saddle */
              case 11: seg(eT(), eR()); break;
              case 12: seg(eLf(), eR()); break;
              case 13: seg(eB(), eR()); break;
              case 14: seg(eLf(), eB()); break;
            }
          }
        }
      }

      /* --- stitch touching segments into longer polylines so the pen
         draws flowing caustic threads instead of thousands of dashes --- */
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map(); /* endpoint key -> list of {seg, end} */
      const segs = paths.map((pa) => ({ a: pa.pts[0], b: pa.pts[1], used: false }));
      const push = (key, ref) => {
        let a = map.get(key); if (!a) { a = []; map.set(key, a); } a.push(ref);
      };
      segs.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });

      const chains = [];
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].used) continue;
        segs[i].used = true;
        const chain = [segs[i].a, segs[i].b];
        /* extend forward */
        let grow = true;
        while (grow) {
          grow = false;
          const tail = chain[chain.length - 1];
          const cands = map.get(kk(tail)) || [];
          for (const ref of cands) {
            const s = segs[ref.i];
            if (s.used) continue;
            const other = ref.end === "a" ? s.b : s.a;
            chain.push(other); s.used = true; grow = true; break;
          }
        }
        /* extend backward */
        grow = true;
        while (grow) {
          grow = false;
          const head = chain[0];
          const cands = map.get(kk(head)) || [];
          for (const ref of cands) {
            const s = segs[ref.i];
            if (s.used) continue;
            const other = ref.end === "a" ? s.b : s.a;
            chain.unshift(other); s.used = true; grow = true; break;
          }
        }
        chains.push(chain);
      }

      const out = [];
      let acc = 0;
      const BUDGET = 110000;
      for (const chain of chains) {
        if (chain.length < 2) continue;
        if (minLen > 0 && pathLength(chain, false) < minLen) continue;
        if (acc + chain.length > BUDGET) break;
        acc += chain.length;
        out.push({ pts: chain, closed: false, layer: L });
      }

      return applyStyle({ paths: out }, ins[0]);
    },
  
};
