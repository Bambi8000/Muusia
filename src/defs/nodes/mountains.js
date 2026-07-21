import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "mountains",
    name: "Mountains", cat: "gen", group: "nature", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "rows", label: "Ridge lines", type: "slider", min: 8, max: 90, step: 1, def: 36 },
      { key: "height", label: "Height mm", type: "slider", min: 5, max: 150, step: 1, def: 55 },
      { key: "depth", label: "Depth mm", type: "slider", min: 20, max: 300, step: 1, def: 110 },
      { key: "scale", label: "Terrain scale", type: "slider", min: 0.004, max: 0.06, step: 0.001, def: 0.015 },
      { key: "octaves", label: "Octaves", type: "slider", min: 1, max: 5, step: 1, def: 4 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "skew", label: "Skew mm (oblique)", type: "slider", min: -80, max: 80, step: 1, def: 0 },
      { key: "fade", label: "Fade edges (island)", type: "check", def: true },
      { key: "cross", label: "Cross lines (mesh)", type: "check", def: false },
      { key: "res", label: "Resolution mm", type: "slider", min: 0.5, max: 4, step: 0.25, def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 51 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rows = Math.round(p.rows);
      const x0 = p.margin + Math.max(0, -p.skew), x1 = W - p.margin - Math.max(0, p.skew);
      const width = x1 - x0;
      if (width < 10) return EMPTY;
      const nx = Math.max(8, Math.floor(width / Math.max(0.4, p.res)));
      const oct = Math.round(p.octaves);
      const fbm = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < oct; o++) {
          v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
          tot += amp; amp *= 0.5; fq *= 2;
        }
        return v / tot;
      };
      const baseY = H - p.margin - 2;
      const L = Math.round(p.layer);
      const centerX = (x0 + x1) / 2;
      /* korkeus + reunahaivytys */
      const hAt = (u, rowT) => {
        let h = fbm(u * width * 2, rowT * p.depth * 2);
        h = Math.pow(h, 1.3);
        if (p.fade) {
          const ex = Math.min(1, Math.min(u, 1 - u) * 5);
          const ey = Math.min(1, Math.min(rowT, 1 - rowT) * 5);
          h *= ex * ex * (3 - 2 * ex) * (ey * ey * (3 - 2 * ey));
        }
        return h * p.height;
      };
      /* perspektiivi: rivit kapenevat ja tihenevat syvyyteen */
      const rowScale = (t) => 1 - 0.62 * p.persp * t;
      const rowYOff = (t) => p.depth * (t / (1 + p.persp * t * 1.15));
      /* piilotettu viiva: horisonttipuskuri RUUDUN x-sarakkeittain
         (toimii myos skew + perspektiivi -siirtymilla) */
      const binW = Math.max(0.4, p.res);
      const nBins = Math.ceil(W / binW) + 2;
      const horizon = new Array(nBins).fill(Infinity);
      const binOf = (sx) => Math.max(0, Math.min(nBins - 1, Math.round(sx / binW)));
      const rowPts = [];
      const paths = [];
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        const rowT = rIdx / Math.max(1, rows - 1);       /* 0 = edessa */
        const rs = rowScale(rowT);
        const sy0 = baseY - rowYOff(rowT);
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        const rowRec = [];
        for (let i = 0; i <= nx; i++) {
          const u = i / nx;
          const sx = centerX + (u - 0.5) * width * rs + p.skew * rowT;
          const sy = sy0 - hAt(u, rowT) * rs;
          const b = binOf(sx);
          const vis = sy < horizon[b] - 0.05;
          rowRec.push([sx, sy, vis]);
          if (vis) {
            run.push([sx, sy]);
            if (sy < horizon[b]) horizon[b] = sy;
          } else flush();
        }
        flush();
        rowPts.push(rowRec);
      }
      if (p.cross) {
        for (let i = 0; i <= nx; i += Math.max(2, Math.round(nx / 60))) {
          let run = [];
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (let rIdx = 0; rIdx < rows; rIdx++) {
            const [sx, sy, vis] = rowPts[rIdx][i];
            if (vis) run.push([sx, sy]);
            else flush();
          }
          flush();
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
