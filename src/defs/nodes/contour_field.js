import { Pin, PENS, hash2, noise2, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "contour_field",
  name: "Contour Field",
  cat: "gen",
  group: "scientific",
  desc: "Early-computer-art contour plot: a random height field sampled on a COARSE grid and contoured with straight-line interpolation, so the level lines stay hard-cornered and angular - nested angular diamonds around peaks, tight parallel bundles on steep slopes. Cells sets the grid coarseness (fewer = more angular), Levels the contour count, Roughness blends a smooth terrain into fully independent random spot heights (jagged chaos). Edge numbers stamps each level's index where its line runs off the field, like hand-annotated plotter output from 1970 - on their own pen. Pens cycles levels across the palette. Wire Frame into Seed for a boiling animation.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "cells", label: "Cells (coarseness)", type: "slider", min: 3, max: 24, step: 1, def: 8 },
    { key: "levels", label: "Levels", type: "slider", min: 3, max: 40, step: 1, def: 15 },
    { key: "rough", label: "Roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "labels", label: "Edge numbers", type: "check", def: true },
    { key: "labelSize", label: "Number size mm", type: "slider", min: 1.5, max: 6, step: 0.1, def: 3 },
    { key: "labelPen", label: "Number pen", type: "pen", def: 0 },
    { key: "pens", label: "Pens (cycle levels)", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 3 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const band = p.labels ? Math.max(4, p.labelSize * 1.6) : 0; /* room for edge numbers */
    const x0f = m + band, y0f = m + band;
    const fw = W - 2 * (m + band), fh = H - 2 * (m + band);
    if (fw < 20 || fh < 20) return applyStyle({ paths: [] }, ins[0]);
    const L = Math.round(p.layer), LP = Math.round(p.labelPen);
    const NP = Math.max(1, Math.min(PENS.length, Math.round(p.pens)));
    const gx = Math.max(3, Math.min(24, Math.round(p.cells)));
    const gy = Math.max(3, Math.round(gx * (fh / fw)));
    const NL = Math.max(3, Math.min(40, Math.round(p.levels)));

    /* coarse height field: smooth terrain blended toward independent spot heights */
    const F = [];
    for (let r = 0; r <= gy; r++) {
      const row = [];
      for (let c = 0; c <= gx; c++) {
        const sm = noise2(c * 0.55 + 13.7, r * 0.55 + 71.3, p.seed * 3 + 1);
        const rd = hash2(c, r, p.seed * 13 + 5);
        row.push(sm * (1 - p.rough) + rd * p.rough);
      }
      F.push(row);
    }
    let lo = 1e9, hi = -1e9;
    for (const row of F) for (const v of row) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const span = Math.max(1e-9, hi - lo);

    const toMM = ([cx2, cy2]) => [x0f + (cx2 / gx) * fw, y0f + (cy2 / gy) * fh];
    const paths = [];
    const BUDGET = 118000;
    let total = 0;
    const emit = (ptsG, closed, layer) => {
      if (ptsG.length < 2 || total + ptsG.length > BUDGET) return;
      total += ptsG.length;
      paths.push({ pts: ptsG.map(toMM), closed, layer });
    };

    const labelSpots = []; /* [levelIndex, endpoint(grid), side] */
    for (let li = 0; li < NL; li++) {
      const v = lo + span * ((li + 0.5) / NL);
      /* marching squares on the coarse grid: bits TL=8 TR=4 BR=2 BL=1 */
      const segs = [];
      for (let r = 0; r < gy; r++) {
        for (let c = 0; c < gx; c++) {
          const tl = F[r][c], tr2 = F[r][c + 1], br = F[r + 1][c + 1], bl = F[r + 1][c];
          const idx = (tl > v ? 8 : 0) + (tr2 > v ? 4 : 0) + (br > v ? 2 : 0) + (bl > v ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const T = [c + (v - tl) / (tr2 - tl), r];
          const R = [c + 1, r + (v - tr2) / (br - tr2)];
          const B = [c + (v - bl) / (br - bl), r + 1];
          const Lp = [c, r + (v - tl) / (bl - tl)];
          const add = (a, b) => segs.push([a, b]);
          if (idx === 1) add(Lp, B);
          else if (idx === 2) add(B, R);
          else if (idx === 3) add(Lp, R);
          else if (idx === 4) add(T, R);
          else if (idx === 6) add(T, B);
          else if (idx === 7) add(T, Lp);
          else if (idx === 8) add(T, Lp);
          else if (idx === 9) add(T, B);
          else if (idx === 11) add(T, R);
          else if (idx === 12) add(Lp, R);
          else if (idx === 13) add(B, R);
          else if (idx === 14) add(Lp, B);
          else {
            /* saddles: disambiguate with the cell-center mean */
            const chi = (tl + tr2 + br + bl) / 4 > v;
            if (idx === 5) { if (chi) { add(T, Lp); add(B, R); } else { add(T, R); add(B, Lp); } }
            else { if (chi) { add(T, R); add(Lp, B); } else { add(T, Lp); add(B, R); } }
          }
        }
      }
      /* chain segments into polylines; String(-0) is "0" so keys are -0-safe */
      const key = (q) => Math.round(q[0] * 1e6) + "_" + Math.round(q[1] * 1e6);
      const adj = new Map();
      const push = (k, si, end) => {
        if (!adj.has(k)) adj.set(k, []);
        adj.get(k).push([si, end]);
      };
      segs.forEach((s, i) => { push(key(s[0]), i, 0); push(key(s[1]), i, 1); });
      const used = new Array(segs.length).fill(false);
      const walk = (si, end) => {
        /* start at segs[si], entering from its `end` endpoint */
        used[si] = true;
        const chain = [segs[si][end], segs[si][1 - end]];
        for (;;) {
          const k = key(chain[chain.length - 1]);
          const nexts = (adj.get(k) || []).filter(([j]) => !used[j]);
          if (!nexts.length) break;
          const [j, e] = nexts[0];
          used[j] = true;
          chain.push(segs[j][1 - e]);
        }
        return chain;
      };
      const onBorder = (q) => q[0] < 1e-9 || q[1] < 1e-9 || q[0] > gx - 1e-9 || q[1] > gy - 1e-9;
      const chains = [];
      /* open chains first: start from border endpoints with a single attached segment */
      segs.forEach((s, i) => {
        if (used[i]) return;
        for (const end of [0, 1]) {
          if (!used[i] && onBorder(s[end]) && (adj.get(key(s[end])) || []).filter(([j]) => !used[j]).length === 1) {
            chains.push({ pts: walk(i, end), open: true });
          }
        }
      });
      segs.forEach((s, i) => { if (!used[i]) chains.push({ pts: walk(i, 0), open: false }); });
      const pen = NP > 1 ? (L + (li % NP)) % PENS.length : L;
      for (const ch of chains) {
        if (ch.open) emit(ch.pts, false, pen);
        else {
          const pts = ch.pts.slice();
          if (key(pts[0]) === key(pts[pts.length - 1])) pts.pop();
          emit(pts, pts.length > 2, pen);
        }
      }
      if (p.labels) {
        const op = chains.find((ch) => ch.open && onBorder(ch.pts[0]));
        if (op) {
          const e = op.pts[0];
          const side = e[0] < 1e-9 ? "L" : e[0] > gx - 1e-9 ? "R" : e[1] < 1e-9 ? "T" : "B";
          labelSpots.push([li + 1, e, side]);
        }
      }
    }

    /* edge numbers just outside the field, like annotated plotter output */
    if (p.labels) {
      const placed = []; /* [x, y, w, h] of emitted numbers; overlapping ones are skipped */
      for (const [num, e, side] of labelSpots) {
        const fsRes = fontStrokes(String(num), p.labelSize);
        const [ex, ey] = toMM(e);
        const gap = 2.2;
        let tx, ty;
        if (side === "L") { tx = ex - gap - fsRes.width; ty = ey - p.labelSize / 2; }
        else if (side === "R") { tx = ex + gap; ty = ey - p.labelSize / 2; }
        else if (side === "T") { tx = ex - fsRes.width / 2; ty = ey - gap - p.labelSize; }
        else { tx = ex - fsRes.width / 2; ty = ey + gap; }
        tx = Math.max(1, Math.min(W - 1 - fsRes.width, tx));
        ty = Math.max(1, Math.min(H - 1 - p.labelSize, ty));
        const pad = 1.2;
        const hit = placed.some(([qx, qy, qw, qh]) =>
          tx < qx + qw + pad && tx + fsRes.width > qx - pad &&
          ty < qy + qh + pad && ty + p.labelSize > qy - pad);
        if (hit) continue;
        placed.push([tx, ty, fsRes.width, p.labelSize]);
        for (const stroke of fsRes.strokes) {
          const pts = stroke.map(([sx, sy]) => [tx + sx, ty + sy]);
          if (pts.length >= 2 && total + pts.length <= BUDGET) {
            total += pts.length;
            paths.push({ pts, closed: false, layer: LP });
          }
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  }
};
