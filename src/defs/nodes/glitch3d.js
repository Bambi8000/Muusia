import { Pin, EMPTY, mulberry32, noise2, resample } from "../helpers.js";

export default {
  key: "glitch3d",
    name: "3D Glitch",
    cat: "mod",
    group: "deform",
    desc: "Throws the 2D drawing into 3D space and corrupts it: the sheet undulates with noise relief, tilts with yaw and pitch under perspective, then glitches in screen space - horizontal bands tear loose and shift sideways, some quantize into blocky steps. Color split adds a displaced duplicate on another pen (plotter chromatic aberration). Wire Drift to Frame and the corruption crawls through an animation.",
    ins: [Pin("paths", "Paths")],
    outs: [Pin("paths")],
    params: [
      { key: "relief", label: "3D relief", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "scale", label: "Relief scale mm", type: "slider", min: 10, max: 120, step: 1, def: 50 },
      { key: "yaw", label: "Yaw deg", type: "slider", min: -60, max: 60, step: 1, def: 18 },
      { key: "pitch", label: "Pitch deg", type: "slider", min: -60, max: 60, step: 1, def: 22 },
      { key: "glitch", label: "Glitch", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "bands", label: "Glitch bands", type: "slider", min: 3, max: 40, step: 1, def: 14 },
      { key: "split", label: "Color split", type: "check", def: false },
      { key: "splitPen", label: "Split pen", type: "pen", def: 1 },
      { key: "drift", label: "Drift (wire Frame)", type: "slider", min: 0, max: 10, step: 0.05, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 9 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      /* content bbox: distorted result is fitted back into it */
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const pa of src.paths) for (const [x, y] of pa.pts) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const bw = Math.max(1, bx1 - bx0), bh = Math.max(1, by1 - by0);
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const D = p.drift * 2.9;
      const f = 1 / Math.max(4, p.scale);
      const zAmp = p.relief * Math.min(bw, bh) * 0.35;
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cyw = Math.cos(ya), syw = Math.sin(ya);
      const cpw = Math.cos(pa2), spw = Math.sin(pa2);
      const FOC = Math.max(bw, bh) * 2.2;
      const proj = (x, y) => {
        const ox = x - cx, oy = y - cy;
        const z = (noise2(x * f + D, y * f + D * 0.7, p.seed) - 0.5) * 2 * zAmp;
        /* yaw around vertical, pitch around horizontal */
        let X = ox * cyw + z * syw;
        let Z = -ox * syw + z * cyw;
        let Y = oy * cpw - Z * spw;
        Z = oy * spw + Z * cpw;
        const sc = FOC / Math.max(FOC * 0.15, FOC + Z);
        return [X * sc, Y * sc];
      };
      /* project all paths, track projected bbox */
      const step = 1.2;
      const proj2 = [];
      let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
      for (const pa of src.paths) {
        const pts = resample(pa.pts, pa.closed, step).map(([x, y]) => proj(x, y));
        for (const [x, y] of pts) {
          if (x < px0) px0 = x; if (x > px1) px1 = x;
          if (y < py0) py0 = y; if (y > py1) py1 = y;
        }
        proj2.push({ pts, closed: pa.closed, layer: pa.layer });
      }
      const sc2 = Math.min(bw / ((px1 - px0) || 1), bh / ((py1 - py0) || 1));
      const ox2 = bx0 + (bw - (px1 - px0) * sc2) / 2 - px0 * sc2;
      const oy2 = by0 + (bh - (py1 - py0) * sc2) / 2 - py0 * sc2;
      /* glitch bands in screen space: seeded shifts + blocky x-quantize, paths split at band edges */
      const NB = Math.max(1, Math.round(p.bands));
      const bandH = bh / NB;
      const rng = mulberry32(p.seed * 811 + 7 + Math.floor(D * 13.7));
      const bandDx = [], bandQ = [];
      for (let b = 0; b < NB + 2; b++) {
        const hit = rng() < p.glitch * 0.75;
        bandDx.push(hit ? (rng() - 0.5) * bw * 0.22 * p.glitch : 0);
        bandQ.push(hit && rng() < 0.35 ? 1.5 + rng() * 5 : 0); /* quantize block mm */
      }
      const bandOf = (y) => Math.max(0, Math.min(NB + 1, Math.floor((y - by0) / bandH)));
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const emit = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        out.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      const glitched = [];
      for (const pa of proj2) {
        const pts = pa.pts.map(([x, y]) => [x * sc2 + ox2, y * sc2 + oy2]);
        if (p.glitch < 0.01) { glitched.push({ pts, closed: pa.closed, layer: pa.layer }); continue; }
        let run = [];
        let curB = -1;
        for (const [x, y] of pts) {
          const b = bandOf(y);
          if (b !== curB && run.length) {
            if (run.length > 1) glitched.push({ pts: run, closed: false, layer: pa.layer });
            run = [];
          }
          curB = b;
          let gx = x + bandDx[b];
          if (bandQ[b] > 0) gx = Math.round(gx / bandQ[b]) * bandQ[b];
          run.push([gx, y]);
        }
        if (run.length > 1) glitched.push({ pts: run, closed: curB === bandOf(pts[0][1]) && pa.closed && glitched.length === 0 ? false : false, layer: pa.layer });
      }
      for (const g of glitched) emit(g.pts, g.closed, g.layer);
      if (p.split) {
        const dx = 0.6 + p.glitch * 1.6, dy = -0.3 - p.glitch * 0.5;
        const sp = Math.round(p.splitPen);
        for (const g of glitched) emit(g.pts.map(([x, y]) => [x + dx, y + dy]), g.closed, sp);
      }
      return { paths: out };
    }
  
};
