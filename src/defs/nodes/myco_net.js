import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "myco_net",
    name: "Root Web",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 9999 },
      { key: "hyphae", label: "Initial Spores", type: "slider", min: 1, max: 30, step: 1, def: 6 },
      { key: "length", label: "Growth Cycles", type: "slider", min: 10, max: 400, step: 10, def: 120 },
      { key: "branching", label: "Split Rate", type: "slider", min: 0.01, max: 0.25, step: 0.01, def: 0.06 },
      { key: "wander", label: "Wander", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "step", label: "Internode (mm)", type: "slider", min: 0.5, max: 6, step: 0.1, def: 2.0 },
      { key: "spawn", label: "Spawn Radius (mm)", type: "slider", min: 0, max: 80, step: 1, def: 8 },
      { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 6 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 19 + 7);
      const paths = [];
      const queue = [];
      const L = Math.round(p.layer);
      const stepLen = Math.max(0.2, p.step);

      const count = Math.max(1, Math.round(p.hyphae));
      const spawnR = Math.min(Math.max(0, p.spawn), Math.min(W, H) / 2 - m - 1);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const sx = W / 2 + Math.cos(angle) * spawnR;
        const sy = H / 2 + Math.sin(angle) * spawnR;
        queue.push({ x: sx, y: sy, angle, pts: [[sx, sy]] });
      }
      let steps = 0;
      const maxSteps = Math.round(p.length);
      const pointBudget = 60000;
      let generatedPoints = 0;
      /* incremental steering: turn by a noise-driven delta each step.
         (Blending raw angle VALUES with a 0..4pi field is not angle math
         and biases every tip toward the field's absolute magnitude.) */
      const turnRate = 0.25 + 1.1 * Math.max(0, Math.min(1, p.wander));

      while (queue.length > 0 && steps < maxSteps && generatedPoints < pointBudget) {
        const levelSize = queue.length;
        steps++;
        for (let i = 0; i < levelSize; i++) {
          const tip = queue.shift();
          if (!tip) continue;
          const drift = (noise2(tip.x * 0.012, tip.y * 0.012, p.seed) - 0.5) * 2;
          const nextAngle = tip.angle + drift * turnRate;
          const nx = tip.x + Math.cos(nextAngle) * stepLen;
          const ny = tip.y + Math.sin(nextAngle) * stepLen;
          if (nx < m || nx > W - m || ny < m || ny > H - m) {
            if (tip.pts.length > 1) paths.push({ pts: tip.pts, closed: false, layer: L });
            continue;
          }
          tip.pts.push([nx, ny]);
          generatedPoints++;
          if (rng() < p.branching && queue.length < 75) {
            const splitLeft = nextAngle + (rng() * 0.4 + 0.15);
            const splitRight = nextAngle - (rng() * 0.4 + 0.15);
            queue.push({ x: nx, y: ny, angle: splitLeft, pts: [[nx, ny]] });
            queue.push({ x: nx, y: ny, angle: splitRight, pts: [[nx, ny]] });
            paths.push({ pts: tip.pts, closed: false, layer: L });
          } else {
            queue.push({ x: nx, y: ny, angle: nextAngle, pts: tip.pts });
          }
        }
      }
      queue.forEach(tip => {
        if (tip.pts.length > 1) paths.push({ pts: tip.pts, closed: false, layer: L });
      });
      return applyStyle({ paths }, ins[0]);
    }
  
};
