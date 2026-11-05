import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "leaf_field",
  name: "Leaf Field",
  cat: "gen",
  group: "nature",
  desc: "Scatter a page of individual, plotter-ready leaves. Scatter moves from even rows to loose placement; Direction aligns leaves, waves them or turns them around a whirl. Shape selects lance, oval, lobed, serrated or a seeded mix. No overlap keeps whole leaves and their stems apart, with a Gap around each one; when space runs out, fewer leaves are drawn. Size, variation, width, bend, angle spread and vein pairs shape the blades. Artwork combines both pens; Leaves gives closed outlines for Hatch Fill, and Veins gives open details. All marks fit Margin. Style affects Artwork only.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Artwork"), Pin("paths", "Leaves"), Pin("paths", "Veins")],
  params: [
    { key: "count", label: "Leaves", type: "slider", min: 1, max: 300, step: 1, def: 70 },
    { key: "size", label: "Length mm", type: "slider", min: 4, max: 90, step: 1, def: 23 },
    { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "width", label: "Width / length", type: "slider", min: 0.15, max: 0.9, step: 0.01, def: 0.46 },
    { key: "shape", label: "Shape", type: "select", options: ["Mixed", "Lance", "Oval", "Lobed", "Serrated"], def: "Mixed" },
    { key: "scatter", label: "Scatter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "noOverlap", label: "No overlap", type: "check", def: false },
    { key: "gap", label: "Leaf gap mm", type: "slider", min: 0.2, max: 15, step: 0.1, def: 1.5, showIf: p => !!p.noOverlap },
    { key: "direction", label: "Direction", type: "select", options: ["Aligned", "Wave", "Whorl"], def: "Wave" },
    { key: "angle", label: "Base angle °", type: "slider", min: 0, max: 360, step: 1, def: 25 },
    { key: "angleVar", label: "Angle spread °", type: "slider", min: 0, max: 180, step: 1, def: 42 },
    { key: "bend", label: "Leaf bend", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "veins", label: "Vein pairs", type: "slider", min: 0, max: 10, step: 1, def: 4 },
    { key: "stems", label: "Stems", type: "check", def: true },
    { key: "leafPen", label: "Leaf pen", type: "pen", def: 0 },
    { key: "veinPen", label: "Vein pen", type: "pen", def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 42 },
  ],
  overlay(p, ctx) {
    if (!ctx || !Number.isFinite(ctx.W) || !Number.isFinite(ctx.H)) return [];
    const m = Math.max(0, Math.min(60, Number(p.margin) || 0));
    if (ctx.W <= 2 * m || ctx.H <= 2 * m) return [];
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const W = ctx && ctx.W, H = ctx && ctx.H;
    const empty = [{ paths: [] }, { paths: [] }, { paths: [] }];
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return empty;
    const clamp = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : fallback;
    const margin = clamp(p.margin, 0, 60, 12);
    const x0 = margin, y0 = margin, x1 = W - margin, y1 = H - margin;
    const bw = x1 - x0, bh = y1 - y0;
    if (bw < 3 || bh < 3) return empty;
    const count = Math.round(clamp(p.count, 1, 300, 70));
    const size = clamp(p.size, 4, 90, 23);
    const sizeVar = clamp(p.sizeVar, 0, 1, 0.55);
    const width = clamp(p.width, 0.15, 0.9, 0.46);
    const scatter = clamp(p.scatter, 0, 1, 0.2);
    const noOverlap = !!p.noOverlap;
    const gap = clamp(p.gap, 0.2, 15, 1.5);
    const bend = clamp(p.bend, 0, 1, 0.35);
    const angle = clamp(p.angle, 0, 360, 25) * Math.PI / 180;
    const angleVar = clamp(p.angleVar, 0, 180, 42) * Math.PI / 180;
    const veins = Math.round(clamp(p.veins, 0, 10, 4));
    const leafPen = Math.round(clamp(p.leafPen, 0, 11, 0));
    const veinPen = Math.round(clamp(p.veinPen, 0, 11, 1));
    const seed = Math.trunc(clamp(p.seed, -2147483648, 2147483647, 42));
    const cols = Math.max(1, Math.round(Math.sqrt(count * bw / bh)));
    const rows = Math.ceil(count / cols);
    const outlines = [], details = [], occupied = [];
    const shapes = ["Lance", "Oval", "Lobed", "Serrated"];

    for (let i = 0; i < count; i++) {
      const rng = mulberry32((seed + i * 2654435761) | 0);
      const gx = x0 + (i % cols + 0.5) * bw / cols;
      const gy = y0 + (Math.floor(i / cols) + 0.5) * bh / rows;
      const cx0 = gx + (x0 + rng() * bw - gx) * scatter;
      const cy0 = gy + (y0 + rng() * bh - gy) * scatter;
      const L = Math.max(2, Math.min(size * (1 + (rng() - 0.5) * sizeVar), Math.min(bw, bh) * 0.85));
      const shape = p.shape === "Mixed" ? shapes[Math.floor(rng() * shapes.length)] : (shapes.includes(p.shape) ? p.shape : "Mixed");
      const curve = (rng() - 0.5) * 2 * bend * L * 0.12;
      const angleJitter = (rng() - 0.5) * 2 * angleVar;
      const halfWidth = t => {
        const s = Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, t))));
        let w = Math.pow(s, shape === "Oval" ? 0.72 : 1.08);
        if (shape === "Lance") w *= 1.17 - 0.34 * t;
        if (shape === "Lobed") w *= 0.83 + 0.17 * Math.cos(8 * Math.PI * t);
        if (shape === "Serrated") w *= 0.86 + 0.14 * (1 - ((t * 9) % 1));
        return (L * width / 2) * w;
      };
      const local = (t, side) => [(t - 0.5) * L, curve * Math.sin(Math.PI * t) + side * halfWidth(t)];
      const contours = [];
      const n = 72;
      for (let j = 0; j <= n; j++) contours.push(local(j / n, 1));
      for (let j = n - 1; j >= 1; j--) contours.push(local(j / n, -1));
      const veinPaths = [];
      if (p.stems) veinPaths.push([[-0.62 * L, 0], ...Array.from({ length: 15 }, (_, j) => local(j / 14, 0))]);
      else veinPaths.push(Array.from({ length: 15 }, (_, j) => local(j / 14, 0)));
      for (let k = 0; k < veins; k++) {
        const t0 = 0.16 + (k + 0.5) * 0.66 / veins;
        const t1 = Math.min(0.94, t0 + 0.14);
        for (const side of [-1, 1]) {
          const branch = [];
          for (let j = 0; j <= 4; j++) {
            const f = j / 4, t = t0 + (t1 - t0) * f;
            branch.push(local(t, side * f * 0.93));
          }
          veinPaths.push(branch);
        }
      }
      const all = [contours, ...veinPaths];
      const placeRng = noOverlap ? mulberry32((seed ^ Math.imul(i + 1, 2246822519)) | 0) : null;
      for (let trial = 0; trial < (noOverlap ? 40 : 1); trial++) {
        const cx = trial ? x0 + placeRng() * bw : cx0;
        const cy = trial ? y0 + placeRng() * bh : cy0;
        let a = angle;
        if (p.direction === "Wave") a += Math.sin(cx / 37 + cy / 49) * 0.7;
        else if (p.direction === "Whorl") a += Math.atan2(cy - H / 2, cx - W / 2) + Math.PI / 2;
        a += angleJitter;
        const ca = Math.cos(a), sa = Math.sin(a);
        const rotated = all.map(path => path.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const path of rotated) for (const [x, y] of path) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
        const fit = Math.min(1, bw / (maxX - minX), bh / (maxY - minY));
        if (!Number.isFinite(fit) || fit <= 0) continue;
        const baseX = cx + (minX - cx) * fit, baseY = cy + (minY - cy) * fit;
        const topX = cx + (maxX - cx) * fit, topY = cy + (maxY - cy) * fit;
        const dx = baseX < x0 ? x0 - baseX : topX > x1 ? x1 - topX : 0;
        const dy = baseY < y0 ? y0 - baseY : topY > y1 ? y1 - topY : 0;
        const box = [baseX + dx, baseY + dy, topX + dx, topY + dy];
        if (noOverlap && occupied.some(b =>
          box[0] < b[2] + gap && box[2] > b[0] - gap &&
          box[1] < b[3] + gap && box[3] > b[1] - gap)) continue;
        const place = path => path.map(([x, y]) => [Math.max(x0, Math.min(x1, cx + (x - cx) * fit + dx)), Math.max(y0, Math.min(y1, cy + (y - cy) * fit + dy))]);
        outlines.push({ pts: place(rotated[0]), closed: true, layer: leafPen });
        for (let j = 1; j < rotated.length; j++) details.push({ pts: place(rotated[j]), closed: false, layer: veinPen });
        if (noOverlap) occupied.push(box);
        break;
      }
    }
    const leaves = { paths: outlines }, v = { paths: details };
    const artwork = applyStyle({ paths: [...outlines, ...details] }, ins[0]);
    return [artwork, leaves, v];
  },
};
