import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "pattern_tile", name: "Pattern Tile", cat: "gen", group: "textimg",
  desc: "Paint a small grid motif and repeat it across the paper. Drag across cells to draw or erase. Outline merges touching painted cells into continuous contours without internal grid lines; Slash and Cross draw simple pen marks in every painted cell. Cell size sets the physical pitch, Shift moves the repeat by whole cells, and Margin keeps it inside the page. Pattern is the full page; Tile is one centred repeat unit that can feed Seamless Tile. Both outputs are editable vector paths and are saved with the patch. Large patterns beyond the 120k-point budget return empty rather than a partial drawing.",
  ins: [Pin("style", "Style")], outs: [Pin("paths", "Pattern"), Pin("paths", "Tile")],
  params: [
    { key: "cells", label: "Paint motif", type: "patterngrid", def: ["00011000","00111100","01100110","11000011","11000011","01100110","00111100","00011000"] },
    { key: "grid", label: "Grid cells", type: "slider", min: 3, max: 16, step: 1, def: 8 },
    { key: "cell", label: "Cell size mm", type: "slider", min: 3, max: 24, step: .5, def: 7 },
    { key: "mark", label: "Draw as", type: "select", options: ["Outline", "Slash", "Cross"], def: "Outline" },
    { key: "shiftX", label: "Shift X cells", type: "slider", min: -16, max: 16, step: 1, def: 0 },
    { key: "shiftY", label: "Shift Y cells", type: "slider", min: -16, max: 16, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  _grid(p) {
    const n = Math.max(3, Math.min(16, Math.round(+p.grid || 8)));
    const raw = Array.isArray(p.cells) ? p.cells.slice(0, 16).filter(v => typeof v === "string") : [];
    const h = raw.length, w = Math.max(0, ...raw.map(s => Math.min(16, s.length)));
    const a = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) =>
      h && w ? raw[Math.min(h - 1, Math.floor((y + .5) * h / n))]?.[Math.min(w - 1, Math.floor((x + .5) * w / n))] === "1" : false));
    return { n, a };
  },
  overlay(p, c) {
    const W = +c?.W, H = +c?.H;
    if (!(Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0)) return [];
    const m = Math.max(0, Math.min(Math.min(W, H) / 2, Number.isFinite(+p.margin) ? +p.margin : 12));
    return [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }];
  },
  _draw(grid, cols, rows, xAt, yAt, active, mark, layer) {
    const paths = [], limit = 120000;
    const add = (pts, closed = false) => { paths.push({ pts, closed, layer }); };
    if (mark === "Outline") {
      // Clockwise exposed edges. The rightmost turn preserves separate loops
      // when two painted regions touch only at a corner.
      const starts = new Map(), edges = [];
      const edge = (x0, y0, x1, y1, dir) => {
        const e = { x0, y0, x1, y1, dir, used: false };
        edges.push(e);
        const key = `${x0},${y0}`;
        if (!starts.has(key)) starts.set(key, []);
        starts.get(key).push(e);
      };
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (!active(x, y)) continue;
        if (!active(x, y - 1)) edge(x, y, x + 1, y, 0);
        if (!active(x + 1, y)) edge(x + 1, y, x + 1, y + 1, 1);
        if (!active(x, y + 1)) edge(x + 1, y + 1, x, y + 1, 2);
        if (!active(x - 1, y)) edge(x, y + 1, x, y, 3);
        if (edges.length > limit) return EMPTY;
      }
      for (const first of edges) {
        if (first.used) continue;
        const vertices = [[first.x0, first.y0]];
        let cur = first;
        while (cur && !cur.used) {
          cur.used = true;
          vertices.push([cur.x1, cur.y1]);
          const choices = (starts.get(`${cur.x1},${cur.y1}`) || []).filter(e => !e.used);
          choices.sort((a, b) => ((a.dir - cur.dir + 4) % 4) - ((b.dir - cur.dir + 4) % 4));
          cur = choices[0];
        }
        const closed = vertices.length > 2 && vertices[0][0] === vertices.at(-1)[0] && vertices[0][1] === vertices.at(-1)[1];
        if (closed) vertices.pop();
        // Remove collinear intermediate points without changing the contour.
        const v = vertices.filter((pt, i) => {
          if (!closed && (i === 0 || i === vertices.length - 1)) return true;
          const a = vertices[(i - 1 + vertices.length) % vertices.length], b = vertices[(i + 1) % vertices.length];
          return (pt[0] - a[0]) * (b[1] - pt[1]) !== (pt[1] - a[1]) * (b[0] - pt[0]);
        });
        if (v.length >= (closed ? 3 : 2)) add(v.map(([x, y]) => [xAt(x), yAt(y)]), closed);
      }
    } else {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (!active(x, y)) continue;
        const x0 = xAt(x), x1 = xAt(x + 1), y0 = yAt(y), y1 = yAt(y + 1);
        const pad = Math.min(x1 - x0, y1 - y0) * .18;
        add([[x0 + pad, y1 - pad], [x1 - pad, y0 + pad]]);
        if (mark === "Cross") add([[x0 + pad, y0 + pad], [x1 - pad, y1 - pad]]);
        if (paths.length * 2 > limit) return EMPTY;
      }
    }
    if (paths.reduce((sum, q) => sum + q.pts.length, 0) > limit) return EMPTY;
    return { paths };
  },
  compute(ins, p, c) {
    const W = +c?.W, H = +c?.H;
    if (!(Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0)) return [EMPTY, EMPTY];
    const m = Math.max(0, Math.min(Math.min(W, H) / 2, Number.isFinite(+p.margin) ? +p.margin : 12));
    const width = W - 2 * m, height = H - 2 * m;
    if (width <= 0 || height <= 0) return [EMPTY, EMPTY];
    const { n, a } = this._grid(p);
    const pitch = Math.max(3, Math.min(24, Number.isFinite(+p.cell) ? +p.cell : 7));
    const cols = Math.ceil(width / pitch), rows = Math.ceil(height / pitch);
    if (cols * rows > 80000) return [EMPTY, EMPTY];
    const sx = ((Math.round(+p.shiftX || 0) % n) + n) % n;
    const sy = ((Math.round(+p.shiftY || 0) % n) + n) % n;
    const on = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows && a[((y + sy) % n + n) % n][((x + sx) % n + n) % n];
    const layer = Math.max(0, Math.min(11, Math.round(Number.isFinite(+p.layer) ? +p.layer : 0)));
    const mark = ["Outline", "Slash", "Cross"].includes(p.mark) ? p.mark : "Outline";
    const pattern = this._draw(a, cols, rows, x => Math.min(W - m, m + x * pitch), y => Math.min(H - m, m + y * pitch), on, mark, layer);
    const tilePitch = Math.min(pitch, width / n, height / n);
    const ox = (W - n * tilePitch) / 2, oy = (H - n * tilePitch) / 2;
    const tileOn = (x, y) => a[((y + sy) % n + n) % n][((x + sx) % n + n) % n];
    const tile = this._draw(a, n, n, x => ox + x * tilePitch, y => oy + y * tilePitch, tileOn, mark, layer);
    return [applyStyle(pattern, ins?.[0]), applyStyle(tile, ins?.[0])];
  },
};
