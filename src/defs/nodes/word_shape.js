import { Pin, EMPTY, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "word_shape", name: "Word Shape", cat: "gen", group: "textimg",
  desc: "Make shapes from words. Shorten rows creates the ABRACADABRA triangle: the complete text, then one fewer character on each centred row. Eight built-in silhouettes also include Triangle up, Diamond, Hourglass, Circle, Heart, Square and Hexagon. Repeat text fills available rows; Whole words keeps every word intact. Connect closed paths to Shape: Auto uses them at their actual canvas coordinates, including even-odd holes and disconnected pieces. Inside places complete letters inside the region; Outside fills the surrounding margin area and leaves the shape blank. Nothing is clipped through a letter. Wired shape explicitly requires closed paths; empty Auto input uses the preset. Fit text reduces Letter height to fit the requested row count. Built-in shortened rows use Width/Height as a fitting box. Other layouts flow through the actual region. Plotter and Serif use real capital pen strokes, including ÄÖÅ; unsupported characters become ?. Clearance protects each complete character box, including accents and serifs. Dense requests are refused whole at 2500 letters / 100000 points rather than losing the end of the text. Guides never export. Search: word, shape, concrete poetry, calligram, sana, muoto, kolmio.",
  ins: [Pin("paths", "Shape (closed paths)"), Pin("style", "Style")],
  outs: [Pin("paths", "Text")],
  params: [
    { key: "text", label: "Text", type: "text", def: "ABRACADABRA" },
    { key: "source", label: "Shape source", type: "select", options: ["Auto", "Built-in", "Wired shape"], def: "Auto" },
    { key: "shape", label: "Shape", type: "select", options: ["Triangle down", "Triangle up", "Diamond", "Hourglass", "Circle", "Heart", "Square", "Hexagon"], def: "Triangle down", showIf: p => p.source !== "Wired shape" },
    { key: "placement", label: "Place text", type: "select", options: ["Inside", "Outside"], def: "Inside" },
    { key: "mode", label: "Text mode", type: "select", options: ["Shorten rows", "Repeat text", "Whole words"], def: "Shorten rows" },
    { key: "trim", label: "Remove letters from", type: "select", options: ["End", "Start", "Both sides"], def: "End", showIf: p => p.mode === "Shorten rows" },
    { key: "font", label: "Font", type: "select", options: ["Plotter", "Serif"], def: "Serif" },
    { key: "width", label: "Built-in width mm", type: "slider", min: 10, max: 400, step: 1, def: 160, showIf: p => p.source !== "Wired shape" },
    { key: "height", label: "Built-in height mm", type: "slider", min: 10, max: 400, step: 1, def: 170, showIf: p => p.source !== "Wired shape" },
    { key: "autoRows", label: "Rows from text", type: "check", def: true },
    { key: "rows", label: "Rows", type: "slider", min: 2, max: 120, step: 1, def: 18, showIf: p => !p.autoRows },
    { key: "fit", label: "Fit text", type: "check", def: true },
    { key: "size", label: "Letter height mm", type: "slider", min: 1, max: 40, step: 0.5, def: 18 },
    { key: "tracking", label: "Letter spacing", type: "slider", min: 1, max: 3, step: 0.05, def: 1.35 },
    { key: "lineSpacing", label: "Row spacing", type: "slider", min: 1, max: 3, step: 0.05, def: 1.5 },
    { key: "align", label: "Row alignment", type: "select", options: ["Center", "Left", "Right"], def: "Center" },
    { key: "clearance", label: "Clearance mm", type: "slider", min: 0, max: 10, step: 0.25, def: 0.5 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  _prepare(p, ctx, input) {
    const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : d));
    const W = num(ctx?.W, 0, 0, 100000), H = num(ctx?.H, 0, 0, 100000), m = num(p.margin, 12, 0, 100000);
    const gap = num(p.clearance, 0.5, 0, 100), outside = p.placement === "Outside";
    if (W - 2 * (m + gap) < 1 || H - 2 * (m + gap) < 1) return null;
    const source = Array.isArray(input?.paths) ? input.paths : [], closed = source.filter(s => s.closed);
    let rings = [], wired = false, points = 0;
    if (p.source !== "Built-in" && closed.length) {
      wired = true;
      if (closed.length > 256) return null;
      for (const path of closed) {
        if (!Array.isArray(path.pts) || path.pts.length < 3 || path.pts.some(q => !Array.isArray(q) || !Number.isFinite(q[0]) || !Number.isFinite(q[1]))) return null;
        if (points + path.pts.length > 12000) return null;
        const pts = path.pts.map(q => q.slice(0, 2));
        if (pts.length > 3 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 1e-8) pts.pop();
        points += pts.length; if (pts.length < 3 || points > 12000) return null;
        rings.push(pts);
      }
    } else if (p.source === "Wired shape") return null;
    const bw = Math.min(num(p.width, 160, 1, 10000), W - 2 * (m + gap)), bh = Math.min(num(p.height, 170, 1, 10000), H - 2 * (m + gap));
    const box = { x0: (W - bw) / 2, y0: (H - bh) / 2, x1: (W + bw) / 2, y1: (H + bh) / 2 };
    if (!wired) {
      const shape = p.shape;
      let pts;
      if (shape === "Triangle up") pts = [[0, -1], [1, 1], [-1, 1]];
      else if (shape === "Diamond") pts = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      else if (shape === "Hourglass") pts = [[-1, -1], [1, -1], [0.09, 0], [1, 1], [-1, 1], [-0.09, 0]];
      else if (shape === "Circle") pts = Array.from({ length: 128 }, (_, i) => [Math.cos(i * Math.PI / 64), Math.sin(i * Math.PI / 64)]);
      else if (shape === "Heart") {
        pts = Array.from({ length: 160 }, (_, i) => { const t = i * Math.PI / 80; return [16 * Math.sin(t) ** 3 / 16, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2.5) / 15]; });
      } else if (shape === "Square") pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      else if (shape === "Hexagon") pts = [[-.5, -1], [.5, -1], [1, 0], [.5, 1], [-.5, 1], [-1, 0]];
      else pts = [[-1, -1], [1, -1], [0, 1]];
      // Normalise the heart too: its familiar parametric curve has unequal extents.
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), ax = Math.min(...xs), bx = Math.max(...xs), ay = Math.min(...ys), by = Math.max(...ys);
      rings = [pts.map(([x, y]) => [box.x0 + (x - ax) / (bx - ax) * bw, box.y0 + (y - ay) / (by - ay) * bh])];
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const edges = [];
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]);
      if (a[0] !== b[0] || a[1] !== b[1]) edges.push([a, b]);
    }
    if (!edges.length || x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return null;
    const region = outside ? { x0: m, y0: m, x1: W - m, y1: H - m } : { x0: Math.max(m, x0), y0: Math.max(m, y0), x1: Math.min(W - m, x1), y1: Math.min(H - m, y1) };
    if (region.x1 <= region.x0 || region.y1 <= region.y0) return null;
    return { W, H, m, gap, outside, wired, rings, edges, region, box, num };
  },
  _layout(p, ctx, input) {
    const G = this._prepare(p, ctx, input); if (!G) return null;
    const { num, edges, gap, outside } = G;
    const text = Array.from(String(p.text ?? "").normalize("NFC").toUpperCase().replace(/[|\s]+/g, " ").trim()).map(c => SFONT[c] ? c : "?");
    if (!text.length || text.length > 240) return null;
    // Add small authored terminal serifs to the shared single-stroke capitals.
    const glyphs = new Map();
    for (const c of new Set(text.concat([" "]))) {
      const g = SFONT[c], strokes = g.s.map(s => s.map(q => [...q]));
      if (p.font === "Serif" && c !== " ") for (const stroke of g.s) {
        for (const end of [0, stroke.length - 1]) {
          const q = stroke[end], next = stroke[end ? end - 1 : 1];
          if ((q[1] === 0 || q[1] === 10) && Math.abs(q[1] - next[1]) > 0.5) strokes.push([[q[0] - .65, q[1]], [q[0] + .65, q[1]]]);
        }
      }
      const unique = new Map();
      for (const stroke of strokes) { const a = JSON.stringify(stroke), b = JSON.stringify([...stroke].reverse()); unique.set(a < b ? a : b, stroke); }
      glyphs.set(c, [...unique.values()]);
    }
    const all = [...glyphs.values()].flat(2);
    const minX = Math.min(0, ...all.map(q => q[0])), maxX = Math.max(8, ...all.map(q => q[0]));
    const minY = Math.min(0, ...all.map(q => q[1])), maxY = Math.max(10, ...all.map(q => q[1]));
    const gw = (maxX - minX) / 10, gh = (maxY - minY) / 10;
    const track = num(p.tracking, 1.35, 1, 5), lineSpace = num(p.lineSpacing, 1.5, 1, 5);
    const stepped = !G.wired && !outside && p.mode === "Shorten rows";
    const double = p.shape === "Diamond" || p.shape === "Hourglass";
    const rows = p.autoRows ? Math.min(160, double && !G.wired && !outside ? text.length * 2 - 1 : text.length) : Math.round(num(p.rows, 18, 1, 160));
    const R = stepped ? G.box : G.region;
    let size = num(p.size, 18, 0.2, 200);
    const fitColumns = p.mode === "Whole words" ? Math.max(...text.join("").split(" ").map(w => w.length)) : p.mode === "Repeat text" ? 1 : text.length;
    if (p.fit) size = Math.min(size, Math.max(.001, (R.x1 - R.x0 - 2 * gap) / (gw * (1 + (fitColumns - 1) * track))), Math.max(.001, (R.y1 - R.y0 - 2 * gap) / (gh * (1 + (rows - 1) * lineSpace))));
    if (size < 0.2) return null;
    const cell = gw * size, advance = cell * track, letterH = gh * size, pitch = letterH * lineSpace;
    const totalH = letterH + (rows - 1) * pitch;
    if (stepped && (totalH + 2 * gap > R.y1 - R.y0 + 1e-7 || cell + (text.length - 1) * advance + 2 * gap > R.x1 - R.x0 + 1e-7)) return null;
    const yStart = (R.y0 + R.y1 - totalH) / 2;
    if (rows * Math.max(1, Math.ceil((R.x1 - R.x0) / advance)) > 5000 || rows * edges.length > 1000000) return null;
    const placements = [], lines = [];
    let work = 0, rowEdges = edges;
    const inside = (x, y) => {
      let hit = false;
      for (const [a, b] of rowEdges) if ((a[1] > y) !== (b[1] > y) && x < a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])) hit = !hit;
      return hit;
    };
    const intersectsBox = (a, b, x0, y0, x1, y1) => {
      let lo = 0, hi = 1;
      for (const [start, d, min, max] of [[a[0], b[0] - a[0], x0, x1], [a[1], b[1] - a[1], y0, y1]]) {
        if (Math.abs(d) < 1e-12) { if (start <= min || start >= max) return false; }
        else { let t0 = (min - start) / d, t1 = (max - start) / d; if (t0 > t1) [t0, t1] = [t1, t0]; lo = Math.max(lo, t0); hi = Math.min(hi, t1); if (hi <= lo + 1e-10) return false; }
      }
      return hi > lo + 1e-10;
    };
    const validBox = (x, y) => {
      const x0 = x - gap + 1e-7, x1 = x + cell + gap - 1e-7, y0 = y - gap + 1e-7, y1 = y + letterH + gap - 1e-7;
      if (x0 < G.m - 1e-6 || y0 < G.m - 1e-6 || x1 > G.W - G.m + 1e-6 || y1 > G.H - G.m + 1e-6) return false;
      if (stepped) return true;
      work += rowEdges.length;
      if (work > 5000000 || inside((x0 + x1) / 2, (y0 + y1) / 2) === outside) return false;
      for (const [a, b] of rowEdges) { if (++work > 5000000) return false; if (Math.max(a[0], b[0]) <= x0 || Math.min(a[0], b[0]) >= x1 || Math.max(a[1], b[1]) <= y0 || Math.min(a[1], b[1]) >= y1) continue; if (intersectsBox(a, b, x0, y0, x1, y1)) return false; }
      return true;
    };
    const cut = n => {
      n = Math.min(n, text.length); const start = p.trim === "Start" ? text.length - n : p.trim === "Both sides" ? Math.floor((text.length - n) / 2) : 0;
      return text.slice(start, start + n);
    };
    let cursor = 0, wordIndex = 0;
    const words = text.join("").split(" ").map(w => Array.from(w));
    for (let row = 0; row < rows; row++) {
      const y = yStart + row * pitch;
      rowEdges = stepped ? [] : edges.filter(([a, b]) => Math.max(a[1], b[1]) >= y - gap && Math.min(a[1], b[1]) <= y + letterH + gap);
      let intervals = [];
      if (stepped) {
        const t = rows === 1 ? .5 : row / (rows - 1);
        let fraction = 1;
        if (p.shape === "Triangle down") fraction = (rows - row) / rows;
        else if (p.shape === "Triangle up") fraction = (row + 1) / rows;
        else if (p.shape === "Diamond") fraction = Math.min(row + 1, rows - row) / Math.ceil(rows / 2);
        else if (p.shape === "Hourglass") fraction = (Math.abs(row - (rows - 1) / 2) + 1) / ((rows - 1) / 2 + 1);
        else if (p.shape === "Circle") fraction = Math.sqrt(Math.max(0, 1 - ((row + .5) / rows * 2 - 1) ** 2));
        else if (p.shape === "Heart") fraction = t < .22 ? .72 + t / .22 * .28 : Math.max(.05, 1 - ((t - .22) / .78) ** 1.1);
        else if (p.shape === "Hexagon") fraction = Math.min(1, .5 + Math.min(t, 1 - t) * 2);
        const n = Math.max(1, Math.min(text.length, Math.round(fraction * text.length)));
        const width = cell + (text.length - 1) * advance, cx = (R.x0 + R.x1) / 2;
        intervals = [[cx - width / 2, cx + width / 2, n]];
        if (p.shape === "Heart" && t < .22 && text.length >= 4) {
          const count = Math.max(1, Math.round(text.length * (.28 + .1 * t / .22)));
          const lobe = cell + (count - 1) * advance, offset = width * .26;
          intervals = [[cx - offset - lobe / 2, cx - offset + lobe / 2, count], [cx + offset - lobe / 2, cx + offset + lobe / 2, count]];
        }
      } else {
        // Intersect horizontal sections through the whole letter-height band.
        // Final box/edge checks also handle overlapping contours and tiny holes.
        const y0 = y - gap, y1 = y + letterH + gap;
        const levels = new Set([y0 + 1e-7, y1 - 1e-7, (y0 + y1) / 2]);
        for (const edge of rowEdges) for (const q of edge) if (q[1] > y0 && q[1] < y1) { levels.add(q[1] - 1e-7); levels.add(q[1] + 1e-7); }
        let spans = [[R.x0 + gap, R.x1 - gap]];
        for (const v of levels) {
          work += rowEdges.length; if (work > 5000000) return null;
          const xs = [];
          for (const [a, b] of rowEdges) if ((a[1] > v) !== (b[1] > v)) xs.push(a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]));
          xs.sort((a, b) => a - b); const sections = [];
          if (outside) { let a = G.m; for (let i = 0; i + 1 < xs.length; i += 2) { sections.push([a, xs[i]]); a = xs[i + 1]; } sections.push([a, G.W - G.m]); }
          else for (let i = 0; i + 1 < xs.length; i += 2) sections.push([xs[i], xs[i + 1]]);
          const next = [];
          for (const [a, b] of spans) for (const [c, d] of sections) { const left = Math.max(a, c + gap), right = Math.min(b, d - gap); if (right - left >= cell - 1e-7) next.push([left, right]); }
          spans = next; if (!spans.length) break;
        }
        intervals = spans.map(([a, b]) => [a, b, Math.max(0, Math.floor((b - a - cell + 1e-7) / advance) + 1)]);
      }
      for (const [a, b, capacity] of intervals) {
        if (!capacity) continue;
        let chars; const wordStart = wordIndex;
        if (p.mode === "Repeat text") {
          const stream = text.concat([" "]); chars = Array.from({ length: capacity }, () => stream[cursor++ % stream.length]);
        } else if (p.mode === "Whole words") {
          chars = []; let tries = 0;
          while (tries++ <= words.length + capacity) {
            const word = words[wordIndex % words.length];
            if (word.length > capacity) break;
            if (chars.length + (chars.length ? 1 : 0) + word.length > capacity) break;
            if (chars.length) chars.push(" "); chars.push(...word); wordIndex++;
          }
        } else chars = cut(capacity);
        if (!chars?.length) continue;
        const width = cell + (chars.length - 1) * advance;
        const x0 = p.align === "Left" ? a : p.align === "Right" ? b - width : (a + b - width) / 2;
        const boxes = chars.map((_, i) => [x0 + i * advance, y]);
        // Whole-word rows are accepted as units so an edge cannot eat a letter.
        if (p.mode === "Whole words" && boxes.some(([x, y]) => !validBox(x, y))) { wordIndex = wordStart; continue; }
        const accepted = [];
        chars.forEach((c, i) => {
          const [x, y] = boxes[i];
          if (c === " " || validBox(x, y)) { placements.push({ c, x, y, w: cell, h: letterH, row }); accepted.push(c); }
        });
        lines.push({ row, text: accepted.join(""), x: x0, y });
      }
      if (placements.length > 2500 || work > 5000000) return null;
    }
    return { ...G, placements, lines, glyphs, size, minX, minY, cell, letterH, rows, stepped };
  },
  overlay(p, ctx, ins) {
    const G = this._prepare(p, ctx, ins?.[0]); if (!G) return [];
    // Stepped words describe a typographic silhouette, not a clipping polygon.
    if (!G.wired && p.placement !== "Outside" && p.mode === "Shorten rows") return [{ kind: "rect", x: G.box.x0, y: G.box.y0, w: G.box.x1 - G.box.x0, h: G.box.y1 - G.box.y0 }];
    return [{ kind: "rect", x: G.m, y: G.m, w: G.W - 2 * G.m, h: G.H - 2 * G.m }, ...G.rings.map(pts => ({ kind: "poly", pts: [...pts, pts[0]] }))];
  },
  compute(ins, p, ctx) {
    const L = this._layout(p, ctx, ins?.[0]); if (!L) return EMPTY;
    const layer = Math.round(L.num(p.layer, 0, 0, 11)), paths = [];
    let count = 0;
    for (const { c, x, y } of L.placements) for (const stroke of L.glyphs.get(c)) {
      if (stroke.length < 2) continue;
      const glyphXs = L.glyphs.get(c).flat().map(q => q[0]);
      const offset = (L.cell * 10 / L.size - (Math.max(...glyphXs) - Math.min(...glyphXs))) / 2 - Math.min(...glyphXs);
      const pts = stroke.map(([gx, gy]) => [x + (gx + offset) * L.size / 10, y + (gy - L.minY) * L.size / 10]);
      const closed = pts.length > 3 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 1e-7;
      if (closed) pts.pop(); count += pts.length; if (count > 100000) return EMPTY;
      paths.push({ pts, closed, layer });
    }
    return applyStyle({ paths }, ins?.[1]);
  },
};
