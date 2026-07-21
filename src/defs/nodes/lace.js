import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  key: "lace",
    name: "Lace",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Pattern", type: "select", options: ["Doily", "Edging", "Mesh ground"], def: "Doily" },
      { key: "rings", label: "Rings (doily)", type: "slider", min: 1, max: 10, step: 1, def: 5 },
      { key: "sectors", label: "Sectors / scallops", type: "slider", min: 4, max: 40, step: 1, def: 16 },
      { key: "detail", label: "Detail", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "picots", label: "Picots", type: "check", def: true },
      { key: "depth", label: "Depth mm (edging)", type: "slider", min: 10, max: 80, step: 1, def: 30 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 7 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const S = Math.max(4, Math.min(64, Math.round(p.sectors)));
      const det = Math.max(0, Math.min(1, p.detail));
      const TWO = Math.PI * 2;
      const paths = [];
      const circleAt = (cx, cy, r, n) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TWO;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        paths.push({ pts, closed: true, layer: L });
      };

      /* ============================ DOILY ============================ */
      if (p.mode === "Doily") {
        const cx = W / 2, cy = H / 2;
        const maxR = Math.min(W, H) / 2 - m;
        if (maxR < 12) return applyStyle({ paths: [] }, ins[0]);
        const P = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        const picotR = p.picots ? Math.min(2.4, Math.max(1, maxR * 0.028)) : 0;
        const scH = Math.max(4, Math.min(15, maxR * 0.15));
        const outerBase = maxR - 2 * picotR - scH;

        /* --- center flower --- */
        const fR = maxR * 0.2;
        const np = Math.min(16, Math.max(5, Math.round(S / 2)));
        const NN = 9;
        for (let j = 0; j < np; j++) {
          const a = (j / np) * TWO;
          const ca = Math.cos(a), sa = Math.sin(a);
          const wid = fR * 0.5;
          const pts = [];
          for (let i = 0; i <= NN; i++) {
            const u = i / NN, t = u * fR, rad = Math.sin(Math.PI * u) * wid * 0.5;
            pts.push([cx + ca * t - sa * rad, cy + sa * t + ca * rad]);
          }
          for (let i = NN - 1; i >= 1; i--) {
            const u = i / NN, t = u * fR, rad = -Math.sin(Math.PI * u) * wid * 0.5;
            pts.push([cx + ca * t - sa * rad, cy + sa * t + ca * rad]);
          }
          paths.push({ pts, closed: true, layer: L });
        }
        circleAt(cx, cy, fR * 0.22, 12);

        /* --- ring bands with hashed classic motifs --- */
        const rIn = fR * 1.3;
        const availB = outerBase - rIn - 2;
        const K = Math.max(0, Math.min(10, Math.round(p.rings)));
        if (availB > 6 && K > 0) {
          const bh = availB / K;
          for (let k = 0; k < K; k++) {
            const r0 = rIn + k * bh + 0.8;
            const r1 = rIn + (k + 1) * bh - 0.8;
            if (r1 - r0 < 1.5) continue;
            const rm = (r0 + r1) / 2;
            const pick = hash2(k * 13 + 2, 5, p.seed);
            if (pick < 0.16) {
              /* plain ring */
              circleAt(cx, cy, rm, Math.max(48, S * 5));
            } else if (pick < 0.32) {
              /* double ring */
              circleAt(cx, cy, r0 + (r1 - r0) * 0.25, Math.max(48, S * 5));
              circleAt(cx, cy, r0 + (r1 - r0) * 0.75, Math.max(48, S * 5));
            } else if (pick < 0.56) {
              /* zigzag mesh: two opposite-phase rings -> diamonds */
              const M = S * 2;
              for (let ph = 0; ph < 2; ph++) {
                const pts = [];
                for (let i = 0; i < M; i++) {
                  const r = (i + ph) % 2 ? r1 : r0;
                  pts.push(P(r, (i / M) * TWO));
                }
                paths.push({ pts, closed: true, layer: L });
              }
            } else if (pick < 0.8) {
              /* fans: per-sector spokes + outer arc */
              const st = TWO / S;
              const nf = 3 + Math.round(det * 4);
              for (let s = 0; s < S; s++) {
                const a0 = s * st, ac = a0 + st / 2;
                const piv = P(r0, ac);
                for (let j = 0; j < nf; j++) {
                  const aj = a0 + (0.12 + 0.76 * (nf === 1 ? 0.5 : j / (nf - 1))) * st;
                  paths.push({ pts: [piv.slice(), P(r1 - 0.3, aj)], closed: false, layer: L });
                }
                const arc = [];
                for (let j = 0; j <= 8; j++) {
                  arc.push(P(r1 - 0.3, a0 + (0.12 + 0.76 * (j / 8)) * st));
                }
                paths.push({ pts: arc, closed: false, layer: L });
              }
            } else {
              /* picot ring: circle with tiny outward loops */
              circleAt(cx, cy, rm, Math.max(48, S * 5));
              let pr = Math.min(2.2, Math.max(0.8, (r1 - r0) * 0.3));
              pr = Math.min(pr, (r1 - rm) / 2);
              if (pr > 0.4) {
                for (let s = 0; s < S; s++) {
                  const a = ((s + 0.5) / S) * TWO;
                  const c = P(rm + pr, a);
                  circleAt(c[0], c[1], pr, 8);
                }
              }
            }
          }
        }

        /* --- outer scalloped edge (classic finish) --- */
        circleAt(cx, cy, outerBase, Math.max(48, S * 5));
        const J = 10;
        const sc = [];
        for (let s = 0; s < S; s++) {
          for (let j = 0; j < J; j++) {
            const u = j / J;
            const a = ((s + u) / S) * TWO;
            const rad = outerBase + scH * Math.pow(Math.sin(Math.PI * u), 1.15);
            sc.push(P(rad, a));
          }
        }
        paths.push({ pts: sc, closed: true, layer: L });
        if (picotR > 0) {
          for (let s = 0; s < S; s++) {
            const a = ((s + 0.5) / S) * TWO;
            const c = P(maxR - picotR, a);
            circleAt(c[0], c[1], picotR, 10);
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ============================ EDGING ============================ */
      if (p.mode === "Edging") {
        const x0 = m, x1 = W - m;
        if (x1 - x0 < 20) return applyStyle({ paths: [] }, ins[0]);
        const y0 = m;
        const Dmax = H - 2 * m;
        let pr = p.picots ? 2 : 0;
        let D = Math.min(Math.max(10, p.depth), Dmax) - 2 * pr;
        if (D < 10) { pr = 0; D = Math.min(Math.max(8, p.depth), Dmax); }
        if (D < 8) return applyStyle({ paths: [] }, ins[0]);

        /* header lines */
        paths.push({ pts: [[x0, y0], [x1, y0]], closed: false, layer: L });
        paths.push({ pts: [[x0, y0 + 1.8], [x1, y0 + 1.8]], closed: false, layer: L });

        /* mesh strip: two opposite-phase zigzags */
        const yA = y0 + 3.5;
        const yB = yA + Math.max(4, D * 0.25);
        const M2 = S * 2;
        for (let ph = 0; ph < 2; ph++) {
          const pts = [];
          for (let i = 0; i <= M2; i++) {
            const x = x0 + (i / M2) * (x1 - x0);
            pts.push([x, (i + ph) % 2 ? yB : yA]);
          }
          paths.push({ pts, closed: false, layer: L });
        }

        /* scallops with fans + picots */
        const yb = yB + 2;
        const ybot = y0 + 3.5 + D;
        if (ybot - yb > 4) {
          const wSc = (x1 - x0) / S;
          const J = 12;
          const chain = [];
          for (let s = 0; s < S; s++) {
            for (let j = 0; j <= (s === S - 1 ? J : J - 1); j++) {
              const u = j / J;
              const x = x0 + ((s + u) / S) * (x1 - x0);
              const y = yb + (ybot - yb) * Math.pow(Math.sin(Math.PI * u), 1.1);
              chain.push([x, y]);
            }
          }
          paths.push({ pts: chain, closed: false, layer: L });
          const nf = 3 + Math.round(det * 4);
          for (let s = 0; s < S; s++) {
            const xs = x0 + s * wSc;
            const piv = [xs + wSc / 2, yb + 0.5];
            for (let j = 0; j < nf; j++) {
              const u = 0.15 + 0.7 * (nf === 1 ? 0.5 : j / (nf - 1));
              const x = xs + u * wSc;
              const y = yb + (ybot - yb) * Math.pow(Math.sin(Math.PI * u), 1.1);
              paths.push({ pts: [piv.slice(), [x, y - 0.4]], closed: false, layer: L });
            }
            if (pr > 0) {
              const cxp = xs + wSc / 2;
              circleAt(cxp, ybot + pr, pr, 10);
            }
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ========================= MESH GROUND ========================= */
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const g = 3.5 + (1 - det) * 9;
      const cs = g * Math.SQRT2;
      /* diagonal families clipped to rect */
      const clipLine = (sign) => {
        /* sign +1: x + y = c ; sign -1: x - y = c */
        const cMin = sign > 0 ? x0 + y0 : x0 - y1;
        const cMax = sign > 0 ? x1 + y1 : x1 - y0;
        for (let c = cMin + cs / 2; c < cMax; c += cs) {
          const cand = [];
          const tryPt = (x, y) => {
            if (x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6) cand.push([x, y]);
          };
          if (sign > 0) {
            tryPt(x0, c - x0); tryPt(x1, c - x1); tryPt(c - y0, y0); tryPt(c - y1, y1);
          } else {
            tryPt(x0, x0 - c); tryPt(x1, x1 - c); tryPt(c + y0, y0); tryPt(c + y1, y1);
          }
          /* dedupe + take extremes */
          const uniq = [];
          for (const q of cand) {
            if (!uniq.some((u) => Math.abs(u[0] - q[0]) < 1e-6 && Math.abs(u[1] - q[1]) < 1e-6)) uniq.push(q);
          }
          if (uniq.length >= 2) {
            uniq.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const a = uniq[0], b = uniq[uniq.length - 1];
            if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) {
              paths.push({ pts: [a, b], closed: false, layer: L });
            }
          }
        }
      };
      clipLine(1); clipLine(-1);
      /* torchon spiders */
      const nx = Math.floor((x1 - x0) / cs), ny = Math.floor((y1 - y0) / cs);
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          if (hash2(i * 3 + 1, j * 3 + 2, p.seed) >= det * 0.45) continue;
          const cxx = x0 + (i + 0.5) * cs, cyy = y0 + (j + 0.5) * cs;
          const d = g * 0.42;
          if (cxx - d < x0 || cxx + d > x1 || cyy - d < y0 || cyy + d > y1) continue;
          paths.push({
            pts: [[cxx + d, cyy], [cxx, cyy + d], [cxx - d, cyy], [cxx, cyy - d]],
            closed: true, layer: L,
          });
          paths.push({ pts: [[cxx - d * 0.55, cyy], [cxx + d * 0.55, cyy]], closed: false, layer: L });
          paths.push({ pts: [[cxx, cyy - d * 0.55], [cxx, cyy + d * 0.55]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
