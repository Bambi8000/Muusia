import { Pin, EMPTY, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "glyphtone",
  name: "Glyph Halftone",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  desc: "A designer's halftone: a grid where each cell renders its darkness as a glyph — a filled dot, a donut ring, a cluster of mini dots, a stack of stripes, or a stacked chevron. Source is either a seeded noise field (create from nothing) or an imported image (PNG/JPG, fitted to the margin box). Type by Value assigns glyphs by darkness band (clusters in light areas through to filled dots in dark ones, like classic poster halftones); Random picks freely per cell. Big cells merges some cells into 2×2 giants for scale contrast, Size jitter loosens the grid, Pens used sprays glyphs across several pens starting from the base pen. Fill pitch is the concentric-fill line spacing — match it to your pen width for solid blacks.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "source", label: "Source", type: "select", options: ["Noise", "Image"], def: "Noise" },
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "cell", label: "Cell mm", type: "slider", min: 3, max: 20, step: 0.5, def: 6 },
    { key: "gDot", label: "Dots", type: "check", def: true },
    { key: "gRing", label: "Rings", type: "check", def: true },
    { key: "gClu", label: "Clusters", type: "check", def: true },
    { key: "gStr", label: "Stripes", type: "check", def: true },
    { key: "gChe", label: "Chevrons", type: "check", def: false },
    { key: "typeby", label: "Type by", type: "select", options: ["Value", "Random"], def: "Value" },
    { key: "big", label: "Big cells", type: "slider", min: 0, max: 1, step: 0.01, def: 0.25 },
    { key: "jitter", label: "Size jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.6, step: 0.01, def: 0.08 },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "invert", label: "Invert", type: "check", def: false },
    { key: "nscale", label: "Field scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
    { key: "pitch", label: "Fill pitch mm", type: "slider", min: 0.3, max: 2, step: 0.05, def: 0.6 },
    { key: "pens", label: "Pens used", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 29 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx, node) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const cell = Math.max(2, p.cell);
    const margin = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 5));
    const cutoff = Math.max(0, p.cutoff);
    const gam = Math.max(0.1, p.gamma);
    const jit = Math.max(0, Math.min(1.5, p.jitter));
    const bigP = Math.max(0, Math.min(1, p.big));
    const pensN = Math.max(1, Math.min(12, Math.round(p.pens)));
    const baseL = Math.round(p.layer);

    // enabled glyphs in light→dark canonical order
    const order = [];
    if (p.gClu) order.push("clu");
    if (p.gChe) order.push("che");
    if (p.gStr) order.push("str");
    if (p.gRing) order.push("ring");
    if (p.gDot) order.push("dot");
    if (!order.length) return applyStyle(EMPTY, ins[0]);

    // ---- darkness field ----
    const img = node && node.data && node.data.img;
    if (p.source === "Image" && !img) return applyStyle(EMPTY, ins[0]);
    let darkAt;
    if (p.source === "Image") {
      const boxW = W - 2 * margin, boxH = H - 2 * margin;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ix0 = (W - iw) / 2, iy0 = (H - ih) / 2;
      darkAt = (x, y) => {
        const u = (x - ix0) / sc, v = (y - iy0) / sc;
        if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
        const ui = Math.floor(u), vi = Math.floor(v);
        const fu = u - ui, fv = v - vi, g = img.g;
        const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
        const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
        return a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
      };
    } else {
      const sc = Math.max(0.0005, p.nscale);
      darkAt = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < 3; o++) { v += amp * noise2(x * sc * fq, y * sc * fq, seed + o * 7); tot += amp; amp *= 0.5; fq *= 2; }
        return v / tot;
      };
    }
    const value = (x, y) => {
      let v = darkAt(x, y);
      if (p.invert) v = 1 - v;
      return Math.pow(Math.max(0, Math.min(1, v)), gam);
    };

    // ---- grid + 2x2 big-cell occupancy ----
    const cols = Math.floor((W - 2 * margin) / cell);
    const rows = Math.floor((H - 2 * margin) / cell);
    if (cols < 1 || rows < 1) return applyStyle(EMPTY, ins[0]);
    const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
    const used = new Uint8Array(cols * rows);
    const glyphs = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (used[r * cols + c]) continue;
      const canBig = c + 1 < cols && r + 1 < rows && !used[r * cols + c + 1] && !used[(r + 1) * cols + c] && !used[(r + 1) * cols + c + 1];
      const isBig = canBig && hash2(c * 7 + 1, r * 13 + 5, seed * 3 + 11) < bigP * 0.4;
      const span = isBig ? 2 : 1;
      for (let j = 0; j < span; j++) for (let i = 0; i < span; i++) used[(r + j) * cols + c + i] = 1;
      const cx = ox + c * cell + (span * cell) / 2, cy = oy + r * cell + (span * cell) / 2;
      const v = value(cx, cy);
      if (v < cutoff) continue;
      glyphs.push({ cx, cy, span, v, c, r });
    }
    if (!glyphs.length) return applyStyle(EMPTY, ins[0]);

    // ---- budget-aware fill pitch ----
    let pitch = Math.max(0.25, p.pitch);
    const estR = (cell * 0.45);
    const estPts = glyphs.length * ((estR / pitch) * ((2 * Math.PI * estR * 0.6) / 0.7)) * 0.6;
    if (estPts > 110000) pitch *= estPts / 110000;

    // ---- glyph painters (local coords around cx,cy; h = half size) ----
    const paths = [];
    const circle = (cx, cy, r, layer) => {
      const n = Math.max(8, Math.ceil((2 * Math.PI * r) / 0.7));
      const pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      paths.push({ pts, closed: true, layer });
    };
    const fillDisc = (cx, cy, R, rIn, layer) => {
      for (let r = R; r > rIn + 1e-6; r -= pitch) circle(cx, cy, r, layer);
      if (rIn > 0) circle(cx, cy, rIn, layer);
      else if (R % pitch > pitch * 0.4) circle(cx, cy, Math.max(0.15, (R % pitch) / 2), layer);
    };
    const draw = {
      dot: (g, h, L) => fillDisc(g.cx, g.cy, h * 0.9, 0, L),
      ring: (g, h, L) => fillDisc(g.cx, g.cy, h * 0.9, h * 0.9 * 0.45, L),
      clu: (g, h, L, rng) => {
        const k = 2 + Math.round(g.v * 2);
        const sp = (2 * h) / k;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++)
          fillDisc(g.cx - h + sp * (i + 0.5), g.cy - h + sp * (j + 0.5), Math.max(0.25, sp * 0.28), 0, L);
      },
      str: (g, h, L) => {
        const n = 2 + Math.round(g.v * 4);
        const w = h * 0.95, hh = h * 0.8;
        for (let j = 0; j < n; j++) {
          const y = g.cy - hh + (n === 1 ? hh : (j / (n - 1)) * 2 * hh);
          paths.push({ pts: [[g.cx - w, y], [g.cx + w, y]], closed: false, layer: L });
        }
      },
      che: (g, h, L) => {
        const n = 1 + Math.round(g.v * 2);
        const w = h * 0.9, k = h * 0.55, step = (h * 1.4) / Math.max(1, n);
        for (let j = 0; j < n; j++) {
          const y = g.cy - h * 0.35 + j * step;
          paths.push({ pts: [[g.cx - w, y + k], [g.cx, y - k], [g.cx + w, y + k]], closed: false, layer: L });
        }
      },
    };

    for (const g of glyphs) {
      const rng = mulberry32(seed * 7919 + (g.r * 4096 + g.c) * 613 + 29);
      const type = p.typeby === "Random"
        ? order[Math.floor(rng() * order.length)]
        : order[Math.min(order.length - 1, Math.floor(g.v * order.length * 0.9999))];
      const sizef = (0.35 + 0.65 * g.v) * (1 + (rng() - 0.5) * jit * 0.8);
      const h = Math.max(0.4, (g.span * cell) / 2 * 0.92 * Math.min(1.15, sizef));
      const L = ((baseL + Math.floor(rng() * pensN)) % 12 + 12) % 12;
      draw[type](g, h, L, rng);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
