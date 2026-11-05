import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  key: "isometric_blocks",
  name: "Isometric Blocks",
  cat: "gen",
  group: "geometric",
  desc: "Build a page of separated isometric blocks with an exact 30° top projection. Terraces, Stairs, Wave and Random set quantized heights; Density leaves open cells, and Stagger offsets alternate rows. Height, Levels and Cell gap shape the arrangement, which scales as a whole to fit Margin. Edges are drawn once per block. Side hatch shades the two visible faces at different densities; All faces adds a light top hatch. Artwork has the plotted edges and shading; separate closed Top, Left and Right faces are ready for Hatch Fill or other region effects. Face hatches use their own pens. Style changes Artwork only.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Artwork"), Pin("paths", "Top faces"), Pin("paths", "Left faces"), Pin("paths", "Right faces")],
  params: [
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 24, step: 1, def: 7 },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 16, step: 1, def: 3 },
    { key: "pattern", label: "Height pattern", type: "select", options: ["Terraces", "Stairs", "Wave", "Random"], def: "Terraces" },
    { key: "levels", label: "Height levels", type: "slider", min: 1, max: 10, step: 1, def: 5 },
    { key: "height", label: "Max height × width", type: "slider", min: 0.2, max: 2.5, step: 0.05, def: 1.3 },
    { key: "density", label: "Occupied cells %", type: "slider", min: 5, max: 100, step: 1, def: 95 },
    { key: "stagger", label: "Stagger rows", type: "check", def: true },
    { key: "gap", label: "Cell gap × width", type: "slider", min: 0, max: 0.8, step: 0.02, def: 0.18 },
    { key: "shading", label: "Shading", type: "select", options: ["Edges only", "Side hatch", "All faces"], def: "Side hatch" },
    { key: "hatchGap", label: "Hatch gap mm", type: "slider", min: 0.7, max: 8, step: 0.1, def: 2.2, showIf: p => p.shading !== "Edges only" },
    { key: "edgePen", label: "Edge pen", type: "pen", def: 0 },
    { key: "leftPen", label: "Left shade pen", type: "pen", def: 1, showIf: p => p.shading !== "Edges only" },
    { key: "rightPen", label: "Right shade pen", type: "pen", def: 2, showIf: p => p.shading !== "Edges only" },
    { key: "topPen", label: "Top shade pen", type: "pen", def: 3, showIf: p => p.shading === "All faces" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 29 },
  ],
  overlay(p, ctx) {
    if (!ctx || !Number.isFinite(ctx.W) || !Number.isFinite(ctx.H)) return [];
    const m = Math.max(0, Math.min(60, Number(p.margin) || 0));
    if (ctx.W <= 2 * m || ctx.H <= 2 * m) return [];
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const W = ctx && ctx.W, H = ctx && ctx.H;
    const empty = [{ paths: [] }, { paths: [] }, { paths: [] }, { paths: [] }];
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return empty;
    const num = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : fallback;
    const margin = num(p.margin, 0, 60, 12);
    const bw = W - 2 * margin, bh = H - 2 * margin;
    if (bw <= 1 || bh <= 1) return empty;
    const cols = Math.round(num(p.cols, 1, 24, 7));
    const rows = Math.round(num(p.rows, 1, 16, 3));
    const levels = Math.round(num(p.levels, 1, 10, 5));
    const heightRatio = num(p.height, 0.2, 2.5, 1.3);
    const density = num(p.density, 5, 100, 95) / 100;
    const gapRatio = num(p.gap, 0, 0.8, 0.18);
    const stagger = !!p.stagger && rows > 1;
    const shading = ["Edges only", "Side hatch", "All faces"].includes(p.shading) ? p.shading : "Side hatch";
    const seed = Math.round(num(p.seed, -2147483648, 2147483647, 29));
    const pen = key => Math.round(num(p[key], 0, 11, 0));
    const edgePen = pen("edgePen"), leftPen = pen("leftPen"), rightPen = pen("rightPen"), topPen = pen("topPen");
    const iso = 1 / Math.sqrt(3);
    const wByWidth = bw / (cols + (cols - 1) * gapRatio + (stagger ? (1 + gapRatio) / 2 : 0));
    const wByHeight = bh / (rows * (iso + heightRatio) + (rows - 1) * gapRatio);
    const width = Math.min(wByWidth, wByHeight);
    if (!Number.isFinite(width) || width <= 0.05) return empty;
    const diamondH = width * iso, maxH = width * heightRatio, gap = width * gapRatio;
    const totalW = cols * width + (cols - 1) * gap + (stagger ? (width + gap) / 2 : 0);
    const totalH = rows * (diamondH + maxH) + (rows - 1) * gap;
    const startX = (W - totalW) / 2, startY = (H - totalH) / 2;
    const art = [], tops = [], lefts = [], rights = [];
    const proposed = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (density < 1 && hash2(x + 101, y + 211, seed + 911) >= density) continue;
      let value;
      if (p.pattern === "Stairs") value = (x / Math.max(1, cols - 1) + y / Math.max(1, rows - 1)) / 2;
      else if (p.pattern === "Wave") value = 0.5 + 0.5 * Math.sin(x * 0.95 + seed * 0.013) * Math.cos(y * 1.1 - seed * 0.017);
      else if (p.pattern === "Random") value = hash2(x, y, seed + 19);
      else {
        const dx = (x - (cols - 1) / 2) / Math.max(1, (cols - 1) / 2);
        const dy = (y - (rows - 1) / 2) / Math.max(1, (rows - 1) / 2);
        value = Math.max(0, 1 - Math.hypot(dx, dy) / Math.sqrt(2));
      }
      const tier = Math.min(levels - 1, Math.floor(Math.max(0, Math.min(0.999999, value)) * levels));
      const h = maxH * (levels === 1 ? 1 : 0.28 + 0.72 * tier / (levels - 1));
      proposed.push({ x, y, h });
    }
    if (!proposed.length) return empty;
    const desiredGap = num(p.hatchGap, 0.7, 8, 2.2);
    const hatchGap = Math.max(desiredGap, proposed.length * width * (shading === "All faces" ? 1.4 : 1.1) / 40000);
    const point = (x, y) => [x, y];
    const line = (a, b, layer) => {
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05) art.push({ pts: [a, b], closed: false, layer });
    };
    const hatch = (a, b, layer) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      const inset = Math.min(0.4, len * 0.1);
      if (len > inset * 2 + 0.05) line([a[0] + dx * inset / len, a[1] + dy * inset / len], [b[0] - dx * inset / len, b[1] - dy * inset / len], layer);
    };
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (const { x, y, h } of proposed) {
      const cx = startX + x * (width + gap) + (stagger && y % 2 ? (width + gap) / 2 : 0) + width / 2;
      const topY = startY + y * (diamondH + maxH + gap) + maxH - h;
      const T = point(cx, topY), R = point(cx + width / 2, topY + diamondH / 2);
      const B = point(cx, topY + diamondH), L = point(cx - width / 2, topY + diamondH / 2);
      const Rp = point(R[0], R[1] + h), Bp = point(B[0], B[1] + h), Lp = point(L[0], L[1] + h);
      const layer = edgePen;
      art.push({ pts: [T, R, Rp, Bp, Lp, L], closed: true, layer });
      line(L, B, layer); line(B, R, layer); line(B, Bp, layer);
      tops.push({ pts: [T, R, B, L], closed: true, layer: topPen });
      lefts.push({ pts: [L, B, Bp, Lp], closed: true, layer: leftPen });
      rights.push({ pts: [B, R, Rp, Bp], closed: true, layer: rightPen });
      if (shading !== "Edges only") {
        const leftCount = Math.floor((width / 2) / (hatchGap * 1.7));
        const rightCount = Math.floor((width / 2) / hatchGap);
        for (let j = 1; j <= leftCount; j++) {
          const t = j / (leftCount + 1), a = mix(L, B, t);
          hatch(a, [a[0], a[1] + h], leftPen);
        }
        for (let j = 1; j <= rightCount; j++) {
          const t = j / (rightCount + 1), a = mix(B, R, t);
          hatch(a, [a[0], a[1] + h], rightPen);
        }
        if (shading === "All faces") {
          const topCount = Math.floor((width / 2) / (hatchGap * 2.2));
          for (let j = 1; j <= topCount; j++) {
            const t = j / (topCount + 1);
            hatch(mix(T, L, t), mix(R, B, t), topPen);
          }
        }
      }
    }
    return [applyStyle({ paths: art }, ins[0]), { paths: tops }, { paths: lefts }, { paths: rights }];
  },
};
