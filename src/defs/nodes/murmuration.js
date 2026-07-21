import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "murmuration",
    name: "Murmuration",
    cat: "gen",
    group: "creatures",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "birds", label: "Birds", type: "slider", min: 10, max: 600, step: 1, def: 220 },
      { key: "time", label: "Time (wire Frame t)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "travel", label: "Travel range", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "path", label: "Flock path", type: "select", options: ["Wander", "Oval", "Figure-8", "Lissajous 2:3", "Trefoil"], def: "Wander" },
      { key: "wander", label: "Wander mix (guide paths)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "spread", label: "Flock radius mm", type: "slider", min: 10, max: 150, step: 1, def: 55 },
      { key: "pulse", label: "Pulse (breathing)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "swirl", label: "Swirl turns / loop", type: "slider", min: -3, max: 3, step: 1, def: 1 },
      { key: "scatter", label: "Scatter mm", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "stretch", label: "Stretch along travel", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "shape", label: "Bird shape", type: "select", options: ["Dash", "Chevron", "Dot"], def: "Chevron" },
      { key: "size", label: "Bird size mm", type: "slider", min: 0.5, max: 6, step: 0.1, def: 1.8 },
      { key: "trail", label: "Trail mm", type: "slider", min: 0, max: 25, step: 0.5, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);

      const TWO = Math.PI * 2;
      const seed = p.seed;
      const N = Math.max(1, Math.min(800, Math.round(p.birds)));
      const tt = ((p.time % 1) + 1) % 1; /* wrap so Frame frame# also animates */
      const spread = Math.max(1, p.spread);
      const scatter = Math.max(0, p.scatter);
      const turns = Math.round(Math.max(-6, Math.min(6, p.swirl))); /* integer -> seamless loop */
      const travel = Math.max(0, Math.min(1, p.travel));
      const stretchAmt = Math.max(0, Math.min(1, p.stretch));

      /* All time-varying terms sample noise on a circle: cos/sin(2πt).
         Anything periodic in t by construction => t=0 and t=1 identical
         => seamless animation loops. */
      const cW = (W / 2), cH = (H / 2);
      const travX = Math.max(0, (x1 - x0) / 2 - spread * 0.35) * travel;
      const travY = Math.max(0, (y1 - y0) / 2 - spread * 0.35) * travel;

      const flockCenter = (t) => {
        const a = TWO * t, c = Math.cos(a), s = Math.sin(a);
        /* loop-noise wander (periodic in t by circular sampling) */
        const nx = (noise2(c * 1.7 + 3.1, s * 1.7 + 7.7, seed + 11) - 0.5) * 2;
        const ny = (noise2(c * 1.7 + 13.9, s * 1.7 + 2.3, seed + 29) - 0.5) * 2;
        if (p.path === "Oval" || p.path === "Figure-8" || p.path === "Lissajous 2:3" || p.path === "Trefoil") {
          /* closed guide curves, all 2π-periodic => loop stays seamless */
          let gx, gy;
          if (p.path === "Oval") { gx = c; gy = s; }
          else if (p.path === "Figure-8") { gx = c; gy = Math.sin(2 * a) * 0.9; }
          else if (p.path === "Lissajous 2:3") { gx = Math.sin(2 * a); gy = Math.sin(3 * a); }
          else { const r3 = (1 + 0.38 * Math.cos(3 * a)) / 1.38; gx = c * r3; gy = s * r3; }
          const wmix = 0.35 * Math.max(0, Math.min(1, p.wander));
          return [cW + (gx * (1 - wmix) + nx * wmix) * travX,
                  cH + (gy * (1 - wmix) + ny * wmix) * travY];
        }
        /* Wander: original behavior, unchanged for existing patches */
        return [cW + nx * travX, cH + ny * travY];
      };

      /* per-bird stable hashes */
      const birdsArr = [];
      for (let i = 0; i < N; i++) {
        birdsArr.push({
          a0: hash2(i, 3, seed) * TWO,
          r0: Math.sqrt(hash2(i, 5, seed)),        /* sqrt -> uniform disc */
          sz: Math.max(0.2, p.size) * (0.55 + 0.9 * hash2(i, 21, seed)), /* depth illusion */
          o1: hash2(i, 11, seed) * 47, o2: hash2(i, 12, seed) * 47,
          o3: hash2(i, 13, seed) * 47, o4: hash2(i, 14, seed) * 47,
          o5: hash2(i, 15, seed) * 47, o6: hash2(i, 16, seed) * 47,
        });
      }

      const posAt = (t, h) => {
        const a = TWO * t, c = Math.cos(a), s = Math.sin(a);
        const fc = flockCenter(t);
        /* flock travel direction (for elongation) */
        const pA = flockCenter(t - 0.012), pB = flockCenter(t + 0.012);
        let vx = pB[0] - pA[0], vy = pB[1] - pA[1];
        const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
        /* swirling polar offset + global breathing pulse */
        const ang = h.a0 + turns * TWO * t
          + (noise2(c * 1.1 + h.o1, s * 1.1 + h.o2, seed + 5) - 0.5) * 2.5;
        const pul = 1 + p.pulse * 0.7 * ((noise2(c * 0.9 + 31, s * 0.9 + 17, seed + 41) - 0.5) * 2);
        const rad = h.r0 * spread * pul;
        let ox = Math.cos(ang) * rad, oy = Math.sin(ang) * rad;
        /* elongate along travel, squash across it */
        const along = ox * vx + oy * vy;
        const perp = -ox * vy + oy * vx;
        const stA = 1 + stretchAmt * 0.9, stP = 1 / (1 + stretchAmt * 0.45);
        ox = vx * along * stA - vy * perp * stP;
        oy = vy * along * stA + vx * perp * stP;
        /* individual wander */
        ox += (noise2(c * 2.3 + h.o3, s * 2.3 + h.o4, seed + 7) - 0.5) * 2 * scatter;
        oy += (noise2(c * 2.3 + h.o5, s * 2.3 + h.o6, seed + 9) - 0.5) * 2 * scatter;
        return [fc[0] + ox, fc[1] + oy];
      };

      const inside = (q) => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
      /* glyph reach beyond the bird position, per shape */
      const reachOf = (sz) => p.shape === "Chevron" ? sz * 1.4 : p.shape === "Dash" ? sz * 0.55 : Math.max(0.25, sz * 0.28) + 0.05;
      const insideR = (q, r) => q[0] >= x0 + r && q[0] <= x1 - r && q[1] >= y0 + r && q[1] <= y1 - r;
      const paths = [];
      const trailMm = Math.max(0, p.trail);

      for (const h of birdsArr) {
        const pos = posAt(tt, h);
        if (!insideR(pos, reachOf(h.sz))) continue;
        /* heading from the closed-form derivative (periodic, so loop-safe) */
        const e = 0.002;
        const pA = posAt(tt - e, h), pB = posAt(tt + e, h);
        let dx = pB[0] - pA[0], dy = pB[1] - pA[1];
        const dl = Math.hypot(dx, dy);
        if (dl > 1e-9) { dx /= dl; dy /= dl; } else { dx = 1; dy = 0; }

        /* trail: flight history, oldest -> head so pen travels in flight direction */
        if (trailMm > 0.5) {
          const tp = [pos];
          let tcur = tt, acc = 0, guard = 0;
          const dt = 0.0035;
          while (acc < trailMm && guard++ < 36) {
            const prev = posAt(tcur - dt, h);
            if (!inside(prev)) break;
            acc += Math.hypot(prev[0] - tp[0][0], prev[1] - tp[0][1]);
            tp.unshift(prev);
            tcur -= dt;
          }
          if (tp.length >= 2) paths.push({ pts: tp, closed: false, layer: L });
        }

        const sz = h.sz;
        if (p.shape === "Dash") {
          paths.push({
            pts: [[pos[0] - dx * sz / 2, pos[1] - dy * sz / 2], [pos[0] + dx * sz / 2, pos[1] + dy * sz / 2]],
            closed: false, layer: L,
          });
        } else if (p.shape === "Dot") {
          const r = Math.max(0.25, sz * 0.28);
          const pts = [];
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * TWO;
            pts.push([pos[0] + Math.cos(a) * r, pos[1] + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: true, layer: L });
        } else {
          /* Chevron: tiny V opening backwards -- the classic distant-starling glyph.
             One 3-point stroke: wingtip -> head -> wingtip (single pen-down). */
          const hx = pos[0] + dx * sz * 0.35, hy = pos[1] + dy * sz * 0.35;
          const wa = 2.65; /* ~152 deg back from heading */
          const c1 = Math.cos(wa), s1 = Math.sin(wa);
          const w1 = [hx + (dx * c1 - dy * s1) * sz, hy + (dx * s1 + dy * c1) * sz];
          const w2 = [hx + (dx * c1 + dy * s1) * sz, hy + (-dx * s1 + dy * c1) * sz];
          paths.push({ pts: [w1, [hx, hy], w2], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
