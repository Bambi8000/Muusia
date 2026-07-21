import { Pin, resample, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "ruler",
    name: "Ruler", cat: "gen", group: "scientific", ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "scale", label: "Scale", type: "select", options: ["Linear", "Logarithmic (slide rule)"], def: "Linear" },
      { key: "spacing", label: "Tick spacing mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 2 },
      { key: "decades", label: "Decades (log)", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "minor", label: "Minor tick mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 3 },
      { key: "major", label: "Major tick mm", type: "slider", min: 1, max: 40, step: 0.25, def: 8 },
      { key: "side", label: "Ticks side", type: "select", options: ["Up", "Down", "Both"], def: "Up" },
      { key: "baseline", label: "Draw baseline", type: "check", def: true },
      { key: "labels", label: "Every 10th tick", type: "select", options: ["None", "Numbers", "Symbols"], def: "Numbers" },
      { key: "lsize", label: "Label size mm", type: "slider", min: 1, max: 15, step: 0.25, def: 4 },
      { key: "lstep", label: "Number step", type: "slider", min: 1, max: 100, step: 1, def: 1 },
      { key: "margin", label: "Margin mm (no spine)", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const spines = ins[0] && ins[0].paths && ins[0].paths.length
        ? ins[0].paths
        : [{ pts: [[p.margin, H / 2], [W - p.margin, H / 2]], closed: false, layer: L }];
      const paths = [];
      const SYMS = ["circle", "triangle", "square", "plus", "cross"];
      const symbolAt = (kind, x, y, r, ca, sa, layer) => {
        const T = ([lx, ly]) => [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
        if (kind === "circle") {
          const pts = [];
          for (let q = 0; q < 12; q++) {
            const a = (q / 12) * Math.PI * 2;
            pts.push(T([Math.cos(a) * r, Math.sin(a) * r]));
          }
          paths.push({ pts, closed: true, layer });
        } else if (kind === "triangle") {
          const pts = [0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2 - Math.PI / 2;
            return T([Math.cos(a) * r, Math.sin(a) * r]);
          });
          paths.push({ pts, closed: true, layer });
        } else if (kind === "square") {
          paths.push({ pts: [T([-r, -r]), T([r, -r]), T([r, r]), T([-r, r])], closed: true, layer });
        } else if (kind === "plus") {
          paths.push({ pts: [T([-r, 0]), T([r, 0])], closed: false, layer });
          paths.push({ pts: [T([0, -r]), T([0, r])], closed: false, layer });
        } else {
          paths.push({ pts: [T([-r, -r]), T([r, r])], closed: false, layer });
          paths.push({ pts: [T([r, -r]), T([-r, r])], closed: false, layer });
        }
      };
      for (const spine of spines) {
        const base = resample(spine.pts, spine.closed, 0.6);
        if (base.length < 2) continue;
        const closed = !!spine.closed;
        const pts2 = closed ? [...base, base[0]] : base;
        const cum = [0];
        for (let i = 1; i < pts2.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts2[i][0] - pts2[i - 1][0], pts2[i][1] - pts2[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 2) continue;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = pts2[lo][0] + (pts2[hi][0] - pts2[lo][0]) * f;
          const y = pts2[lo][1] + (pts2[hi][1] - pts2[lo][1]) * f;
          const tx = pts2[hi][0] - pts2[lo][0], ty = pts2[hi][1] - pts2[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };
        if (p.baseline) paths.push({ pts: base.map((q) => q.slice()), closed, layer: spine.layer !== undefined ? spine.layer : L });
        /* tick-lista: [s, rank(0=minor,1=medium,2=major), labelValue] */
        const ticks = [];
        if (p.scale === "Linear") {
          const n = Math.floor(total / Math.max(0.3, p.spacing));
          for (let k = 0; k <= n; k++) {
            if (closed && k === n && (k * p.spacing) >= total - 0.01) break;
            ticks.push([k * p.spacing, k % 10 === 0 ? 2 : k % 5 === 0 ? 1 : 0, (k / 10) * p.lstep]);
          }
        } else {
          const D = Math.round(p.decades);
          const unit = total / D;
          for (let d = 0; d < D; d++) {
            for (let v = 10; v < 100; v++) {
              const s = (d + Math.log10(v / 10)) * unit;
              ticks.push([s, v % 10 === 0 ? 2 : v % 5 === 0 ? 1 : 0, v / 10]);
            }
          }
          ticks.push([total, 2, 10]);
        }
        let majorIdx = 0;
        for (const [s, rank, val] of ticks) {
          const [x, y, tx, ty] = at(s);
          const nx = -ty, ny = tx;
          const len = rank === 2 ? p.major : rank === 1 ? (p.minor + p.major) / 2 : p.minor;
          let a0 = 0, a1 = 0;
          if (p.side === "Up") { a0 = 0; a1 = -len; }
          else if (p.side === "Down") { a0 = 0; a1 = len; }
          else { a0 = -len / 2; a1 = len / 2; }
          paths.push({
            pts: [[x + nx * a0, y + ny * a0], [x + nx * a1, y + ny * a1]],
            closed: false, layer: L,
          });
          if (rank === 2 && p.labels !== "None") {
            const off = (p.side === "Down" ? len : -len) + (p.side === "Down" ? 1.5 : -1.5);
            const lx = x + nx * off, ly = y + ny * off;
            if (p.labels === "Symbols") {
              symbolAt(SYMS[majorIdx % SYMS.length], lx + nx * (p.side === "Down" ? p.lsize / 2 : -p.lsize / 2), ly + ny * (p.side === "Down" ? p.lsize / 2 : -p.lsize / 2) * 1, p.lsize / 2, tx, ty, L);
            } else {
              const label = p.scale === "Linear"
                ? String(Math.round(val * 100) / 100)
                : String(Math.round(val * 10) / 10);
              const fs = fontStrokes(label, p.lsize, 1);
              /* keskita tekstin leveys tickin kohdalle, ylareuna tickin karjesta poispain */
              const bx = -fs.width / 2;
              const by = p.side === "Down" ? 0 : -p.lsize;
              for (const stroke of fs.strokes) {
                paths.push({
                  pts: stroke.map(([gx, gy]) => {
                    const ox = bx + gx, oy = by + gy;
                    return [lx + ox * tx + oy * nx, ly + ox * ty + oy * ny];
                  }),
                  closed: false, layer: L,
                });
              }
            }
            majorIdx++;
          }
        }
      }
      return applyStyle({ paths }, ins[1]);
    },
  
};
