import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "murmuration",
    name: "Murmuration",
    desc: "A bird flock or a ground-level reindeer herd. Reindeer Migration follows a shared winding route with delayed followers and local spacing; Milling circulates, while Gather & roam contracts and spreads. Choose Point, Circle or Dash marks. Timeline follows Play and uses frame index / frame count for a seamless loop without a duplicate endpoint. Manual uses Time; for a wired loop use Frame rot ° → Math ÷ 360 → Time. The same seeded animals persist throughout the loop. Preferred spacing is a soft separation distance, not a collision-free packing guarantee. Existing bird patches keep their original motion.",
    cat: "gen",
    group: "creatures",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "behaviour", label: "Behaviour", type: "select", options: ["Bird flock", "Reindeer herd"], def: "Bird flock" },
      { key: "birds", label: "Animals", type: "slider", min: 10, max: 600, step: 1, def: 220 },
      { key: "clock", label: "Time source", type: "select", options: ["Timeline", "Manual"], def: "Timeline", showIf: p => p.behaviour === "Reindeer herd" },
      { key: "time", label: "Time 0–1", type: "slider", min: 0, max: 1, step: 0.001, def: 0, showIf: p => p.behaviour !== "Reindeer herd" || p.clock === "Manual" },
      { key: "herdMotion", label: "Herd motion", type: "select", options: ["Migration", "Milling", "Gather & roam"], def: "Migration", showIf: p => p.behaviour === "Reindeer herd" },
      { key: "following", label: "Follow leaders", type: "slider", min: 0, max: 1, step: 0.05, def: 0.75, showIf: p => p.behaviour === "Reindeer herd" && p.herdMotion !== "Milling" },
      { key: "spacing", label: "Preferred spacing mm", type: "slider", min: 0.5, max: 10, step: 0.1, def: 2.6, showIf: p => p.behaviour === "Reindeer herd" },
      { key: "separation", label: "Neighbour avoidance", type: "slider", min: 0, max: 1, step: 0.05, def: 0.85, showIf: p => p.behaviour === "Reindeer herd" },
      { key: "travel", label: "Travel range", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "path", label: "Flock path", type: "select", options: ["Wander", "Oval", "Figure-8", "Lissajous 2:3", "Trefoil"], def: "Wander", showIf: p => p.behaviour !== "Reindeer herd" },
      { key: "wander", label: "Wander mix (guide paths)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4, showIf: p => p.behaviour !== "Reindeer herd" },
      { key: "spread", label: "Group radius mm", type: "slider", min: 10, max: 150, step: 1, def: 55 },
      { key: "pulse", label: "Pulse (breathing)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "swirl", label: "Swirl turns / loop", type: "slider", min: -3, max: 3, step: 1, def: 1, showIf: p => p.behaviour !== "Reindeer herd" },
      { key: "scatter", label: "Scatter mm", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "stretch", label: "Stretch along travel", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "shape", label: "Bird shape", type: "select", options: ["Dash", "Chevron", "Dot"], def: "Chevron", showIf: p => p.behaviour !== "Reindeer herd" },
      { key: "herdMark", label: "Animal mark", type: "select", options: ["Point", "Circle", "Dash"], def: "Dash", showIf: p => p.behaviour === "Reindeer herd" },
      { key: "size", label: "Mark size mm", type: "slider", min: 0.5, max: 6, step: 0.1, def: 1.8 },
      { key: "trail", label: "Trail mm", type: "slider", min: 0, max: 25, step: 0.5, def: 0, showIf: p => p.behaviour !== "Reindeer herd" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    overlay(p, ctx) {
      const m = Math.max(0, Number(p.margin) || 0);
      return ctx.W > 2 * m && ctx.H > 2 * m ? [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }] : [];
    },
    compute(ins, p, ctx) {
      if (p.behaviour === "Reindeer herd") {
        const num = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
        const W = num(ctx.W, 297, 1, 5000), H = num(ctx.H, 210, 1, 5000);
        const m = num(p.margin, 10, 0, 2500), size = num(p.size, 1.8, 0.1, 12);
        // Reserve the whole glyph and a small separation buffer. Every animal
        // stays on the page: no clipping or dropping individuals between frames.
        const reach = size * 0.62 + 0.2;
        const bx = W / 2 - m - reach, by = H / 2 - m - reach;
        if (bx <= 0 || by <= 0) return applyStyle({ paths: [] }, ins[0]);
        const N = Math.round(num(p.birds, 220, 1, 800)), seed = num(p.seed, 3, -1e9, 1e9);
        const TWO = Math.PI * 2, wrap = t => ((t % 1) + 1) % 1;
        const frames = Math.round(num(ctx.frameCount, 1, 1, 999));
        const phase = p.clock === "Manual" ? num(p.time, 0, -1e6, 1e6) : num(ctx.frameIdx, 0, 0, 1e6) / frames;
        const t = wrap(phase), pulse = num(p.pulse, 0.5, 0, 1), stretch = num(p.stretch, 0.6, 0, 1);
        const travel = num(p.travel, 0.5, 0, 1), follow = num(p.following, 0.75, 0, 1);
        const avoidance = num(p.separation, 0.85, 0, 1);
        const spacing = num(p.spacing, 2.6, 0.1, 20);
        const spread = Math.min(num(p.spread, 55, 1, 500), Math.min(bx, by) * 0.72);
        const scatter = Math.min(num(p.scatter, 8, 0, 100), spread * 0.22);
        const ax = Math.max(0, bx - spread * 1.2 - scatter - spacing), ay = Math.max(0, by - spread * 1.2 - scatter - spacing);
        const clampX = x => Math.max(-bx, Math.min(bx, x)), clampY = y => Math.max(-by, Math.min(by, y));
        const animals = Array.from({ length: N }, (_, i) => {
          // Sunflower sites give stable, well-spaced identities, without a grid.
          const angle = i * Math.PI * (3 - Math.sqrt(5)) + seed * 0.73;
          const radius = Math.sqrt((i + 0.5) / N);
          return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
            a: TWO * hash2(i, 3, seed), b: TWO * hash2(i, 7, seed), r: radius,
            size: size * (0.82 + 0.32 * hash2(i, 21, seed)) };
        });
        const guide = phase => {
          const a = TWO * phase;
          return [travel * ax * (0.78 * Math.cos(a) + 0.16 * Math.sin(2 * a)),
            travel * ay * (0.72 * Math.sin(a) + 0.18 * Math.sin(3 * a + 0.4))];
        };
        const positions = phase => {
          const now = TWO * wrap(phase);
          const target = animals.map(h => {
            const lag = follow * 0.12 * (1 - h.x);
            // A periodic speed wave lets animals bunch up and then move on.
            const a = now - TWO * lag + 0.13 * Math.sin(now + h.a);
            if (p.herdMotion === "Milling") {
              const angle = now + h.a + 0.22 * Math.sin(2 * now + h.b);
              const radius = spread * (0.30 + 0.65 * h.r) * (1 + pulse * 0.12 * Math.sin(3 * angle - now));
              const center = guide(phase);
              return [clampX(center[0] * 0.35 + Math.cos(angle) * radius),
                clampY(center[1] * 0.35 + Math.sin(angle) * radius * (0.8 - 0.2 * stretch))];
            }
            const localPhase = a / TWO, center = guide(localPhase);
            const before = guide(localPhase - 0.001), after = guide(localPhase + 0.001);
            // At Travel 0 use a steady ground heading, not a rotating fallback.
            let dx = after[0] - before[0], dy = after[1] - before[1], len = Math.hypot(dx, dy);
            if (len < 1e-8) { dx = 1; dy = 0; len = 1; }
            dx /= len; dy /= len;
            const gather = p.herdMotion === "Gather & roam";
            const breathing = gather ? 0.70 + pulse * 0.29 * Math.cos(now - 0.35 * h.x)
              : 0.88 + pulse * 0.10 * Math.sin(2 * now - h.x);
            const longitudinal = h.x * spread * breathing * (0.75 + stretch * 0.25)
              + scatter * 0.35 * Math.sin(now + h.a);
            const lateral = h.y * spread * breathing * (0.72 - stretch * 0.32)
              + scatter * 0.25 * Math.sin(2 * now + h.b);
            const pace = gather ? 0.5 : 1;
            return [clampX(center[0] * pace + dx * longitudinal - dy * lateral),
              clampY(center[1] * pace + dy * longitudinal + dx * lateral)];
          });
          const pts = target.map(q => q.slice());
          // Deterministic social-force relaxation: local repulsion and a spring
          // back to each follower's target. Rebuilt from phase, never from the
          // previous displayed frame, so scrubbing/export order cannot alter it.
          if (avoidance > 0) for (let pass = 0; pass < 8; pass++) {
            const cells = new Map(), shifts = pts.map(() => [0, 0]);
            for (let i = 0; i < N; i++) {
              const key = Math.floor(pts[i][0] / spacing) + "," + Math.floor(pts[i][1] / spacing);
              if (!cells.has(key)) cells.set(key, []);
              cells.get(key).push(i);
            }
            for (let i = 0; i < N; i++) {
              const cellX = Math.floor(pts[i][0] / spacing), cellY = Math.floor(pts[i][1] / spacing);
              for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
                for (const j of cells.get((cellX + ox) + "," + (cellY + oy)) || []) {
                  if (j <= i) continue;
                  let dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = Math.hypot(dx, dy);
                  if (d >= spacing) continue;
                  if (d < 1e-9) { const a = hash2(i, j, seed) * TWO; dx = Math.cos(a); dy = Math.sin(a); d = 1e-9; }
                  else { dx /= d; dy /= d; }
                  const force = (spacing - d) * 0.42 * avoidance;
                  shifts[i][0] += dx * force; shifts[i][1] += dy * force;
                  shifts[j][0] -= dx * force; shifts[j][1] -= dy * force;
                }
              }
            }
            for (let i = 0; i < N; i++) {
              const dx = shifts[i][0] + (target[i][0] - pts[i][0]) * 0.055;
              const dy = shifts[i][1] + (target[i][1] - pts[i][1]) * 0.055;
              const limit = Math.max(1, Math.hypot(dx, dy) / (spacing * 0.45));
              pts[i] = [clampX(pts[i][0] + dx / limit), clampY(pts[i][1] + dy / limit)];
            }
          }
          return pts;
        };
        const current = positions(t), before = positions(t - 0.001), after = positions(t + 0.001);
        const L = Math.round(num(p.layer, 0, 0, 11));
        const paths = current.map((q, i) => {
          const x = q[0] + W / 2, y = q[1] + H / 2, sz = animals[i].size;
          if (p.herdMark === "Circle") {
            return { pts: Array.from({ length: 12 }, (_, j) => [x + Math.cos(j * TWO / 12) * sz / 2, y + Math.sin(j * TWO / 12) * sz / 2]), closed: true, layer: L };
          }
          let dx = after[i][0] - before[i][0], dy = after[i][1] - before[i][1], len = Math.hypot(dx, dy);
          if (len < 1e-8) { dx = 1; dy = 0; len = 1; }
          // Points are short physical strokes, so SVG and G-code both mark paper.
          const half = p.herdMark === "Point" ? Math.min(0.16, sz * 0.1) : sz / 2;
          return { pts: [[x - dx / len * half, y - dy / len * half], [x + dx / len * half, y + dy / len * half]], closed: false, layer: L };
        });
        return applyStyle({ paths }, ins[0]);
      }
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
