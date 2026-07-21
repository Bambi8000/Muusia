/* Muusia shared node helpers - extracted from App.jsx (Era C0) */
export const PENS_DEFAULT = [
  { name: "Black", c: "#23242A" }, { name: "Blue", c: "#2A56A8" },
  { name: "Red", c: "#C23A30" }, { name: "Green", c: "#1F7A48" },
  { name: "Orange", c: "#D2761E" }, { name: "Purple", c: "#6C42A6" },
  { name: "Teal", c: "#1F8A80" }, { name: "Magenta", c: "#C2408F" },
  { name: "Brown", c: "#7A4A2B" }, { name: "Gray", c: "#7D828C" },
  { name: "Ochre", c: "#B8952E" }, { name: "Sky", c: "#3E9BD6" },
];
export const PENS = PENS_DEFAULT.map((p) => ({ ...p }));
try {
  const saved = JSON.parse(localStorage.getItem("muusia-pens") || "null");
  if (Array.isArray(saved)) saved.forEach((q, i) => {
    if (i < PENS.length && q && typeof q.c === "string" && /^#[0-9a-fA-F]{6}$/.test(q.c)) {
      PENS[i].c = q.c;
      if (typeof q.name === "string" && q.name.trim()) PENS[i].name = String(q.name).slice(0, 16);
    }
  });
} catch (e) { /* private mode / file:// quirks: fall back to defaults */ }
export function savePens() { try { localStorage.setItem("muusia-pens", JSON.stringify(PENS)); } catch (e) {} }
export function resetPens() { PENS.forEach((p, i) => { p.c = PENS_DEFAULT[i].c; p.name = PENS_DEFAULT[i].name; }); savePens(); }

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

export function pathLength(pts, closed) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return L;
}

export function resample(pts, closed, step) {
  if (pts.length < 2) return pts.slice();
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [src[0].slice()];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    let [x0, y0] = src[i - 1], [x1, y1] = src[i];
    let seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg === 0) continue;
    let t = (step - carry) / seg;
    while (t <= 1) { out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); t += step / seg; }
    carry = (carry + seg) % step;
  }
  if (!closed) {
    const last = src[src.length - 1], ol = out[out.length - 1];
    if (Math.hypot(last[0] - ol[0], last[1] - ol[1]) > 0.01) out.push(last.slice());
  }
  return out;
}

export function applyStyle(ps, st) {
  if (!isStyle(st) || st.mode === "Solid") return ps;
  const out = [];
  const DOT = 0.14;
  ps.paths.forEach((path, pi) => {
    const pts = resample(path.pts, path.closed, 0.6);
    if (pts.length < 2) return;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1];
    if (L <= 0) return;
    let ptr = 0;
    const pointAt = (d) => {
      while (ptr < cum.length - 2 && cum[ptr + 1] < d) ptr++;
      while (ptr > 0 && cum[ptr] > d) ptr--;
      const seg = cum[ptr + 1] - cum[ptr] || 1;
      const t = (d - cum[ptr]) / seg;
      return [pts[ptr][0] + (pts[ptr + 1][0] - pts[ptr][0]) * t, pts[ptr][1] + (pts[ptr + 1][1] - pts[ptr][1]) * t];
    };
    const rng = mulberry32((st.seed || 0) * 131 + pi * 977 + 5);
    let d = st.phase || 0, alt = 0, guard = 0;
    while (d < L && guard++ < 5000) {
      let on;
      if (st.mode === "Dashed") on = Math.max(0.1, st.dash * (1 + (rng() - 0.5) * 2 * st.vary));
      else if (st.mode === "Dots") on = DOT;
      else on = alt % 2 === 0 ? Math.max(0.1, st.dash * (1 + (rng() - 0.5) * 2 * st.vary)) : DOT;
      const end = Math.min(d + on, L);
      const seg = [];
      const steps = Math.max(1, Math.ceil((end - d) / 0.6));
      ptr = 0;
      for (let s = 0; s <= steps; s++) seg.push(pointAt(d + ((end - d) * s) / steps));
      out.push({ pts: seg, closed: false, layer: path.layer });
      d = end + Math.max(0.1, st.gap * (1 + (rng() - 0.5) * st.vary));
      alt++;
    }
  });
  return { paths: out };
}

export function parseSVG(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("SVG parse failed");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("No svg element");
  const colors = [];
  const colorIdx = (c) => {
    if (!c || c === "none" || c === "inherit") return 0;
    let i = colors.indexOf(c);
    if (i < 0) { colors.push(c); i = colors.length - 1; }
    return i;
  };
  const paths = [];
  const circlePts = (cx, cy, rx, ry, m) => {
    const pts = [];
    const n = Math.min(96, Math.max(16, Math.ceil(Math.max(rx, ry))));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(mApply(m, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
    }
    return pts;
  };
  function walk(el, m, color) {
    for (const ch of Array.from(el.children)) {
      const tag = ch.tagName.toLowerCase();
      const cm = mMul(m, parseTransform(ch.getAttribute("transform")));
      const stroke = ch.getAttribute("stroke");
      const fill = ch.getAttribute("fill");
      const col = (stroke && stroke !== "none" ? stroke : null) || (fill && fill !== "none" ? fill : null) || color;
      const A = (a, d) => { const v = ch.getAttribute(a); return v === null ? d : parseFloat(v); };
      if (tag === "g" || tag === "svg") walk(ch, cm, col);
      else if (tag === "path") {
        for (const sub of parsePathD(ch.getAttribute("d") || "")) {
          paths.push({ pts: sub.pts.map(([x, y]) => mApply(cm, x, y)), closed: sub.closed, colorIdx: colorIdx(col) });
        }
      } else if (tag === "line") {
        paths.push({ pts: [mApply(cm, A("x1", 0), A("y1", 0)), mApply(cm, A("x2", 0), A("y2", 0))], closed: false, colorIdx: colorIdx(col) });
      } else if (tag === "rect") {
        const x = A("x", 0), y = A("y", 0), w = A("width", 0), h = A("height", 0);
        paths.push({
          pts: [mApply(cm, x, y), mApply(cm, x + w, y), mApply(cm, x + w, y + h), mApply(cm, x, y + h)],
          closed: true, colorIdx: colorIdx(col),
        });
      } else if (tag === "circle") {
        paths.push({ pts: circlePts(A("cx", 0), A("cy", 0), A("r", 0), A("r", 0), cm), closed: true, colorIdx: colorIdx(col) });
      } else if (tag === "ellipse") {
        paths.push({ pts: circlePts(A("cx", 0), A("cy", 0), A("rx", 0), A("ry", 0), cm), closed: true, colorIdx: colorIdx(col) });
      } else if (tag === "polyline" || tag === "polygon") {
        const raw = (ch.getAttribute("points") || "").split(/[\s,]+/).filter(Boolean).map(Number);
        const pts = [];
        for (let i = 0; i + 1 < raw.length; i += 2) pts.push(mApply(cm, raw[i], raw[i + 1]));
        if (pts.length > 1) paths.push({ pts, closed: tag === "polygon", colorIdx: colorIdx(col) });
      }
    }
  }
  walk(svg, M_ID, null);
  if (!paths.length) throw new Error("No paths in SVG");
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) for (const [x, y] of p.pts) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return { paths, bbox: { x: minX, y: minY, w: Math.max(0.01, maxX - minX), h: Math.max(0.01, maxY - minY) }, colors };
}

export function signedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  return a / 2;
}

export function fontStrokes(str, size, track) {
  const sc = size / 10;
  const tr = track || 1;
  const out = [];
  let x = 0;
  for (const ch of String(str).toUpperCase()) {
    const g = SFONT[ch] || SFONT[" "];
    for (const stroke of g.s) {
      if (stroke.length < 2) continue;
      out.push(stroke.map(([gx, gy]) => [x + gx * sc, gy * sc]));
    }
    x += (g.w + 2) * sc * tr;
  }
  return { strokes: out, width: x };
}

export const EMPTY = { paths: [] };

export const Pin = (type, label) => ({ type, label });

export const SFONT = {
  "A": { w: 9, s: [[[0,10],[4,0],[8,10]], [[1.6,6],[6.4,6]]] },
  "B": { w: 9, s: [[[0,10],[0,0],[6,0],[7.5,1.5],[7.5,3.5],[6,5],[0,5]], [[6,5],[7.5,6.5],[7.5,8.5],[6,10],[0,10]]] },
  "C": { w: 9, s: [[[8,1.5],[6,0],[2,0],[0,2],[0,8],[2,10],[6,10],[8,8.5]]] },
  "D": { w: 9, s: [[[0,10],[0,0],[5,0],[8,3],[8,7],[5,10],[0,10]]] },
  "E": { w: 8, s: [[[7,0],[0,0],[0,10],[7,10]], [[0,5],[5.5,5]]] },
  "F": { w: 8, s: [[[7,0],[0,0],[0,10]], [[0,5],[5.5,5]]] },
  "G": { w: 9, s: [[[8,1.5],[6,0],[2,0],[0,2],[0,8],[2,10],[6,10],[8,8],[8,5],[4.5,5]]] },
  "H": { w: 9, s: [[[0,0],[0,10]], [[8,0],[8,10]], [[0,5],[8,5]]] },
  "I": { w: 3, s: [[[1.5,0],[1.5,10]]] },
  "J": { w: 7, s: [[[6,0],[6,8],[4,10],[2,10],[0,8.5]]] },
  "K": { w: 9, s: [[[0,0],[0,10]], [[8,0],[0,6]], [[2.7,4],[8,10]]] },
  "L": { w: 7, s: [[[0,0],[0,10],[7,10]]] },
  "M": { w: 10, s: [[[0,10],[0,0],[4.5,7],[9,0],[9,10]]] },
  "N": { w: 9, s: [[[0,10],[0,0],[8,10],[8,0]]] },
  "O": { w: 9, s: [[[2,0],[6,0],[8,2],[8,8],[6,10],[2,10],[0,8],[0,2],[2,0]]] },
  "P": { w: 9, s: [[[0,10],[0,0],[6,0],[8,2],[8,3.5],[6,5.5],[0,5.5]]] },
  "Q": { w: 9, s: [[[2,0],[6,0],[8,2],[8,8],[6,10],[2,10],[0,8],[0,2],[2,0]], [[5,7],[8.6,10.6]]] },
  "R": { w: 9, s: [[[0,10],[0,0],[6,0],[8,2],[8,3.5],[6,5.5],[0,5.5]], [[4,5.5],[8,10]]] },
  "S": { w: 9, s: [[[8,1.5],[6,0],[2,0],[0,1.8],[0,3.2],[2,5],[6,5],[8,6.8],[8,8.2],[6,10],[2,10],[0,8.5]]] },
  "T": { w: 8, s: [[[0,0],[8,0]], [[4,0],[4,10]]] },
  "U": { w: 9, s: [[[0,0],[0,8],[2,10],[6,10],[8,8],[8,0]]] },
  "V": { w: 9, s: [[[0,0],[4,10],[8,0]]] },
  "W": { w: 11, s: [[[0,0],[2.5,10],[5,2.5],[7.5,10],[10,0]]] },
  "X": { w: 9, s: [[[0,0],[8,10]], [[8,0],[0,10]]] },
  "Y": { w: 9, s: [[[0,0],[4,5],[8,0]], [[4,5],[4,10]]] },
  "Z": { w: 9, s: [[[0,0],[8,0],[0,10],[8,10]]] },
  "0": { w: 9, s: [[[2,0],[6,0],[8,2],[8,8],[6,10],[2,10],[0,8],[0,2],[2,0]], [[1,8.5],[7,1.5]]] },
  "1": { w: 5, s: [[[0,2],[2.5,0],[2.5,10]], [[0.5,10],[4.5,10]]] },
  "2": { w: 9, s: [[[0,2],[2,0],[6,0],[8,2],[8,3.5],[0,10],[8,10]]] },
  "3": { w: 9, s: [[[0,1.5],[2,0],[6,0],[8,1.8],[8,3.2],[6,5],[3,5]], [[6,5],[8,6.8],[8,8.5],[6,10],[2,10],[0,8.5]]] },
  "4": { w: 9, s: [[[6,10],[6,0],[0,7],[8,7]]] },
  "5": { w: 9, s: [[[7.5,0],[0.5,0],[0,4.5],[2,4],[6,4],[8,6],[8,8],[6,10],[2,10],[0,8.5]]] },
  "6": { w: 9, s: [[[7.5,1.5],[5.5,0],[2.5,0],[0,2.5],[0,8],[2,10],[6,10],[8,8],[8,6.5],[6,4.8],[2,4.8],[0,6.5]]] },
  "7": { w: 9, s: [[[0,0],[8,0],[3,10]]] },
  "8": { w: 9, s: [[[2,0],[6,0],[7.5,1.5],[7.5,3.5],[6,5],[2,5],[0.5,3.5],[0.5,1.5],[2,0]], [[2,5],[6,5],[8,6.5],[8,8.5],[6,10],[2,10],[0,8.5],[0,6.5],[2,5]]] },
  "9": { w: 9, s: [[[0.5,8.5],[2.5,10],[5.5,10],[8,7.5],[8,2],[6,0],[2,0],[0,2],[0,3.5],[2,5.2],[6,5.2],[8,3.5]]] },
  " ": { w: 6, s: [] },
  ".": { w: 3, s: [[[1,9.3],[1.8,9.3],[1.8,10],[1,10],[1,9.3]]] },
  ",": { w: 3, s: [[[1.8,9],[1.8,10],[0.7,11.6]]] },
  "-": { w: 7, s: [[[0.8,5],[6,5]]] },
  ":": { w: 3, s: [[[1,3],[1.8,3],[1.8,3.7],[1,3.7],[1,3]], [[1,9.3],[1.8,9.3],[1.8,10],[1,10],[1,9.3]]] },
  "!": { w: 3, s: [[[1.4,0],[1.4,7]], [[1,9.3],[1.8,9.3],[1.8,10],[1,10],[1,9.3]]] },
  "?": { w: 8, s: [[[0,2],[2,0],[5.5,0],[7.5,2],[7.5,3.5],[4,6],[4,7.2]], [[3.6,9.3],[4.4,9.3],[4.4,10],[3.6,10],[3.6,9.3]]] },
  "'": { w: 3, s: [[[1.4,0],[1.4,3]]] },
  "(": { w: 5, s: [[[3.5,-0.5],[1.5,2],[1.5,8],[3.5,10.5]]] },
  ")": { w: 5, s: [[[0.5,-0.5],[2.5,2],[2.5,8],[0.5,10.5]]] },
  "+": { w: 8, s: [[[3.8,2],[3.8,8]], [[0.8,5],[6.8,5]]] },
  "/": { w: 7, s: [[[0,10],[6,0]]] },
  "Ä": { w: 9, s: [[[0,10],[4,0],[8,10]], [[1.6,6],[6.4,6]], [[2,-2.4],[2,-1.6]], [[6,-2.4],[6,-1.6]]] },
  "Ö": { w: 9, s: [[[2,0],[6,0],[8,2],[8,8],[6,10],[2,10],[0,8],[0,2],[2,0]], [[2,-2.4],[2,-1.6]], [[6,-2.4],[6,-1.6]]] },
  "Å": { w: 9, s: [[[0,10],[4,0],[8,10]], [[1.6,6],[6.4,6]], [[3.2,-2.6],[4.8,-2.6],[4.8,-1.2],[3.2,-1.2],[3.2,-2.6]]] },
};

export function isStyle(v) { return v && v.kind === "style"; }
