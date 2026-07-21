import { Pin, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "mesh",
    name: "Mesh", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Cols", type: "slider", min: 2, max: 40, step: 1, def: 14 },
      { key: "rows", label: "Rows", type: "slider", min: 2, max: 40, step: 1, def: 10 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 20, step: 0.25, def: 4 },
      { key: "diag", label: "Diagonals", type: "select", options: ["None", "\\", "/", "Alternating", "Random"], def: "Alternating" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 25 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cols = Math.round(p.cols), rows = Math.round(p.rows);
      const rng = mulberry32(p.seed * 577 + 11);
      const pts = [];
      for (let j = 0; j <= rows; j++) {
        const row = [];
        for (let i = 0; i <= cols; i++) {
          const edge = i === 0 || j === 0 || i === cols || j === rows;
          const jx = edge ? 0 : (rng() - 0.5) * 2 * p.jit;
          const jy = edge ? 0 : (rng() - 0.5) * 2 * p.jit;
          row.push([
            p.margin + ((W - 2 * p.margin) * i) / cols + jx,
            p.margin + ((H - 2 * p.margin) * j) / rows + jy,
          ]);
        }
        pts.push(row);
      }
      const paths = [];
      const L = Math.round(p.layer);
      for (let j = 0; j <= rows; j++) paths.push({ pts: pts[j].map((q) => q.slice()), closed: false, layer: L });
      for (let i = 0; i <= cols; i++) paths.push({ pts: pts.map((row) => row[i].slice()), closed: false, layer: L });
      if (p.diag !== "None") {
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          let d = p.diag;
          if (d === "Alternating") d = (i + j) % 2 === 0 ? "\\" : "/";
          else if (d === "Random") d = hash2(i, j, p.seed + 3) > 0.5 ? "\\" : "/";
          paths.push(d === "\\"
            ? { pts: [pts[j][i].slice(), pts[j + 1][i + 1].slice()], closed: false, layer: L }
            : { pts: [pts[j][i + 1].slice(), pts[j + 1][i].slice()], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
