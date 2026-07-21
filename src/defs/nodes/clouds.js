import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "clouds",
  name: "Clouds",
  cat: "gen",
  group: "nature",
  desc: "Old-etching cumulus: each cloud is a row of overlapping lobe circles plus a few stacked on top, drawn as scalloped visible arcs. Inner creases lets each arc continue a little way behind its neighbour, like an engraver's line; Hatch shading adds horizontal rows that thin upward plus a dashed drop shadow under the flat base.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Clouds", type: "slider", min: 1, max: 12, step: 1, def: 4 },
    { key: "size", label: "Size mm", type: "slider", min: 20, max: 220, step: 1, def: 90 },
    { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "lobes", label: "Lobes", type: "slider", min: 3, max: 14, step: 1, def: 7 },
    { key: "flat", label: "Flat base", type: "check", def: true },
    { key: "crease", label: "Inner creases", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "shade", label: "Hatch shading", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
    { key: "zone", label: "Sky zone %", type: "slider", min: 20, max: 100, step: 1, def: 55 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 33 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "shadePen", label: "Shade pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 24 || H - 2 * m < 24) return applyStyle({ paths: [] }, ins[0]);
    const rng = mulberry32(p.seed * 6089 + 17);
    const L = Math.round(p.layer), SP = Math.round(p.shadePen);
    const paths = [];

    const drawCloud = (ccx, baseY, w, h, sd) => {
      const rr = mulberry32(sd);
      const nL = Math.max(3, Math.round(p.lobes));
      const nB = Math.max(2, Math.round(nL * 0.6));
      const nT = Math.max(0, nL - nB);
      const lobes = [];
      for (let i = 0; i < nB; i++) {
        const t = nB === 1 ? 0.5 : i / (nB - 1);
        const prof = 0.55 + 0.45 * Math.sin(Math.PI * (0.1 + 0.8 * t));
        const r = h * 0.52 * prof * (0.8 + 0.4 * rr());
        const x = ccx + (t - 0.5) * (w - h * 0.5) + (rr() - 0.5) * h * 0.12;
        lobes.push({ x, y: baseY - r * 0.72, r });
      }
      for (let i = 0; i < nT; i++) {
        const t = nT === 1 ? 0.5 : i / (nT - 1);
        const r = h * (0.3 + 0.22 * rr());
        const x = ccx + (t - 0.5) * w * 0.45 + (rr() - 0.5) * h * 0.15;
        lobes.push({ x, y: baseY - h * (0.72 + 0.28 * rr()), r });
      }
      /* scalloped outline: hide points deeper inside a neighbour than the crease depth */
      for (let i = 0; i < lobes.length; i++) {
        const c = lobes[i];
        const n = Math.max(24, Math.round((Math.PI * 2 * c.r) / 0.8));
        const vis = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = c.x + Math.cos(a) * c.r, y = c.y + Math.sin(a) * c.r;
          let v = !(p.flat && y > baseY + 0.01);
          if (v) {
            for (let j = 0; j < lobes.length; j++) {
              if (j === i) continue;
              const o = lobes[j];
              const depth = o.r - Math.hypot(x - o.x, y - o.y);
              const allow = 0.15 + p.crease * Math.min(o.r, c.r) * 0.35;
              if (depth > allow) { v = false; break; }
            }
          }
          vis.push(v ? [x, y] : null);
        }
        const s0 = vis.findIndex((q) => q === null);
        if (s0 < 0) {
          paths.push({ pts: vis.map((q) => q.slice()), closed: true, layer: L });
          continue;
        }
        let run = [];
        const flush = () => { if (run.length > 2) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        for (let k = 1; k <= n; k++) {
          const q = vis[(s0 + k) % n];
          if (q) run.push([q[0], q[1]]); else flush();
        }
        flush();
      }
      /* flat base: merged chords where lobes span the base line */
      if (p.flat) {
        const iv = [];
        for (const c of lobes) {
          const dy = baseY - c.y;
          if (Math.abs(dy) < c.r) {
            const dx = Math.sqrt(c.r * c.r - dy * dy);
            iv.push([c.x - dx, c.x + dx]);
          }
        }
        iv.sort((a, b) => a[0] - b[0]);
        let cur = null;
        const spans = [];
        for (const s of iv) {
          if (!cur || s[0] > cur[1] + 0.2) { cur = [s[0], s[1]]; spans.push(cur); }
          else cur[1] = Math.max(cur[1], s[1]);
        }
        for (const s of spans) paths.push({ pts: [[s[0], baseY], [s[1], baseY]], closed: false, layer: L });
      }
      /* hatch shading: horizontal rows thinning upward, inset from the silhouette */
      if (p.shade > 0.02) {
        const inside = (x, y) => {
          if (p.flat && y > baseY - 0.4) return false;
          for (const c of lobes) if (Math.hypot(x - c.x, y - c.y) < c.r - 0.7) return true;
          return false;
        };
        let y = baseY - 1.1, sp2 = 1.25, row = 0;
        const maxRows = Math.round(2 + p.shade * 10);
        const step = 0.8;
        while (row < maxRows && y > baseY - h * 1.05) {
          let runS = null;
          for (let x = ccx - w * 0.7; x <= ccx + w * 0.7 + step; x += step) {
            const on = inside(x, y) && noise2(x * 0.35, y * 0.35, sd + row * 13) > 0.18 + row * 0.03;
            if (on && runS === null) runS = x;
            else if (!on && runS !== null) {
              if (x - runS > 1.6) paths.push({ pts: [[runS, y], [x - step, y]], closed: false, layer: SP });
              runS = null;
            }
          }
          row++;
          sp2 *= 1.28;
          y -= sp2;
        }
        /* dashed drop shadow under the base */
        if (p.flat && p.shade > 0.15) {
          for (let s = 0; s < 2; s++) {
            const yy = baseY + 2 + s * 2.4;
            const half = w * (0.34 - s * 0.09);
            const dr = mulberry32(sd * 53 + s);
            let x = ccx - half;
            while (x < ccx + half) {
              const len = 2 + dr() * 4;
              if (dr() < 0.75) paths.push({ pts: [[x, yy], [Math.min(x + len, ccx + half), yy]], closed: false, layer: SP });
              x += len + 1.4 + dr() * 2.2;
            }
          }
        }
      }
    };

    const zoneH = Math.max(20, (H - 2 * m) * (p.zone / 100));
    const nC = Math.max(1, Math.round(p.count));
    const placed = [];
    let guard = 0;
    while (placed.length < nC && guard++ < nC * 60) {
      const w = Math.max(14, p.size * (1 - p.sizeVar * rng()));
      const h = w * 0.42;
      const we = w * 1.3; /* lobes + creases can poke past w/2, reserve room */
      if (W - 2 * m < we + 2) continue;
      const cx = m + we / 2 + rng() * (W - 2 * m - we);
      const yLo = m + h * 1.45;
      const yHi = Math.min(H - m - 7, m + zoneH);
      if (yHi <= yLo) continue;
      const cy = yLo + rng() * (yHi - yLo);
      let ok = true;
      for (const q of placed) {
        if (Math.abs(cx - q[0]) < (w + q[2]) * 0.55 && Math.abs(cy - q[1]) < (h + q[3]) * 0.85) { ok = false; break; }
      }
      if (!ok) continue;
      placed.push([cx, cy, w, h]);
      drawCloud(cx, cy, w, h, p.seed * 197 + placed.length * 131);
    }
    return applyStyle({ paths }, ins[0]);
  },
};