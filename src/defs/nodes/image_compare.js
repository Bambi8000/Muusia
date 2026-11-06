import { Pin } from "../helpers.js";

export default {
  key: "image_compare",
  name: "Image Compare",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  imageMax: 400,
  desc: "Load one image and compare two or four plotter treatments on the same sheet. Each panel samples the same pixels and uses the same contrast and white cutoff. Flow curves hatch lines, Straight keeps diagonal lines, Facets uses short directional marks, and Spiral draws one unbroken line within its panel. Change the A–D style choices, line spacing and pens, then wire an individual panel output to continue working with the result you like. The comparison is vector artwork and can be exported.",
  ins: [],
  outs: [Pin("paths", "Sheet"), Pin("paths", "A"), Pin("paths", "B"), Pin("paths", "C"), Pin("paths", "D")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "layout", label: "Panels", type: "select", options: ["Two", "Four"], def: "Four" },
    { key: "styleA", label: "A style", type: "select", options: ["Flow", "Straight", "Facets", "Spiral"], def: "Flow" },
    { key: "styleB", label: "B style", type: "select", options: ["Flow", "Straight", "Facets", "Spiral"], def: "Straight" },
    { key: "styleC", label: "C style", type: "select", options: ["Flow", "Straight", "Facets", "Spiral"], def: "Facets", showIf: p => p.layout === "Four" },
    { key: "styleD", label: "D style", type: "select", options: ["Flow", "Straight", "Facets", "Spiral"], def: "Spiral", showIf: p => p.layout === "Four" },
    { key: "spacing", label: "Line spacing mm", type: "slider", min: 0.8, max: 6, step: 0.1, def: 1.7 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0.5, max: 3, step: 0.05, def: 1.65 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.12 },
    { key: "gutter", label: "Panel gap mm", type: "slider", min: 4, max: 30, step: 1, def: 12 },
    { key: "frame", label: "Panel frames", type: "check", def: true },
    { key: "penA", label: "A pen", type: "pen", def: 0 },
    { key: "penB", label: "B pen", type: "pen", def: 0 },
    { key: "penC", label: "C pen", type: "pen", def: 0, showIf: p => p.layout === "Four" },
    { key: "penD", label: "D pen", type: "pen", def: 0, showIf: p => p.layout === "Four" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 50, step: 1, def: 10 },
  ],
  overlay(p, ctx) {
    const W = ctx?.W, H = ctx?.H;
    if (!Number.isFinite(W) || !Number.isFinite(H)) return [];
    const n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d;
    const m = n(p.margin, 0, 50, 10), g = n(p.gutter, 4, 30, 12), four = p.layout !== "Two";
    const w = (W - 2 * m - g) / 2, h = four ? (H - 2 * m - g) / 2 : H - 2 * m;
    if (w <= 0 || h <= 0) return [];
    return Array.from({ length: four ? 4 : 2 }, (_, i) => ({ kind: "rect", x: m + (i % 2) * (w + g), y: m + Math.floor(i / 2) * (h + g), w, h }));
  },
  compute(ins, p, ctx, node) {
    const empty = Array.from({ length: 5 }, () => ({ paths: [] }));
    const img = node?.data?.img, W = ctx?.W, H = ctx?.H;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0 ||
      !img || !Number.isInteger(img.w) || !Number.isInteger(img.h) || img.w < 2 || img.h < 2 ||
      img.w * img.h > 2560000 || !img.g || img.g.length !== img.w * img.h) return empty;
    const n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d;
    const m = n(p.margin, 0, 50, 10), gap = n(p.gutter, 4, 30, 12), four = p.layout !== "Two";
    const pw = (W - 2 * m - gap) / 2, ph = four ? (H - 2 * m - gap) / 2 : H - 2 * m;
    if (pw < 20 || ph < 22) return empty;
    const spacing = n(p.spacing, 0.8, 6, 1.7), contrast = n(p.contrast, 0.5, 3, 1.65), cutoff = n(p.cutoff, 0, 0.5, 0.12);
    const panels = [];
    const letters = [
      [[[3, 8], [6, 1], [9, 8]], [[4, 6], [8, 6]]],
      [[[3, 1], [3, 8], [7, 8], [9, 7], [9, 5], [7, 4], [3, 4]], [[7, 4], [9, 3], [9, 2], [7, 1], [3, 1]]],
      [[[9, 2], [7, 1], [4, 1], [3, 3], [3, 6], [4, 8], [7, 8], [9, 7]]],
      [[[3, 1], [3, 8], [6, 8], [9, 6], [9, 3], [6, 1], [3, 1]]],
    ];
    for (let i = 0, count = four ? 4 : 2; i < count; i++) {
      const x = m + (i % 2) * (pw + gap), y = m + Math.floor(i / 2) * (ph + gap);
      const pen = Math.round(n(p["pen" + "ABCD"[i]], 0, 11, 0));
      const style = ["Flow", "Straight", "Facets", "Spiral"].includes(p["style" + "ABCD"[i]]) ? p["style" + "ABCD"[i]] : "Flow";
      const paths = [];
      const add = (pts, closed = false) => { if (pts.length >= 2) paths.push({ pts, closed, layer: pen }); };
      for (const stroke of letters[i]) add(stroke.map(([a, b]) => [x + a, y + b]));
      if (p.frame) add([[x + 1, y + 11], [x + 1, y + ph - 1], [x + pw - 1, y + ph - 1], [x + pw - 1, y + 11]], false);
      const inset = 3, bx = x + inset, by = y + 13, bw = pw - 2 * inset, bh = ph - 16;
      const sc = Math.min(bw / img.w, bh / img.h), iw = img.w * sc, ih = img.h * sc;
      const ox = bx + (bw - iw) / 2, oy = by + (bh - ih) / 2;
      const dark = (px, py) => {
        if (px < ox || py < oy || px > ox + iw || py > oy + ih) return 0;
        const u = Math.max(0, Math.min(img.w - 1, (px - ox) / sc - 0.5));
        const v = Math.max(0, Math.min(img.h - 1, (py - oy) / sc - 0.5));
        const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
        const at = (a, b) => n(img.g[Math.min(img.h - 1, b) * img.w + Math.min(img.w - 1, a)], 0, 1, 0);
        const tone = at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
        return Math.max(0, Math.min(1, ((tone - 0.5) * contrast + 0.5 - cutoff) / (1 - cutoff)));
      };
      if (style === "Spiral") {
        const cx = ox + iw / 2, cy = oy + ih / 2, rx = iw / 2 - 2, ry = ih / 2 - 2;
        const turns = Math.max(2, Math.min(90, Math.floor(Math.min(rx, ry) / spacing)));
        const points = Math.min(24000, Math.max(300, Math.ceil(Math.PI * (rx + ry) * turns / 1.15)));
        const pts = [];
        for (let k = 0; k <= points; k++) {
          const t = k / points, a = -Math.PI / 2 + t * turns * 2 * Math.PI;
          const ux = Math.cos(a), uy = Math.sin(a), baseX = cx + rx * t * ux, baseY = cy + ry * t * uy;
          const amp = Math.min(spacing * 0.8, 1.6) * Math.sqrt(dark(baseX, baseY)) * Math.sin(2 * Math.PI * k / Math.max(12, points / (turns * 30)));
          pts.push([n(cx + (rx * t + amp) * ux, ox, ox + iw, cx), n(cy + (ry * t + amp) * uy, oy, oy + ih, cy)]);
        }
        add(pts);
      } else if (style === "Facets") {
        const cell = Math.max(spacing * 1.8, Math.sqrt(iw * ih / 5000));
        const cols = Math.max(1, Math.ceil(iw / cell)), rows = Math.max(1, Math.ceil(ih / cell));
        for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < cols; ix++) {
          const px = ox + (ix + 0.5) * iw / cols, py = oy + (iy + 0.5) * ih / rows, tone = dark(px, py);
          if (tone < 0.15) continue;
          const gx = dark(px + cell * 0.4, py) - dark(px - cell * 0.4, py), gy = dark(px, py + cell * 0.4) - dark(px, py - cell * 0.4);
          const a = Math.hypot(gx, gy) > 0.03 ? Math.atan2(gy, gx) + Math.PI / 2 : -Math.PI / 4;
          const length = cell * (0.35 + 0.5 * tone), dx = Math.cos(a) * length / 2, dy = Math.sin(a) * length / 2;
          add([[n(px - dx, ox, ox + iw, px), n(py - dy, oy, oy + ih, py)], [n(px + dx, ox, ox + iw, px), n(py + dy, oy, oy + ih, py)]]);
        }
      } else {
        const angle = -Math.PI / 5, ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
        const radius = Math.hypot(iw, ih) / 2 + 2, cx = ox + iw / 2, cy = oy + ih / 2;
        const pitch = Math.max(spacing, Math.sqrt(iw * ih / 18000));
        const lines = Math.min(180, Math.ceil(2 * radius / pitch)), steps = Math.min(550, Math.ceil(2 * radius / Math.max(0.9, pitch * 0.65)));
        for (let line = 0; line <= lines; line++) {
          const offset = -radius + line * pitch;
          let run = [];
          const flush = () => { if (run.length > 1) add(run); run = []; };
          for (let j = 0; j <= steps; j++) {
            const q = -radius + 2 * radius * j / steps, px = cx + ux * q + nx * offset, py = cy + uy * q + ny * offset;
            const tone = dark(px, py), bend = style === "Flow" ? (2.5 * tone * Math.sin(q / 11 + line * 0.32) + 3 * (dark(px + nx * 2, py + ny * 2) - dark(px - nx * 2, py - ny * 2))) : 0;
            const sx = px + nx * bend, sy = py + ny * bend;
            if (sx >= ox && sx <= ox + iw && sy >= oy && sy <= oy + ih && dark(sx, sy) > 0.18) run.push([sx, sy]);
            else flush();
          }
          flush();
        }
      }
      panels.push({ paths });
    }
    while (panels.length < 4) panels.push({ paths: [] });
    return [{ paths: panels.flatMap(q => q.paths) }, ...panels];
  },
};
