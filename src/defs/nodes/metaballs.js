import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "metaballs",
    name: "Metaballs",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "blobs", label: "Blobs", type: "slider", min: 2, max: 30, step: 1, def: 6 },
      { key: "size", label: "Blob size mm", type: "slider", min: 5, max: 60, step: 1, def: 22 },
      { key: "spread", label: "Spread", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.55 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 5, step: 1, def: 2 },
      { key: "cell", label: "Cell mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 29 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const L = Math.round(p.layer);
      const NB = Math.max(1, Math.min(40, Math.round(p.blobs)));
      const rng = mulberry32(p.seed * 8837 + 5);
      const cx = W / 2, cy = H / 2;
      const rx = (x1 - x0) / 2 * p.spread, ry = (y1 - y0) / 2 * p.spread;
      const blobs = [];
      for (let i = 0; i < NB; i++) {
        blobs.push({
          x: cx + (rng() * 2 - 1) * rx,
          y: cy + (rng() * 2 - 1) * ry,
          r: Math.max(2, p.size) * (0.55 + rng() * 0.9)
        });
      }
      const field = (x, y) => {
        let v = 0;
        for (const b of blobs) {
          const dx = x - b.x, dy = y - b.y;
          v += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        return v;
      };
      const cell = Math.max(0.8, p.cell);
      const cols = Math.max(2, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.max(2, Math.round((y1 - y0) / cell) + 1);
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = field(gx(c), gy(r));
      const segs = [];
      const NBands = Math.max(1, Math.min(6, Math.round(p.bands)));
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let bi = 0; bi < NBands; bi++) {
        const lvl = 1 * Math.pow(1.6, bi); /* nested iso levels */
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
            const S = (A, B) => segs.push([A, B]);
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
      /* stitch segments into contour loops */
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s, i) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
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
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
