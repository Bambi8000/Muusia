import { Pin, mulberry32, noise2, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "scan",
    name: "Seismic", cat: "gen", group: "scientific",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "size", label: "Size mm", type: "slider", min: 30, max: 300, step: 1, def: 150 },
      { key: "detail", label: "Detail / density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "annotate", label: "Annotations (ticks, scale)", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "annPen", label: "Annotation pen", type: "pen", def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 157 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const L = Math.round(p.layer);
      const AP = Math.round(p.annPen);
      const rng = mulberry32(p.seed * 7127 + 131);
      const S = p.size;
      const paths = [];
      const line = (a, b, ly) => paths.push({ pts: [a, b], closed: false, layer: ly === undefined ? L : ly });
      const poly = (pts, closed, ly) => paths.push({ pts, closed: !!closed, layer: ly === undefined ? L : ly });
      const circle = (x, y, r, n, ly) => {
        const pts = [];
        for (let k = 0; k < (n || 32); k++) {
          const a = (k / (n || 32)) * Math.PI * 2;
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        poly(pts, true, ly);
      };
      const blob = (x, y, r, wob, sd) => {
        const rr = mulberry32(sd);
        const nH = 3, amps = [], phs = [];
        for (let h = 0; h < nH; h++) { amps.push(wob * r * rr() / (h + 1)); phs.push(rr() * 6.28); }
        const pts = [];
        for (let k = 0; k < 40; k++) {
          const th = (k / 40) * Math.PI * 2;
          let rad = r;
          for (let h = 0; h < nH; h++) rad += amps[h] * Math.sin((h + 2) * th + phs[h]);
          pts.push([x + Math.cos(th) * rad, y + Math.sin(th) * rad]);
        }
        return pts;
      };
      const label = (str, x, y, sz, ly) => {
        const fs = fontStrokes(str, sz, 1);
        for (const st of fs.strokes) {
          poly(st.map(([gx, gy]) => [x + gx, y + gy - sz]), false, ly);
        }
        return fs.width;
      };
              /* EEG / Seismic: kanavarivit, rauhallista pohjaa + purskeet */
        const nCh = Math.round(5 + p.detail * 9);
        const w = S * 1.4, h = S;
        const x0 = p.cx - w / 2, y0 = p.cy - h / 2;
        const chH = h / nCh;
        for (let c = 0; c < nCh; c++) {
          const by = y0 + (c + 0.5) * chH;
          /* purskeet: 1-3 tapahtumaa satunnaisin kohdin */
          const rngC = mulberry32(p.seed * 331 + c * 71);
          const nEv = 1 + Math.floor(rngC() * 3);
          const evs = [];
          for (let e = 0; e < nEv; e++) evs.push([rngC() * 0.8 + 0.05, 0.04 + rngC() * 0.12, 0.4 + rngC() * 0.6]);
          const pts = [];
          for (let x = 0; x <= w; x += 0.5) {
            const u = x / w;
            let amp = 0.06;
            let fq = 0.8;
            for (const [eu, ew, ea] of evs) {
              const d = Math.abs(u - eu) / ew;
              if (d < 1) {
                const env = (1 - d) * (1 - d);
                amp += ea * env;
                fq += 3 * env;
              }
            }
            const y = by
              + (noise2(x * 0.15 * fq, c * 9.7, p.seed) - 0.5) * chH * amp * 1.6
              + Math.sin(x * 0.9 * fq + c * 2) * chH * amp * 0.5;
            pts.push([x0 + x, y]);
          }
          poly(pts, false);
        }
        if (p.annotate) {
          for (let c = 0; c < nCh; c++) {
            line([x0 - 5, y0 + (c + 0.5) * chH], [x0 - 2, y0 + (c + 0.5) * chH], AP);
          }
          for (let t = 0; t <= 10; t++) {
            line([x0 + (t / 10) * w, y0 + h + 3], [x0 + (t / 10) * w, y0 + h + 6], AP);
          }
          label("1 S/DIV", x0, y0 + h + 13, 3.5, AP);
        }

      return applyStyle({ paths }, ins[0]);
    },
  
};
