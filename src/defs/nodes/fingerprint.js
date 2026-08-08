import { Pin, mulberry32, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "fingerprint",
  name: "Fingerprint",
  cat: "gen",
  group: "organic",
  desc: "Fingerprint ridges: evenly spaced rings grow outward from seeded centers, and where two ring systems meet they MERGE into one flowing family instead of crossing - contours of a soft-min distance field, so the gap between neighbouring lines stays constant everywhere like real offset curves. Centers sets the seed count, Ring gap the line spacing, Merge how softly systems fuse (0 = kissing circles, 1 = one big swirling field), Wobble warps the ridges hand-drawn loose, Max rings caps each system so white pools can remain. Line breaks cuts the ridges into dashes the way a drying pen does, and Gap dots drops 1-3 ink dots into some of the breaks - the reference-photo signature. Unlike Truchet (grid-locked arcs) or Contour Field (coarse angular level lines), these are smooth constant-spacing organic ridges. Heavier than average: lower Centers or raise Ring gap while sketching.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seeds", label: "Centers", type: "slider", min: 1, max: 40, step: 1, def: 12 },
    { key: "gap", label: "Ring gap mm", type: "slider", min: 1, max: 8, step: 0.1, def: 2.2 },
    { key: "merge", label: "Merge", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
    { key: "maxRings", label: "Max rings", type: "slider", min: 5, max: 80, step: 1, def: 60 },
    { key: "breaks", label: "Line breaks", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "dots", label: "Gap dots", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 4 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  overlay(p, ctx) {
    /* seed centers + field box, same placement math as compute */
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const bw = W - 2 * m, bh = H - 2 * m;
    if (bw < 10 || bh < 10) return [];
    const rng = mulberry32(p.seed * 6689 + 31);
    const nS = Math.max(1, Math.min(40, Math.round(p.seeds)));
    const minD = Math.sqrt((bw * bh) / nS) * 0.55;
    const pts = [];
    for (let i = 0; i < nS; i++) {
      for (let a = 0; a < 40; a++) {
        const x = m + rng() * bw, y = m + rng() * bh;
        if (pts.every(([qx, qy]) => Math.hypot(qx - x, qy - y) >= minD)) { pts.push([x, y]); break; }
      }
    }
    const guides = [{ kind: "rect", x: m, y: m, w: bw, h: bh }];
    for (const [x, y] of pts) guides.push({ kind: "point", x, y });
    return guides;
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const bw = W - 2 * m, bh = H - 2 * m;
    if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
    const rng = mulberry32(p.seed * 6689 + 31);
    const L = Math.round(p.layer);
    const gap = Math.max(0.6, p.gap);

    /* ---- seeded centers (dart throwing, identical stream to overlay) ---- */
    const nS = Math.max(1, Math.min(40, Math.round(p.seeds)));
    const minD = Math.sqrt((bw * bh) / nS) * 0.55;
    const seeds = [];
    for (let i = 0; i < nS; i++) {
      for (let a = 0; a < 40; a++) {
        const x = m + rng() * bw, y = m + rng() * bh;
        if (seeds.every(([qx, qy]) => Math.hypot(qx - x, qy - y) >= minD)) { seeds.push([x, y]); break; }
      }
    }
    if (!seeds.length) return applyStyle({ paths: [] }, ins[0]);

    /* ---- soft-min distance field on a fine grid, domain-warped ---- */
    const k = gap * (0.1 + p.merge * 2);            /* smooth-min radius */
    const wa = p.wobble * gap * 2.5, ws = 0.035;      /* warp amp + scale */
    let cs = Math.max(0.8, gap / 2.5);                /* grid cell mm */
    while (((Math.ceil(bw / cs) + 1) * (Math.ceil(bh / cs) + 1)) > 95000) cs *= 1.25;
    const gx = Math.ceil(bw / cs), gy = Math.ceil(bh / cs);
    const field = (x, y) => {
      const xw = x + (noise2(x * ws, y * ws, p.seed * 3 + 7) - 0.5) * 2 * wa;
      const yw = y + (noise2(x * ws + 43, y * ws + 43, p.seed * 5 + 9) - 0.5) * 2 * wa;
      /* LSE soft-min of distances to all centers */
      let mn = 1e18;
      for (const [sx2, sy2] of seeds) { const d = Math.hypot(xw - sx2, yw - sy2); if (d < mn) mn = d; }
      let s = 0;
      for (const [sx2, sy2] of seeds) s += Math.exp(-(Math.hypot(xw - sx2, yw - sy2) - mn) / k);
      return mn - k * Math.log(s);
    };
    const F = new Float64Array((gx + 1) * (gy + 1));
    for (let r = 0; r <= gy; r++) {
      for (let c = 0; c <= gx; c++) F[r * (gx + 1) + c] = field(m + (c / gx) * bw, m + (r / gy) * bh);
    }
    let maxd = 0;
    for (let i = 0; i < F.length; i++) if (F[i] > maxd) maxd = F[i];

    /* ---- ring levels, marching squares, chaining ---- */
    const paths = [];
    const BUDGET = 116000;
    let total = 0;
    const toMM = ([cx2, cy2]) => [m + (cx2 / gx) * bw, m + (cy2 / gy) * bh];
    const dotify = (x, y) => {
      if (total + 2 > BUDGET) return;
      total += 2;
      paths.push({ pts: [[x, y], [x + 0.05, y]], closed: false, layer: L });
    };
    const emit = (ptsG, closed) => {
      const pts = ptsG.map(toMM);
      if (pts.length < 2) return;
      if (p.breaks <= 0) {
        if (total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({ pts, closed, layer: L });
        return;
      }
      /* dashed ridges: draw stretches broken by short pen-up gaps, dots in some gaps */
      const rs = resample(pts, closed, 0.45);
      let i = 0;
      while (i < rs.length - 1) {
        const drawLen = (6 + rng() * 24) * (1.25 - p.breaks);
        const nDraw = Math.max(2, Math.round(drawLen / 0.45));
        const piece = rs.slice(i, Math.min(rs.length, i + nDraw + 1));
        if (piece.length >= 2 && total + piece.length <= BUDGET) {
          total += piece.length;
          paths.push({ pts: piece, closed: false, layer: L });
        }
        i += nDraw;
        const gapLen = 0.8 + rng() * 1.8;
        const nGap = Math.max(1, Math.round(gapLen / 0.45));
        if (p.dots && rng() < 0.6) {
          const nDots = 1 + Math.floor(rng() * 3);
          for (let d = 1; d <= nDots; d++) {
            const j = i + Math.round((d / (nDots + 1)) * nGap);
            if (j < rs.length) dotify(rs[j][0], rs[j][1]);
          }
        }
        i += nGap;
      }
    };
    const key = (q) => Math.round(q[0] * 1e6) + "_" + Math.round(q[1] * 1e6);
    const NLmax = Math.max(1, Math.min(80, Math.round(p.maxRings)));
    for (let li = 0; li < NLmax; li++) {
      const v = gap * (li + 0.5);
      if (v > maxd || total >= BUDGET) break;
      const segs = [];
      for (let r = 0; r < gy; r++) {
        for (let c = 0; c < gx; c++) {
          const tl = F[r * (gx + 1) + c], tr2 = F[r * (gx + 1) + c + 1];
          const br = F[(r + 1) * (gx + 1) + c + 1], bl = F[(r + 1) * (gx + 1) + c];
          const idx = (tl > v ? 8 : 0) + (tr2 > v ? 4 : 0) + (br > v ? 2 : 0) + (bl > v ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const T = [c + (v - tl) / (tr2 - tl), r];
          const R = [c + 1, r + (v - tr2) / (br - tr2)];
          const B = [c + (v - bl) / (br - bl), r + 1];
          const Lp = [c, r + (v - tl) / (bl - tl)];
          const add = (a, b) => segs.push([a, b]);
          if (idx === 1) add(Lp, B); else if (idx === 2) add(B, R);
          else if (idx === 3) add(Lp, R); else if (idx === 4) add(T, R);
          else if (idx === 6) add(T, B); else if (idx === 7) add(T, Lp);
          else if (idx === 8) add(T, Lp); else if (idx === 9) add(T, B);
          else if (idx === 11) add(T, R); else if (idx === 12) add(Lp, R);
          else if (idx === 13) add(B, R); else if (idx === 14) add(Lp, B);
          else {
            const chi = (tl + tr2 + br + bl) / 4 > v;
            if (idx === 5) { if (chi) { add(T, Lp); add(B, R); } else { add(T, R); add(B, Lp); } }
            else { if (chi) { add(T, R); add(Lp, B); } else { add(T, Lp); add(B, R); } }
          }
        }
      }
      const adj = new Map();
      const push = (kk, si, end) => {
        if (!adj.has(kk)) adj.set(kk, []);
        adj.get(kk).push([si, end]);
      };
      segs.forEach((s, i) => { push(key(s[0]), i, 0); push(key(s[1]), i, 1); });
      const used = new Array(segs.length).fill(false);
      const walk = (si, end) => {
        used[si] = true;
        const chain = [segs[si][end], segs[si][1 - end]];
        for (;;) {
          const kk = key(chain[chain.length - 1]);
          const nexts = (adj.get(kk) || []).filter(([j]) => !used[j]);
          if (!nexts.length) break;
          const [j, e] = nexts[0];
          used[j] = true;
          chain.push(segs[j][1 - e]);
        }
        return chain;
      };
      const onBorder = (q) => q[0] < 1e-9 || q[1] < 1e-9 || q[0] > gx - 1e-9 || q[1] > gy - 1e-9;
      segs.forEach((s, i) => {
        if (used[i]) return;
        for (const end of [0, 1]) {
          if (!used[i] && onBorder(s[end]) && (adj.get(key(s[end])) || []).filter(([j]) => !used[j]).length === 1) {
            emit(walk(i, end), false);
          }
        }
      });
      segs.forEach((s, i) => {
        if (used[i]) return;
        const chain = walk(i, 0);
        if (key(chain[0]) === key(chain[chain.length - 1])) { chain.pop(); emit(chain, chain.length > 2); }
        else emit(chain, false);
      });
    }
    return applyStyle({ paths }, ins[0]);
  }
};
