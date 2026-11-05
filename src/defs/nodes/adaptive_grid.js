import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "adaptive_grid", name: "Adaptive Grid", cat: "gen", group: "geometric",
  desc: "A plotter-ready grid whose cells become smaller near a focus point, an incoming drawing, or a seeded noise field. Connect Draw Path or any blue path source to Influence, then choose Input drawing. Max cell sets the coarse lattice; Min cell and Levels bound refinement; Detail and Radius shape where it becomes fine. Grid outputs unique shared edges without double plotting. Cells outputs closed rectangles for Hatch Fill, pattern nodes and other region effects. Both remain inside Margin. Very large requests return empty instead of a partial grid.",
  ins: [Pin("paths", "Influence"), Pin("style", "Style")],
  outs: [Pin("paths", "Grid"), Pin("paths", "Cells")],
  params: [
    { key: "source", label: "Detail source", type: "select", options: ["Focus", "Input drawing", "Noise"], def: "Focus" },
    { key: "maxCell", label: "Max cell mm", type: "slider", min: 12, max: 120, step: 1, def: 44 },
    { key: "minCell", label: "Min cell mm", type: "slider", min: 2, max: 30, step: .5, def: 5.5 },
    { key: "levels", label: "Refine levels", type: "slider", min: 0, max: 5, step: 1, def: 4 },
    { key: "detail", label: "Detail %", type: "slider", min: 0, max: 100, step: 1, def: 85 },
    { key: "radius", label: "Influence radius mm", type: "slider", min: 10, max: 240, step: 1, def: 95, showIf: p => p.source !== "Noise" },
    { key: "focusX", label: "Focus X %", type: "slider", min: 0, max: 100, step: 1, def: 50, showIf: p => p.source === "Focus" },
    { key: "focusY", label: "Focus Y %", type: "slider", min: 0, max: 100, step: 1, def: 50, showIf: p => p.source === "Focus" },
    { key: "fieldSize", label: "Noise size mm", type: "slider", min: 10, max: 200, step: 1, def: 78, showIf: p => p.source === "Noise" },
    { key: "seed", label: "Seed", type: "seed", min: 0, max: 9999, def: 31, showIf: p => p.source === "Noise" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  _layout(p, c) {
    const W = +c?.W, H = +c?.H;
    if (!(Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0)) return null;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2, Number.isFinite(+p.margin) ? +p.margin : 12));
    if (W - 2 * m < 2 || H - 2 * m < 2) return null;
    return { W, H, m, w: W - 2 * m, h: H - 2 * m };
  },
  overlay(p, c) {
    const f = this._layout(p, c);
    if (!f) return [];
    const out = [{ kind: "rect", x: f.m, y: f.m, w: f.w, h: f.h }];
    if (p.source === "Focus") {
      const x = f.m + f.w * Math.max(0, Math.min(1, (+p.focusX || 0) / 100));
      const y = f.m + f.h * Math.max(0, Math.min(1, (+p.focusY || 0) / 100));
      out.push({ kind: "point", x, y }, { kind: "circle", cx: x, cy: y, r: Math.max(10, Math.min(240, +p.radius || 95)) });
    }
    return out;
  },
  _samples(src, f, radius) {
    const buckets = new Map(), seen = new Set(), bucket = Math.max(10, radius);
    const step = Math.max(1.5, radius / 10), snap = step / 2;
    let segments = 0, count = 0;
    const put = (x, y) => {
      if (!Number.isFinite(x + y) || x < f.m - radius || x > f.W - f.m + radius || y < f.m - radius || y > f.H - f.m + radius) return true;
      const k = `${Math.round(x / snap)},${Math.round(y / snap)}`;
      if (seen.has(k)) return true;
      seen.add(k);
      if (++count > 30000) return false;
      const key = `${Math.floor(x / bucket)},${Math.floor(y / bucket)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push([x, y]);
      return true;
    };
    for (const path of src?.paths || []) {
      const pts = Array.isArray(path?.pts) ? path.pts : [];
      if (pts.length === 1 && !put(+pts[0][0], +pts[0][1])) return null;
      for (let i = 0; i < pts.length - (path.closed ? 0 : 1); i++) {
        if (++segments > 200000) return null;
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (!a || !b || !Number.isFinite(+a[0] + +a[1] + +b[0] + +b[1])) continue;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(len / step));
        if (n > 30000) return null;
        for (let j = 0; j <= n; j++) if (!put(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n)) return null;
      }
    }
    return { buckets, bucket };
  },
  compute(ins, p, c) {
    const f = this._layout(p, c);
    if (!f) return [EMPTY, EMPTY];
    const maxCell = Math.max(12, Math.min(160, Number.isFinite(+p.maxCell) ? +p.maxCell : 44));
    const minCell = Math.max(2, Math.min(40, Number.isFinite(+p.minCell) ? +p.minCell : 5.5));
    const levels = Math.max(0, Math.min(6, Math.round(+p.levels || 0)));
    const detail = Math.max(0, Math.min(1, (Number.isFinite(+p.detail) ? +p.detail : 85) / 100));
    const radius = Math.max(10, Math.min(300, Number.isFinite(+p.radius) ? +p.radius : 95));
    const cols = Math.max(1, Math.ceil(f.w / maxCell)), rows = Math.max(1, Math.ceil(f.h / maxCell));
    if (cols * rows > 5000) return [EMPTY, EMPTY];
    const mode = ["Focus", "Input drawing", "Noise"].includes(p.source) ? p.source : "Focus";
    const fx = f.m + f.w * Math.max(0, Math.min(1, (Number.isFinite(+p.focusX) ? +p.focusX : 50) / 100));
    const fy = f.m + f.h * Math.max(0, Math.min(1, (Number.isFinite(+p.focusY) ? +p.focusY : 50) / 100));
    const fieldSize = Math.max(10, Math.min(250, Number.isFinite(+p.fieldSize) ? +p.fieldSize : 78));
    const seed = Math.round(Number.isFinite(+p.seed) ? +p.seed : 31);
    const samples = mode === "Input drawing" ? this._samples(ins?.[0], f, radius) : null;
    if (mode === "Input drawing" && !samples) return [EMPTY, EMPTY];
    const influence = (x, y) => {
      if (mode === "Noise") return noise2(x / fieldSize, y / fieldSize, seed);
      let distance = Math.hypot(x - fx, y - fy);
      if (mode === "Input drawing") {
        distance = Infinity;
        const ix = Math.floor(x / samples.bucket), iy = Math.floor(y / samples.bucket);
        for (let by = iy - 1; by <= iy + 1; by++) for (let bx = ix - 1; bx <= ix + 1; bx++)
          for (const q of samples.buckets.get(`${bx},${by}`) || []) distance = Math.min(distance, Math.hypot(x - q[0], y - q[1]));
      }
      return Math.max(0, 1 - distance / radius);
    };
    const leaves = [];
    const split = (x0, y0, x1, y1, depth) => {
      if (leaves.length > 4500) return false;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const shouldSplit = depth < levels && (x1 - x0) / 2 >= minCell && (y1 - y0) / 2 >= minCell &&
        influence(cx, cy) * detail > .22 + depth * .13;
      if (shouldSplit) {
        return split(x0, y0, cx, cy, depth + 1) && split(cx, y0, x1, cy, depth + 1) &&
          split(x0, cy, cx, y1, depth + 1) && split(cx, cy, x1, y1, depth + 1);
      }
      leaves.push([x0, y0, x1, y1]);
      return leaves.length <= 4500;
    };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (!split(f.m + f.w * x / cols, f.m + f.h * y / rows,
        f.m + f.w * (x + 1) / cols, f.m + f.h * (y + 1) / rows, 0)) return [EMPTY, EMPTY];
    }
    const layer = Math.max(0, Math.min(11, Math.round(Number.isFinite(+p.layer) ? +p.layer : 0)));
    const cells = { paths: leaves.map(([x0, y0, x1, y1]) => ({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, layer })) };
    const horizontal = new Map(), vertical = new Map();
    const quant = x => Math.round(x * 1e6) / 1e6;
    const add = (map, fixed, a, b) => {
      const key = quant(fixed);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push([quant(a), quant(b)]);
    };
    for (const [x0, y0, x1, y1] of leaves) {
      add(horizontal, y0, x0, x1); add(horizontal, y1, x0, x1);
      add(vertical, x0, y0, y1); add(vertical, x1, y0, y1);
    }
    const paths = [];
    const emit = (map, horizontalAxis) => {
      for (const [fixed, intervals] of map) {
        intervals.sort((a, b) => a[0] - b[0]);
        let [start, end] = intervals[0];
        for (let i = 1; i <= intervals.length; i++) {
          const next = intervals[i];
          if (next && next[0] <= end + 1e-6) { end = Math.max(end, next[1]); continue; }
          paths.push({ pts: horizontalAxis ? [[start, fixed], [end, fixed]] : [[fixed, start], [fixed, end]], closed: false, layer });
          if (next) [start, end] = next;
        }
      }
    };
    emit(horizontal, true); emit(vertical, false);
    return [applyStyle({ paths }, ins?.[1]), applyStyle(cells, ins?.[1])];
  },
};
