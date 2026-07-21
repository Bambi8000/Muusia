import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "pendulum",
    name: "Pendulum", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "arms", label: "Arms", type: "slider", min: 1, max: 3, step: 1, def: 2 },
      { key: "r1", label: "Arm 1 radius", type: "slider", min: 1, max: 100, step: 0.5, def: 50 },
      { key: "f1", label: "Arm 1 freq", type: "slider", min: 0.1, max: 20, step: 0.01, def: 2 },
      { key: "r2", label: "Arm 2 radius", type: "slider", min: 0, max: 100, step: 0.5, def: 22 },
      { key: "f2", label: "Arm 2 freq", type: "slider", min: 0.1, max: 40, step: 0.01, def: 5.03 },
      { key: "r3", label: "Arm 3 radius", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
      { key: "f3", label: "Arm 3 freq", type: "slider", min: 0.1, max: 60, step: 0.01, def: 11.1 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 1.2 },
      { key: "couple", label: "Coupling", type: "slider", min: 0, max: 2, step: 0.02, def: 0.4 },
      { key: "damp", label: "Damping", type: "slider", min: 0, max: 1.2, step: 0.01, def: 0.25 },
      { key: "table", label: "Table rotation (rev)", type: "slider", min: -4, max: 4, step: 0.05, def: 0.5 },
      { key: "turns", label: "Duration (turns)", type: "slider", min: 2, max: 120, step: 1, def: 30 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* ketjutetut vaimenevat heilurivarret; kytkenta: varren taajuutta
         moduloi edellisen varren kulma -> aito vuorovaikutus.
         Pyoriva poyta kuten oikeissa piirtokoneissa. */
      const nArms = Math.round(p.arms);
      const R = [p.r1, p.r2, p.r3];
      const F = [p.f1, p.f2, p.f3];
      const N = Math.min(30000, Math.round(p.turns * 400));
      const raw = [];
      const th = [0, 0, 0];
      const dt = p.turns / N;
      let t = 0;
      for (let i = 0; i <= N; i++) {
        const e = Math.exp(-p.damp * t);
        let x = 0, y = 0, prevAng = 0;
        for (let a = 0; a < nArms; a++) {
          /* taajuusmodulaatio edellisen varren kulmalla */
          const fEff = F[a] * (a === 0 ? 1 : 1 + p.couple * Math.sin(prevAng) * 0.5);
          th[a] += 2 * Math.PI * fEff * dt;
          const ang = th[a] + (a === 1 ? p.phase : a === 2 ? p.phase / 2 : 0);
          x += R[a] * e * Math.cos(ang);
          y += R[a] * e * Math.sin(ang);
          prevAng = ang;
        }
        /* poydan pyoriminen */
        const ta = 2 * Math.PI * p.table * (t / p.turns);
        const ca = Math.cos(ta), sa = Math.sin(ta);
        raw.push([x * ca - y * sa, x * sa + y * ca]);
        t += dt;
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
