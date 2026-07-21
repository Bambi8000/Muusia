import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "harmonograph",
    name: "Harmonograph",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "fx", label: "Freq X", type: "slider", min: 1, max: 12, step: 1, def: 3 },
      { key: "fy", label: "Freq Y", type: "slider", min: 1, max: 12, step: 1, def: 2 },
      { key: "detune", label: "Detune", type: "slider", min: 0, max: 0.05, step: 0.001, def: 0.008 },
      { key: "damp", label: "Damping", type: "slider", min: 0.001, max: 0.1, step: 0.001, def: 0.015 },
      { key: "dur", label: "Duration (swings)", type: "slider", min: 5, max: 80, step: 1, def: 40 },
      { key: "mix", label: "Pendulum 2 mix", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed (phases)", type: "seed", def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const ax = (W - 2 * m) / 2, ay = (H - 2 * m) / 2;
      if (ax < 5 || ay < 5) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 2833 + 41);
      const p1 = rng() * Math.PI * 2, p2 = rng() * Math.PI * 2;
      const p3 = rng() * Math.PI * 2, p4 = rng() * Math.PI * 2;
      const TWO = Math.PI * 2;
      const fx = Math.max(1, Math.round(p.fx)), fy = Math.max(1, Math.round(p.fy));
      const mix = Math.max(0, Math.min(1, p.mix));
      const damp = Math.max(0.0005, p.damp);
      const dur = Math.max(2, p.dur);
      /* two damped pendulums per axis: the classic twin-pendulum machine */
      const xAt = (t) => {
        const e1 = Math.exp(-damp * t), e2 = Math.exp(-damp * 1.35 * t);
        return (Math.sin(TWO * fx * t + p1) * e1 * (1 - mix * 0.5) +
                Math.sin(TWO * (fx + p.detune * fx + 1) * t + p2) * e2 * mix * 0.5);
      };
      const yAt = (t) => {
        const e1 = Math.exp(-damp * t), e2 = Math.exp(-damp * 1.35 * t);
        return (Math.sin(TWO * fy * t + p3) * e1 * (1 - mix * 0.5) +
                Math.sin(TWO * (fy + p.detune * fy + 1) * t + p4) * e2 * mix * 0.5);
      };
      const n = Math.min(30000, Math.max(2000, Math.round(dur * 400)));
      const pts = [];
      let lastX = 1e9, lastY = 1e9;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * dur;
        const x = W / 2 + xAt(t) * ax;
        const y = H / 2 + yAt(t) * ay;
        /* decimate: only emit once the pen has moved */
        if (Math.hypot(x - lastX, y - lastY) >= 0.15 || i === 0 || i === n) {
          pts.push([x, y]);
          lastX = x; lastY = y;
        }
      }
      if (pts.length < 2) return applyStyle({ paths: [] }, ins[0]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    }
  
};
