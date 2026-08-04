import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "mini_squares",
  name: "Mini Squares",
  cat: "gen",
  group: "geometric",
  desc: "A field of axis-aligned squares packed on a hidden grid: larger multi-cell squares are placed first, then single cells fill in around them, so neighbours share edges like a mosaic. Density comes from patchy noise multiplied by a Spread falloff (Corner / Center / Linear) so the field crumbles away at its edge. Nest depth tucks smaller squares inside squares - concentric insets or corner-anchored knots (Mixed picks per square). Gap shrinks every top-level square so shared edges separate. Chain into Container or Wind Tunnel as an obstacle field, or drive Density with a value wire for animated growth.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "cell", label: "Cell (mm)", type: "slider", min: 2, max: 12, step: 0.5, def: 4 },
    { key: "density", label: "Density", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "maxsize", label: "Max square (cells)", type: "slider", min: 1, max: 4, step: 1, def: 3 },
    { key: "patch", label: "Patch size (cells)", type: "slider", min: 2, max: 24, step: 0.5, def: 8 },
    { key: "spread", label: "Spread", type: "select", options: ["Full", "Corner", "Center", "Linear"], def: "Corner" },
    { key: "fade", label: "Fade", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7 },
    { key: "nest", label: "Nest depth", type: "slider", min: 0, max: 3, step: 1, def: 2 },
    { key: "nestp", label: "Nest %", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "neststyle", label: "Nest style", type: "select", options: ["Concentric", "Corner", "Mixed"], def: "Mixed" },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 2, step: 0.05, def: 0 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const cell = Math.max(0.8, p.cell);
    const margin = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - cell));
    const cols = Math.max(1, Math.floor((W - 2 * margin) / cell));
    const rows = Math.max(1, Math.floor((H - 2 * margin) / cell));
    const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
    const seed = Math.round(p.seed);
    const rng = mulberry32(seed * 7919 + 13);
    const maxS = Math.max(1, Math.min(8, Math.round(p.maxsize)));
    const density = Math.max(0, Math.min(1, p.density));
    const fade = Math.max(0, Math.min(1, p.fade));
    const patch = Math.max(1.5, p.patch);
    const sc = 1 / patch;
    const fbm = (u, v) =>
      0.62 * noise2(u * sc, v * sc, seed) +
      0.26 * noise2(u * sc * 2 + 31.7, v * sc * 2 + 11.3, seed + 7) +
      0.12 * noise2(u * sc * 4 + 7.1, v * sc * 4 + 3.9, seed + 15);
    const fall = (gx, gy) => {
      const u = (gx + 0.5) / cols, v = (gy + 0.5) / rows;
      let d;
      if (p.spread === "Corner") d = Math.hypot(u, v) / Math.SQRT2;
      else if (p.spread === "Center") d = Math.hypot(u - 0.5, v - 0.5) / 0.7071;
      else if (p.spread === "Linear") d = u;
      else return 1;
      d = Math.max(0, Math.min(1, d));
      const s = d * d * (3 - 2 * d);
      return Math.max(0, 1 - fade * s);
    };
    const occ = new Uint8Array(cols * rows);
    const free = (cx, cy, s) => {
      if (cx < 0 || cy < 0 || cx + s > cols || cy + s > rows) return false;
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (occ[(cy + j) * cols + cx + i]) return false;
      return true;
    };
    const take = (cx, cy, s) => {
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) occ[(cy + j) * cols + cx + i] = 1;
    };
    const paths = [];
    const layer = Math.round(p.layer);
    const gap = Math.max(0, p.gap);
    const rect = (x, y, w) => {
      if (w > 0.25) paths.push({ pts: [[x, y], [x + w, y], [x + w, y + w], [x, y + w]], closed: true, layer });
    };
    const nestDepth = Math.max(0, Math.min(4, Math.round(p.nest)));
    const nestP = Math.max(0, Math.min(1, p.nestp));
    const addNest = (x, y, side, depth, r) => {
      if (depth <= 0 || side < 2.0) return;
      if (r() >= nestP) return;
      let style = p.neststyle;
      if (style === "Mixed") style = r() < 0.5 ? "Concentric" : "Corner";
      if (style === "Concentric") {
        const in0 = Math.max(0.35, side * 0.16);
        const s2 = side - 2 * in0;
        if (s2 < 0.6) return;
        rect(x + in0, y + in0, s2);
        addNest(x + in0, y + in0, s2, depth - 1, r);
      } else {
        const s2 = side * 0.42;
        const in0 = Math.max(0.3, side * 0.09);
        if (s2 < 0.6 || s2 + 2 * in0 > side) return;
        const c = Math.floor(r() * 4);
        const nx = (c === 1 || c === 2) ? x + side - in0 - s2 : x + in0;
        const ny = c >= 2 ? y + side - in0 - s2 : y + in0;
        rect(nx, ny, s2);
        addNest(nx, ny, s2, depth - 1, r);
      }
    };
    for (let s = maxS; s >= 1; s--) {
      const anchors = [];
      for (let cy = 0; cy + s <= rows; cy++) for (let cx = 0; cx + s <= cols; cx++) anchors.push([cx, cy]);
      for (let i = anchors.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = anchors[i]; anchors[i] = anchors[j]; anchors[j] = t;
      }
      const decay = Math.pow(0.4, s - 1);
      for (let a = 0; a < anchors.length; a++) {
        const cx = anchors[a][0], cy = anchors[a][1];
        if (!free(cx, cy, s)) continue;
        const n = fbm(cx + s / 2, cy + s / 2);
        const f = fall(cx + (s - 1) / 2, cy + (s - 1) / 2);
        const prob = density * decay * f * (0.35 + 0.85 * n);
        if (rng() < prob) {
          take(cx, cy, s);
          const g = Math.min(gap / 2, s * cell * 0.3);
          const x = ox + cx * cell + g, y = oy + cy * cell + g;
          const side = s * cell - 2 * g;
          rect(x, y, side);
          const r = mulberry32(seed * 7919 + cy * 10007 + cx * 613 + s * 31);
          addNest(x, y, side, nestDepth, r);
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
