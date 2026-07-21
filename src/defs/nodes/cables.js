import { Pin, PENS, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "cables",
    name: "Cables", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Cables", type: "slider", min: 1, max: 40, step: 1, def: 9 },
      { key: "length", label: "Length mm", type: "slider", min: 50, max: 2000, step: 10, def: 600 },
      { key: "waviness", label: "Waviness", type: "slider", min: 0.05, max: 1.5, step: 0.05, def: 0.45 },
      { key: "wscale", label: "Turn scale", type: "slider", min: 0.2, max: 5, step: 0.1, def: 1.5 },
      { key: "startMode", label: "Layout", type: "select", options: ["Edges (in & out)", "Pile (inside)"], def: "Edges (in & out)" },
      { key: "penPer", label: "Pen per cable", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 63 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const paths = [];
      for (let c = 0; c < Math.round(p.count); c++) {
        const rng = mulberry32(p.seed * 1447 + c * 331 + 17);
        let x, y, heading;
        if (p.startMode === "Pile (inside)") {
          x = W * (0.3 + rng() * 0.4);
          y = H * (0.3 + rng() * 0.4);
          heading = rng() * Math.PI * 2;
        } else {
          /* aloitus satunnaiselta reunalta, suunta sisaanpain */
          const edge = Math.floor(rng() * 4);
          if (edge === 0) { x = m + rng() * (W - 2 * m); y = m; heading = Math.PI / 2; }
          else if (edge === 1) { x = W - m; y = m + rng() * (H - 2 * m); heading = Math.PI; }
          else if (edge === 2) { x = m + rng() * (W - 2 * m); y = H - m; heading = -Math.PI / 2; }
          else { x = m; y = m + rng() * (H - 2 * m); heading = 0; }
          heading += (rng() - 0.5) * 0.8;
        }
        const pts = [[x, y]];
        const step = 1.2;
        const nSteps = Math.min(4000, Math.round(p.length / step));
        for (let i = 0; i < nSteps; i++) {
          /* pehmea kohinaohjattu kaantyminen (johdon jaykkyys = inertia) */
          const turn = (noise2(i * 0.02 * p.wscale, c * 13.7, p.seed) - 0.5) * 2 * p.waviness * 0.35;
          heading += turn;
          /* pehmea tyonto reunoilta sisaanpain */
          const edgeD = 22;
          let steer = 0;
          const toCenter = Math.atan2(H / 2 - y, W / 2 - x);
          const dEdge = Math.min(x - m, W - m - x, y - m, H - m - y);
          if (dEdge < edgeD) {
            let dA = toCenter - heading;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            steer = dA * (1 - dEdge / edgeD) * 0.25;
          }
          heading += steer;
          x += Math.cos(heading) * step;
          y += Math.sin(heading) * step;
          x = Math.max(m, Math.min(W - m, x));
          y = Math.max(m, Math.min(H - m, y));
          pts.push([x, y]);
        }
        paths.push({
          pts, closed: false,
          layer: p.penPer ? (Math.round(p.layer) + c) % PENS.length : Math.round(p.layer),
        });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
