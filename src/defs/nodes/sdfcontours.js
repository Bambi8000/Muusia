import { Pin, EMPTY, pathLength } from "../helpers.js";

export default {
  key: "sdfcontours",
    name: "SDF Contours",
    cat: "mod",
    group: "deform",
    desc: "Distance-field isolines around ALL input geometry: unlike per-path Offset, nearby shapes merge into one smooth halo, like metaballs. Start/step/count set the contour distances; Inside adds negative offsets within closed shapes. Cell controls field resolution.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "start", label: "First contour mm", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
      { key: "step", label: "Contour step mm", type: "slider", min: 0.5, max: 15, step: 0.5, def: 3 },
      { key: "count", label: "Contours", type: "slider", min: 1, max: 8, step: 1, def: 3 },
      { key: "inside", label: "Inside contours too", type: "check", def: false },
      { key: "cell", label: "Field cell mm", type: "slider", min: 1, max: 4, step: 0.25, def: 1.8 },
      { key: "keep", label: "Keep source", type: "check", def: true },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
      { key: "layer", label: "Contour pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const maxD = p.start + p.step * Math.max(0, p.count - 1) + p.cell * 2;
      /* segments of all paths, bucketed for nearest-distance queries */
      const segs = [];
      for (const pa of src.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
        }
      }
      if (!segs.length) return EMPTY;
      const bs = Math.max(4, p.cell * 3);
      const bkey = (x, y) => Math.floor(x / bs) + "," + Math.floor(y / bs);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]);
        const y0 = Math.min(s[1], s[3]), y1 = Math.max(s[1], s[3]);
        for (let by = Math.floor(y0 / bs); by <= Math.floor(y1 / bs); by++) {
          for (let bx = Math.floor(x0 / bs); bx <= Math.floor(x1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k);
            if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
        }
      });
      const segDist = (x, y, s) => {
        const dx = s[2] - s[0], dy = s[3] - s[1];
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
      };
      const distAt = (x, y) => {
        /* expanding ring search over buckets, bounded by maxD */
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        let best = maxD + 1;
        const maxR = Math.ceil(maxD / bs) + 1;
        for (let r = 0; r <= maxR; r++) {
          if ((r - 1) * bs > best) break;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const a = buckets.get((bx + dx) + "," + (by + dy));
              if (!a) continue;
              for (const i of a) {
                const d = segDist(x, y, segs[i]);
                if (d < best) best = d;
              }
            }
          }
        }
        return best;
      };
      /* sign: inside any closed path -> negative, ALWAYS (so default contours
         are outside-only; the Inside option merely adds negative levels) */
      const closedPolys = src.paths.filter((pa) => pa.closed && pa.pts.length >= 3).map((pa) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of pa.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        return { poly: pa.pts, x0, y0, x1, y1 };
      });
      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const signAt = (x, y) => {
        for (const cp of closedPolys) {
          if (x < cp.x0 || x > cp.x1 || y < cp.y0 || y > cp.y1) continue;
          if (pip(x, y, cp.poly)) return -1;
        }
        return 1;
      };
      const cell = Math.max(0.8, p.cell);
      const cols = Math.min(260, Math.max(4, Math.round(W / cell) + 1));
      const rows = Math.min(380, Math.max(4, Math.round(H / cell) + 1));
      const gx = (c) => (c / (cols - 1)) * W;
      const gy = (r) => (r / (rows - 1)) * H;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gx(c), y = gy(r);
          F[r * cols + c] = distAt(x, y) * (closedPolys.length ? signAt(x, y) : 1);
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      if (p.keep) src.paths.forEach((pa) => paths.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }));
      const segsOut = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      const levels = [];
      for (let k = 0; k < Math.max(1, Math.round(p.count)); k++) {
        const d = p.start + p.step * k;
        levels.push(d);
        if (p.inside) levels.push(-d);
      }
      for (const lvl of levels) {
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
            const S = (A, B) => segsOut.push([A, B]);
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
      const items = segsOut.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
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
      return { paths };
    }
  
};
