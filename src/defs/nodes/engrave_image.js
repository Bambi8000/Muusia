import { Pin, hash2, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "engrave_image",
  name: "Engrave Image",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  imageMax: 640,
  desc: "Turn a photo into plotter-ready etched linework. Flow bends long hatch strokes around tonal edges; Straight keeps a disciplined diagonal screen; Facets builds small marks that turn with the image gradient. Darker areas receive a second hatch pass, deep shadows can crosshatch, and lighter tone can receive sparse dots. Contour outlines, main hatch, shadow hatch and dots each have their own pen and separate outputs. Spacing is in paper millimetres; dense requests coarsen over the entire picture so no side is cut off. All processing stays on this device. Choose a clear photo with a simple background, then adjust Contrast, White cutoff and Shadow threshold.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Artwork"), Pin("paths", "Outlines"), Pin("paths", "Hatching"), Pin("paths", "Shadows"), Pin("paths", "Dots")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "mode", label: "Engraving", type: "select", options: ["Flow", "Straight", "Facets"], def: "Flow" },
    { key: "spacing", label: "Line spacing mm", type: "slider", min: 0.7, max: 8, step: 0.1, def: 2.2 },
    { key: "angle", label: "Base angle °", type: "slider", min: -90, max: 90, step: 1, def: -35 },
    { key: "bend", label: "Flow bend mm", type: "slider", min: 0, max: 10, step: 0.2, def: 4, showIf: p => p.mode === "Flow" },
    { key: "contrast", label: "Contrast", type: "slider", min: 0.5, max: 2.5, step: 0.05, def: 1.25 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.18 },
    { key: "shadow", label: "Shadow threshold", type: "slider", min: 0.35, max: 0.9, step: 0.01, def: 0.62 },
    { key: "cross", label: "Crosshatch shadows", type: "check", def: true },
    { key: "outline", label: "Contour outlines", type: "check", def: true },
    { key: "outlineTone", label: "Outline tone", type: "slider", min: 0.2, max: 0.85, step: 0.01, def: 0.46, showIf: p => !!p.outline },
    { key: "dots", label: "Light dots", type: "check", def: true },
    { key: "wobble", label: "Hand wobble mm", type: "slider", min: 0, max: 1.5, step: 0.05, def: 0.25 },
    { key: "minStroke", label: "Min stroke mm", type: "slider", min: 0, max: 10, step: 0.5, def: 2 },
    { key: "outlinePen", label: "Outline pen", type: "pen", def: 0 },
    { key: "hatchPen", label: "Hatch pen", type: "pen", def: 1 },
    { key: "shadowPen", label: "Shadow pen", type: "pen", def: 2, showIf: p => !!p.cross },
    { key: "dotPen", label: "Dot pen", type: "pen", def: 3, showIf: p => !!p.dots },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 43 },
  ],
  overlay(p, ctx, ins, node) {
    if (!Number.isFinite(ctx?.W) || !Number.isFinite(ctx?.H)) return [];
    const m = Math.max(0, Math.min(60, Number(p.margin) || 0));
    const img = node?.data?.img;
    if (img?.w > 0 && img?.h > 0 && ctx.W > 2 * m && ctx.H > 2 * m) {
      const sc = Math.min((ctx.W - 2 * m) / img.w, (ctx.H - 2 * m) / img.h);
      const w = img.w * sc, h = img.h * sc;
      return [{ kind: "rect", x: (ctx.W - w) / 2, y: (ctx.H - h) / 2, w, h }];
    }
    return ctx.W > 2 * m && ctx.H > 2 * m ? [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }] : [];
  },
  compute(ins, p, ctx, node) {
    const empty = [{ paths: [] }, { paths: [] }, { paths: [] }, { paths: [] }, { paths: [] }];
    const img = node?.data?.img;
    const W = ctx?.W, H = ctx?.H;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0 ||
      !img || !Number.isInteger(img.w) || !Number.isInteger(img.h) || img.w < 2 || img.h < 2 ||
      img.w * img.h > 2560000 || !img.g || img.g.length !== img.w * img.h) return empty;
    const n = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : fallback;
    const margin = n(p.margin, 0, 60, 12);
    if (W - 2 * margin < 2 || H - 2 * margin < 2) return empty;
    const sc = Math.min((W - 2 * margin) / img.w, (H - 2 * margin) / img.h);
    const iw = img.w * sc, ih = img.h * sc, x0 = (W - iw) / 2, y0 = (H - ih) / 2;
    const x1 = x0 + iw, y1 = y0 + ih, area = iw * ih;
    const contrast = n(p.contrast, 0.5, 2.5, 1.25);
    const cutoff = n(p.cutoff, 0, 0.5, 0.18);
    const shadow = n(p.shadow, 0.35, 0.9, 0.62);
    const seed = Math.round(n(p.seed, -2147483648, 2147483647, 43));
    const pen = key => Math.round(n(p[key], 0, 11, 0));
    const outlinePen = pen("outlinePen"), hatchPen = pen("hatchPen"), shadowPen = pen("shadowPen"), dotPen = pen("dotPen");
    const minStroke = n(p.minStroke, 0, 10, 2);
    const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const dark = (x, y) => {
      if (!inside(x, y)) return 0;
      const u = Math.max(0, Math.min(img.w - 1, (x - x0) / sc - 0.5));
      const v = Math.max(0, Math.min(img.h - 1, (y - y0) / sc - 0.5));
      const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
      const at = (a, b) => { const q = Number(img.g[Math.min(img.h - 1, b) * img.w + Math.min(img.w - 1, a)]); return Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0; };
      const tone = at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
      return Math.max(0, Math.min(1, (tone - 0.5) * contrast + 0.5));
    };
    const outlines = [], hatching = [], shadows = [], dots = [];
    const pathLength = pts => pts.reduce((sum, q, i) => i ? sum + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : sum, 0);
    const pushStroke = (target, pts, layer) => {
      if (pts.length >= 2 && pathLength(pts) >= minStroke) target.push({ pts, closed: false, layer });
    };
    const reqPitch = n(p.spacing, 0.7, 8, 2.2);
    const passes = 2 + (p.cross ? 1 : 0);
    const pitch = Math.max(reqPitch, Math.sqrt(area * passes / (65000 * 0.75)));
    const step = Math.max(0.8, pitch * 0.75);
    const angle = n(p.angle, -90, 90, -35) * Math.PI / 180;
    const wobble = n(p.wobble, 0, 1.5, 0.25);
    const mode = ["Flow", "Straight", "Facets"].includes(p.mode) ? p.mode : "Flow";
    const bend = mode === "Flow" ? n(p.bend, 0, 10, 4) : 0;
    const centerX = (x0 + x1) / 2, centerY = (y0 + y1) / 2;
    const radius = Math.hypot(iw, ih) / 2 + bend + 2;
    const family = (a, offset, threshold, target, layer, familyId) => {
      const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      const count = Math.min(800, Math.ceil(2 * radius / pitch));
      const samples = Math.min(3000, Math.ceil(2 * radius / step));
      for (let i = 0; i <= count; i++) {
        const v = -radius + i * pitch + offset, jitter = (hash2(i + 31, familyId + 11, seed) - 0.5) * 0.08;
        let run = [];
        const flush = () => { pushStroke(target, run, layer); run = []; };
        for (let j = 0; j <= samples; j++) {
          const u = -radius + j * 2 * radius / samples;
          const bx = centerX + dx * u + nx * v, by = centerY + dy * u + ny * v;
          const tone = bend ? dark(bx, by) : 0;
          const edge = bend ? dark(bx + nx * 4, by + ny * 4) - dark(bx - nx * 4, by - ny * 4) : 0;
          const flow = bend * (0.6 * Math.sin(u / 19 + i * 0.16) * Math.sqrt(tone) + 0.9 * edge);
          const hand = wobble * (Math.sin(u * 0.19 + i * 1.31 + seed * 0.03) + 0.4 * Math.sin(u * 0.47 + i * 0.59 + seed * 0.07)) / 1.4;
          const x = bx + nx * (flow + hand), y = by + ny * (flow + hand);
          if (inside(x, y) && dark(x, y) >= threshold + jitter) run.push([x, y]);
          else flush();
        }
        flush();
      }
    };
    if (mode === "Facets") {
      const cell = Math.max(reqPitch * 1.5, Math.sqrt(area / 17000));
      const cols = Math.ceil(iw / cell), rows = Math.ceil(ih / cell);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const cx = x0 + (x + 0.5) * iw / cols, cy = y0 + (y + 0.5) * ih / rows;
        const tone = dark(cx, cy);
        if (tone <= cutoff) continue;
        const gx = dark(cx + cell * 0.4, cy) - dark(cx - cell * 0.4, cy);
        const gy = dark(cx, cy + cell * 0.4) - dark(cx, cy - cell * 0.4);
        const axis = Math.hypot(gx, gy) > 0.03 ? Math.atan2(gy, gx) + Math.PI / 2 : angle;
        const strokes = Math.min(3, Math.ceil((tone - cutoff) * 3.2));
        for (let k = 0; k < strokes; k++) {
          const h = hash2(x * 7 + k * 13, y * 11 + 2, seed);
          const v = hash2(x * 7 + k * 17, y * 11 + 5, seed);
          const px = cx + (h - 0.5) * cell * 0.55, py = cy + (v - 0.5) * cell * 0.55;
          const theta = axis + (hash2(x + k * 23, y + 9, seed) - 0.5) * 0.55;
          const len = cell * (0.45 + 0.35 * tone), ux = Math.cos(theta) * len / 2, uy = Math.sin(theta) * len / 2;
          if (inside(px - ux, py - uy) && inside(px + ux, py + uy)) pushStroke(hatching, [[px - ux, py - uy], [px + ux, py + uy]], hatchPen);
        }
      }
    } else {
      family(angle, 0, cutoff + 0.03, hatching, hatchPen, 1);
      family(angle, pitch / 2, cutoff + 0.27, hatching, hatchPen, 2);
    }
    if (p.cross) family(angle + Math.PI * 0.38, pitch / 3, shadow, shadows, shadowPen, 3);
    if (p.dots) {
      const dotPitch = Math.max(reqPitch * 1.7, Math.sqrt(area / 4000));
      const cols = Math.ceil(iw / dotPitch), rows = Math.ceil(ih / dotPitch);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const cx = x0 + (x + 0.5) * iw / cols, cy = y0 + (y + 0.5) * ih / rows;
        const tone = dark(cx, cy);
        if (tone <= cutoff * 0.75 || tone >= shadow) continue;
        const chance = 0.12 + 0.5 * Math.min(1, tone / Math.max(shadow, 0.01));
        if (hash2(x + 91, y + 27, seed) >= chance) continue;
        const r = Math.min(0.3, dotPitch * 0.1);
        if (cx - r < x0 || cx + r > x1 || cy - r < y0 || cy + r > y1) continue;
        dots.push({ pts: Array.from({ length: 6 }, (_, k) => [cx + r * Math.cos(k * Math.PI / 3), cy + r * Math.sin(k * Math.PI / 3)]), closed: true, layer: dotPen });
      }
    }
    if (p.outline) {
      const level = n(p.outlineTone, 0.2, 0.85, 0.46);
      const grid = Math.max(1.2, Math.sqrt(area / 30000));
      const nx = Math.max(2, Math.ceil(iw / grid)), ny = Math.max(2, Math.ceil(ih / grid));
      const val = new Float32Array((nx + 1) * (ny + 1));
      for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) val[y * (nx + 1) + x] = dark(x0 + x * iw / nx, y0 + y * ih / ny);
      const points = new Map(), links = new Map();
      const join = (a, b) => {
        if (!links.has(a)) links.set(a, []);
        if (!links.has(b)) links.set(b, []);
        links.get(a).push(b); links.get(b).push(a);
      };
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const a = val[y * (nx + 1) + x], b = val[y * (nx + 1) + x + 1];
        const c = val[(y + 1) * (nx + 1) + x + 1], d = val[(y + 1) * (nx + 1) + x];
        const e = [];
        const cross = (s, t) => (s >= level) !== (t >= level);
        const put = (id, px, py) => { e.push(id); points.set(id, [px, py]); };
        const lerp = (s, t) => Math.max(0, Math.min(1, (level - s) / (t - s)));
        if (cross(a, b)) put(`h:${x}:${y}`, x0 + (x + lerp(a, b)) * iw / nx, y0 + y * ih / ny);
        if (cross(b, c)) put(`v:${x + 1}:${y}`, x0 + (x + 1) * iw / nx, y0 + (y + lerp(b, c)) * ih / ny);
        if (cross(d, c)) put(`h:${x}:${y + 1}`, x0 + (x + lerp(d, c)) * iw / nx, y0 + (y + 1) * ih / ny);
        if (cross(a, d)) put(`v:${x}:${y}`, x0 + x * iw / nx, y0 + (y + lerp(a, d)) * ih / ny);
        if (e.length === 2) join(e[0], e[1]);
        else if (e.length === 4) {
          const highCenter = (a + b + c + d) / 4 >= level;
          if (highCenter) { join(e[0], e[1]); join(e[2], e[3]); }
          else { join(e[0], e[3]); join(e[1], e[2]); }
        }
      }
      const visited = new Set(), edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
      const trace = start => {
        const pts = [], first = start;
        let at = start, closed = false;
        for (let count = 0; count < 40000; count++) {
          pts.push(points.get(at));
          const next = (links.get(at) || []).find(q => !visited.has(edgeKey(at, q)));
          if (!next) break;
          visited.add(edgeKey(at, next));
          at = next;
          if (at === first) { closed = true; break; }
        }
        if (pts.length >= (closed ? 3 : 2) && pathLength(pts) >= minStroke && pts.every(q => q && inside(q[0], q[1])))
          outlines.push({ pts, closed, layer: outlinePen });
      };
      for (const [key, adjacent] of links) if (adjacent.length === 1 && adjacent.some(q => !visited.has(edgeKey(key, q)))) trace(key);
      for (const [key, adjacent] of links) if (adjacent.some(q => !visited.has(edgeKey(key, q)))) trace(key);
    }
    const artwork = applyStyle({ paths: [...outlines, ...hatching, ...shadows, ...dots] }, ins[0]);
    return [artwork, { paths: outlines }, { paths: hatching }, { paths: shadows }, { paths: dots }];
  },
};
