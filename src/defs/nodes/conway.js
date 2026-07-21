import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "conway",
    name: "Conway",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Grid columns", type: "slider", min: 10, max: 80, step: 1, def: 40 },
      { key: "fill", label: "Initial fill", type: "slider", min: 0.05, max: 0.8, step: 0.05, def: 0.35 },
      { key: "gens", label: "Generations (wire LFO/Frame)", type: "slider", min: 0, max: 200, step: 1, def: 20 },
      { key: "wrap", label: "Wrap edges", type: "check", def: true },
      { key: "style", label: "Cell style", type: "select", options: ["Squares", "Dots", "Diamonds"], def: "Squares" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 19 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
      const cols = Math.max(4, Math.min(100, Math.round(p.cols)));
      const cell = bw / cols;
      const rows = Math.max(4, Math.floor(bh / cell));
      /* deterministic replay: seed the board, run N generations from scratch.
         Stateless per compute -> wire a value into Generations to animate growth */
      const rng = mulberry32(p.seed * 7477 + 3);
      let grid = new Uint8Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = rng() < p.fill ? 1 : 0;
      const gens = Math.max(0, Math.min(400, Math.floor(p.gens)));
      const wrap = !!p.wrap;
      let next = new Uint8Array(cols * rows);
      for (let g = 0; g < gens; g++) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                let xx = x + dx, yy = y + dy;
                if (wrap) { xx = (xx + cols) % cols; yy = (yy + rows) % rows; }
                else if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
                n += grid[yy * cols + xx];
              }
            }
            const alive = grid[y * cols + x];
            next[y * cols + x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
          }
        }
        const t = grid; grid = next; next = t;
      }
      const paths = [];
      const L = Math.round(p.layer);
      const pad = cell * 0.12;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!grid[y * cols + x]) continue;
          const x0 = m + x * cell + pad, y0 = m + y * cell + pad;
          const x1 = m + (x + 1) * cell - pad, y1 = m + (y + 1) * cell - pad;
          const cxx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
          if (p.style === "Dots") {
            const r = cell * 0.28;
            const pts = [];
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              pts.push([cxx + Math.cos(a) * r, cyy + Math.sin(a) * r]);
            }
            paths.push({ pts, closed: true, layer: L });
          } else if (p.style === "Diamonds") {
            paths.push({ pts: [[cxx, y0], [x1, cyy], [cxx, y1], [x0, cyy]], closed: true, layer: L });
          } else {
            paths.push({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
