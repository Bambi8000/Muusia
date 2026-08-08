import { Pin, PENS, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "truchet_multi",
  name: "Truchet Multiscale",
  cat: "gen",
  group: "geometric",
  desc: "The Carlson-style multiscale sibling of the built-in Truchet: every grid cell gets a randomly oriented pair of quarter-arcs (or straight chamfers), and because the strands cross cell edges at fixed stations, they join seamlessly from tile to tile - the node CHAINS them, so the whole labyrinth comes out as closed loops and long border-to-border strokes instead of thousands of tiny arcs. Strands draws 1-4 parallel lines per tile for a woven look; Tiles picks Arcs, Lines (45-degree chamfers) or Mixed per tile; Subdivide + Sub levels split seeded cells into quarter-size tiles for the multiscale look (strands break at scale seams - that is the style). Unlike the built-in Truchet (which emits every quarter-arc as its own path and offers Loop / fill / never-meet modes), this one CHAINS strands across tiles into closed loops and border-to-border strokes, and subdivides. Pens by depth inks each scale level with its own pen. Wire Frame into Seed to reshuffle the maze per paper.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "cell", label: "Cell mm", type: "slider", min: 6, max: 60, step: 1, def: 18 },
    { key: "strands", label: "Strands per tile", type: "slider", min: 1, max: 4, step: 1, def: 2 },
    { key: "tiles", label: "Tiles", type: "select", options: ["Arcs", "Lines", "Mixed"], def: "Arcs" },
    { key: "subdiv", label: "Subdivide", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "sublevels", label: "Sub levels", type: "slider", min: 0, max: 2, step: 1, def: 1 },
    { key: "pens", label: "Pens by depth", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 6 },
    { key: "layer", label: "Pen", type: "pen", def: 0 }
  ],
  overlay(p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const cell = Math.max(4, p.cell);
    const cols = Math.floor((W - 2 * m) / cell);
    const rows = Math.floor((H - 2 * m) / cell);
    if (cols < 1 || rows < 1) return [];
    const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
    return [{ kind: "rect", x: ox, y: oy, w: cols * cell, h: rows * cell }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const cell = Math.max(4, p.cell);
    const cols = Math.floor((W - 2 * m) / cell);
    const rows = Math.floor((H - 2 * m) / cell);
    if (cols < 1 || rows < 1) return applyStyle({ paths: [] }, ins[0]);
    const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
    const rng = mulberry32(p.seed * 8117 + 3);
    const L = Math.round(p.layer);
    const NP = Math.max(1, Math.min(PENS.length, Math.round(p.pens)));
    const K = Math.max(1, Math.min(4, Math.round(p.strands)));
    const maxD = Math.max(0, Math.min(2, Math.round(p.sublevels)));

    /* ---- one strand = quarter arc (or chamfer) joining two edge stations of a corner.
       Stations sit at j/(K+1) along each edge from BOTH ends (a symmetric set), so
       equal-size neighbours share exact endpoints and strands chain across tiles. ---- */
    const strands = []; /* { pts, pen } - endpoints exact for chaining */
    const emitStrand = (cx2, cy2, sgnX, sgnY, r, arc, depth) => {
      /* corner at (cx2, cy2); the strand joins (cx2 + sgnX*r, cy2) and (cx2, cy2 + sgnY*r) */
      const A = [cx2 + sgnX * r, cy2], B = [cx2, cy2 + sgnY * r];
      const pen = NP > 1 ? (L + (depth % NP)) % PENS.length : L;
      if (!arc) { strands.push({ pts: [A, B], pen }); return; }
      const n = Math.max(6, Math.round((r * Math.PI * 0.5) / 0.6));
      const pts = [A];
      for (let i = 1; i < n; i++) {
        const t = (i / n) * Math.PI * 0.5;
        pts.push([cx2 + sgnX * r * Math.cos(t), cy2 + sgnY * r * Math.sin(t)]);
      }
      pts.push(B);
      strands.push({ pts, pen });
    };
    const tile = (x0, y0, s, depth) => {
      if (depth < maxD && rng() < p.subdiv) {
        const h = s / 2;
        tile(x0, y0, h, depth + 1); tile(x0 + h, y0, h, depth + 1);
        tile(x0, y0 + h, h, depth + 1); tile(x0 + h, y0 + h, h, depth + 1);
        return;
      }
      const orient = rng() < 0.5;
      const arc = p.tiles === "Arcs" ? true : p.tiles === "Lines" ? false : rng() < 0.5;
      for (let j = 1; j <= K; j++) {
        const r = (s * j) / (K + 1);
        if (orient) {
          emitStrand(x0, y0, 1, 1, r, arc, depth);           /* TL corner */
          emitStrand(x0 + s, y0 + s, -1, -1, r, arc, depth); /* BR corner */
        } else {
          emitStrand(x0 + s, y0, -1, 1, r, arc, depth);      /* TR corner */
          emitStrand(x0, y0 + s, 1, -1, r, arc, depth);      /* BL corner */
        }
      }
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) tile(ox + c * cell, oy + r * cell, cell, 0);
    }

    /* ---- chain strands across tile edges (String(-0) is "0", keys are -0-safe) ---- */
    const key = (q) => Math.round(q[0] * 1e5) + "_" + Math.round(q[1] * 1e5);
    const adj = new Map();
    const push = (k, si, end) => {
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push([si, end]);
    };
    strands.forEach((s, i) => {
      push(key(s.pts[0]), i, 0);
      push(key(s.pts[s.pts.length - 1]), i, 1);
    });
    const used = new Array(strands.length).fill(false);
    const walk = (si, end) => {
      used[si] = true;
      const first = strands[si];
      const pen = first.pen;
      let chain = end === 0 ? first.pts.slice() : first.pts.slice().reverse();
      for (;;) {
        const k = key(chain[chain.length - 1]);
        const nexts = (adj.get(k) || []).filter(([j]) => !used[j] && strands[j].pen === pen);
        if (!nexts.length) break;
        const [j, e] = nexts[0];
        used[j] = true;
        const add = e === 0 ? strands[j].pts : strands[j].pts.slice().reverse();
        chain = chain.concat(add.slice(1));
      }
      return { chain, pen };
    };
    const paths = [];
    const BUDGET = 118000;
    let total = 0;
    const emit = (pts, closed, layer) => {
      if (pts.length < 2 || total + pts.length > BUDGET) return;
      total += pts.length;
      paths.push({ pts, closed, layer });
    };
    /* open chains first: start where an endpoint has no partner (region border / scale seam) */
    strands.forEach((s, i) => {
      if (used[i]) return;
      for (const end of [0, 1]) {
        const k = key(end === 0 ? s.pts[0] : s.pts[s.pts.length - 1]);
        const deg = (adj.get(k) || []).filter(([j]) => !used[j] && strands[j].pen === s.pen).length;
        if (!used[i] && deg === 1) {
          const { chain, pen } = walk(i, end);
          emit(chain, false, pen);
        }
      }
    });
    /* the rest are loops */
    strands.forEach((s, i) => {
      if (used[i]) return;
      const { chain, pen } = walk(i, 0);
      if (key(chain[0]) === key(chain[chain.length - 1])) {
        chain.pop();
        emit(chain, chain.length > 2, pen);
      } else emit(chain, false, pen);
    });
    return applyStyle({ paths }, ins[0]);
  }
};
