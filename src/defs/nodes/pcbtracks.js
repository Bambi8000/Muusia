import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "pcbtracks",
    name: "PCB Tracks",
    cat: "gen",
    group: "structural",
    desc: "Printed circuit board copper: octilinear tracks (45-degree bends only) routed between round pads, IC footprints as twin rows of pads feeding tracks outward, and via dots along the runs. One pen - classic single-layer copper look.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tracks", label: "Tracks", type: "slider", min: 4, max: 60, step: 1, def: 24 },
      { key: "chips", label: "IC footprints", type: "slider", min: 0, max: 6, step: 1, def: 2 },
      { key: "grid", label: "Grid mm", type: "slider", min: 1.5, max: 8, step: 0.5, def: 3 },
      { key: "pad", label: "Pad size mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5 },
      { key: "vias", label: "Vias", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 4231 + 17);
      const G = Math.max(1, p.grid);
      const L = Math.round(p.layer);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer: L
        });
      };
      const circle = (cx, cy, r) => {
        const nn = Math.max(8, Math.round(r * 5));
        const c = [];
        for (let k = 0; k < nn; k++) {
          const a = (k / nn) * Math.PI * 2;
          c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return c;
      };
      const pad = (cx, cy) => {
        push(circle(cx, cy, p.pad / 2), true);
        push(circle(cx, cy, p.pad * 0.2), true);
      };
      const snap = (v) => Math.round(v / G) * G;
      const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      /* track sources: chip pins + loose pads */
      const sources = [];
      const nch = Math.round(p.chips);
      for (let c = 0; c < nch; c++) {
        const pins = 3 + Math.floor(rng() * 3);
        const horiz = rng() < 0.5;
        const wpx = (pins - 1) * G * 2, wpy = G * 4;
        const cx = snap(x0 + p.pad + rng() * (x1 - x0 - wpx - 2 * p.pad)) ;
        const cy = snap(y0 + p.pad + rng() * (y1 - y0 - (horiz ? wpy : wpx) - 2 * p.pad));
        for (let k = 0; k < pins; k++) {
          for (const side of [0, 1]) {
            const px = horiz ? cx + k * G * 2 : cx + side * wpy;
            const py = horiz ? cy + side * wpy : cy + k * G * 2;
            pad(px, py);
            const dirOut = horiz ? (side ? 2 : 6) : (side ? 0 : 4);
            sources.push([px, py, dirOut]);
          }
        }
        /* chip body outline */
        const bx0 = horiz ? cx - G : cx + G * 0.8, by0 = horiz ? cy + G * 0.8 : cy - G;
        const bx1 = horiz ? cx + wpx + G : cx + wpy - G * 0.8, by1 = horiz ? cy + wpy - G * 0.8 : cy + wpx + G;
        push([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], true);
      }
      const NT = Math.round(p.tracks);
      /* octilinear routed tracks: prefer long straights, 45-degree bends */
      for (let t = 0; t < NT; t++) {
        let sx, sy, d;
        if (t < sources.length) { [sx, sy, d] = sources[t]; }
        else {
          sx = snap(x0 + p.pad + rng() * (x1 - x0 - 2 * p.pad));
          sy = snap(y0 + p.pad + rng() * (y1 - y0 - 2 * p.pad));
          d = Math.floor(rng() * 8);
          pad(sx, sy);
        }
        const pts = [[sx, sy]];
        let x = sx, y = sy;
        const steps = 6 + Math.floor(rng() * Math.max(6, (x1 - x0) / G * 0.5));
        let run = 0;
        for (let i = 0; i < steps; i++) {
          const fits = (dd) => {
            const nx = x + DIR[dd][0] * G, ny = y + DIR[dd][1] * G;
            return nx >= x0 + p.pad && nx <= x1 - p.pad && ny >= y0 + p.pad && ny <= y1 - p.pad;
          };
          if (!fits(d)) {
            const sgn = rng() < 0.5 ? 1 : -1;
            let found = -1;
            for (const tr of [sgn, -sgn, 2 * sgn, -2 * sgn, 3 * sgn, -3 * sgn]) {
              const dd = ((d + tr) % 8 + 8) % 8;
              if (fits(dd)) { found = dd; break; }
            }
            if (found < 0) break;
            d = found;
          }
          x += DIR[d][0] * G; y += DIR[d][1] * G;
          pts.push([x, y]);
          run++;
          if (run >= 3 && rng() < 0.22) {
            d = ((d + (rng() < 0.5 ? 1 : 7)) % 8 + 8) % 8;
            run = 0;
          }
        }
        /* collapse spikes */
        for (let i = pts.length - 2; i >= 1; i--) {
          if (Math.abs(pts[i - 1][0] - pts[i + 1][0]) < 0.01 && Math.abs(pts[i - 1][1] - pts[i + 1][1]) < 0.01) pts.splice(i, 2);
        }
        if (pts.length < 2) continue;
        push(pts, false);
        pad(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        /* vias along the run */
        if (p.vias > 0.01) {
          for (let i = 2; i < pts.length - 2; i++) {
            if (rng() < p.vias * 0.12) push(circle(pts[i][0], pts[i][1], p.pad * 0.22), true);
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
