import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "water",
      name: "Water",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 0, max: 400, step: 1, def: 85 },
      { key: "lines", label: "Ripple lines", type: "slider", min: 5, max: 150, step: 1, def: 55 },
      { key: "amp", label: "Wave amp mm", type: "slider", min: 0.2, max: 12, step: 0.1, def: 1.6 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 3, max: 80, step: 0.5, def: 16 },
      { key: "swell", label: "Swell mm", type: "slider", min: 0, max: 20, step: 0.25, def: 2.5 },
      { key: "chop", label: "Choppiness (gaps)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 89 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const y0 = p.horizon, y1 = H - m;
      if (y1 - y0 < 5) return EMPTY;
      const paths = [];
      const n = Math.round(p.lines);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;                       /* 0 = horisontissa, 1 = edessa */
        /* perspektiivi: rivit pakkautuvat horisonttiin, aallot pienenevat kauas */
        const g = 1 + p.persp * 1.6;
        const y = y0 + Math.pow(t, g) * (y1 - y0);
        const sc = 0.22 + 0.78 * Math.pow(t, 0.8 + p.persp);
        const amp = p.amp * sc;
        const wl = Math.max(1.5, p.wl * sc);
        const ph = mulberry32(p.seed * 613 + i * 97)() * Math.PI * 2;
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer: L });
          run = [];
        };
        const step = 0.9;
        for (let x = m; x <= W - m; x += step) {
          /* aalto: paa-aalto + hitaampi maininki + kohinarikkonaisuus */
          const wave = Math.sin((x / wl) * Math.PI * 2 + ph) * amp * 0.5
            + Math.sin((x / (wl * 3.7)) * Math.PI * 2 + ph * 1.7) * p.swell * sc * 0.5
            + (noise2(x * 0.15, i * 3.1, p.seed) - 0.5) * amp * 0.8;
          /* katkonta: kimallus rikkoo viivan; tuulenvireet kohinakentasta */
          const gate = noise2(x * (0.05 + 0.1 / sc), i * 1.9, p.seed + 31);
          if (gate > p.chop * 0.85) run.push([x, y + wave]);
          else flush();
        }
        flush();
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
