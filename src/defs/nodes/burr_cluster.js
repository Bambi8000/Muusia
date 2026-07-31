import { Pin, EMPTY, PENS, mulberry32, hash2, noise2, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "burr_cluster",
  name: "Burr Cluster",
  cat: "gen",
  group: "nature",
  desc: "A clustered mass of overlapping seed pods \u2014 burrs \u2014 grown by chaining noise-edged lobes onto each other. Every lobe fills with stitched-panel rows that follow the pod's own outline — the top rows bow with the upper edge, the bottom rows with the lower, squeezing together at the tips like quilted seams (Angle jitter turns each pod's grain, Speckle skips short ink gaps along the rows, Wobble bends them); lobes layer over one another and Seam gap erodes a clean white channel between the panels so every pod reads as its own stitched piece; Spread runs from a deeply merged mass to pods sitting side by side. The signature bristle: short spikes radiate from every visible edge \u2014 outer silhouette and internal seams alike \u2014 with jittered angles and crossing X pairs (Spikes sets density, Spike length their reach). Blots splatters small filled ink dots across the mass. Lobes and Lobe size grow the colony from a sprig to a full sheet; the cluster chains from the Center point. Tip: two clusters on separate pens, slightly overlapping, make the classic double-pod composition.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "lobes", label: "Lobes", type: "slider", min: 3, max: 24, step: 1, def: 12 },
    { key: "size", label: "Lobe size", type: "slider", min: 10, max: 55, step: 0.5, def: 26 },
    { key: "spread", label: "Spread", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "seam", label: "Seam gap", type: "slider", min: 0, max: 2.5, step: 0.05, def: 1.0 },
    { key: "hatchStep", label: "Hatch spacing", type: "slider", min: 0.7, max: 3, step: 0.05, def: 1.1 },
    { key: "angJit", label: "Angle jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "speckle", label: "Speckle", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "spikes", label: "Spikes", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7 },
    { key: "spikeLen", label: "Spike length", type: "slider", min: 1, max: 8, step: 0.1, def: 3.5 },
    { key: "blots", label: "Blots", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "cx", label: "Center X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Center Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [
      { kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m },
      { kind: "point", x: (ctx.W * p.cx) / 100, y: (ctx.H * p.cy) / 100 },
    ];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed);
    const m = Math.max(0, p.margin);
    const lox = m, loy = m, hix = W - m, hiy = H - m;
    if (hix - lox < 15 || hiy - loy < 15) return EMPTY;
    const pen = Math.round(p.layer) % PENS.length;
    const nL = Math.max(1, Math.round(p.lobes));
    const base = Math.max(5, p.size);
    const rng = mulberry32(seed * 7919 + 13);
    const paths = [];
    let budget = 112000;
    const push = (pts, closed) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed, layer: pen });
    };
    const inR = ([x, y]) => x >= lox && x <= hix && y >= loy && y <= hiy;

    /* ---- lobes: chained random walk, each overlapping a previous one ---- */
    const lobes = [];
    for (let i = 0; i < nL; i++) {
      const r = base * (0.55 + 0.6 * rng());
      let x, y;
      if (i === 0) {
        x = (W * p.cx) / 100; y = (H * p.cy) / 100;
      } else {
        const par = lobes[Math.floor(rng() * lobes.length)];
        const a = rng() * Math.PI * 2;
        // Spread 0 = deeply merged mass, 1 = pods side by side, barely touching
        const d = (par.r + r) * (0.34 + 0.52 * p.spread + 0.14 * rng());
        x = par.x + Math.cos(a) * d;
        y = par.y + Math.sin(a) * d;
      }
      x = Math.min(hix - r * 0.4, Math.max(lox + r * 0.4, x));
      y = Math.min(hiy - r * 0.4, Math.max(loy + r * 0.4, y));
      lobes.push({ x, y, r, i });
    }
    const edgeR = (L, ang) =>
      L.r * (1 + 0.25 * (noise2(Math.cos(ang) * 1.6 + L.i * 3, Math.sin(ang) * 1.6 + L.i * 3, seed) - 0.5) * 2);
    const inLobe = (L, px, py) => {
      const dx = px - L.x, dy = py - L.y;
      const d = Math.hypot(dx, dy);
      return d <= (d < L.r * 0.6 ? L.r : edgeR(L, Math.atan2(dy, dx)));
    };
    const topLobe = (px, py) => {
      for (let i = nL - 1; i >= 0; i--) if (inLobe(lobes[i], px, py)) return i;
      return -1;
    };
    // 1 mm grid cache of topLobe over the region: hatch clipping + seam
    // erosion read this instead of calling topLobe per point
    const gw = Math.ceil(hix - lox) + 1, gh = Math.ceil(hiy - loy) + 1;
    const grid = new Int8Array(gw * gh).fill(-1);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++)
        grid[gy * gw + gx] = topLobe(lox + gx, loy + gy);
    const gTop = (px, py) => {
      const gx = Math.round(px - lox), gy = Math.round(py - loy);
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return -1;
      return grid[gy * gw + gx];
    };
    const seam = Math.max(0, p.seam);
    // panel membership with seam erosion: the point AND its ring at seam
    // distance must all belong to lobe i -> rows stop short of every seam
    const inPanel = (px, py, i) => {
      if (gTop(px, py) !== i) return false;
      if (seam < 0.05) return true;
      return gTop(px + seam, py) === i && gTop(px - seam, py) === i &&
             gTop(px, py + seam) === i && gTop(px, py - seam) === i;
    };

    /* ---- per-lobe hatch: stitched-panel rows that FOLLOW the pod shape ---
       row k interpolates between the lobe's top and bottom edge curves, so
       rows bow with the outline and squeeze at the tips like quilted seams */
    for (const L of lobes) {
      if (budget <= 0) break;
      const a = (hash2(L.i, 1, seed) - 0.5) * 0.9 * p.angJit;
      const ca = Math.cos(a), sa = Math.sin(a);
      const ext = L.r * 1.35;
      const du = 1.0;
      const nu = Math.ceil((2 * ext) / du);
      const toW = (u, v) => [L.x + ca * u - sa * v, L.y + sa * u + ca * v];
      // profile: lobe extent [vMin, vMax] at each u (grain-frame scanline)
      const vMin = new Array(nu + 1).fill(Infinity);
      const vMax = new Array(nu + 1).fill(-Infinity);
      for (let iu = 0; iu <= nu; iu++) {
        const u = -ext + iu * du;
        for (let v = -ext; v <= ext; v += 0.8) {
          const [wx, wy] = toW(u, v);
          if (inLobe(L, wx, wy)) {
            if (v < vMin[iu]) vMin[iu] = v;
            if (v > vMax[iu]) vMax[iu] = v;
          }
        }
      }
      // light smoothing hides the scan quantisation in the row curves
      const sm = (A) => A.map((v, i) => {
        if (!isFinite(v)) return v;
        let s2 = 0, n2 = 0;
        for (let d = -2; d <= 2; d++) {
          const w2 = A[i + d];
          if (isFinite(w2)) { s2 += w2; n2++; }
        }
        return s2 / n2;
      });
      const vLo = sm(vMin), vHi = sm(vMax);
      let height = 0;
      for (let iu = 0; iu <= nu; iu++)
        if (isFinite(vLo[iu])) height = Math.max(height, vHi[iu] - vLo[iu]);
      const step = Math.max(0.5, p.hatchStep);
      const nRows = Math.max(1, Math.round(height / step));
      const pad = Math.min(0.35, (0.45 * step) / Math.max(1, height));
      let flip = false;
      for (let k2 = 0; k2 < nRows; k2++) {
        const f = pad + ((k2 + 0.5) / nRows) * (1 - 2 * pad);
        let run = [];
        const flush = () => {
          // rows need >= 3 pts: keeps 2-pt paths exclusive to spikes and
          // drops sub-2mm fragments at pod tips
          if (run.length >= 3 && pathLength(run, false) > 1.6)
            push(flip ? run.reverse() : run, false);
          run = [];
        };
        // speckle: short INK-SKIP gaps along the row — draw a 2.5-6.5 mm
        // segment, then maybe skip 0.5-1.9 mm and continue. Small gaps never
        // stack across rows into holes the way whole-chunk dropout did.
        let cPos = 0, cLen = 0, cKeep = true, chunkIdx = 0;
        for (let iu = 0; iu <= nu; iu++) {
          if (!isFinite(vLo[iu]) || vHi[iu] - vLo[iu] < 0.8) { flush(); continue; }
          if (cPos >= cLen) {
            chunkIdx++;
            if (cKeep && hash2(k2 * 131 + chunkIdx, L.i * 7 + 1, seed + 9) < p.speckle * 0.75) {
              cKeep = false; // insert a short gap
              cLen = Math.max(1, Math.round((0.5 + 1.4 * hash2(k2 * 57 + chunkIdx, L.i, seed + 3)) / du));
              flush();
            } else {
              cKeep = true;  // next drawn segment
              cLen = Math.round((2.5 + 4 * hash2(k2 * 57 + chunkIdx, L.i, seed + 3)) / du);
            }
            cPos = 0;
          }
          cPos++;
          if (!cKeep) continue;
          const u = -ext + iu * du;
          let v = vLo[iu] + f * (vHi[iu] - vLo[iu]);
          if (p.wobble > 0)
            v += (noise2(u * 0.07 + L.i, k2 * 0.43, seed + 5) - 0.5) * p.wobble * 1.4;
          const [px, py] = toW(u, v);
          if (inR([px, py]) && inPanel(px, py, L.i)) run.push([px, py]);
          else flush();
        }
        flush();
        flip = !flip;
      }
    }

    /* ---- spikes: bristles on every VISIBLE edge (silhouette + seams) ---- */
    if (p.spikes > 0.02) {
      for (const L of lobes) {
        if (budget <= 0) break;
        const per = 2 * Math.PI * L.r;
        const nS = Math.max(8, Math.round((per / 2.0) * p.spikes));
        for (let s2 = 0; s2 < nS; s2++) {
          const ang = (s2 / nS) * Math.PI * 2 + hash2(s2, L.i, seed + 15) * 0.2;
          const R = edgeR(L, ang);
          const bx = L.x + Math.cos(ang) * R, by = L.y + Math.sin(ang) * R;
          // visible edge: just outside must not be this lobe's own top region
          const ox = L.x + Math.cos(ang) * (R + 1.2), oy = L.y + Math.sin(ang) * (R + 1.2);
          const outTop = topLobe(ox, oy);
          const inTop = topLobe(L.x + Math.cos(ang) * (R - 1.2),
                                L.y + Math.sin(ang) * (R - 1.2));
          if (inTop !== L.i || outTop === L.i) continue;
          if (outTop > L.i) continue; // seam hidden under a higher lobe
          const nCross = 1 + (hash2(s2, L.i + 40, seed) < 0.45 ? 1 : 0);
          for (let c2 = 0; c2 < nCross; c2++) {
            const tilt = (hash2(s2 * 3 + c2, L.i, seed + 21) - 0.5) *
              (c2 === 0 ? 0.7 : 1.6);
            const dx = Math.cos(ang + tilt), dy = Math.sin(ang + tilt);
            const len = p.spikeLen * (0.5 + 0.8 * hash2(s2, c2 + L.i * 9, seed + 27));
            const A2 = [bx - dx * len * 0.3, by - dy * len * 0.3];
            const B2 = [bx + dx * len * 0.7, by + dy * len * 0.7];
            if (inR(A2) && inR(B2)) push([A2, B2], false);
          }
        }
      }
    }

    /* ---- blots: small filled ink dots scattered over the mass ----------- */
    if (p.blots > 0.02) {
      const rngB = mulberry32(seed * 7919 + 301);
      const nB = Math.round(p.blots * nL * 5);
      for (let b = 0; b < nB && budget > 0; b++) {
        const L = lobes[Math.floor(rngB() * nL)];
        const a = rngB() * Math.PI * 2;
        const d = Math.sqrt(rngB()) * L.r * 0.8;
        const bx = L.x + Math.cos(a) * d, by = L.y + Math.sin(a) * d;
        if (gTop(bx, by) < 0 || !inR([bx, by])) continue;
        const r0 = 0.3 + rngB() * 1.0;
        for (let r = r0; r > 0.15; r -= 0.5) {
          const pts = [];
          for (let k2 = 0; k2 < 10; k2++) {
            const aa = (k2 / 10) * Math.PI * 2;
            pts.push([bx + Math.cos(aa) * r, by + Math.sin(aa) * r]);
          }
          push(pts, true);
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
