import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "cycloidm",
    name: "Cycloid Machine", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "gearDist", label: "Gear distance", type: "slider", min: 20, max: 150, step: 1, def: 60 },
      { key: "gearY", label: "Gears offset Y", type: "slider", min: 20, max: 160, step: 1, def: 85 },
      { key: "r1", label: "Crank 1 radius", type: "slider", min: 2, max: 50, step: 0.5, def: 15 },
      { key: "f1", label: "Crank 1 speed", type: "slider", min: -20, max: 20, step: 0.01, def: 3 },
      { key: "r2", label: "Crank 2 radius", type: "slider", min: 2, max: 50, step: 0.5, def: 21 },
      { key: "f2", label: "Crank 2 speed", type: "slider", min: -20, max: 20, step: 0.01, def: 5.02 },
      { key: "L1", label: "Rod 1 length", type: "slider", min: 20, max: 200, step: 0.5, def: 95 },
      { key: "L2", label: "Rod 2 length", type: "slider", min: 20, max: 200, step: 0.5, def: 82 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 0.8 },
      { key: "table", label: "Table speed", type: "slider", min: -4, max: 4, step: 0.01, def: 0.13 },
      { key: "turns", label: "Duration (turns)", type: "slider", min: 2, max: 200, step: 1, def: 40 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* Cycloid Drawing Machine: kaksi kampea, kaksi nivelivartta -> kyna on
         varsiympyroiden leikkauspiste; paperi pyorii omalla poydallaan. */
      const G1 = [-p.gearDist / 2, p.gearY];
      const G2 = [p.gearDist / 2, p.gearY];
      const N = Math.min(40000, Math.round(p.turns * 420));
      const raw = [];
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns;
        const a1 = 2 * Math.PI * p.f1 * t;
        const a2 = 2 * Math.PI * p.f2 * t + p.phase;
        const P1 = [G1[0] + Math.cos(a1) * p.r1, G1[1] + Math.sin(a1) * p.r1];
        const P2 = [G2[0] + Math.cos(a2) * p.r2, G2[1] + Math.sin(a2) * p.r2];
        /* ympyroiden (P1,L1) ja (P2,L2) leikkaus */
        const dx = P2[0] - P1[0], dy = P2[1] - P1[1];
        const d = Math.hypot(dx, dy) || 1e-9;
        let pen;
        if (d >= p.L1 + p.L2) {
          /* varret suorassa: piste janan jatkeella suhteessa */
          const f = p.L1 / (p.L1 + p.L2);
          pen = [P1[0] + dx * f, P1[1] + dy * f];
        } else if (d <= Math.abs(p.L1 - p.L2)) {
          const f = p.L1 / Math.max(0.01, d);
          pen = [P1[0] + dx * f, P1[1] + dy * f];
        } else {
          const a = (p.L1 * p.L1 - p.L2 * p.L2 + d * d) / (2 * d);
          const h = Math.sqrt(Math.max(0, p.L1 * p.L1 - a * a));
          const mx = P1[0] + (dx / d) * a, my = P1[1] + (dy / d) * a;
          const c1 = [mx - (dy / d) * h, my + (dx / d) * h];
          const c2 = [mx + (dy / d) * h, my - (dx / d) * h];
          /* jatkuvuus: valitse edellista lahempi haara (alussa ylempi = kyna poydan puolella) */
          if (prev) {
            pen = Math.hypot(c1[0] - prev[0], c1[1] - prev[1]) <= Math.hypot(c2[0] - prev[0], c2[1] - prev[1]) ? c1 : c2;
          } else {
            pen = c1[1] < c2[1] ? c1 : c2;
          }
        }
        prev = pen;
        /* pyoriva poyta origossa: kyna paperin koordinaatistoon */
        const ta = -2 * Math.PI * p.table * t;
        const ca = Math.cos(ta), sa = Math.sin(ta);
        raw.push([pen[0] * ca - pen[1] * sa, pen[0] * sa + pen[1] * ca]);
      }
      /* sovita canvasille */
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  
};
