import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "net",
      name: "Net",
    cat: "gen", group: "structural",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "pattern", label: "Mesh type", type: "select", options: ["Diamond", "Square", "Triangle", "Hexagon"], def: "Diamond" },
      { key: "cell", label: "Cell size mm", type: "slider", min: 2, max: 60, step: 0.5, def: 14 },
      { key: "sag", label: "Sag mm (hanging)", type: "slider", min: 0, max: 60, step: 0.5, def: 12 },
      { key: "jit", label: "Irregularity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 109 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const w = W - 2 * m, h = H - 2 * m;
      if (w < 5 || h < 5) return EMPTY;
      /* verkon roikkuminen + epasaannollisyys yhtenaisena kenttana:
         koko verkko painuu keskelta, solmut varisevat kohinalla */
      const disp = (x, y) => {
        const u = (x - m) / w;
        const dy = p.sag * Math.sin(Math.PI * Math.max(0, Math.min(1, u))) * (0.25 + 0.75 * (y - m) / h);
        const jx = (noise2(x * 0.05, y * 0.05, p.seed) - 0.5) * p.jit * p.cell * 0.9;
        const jy = (noise2(x * 0.05 + 40, y * 0.05 + 40, p.seed + 3) - 0.5) * p.jit * p.cell * 0.9;
        return [x + jx, y + dy + jy];
      };
      const paths = [];
      const seg = (a, b) => {
        /* piirra saie hienojakoisena jotta sag/jitter taipuu sulavasti */
        const n = 6;
        const pts = [];
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          pts.push(disp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
        }
        paths.push({ pts, closed: false, layer: L });
      };
      const poly = (raw) => {
        /* jatkuva polyline solmupisteista, valit hienonnettuna */
        const pts = [];
        for (let i = 0; i < raw.length - 1; i++) {
          const a = raw[i], b = raw[i + 1];
          const n = 4;
          for (let k = i === 0 ? 0 : 1; k <= n; k++) {
            const t = k / n;
            pts.push(disp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
          }
        }
        if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
      };
      const c = p.cell;
      if (p.pattern === "Square") {
        for (let y = m; y <= m + h + 0.01; y += c) poly([[m, y], [m + w, y]]);
        for (let x = m; x <= m + w + 0.01; x += c) poly([[x, m], [x, m + h]]);
      } else if (p.pattern === "Diamond") {
        /* diagonaalit molempiin suuntiin — kalastusverkko */
        for (let s = -h; s <= w + h; s += c) {
          poly([[m + s, m], [m + s + h, m + h]]);
          poly([[m + s, m], [m + s - h, m + h]]);
        }
      } else if (p.pattern === "Triangle") {
        for (let y = m; y <= m + h + 0.01; y += c) poly([[m, y], [m + w, y]]);
        for (let s = -h; s <= w + h; s += c) {
          poly([[m + s, m], [m + s + h, m + h]]);
          poly([[m + s, m], [m + s - h, m + h]]);
        }
      } else {
        /* Hexagon: hunajakenno siksak-riveina + pystylinkit -> ei tuplavetoja */
        const hw = c / 2, hh = (c * Math.sqrt(3)) / 2;
        let rowI = 0;
        for (let y = m; y <= m + h - hh * 0.5; y += hh, rowI++) {
          const off = rowI % 2 === 0 ? 0 : 0;
          /* siksak: /\/\/\ */
          const raw = [];
          let up = rowI % 2 === 0;
          for (let x = m; x <= m + w + 0.01; x += hw) {
            raw.push([x, up ? y : y + hh * 0.5]);
            up = !up;
          }
          poly(raw);
          /* pystylinkit siksakin alapisteista seuraavan rivin ylapisteisiin */
          let up2 = rowI % 2 === 0;
          for (let x = m; x <= m + w + 0.01; x += hw) {
            if (!up2 && y + hh * 0.5 + hh * 0.5 <= m + h) {
              seg([x, y + hh * 0.5], [x, y + hh]);
            }
            up2 = !up2;
          }
        }
      }
      /* rajaa marginaaliin: sag voi tyontaa alle — kevyt leikkaus */
      const paths2 = paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [Math.max(m - 1, Math.min(m + w + 1, x)), Math.min(H - 2, y)]),
      }));
      return applyStyle({ paths: paths2 }, ins[0]);
    }
  
};
