import { Pin, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "julia",
    name: "Julia",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Set", type: "select", options: ["Julia", "Mandelbrot"], def: "Julia" },
      { key: "cre", label: "c real (wire LFO)", type: "slider", min: -1.5, max: 1.5, step: 0.005, def: -0.7 },
      { key: "cim", label: "c imag", type: "slider", min: -1.5, max: 1.5, step: 0.005, def: 0.27 },
      { key: "zoom", label: "Zoom", type: "slider", min: 0.5, max: 8, step: 0.1, def: 1 },
      { key: "iters", label: "Max iterations", type: "slider", min: 20, max: 200, step: 5, def: 60 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "cell", label: "Cell mm", type: "slider", min: 0.8, max: 4, step: 0.2, def: 1.6 },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
      const cell = Math.max(0.6, p.cell);
      const cols = Math.min(240, Math.max(10, Math.round(bw / cell)));
      const rows = Math.min(320, Math.max(10, Math.round(bh / cell)));
      const julia = p.mode === "Julia";
      const zoom = Math.max(0.1, p.zoom);
      const span = 3.2 / zoom;
      const cx0 = julia ? 0 : -0.5;
      const aspect = bh / bw;
      const maxIt = Math.max(10, Math.min(400, Math.round(p.iters)));
      /* smooth escape-time field, normalized 0..1 */
      const field = (fx, fyv) => {
        let zr, zi, cr, ci2;
        if (julia) { zr = fx; zi = fyv; cr = p.cre; ci2 = p.cim; }
        else { zr = 0; zi = 0; cr = fx; ci2 = fyv; }
        let i = 0;
        let r2 = zr * zr + zi * zi;
        while (i < maxIt && r2 < 16) {
          const nr = zr * zr - zi * zi + cr;
          zi = 2 * zr * zi + ci2;
          zr = nr;
          r2 = zr * zr + zi * zi;
          i++;
        }
        if (i >= maxIt) return 1;
        const sm = i + 1 - Math.log2(Math.max(1.0001, Math.log(Math.sqrt(r2))));
        return Math.max(0, Math.min(1, sm / maxIt));
      };
      const gx = (c) => m + (c / (cols - 1)) * bw;
      const gy = (r) => m + (r / (rows - 1)) * bh;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fx = cx0 + (c / (cols - 1) - 0.5) * span;
          const fyv = (r / (rows - 1) - 0.5) * span * aspect;
          F[r * cols + c] = field(fx, fyv);
        }
      }
      const segs = [];
      const NB = Math.max(1, Math.min(8, Math.round(p.bands)));
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let bi = 0; bi < NB; bi++) {
        const lvl = (bi + 1) / (NB + 1);
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A2, B2) => segs.push([A2, B2]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
