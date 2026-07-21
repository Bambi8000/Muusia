import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "worm",
      name: "Worm",
    cat: "gen", group: "creatures",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Worms", type: "slider", min: 1, max: 12, step: 1, def: 2 },
      { key: "length", label: "Length mm", type: "slider", min: 30, max: 500, step: 5, def: 170 },
      { key: "width", label: "Body width mm", type: "slider", min: 2, max: 30, step: 0.5, def: 9 },
      { key: "segs", label: "Segment rings", type: "slider", min: 6, max: 120, step: 1, def: 40 },
      { key: "wander", label: "Wander", type: "slider", min: 0.05, max: 1.5, step: 0.05, def: 0.5 },
      { key: "legs", label: "Legs", type: "select", options: ["None (worm)", "Centipede"], def: "Centipede" },
      { key: "legLen", label: "Leg length mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "legEvery", label: "Legs every Nth ring", type: "slider", min: 1, max: 6, step: 1, def: 1 },
      { key: "antennae", label: "Antennae", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 137 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin + p.width;
      const paths = [];
      for (let c = 0; c < Math.round(p.count); c++) {
        const rng = mulberry32(p.seed * 4967 + c * 373 + 91);
        /* selkaranka: inertiavaellus pehmealla reunaohjauksella */
        let x = m + rng() * (W - 2 * m);
        let y = m + rng() * (H - 2 * m);
        let heading = rng() * Math.PI * 2;
        const spine = [[x, y]];
        const step = 1.2;
        const nSteps = Math.round(p.length / step);
        for (let i = 0; i < nSteps; i++) {
          heading += (noise2(i * 0.03, c * 17.3, p.seed) - 0.5) * 2 * p.wander * 0.3;
          const dEdge = Math.min(x - m, W - m - x, y - m, H - m - y);
          if (dEdge < 25) {
            const toC = Math.atan2(H / 2 - y, W / 2 - x);
            let dA = toC - heading;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            heading += dA * (1 - dEdge / 25) * 0.2;
          }
          x += Math.cos(heading) * step;
          y += Math.sin(heading) * step;
          spine.push([x, y]);
        }
        /* runko: renkaat selkarankaa pitkin, paksuusprofiili kapenee paihin
           -> putkimainen 3D-vaikutelma pelkilla vanteilla */
        const nSeg = Math.round(p.segs);
        const N = spine.length;
        const frameAt = (t) => {
          const idx = Math.min(N - 2, Math.max(0, Math.floor(t * (N - 1))));
          const f = t * (N - 1) - idx;
          const a = spine[idx], b = spine[idx + 1];
          const px = a[0] + (b[0] - a[0]) * f, py = a[1] + (b[1] - a[1]) * f;
          const tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1;
          return [px, py, tx / tl, ty / tl];
        };
        const prof = (t) => {
          /* paa pyorea, hanta suippo */
          const head = Math.min(1, t * 6);
          const tail = Math.min(1, (1 - t) * 3);
          return (p.width / 2) * Math.sqrt(head) * Math.pow(tail, 0.8);
        };
        for (let s = 0; s < nSeg; s++) {
          const t = s / Math.max(1, nSeg - 1);
          const [px, py, tx, ty] = frameAt(t);
          const r = prof(t);
          if (r < 0.3) continue;
          /* rengas = litistetty ellipsi rungon poikki (nakyy vanteena) */
          const pts = [];
          const nP = 18;
          for (let k = 0; k < nP; k++) {
            const a = (k / nP) * Math.PI * 2;
            const u = Math.cos(a) * r;          /* poikittain */
            const v = Math.sin(a) * r * 0.34;   /* pitkin runkoa (litistys) */
            pts.push([px + (-ty) * u + tx * v, py + tx * u + ty * v]);
          }
          paths.push({ pts, closed: true, layer: L });
          /* jalat: parit molemmin puolin, askelrytmi vuorottelee */
          if (p.legs === "Centipede" && s % Math.round(p.legEvery) === 0 && t > 0.06 && t < 0.94) {
            const gait = (s % 2 === 0 ? 1 : -1) * 0.5;
            for (const side of [1, -1]) {
              const bx = px + (-ty) * r * side, by = py + tx * r * side;
              const baseA = Math.atan2(tx * side, -ty * side); /* ulospain */
              const a1 = baseA + gait * 0.55 * side;
              const midx = bx + Math.cos(a1) * p.legLen * 0.55;
              const midy = by + Math.sin(a1) * p.legLen * 0.55;
              const a2 = a1 + 0.5 * side;
              paths.push({
                pts: [
                  [bx, by],
                  [midx, midy],
                  [midx + Math.cos(a2) * p.legLen * 0.5, midy + Math.sin(a2) * p.legLen * 0.5],
                ],
                closed: false, layer: L,
              });
            }
          }
        }
        /* tuntosarvet paahan */
        if (p.antennae) {
          const [px, py, tx, ty] = frameAt(1);
          for (const side of [1, -1]) {
            const a = Math.atan2(ty, tx) + side * 0.5;
            const len = p.width * 0.9;
            const mx = px + Math.cos(a) * len * 0.6, my = py + Math.sin(a) * len * 0.6;
            paths.push({
              pts: [[px, py], [mx, my], [mx + Math.cos(a + side * 0.5) * len * 0.5, my + Math.sin(a + side * 0.5) * len * 0.5]],
              closed: false, layer: L,
            });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
