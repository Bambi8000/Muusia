import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "interference",
    name: "Contours", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "field", label: "Field", type: "select", options: ["Terrain (fBm)", "Waves"], def: "Terrain (fBm)" },
      { key: "scale", label: "Terrain scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
      { key: "octaves", label: "Octaves", type: "slider", min: 1, max: 5, step: 1, def: 4 },
      { key: "sources", label: "Wave sources", type: "slider", min: 2, max: 5, step: 1, def: 2 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 5, max: 80, step: 1, def: 24 },
      { key: "levels", label: "Contour levels", type: "slider", min: 2, max: 24, step: 1, def: 12 },
      { key: "res", label: "Resolution mm", type: "slider", min: 1, max: 5, step: 0.5, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 5 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 433 + 17);
      let f;
      if (p.field === "Waves") {
        const srcs = [];
        const nS = Math.round(p.sources);
        for (let i = 0; i < nS; i++) {
          srcs.push([p.margin + rng() * (W - 2 * p.margin), p.margin + rng() * (H - 2 * p.margin)]);
        }
        f = (x, y) => {
          let v = 0;
          for (const [sx, sy] of srcs) v += Math.sin((Math.hypot(x - sx, y - sy) / p.wl) * Math.PI * 2);
          return v;
        };
      } else {
        /* fBm-maasto: oktaaveittain summattu kohina -> korkeuskartta */
        const oct = Math.round(p.octaves);
        f = (x, y) => {
          let v = 0, amp = 1, fq = 1, tot = 0;
          for (let o = 0; o < oct; o++) {
            v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
            tot += amp; amp *= 0.5; fq *= 2;
          }
          return v / tot;
        };
      }
      /* marching squares + ketjutus */
      const step = Math.max(1, p.res);
      const x0 = p.margin, y0 = p.margin, x1 = W - p.margin, y1 = H - p.margin;
      const nx = Math.floor((x1 - x0) / step), ny = Math.floor((y1 - y0) / step);
      const grid = [];
      let vMin = Infinity, vMax = -Infinity;
      for (let j = 0; j <= ny; j++) {
        const row = [];
        for (let i = 0; i <= nx; i++) {
          const v = f(x0 + i * step, y0 + j * step);
          if (v < vMin) vMin = v;
          if (v > vMax) vMax = v;
          row.push(v);
        }
        grid.push(row);
      }
      const paths = [];
      for (let L = 1; L <= Math.round(p.levels); L++) {
        const iso = vMin + ((vMax - vMin) * L) / (Math.round(p.levels) + 1);
        const segs = [];
        const lerp = (va, vb, pa, pb) => {
          const t = (iso - va) / (vb - va || 1e-9);
          return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
        };
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const ax = x0 + i * step, ay = y0 + j * step;
          const v = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
          const P = [[ax, ay], [ax + step, ay], [ax + step, ay + step], [ax, ay + step]];
          let idx = 0;
          for (let k = 0; k < 4; k++) if (v[k] > iso) idx |= 1 << k;
          if (idx === 0 || idx === 15) continue;
          const E = (k) => lerp(v[k], v[(k + 1) % 4], P[k], P[(k + 1) % 4]);
          const CASES = {
            1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]],
            6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]],
            11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]],
          };
          for (const [ea, eb] of CASES[idx] || []) segs.push([E(ea), E(eb)]);
        }
        /* ketjuta segmentit polyviivoiksi */
        const key = (pt) => Math.round(pt[0] * 20) + "," + Math.round(pt[1] * 20);
        const adj = {};
        segs.forEach((s, i) => {
          for (const end of [0, 1]) {
            const k = key(s[end]);
            (adj[k] = adj[k] || []).push([i, end]);
          }
        });
        const used = new Array(segs.length).fill(false);
        for (let i = 0; i < segs.length; i++) {
          if (used[i]) continue;
          used[i] = true;
          let chain = [segs[i][0], segs[i][1]];
          let grow = true;
          while (grow) {
            grow = false;
            const k = key(chain[chain.length - 1]);
            for (const [si, se] of adj[k] || []) {
              if (used[si]) continue;
              used[si] = true;
              chain.push(segs[si][se === 0 ? 1 : 0]);
              grow = true;
              break;
            }
          }
          if (chain.length > 1) paths.push({ pts: chain, closed: false, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
