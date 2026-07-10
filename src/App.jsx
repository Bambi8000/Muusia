import React, { useState, useRef, useMemo, useEffect } from "react";

/* ============================================================
   MUUSIA v1.8
   - Nodejen minimointi (esikatselu/parametrit piiloon)
   - Param-portit samoilla riveillä kuin faderit (mitatut ankkurit)
   - Esc / nappi: tyhjennä monivalinta
   - Johdon irrotus: tartu sisääntuloporttiin (raahaa pois = poista)
   - Grid: viivojen määrät suoraan
   - Pensselin pyöritys: koneprofiilissa (MANUAL_STEPPER suunnasta)
   - Kasto: huoltopiste canvasin ulkopuolella, matkaväli-laukaisu
   ============================================================ */

/* ---------- Design tokens ---------- */
const T = {
  bg: "#171A20", panel: "#1E222B", panel2: "#232834", line: "#2C3240",
  text: "#CBD1DE", dim: "#828BA0", accent: "#5B8DEF",
  paper: "#F6F2E7", paperLine: "#E4DECE", group: "#E0B341",
  value: "#45C4A0", style: "#B07CE8",
};
const PENS = [
  { name: "Black", c: "#23242A" }, { name: "Blue", c: "#2A56A8" },
  { name: "Red", c: "#C23A30" }, { name: "Green", c: "#1F7A48" },
  { name: "Orange", c: "#D2761E" }, { name: "Purple", c: "#6C42A6" },
];

const mono = "'IBM Plex Mono','SFMono-Regular',Consolas,monospace";
const disp = "'Space Grotesk','Segoe UI',sans-serif";

const TYPE_COLOR = { paths: T.accent, value: T.value, style: T.style };

/* ---------- RNG + noise ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, seed) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/* ---------- Path helpers ---------- */
const EMPTY = { paths: [] };
function pathLength(pts, closed) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return L;
}
function resample(pts, closed, step) {
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
function totalStats(ps) {
  let n = 0, pts = 0, L = 0;
  for (const p of ps.paths) { n++; pts += p.pts.length; L += pathLength(p.pts, p.closed); }
  return { n, pts, L };
}
function pointInMask(ps, x, y) {
  let inside = false;
  for (const p of ps.paths) {
    const pts = p.pts;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/* ---------- Tyyli ---------- */
const SOLID_STYLE = { kind: "style", mode: "Solid" };
function isStyle(v) { return v && v.kind === "style"; }
function applyStyle(ps, st) {
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

/* ============================================================
   NODE-REKISTERI
   ============================================================ */
const GEN_GROUPS = {
  geometric:  "Geometric",
  organic:    "Organic & Flow",
  machines:   "Drawing Machines",
  nature:     "Nature",
  creatures:  "Creatures",
  space:      "Space",
  scientific: "Scientific",
  structural: "Structural",
  textimg:    "Text & Image",
};
const MOD_GROUPS = {
  transform: "Transform",
  deform:    "Deform",
  pathops:   "Path Ops",
  cutsplit:  "Cut & Split",
  fillstyle: "Fill & Style",
  penout:    "Pen & Output",
};
const CATS = {
  gen: { label: "Generators", color: "#5B8DEF" },
  mod: { label: "Modifiers", color: "#D2A21E" },
  dec: { label: "Decorators", color: "#4FBF8B" },
  duo: { label: "Combiners", color: "#C25CB0" },
  math: { label: "Math", color: "#45C4A0" },
  route: { label: "Routing", color: "#8B93A5" },
};
const Pin = (type, label) => ({ type, label });

/* ---------- SVG-jäsennys (import-nodea varten) ---------- */
const M_ID = [1, 0, 0, 1, 0, 0];
function mMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
function mApply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
function parseTransform(str) {
  let m = M_ID;
  if (!str) return m;
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let t;
  while ((t = re.exec(str))) {
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    const f = t[1];
    if (f === "translate") m = mMul(m, [1, 0, 0, 1, a[0] || 0, a[1] || 0]);
    else if (f === "scale") m = mMul(m, [a[0] || 1, 0, 0, a[1] !== undefined ? a[1] : a[0] || 1, 0, 0]);
    else if (f === "rotate") {
      const r = ((a[0] || 0) * Math.PI) / 180, cx = a[1] || 0, cy = a[2] || 0;
      m = mMul(m, [1, 0, 0, 1, cx, cy]);
      m = mMul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
      m = mMul(m, [1, 0, 0, 1, -cx, -cy]);
    } else if (f === "matrix" && a.length === 6) m = mMul(m, a);
  }
  return m;
}
function flattenCubic(p0, p1, p2, p3, out) {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
  const n = Math.min(64, Math.max(4, Math.ceil(len / 2)));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}
function flattenQuad(p0, p1, p2, out) {
  flattenCubic(p0,
    [p0[0] + (2 / 3) * (p1[0] - p0[0]), p0[1] + (2 / 3) * (p1[1] - p0[1])],
    [p2[0] + (2 / 3) * (p1[0] - p2[0]), p2[1] + (2 / 3) * (p1[1] - p2[1])],
    p2, out);
}
function flattenArc(p0, rx, ry, rotDeg, laf, sf, p1, out) {
  /* W3C endpoint -> center -parametrisointi */
  if (rx === 0 || ry === 0) { out.push(p1); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180;
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1 = Math.cos(phi) * dx + Math.sin(phi) * dy;
  const y1 = -Math.sin(phi) * dx + Math.cos(phi) * dy;
  let l = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let co = Math.sqrt(Math.max(0, num / den));
  if (laf === sf) co = -co;
  const cxp = (co * rx * y1) / ry, cyp = (-co * ry * x1) / rx;
  const cx = Math.cos(phi) * cxp - Math.sin(phi) * cyp + (p0[0] + p1[0]) / 2;
  const cy = Math.sin(phi) * cxp + Math.cos(phi) * cyp + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy, vx, vy) => {
    const d = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, (ux * vx + uy * vy) / d)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const th1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dth = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sf && dth > 0) dth -= 2 * Math.PI;
  if (sf && dth < 0) dth += 2 * Math.PI;
  const n = Math.min(96, Math.max(4, Math.ceil(Math.abs(dth) * Math.max(rx, ry) / 2)));
  for (let i = 1; i <= n; i++) {
    const th = th1 + (dth * i) / n;
    out.push([
      cx + rx * Math.cos(phi) * Math.cos(th) - ry * Math.sin(phi) * Math.sin(th),
      cy + rx * Math.sin(phi) * Math.cos(th) + ry * Math.cos(phi) * Math.sin(th),
    ]);
  }
}
function parsePathD(d) {
  const tokens = d.match(/[a-zA-Z]|-?\.?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) || [];
  const subs = [];
  let pts = null, closed = false;
  let cx = 0, cy = 0, sx = 0, sy = 0, cmd = "", pcx = null, pcy = null, pqx = null, pqy = null;
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  const flush = () => { if (pts && pts.length > 1) subs.push({ pts, closed }); pts = null; closed = false; };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M") {
      flush();
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      cx = sx = x; cy = sy = y;
      pts = [[x, y]];
      cmd = rel ? "l" : "L";
      pcx = pcy = pqx = pqy = null;
    } else if (C === "L") {
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      pts && pts.push([x, y]); cx = x; cy = y; pcx = pqx = null;
    } else if (C === "H") {
      let x = num(); if (rel) x += cx;
      pts && pts.push([x, cy]); cx = x; pcx = pqx = null;
    } else if (C === "V") {
      let y = num(); if (rel) y += cy;
      pts && pts.push([cx, y]); cy = y; pcx = pqx = null;
    } else if (C === "C" || C === "S") {
      let x1, y1;
      if (C === "C") { x1 = num(); y1 = num(); if (rel) { x1 += cx; y1 += cy; } }
      else { x1 = pcx !== null ? 2 * cx - pcx : cx; y1 = pcy !== null ? 2 * cy - pcy : cy; }
      let x2 = num(), y2 = num(), x = num(), y = num();
      if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
      pts && flattenCubic([cx, cy], [x1, y1], [x2, y2], [x, y], pts);
      pcx = x2; pcy = y2; pqx = null; cx = x; cy = y;
    } else if (C === "Q" || C === "T") {
      let x1, y1;
      if (C === "Q") { x1 = num(); y1 = num(); if (rel) { x1 += cx; y1 += cy; } }
      else { x1 = pqx !== null ? 2 * cx - pqx : cx; y1 = pqy !== null ? 2 * cy - pqy : cy; }
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      pts && flattenQuad([cx, cy], [x1, y1], [x, y], pts);
      pqx = x1; pqy = y1; pcx = null; cx = x; cy = y;
    } else if (C === "A") {
      const rx = num(), ry = num(), rot = num(), laf = num(), sf = num();
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      pts && flattenArc([cx, cy], rx, ry, rot, laf, sf, [x, y], pts);
      pcx = pqx = null; cx = x; cy = y;
    } else if (C === "Z") {
      closed = true; cx = sx; cy = sy;
      flush();
    } else { i++; }
  }
  flush();
  return subs;
}
function parseSVG(text) {
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
function signedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  return a / 2;
}

/* reitin optimointi: nearest-neighbor, valinnainen suunnan sailytys */
function routeOptimize(ps, preserve) {
  const rem = ps.paths.map((pa) => pa);
  const out = [];
  let cx = 0, cy = 0;
  while (rem.length) {
    let bi = 0, bflip = false, bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const s = rem[i].pts[0], e = rem[i].pts[rem[i].pts.length - 1];
      const ds = Math.hypot(s[0] - cx, s[1] - cy);
      if (ds < bd) { bd = ds; bi = i; bflip = false; }
      if (!preserve && !rem[i].closed) {
        const de = Math.hypot(e[0] - cx, e[1] - cy);
        if (de < bd) { bd = de; bi = i; bflip = true; }
      }
    }
    const pick = rem.splice(bi, 1)[0];
    const path = bflip ? { ...pick, pts: [...pick.pts].reverse() } : pick;
    out.push(path);
    const last = path.closed ? path.pts[0] : path.pts[path.pts.length - 1];
    cx = last[0]; cy = last[1];
  }
  return { paths: out };
}

const SFONT = {
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

/* yksiviivafontin renderointi: palauttaa vedot origossa (y 0..10 -ruudukko skaalattuna) */
function fontStrokes(str, size, track) {
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

const DEFS = {
  grid: {
    name: "Grid", cat: "gen", group: "geometric", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "vlines", label: "Vertical lines", type: "slider", min: 0, max: 60, step: 1, def: 13 },
      { key: "hlines", label: "Horizontal lines", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "res", label: "Resolution mm", type: "slider", min: 0.5, max: 10, step: 0.5, def: 2 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const x0 = p.margin, y0 = p.margin, x1 = W - p.margin, y1 = H - p.margin;
      const paths = [];
      const line = (ax, ay, bx, by) => {
        const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / p.res));
        const pts = [];
        for (let i = 0; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
        paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      };
      const hN = Math.round(p.hlines), vN = Math.round(p.vlines);
      for (let r = 0; r < hN; r++) {
        const y = hN === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * r) / (hN - 1);
        line(x0, y, x1, y);
      }
      for (let c = 0; c < vN; c++) {
        const x = vN === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * c) / (vN - 1);
        line(x, y0, x, y1);
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  radat: {
    name: "Tracks", cat: "gen", group: "geometric", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "rings", label: "Loops", type: "slider", min: 1, max: 30, step: 1, def: 10 },
      { key: "gap", label: "Gap mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "wob", label: "Shape noise", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "drift", label: "Drift", type: "slider", min: 0, max: 20, step: 0.5, def: 4 },
      { key: "seed", label: "Seed", type: "seed", def: 7 },
      { key: "layer", label: "Pen", type: "pen", def: 1 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) / 2 - 8;
      const paths = [];
      for (let r = 0; r < p.rings; r++) {
        const base = maxR - r * p.gap;
        if (base < 3) break;
        const ox = (noise2(r * 0.7, 0.3, p.seed) - 0.5) * 2 * p.drift * (r / Math.max(1, p.rings));
        const oy = (noise2(0.3, r * 0.7, p.seed + 9) - 0.5) * 2 * p.drift * (r / Math.max(1, p.rings));
        const N = Math.max(24, Math.floor(base * 1.2));
        const pts = [];
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          const wob = (noise2(Math.cos(a) * 1.3 + r * 0.31, Math.sin(a) * 1.3, p.seed + 40) - 0.5) * 2 * p.wob;
          const rr = base + wob;
          pts.push([cx + ox + Math.cos(a) * rr * (W / Math.min(W, H)) * 0.9, cy + oy + Math.sin(a) * rr]);
        }
        paths.push({ pts, closed: true, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  flow: {
    name: "Flow Field", cat: "gen", group: "organic", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Trails", type: "slider", min: 5, max: 300, step: 5, def: 80 },
      { key: "steps", label: "Length", type: "slider", min: 10, max: 300, step: 5, def: 90 },
      { key: "scale", label: "Field scale", type: "slider", min: 0.005, max: 0.08, step: 0.005, def: 0.02 },
      { key: "curl", label: "Curl", type: "slider", min: 0.5, max: 4, step: 0.25, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 2 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1013 + 77);
      const paths = [];
      for (let k = 0; k < p.count; k++) {
        let x = p.margin + rng() * (W - 2 * p.margin);
        let y = p.margin + rng() * (H - 2 * p.margin);
        const pts = [[x, y]];
        for (let s = 0; s < p.steps; s++) {
          const a = noise2(x * p.scale, y * p.scale, p.seed) * Math.PI * 2 * p.curl;
          x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6;
          if (x < p.margin || x > W - p.margin || y < p.margin || y > H - p.margin) break;
          pts.push([x, y]);
        }
        if (pts.length > 3) paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  truchet: {
    name: "Truchet", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Pattern", type: "select", options: ["Tiles", "Loop"], def: "Tiles" },
      { key: "ttype", label: "Tile type", type: "select", options: ["Arcs", "Diagonals"], def: "Arcs" },
      { key: "tile", label: "Tile mm", type: "slider", min: 4, max: 60, step: 1, def: 15 },
      { key: "scale", label: "Scale %", type: "slider", min: 10, max: 400, step: 1, def: 100 },
      { key: "lines", label: "Lines per tile", type: "slider", min: 1, max: 6, step: 1, def: 1 },
      { key: "spread", label: "Line spread %", type: "slider", min: 10, max: 100, step: 1, def: 100 },
      { key: "gapmm", label: "Arc gap mm", type: "slider", min: 0, max: 8, step: 0.1, def: 0 },
      { key: "round", label: "Corner radius % (loop)", type: "slider", min: 10, max: 100, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 9 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const t = Math.max(1.5, p.tile * (p.scale / 100));
      const L = Math.round(p.layer);

      /* ---------- LOOP: yksi suljettu kieppi (virittävä puu -> kiertoreitti) ---------- */
      if (p.mode === "Loop") {
        const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
        const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
        const s = t / 2; /* alihilan askel */
        const ox = (W - cols * t) / 2 + t / 4;
        const oy = (H - rows * t) / 2 + t / 4;
        const rng = mulberry32(p.seed * 811 + 3);
        /* virittava puu solujen ylitse (satunnainen DFS) */
        const visited = new Set();
        const treeH = new Set(); /* "i,j" = reuna (i,j)-(i+1,j) */
        const treeV = new Set(); /* "i,j" = reuna (i,j)-(i,j+1) */
        const stack = [[Math.floor(rng() * cols), Math.floor(rng() * rows)]];
        visited.add(stack[0][0] + "," + stack[0][1]);
        while (stack.length) {
          const [ci, cj] = stack[stack.length - 1];
          const nbrs = [];
          if (ci > 0 && !visited.has((ci - 1) + "," + cj)) nbrs.push([ci - 1, cj, "H", ci - 1, cj]);
          if (ci < cols - 1 && !visited.has((ci + 1) + "," + cj)) nbrs.push([ci + 1, cj, "H", ci, cj]);
          if (cj > 0 && !visited.has(ci + "," + (cj - 1))) nbrs.push([ci, cj - 1, "V", ci, cj - 1]);
          if (cj < rows - 1 && !visited.has(ci + "," + (cj + 1))) nbrs.push([ci, cj + 1, "V", ci, cj]);
          if (!nbrs.length) { stack.pop(); continue; }
          const [ni, nj, kind, ei, ej] = nbrs[Math.floor(rng() * nbrs.length)];
          (kind === "H" ? treeH : treeV).add(ei + "," + ej);
          visited.add(ni + "," + nj);
          stack.push([ni, nj]);
        }
        /* alihilan reunat: joka solu pieni rengas, puun reunat leikkaa+liittaa renkaat yhdeksi */
        const edges = new Set();
        const ek = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
        const vk = (x, y) => x + "," + y;
        const addE = (x1, y1, x2, y2) => edges.add(ek(vk(x1, y1), vk(x2, y2)));
        const delE = (x1, y1, x2, y2) => edges.delete(ek(vk(x1, y1), vk(x2, y2)));
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const a = [2 * i, 2 * j], b = [2 * i + 1, 2 * j], c = [2 * i, 2 * j + 1], d = [2 * i + 1, 2 * j + 1];
          addE(...a, ...b); addE(...b, ...d); addE(...d, ...c); addE(...c, ...a);
        }
        for (const key of treeH) {
          const [i, j] = key.split(",").map(Number);
          delE(2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1);
          delE(2 * i + 2, 2 * j, 2 * i + 2, 2 * j + 1);
          addE(2 * i + 1, 2 * j, 2 * i + 2, 2 * j);
          addE(2 * i + 1, 2 * j + 1, 2 * i + 2, 2 * j + 1);
        }
        for (const key of treeV) {
          const [i, j] = key.split(",").map(Number);
          delE(2 * i, 2 * j + 1, 2 * i + 1, 2 * j + 1);
          delE(2 * i, 2 * j + 2, 2 * i + 1, 2 * j + 2);
          addE(2 * i, 2 * j + 1, 2 * i, 2 * j + 2);
          addE(2 * i + 1, 2 * j + 1, 2 * i + 1, 2 * j + 2);
        }
        /* jokaisen pisteen aste on 2 -> seuraa sykli */
        const adj = {};
        for (const e of edges) {
          const [a, b] = e.split("|");
          (adj[a] = adj[a] || []).push(b);
          (adj[b] = adj[b] || []).push(a);
        }
        const startK = vk(0, 0);
        const loop = [];
        let cur = startK, prev = null;
        for (let guard = 0; guard < edges.size + 2; guard++) {
          loop.push(cur);
          const nb = adj[cur] || [];
          const nxt = nb[0] === prev ? nb[1] : nb[0];
          if (nxt === undefined) break;
          prev = cur; cur = nxt;
          if (cur === startK) break;
        }
        const V = loop.map((k) => {
          const [x, y] = k.split(",").map(Number);
          return [ox + x * s, oy + y * s];
        });
        /* pyorista kulmat neljanneskaarilla -> truchet-ilme */
        const r = (s / 2) * (p.round / 100);
        const pts = [];
        const N = V.length;
        for (let i = 0; i < N; i++) {
          const v = V[i], pr = V[(i - 1 + N) % N], nx = V[(i + 1) % N];
          const d1 = [v[0] - pr[0], v[1] - pr[1]];
          const d2 = [nx[0] - v[0], nx[1] - v[1]];
          const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
          const u1 = [d1[0] / l1, d1[1] / l1], u2 = [d2[0] / l2, d2[1] / l2];
          const cross = u1[0] * u2[1] - u1[1] * u2[0];
          if (Math.abs(cross) < 0.01) { pts.push([v[0], v[1]]); continue; } /* suora jatkuu */
          const P1 = [v[0] - u1[0] * r, v[1] - u1[1] * r];
          const C = [P1[0] + u2[0] * r, P1[1] + u2[1] * r];
          const a1 = Math.atan2(P1[1] - C[1], P1[0] - C[0]);
          const sweep = (cross > 0 ? 1 : -1) * (Math.PI / 2);
          for (let k = 0; k <= 6; k++) {
            const a = a1 + (k / 6) * sweep;
            pts.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]);
          }
        }
        return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);
      }

      /* ---------- TILES: perinteinen truchet-laatoitus ---------- */
      const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
      const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
      const ox = (W - cols * t) / 2, oy = (H - rows * t) / 2;
      const paths = [];
      const nL = Math.round(p.lines);
      const spread = p.spread / 100;
      const arc = (cx, cy, a0) => {
        for (let m = 0; m < nL; m++) {
          const rr = t / 2 + ((m + 0.5) / nL - 0.5) * t * spread;
          if (rr <= 0.3) continue;
          const dA = Math.min(0.55, (p.gapmm / 2) / rr);
          const a1 = a0 + dA, a2 = a0 + Math.PI / 2 - dA;
          if (a2 <= a1) continue;
          const pts = [];
          for (let i = 0; i <= 12; i++) {
            const a = a1 + (i / 12) * (a2 - a1);
            pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
          }
          paths.push({ pts, closed: false, layer: L });
        }
      };
      const diag = (x0, y0, kind) => {
        for (let m = 0; m < nL; m++) {
          const o = ((m + 0.5) / nL - 0.5) * t * spread;
          let A, B;
          if (kind === "\\") {
            A = o >= 0 ? [x0 + o, y0] : [x0, y0 - o];
            B = o >= 0 ? [x0 + t, y0 + t - o] : [x0 + t + o, y0 + t];
          } else {
            A = o >= 0 ? [x0 + t - o, y0] : [x0 + t, y0 - o];
            B = o >= 0 ? [x0, y0 + t - o] : [x0 - o, y0 + t];
          }
          const dx = B[0] - A[0], dy = B[1] - A[1];
          const len = Math.hypot(dx, dy);
          const g2 = p.gapmm / 2;
          if (len > p.gapmm + 0.5) {
            A = [A[0] + (dx / len) * g2, A[1] + (dy / len) * g2];
            B = [B[0] - (dx / len) * g2, B[1] - (dy / len) * g2];
            paths.push({ pts: [A, B], closed: false, layer: L });
          }
        }
      };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x0 = ox + c * t, y0 = oy + r * t;
        const flip = hash2(c, r, p.seed) > 0.5;
        if (p.ttype === "Arcs") {
          if (flip) { arc(x0, y0, 0); arc(x0 + t, y0 + t, Math.PI); }
          else { arc(x0 + t, y0, Math.PI / 2); arc(x0, y0 + t, -Math.PI / 2); }
        } else {
          diag(x0, y0, flip ? "\\" : "/");
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  lissajous: {
    name: "Lissajous", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "fx", label: "Freq X", type: "slider", min: 1, max: 16, step: 1, def: 3 },
      { key: "fy", label: "Freq Y", type: "slider", min: 1, max: 16, step: 1, def: 4 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 1.57 },
      { key: "turns", label: "Turns", type: "slider", min: 1, max: 60, step: 1, def: 8 },
      { key: "damp", label: "Damping", type: "slider", min: 0, max: 0.05, step: 0.001, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 1 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const Ax = W / 2 - p.margin, Ay = H / 2 - p.margin;
      const cx = W / 2, cy = H / 2;
      const N = Math.min(12000, Math.round(p.turns * 220));
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns * Math.PI * 2;
        const e = Math.exp(-p.damp * t);
        pts.push([cx + Ax * Math.sin(p.fx * t + p.phase) * e, cy + Ay * Math.sin(p.fy * t) * e]);
      }
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  },

  phyllo: {
    name: "Phyllotaxis", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Count", type: "slider", min: 10, max: 1500, step: 10, def: 400 },
      { key: "c", label: "Spacing c", type: "slider", min: 0.5, max: 8, step: 0.1, def: 2.5 },
      { key: "angle", label: "Angle °", type: "slider", min: 100, max: 180, step: 0.1, def: 137.5 },
      { key: "mode", label: "Mode", type: "select", options: ["Dots", "Spiral"], def: "Dots" },
      { key: "dotR", label: "Dot size mm", type: "slider", min: 0.2, max: 6, step: 0.1, def: 1 },
      { key: "layer", label: "Pen", type: "pen", def: 2 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) / 2 - 8;
      const golden = (p.angle * Math.PI) / 180;
      const paths = [];
      const centers = [];
      for (let i = 0; i < p.count; i++) {
        const r = p.c * Math.sqrt(i);
        if (r > maxR) break;
        const a = i * golden;
        centers.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      if (p.mode === "Spiral") {
        if (centers.length > 1) paths.push({ pts: centers, closed: false, layer: Math.round(p.layer) });
      } else {
        for (const [x, y] of centers) {
          const pts = [];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            pts.push([x + Math.cos(a) * (p.dotR / 2), y + Math.sin(a) * (p.dotR / 2)]);
          }
          paths.push({ pts, closed: true, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  lsystem: {
    name: "L-System", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "preset", label: "Preset", type: "select", options: ["Koch", "Dragon", "Plant", "Sierpinski", "Hilbert", "Lightning", "Custom"], def: "Plant" },
      { key: "axiom", label: "Axiom (custom)", type: "text", def: "F" },
      { key: "rules", label: "Rules (custom)", type: "text", def: "F=F+F--F+F" },
      { key: "iter", label: "Iterations / detail", type: "slider", min: 1, max: 8, step: 1, def: 4 },
      { key: "angle", label: "Angle ° (custom/branch)", type: "slider", min: 1, max: 120, step: 0.5, def: 60 },
      { key: "jitter", label: "Jitter / roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "branches", label: "Branches (lightning)", type: "slider", min: 0, max: 15, step: 1, def: 6 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 37 },
      { key: "layer", label: "Pen", type: "pen", def: 3 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1889 + 7);

      /* ---- Lightning: keskipiste-siirto + haarautuva salama ---- */
      if (p.preset === "Lightning") {
        const rough = Math.max(0.05, p.jitter || 0.35);
        const bolt = (x0, y0, x1, y1, detail) => {
          let pts = [[x0, y0], [x1, y1]];
          for (let d = 0; d < detail; d++) {
            const next = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
              const a = pts[i - 1], b = pts[i];
              const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
              const dx = b[0] - a[0], dy = b[1] - a[1];
              const len = Math.hypot(dx, dy) || 1;
              const off = (rng() - 0.5) * 2 * len * rough * 0.55;
              next.push([mx + (-dy / len) * off, my + (dx / len) * off]);
              next.push(b);
            }
            pts = next;
          }
          return pts;
        };
        const detail = Math.min(8, Math.max(3, Math.round(p.iter) + 2));
        const topX = W * (0.35 + rng() * 0.3);
        const botX = W * (0.25 + rng() * 0.5);
        const main = bolt(topX, p.margin, botX, H - p.margin, detail);
        const paths = [{ pts: main, closed: false, layer: Math.round(p.layer) }];
        const nBr = Math.round(p.branches);
        for (let b = 0; b < nBr; b++) {
          /* haara ylemmästä 2/3:sta, suunta paakolarin mukaan +- kulma */
          const i = 2 + Math.floor(rng() * (main.length * 0.66));
          if (i >= main.length - 1) continue;
          const S = main[i];
          const dx = main[i + 1][0] - main[i - 1][0], dy = main[i + 1][1] - main[i - 1][1];
          const base = Math.atan2(dy, dx);
          const sign = rng() > 0.5 ? 1 : -1;
          const a = base + sign * ((p.angle + (rng() - 0.5) * 20) * Math.PI) / 180;
          const len = (H - p.margin - S[1]) * (0.2 + rng() * 0.35);
          if (len < 5) continue;
          const E = [S[0] + Math.cos(a) * len, S[1] + Math.sin(a) * Math.abs(len)];
          const br = bolt(S[0], S[1], E[0], E[1], Math.max(2, detail - 2));
          paths.push({ pts: br, closed: false, layer: Math.round(p.layer) });
          /* pieni ala-haara puolella todennakoisyydella */
          if (rng() > 0.5 && br.length > 4) {
            const j = 1 + Math.floor(rng() * (br.length - 2));
            const S2 = br[j];
            const a2 = a + (rng() > 0.5 ? 1 : -1) * ((p.angle * 0.7) * Math.PI) / 180;
            const len2 = len * (0.25 + rng() * 0.3);
            if (len2 > 4) {
              const E2 = [S2[0] + Math.cos(a2) * len2, S2[1] + Math.sin(a2) * Math.abs(len2)];
              paths.push({ pts: bolt(S2[0], S2[1], E2[0], E2[1], Math.max(2, detail - 3)), closed: false, layer: Math.round(p.layer) });
            }
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---- tavalliset L-systeemit (jitter = stokastinen turtle) ---- */
      const PRESETS = {
        Koch: { axiom: "F", rules: "F=F+F--F+F", angle: 60 },
        Dragon: { axiom: "FX", rules: "X=X+YF+;Y=-FX-Y", angle: 90 },
        Plant: { axiom: "X", rules: "X=F+[[X]-X]-F[-FX]+X;F=FF", angle: 25 },
        Sierpinski: { axiom: "F-G-G", rules: "F=F-G+F+G-F;G=GG", angle: 120 },
        Hilbert: { axiom: "A", rules: "A=-BF+AFA+FB-;B=+AF-BFB-FA+", angle: 90 },
      };
      const cfg = p.preset === "Custom"
        ? { axiom: p.axiom || "F", rules: p.rules || "", angle: p.angle }
        : PRESETS[p.preset];
      const ruleMap = {};
      for (const r of String(cfg.rules).split(";")) {
        const [k, v] = r.split("=");
        if (k && v !== undefined) ruleMap[k.trim()] = v.trim();
      }
      let s = cfg.axiom;
      for (let i = 0; i < Math.round(p.iter); i++) {
        let next = "";
        for (const ch of s) next += ruleMap[ch] !== undefined ? ruleMap[ch] : ch;
        if (next.length > 200000) break;
        s = next;
      }
      const rad0 = (cfg.angle * Math.PI) / 180;
      let x = 0, y = 0, a = -Math.PI / 2;
      const stack = [];
      const rawPaths = [];
      let cur = [[0, 0]];
      for (const ch of s) {
        if (ch === "F" || ch === "G") {
          const step = 1 + (p.jitter ? (rng() - 0.5) * p.jitter * 0.7 : 0);
          x += Math.cos(a) * step; y += Math.sin(a) * step;
          cur.push([x, y]);
        } else if (ch === "f") {
          if (cur.length > 1) rawPaths.push(cur);
          x += Math.cos(a); y += Math.sin(a);
          cur = [[x, y]];
        } else if (ch === "+" || ch === "-") {
          const jit = p.jitter ? 1 + (rng() - 0.5) * 2 * p.jitter : 1;
          a += (ch === "+" ? 1 : -1) * rad0 * jit;
        } else if (ch === "[") stack.push([x, y, a]);
        else if (ch === "]") {
          if (cur.length > 1) rawPaths.push(cur);
          const st = stack.pop();
          if (st) { x = st[0]; y = st[1]; a = st[2]; }
          cur = [[x, y]];
        }
      }
      if (cur.length > 1) rawPaths.push(cur);
      if (!rawPaths.length) return EMPTY;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pa of rawPaths) for (const [px, py] of pa) {
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const paths = rawPaths.map((pa) => ({
        pts: pa.map(([px, py]) => [px * sc + ox, py * sc + oy]),
        closed: false, layer: Math.round(p.layer),
      }));
      return applyStyle({ paths }, ins[0]);
    },
  },

  spiro: {
    name: "Spirograph", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "R", label: "Ring R", type: "slider", min: 10, max: 100, step: 1, def: 60 },
      { key: "r", label: "Gear r", type: "slider", min: 2, max: 90, step: 1, def: 21 },
      { key: "d", label: "Pen offset d", type: "slider", min: 0, max: 90, step: 0.5, def: 30 },
      { key: "kind", label: "Kind", type: "select", options: ["Hypotrochoid", "Epitrochoid"], def: "Hypotrochoid" },
      { key: "turns", label: "Turns", type: "slider", min: 1, max: 120, step: 1, def: 40 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 4 },
    ],
    compute(ins, p, ctx) {
      const N = Math.min(14000, Math.round(p.turns * 160));
      const raw = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns * Math.PI * 2;
        let x, y;
        if (p.kind === "Hypotrochoid") {
          const k = (p.R - p.r) / p.r;
          x = (p.R - p.r) * Math.cos(t) + p.d * Math.cos(k * t);
          y = (p.R - p.r) * Math.sin(t) - p.d * Math.sin(k * t);
        } else {
          const k = (p.R + p.r) / p.r;
          x = (p.R + p.r) * Math.cos(t) - p.d * Math.cos(k * t);
          y = (p.R + p.r) * Math.sin(t) - p.d * Math.sin(k * t);
        }
        raw.push([x, y]);
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  },

  pendulum: {
    name: "Pendulum", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "arms", label: "Arms", type: "slider", min: 1, max: 3, step: 1, def: 2 },
      { key: "r1", label: "Arm 1 radius", type: "slider", min: 1, max: 100, step: 0.5, def: 50 },
      { key: "f1", label: "Arm 1 freq", type: "slider", min: 0.1, max: 20, step: 0.01, def: 2 },
      { key: "r2", label: "Arm 2 radius", type: "slider", min: 0, max: 100, step: 0.5, def: 22 },
      { key: "f2", label: "Arm 2 freq", type: "slider", min: 0.1, max: 40, step: 0.01, def: 5.03 },
      { key: "r3", label: "Arm 3 radius", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
      { key: "f3", label: "Arm 3 freq", type: "slider", min: 0.1, max: 60, step: 0.01, def: 11.1 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 1.2 },
      { key: "couple", label: "Coupling", type: "slider", min: 0, max: 2, step: 0.02, def: 0.4 },
      { key: "damp", label: "Damping", type: "slider", min: 0, max: 1.2, step: 0.01, def: 0.25 },
      { key: "table", label: "Table rotation (rev)", type: "slider", min: -4, max: 4, step: 0.05, def: 0.5 },
      { key: "turns", label: "Duration (turns)", type: "slider", min: 2, max: 120, step: 1, def: 30 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* ketjutetut vaimenevat heilurivarret; kytkenta: varren taajuutta
         moduloi edellisen varren kulma -> aito vuorovaikutus.
         Pyoriva poyta kuten oikeissa piirtokoneissa. */
      const nArms = Math.round(p.arms);
      const R = [p.r1, p.r2, p.r3];
      const F = [p.f1, p.f2, p.f3];
      const N = Math.min(30000, Math.round(p.turns * 400));
      const raw = [];
      const th = [0, 0, 0];
      const dt = p.turns / N;
      let t = 0;
      for (let i = 0; i <= N; i++) {
        const e = Math.exp(-p.damp * t);
        let x = 0, y = 0, prevAng = 0;
        for (let a = 0; a < nArms; a++) {
          /* taajuusmodulaatio edellisen varren kulmalla */
          const fEff = F[a] * (a === 0 ? 1 : 1 + p.couple * Math.sin(prevAng) * 0.5);
          th[a] += 2 * Math.PI * fEff * dt;
          const ang = th[a] + (a === 1 ? p.phase : a === 2 ? p.phase / 2 : 0);
          x += R[a] * e * Math.cos(ang);
          y += R[a] * e * Math.sin(ang);
          prevAng = ang;
        }
        /* poydan pyoriminen */
        const ta = 2 * Math.PI * p.table * (t / p.turns);
        const ca = Math.cos(ta), sa = Math.sin(ta);
        raw.push([x * ca - y * sa, x * sa + y * ca]);
        t += dt;
      }
      /* sovita canvasille */
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  },

  cycloidm: {
    name: "Cycloid Machine", cat: "gen", group: "machines", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "gearDist", label: "Gear distance", type: "slider", min: 20, max: 150, step: 1, def: 60 },
      { key: "gearY", label: "Gears offset Y", type: "slider", min: 20, max: 160, step: 1, def: 85 },
      { key: "r1", label: "Crank 1 radius", type: "slider", min: 2, max: 50, step: 0.5, def: 15 },
      { key: "f1", label: "Crank 1 speed", type: "slider", min: -20, max: 20, step: 0.01, def: 3 },
      { key: "r2", label: "Crank 2 radius", type: "slider", min: 2, max: 50, step: 0.5, def: 21 },
      { key: "f2", label: "Crank 2 speed", type: "slider", min: -20, max: 20, step: 0.01, def: 5.02 },
      { key: "L1", label: "Rod 1 length", type: "slider", min: 20, max: 200, step: 0.5, def: 95 },
      { key: "L2", label: "Rod 2 length", type: "slider", min: 20, max: 200, step: 0.5, def: 82 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.01, def: 0.8 },
      { key: "table", label: "Table speed", type: "slider", min: -4, max: 4, step: 0.01, def: 0.13 },
      { key: "turns", label: "Duration (turns)", type: "slider", min: 2, max: 200, step: 1, def: 40 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* Cycloid Drawing Machine: kaksi kampea, kaksi nivelivartta -> kyna on
         varsiympyroiden leikkauspiste; paperi pyorii omalla poydallaan. */
      const G1 = [-p.gearDist / 2, p.gearY];
      const G2 = [p.gearDist / 2, p.gearY];
      const N = Math.min(40000, Math.round(p.turns * 420));
      const raw = [];
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * p.turns;
        const a1 = 2 * Math.PI * p.f1 * t;
        const a2 = 2 * Math.PI * p.f2 * t + p.phase;
        const P1 = [G1[0] + Math.cos(a1) * p.r1, G1[1] + Math.sin(a1) * p.r1];
        const P2 = [G2[0] + Math.cos(a2) * p.r2, G2[1] + Math.sin(a2) * p.r2];
        /* ympyroiden (P1,L1) ja (P2,L2) leikkaus */
        const dx = P2[0] - P1[0], dy = P2[1] - P1[1];
        const d = Math.hypot(dx, dy) || 1e-9;
        let pen;
        if (d >= p.L1 + p.L2) {
          /* varret suorassa: piste janan jatkeella suhteessa */
          const f = p.L1 / (p.L1 + p.L2);
          pen = [P1[0] + dx * f, P1[1] + dy * f];
        } else if (d <= Math.abs(p.L1 - p.L2)) {
          const f = p.L1 / Math.max(0.01, d);
          pen = [P1[0] + dx * f, P1[1] + dy * f];
        } else {
          const a = (p.L1 * p.L1 - p.L2 * p.L2 + d * d) / (2 * d);
          const h = Math.sqrt(Math.max(0, p.L1 * p.L1 - a * a));
          const mx = P1[0] + (dx / d) * a, my = P1[1] + (dy / d) * a;
          const c1 = [mx - (dy / d) * h, my + (dx / d) * h];
          const c2 = [mx + (dy / d) * h, my - (dx / d) * h];
          /* jatkuvuus: valitse edellista lahempi haara (alussa ylempi = kyna poydan puolella) */
          if (prev) {
            pen = Math.hypot(c1[0] - prev[0], c1[1] - prev[1]) <= Math.hypot(c2[0] - prev[0], c2[1] - prev[1]) ? c1 : c2;
          } else {
            pen = c1[1] < c2[1] ? c1 : c2;
          }
        }
        prev = pen;
        /* pyoriva poyta origossa: kyna paperin koordinaatistoon */
        const ta = -2 * Math.PI * p.table * t;
        const ca = Math.cos(ta), sa = Math.sin(ta);
        raw.push([pen[0] * ca - pen[1] * sa, pen[0] * sa + pen[1] * ca]);
      }
      /* sovita canvasille */
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of raw) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      const { W, H } = ctx;
      const sc = Math.min((W - 2 * p.margin) / Math.max(0.01, maxX - minX), (H - 2 * p.margin) / Math.max(0.01, maxY - minY));
      const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
      const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
      const pts = raw.map(([x, y]) => [x * sc + ox, y * sc + oy]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    },
  },

  interference: {
    name: "Contours", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "field", label: "Field", type: "select", options: ["Terrain (fBm)", "Waves"], def: "Terrain (fBm)" },
      { key: "scale", label: "Terrain scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
      { key: "octaves", label: "Octaves", type: "slider", min: 1, max: 5, step: 1, def: 4 },
      { key: "sources", label: "Wave sources", type: "slider", min: 2, max: 5, step: 1, def: 2 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 5, max: 80, step: 1, def: 24 },
      { key: "levels", label: "Contour levels", type: "slider", min: 2, max: 24, step: 1, def: 12 },
      { key: "res", label: "Resolution mm", type: "slider", min: 1, max: 5, step: 0.5, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 5 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 433 + 17);
      let f;
      if (p.field === "Waves") {
        const srcs = [];
        const nS = Math.round(p.sources);
        for (let i = 0; i < nS; i++) {
          srcs.push([p.margin + rng() * (W - 2 * p.margin), p.margin + rng() * (H - 2 * p.margin)]);
        }
        f = (x, y) => {
          let v = 0;
          for (const [sx, sy] of srcs) v += Math.sin((Math.hypot(x - sx, y - sy) / p.wl) * Math.PI * 2);
          return v;
        };
      } else {
        /* fBm-maasto: oktaaveittain summattu kohina -> korkeuskartta */
        const oct = Math.round(p.octaves);
        f = (x, y) => {
          let v = 0, amp = 1, fq = 1, tot = 0;
          for (let o = 0; o < oct; o++) {
            v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
            tot += amp; amp *= 0.5; fq *= 2;
          }
          return v / tot;
        };
      }
      /* marching squares + ketjutus */
      const step = Math.max(1, p.res);
      const x0 = p.margin, y0 = p.margin, x1 = W - p.margin, y1 = H - p.margin;
      const nx = Math.floor((x1 - x0) / step), ny = Math.floor((y1 - y0) / step);
      const grid = [];
      let vMin = Infinity, vMax = -Infinity;
      for (let j = 0; j <= ny; j++) {
        const row = [];
        for (let i = 0; i <= nx; i++) {
          const v = f(x0 + i * step, y0 + j * step);
          if (v < vMin) vMin = v;
          if (v > vMax) vMax = v;
          row.push(v);
        }
        grid.push(row);
      }
      const paths = [];
      for (let L = 1; L <= Math.round(p.levels); L++) {
        const iso = vMin + ((vMax - vMin) * L) / (Math.round(p.levels) + 1);
        const segs = [];
        const lerp = (va, vb, pa, pb) => {
          const t = (iso - va) / (vb - va || 1e-9);
          return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
        };
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const ax = x0 + i * step, ay = y0 + j * step;
          const v = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
          const P = [[ax, ay], [ax + step, ay], [ax + step, ay + step], [ax, ay + step]];
          let idx = 0;
          for (let k = 0; k < 4; k++) if (v[k] > iso) idx |= 1 << k;
          if (idx === 0 || idx === 15) continue;
          const E = (k) => lerp(v[k], v[(k + 1) % 4], P[k], P[(k + 1) % 4]);
          const CASES = {
            1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]],
            6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]],
            11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]],
          };
          for (const [ea, eb] of CASES[idx] || []) segs.push([E(ea), E(eb)]);
        }
        /* ketjuta segmentit polyviivoiksi */
        const key = (pt) => Math.round(pt[0] * 20) + "," + Math.round(pt[1] * 20);
        const adj = {};
        segs.forEach((s, i) => {
          for (const end of [0, 1]) {
            const k = key(s[end]);
            (adj[k] = adj[k] || []).push([i, end]);
          }
        });
        const used = new Array(segs.length).fill(false);
        for (let i = 0; i < segs.length; i++) {
          if (used[i]) continue;
          used[i] = true;
          let chain = [segs[i][0], segs[i][1]];
          let grow = true;
          while (grow) {
            grow = false;
            const k = key(chain[chain.length - 1]);
            for (const [si, se] of adj[k] || []) {
              if (used[si]) continue;
              used[si] = true;
              chain.push(segs[si][se === 0 ? 1 : 0]);
              grow = true;
              break;
            }
          }
          if (chain.length > 1) paths.push({ pts: chain, closed: false, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  circpack: {
    name: "Circle Packing", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "attempts", label: "Attempts", type: "slider", min: 50, max: 3000, step: 50, def: 800 },
      { key: "minR", label: "Min R mm", type: "slider", min: 0.5, max: 15, step: 0.25, def: 1.5 },
      { key: "maxR", label: "Max R mm", type: "slider", min: 2, max: 60, step: 0.5, def: 18 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 14 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 271 + 91);
      const circles = [];
      for (let a = 0; a < p.attempts; a++) {
        const x = p.margin + rng() * (W - 2 * p.margin);
        const y = p.margin + rng() * (H - 2 * p.margin);
        let r = Math.min(p.maxR, x - p.margin, W - p.margin - x, y - p.margin, H - p.margin - y);
        for (const c of circles) {
          const d = Math.hypot(x - c[0], y - c[1]) - c[2];
          if (d < r) r = d;
          if (r < p.minR) break;
        }
        if (r >= p.minR) circles.push([x, y, r]);
      }
      const paths = circles.map(([x, y, r]) => {
        const n = Math.min(64, Math.max(12, Math.ceil(r * 2.5)));
        const pts = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        return { pts, closed: true, layer: Math.round(p.layer) };
      });
      return applyStyle({ paths }, ins[0]);
    },
  },

  barcode: {
    name: "Barcode", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "orient", label: "Orientation", type: "select", options: ["Vertical bars", "Horizontal bars"], def: "Vertical bars" },
      { key: "barMin", label: "Bar min mm", type: "slider", min: 0.3, max: 20, step: 0.1, def: 0.8 },
      { key: "barMax", label: "Bar max mm", type: "slider", min: 0.5, max: 40, step: 0.1, def: 8 },
      { key: "gapMin", label: "Gap min mm", type: "slider", min: 0.3, max: 20, step: 0.1, def: 1 },
      { key: "gapMax", label: "Gap max mm", type: "slider", min: 0.5, max: 40, step: 0.1, def: 6 },
      { key: "fill", label: "Fill spacing mm", type: "slider", min: 0.2, max: 5, step: 0.05, def: 0.6 },
      { key: "hJit", label: "Height jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 719 + 29);
      const vert = p.orient === "Vertical bars";
      const along0 = p.margin, along1 = vert ? H - p.margin : W - p.margin; /* viivan suunta */
      const across0 = p.margin, across1 = vert ? W - p.margin : H - p.margin; /* palkkien etenemissuunta */
      const bMin = Math.min(p.barMin, p.barMax), bMax = Math.max(p.barMin, p.barMax);
      const gMin = Math.min(p.gapMin, p.gapMax), gMax = Math.max(p.gapMin, p.gapMax);
      const L = Math.round(p.layer);
      const paths = [];
      let x = across0;
      let flip = false; /* boustrophedon: joka toinen viiva vastakkaiseen suuntaan */
      let guard = 0;
      while (x < across1 - bMin && guard++ < 4000) {
        const w = Math.min(bMin + rng() * (bMax - bMin), across1 - x);
        /* korkeusjitter per palkki */
        const a0 = along0 + rng() * p.hJit * (along1 - along0) * 0.35;
        const a1 = along1 - rng() * p.hJit * (along1 - along0) * 0.35;
        const n = Math.max(1, Math.round(w / Math.max(0.2, p.fill)));
        const sp = n > 0 ? w / n : w;
        for (let k = 0; k <= n; k++) {
          const c = x + k * sp;
          const A = flip ? a1 : a0, B = flip ? a0 : a1;
          paths.push({
            pts: vert ? [[c, A], [c, B]] : [[A, c], [B, c]],
            closed: false, layer: L,
          });
          flip = !flip;
        }
        x += w + gMin + rng() * (gMax - gMin);
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  solids: {
    name: "Solids", cat: "gen", group: "space", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Shape", type: "select", options: ["Sphere", "Cube", "Tetrahedron", "Octahedron", "Icosahedron", "Dodecahedron"], def: "Sphere" },
      { key: "size", label: "Size mm", type: "slider", min: 10, max: 250, step: 1, def: 120 },
      { key: "rx", label: "Rotate X °", type: "slider", min: -180, max: 180, step: 1, def: -20 },
      { key: "ry", label: "Rotate Y °", type: "slider", min: -180, max: 180, step: 1, def: 30 },
      { key: "rz", label: "Rotate Z °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "lat", label: "Latitudes (sphere)", type: "slider", min: 3, max: 24, step: 1, def: 9 },
      { key: "lon", label: "Longitudes (sphere)", type: "slider", min: 4, max: 24, step: 1, def: 12 },
      { key: "sstyle", label: "Sphere style", type: "select", options: ["Solid (hide back)", "Transparent"], def: "Solid (hide back)" },
      { key: "px", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const r = p.size / 2;
      const cx = p.px, cy = p.py;
      /* rotaatio ZYX */
      const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180, az = (p.rz * Math.PI) / 180;
      const cX = Math.cos(ax), sX = Math.sin(ax);
      const cY = Math.cos(ay), sY = Math.sin(ay);
      const cZ = Math.cos(az), sZ = Math.sin(az);
      const rot = ([x, y, z]) => {
        let y1 = y * cX - z * sX, z1 = y * sX + z * cX;                 /* X */
        let x2 = x * cY + z1 * sY, z2 = -x * sY + z1 * cY;             /* Y */
        return [x2 * cZ - y1 * sZ, x2 * sZ + y1 * cZ, z2];             /* Z */
      };
      const camD = r * (6 - 4.8 * p.persp);
      const proj = ([x, y, z]) => {
        const f = p.persp > 0 ? camD / Math.max(camD * 0.2, camD + z) : 1;
        return [cx + x * f, cy + y * f];
      };
      const L = Math.round(p.layer);
      const paths = [];
      const PHI = (1 + Math.sqrt(5)) / 2;
      if (p.shape === "Sphere") {
        const emit = (ring3d) => {
          /* jaa nakyviin kaariin (takapinta piiloon) */
          let run = [];
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (const v of ring3d) {
            const R = rot(v);
            const visible = p.sstyle === "Transparent" || R[2] <= r * 0.02;
            if (visible) run.push(proj(R));
            else flush();
          }
          if (run.length === ring3d.length) paths.push({ pts: run, closed: true, layer: L });
          else flush();
        };
        const N = 72;
        for (let la = 1; la < Math.round(p.lat); la++) {
          const phi = (la / Math.round(p.lat)) * Math.PI;
          const rr = Math.sin(phi) * r, zz = Math.cos(phi) * r;
          const ring = [];
          for (let i = 0; i < N; i++) {
            const th = (i / N) * Math.PI * 2;
            ring.push([Math.cos(th) * rr, zz, Math.sin(th) * rr]);
          }
          emit(ring);
        }
        for (let lo = 0; lo < Math.round(p.lon); lo++) {
          const th = (lo / Math.round(p.lon)) * Math.PI;
          const ring = [];
          for (let i = 0; i < N; i++) {
            const phi = (i / N) * Math.PI * 2;
            ring.push([Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(th) * r]);
          }
          emit(ring);
        }
      } else {
        let V;
        if (p.shape === "Cube") {
          V = [];
          for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
        } else if (p.shape === "Tetrahedron") {
          V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
        } else if (p.shape === "Octahedron") {
          V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        } else if (p.shape === "Icosahedron") {
          V = [];
          for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
            V.push([0, s1, s2 * PHI]);
            V.push([s1, s2 * PHI, 0]);
            V.push([s2 * PHI, 0, s1]);
          }
        } else {
          V = [];
          for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
          for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
            V.push([0, s1 / PHI, s2 * PHI]);
            V.push([s1 / PHI, s2 * PHI, 0]);
            V.push([s2 * PHI, 0, s1 / PHI]);
          }
        }
        /* normalisoi sateeseen r */
        const maxL = Math.max(...V.map((v) => Math.hypot(v[0], v[1], v[2])));
        V = V.map((v) => [v[0] / maxL * r, v[1] / maxL * r, v[2] / maxL * r]);
        /* sarmat = lyhimman etaisyyden parit */
        let minD = Infinity;
        for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
          const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
          if (d < minD - 0.001) minD = d;
        }
        for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
          const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
          if (d < minD * 1.08) {
            paths.push({ pts: [proj(rot(V[i])), proj(rot(V[j]))], closed: false, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  mountains: {
    name: "Mountains", cat: "gen", group: "nature", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "rows", label: "Ridge lines", type: "slider", min: 8, max: 90, step: 1, def: 36 },
      { key: "height", label: "Height mm", type: "slider", min: 5, max: 150, step: 1, def: 55 },
      { key: "depth", label: "Depth mm", type: "slider", min: 20, max: 300, step: 1, def: 110 },
      { key: "scale", label: "Terrain scale", type: "slider", min: 0.004, max: 0.06, step: 0.001, def: 0.015 },
      { key: "octaves", label: "Octaves", type: "slider", min: 1, max: 5, step: 1, def: 4 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "skew", label: "Skew mm (oblique)", type: "slider", min: -80, max: 80, step: 1, def: 0 },
      { key: "fade", label: "Fade edges (island)", type: "check", def: true },
      { key: "cross", label: "Cross lines (mesh)", type: "check", def: false },
      { key: "res", label: "Resolution mm", type: "slider", min: 0.5, max: 4, step: 0.25, def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 51 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rows = Math.round(p.rows);
      const x0 = p.margin + Math.max(0, -p.skew), x1 = W - p.margin - Math.max(0, p.skew);
      const width = x1 - x0;
      if (width < 10) return EMPTY;
      const nx = Math.max(8, Math.floor(width / Math.max(0.4, p.res)));
      const oct = Math.round(p.octaves);
      const fbm = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < oct; o++) {
          v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
          tot += amp; amp *= 0.5; fq *= 2;
        }
        return v / tot;
      };
      const baseY = H - p.margin - 2;
      const L = Math.round(p.layer);
      const centerX = (x0 + x1) / 2;
      /* korkeus + reunahaivytys */
      const hAt = (u, rowT) => {
        let h = fbm(u * width * 2, rowT * p.depth * 2);
        h = Math.pow(h, 1.3);
        if (p.fade) {
          const ex = Math.min(1, Math.min(u, 1 - u) * 5);
          const ey = Math.min(1, Math.min(rowT, 1 - rowT) * 5);
          h *= ex * ex * (3 - 2 * ex) * (ey * ey * (3 - 2 * ey));
        }
        return h * p.height;
      };
      /* perspektiivi: rivit kapenevat ja tihenevat syvyyteen */
      const rowScale = (t) => 1 - 0.62 * p.persp * t;
      const rowYOff = (t) => p.depth * (t / (1 + p.persp * t * 1.15));
      /* piilotettu viiva: horisonttipuskuri RUUDUN x-sarakkeittain
         (toimii myos skew + perspektiivi -siirtymilla) */
      const binW = Math.max(0.4, p.res);
      const nBins = Math.ceil(W / binW) + 2;
      const horizon = new Array(nBins).fill(Infinity);
      const binOf = (sx) => Math.max(0, Math.min(nBins - 1, Math.round(sx / binW)));
      const rowPts = [];
      const paths = [];
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        const rowT = rIdx / Math.max(1, rows - 1);       /* 0 = edessa */
        const rs = rowScale(rowT);
        const sy0 = baseY - rowYOff(rowT);
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        const rowRec = [];
        for (let i = 0; i <= nx; i++) {
          const u = i / nx;
          const sx = centerX + (u - 0.5) * width * rs + p.skew * rowT;
          const sy = sy0 - hAt(u, rowT) * rs;
          const b = binOf(sx);
          const vis = sy < horizon[b] - 0.05;
          rowRec.push([sx, sy, vis]);
          if (vis) {
            run.push([sx, sy]);
            if (sy < horizon[b]) horizon[b] = sy;
          } else flush();
        }
        flush();
        rowPts.push(rowRec);
      }
      if (p.cross) {
        const step = Math.max(1, Math.round((rowStep / Math.max(0.4, p.res)) * 0.9));
        for (let i = 0; i <= nx; i += Math.max(2, Math.round(nx / 60))) {
          let run = [];
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (let rIdx = 0; rIdx < rows; rIdx++) {
            const [sx, sy, vis] = rowPts[rIdx][i];
            if (vis) run.push([sx, sy]);
            else flush();
          }
          flush();
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  randlines: {
    name: "Random Lines", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Lines", type: "slider", min: 2, max: 600, step: 1, def: 80 },
      { key: "mode", label: "Mode", type: "select", options: ["Free (2 random points)", "Fixed length"], def: "Fixed length" },
      { key: "length", label: "Length mm", type: "slider", min: 2, max: 200, step: 1, def: 30 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "angles", label: "Angles", type: "select", options: ["Any", "Horizontal + Vertical", "Diagonals", "Quantized 45°"], def: "Any" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 53 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 997 + 3);
      const L = Math.round(p.layer);
      const m = p.margin;
      const paths = [];
      const rx = () => m + rng() * (W - 2 * m);
      const ry = () => m + rng() * (H - 2 * m);
      const clampP = (q) => [Math.max(m, Math.min(W - m, q[0])), Math.max(m, Math.min(H - m, q[1]))];
      for (let i = 0; i < Math.round(p.count); i++) {
        if (p.mode === "Free (2 random points)") {
          paths.push({ pts: [[rx(), ry()], [rx(), ry()]], closed: false, layer: L });
        } else {
          const cx = rx(), cy = ry();
          let a;
          if (p.angles === "Horizontal + Vertical") a = rng() > 0.5 ? 0 : Math.PI / 2;
          else if (p.angles === "Diagonals") a = rng() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
          else if (p.angles === "Quantized 45°") a = Math.floor(rng() * 4) * (Math.PI / 4);
          else a = rng() * Math.PI;
          const len = Math.max(1, p.length * (1 - p.lenVar * rng()));
          const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
          paths.push({ pts: [clampP([cx - dx, cy - dy]), clampP([cx + dx, cy + dy])], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  starfield: {
    name: "Starfield", cat: "gen", group: "space", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Stars", type: "slider", min: 10, max: 800, step: 5, def: 160 },
      { key: "dist", label: "Distribution", type: "select", options: ["Uniform", "Clustered"], def: "Clustered" },
      { key: "drawStars", label: "Draw stars", type: "check", def: true },
      { key: "starSize", label: "Star size mm", type: "slider", min: 0.2, max: 5, step: 0.1, def: 0.8 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "connect", label: "Connect", type: "select", options: ["None", "Near pairs (distance)", "K nearest", "Constellations"], def: "Constellations" },
      { key: "connDist", label: "Connect distance mm", type: "slider", min: 3, max: 100, step: 1, def: 28 },
      { key: "k", label: "K (nearest)", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "starPen", label: "Star pen", type: "pen", def: 0 },
      { key: "linePen", label: "Line pen", type: "pen", def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 57 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1201 + 11);
      const m = p.margin;
      /* tahdet */
      const stars = [];
      let guard = 0;
      while (stars.length < Math.round(p.count) && guard++ < p.count * 40) {
        const x = m + rng() * (W - 2 * m);
        const y = m + rng() * (H - 2 * m);
        if (p.dist === "Clustered") {
          const n = noise2(x * 0.012, y * 0.012, p.seed + 99);
          if (rng() > 0.08 + 0.92 * n * n) continue;
        }
        stars.push([x, y, 1 - p.sizeVar * rng()]);
      }
      const paths = [];
      const SP = Math.round(p.starPen), LP = Math.round(p.linePen);
      /* yhdysviivat */
      const seg = (a, b) => paths.push({ pts: [[stars[a][0], stars[a][1]], [stars[b][0], stars[b][1]]], closed: false, layer: LP });
      const d2 = (a, b) => {
        const dx = stars[a][0] - stars[b][0], dy = stars[a][1] - stars[b][1];
        return dx * dx + dy * dy;
      };
      if (p.connect === "Near pairs (distance)") {
        const lim = p.connDist * p.connDist;
        let nSeg = 0;
        for (let i = 0; i < stars.length && nSeg < 6000; i++) {
          for (let j = i + 1; j < stars.length && nSeg < 6000; j++) {
            if (d2(i, j) <= lim) { seg(i, j); nSeg++; }
          }
        }
      } else if (p.connect === "K nearest") {
        const done = new Set();
        for (let i = 0; i < stars.length; i++) {
          const near = stars.map((_, j) => j).filter((j) => j !== i)
            .sort((a, b) => d2(i, a) - d2(i, b)).slice(0, Math.round(p.k));
          for (const j of near) {
            const key = i < j ? i + "|" + j : j + "|" + i;
            if (!done.has(key)) { done.add(key); seg(i, j); }
          }
        }
      } else if (p.connect === "Constellations") {
        /* ketjuta: satunnainen aloitus, lahin vapaa naapuri sateella, 3-9 tahden kuvio */
        const used = new Set();
        const lim = p.connDist * p.connDist;
        const order = stars.map((_, i) => i).sort(() => rng() - 0.5);
        for (const start of order) {
          if (used.has(start)) continue;
          const chainLen = 3 + Math.floor(rng() * 7);
          const chain = [[stars[start][0], stars[start][1]]];
          used.add(start);
          let cur = start;
          for (let c = 1; c < chainLen; c++) {
            let best = -1, bd = lim;
            for (let j = 0; j < stars.length; j++) {
              if (used.has(j)) continue;
              const dd = d2(cur, j);
              if (dd <= bd) { bd = dd; best = j; }
            }
            if (best < 0) break;
            used.add(best);
            chain.push([stars[best][0], stars[best][1]]);
            cur = best;
          }
          if (chain.length > 1) paths.push({ pts: chain, closed: false, layer: LP });
        }
      }
      /* tahtipisteet paalle (piirtojarjestys: viivat ensin) */
      if (p.drawStars) {
        for (const [x, y, sz] of stars) {
          const r = Math.max(0.1, (p.starSize / 2) * sz);
          const pts = [];
          for (let q = 0; q < 8; q++) {
            const a = (q / 8) * Math.PI * 2;
            pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: true, layer: SP });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  ruler: {
    name: "Ruler", cat: "gen", group: "scientific", ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "scale", label: "Scale", type: "select", options: ["Linear", "Logarithmic (slide rule)"], def: "Linear" },
      { key: "spacing", label: "Tick spacing mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 2 },
      { key: "decades", label: "Decades (log)", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "minor", label: "Minor tick mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 3 },
      { key: "major", label: "Major tick mm", type: "slider", min: 1, max: 40, step: 0.25, def: 8 },
      { key: "side", label: "Ticks side", type: "select", options: ["Up", "Down", "Both"], def: "Up" },
      { key: "baseline", label: "Draw baseline", type: "check", def: true },
      { key: "labels", label: "Every 10th tick", type: "select", options: ["None", "Numbers", "Symbols"], def: "Numbers" },
      { key: "lsize", label: "Label size mm", type: "slider", min: 1, max: 15, step: 0.25, def: 4 },
      { key: "lstep", label: "Number step", type: "slider", min: 1, max: 100, step: 1, def: 1 },
      { key: "margin", label: "Margin mm (no spine)", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const spines = ins[0] && ins[0].paths && ins[0].paths.length
        ? ins[0].paths
        : [{ pts: [[p.margin, H / 2], [W - p.margin, H / 2]], closed: false, layer: L }];
      const paths = [];
      const SYMS = ["circle", "triangle", "square", "plus", "cross"];
      const symbolAt = (kind, x, y, r, ca, sa, layer) => {
        const T = ([lx, ly]) => [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
        if (kind === "circle") {
          const pts = [];
          for (let q = 0; q < 12; q++) {
            const a = (q / 12) * Math.PI * 2;
            pts.push(T([Math.cos(a) * r, Math.sin(a) * r]));
          }
          paths.push({ pts, closed: true, layer });
        } else if (kind === "triangle") {
          const pts = [0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2 - Math.PI / 2;
            return T([Math.cos(a) * r, Math.sin(a) * r]);
          });
          paths.push({ pts, closed: true, layer });
        } else if (kind === "square") {
          paths.push({ pts: [T([-r, -r]), T([r, -r]), T([r, r]), T([-r, r])], closed: true, layer });
        } else if (kind === "plus") {
          paths.push({ pts: [T([-r, 0]), T([r, 0])], closed: false, layer });
          paths.push({ pts: [T([0, -r]), T([0, r])], closed: false, layer });
        } else {
          paths.push({ pts: [T([-r, -r]), T([r, r])], closed: false, layer });
          paths.push({ pts: [T([r, -r]), T([-r, r])], closed: false, layer });
        }
      };
      for (const spine of spines) {
        const base = resample(spine.pts, spine.closed, 0.6);
        if (base.length < 2) continue;
        const closed = !!spine.closed;
        const pts2 = closed ? [...base, base[0]] : base;
        const cum = [0];
        for (let i = 1; i < pts2.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts2[i][0] - pts2[i - 1][0], pts2[i][1] - pts2[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 2) continue;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = pts2[lo][0] + (pts2[hi][0] - pts2[lo][0]) * f;
          const y = pts2[lo][1] + (pts2[hi][1] - pts2[lo][1]) * f;
          const tx = pts2[hi][0] - pts2[lo][0], ty = pts2[hi][1] - pts2[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };
        if (p.baseline) paths.push({ pts: base.map((q) => q.slice()), closed, layer: spine.layer !== undefined ? spine.layer : L });
        /* tick-lista: [s, rank(0=minor,1=medium,2=major), labelValue] */
        const ticks = [];
        if (p.scale === "Linear") {
          const n = Math.floor(total / Math.max(0.3, p.spacing));
          for (let k = 0; k <= n; k++) {
            if (closed && k === n && (k * p.spacing) >= total - 0.01) break;
            ticks.push([k * p.spacing, k % 10 === 0 ? 2 : k % 5 === 0 ? 1 : 0, (k / 10) * p.lstep]);
          }
        } else {
          const D = Math.round(p.decades);
          const unit = total / D;
          for (let d = 0; d < D; d++) {
            for (let v = 10; v < 100; v++) {
              const s = (d + Math.log10(v / 10)) * unit;
              ticks.push([s, v % 10 === 0 ? 2 : v % 5 === 0 ? 1 : 0, v / 10]);
            }
          }
          ticks.push([total, 2, 10]);
        }
        let majorIdx = 0;
        for (const [s, rank, val] of ticks) {
          const [x, y, tx, ty] = at(s);
          const nx = -ty, ny = tx;
          const len = rank === 2 ? p.major : rank === 1 ? (p.minor + p.major) / 2 : p.minor;
          let a0 = 0, a1 = 0;
          if (p.side === "Up") { a0 = 0; a1 = -len; }
          else if (p.side === "Down") { a0 = 0; a1 = len; }
          else { a0 = -len / 2; a1 = len / 2; }
          paths.push({
            pts: [[x + nx * a0, y + ny * a0], [x + nx * a1, y + ny * a1]],
            closed: false, layer: L,
          });
          if (rank === 2 && p.labels !== "None") {
            const off = (p.side === "Down" ? len : -len) + (p.side === "Down" ? 1.5 : -1.5);
            const lx = x + nx * off, ly = y + ny * off;
            if (p.labels === "Symbols") {
              symbolAt(SYMS[majorIdx % SYMS.length], lx + nx * (p.side === "Down" ? p.lsize / 2 : -p.lsize / 2), ly + ny * (p.side === "Down" ? p.lsize / 2 : -p.lsize / 2) * 1, p.lsize / 2, tx, ty, L);
            } else {
              const label = p.scale === "Linear"
                ? String(Math.round(val * 100) / 100)
                : String(Math.round(val * 10) / 10);
              const fs = fontStrokes(label, p.lsize, 1);
              /* keskita tekstin leveys tickin kohdalle, ylareuna tickin karjesta poispain */
              const bx = -fs.width / 2;
              const by = p.side === "Down" ? 0 : -p.lsize;
              for (const stroke of fs.strokes) {
                paths.push({
                  pts: stroke.map(([gx, gy]) => {
                    const ox = bx + gx, oy = by + gy;
                    return [lx + ox * tx + oy * nx, ly + ox * ty + oy * ny];
                  }),
                  closed: false, layer: L,
                });
              }
            }
            majorIdx++;
          }
        }
      }
      return applyStyle({ paths }, ins[1]);
    },
  },

  cables: {
    name: "Cables", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Cables", type: "slider", min: 1, max: 40, step: 1, def: 9 },
      { key: "length", label: "Length mm", type: "slider", min: 50, max: 2000, step: 10, def: 600 },
      { key: "waviness", label: "Waviness", type: "slider", min: 0.05, max: 1.5, step: 0.05, def: 0.45 },
      { key: "wscale", label: "Turn scale", type: "slider", min: 0.2, max: 5, step: 0.1, def: 1.5 },
      { key: "startMode", label: "Layout", type: "select", options: ["Edges (in & out)", "Pile (inside)"], def: "Edges (in & out)" },
      { key: "penPer", label: "Pen per cable", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 63 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const paths = [];
      for (let c = 0; c < Math.round(p.count); c++) {
        const rng = mulberry32(p.seed * 1447 + c * 331 + 17);
        let x, y, heading;
        if (p.startMode === "Pile (inside)") {
          x = W * (0.3 + rng() * 0.4);
          y = H * (0.3 + rng() * 0.4);
          heading = rng() * Math.PI * 2;
        } else {
          /* aloitus satunnaiselta reunalta, suunta sisaanpain */
          const edge = Math.floor(rng() * 4);
          if (edge === 0) { x = m + rng() * (W - 2 * m); y = m; heading = Math.PI / 2; }
          else if (edge === 1) { x = W - m; y = m + rng() * (H - 2 * m); heading = Math.PI; }
          else if (edge === 2) { x = m + rng() * (W - 2 * m); y = H - m; heading = -Math.PI / 2; }
          else { x = m; y = m + rng() * (H - 2 * m); heading = 0; }
          heading += (rng() - 0.5) * 0.8;
        }
        const pts = [[x, y]];
        const step = 1.2;
        const nSteps = Math.min(4000, Math.round(p.length / step));
        for (let i = 0; i < nSteps; i++) {
          /* pehmea kohinaohjattu kaantyminen (johdon jaykkyys = inertia) */
          const turn = (noise2(i * 0.02 * p.wscale, c * 13.7, p.seed) - 0.5) * 2 * p.waviness * 0.35;
          heading += turn;
          /* pehmea tyonto reunoilta sisaanpain */
          const edgeD = 22;
          let steer = 0;
          const toCenter = Math.atan2(H / 2 - y, W / 2 - x);
          const dEdge = Math.min(x - m, W - m - x, y - m, H - m - y);
          if (dEdge < edgeD) {
            let dA = toCenter - heading;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            steer = dA * (1 - dEdge / edgeD) * 0.25;
          }
          heading += steer;
          x += Math.cos(heading) * step;
          y += Math.sin(heading) * step;
          x = Math.max(m, Math.min(W - m, x));
          y = Math.max(m, Math.min(H - m, y));
          pts.push([x, y]);
        }
        paths.push({
          pts, closed: false,
          layer: p.penPer ? (Math.round(p.layer) + c) % PENS.length : Math.round(p.layer),
        });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  lathe: {
    name: "Lathe", cat: "gen", group: "structural", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "sheds", label: "Sheds (skirts)", type: "slider", min: 1, max: 20, step: 1, def: 6 },
      { key: "depth", label: "Shed depth mm", type: "slider", min: 0, max: 50, step: 0.5, def: 16 },
      { key: "shape", label: "Shed shape", type: "select", options: ["Skirt (insulator)", "Round wave", "Sharp zigzag"], def: "Skirt (insulator)" },
      { key: "coreR", label: "Core radius mm", type: "slider", min: 2, max: 60, step: 0.5, def: 13 },
      { key: "height", label: "Height mm", type: "slider", min: 20, max: 300, step: 1, def: 150 },
      { key: "rings", label: "Rings", type: "slider", min: 10, max: 300, step: 2, def: 110 },
      { key: "tilt", label: "View tilt", type: "slider", min: 0.05, max: 1, step: 0.05, def: 0.32 },
      { key: "mode", label: "Render", type: "select", options: ["Rings", "Profile", "Both"], def: "Rings" },
      { key: "px", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const L = Math.round(p.layer);
      const paths = [];
      /* pyorahdysprofiili r(t), t = 0 ylhaalla .. 1 alhaalla */
      const rAt = (t) => {
        const u = (t * p.sheds) % 1;
        let bump;
        if (p.shape === "Skirt (insulator)") bump = Math.pow(u, 0.65);          /* kasvaa, pudotus poimun lopussa */
        else if (p.shape === "Sharp zigzag") bump = 1 - Math.abs(u * 2 - 1);
        else bump = 0.5 + 0.5 * Math.sin((t * p.sheds) * Math.PI * 2 - Math.PI / 2);
        /* paat kapenevat hieman (kaula & kanta) */
        const env = Math.min(1, Math.min(t, 1 - t) * 8 + 0.35);
        return (p.coreR + p.depth * bump) * env + p.coreR * (1 - env) * 0.6;
      };
      const y0 = p.py - p.height / 2;
      if (p.mode !== "Profile") {
        const nR = Math.round(p.rings);
        for (let i = 0; i <= nR; i++) {
          const t = i / nR;
          const r = rAt(t);
          const cy = y0 + t * p.height;
          const pts = [];
          for (let k = 0; k < 48; k++) {
            const a = (k / 48) * Math.PI * 2;
            pts.push([p.px + Math.cos(a) * r, cy + Math.sin(a) * r * p.tilt]);
          }
          paths.push({ pts, closed: true, layer: L });
        }
      }
      if (p.mode !== "Rings") {
        const nP = 400;
        const left = [], right = [];
        for (let i = 0; i <= nP; i++) {
          const t = i / nP;
          const r = rAt(t);
          const cy = y0 + t * p.height;
          left.push([p.px - r, cy]);
          right.push([p.px + r, cy]);
        }
        paths.push({ pts: left, closed: false, layer: L });
        paths.push({ pts: right, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  fabric: {
    name: "Fabric", cat: "gen", group: "organic", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Drape", type: "select", options: ["Curtain (folds)", "Flag (wave)", "Silk (flow)"], def: "Curtain (folds)" },
      { key: "warp", label: "Warp lines (vert)", type: "slider", min: 0, max: 80, step: 1, def: 34 },
      { key: "weft", label: "Weft lines (horiz)", type: "slider", min: 0, max: 80, step: 1, def: 18 },
      { key: "folds", label: "Folds", type: "slider", min: 1, max: 16, step: 0.5, def: 5 },
      { key: "depth", label: "Fold depth mm", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "sag", label: "Sag mm", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
      { key: "noiseAmt", label: "Rumple mm", type: "slider", min: 0, max: 25, step: 0.25, def: 4 },
      { key: "nscale", label: "Rumple scale", type: "slider", min: 0.5, max: 6, step: 0.1, def: 2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 67 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const w = W - 2 * m, h = H - 2 * m;
      if (w < 10 || h < 10) return EMPTY;
      const L = Math.round(p.layer);
      /* yhtenainen siirtymakentta molemmille lankasuunnille -> kudos pysyy koherenttina */
      const disp = (u, t) => {
        const nA = noise2(u * p.nscale * 3, t * p.nscale * 3, p.seed) - 0.5;
        const nB = noise2(u * p.nscale * 3 + 31, t * p.nscale * 3 + 17, p.seed + 5) - 0.5;
        let dx = 0, dy = 0;
        if (p.mode === "Curtain (folds)") {
          const ph = 3 * (noise2(u * 1.6, 0.3, p.seed + 9) - 0.5);
          dx = p.depth * (0.2 + 0.8 * t) * Math.sin(Math.PI * 2 * p.folds * u + ph);
          dy = p.sag * Math.sin(Math.PI * u) * t;
        } else if (p.mode === "Flag (wave)") {
          dx = p.depth * 0.4 * Math.sin(Math.PI * 2 * (p.folds * 0.5 * t + u * 0.6));
          dy = p.sag * u * Math.sin(Math.PI * 2 * (p.folds * u - t * 0.8));
        } else {
          dx = p.depth * 2 * nA;
          dy = p.sag * 2 * nB;
        }
        dx += p.noiseAmt * 2 * nA;
        dy += p.noiseAmt * 2 * nB;
        return [dx, dy];
      };
      const paths = [];
      const nS = 90;
      for (let i = 0; i <= Math.round(p.warp); i++) {
        if (p.warp === 0) break;
        const u = i / Math.round(p.warp);
        const pts = [];
        for (let k = 0; k <= nS; k++) {
          const t = k / nS;
          const [dx, dy] = disp(u, t);
          pts.push([m + u * w + dx, m + t * h + dy]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      for (let j = 0; j <= Math.round(p.weft); j++) {
        if (p.weft === 0) break;
        const t = j / Math.round(p.weft);
        const pts = [];
        for (let k = 0; k <= nS; k++) {
          const u = k / nS;
          const [dx, dy] = disp(u, t);
          pts.push([m + u * w + dx, m + t * h + dy]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  hairs: {
    name: "Hairs", cat: "gen", group: "organic", ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Hairs", type: "slider", min: 20, max: 4000, step: 10, def: 700 },
      { key: "length", label: "Length mm", type: "slider", min: 1, max: 40, step: 0.5, def: 7 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "curl", label: "Curl", type: "slider", min: 0, max: 3, step: 0.05, def: 0.8 },
      { key: "dirMode", label: "Direction", type: "select", options: ["Flow (noise)", "Fixed angle", "Radial out"], def: "Flow (noise)" },
      { key: "angle", label: "Angle ° (fixed)", type: "slider", min: -180, max: 180, step: 1, def: 90 },
      { key: "fscale", label: "Flow scale", type: "slider", min: 0.002, max: 0.05, step: 0.001, def: 0.01 },
      { key: "droop", label: "Gravity droop", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "margin", label: "Margin mm (no region)", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 71 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      /* alue: suljetut sisaantulopolut (even-odd) tai koko canvas */
      const regions = ins[0] && ins[0].paths ? ins[0].paths.filter((q) => q.closed && q.pts.length > 2) : [];
      const inside = (x, y) => {
        if (!regions.length) {
          return x >= p.margin && x <= W - p.margin && y >= p.margin && y <= H - p.margin;
        }
        let cnt = 0;
        for (const path of regions) {
          const pts = path.pts;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
                (x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0])) cnt++;
          }
        }
        return cnt % 2 === 1;
      };
      /* alueen bbox naytteistysta varten */
      let bx0 = p.margin, by0 = p.margin, bx1 = W - p.margin, by1 = H - p.margin;
      if (regions.length) {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
        for (const path of regions) for (const [x, y] of path.pts) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      }
      const rng = mulberry32(p.seed * 1721 + 29);
      const paths = [];
      let guard = 0;
      const target = Math.round(p.count);
      while (paths.length < target && guard++ < target * 30) {
        const x0 = bx0 + rng() * (bx1 - bx0);
        const y0 = by0 + rng() * (by1 - by0);
        if (!inside(x0, y0)) continue;
        let a;
        if (p.dirMode === "Fixed angle") a = (p.angle * Math.PI) / 180 + (rng() - 0.5) * 0.4;
        else if (p.dirMode === "Radial out") a = Math.atan2(y0 - H / 2, x0 - W / 2) + (rng() - 0.5) * 0.3;
        else a = noise2(x0 * p.fscale, y0 * p.fscale, p.seed + 3) * Math.PI * 4;
        const len = Math.max(0.5, p.length * (1 - p.lenVar * rng()));
        const nSeg = 6;
        const step = len / nSeg;
        const curlDir = rng() > 0.5 ? 1 : -1;
        const pts = [[x0, y0]];
        let x = x0, y = y0, ha = a;
        for (let s = 0; s < nSeg; s++) {
          /* kihara + painovoima: suunta taipuu alaspain matkalla */
          ha += (p.curl * curlDir * 0.25) + (rng() - 0.5) * 0.1;
          const down = Math.PI / 2;
          let dA = down - ha;
          while (dA > Math.PI) dA -= Math.PI * 2;
          while (dA < -Math.PI) dA += Math.PI * 2;
          ha += dA * p.droop * 0.12;
          x += Math.cos(ha) * step;
          y += Math.sin(ha) * step;
          pts.push([x, y]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[1]);
    },
  },

  potato: {
      name: "Potato",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Potatoes", type: "slider", min: 1, max: 60, step: 1, def: 9 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 120, step: 1, def: 38 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "irr", label: "Irregularity", type: "slider", min: 0, max: 0.6, step: 0.02, def: 0.22 },
      { key: "eyes", label: "Eyes (texture)", type: "select", options: ["None", "Dots", "Arcs (eyes)"], def: "Arcs (eyes)" },
      { key: "eyeCount", label: "Eyes per potato", type: "slider", min: 1, max: 30, step: 1, def: 7 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 73 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 2311 + 41);
      const L = Math.round(p.layer);
      const paths = [];
      const placed = [];
      let guard = 0;
      while (placed.length < Math.round(p.count) && guard++ < p.count * 60) {
        const R = (p.size / 2) * (1 - p.sizeVar * rng());
        const cx = p.margin + R + rng() * (W - 2 * p.margin - 2 * R);
        const cy = p.margin + R + rng() * (H - 2 * p.margin - 2 * R);
        if (W - 2 * p.margin < 2 * R || H - 2 * p.margin < 2 * R) continue;
        /* kevyt paallekkaisyyden esto (perunat kasassa saavat koskettaa) */
        let ok = true;
        for (const q of placed) {
          if (Math.hypot(cx - q[0], cy - q[1]) < (R + q[2]) * 0.75) { ok = false; break; }
        }
        if (!ok && guard < p.count * 40) continue;
        placed.push([cx, cy, R]);
        /* epasymmetrinen muoto: matalataajuiset harmoniset satunnaisin vaihein */
        const nH = 3;
        const amps = [], phs = [];
        for (let h = 0; h < nH; h++) {
          amps.push((p.irr * R * (0.4 + 0.6 * rng())) / (h + 1));
          phs.push(rng() * Math.PI * 2);
        }
        /* kevyt litistys satunnaiseen suuntaan (peruna, ei pallo) */
        const squash = 0.75 + 0.2 * rng();
        const sqA = rng() * Math.PI;
        const rAt = (th) => {
          let r = R;
          for (let h = 0; h < nH; h++) r += amps[h] * Math.sin((h + 2) * th + phs[h]);
          return Math.max(R * 0.3, r);
        };
        const pts = [];
        for (let k = 0; k < 72; k++) {
          const th = (k / 72) * Math.PI * 2;
          const r = rAt(th);
          let x = Math.cos(th) * r, y = Math.sin(th) * r;
          /* litistys akselia pitkin */
          const ca = Math.cos(sqA), sa = Math.sin(sqA);
          const u = x * ca + y * sa, v = -x * sa + y * ca;
          x = u * ca - v * squash * sa;
          y = u * sa + v * squash * ca;
          pts.push([cx + x, cy + y]);
        }
        paths.push({ pts, closed: true, layer: L });
        /* silmat */
        if (p.eyes !== "None") {
          for (let e = 0; e < Math.round(p.eyeCount); e++) {
            const th = rng() * Math.PI * 2;
            const rr = Math.sqrt(rng()) * 0.62 * rAt(th) * squash;
            const ex = cx + Math.cos(th) * rr;
            const ey = cy + Math.sin(th) * rr;
            if (p.eyes === "Dots") {
              const er = 0.5 + rng() * 0.9;
              const dot = [];
              for (let q = 0; q < 7; q++) {
                const a = (q / 7) * Math.PI * 2;
                dot.push([ex + Math.cos(a) * er, ey + Math.sin(a) * er]);
              }
              paths.push({ pts: dot, closed: true, layer: L });
            } else {
              /* pieni kaareva "silma": 4 pisteen hymy satunnaisessa kulmassa */
              const ea = rng() * Math.PI * 2;
              const el = 1 + rng() * 2.2;
              const ca = Math.cos(ea), sa = Math.sin(ea);
              const arc = [[-el, -el * 0.25], [-el * 0.35, el * 0.28], [el * 0.35, el * 0.28], [el, -el * 0.25]];
              paths.push({
                pts: arc.map(([ax, ay]) => [ex + ax * ca - ay * sa, ey + ax * sa + ay * ca]),
                closed: false, layer: L,
              });
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  trunks: {
      name: "Trunks",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Trunks", type: "slider", min: 1, max: 30, step: 1, def: 7 },
      { key: "width", label: "Width mm", type: "slider", min: 2, max: 60, step: 0.5, def: 16 },
      { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "smooth", label: "Smoothness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65 },
      { key: "lean", label: "Lean", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "artifacts", label: "Artifacts (bark)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "taper", label: "Taper", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "markPen", label: "Bark pen", type: "pen", def: 0 },
      { key: "sameAsTrunk", label: "Bark = trunk pen", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 79 },
      { key: "layer", label: "Trunk pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const MP = p.sameAsTrunk ? L : Math.round(p.markPen);
      const paths = [];
      const rngG = mulberry32(p.seed * 2903 + 53);
      /* rungot jaettuna leveydelle kevyella jitterilla */
      const n = Math.round(p.count);
      const slots = [];
      for (let i = 0; i < n; i++) slots.push((i + 0.5) / n + (rngG() - 0.5) * (0.5 / n));
      for (let c = 0; c < n; c++) {
        const rng = mulberry32(p.seed * 2903 + c * 419 + 7);
        const w0 = p.width * (1 - p.widthVar * rng());
        const cx0 = p.margin + slots[c] * (W - 2 * p.margin);
        const leanAmt = (rng() - 0.5) * 2 * p.lean * w0 * 2.5;
        /* reunojen vaellus: smoothness pienentaa amplitudia ja hidastaa taajuutta */
        const amp = (1 - p.smooth) * w0 * 0.45;
        const fq = 2 + (1 - p.smooth) * 6;
        const nS = 110;
        const left = [], right = [];
        const edgeAt = (t) => {
          const cx = cx0 + leanAmt * t + (noise2(t * 1.2, c * 7.3, p.seed) - 0.5) * w0 * 0.7 * (1 - p.smooth);
          const w = (w0 / 2) * (1 - p.taper * (1 - t));   /* kapenee ylospain */
          const wl = (noise2(t * fq, c * 11.1, p.seed + 2) - 0.5) * 2 * amp;
          const wr = (noise2(t * fq, c * 11.1 + 50, p.seed + 3) - 0.5) * 2 * amp;
          return [cx - w + wl, cx + w + wr, cx, w * 2];
        };
        for (let i = 0; i <= nS; i++) {
          const t = i / nS;
          const y = p.margin + t * (H - 2 * p.margin);
          const [xl, xr] = edgeAt(t);
          left.push([xl, y]);
          right.push([xr, y]);
        }
        paths.push({ pts: left, closed: false, layer: L });
        paths.push({ pts: right, closed: false, layer: L });
        /* koivun kaarnamerkit: vaakasuuntaisia kaaria rungon sisalla,
           satunnainen osuus leveydesta, kevyt kaarevuus alaspain */
        const nMarks = Math.round(p.artifacts * 26 * (H / 200));
        for (let m = 0; m < nMarks; m++) {
          const t = 0.03 + rng() * 0.94;
          const y = p.margin + t * (H - 2 * p.margin);
          const [xl, xr] = edgeAt(t);
          const wSpan = xr - xl;
          if (wSpan < 1.5) continue;
          const a = rng() * 0.55;
          const b = a + 0.15 + rng() * Math.min(0.8, 1 - a - 0.15);
          const x0 = xl + wSpan * a, x1 = xl + wSpan * Math.min(0.97, b);
          const sagY = (0.3 + rng() * 0.9);
          const mid = [(x0 + x1) / 2, y + sagY];
          paths.push({ pts: [[x0, y], mid, [x1, y]], closed: false, layer: MP });
          /* osa merkeista kaksinkertaisia (paksu kaarnaviiru) */
          if (rng() < 0.3) {
            paths.push({ pts: [[x0, y + 1], [(x0 + x1) / 2, y + 1 + sagY], [x1, y + 1]], closed: false, layer: MP });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  water: {
      name: "Water",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 0, max: 400, step: 1, def: 85 },
      { key: "lines", label: "Ripple lines", type: "slider", min: 5, max: 150, step: 1, def: 55 },
      { key: "amp", label: "Wave amp mm", type: "slider", min: 0.2, max: 12, step: 0.1, def: 1.6 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 3, max: 80, step: 0.5, def: 16 },
      { key: "swell", label: "Swell mm", type: "slider", min: 0, max: 20, step: 0.25, def: 2.5 },
      { key: "chop", label: "Choppiness (gaps)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 89 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const y0 = p.horizon, y1 = H - m;
      if (y1 - y0 < 5) return EMPTY;
      const paths = [];
      const n = Math.round(p.lines);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;                       /* 0 = horisontissa, 1 = edessa */
        /* perspektiivi: rivit pakkautuvat horisonttiin, aallot pienenevat kauas */
        const g = 1 + p.persp * 1.6;
        const y = y0 + Math.pow(t, g) * (y1 - y0);
        const sc = 0.22 + 0.78 * Math.pow(t, 0.8 + p.persp);
        const amp = p.amp * sc;
        const wl = Math.max(1.5, p.wl * sc);
        const ph = mulberry32(p.seed * 613 + i * 97)() * Math.PI * 2;
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer: L });
          run = [];
        };
        const step = 0.9;
        for (let x = m; x <= W - m; x += step) {
          /* aalto: paa-aalto + hitaampi maininki + kohinarikkonaisuus */
          const wave = Math.sin((x / wl) * Math.PI * 2 + ph) * amp * 0.5
            + Math.sin((x / (wl * 3.7)) * Math.PI * 2 + ph * 1.7) * p.swell * sc * 0.5
            + (noise2(x * 0.15, i * 3.1, p.seed) - 0.5) * amp * 0.8;
          /* katkonta: kimallus rikkoo viivan; tuulenvireet kohinakentasta */
          const gate = noise2(x * (0.05 + 0.1 / sc), i * 1.9, p.seed + 31);
          if (gate > p.chop * 0.85) run.push([x, y + wave]);
          else flush();
        }
        flush();
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  skyline: {
      name: "Skyline",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Forest", "City"], def: "Forest" },
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 10, max: 400, step: 1, def: 85 },
      { key: "height", label: "Height mm", type: "slider", min: 5, max: 150, step: 1, def: 38 },
      { key: "layers", label: "Layers (depth)", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "rough", label: "Hill roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "detail", label: "Detail (trees/buildings)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "texture", label: "Texture (trunks/windows)", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 97 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const w = W - 2 * m;
      if (w < 20) return EMPTY;
      const paths = [];
      const nL = Math.round(p.layers);
      for (let ly = 0; ly < nL; ly++) {
        /* kerros 0 = etummainen (korkein, horisontissa), taaemmat nousevat ylos ja madaltuvat */
        const back = ly / Math.max(1, nL - 1 || 1);
        const hgt = p.height * (1 - 0.45 * back);
        const yBase = p.horizon - back * p.height * 0.55;
        const lseed = p.seed + ly * 137;
        const rng = mulberry32(lseed * 761 + 5);
        if (p.mode === "Forest") {
          /* kukkulasiluetti fBm + havupiikit paalle */
          const hillAt = (x) => {
            const u = (x - m) / w;
            let v = 0, a = 1, f = 1, tot = 0;
            for (let o = 0; o < 3; o++) {
              v += a * noise2(u * (2 + p.rough * 5) * f, ly * 7.7, lseed);
              tot += a; a *= 0.5; f *= 2;
            }
            return yBase - (v / tot) * hgt;
          };
          const pts = [];
          let x = m;
          while (x <= W - m) {
            const hy = hillAt(x);
            /* kuusenlatva: piikki ylos ja alas takaisin, korkeus satunnainen */
            const spikeH = (0.5 + rng() * 1) * (1.5 + p.detail * 4) * (1 - 0.4 * back);
            const spikeW = 0.8 + rng() * (2.5 - p.detail * 1.2);
            if (p.detail > 0.02) {
              pts.push([x, hy]);
              pts.push([x + spikeW / 2, hy - spikeH]);
              pts.push([x + spikeW, hy]);
            } else {
              pts.push([x, hy]);
            }
            x += Math.max(0.6, spikeW);
          }
          paths.push({ pts, closed: false, layer: L });
          /* tekstuuri: runkoviiruja siluetista alaspain (vain etukerros) */
          if (p.texture && ly === 0) {
            const nT = Math.round(w / 6);
            for (let k = 0; k < nT; k++) {
              const tx = m + rng() * w;
              const ty = hillAt(tx);
              const tl = (2 + rng() * 6) * (0.5 + p.detail);
              paths.push({ pts: [[tx, ty + 1], [tx + (rng() - 0.5) * 0.8, ty + 1 + tl]], closed: false, layer: L });
            }
          }
        } else {
          /* CITY: porrastettu talosiluetti yhtena polylinena */
          const pts = [[m, yBase]];
          let x = m;
          let prevH = 0;
          const bldgs = [];
          while (x < W - m) {
            const bw = Math.min(W - m - x, (4 + rng() * 26) * (1 - p.detail * 0.5) + 2);
            /* korkeusjakauma: enimmakseen matalia, joskus torni */
            const tall = rng() < 0.14 ? 1 + rng() * 0.8 : 0.25 + rng() * 0.6;
            const bh = hgt * tall * (1 - 0.3 * back);
            pts.push([x, yBase - bh]);
            pts.push([x + bw, yBase - bh]);
            pts.push([x + bw, yBase]);
            bldgs.push([x, bw, bh]);
            /* antenni satunnaisesti korkeimpiin */
            if (tall > 1.2 && rng() < 0.6) {
              paths.push({ pts: [[x + bw / 2, yBase - bh], [x + bw / 2, yBase - bh - hgt * 0.18]], closed: false, layer: L });
            }
            x += bw;
          }
          paths.push({ pts, closed: false, layer: L });
          /* ikkunat: pienia vaakaviiruja rakennusten sisalla (etukerros) */
          if (p.texture && ly === 0) {
            for (const [bx, bw, bh] of bldgs) {
              if (bw < 5 || bh < 8) continue;
              const cols = Math.max(1, Math.floor(bw / 3.5));
              const rows = Math.max(1, Math.floor(bh / 4.5));
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  if (rng() < 0.45) continue;   /* osa ikkunoista pimeana */
                  const wx = bx + 1.6 + c * ((bw - 3.2) / Math.max(1, cols - 1 || 1));
                  const wy = yBase - bh + 2.5 + r * ((bh - 5) / Math.max(1, rows - 1 || 1));
                  paths.push({ pts: [[wx - 0.7, wy], [wx + 0.7, wy]], closed: false, layer: L });
                }
              }
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  tiles: {
      name: "Tiles",
    cat: "gen", group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Columns", type: "slider", min: 1, max: 40, step: 1, def: 10 },
      { key: "rows", label: "Rows", type: "slider", min: 1, max: 40, step: 1, def: 7 },
      { key: "shape", label: "Shape", type: "select", options: ["Superellipse", "Circle", "Triangle", "Hexagon", "Star", "Reuleaux", "Cross"], def: "Superellipse" },
      { key: "superN", label: "Superellipse N", type: "slider", min: 0.4, max: 8, step: 0.05, def: 2.5 },
      { key: "sizeX", label: "Size X %", type: "slider", min: 10, max: 100, step: 1, def: 78 },
      { key: "sizeY", label: "Size Y % (0 = same)", type: "slider", min: 0, max: 100, step: 1, def: 0 },
      { key: "starPts", label: "Star points", type: "slider", min: 3, max: 12, step: 1, def: 5 },
      { key: "starIn", label: "Star inner %", type: "slider", min: 10, max: 90, step: 1, def: 45 },
      { key: "rot", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "rotJit", label: "Rotation jitter °", type: "slider", min: 0, max: 180, step: 1, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 101 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const cols = Math.round(p.cols), rows = Math.round(p.rows);
      const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
      const rng = mulberry32(p.seed * 3169 + 61);
      const a = (cw / 2) * (p.sizeX / 100);
      const b = (ch / 2) * ((p.sizeY > 0 ? p.sizeY : p.sizeX) / 100);
      /* muodon pisteet yksikkokoossa (a,b sisaan skaalattuna) */
      const shapePts = () => {
        const pts = [];
        if (p.shape === "Superellipse") {
          /* |x/a|^n + |y/b|^n = 1 : N 1 = timantti, 2 = ellipsi, iso = suorakulmio, <1 = astroidi */
          const e = 2 / Math.max(0.05, p.superN);
          for (let k = 0; k < 64; k++) {
            const t = (k / 64) * Math.PI * 2;
            const c = Math.cos(t), s = Math.sin(t);
            pts.push([
              a * Math.sign(c) * Math.pow(Math.abs(c), e),
              b * Math.sign(s) * Math.pow(Math.abs(s), e),
            ]);
          }
        } else if (p.shape === "Circle") {
          for (let k = 0; k < 48; k++) {
            const t = (k / 48) * Math.PI * 2;
            pts.push([a * Math.cos(t), b * Math.sin(t)]);
          }
        } else if (p.shape === "Triangle") {
          for (let k = 0; k < 3; k++) {
            const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
            pts.push([a * Math.cos(t), b * Math.sin(t)]);
          }
        } else if (p.shape === "Hexagon") {
          for (let k = 0; k < 6; k++) {
            const t = (k / 6) * Math.PI * 2;
            pts.push([a * Math.cos(t), b * Math.sin(t)]);
          }
        } else if (p.shape === "Star") {
          const n = Math.round(p.starPts);
          for (let k = 0; k < n * 2; k++) {
            const t = (k / (n * 2)) * Math.PI * 2 - Math.PI / 2;
            const rr = k % 2 === 0 ? 1 : p.starIn / 100;
            pts.push([a * rr * Math.cos(t), b * rr * Math.sin(t)]);
          }
        } else if (p.shape === "Reuleaux") {
          /* kolme kaarta, keskukset kolmion vastakkaisissa karjissa */
          const V = [0, 1, 2].map((k) => {
            const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
            return [Math.cos(t), Math.sin(t)];
          });
          const R = Math.hypot(V[1][0] - V[0][0], V[1][1] - V[0][1]);
          for (let k = 0; k < 3; k++) {
            const c = V[k];
            const a1 = Math.atan2(V[(k + 1) % 3][1] - c[1], V[(k + 1) % 3][0] - c[0]);
            const a2 = Math.atan2(V[(k + 2) % 3][1] - c[1], V[(k + 2) % 3][0] - c[0]);
            let d = a2 - a1;
            while (d < 0) d += Math.PI * 2;
            for (let q = 0; q < 12; q++) {
              const t = a1 + (q / 12) * d;
              pts.push([(c[0] + Math.cos(t) * R) * a * 0.62, (c[1] + Math.sin(t) * R) * b * 0.62]);
            }
          }
        } else {
          /* Cross: risti */
          const t = 0.36;
          const cr = [
            [-t, -1], [t, -1], [t, -t], [1, -t], [1, t], [t, t],
            [t, 1], [-t, 1], [-t, t], [-1, t], [-1, -t], [-t, -t],
          ];
          for (const [x, y] of cr) pts.push([x * a, y * b]);
        }
        return pts;
      };
      const base = shapePts();
      const paths = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = m + (c + 0.5) * cw;
          const cy = m + (r + 0.5) * ch;
          const ang = ((p.rot + (rng() - 0.5) * 2 * p.rotJit) * Math.PI) / 180;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          paths.push({
            pts: base.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]),
            closed: true,
            layer: L,
          });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  regmarks: {
      name: "Reg Marks",
    cat: "gen", group: "structural",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "style", label: "Style", type: "select", options: ["Cross +", "Registration (circle + cross)", "Corner L"], def: "Cross +" },
      { key: "size", label: "Size mm", type: "slider", min: 2, max: 30, step: 0.5, def: 8 },
      { key: "insetX", label: "Inset X mm", type: "slider", min: 0, max: 100, step: 0.5, def: 10 },
      { key: "insetY", label: "Inset Y mm", type: "slider", min: 0, max: 100, step: 0.5, def: 10 },
      { key: "tl", label: "Top left", type: "check", def: true },
      { key: "tr", label: "Top right", type: "check", def: true },
      { key: "bl", label: "Bottom left", type: "check", def: true },
      { key: "br", label: "Bottom right", type: "check", def: true },
      { key: "center", label: "Center mark", type: "check", def: false },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const r = p.size / 2;
      const paths = [];
      const cross = (x, y) => {
        paths.push({ pts: [[x - r, y], [x + r, y]], closed: false, layer: L });
        paths.push({ pts: [[x, y - r], [x, y + r]], closed: false, layer: L });
      };
      const circle = (x, y, cr) => {
        const pts = [];
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * Math.PI * 2;
          pts.push([x + Math.cos(a) * cr, y + Math.sin(a) * cr]);
        }
        paths.push({ pts, closed: true, layer: L });
      };
      /* L-merkki: kulman suuntainen — sx/sy kertovat mihin suuntaan viivat osoittavat */
      const cornerL = (x, y, sx, sy) => {
        paths.push({ pts: [[x, y], [x + sx * p.size, y]], closed: false, layer: L });
        paths.push({ pts: [[x, y], [x, y + sy * p.size]], closed: false, layer: L });
      };
      const mark = (x, y, sx, sy) => {
        if (p.style === "Cross +") cross(x, y);
        else if (p.style === "Registration (circle + cross)") {
          cross(x, y);
          circle(x, y, r * 0.62);
        } else cornerL(x, y, sx, sy);
      };
      if (p.tl) mark(p.insetX, p.insetY, 1, 1);
      if (p.tr) mark(W - p.insetX, p.insetY, -1, 1);
      if (p.bl) mark(p.insetX, H - p.insetY, 1, -1);
      if (p.br) mark(W - p.insetX, H - p.insetY, -1, -1);
      if (p.center) mark(W / 2, H / 2, 1, 1);
      return applyStyle({ paths }, ins[0]);
    }
  },

  tvnoise: {
      name: "Noise",
    cat: "gen", group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Pixel shape", type: "select", options: ["Square", "Circle", "Dash (scanline)"], def: "Square" },
      { key: "cell", label: "Cell size mm", type: "slider", min: 0.8, max: 15, step: 0.1, def: 3 },
      { key: "density", label: "Density", type: "slider", min: 0.02, max: 1, step: 0.02, def: 0.3 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "posJit", label: "Position jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "bands", label: "Interference bands", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 107 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const cell = Math.max(0.5, p.cell);
      const cols = Math.min(400, Math.floor((W - 2 * m) / cell));
      const rows = Math.min(400, Math.floor((H - 2 * m) / cell));
      if (cols < 1 || rows < 1) return EMPTY;
      const paths = [];
      let budget = 9000; /* max pikselia */
      for (let r = 0; r < rows && budget > 0; r++) {
        /* hairintajuovat: tiheys aaltoilee riveittain kuin huono signaali */
        const band = p.bands > 0
          ? 1 - p.bands * (0.5 + 0.5 * Math.sin(r * 0.7 + noise2(0.3, r * 0.13, p.seed + 7) * 6))
          : 1;
        for (let c = 0; c < cols && budget > 0; c++) {
          const h = hash2(c, r, p.seed);
          if (h > p.density * band) continue;
          budget--;
          const rng = mulberry32((r * 7919 + c) * 31 + p.seed);
          const sz = (cell / 2) * 0.85 * (1 - p.sizeVar * rng());
          const x = m + (c + 0.5) * cell + (rng() - 0.5) * cell * p.posJit;
          const y = m + (r + 0.5) * cell + (rng() - 0.5) * cell * p.posJit;
          if (p.shape === "Square") {
            paths.push({ pts: [[x - sz, y - sz], [x + sz, y - sz], [x + sz, y + sz], [x - sz, y + sz]], closed: true, layer: L });
          } else if (p.shape === "Circle") {
            const pts = [];
            const n = sz < 1 ? 6 : 10;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              pts.push([x + Math.cos(a) * sz, y + Math.sin(a) * sz]);
            }
            paths.push({ pts, closed: true, layer: L });
          } else {
            /* scanline: vaakaviiru, pituus vaihtelee */
            const len = sz * (1.5 + rng() * 3);
            paths.push({ pts: [[x - len, y], [x + len, y]], closed: false, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  net: {
      name: "Net",
    cat: "gen", group: "structural",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "pattern", label: "Mesh type", type: "select", options: ["Diamond", "Square", "Triangle", "Hexagon"], def: "Diamond" },
      { key: "cell", label: "Cell size mm", type: "slider", min: 2, max: 60, step: 0.5, def: 14 },
      { key: "sag", label: "Sag mm (hanging)", type: "slider", min: 0, max: 60, step: 0.5, def: 12 },
      { key: "jit", label: "Irregularity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 109 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const w = W - 2 * m, h = H - 2 * m;
      if (w < 5 || h < 5) return EMPTY;
      /* verkon roikkuminen + epasaannollisyys yhtenaisena kenttana:
         koko verkko painuu keskelta, solmut varisevat kohinalla */
      const disp = (x, y) => {
        const u = (x - m) / w;
        const dy = p.sag * Math.sin(Math.PI * Math.max(0, Math.min(1, u))) * (0.25 + 0.75 * (y - m) / h);
        const jx = (noise2(x * 0.05, y * 0.05, p.seed) - 0.5) * p.jit * p.cell * 0.9;
        const jy = (noise2(x * 0.05 + 40, y * 0.05 + 40, p.seed + 3) - 0.5) * p.jit * p.cell * 0.9;
        return [x + jx, y + dy + jy];
      };
      const paths = [];
      const seg = (a, b) => {
        /* piirra saie hienojakoisena jotta sag/jitter taipuu sulavasti */
        const n = 6;
        const pts = [];
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          pts.push(disp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
        }
        paths.push({ pts, closed: false, layer: L });
      };
      const poly = (raw) => {
        /* jatkuva polyline solmupisteista, valit hienonnettuna */
        const pts = [];
        for (let i = 0; i < raw.length - 1; i++) {
          const a = raw[i], b = raw[i + 1];
          const n = 4;
          for (let k = i === 0 ? 0 : 1; k <= n; k++) {
            const t = k / n;
            pts.push(disp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
          }
        }
        if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
      };
      const c = p.cell;
      if (p.pattern === "Square") {
        for (let y = m; y <= m + h + 0.01; y += c) poly([[m, y], [m + w, y]]);
        for (let x = m; x <= m + w + 0.01; x += c) poly([[x, m], [x, m + h]]);
      } else if (p.pattern === "Diamond") {
        /* diagonaalit molempiin suuntiin — kalastusverkko */
        for (let s = -h; s <= w + h; s += c) {
          poly([[m + s, m], [m + s + h, m + h]]);
          poly([[m + s, m], [m + s - h, m + h]]);
        }
      } else if (p.pattern === "Triangle") {
        for (let y = m; y <= m + h + 0.01; y += c) poly([[m, y], [m + w, y]]);
        for (let s = -h; s <= w + h; s += c) {
          poly([[m + s, m], [m + s + h, m + h]]);
          poly([[m + s, m], [m + s - h, m + h]]);
        }
      } else {
        /* Hexagon: hunajakenno siksak-riveina + pystylinkit -> ei tuplavetoja */
        const hw = c / 2, hh = (c * Math.sqrt(3)) / 2;
        let rowI = 0;
        for (let y = m; y <= m + h - hh * 0.5; y += hh, rowI++) {
          const off = rowI % 2 === 0 ? 0 : 0;
          /* siksak: /\/\/\ */
          const raw = [];
          let up = rowI % 2 === 0;
          for (let x = m; x <= m + w + 0.01; x += hw) {
            raw.push([x, up ? y : y + hh * 0.5]);
            up = !up;
          }
          poly(raw);
          /* pystylinkit siksakin alapisteista seuraavan rivin ylapisteisiin */
          let up2 = rowI % 2 === 0;
          for (let x = m; x <= m + w + 0.01; x += hw) {
            if (!up2 && y + hh * 0.5 + hh * 0.5 <= m + h) {
              seg([x, y + hh * 0.5], [x, y + hh]);
            }
            up2 = !up2;
          }
        }
      }
      /* rajaa marginaaliin: sag voi tyontaa alle — kevyt leikkaus */
      const paths2 = paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [Math.max(m - 1, Math.min(m + w + 1, x)), Math.min(H - 2, y)]),
      }));
      return applyStyle({ paths: paths2 }, ins[0]);
    }
  },

  panelka: {
      name: "Building",
    cat: "gen", group: "structural",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "floors", label: "Floors", type: "slider", min: 2, max: 24, step: 1, def: 9 },
      { key: "sections", label: "Sections (stairwells)", type: "slider", min: 1, max: 8, step: 1, def: 4 },
      { key: "floorH", label: "Floor height mm", type: "slider", min: 3, max: 20, step: 0.5, def: 8 },
      { key: "secW", label: "Section width mm", type: "slider", min: 10, max: 80, step: 1, def: 34 },
      { key: "winPerSec", label: "Windows / section", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "balcony", label: "Balconies", type: "select", options: ["None", "Alternating columns", "All"], def: "Alternating columns" },
      { key: "seams", label: "Panel seams", type: "check", def: true },
      { key: "litRatio", label: "Lit windows", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "depth", label: "Side depth mm (0 = off)", type: "slider", min: 0, max: 60, step: 1, def: 18 },
      { key: "roofBits", label: "Roof machinery + antennas", type: "check", def: true },
      { key: "groundY", label: "Ground Y mm", type: "slider", min: 20, max: 400, step: 1, def: 185 },
      { key: "seed", label: "Seed", type: "seed", def: 113 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W } = ctx;
      const L = Math.round(p.layer);
      const rng = mulberry32(p.seed * 3491 + 71);
      const floors = Math.round(p.floors);
      const secs = Math.round(p.sections);
      const bw = secs * p.secW;                 /* rungon leveys */
      const bh = floors * p.floorH;             /* rungon korkeus */
      const x0 = (W - bw) / 2 - (p.depth > 0 ? p.depth * 0.35 : 0);
      const y1 = p.groundY;                     /* maanpinta */
      const y0 = y1 - bh;                       /* katto */
      const paths = [];
      const rect = (x, y, w, h, closed) => {
        paths.push({ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: closed !== false, layer: L });
      };
      const line = (a, b) => paths.push({ pts: [a, b], closed: false, layer: L });
      /* --- runko --- */
      rect(x0, y0, bw, bh);
      /* --- elementtisaumat: vaaka joka kerros, pysty joka sektio --- */
      if (p.seams) {
        for (let f = 1; f < floors; f++) line([x0, y0 + f * p.floorH], [x0 + bw, y0 + f * p.floorH]);
        for (let s = 1; s < secs; s++) line([x0 + s * p.secW, y0], [x0 + s * p.secW, y1]);
      }
      /* --- ikkunat + parvekkeet --- */
      const nW = Math.round(p.winPerSec);
      const cellW = p.secW / nW;
      const ww = cellW * 0.44, wh = p.floorH * 0.5;
      for (let f = 0; f < floors; f++) {
        const wy = y0 + f * p.floorH + p.floorH * 0.25;
        for (let s = 0; s < secs; s++) {
          for (let k = 0; k < nW; k++) {
            const colIdx = s * nW + k;
            const wx = x0 + s * p.secW + (k + 0.5) * cellW - ww / 2;
            const isBalc = p.balcony === "All"
              || (p.balcony === "Alternating columns" && colIdx % 2 === 1);
            const ground = f === floors - 1;
            if (isBalc && !ground) {
              /* parveke: leveämpi kehys + kaiteen vaakaviivat */
              const bx = wx - ww * 0.28, bwd = ww * 1.56;
              rect(bx, wy, bwd, wh);
              for (let q = 1; q <= 2; q++) {
                line([bx, wy + wh * (0.5 + q * 0.16)], [bx + bwd, wy + wh * (0.5 + q * 0.16)]);
              }
            } else {
              rect(wx, wy, ww, wh);
              /* valo ikkunassa: diagonaaliviivat */
              if (rng() < p.litRatio) {
                line([wx + ww * 0.15, wy + wh * 0.85], [wx + ww * 0.85, wy + wh * 0.15]);
                line([wx + ww * 0.15, wy + wh * 0.45], [wx + ww * 0.55, wy + wh * 0.15]);
              }
            }
          }
          /* ovi + katos joka sektion alakertaan */
          if (f === floors - 1) {
            const dx = x0 + s * p.secW + p.secW / 2;
            const dw = Math.min(6, p.secW * 0.22), dh = Math.min(p.floorH * 0.7, 7);
            rect(dx - dw / 2, y1 - dh, dw, dh, false);
            line([dx - dw, y1 - dh - 1.2], [dx + dw, y1 - dh - 1.2]); /* katos */
          }
        }
      }
      /* --- katto: konehuone + antennit --- */
      if (p.roofBits) {
        line([x0 - 1.5, y0], [x0 + bw + 1.5, y0]); /* rajakorniisi */
        const mw = p.secW * 0.7, mh = Math.min(6, p.floorH * 0.8);
        const mx = x0 + bw * (0.15 + rng() * 0.5);
        rect(mx, y0 - mh, mw, mh, false);
        const nAnt = 1 + Math.floor(rng() * 3);
        for (let a = 0; a < nAnt; a++) {
          const ax = x0 + bw * (0.1 + rng() * 0.8);
          const ah = 4 + rng() * 9;
          line([ax, y0], [ax, y0 - ah]);
          if (rng() < 0.5) line([ax - 1.5, y0 - ah + 1.5], [ax + 1.5, y0 - ah + 1.5]);
        }
      }
      /* --- viisto sivupinta (oblique) --- */
      if (p.depth > 0) {
        const ddx = p.depth * 0.7, ddy = -p.depth * 0.5;
        const xr = x0 + bw;
        /* sivun aariviiva */
        paths.push({
          pts: [[xr, y0], [xr + ddx, y0 + ddy], [xr + ddx, y1 + ddy], [xr, y1]],
          closed: true, layer: L,
        });
        /* katon taso */
        paths.push({
          pts: [[x0, y0], [x0 + ddx, y0 + ddy], [xr + ddx, y0 + ddy], [xr, y0]],
          closed: true, layer: L,
        });
        /* kerrossaumat sivupinnalla */
        if (p.seams) {
          for (let f = 1; f < floors; f++) {
            const yy = y0 + f * p.floorH;
            line([xr, yy], [xr + ddx, yy + ddy]);
          }
          /* paatyikkunarivi (kapea) */
          for (let f = 0; f < floors - 1; f++) {
            const wy = y0 + f * p.floorH + p.floorH * 0.3;
            const t = 0.5;
            paths.push({
              pts: [
                [xr + ddx * (t - 0.12), wy + ddy * (t - 0.12)],
                [xr + ddx * (t + 0.12), wy + ddy * (t + 0.12)],
                [xr + ddx * (t + 0.12), wy + ddy * (t + 0.12) + p.floorH * 0.4],
                [xr + ddx * (t - 0.12), wy + ddy * (t - 0.12) + p.floorH * 0.4],
              ],
              closed: true, layer: L,
            });
          }
        }
      }
      /* maaviiva */
      line([Math.max(2, x0 - bw * 0.15), y1], [Math.min(W - 2, x0 + bw + (p.depth > 0 ? p.depth : 0) + bw * 0.15), y1]);
      return applyStyle({ paths }, ins[0]);
    }
  },

  followlines: {
      name: "Follow Lines",
    cat: "gen", group: "organic",
    ins: [Pin("paths", "Spine (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "bands", label: "Bands (no spine)", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "count", label: "Lines per band", type: "slider", min: 3, max: 150, step: 1, def: 50 },
      { key: "step", label: "Line spacing mm", type: "slider", min: 0.3, max: 6, step: 0.05, def: 0.9 },
      { key: "drift", label: "Drift (pinch/fan)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "dscale", label: "Drift scale", type: "slider", min: 0.2, max: 5, step: 0.1, def: 1.2 },
      { key: "smooth", label: "Relax (straighten)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "side", label: "Side", type: "select", options: ["Right", "Left", "Both"], def: "Right" },
      { key: "angle", label: "Base angle ° (no spine)", type: "slider", min: -180, max: 180, step: 1, def: 60 },
      { key: "wave", label: "Base waviness (no spine)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "penPer", label: "Pen per band", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8 },
      { key: "seed", label: "Seed", type: "seed", def: 127 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = p.margin;
      const paths = [];
      /* --- selkarangat: sisaantulo tai generoidut aaltopohjat --- */
      let spines = [];
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        spines = ins[0].paths.map((q) => resample(q.pts, false, 1.2));
      } else {
        const a = (p.angle * Math.PI) / 180;
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const diag = Math.hypot(W, H) * 1.3;
        const nB = Math.round(p.bands);
        for (let b = 0; b < nB; b++) {
          /* pohjakayrat jaettu poikittaissuunnassa */
          const off = (nB === 1 ? 0 : (b / (nB - 1) - 0.5)) * Math.hypot(W, H) * 0.75;
          const pts = [];
          const nS = Math.round(diag / 1.2);
          for (let i = 0; i <= nS; i++) {
            const t = (i / nS - 0.5) * diag;
            const wob = (noise2(t * 0.012, b * 9.1, p.seed + 17) - 0.5) * p.wave * 90;
            pts.push([
              W / 2 + dx * t + px * (off + wob),
              H / 2 + dy * t + py * (off + wob),
            ]);
          }
          spines.push(pts);
        }
      }
      /* --- leikkaus marginaalisuorakaiteeseen ajossa --- */
      const inside = ([x, y]) => x >= m && x <= W - m && y >= m && y <= H - m;
      const emit = (pts, layer) => {
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer });
          run = [];
        };
        for (const pt of pts) {
          if (inside(pt)) run.push(pt);
          else flush();
        }
        flush();
      };
      /* --- myotailevat viivat: iteratiivinen vaihteleva offset + rentoutus --- */
      const sides = p.side === "Both" ? [1, -1] : p.side === "Left" ? [-1] : [1];
      const nPer = Math.min(200, Math.round(p.count));
      let budget = 120000;
      spines.forEach((base, bi) => {
        const layer = p.penPer ? (Math.round(p.layer) + bi) % PENS.length : Math.round(p.layer);
        for (const s of sides) {
          let cur = base.map((q) => q.slice());
          for (let it = 0; it < nPer && budget > 0; it++) {
            if (it > 0 || s === sides[0]) emit(cur, layer);
            budget -= cur.length;
            const N = cur.length;
            if (N < 3) break;
            /* normaalit */
            const next = new Array(N);
            for (let j = 0; j < N; j++) {
              const jn = Math.min(j + 1, N - 1), jp = Math.max(j - 1, 0);
              const tx = cur[jn][0] - cur[jp][0], ty = cur[jn][1] - cur[jp][1];
              const tl = Math.hypot(tx, ty) || 1;
              /* offset vaihtelee matkalla + iteraatioittain -> nipistykset ja viuhkat */
              const mod = 1 + p.drift * 1.7 * (noise2(j * 0.02 * p.dscale, it * 0.13 + bi * 5, p.seed + 5) - 0.5) * 2;
              const off = p.step * Math.max(0.08, mod) * s;
              next[j] = [cur[j][0] + (-ty / tl) * off, cur[j][1] + (tx / tl) * off];
            }
            /* rentoutus: viivat suoristuvat vahitellen pohjasta poispain */
            if (p.smooth > 0) {
              for (let j = 1; j < N - 1; j++) {
                next[j] = [
                  next[j][0] * (1 - p.smooth * 0.5) + (next[j - 1][0] + next[j + 1][0]) * 0.25 * p.smooth,
                  next[j][1] * (1 - p.smooth * 0.5) + (next[j - 1][1] + next[j + 1][1]) * 0.25 * p.smooth,
                ];
              }
            }
            /* kaanteisten segmenttien siivous (offset-cuspit) */
            const clean = [next[0]];
            for (let j = 1; j < N; j++) {
              const odx = cur[j][0] - cur[j - 1][0], ody = cur[j][1] - cur[j - 1][1];
              const fdx = next[j][0] - clean[clean.length - 1][0], fdy = next[j][1] - clean[clean.length - 1][1];
              if (odx * fdx + ody * fdy > 0) clean.push(next[j]);
            }
            if (clean.length < 3) break;
            /* tasavali sailyy: uudelleennaytteista muutaman iteraation valein */
            cur = it % 4 === 3 ? resample(clean, false, 1.2) : clean;
          }
        }
      });
      return applyStyle({ paths }, ins[1]);
    }
  },

  wood: {
      name: "Wood Rings",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Cut", type: "select", options: ["Rings (cross-cut)", "Grain (split face)"], def: "Rings (cross-cut)" },
      { key: "rings", label: "Rings (years)", type: "slider", min: 4, max: 90, step: 1, def: 30 },
      { key: "spacing", label: "Ring spacing mm", type: "slider", min: 0.5, max: 10, step: 0.1, def: 2.6 },
      { key: "yearVar", label: "Growth variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.14 },
      { key: "ecc", label: "Eccentricity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "eccAng", label: "Eccentricity angle °", type: "slider", min: -180, max: 180, step: 1, def: 40 },
      { key: "cracks", label: "Cracks", type: "slider", min: 0, max: 8, step: 1, def: 3 },
      { key: "bark", label: "Bark", type: "check", def: true },
      { key: "flame", label: "Flame (grain mode)", type: "slider", min: 0.2, max: 3, step: 0.05, def: 1 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "seed", label: "Seed", type: "seed", def: 131 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const rng = mulberry32(p.seed * 4271 + 83);
      const nR = Math.round(p.rings);
      const paths = [];
      /* kasvuvuodet: leveys vaihtelee (kuivat vuodet kapeita, hyvat leveita),
         hitaalla kohinalla jotta vuodet ryhmittyvat jaksoiksi */
      const widths = [];
      let radius = 0;
      for (let i = 0; i < nR; i++) {
        const w = p.spacing * (1 - p.yearVar * 0.85 * noise2(i * 0.35, 3.7, p.seed + 11));
        widths.push(Math.max(p.spacing * 0.12, w));
        radius += widths[i];
      }
      if (p.mode === "Rings (cross-cut)") {
        /* jaettu kulmakohina: renkaat samanmuotoisia -> eivat leikkaa toisiaan */
        const angNoise = (th, i) => {
          const x = Math.cos(th) * 1.6, y = Math.sin(th) * 1.6;
          const shared = noise2(x + 40, y + 40, p.seed) - 0.5;
          const evolve = (noise2(x * 2.3 + i * 0.06, y * 2.3, p.seed + 7) - 0.5) * 0.3;
          return shared + evolve;
        };
        const eA = (p.eccAng * Math.PI) / 180;
        let r = 0;
        /* ydin */
        const pith = [];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          pith.push([p.cx + Math.cos(a) * 0.7, p.cy + Math.sin(a) * 0.7]);
        }
        paths.push({ pts: pith, closed: true, layer: L });
        const ringPt = (th, rr, i) => {
          /* epakeskisyys: rengas venyy yhteen suuntaan (reaktiopuu) */
          const stretch = 1 + p.ecc * 0.55 * Math.cos(th - eA);
          const rad = rr * stretch * (1 + p.wobble * 2 * angNoise(th, i));
          return [p.cx + Math.cos(th) * rad, p.cy + Math.sin(th) * rad];
        };
        for (let i = 0; i < nR; i++) {
          r += widths[i];
          const nS = Math.max(40, Math.min(160, Math.round(r * 2.2)));
          const pts = [];
          for (let k = 0; k < nS; k++) {
            pts.push(ringPt((k / nS) * Math.PI * 2, r, i));
          }
          paths.push({ pts, closed: true, layer: L });
        }
        /* kaarna: rosoinen kaksoiskeha uloimman ulkopuolella */
        if (p.bark) {
          for (const extra of [0.35, 0.75]) {
            const rr = r + p.spacing * extra + 0.6;
            const nS = Math.max(60, Math.round(rr * 2.5));
            const pts = [];
            for (let k = 0; k < nS; k++) {
              const th = (k / nS) * Math.PI * 2;
              const rough = (hash2(k, Math.round(extra * 10), p.seed + 23) - 0.5) * p.spacing * 0.8;
              const [x, y] = ringPt(th, rr, nR);
              const d = Math.hypot(x - p.cx, y - p.cy) || 1;
              pts.push([x + ((x - p.cx) / d) * rough, y + ((y - p.cy) / d) * rough]);
            }
            paths.push({ pts, closed: true, layer: L });
          }
        }
        /* halkeamat: sateittaiset kapenevat kiilat sahalaidalla */
        const nC = Math.round(p.cracks);
        for (let c = 0; c < nC; c++) {
          const th = rng() * Math.PI * 2;
          const rIn = r * (0.15 + rng() * 0.25);
          const rOut = r * (0.85 + rng() * 0.14);
          const wid = 0.02 + rng() * 0.035; /* kiilan kulmapuolikas juuressa */
          for (const s of [1, -1]) {
            const pts = [];
            const nS = 14;
            for (let k = 0; k <= nS; k++) {
              const t = k / nS;
              const rr = rIn + (rOut - rIn) * t;
              const jag = (hash2(k, c * 7 + (s > 0 ? 0 : 50), p.seed + 31) - 0.5) * 0.04;
              const a = th + s * wid * (1 - t) + jag;
              pts.push(ringPt(a, rr, 0));
            }
            paths.push({ pts, closed: false, layer: L });
          }
        }
      } else {
        /* GRAIN: halkaistu pinta — sisakkaiset liekkikaaret.
           Rengas i leikkaa pinnan paraabelina: pieni i = tiukka katedraalikaari,
           iso i = loivenee lankun reunoja kohti. */
        const bw = Math.min(W - 20, radius * 3.2);
        const x0 = p.cx - bw / 2, x1 = p.cx + bw / 2;
        const apexY = p.cy - radius * 0.9;
        let a = 0;
        for (let i = 0; i < nR; i++) {
          a += widths[i];
          const focal = p.flame * (a * 0.9 + 6);
          const pts = [];
          const step = 1.4;
          for (let x = x0; x <= x1 + 0.01; x += step) {
            const u = x - p.cx;
            let y = apexY + a + (u * u) / (4 * focal);
            /* syykuvion elava varina, hitaasti kaarta pitkin */
            y += (noise2(x * 0.03, i * 0.4, p.seed + 3) - 0.5) * p.wobble * 26;
            /* pysty-epakeskisyys: kaaret kallistuvat */
            y += p.ecc * u * 0.12 * Math.sin(i * 0.3);
            if (y > apexY - 2 && y < H - 4 && y > 4) pts.push([x, y]);
            else if (pts.length > 1) {
              paths.push({ pts: pts.slice(), closed: false, layer: L });
              pts.length = 0;
            } else pts.length = 0;
          }
          if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
        }
        /* halkeamat grain-pinnalla: pitkia kapeita pystyviiruja */
        const nC = Math.round(p.cracks);
        for (let c = 0; c < nC; c++) {
          const x = x0 + rng() * bw;
          const y0c = apexY + radius * (0.3 + rng() * 0.8);
          const len = 8 + rng() * 30;
          const pts = [];
          for (let k = 0; k <= 10; k++) {
            const t = k / 10;
            pts.push([x + (hash2(k, c * 11, p.seed + 41) - 0.5) * 1.6, y0c + len * t]);
          }
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  worm: {
      name: "Worm",
    cat: "gen", group: "creatures",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Worms", type: "slider", min: 1, max: 12, step: 1, def: 2 },
      { key: "length", label: "Length mm", type: "slider", min: 30, max: 500, step: 5, def: 170 },
      { key: "width", label: "Body width mm", type: "slider", min: 2, max: 30, step: 0.5, def: 9 },
      { key: "segs", label: "Segment rings", type: "slider", min: 6, max: 120, step: 1, def: 40 },
      { key: "wander", label: "Wander", type: "slider", min: 0.05, max: 1.5, step: 0.05, def: 0.5 },
      { key: "legs", label: "Legs", type: "select", options: ["None (worm)", "Centipede"], def: "Centipede" },
      { key: "legLen", label: "Leg length mm", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "legEvery", label: "Legs every Nth ring", type: "slider", min: 1, max: 6, step: 1, def: 1 },
      { key: "antennae", label: "Antennae", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 137 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin + p.width;
      const paths = [];
      for (let c = 0; c < Math.round(p.count); c++) {
        const rng = mulberry32(p.seed * 4967 + c * 373 + 91);
        /* selkaranka: inertiavaellus pehmealla reunaohjauksella */
        let x = m + rng() * (W - 2 * m);
        let y = m + rng() * (H - 2 * m);
        let heading = rng() * Math.PI * 2;
        const spine = [[x, y]];
        const step = 1.2;
        const nSteps = Math.round(p.length / step);
        for (let i = 0; i < nSteps; i++) {
          heading += (noise2(i * 0.03, c * 17.3, p.seed) - 0.5) * 2 * p.wander * 0.3;
          const dEdge = Math.min(x - m, W - m - x, y - m, H - m - y);
          if (dEdge < 25) {
            const toC = Math.atan2(H / 2 - y, W / 2 - x);
            let dA = toC - heading;
            while (dA > Math.PI) dA -= Math.PI * 2;
            while (dA < -Math.PI) dA += Math.PI * 2;
            heading += dA * (1 - dEdge / 25) * 0.2;
          }
          x += Math.cos(heading) * step;
          y += Math.sin(heading) * step;
          spine.push([x, y]);
        }
        /* runko: renkaat selkarankaa pitkin, paksuusprofiili kapenee paihin
           -> putkimainen 3D-vaikutelma pelkilla vanteilla */
        const nSeg = Math.round(p.segs);
        const N = spine.length;
        const frameAt = (t) => {
          const idx = Math.min(N - 2, Math.max(0, Math.floor(t * (N - 1))));
          const f = t * (N - 1) - idx;
          const a = spine[idx], b = spine[idx + 1];
          const px = a[0] + (b[0] - a[0]) * f, py = a[1] + (b[1] - a[1]) * f;
          const tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1;
          return [px, py, tx / tl, ty / tl];
        };
        const prof = (t) => {
          /* paa pyorea, hanta suippo */
          const head = Math.min(1, t * 6);
          const tail = Math.min(1, (1 - t) * 3);
          return (p.width / 2) * Math.sqrt(head) * Math.pow(tail, 0.8);
        };
        for (let s = 0; s < nSeg; s++) {
          const t = s / Math.max(1, nSeg - 1);
          const [px, py, tx, ty] = frameAt(t);
          const r = prof(t);
          if (r < 0.3) continue;
          /* rengas = litistetty ellipsi rungon poikki (nakyy vanteena) */
          const pts = [];
          const nP = 18;
          for (let k = 0; k < nP; k++) {
            const a = (k / nP) * Math.PI * 2;
            const u = Math.cos(a) * r;          /* poikittain */
            const v = Math.sin(a) * r * 0.34;   /* pitkin runkoa (litistys) */
            pts.push([px + (-ty) * u + tx * v, py + tx * u + ty * v]);
          }
          paths.push({ pts, closed: true, layer: L });
          /* jalat: parit molemmin puolin, askelrytmi vuorottelee */
          if (p.legs === "Centipede" && s % Math.round(p.legEvery) === 0 && t > 0.06 && t < 0.94) {
            const gait = (s % 2 === 0 ? 1 : -1) * 0.5;
            for (const side of [1, -1]) {
              const bx = px + (-ty) * r * side, by = py + tx * r * side;
              const baseA = Math.atan2(tx * side, -ty * side); /* ulospain */
              const a1 = baseA + gait * 0.55 * side;
              const midx = bx + Math.cos(a1) * p.legLen * 0.55;
              const midy = by + Math.sin(a1) * p.legLen * 0.55;
              const a2 = a1 + 0.5 * side;
              paths.push({
                pts: [
                  [bx, by],
                  [midx, midy],
                  [midx + Math.cos(a2) * p.legLen * 0.5, midy + Math.sin(a2) * p.legLen * 0.5],
                ],
                closed: false, layer: L,
              });
            }
          }
        }
        /* tuntosarvet paahan */
        if (p.antennae) {
          const [px, py, tx, ty] = frameAt(1);
          for (const side of [1, -1]) {
            const a = Math.atan2(ty, tx) + side * 0.5;
            const len = p.width * 0.9;
            const mx = px + Math.cos(a) * len * 0.6, my = py + Math.sin(a) * len * 0.6;
            paths.push({
              pts: [[px, py], [mx, my], [mx + Math.cos(a + side * 0.5) * len * 0.5, my + Math.sin(a + side * 0.5) * len * 0.5]],
              closed: false, layer: L,
            });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },

  image: {
    name: "Image", cat: "gen", group: "textimg", fileImage: true,
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "mode", label: "Render", type: "select", options: ["Scanline wave", "Halftone dots", "Hatch levels", "Flow shade"], def: "Scanline wave" },
      { key: "cell", label: "Cell / spacing mm", type: "slider", min: 0.8, max: 12, step: 0.1, def: 2.4 },
      { key: "strength", label: "Strength", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.8 },
      { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
      { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.06 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 139 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx, node) {
      const img = node && node.data && node.data.img;
      if (!img) return EMPTY;
      const { W, H } = ctx;
      const m = p.margin;
      /* sovita kuva marginaalilaatikkoon mittasuhteet sailyttaen */
      const boxW = W - 2 * m, boxH = H - 2 * m;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const x0 = (W - iw) / 2, y0 = (H - ih) / 2;
      const darkAt = (x, y) => {
        /* bilineaarinen naytteistys; kuvan ulkopuolella valkoista */
        const u = (x - x0) / sc, v = (y - y0) / sc;
        if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
        const ui = Math.floor(u), vi = Math.floor(v);
        const fu = u - ui, fv = v - vi;
        const g = img.g;
        const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
        const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
        let d = a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
        if (p.invert) d = 1 - d;
        return Math.pow(Math.max(0, d), p.gamma);
      };
      const L = Math.round(p.layer);
      const paths = [];
      if (p.mode === "Scanline wave") {
        /* klassikko: vaakarivit, tummuus kasvattaa amplitudia JA taajuutta */
        for (let y = y0; y <= y0 + ih; y += p.cell) {
          let run = [], phase = 0;
          const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
          for (let x = x0; x <= x0 + iw; x += 0.35) {
            const d = darkAt(x, y);
            if (d < p.cutoff) { flush(); continue; }
            phase += 0.5 + d * 2.6;
            run.push([x, y + Math.sin(phase) * d * p.cell * 0.48 * p.strength]);
          }
          flush();
        }
      } else if (p.mode === "Halftone dots") {
        for (let y = y0 + p.cell / 2; y < y0 + ih; y += p.cell) {
          for (let x = x0 + p.cell / 2; x < x0 + iw; x += p.cell) {
            const d = darkAt(x, y);
            if (d < p.cutoff) continue;
            const r = d * p.cell * 0.46 * p.strength;
            if (r < 0.16) continue;
            const pts = [];
            const n = r < 0.8 ? 6 : 10;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
            }
            paths.push({ pts, closed: true, layer: L });
          }
        }
      } else if (p.mode === "Hatch levels") {
        /* 4 viivoitustasoa: tummempi alue saa useamman suunnan */
        const angles = [45, -45, 0, 90];
        const levels = [0.2, 0.42, 0.62, 0.82];
        const diag = Math.hypot(iw, ih);
        const cxm = x0 + iw / 2, cym = y0 + ih / 2;
        for (let k = 0; k < 4; k++) {
          const a = (angles[k] * Math.PI) / 180;
          const dx = Math.cos(a), dy = Math.sin(a);
          const px = -dy, py = dx;
          for (let o = -diag / 2; o <= diag / 2; o += p.cell) {
            let run = [];
            const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
            for (let t = -diag / 2; t <= diag / 2; t += 0.5) {
              const x = cxm + dx * t + px * o, y = cym + dy * t + py * o;
              if (darkAt(x, y) * p.strength >= levels[k]) run.push([x, y]);
              else flush();
            }
            flush();
          }
        }
      } else {
        /* Flow shade: virtausviivat joiden tiheys ja pituus seuraavat tummuutta */
        const rng = mulberry32(p.seed * 5479 + 101);
        const attempts = Math.round((iw * ih) / (p.cell * p.cell) * 1.6);
        let budget = 60000;
        for (let i = 0; i < attempts && budget > 0; i++) {
          const sx = x0 + rng() * iw, sy = y0 + rng() * ih;
          const d0 = darkAt(sx, sy);
          if (d0 < p.cutoff || rng() > d0) continue;
          const len = 2 + d0 * 14 * p.strength;
          let x = sx, y = sy;
          const pts = [[x, y]];
          const steps = Math.round(len / 0.8);
          for (let s = 0; s < steps; s++) {
            const a = noise2(x * 0.02, y * 0.02, p.seed + 9) * Math.PI * 4;
            x += Math.cos(a) * 0.8;
            y += Math.sin(a) * 0.8;
            pts.push([x, y]);
          }
          budget -= pts.length;
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  growth: {
    name: "Growth", cat: "gen", group: "organic",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations", type: "slider", min: 20, max: 600, step: 5, def: 220 },
      { key: "repelR", label: "Repel radius mm", type: "slider", min: 1, max: 15, step: 0.25, def: 4 },
      { key: "repelF", label: "Repulsion", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "attract", label: "Cohesion", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "maxEdge", label: "Split edge mm", type: "slider", min: 0.6, max: 6, step: 0.1, def: 2 },
      { key: "growRate", label: "Growth rate", type: "slider", min: 0, max: 10, step: 1, def: 3 },
      { key: "startR", label: "Start radius mm", type: "slider", min: 3, max: 80, step: 1, def: 22 },
      { key: "bound", label: "Bounds", type: "select", options: ["Canvas margin", "Circle"], def: "Circle" },
      { key: "boundR", label: "Circle bound Ø mm", type: "slider", min: 20, max: 400, step: 1, def: 170 },
      { key: "rings", label: "History rings", type: "check", def: true },
      { key: "ringEvery", label: "Ring every N iters", type: "slider", min: 5, max: 100, step: 1, def: 24 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 149 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    overlay(p, ctx) {
      return p.bound === "Circle"
        ? [{ kind: "circle", cx: p.cx, cy: p.cy, r: p.boundR / 2 }]
        : [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
    },
    compute(ins, p, ctx) {
      /* differential growth: silmukka kasvaa — naapurivetovoima pitaa kasassa,
         lahitorjunta tyontaa erilleen, pitkat sarmat halkeavat -> poimuttuva kayra */
      const { W, H } = ctx;
      const MAXP = 2400;
      const rng = mulberry32(p.seed * 6091 + 113);
      let pts = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const r = p.startR * (1 + 0.08 * (rng() - 0.5));
        pts.push([p.cx + Math.cos(a) * r, p.cy + Math.sin(a) * r]);
      }
      const clampB = (q) => {
        if (p.bound === "Circle") {
          const dx = q[0] - p.cx, dy = q[1] - p.cy;
          const d = Math.hypot(dx, dy);
          const R = p.boundR / 2 - 1;
          if (d > R) return [p.cx + (dx / d) * R, p.cy + (dy / d) * R];
          return q;
        }
        return [Math.max(p.margin, Math.min(W - p.margin, q[0])), Math.max(p.margin, Math.min(H - p.margin, q[1]))];
      };
      const paths = [];
      const L = Math.round(p.layer);
      const rr = p.repelR, rr2 = rr * rr;
      const nIters = Math.round(p.iters);
      for (let it = 0; it < nIters; it++) {
        const N = pts.length;
        /* spatiaalinen hila naapurihakuun */
        const cellS = rr;
        const grid = new Map();
        for (let i = 0; i < N; i++) {
          const key = Math.floor(pts[i][0] / cellS) + "," + Math.floor(pts[i][1] / cellS);
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(i);
        }
        const next = new Array(N);
        for (let i = 0; i < N; i++) {
          const [x, y] = pts[i];
          let rx = 0, ry = 0;
          const gx = Math.floor(x / cellS), gy = Math.floor(y / cellS);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
            const lst = grid.get((gx + ox) + "," + (gy + oy));
            if (!lst) continue;
            for (const j of lst) {
              /* ohita kayran valittomat naapurit — muuten torjunta kumoaa koheesion */
              const ringD = Math.min((i - j + N) % N, (j - i + N) % N);
              if (ringD <= 2) continue;
              const dx = x - pts[j][0], dy = y - pts[j][1];
              const d2 = dx * dx + dy * dy;
              if (d2 > rr2 || d2 < 1e-9) continue;
              const d = Math.sqrt(d2);
              const f = (1 - d / rr) / d;
              rx += dx * f; ry += dy * f;
            }
          }
          const ip = (i - 1 + N) % N, inx = (i + 1) % N;
          const ax = (pts[ip][0] + pts[inx][0]) / 2 - x;
          const ay = (pts[ip][1] + pts[inx][1]) / 2 - y;
          let mx = rx * p.repelF * 0.55 + ax * p.attract * 0.55;
          let my = ry * p.repelF * 0.55 + ay * p.attract * 0.55;
          const ml = Math.hypot(mx, my);
          if (ml > 0.9) { mx = (mx / ml) * 0.9; my = (my / ml) * 0.9; }
          next[i] = clampB([x + mx, y + my]);
        }
        /* sarmien halkaisu: pitkat sarmat + kasvupaine (satunnaiset halkaisut) */
        const forceSplit = new Set();
        for (let k = 0; k < Math.round(p.growRate); k++) forceSplit.add(Math.floor(rng() * N));
        const grown = [];
        for (let i = 0; i < N; i++) {
          const a = next[i], b = next[(i + 1) % N];
          grown.push(a);
          const eLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (grown.length < MAXP && (eLen > p.maxEdge || (forceSplit.has(i) && eLen > 0.5))) {
            grown.push([(a[0] + b[0]) / 2 + (rng() - 0.5) * 0.15, (a[1] + b[1]) / 2 + (rng() - 0.5) * 0.15]);
          }
        }
        pts = grown;
        if (p.rings && it > 0 && it % Math.round(p.ringEvery) === 0) {
          paths.push({ pts: pts.map((q) => q.slice()), closed: true, layer: L });
        }
      }
      paths.push({ pts, closed: true, layer: L });
      return applyStyle({ paths }, ins[0]);
    },
  },

  concrete: {
    name: "Concrete Poetry", cat: "gen", group: "textimg",
    ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text (| = line, space = word)", type: "text", def: "WORD IS IMAGE" },
      { key: "mode", label: "Layout", type: "select", options: ["Fill region", "Spiral", "Wave", "Scatter words"], def: "Fill region" },
      { key: "size", label: "Size mm", type: "slider", min: 2, max: 40, step: 0.5, def: 7 },
      { key: "sizeVar", label: "Size variation (scatter)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "track", label: "Tracking", type: "slider", min: 0.6, max: 2.5, step: 0.05, def: 1 },
      { key: "lineh", label: "Line height ×", type: "slider", min: 0.9, max: 3, step: 0.05, def: 1.35 },
      { key: "turns", label: "Turns (spiral)", type: "slider", min: 1, max: 14, step: 0.5, def: 5 },
      { key: "waveAmp", label: "Wave amp mm", type: "slider", min: 0, max: 60, step: 1, def: 16 },
      { key: "waveLen", label: "Wave length mm", type: "slider", min: 20, max: 400, step: 5, def: 130 },
      { key: "count", label: "Words (scatter)", type: "slider", min: 5, max: 400, step: 5, def: 80 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 151 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const text = String(p.text || "").toUpperCase();
      const paths = [];
      /* alue: suljetut sisaantulopolut tai marginaalilaatikko */
      const regions = ins[0] && ins[0].paths ? ins[0].paths.filter((q) => q.closed && q.pts.length > 2) : [];
      const inside = (x, y) => {
        if (!regions.length) return x >= m && x <= W - m && y >= m && y <= H - m;
        let cnt = 0;
        for (const path of regions) {
          const pts = path.pts;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
                (x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0])) cnt++;
          }
        }
        return cnt % 2 === 1;
      };
      let bx0 = m, by0 = m, bx1 = W - m, by1 = H - m;
      if (regions.length) {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
        for (const path of regions) for (const [x, y] of path.pts) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      }
      /* glyyfin piirto: sijainti + rotaatio + skaala; palauttaa etenemismitan */
      const drawGlyph = (ch, x, y, size, ang, guard) => {
        const g = SFONT[ch] || SFONT[" "];
        const sc = size / 10;
        const adv = (g.w + 2) * sc * p.track;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        /* guard: piirra vain jos glyyfin keskikohta on alueen sisalla */
        const gcx = x + (adv / 2) * ca - (size / 2) * -sa;
        const gcy = y + (adv / 2) * sa + (size / 2) * -ca;
        if (guard && !inside(x + (adv / 2) * ca, y + (adv / 2) * sa - (size * 0.4) * ca * 0)) return adv;
        if (guard && !inside(gcx, gcy)) return adv;
        for (const stroke of g.s) {
          if (stroke.length < 2) continue;
          paths.push({
            pts: stroke.map(([gx, gy]) => {
              const lx = gx * sc, ly = (gy - 10) * sc; /* baseline y=0 */
              return [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
            }),
            closed: false, layer: L,
          });
        }
        return adv;
      };
      const lineText = text.replace(/\|/g, " ");
      if (p.mode === "Fill region") {
        /* rivit toistuvaa tekstia; glyyfi piirtyy vain alueen sisalla */
        const src2 = lineText + "  ";
        let row = 0;
        for (let y = by0 + p.size; y <= by1; y += p.size * p.lineh, row++) {
          /* rivioffset ettei sama sana pinoudu */
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, 0, true);
          }
        }
      } else if (p.mode === "Spiral") {
        /* arkhimedeen spiraali ulkoa sisaan, teksti toistuu */
        const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const maxR = Math.min(bx1 - bx0, by1 - by0) / 2 - p.size;
        const loopGap = Math.max(p.size * p.lineh, maxR / Math.max(1, p.turns));
        const rAt = (th) => maxR - (th / (Math.PI * 2)) * loopGap;
        let th = 0, ci = 0;
        const srcT = lineText + " \u00B7 ";
        let guardCount = 0;
        while (rAt(th) > p.size && guardCount++ < 3000) {
          const r = rAt(th);
          const x = cx + Math.cos(th) * r;
          const y = cy + Math.sin(th) * r;
          const ch = srcT[ci % srcT.length];
          ci++;
          const g = SFONT[ch] || SFONT[" "];
          const adv = (g.w + 2) * (p.size / 10) * p.track;
          /* tangentin suunta + kaarevuuskorjattu kulma-askel */
          drawGlyph(ch, x, y, p.size, th + Math.PI / 2, false);
          th += adv / Math.max(2, r);
        }
      } else if (p.mode === "Wave") {
        const src2 = lineText + "  ";
        let row = 0;
        for (let y0 = by0 + p.size; y0 <= by1; y0 += p.size * p.lineh, row++) {
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ph = (x / p.waveLen) * Math.PI * 2 + row * 0.7;
            const y = y0 + Math.sin(ph) * p.waveAmp * 0.5;
            /* kulma seuraa aallon derivaattaa */
            const slope = Math.cos(ph) * p.waveAmp * 0.5 * (Math.PI * 2 / p.waveLen);
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, Math.atan(slope), true) * Math.cos(Math.atan(slope) * 0.5);
          }
        }
      } else {
        /* Scatter: sanat hajallaan alueen sisalla */
        const words = lineText.split(/\s+/).filter(Boolean);
        if (!words.length) return EMPTY;
        const rng = mulberry32(p.seed * 6689 + 127);
        let placed = 0, guard = 0;
        while (placed < Math.round(p.count) && guard++ < p.count * 25) {
          const word = words[Math.floor(rng() * words.length)];
          const size = p.size * (1 - p.sizeVar * rng());
          const ang = (rng() - 0.5) * 1.1;
          const x0 = bx0 + rng() * (bx1 - bx0);
          const y0 = by0 + rng() * (by1 - by0);
          if (!inside(x0, y0)) continue;
          let x = x0;
          for (const ch of word) {
            x += drawGlyph(ch, x, y0 + (x - x0) * Math.tan(ang) * 0, size, ang, true);
          }
          placed++;
        }
      }
      return applyStyle({ paths }, ins[1]);
    },
  },

  fresnel: {
    name: "Fresnel Lens", cat: "mod", group: "fillstyle", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Lens", type: "select", options: ["Circular", "Linear"], def: "Circular" },
      { key: "cx", label: "Center X mm", type: "slider", min: -100, max: 500, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: -100, max: 500, step: 1, def: 100 },
      { key: "angle", label: "Angle ° (linear)", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "radius", label: "Lens Ø mm", type: "slider", min: 20, max: 500, step: 1, def: 180 },
      { key: "zoneW", label: "Groove pitch mm", type: "slider", min: 2, max: 60, step: 0.5, def: 14 },
      { key: "strength", label: "Strength (− expand)", type: "slider", min: -0.85, max: 0.85, step: 0.05, def: 0.5 },
      { key: "curve", label: "Groove profile", type: "select", options: ["Lens (smooth)", "Prism (linear)"], def: "Lens (smooth)" },
      { key: "edge", label: "Edge falloff", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    ],
    overlay(p) {
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.mode === "Circular") {
        g.push({ kind: "circle", cx: p.cx, cy: p.cy, r: p.radius / 2 });
        /* pari uraa nakyviin */
        for (let r = p.zoneW; r < p.radius / 2; r += p.zoneW * 2) {
          g.push({ kind: "circle", cx: p.cx, cy: p.cy, r });
        }
      } else {
        const a = (p.angle * Math.PI) / 180;
        const dx = Math.cos(a), dy = Math.sin(a);
        const px = -dy, py = dx;
        const R = p.radius / 2;
        g.push({
          kind: "poly",
          pts: [
            [p.cx - dx * R - px * R, p.cy - dy * R - py * R],
            [p.cx + dx * R - px * R, p.cy + dy * R - py * R],
            [p.cx + dx * R + px * R, p.cy + dy * R + py * R],
            [p.cx - dx * R + px * R, p.cy - dy * R + py * R],
          ],
        });
      }
      return g;
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      /* fresnel: linssin taittuma vyohykkeittain — siirtyma nollautuu joka uran
         reunalla -> samankeskiset leikkaus-epajatkuvuudet kuten oikeassa linssissa.
         Vyohykkeen sisainen kartoitus on monotoninen -> ei laskoksia uran sisalla. */
      const R = p.radius / 2;
      const dirA = (p.angle * Math.PI) / 180;
      const dux = Math.cos(dirA), duy = Math.sin(dirA);
      const remapU = (u, f) => {
        const s = p.strength * f;
        if (p.curve === "Prism (linear)") {
          /* lineaarinen puristus vyohykkeen alkuun/loppuun */
          const k = 1 + s * 1.6;
          const v = Math.pow(u, k);
          return v;
        }
        /* sileä linssikayra: eksponenttikartoitus (monotoninen) */
        return Math.pow(u, 1 + s * 2.2);
      };
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 0.7).map(([x, y]) => {
          let d, ux, uy;
          if (p.mode === "Circular") {
            const dx = x - p.cx, dy = y - p.cy;
            d = Math.hypot(dx, dy);
            if (d < 0.001 || d > R) return [x, y];
            ux = dx / d; uy = dy / d;
          } else {
            const rx = x - p.cx, ry = y - p.cy;
            const v = -rx * duy + ry * dux;
            if (Math.abs(v) > R) return [x, y];
            d = rx * dux + ry * duy;
            if (Math.abs(d) > R) return [x, y];
            ux = dux; uy = duy;
          }
          /* reunahaivytys */
          const dd = Math.abs(d);
          const t = dd / R;
          let f = 1;
          if (p.edge > 0 && t > 1 - p.edge) {
            const e = (1 - t) / p.edge;
            f = e * e * (3 - 2 * e);
          }
          const sign = d >= 0 ? 1 : -1;
          const zone = Math.floor(dd / p.zoneW);
          const u = (dd - zone * p.zoneW) / p.zoneW;
          const nd = (zone + remapU(u, f)) * p.zoneW * sign;
          return [x + ux * (nd - d), y + uy * (nd - d)];
        }),
      }));
      return { paths };
    },
  },

  scan: {
    name: "Scan", cat: "gen", group: "scientific",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Modality", type: "select", options: ["X-ray (ribcage)", "CT slice", "MRI (head)", "Ultrasound", "Microscope (cells)", "SEM (diatom)", "EEG / Seismic"], def: "MRI (head)" },
      { key: "size", label: "Size mm", type: "slider", min: 30, max: 300, step: 1, def: 150 },
      { key: "detail", label: "Detail / density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "annotate", label: "Annotations (ticks, scale)", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "annPen", label: "Annotation pen", type: "pen", def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 157 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const L = Math.round(p.layer);
      const AP = Math.round(p.annPen);
      const rng = mulberry32(p.seed * 7127 + 131);
      const S = p.size;
      const paths = [];
      const line = (a, b, ly) => paths.push({ pts: [a, b], closed: false, layer: ly === undefined ? L : ly });
      const poly = (pts, closed, ly) => paths.push({ pts, closed: !!closed, layer: ly === undefined ? L : ly });
      const circle = (x, y, r, n, ly) => {
        const pts = [];
        for (let k = 0; k < (n || 32); k++) {
          const a = (k / (n || 32)) * Math.PI * 2;
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        poly(pts, true, ly);
      };
      const blob = (x, y, r, wob, sd) => {
        const rr = mulberry32(sd);
        const nH = 3, amps = [], phs = [];
        for (let h = 0; h < nH; h++) { amps.push(wob * r * rr() / (h + 1)); phs.push(rr() * 6.28); }
        const pts = [];
        for (let k = 0; k < 40; k++) {
          const th = (k / 40) * Math.PI * 2;
          let rad = r;
          for (let h = 0; h < nH; h++) rad += amps[h] * Math.sin((h + 2) * th + phs[h]);
          pts.push([x + Math.cos(th) * rad, y + Math.sin(th) * rad]);
        }
        return pts;
      };
      const label = (str, x, y, sz, ly) => {
        const fs = fontStrokes(str, sz, 1);
        for (const st of fs.strokes) {
          poly(st.map(([gx, gy]) => [x + gx, y + gy - sz]), false, ly);
        }
        return fs.width;
      };
      const M = p.mode;
      if (M === "X-ray (ribcage)") {
        const h = S, w = S * 0.72;
        const top = p.cy - h / 2;
        /* selkaranka: nikamapino */
        const nV = 10;
        const vh = h / nV;
        for (let v = 0; v < nV; v++) {
          const vy = top + v * vh;
          const vw = w * 0.075 * (1 + 0.1 * Math.sin(v));
          poly([[p.cx - vw, vy + vh * 0.12], [p.cx + vw, vy + vh * 0.12], [p.cx + vw, vy + vh * 0.82], [p.cx - vw, vy + vh * 0.82]], true);
        }
        /* kylkiluut: kaarevat parit molemmin puolin, kaksoisviivoina */
        const nR = 8;
        for (let r = 0; r < nR; r++) {
          const t = r / (nR - 1);
          const ry = top + h * (0.12 + t * 0.72);
          const reach = w * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, 0.25 + t)));
          for (const s of [1, -1]) {
            for (const off of [0, 1.4]) {
              const pts = [];
              for (let k = 0; k <= 16; k++) {
                const u = k / 16;
                const x = p.cx + s * (w * 0.08 + reach * Math.sin(u * Math.PI * 0.62));
                const y = ry + off + u * u * h * 0.16 + Math.sin(u * 6 + r) * 0.4 * (1 - p.detail * 0.5);
                pts.push([x, y]);
              }
              poly(pts, false);
            }
          }
        }
        /* solisluut */
        for (const s of [1, -1]) {
          poly([[p.cx + s * w * 0.06, top + h * 0.05], [p.cx + s * w * 0.3, top + h * 0.02], [p.cx + s * w * 0.48, top + h * 0.06]], false);
        }
        if (p.annotate) {
          label("AP VIEW", p.cx - w / 2, top - 6, 4, AP);
          label("R", p.cx - w / 2 - 10, p.cy, 6, AP);
        }
      } else if (M === "CT slice") {
        const rx = S / 2, ry = S * 0.38;
        /* iho + rasvakerros: sisakkaiset ellipsit kohinalla */
        for (const f of [1, 0.94, 0.88]) {
          const pts = [];
          for (let k = 0; k < 64; k++) {
            const a = (k / 64) * Math.PI * 2;
            const n = 1 + (noise2(Math.cos(a) * 2 + 30, Math.sin(a) * 2, p.seed) - 0.5) * 0.05;
            pts.push([p.cx + Math.cos(a) * rx * f * n, p.cy + Math.sin(a) * ry * f * n]);
          }
          poly(pts, true);
        }
        /* nikama alareunassa + sadetahti */
        const sy = p.cy + ry * 0.55;
        circle(p.cx, sy, S * 0.07, 20);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          line([p.cx + Math.cos(a) * S * 0.03, sy + Math.sin(a) * S * 0.03], [p.cx + Math.cos(a) * S * 0.07, sy + Math.sin(a) * S * 0.07]);
        }
        /* elimet: blobit, yksi viivoitettu */
        const organs = [[-0.32, -0.12, 0.2], [0.28, -0.08, 0.24], [0.02, 0.14, 0.13]];
        organs.forEach(([ox, oy, or_], i) => {
          const b = blob(p.cx + ox * rx * 1.4, p.cy + oy * ry * 1.6, or_ * S * 0.5, 0.25, p.seed + i * 7);
          poly(b, true);
          if (i === 1 && p.detail > 0.3) {
            /* tihea elin: sisainen viivoitus vaakaan */
            let y0 = Infinity, y1 = -Infinity;
            for (const [, yy] of b) { if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
            for (let y = y0 + 2; y < y1; y += 2.2 - p.detail) {
              const xs = [];
              for (let j = 0, jj = b.length - 1; j < b.length; jj = j++) {
                if ((b[j][1] > y) !== (b[jj][1] > y)) {
                  xs.push(b[jj][0] + (b[j][0] - b[jj][0]) * (y - b[jj][1]) / (b[j][1] - b[jj][1]));
                }
              }
              xs.sort((a2, b2) => a2 - b2);
              for (let q = 0; q + 1 < xs.length; q += 2) line([xs[q], y], [xs[q + 1], y]);
            }
          }
        });
        if (p.annotate) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            line([p.cx + dx * (rx + 4), p.cy + dy * (ry + 4)], [p.cx + dx * (rx + 9), p.cy + dy * (ry + 9)], AP);
          }
          label("R", p.cx - rx - 14, p.cy, 5, AP);
          label("L", p.cx + rx + 8, p.cy, 5, AP);
        }
      } else if (M === "MRI (head)") {
        const h = S, w = S * 0.82;
        const x0 = p.cx - w / 2, y0 = p.cy - h / 2;
        /* profiili vasemmalle: otsa-nena-huulet-leuka parametrisena */
        const P = [
          [0.52, 0.02], [0.3, 0.06], [0.14, 0.2], [0.06, 0.38],
          [0.02, 0.5], [0.1, 0.55], [0.03, 0.62], [0.1, 0.66],
          [0.06, 0.72], [0.14, 0.78], [0.2, 0.86], [0.3, 0.95], [0.42, 1.0],
        ].map(([u, v]) => [x0 + u * w + (rng() - 0.5) * 1.2, y0 + v * h]);
        /* takaraivo + kallo */
        const back = [];
        for (let k = 0; k <= 20; k++) {
          const a = -Math.PI / 2 + (k / 20) * Math.PI;
          back.push([p.cx + Math.cos(a) * w * 0.46, y0 + h * 0.34 + Math.sin(a) * h * 0.36]);
        }
        poly([...P, ...back.reverse()], false);
        /* kallon sisareuna ylhaalla */
        const inner = [];
        for (let k = 0; k <= 24; k++) {
          const a = Math.PI * 1.05 + (k / 24) * Math.PI * 0.95;
          inner.push([p.cx + Math.cos(a) * w * 0.4, y0 + h * 0.33 + Math.sin(a) * h * 0.3]);
        }
        poly(inner, false);
        /* aivot: gyrus-mutkittelu ellipsin sisalla */
        const bcx = p.cx + w * 0.02, bcy = y0 + h * 0.3;
        const brx = w * 0.36, bry = h * 0.26;
        const inBrain = (x, y) => ((x - bcx) / brx) ** 2 + ((y - bcy) / bry) ** 2 <= 1;
        const nG = Math.round(30 + p.detail * 90);
        for (let g = 0; g < nG; g++) {
          let x = bcx + (rng() * 2 - 1) * brx * 0.9;
          let y = bcy + (rng() * 2 - 1) * bry * 0.9;
          if (!inBrain(x, y)) continue;
          const pts = [[x, y]];
          let a = rng() * Math.PI * 2;
          const steps = 6 + Math.floor(rng() * 12);
          for (let s2 = 0; s2 < steps; s2++) {
            a += (noise2(x * 0.06, y * 0.06, p.seed + 3) - 0.5) * 2.4;
            x += Math.cos(a) * 1.6;
            y += Math.sin(a) * 1.6;
            if (!inBrain(x, y)) break;
            pts.push([x, y]);
          }
          if (pts.length > 2) poly(pts, false);
        }
        /* pikkuaivot: hienot rinnakkaiskaaret */
        const ccx = p.cx + w * 0.24, ccy = y0 + h * 0.52;
        for (let r = 3; r < w * 0.15; r += 2) {
          const pts = [];
          for (let k = 0; k <= 12; k++) {
            const a = Math.PI * 0.15 + (k / 12) * Math.PI * 0.9;
            pts.push([ccx + Math.cos(a) * r, ccy + Math.sin(a) * r * 0.8]);
          }
          poly(pts, false);
        }
        /* aivorunko */
        poly([[p.cx + w * 0.1, y0 + h * 0.5], [p.cx + w * 0.08, y0 + h * 0.68]], false);
        poly([[p.cx + w * 0.16, y0 + h * 0.52], [p.cx + w * 0.14, y0 + h * 0.68]], false);
        if (p.annotate) {
          label("SAG T1", x0, y0 - 5, 4, AP);
          for (let k = 0; k < 5; k++) line([x0 - 6, y0 + (k / 4) * h], [x0 - 3, y0 + (k / 4) * h], AP);
        }
      } else if (M === "Ultrasound") {
        const apex = [p.cx, p.cy - S * 0.45];
        const ang0 = Math.PI / 2 - 0.6, ang1 = Math.PI / 2 + 0.6;
        const R = S * 0.9;
        /* sektorin reunat + kaari */
        line(apex, [apex[0] + Math.cos(ang0) * R, apex[1] + Math.sin(ang0) * R]);
        line(apex, [apex[0] + Math.cos(ang1) * R, apex[1] + Math.sin(ang1) * R]);
        const arcPts = (r) => {
          const pts = [];
          for (let k = 0; k <= 40; k++) {
            const a = ang0 + (k / 40) * (ang1 - ang0);
            pts.push([apex[0] + Math.cos(a) * r, apex[1] + Math.sin(a) * r]);
          }
          return pts;
        };
        poly(arcPts(R), false);
        /* kaikukerrokset: kohinaportitetut katkokaaret (speckle) */
        const nB = Math.round(10 + p.detail * 26);
        for (let b = 1; b <= nB; b++) {
          const r = (b / nB) * R * 0.97 + 3;
          let run = [];
          const flush = () => { if (run.length > 1) poly(run, false); run = []; };
          for (let k = 0; k <= 90; k++) {
            const a = ang0 + (k / 90) * (ang1 - ang0);
            const g = noise2(a * 9, r * 0.25, p.seed + 11);
            if (g > 0.62 - p.detail * 0.22) run.push([apex[0] + Math.cos(a) * r, apex[1] + Math.sin(a) * r]);
            else flush();
          }
          flush();
        }
        /* kaikutiivis massa */
        const ma = (ang0 + ang1) / 2 + (rng() - 0.5) * 0.5;
        const mr = R * (0.45 + rng() * 0.3);
        const mx = apex[0] + Math.cos(ma) * mr, my = apex[1] + Math.sin(ma) * mr;
        for (let r = 2; r < S * 0.1; r += 1.6) circle(mx, my, r, 18);
        if (p.annotate) {
          for (let d = 1; d <= 4; d++) {
            const r = (d / 4) * R;
            const a = ang1 + 0.05;
            line([apex[0] + Math.cos(a) * r, apex[1] + Math.sin(a) * r], [apex[0] + Math.cos(a) * (r + 4), apex[1] + Math.sin(a) * (r + 4)], AP);
          }
          label("5 MHZ", p.cx - S * 0.45, apex[1] - 4, 4, AP);
        }
      } else if (M === "Microscope (cells)") {
        const R = S / 2;
        /* nakokentta */
        circle(p.cx, p.cy, R, 72);
        circle(p.cx, p.cy, R - 1.6, 72);
        /* solut */
        const nC = Math.round(5 + p.detail * 18);
        const placed = [];
        let guard = 0;
        while (placed.length < nC && guard++ < nC * 30) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * R * 0.82;
          const x = p.cx + Math.cos(a) * d, y = p.cy + Math.sin(a) * d;
          const r = S * (0.05 + rng() * 0.06);
          if (d + r > R * 0.95) continue;
          let ok = true;
          for (const q of placed) if (Math.hypot(x - q[0], y - q[1]) < (r + q[2]) * 0.9) { ok = false; break; }
          if (!ok) continue;
          placed.push([x, y, r]);
          const mitosis = rng() < 0.18;
          if (mitosis) {
            const oa = rng() * Math.PI * 2;
            poly(blob(x - Math.cos(oa) * r * 0.5, y - Math.sin(oa) * r * 0.5, r * 0.68, 0.2, p.seed + placed.length * 13), true);
            poly(blob(x + Math.cos(oa) * r * 0.5, y + Math.sin(oa) * r * 0.5, r * 0.68, 0.2, p.seed + placed.length * 17), true);
          } else {
            poly(blob(x, y, r, 0.22, p.seed + placed.length * 11), true);
            /* tuma + organellit */
            const nx = x + (rng() - 0.5) * r * 0.5, ny = y + (rng() - 0.5) * r * 0.5;
            poly(blob(nx, ny, r * 0.36, 0.25, p.seed + placed.length * 19), true);
            const nOrg = 2 + Math.floor(rng() * 4);
            for (let o = 0; o < nOrg; o++) {
              const oa = rng() * Math.PI * 2, od = rng() * r * 0.7;
              const oxp = x + Math.cos(oa) * od, oyp = y + Math.sin(oa) * od;
              if (Math.hypot(oxp - nx, oyp - ny) < r * 0.45) continue;
              circle(oxp, oyp, 0.7 + rng() * 0.8, 7);
            }
          }
        }
        if (p.annotate) {
          const bx = p.cx + R * 0.35, by = p.cy + R + 8;
          line([bx, by], [bx + S * 0.2, by], AP);
          line([bx, by - 2], [bx, by + 2], AP);
          line([bx + S * 0.2, by - 2], [bx + S * 0.2, by + 2], AP);
          label("50 UM", bx + S * 0.045, by + 8, 4, AP);
        }
      } else if (M === "SEM (diatom)") {
        const R = S / 2;
        /* piileva: kaksoiskuori + sateittaiset ripsut + huokosrenkaat */
        circle(p.cx, p.cy, R, 72);
        circle(p.cx, p.cy, R * 0.96, 72);
        circle(p.cx, p.cy, R * 0.16, 24);
        const nRib = Math.round(18 + p.detail * 40);
        for (let k = 0; k < nRib; k++) {
          const a = (k / nRib) * Math.PI * 2;
          line([p.cx + Math.cos(a) * R * 0.2, p.cy + Math.sin(a) * R * 0.2],
               [p.cx + Math.cos(a) * R * 0.94, p.cy + Math.sin(a) * R * 0.94]);
        }
        /* huokoset: pisteita ripsien valissa renkaittain */
        const nRing = Math.round(3 + p.detail * 5);
        for (let ring = 1; ring <= nRing; ring++) {
          const r = R * (0.2 + (ring / (nRing + 1)) * 0.72);
          for (let k = 0; k < nRib; k++) {
            const a = ((k + 0.5) / nRib) * Math.PI * 2;
            circle(p.cx + Math.cos(a) * r, p.cy + Math.sin(a) * r, 0.7 + ring * 0.12, 6);
          }
        }
        if (p.annotate) {
          label("SEM 2.0KV X850", p.cx - R, p.cy + R + 8, 4, AP);
          const bx = p.cx + R * 0.4;
          line([bx, p.cy + R + 14], [bx + S * 0.15, p.cy + R + 14], AP);
          label("10 UM", bx, p.cy + R + 21, 3.5, AP);
        }
      } else {
        /* EEG / Seismic: kanavarivit, rauhallista pohjaa + purskeet */
        const nCh = Math.round(5 + p.detail * 9);
        const w = S * 1.4, h = S;
        const x0 = p.cx - w / 2, y0 = p.cy - h / 2;
        const chH = h / nCh;
        for (let c = 0; c < nCh; c++) {
          const by = y0 + (c + 0.5) * chH;
          /* purskeet: 1-3 tapahtumaa satunnaisin kohdin */
          const rngC = mulberry32(p.seed * 331 + c * 71);
          const nEv = 1 + Math.floor(rngC() * 3);
          const evs = [];
          for (let e = 0; e < nEv; e++) evs.push([rngC() * 0.8 + 0.05, 0.04 + rngC() * 0.12, 0.4 + rngC() * 0.6]);
          const pts = [];
          for (let x = 0; x <= w; x += 0.5) {
            const u = x / w;
            let amp = 0.06;
            let fq = 0.8;
            for (const [eu, ew, ea] of evs) {
              const d = Math.abs(u - eu) / ew;
              if (d < 1) {
                const env = (1 - d) * (1 - d);
                amp += ea * env;
                fq += 3 * env;
              }
            }
            const y = by
              + (noise2(x * 0.15 * fq, c * 9.7, p.seed) - 0.5) * chH * amp * 1.6
              + Math.sin(x * 0.9 * fq + c * 2) * chH * amp * 0.5;
            pts.push([x0 + x, y]);
          }
          poly(pts, false);
        }
        if (p.annotate) {
          for (let c = 0; c < nCh; c++) {
            line([x0 - 5, y0 + (c + 0.5) * chH], [x0 - 2, y0 + (c + 0.5) * chH], AP);
          }
          for (let t = 0; t <= 10; t++) {
            line([x0 + (t / 10) * w, y0 + h + 3], [x0 + (t / 10) * w, y0 + h + 6], AP);
          }
          label("1 S/DIV", x0, y0 + h + 13, 3.5, AP);
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },


  testcard: {
    name: "Test Card", cat: "gen", group: "structural",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "tests", label: "Tests", type: "multi", options: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches", "Registration", "Speed ramp"], def: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches"] },
      { key: "cols", label: "Columns", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "cell", label: "Cell size mm", type: "slider", min: 30, max: 120, step: 1, def: 62 },
      { key: "gap", label: "Cell gap mm", type: "slider", min: 4, max: 30, step: 1, def: 12 },
      { key: "labels", label: "Labels", type: "check", def: true },
      { key: "labelPen", label: "Label pen", type: "pen", def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const AP = Math.round(p.labelPen);
      const m = p.margin;
      const paths = [];
      const line = (a, b) => paths.push({ pts: [a, b], closed: false, layer: L });
      const poly = (pts, closed) => paths.push({ pts, closed: !!closed, layer: L });
      const arc = (cx, cy, r, a0, a1, n) => {
        const pts = [];
        const N = n || 40;
        for (let k = 0; k <= N; k++) {
          const a = a0 + (a1 - a0) * (k / N);
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        poly(pts, false);
      };
      const label = (str, x, y, sz) => {
        const fs = fontStrokes(String(str), sz || 3.2, 1);
        for (const st of fs.strokes) paths.push({ pts: st.map(([gx, gy]) => [x + gx, y + gy]), closed: false, layer: AP });
      };
      /* --- yksittaiset testit; kukin piirtaa soluun (x0,y0,cs) --- */
      const drawTest = (name, x0, y0, cs) => {
        if (p.labels) label(name, x0, y0 - 3, 3.4);
        const pad = 3;
        const ix = x0 + pad, iy = y0 + pad, iw = cs - pad * 2, ih = cs - pad * 2;
        if (name === "Line weight sweep") {
          /* sama viiva monta kertaa: yksi veto, 2, 3... paallekkain -> nakyva paksuus/peitto.
             plotterilla toistoveto tummentaa; nakee myos kohdistustarkkuuden. */
          const rows = 6;
          for (let r = 0; r < rows; r++) {
            const y = iy + (r + 0.5) * (ih / rows);
            const passes = r + 1;
            for (let q = 0; q < passes; q++) {
              line([ix, y + (q - passes / 2) * 0.15], [ix + iw * 0.8, y + (q - passes / 2) * 0.15]);
            }
            if (p.labels) label(passes + "x", ix + iw * 0.84, y + 1.2, 2.6);
          }
        } else if (name === "Line spacing") {
          /* tihenevat pystyviivat: nakee milloin viivat sulautuvat / kynan leveys */
          const gaps = [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25];
          let x = ix;
          for (let g = 0; g < gaps.length && x < ix + iw; g++) {
            const grp = ix + (g / gaps.length) * iw;
            for (let k = 0; k < 5; k++) {
              const xx = grp + k * gaps[g];
              if (xx < ix + iw) line([xx, iy], [xx, iy + ih * 0.82]);
            }
            if (p.labels) label(gaps[g] + "", grp, iy + ih * 0.9, 2.2);
          }
        } else if (name === "Hatch density") {
          /* nelja ruutua kasvavalla viivoitustiheydella + ristikko */
          const q = ih / 2 - 1;
          const dens = [2.5, 1.5, 1, 0.6];
          for (let i = 0; i < 4; i++) {
            const qx = ix + (i % 2) * (iw / 2), qy = iy + Math.floor(i / 2) * (ih / 2);
            const qw = iw / 2 - 2, qh = ih / 2 - 2;
            poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true);
            for (let y = qy + dens[i]; y < qy + qh; y += dens[i]) line([qx, y], [qx + qw, y]);
            if (i >= 2) for (let x = qx + dens[i]; x < qx + qw; x += dens[i]) line([x, qy], [x, qy + qh]);
            if (p.labels) label(dens[i] + "", qx + 1, qy + qh - 1, 2.2);
          }
        } else if (name === "Arcs & circles") {
          /* sisakkaiset ympyrat + kaaria eri sateilla: nakee pyoreyden ja nykimisen */
          const cx = ix + iw / 2, cy = iy + ih / 2;
          for (let r = ih * 0.08; r < ih * 0.48; r += ih * 0.09) arc(cx, cy, r, 0, Math.PI * 2, Math.max(24, r * 3));
          /* pienet kaaret kulmassa: tiukka kaarre = nykiva jos kiihtyvyys liian iso */
          for (let i = 0; i < 4; i++) arc(ix + iw * 0.5, iy + ih * 0.5, 2 + i * 1.2, 0, Math.PI * 1.5, 20);
        } else if (name === "Pen-lift dots") {
          /* pisteruudukko: jokainen = nosto+lasku+minimiveto. testaa noston toistettavuutta
             ja settle-viivetta (jos kyna vetaa hannan -> viive liian pieni). */
          const n = 8;
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
            const x = ix + (c + 0.5) * (iw / n), y = iy + (r + 0.5) * (ih / n);
            /* minimiveto: pieni risti, paljastaa hannat molempiin suuntiin */
            line([x - 0.6, y], [x + 0.6, y]);
            line([x, y - 0.6], [x, y + 0.6]);
          }
          if (p.labels) label("lift x" + (n * n), ix, iy + ih + 0.5, 2.4);
        } else if (name === "Fill swatches") {
          /* kolme taytto-tyylia: vaaka, ristikko, spiraali -> kynan peittavyys */
          const sw = iw / 3 - 1;
          /* 1 vaakatäytto */
          for (let y = iy; y < iy + ih * 0.7; y += 0.8) line([ix, y], [ix + sw, y]);
          /* 2 ristikko */
          const x2 = ix + iw / 3;
          for (let y = iy; y < iy + ih * 0.7; y += 1) line([x2, y], [x2 + sw, y]);
          for (let x = x2; x < x2 + sw; x += 1) line([x, iy], [x, iy + ih * 0.7]);
          /* 3 spiraali */
          const cx = ix + iw * 0.83, cy = iy + ih * 0.35, sp = [];
          for (let t = 0; t < Math.PI * 12; t += 0.25) {
            const rr = t * 0.28;
            if (rr > sw / 2) break;
            sp.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
          }
          poly(sp, false);
          if (p.labels) { label("flat", ix, iy + ih * 0.78, 2.4); label("grid", x2, iy + ih * 0.78, 2.4); label("spir", cx - sw / 3, iy + ih * 0.78, 2.4); }
        } else if (name === "Registration") {
          /* kohdistusristi + neliot: monikynatoiston tarkkuus */
          const cx = ix + iw / 2, cy = iy + ih / 2;
          line([cx - iw * 0.4, cy], [cx + iw * 0.4, cy]);
          line([cx, cy - ih * 0.4], [cx, cy + ih * 0.4]);
          for (const r of [iw * 0.12, iw * 0.24, iw * 0.36]) poly([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], true);
          arc(cx, cy, iw * 0.06, 0, Math.PI * 2, 24);
        } else if (name === "Speed ramp") {
          /* siksak jonka amplitudi/tiheys kasvaa: nopeat suunnanvaihdot paljastavat
             kiihtyvyysrajan (pyoristyvat kulmat / helinä). */
          const rows = 5;
          for (let r = 0; r < rows; r++) {
            const y = iy + (r + 0.5) * (ih / rows);
            const teeth = 4 + r * 4;
            const amp = ih / rows * 0.35;
            const pts = [];
            for (let k = 0; k <= teeth; k++) {
              pts.push([ix + (k / teeth) * iw, y + (k % 2 ? amp : -amp)]);
            }
            poly(pts, false);
            if (p.labels) label(teeth + "", ix + iw + 0.5, y + 1, 2.4);
          }
        }
      };
      /* --- ruudukkoasettelu --- */
      const sel = (p.tests && p.tests.length ? p.tests : ["Line weight sweep"]);
      const cols = Math.round(p.cols);
      const cs = p.cell;
      const gap = p.gap;
      const gridW = cols * cs + (cols - 1) * gap;
      const startX = m + Math.max(0, (W - 2 * m - gridW) / 2);
      let startY = m + 6;
      sel.forEach((name, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const x0 = startX + c * (cs + gap);
        const y0 = startY + r * (cs + gap + 6);
        drawTest(name, x0, y0, cs);
      });
      return applyStyle({ paths }, ins[0]);
    },
  },

  clouds: {
    name: "Clouds", cat: "gen", group: "nature",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "type", label: "Cloud type", type: "select", options: ["Cumulus", "Stratus", "Cirrus", "Cumulonimbus", "Altocumulus"], def: "Cumulus" },
      { key: "count", label: "Amount", type: "slider", min: 1, max: 30, step: 1, def: 6 },
      { key: "size", label: "Size mm", type: "slider", min: 10, max: 140, step: 1, def: 50 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "detail", label: "Detail / texture", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "shade", label: "Shading", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 0, max: 400, step: 1, def: 130 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 171 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
      { key: "shadePen", label: "Shade pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer), SP = Math.round(p.shadePen);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8123 + 61);
      const paths = [];
      /* realistinen pilvi: reuna rakennetaan noise-moduloiduista sateista, ei
         tasaisista kaarilohkoista. eri tyypeilla eri profiili + tekstuuri. */
      const cloudOutline = (cx, cy, w, h, lumpy, sd, flatBase) => {
        const rr = mulberry32(sd);
        const ph = rr() * 100;
        const pts = [];
        const N = Math.max(60, Math.round(w));
        for (let k = 0; k < N; k++) {
          const t = k / N;
          const a = t * Math.PI * 2;
          /* peruskaari: leveä ja matala ellipsi */
          let ex = Math.cos(a), ey = Math.sin(a);
          /* monikerroksinen kohina reunalle -> kuhmurainen mutta ei sahalaita */
          let bump = 0;
          bump += (noise2(ex * lumpy + ph, ey * lumpy, sd) - 0.5) * 1.0;
          bump += (noise2(ex * lumpy * 2.3 + ph, ey * lumpy * 2.3, sd + 3) - 0.5) * 0.5 * p.detail;
          bump += (noise2(ex * lumpy * 4.7 + ph, ey * lumpy * 4.7, sd + 7) - 0.5) * 0.25 * p.detail;
          const rad = 1 + bump * 0.55;
          let x = cx + ex * w * 0.5 * rad;
          let y = cy + ey * h * 0.5 * rad;
          /* litteä pohja: alapuoli puristetaan vaakasuoraksi */
          if (flatBase && ey > 0) {
            y = cy + ey * h * 0.5 * rad * (1 - ey * 0.75);
          }
          pts.push([x, y]);
        }
        return pts;
      };
      const hatchRegion = (pts, dir, gap, penL, coverTop) => {
        /* viivoita monikulmion sisä (even-odd) — pehmeä varjo pohjaan */
        let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
        for (const [x, y] of pts) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
        for (let y = y0 + gap; y < y1; y += gap) {
          /* varjo painottuu alaosaan ellei coverTop */
          if (!coverTop && y < y0 + (y1 - y0) * 0.45) continue;
          const xs = [];
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if ((pts[i][1] > y) !== (pts[j][1] > y)) {
              xs.push(pts[j][0] + (pts[i][0] - pts[j][0]) * (y - pts[j][1]) / (pts[i][1] - pts[j][1]));
            }
          }
          xs.sort((a, b) => a - b);
          for (let q = 0; q + 1 < xs.length; q += 2) {
            if (xs[q + 1] - xs[q] > 1) paths.push({ pts: [[xs[q], y], [xs[q + 1], y]], closed: false, layer: penL });
          }
        }
      };
      const place = (n, yBand, spread, drawer) => {
        const placed = [];
        let guard = 0;
        for (let i = 0; i < n && guard < n * 40; ) {
          guard++;
          const sz = p.size * (1 - p.sizeVar * rng());
          const cx = m + sz * 0.6 + rng() * (W - 2 * m - sz * 1.2);
          const cy = yBand[0] + rng() * (yBand[1] - yBand[0]);
          let ok = true;
          for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * spread) { ok = false; break; }
          if (!ok) continue;
          placed.push([cx, cy, sz]);
          drawer(cx, cy, sz, p.seed + i * 53);
          i++;
        }
      };
      const T = p.type;
      const hor = p.horizon;
      if (T === "Cumulus") {
        /* pörheä, litteäpohjainen, pystysuora kohoama */
        place(p.count, [m + p.size * 0.5, hor - p.size * 0.2], 0.5, (cx, cy, sz, sd) => {
          const out = cloudOutline(cx, cy, sz * 1.3, sz * 0.9, 2.2, sd, true);
          paths.push({ pts: out, closed: true, layer: L });
          if (p.shade > 0.05) hatchRegion(out, 0, Math.max(1.2, 3 - p.shade * 2), SP, false);
        });
      } else if (T === "Stratus") {
        /* matala, venynyt, kerroksellinen sumuvyö */
        place(Math.max(2, Math.round(p.count * 0.7)), [hor - p.size * 0.5, hor], 0.35, (cx, cy, sz, sd) => {
          const out = cloudOutline(cx, cy, sz * 2.6, sz * 0.42, 1.6, sd, false);
          paths.push({ pts: out, closed: true, layer: L });
          /* sisäiset vaakajuovat -> kerrokset */
          const rr = mulberry32(sd + 1);
          const nLayer = Math.round(1 + p.detail * 4);
          for (let l = 0; l < nLayer; l++) {
            const yy = cy - sz * 0.15 + l * sz * 0.12;
            const half = sz * 1.1 * (0.5 + rr() * 0.4);
            paths.push({ pts: [[cx - half, yy], [cx + half, yy]], closed: false, layer: SP });
          }
        });
      } else if (T === "Cirrus") {
        /* ohut, sulkamainen — kaarevat harjaviivat, ei täyttä ääriviivaa */
        place(p.count, [m + p.size * 0.3, hor - p.size * 0.5], 0.3, (cx, cy, sz, sd) => {
          const rr = mulberry32(sd);
          const dir = -0.3 + rr() * 0.6;
          const nStrand = Math.round(3 + p.detail * 8);
          /* pääharja */
          const spine = [];
          for (let k = 0; k <= 20; k++) {
            const t = k / 20;
            spine.push([cx - sz + t * sz * 2, cy + Math.sin(t * 2.5 + dir) * sz * 0.15 + dir * t * sz]);
          }
          paths.push({ pts: spine, closed: false, layer: L });
          /* haivenet: lyhyet kaaret harjasta ylös taakse (fallstreak) */
          for (let s = 0; s < nStrand; s++) {
            const idx = Math.floor(rr() * (spine.length - 1));
            const [bx, by] = spine[idx];
            const wisp = [];
            const wl = sz * (0.3 + rr() * 0.5);
            const wa = -Math.PI * 0.5 + (rr() - 0.5) * 0.8 + dir;
            for (let k = 0; k <= 8; k++) {
              const t = k / 8;
              wisp.push([bx + Math.cos(wa) * wl * t + t * t * sz * 0.2, by + Math.sin(wa) * wl * t]);
            }
            paths.push({ pts: wisp, closed: false, layer: L });
          }
        });
      } else if (T === "Cumulonimbus") {
        /* massiivinen ukkospilvi: pystykohoama + levinnyt alasin ylhäällä */
        place(Math.max(1, Math.round(p.count * 0.5)), [hor - p.size * 0.3, hor - p.size * 0.1], 0.9, (cx, cy, sz, sd) => {
          /* runko */
          const body = cloudOutline(cx, cy - sz * 0.2, sz * 1.1, sz * 1.8, 2.0, sd, true);
          paths.push({ pts: body, closed: true, layer: L });
          /* alasin: leveä litteä yläosa */
          const anvil = cloudOutline(cx, cy - sz * 1.05, sz * 2.4, sz * 0.5, 1.8, sd + 5, false);
          paths.push({ pts: anvil, closed: true, layer: L });
          if (p.shade > 0.05) { hatchRegion(body, 0, Math.max(1.2, 3 - p.shade * 2), SP, false); }
          /* sadeviirut pohjasta */
          if (p.detail > 0.3) {
            const rr = mulberry32(sd + 9);
            for (let r = 0; r < Math.round(p.detail * 10); r++) {
              const rx = cx + (rr() - 0.5) * sz * 1.6;
              const ry = cy + sz * 1.4;
              paths.push({ pts: [[rx, ry], [rx + (rr() - 0.5) * sz * 0.1, ry + sz * (0.3 + rr() * 0.5)]], closed: false, layer: SP });
            }
          }
        });
      } else {
        /* Altocumulus: säännöllinen laikkukenttä ("lampaita") */
        const cols = Math.round(4 + p.count);
        const rows = Math.round(2 + p.count * 0.4);
        const cw = (W - 2 * m) / cols, ch = Math.min(cw, (hor - m) / rows);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (rng() < 0.15) continue;
          const cx = m + (c + 0.5) * cw + (rng() - 0.5) * cw * 0.3;
          const cy = m + (r + 0.5) * ch + (rng() - 0.5) * ch * 0.2;
          const sz = Math.min(cw, ch) * (0.55 + rng() * 0.3) * (1 - p.sizeVar * 0.3 * rng());
          const out = cloudOutline(cx, cy, sz * 1.2, sz * 0.75, 2.5, p.seed + r * 31 + c * 7, false);
          paths.push({ pts: out, closed: true, layer: L });
          if (p.shade > 0.1) {
            /* pieni varjo alle */
            paths.push({ pts: [[cx - sz * 0.4, cy + sz * 0.4], [cx + sz * 0.4, cy + sz * 0.4]], closed: false, layer: SP });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  stone: {
    name: "Stone", cat: "gen", group: "nature",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Stones", type: "slider", min: 1, max: 40, step: 1, def: 8 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 100, step: 1, def: 30 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "facets", label: "Facets", type: "slider", min: 5, max: 24, step: 1, def: 11 },
      { key: "angular", label: "Angularity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "shade", label: "Interior facets", type: "check", def: true },
      { key: "hatch", label: "Hatch shading", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "layout", label: "Layout", type: "select", options: ["Scatter", "Pile", "Wall"], def: "Scatter" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 173 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
      { key: "shadePen", label: "Shade pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer), SP = Math.round(p.shadePen);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8419 + 71);
      const paths = [];
      const oneStone = (cx, cy, sz, sd) => {
        const rr = mulberry32(sd);
        const nF = Math.round(p.facets);
        const outline = [];
        const radii = [];
        for (let i = 0; i < nF; i++) {
          const a = (i / nF) * Math.PI * 2 + (rr() - 0.5) * 0.2;
          /* angularity: satunnainen sade -> rosoinen; sileampi kun pieni */
          const r = sz * 0.5 * (1 - p.angular * 0.5 * rr());
          radii.push(r);
          outline.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82]);
        }
        paths.push({ pts: outline, closed: true, layer: L });
        /* sisafasetit: muutama viiva reunapisteista sisaan -> kolmiulotteinen lohkare */
        if (p.shade) {
          const hi = [cx - sz * 0.12, cy - sz * 0.12];
          const nEdge = Math.min(nF, 3 + Math.floor(rr() * 3));
          for (let k = 0; k < nEdge; k++) {
            const idx = Math.floor(rr() * nF);
            paths.push({ pts: [outline[idx], hi], closed: false, layer: L });
          }
        }
        /* viivoitusvarjo alaoikealla */
        if (p.hatch > 0.05) {
          const nH = Math.round(p.hatch * 10);
          for (let s = 0; s < nH; s++) {
            const t = s / (nH + 1);
            const y = cy + sz * 0.1 + t * sz * 0.32;
            const half = sz * 0.4 * (1 - t) * 0.6;
            paths.push({ pts: [[cx + sz * 0.05, y], [cx + sz * 0.05 + half, y - half * 0.4]], closed: false, layer: SP });
          }
        }
      };
      const n = Math.round(p.count);
      const placed = [];
      let guard = 0;
      for (let i = 0; i < n && guard < n * 50; ) {
        guard++;
        const sz = p.size * (1 - p.sizeVar * rng());
        let cx, cy;
        if (p.layout === "Wall") {
          const cols = Math.ceil(Math.sqrt(n * (W / H)));
          const rows = Math.ceil(n / cols);
          const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
          const c = i % cols, r = Math.floor(i / cols);
          cx = m + (c + 0.5) * cw + (rng() - 0.5) * cw * 0.2;
          cy = m + (r + 0.5) * ch + (rng() - 0.5) * ch * 0.2;
        } else if (p.layout === "Pile") {
          cx = W / 2 + (rng() - 0.5) * (W - 2 * m) * 0.7;
          cy = H - m - sz * 0.5 - rng() * rng() * (H - 2 * m) * 0.8;
        } else {
          cx = m + sz / 2 + rng() * (W - 2 * m - sz);
          cy = m + sz / 2 + rng() * (H - 2 * m - sz);
        }
        let ok = true;
        for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * 0.44) { ok = false; break; }
        if (!ok && p.layout !== "Pile") continue;
        placed.push([cx, cy, sz]);
        oneStone(cx, cy, sz, p.seed + i * 29);
        i++;
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  asteroids: {
    name: "Asteroids", cat: "gen", group: "space",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Asteroids", type: "slider", min: 1, max: 40, step: 1, def: 10 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 90, step: 1, def: 28 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "verts", label: "Vertices", type: "slider", min: 6, max: 16, step: 1, def: 10 },
      { key: "jag", label: "Jaggedness", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.4 },
      { key: "ship", label: "Player ship", type: "check", def: true },
      { key: "bullets", label: "Bullets", type: "slider", min: 0, max: 12, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 175 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8747 + 83);
      const paths = [];
      /* klassinen vektoriasteroidi: epasaannollinen monikulmio jossa sisaan/ulos-piikkeja */
      const oneRock = (cx, cy, sz, sd) => {
        const rr = mulberry32(sd);
        const nV = Math.round(p.verts);
        const pts = [];
        for (let i = 0; i < nV; i++) {
          const a = (i / nV) * Math.PI * 2;
          /* piikit: osa pisteista sisaan, osa ulos -> Asteroids-siluetti */
          const spike = rr() < 0.4 ? 1 - p.jag : 1 + p.jag * 0.5;
          const r = sz * 0.5 * spike;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        paths.push({ pts, closed: true, layer: L });
      };
      const n = Math.round(p.count);
      const placed = [];
      let guard = 0;
      for (let i = 0; i < n && guard < n * 40; ) {
        guard++;
        const sz = p.size * (1 - p.sizeVar * rng());
        const cx = m + sz / 2 + rng() * (W - 2 * m - sz);
        const cy = m + sz / 2 + rng() * (H - 2 * m - sz);
        let ok = true;
        for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * 0.5) { ok = false; break; }
        if (!ok) continue;
        placed.push([cx, cy, sz]);
        oneRock(cx, cy, sz, p.seed + i * 37);
        i++;
      }
      /* alus: klassinen kolmio + peräliekki-viiri */
      if (p.ship) {
        const sx = W / 2, sy = H * 0.7, ss = p.size * 0.6;
        const dir = -Math.PI / 2 + (rng() - 0.5) * 0.6;
        const tip = [sx + Math.cos(dir) * ss, sy + Math.sin(dir) * ss];
        const l = [sx + Math.cos(dir + 2.4) * ss * 0.8, sy + Math.sin(dir + 2.4) * ss * 0.8];
        const r = [sx + Math.cos(dir - 2.4) * ss * 0.8, sy + Math.sin(dir - 2.4) * ss * 0.8];
        const bl = [sx + Math.cos(dir + Math.PI) * ss * 0.35, sy + Math.sin(dir + Math.PI) * ss * 0.35];
        paths.push({ pts: [tip, l, bl, r, tip], closed: true, layer: L });
      }
      /* ammukset: pienet viivanpätkät */
      for (let b = 0; b < Math.round(p.bullets); b++) {
        const bx = m + rng() * (W - 2 * m), by = m + rng() * (H - 2 * m);
        const a = rng() * Math.PI * 2;
        paths.push({ pts: [[bx, by], [bx + Math.cos(a) * 2, by + Math.sin(a) * 2]], closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  planets: {
    name: "Planets", cat: "gen", group: "space",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "body", label: "Body", type: "select", options: ["Sun", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Moon"], def: "Saturn" },
      { key: "size", label: "Radius mm", type: "slider", min: 10, max: 180, step: 1, def: 70 },
      { key: "detail", label: "Surface detail", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "rings", label: "Rings (if any)", type: "check", def: true },
      { key: "terminator", label: "Shadow terminator", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "seed", label: "Seed", type: "seed", def: 177 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const L = Math.round(p.layer);
      const rng = mulberry32(p.seed * 9011 + 47);
      const R = p.size;
      const cx = p.cx, cy = p.cy;
      const paths = [];
      const circle = (x, y, r, n) => {
        const pts = [];
        const N = n || Math.max(40, Math.round(r * 2.2));
        for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
        return pts;
      };
      /* kiekko */
      paths.push({ pts: circle(cx, cy, R), closed: true, layer: L });
      const body = p.body;
      const bandLine = (yFrac, amp, wob) => {
        /* vaakavyo pallon poikki (leveys pienenee reunoilla) */
        const y = cy + yFrac * R;
        const halfX = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
        if (halfX < 1) return;
        const pts = [];
        const steps = Math.max(6, Math.round(halfX / 2));
        for (let k = 0; k <= steps; k++) {
          const x = cx - halfX + (2 * halfX) * (k / steps);
          const yy = y + Math.sin(k * 0.6 + yFrac * 9) * amp * wob;
          pts.push([x, yy]);
        }
        paths.push({ pts, closed: false, layer: L });
      };
      const spot = (xf, yf, rf) => {
        const x = cx + xf * R, y = cy + yf * R;
        const rr = rf * R;
        if (Math.hypot(x - cx, y - cy) + rr > R) return;
        paths.push({ pts: circle(x, y, rr, 20), closed: true, layer: L });
      };
      const craters = (n) => {
        for (let i = 0; i < n; i++) {
          const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * R * 0.82;
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
          const cr = R * (0.03 + rng() * 0.09);
          if (Math.hypot(x - cx, y - cy) + cr > R * 0.97) continue;
          paths.push({ pts: circle(x, y, cr, 14), closed: true, layer: L });
        }
      };
      const nD = p.detail;
      if (body === "Sun") {
        /* koronapiikit ulos + granulaatiokaaria */
        const spikes = Math.round(16 + nD * 28);
        for (let k = 0; k < spikes; k++) {
          const a = (k / spikes) * Math.PI * 2;
          const l = R * (0.08 + rng() * 0.14);
          paths.push({ pts: [[cx + Math.cos(a) * R, cy + Math.sin(a) * R], [cx + Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l)]], closed: false, layer: L });
        }
        for (let i = 0; i < Math.round(nD * 8); i++) spot((rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2, 0.03 + rng() * 0.04);
      } else if (body === "Mercury" || body === "Moon") {
        craters(Math.round(6 + nD * 30));
      } else if (body === "Venus") {
        for (let b = -3; b <= 3; b++) bandLine(b / 4.2, R * 0.03, nD);
      } else if (body === "Earth") {
        /* mannermaiset blobit + navat */
        for (let i = 0; i < Math.round(2 + nD * 4); i++) {
          const a = rng() * Math.PI * 2, d = rng() * R * 0.6;
          const bx = cx + Math.cos(a) * d, by = cy + Math.sin(a) * d;
          const cont = [];
          const cn = 8 + Math.floor(rng() * 6);
          const cr = R * (0.18 + rng() * 0.22);
          for (let k = 0; k < cn; k++) {
            const aa = (k / cn) * Math.PI * 2;
            const r = cr * (0.6 + rng() * 0.6);
            let x = bx + Math.cos(aa) * r, y = by + Math.sin(aa) * r;
            const dd = Math.hypot(x - cx, y - cy);
            if (dd > R * 0.96) { x = cx + (x - cx) / dd * R * 0.96; y = cy + (y - cy) / dd * R * 0.96; }
            cont.push([x, y]);
          }
          paths.push({ pts: cont, closed: true, layer: L });
        }
      } else if (body === "Mars") {
        craters(Math.round(3 + nD * 10));
        for (let b = -2; b <= 2; b += 2) bandLine(b / 3.5, R * 0.02, nD * 0.5);
        /* napalakki */
        paths.push({ pts: circle(cx, cy - R * 0.75, R * 0.18, 18), closed: true, layer: L });
      } else if (body === "Jupiter") {
        for (let b = -5; b <= 5; b++) bandLine(b / 6.5, R * 0.035, nD);
        /* suuri punainen pilkku */
        spot(0.35, 0.2, 0.12);
      } else if (body === "Saturn") {
        for (let b = -4; b <= 4; b++) bandLine(b / 5.5, R * 0.025, nD * 0.7);
      } else if (body === "Uranus" || body === "Neptune") {
        for (let b = -3; b <= 3; b += 1) bandLine(b / 4.5, R * 0.02, nD * 0.5);
        if (body === "Neptune") spot(-0.3, -0.15, 0.1);
      }
      /* renkaat: Saturnus aina, Uranus valinnaisesti; ellipsi eteen+taakse */
      if (p.rings && (body === "Saturn" || body === "Uranus")) {
        const tilt = body === "Saturn" ? 0.32 : 0.72;
        const ringR = [R * 1.35, R * 1.7, R * 1.9];
        for (const rR of ringR) {
          const ell = [];
          for (let k = 0; k <= 60; k++) {
            const a = (k / 60) * Math.PI * 2;
            ell.push([cx + Math.cos(a) * rR, cy + Math.sin(a) * rR * tilt]);
          }
          paths.push({ pts: ell, closed: true, layer: L });
        }
      }
      /* varjoterminaattori: sirpin kaari */
      if (p.terminator > 0.02) {
        const off = (p.terminator * 2 - 1) * R;
        const term = [];
        for (let k = 0; k <= 40; k++) {
          const t = k / 40;
          const y = cy - R + t * 2 * R;
          const halfX = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
          term.push([cx + off * (halfX / R), y]);
        }
        paths.push({ pts: term, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  solar: {
    name: "Solar System", cat: "gen", group: "space",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "planets", label: "Planets", type: "multi", options: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"], def: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn"] },
      { key: "orbits", label: "Orbit paths", type: "check", def: true },
      { key: "moons", label: "Major moons", type: "check", def: true },
      { key: "moonOrbits", label: "Moon orbits", type: "check", def: true },
      { key: "sun", label: "Draw sun", type: "check", def: true },
      { key: "spacing", label: "Orbit spacing", type: "select", options: ["Even", "Log (realistic-ish)"], def: "Even" },
      { key: "phase", label: "Orbit phase", type: "slider", min: 0, max: 360, step: 1, def: 40 },
      { key: "tilt", label: "View tilt", type: "slider", min: 0.15, max: 1, step: 0.05, def: 0.5 },
      { key: "planetScale", label: "Planet size ×", type: "slider", min: 0.3, max: 3, step: 0.1, def: 1 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "orbitPen", label: "Orbit pen", type: "pen", def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 179 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer), OP = Math.round(p.orbitPen);
      const cx = p.cx, cy = p.cy;
      const tilt = p.tilt;
      const paths = [];
      /* planeettadata: suhteellinen sade (nakyva), variarvo, kuut [nimi, kiertosade x planeetan sade] */
      const DATA = {
        Mercury: { r: 1.2, moons: [] },
        Venus: { r: 1.6, moons: [] },
        Earth: { r: 1.7, moons: [["Moon", 2.4]] },
        Mars: { r: 1.4, moons: [["Phobos", 1.8], ["Deimos", 2.6]] },
        Jupiter: { r: 4.2, moons: [["Io", 1.7], ["Europa", 2.2], ["Ganymede", 2.9], ["Callisto", 3.7]] },
        Saturn: { r: 3.6, moons: [["Titan", 3.2], ["Rhea", 2.2]], ring: true },
        Uranus: { r: 2.6, moons: [["Titania", 2.4], ["Oberon", 3.1]], ring: true },
        Neptune: { r: 2.5, moons: [["Triton", 2.6]] },
      };
      const ORDER = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
      const sel = (p.planets && p.planets.length ? p.planets : ["Earth"]).filter((n) => DATA[n]);
      sel.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      const circle = (x, y, r, ty, n) => {
        const pts = []; const N = n || Math.max(20, Math.round(r * 2.5));
        for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
        paths.push({ pts, closed: true, layer: ty });
      };
      const ellipse = (x, y, r, ty) => {
        const pts = []; const N = Math.max(40, Math.round(r * 2));
        for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * tilt]); }
        paths.push({ pts, closed: true, layer: ty });
      };
      /* aurinko */
      const sunR = 8 * p.planetScale;
      if (p.sun) circle(cx, cy, sunR, L, 40);
      /* kiertoradat: mahdu W/2:een marginaalilla */
      const maxOrbit = Math.min(W, H) / 2 - 20;
      const n = sel.length;
      const phase = (p.phase * Math.PI) / 180;
      sel.forEach((name, i) => {
        const d = DATA[name];
        let orbitR;
        if (p.spacing.startsWith("Log")) {
          orbitR = sunR + 14 + (maxOrbit - sunR - 14) * (Math.log(2 + i) / Math.log(2 + n - 1));
        } else {
          orbitR = sunR + 14 + (maxOrbit - sunR - 14) * ((i + 1) / n);
        }
        /* kiertorata */
        if (p.orbits) ellipse(cx, cy, orbitR, OP);
        /* planeetan sijainti radalla */
        const ang = phase + i * 1.05;
        const px = cx + Math.cos(ang) * orbitR;
        const py = cy + Math.sin(ang) * orbitR * tilt;
        const pr = Math.max(1.5, d.r * 2.2 * p.planetScale);
        circle(px, py, pr, L, Math.max(16, Math.round(pr * 3)));
        /* renkaat */
        if (d.ring) {
          for (const rr of [pr * 1.5, pr * 1.9]) {
            const ell = [];
            for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2; ell.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.4]); }
            paths.push({ pts: ell, closed: true, layer: L });
          }
        }
        /* kuut */
        if (p.moons && d.moons.length) {
          d.moons.forEach(([mn, mOrb], mi) => {
            const mR = pr * mOrb;
            if (p.moonOrbits) {
              const ell = [];
              for (let k = 0; k <= 30; k++) { const a = (k / 30) * Math.PI * 2; ell.push([px + Math.cos(a) * mR, py + Math.sin(a) * mR * tilt]); }
              paths.push({ pts: ell, closed: true, layer: OP });
            }
            const ma = phase * 1.7 + mi * 1.3 + i;
            const mx = px + Math.cos(ma) * mR, my = py + Math.sin(ma) * mR * tilt;
            circle(mx, my, Math.max(0.8, pr * 0.28), L, 12);
          });
        }
      });
      return applyStyle({ paths }, ins[0]);
    },
  },

  travelstop: {
    name: "Travel Stop", cat: "mod", group: "penout",
    ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "every", label: "Distance mm", type: "slider", min: 100, max: 8000, step: 50, def: 2000 },
      { key: "mode", label: "Action", type: "select", options: ["Pause (M0)", "Pen change"], def: "Pause (M0)" },
      { key: "msg", label: "Message", type: "text", def: "Advance chalk / refill" },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* jaetaan polut peräkkäin ja lisataan stop-merkki kun kertyma ylittaa rajan.
         merkki kulkee polun kentassa __stop; G-code-generaattori lukee sen ja
         lisaa noston + M0/pen-change ennen ko. polkua. matka lasketaan piirretysta. */
      let acc = 0;
      const out = [];
      const plen = (pts, closed) => {
        let d = 0;
        for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (closed && pts.length > 1) d += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
        return d;
      };
      for (const path of src.paths) {
        const L = plen(path.pts, path.closed);
        if (acc + L > p.every && acc > 0) {
          out.push({ ...path, __stop: { mode: p.mode, msg: p.msg } });
          acc = L;
        } else {
          out.push({ ...path });
          acc += L;
        }
      }
      return { paths: out };
    },
  },

  caustics: {
    name: "Caustics",
    cat: "gen",
    group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cell", label: "Sample cell mm", type: "slider", min: 1, max: 8, step: 0.25, def: 3 },
      { key: "scale", label: "Ripple scale", type: "slider", min: 0.01, max: 0.12, step: 0.005, def: 0.045 },
      { key: "octaves", label: "Detail octaves", type: "slider", min: 1, max: 4, step: 1, def: 3 },
      { key: "focus", label: "Focus / caustic gain", type: "slider", min: 0.2, max: 4, step: 0.05, def: 1.4 },
      { key: "thresh", label: "Brightness threshold", type: "slider", min: 0.1, max: 0.9, step: 0.02, def: 0.5 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "stretch", label: "Depth stretch", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "minlen", label: "Min line mm", type: "slider", min: 0, max: 30, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 5 || y1 - y0 < 5) return EMPTY;

      const cell = Math.max(0.6, p.cell);
      const cols = Math.max(2, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.max(2, Math.round((y1 - y0) / cell) + 1);
      const sc = Math.max(0.001, p.scale);
      const oct = Math.max(1, Math.min(4, Math.round(p.octaves)));
      const seed = p.seed;

      /* --- water-surface height as multi-octave value noise ---
         Two slightly offset noise fields stand in for two crossing
         wave trains; their interference makes the polygonal net. */
      const stretchY = 1 - Math.max(0, Math.min(1, p.stretch)) * 0.6; /* squash y => elongated ripples toward viewer */
      const surf = (x, y) => {
        let v = 0, amp = 1, fq = 1, norm = 0;
        for (let o = 0; o < oct; o++) {
          const sx = x * sc * fq;
          const sy = y * sc * fq * stretchY;
          const a = noise2(sx, sy, seed + o * 17);
          const b = noise2(sy * 1.3 + 11, sx * 1.3 + 5, seed + 100 + o * 17);
          v += amp * (a + b) * 0.5;
          norm += amp;
          amp *= 0.5; fq *= 2;
        }
        return v / norm; /* [0,1) */
      };

      /* --- caustic brightness ≈ curvature (Laplacian) of the surface.
         Where the wavy "lens" surface converges, light focuses -> bright.
         We rectify and gamma it so only the crests read as lines. */
      const h = cell; /* finite-difference step in mm */
      const bright = (x, y) => {
        const c = surf(x, y);
        const lap =
          surf(x + h, y) + surf(x - h, y) +
          surf(x, y + h) + surf(x, y - h) - 4 * c;
        /* positive curvature = focusing; scale by cell^2 to normalize */
        let b = -lap * (1 / (sc * sc * h * h)) * 0.00004 * p.focus;
        b = 0.5 + b; /* center around mid so threshold band works both ways */
        return b;
      };

      /* --- sample the field on the grid --- */
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const field = new Float64Array(cols * rows);
      let fmin = Infinity, fmax = -Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = bright(gx(c), gy(r));
          field[r * cols + c] = v;
          if (v < fmin) fmin = v;
          if (v > fmax) fmax = v;
        }
      }
      const span = (fmax - fmin) || 1;
      const at = (c, r) => (field[r * cols + c] - fmin) / span; /* normalized [0,1] */

      /* --- marching squares iso-contours at one or more levels --- */
      const paths = [];
      const nb = Math.max(1, Math.min(12, Math.round(p.bands)));
      const base = Math.max(0.02, Math.min(0.98, p.thresh));
      const minLen = Math.max(0, p.minlen);

      const interp = (va, vb, lvl) => {
        const d = vb - va;
        if (Math.abs(d) < 1e-9) return 0.5;
        return (lvl - va) / d;
      };

      for (let bi = 0; bi < nb; bi++) {
        /* spread bands around the base threshold */
        const level = nb === 1 ? base
          : base + (bi - (nb - 1) / 2) * (0.9 / nb) * 0.5;
        const lvl = Math.max(0.01, Math.min(0.99, level));

        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = at(c, r), tr = at(c + 1, r);
            const bl = at(c, r + 1), br = at(c + 1, r + 1);
            let idx = 0;
            if (tl > lvl) idx |= 8;
            if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2;
            if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;

            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eLf = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];

            const seg = (a, b) => {
              paths.push({ pts: [a, b], closed: false, layer: L });
            };

            switch (idx) {
              case 1: seg(eLf(), eB()); break;
              case 2: seg(eB(), eR()); break;
              case 3: seg(eLf(), eR()); break;
              case 4: seg(eT(), eR()); break;
              case 5: seg(eLf(), eT()); seg(eB(), eR()); break; /* saddle */
              case 6: seg(eT(), eB()); break;
              case 7: seg(eLf(), eT()); break;
              case 8: seg(eLf(), eT()); break;
              case 9: seg(eT(), eB()); break;
              case 10: seg(eLf(), eB()); seg(eT(), eR()); break; /* saddle */
              case 11: seg(eT(), eR()); break;
              case 12: seg(eLf(), eR()); break;
              case 13: seg(eB(), eR()); break;
              case 14: seg(eLf(), eB()); break;
            }
          }
        }
      }

      /* --- stitch touching segments into longer polylines so the pen
         draws flowing caustic threads instead of thousands of dashes --- */
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map(); /* endpoint key -> list of {seg, end} */
      const segs = paths.map((pa) => ({ a: pa.pts[0], b: pa.pts[1], used: false }));
      const push = (key, ref) => {
        let a = map.get(key); if (!a) { a = []; map.set(key, a); } a.push(ref);
      };
      segs.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });

      const chains = [];
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].used) continue;
        segs[i].used = true;
        const chain = [segs[i].a, segs[i].b];
        /* extend forward */
        let grow = true;
        while (grow) {
          grow = false;
          const tail = chain[chain.length - 1];
          const cands = map.get(kk(tail)) || [];
          for (const ref of cands) {
            const s = segs[ref.i];
            if (s.used) continue;
            const other = ref.end === "a" ? s.b : s.a;
            chain.push(other); s.used = true; grow = true; break;
          }
        }
        /* extend backward */
        grow = true;
        while (grow) {
          grow = false;
          const head = chain[0];
          const cands = map.get(kk(head)) || [];
          for (const ref of cands) {
            const s = segs[ref.i];
            if (s.used) continue;
            const other = ref.end === "a" ? s.b : s.a;
            chain.unshift(other); s.used = true; grow = true; break;
          }
        }
        chains.push(chain);
      }

      const out = [];
      let acc = 0;
      const BUDGET = 110000;
      for (const chain of chains) {
        if (chain.length < 2) continue;
        if (minLen > 0 && pathLength(chain, false) < minLen) continue;
        if (acc + chain.length > BUDGET) break;
        acc += chain.length;
        out.push({ pts: chain, closed: false, layer: L });
      }

      return applyStyle({ paths: out }, ins[0]);
    },
  },
  textpath: {
    name: "Text on Path",
    cat: "gen",
    group: "textimg",
    ins: [Pin("paths", "Path"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text", type: "text", def: "MUUSIA" },
      { key: "size", label: "Size mm (cap height)", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
      { key: "track", label: "Tracking %", type: "slider", min: 50, max: 300, step: 1, def: 100 },
      { key: "align", label: "Align on path", type: "select", options: ["Start", "Center", "End"], def: "Center" },
      { key: "startPct", label: "Start offset %", type: "slider", min: -50, max: 100, step: 1, def: 0 },
      { key: "baseline", label: "Baseline offset mm", type: "slider", min: -40, max: 40, step: 0.5, def: 0 },
      { key: "side", label: "Side", type: "select", options: ["Along", "Flip (read other side)"], def: "Along" },
      { key: "repeat", label: "Repeat to fill", type: "check", def: false },
      { key: "gap", label: "Repeat gap mm", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
      { key: "res", label: "Curve sample mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.6 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const F = SFONT; /* baked-in: module scope */
      const sc = Math.max(0.01, p.size) / 10;
      const tr = Math.max(0.1, p.track / 100);
      const flip = p.side === "Flip (read other side)";

      /* fallback spine: straight horizontal line if nothing wired */
      const spines = ins[0] && ins[0].paths && ins[0].paths.length
        ? ins[0].paths
        : [{ pts: [[15, H / 2], [W - 15, H / 2]], closed: false, layer: L }];

      /* advance width of one glyph including inter-letter gap */
      const glyphW = (ch) => ((F[ch] || F[" "]).w + 2) * sc * tr;
      const strForWidth = (s) => {
        let w = 0;
        for (const ch of s) w += glyphW(ch);
        return w;
      };

      const chars = String(p.text || "").toUpperCase().split("");
      const oneW = strForWidth(chars);
      if (oneW <= 0) return applyStyle({ paths: [] }, ins[1]);

      const paths = [];

      for (const spine of spines) {
        const base = resample(spine.pts, spine.closed, Math.max(0.2, p.res));
        if (base.length < 2) continue;
        const closed = !!spine.closed;
        const pts2 = closed ? [...base, base[0]] : base;

        /* arc-length table */
        const cum = [0];
        for (let i = 1; i < pts2.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts2[i][0] - pts2[i - 1][0], pts2[i][1] - pts2[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 1) continue;

        /* position + unit tangent at arc-length s */
        const at = (s) => {
          if (closed) { s = ((s % total) + total) % total; }
          else { s = Math.max(0, Math.min(total, s)); }
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = pts2[lo][0] + (pts2[hi][0] - pts2[lo][0]) * f;
          const y = pts2[lo][1] + (pts2[hi][1] - pts2[lo][1]) * f;
          let tx = pts2[hi][0] - pts2[lo][0], ty = pts2[hi][1] - pts2[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };

        /* one pass lays out chars starting at arc-length s0 */
        const layout = (s0) => {
          let cursor = s0;
          for (const ch of chars) {
            const g = F[ch] || F[" "];
            const adv = glyphW(ch);
            /* place glyph centered on its own advance so rotation looks even */
            const glyphCenter = cursor + adv / 2;
            const [cx, cy, tx, ty] = at(glyphCenter);
            /* tangent (reading direction) and normal */
            let dx = tx, dy = ty, nx = -ty, ny = tx;
            if (flip) { dx = -dx; dy = -dy; nx = -nx; ny = -ny; }
            /* glyph local origin: left edge of glyph body, baseline at y=10*sc.
               We want the glyph's own left edge at (cursor) along the path and
               its baseline shifted by p.baseline along the normal. Local x measured
               from glyph left; recenter so text advance aligns with path arc-length. */
            const halfAdv = adv / 2;
            for (const stroke of g.s) {
              if (stroke.length < 2) continue;
              const outPts = stroke.map(([gx, gy]) => {
                /* local coords in mm: lx along reading dir (0..adv), ly up/down.
                   baseline of font is gy=10 (bottom); shift so baseline sits on path. */
                const lx = gx * sc - halfAdv;              /* center glyph on its advance */
                const ly = (gy * sc - 10 * sc) + p.baseline; /* 0 at baseline, negative = up */
                return [
                  cx + dx * lx + nx * ly,
                  cy + dy * lx + ny * ly,
                ];
              });
              paths.push({ pts: outPts, closed: false, layer: L });
            }
            cursor += adv;
          }
          return cursor;
        };

        if (p.repeat) {
          const stride = oneW + Math.max(0, p.gap);
          let s = (p.startPct / 100) * total;
          /* how many fit */
          const room = closed ? total : (total - s);
          let n = Math.max(1, Math.floor((room + Math.max(0, p.gap)) / stride));
          if (closed) n = Math.max(1, Math.floor(total / stride));
          for (let k = 0; k < n; k++) layout(s + k * stride);
        } else {
          let s0;
          if (p.startPct !== 0) {
            s0 = (p.startPct / 100) * total;
          } else if (p.align === "Center") {
            s0 = (total - oneW) / 2;
          } else if (p.align === "End") {
            s0 = total - oneW;
          } else {
            s0 = 0;
          }
          layout(s0);
        }
      }

      return applyStyle({ paths }, ins[1]);
    },
  },
  lace: {
    name: "Lace",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Pattern", type: "select", options: ["Doily", "Edging", "Mesh ground"], def: "Doily" },
      { key: "rings", label: "Rings (doily)", type: "slider", min: 1, max: 10, step: 1, def: 5 },
      { key: "sectors", label: "Sectors / scallops", type: "slider", min: 4, max: 40, step: 1, def: 16 },
      { key: "detail", label: "Detail", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "picots", label: "Picots", type: "check", def: true },
      { key: "depth", label: "Depth mm (edging)", type: "slider", min: 10, max: 80, step: 1, def: 30 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 7 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const S = Math.max(4, Math.min(64, Math.round(p.sectors)));
      const det = Math.max(0, Math.min(1, p.detail));
      const TWO = Math.PI * 2;
      const paths = [];
      const circleAt = (cx, cy, r, n) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TWO;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        paths.push({ pts, closed: true, layer: L });
      };

      /* ============================ DOILY ============================ */
      if (p.mode === "Doily") {
        const cx = W / 2, cy = H / 2;
        const maxR = Math.min(W, H) / 2 - m;
        if (maxR < 12) return applyStyle({ paths: [] }, ins[0]);
        const P = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        const picotR = p.picots ? Math.min(2.4, Math.max(1, maxR * 0.028)) : 0;
        const scH = Math.max(4, Math.min(15, maxR * 0.15));
        const outerBase = maxR - 2 * picotR - scH;

        /* --- center flower --- */
        const fR = maxR * 0.2;
        const np = Math.min(16, Math.max(5, Math.round(S / 2)));
        const NN = 9;
        for (let j = 0; j < np; j++) {
          const a = (j / np) * TWO;
          const ca = Math.cos(a), sa = Math.sin(a);
          const wid = fR * 0.5;
          const pts = [];
          for (let i = 0; i <= NN; i++) {
            const u = i / NN, t = u * fR, rad = Math.sin(Math.PI * u) * wid * 0.5;
            pts.push([cx + ca * t - sa * rad, cy + sa * t + ca * rad]);
          }
          for (let i = NN - 1; i >= 1; i--) {
            const u = i / NN, t = u * fR, rad = -Math.sin(Math.PI * u) * wid * 0.5;
            pts.push([cx + ca * t - sa * rad, cy + sa * t + ca * rad]);
          }
          paths.push({ pts, closed: true, layer: L });
        }
        circleAt(cx, cy, fR * 0.22, 12);

        /* --- ring bands with hashed classic motifs --- */
        const rIn = fR * 1.3;
        const availB = outerBase - rIn - 2;
        const K = Math.max(0, Math.min(10, Math.round(p.rings)));
        if (availB > 6 && K > 0) {
          const bh = availB / K;
          for (let k = 0; k < K; k++) {
            const r0 = rIn + k * bh + 0.8;
            const r1 = rIn + (k + 1) * bh - 0.8;
            if (r1 - r0 < 1.5) continue;
            const rm = (r0 + r1) / 2;
            const pick = hash2(k * 13 + 2, 5, p.seed);
            if (pick < 0.16) {
              /* plain ring */
              circleAt(cx, cy, rm, Math.max(48, S * 5));
            } else if (pick < 0.32) {
              /* double ring */
              circleAt(cx, cy, r0 + (r1 - r0) * 0.25, Math.max(48, S * 5));
              circleAt(cx, cy, r0 + (r1 - r0) * 0.75, Math.max(48, S * 5));
            } else if (pick < 0.56) {
              /* zigzag mesh: two opposite-phase rings -> diamonds */
              const M = S * 2;
              for (let ph = 0; ph < 2; ph++) {
                const pts = [];
                for (let i = 0; i < M; i++) {
                  const r = (i + ph) % 2 ? r1 : r0;
                  pts.push(P(r, (i / M) * TWO));
                }
                paths.push({ pts, closed: true, layer: L });
              }
            } else if (pick < 0.8) {
              /* fans: per-sector spokes + outer arc */
              const st = TWO / S;
              const nf = 3 + Math.round(det * 4);
              for (let s = 0; s < S; s++) {
                const a0 = s * st, ac = a0 + st / 2;
                const piv = P(r0, ac);
                for (let j = 0; j < nf; j++) {
                  const aj = a0 + (0.12 + 0.76 * (nf === 1 ? 0.5 : j / (nf - 1))) * st;
                  paths.push({ pts: [piv.slice(), P(r1 - 0.3, aj)], closed: false, layer: L });
                }
                const arc = [];
                for (let j = 0; j <= 8; j++) {
                  arc.push(P(r1 - 0.3, a0 + (0.12 + 0.76 * (j / 8)) * st));
                }
                paths.push({ pts: arc, closed: false, layer: L });
              }
            } else {
              /* picot ring: circle with tiny outward loops */
              circleAt(cx, cy, rm, Math.max(48, S * 5));
              let pr = Math.min(2.2, Math.max(0.8, (r1 - r0) * 0.3));
              pr = Math.min(pr, (r1 - rm) / 2);
              if (pr > 0.4) {
                for (let s = 0; s < S; s++) {
                  const a = ((s + 0.5) / S) * TWO;
                  const c = P(rm + pr, a);
                  circleAt(c[0], c[1], pr, 8);
                }
              }
            }
          }
        }

        /* --- outer scalloped edge (classic finish) --- */
        circleAt(cx, cy, outerBase, Math.max(48, S * 5));
        const J = 10;
        const sc = [];
        for (let s = 0; s < S; s++) {
          for (let j = 0; j < J; j++) {
            const u = j / J;
            const a = ((s + u) / S) * TWO;
            const rad = outerBase + scH * Math.pow(Math.sin(Math.PI * u), 1.15);
            sc.push(P(rad, a));
          }
        }
        paths.push({ pts: sc, closed: true, layer: L });
        if (picotR > 0) {
          for (let s = 0; s < S; s++) {
            const a = ((s + 0.5) / S) * TWO;
            const c = P(maxR - picotR, a);
            circleAt(c[0], c[1], picotR, 10);
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ============================ EDGING ============================ */
      if (p.mode === "Edging") {
        const x0 = m, x1 = W - m;
        if (x1 - x0 < 20) return applyStyle({ paths: [] }, ins[0]);
        const y0 = m;
        const Dmax = H - 2 * m;
        let pr = p.picots ? 2 : 0;
        let D = Math.min(Math.max(10, p.depth), Dmax) - 2 * pr;
        if (D < 10) { pr = 0; D = Math.min(Math.max(8, p.depth), Dmax); }
        if (D < 8) return applyStyle({ paths: [] }, ins[0]);

        /* header lines */
        paths.push({ pts: [[x0, y0], [x1, y0]], closed: false, layer: L });
        paths.push({ pts: [[x0, y0 + 1.8], [x1, y0 + 1.8]], closed: false, layer: L });

        /* mesh strip: two opposite-phase zigzags */
        const yA = y0 + 3.5;
        const yB = yA + Math.max(4, D * 0.25);
        const M2 = S * 2;
        for (let ph = 0; ph < 2; ph++) {
          const pts = [];
          for (let i = 0; i <= M2; i++) {
            const x = x0 + (i / M2) * (x1 - x0);
            pts.push([x, (i + ph) % 2 ? yB : yA]);
          }
          paths.push({ pts, closed: false, layer: L });
        }

        /* scallops with fans + picots */
        const yb = yB + 2;
        const ybot = y0 + 3.5 + D;
        if (ybot - yb > 4) {
          const wSc = (x1 - x0) / S;
          const J = 12;
          const chain = [];
          for (let s = 0; s < S; s++) {
            for (let j = 0; j <= (s === S - 1 ? J : J - 1); j++) {
              const u = j / J;
              const x = x0 + ((s + u) / S) * (x1 - x0);
              const y = yb + (ybot - yb) * Math.pow(Math.sin(Math.PI * u), 1.1);
              chain.push([x, y]);
            }
          }
          paths.push({ pts: chain, closed: false, layer: L });
          const nf = 3 + Math.round(det * 4);
          for (let s = 0; s < S; s++) {
            const xs = x0 + s * wSc;
            const piv = [xs + wSc / 2, yb + 0.5];
            for (let j = 0; j < nf; j++) {
              const u = 0.15 + 0.7 * (nf === 1 ? 0.5 : j / (nf - 1));
              const x = xs + u * wSc;
              const y = yb + (ybot - yb) * Math.pow(Math.sin(Math.PI * u), 1.1);
              paths.push({ pts: [piv.slice(), [x, y - 0.4]], closed: false, layer: L });
            }
            if (pr > 0) {
              const cxp = xs + wSc / 2;
              circleAt(cxp, ybot + pr, pr, 10);
            }
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ========================= MESH GROUND ========================= */
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const g = 3.5 + (1 - det) * 9;
      const cs = g * Math.SQRT2;
      /* diagonal families clipped to rect */
      const clipLine = (sign) => {
        /* sign +1: x + y = c ; sign -1: x - y = c */
        const cMin = sign > 0 ? x0 + y0 : x0 - y1;
        const cMax = sign > 0 ? x1 + y1 : x1 - y0;
        for (let c = cMin + cs / 2; c < cMax; c += cs) {
          const cand = [];
          const tryPt = (x, y) => {
            if (x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6) cand.push([x, y]);
          };
          if (sign > 0) {
            tryPt(x0, c - x0); tryPt(x1, c - x1); tryPt(c - y0, y0); tryPt(c - y1, y1);
          } else {
            tryPt(x0, x0 - c); tryPt(x1, x1 - c); tryPt(c + y0, y0); tryPt(c + y1, y1);
          }
          /* dedupe + take extremes */
          const uniq = [];
          for (const q of cand) {
            if (!uniq.some((u) => Math.abs(u[0] - q[0]) < 1e-6 && Math.abs(u[1] - q[1]) < 1e-6)) uniq.push(q);
          }
          if (uniq.length >= 2) {
            uniq.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const a = uniq[0], b = uniq[uniq.length - 1];
            if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) {
              paths.push({ pts: [a, b], closed: false, layer: L });
            }
          }
        }
      };
      clipLine(1); clipLine(-1);
      /* torchon spiders */
      const nx = Math.floor((x1 - x0) / cs), ny = Math.floor((y1 - y0) / cs);
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          if (hash2(i * 3 + 1, j * 3 + 2, p.seed) >= det * 0.45) continue;
          const cxx = x0 + (i + 0.5) * cs, cyy = y0 + (j + 0.5) * cs;
          const d = g * 0.42;
          if (cxx - d < x0 || cxx + d > x1 || cyy - d < y0 || cyy + d > y1) continue;
          paths.push({
            pts: [[cxx + d, cyy], [cxx, cyy + d], [cxx - d, cyy], [cxx, cyy - d]],
            closed: true, layer: L,
          });
          paths.push({ pts: [[cxx - d * 0.55, cyy], [cxx + d * 0.55, cyy]], closed: false, layer: L });
          paths.push({ pts: [[cxx, cyy - d * 0.55], [cxx, cyy + d * 0.55]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },
  macrame: {
    name: "Macrame",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "pattern", label: "Pattern", type: "select", options: ["Alternating net", "Diamonds", "Sinnet columns"], def: "Alternating net" },
      { key: "cords", label: "Cords", type: "slider", min: 4, max: 40, step: 2, def: 12 },
      { key: "rows", label: "Knot rows", type: "slider", min: 1, max: 40, step: 1, def: 9 },
      { key: "knot", label: "Knot size mm", type: "slider", min: 1, max: 10, step: 0.25, def: 3 },
      { key: "fringe", label: "Fringe mm", type: "slider", min: 0, max: 80, step: 1, def: 25 },
      { key: "wiggle", label: "Fringe wiggle", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "bar", label: "Top bar + loops", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 11 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      let N = Math.max(4, Math.min(40, Math.round(p.cords)));
      N -= N % 2;
      const kd = Math.max(0.5, Math.min(12, p.knot));
      const x0 = m, x1 = W - m;
      if (x1 - x0 < N * 2) return applyStyle({ paths: [] }, ins[0]);
      const xi = (i) => x0 + ((i + 0.5) / N) * (x1 - x0);

      const ybar = m + 2;
      const yTop = ybar + (p.bar ? 4 : 1);
      const fringe = Math.max(0, p.fringe);
      const avail = H - m - yTop - fringe - 2;
      let R = Math.max(1, Math.min(40, Math.round(p.rows)));
      if (avail < R * Math.max(2, kd)) {
        R = Math.max(1, Math.floor(avail / Math.max(2, kd)));
      }
      if (avail < 4) return applyStyle({ paths: [] }, ins[0]);
      const rowH = avail / R;
      const yRow = (r) => yTop + (r + 0.5) * rowH;

      /* which adjacent-cord pairs get a knot on row r (pair = left cord index) */
      const pairsAt = (r) => {
        const out = [];
        if (p.pattern === "Sinnet columns") {
          for (let i = 0; i + 1 < N; i += 2) out.push(i);
        } else if (p.pattern === "Diamonds") {
          const T = Math.max(2, N - 2);
          const rr = r % T;
          const cand = [rr, N - 2 - rr].filter((v) => v >= 0 && v + 1 < N);
          cand.sort((a, b) => a - b);
          let last = -9;
          for (const c of cand) {
            if (c - last >= 2) { out.push(c); last = c; }
          }
        } else {
          /* alternating net */
          for (let i = r % 2; i + 1 < N; i += 2) out.push(i);
        }
        return out;
      };

      const paths = [];
      /* per-cord routing through its knots */
      const cordPts = Array.from({ length: N }, (_, c) => [[xi(c), p.bar ? ybar + 1.2 : ybar]]);
      const knots = []; /* [kx, ky] */
      for (let r = 0; r < R; r++) {
        const y = yRow(r);
        for (const i of pairsAt(r)) {
          const kx = (xi(i) + xi(i + 1)) / 2;
          knots.push([kx, y]);
          /* cords pinch into the knot and out below it */
          const off = kd * 0.2;
          cordPts[i].push([kx - off, y - kd * 0.5], [kx - off, y + kd * 0.5]);
          cordPts[i + 1].push([kx + off, y - kd * 0.5], [kx + off, y + kd * 0.5]);
        }
      }
      /* finish cords + fringe */
      const yF0 = yTop + R * rowH + 1;
      for (let c = 0; c < N; c++) {
        const pts = cordPts[c];
        const lastX = pts[pts.length - 1][0];
        pts.push([lastX, yF0]);
        if (fringe > 1) {
          const fl = Math.min(fringe, H - m - yF0);
          const steps = Math.max(2, Math.round(fl / 2));
          for (let s = 1; s <= steps; s++) {
            const yy = yF0 + (s / steps) * fl;
            const wx = (noise2(yy * 0.25, c * 7.13, p.seed) - 0.5) * 2 * p.wiggle * 2.5;
            pts.push([lastX + wx, yy]);
          }
        }
        if (pts.length >= 2) paths.push({ pts, closed: false, layer: L });
      }
      /* knot ovals + wrap line */
      for (const [kx, ky] of knots) {
        const rx = kd * 0.55, ry = kd * 0.42;
        const pts = [];
        for (let q = 0; q < 12; q++) {
          const a = (q / 12) * Math.PI * 2;
          pts.push([kx + Math.cos(a) * rx, ky + Math.sin(a) * ry]);
        }
        paths.push({ pts, closed: true, layer: L });
        paths.push({ pts: [[kx - rx * 0.55, ky], [kx + rx * 0.55, ky]], closed: false, layer: L });
      }
      /* top bar with lark's head loops */
      if (p.bar) {
        paths.push({ pts: [[x0, ybar], [x1, ybar]], closed: false, layer: L });
        for (let c = 0; c < N; c++) {
          const cxx = xi(c);
          const pts = [];
          for (let q = 0; q < 10; q++) {
            const a = (q / 10) * Math.PI * 2;
            pts.push([cxx + Math.cos(a) * 1.1, ybar + Math.sin(a) * 1.1]);
          }
          paths.push({ pts, closed: true, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },
  mathknot: {
    name: "Knot",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "type", label: "Type", type: "select", options: ["Torus p·q", "Lissajous"], def: "Torus p·q" },
      { key: "fp", label: "p (freq 1)", type: "slider", min: 1, max: 12, step: 1, def: 2 },
      { key: "fq", label: "q (freq 2)", type: "slider", min: 1, max: 12, step: 1, def: 3 },
      { key: "fz", label: "Freq Z (Lissajous)", type: "slider", min: 1, max: 12, step: 1, def: 7 },
      { key: "tube", label: "Tube (torus)", type: "slider", min: 0.1, max: 0.9, step: 0.05, def: 0.5 },
      { key: "gap", label: "Crossing gap mm", type: "slider", min: 0, max: 8, step: 0.1, def: 2.2 },
      { key: "step", label: "Sample step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "rot", label: "Rotate °", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed (Lissajous)", type: "seed", def: 5 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const availW = W - 2 * m, availH = H - 2 * m;
      if (availW < 10 || availH < 10) return applyStyle({ paths: [] }, ins[0]);

      const fp = Math.max(1, Math.min(12, Math.round(p.fp)));
      const fq = Math.max(1, Math.min(12, Math.round(p.fq)));
      const fz = Math.max(1, Math.min(12, Math.round(p.fz)));
      const tube = Math.max(0.05, Math.min(0.95, p.tube));
      const step = Math.max(0.25, p.step);
      const n = Math.max(240, Math.min(1600, Math.round(720 / step)));
      const TWO = Math.PI * 2;

      /* --- sample the 3D curve --- */
      const rng = mulberry32(p.seed * 7919 + 13);
      const ph1 = rng() * TWO, ph2 = rng() * TWO, ph3 = rng() * TWO;
      const rr = p.rot * Math.PI / 180;
      const cr = Math.cos(rr), sr = Math.sin(rr);
      const xs = new Float64Array(n), ys = new Float64Array(n), zs = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) / n) * TWO;
        let x, y, z;
        if (p.type === "Lissajous") {
          x = Math.cos(fp * t + ph1);
          y = Math.cos(fq * t + ph2);
          z = Math.cos(fz * t + ph3);
        } else {
          const rad = 1 + tube * Math.cos(fq * t);
          x = rad * Math.cos(fp * t);
          y = rad * Math.sin(fp * t);
          z = tube * Math.sin(fq * t);
        }
        xs[i] = x * cr - y * sr;
        ys[i] = x * sr + y * cr;
        zs[i] = z;
      }

      /* --- fit to canvas --- */
      let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
      for (let i = 0; i < n; i++) {
        if (xs[i] < bx0) bx0 = xs[i]; if (xs[i] > bx1) bx1 = xs[i];
        if (ys[i] < by0) by0 = ys[i]; if (ys[i] > by1) by1 = ys[i];
      }
      const bw = (bx1 - bx0) || 1, bh = (by1 - by0) || 1;
      const sc = Math.min(availW / bw, availH / bh);
      const ox = m + (availW - bw * sc) / 2 - bx0 * sc;
      const oy = m + (availH - bh * sc) / 2 - by0 * sc;
      const pts = [];
      for (let i = 0; i < n; i++) pts.push([xs[i] * sc + ox, ys[i] * sc + oy]);

      /* --- arc-length table --- */
      const segLen = new Float64Array(n);
      const cum = new Float64Array(n);
      let total = 0;
      for (let i = 0; i < n; i++) {
        cum[i] = total;
        const j = (i + 1) % n;
        segLen[i] = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
        total += segLen[i];
      }
      if (total < 2) return applyStyle({ paths: [] }, ins[0]);

      /* --- find planar self-intersections, cut the strand that is UNDER --- */
      const gapHalf = Math.max(0, p.gap) / 2;
      const cuts = [];
      if (gapHalf > 0.01) {
        for (let i = 0; i < n; i++) {
          const i2 = (i + 1) % n;
          const ax = pts[i][0], ay = pts[i][1];
          const bx = pts[i2][0], by = pts[i2][1];
          const ix0 = Math.min(ax, bx), ix1 = Math.max(ax, bx);
          const iy0 = Math.min(ay, by), iy1 = Math.max(ay, by);
          for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue; /* adjacent around the wrap */
            const j2 = (j + 1) % n;
            const cx = pts[j][0], cy = pts[j][1];
            const dx = pts[j2][0], dy = pts[j2][1];
            /* bbox reject */
            if (Math.max(cx, dx) < ix0 || Math.min(cx, dx) > ix1) continue;
            if (Math.max(cy, dy) < iy0 || Math.min(cy, dy) > iy1) continue;
            const rX = bx - ax, rY = by - ay;
            const sX = dx - cx, sY = dy - cy;
            const den = rX * sY - rY * sX;
            if (Math.abs(den) < 1e-12) continue;
            const qpX = cx - ax, qpY = cy - ay;
            const t = (qpX * sY - qpY * sX) / den;
            const u = (qpX * rY - qpY * rX) / den;
            if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
            const za = zs[i] + (zs[i2] - zs[i]) * t;
            const zb = zs[j] + (zs[j2] - zs[j]) * u;
            if (Math.abs(za - zb) < 1e-9) continue; /* grazing: leave uncut */
            const s = za < zb ? cum[i] + t * segLen[i] : cum[j] + u * segLen[j];
            cuts.push(s);
          }
        }
      }

      if (!cuts.length) {
        return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);
      }

      /* --- drop vertices within gap/2 (arc distance) of each under-cut --- */
      const kept = new Uint8Array(n).fill(1);
      const circD = (a, b) => {
        let d = Math.abs(a - b);
        return Math.min(d, total - d);
      };
      for (const s of cuts) {
        /* binary search: lo = last vertex with cum <= s */
        let lo = 0, hi = n - 1;
        if (cum[hi] <= s) { lo = hi; hi = 0; }
        else {
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
        }
        /* walk forward from the vertex after s */
        let j = (lo + 1) % n, guard = 0;
        while (guard++ < n && circD(cum[j], s) < gapHalf) { kept[j] = 0; j = (j + 1) % n; }
        /* walk backward from the vertex before/at s */
        j = lo; guard = 0;
        while (guard++ < n && circD(cum[j], s) < gapHalf) { kept[j] = 0; j = (j - 1 + n) % n; }
      }

      /* --- collect circular runs of kept vertices --- */
      let allKept = true, noneKept = true;
      for (let i = 0; i < n; i++) {
        if (kept[i]) noneKept = false; else allKept = false;
      }
      if (noneKept) return applyStyle({ paths: [] }, ins[0]);
      if (allKept) return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);

      const paths = [];
      for (let i = 0; i < n; i++) {
        const prev = (i - 1 + n) % n;
        if (!kept[i] || kept[prev]) continue; /* run starts where prev was cut */
        const run = [];
        let j = i, guard = 0;
        while (kept[j] && guard <= n) {
          run.push(pts[j].slice());
          j = (j + 1) % n; guard++;
        }
        if (run.length >= 2) paths.push({ pts: run, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },
  murmuration: {
    name: "Murmuration",
    cat: "gen",
    group: "creatures",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "birds", label: "Birds", type: "slider", min: 10, max: 600, step: 1, def: 220 },
      { key: "time", label: "Time (wire Frame t)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "travel", label: "Travel range", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "path", label: "Flock path", type: "select", options: ["Wander", "Oval", "Figure-8", "Lissajous 2:3", "Trefoil"], def: "Wander" },
      { key: "wander", label: "Wander mix (guide paths)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "spread", label: "Flock radius mm", type: "slider", min: 10, max: 150, step: 1, def: 55 },
      { key: "pulse", label: "Pulse (breathing)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "swirl", label: "Swirl turns / loop", type: "slider", min: -3, max: 3, step: 1, def: 1 },
      { key: "scatter", label: "Scatter mm", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "stretch", label: "Stretch along travel", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "shape", label: "Bird shape", type: "select", options: ["Dash", "Chevron", "Dot"], def: "Chevron" },
      { key: "size", label: "Bird size mm", type: "slider", min: 0.5, max: 6, step: 0.1, def: 1.8 },
      { key: "trail", label: "Trail mm", type: "slider", min: 0, max: 25, step: 0.5, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 3 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);

      const TWO = Math.PI * 2;
      const seed = p.seed;
      const N = Math.max(1, Math.min(800, Math.round(p.birds)));
      const tt = ((p.time % 1) + 1) % 1; /* wrap so Frame frame# also animates */
      const spread = Math.max(1, p.spread);
      const scatter = Math.max(0, p.scatter);
      const turns = Math.round(Math.max(-6, Math.min(6, p.swirl))); /* integer -> seamless loop */
      const travel = Math.max(0, Math.min(1, p.travel));
      const stretchAmt = Math.max(0, Math.min(1, p.stretch));

      /* All time-varying terms sample noise on a circle: cos/sin(2πt).
         Anything periodic in t by construction => t=0 and t=1 identical
         => seamless animation loops. */
      const cW = (W / 2), cH = (H / 2);
      const travX = Math.max(0, (x1 - x0) / 2 - spread * 0.35) * travel;
      const travY = Math.max(0, (y1 - y0) / 2 - spread * 0.35) * travel;

      const flockCenter = (t) => {
        const a = TWO * t, c = Math.cos(a), s = Math.sin(a);
        /* loop-noise wander (periodic in t by circular sampling) */
        const nx = (noise2(c * 1.7 + 3.1, s * 1.7 + 7.7, seed + 11) - 0.5) * 2;
        const ny = (noise2(c * 1.7 + 13.9, s * 1.7 + 2.3, seed + 29) - 0.5) * 2;
        if (p.path === "Oval" || p.path === "Figure-8" || p.path === "Lissajous 2:3" || p.path === "Trefoil") {
          /* closed guide curves, all 2π-periodic => loop stays seamless */
          let gx, gy;
          if (p.path === "Oval") { gx = c; gy = s; }
          else if (p.path === "Figure-8") { gx = c; gy = Math.sin(2 * a) * 0.9; }
          else if (p.path === "Lissajous 2:3") { gx = Math.sin(2 * a); gy = Math.sin(3 * a); }
          else { const r3 = (1 + 0.38 * Math.cos(3 * a)) / 1.38; gx = c * r3; gy = s * r3; }
          const wmix = 0.35 * Math.max(0, Math.min(1, p.wander));
          return [cW + (gx * (1 - wmix) + nx * wmix) * travX,
                  cH + (gy * (1 - wmix) + ny * wmix) * travY];
        }
        /* Wander: original behavior, unchanged for existing patches */
        return [cW + nx * travX, cH + ny * travY];
      };

      /* per-bird stable hashes */
      const birdsArr = [];
      for (let i = 0; i < N; i++) {
        birdsArr.push({
          a0: hash2(i, 3, seed) * TWO,
          r0: Math.sqrt(hash2(i, 5, seed)),        /* sqrt -> uniform disc */
          sz: Math.max(0.2, p.size) * (0.55 + 0.9 * hash2(i, 21, seed)), /* depth illusion */
          o1: hash2(i, 11, seed) * 47, o2: hash2(i, 12, seed) * 47,
          o3: hash2(i, 13, seed) * 47, o4: hash2(i, 14, seed) * 47,
          o5: hash2(i, 15, seed) * 47, o6: hash2(i, 16, seed) * 47,
        });
      }

      const posAt = (t, h) => {
        const a = TWO * t, c = Math.cos(a), s = Math.sin(a);
        const fc = flockCenter(t);
        /* flock travel direction (for elongation) */
        const pA = flockCenter(t - 0.012), pB = flockCenter(t + 0.012);
        let vx = pB[0] - pA[0], vy = pB[1] - pA[1];
        const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
        /* swirling polar offset + global breathing pulse */
        const ang = h.a0 + turns * TWO * t
          + (noise2(c * 1.1 + h.o1, s * 1.1 + h.o2, seed + 5) - 0.5) * 2.5;
        const pul = 1 + p.pulse * 0.7 * ((noise2(c * 0.9 + 31, s * 0.9 + 17, seed + 41) - 0.5) * 2);
        const rad = h.r0 * spread * pul;
        let ox = Math.cos(ang) * rad, oy = Math.sin(ang) * rad;
        /* elongate along travel, squash across it */
        const along = ox * vx + oy * vy;
        const perp = -ox * vy + oy * vx;
        const stA = 1 + stretchAmt * 0.9, stP = 1 / (1 + stretchAmt * 0.45);
        ox = vx * along * stA - vy * perp * stP;
        oy = vy * along * stA + vx * perp * stP;
        /* individual wander */
        ox += (noise2(c * 2.3 + h.o3, s * 2.3 + h.o4, seed + 7) - 0.5) * 2 * scatter;
        oy += (noise2(c * 2.3 + h.o5, s * 2.3 + h.o6, seed + 9) - 0.5) * 2 * scatter;
        return [fc[0] + ox, fc[1] + oy];
      };

      const inside = (q) => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1;
      /* glyph reach beyond the bird position, per shape */
      const reachOf = (sz) => p.shape === "Chevron" ? sz * 1.4 : p.shape === "Dash" ? sz * 0.55 : Math.max(0.25, sz * 0.28) + 0.05;
      const insideR = (q, r) => q[0] >= x0 + r && q[0] <= x1 - r && q[1] >= y0 + r && q[1] <= y1 - r;
      const paths = [];
      const trailMm = Math.max(0, p.trail);

      for (const h of birdsArr) {
        const pos = posAt(tt, h);
        if (!insideR(pos, reachOf(h.sz))) continue;
        /* heading from the closed-form derivative (periodic, so loop-safe) */
        const e = 0.002;
        const pA = posAt(tt - e, h), pB = posAt(tt + e, h);
        let dx = pB[0] - pA[0], dy = pB[1] - pA[1];
        const dl = Math.hypot(dx, dy);
        if (dl > 1e-9) { dx /= dl; dy /= dl; } else { dx = 1; dy = 0; }

        /* trail: flight history, oldest -> head so pen travels in flight direction */
        if (trailMm > 0.5) {
          const tp = [pos];
          let tcur = tt, acc = 0, guard = 0;
          const dt = 0.0035;
          while (acc < trailMm && guard++ < 36) {
            const prev = posAt(tcur - dt, h);
            if (!inside(prev)) break;
            acc += Math.hypot(prev[0] - tp[0][0], prev[1] - tp[0][1]);
            tp.unshift(prev);
            tcur -= dt;
          }
          if (tp.length >= 2) paths.push({ pts: tp, closed: false, layer: L });
        }

        const sz = h.sz;
        if (p.shape === "Dash") {
          paths.push({
            pts: [[pos[0] - dx * sz / 2, pos[1] - dy * sz / 2], [pos[0] + dx * sz / 2, pos[1] + dy * sz / 2]],
            closed: false, layer: L,
          });
        } else if (p.shape === "Dot") {
          const r = Math.max(0.25, sz * 0.28);
          const pts = [];
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * TWO;
            pts.push([pos[0] + Math.cos(a) * r, pos[1] + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: true, layer: L });
        } else {
          /* Chevron: tiny V opening backwards -- the classic distant-starling glyph.
             One 3-point stroke: wingtip -> head -> wingtip (single pen-down). */
          const hx = pos[0] + dx * sz * 0.35, hy = pos[1] + dy * sz * 0.35;
          const wa = 2.65; /* ~152 deg back from heading */
          const c1 = Math.cos(wa), s1 = Math.sin(wa);
          const w1 = [hx + (dx * c1 - dy * s1) * sz, hy + (dx * s1 + dy * c1) * sz];
          const w2 = [hx + (dx * c1 + dy * s1) * sz, hy + (-dx * s1 + dy * c1) * sz];
          paths.push({ pts: [w1, [hx, hy], w2], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },
  dazzle: {
    name: "Dazzle Camouflage",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "patches", label: "Patches", type: "slider", min: 2, max: 60, step: 1, def: 14 },
      { key: "spacing", label: "Stripe spacing mm", type: "slider", min: 1, max: 12, step: 0.25, def: 3 },
      { key: "jitter", label: "Angle jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "blank", label: "Blank patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "cross", label: "Cross-hatch patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
      { key: "wavy", label: "Wavy patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
      { key: "outline", label: "Patch outlines", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 17 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);

      const rng = mulberry32((p.seed | 0) * 2654435761 + 7);
      const target = Math.max(1, Math.min(80, Math.round(p.patches)));
      const sp = Math.max(0.8, p.spacing);
      const MINAREA = Math.max(60, sp * sp * 6);

      /* --- recursive BSP: split the largest convex patch with a random chord --- */
      const area = (poly) => Math.abs(signedArea(poly));
      const centroid = (poly) => {
        let cx = 0, cy = 0;
        for (const q of poly) { cx += q[0]; cy += q[1]; }
        return [cx / poly.length, cy / poly.length];
      };
      const splitConvex = (poly, px, py, ang) => {
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        const d = nx * px + ny * py;
        const A = [], B = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          const a = poly[i], b = poly[(i + 1) % n];
          const da = nx * a[0] + ny * a[1] - d;
          const db = nx * b[0] + ny * b[1] - d;
          if (da >= -1e-9) A.push(a);
          if (da <= 1e-9) B.push(a);
          if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
            const t = da / (da - db);
            const ip = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            A.push(ip); B.push(ip);
          }
        }
        return [A, B];
      };

      let polys = [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
      let guard = 0;
      while (polys.length < target && guard++ < 400) {
        /* pick largest patch */
        let bi = 0, ba = -1;
        for (let i = 0; i < polys.length; i++) {
          const a = area(polys[i]);
          if (a > ba) { ba = a; bi = i; }
        }
        if (ba < MINAREA * 2.2) break; /* nothing big enough left to split */
        const poly = polys[bi];
        const [ccx, ccy] = centroid(poly);
        const px = ccx + (rng() - 0.5) * Math.sqrt(ba) * 0.4;
        const py = ccy + (rng() - 0.5) * Math.sqrt(ba) * 0.4;
        const ang = rng() * Math.PI;
        const [A, B] = splitConvex(poly, px, py, ang);
        if (A.length >= 3 && B.length >= 3 && area(A) > MINAREA && area(B) > MINAREA) {
          polys.splice(bi, 1, A, B);
        }
        /* else: retry with new random point/angle next iteration */
      }

      /* --- per-patch styling: clashing quantized angles --- */
      const paths = [];
      const clampRect = (q) => [
        Math.max(x0, Math.min(x1, q[0])),
        Math.max(y0, Math.min(y1, q[1])),
      ];
      const angleSteps = [0, 30, 60, 90, 120, 150];
      let prevIdx = -1;

      const hatch = (poly, phi, spacing, wavyAmp, wavePhase) => {
        const dx = Math.cos(phi), dy = Math.sin(phi);
        const nx = -dy, ny = dx;
        let cmin = Infinity, cmax = -Infinity;
        for (const q of poly) {
          const c = nx * q[0] + ny * q[1];
          if (c < cmin) cmin = c;
          if (c > cmax) cmax = c;
        }
        let rev = false;
        for (let c = cmin + spacing / 2; c < cmax; c += spacing) {
          /* intersect infinite line (n·q = c) with convex polygon edges */
          const hits = [];
          const n = poly.length;
          for (let i = 0; i < n; i++) {
            const a = poly[i], b = poly[(i + 1) % n];
            const da = nx * a[0] + ny * a[1] - c;
            const db = nx * b[0] + ny * b[1] - c;
            if ((da > 0 && db <= 0) || (da <= 0 && db > 0)) {
              const t = da / (da - db);
              hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
          }
          if (hits.length < 2) continue;
          hits.sort((u, v) => (u[0] * dx + u[1] * dy) - (v[0] * dx + v[1] * dy));
          let A = hits[0], B = hits[hits.length - 1];
          const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
          if (len < 0.6) continue;
          if (rev) { const t = A; A = B; B = t; } /* serpentine: pen-friendly */
          rev = !rev;
          if (wavyAmp > 0.05 && len > 4) {
            const K = Math.max(3, Math.round(len / 2));
            const pts = [];
            for (let k = 0; k <= K; k++) {
              const u = k / K;
              const bx = A[0] + (B[0] - A[0]) * u;
              const by = A[1] + (B[1] - A[1]) * u;
              const off = Math.sin(u * len * 0.9 + wavePhase + c * 0.3) * wavyAmp;
              pts.push(clampRect([bx + nx * off, by + ny * off]));
            }
            paths.push({ pts, closed: false, layer: L });
          } else {
            paths.push({ pts: [A, B], closed: false, layer: L });
          }
        }
      };

      for (let i = 0; i < polys.length; i++) {
        const poly = polys[i];
        if (poly.length < 3 || area(poly) < 1) continue;
        if (p.outline) {
          paths.push({ pts: poly.map((q) => q.slice()), closed: true, layer: L });
        }
        const h1 = hash2(i * 7 + 1, 3, p.seed);
        if (h1 < Math.max(0, Math.min(1, p.blank))) { prevIdx = -1; continue; }
        /* clashing angle: quantized palette, never repeat the previous patch */
        let ai = Math.floor(hash2(i * 7 + 2, 9, p.seed) * angleSteps.length) % angleSteps.length;
        if (ai === prevIdx) ai = (ai + 2) % angleSteps.length;
        prevIdx = ai;
        const jit = (hash2(i * 7 + 3, 11, p.seed) - 0.5) * 24 * Math.max(0, Math.min(1, p.jitter));
        const phi = ((angleSteps[ai] + jit) * Math.PI) / 180;
        const spLocal = sp * (0.75 + 0.5 * hash2(i * 7 + 4, 13, p.seed));
        const isWavy = hash2(i * 7 + 5, 15, p.seed) < Math.max(0, Math.min(1, p.wavy));
        const amp = isWavy ? Math.min(spLocal * 0.32, 1.6) : 0;
        const phase = hash2(i * 7 + 6, 17, p.seed) * Math.PI * 2;
        hatch(poly, phi, spLocal, amp, phase);
        if (hash2(i * 7 + 8, 19, p.seed) < Math.max(0, Math.min(1, p.cross))) {
          hatch(poly, phi + Math.PI / 2 + 0.12, spLocal * 1.4, 0, 0);
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },
  glitch_loom: {
    name: "Glitch Loom",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 42 },
      { key: "pitch", label: "Loom Pitch (mm)", type: "slider", min: 1, max: 20, step: 0.5, def: 6 },
      { key: "shift", label: "Max Warp Shift", type: "slider", min: 0, max: 60, step: 1, def: 20 },
      { key: "fray", label: "Fray Probability", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "fray_len", label: "Fray Length", type: "slider", min: 2, max: 40, step: 1, def: 12 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 48611 + 12345);
      const paths = [];
      const pitchVal = Math.max(0.5, p.pitch);
      const stepSize = Math.max(0.2, pitchVal / 6);
      /* the app does not clip out-of-canvas geometry, so the mod must:
         shifted rows and frayed threads are clamped to the sheet */
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));

      src.paths.forEach((path) => {
        const resampled = resample(path.pts, path.closed, stepSize);
        if (resampled.length < 2) return;
        let currentSegment = [];
        let lastRow = Math.floor(resampled[0][1] / pitchVal);
        const flush = (row) => {
          if (currentSegment.length < 2) { currentSegment = []; return; }
          const rowSeed = hash2(0, row, p.seed);
          const dx = (rowSeed - 0.5) * 2 * p.shift;
          const shiftedPts = currentSegment.map(([sx, sy]) => [clampX(sx + dx), sy]);
          paths.push({ pts: shiftedPts, closed: false, layer: path.layer });
          if (rng() < p.fray) {
            const lastPt = shiftedPts[shiftedPts.length - 1];
            const frayPts = [lastPt.slice()];
            const steps = 6;
            for (let k = 1; k <= steps; k++) {
              const t = k / steps;
              const fx = clampX(lastPt[0] + (noise2(lastPt[0] * 0.08, t * 3, p.seed + row) - 0.5) * 6);
              const fy = clampY(lastPt[1] + t * p.fray_len);
              frayPts.push([fx, fy]);
            }
            paths.push({ pts: frayPts, closed: false, layer: path.layer });
          }
          currentSegment = [];
        };
        for (let i = 0; i < resampled.length; i++) {
          const [x, y] = resampled[i];
          const currentRow = Math.floor(y / pitchVal);
          if (currentRow !== lastRow && currentSegment.length > 0) flush(lastRow);
          currentSegment.push([x, y]);
          lastRow = currentRow;
        }
        flush(lastRow);
      });
      return { paths };
    }
  },
  myco_net: {
    name: "Mycelial Net",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 9999 },
      { key: "hyphae", label: "Initial Spores", type: "slider", min: 1, max: 30, step: 1, def: 6 },
      { key: "length", label: "Growth Cycles", type: "slider", min: 10, max: 400, step: 10, def: 120 },
      { key: "branching", label: "Split Rate", type: "slider", min: 0.01, max: 0.25, step: 0.01, def: 0.06 },
      { key: "wander", label: "Wander", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "step", label: "Internode (mm)", type: "slider", min: 0.5, max: 6, step: 0.1, def: 2.0 },
      { key: "spawn", label: "Spawn Radius (mm)", type: "slider", min: 0, max: 80, step: 1, def: 8 },
      { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 6 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 19 + 7);
      const paths = [];
      const queue = [];
      const L = Math.round(p.layer);
      const stepLen = Math.max(0.2, p.step);

      const count = Math.max(1, Math.round(p.hyphae));
      const spawnR = Math.min(Math.max(0, p.spawn), Math.min(W, H) / 2 - m - 1);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const sx = W / 2 + Math.cos(angle) * spawnR;
        const sy = H / 2 + Math.sin(angle) * spawnR;
        queue.push({ x: sx, y: sy, angle, pts: [[sx, sy]] });
      }
      let steps = 0;
      const maxSteps = Math.round(p.length);
      const pointBudget = 60000;
      let generatedPoints = 0;
      /* incremental steering: turn by a noise-driven delta each step.
         (Blending raw angle VALUES with a 0..4pi field is not angle math
         and biases every tip toward the field's absolute magnitude.) */
      const turnRate = 0.25 + 1.1 * Math.max(0, Math.min(1, p.wander));

      while (queue.length > 0 && steps < maxSteps && generatedPoints < pointBudget) {
        const levelSize = queue.length;
        steps++;
        for (let i = 0; i < levelSize; i++) {
          const tip = queue.shift();
          if (!tip) continue;
          const drift = (noise2(tip.x * 0.012, tip.y * 0.012, p.seed) - 0.5) * 2;
          const nextAngle = tip.angle + drift * turnRate;
          const nx = tip.x + Math.cos(nextAngle) * stepLen;
          const ny = tip.y + Math.sin(nextAngle) * stepLen;
          if (nx < m || nx > W - m || ny < m || ny > H - m) {
            if (tip.pts.length > 1) paths.push({ pts: tip.pts, closed: false, layer: L });
            continue;
          }
          tip.pts.push([nx, ny]);
          generatedPoints++;
          if (rng() < p.branching && queue.length < 75) {
            const splitLeft = nextAngle + (rng() * 0.4 + 0.15);
            const splitRight = nextAngle - (rng() * 0.4 + 0.15);
            queue.push({ x: nx, y: ny, angle: splitLeft, pts: [[nx, ny]] });
            queue.push({ x: nx, y: ny, angle: splitRight, pts: [[nx, ny]] });
            paths.push({ pts: tip.pts, closed: false, layer: L });
          } else {
            queue.push({ x: nx, y: ny, angle: nextAngle, pts: tip.pts });
          }
        }
      }
      queue.forEach(tip => {
        if (tip.pts.length > 1) paths.push({ pts: tip.pts, closed: false, layer: L });
      });
      return applyStyle({ paths }, ins[0]);
    }
  },
  sand_line_hatch: {
    name: "Sand Line Hatch",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 1337 },
      { key: "lines", label: "Line Count", type: "slider", min: 10, max: 200, step: 1, def: 80 },
      { key: "density", label: "Max Density", type: "slider", min: 0.1, max: 1.0, step: 0.05, def: 0.7 },
      { key: "freq", label: "Noise Frequency", type: "slider", min: 0.001, max: 0.05, step: 0.001, def: 0.015 },
      { key: "grain_len", label: "Grain Length (mm)", type: "slider", min: 0.5, max: 5.0, step: 0.1, def: 1.5 },
      { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      if (W - 2 * m < 5 || H - 2 * m < 5) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 997 + 11);
      const paths = [];
      const L = Math.round(p.layer);
      const count = Math.round(p.lines);
      const grainSize = Math.max(0.2, p.grain_len);
      const dens = Math.max(0, Math.min(1, p.density));

      for (let i = 0; i < count; i++) {
        const y = m + ((H - 2 * m) * (i / (count - 1 || 1)));
        const lineSegs = [];
        let x = m;
        let runStart = null;
        while (x < W - m) {
          const noiseVal = noise2(x * p.freq, y * p.freq, p.seed);
          /* darkness = noise * density: density now scales ink amount correctly
             (the old rng()*density threshold was inverted: low density = MORE ink) */
          if (rng() < noiseVal * dens) {
            if (runStart === null) runStart = x;
            x = Math.min(x + grainSize, W - m);
          } else {
            if (runStart !== null && x - runStart > 0.1) {
              lineSegs.push([[runStart, y], [x, y]]); /* runs are collinear: 2 pts suffice */
            }
            runStart = null;
            x += grainSize * (0.5 + rng() * 0.5);
          }
        }
        if (runStart !== null && x - runStart > 0.1) {
          lineSegs.push([[runStart, y], [Math.min(x, W - m), y]]);
        }
        /* serpentine: alternate line direction so the pen never shuttles back empty */
        if (i % 2 === 1) {
          lineSegs.reverse();
          for (const seg of lineSegs) seg.reverse();
        }
        for (const seg of lineSegs) paths.push({ pts: seg, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  gravity_cascade: {
    name: "Gravity Cascade",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 888 },
      { key: "orbits", label: "Orbit Count", type: "slider", min: 5, max: 80, step: 1, def: 35 },
      { key: "steps", label: "Steps per Orbit", type: "slider", min: 100, max: 2000, step: 50, def: 800 },
      { key: "pull", label: "Gravity Strength", type: "slider", min: 0.1, max: 3.0, step: 0.1, def: 1.2 },
      { key: "damping", label: "Friction Decay", type: "slider", min: 0.0, max: 0.02, step: 0.001, def: 0.003 },
      { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 8 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 4321 + 93);
      const paths = [];
      const L = Math.round(p.layer);

      /* three gravity wells in a triangle; seed jitters the layout
         (previously rng was created but never used: seed had NO effect) */
      const jit = () => (rng() - 0.5) * Math.min(W, H) * 0.08;
      const centers = [
        [W * 0.5 + jit(), H * 0.3 + jit()],
        [W * 0.35 + jit(), H * 0.65 + jit()],
        [W * 0.65 + jit(), H * 0.65 + jit()]
      ];

      const orbitCount = Math.round(p.orbits);
      const maxSteps = Math.round(p.steps);
      const dt = 0.4;
      const BUDGET = 110000;
      let totalPts = 0;
      const inside = (x, y) => x >= m && x <= W - m && y >= m && y <= H - m;

      for (let o = 0; o < orbitCount && totalPts < BUDGET; o++) {
        const angle = (o / orbitCount) * Math.PI * 2;
        const shell = Math.min(W, H) * 0.25 * (0.85 + rng() * 0.3); /* seeded shell jitter */
        let px = W * 0.5 + Math.cos(angle) * shell;
        let py = H * 0.5 + Math.sin(angle) * shell;
        const speed = 1.8 * (0.85 + rng() * 0.3);
        let vx = -Math.sin(angle) * speed;
        let vy = Math.cos(angle) * speed;

        const pts = [[px, py]];
        let lastX = px, lastY = py;
        for (let s = 0; s < maxSteps; s++) {
          let ax = 0, ay = 0;
          for (let c = 0; c < centers.length; c++) {
            const dx = centers[c][0] - px;
            const dy = centers[c][1] - py;
            const distSq = dx * dx + dy * dy + 15.0;
            const dist = Math.sqrt(distSq);
            const force = p.pull / distSq;
            ax += (dx / dist) * force;
            ay += (dy / dist) * force;
          }
          vx += ax * dt; vy += ay * dt;
          vx *= (1.0 - p.damping); vy *= (1.0 - p.damping);
          px += vx * dt; py += vy * dt;
          /* end the path AT the sheet: out-of-canvas points must not be emitted */
          if (!inside(px, py)) break;
          /* decimation: tight orbits crawl; only emit once the pen has moved */
          if (Math.hypot(px - lastX, py - lastY) >= 0.35) {
            pts.push([px, py]);
            lastX = px; lastY = py;
            totalPts++;
            if (totalPts >= BUDGET) break;
          }
        }
        if (pts.length > 2) paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  origami_glitch_fold: {
    name: "Origami Glitch Fold",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "angle", label: "Fold Angle (deg)", type: "slider", min: 0, max: 360, step: 1, def: 45 },
      { key: "offset", label: "Axis Position", type: "slider", min: -100, max: 100, step: 1, def: 0 },
      { key: "distortion", label: "Crease Warp", type: "slider", min: -0.5, max: 0.5, step: 0.01, def: 0.15 },
      { key: "keep", label: "Keep Original", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const rad = (p.angle * Math.PI) / 180;
      const nx = Math.cos(rad);
      const ny = Math.sin(rad);
      const cx = W / 2 + nx * p.offset;
      const cy = H / 2 + ny * p.offset;
      /* mirroring can fling points far off the sheet and the app does not clip */
      const clamp = ([x, y]) => [
        Math.max(0.5, Math.min(W - 0.5, x)),
        Math.max(0.5, Math.min(H - 0.5, y))
      ];

      const paths = [];
      src.paths.forEach((path) => {
        if (p.keep) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
        }
        const densified = resample(path.pts, path.closed, 1.0);
        const modifiedPts = densified.map(([x, y]) => {
          const dx = x - cx;
          const dy = y - cy;
          const distance = dx * nx + dy * ny;
          if (distance > 0) {
            let rx = x - 2 * distance * nx;
            let ry = y - 2 * distance * ny;
            const warpFactor = Math.abs(distance) * p.distortion;
            rx += -ny * warpFactor;
            ry += nx * warpFactor;
            return clamp([rx, ry]);
          }
          return [x, y];
        });
        paths.push({ ...path, pts: modifiedPts, closed: path.closed });
      });
      return { paths };
    }
  },
  cellular_mosaic: {
    name: "Cellular Mosaic Displace",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 719 },
      { key: "scale", label: "Cell Size (mm)", type: "slider", min: 3, max: 40, step: 0.5, def: 12 },
      { key: "shatter", label: "Shatter Explode", type: "slider", min: 0, max: 25, step: 0.5, def: 8 },
      { key: "quantize", label: "Snap to Grid", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      const cellSize = Math.max(1, p.scale);
      const q = cellSize / 4; /* sub-lattice pitch for quantize mode */

      const flushSeg = (pts, layer) => {
        /* drop consecutive duplicates; a path of identical points is a
           zero-length pen mark */
        const clean = [];
        for (const pt of pts) {
          const last = clean[clean.length - 1];
          if (!last || Math.abs(last[0] - pt[0]) > 1e-6 || Math.abs(last[1] - pt[1]) > 1e-6) {
            clean.push(pt);
          }
        }
        if (clean.length > 1) paths.push({ pts: clean, closed: false, layer });
      };

      src.paths.forEach((path) => {
        const densified = resample(path.pts, path.closed, 0.5);
        if (densified.length < 2) return;
        let currentPts = [];
        let lastCellKey = "";
        for (let i = 0; i < densified.length; i++) {
          const [x, y] = densified[i];
          const gx = Math.floor(x / cellSize);
          const gy = Math.floor(y / cellSize);
          const hx = hash2(gx, gy, p.seed);
          const hy = hash2(gx, gy, p.seed + 555);
          const cellKey = gx + "_" + gy;
          if (cellKey !== lastCellKey && currentPts.length > 0) {
            flushSeg(currentPts, path.layer);
            currentPts = [];
          }
          const dx = (hx - 0.5) * p.shatter;
          const dy = (hy - 0.5) * p.shatter;
          let nx = x + dx;
          let ny = y + dy;
          if (p.quantize) {
            /* snap the point to a sub-lattice INSIDE the cell.
               (Snapping every point to one cell corner collapsed whole
               segments into zero-length stacks of identical points.) */
            nx = Math.round(x / q) * q + dx;
            ny = Math.round(y / q) * q + dy;
          }
          currentPts.push([nx, ny]);
          lastCellKey = cellKey;
        }
        flushSeg(currentPts, path.layer);
      });
      return { paths };
    }
  },
  hyperbolic_truchet: {
    name: "Hyperbolic Truchet Maze",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 2026 },
      { key: "rings", label: "Concentric Rings", type: "slider", min: 4, max: 40, step: 1, def: 18 },
      { key: "segments", label: "Ray Segments", type: "slider", min: 8, max: 120, step: 2, def: 48 },
      { key: "curvature", label: "Ring Crowding (- center / + edge)", type: "slider", min: -1, max: 1, step: 0.05, def: -0.5 },
      { key: "style", label: "Tile Style", type: "select", options: ["Arcs (Truchet)", "Diagonals"], def: "Arcs (Truchet)" },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const paths = [];
      const cx = W / 2, cy = H / 2;
      const maxRadius = Math.min(W, H) * 0.45;
      const L = Math.round(p.layer);
      const ringCount = Math.max(1, Math.round(p.rings));
      const segCount = Math.max(4, Math.round(p.segments));
      const TWO = Math.PI * 2;

      /* ring distribution: exponential mapping, sign of curvature picks
         whether rings crowd toward the center (event horizon) or the rim */
      const k = Math.max(-1, Math.min(1, p.curvature)) * 3;
      const remap = (t) => Math.abs(k) < 0.01 ? t : (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
      const radii = [];
      for (let r = 0; r <= ringCount; r++) {
        radii.push(maxRadius * remap(r / ringCount));
      }

      const P = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      /* quarter-ellipse in (angle, radius) space: enters/leaves cell edges
         perpendicular-ish so strands connect seamlessly across cells */
      const arcMid = (aFrom, rFrom, aTo, rTo) => {
        const chord = Math.hypot(P(aTo, rTo)[0] - P(aFrom, rFrom)[0], P(aTo, rTo)[1] - P(aFrom, rFrom)[1]);
        const K = Math.max(4, Math.min(24, Math.round(chord / 1.1) + 3));
        const pts = [];
        for (let j = 0; j <= K; j++) {
          const u = j / K;
          const a = aFrom + (aTo - aFrom) * Math.sin(u * Math.PI / 2);
          const rr = rFrom + (rTo - rFrom) * (1 - Math.cos(u * Math.PI / 2));
          pts.push(P(a, rr));
        }
        return pts;
      };

      for (let r = 0; r < ringCount; r++) {
        const rIn = radii[r], rOut = radii[r + 1];
        const rMid = (rIn + rOut) / 2;
        if (rOut - rIn < 0.4) continue;
        for (let s = 0; s < segCount; s++) {
          const a1 = (s / segCount) * TWO;
          const a2 = ((s + 1) / segCount) * TWO;
          const aMid = (a1 + a2) / 2;
          const cellHash = hash2(r, s, p.seed);
          if (p.style === "Diagonals") {
            /* original behavior: corner-to-corner spiral diagonals */
            const from = cellHash > 0.5 ? a1 : a2;
            const to = cellHash > 0.5 ? a2 : a1;
            const arc = [];
            for (let j = 0; j <= 8; j++) {
              const u = j / 8;
              arc.push(P(from + (to - from) * u, rIn + (rOut - rIn) * u));
            }
            paths.push({ pts: arc, closed: false, layer: L });
          } else {
            /* true Truchet: two arcs joining EDGE MIDPOINTS, flipped by hash.
               Midpoints: left ray (a1,rMid), right ray (a2,rMid),
               inner arc (aMid,rIn), outer arc (aMid,rOut).
               Shared midpoints make strands continue across neighbors. */
            if (cellHash > 0.5) {
              paths.push({ pts: arcMid(a1, rMid, aMid, rIn), closed: false, layer: L });
              paths.push({ pts: arcMid(aMid, rOut, a2, rMid), closed: false, layer: L });
            } else {
              paths.push({ pts: arcMid(a1, rMid, aMid, rOut), closed: false, layer: L });
              paths.push({ pts: arcMid(aMid, rIn, a2, rMid), closed: false, layer: L });
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  tape_saturation: {
    name: "Tape Saturation Harmonics",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 444 },
      { key: "tracks", label: "Signal Tracks", type: "slider", min: 10, max: 120, step: 1, def: 50 },
      { key: "freq", label: "Signal Freq", type: "slider", min: 0.01, max: 0.2, step: 0.005, def: 0.06 },
      { key: "amp", label: "Gain Amplitude", type: "slider", min: 2, max: 40, step: 0.5, def: 15 },
      { key: "clip", label: "Saturation Clip (mm)", type: "slider", min: 1, max: 30, step: 0.5, def: 8 },
      { key: "flutter", label: "Wow & Flutter", type: "slider", min: 0, max: 5, step: 0.1, def: 1.5 },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const paths = [];
      const L = Math.round(p.layer);
      const trackCount = Math.round(p.tracks);

      for (let t = 0; t < trackCount; t++) {
        const baselineY = 15 + ((H - 30) * (t / (trackCount - 1 || 1)));
        const pts = [];
        const trackSeed = p.seed * 31 + t * 17;
        for (let x = 10; x <= W - 10; x += 0.5) {
          let signal = Math.sin(x * p.freq + (t * 0.15));
          let rawY = signal * p.amp;
          if (rawY > p.clip) rawY = p.clip;
          if (rawY < -p.clip) rawY = -p.clip;
          const wow = (noise2(x * 0.003, t * 0.05, trackSeed) - 0.5) * p.flutter * 4;
          const flutter = (noise2(x * 0.1, t * 0.5, trackSeed + 99) - 0.5) * p.flutter * 0.5;
          /* clamp to the sheet: clip + wow near the top/bottom tracks could
             otherwise push the pen off the paper */
          const finalY = Math.max(0.5, Math.min(H - 0.5, baselineY + rawY + wow + flutter));
          pts.push([x, finalY]);
        }
        if (pts.length > 1) {
          /* serpentine: each track is one continuous stroke, so alternate
             direction -> no empty carriage return between tracks */
          if (t % 2 === 1) pts.reverse();
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  voronoi: {
    name: "Voronoi",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cells", label: "Cells", type: "slider", min: 3, max: 300, step: 1, def: 40 },
      { key: "relax", label: "Relax (Lloyd)", type: "slider", min: 0, max: 3, step: 1, def: 1 },
      { key: "sites", label: "Draw sites", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 13 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const N = Math.max(2, Math.min(400, Math.round(p.cells)));
      const rng = mulberry32(p.seed * 6151 + 17);
      let sites = [];
      for (let i = 0; i < N; i++) {
        sites.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
      }
      /* cell of site i = margin rect clipped by bisector half-planes vs all others */
      const cellOf = (i) => {
        let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        const [sx, sy] = sites[i];
        for (let j = 0; j < sites.length && poly.length >= 3; j++) {
          if (j === i) continue;
          const [ox, oy] = sites[j];
          /* keep side of the bisector closer to site i */
          const nx = ox - sx, ny = oy - sy;
          const d = (nx * (sx + ox) + ny * (sy + oy)) / 2;
          const out = [];
          for (let k = 0; k < poly.length; k++) {
            const A = poly[k], B = poly[(k + 1) % poly.length];
            const da = nx * A[0] + ny * A[1] - d;
            const db = nx * B[0] + ny * B[1] - d;
            if (da <= 0) out.push(A);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
              const t = da / (da - db);
              out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
            }
          }
          poly = out;
        }
        return poly;
      };
      const relaxN = Math.max(0, Math.min(3, Math.round(p.relax)));
      for (let r = 0; r < relaxN; r++) {
        sites = sites.map((_, i) => {
          const poly = cellOf(i);
          if (poly.length < 3) return sites[i];
          let cx = 0, cy = 0;
          for (const [x, y] of poly) { cx += x; cy += y; }
          return [cx / poly.length, cy / poly.length];
        });
      }
      /* emit shared edges once (each edge belongs to two cells) */
      const L = Math.round(p.layer);
      const paths = [];
      const seen = new Set();
      const q = (v) => Math.round(v * 20) / 20;
      for (let i = 0; i < sites.length; i++) {
        const poly = cellOf(i);
        for (let k = 0; k < poly.length; k++) {
          const A = poly[k], B = poly[(k + 1) % poly.length];
          if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 0.05) continue;
          const ka = q(A[0]) + "," + q(A[1]), kb = q(B[0]) + "," + q(B[1]);
          const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
          if (seen.has(key)) continue;
          seen.add(key);
          paths.push({ pts: [[A[0], A[1]], [B[0], B[1]]], closed: false, layer: L });
        }
        if (p.sites) {
          const [sx, sy] = sites[i];
          paths.push({ pts: [[sx - 1, sy], [sx + 1, sy]], closed: false, layer: L });
          paths.push({ pts: [[sx, sy - 1], [sx, sy + 1]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  metaballs: {
    name: "Metaballs",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "blobs", label: "Blobs", type: "slider", min: 2, max: 30, step: 1, def: 6 },
      { key: "size", label: "Blob size mm", type: "slider", min: 5, max: 60, step: 1, def: 22 },
      { key: "spread", label: "Spread", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.55 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 5, step: 1, def: 2 },
      { key: "cell", label: "Cell mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 29 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[0]);
      const L = Math.round(p.layer);
      const NB = Math.max(1, Math.min(40, Math.round(p.blobs)));
      const rng = mulberry32(p.seed * 8837 + 5);
      const cx = W / 2, cy = H / 2;
      const rx = (x1 - x0) / 2 * p.spread, ry = (y1 - y0) / 2 * p.spread;
      const blobs = [];
      for (let i = 0; i < NB; i++) {
        blobs.push({
          x: cx + (rng() * 2 - 1) * rx,
          y: cy + (rng() * 2 - 1) * ry,
          r: Math.max(2, p.size) * (0.55 + rng() * 0.9)
        });
      }
      const field = (x, y) => {
        let v = 0;
        for (const b of blobs) {
          const dx = x - b.x, dy = y - b.y;
          v += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        return v;
      };
      const cell = Math.max(0.8, p.cell);
      const cols = Math.max(2, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.max(2, Math.round((y1 - y0) / cell) + 1);
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = field(gx(c), gy(r));
      const segs = [];
      const NBands = Math.max(1, Math.min(6, Math.round(p.bands)));
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let bi = 0; bi < NBands; bi++) {
        const lvl = 1 * Math.pow(1.6, bi); /* nested iso levels */
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segs.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      /* stitch segments into contour loops */
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s, i) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  traceimg: {
    name: "Trace",
    cat: "gen",
    group: "textimg",
    fileImage: true,
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "levels", label: "Threshold levels", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "low", label: "Lowest threshold", type: "slider", min: 0.05, max: 0.9, step: 0.05, def: 0.25 },
      { key: "high", label: "Highest threshold", type: "slider", min: 0.1, max: 0.95, step: 0.05, def: 0.75 },
      { key: "cell", label: "Cell mm", type: "slider", min: 0.8, max: 6, step: 0.2, def: 1.6 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx, node) {
      const img = node && node.data && node.data.img;
      if (!img) return applyStyle({ paths: [] }, ins[0]);
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const boxW = W - 2 * m, boxH = H - 2 * m;
      if (boxW < 10 || boxH < 10) return applyStyle({ paths: [] }, ins[0]);
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ox = (W - iw) / 2, oy = (H - ih) / 2;
      const darkAt = (x, y) => {
        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;
        const iu = Math.floor(u), iv = Math.floor(v);
        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];
        const fu = u - iu, fv = v - iv;
        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +
                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;
        return p.invert ? 1 - d : d;
      };
      const cell = Math.max(0.5, p.cell);
      const cols = Math.max(2, Math.round(iw / cell) + 1);
      const rows = Math.max(2, Math.round(ih / cell) + 1);
      const gx = (c) => ox + (c / (cols - 1)) * iw;
      const gy = (r) => oy + (r / (rows - 1)) * ih;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = darkAt(gx(c), gy(r));
      const NL = Math.max(1, Math.min(8, Math.round(p.levels)));
      const lo = Math.min(p.low, p.high), hi = Math.max(p.low, p.high);
      const segs = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let li = 0; li < NL; li++) {
        const lvl = NL === 1 ? (lo + hi) / 2 : lo + (li / (NL - 1)) * (hi - lo);
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segs.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  occlude: {
    name: "Occlude",
    cat: "mod",
    group: "occlusion",
    ins: [Pin("paths", "Lines"), Pin("paths", "Occluders (closed)")],
    outs: [Pin("paths")],
    params: [
      { key: "gap", label: "Gap mm (+grow / -shrink)", type: "slider", min: -5, max: 8, step: 0.25, def: 0.8 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 },
      { key: "drawOcc", label: "Draw occluders", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const twoInput = !!(ins[1] && ins[1].paths && ins[1].paths.length);
      const step = Math.max(0.25, p.res);
      const gap = p.gap;
      const paths = [];

      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const edgeDist = (x, y, poly) => {
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const ax = poly[j][0], ay = poly[j][1];
          const bx = poly[i][0], by = poly[i][1];
          const dx = bx - ax, dy = by - ay;
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
          if (d < best) best = d;
        }
        return best;
      };
      const prepOcc = (path) => {
        const poly = path.pts;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of poly) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const pad = Math.max(0, gap);
        return { poly, x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
      };
      const hidden = (x, y, occ) => {
        if (x < occ.x0 || x > occ.x1 || y < occ.y0 || y > occ.y1) return false;
        const inside = pip(x, y, occ.poly);
        if (gap >= 0) {
          return inside || (gap > 0 && edgeDist(x, y, occ.poly) < gap);
        }
        /* negative gap: occlusion shrinks inward */
        return inside && edgeDist(x, y, occ.poly) > -gap;
      };
      const emitVisible = (path, occs) => {
        if (!occs.length) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        const pts = resample(path.pts, path.closed, step);
        const vis = pts.map(([x, y]) => !occs.some((o) => hidden(x, y, o)));
        const runs = [];
        let run = [];
        for (let i = 0; i < pts.length; i++) {
          if (vis[i]) run.push(pts[i]);
          else { if (run.length > 1) runs.push(run); run = []; }
        }
        if (run.length > 1) runs.push(run);
        /* closed source with visible wrap: merge last run into first */
        if (path.closed && runs.length > 1 && vis[0] && vis[pts.length - 1]) {
          const last = runs.pop();
          runs[0] = last.concat(runs[0]);
        }
        if (path.closed && runs.length === 1 && vis.every(Boolean)) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        for (const r of runs) paths.push({ pts: r, closed: false, layer: path.layer });
      };

      if (twoInput) {
        const occs = ins[1].paths.filter((pa) => pa.closed && pa.pts.length >= 3).map(prepOcc);
        src.paths.forEach((path) => emitVisible(path, occs));
        if (p.drawOcc) {
          ins[1].paths.forEach((pa) => paths.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }));
        }
      } else {
        /* painter mode: within the set, LATER closed shapes occlude EARLIER paths */
        const all = src.paths;
        const occAfter = all.map((pa, i) =>
          all.slice(i + 1).filter((o) => o.closed && o.pts.length >= 3).map(prepOcc));
        all.forEach((path, i) => emitVisible(path, occAfter[i]));
      }
      return { paths };
    }
  },
  cagewarp: {
    name: "Cage Warp",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "grid", label: "Cage cells", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "amount", label: "Amount mm", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "pin", label: "Pin edges", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.5 },
      { key: "seed", label: "Seed", type: "seed", def: 23 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const G = Math.max(1, Math.min(8, Math.round(p.grid)));
      const amt = Math.max(0, p.amount);
      /* seeded control-point displacements on a (G+1)x(G+1) lattice */
      const dxs = [], dys = [];
      for (let j = 0; j <= G; j++) {
        for (let i = 0; i <= G; i++) {
          const border = i === 0 || j === 0 || i === G || j === G;
          const k = p.pin && border ? 0 : 1;
          dxs.push((hash2(i * 7 + 1, j * 7 + 2, p.seed) - 0.5) * 2 * amt * k);
          dys.push((hash2(i * 7 + 3, j * 7 + 4, p.seed + 99) - 0.5) * 2 * amt * k);
        }
      }
      const at = (arr, i, j) => arr[j * (G + 1) + i];
      const ss = (t) => t * t * (3 - 2 * t);
      const disp = (x, y) => {
        const u = Math.max(0, Math.min(0.9999, x / W)) * G;
        const v = Math.max(0, Math.min(0.9999, y / H)) * G;
        const i = Math.floor(u), j = Math.floor(v);
        const fu = ss(u - i), fv = ss(v - j);
        const bl = (arr) =>
          at(arr, i, j) * (1 - fu) * (1 - fv) + at(arr, i + 1, j) * fu * (1 - fv) +
          at(arr, i, j + 1) * (1 - fu) * fv + at(arr, i + 1, j + 1) * fu * fv;
        return [bl(dxs), bl(dys)];
      };
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.3, p.res)).map(([x, y]) => {
          const [dx, dy] = disp(x, y);
          return [clampX(x + dx), clampY(y + dy)];
        })
      }));
      return { paths };
    }
  },
  carve: {
    name: "Carve",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "t0", label: "Start t (0-1)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "t1", label: "End t (0-1, wire Frame)", type: "slider", min: 0, max: 1, step: 0.001, def: 1 },
      { key: "invert", label: "Keep outside", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      let a = Math.max(0, Math.min(1, Math.min(p.t0, p.t1)));
      let b = Math.max(0, Math.min(1, Math.max(p.t0, p.t1)));
      const paths = [];
      const extract = (pts, s0, s1, layer) => {
        /* substring of a polyline by arc length, interpolated cut points */
        if (s1 - s0 < 0.01) return;
        const out = [];
        let acc = 0, started = false;
        for (let i = 1; i < pts.length; i++) {
          const ax = pts[i - 1][0], ay = pts[i - 1][1];
          const bx = pts[i][0], by = pts[i][1];
          const seg = Math.hypot(bx - ax, by - ay);
          if (seg < 1e-9) continue;
          const e0 = acc, e1 = acc + seg;
          if (e1 > s0 && e0 < s1) {
            const f0 = Math.max(0, (s0 - e0) / seg);
            const f1 = Math.min(1, (s1 - e0) / seg);
            if (!started) {
              out.push([ax + (bx - ax) * f0, ay + (by - ay) * f0]);
              started = true;
            }
            out.push([ax + (bx - ax) * f1, ay + (by - ay) * f1]);
          }
          acc = e1;
          if (e1 >= s1) break;
        }
        if (out.length > 1) paths.push({ pts: out, closed: false, layer });
      };
      src.paths.forEach((path) => {
        const raw = path.closed ? [...path.pts, path.pts[0]] : path.pts;
        const total = pathLength(raw, false);
        if (total < 0.01 || raw.length < 2) return;
        if (!p.invert && a <= 0.0005 && b >= 0.9995) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        if (!p.invert) {
          extract(raw, a * total, b * total, path.layer);
        } else if (path.closed) {
          /* complement of the window wraps around a closed path */
          const dbl = [...raw.slice(0, -1), ...raw];
          extract(dbl, b * total, (a + 1) * total, path.layer);
        } else {
          extract(raw, 0, a * total, path.layer);
          extract(raw, b * total, total, path.layer);
        }
      });
      return { paths };
    }
  },
  echo: {
    name: "Echo",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "copies", label: "Echo copies", type: "slider", min: 1, max: 12, step: 1, def: 4 },
      { key: "dx", label: "Move X mm / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 4 },
      { key: "dy", label: "Move Y mm / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 4 },
      { key: "rot", label: "Rotate deg / copy", type: "slider", min: -90, max: 90, step: 0.5, def: 0 },
      { key: "scale", label: "Scale % / copy", type: "slider", min: 50, max: 150, step: 1, def: 100 },
      { key: "pivot", label: "Pivot", type: "select", options: ["Canvas center", "Path centroid"], def: "Canvas center" },
      { key: "orig", label: "Include original", type: "check", def: true },
      { key: "cycle", label: "Cycle pens", type: "check", def: false }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const K = Math.max(1, Math.min(20, Math.round(p.copies)));
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      src.paths.forEach((path) => {
        if (p.orig) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
        let pcx = W / 2, pcy = H / 2;
        if (p.pivot === "Path centroid") {
          pcx = 0; pcy = 0;
          for (const [x, y] of path.pts) { pcx += x; pcy += y; }
          pcx /= path.pts.length; pcy /= path.pts.length;
        }
        for (let k = 1; k <= K; k++) {
          const ang = (p.rot * Math.PI / 180) * k;
          const sc = Math.pow(p.scale / 100, k);
          if (sc < 0.005) break;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const ox = p.dx * k, oy = p.dy * k;
          const layer = p.cycle ? ((path.layer + k) % PENS.length) : path.layer;
          paths.push({
            pts: path.pts.map(([x, y]) => {
              const lx = (x - pcx) * sc, ly = (y - pcy) * sc;
              return clamp([pcx + lx * ca - ly * sa + ox, pcy + lx * sa + ly * ca + oy]);
            }),
            closed: path.closed, layer
          });
        }
      });
      return { paths };
    }
  },
  displaceimg: {
    name: "Displace by Image",
    cat: "mod",
    group: "deform",
    fileImage: true,
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "amount", label: "Amount mm", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
      { key: "mode", label: "Mode", type: "select", options: ["Darkness along angle", "Gradient (emboss)"], def: "Darkness along angle" },
      { key: "angle", label: "Angle deg", type: "slider", min: 0, max: 360, step: 1, def: 90 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1 },
      { key: "margin", label: "Image fit margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 }
    ],
    compute(ins, p, ctx, node) {
      const src = ins[0] || EMPTY;
      const img = node && node.data && node.data.img;
      if (!img) {
        return { paths: src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const boxW = W - 2 * m, boxH = H - 2 * m;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ox = (W - iw) / 2, oy = (H - ih) / 2;
      const darkAt = (x, y) => {
        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;
        const iu = Math.floor(u), iv = Math.floor(v);
        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];
        const fu = u - iu, fv = v - iv;
        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +
                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;
        return p.invert ? 1 - d : d;
      };
      const a = (p.angle * Math.PI) / 180;
      const adx = Math.cos(a), ady = Math.sin(a);
      const amt = Math.max(0, p.amount);
      const eps = Math.max(0.8, sc);
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.3, p.res)).map(([x, y]) => {
          let dx, dy;
          if (p.mode === "Gradient (emboss)") {
            dx = (darkAt(x + eps, y) - darkAt(x - eps, y)) * amt * 2;
            dy = (darkAt(x, y + eps) - darkAt(x, y - eps)) * amt * 2;
          } else {
            const d = darkAt(x, y) * amt;
            dx = adx * d; dy = ady * d;
          }
          return [clampX(x + dx), clampY(y + dy)];
        })
      }));
      return { paths };
    }
  },
  travelsort: {
    name: "Travel Sort",
    cat: "mod",
    group: "penout",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "reverse", label: "Allow reversing", type: "check", def: true },
      { key: "rotate", label: "Rotate closed starts", type: "check", def: true },
      { key: "bypen", label: "Group by pen", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (src.paths.length < 3) {
        return { paths: src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      /* group by pen (preserving order of first appearance), sort within groups */
      const groups = [];
      const byLayer = new Map();
      src.paths.forEach((pa) => {
        const key = p.bypen ? pa.layer : 0;
        if (!byLayer.has(key)) { byLayer.set(key, []); groups.push(byLayer.get(key)); }
        byLayer.get(key).push(pa);
      });
      const out = [];
      let cur = [0, 0];
      for (const group of groups) {
        const items = group.map((pa) => ({
          pa,
          start: pa.pts[0],
          end: pa.pts[pa.pts.length - 1],
          used: false
        }));
        const HARD = 3000; /* O(n^2) guard: beyond this, pass through unsorted */
        if (items.length > HARD) {
          for (const it of items) out.push({ ...it.pa, pts: it.pa.pts.map((q) => q.slice()) });
          continue;
        }
        for (let n = 0; n < items.length; n++) {
          let best = -1, bestD = Infinity, bestRev = false;
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.used) continue;
            const d1 = Math.hypot(cur[0] - it.start[0], cur[1] - it.start[1]);
            if (d1 < bestD) { bestD = d1; best = i; bestRev = false; }
            if (p.reverse && !it.pa.closed) {
              const d2 = Math.hypot(cur[0] - it.end[0], cur[1] - it.end[1]);
              if (d2 < bestD) { bestD = d2; best = i; bestRev = true; }
            }
          }
          const it = items[best];
          it.used = true;
          let pts = it.pa.pts.map((q) => q.slice());
          if (it.pa.closed && p.rotate) {
            /* enter a closed loop at its vertex nearest the pen */
            let bi = 0, bd = Infinity;
            for (let k = 0; k < pts.length; k++) {
              const d = Math.hypot(cur[0] - pts[k][0], cur[1] - pts[k][1]);
              if (d < bd) { bd = d; bi = k; }
            }
            if (bi > 0) pts = pts.slice(bi).concat(pts.slice(0, bi));
          } else if (bestRev) {
            pts.reverse();
          }
          out.push({ ...it.pa, pts });
          cur = it.pa.closed ? pts[0] : pts[pts.length - 1];
        }
      }
      return { paths: out };
    }
  },
  cull: {
    name: "Cull",
    cat: "mod",
    group: "penout",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Criterion", type: "select", options: ["Random", "Every Nth", "Shorter than", "Longer than"], def: "Random" },
      { key: "keep", label: "Keep probability", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "nth", label: "N (Every Nth)", type: "slider", min: 2, max: 20, step: 1, def: 2 },
      { key: "len", label: "Length mm", type: "slider", min: 0, max: 200, step: 1, def: 20 },
      { key: "invert", label: "Invert selection", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 61 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      src.paths.forEach((path, i) => {
        let drop;
        if (p.mode === "Every Nth") {
          drop = (i % Math.max(2, Math.round(p.nth))) === 0;
        } else if (p.mode === "Shorter than") {
          drop = pathLength(path.pts, path.closed) < p.len;
        } else if (p.mode === "Longer than") {
          drop = pathLength(path.pts, path.closed) > p.len;
        } else {
          drop = hash2(i * 13 + 5, 3, p.seed) >= Math.max(0, Math.min(1, p.keep));
        }
        if (p.invert) drop = !drop;
        if (!drop) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
      });
      return { paths };
    }
  },
  copypoints: {
    name: "Copy to Points",
    cat: "duo",
    ins: [Pin("paths", "Points"), Pin("paths", "Motif")],
    outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Point spacing mm (0=vertices)", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
      { key: "scale", label: "Scale %", type: "slider", min: 5, max: 300, step: 1, def: 100 },
      { key: "sjit", label: "Scale jitter %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
      { key: "rmode", label: "Rotation", type: "select", options: ["None", "Along tangent", "Random"], def: "None" },
      { key: "rjit", label: "Rotation jitter deg", type: "slider", min: 0, max: 180, step: 1, def: 0 },
      { key: "prob", label: "Probability", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
      { key: "seed", label: "Seed", type: "seed", def: 31 }
    ],
    compute(ins, p, ctx) {
      const ptsIn = ins[0], motifIn = ins[1];
      if (!ptsIn || !ptsIn.paths || !ptsIn.paths.length) return EMPTY;
      if (!motifIn || !motifIn.paths || !motifIn.paths.length) return EMPTY;
      /* motif centered on its bounding-box center */
      let mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
      for (const pa of motifIn.paths) for (const [x, y] of pa.pts) {
        if (x < mx0) mx0 = x; if (x > mx1) mx1 = x;
        if (y < my0) my0 = y; if (y > my1) my1 = y;
      }
      const mcx = (mx0 + mx1) / 2, mcy = (my0 + my1) / 2;
      const paths = [];
      const BUDGET = 100000;
      let total = 0, idx = 0;
      for (const host of ptsIn.paths) {
        const pts = p.spacing > 0.01
          ? resample(host.pts, host.closed, Math.max(0.5, p.spacing))
          : host.pts;
        for (let i = 0; i < pts.length; i++) {
          idx++;
          if (p.prob < 1 && hash2(idx * 3 + 1, 5, p.seed) >= p.prob) continue;
          const sc = (p.scale / 100) *
            (1 + (hash2(idx * 3 + 2, 7, p.seed) - 0.5) * 2 * (p.sjit / 100));
          if (sc <= 0.001) continue;
          let ang = 0;
          if (p.rmode === "Along tangent") {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          } else if (p.rmode === "Random") {
            ang = hash2(idx * 3 + 3, 9, p.seed) * Math.PI * 2;
          }
          ang += (hash2(idx * 3 + 4, 11, p.seed) - 0.5) * 2 * (p.rjit * Math.PI / 180);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const [px, py] = pts[i];
          for (const mp of motifIn.paths) {
            if (total + mp.pts.length > BUDGET) return { paths };
            total += mp.pts.length;
            paths.push({
              pts: mp.pts.map(([x, y]) => {
                const lx = (x - mcx) * sc, ly = (y - mcy) * sc;
                return [px + lx * ca - ly * sa, py + lx * sa + ly * ca];
              }),
              closed: mp.closed, layer: mp.layer
            });
          }
        }
      }
      return { paths };
    }
  },
  lfo: {
    name: "LFO",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "wave", label: "Waveform", type: "select", options: ["Sine", "Triangle", "Saw", "Square", "Noise loop"], def: "Sine" },
      { key: "cycles", label: "Cycles / loop", type: "slider", min: 1, max: 16, step: 1, def: 1 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed (noise)", type: "seed", def: 8 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const cyc = Math.max(1, Math.round(p.cycles)); /* integer -> loop stays seamless */
      const u = ((raw * cyc + p.phase) % 1 + 1) % 1;
      let v;
      if (p.wave === "Triangle") v = 1 - Math.abs(u * 2 - 1);
      else if (p.wave === "Saw") v = u;
      else if (p.wave === "Square") v = u < 0.5 ? 1 : 0;
      else if (p.wave === "Noise loop") {
        const a = u * Math.PI * 2;
        v = noise2(Math.cos(a) * 1.5 + 7.3, Math.sin(a) * 1.5 + 2.9, p.seed);
      } else v = 0.5 + 0.5 * Math.sin(u * Math.PI * 2);
      return p.min + v * (p.max - p.min);
    }
  },
  steps: {
    name: "Steps",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "steps", label: "Steps", type: "slider", min: 2, max: 16, step: 1, def: 4 },
      { key: "mode", label: "Pattern", type: "select", options: ["Ramp up", "Ramp down", "Ping-pong", "Random"], def: "Ramp up" },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed (random)", type: "seed", def: 4 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const N = Math.max(2, Math.min(64, Math.round(p.steps)));
      const u = ((raw % 1) + 1) % 1;
      const i = Math.min(N - 1, Math.floor(u * N));
      let f;
      if (p.mode === "Ramp down") f = 1 - i / (N - 1);
      else if (p.mode === "Ping-pong") {
        const half = Math.ceil((N - 1) / 2);
        f = (i <= half ? i : (N - 1 - i)) / Math.max(1, half);
      }
      else if (p.mode === "Random") f = hash2(i * 17 + 3, 7, p.seed);
      else f = i / (N - 1);
      return p.min + f * (p.max - p.min);
    }
  },
  shaper: {
    name: "Shaper",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "curve", label: "Curve", type: "select", options: ["Linear", "Smoothstep", "Ease in", "Ease out", "Ease in-out", "Bounce", "Reverse", "Triangle"], def: "Smoothstep" },
      { key: "repeat", label: "Repeat / loop", type: "slider", min: 1, max: 8, step: 1, def: 1 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const rep = Math.max(1, Math.round(p.repeat));
      /* end-inclusive wrap: t=1 lands on the END of the last cycle, so a
         write-on driven by Frame does not snap back on its final frame.
         (For a seamless LOOP use Triangle, whose endpoints match anyway.) */
      let u = ((raw * rep) % 1 + 1) % 1;
      if (u === 0 && raw * rep > 0) u = 1;
      switch (p.curve) {
        case "Linear": return u;
        case "Ease in": return u * u * u;
        case "Ease out": { const w = 1 - u; return 1 - w * w * w; }
        case "Ease in-out": return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        case "Bounce": {
          const n1 = 7.5625, d1 = 2.75;
          let x = u;
          if (x < 1 / d1) return n1 * x * x;
          if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
          if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
          x -= 2.625 / d1; return n1 * x * x + 0.984375;
        }
        case "Reverse": return 1 - u;
        case "Triangle": return 1 - Math.abs(u * 2 - 1);
        default: return u * u * (3 - 2 * u);
      }
    }
  },
  stencil: {
    name: "Stencil",
    cat: "duo",
    ins: [Pin("paths", "Regions (closed)"), Pin("paths", "Content")],
    outs: [Pin("paths")],
    params: [
      { key: "region", label: "Region index (next/prev, wire Steps)", type: "slider", min: 0, max: 63, step: 1, def: 0 },
      { key: "all", label: "All regions", type: "check", def: false },
      { key: "inset", label: "Edge inset mm", type: "slider", min: -5, max: 8, step: 0.25, def: 1 },
      { key: "outline", label: "Show region outline", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const regsIn = ins[0], contentIn = ins[1];
      if (!regsIn || !regsIn.paths || !regsIn.paths.length) return EMPTY;

      /* collect closed loops, ordered deterministically top-left -> bottom-right
         so the index slider steps through them predictably */
      const loops = regsIn.paths
        .filter((pa) => pa.closed && pa.pts.length >= 3)
        .map((pa) => {
          let cx = 0, cy = 0;
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const [x, y] of pa.pts) {
            cx += x; cy += y;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          cx /= pa.pts.length; cy /= pa.pts.length;
          return { pa, cx, cy, x0, y0, x1, y1 };
        })
        .sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
      if (!loops.length) return EMPTY;

      /* selection: index wraps modulo count -> any slider/wired value is valid */
      const idx = ((Math.floor(p.region) % loops.length) + loops.length) % loops.length;
      const active = p.all ? loops : [loops[idx]];

      const inset = p.inset;
      const pad = Math.max(0, -inset);
      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const edgeDist = (x, y, poly) => {
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const ax = poly[j][0], ay = poly[j][1];
          const bx = poly[i][0], by = poly[i][1];
          const dx = bx - ax, dy = by - ay;
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
          if (d < best) best = d;
        }
        return best;
      };
      /* point is kept if it lies in ANY active region, respecting the inset */
      const keepPt = (x, y) => {
        for (const lo of active) {
          if (x < lo.x0 - pad || x > lo.x1 + pad || y < lo.y0 - pad || y > lo.y1 + pad) continue;
          const inside = pip(x, y, lo.pa.pts);
          if (inset > 0) {
            if (inside && edgeDist(x, y, lo.pa.pts) >= inset) return true;
          } else if (inset < 0) {
            if (inside || edgeDist(x, y, lo.pa.pts) <= -inset) return true;
          } else if (inside) return true;
        }
        return false;
      };

      const paths = [];
      if (p.outline) {
        for (const lo of active) {
          paths.push({ ...lo.pa, pts: lo.pa.pts.map((q) => q.slice()) });
        }
      }
      if (contentIn && contentIn.paths && contentIn.paths.length) {
        const step = Math.max(0.25, p.res);
        contentIn.paths.forEach((path) => {
          if (path.pts.length < 2) return;
          const pts = resample(path.pts, path.closed, step);
          const vis = pts.map(([x, y]) => keepPt(x, y));
          const runs = [];
          let run = [];
          for (let i = 0; i < pts.length; i++) {
            if (vis[i]) run.push(pts[i]);
            else { if (run.length > 1) runs.push(run); run = []; }
          }
          if (run.length > 1) runs.push(run);
          if (path.closed && runs.length > 1 && vis[0] && vis[pts.length - 1]) {
            const last = runs.pop();
            runs[0] = last.concat(runs[0]);
          }
          if (path.closed && runs.length === 1 && vis.every(Boolean)) {
            paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
            return;
          }
          for (const r of runs) paths.push({ pts: r, closed: false, layer: path.layer });
        });
      }
      return { paths };
    }
  },
  harmonograph: {
    name: "Harmonograph",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "fx", label: "Freq X", type: "slider", min: 1, max: 12, step: 1, def: 3 },
      { key: "fy", label: "Freq Y", type: "slider", min: 1, max: 12, step: 1, def: 2 },
      { key: "detune", label: "Detune", type: "slider", min: 0, max: 0.05, step: 0.001, def: 0.008 },
      { key: "damp", label: "Damping", type: "slider", min: 0.001, max: 0.1, step: 0.001, def: 0.015 },
      { key: "dur", label: "Duration (swings)", type: "slider", min: 5, max: 80, step: 1, def: 40 },
      { key: "mix", label: "Pendulum 2 mix", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed (phases)", type: "seed", def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const ax = (W - 2 * m) / 2, ay = (H - 2 * m) / 2;
      if (ax < 5 || ay < 5) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 2833 + 41);
      const p1 = rng() * Math.PI * 2, p2 = rng() * Math.PI * 2;
      const p3 = rng() * Math.PI * 2, p4 = rng() * Math.PI * 2;
      const TWO = Math.PI * 2;
      const fx = Math.max(1, Math.round(p.fx)), fy = Math.max(1, Math.round(p.fy));
      const mix = Math.max(0, Math.min(1, p.mix));
      const damp = Math.max(0.0005, p.damp);
      const dur = Math.max(2, p.dur);
      /* two damped pendulums per axis: the classic twin-pendulum machine */
      const xAt = (t) => {
        const e1 = Math.exp(-damp * t), e2 = Math.exp(-damp * 1.35 * t);
        return (Math.sin(TWO * fx * t + p1) * e1 * (1 - mix * 0.5) +
                Math.sin(TWO * (fx + p.detune * fx + 1) * t + p2) * e2 * mix * 0.5);
      };
      const yAt = (t) => {
        const e1 = Math.exp(-damp * t), e2 = Math.exp(-damp * 1.35 * t);
        return (Math.sin(TWO * fy * t + p3) * e1 * (1 - mix * 0.5) +
                Math.sin(TWO * (fy + p.detune * fy + 1) * t + p4) * e2 * mix * 0.5);
      };
      const n = Math.min(30000, Math.max(2000, Math.round(dur * 400)));
      const pts = [];
      let lastX = 1e9, lastY = 1e9;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * dur;
        const x = W / 2 + xAt(t) * ax;
        const y = H / 2 + yAt(t) * ay;
        /* decimate: only emit once the pen has moved */
        if (Math.hypot(x - lastX, y - lastY) >= 0.15 || i === 0 || i === n) {
          pts.push([x, y]);
          lastX = x; lastY = y;
        }
      }
      if (pts.length < 2) return applyStyle({ paths: [] }, ins[0]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    }
  },
  fmrose: {
    name: "FM Rose",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "fc", label: "Carrier", type: "slider", min: 1, max: 16, step: 1, def: 5 },
      { key: "fm", label: "Modulator", type: "slider", min: 1, max: 16, step: 1, def: 3 },
      { key: "index", label: "FM index", type: "slider", min: 0, max: 10, step: 0.1, def: 2 },
      { key: "depth", label: "Depth", type: "slider", min: 0, max: 1, step: 0.02, def: 0.5 },
      { key: "rings", label: "Rings", type: "slider", min: 1, max: 16, step: 1, def: 1 },
      { key: "rot", label: "Rotate deg / ring", type: "slider", min: 0, max: 90, step: 1, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const R = Math.min(W, H) / 2 - m;
      if (R < 5) return applyStyle({ paths: [] }, ins[0]);
      const cx = W / 2, cy = H / 2;
      const fc = Math.max(1, Math.round(p.fc)), fm = Math.max(1, Math.round(p.fm));
      const depth = Math.max(0, Math.min(1, p.depth));
      const K = Math.max(1, Math.min(24, Math.round(p.rings)));
      const paths = [];
      const NPTS = 720;
      for (let k = 0; k < K; k++) {
        const scale = (K - k) / K;
        const off = (p.rot * Math.PI / 180) * k;
        const pts = [];
        for (let i = 0; i < NPTS; i++) {
          const th = (i / NPTS) * Math.PI * 2;
          /* FM synthesis as a polar curve: r follows the modulated carrier */
          const r = (1 + depth * Math.sin(fc * th + p.index * Math.sin(fm * th))) / (1 + depth);
          const rr = R * scale * Math.max(0.02, r);
          pts.push([cx + Math.cos(th + off) * rr, cy + Math.sin(th + off) * rr]);
        }
        paths.push({ pts, closed: true, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  granulate: {
    name: "Granulate",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "grain", label: "Grain length mm", type: "slider", min: 1, max: 25, step: 0.5, def: 6 },
      { key: "density", label: "Density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.9 },
      { key: "jitter", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 2 },
      { key: "rotate", label: "Rotate ± deg", type: "slider", min: 0, max: 90, step: 1, def: 12 },
      { key: "sjit", label: "Scale jitter %", type: "slider", min: 0, max: 80, step: 1, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 37 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const gl = Math.max(0.8, p.grain);
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      let gid = 0;
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.min(0.6, gl / 4));
        if (pts.length < 2) return;
        let start = 0, acc = 0;
        const flushGrain = (a, b) => {
          gid++;
          if (b - a < 1) return;
          if (hash2(gid * 5 + 1, 3, p.seed) >= Math.max(0, Math.min(1, p.density))) return;
          const grainPts = pts.slice(a, b + 1);
          /* transform the grain around its own centroid */
          let gx = 0, gy = 0;
          for (const [x, y] of grainPts) { gx += x; gy += y; }
          gx /= grainPts.length; gy /= grainPts.length;
          const jx = (hash2(gid * 5 + 2, 7, p.seed) - 0.5) * 2 * p.jitter;
          const jy = (hash2(gid * 5 + 3, 9, p.seed) - 0.5) * 2 * p.jitter;
          const ang = (hash2(gid * 5 + 4, 11, p.seed) - 0.5) * 2 * (p.rotate * Math.PI / 180);
          const sc = 1 + (hash2(gid * 5 + 5, 13, p.seed) - 0.5) * 2 * (p.sjit / 100);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          paths.push({
            pts: grainPts.map(([x, y]) => {
              const lx = (x - gx) * sc, ly = (y - gy) * sc;
              return clamp([gx + lx * ca - ly * sa + jx, gy + lx * sa + ly * ca + jy]);
            }),
            closed: false, layer: path.layer
          });
        };
        for (let i = 1; i < pts.length; i++) {
          acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (acc >= gl) { flushGrain(start, i); start = i; acc = 0; }
        }
        flushGrain(start, pts.length - 1);
      });
      return { paths };
    }
  },
  fold: {
    name: "Fold",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "gain", label: "Gain (drive)", type: "slider", min: 1, max: 4, step: 0.05, def: 1.5 },
      { key: "wx", label: "Window width mm", type: "slider", min: 20, max: 220, step: 1, def: 120 },
      { key: "wy", label: "Window height mm", type: "slider", min: 20, max: 300, step: 1, def: 160 },
      { key: "axis", label: "Fold axis", type: "select", options: ["Both", "X only", "Y only"], def: "Both" },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const hx = Math.max(5, p.wx / 2), hy = Math.max(5, p.wy / 2);
      const gain = Math.max(0.1, p.gain);
      /* wavefolder: reflect back into the window, repeatedly (triangle fold) */
      const fold1 = (v, half) => {
        const period = 4 * half;
        let u = ((v + half) % period + period) % period;
        return (u < 2 * half ? u - half : 3 * half - u);
      };
      const doX = p.axis !== "Y only", doY = p.axis !== "X only";
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.25, p.res)).map(([x, y]) => {
          /* drive: scale outward from center before folding, like input gain */
          let lx = (x - cx) * gain, ly = (y - cy) * gain;
          if (doX) lx = fold1(lx, hx);
          if (doY) ly = fold1(ly, hy);
          return [cx + lx, cy + ly];
        })
      }));
      return { paths };
    }
  },
  adsr: {
    name: "ADSR",
    cat: "math",
    ins: [Pin("value", "t (wire Frame)")],
    outs: [Pin("value")],
    params: [
      { key: "t", label: "t (if unwired)", type: "slider", min: 0, max: 1, step: 0.001, def: 0 },
      { key: "a", label: "Attack", type: "slider", min: 0, max: 1, step: 0.01, def: 0.1 },
      { key: "d", label: "Decay", type: "slider", min: 0, max: 1, step: 0.01, def: 0.2 },
      { key: "s", label: "Sustain level", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: "r", label: "Release", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 }
    ],
    compute(ins, p) {
      const raw = typeof ins[0] === "number" ? ins[0] : p.t;
      const u = Math.max(0, Math.min(1, raw));
      let a = Math.max(0, p.a), d = Math.max(0, p.d), r = Math.max(0, p.r);
      const sum = a + d + r;
      if (sum > 1) { a /= sum; d /= sum; r /= sum; } /* squeeze to fit; sustain -> 0 */
      const sus = Math.max(0, Math.min(1, p.s));
      const relStart = 1 - r;
      let v;
      if (u < a) v = a > 0 ? u / a : 1;
      else if (u < a + d) v = d > 0 ? 1 - (1 - sus) * ((u - a) / d) : sus;
      else if (u < relStart) v = sus;
      else v = r > 0 ? sus * (1 - (u - relStart) / r) : 0;
      return p.min + v * (p.max - p.min);
    }
  },
  bitcrush: {
    name: "Bitcrush",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "rate", label: "Sample rate mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 4 },
      { key: "depth", label: "Bit depth grid mm (0=off)", type: "slider", min: 0, max: 12, step: 0.25, def: 2 },
      { key: "axis", label: "Quantize axis", type: "select", options: ["Both", "X only", "Y only"], def: "Both" }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const rate = Math.max(0.3, p.rate);
      const q = Math.max(0, p.depth);
      const qx = p.axis !== "Y only", qy = p.axis !== "X only";
      const snap = (v) => q > 0.01 ? Math.round(v / q) * q : v;
      const paths = [];
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, rate).map(([x, y]) => [
          qx ? snap(x) : x, qy ? snap(y) : y
        ]);
        /* quantizing can stack identical points: dedupe (no zero-length marks) */
        const clean = [];
        for (const pt of pts) {
          const last = clean[clean.length - 1];
          if (!last || Math.abs(last[0] - pt[0]) > 1e-6 || Math.abs(last[1] - pt[1]) > 1e-6) clean.push(pt);
        }
        if (path.closed && clean.length > 2) {
          const a = clean[0], b = clean[clean.length - 1];
          if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) clean.pop();
        }
        if (clean.length > 1) paths.push({ pts: clean, closed: path.closed && clean.length > 2, layer: path.layer });
      });
      return { paths };
    }
  },
  switch: {
    name: "Switch",
    cat: "duo",
    ins: [Pin("value", "Select"), Pin("paths", "A"), Pin("paths", "B"), Pin("paths", "C")],
    outs: [Pin("paths")],
    params: [
      { key: "sel", label: "Select (if unwired, wire Steps)", type: "slider", min: 0, max: 2, step: 1, def: 0 }
    ],
    compute(ins, p) {
      const val = typeof ins[0] === "number" ? ins[0] : p.sel;
      const wired = [];
      for (let i = 1; i <= 3; i++) {
        if (ins[i] && ins[i].paths && ins[i].paths.length) wired.push(ins[i]);
      }
      if (!wired.length) return EMPTY;
      const idx = ((Math.floor(val) % wired.length) + wired.length) % wired.length;
      const pick = wired[idx];
      return { paths: pick.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
    }
  },
  conway: {
    name: "Conway",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Grid columns", type: "slider", min: 10, max: 80, step: 1, def: 40 },
      { key: "fill", label: "Initial fill", type: "slider", min: 0.05, max: 0.8, step: 0.05, def: 0.35 },
      { key: "gens", label: "Generations (wire LFO/Frame)", type: "slider", min: 0, max: 200, step: 1, def: 20 },
      { key: "wrap", label: "Wrap edges", type: "check", def: true },
      { key: "style", label: "Cell style", type: "select", options: ["Squares", "Dots", "Diamonds"], def: "Squares" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 19 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
      const cols = Math.max(4, Math.min(100, Math.round(p.cols)));
      const cell = bw / cols;
      const rows = Math.max(4, Math.floor(bh / cell));
      /* deterministic replay: seed the board, run N generations from scratch.
         Stateless per compute -> wire a value into Generations to animate growth */
      const rng = mulberry32(p.seed * 7477 + 3);
      let grid = new Uint8Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = rng() < p.fill ? 1 : 0;
      const gens = Math.max(0, Math.min(400, Math.floor(p.gens)));
      const wrap = !!p.wrap;
      let next = new Uint8Array(cols * rows);
      for (let g = 0; g < gens; g++) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                let xx = x + dx, yy = y + dy;
                if (wrap) { xx = (xx + cols) % cols; yy = (yy + rows) % rows; }
                else if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
                n += grid[yy * cols + xx];
              }
            }
            const alive = grid[y * cols + x];
            next[y * cols + x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
          }
        }
        const t = grid; grid = next; next = t;
      }
      const paths = [];
      const L = Math.round(p.layer);
      const pad = cell * 0.12;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!grid[y * cols + x]) continue;
          const x0 = m + x * cell + pad, y0 = m + y * cell + pad;
          const x1 = m + (x + 1) * cell - pad, y1 = m + (y + 1) * cell - pad;
          const cxx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
          if (p.style === "Dots") {
            const r = cell * 0.28;
            const pts = [];
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              pts.push([cxx + Math.cos(a) * r, cyy + Math.sin(a) * r]);
            }
            paths.push({ pts, closed: true, layer: L });
          } else if (p.style === "Diamonds") {
            paths.push({ pts: [[cxx, y0], [x1, cyy], [cxx, y1], [x0, cyy]], closed: true, layer: L });
          } else {
            paths.push({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, layer: L });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  tileshuffle: {
    name: "Tile Shuffle",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Columns", type: "slider", min: 2, max: 12, step: 1, def: 4 },
      { key: "rows", label: "Rows", type: "slider", min: 2, max: 12, step: 1, def: 5 },
      { key: "amount", label: "Shuffle amount", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "flips", label: "Random flips / 180", type: "check", def: true },
      { key: "res", label: "Cut step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "seed", label: "Seed", type: "seed", def: 47 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const C = Math.max(1, Math.min(16, Math.round(p.cols)));
      const R = Math.max(1, Math.min(16, Math.round(p.rows)));
      const tw = W / C, th = H / R;
      const NT = C * R;
      /* seeded permutation over a subset chosen by Amount */
      const rng = mulberry32(p.seed * 5501 + 9);
      const inShuffle = [];
      for (let i = 0; i < NT; i++) if (rng() < p.amount) inShuffle.push(i);
      const perm = new Array(NT);
      for (let i = 0; i < NT; i++) perm[i] = i;
      const pool = inShuffle.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      inShuffle.forEach((tile, k) => { perm[tile] = pool[k]; });
      /* per-tile flip/rotation (bounds-safe: flips + 180 only) */
      const mode = new Array(NT).fill(0);
      if (p.flips) {
        for (let i = 0; i < NT; i++) {
          if (perm[i] !== i || rng() < p.amount * 0.3) mode[i] = Math.floor(rng() * 4); /* 0=none 1=flipX 2=flipY 3=180 */
        }
      }
      const paths = [];
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        let run = [], lastTile = -1, prev = null;
        const flushRun = () => {
          if (run.length > 1) {
            const tile = lastTile;
            const dst = perm[tile];
            const sx = (tile % C) * tw, sy = Math.floor(tile / C) * th;
            const dx = (dst % C) * tw, dy = Math.floor(dst / C) * th;
            const mo = mode[tile];
            paths.push({
              pts: run.map(([x, y]) => {
                let lx = x - sx, ly = y - sy;
                if (mo === 1 || mo === 3) lx = tw - lx;
                if (mo === 2 || mo === 3) ly = th - ly;
                return [dx + lx, dy + ly];
              }),
              closed: false, layer: path.layer
            });
          }
          run = [];
        };
        for (const pt of pts) {
          const tx = Math.min(C - 1, Math.max(0, Math.floor(pt[0] / tw)));
          const ty = Math.min(R - 1, Math.max(0, Math.floor(pt[1] / th)));
          const tile = ty * C + tx;
          if (tile !== lastTile && run.length && prev) {
            /* exact cut: intersect the crossing segment with the tile border
               and give the boundary point to BOTH runs (no ink lost at seams) */
            const px = prev[0], py = prev[1];
            const dx = pt[0] - px, dy = pt[1] - py;
            const ptx = Math.floor(px / tw), pty = Math.floor(py / th);
            let t = 1;
            if (tx !== ptx && Math.abs(dx) > 1e-12) {
              const xb = tw * Math.max(ptx, tx);
              t = Math.min(t, (xb - px) / dx);
            }
            if (ty !== pty && Math.abs(dy) > 1e-12) {
              const yb = th * Math.max(pty, ty);
              t = Math.min(t, (yb - py) / dy);
            }
            t = Math.max(0, Math.min(1, t));
            const bp = [px + dx * t, py + dy * t];
            run.push(bp);
            flushRun();
            run = [bp.slice()];
          }
          lastTile = tile;
          run.push(pt);
          prev = pt;
        }
        flushRun();
      });
      return { paths };
    }
  },
  superformula: {
    name: "Superformula",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "m", label: "Symmetry m", type: "slider", min: 0, max: 24, step: 1, def: 6 },
      { key: "n1", label: "n1", type: "slider", min: 0.1, max: 40, step: 0.1, def: 3 },
      { key: "n2", label: "n2", type: "slider", min: 0.1, max: 40, step: 0.1, def: 6 },
      { key: "n3", label: "n3", type: "slider", min: 0.1, max: 40, step: 0.1, def: 6 },
      { key: "asym", label: "a/b asymmetry", type: "slider", min: 0.2, max: 5, step: 0.05, def: 1 },
      { key: "rings", label: "Rings", type: "slider", min: 1, max: 24, step: 1, def: 1 },
      { key: "twist", label: "Twist deg / ring", type: "slider", min: 0, max: 45, step: 0.5, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m2 = Math.max(0, p.margin);
      const Rmax = Math.min(W, H) / 2 - m2;
      if (Rmax < 5) return applyStyle({ paths: [] }, ins[0]);
      const cx = W / 2, cy = H / 2;
      const mm = Math.max(0, Math.round(p.m));
      const n1 = Math.max(0.05, p.n1), n2 = Math.max(0.05, p.n2), n3 = Math.max(0.05, p.n3);
      const a = 1, b = Math.max(0.05, p.asym);
      const NPTS = 720;
      /* Gielis superformula, guarded against zero base */
      const rBase = new Float64Array(NPTS);
      let rMax = 0;
      for (let i = 0; i < NPTS; i++) {
        const th = (i / NPTS) * Math.PI * 2;
        const t1 = Math.pow(Math.abs(Math.cos((mm * th) / 4) / a), n2);
        const t2 = Math.pow(Math.abs(Math.sin((mm * th) / 4) / b), n3);
        const base = Math.max(1e-9, t1 + t2);
        const r = Math.pow(base, -1 / n1);
        rBase[i] = Number.isFinite(r) ? r : 0;
        if (rBase[i] > rMax) rMax = rBase[i];
      }
      if (rMax < 1e-9) return applyStyle({ paths: [] }, ins[0]);
      const K = Math.max(1, Math.min(32, Math.round(p.rings)));
      const paths = [];
      for (let k = 0; k < K; k++) {
        const scale = (K - k) / K;
        const off = (p.twist * Math.PI / 180) * k;
        const pts = [];
        for (let i = 0; i < NPTS; i++) {
          const th = (i / NPTS) * Math.PI * 2;
          const rr = (rBase[i] / rMax) * Rmax * scale;
          pts.push([cx + Math.cos(th + off) * rr, cy + Math.sin(th + off) * rr]);
        }
        paths.push({ pts, closed: true, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  kaleidoscope: {
    name: "Kaleidoscope",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "sectors", label: "Sectors", type: "slider", min: 2, max: 24, step: 1, def: 6 },
      { key: "mirror", label: "Mirror alternate", type: "check", def: true },
      { key: "rot", label: "Rotate offset deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const N = Math.max(2, Math.min(32, Math.round(p.sectors)));
      const wedge = (Math.PI * 2) / N;
      const base = (p.rot * Math.PI) / 180;
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      /* 1) clip the source to one wedge, 2) replicate the runs N times,
         mirroring every other copy when Mirror is on */
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        const inWedge = pts.map(([x, y]) => {
          let a = Math.atan2(y - cy, x - cx) - base;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          return a < wedge;
        });
        const runs = [];
        let run = [];
        for (let i = 0; i < pts.length; i++) {
          if (inWedge[i]) run.push(pts[i]);
          else { if (run.length > 1) runs.push(run); run = []; }
        }
        if (run.length > 1) runs.push(run);
        for (const r of runs) {
          /* run in wedge-local polar coordinates */
          const local = r.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            let a = Math.atan2(dy, dx) - base;
            a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            return [Math.hypot(dx, dy), a];
          });
          for (let k = 0; k < N; k++) {
            const flip = p.mirror && (k % 2 === 1);
            paths.push({
              pts: local.map(([rad, a]) => {
                const aa = base + k * wedge + (flip ? wedge - a : a);
                return clamp([cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad]);
              }),
              closed: false, layer: path.layer
            });
          }
        }
      });
      return { paths };
    }
  },
  topolar: {
    name: "To Polar",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "rin", label: "Inner radius mm", type: "slider", min: 0, max: 80, step: 1, def: 15 },
      { key: "turns", label: "Turns", type: "slider", min: 0.25, max: 3, step: 0.05, def: 1 },
      { key: "start", label: "Start angle deg", type: "slider", min: 0, max: 360, step: 1, def: 270 },
      { key: "flip", label: "Top of canvas", type: "select", options: ["Outer edge", "Inner edge"], def: "Outer edge" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const rOut = Math.min(W, H) / 2 - m;
      const rIn = Math.max(0, Math.min(p.rin, rOut - 2));
      if (rOut - rIn < 2) return { paths: [] };
      const cx = W / 2, cy = H / 2;
      const a0 = (p.start * Math.PI) / 180;
      const TWO = Math.PI * 2;
      const outerTop = p.flip === "Outer edge";
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      /* cartesian canvas wrapped onto a ring: x -> angle, y -> radius */
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.25, p.res)).map(([x, y]) => {
          const u = x / W;
          const v = y / H;
          const ang = a0 + u * p.turns * TWO;
          const frac = outerTop ? 1 - v : v;
          const rr = rIn + frac * (rOut - rIn);
          return clamp([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
        })
      }));
      return { paths };
    }
  },
  filterpath: {
    name: "Filter",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Lowpass", "Highpass"], def: "Lowpass" },
      { key: "cutoff", label: "Cutoff mm", type: "slider", min: 1, max: 40, step: 0.5, def: 8 },
      { key: "reso", label: "Resonance", type: "slider", min: 0, max: 0.95, step: 0.05, def: 0.3 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 2, step: 0.1, def: 0.5 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const step = Math.max(0.25, p.res);
      /* Chamberlin state-variable filter run ALONG each path, x and y as two
         signals. Causal, so resonance rings AFTER corners - that is the point. */
      const f = 2 * Math.sin(Math.PI * Math.min(0.22, step / Math.max(1, p.cutoff)));
      const q = Math.max(0.08, 1 - p.reso);
      const paths = [];
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, step);
        if (pts.length < 3) {
          paths.push({ ...path, pts: path.pts.map((v) => v.slice()) });
          return;
        }
        const runFilter = () => {
          let lx = pts[0][0], bx = 0, ly = pts[0][1], by = 0;
          const stepOne = ([x, y]) => {
            const hx = x - lx - q * bx; bx += f * hx; lx += f * bx;
            const hy = y - ly - q * by; by += f * hy; ly += f * by;
            return [hx, hy, lx, ly];
          };
          /* closed paths: one warm-up lap kills the start transient */
          if (path.closed) for (const pt of pts) stepOne(pt);
          return pts.map((pt) => stepOne(pt));
        };
        const st = runFilter();
        if (p.mode === "Highpass") {
          /* the high band wiggles around zero: re-center on the path centroid */
          let gx = 0, gy = 0;
          for (const [x, y] of pts) { gx += x; gy += y; }
          gx /= pts.length; gy /= pts.length;
          paths.push({
            pts: st.map(([hx, hy]) => [gx + hx, gy + hy]),
            closed: path.closed, layer: path.layer
          });
        } else {
          paths.push({
            pts: st.map(([, , lx2, ly2]) => [lx2, ly2]),
            closed: path.closed, layer: path.layer
          });
        }
      });
      return { paths };
    }
  },
  stringpluck: {
    name: "String",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "rows", label: "Time frames", type: "slider", min: 5, max: 60, step: 1, def: 24 },
      { key: "harm", label: "Harmonics", type: "slider", min: 3, max: 30, step: 1, def: 12 },
      { key: "pluck", label: "Pluck position", type: "slider", min: 0.05, max: 0.95, step: 0.01, def: 0.3 },
      { key: "amp", label: "Amplitude mm", type: "slider", min: 2, max: 40, step: 0.5, def: 16 },
      { key: "decay", label: "Decay", type: "slider", min: 0.05, max: 2, step: 0.05, def: 0.5 },
      { key: "span", label: "Time span (periods)", type: "slider", min: 0.5, max: 10, step: 0.25, def: 4 },
      { key: "detune", label: "Detune (organic)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 21 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, x1 = W - m;
      if (x1 - x0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const R = Math.max(2, Math.min(80, Math.round(p.rows)));
      const K = Math.max(1, Math.min(40, Math.round(p.harm)));
      const pl = Math.max(0.02, Math.min(0.98, p.pluck));
      /* triangular pluck: modal amplitudes of a string plucked at position pl */
      const A = [];
      let norm = 0;
      for (let k = 1; k <= K; k++) {
        const a = Math.sin(k * Math.PI * pl) / (k * k);
        A.push(a);
        norm += Math.abs(a);
      }
      for (let k = 0; k < K; k++) A[k] /= (norm || 1);
      const eps = [];
      for (let k = 0; k < K; k++) {
        eps.push((hash2(k * 7 + 1, 5, p.seed) - 0.5) * 0.01 * p.detune);
      }
      const amp = Math.max(0.5, p.amp);
      const yTop = m + amp + 2, yBot = H - m - amp - 2;
      if (yBot - yTop < 5) return applyStyle({ paths: [] }, ins[0]);
      const paths = [];
      const L = Math.round(p.layer);
      const NX = 160;
      for (let r = 0; r < R; r++) {
        const t = (r / Math.max(1, R - 1)) * p.span;
        const yBase = yTop + (r / Math.max(1, R - 1)) * (yBot - yTop);
        const pts = [];
        for (let i = 0; i <= NX; i++) {
          const u = i / NX;
          let v = 0;
          for (let k = 0; k < K; k++) {
            const kk = k + 1;
            /* higher modes die first: e^(-decay k^2 t) */
            v += A[k] * Math.sin(kk * Math.PI * u) *
                 Math.cos(2 * Math.PI * kk * t * (1 + eps[k])) *
                 Math.exp(-p.decay * kk * kk * t * 0.1);
          }
          pts.push([x0 + u * (x1 - x0), yBase + v * amp]);
        }
        if (r % 2 === 1) pts.reverse(); /* serpentine */
        paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  fourier: {
    name: "Fourier",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "harm", label: "Harmonics (wire Frame/LFO)", type: "slider", min: 1, max: 64, step: 1, def: 8 },
      { key: "epi", label: "Draw epicycles", type: "check", def: false },
      { key: "keepOpen", label: "Pass open paths through", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const M = 256;
      const H = Math.max(1, Math.min(Math.floor(M / 2) - 1, Math.floor(p.harm)));
      const paths = [];
      src.paths.forEach((path) => {
        if (!path.closed || path.pts.length < 3) {
          if (p.keepOpen) paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        /* uniform M samples of the closed contour */
        const total = pathLength([...path.pts, path.pts[0]], false);
        if (total < 1) return;
        const smp = resample(path.pts, true, total / M);
        const zs = smp.slice(0, M);
        while (zs.length < M) zs.push(zs[zs.length - 1]);
        /* DFT coefficients for n in [-H..H] (elliptic Fourier reconstruction) */
        const coef = [];
        for (let n = -H; n <= H; n++) {
          let re = 0, im = 0;
          for (let k = 0; k < M; k++) {
            const ang = (-2 * Math.PI * n * k) / M;
            const c = Math.cos(ang), s = Math.sin(ang);
            re += zs[k][0] * c - zs[k][1] * s;
            im += zs[k][0] * s + zs[k][1] * c;
          }
          coef.push({ n, re: re / M, im: im / M });
        }
        /* rebuild with the kept harmonics: shape morphs circle -> original */
        const out = [];
        for (let k = 0; k < M; k++) {
          let x = 0, y = 0;
          for (const { n, re, im } of coef) {
            const ang = (2 * Math.PI * n * k) / M;
            const c = Math.cos(ang), s = Math.sin(ang);
            x += re * c - im * s;
            y += re * s + im * c;
          }
          out.push([x, y]);
        }
        paths.push({ pts: out, closed: true, layer: path.layer });
        /* optional epicycle ghost circles: largest terms chained from the center */
        if (p.epi) {
          const terms = coef.filter((t) => t.n !== 0)
            .sort((a, b) => (b.re * b.re + b.im * b.im) - (a.re * a.re + a.im * a.im))
            .slice(0, Math.min(10, 2 * H));
          const c0 = coef.find((t) => t.n === 0) || { re: 0, im: 0 };
          let cxx = c0.re, cyy = c0.im;
          for (const t of terms) {
            const r = Math.hypot(t.re, t.im);
            if (r < 0.5) break;
            const ring = [];
            for (let a = 0; a < 16; a++) {
              const th = (a / 16) * Math.PI * 2;
              ring.push([cxx + Math.cos(th) * r, cyy + Math.sin(th) * r]);
            }
            paths.push({ pts: ring, closed: true, layer: path.layer });
            cxx += t.re; cyy += t.im;
          }
        }
      });
      return { paths };
    }
  },
  delaunay: {
    name: "Delaunay",
    cat: "gen",
    group: "geometric",
    ins: [Pin("paths", "Points (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "points", label: "Points (if unwired)", type: "slider", min: 3, max: 400, step: 1, def: 60 },
      { key: "spacing", label: "Input spacing mm (0=vertices)", type: "slider", min: 0, max: 40, step: 0.5, def: 12 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 43 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 10 || y1 - y0 < 10) return applyStyle({ paths: [] }, ins[1]);
      /* points: from wired paths (resampled/vertices) or seeded random */
      let pts = [];
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        for (const pa of ins[0].paths) {
          const src = p.spacing > 0.01 ? resample(pa.pts, pa.closed, Math.max(1, p.spacing)) : pa.pts;
          for (const q of src) pts.push([q[0], q[1]]);
        }
      } else {
        const rng = mulberry32(p.seed * 3803 + 27);
        const N = Math.max(3, Math.min(400, Math.round(p.points)));
        for (let i = 0; i < N; i++) {
          pts.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
        }
      }
      /* dedupe near-identical points (degenerate circumcircles) */
      const seenP = new Set();
      pts = pts.filter(([x, y]) => {
        const k = Math.round(x * 10) + "," + Math.round(y * 10);
        if (seenP.has(k)) return false;
        seenP.add(k);
        return true;
      });
      if (pts.length > 600) {
        const stride = pts.length / 600;
        const dec = [];
        for (let i = 0; i < 600; i++) dec.push(pts[Math.floor(i * stride)]);
        pts = dec;
      }
      if (pts.length < 3) return applyStyle({ paths: [] }, ins[1]);
      /* Bowyer-Watson triangulation */
      const n = pts.length;
      const big = Math.max(W, H) * 10;
      const P = pts.concat([[W / 2 - big, H / 2 - big], [W / 2 + big, H / 2 - big], [W / 2, H / 2 + big]]);
      let tris = [[n, n + 1, n + 2]];
      const circum = (i, j, k) => {
        const [ax, ay] = P[i], [bx, by] = P[j], [cx2, cy2] = P[k];
        const d = 2 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by));
        if (Math.abs(d) < 1e-12) return null;
        const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx2 * cx2 + cy2 * cy2;
        const ux = (a2 * (by - cy2) + b2 * (cy2 - ay) + c2 * (ay - by)) / d;
        const uy = (a2 * (cx2 - bx) + b2 * (ax - cx2) + c2 * (bx - ax)) / d;
        return [ux, uy, (ux - ax) * (ux - ax) + (uy - ay) * (uy - ay)];
      };
      for (let pi = 0; pi < n; pi++) {
        const [px, py] = P[pi];
        const bad = [];
        for (let t = 0; t < tris.length; t++) {
          const cc = circum(tris[t][0], tris[t][1], tris[t][2]);
          if (!cc) { continue; }
          const dx = px - cc[0], dy = py - cc[1];
          if (dx * dx + dy * dy < cc[2] - 1e-9) bad.push(t);
        }
        /* boundary polygon = edges of bad triangles not shared by two bad ones */
        const edgeCount = new Map();
        const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            const k = ek(u, v);
            edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
          }
        }
        const boundary = [];
        for (const t of bad) {
          const [a, b, c] = tris[t];
          for (const [u, v] of [[a, b], [b, c], [c, a]]) {
            if (edgeCount.get(ek(u, v)) === 1) boundary.push([u, v]);
          }
        }
        for (let i = bad.length - 1; i >= 0; i--) tris.splice(bad[i], 1);
        for (const [u, v] of boundary) tris.push([u, v, pi]);
      }
      /* unique edges, skipping the super-triangle */
      const L = Math.round(p.layer);
      const paths = [];
      const seen = new Set();
      for (const [a, b, c] of tris) {
        if (a >= n || b >= n || c >= n) continue;
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const k = u < v ? u + "_" + v : v + "_" + u;
          if (seen.has(k)) continue;
          seen.add(k);
          paths.push({ pts: [[P[u][0], P[u][1]], [P[v][0], P[v][1]]], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[1]);
    }
  },
  attractor: {
    name: "Attractor",
    cat: "gen",
    group: "scientific",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "type", label: "Type", type: "select", options: ["Clifford", "De Jong", "Lorenz (x-z)"], def: "Clifford" },
      { key: "a", label: "a", type: "slider", min: -3, max: 3, step: 0.01, def: -1.4 },
      { key: "b", label: "b", type: "slider", min: -3, max: 3, step: 0.01, def: 1.6 },
      { key: "c", label: "c", type: "slider", min: -3, max: 3, step: 0.01, def: 1.0 },
      { key: "d", label: "d", type: "slider", min: -3, max: 3, step: 0.01, def: 0.7 },
      { key: "iters", label: "Iterations", type: "slider", min: 1000, max: 30000, step: 500, def: 8000 },
      { key: "mode", label: "Draw as", type: "select", options: ["Polyline", "Dashes"], def: "Polyline" },
      { key: "dash", label: "Dash mm", type: "slider", min: 0.4, max: 3, step: 0.1, def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed (start jitter)", type: "seed", def: 7 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 911 + 3);
      const iters = Math.max(500, Math.min(40000, Math.round(p.iters)));
      const raw = [];
      if (p.type === "Lorenz (x-z)") {
        let x = 1 + rng() * 0.1, y = 1 + rng() * 0.1, z = 20 + rng();
        const rho = 28 + p.a * 5, sigma = 10, beta = 8 / 3, dt = 0.006;
        for (let i = 0; i < iters + 200; i++) {
          const dx = sigma * (y - x);
          const dy = x * (rho - z) - y;
          const dz = x * y - beta * z;
          x += dx * dt; y += dy * dt; z += dz * dt;
          if (i >= 200) raw.push([x, z]);
          if (!Number.isFinite(x) || !Number.isFinite(z)) break;
        }
      } else {
        let x = rng() * 0.2, y = rng() * 0.2;
        for (let i = 0; i < iters + 100; i++) {
          let nx, ny;
          if (p.type === "De Jong") {
            nx = Math.sin(p.a * y) - Math.cos(p.b * x);
            ny = Math.sin(p.c * x) - Math.cos(p.d * y);
          } else {
            nx = Math.sin(p.a * y) + p.c * Math.cos(p.a * x);
            ny = Math.sin(p.b * x) + p.d * Math.cos(p.b * y);
          }
          x = nx; y = ny;
          if (i >= 100) raw.push([x, y]);
        }
      }
      if (raw.length < 10) return applyStyle({ paths: [] }, ins[0]);
      /* fit to the margin box */
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const [x, y] of raw) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const sc = Math.min(bw / ((bx1 - bx0) || 1), bh / ((by1 - by0) || 1));
      const ox = m + (bw - (bx1 - bx0) * sc) / 2 - bx0 * sc;
      const oy = m + (bh - (by1 - by0) * sc) / 2 - by0 * sc;
      const map = ([x, y]) => [x * sc + ox, y * sc + oy];
      const L = Math.round(p.layer);
      const paths = [];
      if (p.mode === "Dashes") {
        /* the classic attractor-dust look; stride-capped for the pen's sake */
        const MAXD = 6000;
        const stride = Math.max(1, Math.floor(raw.length / MAXD));
        for (let i = 0; i + stride < raw.length; i += stride) {
          const A = map(raw[i]), B = map(raw[i + 1]);
          const dx = B[0] - A[0], dy = B[1] - A[1];
          const dl = Math.hypot(dx, dy) || 1;
          const hx = (dx / dl) * p.dash / 2, hy = (dy / dl) * p.dash / 2;
          paths.push({ pts: [[A[0] - hx, A[1] - hy], [A[0] + hx, A[1] + hy]], closed: false, layer: L });
        }
      } else {
        /* one continuous chaotic thread, decimated */
        const pts = [];
        let lx = 1e9, ly = 1e9;
        for (const q of raw) {
          const [x, y] = map(q);
          if (Math.hypot(x - lx, y - ly) >= 0.2) {
            pts.push([x, y]);
            lx = x; ly = y;
          }
          if (pts.length >= 100000) break;
        }
        if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  reactdiff: {
    name: "Reaction-Diffusion",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "cell", label: "Cell mm", type: "slider", min: 1.5, max: 5, step: 0.25, def: 2.5 },
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 400, step: 10, def: 200 },
      { key: "feed", label: "Feed F", type: "slider", min: 0.01, max: 0.09, step: 0.001, def: 0.037 },
      { key: "kill", label: "Kill k", type: "slider", min: 0.045, max: 0.07, step: 0.001, def: 0.06 },
      { key: "spots", label: "Seed spots", type: "slider", min: 1, max: 20, step: 1, def: 6 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 3, step: 1, def: 1 },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 33 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 15 || bh < 15) return applyStyle({ paths: [] }, ins[0]);
      const cell = Math.max(1.2, p.cell);
      const cols = Math.min(110, Math.max(10, Math.round(bw / cell)));
      const rows = Math.min(150, Math.max(10, Math.round(bh / cell)));
      /* Gray-Scott, deterministic replay from seeded spots (stateless per compute:
         wire a value into Iterations to animate the pattern growing) */
      const NC = cols * rows;
      let U = new Float64Array(NC).fill(1);
      let V = new Float64Array(NC).fill(0);
      const rng = mulberry32(p.seed * 6733 + 11);
      const nSpots = Math.max(1, Math.min(30, Math.round(p.spots)));
      for (let s = 0; s < nSpots; s++) {
        const sx = 3 + Math.floor(rng() * (cols - 6));
        const sy = 3 + Math.floor(rng() * (rows - 6));
        const r = 2 + Math.floor(rng() * 2);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const xx = sx + dx, yy = sy + dy;
            if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
            V[yy * cols + xx] = 1;
            U[yy * cols + xx] = 0.5;
          }
        }
      }
      const Du = 0.16, Dv = 0.08, F = p.feed, K = p.kill;
      const gens = Math.max(0, Math.min(500, Math.floor(p.iters)));
      let U2 = new Float64Array(NC), V2 = new Float64Array(NC);
      for (let g = 0; g < gens; g++) {
        for (let y = 0; y < rows; y++) {
          const yu = y === 0 ? 0 : y - 1, yd = y === rows - 1 ? rows - 1 : y + 1;
          for (let x = 0; x < cols; x++) {
            const xl = x === 0 ? 0 : x - 1, xr = x === cols - 1 ? cols - 1 : x + 1;
            const i = y * cols + x;
            const lapU = 0.2 * (U[y * cols + xl] + U[y * cols + xr] + U[yu * cols + x] + U[yd * cols + x])
              + 0.05 * (U[yu * cols + xl] + U[yu * cols + xr] + U[yd * cols + xl] + U[yd * cols + xr]) - U[i];
            const lapV = 0.2 * (V[y * cols + xl] + V[y * cols + xr] + V[yu * cols + x] + V[yd * cols + x])
              + 0.05 * (V[yu * cols + xl] + V[yu * cols + xr] + V[yd * cols + xl] + V[yd * cols + xr]) - V[i];
            const uvv = U[i] * V[i] * V[i];
            U2[i] = U[i] + (Du * lapU - uvv + F * (1 - U[i]));
            V2[i] = V[i] + (Dv * lapV + uvv - (F + K) * V[i]);
          }
        }
        let t = U; U = U2; U2 = t;
        t = V; V = V2; V2 = t;
      }
      /* marching-squares contours of V */
      const gx = (c) => m + (c / (cols - 1)) * bw;
      const gy = (r) => m + (r / (rows - 1)) * bh;
      const segs = [];
      const NB = Math.max(1, Math.min(4, Math.round(p.bands)));
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let bi = 0; bi < NB; bi++) {
        const lvl = 0.18 + bi * 0.08;
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = V[r * cols + c], tr = V[r * cols + c + 1];
            const bl = V[(r + 1) * cols + c], br = V[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segs.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  julia: {
    name: "Julia",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Set", type: "select", options: ["Julia", "Mandelbrot"], def: "Julia" },
      { key: "cre", label: "c real (wire LFO)", type: "slider", min: -1.5, max: 1.5, step: 0.005, def: -0.7 },
      { key: "cim", label: "c imag", type: "slider", min: -1.5, max: 1.5, step: 0.005, def: 0.27 },
      { key: "zoom", label: "Zoom", type: "slider", min: 0.5, max: 8, step: 0.1, def: 1 },
      { key: "iters", label: "Max iterations", type: "slider", min: 20, max: 200, step: 5, def: 60 },
      { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "cell", label: "Cell mm", type: "slider", min: 0.8, max: 4, step: 0.2, def: 1.6 },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 10 || bh < 10) return applyStyle({ paths: [] }, ins[0]);
      const cell = Math.max(0.6, p.cell);
      const cols = Math.min(240, Math.max(10, Math.round(bw / cell)));
      const rows = Math.min(320, Math.max(10, Math.round(bh / cell)));
      const julia = p.mode === "Julia";
      const zoom = Math.max(0.1, p.zoom);
      const span = 3.2 / zoom;
      const cx0 = julia ? 0 : -0.5;
      const aspect = bh / bw;
      const maxIt = Math.max(10, Math.min(400, Math.round(p.iters)));
      /* smooth escape-time field, normalized 0..1 */
      const field = (fx, fyv) => {
        let zr, zi, cr, ci2;
        if (julia) { zr = fx; zi = fyv; cr = p.cre; ci2 = p.cim; }
        else { zr = 0; zi = 0; cr = fx; ci2 = fyv; }
        let i = 0;
        let r2 = zr * zr + zi * zi;
        while (i < maxIt && r2 < 16) {
          const nr = zr * zr - zi * zi + cr;
          zi = 2 * zr * zi + ci2;
          zr = nr;
          r2 = zr * zr + zi * zi;
          i++;
        }
        if (i >= maxIt) return 1;
        const sm = i + 1 - Math.log2(Math.max(1.0001, Math.log(Math.sqrt(r2))));
        return Math.max(0, Math.min(1, sm / maxIt));
      };
      const gx = (c) => m + (c / (cols - 1)) * bw;
      const gy = (r) => m + (r / (rows - 1)) * bh;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fx = cx0 + (c / (cols - 1) - 0.5) * span;
          const fyv = (r / (rows - 1) - 0.5) * span * aspect;
          F[r * cols + c] = field(fx, fyv);
        }
      }
      const segs = [];
      const NB = Math.max(1, Math.min(8, Math.round(p.bands)));
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      for (let bi = 0; bi < NB; bi++) {
        const lvl = (bi + 1) / (NB + 1);
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A2, B2) => segs.push([A2, B2]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      const paths = [];
      const L = Math.round(p.layer);
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  diffgrowth: {
    name: "Differential Growth",
    cat: "gen",
    group: "organic",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 400, step: 5, def: 150 },
      { key: "repel", label: "Repulsion radius mm", type: "slider", min: 2, max: 15, step: 0.5, def: 6 },
      { key: "edge", label: "Edge length mm", type: "slider", min: 1, max: 6, step: 0.25, def: 2.5 },
      { key: "chaos", label: "Chaos", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "r0", label: "Seed circle mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 17 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const R = Math.max(1.5, p.repel);
      const edge = Math.max(0.8, p.edge);
      const MAXP = 2600;
      /* seed circle */
      const rng = mulberry32(p.seed * 4241 + 13);
      const cx = W / 2, cy = H / 2;
      let pts = [];
      const N0 = 40;
      for (let i = 0; i < N0; i++) {
        const a = (i / N0) * Math.PI * 2;
        const rr = Math.max(3, p.r0) * (1 + (rng() - 0.5) * 0.1);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      const gens = Math.max(0, Math.min(500, Math.floor(p.iters)));
      const STEP = 0.55;
      for (let g = 0; g < gens; g++) {
        const n = pts.length;
        /* spatial buckets for repulsion */
        const bs = R;
        const grid = new Map();
        const bk = (x, y) => Math.floor(x / bs) + "," + Math.floor(y / bs);
        for (let i = 0; i < n; i++) {
          const k = bk(pts[i][0], pts[i][1]);
          let a = grid.get(k);
          if (!a) { a = []; grid.set(k, a); }
          a.push(i);
        }
        const nxt = new Array(n);
        for (let i = 0; i < n; i++) {
          const [x, y] = pts[i];
          let fx = 0, fy = 0;
          /* attraction: springs to ring neighbours */
          const pa = pts[(i - 1 + n) % n], pb = pts[(i + 1) % n];
          fx += (pa[0] + pb[0] - 2 * x) * 0.28;
          fy += (pa[1] + pb[1] - 2 * y) * 0.28;
          /* repulsion from everything nearby (bucket search) */
          const bxc = Math.floor(x / bs), byc = Math.floor(y / bs);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const cellA = grid.get((bxc + dx) + "," + (byc + dy));
              if (!cellA) continue;
              for (const j of cellA) {
                if (j === i) continue;
                const ox = x - pts[j][0], oy = y - pts[j][1];
                const d = Math.hypot(ox, oy);
                if (d > 1e-6 && d < R) {
                  const f = ((R - d) / R) * 0.9;
                  fx += (ox / d) * f;
                  fy += (oy / d) * f;
                }
              }
            }
          }
          /* position-hashed chaos: deterministic even as points split */
          if (p.chaos > 0) {
            const a = noise2(x * 0.11 + 31.7, y * 0.11 + 8.3, p.seed) * Math.PI * 4;
            fx += Math.cos(a) * p.chaos * 0.4;
            fy += Math.sin(a) * p.chaos * 0.4;
          }
          /* soft walls: repel from the margin box */
          if (x - x0 < R) fx += ((R - (x - x0)) / R) * 1.2;
          if (x1 - x < R) fx -= ((R - (x1 - x)) / R) * 1.2;
          if (y - y0 < R) fy += ((R - (y - y0)) / R) * 1.2;
          if (y1 - y < R) fy -= ((R - (y1 - y)) / R) * 1.2;
          const fl = Math.hypot(fx, fy);
          const s = fl > 1 ? STEP / fl : STEP;
          nxt[i] = [
            Math.max(x0, Math.min(x1, x + fx * s)),
            Math.max(y0, Math.min(y1, y + fy * s))
          ];
        }
        pts = nxt;
        /* growth: split edges that stretched past the threshold */
        if (pts.length < MAXP) {
          const grown = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            grown.push(a);
            if (grown.length + (pts.length - i) < MAXP &&
                Math.hypot(b[0] - a[0], b[1] - a[1]) > edge) {
              grown.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
            }
          }
          pts = grown;
        }
      }
      if (pts.length < 3) return applyStyle({ paths: [] }, ins[0]);
      return applyStyle({ paths: [{ pts, closed: true, layer: Math.round(p.layer) }] }, ins[0]);
    }
  },
  sdfcontours: {
    name: "SDF Contours",
    cat: "mod",
    group: "deform",
    desc: "Distance-field isolines around ALL input geometry: unlike per-path Offset, nearby shapes merge into one smooth halo, like metaballs. Start/step/count set the contour distances; Inside adds negative offsets within closed shapes. Cell controls field resolution.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "start", label: "First contour mm", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
      { key: "step", label: "Contour step mm", type: "slider", min: 0.5, max: 15, step: 0.5, def: 3 },
      { key: "count", label: "Contours", type: "slider", min: 1, max: 8, step: 1, def: 3 },
      { key: "inside", label: "Inside contours too", type: "check", def: false },
      { key: "cell", label: "Field cell mm", type: "slider", min: 1, max: 4, step: 0.25, def: 1.8 },
      { key: "keep", label: "Keep source", type: "check", def: true },
      { key: "minlen", label: "Min contour mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
      { key: "layer", label: "Contour pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const maxD = p.start + p.step * Math.max(0, p.count - 1) + p.cell * 2;
      /* segments of all paths, bucketed for nearest-distance queries */
      const segs = [];
      for (const pa of src.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
        }
      }
      if (!segs.length) return EMPTY;
      const bs = Math.max(4, p.cell * 3);
      const bkey = (x, y) => Math.floor(x / bs) + "," + Math.floor(y / bs);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]);
        const y0 = Math.min(s[1], s[3]), y1 = Math.max(s[1], s[3]);
        for (let by = Math.floor(y0 / bs); by <= Math.floor(y1 / bs); by++) {
          for (let bx = Math.floor(x0 / bs); bx <= Math.floor(x1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k);
            if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
        }
      });
      const segDist = (x, y, s) => {
        const dx = s[2] - s[0], dy = s[3] - s[1];
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
      };
      const distAt = (x, y) => {
        /* expanding ring search over buckets, bounded by maxD */
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        let best = maxD + 1;
        const maxR = Math.ceil(maxD / bs) + 1;
        for (let r = 0; r <= maxR; r++) {
          if ((r - 1) * bs > best) break;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const a = buckets.get((bx + dx) + "," + (by + dy));
              if (!a) continue;
              for (const i of a) {
                const d = segDist(x, y, segs[i]);
                if (d < best) best = d;
              }
            }
          }
        }
        return best;
      };
      /* sign: inside any closed path -> negative, ALWAYS (so default contours
         are outside-only; the Inside option merely adds negative levels) */
      const closedPolys = src.paths.filter((pa) => pa.closed && pa.pts.length >= 3).map((pa) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of pa.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        return { poly: pa.pts, x0, y0, x1, y1 };
      });
      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const signAt = (x, y) => {
        for (const cp of closedPolys) {
          if (x < cp.x0 || x > cp.x1 || y < cp.y0 || y > cp.y1) continue;
          if (pip(x, y, cp.poly)) return -1;
        }
        return 1;
      };
      const cell = Math.max(0.8, p.cell);
      const cols = Math.min(260, Math.max(4, Math.round(W / cell) + 1));
      const rows = Math.min(380, Math.max(4, Math.round(H / cell) + 1));
      const gx = (c) => (c / (cols - 1)) * W;
      const gy = (r) => (r / (rows - 1)) * H;
      const F = new Float64Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gx(c), y = gy(r);
          F[r * cols + c] = distAt(x, y) * (closedPolys.length ? signAt(x, y) : 1);
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      if (p.keep) src.paths.forEach((pa) => paths.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }));
      const segsOut = [];
      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);
      const levels = [];
      for (let k = 0; k < Math.max(1, Math.round(p.count)); k++) {
        const d = p.start + p.step * k;
        levels.push(d);
        if (p.inside) levels.push(-d);
      }
      for (const lvl of levels) {
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = F[r * cols + c], tr = F[r * cols + c + 1];
            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];
            let idx = 0;
            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;
            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;
            if (idx === 0 || idx === 15) continue;
            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);
            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];
            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];
            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];
            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];
            const S = (A, B) => segsOut.push([A, B]);
            switch (idx) {
              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;
              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;
              case 5: S(eL(), eT()); S(eB(), eR()); break;
              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;
              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;
              case 10: S(eL(), eB()); S(eT(), eR()); break;
              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;
              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;
            }
          }
        }
      }
      const q = (v) => Math.round(v * 100) / 100;
      const kk = (pt) => q(pt[0]) + "," + q(pt[1]);
      const map = new Map();
      const items = segsOut.map((s) => ({ a: s[0], b: s[1], used: false }));
      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };
      items.forEach((s, i) => { push(kk(s.a), { i, end: "a" }); push(kk(s.b), { i, end: "b" }); });
      for (let i = 0; i < items.length; i++) {
        if (items[i].used) continue;
        items[i].used = true;
        const chain = [items[i].a, items[i].b];
        let grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.push(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        grow = true;
        while (grow) {
          grow = false;
          for (const ref of (map.get(kk(chain[0])) || [])) {
            const s = items[ref.i];
            if (s.used) continue;
            chain.unshift(ref.end === "a" ? s.b : s.a);
            s.used = true; grow = true; break;
          }
        }
        if (chain.length < 3) continue;
        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;
        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.6;
        if (closed) chain.pop();
        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });
      }
      return { paths };
    }
  },
  raydrape: {
    name: "Ray",
    cat: "duo",
    desc: "Houdini-style Ray: every point of A is cast along a direction until it hits B's lines, so A drapes over B like fabric or rain. Points that miss keep their place (or drop). Offset lands the line slightly before the surface.",
    ins: [Pin("paths", "A (to project)"), Pin("paths", "B (targets)")],
    outs: [Pin("paths")],
    params: [
      { key: "angle", label: "Direction deg (90=down)", type: "slider", min: 0, max: 360, step: 1, def: 90 },
      { key: "maxd", label: "Max distance mm (0=inf)", type: "slider", min: 0, max: 300, step: 5, def: 0 },
      { key: "offset", label: "Offset from surface mm", type: "slider", min: 0, max: 10, step: 0.25, def: 0.5 },
      { key: "misses", label: "Keep misses in place", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 }
    ],
    compute(ins, p, ctx) {
      const A = ins[0] || EMPTY, B = ins[1] || EMPTY;
      if (!B.paths || !B.paths.length) {
        return { paths: A.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      const segs = [];
      for (const pa of B.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
        }
      }
      const a = (p.angle * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);
      const maxd = p.maxd > 0 ? p.maxd : 1e9;
      /* ray (px,py)+t(dx,dy) vs segment: standard 2x2 solve */
      const cast = (px, py) => {
        let best = Infinity;
        for (const s of segs) {
          const ex = s[2] - s[0], ey = s[3] - s[1];
          const den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-12) continue;
          const qx = s[0] - px, qy = s[1] - py;
          const t = (qx * ey - qy * ex) / den;
          const u = (qx * dy - qy * dx) / den;
          if (t >= 0 && t <= maxd && u >= 0 && u <= 1 && t < best) best = t;
        }
        return best;
      };
      const paths = [];
      A.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        const out = [];
        for (const [px, py] of pts) {
          const t = cast(px, py);
          if (t === Infinity) {
            if (p.misses) out.push([px, py]);
            else { if (out.length > 1) paths.push({ pts: out.slice(), closed: false, layer: path.layer }); out.length = 0; }
          } else {
            const tt = Math.max(0, t - p.offset);
            out.push([px + dx * tt, py + dy * tt]);
          }
        }
        if (out.length > 1) paths.push({ pts: out, closed: path.closed && p.misses, layer: path.layer });
      });
      return { paths };
    }
  },
  runes: {
    name: "Runes",
    cat: "gen",
    group: "textimg",
    desc: "Asemic writing: a seeded alphabet of invented angular glyphs, laid out in words and lines like real text. Because letters repeat from a finite alphabet, it reads as language. Complexity sets strokes per glyph; every seed is a new script.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "size", label: "Glyph height mm", type: "slider", min: 3, max: 20, step: 0.5, def: 7 },
      { key: "alphabet", label: "Alphabet size", type: "slider", min: 6, max: 30, step: 1, def: 16 },
      { key: "complexity", label: "Strokes per glyph", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "linesp", label: "Line spacing", type: "slider", min: 1.2, max: 3, step: 0.1, def: 1.8 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "seed", label: "Seed", type: "seed", def: 77 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const gh = Math.max(2, p.size);
      const gw = gh * 0.62;
      /* build a seeded alphabet: glyphs = strokes on a 3x4 lattice */
      const K = Math.max(4, Math.min(40, Math.round(p.alphabet)));
      const CPX = Math.max(1, Math.min(8, Math.round(p.complexity)));
      const rng = mulberry32(p.seed * 3323 + 7);
      const LX = 3, LY = 4;
      const alphabet = [];
      for (let g = 0; g < K; g++) {
        const strokes = [];
        const nStrokes = 1 + Math.floor(rng() * CPX);
        for (let s = 0; s < nStrokes; s++) {
          /* each stroke: 2-3 lattice points, no zero-length hops */
          const nPts = 2 + (rng() < 0.4 ? 1 : 0);
          const pts = [];
          let last = -1;
          for (let i = 0; i < nPts; i++) {
            let pt;
            do { pt = Math.floor(rng() * LX * LY); } while (pt === last);
            last = pt;
            pts.push([(pt % LX) / (LX - 1), Math.floor(pt / LX) / (LY - 1)]);
          }
          strokes.push(pts);
        }
        /* every glyph gets a baseline anchor stroke sometimes (stability) */
        if (rng() < 0.35) strokes.push([[0, 1], [1, 1]]);
        alphabet.push(strokes);
      }
      /* text stream: seeded glyph sequence with Zipf-ish letter frequency + words */
      const paths = [];
      const L = Math.round(p.layer);
      const lineH = gh * Math.max(1.1, p.linesp);
      const step = gw * 1.28;
      const space = gw * 0.9;
      const zipf = () => {
        /* low indices much more common, like real letters */
        const r = rng();
        return Math.min(K - 1, Math.floor(K * r * r));
      };
      let y = y0;
      while (y + gh <= y1) {
        let x = x0;
        let word = 2 + Math.floor(rng() * 7);
        while (x + gw <= x1) {
          if (word <= 0) {
            x += space;
            word = 2 + Math.floor(rng() * 7);
            continue;
          }
          const strokes = alphabet[zipf()];
          for (const st of strokes) {
            const pts = st.map(([u, v]) => [x + u * gw, y + v * gh]);
            paths.push({ pts, closed: false, layer: L });
          }
          x += step;
          word--;
        }
        y += lineH;
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  network: {
    name: "Network",
    cat: "gen",
    group: "structural",
    desc: "A seeded graph laid out by force simulation (nodes repel, edges pull), replayed deterministically for N iterations - wire a value into Iterations to watch it untangle. Nearest-neighbour links plus a few long-range ones give constellation diagrams; node circles can scale by connection count.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "nodes", label: "Nodes", type: "slider", min: 5, max: 120, step: 1, def: 40 },
      { key: "links", label: "Links per node", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "longp", label: "Long links", type: "slider", min: 0, max: 0.3, step: 0.01, def: 0.06 },
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 0, max: 300, step: 5, def: 120 },
      { key: "dots", label: "Draw nodes", type: "check", def: true },
      { key: "degsize", label: "Size by connections", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const N2 = Math.max(3, Math.min(150, Math.round(p.nodes)));
      const rng = mulberry32(p.seed * 9013 + 3);
      const pos = [];
      for (let i = 0; i < N2; i++) {
        pos.push([x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)]);
      }
      /* edges: k nearest at start + seeded long-range links */
      const edges = new Set();
      const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a;
      const kNear = Math.max(1, Math.min(6, Math.round(p.links)));
      for (let i = 0; i < N2; i++) {
        const d = pos.map((q, j) => [Math.hypot(q[0] - pos[i][0], q[1] - pos[i][1]), j])
          .sort((a, b) => a[0] - b[0]);
        for (let k = 1; k <= kNear && k < d.length; k++) edges.add(ek(i, d[k][1]));
        if (rng() < p.longp * 3) {
          const j = Math.floor(rng() * N2);
          if (j !== i) edges.add(ek(i, j));
        }
      }
      const E = [...edges].map((k) => k.split("_").map(Number));
      const deg = new Array(N2).fill(0);
      for (const [a, b] of E) { deg[a]++; deg[b]++; }
      /* force layout: repulsion all pairs, springs on edges, deterministic */
      const gens = Math.max(0, Math.min(400, Math.floor(p.iters)));
      const ideal = Math.sqrt(((x1 - x0) * (y1 - y0)) / N2) * 0.9;
      for (let g = 0; g < gens; g++) {
        const fx = new Float64Array(N2), fy = new Float64Array(N2);
        for (let i = 0; i < N2; i++) {
          for (let j = i + 1; j < N2; j++) {
            let ox = pos[i][0] - pos[j][0], oy = pos[i][1] - pos[j][1];
            let d = Math.hypot(ox, oy);
            if (d < 0.01) { ox = 0.01 * ((i % 3) - 1); oy = 0.01; d = 0.014; }
            const f = (ideal * ideal) / (d * d) * 0.5;
            fx[i] += (ox / d) * f; fy[i] += (oy / d) * f;
            fx[j] -= (ox / d) * f; fy[j] -= (oy / d) * f;
          }
        }
        for (const [a, b] of E) {
          const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
          const d = Math.hypot(ox, oy) || 0.01;
          const f = (d - ideal) * 0.05;
          fx[a] += (ox / d) * f; fy[a] += (oy / d) * f;
          fx[b] -= (ox / d) * f; fy[b] -= (oy / d) * f;
        }
        const cool = 1 - g / (gens + 1);
        for (let i = 0; i < N2; i++) {
          const fl = Math.hypot(fx[i], fy[i]) || 1;
          const s = Math.min(3 * cool + 0.2, fl) / fl;
          pos[i][0] = Math.max(x0, Math.min(x1, pos[i][0] + fx[i] * s));
          pos[i][1] = Math.max(y0, Math.min(y1, pos[i][1] + fy[i] * s));
        }
      }
      const paths = [];
      const L = Math.round(p.layer);
      const rOf = (i) => p.degsize ? 1 + Math.min(4, deg[i] * 0.5) : 1.6;
      for (const [a, b] of E) {
        /* trim edge lines so they stop at the node circles */
        const ox = pos[b][0] - pos[a][0], oy = pos[b][1] - pos[a][1];
        const d = Math.hypot(ox, oy);
        if (d < 0.5) continue;
        const ra = p.dots ? rOf(a) + 0.4 : 0, rb = p.dots ? rOf(b) + 0.4 : 0;
        if (ra + rb >= d) continue;
        paths.push({
          pts: [
            [pos[a][0] + (ox / d) * ra, pos[a][1] + (oy / d) * ra],
            [pos[b][0] - (ox / d) * rb, pos[b][1] - (oy / d) * rb]
          ],
          closed: false, layer: L
        });
      }
      if (p.dots) {
        for (let i = 0; i < N2; i++) {
          const r = rOf(i);
          const c = [];
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            c.push([pos[i][0] + Math.cos(a) * r, pos[i][1] + Math.sin(a) * r]);
          }
          paths.push({ pts: c, closed: true, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  tubes: {
    name: "Tubes",
    cat: "gen",
    group: "structural",
    desc: "Tubes wandering and crossing in 3D, projected with perspective and drawn with real hidden lines: tubes break cleanly where they pass behind each other, and their own back side is hidden. Surface is one continuous spiral per tube (single pen-down) or a ring+line wireframe mesh. Radius is noise-modulated; wire Drift to make the tubes move over an animation.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tubes", label: "Tubes", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "radius", label: "Radius mm", type: "slider", min: 2, max: 20, step: 0.5, def: 8 },
      { key: "rmod", label: "Radius modulation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "wander", label: "Wander", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.5 },
      { key: "length", label: "Tube length mm", type: "slider", min: 80, max: 400, step: 10, def: 220 },
      { key: "surface", label: "Surface", type: "select", options: ["Spiral", "Mesh"], def: "Spiral" },
      { key: "density", label: "Spiral turns / ring gap", type: "slider", min: 1, max: 10, step: 0.5, def: 4 },
      { key: "longs", label: "Mesh longitudinals", type: "slider", min: 3, max: 10, step: 1, def: 6 },
      { key: "hidden", label: "Hidden lines", type: "check", def: true },
      { key: "drift", label: "Drift (wire Frame)", type: "slider", min: 0, max: 10, step: 0.05, def: 0 },
      { key: "yaw", label: "View yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 25 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 9 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const NT = Math.max(1, Math.min(8, Math.round(p.tubes)));
      const R0 = Math.max(1, p.radius);
      const DEPTH = Math.min(bw, bh) * 1.2;
      const box = { x: bw / 2, y: bh / 2, z: DEPTH / 2 };
      /* --- 1) center curves: smooth bouncing walks in a 3D box --- */
      const STEP = 1.4;
      const tubesC = [];
      for (let tI = 0; tI < NT; tI++) {
        const s = p.seed * 131 + tI * 977;
        let x = (hash2(tI * 3 + 1, 1, p.seed) - 0.5) * box.x * 1.4;
        let y = (hash2(tI * 3 + 2, 2, p.seed) - 0.5) * box.y * 1.4;
        let z = (hash2(tI * 3 + 3, 3, p.seed) - 0.5) * box.z * 1.4;
        let th = hash2(tI * 3 + 4, 4, p.seed) * Math.PI * 2;
        let ph = (hash2(tI * 3 + 5, 5, p.seed) - 0.5) * Math.PI * 0.8;
        const pts = [];
        const nSteps = Math.round(Math.max(40, p.length) / STEP);
        for (let i = 0; i <= nSteps; i++) {
          pts.push([x, y, z]);
          const u = i * STEP * 0.02;
          th += (noise2(u + tI * 7.3, p.drift + 11.1, s) - 0.5) * p.wander * 0.9;
          ph += (noise2(u + tI * 7.3, p.drift + 53.7, s + 1) - 0.5) * p.wander * 0.7;
          ph = Math.max(-1.1, Math.min(1.1, ph));
          x += Math.cos(th) * Math.cos(ph) * STEP;
          y += Math.sin(th) * Math.cos(ph) * STEP;
          z += Math.sin(ph) * STEP;
          /* bounce off the box walls to stay composed */
          if (x > box.x || x < -box.x) { th = Math.PI - th; x = Math.max(-box.x, Math.min(box.x, x)); }
          if (y > box.y || y < -box.y) { th = -th; y = Math.max(-box.y, Math.min(box.y, y)); }
          if (z > box.z || z < -box.z) { ph = -ph; z = Math.max(-box.z, Math.min(box.z, z)); }
        }
        tubesC.push(pts);
      }
      /* radius along each tube: noise-modulated */
      const rAt = (tI, i, n) => {
        const u = (i / n) * 6;
        const taper = Math.min(1, Math.min(i, n - i) / (n * 0.12));
        return R0 * (1 + (noise2(u + tI * 3.1, p.drift + 29.5, p.seed + 7 + tI) - 0.5) * 2 * p.rmod * 0.6) * (0.35 + 0.65 * taper);
      };
      /* --- 2) rotation-minimizing frames --- */
      const frames = tubesC.map((pts) => {
        const T = [], Nn = [], B = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
          const tl = Math.hypot(tx, ty, tz) || 1;
          tx /= tl; ty /= tl; tz /= tl;
          T.push([tx, ty, tz]);
          if (i === 0) {
            let nx = -ty, ny = tx, nz = 0;
            const nl = Math.hypot(nx, ny, nz) || 1;
            if (nl < 0.1) { nx = 1; ny = 0; nz = 0; }
            Nn.push([nx / nl, ny / nl, nz / nl]);
          } else {
            /* project previous normal off the new tangent */
            const pn = Nn[i - 1];
            const d = pn[0] * tx + pn[1] * ty + pn[2] * tz;
            let nx = pn[0] - d * tx, ny = pn[1] - d * ty, nz = pn[2] - d * tz;
            const nl = Math.hypot(nx, ny, nz) || 1;
            Nn.push([nx / nl, ny / nl, nz / nl]);
          }
          const t2 = T[i], n2 = Nn[i];
          B.push([
            t2[1] * n2[2] - t2[2] * n2[1],
            t2[2] * n2[0] - t2[0] * n2[2],
            t2[0] * n2[1] - t2[1] * n2[0]
          ]);
        }
        return { T, N: Nn, B };
      });
      /* --- 3) view: yaw around Y + slight pitch, perspective --- */
      const ya = (p.yaw * Math.PI) / 180, pa2 = 0.25;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      const FOC = DEPTH * 2.2;
      const proj = (x, y, z) => {
        let X = x * cy2 + z * sy2;
        let Z = -x * sy2 + z * cy2;
        let Y = y * cp2 - Z * sp2;
        Z = y * sp2 + Z * cp2;
        const s = FOC / (FOC + Z);
        return [X * s, Y * s, Z, s];
      };
      /* projected center samples per tube (occlusion buffer) */
      const centers = tubesC.map((pts, tI) => pts.map((q, i) => {
        const [X, Y, Z, s] = proj(q[0], q[1], q[2]);
        return { X, Y, Z, rp: rAt(tI, i, pts.length - 1) * s };
      }));
      /* --- 4) surface geometry (projected, with depth + occlusion info) --- */
      const rawPaths = []; /* { pts: [[X,Y,Z,tI]], layer } split later */
      const TWO = Math.PI * 2;
      for (let tI = 0; tI < NT; tI++) {
        const C = tubesC[tI], Fp = frames[tI];
        const n = C.length - 1;
        const surfPt = (i, ang) => {
          const r = rAt(tI, i, n);
          const Nv = Fp.N[i], Bv = Fp.B[i];
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const x = C[i][0] + (Nv[0] * ca + Bv[0] * sa) * r;
          const y = C[i][1] + (Nv[1] * ca + Bv[1] * sa) * r;
          const z = C[i][2] + (Nv[2] * ca + Bv[2] * sa) * r;
          const [X, Y, Z] = proj(x, y, z);
          return [X, Y, Z];
        };
        if (p.surface === "Spiral") {
          const turnsPer = Math.max(0.5, p.density);
          const pts = [];
          /* substep so the helix stays smooth */
          const SUB = 6;
          for (let i = 0; i < n; i++) {
            for (let ss = 0; ss < SUB; ss++) {
              const fi = i + ss / SUB;
              const i0 = Math.floor(fi);
              const ang = (fi * STEP / 10) * turnsPer * TWO;
              pts.push([...surfPt(i0, ang), tI, i0]);
            }
          }
          rawPaths.push({ pts, tI });
        } else {
          /* rings */
          const gap = Math.max(1.5, 12 / Math.max(0.5, p.density));
          const every = Math.max(1, Math.round(gap / STEP));
          for (let i = 0; i <= n; i += every) {
            const ring = [];
            for (let k = 0; k <= 24; k++) {
              ring.push([...surfPt(i, (k / 24) * TWO), tI, i]);
            }
            rawPaths.push({ pts: ring, tI });
          }
          /* longitudinals */
          const NL = Math.max(2, Math.min(12, Math.round(p.longs)));
          for (let l = 0; l < NL; l++) {
            const ang = (l / NL) * TWO;
            const line = [];
            for (let i = 0; i <= n; i++) line.push([...surfPt(i, ang), tI, i]);
            rawPaths.push({ pts: line, tI });
          }
        }
      }
      /* --- 5) fit to sheet --- */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const rp of rawPaths) for (const q of rp.pts) {
        if (q[0] < fx0) fx0 = q[0]; if (q[0] > fx1) fx1 = q[0];
        if (q[1] < fy0) fy0 = q[1]; if (q[1] > fy1) fy1 = q[1];
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      /* occlusion buffer in sheet coords, bucketed */
      const occ = [];
      centers.forEach((cs, tI) => cs.forEach((c, i) => occ.push({
        x: c.X * sc + ox, y: c.Y * sc + oy, z: c.Z, r: c.rp * sc, tI, i
      })));
      const bs = Math.max(4, R0 * sc * 1.5);
      const grid = new Map();
      occ.forEach((o, k) => {
        const key = Math.floor(o.x / bs) + "," + Math.floor(o.y / bs);
        let a = grid.get(key);
        if (!a) { a = []; grid.set(key, a); }
        a.push(k);
      });
      const isHidden = (x, y, z, tI, ci) => {
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const a = grid.get((bx + dx) + "," + (by + dy));
            if (!a) continue;
            for (const k of a) {
              const o = occ[k];
              if (o.tI === tI && Math.abs(o.i - ci) < 14) continue; /* not our own neighbourhood */
              if (o.z < z - o.r * 0.4 && Math.hypot(x - o.x, y - o.y) < o.r * 0.96) return true;
            }
          }
        }
        return false;
      };
      /* back side of the own tube: sample z behind own center z */
      const centerZ = (tI, i) => centers[tI][Math.min(centers[tI].length - 1, i)].Z;
      const paths = [];
      const L = Math.round(p.layer);
      for (const rp of rawPaths) {
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        for (const q of rp.pts) {
          const x = q[0] * sc + ox, y = q[1] * sc + oy, z = q[2];
          const tI = q[3], ci = q[4];
          let vis = true;
          if (p.hidden) {
            if (z > centerZ(tI, ci) + 0.6) vis = false; /* own back side */
            else if (isHidden(x, y, z, tI, ci)) vis = false;
          }
          if (vis) run.push([Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]);
          else flush();
        }
        flush();
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  view3d: {
    name: "3D View",
    cat: "mod",
    group: "deform",
    desc: "Puts the drawing into 3D space and views it from any angle: yaw/pitch/roll with adjustable perspective (0 = isometric, 1 = dramatic). Z source: Flat tilts the sheet like paper; Pens stacked gives each pen layer its own depth (parallax when rotated); Noise relief bends the drawing over a heightfield. Wire Frame into Yaw for a spinning-drawing animation.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "yaw", label: "Yaw deg (wire Frame x360)", type: "slider", min: 0, max: 360, step: 1, def: 30 },
      { key: "pitch", label: "Pitch deg", type: "slider", min: -90, max: 90, step: 1, def: 30 },
      { key: "roll", label: "Roll deg", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.02, def: 0.5 },
      { key: "zsource", label: "Z source", type: "select", options: ["Flat", "Pens stacked", "Noise relief"], def: "Flat" },
      { key: "gap", label: "Pen layer gap mm", type: "slider", min: 1, max: 40, step: 0.5, def: 10 },
      { key: "relief", label: "Relief height mm", type: "slider", min: 0, max: 60, step: 1, def: 25 },
      { key: "rscale", label: "Relief scale", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.5 },
      { key: "fit", label: "Fit to sheet", type: "check", def: true },
      { key: "res", label: "Relief sample mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1.2 },
      { key: "seed", label: "Seed (relief)", type: "seed", def: 3 },
      { key: "margin", label: "Fit margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const D2R = Math.PI / 180;
      const ya = p.yaw * D2R, pi2 = p.pitch * D2R, ro = p.roll * D2R;
      const cyaw = Math.cos(ya), syaw = Math.sin(ya);
      const cpit = Math.cos(pi2), spit = Math.sin(pi2);
      const crol = Math.cos(ro), srol = Math.sin(ro);
      /* perspective: exponential focal curve — 0 is genuinely isometric
         (focal ~60x canvas), 0.5 pleasant, 1 dramatic */
      const span = Math.max(W, H);
      const FOC = span * 0.7 * Math.pow(85, 1 - Math.max(0, Math.min(1, p.persp)));
      const zOf = (x, y, layer) => {
        if (p.zsource === "Pens stacked") return -(layer || 0) * Math.max(0, p.gap);
        if (p.zsource === "Noise relief") {
          return (noise2(x * 0.012 * p.rscale + 5.7, y * 0.012 * p.rscale + 2.3, p.seed) - 0.5) * 2 * Math.max(0, p.relief);
        }
        return 0;
      };
      const proj = (x, y, layer) => {
        let X = x - cx, Y = y - cy, Z = zOf(x, y, layer);
        /* roll (Z axis) */
        let X1 = X * crol - Y * srol, Y1 = X * srol + Y * crol;
        /* yaw (Y axis) */
        let X2 = X1 * cyaw + Z * syaw;
        let Z2 = -X1 * syaw + Z * cyaw;
        /* pitch (X axis) */
        const Y3 = Y1 * cpit - Z2 * spit;
        const Z3 = Y1 * spit + Z2 * cpit;
        const s = FOC / Math.max(FOC * 0.1, FOC + Z3);
        return [X2 * s, Y3 * s];
      };
      /* straight lines stay straight under perspective, so resampling is only
         needed when the relief bends the plane itself */
      const needResample = p.zsource === "Noise relief";
      const projected = src.paths.map((path) => ({
        layer: path.layer, closed: path.closed,
        pts: (needResample ? resample(path.pts, path.closed, Math.max(0.4, p.res)) : path.pts)
          .map(([x, y]) => proj(x, y, path.layer))
      }));
      /* fit or clamp */
      const m = Math.max(0, p.margin);
      let paths;
      if (p.fit) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const pa of projected) for (const [x, y] of pa.pts) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const bw = W - 2 * m, bh = H - 2 * m;
        const sc = Math.min(bw / ((x1 - x0) || 1), bh / ((y1 - y0) || 1));
        const ox = m + (bw - (x1 - x0) * sc) / 2 - x0 * sc;
        const oy = m + (bh - (y1 - y0) * sc) / 2 - y0 * sc;
        paths = projected.map((pa) => ({
          ...pa, pts: pa.pts.map(([x, y]) => [x * sc + ox, y * sc + oy])
        }));
      } else {
        paths = projected.map((pa) => ({
          ...pa,
          pts: pa.pts.map(([x, y]) => [
            Math.max(0.5, Math.min(W - 0.5, x + cx)),
            Math.max(0.5, Math.min(H - 0.5, y + cy))
          ])
        }));
      }
      return { paths };
    }
  },
  girih: {
    name: "Girih",
    cat: "gen",
    group: "geometric",
    desc: "Islamic star patterns by Hankin's method: a polygon tiling where two rays leave every edge midpoint at a contact angle and meet inside the tile, weaving a continuous star-and-polygon lattice. One angle slider morphs through the whole pattern family (54 deg is the classic); hexagon and square tilings.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tiling", label: "Tiling", type: "select", options: ["Hexagons", "Squares"], def: "Hexagons" },
      { key: "cell", label: "Tile size mm", type: "slider", min: 8, max: 60, step: 1, def: 24 },
      { key: "angle", label: "Contact angle deg (wire LFO)", type: "slider", min: 15, max: 85, step: 0.5, def: 54 },
      { key: "tileLines", label: "Draw tile edges", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);
      const s = Math.max(4, p.cell);
      const tiles = [];
      if (p.tiling === "Squares") {
        for (let y = y0; y + s <= y1 + 0.01; y += s) {
          for (let x = x0; x + s <= x1 + 0.01; x += s) {
            tiles.push([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]);
          }
        }
      } else {
        /* pointy-top hexagons in axial rows */
        const r = s / 2;
        const w = Math.sqrt(3) * r, h = 1.5 * r;
        for (let row = 0; ; row++) {
          const cy = y0 + r + row * h;
          if (cy + r > y1) break;
          const off = (row % 2) * (w / 2);
          for (let col = 0; ; col++) {
            const cx = x0 + w / 2 + off + col * w;
            if (cx + w / 2 > x1) break;
            const hex = [];
            for (let k = 0; k < 6; k++) {
              const a = (Math.PI / 3) * k + Math.PI / 6;
              hex.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
            }
            tiles.push(hex);
          }
        }
      }
      const th = (p.angle * Math.PI) / 180;
      const paths = [];
      const L = Math.round(p.layer);
      for (const poly of tiles) {
        const n = poly.length;
        /* per edge: midpoint + the two Hankin ray directions into the tile */
        const mids = [], d1 = [], d2 = [];
        let cx2 = 0, cy2 = 0;
        for (const [x, y] of poly) { cx2 += x; cy2 += y; }
        cx2 /= n; cy2 /= n;
        for (let i = 0; i < n; i++) {
          const A = poly[i], B = poly[(i + 1) % n];
          const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
          let ex = B[0] - A[0], ey = B[1] - A[1];
          const el = Math.hypot(ex, ey) || 1;
          ex /= el; ey /= el;
          /* inward normal */
          let nx = -ey, ny = ex;
          if ((cx2 - mx) * nx + (cy2 - my) * ny < 0) { nx = -nx; ny = -ny; }
          mids.push([mx, my]);
          d1.push([Math.cos(th) * ex + Math.sin(th) * nx, Math.cos(th) * ey + Math.sin(th) * ny]);
          d2.push([-Math.cos(th) * ex + Math.sin(th) * nx, -Math.cos(th) * ey + Math.sin(th) * ny]);
        }
        /* ray from edge i (dir d1) meets ray from edge i+1 (dir d2) */
        const ring = [];
        let ok = true;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const P = mids[i], D = d1[i], Q = mids[j], E = d2[j];
          const den = D[0] * E[1] - D[1] * E[0];
          let X;
          if (Math.abs(den) < 1e-9) {
            X = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
          } else {
            const t = ((Q[0] - P[0]) * E[1] - (Q[1] - P[1]) * E[0]) / den;
            if (t < 0 || t > s * 2) { ok = false; break; }
            X = [P[0] + D[0] * t, P[1] + D[1] * t];
          }
          ring.push(mids[i].slice(), X);
        }
        if (!ok || ring.length < 4) continue;
        paths.push({ pts: ring, closed: true, layer: L });
        if (p.tileLines) paths.push({ pts: poly.map((q) => q.slice()), closed: true, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  },
  aggregate: {
    name: "Aggregate",
    cat: "gen",
    group: "structural",
    desc: "WASP-style discrete aggregation: copies of a module snap together at connector points (bounding-box edge midpoints), growing a crystal-like assembly one part at a time with collision checks. Wire your own Module in, or use the built-in part. Wire a value into Iterations to animate the growth.",
    ins: [Pin("paths", "Module (optional)"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "iters", label: "Iterations (wire LFO)", type: "slider", min: 1, max: 400, step: 1, def: 60 },
      { key: "scale", label: "Module scale %", type: "slider", min: 20, max: 300, step: 5, def: 100 },
      { key: "rot", label: "Random 90deg rotations", type: "check", def: true },
      { key: "gap", label: "Gap mm", type: "slider", min: -1, max: 6, step: 0.25, def: 0.5 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 41 },
      { key: "layer", label: "Pen (built-in part)", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[1]);
      /* module: wired paths, or a built-in open U part */
      let mod;
      if (ins[0] && ins[0].paths && ins[0].paths.length) {
        mod = ins[0].paths.map((pa) => ({ pts: pa.pts.map((q) => q.slice()), closed: pa.closed, layer: pa.layer }));
      } else {
        const L = Math.round(p.layer);
        mod = [
          { pts: [[-5, 5], [-5, -5], [5, -5], [5, 5]], closed: false, layer: L },
          { pts: [[-2.5, 0], [2.5, 0]], closed: false, layer: L }
        ];
      }
      /* center + measure the module */
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const pa of mod) for (const [x, y] of pa.pts) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const sc = Math.max(0.05, p.scale / 100);
      const mcx = (bx0 + bx1) / 2, mcy = (by0 + by1) / 2;
      const mw = Math.max(1, (bx1 - bx0)) * sc, mh = Math.max(1, (by1 - by0)) * sc;
      const gap = p.gap;
      /* placements: {x, y, rot(0-3), w, h} — 90deg rotations swap w/h */
      const placed = [];
      const rng = mulberry32(p.seed * 5741 + 19);
      const dims = (rot) => (rot % 2 === 0 ? [mw, mh] : [mh, mw]);
      const collides = (x, y, w, h) => {
        const tol = -0.2; /* slight touch allowed */
        if (x - w / 2 < x0 || x + w / 2 > x1 || y - h / 2 < y0 || y + h / 2 > y1) return true;
        for (const pl of placed) {
          const [pw, ph] = dims(pl.rot);
          if (Math.abs(x - pl.x) < (w + pw) / 2 + tol && Math.abs(y - pl.y) < (h + ph) / 2 + tol) return true;
        }
        return false;
      };
      const open = []; /* connectors: {x, y, dir 0=N 1=E 2=S 3=W} on placed parts */
      const addConnectors = (pl) => {
        const [w, h] = dims(pl.rot);
        open.push({ x: pl.x, y: pl.y - h / 2, dir: 0 });
        open.push({ x: pl.x + w / 2, y: pl.y, dir: 1 });
        open.push({ x: pl.x, y: pl.y + h / 2, dir: 2 });
        open.push({ x: pl.x - w / 2, y: pl.y, dir: 3 });
      };
      const first = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rot: 0 };
      placed.push(first);
      addConnectors(first);
      const target = Math.max(1, Math.min(500, Math.round(p.iters)));
      let guard = target * 30;
      while (placed.length < target && open.length && guard-- > 0) {
        const ci = Math.floor(rng() * open.length);
        const c = open[ci];
        const rot = p.rot ? Math.floor(rng() * 4) : 0;
        const [w, h] = dims(rot);
        /* new part sits beyond the connector, opposite side facing it */
        let nx = c.x, ny = c.y;
        if (c.dir === 0) ny -= h / 2 + gap;
        else if (c.dir === 1) nx += w / 2 + gap;
        else if (c.dir === 2) ny += h / 2 + gap;
        else nx -= w / 2 + gap;
        if (collides(nx, ny, w, h)) {
          open.splice(ci, 1);
          continue;
        }
        const pl = { x: nx, y: ny, rot };
        placed.push(pl);
        addConnectors(pl);
        open.splice(ci, 1);
      }
      /* render: module transformed to each placement */
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      for (const pl of placed) {
        const a = (pl.rot * Math.PI) / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (const pa of mod) {
          if (total + pa.pts.length > BUDGET) return applyStyle({ paths }, ins[1]);
          total += pa.pts.length;
          paths.push({
            pts: pa.pts.map(([x, y]) => {
              const lx = (x - mcx) * sc, ly = (y - mcy) * sc;
              return [pl.x + lx * ca - ly * sa, pl.y + lx * sa + ly * ca];
            }),
            closed: pa.closed, layer: pa.layer
          });
        }
      }
      return applyStyle({ paths }, ins[1]);
    }
  },
  turtle: {
    name: "Turtle",
    cat: "gen",
    group: "geometric",
    desc: "Classic turtle graphics from a command string: F/B move drawing, M moves pen-up, R/L turn in degrees, U/D pen up/down, [ ] branch (push/pop), and N[...] repeats a block N times. Example: 36[F8 R10] draws a circle, 5[F40 R144] a star. Auto-fits to the sheet. Deterministic - no seed needed.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "prog", label: "Program", type: "text", def: "12[6[F14 R60] R30]" },
      { key: "startAng", label: "Start angle deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "fit", label: "Fit to sheet", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      /* parse into an op tree: {op, val} or {rep, body} or {branch, body} */
      const src = String(p.prog || "");
      let pos = 0;
      const parseBlock = (depth) => {
        const ops = [];
        while (pos < src.length) {
          const ch = src[pos];
          if (ch === "]") { pos++; return ops; }
          if (/\s|,/.test(ch)) { pos++; continue; }
          if (ch === "[") { pos++; ops.push({ branch: parseBlock(depth + 1) }); continue; }
          if (/[0-9]/.test(ch)) {
            let num = "";
            while (pos < src.length && /[0-9.]/.test(src[pos])) num += src[pos++];
            while (pos < src.length && /\s/.test(src[pos])) pos++;
            if (src[pos] === "[") { pos++; ops.push({ rep: Math.min(200, Math.max(0, Math.round(+num))), body: parseBlock(depth + 1) }); }
            continue; /* bare numbers are ignored */
          }
          const op = ch.toUpperCase();
          pos++;
          if ("FBMRL".includes(op)) {
            let num = "";
            while (pos < src.length && /\s/.test(src[pos])) pos++;
            while (pos < src.length && /[0-9.\-]/.test(src[pos])) num += src[pos++];
            ops.push({ op, val: num === "" ? (op === "R" || op === "L" ? 90 : 10) : +num });
          } else if (op === "U" || op === "D") {
            ops.push({ op });
          } /* unknown chars ignored */
          if (depth > 24) return ops;
        }
        return ops;
      };
      const tree = parseBlock(0);
      /* execute */
      const paths = [];
      let cur = null;
      const st = { x: 0, y: 0, ang: (p.startAng - 90) * Math.PI / 180, pen: true };
      const stack = [];
      let steps = 0;
      const endPath = () => { if (cur && cur.length > 1) paths.push({ pts: cur, closed: false, layer: L }); cur = null; };
      const moveTo = (nx, ny, draw) => {
        if (draw && st.pen) {
          if (!cur) cur = [[st.x, st.y]];
          cur.push([nx, ny]);
        } else endPath();
        st.x = nx; st.y = ny;
      };
      const run = (ops) => {
        for (const o of ops) {
          if (steps++ > 40000) return;
          if (o.rep !== undefined) { for (let i = 0; i < o.rep; i++) { run(o.body); if (steps > 40000) return; } }
          else if (o.branch) {
            stack.push({ ...st });
            endPath();
            run(o.branch);
            endPath();
            const back = stack.pop();
            st.x = back.x; st.y = back.y; st.ang = back.ang; st.pen = back.pen;
          }
          else if (o.op === "F") moveTo(st.x + Math.cos(st.ang) * o.val, st.y + Math.sin(st.ang) * o.val, true);
          else if (o.op === "B") moveTo(st.x - Math.cos(st.ang) * o.val, st.y - Math.sin(st.ang) * o.val, true);
          else if (o.op === "M") moveTo(st.x + Math.cos(st.ang) * o.val, st.y + Math.sin(st.ang) * o.val, false);
          else if (o.op === "R") st.ang += (o.val * Math.PI) / 180;
          else if (o.op === "L") st.ang -= (o.val * Math.PI) / 180;
          else if (o.op === "U") { st.pen = false; endPath(); }
          else if (o.op === "D") st.pen = true;
        }
      };
      run(tree);
      endPath();
      if (!paths.length) return applyStyle({ paths: [] }, ins[0]);
      /* place: fit to margin box or center as-is */
      const m = Math.max(0, p.margin);
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const pa of paths) for (const [x, y] of pa.pts) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const bw = W - 2 * m, bh = H - 2 * m;
      const sc = p.fit ? Math.min(bw / ((bx1 - bx0) || 1), bh / ((by1 - by0) || 1)) : 1;
      const ox = m + (bw - (bx1 - bx0) * sc) / 2 - bx0 * sc;
      const oy = m + (bh - (by1 - by0) * sc) / 2 - by0 * sc;
      const out = paths.map((pa) => ({
        ...pa,
        pts: pa.pts.map(([x, y]) => [
          Math.max(0.5, Math.min(W - 0.5, x * sc + ox)),
          Math.max(0.5, Math.min(H - 0.5, y * sc + oy))
        ])
      }));
      return applyStyle({ paths: out }, ins[0]);
    }
  },
  origami: {
    name: "Origami", cat: "gen", group: "structural", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "splits", label: "Splits", type: "slider", min: 1, max: 80, step: 1, def: 16 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 23 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 941 + 5);
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      let polys = [[[p.margin, p.margin], [W - p.margin, p.margin], [W - p.margin, H - p.margin], [p.margin, H - p.margin]]];
      for (let s = 0; s < Math.round(p.splits); s++) {
        const idx = Math.floor(rng() * polys.length);
        const poly = polys[idx];
        const n = poly.length;
        if (n < 3) continue;
        const a = Math.floor(rng() * n);
        const b = (a + 1 + Math.floor(rng() * (n - 1))) % n;
        if (a === b) continue;
        const Pa = lerp(poly[a], poly[(a + 1) % n], 0.2 + rng() * 0.6);
        const Pb = lerp(poly[b], poly[(b + 1) % n], 0.2 + rng() * 0.6);
        const polyA = [Pa], polyB = [Pb];
        for (let i = (a + 1) % n; ; i = (i + 1) % n) { polyA.push(poly[i]); if (i === b) break; }
        polyA.push(Pb);
        for (let i = (b + 1) % n; ; i = (i + 1) % n) { polyB.push(poly[i]); if (i === a) break; }
        polyB.push(Pa);
        polys[idx] = polyA;
        polys.push(polyB);
      }
      const paths = polys.map((poly) => ({ pts: poly.map((q) => q.slice()), closed: true, layer: Math.round(p.layer) }));
      return applyStyle({ paths }, ins[0]);
    },
  },

  mesh: {
    name: "Mesh", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Cols", type: "slider", min: 2, max: 40, step: 1, def: 14 },
      { key: "rows", label: "Rows", type: "slider", min: 2, max: 40, step: 1, def: 10 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 20, step: 0.25, def: 4 },
      { key: "diag", label: "Diagonals", type: "select", options: ["None", "\\", "/", "Alternating", "Random"], def: "Alternating" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 25 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const cols = Math.round(p.cols), rows = Math.round(p.rows);
      const rng = mulberry32(p.seed * 577 + 11);
      const pts = [];
      for (let j = 0; j <= rows; j++) {
        const row = [];
        for (let i = 0; i <= cols; i++) {
          const edge = i === 0 || j === 0 || i === cols || j === rows;
          const jx = edge ? 0 : (rng() - 0.5) * 2 * p.jit;
          const jy = edge ? 0 : (rng() - 0.5) * 2 * p.jit;
          row.push([
            p.margin + ((W - 2 * p.margin) * i) / cols + jx,
            p.margin + ((H - 2 * p.margin) * j) / rows + jy,
          ]);
        }
        pts.push(row);
      }
      const paths = [];
      const L = Math.round(p.layer);
      for (let j = 0; j <= rows; j++) paths.push({ pts: pts[j].map((q) => q.slice()), closed: false, layer: L });
      for (let i = 0; i <= cols; i++) paths.push({ pts: pts.map((row) => row[i].slice()), closed: false, layer: L });
      if (p.diag !== "None") {
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          let d = p.diag;
          if (d === "Alternating") d = (i + j) % 2 === 0 ? "\\" : "/";
          else if (d === "Random") d = hash2(i, j, p.seed + 3) > 0.5 ? "\\" : "/";
          paths.push(d === "\\"
            ? { pts: [pts[j][i].slice(), pts[j + 1][i + 1].slice()], closed: false, layer: L }
            : { pts: [pts[j][i + 1].slice(), pts[j + 1][i].slice()], closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  ribbon: {
    name: "Ribbon", cat: "gen", group: "geometric", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "wander", label: "Wander mm", type: "slider", min: 0, max: 120, step: 1, def: 45 },
      { key: "wscale", label: "Wander scale", type: "slider", min: 0.2, max: 4, step: 0.1, def: 1 },
      { key: "width", label: "Width mm", type: "slider", min: 2, max: 80, step: 0.5, def: 28 },
      { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.8 },
      { key: "lines", label: "Lines", type: "slider", min: 1, max: 60, step: 1, def: 24 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 27 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      /* selkäranka: vasemmalta oikealle, pystysuuntainen kohinavaellus */
      const N = 160;
      const bb = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = p.margin + (W - 2 * p.margin) * t;
        const y = H / 2 + (noise2(t * 4 * p.wscale, 3.3, p.seed) - 0.5) * 2 * p.wander;
        bb.push([x, Math.max(p.margin, Math.min(H - p.margin, y))]);
      }
      /* leveys(t): kohina, pinch lähelle nollaa */
      const widthAt = (t) => {
        const v = noise2(t * 5 * p.wscale + 40, 8.8, p.seed + 9);
        const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
        return Math.max(0.3, w);
      };
      const normals = bb.map((pt, i) => {
        const nI = Math.min(i + 1, bb.length - 1), pI = Math.max(i - 1, 0);
        const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
        const tl = Math.hypot(tx, ty) || 1;
        return [-ty / tl, tx / tl];
      });
      const K = Math.round(p.lines);
      const paths = [];
      for (let k = 0; k < K; k++) {
        const f = K === 1 ? 0 : k / (K - 1) - 0.5;
        const pts = bb.map((pt, i) => {
          const w = widthAt(i / N);
          return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
        });
        paths.push({ pts, closed: false, layer: Math.round(p.layer) });
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  halftone: {
    name: "Halftone", cat: "gen", group: "scientific", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "cell", label: "Cell mm", type: "slider", min: 3, max: 25, step: 0.5, def: 8 },
      { key: "maxK", label: "Max dots / side", type: "slider", min: 1, max: 6, step: 1, def: 4 },
      { key: "dotR", label: "Dot size mm", type: "slider", min: 0.2, max: 4, step: 0.1, def: 0.7 },
      { key: "scale", label: "Field scale", type: "slider", min: 0.003, max: 0.05, step: 0.001, def: 0.012 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 29 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const fbm = (x, y) => {
        let v = 0, amp = 1, fq = 1, tot = 0;
        for (let o = 0; o < 3; o++) {
          v += amp * noise2(x * p.scale * fq, y * p.scale * fq, p.seed + o * 7);
          tot += amp; amp *= 0.5; fq *= 2;
        }
        return v / tot;
      };
      const paths = [];
      const cols = Math.floor((W - 2 * p.margin) / p.cell);
      const rows = Math.floor((H - 2 * p.margin) / p.cell);
      const ox = (W - cols * p.cell) / 2, oy = (H - rows * p.cell) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cx = ox + c * p.cell + p.cell / 2, cy = oy + r * p.cell + p.cell / 2;
        let v = fbm(cx, cy);
        if (p.invert) v = 1 - v;
        const k = Math.round(v * p.maxK);
        if (k <= 0) continue;
        const sp = p.cell / k;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
          const dx = ox + c * p.cell + sp * (i + 0.5), dy = oy + r * p.cell + sp * (j + 0.5);
          const pts = [];
          for (let q = 0; q < 6; q++) {
            const a = (q / 6) * Math.PI * 2;
            pts.push([dx + Math.cos(a) * (p.dotR / 2), dy + Math.sin(a) * (p.dotR / 2)]);
          }
          paths.push({ pts, closed: true, layer: Math.round(p.layer) });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  },

  svgimport: {
    name: "Import SVG", cat: "gen", group: "textimg", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "filename", label: "SVG file", type: "file", def: "" },
      { key: "fit", label: "Fit", type: "select", options: ["Fit to canvas", "Scale %"], def: "Fit to canvas" },
      { key: "scale", label: "Scale %", type: "slider", min: 1, max: 400, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "offx", label: "Offset X mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "offy", label: "Offset Y mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "dirs", label: "Directions", type: "select", options: ["Original", "Closed clockwise", "Closed counter-clockwise"], def: "Original" },
      { key: "colmode", label: "Colors", type: "select", options: ["From SVG colors", "Single pen"], def: "From SVG colors" },
      { key: "layer", label: "Pen (if single)", type: "pen", def: 0 },
    ],
    onFile(text) { return parseSVG(text); },
    compute(ins, p, ctx, node) {
      const svg = node && node.data && node.data.svg;
      if (!svg) return EMPTY;
      const { W, H } = ctx;
      let s, ox, oy;
      if (p.fit === "Fit to canvas") {
        s = Math.min((W - 2 * p.margin) / svg.bbox.w, (H - 2 * p.margin) / svg.bbox.h);
        ox = (W - svg.bbox.w * s) / 2 - svg.bbox.x * s;
        oy = (H - svg.bbox.h * s) / 2 - svg.bbox.y * s;
      } else {
        s = p.scale / 100;
        ox = p.margin - svg.bbox.x * s;
        oy = p.margin - svg.bbox.y * s;
      }
      const paths = svg.paths.map((sp) => {
        let pts = sp.pts.map(([x, y]) => [x * s + ox + p.offx, y * s + oy + p.offy]);
        if (sp.closed && p.dirs !== "Original") {
          const cw = signedArea(pts) > 0; // y-alas -koordinaatistossa
          const wantCw = p.dirs === "Closed clockwise";
          if (cw !== wantCw) pts = [...pts].reverse();
        }
        return {
          pts, closed: sp.closed,
          layer: p.colmode === "Single pen" ? Math.round(p.layer) : sp.colorIdx % PENS.length,
        };
      });
      return applyStyle({ paths }, ins[0]);
    },
  },

  viiva: {
    name: "Stroke", cat: "gen", group: "textimg", ins: [], outs: [Pin("style")],
    params: [
      { key: "mode", label: "Type", type: "select", options: ["Solid", "Dashed", "Dots", "Dash-dot"], def: "Dashed" },
      { key: "dash", label: "Dash mm", type: "slider", min: 0.5, max: 30, step: 0.25, def: 4 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0.3, max: 30, step: 0.25, def: 3 },
      { key: "vary", label: "Variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "phase", label: "Phase mm", type: "slider", min: 0, max: 30, step: 0.5, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 4 },
    ],
    compute(_ins, p) {
      return { kind: "style", mode: p.mode, dash: p.dash, gap: p.gap, vary: p.vary, phase: p.phase, seed: p.seed };
    },
  },

  tyylita: {
    name: "Apply Style", cat: "mod", group: "fillstyle", ins: [Pin("paths"), Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [],
    compute(ins) { return applyStyle(ins[0] || EMPTY, ins[1]); },
  },

  aaltoilu: {
    name: "Wave", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amp", label: "Amplitude mm", type: "slider", min: 0, max: 20, step: 0.25, def: 3 },
      { key: "wl", label: "Wavelength mm", type: "slider", min: 2, max: 120, step: 1, def: 30 },
      { key: "phase", label: "Phase", type: "slider", min: 0, max: 6.28, step: 0.05, def: 0 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.8, p.wl / 14));
        let d = 0;
        const out = pts.map((pt, i) => {
          if (i > 0) d += Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]);
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          const off = Math.sin((d / Math.max(0.5, p.wl)) * Math.PI * 2 + p.phase) * p.amp;
          return [pt[0] + (-ty / tl) * off, pt[1] + (tx / tl) * off];
        });
        return { ...path, pts: out };
      });
      return { paths };
    },
  },

  jitter: {
    name: "Jitter", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amp", label: "Strength mm", type: "slider", min: 0, max: 15, step: 0.25, def: 2 },
      { key: "scale", label: "Noise scale", type: "slider", min: 0.01, max: 0.5, step: 0.01, def: 0.08 },
      { key: "seed", label: "Seed", type: "seed", def: 1 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [
          x + (noise2(x * p.scale, y * p.scale, p.seed) - 0.5) * 2 * p.amp,
          y + (noise2(x * p.scale + 91, y * p.scale + 37, p.seed) - 0.5) * 2 * p.amp,
        ]),
      }));
      return { paths };
    },
  },

  kierto: {
    name: "Rotate", cat: "mod", group: "transform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "deg", label: "Angle °", type: "slider", min: -180, max: 180, step: 1, def: 15 },
      { key: "per", label: "Per path (centroid)", type: "check", def: false },
      { key: "grad", label: "Progressive (Molnár)", type: "check", def: false },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const rot = (pts, cx, cy, rad) =>
        pts.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
        });
      const n = src.paths.length || 1;
      const paths = src.paths.map((path, i) => {
        const f = p.grad ? i / n : 1;
        const rad = ((p.deg * Math.PI) / 180) * f;
        let cx = ctx.W / 2, cy = ctx.H / 2;
        if (p.per) {
          cx = path.pts.reduce((s, q) => s + q[0], 0) / path.pts.length;
          cy = path.pts.reduce((s, q) => s + q[1], 0) / path.pts.length;
        }
        return { ...path, pts: rot(path.pts, cx, cy, rad) };
      });
      return { paths };
    },
  },

  glitch: {
    name: "Glitch", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "amount", label: "Amount %", type: "slider", min: 0, max: 100, step: 1, def: 20 },
      { key: "amp", label: "Displacement mm", type: "slider", min: 0, max: 30, step: 0.5, def: 6 },
      { key: "skip", label: "Drop strokes %", type: "slider", min: 0, max: 90, step: 1, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 5 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rng = mulberry32(p.seed * 7919 + 13);
      const paths = [];
      for (const path of src.paths) {
        if (rng() * 100 < p.skip) continue;
        const pts = path.pts.map((pt) => pt.slice());
        const segs = Math.max(1, Math.floor((pts.length * p.amount) / 400));
        for (let g = 0; g < segs; g++) {
          if (rng() * 100 > p.amount) continue;
          const i0 = Math.floor(rng() * pts.length);
          const len = 1 + Math.floor(rng() * Math.max(2, pts.length / 10));
          const dx = (rng() - 0.5) * 2 * p.amp, dy = (rng() - 0.5) * 2 * p.amp;
          for (let i = i0; i < Math.min(pts.length, i0 + len); i++) { pts[i][0] += dx; pts[i][1] += dy; }
        }
        paths.push({ ...path, pts });
      }
      return { paths };
    },
  },

  offset: {
    name: "Offset", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "copies", label: "Copies", type: "slider", min: 1, max: 8, step: 1, def: 2 },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.1, max: 10, step: 0.05, def: 0.5 },
      { key: "side", label: "Side", type: "select", options: ["Both", "Left", "Right"], def: "Both" },
      { key: "orig", label: "Include original", type: "check", def: true },
      { key: "clean", label: "Clean corners", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const sides = p.side === "Both" ? [1, -1] : p.side === "Left" ? [1] : [-1];
      const paths = [];
      for (const path of src.paths) {
        if (p.orig) paths.push(path);
        const pts = resample(path.pts, path.closed, Math.max(0.8, p.spacing));
        if (pts.length < 2) continue;
        const N = pts.length;
        const normals = pts.map((pt, i) => {
          const nI = path.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
          const pI = path.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [-ty / tl, tx / tl];
        });
        for (const s of sides) {
          for (let k = 1; k <= Math.round(p.copies); k++) {
            const off = s * k * p.spacing;
            let out = pts.map((pt, i) => [pt[0] + normals[i][0] * off, pt[1] + normals[i][1] * off]);
            if (p.clean) {
              /* poista kaantyneet segmentit: offset-segmentti vs alkuperainen suunta */
              const keep = new Array(out.length).fill(true);
              for (let i = 1; i < out.length; i++) {
                const oi = path.closed ? i % N : i;
                const opi = path.closed ? (i - 1) % N : i - 1;
                const odx = pts[oi][0] - pts[opi][0], ody = pts[oi][1] - pts[opi][1];
                const fdx = out[i][0] - out[i - 1][0], fdy = out[i][1] - out[i - 1][1];
                if (odx * fdx + ody * fdy < 0) keep[i] = false; /* cusp: segmentti kaantyi */
              }
              out = out.filter((_, i) => keep[i]);
              /* siivoa jaljelle jaaneet mikroluupit: pisteet liian lahella toisiaan */
              const out2 = [];
              for (const q of out) {
                const last = out2[out2.length - 1];
                if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.08) out2.push(q);
              }
              out = out2;
            }
            if (out.length > 1) paths.push({ pts: out, closed: path.closed, layer: path.layer });
          }
        }
      }
      return { paths };
    },
  },

  symmetry: {
    name: "Symmetry", cat: "mod", group: "transform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "folds", label: "Folds", type: "slider", min: 1, max: 12, step: 1, def: 6 },
      { key: "mirror", label: "Mirror", type: "check", def: false },
      { key: "useCenter", label: "Use canvas center", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      const folds = Math.max(1, Math.round(p.folds));
      const paths = [];
      const variants = p.mirror
        ? [(x, y) => [x, y], (x, y) => [2 * cx - x, y]]
        : [(x, y) => [x, y]];
      for (const path of src.paths) {
        for (const v of variants) {
          const base = path.pts.map(([x, y]) => v(x, y));
          for (let k = 0; k < folds; k++) {
            const a = (k / folds) * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            paths.push({
              pts: base.map(([x, y]) => {
                const dx = x - cx, dy = y - cy;
                return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
              }),
              closed: path.closed, layer: path.layer,
            });
          }
        }
      }
      return { paths };
    },
  },

  smooth: {
    name: "Smooth", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "iter", label: "Iterations", type: "slider", min: 1, max: 5, step: 1, def: 2 }],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const chaikin = (pts, closed) => {
        if (pts.length < 3) return pts;
        const out = [];
        const N = pts.length;
        const last = closed ? N : N - 1;
        if (!closed) out.push(pts[0].slice());
        for (let i = 0; i < last; i++) {
          const a = pts[i], b = pts[(i + 1) % N];
          out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
          out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        if (!closed) out.push(pts[N - 1].slice());
        return out;
      };
      const paths = src.paths.map((path) => {
        let pts = path.pts;
        for (let i = 0; i < Math.round(p.iter); i++) pts = chaikin(pts, path.closed);
        return { ...path, pts };
      });
      return { paths };
    },
  },

  magnet: {
    name: "Magnet", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "px", label: "Point X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "py", label: "Point Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "radius", label: "Radius mm", type: "slider", min: 5, max: 250, step: 1, def: 70 },
      { key: "strength", label: "Strength mm (− attract)", type: "slider", min: -40, max: 40, step: 0.5, def: 12 },
      { key: "falloff", label: "Falloff", type: "select", options: ["Linear", "Smooth"], def: "Smooth" },
    ],
    overlay(p) {
      return [{ kind: "circle", cx: p.px, cy: p.py, r: p.radius }, { kind: "point", x: p.px, y: p.py }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const dx = x - p.px, dy = y - p.py;
          const d = Math.hypot(dx, dy);
          if (d >= p.radius || d < 0.001) return [x, y];
          let t = 1 - d / p.radius;
          if (p.falloff === "Smooth") t = t * t * (3 - 2 * t);
          const f = p.strength * t;
          return [x + (dx / d) * f, y + (dy / d) * f];
        }),
      }));
      return { paths };
    },
  },

  trimext: {
    name: "Trim/Extend", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "ends", label: "Ends mm (− trim, + extend)", type: "slider", min: -20, max: 20, step: 0.25, def: 2 }],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      for (const path of src.paths) {
        if (path.closed || path.pts.length < 2 || p.ends === 0) { paths.push(path); continue; }
        if (p.ends > 0) {
          const pts = path.pts.map((q) => q.slice());
          const s0 = pts[0], s1 = pts[1];
          const e1 = pts[pts.length - 2], e0 = pts[pts.length - 1];
          const dl = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) || 1;
          const el = Math.hypot(e0[0] - e1[0], e0[1] - e1[1]) || 1;
          pts.unshift([s0[0] - ((s1[0] - s0[0]) / dl) * p.ends, s0[1] - ((s1[1] - s0[1]) / dl) * p.ends]);
          pts.push([e0[0] + ((e0[0] - e1[0]) / el) * p.ends, e0[1] + ((e0[1] - e1[1]) / el) * p.ends]);
          paths.push({ ...path, pts });
        } else {
          const trim = -p.ends;
          const fine = resample(path.pts, false, 0.5);
          const L = pathLength(fine, false);
          if (L <= trim * 2 + 0.5) continue;
          const start = Math.ceil(trim / 0.5), end = fine.length - Math.ceil(trim / 0.5);
          const pts = fine.slice(start, Math.max(start + 2, end));
          if (pts.length > 1) paths.push({ ...path, pts });
        }
      }
      return { paths };
    },
  },

  joinends: {
    name: "Join Ends", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "gap", label: "Max gap mm", type: "slider", min: 0.1, max: 40, step: 0.1, def: 5 },
      { key: "arc", label: "Arc", type: "slider", min: 0, max: 1.5, step: 0.05, def: 0.5 },
      { key: "angTol", label: "Angle tolerance °", type: "slider", min: 5, max: 180, step: 1, def: 60 },
      { key: "samePen", label: "Same pen only", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const out = src.paths.filter((pa) => pa.closed || pa.pts.length < 2);
      let items = src.paths.filter((pa) => !pa.closed && pa.pts.length >= 2)
        .map((pa) => ({ pts: pa.pts.map((q) => q.slice()), layer: pa.layer }));
      const tol = (p.angTol * Math.PI) / 180;
      const outDir = (pts, end) => {
        const a = end === 1 ? pts[pts.length - 1] : pts[0];
        const b = end === 1 ? pts[pts.length - 2] : pts[1];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        return [(a[0] - b[0]) / d, (a[1] - b[1]) / d];
      };
      const endPt = (pts, end) => (end === 1 ? pts[pts.length - 1] : pts[0]);
      const angBetween = (ax, ay, bx, by) => Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by)));
      const bezier = (A, dA, B, dB, d) => {
        const h = d * p.arc;
        const c1 = [A[0] + dA[0] * h, A[1] + dA[1] * h];
        const c2 = [B[0] + dB[0] * h, B[1] + dB[1] * h];
        const n = Math.max(4, Math.min(24, Math.ceil(d / 1.2)));
        const pts = [];
        for (let i = 1; i < n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([
            u * u * u * A[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * B[0],
            u * u * u * A[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * B[1],
          ]);
        }
        return pts;
      };
      /* kierroksittain: pisteytä kaikki kelvolliset päät (etäisyys + kulmasakko),
         yhdistä paras joukko ristiriidattomasti, toista */
      for (let round = 0; round < 60 && items.length > 1; round++) {
        const ends = [];
        items.forEach((it, ii) => {
          for (const e of [0, 1]) {
            ends.push({ ii, e, pt: endPt(it.pts, e), dir: outDir(it.pts, e), layer: it.layer });
          }
        });
        const cands = [];
        for (let a = 0; a < ends.length; a++) {
          for (let b = a + 1; b < ends.length; b++) {
            const A = ends[a], B = ends[b];
            if (A.ii === B.ii) continue;
            if (p.samePen && A.layer !== B.layer) continue;
            const dx = B.pt[0] - A.pt[0], dy = B.pt[1] - A.pt[1];
            const d = Math.hypot(dx, dy);
            if (d > p.gap) continue;
            const L = d || 1;
            const angA = angBetween(A.dir[0], A.dir[1], dx / L, dy / L);
            const angB = angBetween(B.dir[0], B.dir[1], -dx / L, -dy / L);
            if (angA > tol || angB > tol) continue;
            /* pisteytys: etäisyys + kulmien sileyssakko */
            cands.push({ a, b, d, score: d * (1 + (angA + angB) / Math.max(0.15, tol)) });
          }
        }
        if (!cands.length) break;
        cands.sort((x, y) => x.score - y.score);
        const usedItem = new Set();
        const joins = [];
        for (const c of cands) {
          const A = ends[c.a], B = ends[c.b];
          if (usedItem.has(A.ii) || usedItem.has(B.ii)) continue;
          usedItem.add(A.ii); usedItem.add(B.ii);
          joins.push(c);
        }
        if (!joins.length) break;
        const remove = new Set();
        const added = [];
        for (const c of joins) {
          const A = ends[c.a], B = ends[c.b];
          let pi = items[A.ii].pts, pj = items[B.ii].pts;
          if (A.e === 0) pi = [...pi].reverse();
          if (B.e === 1) pj = [...pj].reverse();
          const Ap = pi[pi.length - 1], Bp = pj[0];
          const conn = bezier(Ap, outDir(pi, 1), Bp, outDir(pj, 0), c.d);
          added.push({ pts: [...pi, ...conn, ...pj], layer: items[A.ii].layer });
          remove.add(A.ii); remove.add(B.ii);
        }
        items = items.filter((_, k) => !remove.has(k)).concat(added);
      }
      /* sulje itsensä kohtaavat silmukat */
      for (const it of items) {
        const A = endPt(it.pts, 1), B = endPt(it.pts, 0);
        const d = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (d <= p.gap && it.pts.length > 3) {
          const dA = outDir(it.pts, 1), dB = outDir(it.pts, 0);
          const dx = B[0] - A[0], dy = B[1] - A[1];
          const L = d || 1;
          if (angBetween(dA[0], dA[1], dx / L, dy / L) <= tol &&
              angBetween(dB[0], dB[1], -dx / L, -dy / L) <= tol) {
            it.pts = [...it.pts, ...bezier(A, dA, B, dB, d)];
            it.closed = true;
          }
        }
        out.push({ pts: it.pts, closed: !!it.closed, layer: it.layer });
      }
      return { paths: out };
    },
  },

  simplify: {
    name: "Simplify", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "tol", label: "Tolerance mm", type: "slider", min: 0.05, max: 3, step: 0.05, def: 0.2 }],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rdp = (pts, tol) => {
        if (pts.length < 3) return pts;
        const keep = new Array(pts.length).fill(false);
        keep[0] = keep[pts.length - 1] = true;
        const stack = [[0, pts.length - 1]];
        while (stack.length) {
          const [a, b] = stack.pop();
          const [ax, ay] = pts[a], [bx, by] = pts[b];
          const dx = bx - ax, dy = by - ay;
          const len = Math.hypot(dx, dy) || 1e-9;
          let maxD = 0, maxI = -1;
          for (let i = a + 1; i < b; i++) {
            const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
            if (d > maxD) { maxD = d; maxI = i; }
          }
          if (maxD > tol && maxI > 0) {
            keep[maxI] = true;
            stack.push([a, maxI], [maxI, b]);
          }
        }
        return pts.filter((_, i) => keep[i]);
      };
      const paths = src.paths.map((path) => ({ ...path, pts: rdp(path.pts, p.tol) }));
      return { paths };
    },
  },

  lens: {
    name: "Lens", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "useCenter", label: "Use canvas center", type: "check", def: true },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "radius", label: "Radius mm", type: "slider", min: 10, max: 300, step: 1, def: 90 },
      { key: "strength", label: "Strength (− pinch, + bulge)", type: "slider", min: -0.9, max: 0.9, step: 0.05, def: 0.4 },
    ],
    overlay(p, ctx) {
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      return [{ kind: "circle", cx, cy, r: p.radius }, { kind: "point", x: cx, y: cy }];
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const cx = p.useCenter ? ctx.W / 2 : p.cx;
      const cy = p.useCenter ? ctx.H / 2 : p.cy;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (d >= p.radius || d < 0.001) return [x, y];
          const t = 1 - d / p.radius;
          const f = 1 + p.strength * t * t;
          return [cx + dx * f, cy + dy * f];
        }),
      }));
      return { paths };
    },
  },

  warp: {
    name: "Warp", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["4 corners", "Grid lattice"], def: "4 corners" },
      { key: "tlx", label: "TL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "tly", label: "TL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trx", label: "TR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "trY", label: "TR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "brx", label: "BR Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bry", label: "BR Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "blx", label: "BL Δx mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "bly", label: "BL Δy mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
      { key: "cells", label: "Grid cells", type: "slider", min: 2, max: 12, step: 1, def: 4 },
      { key: "amp", label: "Grid amp mm", type: "slider", min: 0, max: 60, step: 0.5, def: 15 },
      { key: "seed", label: "Grid seed", type: "seed", def: 21 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      let disp;
      if (p.mode === "4 corners") {
        disp = (x, y) => {
          const u = Math.max(0, Math.min(1, x / W)), v = Math.max(0, Math.min(1, y / H));
          const topX = p.tlx + (p.trx - p.tlx) * u, botX = p.blx + (p.brx - p.blx) * u;
          const topY = p.tly + (p.trY - p.tly) * u, botY = p.bly + (p.bry - p.bly) * u;
          return [topX + (botX - topX) * v, topY + (botY - topY) * v];
        };
      } else {
        const n = Math.round(p.cells);
        const rng = mulberry32(p.seed * 359 + 41);
        const lat = [];
        for (let j = 0; j <= n; j++) {
          const row = [];
          for (let i = 0; i <= n; i++) {
            /* reunat paikoillaan, sisäpisteet satunnaisesti */
            const edge = i === 0 || j === 0 || i === n || j === n;
            row.push(edge ? [0, 0] : [(rng() - 0.5) * 2 * p.amp, (rng() - 0.5) * 2 * p.amp]);
          }
          lat.push(row);
        }
        const sm = (t) => t * t * (3 - 2 * t);
        disp = (x, y) => {
          const fx = Math.max(0, Math.min(n - 0.0001, (x / W) * n));
          const fy = Math.max(0, Math.min(n - 0.0001, (y / H) * n));
          const i = Math.floor(fx), j = Math.floor(fy);
          const tx = sm(fx - i), ty = sm(fy - j);
          const a = lat[j][i], b = lat[j][i + 1], c = lat[j + 1][i], d = lat[j + 1][i + 1];
          return [
            (a[0] + (b[0] - a[0]) * tx) * (1 - ty) + (c[0] + (d[0] - c[0]) * tx) * ty,
            (a[1] + (b[1] - a[1]) * tx) * (1 - ty) + (c[1] + (d[1] - c[1]) * tx) * ty,
          ];
        };
      }
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 1.2).map(([x, y]) => {
          const [dx, dy] = disp(x, y);
          return [x + dx, y + dy];
        }),
      }));
      return { paths };
    },
  },

  mirror8: {
      name: "Mirror",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Left-right (2)", "Up-down (2)", "Quad (4)", "8-way (8)"], def: "Left-right (2)" },
      { key: "cx", label: "Mirror X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Mirror Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    overlay(p, ctx) {
      const LEN = (ctx.W + ctx.H);
      const axis = (aDeg) => {
        const a = (aDeg * Math.PI) / 180;
        const dx = Math.cos(a) * LEN, dy = Math.sin(a) * LEN;
        return { kind: "poly", pts: [[p.cx - dx, p.cy - dy], [p.cx + dx, p.cy + dy]] };
      };
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.mode === "Left-right (2)") g.push(axis(90));
      else if (p.mode === "Up-down (2)") g.push(axis(0));
      else if (p.mode === "Quad (4)") g.push(axis(0), axis(90));
      else g.push(axis(0), axis(45), axis(90), axis(135));
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* muunnokset keskipisteen ymparilla:
         heijastus suoran (kulma a) yli: M = [[cos2a, sin2a],[sin2a,-cos2a]] */
      const refl = (aDeg) => {
        const a2 = (2 * aDeg * Math.PI) / 180;
        const c = Math.cos(a2), s = Math.sin(a2);
        return ([x, y]) => [c * x + s * y, s * x - c * y];
      };
      const rot = (aDeg) => {
        const a = (aDeg * Math.PI) / 180;
        const c = Math.cos(a), s = Math.sin(a);
        return ([x, y]) => [c * x - s * y, s * x + c * y];
      };
      const I = ([x, y]) => [x, y];
      let T;
      if (p.mode === "Left-right (2)") T = [I, refl(90)];
      else if (p.mode === "Up-down (2)") T = [I, refl(0)];
      else if (p.mode === "Quad (4)") T = [I, refl(0), refl(90), rot(180)];
      else T = [I, rot(90), rot(180), rot(270), refl(0), refl(45), refl(90), refl(135)];
      const paths = [];
      for (const f of T) {
        for (const path of src.paths) {
          paths.push({
            ...path,
            pts: path.pts.map(([x, y]) => {
              const [nx, ny] = f([x - p.cx, y - p.cy]);
              return [nx + p.cx, ny + p.cy];
            }),
          });
        }
      }
      return { paths };
    }
  },

  move_scale: {
      name: "Move / Scale",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "dx", label: "Move X mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "dy", label: "Move Y mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "scale", label: "Scale %", type: "slider", min: 5, max: 400, step: 1, def: 100 },
      { key: "scaleY", label: "Scale Y % (0 = same)", type: "slider", min: 0, max: 400, step: 1, def: 0 },
      { key: "origin", label: "Scale origin", type: "select", options: ["Content center", "Canvas center", "Custom point"], def: "Content center" },
      { key: "ox", label: "Origin X mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "oy", label: "Origin Y mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 100 },
    ],
    overlay(p, ctx) {
      if (p.origin === "Custom point") return [{ kind: "point", x: p.ox, y: p.oy }];
      if (p.origin === "Canvas center") return [{ kind: "point", x: ctx.W / 2, y: ctx.H / 2 }];
      return [];
    },
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let ox, oy;
      if (p.origin === "Canvas center") { ox = ctx.W / 2; oy = ctx.H / 2; }
      else if (p.origin === "Custom point") { ox = p.ox; oy = p.oy; }
      else {
        /* sisallon bbox-keskipiste */
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const path of src.paths) for (const [x, y] of path.pts) {
          if (x < x0) x0 = x; if (y < y0) y0 = y;
          if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
        ox = (x0 + x1) / 2; oy = (y0 + y1) / 2;
      }
      const sx = p.scale / 100;
      const sy = p.scaleY > 0 ? p.scaleY / 100 : sx;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [
          ox + (x - ox) * sx + p.dx,
          oy + (y - oy) * sy + p.dy,
        ]),
      }));
      return { paths };
    }
  },

  fit_canvas: {
      name: "Fit to Canvas",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 80, step: 1, def: 15 },
      { key: "mode", label: "Mode", type: "select", options: ["Fit (contain)", "Stretch (fill)", "Fit width", "Fit height"], def: "Fit (contain)" },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const path of src.paths) for (const [x, y] of path.pts) {
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
      const bw = Math.max(0.01, x1 - x0), bh = Math.max(0.01, y1 - y0);
      const aw = Math.max(1, ctx.W - 2 * p.margin), ah = Math.max(1, ctx.H - 2 * p.margin);
      let sx, sy;
      if (p.mode === "Stretch (fill)") { sx = aw / bw; sy = ah / bh; }
      else if (p.mode === "Fit width") { sx = sy = aw / bw; }
      else if (p.mode === "Fit height") { sx = sy = ah / bh; }
      else { sx = sy = Math.min(aw / bw, ah / bh); }
      const ox = (ctx.W - bw * sx) / 2, oy = (ctx.H - bh * sy) / 2;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [ox + (x - x0) * sx, oy + (y - y0) * sy]),
      }));
      return { paths };
    }
  },

  reverse: {
      name: "Reverse",
    cat: "mod", group: "pathops",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Which paths", type: "select", options: ["All", "Every 2nd", "Random"], def: "All" },
      { key: "seed", label: "Seed (random)", type: "seed", def: 83 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const rng = mulberry32(p.seed * 431 + 3);
      const paths = src.paths.map((path, i) => {
        let flip;
        if (p.mode === "All") flip = true;
        else if (p.mode === "Every 2nd") flip = i % 2 === 1;
        else flip = rng() > 0.5;
        return flip ? { ...path, pts: [...path.pts].reverse() } : path;
      });
      return { paths };
    }
  },

  skew: {
      name: "Skew",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "skx", label: "Skew X °", type: "slider", min: -60, max: 60, step: 0.5, def: 15 },
      { key: "sky", label: "Skew Y °", type: "slider", min: -60, max: 60, step: 0.5, def: 0 },
      { key: "origin", label: "Origin", type: "select", options: ["Content center", "Canvas center"], def: "Content center" },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let ox, oy;
      if (p.origin === "Canvas center") { ox = ctx.W / 2; oy = ctx.H / 2; }
      else {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const path of src.paths) for (const [x, y] of path.pts) {
          if (x < x0) x0 = x; if (y < y0) y0 = y;
          if (x > x1) x1 = x; if (y > y1) y1 = y;
        }
        ox = (x0 + x1) / 2; oy = (y0 + y1) / 2;
      }
      const tx = Math.tan((p.skx * Math.PI) / 180);
      const ty = Math.tan((p.sky * Math.PI) / 180);
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => {
          const rx = x - ox, ry = y - oy;
          return [ox + rx + ry * tx, oy + ry + rx * ty];
        }),
      }));
      return { paths };
    }
  },

  align: {
      name: "Align",
    cat: "mod", group: "transform",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "hor", label: "Horizontal", type: "select", options: ["None", "Left", "Center", "Right"], def: "Center" },
      { key: "ver", label: "Vertical", type: "select", options: ["None", "Top", "Middle", "Bottom"], def: "Middle" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 80, step: 1, def: 10 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const path of src.paths) for (const [x, y] of path.pts) {
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
      let dx = 0, dy = 0;
      if (p.hor === "Left") dx = p.margin - x0;
      else if (p.hor === "Center") dx = (ctx.W - (x1 - x0)) / 2 - x0;
      else if (p.hor === "Right") dx = ctx.W - p.margin - x1;
      if (p.ver === "Top") dy = p.margin - y0;
      else if (p.ver === "Middle") dy = (ctx.H - (y1 - y0)) / 2 - y0;
      else if (p.ver === "Bottom") dy = ctx.H - p.margin - y1;
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [x + dx, y + dy]),
      }));
      return { paths };
    }
  },

  crop: {
      name: "Crop",
    cat: "mod", group: "cutsplit",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "x", label: "X mm", type: "slider", min: -100, max: 400, step: 1, def: 40 },
      { key: "y", label: "Y mm", type: "slider", min: -100, max: 400, step: 1, def: 30 },
      { key: "w", label: "Width mm", type: "slider", min: 5, max: 400, step: 1, def: 220 },
      { key: "h", label: "Height mm", type: "slider", min: 5, max: 400, step: 1, def: 140 },
      { key: "keep", label: "Keep", type: "select", options: ["Inside", "Outside"], def: "Inside" },
    ],
    overlay(p) {
      return [{ kind: "rect", x: p.x, y: p.y, w: p.w, h: p.h }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const insideRect = ([x, y]) =>
        x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      const want = (pt) => (p.keep === "Inside" ? insideRect(pt) : !insideRect(pt));
      /* rajanylityksen tarkennus bisektiolla (a haluttu, b ei) */
      const cross = (a, b) => {
        let lo = a, hi = b;
        for (let i = 0; i < 10; i++) {
          const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
          if (want(mid)) lo = mid; else hi = mid;
        }
        return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
      };
      const paths = [];
      for (const path of src.paths) {
        const pts = resample(path.pts, path.closed, 0.8);
        const seq = path.closed && pts.length > 1 ? [...pts, pts[0]] : pts;
        let run = [];
        const flush = () => {
          if (run.length > 1) paths.push({ pts: run, closed: false, layer: path.layer });
          run = [];
        };
        for (let i = 0; i < seq.length; i++) {
          const cur = seq[i];
          const inW = want(cur);
          if (inW) {
            if (run.length === 0 && i > 0 && !want(seq[i - 1])) run.push(cross(cur, seq[i - 1]));
            run.push(cur);
          } else {
            if (run.length > 0) {
              run.push(cross(seq[i - 1], cur));
              flush();
            }
          }
        }
        /* kokonaan sisalla pysynyt suljettu polku sailyy suljettuna */
        if (path.closed && run.length === seq.length) {
          run.pop();
          paths.push({ pts: run, closed: true, layer: path.layer });
        } else flush();
      }
      return { paths };
    }
  },

  explosion: {
      name: "Explosion",
    cat: "mod", group: "cutsplit",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "zone", label: "Zone", type: "select", options: ["Circle", "Rectangle"], def: "Circle" },
      { key: "cx", label: "Center X mm", type: "slider", min: -100, max: 500, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: -100, max: 500, step: 1, def: 100 },
      { key: "zw", label: "Zone Ø / width mm", type: "slider", min: 10, max: 500, step: 1, def: 240 },
      { key: "zh", label: "Zone height mm", type: "slider", min: 10, max: 500, step: 1, def: 150 },
      { key: "axis", label: "Axis (rectangle)", type: "select", options: ["Horizontal", "Vertical"], def: "Horizontal" },
      { key: "strength", label: "Strength mm", type: "slider", min: 0, max: 300, step: 1, def: 60 },
      { key: "dir", label: "Direction", type: "select", options: ["Outward", "Inward", "Directional"], def: "Outward" },
      { key: "angle", label: "Angle ° (directional)", type: "slider", min: -180, max: 180, step: 1, def: -90 },
      { key: "falloff", label: "Falloff", type: "select", options: ["Uniform", "Near stronger", "Far stronger"], def: "Near stronger" },
      { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "spread", label: "Spread °", type: "slider", min: 0, max: 90, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 103 },
    ],
    overlay(p) {
      const g = [{ kind: "point", x: p.cx, y: p.cy }];
      if (p.zone === "Circle") {
        g.push({ kind: "circle", cx: p.cx, cy: p.cy, r: p.zw / 2 });
      } else {
        g.push({ kind: "rect", x: p.cx - p.zw / 2, y: p.cy - p.zh / 2, w: p.zw, h: p.zh });
      }
      const L = Math.max(15, Math.min(p.strength, 70));
      if (p.dir === "Directional") {
        const a = (p.angle * Math.PI) / 180;
        g.push({ kind: "arrow", x1: p.cx, y1: p.cy, x2: p.cx + Math.cos(a) * L, y2: p.cy + Math.sin(a) * L });
      } else if (p.zone === "Rectangle") {
        /* suuntanuolet akselia pitkin molempiin suuntiin */
        const s = p.dir === "Inward" ? -1 : 1;
        if (p.axis === "Horizontal") {
          g.push({ kind: "arrow", x1: p.cx + 6 * s, y1: p.cy, x2: p.cx + (6 + L) * s, y2: p.cy });
          g.push({ kind: "arrow", x1: p.cx - 6 * s, y1: p.cy, x2: p.cx - (6 + L) * s, y2: p.cy });
        } else {
          g.push({ kind: "arrow", x1: p.cx, y1: p.cy + 6 * s, x2: p.cx, y2: p.cy + (6 + L) * s });
          g.push({ kind: "arrow", x1: p.cx, y1: p.cy - 6 * s, x2: p.cx, y2: p.cy - (6 + L) * s });
        }
      }
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* jaykka siirto per polku: muoto sailyy, vain sijainti muuttuu.
         Vaikutusalue rajaa: alueen ulkopuoliset kappaleet eivat liiku. */
      const paths = src.paths.map((path, pi) => {
        const rng = mulberry32(p.seed * 419 + pi * 233 + 13);
        let sx = 0, sy = 0;
        for (const [x, y] of path.pts) { sx += x; sy += y; }
        const cx0 = sx / path.pts.length, cy0 = sy / path.pts.length;
        const dx = cx0 - p.cx, dy = cy0 - p.cy;
        let inZone, d, baseDir;
        if (p.zone === "Circle") {
          d = Math.hypot(dx, dy) || 0.001;
          inZone = d <= p.zw / 2;
          baseDir = Math.atan2(dy, dx);
        } else {
          inZone = Math.abs(dx) <= p.zw / 2 && Math.abs(dy) <= p.zh / 2;
          if (p.axis === "Horizontal") {
            d = Math.abs(dx) || 0.001;
            baseDir = dx >= 0 ? 0 : Math.PI;
          } else {
            d = Math.abs(dy) || 0.001;
            baseDir = dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        if (!inZone) return path;
        let f;
        if (p.falloff === "Uniform") f = 1;
        else if (p.falloff === "Near stronger") f = 80 / (30 + d);
        else f = d / 90;
        let amt = p.strength * f * (1 - p.jitter * rng());
        if (p.dir === "Inward") amt = -Math.min(amt, d * 0.95); /* ei ylity keskilinjan yli */
        /* suuntahajonta */
        const dev = ((rng() - 0.5) * 2 * p.spread * Math.PI) / 180;
        const A = (p.dir === "Directional" ? (p.angle * Math.PI) / 180 : baseDir) + dev;
        const mx = Math.cos(A) * amt;
        const my = Math.sin(A) * amt;
        return {
          ...path,
          pts: path.pts.map(([x, y]) => [x + mx, y + my]),
        };
      });
      return { paths };
    }
  },

  stretch: {
    name: "Stretch", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Point (perspective)", "Directional"], def: "Directional" },
      { key: "cx", label: "Band center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Band center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "zw", label: "Band length mm (along)", type: "slider", min: 5, max: 300, step: 1, def: 40 },
      { key: "zh", label: "Band height mm (across)", type: "slider", min: 10, max: 400, step: 1, def: 120 },
      { key: "vpx", label: "Vanish point X mm", type: "slider", min: -300, max: 600, step: 1, def: 20 },
      { key: "vpy", label: "Vanish point Y mm", type: "slider", min: -300, max: 600, step: 1, def: 100 },
      { key: "angle", label: "Angle ° (directional)", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "amount", label: "Stretch mm (− compress)", type: "slider", min: -250, max: 250, step: 1, def: 90 },
      { key: "falloff", label: "Edge falloff", type: "select", options: ["Smooth", "Linear", "Spike"], def: "Smooth" },
      { key: "jit", label: "Per-path jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 47 },
    ],
    overlay(p) {
      let ux, uy;
      if (p.mode === "Directional") {
        const a = (p.angle * Math.PI) / 180;
        ux = Math.cos(a); uy = Math.sin(a);
      } else {
        const dx = p.cx - p.vpx, dy = p.cy - p.vpy;
        const d = Math.hypot(dx, dy) || 1;
        ux = dx / d; uy = dy / d;
      }
      const px = -uy, py = ux;
      const hw = p.zw / 2, hh = p.zh / 2;
      const g = [{
        kind: "poly",
        pts: [
          [p.cx - ux * hw - px * hh, p.cy - uy * hw - py * hh],
          [p.cx + ux * hw - px * hh, p.cy + uy * hw - py * hh],
          [p.cx + ux * hw + px * hh, p.cy + uy * hw + py * hh],
          [p.cx - ux * hw + px * hh, p.cy - uy * hw + py * hh],
        ],
      }];
      if (p.mode !== "Directional") g.push({ kind: "point", x: p.vpx, y: p.vpy });
      const L = Math.max(20, Math.min(Math.abs(p.amount), 80)) * Math.sign(p.amount || 1);
      g.push({ kind: "arrow", x1: p.cx, y1: p.cy, x2: p.cx + ux * L, y2: p.cy + uy * L });
      return g;
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* monotoninen kaista-remap: kaistan sisalla u venyy lineaarisesti,
         kaistan jalkeen kaikki siirtyy amountin verran -> ei laskoksia, viivat suoriksi */
      const shape = (t) => {
        if (t <= 0) return 0;
        t = Math.min(1, t);
        if (p.falloff === "Linear") return t;
        if (p.falloff === "Spike") return Math.pow(t, 2.5);
        return t * t * (3 - 2 * t);
      };
      const half = p.zw / 2;
      const dirAngle = (p.angle * Math.PI) / 180;
      const dux = Math.cos(dirAngle), duy = Math.sin(dirAngle);
      const cdx = p.cx - p.vpx, cdy = p.cy - p.vpy;
      const rc = Math.hypot(cdx, cdy) || 1;
      const angC = Math.atan2(cdy, cdx);
      const angHalf = Math.atan(Math.max(0.01, (p.zh / 2) / rc));
      const paths = src.paths.map((path, pi) => {
        const rng = mulberry32(p.seed * 733 + pi * 271 + 9);
        const amt0 = p.amount * (1 - p.jit * rng());
        return {
          ...path,
          pts: resample(path.pts, path.closed, 0.8).map(([x, y]) => {
            let ux, uy, u, vF;
            if (p.mode === "Directional") {
              ux = dux; uy = duy;
              const rx = x - p.cx, ry = y - p.cy;
              u = rx * ux + ry * uy;
              const v = -rx * uy + ry * ux;
              vF = shape(1 - Math.abs(v) / (p.zh / 2));
            } else {
              const dx = x - p.vpx, dy = y - p.vpy;
              const r = Math.hypot(dx, dy) || 1;
              ux = dx / r; uy = dy / r;
              u = r - rc;
              let dA = Math.atan2(dy, dx) - angC;
              while (dA > Math.PI) dA -= Math.PI * 2;
              while (dA < -Math.PI) dA += Math.PI * 2;
              vF = shape(1 - Math.abs(dA) / angHalf);
            }
            if (vF <= 0) return [x, y];
            const amt = Math.max(-(p.zw * 0.95), amt0 * vF);
            let du;
            if (u <= -half) du = 0;
            else if (u >= half) du = amt;
            else du = ((u + half) / p.zw) * amt;
            return [x + ux * du, y + uy * du];
          }),
        };
      });
      return { paths };
    },
  },

  tangle: {
    name: "Tangle Zone", cat: "mod", group: "deform", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "shape", label: "Zone", type: "select", options: ["Rectangle", "Circle"], def: "Rectangle" },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "zw", label: "Width / Ø mm", type: "slider", min: 10, max: 300, step: 1, def: 120 },
      { key: "zh", label: "Height mm", type: "slider", min: 10, max: 300, step: 1, def: 90 },
      { key: "strength", label: "Strength mm", type: "slider", min: 0, max: 80, step: 0.5, def: 25 },
      { key: "scale", label: "Noise scale", type: "slider", min: 0.01, max: 0.3, step: 0.005, def: 0.05 },
      { key: "seed", label: "Seed", type: "seed", def: 31 },
    ],
    overlay(p) {
      return p.shape === "Circle"
        ? [{ kind: "circle", cx: p.cx, cy: p.cy, r: p.zw / 2 }]
        : [{ kind: "rect", x: p.cx - p.zw / 2, y: p.cy - p.zh / 2, w: p.zw, h: p.zh }];
    },
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      /* voimakkuus 0 reunalla -> ankkurit pysyvat; kasvaa keskustaa kohti */
      const fall = (x, y) => {
        let t;
        if (p.shape === "Circle") {
          const d = Math.hypot(x - p.cx, y - p.cy);
          t = 1 - d / (p.zw / 2);
        } else {
          const fx = 1 - Math.abs(x - p.cx) / (p.zw / 2);
          const fy = 1 - Math.abs(y - p.cy) / (p.zh / 2);
          t = Math.min(fx, fy);
        }
        if (t <= 0) return 0;
        t = Math.min(1, t * 1.6);
        return t * t * (3 - 2 * t);
      };
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, 1).map(([x, y]) => {
          const f = fall(x, y);
          if (f === 0) return [x, y];
          const dx = (noise2(x * p.scale, y * p.scale, p.seed) - 0.5) * 2;
          const dy = (noise2(x * p.scale + 77, y * p.scale + 31, p.seed) - 0.5) * 2;
          return [x + dx * p.strength * f, y + dy * p.strength * f];
        }),
      }));
      return { paths };
    },
  },

  scatter: {
    name: "Scatter", cat: "mod", group: "cutsplit", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Gradient", type: "select", options: ["Top → Bottom", "Bottom → Top", "Left → Right", "Right → Left", "Radial", "Uniform"], def: "Top → Bottom" },
      { key: "offset", label: "Max offset mm", type: "slider", min: 0, max: 40, step: 0.5, def: 8 },
      { key: "rot", label: "Max rotate °", type: "slider", min: 0, max: 90, step: 1, def: 25 },
      { key: "seed", label: "Seed", type: "seed", def: 33 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const paths = src.paths.map((path, i) => {
        const cx = path.pts.reduce((s, q) => s + q[0], 0) / path.pts.length;
        const cy = path.pts.reduce((s, q) => s + q[1], 0) / path.pts.length;
        let f;
        switch (p.mode) {
          case "Top → Bottom": f = cy / H; break;
          case "Bottom → Top": f = 1 - cy / H; break;
          case "Left → Right": f = cx / W; break;
          case "Right → Left": f = 1 - cx / W; break;
          case "Radial": f = Math.hypot(cx - W / 2, cy - H / 2) / (Math.hypot(W, H) / 2); break;
          default: f = 1;
        }
        f = Math.max(0, Math.min(1, f));
        const rng = mulberry32(p.seed * 613 + i * 89 + 7);
        const ang = rng() * Math.PI * 2;
        const dist = rng() * p.offset * f;
        const tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist;
        const rad = ((rng() - 0.5) * 2 * p.rot * f * Math.PI) / 180;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        return {
          ...path,
          pts: path.pts.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            return [cx + dx * ca - dy * sa + tx, cy + dx * sa + dy * ca + ty];
          }),
        };
      });
      return { paths };
    },
  },

  pencycle: {
    name: "Pen Cycle", cat: "mod", group: "penout", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "group", label: "Paths per pen", type: "slider", min: 1, max: 20, step: 1, def: 1 },
      { key: "pens", label: "Pens to use", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "start", label: "Start pen", type: "pen", def: 0 },
      { key: "mode", label: "Mode", type: "select", options: ["Cycle", "Random"], def: "Cycle" },
      { key: "seed", label: "Seed", type: "seed", def: 35 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const g = Math.max(1, Math.round(p.group));
      const nP = Math.round(p.pens);
      const rng = mulberry32(p.seed * 449 + 13);
      let rndMap = null;
      if (p.mode === "Random") {
        rndMap = {};
      }
      const paths = src.paths.map((path, i) => {
        const grp = Math.floor(i / g);
        let pen;
        if (p.mode === "Random") {
          if (rndMap[grp] === undefined) rndMap[grp] = Math.floor(rng() * nP);
          pen = rndMap[grp];
        } else {
          pen = grp % nP;
        }
        return { ...path, layer: (Math.round(p.start) + pen) % PENS.length };
      });
      return { paths };
    },
  },

  chop: {
    name: "Chop", cat: "mod", group: "cutsplit", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "length", label: "Piece length mm", type: "slider", min: 1, max: 80, step: 0.5, def: 12 },
      { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 20, step: 0.25, def: 0 },
      { key: "pens", label: "Pens to use", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "start", label: "Start pen", type: "pen", def: 0 },
      { key: "assign", label: "Assign", type: "select", options: ["Cycle", "Random"], def: "Cycle" },
      { key: "seed", label: "Seed", type: "seed", def: 61 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const nP = Math.round(p.pens);
      const paths = [];
      let globalIdx = 0;
      src.paths.forEach((path, pi) => {
        const rng = mulberry32(p.seed * 379 + pi * 149 + 7);
        const pts = resample(path.pts, path.closed, 0.5);
        const closedPts = path.closed ? [...pts, pts[0]] : pts;
        const cum = [0];
        for (let i = 1; i < closedPts.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(closedPts[i][0] - closedPts[i - 1][0], closedPts[i][1] - closedPts[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 0.5) return;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          return [closedPts[lo][0] + (closedPts[hi][0] - closedPts[lo][0]) * f,
                  closedPts[lo][1] + (closedPts[hi][1] - closedPts[lo][1]) * f, lo];
        };
        let s = 0;
        while (s < total - 0.3) {
          const pieceLen = Math.max(0.5, p.length * (1 - p.lenVar * rng()));
          const s0 = s + p.gap / 2;
          const s1 = Math.min(total, s + pieceLen - p.gap / 2);
          if (s1 - s0 > 0.3) {
            const [ax, ay, aIdx] = at(s0);
            const [bx, by, bIdx] = at(s1);
            const piece = [[ax, ay]];
            for (let i = aIdx + 1; i <= bIdx; i++) piece.push([closedPts[i][0], closedPts[i][1]]);
            piece.push([bx, by]);
            const pen = p.assign === "Random"
              ? Math.floor(rng() * nP)
              : globalIdx % nP;
            paths.push({ pts: piece, closed: false, layer: (Math.round(p.start) + pen) % PENS.length });
            globalIdx++;
          }
          s += pieceLen;
        }
      });
      return { paths };
    },
  },

  hatch: {
    name: "Hatch Fill", cat: "mod", group: "fillstyle", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "region", label: "Region", type: "select", options: ["Inside shapes", "Outside (invert)"], def: "Inside shapes" },
      { key: "invMargin", label: "Invert margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8 },
      { key: "angle", label: "Angle °", type: "slider", min: 0, max: 180, step: 1, def: 45 },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.3, max: 15, step: 0.1, def: 2 },
      { key: "inset", label: "Inset from edge mm", type: "slider", min: 0, max: 10, step: 0.1, def: 0 },
      { key: "cross", label: "Cross hatch", type: "check", def: false },
      { key: "outlines", label: "Keep outlines", type: "check", def: true },
      { key: "keepCol", label: "Keep shape colors", type: "check", def: true },
      { key: "layer", label: "Hatch pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const paths = [];
      let closedPaths = src.paths.filter((pa) => pa.closed && pa.pts.length > 2);
      /* invert: lisaa canvas-kehys uloimmaksi renkaaksi -> even-odd viivoittaa muotojen ULKOpuolen */
      if (p.region === "Outside (invert)") {
        const m = p.invMargin;
        closedPaths = [
          {
            pts: [[m, m], [ctx.W - m, m], [ctx.W - m, ctx.H - m], [m, ctx.H - m]],
            closed: true, layer: Math.round(p.layer),
          },
          ...closedPaths,
        ];
      }
      /* inset: siirrä reunaa täyttöalueen sisään — myös reikien reunat (parity) */
      if (p.inset > 0) {
        const ringContains = (ring, x, y) => {
          let ins = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
          }
          return ins;
        };
        closedPaths = closedPaths.map((pa, pi) => {
          const pts = resample(pa.pts, true, 1);
          const N = pts.length;
          /* montako MUUTA rengasta sisältää tämän? pariton = reiän reuna -> offset ulospäin */
          let cnt = 0;
          for (let k = 0; k < closedPaths.length; k++) {
            if (k === pi) continue;
            if (ringContains(closedPaths[k].pts, pts[0][0], pts[0][1])) cnt++;
          }
          const hole = cnt % 2 === 1;
          const inward = (signedArea(pts) > 0 ? 1 : -1) * (hole ? -1 : 1);
          return {
            ...pa,
            pts: pts.map((pt, i) => {
              const nI = (i + 1) % N, pI = (i - 1 + N) % N;
              const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
              const tl = Math.hypot(tx, ty) || 1;
              return [pt[0] + (-ty / tl) * p.inset * inward, pt[1] + (tx / tl) * p.inset * inward];
            }),
          };
        });
      }
      for (const path of src.paths) if (p.outlines || !path.closed) paths.push(path);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const angles = p.cross ? [p.angle, p.angle + 90] : [p.angle];
      for (const angDeg of angles) {
        const a = (angDeg * Math.PI) / 180;
        const ca = Math.cos(-a), sa = Math.sin(-a);
        const caB = Math.cos(a), saB = Math.sin(a);
        /* kierrä muodot viivoituskulman avaruuteen */
        const rot = closedPaths.map((pa) => ({
          layer: pa.layer,
          pts: pa.pts.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
          }),
        }));
        let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
        for (const pa of rot) for (const [x, y] of pa.pts) {
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
        }
        if (minY === Infinity) continue;
        let row = 0;
        for (let y = minY + p.spacing / 2; y < maxY; y += p.spacing, row++) {
          /* leikkauspisteet per muoto, even-odd */
          const xs = [];
          const xLayer = [];
          for (const pa of rot) {
            const pts = pa.pts;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const [xi, yi] = pts[i], [xj, yj] = pts[j];
              if ((yi > y) !== (yj > y)) {
                xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
                xLayer.push(pa.layer);
              }
            }
          }
          const order = xs.map((x, i) => i).sort((i, j) => xs[i] - xs[j]);
          for (let k = 0; k + 1 < order.length; k += 2) {
            let xA = xs[order[k]], xB = xs[order[k + 1]];
            if (xB - xA < 0.2) continue;
            if (row % 2 === 1) { const t = xA; xA = xB; xB = t; } // boustrophedon: suunta vuorotellen
            const back = ([x, yy]) => {
              const dx = x - cx, dy = yy - cy;
              return [cx + dx * caB - dy * saB, cy + dx * saB + dy * caB];
            };
            paths.push({
              pts: [back([xA, y]), back([xB, y])],
              closed: false,
              layer: p.keepCol ? xLayer[order[k]] : Math.round(p.layer),
            });
          }
        }
      }
      return { paths };
    },
  },

  stamp: {
    name: "Stamp", cat: "dec", ins: [Pin("paths", "Host path"), Pin("paths", "Motif")], outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Spacing mm", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
      { key: "size", label: "Size mm", type: "slider", min: 0.5, max: 25, step: 0.25, def: 3 },
      { key: "sizeMod", label: "Size modulation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "pathVar", label: "Per-path variation", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
      { key: "motif", label: "Motif (if unwired)", type: "select", options: ["Circle", "Square", "Triangle", "Line"], def: "Circle" },
      { key: "orientMode", label: "Orientation", type: "select", options: ["Fixed", "Along path", "Perpendicular"], def: "Fixed" },
      { key: "angle", label: "Angle °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "keepCol", label: "Keep motif colors", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 2 },
      { key: "layer", label: "Motif pen", type: "pen", def: 3 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const motifIn = ins[1];
      const useCustom = motifIn && motifIn.paths && motifIn.paths.length;
      /* normalisoi custom-motiivi: keskitä ja skaalaa yksikkökokoon */
      let motifNorm = null;
      if (useCustom) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const mp of motifIn.paths) for (const [x, y] of mp.pts) {
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        }
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const dim = Math.max(maxX - minX, maxY - minY) || 1;
        motifNorm = motifIn.paths.map((mp) => ({
          pts: mp.pts.map(([x, y]) => [(x - cx) / dim, (y - cy) / dim]),
          closed: mp.closed, layer: mp.layer,
        }));
      }
      const paths = [];
      const corners = p.motif === "Circle" ? 20 : p.motif === "Square" ? 4 : 3;
      const rotOff = p.motif === "Square" ? Math.PI / 4 : -Math.PI / 2;
      src.paths.forEach((path, pIdx) => {
        if (p.host) paths.push(path);
        const pts = resample(path.pts, path.closed, Math.max(0.5, p.spacing));
        pts.forEach((pt, i) => {
          const m = 1 + (noise2(
            pt[0] * 0.05 + pIdx * 7.31 * p.pathVar,
            pt[1] * 0.05 + pIdx * 3.77 * p.pathVar,
            p.seed) - 0.5) * 2 * p.sizeMod;
          const S = Math.max(0.2, p.size * m);
          let ang = (p.angle * Math.PI) / 180;
          if (p.orientMode !== "Fixed" && pts.length > 1) {
            const nb = pts[Math.min(i + 1, pts.length - 1)], pb = pts[Math.max(i - 1, 0)];
            const tang = Math.atan2(nb[1] - pb[1], nb[0] - pb[0]);
            ang += p.orientMode === "Perpendicular" ? tang + Math.PI / 2 : tang;
          }
          const ca = Math.cos(ang), sa = Math.sin(ang);
          if (motifNorm) {
            for (const mp of motifNorm) {
              const out = mp.pts.map(([x, y]) => {
                const xs = x * S, ys = y * S;
                return [pt[0] + xs * ca - ys * sa, pt[1] + xs * sa + ys * ca];
              });
              paths.push({ pts: out, closed: mp.closed, layer: p.keepCol ? mp.layer : Math.round(p.layer) });
            }
          } else if (p.motif === "Line") {
            /* viivamotiivi: pituus = Size, suunta orientaation mukaan */
            const h = S / 2;
            paths.push({
              pts: [[pt[0] - h * ca, pt[1] - h * sa], [pt[0] + h * ca, pt[1] + h * sa]],
              closed: false, layer: Math.round(p.layer),
            });
          } else {
            const r = S / 2;
            const mp = [];
            for (let k = 0; k < corners; k++) {
              const a = (k / corners) * Math.PI * 2 + rotOff + ang;
              mp.push([pt[0] + Math.cos(a) * r, pt[1] + Math.sin(a) * r]);
            }
            paths.push({ pts: mp, closed: true, layer: Math.round(p.layer) });
          }
        });
      });
      return { paths };
    },
  },

  outline: {
    name: "Outline", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "width", label: "Width mm", type: "slider", min: 0.4, max: 12, step: 0.1, def: 2 },
      { key: "clean", label: "Clean corners", type: "check", def: true },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "layer", label: "Outline pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const r = p.width / 2;
      const paths = [];
      const cleanSide = (out, orig, closed) => {
        if (!p.clean) return out;
        const keep = new Array(out.length).fill(true);
        for (let i = 1; i < out.length; i++) {
          const odx = orig[i][0] - orig[i - 1][0], ody = orig[i][1] - orig[i - 1][1];
          const fdx = out[i][0] - out[i - 1][0], fdy = out[i][1] - out[i - 1][1];
          if (odx * fdx + ody * fdy < 0) keep[i] = false;
        }
        const res = [];
        for (let i = 0; i < out.length; i++) {
          if (!keep[i]) continue;
          const last = res[res.length - 1];
          if (!last || Math.hypot(out[i][0] - last[0], out[i][1] - last[1]) > 0.06) res.push(out[i]);
        }
        return res;
      };
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        const L = p.keepCol ? path.layer : Math.round(p.layer);
        const pts = resample(path.pts, path.closed, Math.max(0.5, r / 2));
        if (pts.length < 2) continue;
        const N = pts.length;
        const nl = pts.map((pt, i) => {
          const nI = path.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
          const pI = path.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [-ty / tl, tx / tl];
        });
        if (path.closed) {
          /* suljettu polku -> kaksi rengasta (nauha) */
          for (const s of [1, -1]) {
            const out = cleanSide(pts.map((pt, i) => [pt[0] + nl[i][0] * r * s, pt[1] + nl[i][1] * r * s]), pts, true);
            if (out.length > 2) paths.push({ pts: out, closed: true, layer: L });
          }
          continue;
        }
        /* avoin polku -> kapseli: vasen kylki + paatykaari + oikea kylki + alkukaari */
        const left = cleanSide(pts.map((pt, i) => [pt[0] + nl[i][0] * r, pt[1] + nl[i][1] * r]), pts, false);
        const rightFwd = cleanSide(pts.map((pt, i) => [pt[0] - nl[i][0] * r, pt[1] - nl[i][1] * r]), pts, false);
        const right = [...rightFwd].reverse();
        const capArc = (center, fromV) => {
          /* puoliympyra: fromV-suunnasta 180 astetta myotapaivaan */
          const a0 = Math.atan2(fromV[1], fromV[0]);
          const out = [];
          for (let k = 1; k < 10; k++) {
            const a = a0 - (Math.PI * k) / 10;
            out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]);
          }
          return out;
        };
        const capsule = [
          ...left,
          ...capArc(pts[N - 1], nl[N - 1]),
          ...right,
          ...capArc(pts[0], [-nl[0][0], -nl[0][1]]),
        ];
        if (capsule.length > 3) paths.push({ pts: capsule, closed: true, layer: L });
      }
      return { paths };
    },
  },

  coil: {
    name: "Coil", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "radius", label: "Radius mm", type: "slider", min: 0.5, max: 15, step: 0.1, def: 3 },
      { key: "pitch", label: "Pitch mm / loop", type: "slider", min: 0.5, max: 25, step: 0.1, def: 4 },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "layer", label: "Coil pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        const base = resample(path.pts, path.closed, 0.5);
        if (base.length < 3) continue;
        const cum = [0];
        for (let i = 1; i < base.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 1) continue;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = base[lo][0] + (base[hi][0] - base[lo][0]) * f;
          const y = base[lo][1] + (base[hi][1] - base[lo][1]) * f;
          const tx = base[hi][0] - base[lo][0], ty = base[hi][1] - base[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };
        /* trokoidi: ympyraliike etenevan pisteen ymparilla -> silmukat kun pitch < 2*pi*r */
        const loops = total / Math.max(0.2, p.pitch);
        const stepsPerLoop = Math.max(12, Math.ceil((Math.PI * 2 * p.radius) / 0.7));
        const nSteps = Math.min(60000, Math.ceil(loops * stepsPerLoop));
        const pts = [];
        for (let i = 0; i <= nSteps; i++) {
          const th = (i / nSteps) * loops * Math.PI * 2;
          const s = (th / (Math.PI * 2)) * p.pitch;
          const [x, y, tx, ty] = at(s);
          const cr = p.radius * Math.cos(th), sr = p.radius * Math.sin(th);
          pts.push([x + tx * cr - ty * sr, y + ty * cr + tx * sr]);
        }
        paths.push({ pts, closed: false, layer: p.keepCol ? path.layer : Math.round(p.layer) });
      }
      return { paths };
    },
  },

  hersheytext: {
    name: "Text", cat: "gen", group: "textimg", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text (| = new line)", type: "text", def: "MUUSIA" },
      { key: "size", label: "Size mm (cap height)", type: "slider", min: 2, max: 80, step: 0.5, def: 20 },
      { key: "track", label: "Tracking %", type: "slider", min: 50, max: 250, step: 1, def: 100 },
      { key: "lineh", label: "Line height %", type: "slider", min: 90, max: 300, step: 1, def: 150 },
      { key: "align", label: "Align", type: "select", options: ["Left", "Center", "Right"], def: "Center" },
      { key: "centerC", label: "Center on canvas", type: "check", def: true },
      { key: "px", label: "Pos X mm", type: "slider", min: 0, max: 400, step: 1, def: 20 },
      { key: "py", label: "Pos Y mm", type: "slider", min: 0, max: 400, step: 1, def: 40 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      /* Oma yksiviivafontti: ruudukko x 0..~9, y 0 = versaalin ylareuna, 10 = peruslinja */
      const F = SFONT;
      const sc = p.size / 10;
      const tr = p.track / 100;
      const lines = String(p.text || "").toUpperCase().split("|");
      const lineWidth = (line) => {
        let w = 0;
        for (const ch of line) w += ((F[ch] || F[" "]).w + 2) * sc * tr;
        return w;
      };
      const totalH = p.size + (lines.length - 1) * p.size * (p.lineh / 100);
      const maxW = Math.max(...lines.map(lineWidth), 1);
      let ox, oy;
      if (p.centerC) {
        ox = (ctx.W - maxW) / 2;
        oy = (ctx.H - totalH) / 2;
      } else { ox = p.px; oy = p.py; }
      const paths = [];
      lines.forEach((line, li) => {
        const lw = lineWidth(line);
        let x = ox + (p.align === "Center" ? (maxW - lw) / 2 : p.align === "Right" ? maxW - lw : 0);
        const y = oy + li * p.size * (p.lineh / 100);
        for (const ch of line) {
          const g = F[ch] || F[" "];
          for (const stroke of g.s) {
            if (stroke.length < 2) continue;
            paths.push({
              pts: stroke.map(([gx, gy]) => [x + gx * sc, y + gy * sc]),
              closed: false, layer: Math.round(p.layer),
            });
          }
          x += (g.w + 2) * sc * tr;
        }
      });
      return applyStyle({ paths }, ins[0]);
    },
  },

  fur: {
    name: "Fur", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.5, max: 20, step: 0.25, def: 3 },
      { key: "length", label: "Length mm", type: "slider", min: 0.5, max: 30, step: 0.25, def: 5 },
      { key: "lenJit", label: "Length jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "angJit", label: "Angle jitter °", type: "slider", min: 0, max: 80, step: 1, def: 25 },
      { key: "side", label: "Side", type: "select", options: ["Both (alternate)", "Both (random)", "Left", "Right"], def: "Left" },
      { key: "host", label: "Include host path", type: "check", def: true },
      { key: "seed", label: "Seed", type: "seed", def: 43 },
      { key: "layer", label: "Hair pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      src.paths.forEach((path, pi) => {
        if (p.host) paths.push(path);
        const rng = mulberry32(p.seed * 883 + pi * 127 + 5);
        const pts = resample(path.pts, path.closed, Math.max(0.4, p.spacing));
        let alt = false;
        pts.forEach((pt, i) => {
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          let s;
          if (p.side === "Left") s = 1;
          else if (p.side === "Right") s = -1;
          else if (p.side === "Both (alternate)") { s = alt ? 1 : -1; alt = !alt; }
          else s = rng() > 0.5 ? 1 : -1;
          const baseA = Math.atan2(tx, -ty) + (s < 0 ? Math.PI : 0); /* normaalin suunta */
          const a = baseA + ((rng() - 0.5) * 2 * p.angJit * Math.PI) / 180;
          const len = Math.max(0.2, p.length * (1 - p.lenJit * rng()));
          paths.push({
            pts: [[pt[0], pt[1]], [pt[0] + Math.cos(a) * len, pt[1] + Math.sin(a) * len]],
            closed: false,
            layer: p.keepCol ? path.layer : Math.round(p.layer),
          });
        });
      });
      return { paths };
    },
  },

  endcaps: {
    name: "End Caps", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "where", label: "Where", type: "select", options: ["End", "Start", "Both"], def: "End" },
      { key: "style", label: "Style", type: "select", options: ["Arrow", "Dot", "Circle", "Tick"], def: "Arrow" },
      { key: "size", label: "Size mm", type: "slider", min: 0.5, max: 15, step: 0.25, def: 3 },
      { key: "host", label: "Include host path", type: "check", def: true },
      { key: "layer", label: "Cap pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      const cap = (pt, dirIn, layer) => {
        /* dirIn = polun kulkusuunta paatepisteessa (osoittaa ulos polusta) */
        const a = Math.atan2(dirIn[1], dirIn[0]);
        if (p.style === "Arrow") {
          const w = (25 * Math.PI) / 180;
          for (const s of [1, -1]) {
            paths.push({
              pts: [[pt[0], pt[1]], [pt[0] - Math.cos(a + s * w) * p.size, pt[1] - Math.sin(a + s * w) * p.size]],
              closed: false, layer,
            });
          }
        } else if (p.style === "Tick") {
          const h = p.size / 2;
          paths.push({
            pts: [[pt[0] - Math.sin(a) * h, pt[1] + Math.cos(a) * h], [pt[0] + Math.sin(a) * h, pt[1] - Math.cos(a) * h]],
            closed: false, layer,
          });
        } else {
          const n = p.style === "Dot" ? 8 : 16;
          const r = p.style === "Dot" ? p.size / 4 : p.size / 2;
          const c = [];
          for (let k = 0; k < n; k++) {
            const aa = (k / n) * Math.PI * 2;
            c.push([pt[0] + Math.cos(aa) * r, pt[1] + Math.sin(aa) * r]);
          }
          paths.push({ pts: c, closed: true, layer });
        }
      };
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        if (path.closed || path.pts.length < 2) continue;
        const L = p.keepCol ? path.layer : Math.round(p.layer);
        const n = path.pts.length;
        if (p.where !== "Start") {
          const d = [path.pts[n - 1][0] - path.pts[n - 2][0], path.pts[n - 1][1] - path.pts[n - 2][1]];
          cap(path.pts[n - 1], d, L);
        }
        if (p.where !== "End") {
          const d = [path.pts[0][0] - path.pts[1][0], path.pts[0][1] - path.pts[1][1]];
          cap(path.pts[0], d, L);
        }
      }
      return { paths };
    },
  },

  mask: {
    name: "Mask", cat: "duo", ins: [Pin("paths", "Target"), Pin("paths", "Mask")], outs: [Pin("paths")],
    params: [{ key: "keep", label: "Keep", type: "select", options: ["Outside", "Inside"], def: "Outside" }],
    compute(ins, p) {
      const src = ins[0] || EMPTY, msk = ins[1] || EMPTY;
      if (!msk.paths.length) return src;
      const wantInside = p.keep === "Inside";
      const paths = [];
      for (const path of src.paths) {
        const pts = resample(path.pts, path.closed, 1.5);
        let run = [];
        for (const pt of pts) {
          const keep = pointInMask(msk, pt[0], pt[1]) === wantInside;
          if (keep) run.push(pt);
          else if (run.length > 1) { paths.push({ pts: run, closed: false, layer: path.layer }); run = []; }
          else run = [];
        }
        if (run.length > 1) paths.push({ pts: run, closed: false, layer: path.layer });
      }
      return { paths };
    },
  },

  merge: {
    name: "Merge", cat: "duo",
    ins: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 2 }, (_, i) => Pin("paths", String(i + 1))),
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Inputs", type: "slider", min: 2, max: 6, step: 1, def: 2 },
      { key: "penPer", label: "Pen change per input", type: "check", def: false },
    ],
    compute(ins, p) {
      const paths = [];
      for (let i = 0; i < Math.round(p.count); i++) {
        const src = ins[i] || EMPTY;
        if (!src.paths) continue;
        for (const path of src.paths) paths.push(p.penPer ? { ...path, layer: i % PENS.length } : path);
      }
      return { paths };
    },
  },

  split: {
    name: "Split", cat: "duo",
    ins: [Pin("paths")],
    outs: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 3 }, (_, i) => Pin("paths", String(i + 1))),
    params: [
      { key: "count", label: "Outputs", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "dx", label: "Δ X mm / output", type: "slider", min: -30, max: 30, step: 0.25, def: 2 },
      { key: "dy", label: "Δ Y mm / output", type: "slider", min: -30, max: 30, step: 0.25, def: 0 },
      { key: "drot", label: "Δ Rotate ° / output", type: "slider", min: -45, max: 45, step: 0.5, def: 0 },
      { key: "dscale", label: "Δ Scale % / output", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 6 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const n = Math.round(p.count);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const outs = [];
      for (let i = 0; i < n; i++) {
        const rng = mulberry32(p.seed * 77 + i * 991 + 3);
        const jx = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const jy = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const tx = p.dx * i + jx, ty = p.dy * i + jy;
        const rad = ((p.drot * i) * Math.PI) / 180;
        const sc = 1 + (p.dscale * i) / 100;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        outs.push({
          paths: src.paths.map((path) => ({
            ...path,
            pts: path.pts.map(([x, y]) => {
              const dx0 = (x - cx) * sc, dy0 = (y - cy) * sc;
              return [cx + dx0 * ca - dy0 * sa + tx, cy + dx0 * sa + dy0 * ca + ty];
            }),
          })),
        });
      }
      return outs;
    },
  },

  array: {
    name: "Array", cat: "duo", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Copies", type: "slider", min: 2, max: 8, step: 1, def: 3 },
      { key: "dx", label: "Δ X mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 2 },
      { key: "dy", label: "Δ Y mm / copy", type: "slider", min: -30, max: 30, step: 0.25, def: 0 },
      { key: "drot", label: "Δ Rotate ° / copy", type: "slider", min: -45, max: 45, step: 0.5, def: 0 },
      { key: "dscale", label: "Δ Scale % / copy", type: "slider", min: -30, max: 30, step: 0.5, def: 0 },
      { key: "jit", label: "Jitter mm", type: "slider", min: 0, max: 15, step: 0.25, def: 0 },
      { key: "penPer", label: "Pen change per copy", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 16 },
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const n = Math.round(p.count);
      const cx = ctx.W / 2, cy = ctx.H / 2;
      const paths = [];
      for (let i = 0; i < n; i++) {
        const rng = mulberry32(p.seed * 77 + i * 991 + 3);
        const jx = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const jy = p.jit ? (rng() - 0.5) * 2 * p.jit : 0;
        const tx = p.dx * i + jx, ty = p.dy * i + jy;
        const rad = ((p.drot * i) * Math.PI) / 180;
        const sc = 1 + (p.dscale * i) / 100;
        const ca = Math.cos(rad), sa = Math.sin(rad);
        for (const path of src.paths) {
          paths.push({
            pts: path.pts.map(([x, y]) => {
              const dx0 = (x - cx) * sc, dy0 = (y - cy) * sc;
              return [cx + dx0 * ca - dy0 * sa + tx, cy + dx0 * sa + dy0 * ca + ty];
            }),
            closed: path.closed,
            layer: p.penPer ? i % PENS.length : path.layer,
          });
        }
      }
      return { paths };
    },
  },

  frame: {
    name: "Frame", cat: "math", ins: [],
    outs: [Pin("value", "t 0\u21921"), Pin("value", "frame #"), Pin("value", "wave loop"), Pin("value", "ping-pong")],
    params: [],
    compute(ins, p, ctx) {
      /* animaatioaika: t = lineaarinen ramppi (viim. freimi = 1),
         wave & ping-pong = saumattomat luupit (freimi N == freimi 0) */
      const n = Math.max(1, ctx.frameCount || 1);
      const i = Math.min(n - 1, Math.max(0, ctx.frameIdx || 0));
      const t = n > 1 ? i / (n - 1) : 0;
      const tl = i / n;
      const wave = 0.5 - 0.5 * Math.cos(tl * Math.PI * 2);
      const pp = tl < 0.5 ? tl * 2 : 2 - tl * 2;
      return [t, i, wave, pp];
    },
  },

  arvo: {
    name: "Value", cat: "math", ins: [], outs: [Pin("value")],
    params: [{ key: "v", label: "Value", type: "slider", min: -100, max: 100, step: 0.5, def: 4 }],
    compute(_ins, p) { return p.v; },
  },

  matem: {
    name: "Math", cat: "math", ins: [Pin("value", "A"), Pin("value", "B")], outs: [Pin("value")],
    params: [
      { key: "op", label: "Operation", type: "select", options: ["A + B", "A − B", "A × B", "A ÷ B", "min", "max", "A ^ B", "A mod B"], def: "A + B" },
      { key: "a", label: "A (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 1 },
      { key: "b", label: "B (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 1 },
    ],
    compute(ins, p) {
      const A = typeof ins[0] === "number" ? ins[0] : p.a;
      const B = typeof ins[1] === "number" ? ins[1] : p.b;
      switch (p.op) {
        case "A + B": return A + B;
        case "A − B": return A - B;
        case "A × B": return A * B;
        case "A ÷ B": return B === 0 ? 0 : A / B;
        case "min": return Math.min(A, B);
        case "max": return Math.max(A, B);
        case "A ^ B": return Math.pow(A, B);
        case "A mod B": return B === 0 ? 0 : A % B;
        default: return A;
      }
    },
  },

  satunnainen: {
    name: "Random", cat: "math", ins: [], outs: [Pin("value")],
    params: [
      { key: "min", label: "Min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
      { key: "max", label: "Max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 11 },
    ],
    compute(_ins, p) {
      const rng = mulberry32(p.seed * 2749 + 331);
      return p.min + rng() * (p.max - p.min);
    },
  },

  fan: {
    name: "Fan", cat: "math",
    ins: [Pin("value", "Value")],
    outs: (node) => Array.from({ length: (node && node.params && Math.round(node.params.count)) || 3 }, (_, i) => Pin("value", String(i + 1))),
    params: [
      { key: "count", label: "Outputs", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "base", label: "Value (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 3 },
      { key: "mode", label: "Spread", type: "select", options: ["Same", "Step +", "Factor ×", "Random"], def: "Step +" },
      { key: "step", label: "Step", type: "slider", min: -50, max: 50, step: 0.25, def: 2 },
      { key: "seed", label: "Seed", type: "seed", def: 8 },
    ],
    compute(ins, p) {
      const v = typeof ins[0] === "number" ? ins[0] : p.base;
      const n = Math.round(p.count);
      const rng = mulberry32(p.seed * 613 + 29);
      const outs = [];
      for (let i = 0; i < n; i++) {
        if (p.mode === "Same") outs.push(v);
        else if (p.mode === "Step +") outs.push(v + p.step * i);
        else if (p.mode === "Factor ×") outs.push(v * Math.pow(p.step === 0 ? 1 : p.step, i));
        else outs.push(v + (rng() - 0.5) * 2 * p.step);
      }
      return outs;
    },
  },

  reititys: {
    name: "Route", cat: "route", hidden: true, ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "preserve", label: "Preserve direction", type: "check", def: true }],
    compute(ins, p) { return routeOptimize(ins[0] || EMPTY, p.preserve); },
  },

  group: {
    name: "Group", cat: "duo", hidden: true,
    ins: (node) => (node && node.data ? node.data.bindings.map((b, i) => Pin(bindingType(node, b), "In " + (i + 1))) : []),
    outs: (node) => [Pin(node && node.data ? groupOutType(node) : "paths")],
    params: [],
    compute() { return EMPTY; },
  },
};

/* ============================================================
   CUSTOM NODE PLUGINS — maaritelmat ladataan ajonaikaisesti
   Katso MUUSIA-NODE-API.md
   ============================================================ */
const NODE_HELPERS = { noise2, mulberry32, hash2, resample, pathLength, applyStyle, signedArea, EMPTY, PENS, Pin };
let BUILTIN_KEYS = null;
function evaluateNodeDef(code) {
  if (!BUILTIN_KEYS) BUILTIN_KEYS = new Set(Object.keys(DEFS).filter((k) => !DEFS[k].custom));
  const names = Object.keys(NODE_HELPERS);
  const fn = new Function(...names, `"use strict"; return (${code});`);
  const def = fn(...names.map((n) => NODE_HELPERS[n]));
  if (!def || typeof def !== "object") throw new Error("definition must evaluate to an object");
  if (!def.key || typeof def.key !== "string" || !/^[a-z][a-z0-9_]*$/.test(def.key)) throw new Error("missing/invalid 'key' (lowercase identifier)");
  if (BUILTIN_KEYS.has(def.key) ) throw new Error(`key '${def.key}' collides with a built-in node`);
  if (!def.name) throw new Error("missing 'name'");
  if (typeof def.compute !== "function") throw new Error("missing 'compute' function");
  if (!Array.isArray(def.params)) def.params = [];
  if (!Array.isArray(def.ins) && typeof def.ins !== "function") def.ins = [];
  if (!Array.isArray(def.outs) && typeof def.outs !== "function") def.outs = [Pin("paths")];
  if (!["gen", "mod", "dec", "duo", "math", "route"].includes(def.cat)) def.cat = "gen";
  def.custom = true;
  return def;
}

function bindingType(gnode, b) {
  const inner = gnode.data.nodes.find((n) => n.id === b.nodeId);
  if (!inner) return "paths";
  const pins = defIns(inner);
  return (pins[b.port] && pins[b.port].type) || "value";
}
function groupOutType(gnode) {
  const inner = gnode.data.nodes.find((n) => n.id === gnode.data.outputId);
  if (!inner) return "paths";
  const outs = defOuts(inner);
  return (outs[0] && outs[0].type) || "paths";
}
function defIns(node) {
  const def = DEFS[node.type];
  if (!def) return [];
  return typeof def.ins === "function" ? def.ins(node) : def.ins || [];
}
function defOuts(node) {
  const def = DEFS[node.type];
  if (!def) return [];
  return typeof def.outs === "function" ? def.outs(node) : def.outs || [];
}
function numericParams(node) {
  const def = DEFS[node.type];
  if (!def) return [];
  return def.params.filter((p) => p.type === "slider" || p.type === "number" || p.type === "seed");
}

/* ============================================================
   SUORITUS
   ============================================================ */
function defaultFor(type) {
  if (type === "value") return 0;
  if (type === "style") return SOLID_STYLE;
  return EMPTY;
}
function evalLevel(level, ctx, boundIns) {
  const byId = Object.fromEntries(level.nodes.map((n) => [n.id, n]));
  const cache = {}, visiting = new Set(), pvals = {};
  function outsOf(id) {
    if (cache[id]) return cache[id];
    const node = byId[id];
    if (!node) return [EMPTY];
    const outSpec = defOuts(node);
    if (visiting.has(id)) return outSpec.map((o) => defaultFor(o.type));
    visiting.add(id);
    const merged = { ...node.params };
    for (const np of numericParams(node)) {
      const e = level.edges.find((ed) => ed.to === id && ed.toPort === "p:" + np.key);
      if (e) {
        const v = (outsOf(e.from) || [])[e.fromPort || 0];
        if (typeof v === "number" && isFinite(v)) merged[np.key] = v;
      }
    }
    pvals[id] = merged;
    const pins = defIns(node);
    const ins = pins.map((pin, port) => {
      const e = level.edges.find((ed) => ed.to === id && ed.toPort === port);
      if (e) return (outsOf(e.from) || [])[e.fromPort || 0];
      if (level.bindings && boundIns) {
        const bi = level.bindings.findIndex((b) => b.nodeId === id && b.port === port);
        if (bi >= 0 && boundIns[bi] !== undefined) return boundIns[bi];
      }
      return undefined;
    });
    visiting.delete(id);
    let outs;
    try {
      if (node.type === "group") {
        const inner = evalLevel(node.data, ctx, ins);
        outs = [inner.out[node.data.outputId] ? inner.out[node.data.outputId][0] : EMPTY];
      } else {
        const r = DEFS[node.type].compute(ins, merged, ctx, node);
        outs = outSpec.length > 1 ? (Array.isArray(r) ? r : [r]) : [r];
      }
    } catch (err) {
      outs = outSpec.map((o) => defaultFor(o.type));
    }
    outs = outs.map((o) => {
      if (o && o.paths) {
        let total = 0;
        for (const p of o.paths) total += p.pts.length;
        if (total > 120000) return { paths: o.paths.slice(0, Math.floor((o.paths.length * 120000) / total)) };
      }
      return o;
    });
    cache[id] = outs;
    return outs;
  }
  const out = {};
  for (const n of level.nodes) out[n.id] = outsOf(n.id);
  return { out, pvals };
}

/* ============================================================
   G-CODE — raaka, suunta-tietoinen, pyöritys + kasto
   ============================================================ */
/* Node help texts — generated from MUUSIA-NODES.md. Custom imported nodes
   can override with a def-level desc field. */
const NODE_HELP = {
  aaltoilu: "sinusoidal displacement along/across paths.",
  adsr: "a multi-segment envelope for t: attack, decay, sustain level and release as fractions of the loop. Starts and ends at zero, ideal for animations that appear, hold, and fade.",
  align: "snaps the content bounding box left/centre/right and top/middle/bottom within margins.",
  array: "grid/linear repetition of the input with per-copy deltas.",
  arvo: "A constant number you can wire into any numeric parameter (green ports). Useful for driving several parameters from one place, or as a labelled control for a patch.",
  asteroids: "vector-game asteroids: irregular polygons with in/out spikes (the classic silhouette), plus an optional player ship (triangle) and stray bullets. Jaggedness and vertex count shape the rocks.",
  attractor: "Clifford / De Jong maps or a Lorenz x-z projection iterated thousands of times, fitted to the sheet. Polyline mode gives one chaotic thread, Dashes the classic attractor dust (capped for the pen).",
  barcode: "vertical bars of varying width filled with boustrophedon strokes; a stark rhythm generator (feed it to Stretch).",
  bitcrush: "sample-rate and bit-depth reduction: coarse resampling makes paths angular, grid quantization snaps coordinates. Consecutive duplicate points are removed.",
  cables: "tangled wires: inertia-driven noise walks with soft edge steering. *Edges* layout (cables enter and leave) or *Pile*; optional pen per cable.",
  cagewarp: "a seeded 2-6-cell FFD lattice bends everything smoothly; Pin edges keeps the canvas border still. Output clamped to the sheet.",
  carve: "parametric window t0..t1 of every path by arc length, with interpolated cut points. Wire Frame t into End t for a write-on animation; Invert keeps the complement, wrapping correctly on closed paths.",
  caustics: "top-down shallow-water light caustics: the surface is a sum of crossing noise wave trains, brightness is its curvature (Laplacian), and the bright focus ridges are traced as marching-squares iso-contours stitched into flowing threads. Focus gain, brightness threshold, contour bands, ripple scale, depth stretch, minimum line length.",
  cellular_mosaic: "assigns points to lattice cells, splits paths at cell borders and displaces each fragment by its cell's seeded offset; optional sub-lattice quantize snap for a crystalline look. Duplicate points cleaned.",
  chop: "cuts paths into arc-length pieces (length \u00b1 variation, optional physical gap) and deals the pieces across 1\u20136 pens, cycling or randomly. Multi-colour within a single stroke.",
  circpack: "non-overlapping circles grown by rejection sampling; size range and optional noise-weighted density.",
  clouds: "realistic clouds by type (not cartoon lobes): outlines are noise-modulated so edges are billowy but not jagged. *Cumulus* (puffy, flat-based), *Stratus* (low layered fog band with internal striations), *Cirrus* (thin feathery spine + fallstreak wisps, no solid outline), *Cumulonimbus* (towering storm body + spreading anvil + rain streaks), *Altocumulus* (\"sheep\" \u2014 a regular patch field). Shading a",
  coil: "replaces the line with a trochoid: overlapping loops when pitch < 2\u03c0r (cursive eee / phone cord), stretched waves otherwise; constant loop density thanks to arc-length sampling.",
  concrete: "text as image, using the built-in single-stroke font. Layouts: *Fill region* (repeating text rows clipped glyph-by-glyph to any closed shape wired into the Region input \u2014 a poem in the shape of anything), *Spiral* (text winds inward along an Archimedean spiral, letters rotated to the tangent), *Wave* (undulating baselines, letters lean with the slope), *Scatter words* (seeded dada scatter with siz",
  conway: "Game of Life replayed deterministically from a seeded board for N generations per compute; wire a value into Generations to animate growth. Live cells drawn as squares, dots or diamonds, with optional edge wrap.",
  copypoints: "instances the Motif input onto the Points input's path points (resampled at a spacing, or raw vertices): per-copy scale and rotation jitter, tangent-aligned or random rotation, keep probability, point budget.",
  crop: "clips to a rectangle (keep inside or outside), with bisection-accurate boundary points; fully-inside closed paths stay closed. Guide overlay.",
  cull: "drop paths by criterion: Random keep-probability (seeded), Every Nth, or Shorter/Longer than a length, with Invert.",
  cycloidm: "simulation of the classic wooden drawing machine: two cranks, two linkage rods, the pen at the rods' circle-intersection, paper on a slowly rotating table. Continuity-safe branch selection; auto-fits to canvas.",
  dazzle: "WWI razzle-dazzle: recursive straight-chord splits carve the sheet into convex patches; each patch gets hatching at a quantized clashing angle (never repeating its neighbor), with blank, cross-hatch and wavy patch styles, and optional bold outlines. Serpentine stripe order.",
  delaunay: "triangulation of input path points (resampled or raw vertices) or seeded random sites; the dual of Voronoi. Shared edges emitted once. Feed any artwork in for a low-poly version.",
  diffgrowth: "the classic organic-growth algorithm: a seed circle whose points repel neighbours and split stretched edges until the line fills space like coral. Deterministic (position-hashed chaos); wire Iterations to animate. Heavier at high iteration counts.",
  displaceimg: "a loaded raster (fileImage) displaces paths: darkness pushes along a chosen angle, or the darkness gradient makes lines flow toward tonal edges (emboss). Untouched passthrough when no image is loaded.",
  echo: "1-12 progressive copies where translate, rotate and scale compound per copy; pivot at canvas center or path centroid; optional pen cycling per echo.",
  endcaps: "arrows, dots, circles or ticks at open-path ends (start/end/both), oriented by the path's final direction. Flow Field's missing arrowheads.",
  explosion: "rigid per-shape translation (shapes keep their form). Blast from a point (*Outward/Inward* with distance falloffs) or *Directional* at a fixed angle; effect limited to a circle or rectangle zone, and in rectangle mode movement can be constrained to the horizontal or vertical axis only. Jitter + angular spread keep it organic. Guide overlay with arrows.",
  fabric: "warp and weft lines deformed by one shared displacement field (so the weave stays coherent): *Curtain* folds deepening downward with sag, *Flag* traveling wave, *Silk* pure noise flow; plus fine rumple.",
  fan: "duplicates one value to several outputs with per-output offsets \u2014 one knob driving many parameters.",
  filterpath: "a state-variable audio filter run along each path, x and y as two signals. Lowpass smooths like an analog channel; highpass keeps only the detail re-centered; resonance makes the line ring with decaying oscillation after every feature, because the filter is causal.",
  fit_canvas: "scales and centres content into the margins: contain, stretch, fit-width or fit-height. The \"fix my composition\" node.",
  flow: "streamlines traced through a noise vector field. Scale sets feature size, steps set line length. The classic organic-flow workhorse.",
  fmrose: "FM synthesis as a polar curve: a modulator warps the carrier that shapes the radius. Low index gives rosettes, high index chaotic flowers; rings and twist stack scaled copies.",
  fold: "a wavefolder for geometry: points beyond the window reflect back inside, repeatedly. Gain drives the shape outward before folding, exactly like input gain on a synth wavefolder, multiplying the creases.",
  followlines: "the \"follow the previous stroke\" marker technique: iterative offsets whose distance varies along the length (*Drift*), so bundles pinch into dense ridges and fan into light sheets; *Relax* straightens successive lines. One-sided or both; multiple generated wave bands, or wire any curve as the Spine.",
  fourier: "elliptic Fourier reconstruction of closed shapes from the first K harmonics: K=1 is an ellipse, K=64 the original. Wire a value into Harmonics to morph detail in over an animation; optional epicycle ghost circles.",
  frame: "the animation clock. Outputs: `t 0\u21921` linear ramp (last frame = 1), `frame #` integer, `wave loop` and `ping-pong` (seamless: frame N continues into frame 0). Reads the ANIMATE panel's frame state.",
  fresnel: "lens refraction that resets per concentric zone, exactly like a real Fresnel lens: within each groove the radial mapping is monotonic (no folds), and the groove boundaries produce the characteristic concentric shear discontinuities. Circular or linear (sheet-lens) mode, groove pitch, smooth-lens or prism profile, edge falloff; overlay shows the lens and a few grooves.",
  fur: "short hairs along the path edge: spacing, length \u00b1 jitter, angle jitter, side (left/right/both alternating or random).",
  glitch: "segment displacement/slicing artifacts.",
  glitch_loom: "slices paths at horizontal loom rows and shifts each row by a seeded warp offset (clamped to the sheet); torn ends may spawn frayed threads that drip downward. Pitch, max shift, fray probability and length.",
  granulate: "granular synthesis for paths: the line is chopped into grains that each get jitter, rotation and scale, dissolving geometry into a cloud of its own fragments. Density thins the cloud.",
  gravity_cascade: "a particle per orbit integrated through three seeded gravity wells with softened cores and friction decay: collapsing, wrapping, slingshotting arcs. Paths end at the sheet edge; points are decimated so tight orbits don't crawl.",
  grid: "vertical/horizontal line grid. The plain sheet of paper of generative art; feed it to Warp, Stretch or Lens to bend space itself.",
  group: "a subgraph in a box (created with Cmd+G); double-click to enter.",
  growth: "differential growth: a loop that grows (random edge splits + long-edge splits) while short-range repulsion keeps it self-avoiding and cohesion keeps it smooth \u2014 the organic meander classic. Circle or canvas bounds (guide overlay), optional history rings every N iterations for the nested look. Point-capped.",
  hairs: "area fill of short curved hairs. Direction: noise flow / fixed angle / radial; curl with random handedness; gravity droop. Optional **Region input**: wire closed shapes (Text outlines, silhouettes) and hairs grow only inside (even-odd).",
  halftone: "dot/pattern shading driven by a noise field.",
  harmonograph: "the classic twin-pendulum drawing machine: two damped oscillators per axis trace one continuous stroke that spirals inward as it dies. Near-integer frequency ratios plus a small detune give the iconic almost-closing loops.",
  hatch: "fills closed shapes with hatching (angle, spacing, inset from both edges with parity checking); *Outside* region mode inverts via a synthetic frame ring.",
  hersheytext: "single-stroke plotter typography: built-in geometric uppercase font (A\u2013Z 0\u20139 **\u00c4\u00d6\u00c5** punctuation), `|` for new lines, size = cap height, tracking, line height, alignment, canvas centring. Every letter is pen strokes, not outlines.",
  hyperbolic_truchet: "Truchet tiles on concentric rings: arcs join edge midpoints so strands continue seamlessly across cells (the original corner-diagonal style remains as an option). Ring-crowding slider packs rings toward the center (event-horizon look) or the rim.",
  image: "raster import (PNG/JPG, downsampled to grayscale). Render modes: *Scanline wave* (darkness raises amplitude and frequency of horizontal waves), *Halftone dots*, *Hatch levels* (four cross-hatch passes gated by darkness), and *Flow shade* (noise streamlines seeded and lengthened by darkness). Gamma, invert, white cutoff.",
  interference: "marching-squares contour lines over fBm terrain or wave interference; segments are chained into long polylines.",
  jitter: "per-point random displacement (densifies first).",
  joinends: "connects nearby path endpoints into longer polylines (distance \u00d7 angle scoring, rounds of batch pairing, optional same-pen-only). Run before export to reduce pen lifts.",
  julia: "escape-time fractal contours of the Julia or Mandelbrot set, banded by normalized iteration count. The c-parameters accept value wires, so an LFO turns the fractal into a living, loop-seamless organism.",
  kaleidoscope: "clips the source to one wedge around the canvas center and replicates it N times, mirroring alternate copies. A mandala from anything.",
  kierto: "rotates content around a point.",
  lace: "classic lace in three patterns: *Doily* (center flower, ring bands with seed-picked motifs \u2014 plain/double rings, zigzag diamond mesh, sector fans, picot loops \u2014 and a scalloped picot edge), *Edging* (header lines, mesh strip, scallops with fans and picots), *Mesh ground* (torchon diamond net with hashed spiders). Sectors, rings, detail, picots on/off, edging depth.",
  lathe: "revolved profile rendered as stacked ellipses (\"Rings\"), a mirrored silhouette (\"Profile\"), or both. Shed shapes: *Skirt* (the ceramic high-voltage insulator default), round wave, sharp zigzag; view tilt; ends taper automatically.",
  lens: "bulge/pinch distortion inside a circle (guide overlay).",
  lfo: "a value oscillator for animation: Sine / Triangle / Saw / Square / Noise loop, an integer number of cycles per loop (so wired Frame t stays loop-seamless), phase, and min/max output range.",
  lissajous: "x/y sinusoids with frequency ratio and phase; the *damping* parameter turns it into a harmonograph decay spiral.",
  lsystem: "turtle-graphics rewriting systems. Presets (plant, Koch, dragon, Sierpinski, Lightning with midpoint displacement) plus editable rules, angle jitter and stochastic rule choice.",
  macrame: "knotted cordwork: top bar with lark's-head loops, vertical cords pinching into square knots (oval + wrap line), seeded wiggly fringe. Patterns: *Alternating net*, *Diamonds* (knots travel edge-to-center), *Sinnet columns*. Cords, rows, knot size, fringe length and wiggle.",
  magnet: "attracts/repels points within a radius (guide overlay).",
  mask: "clips paths by closed mask shapes (keep inside/outside).",
  matem: "A op B: + \u2212 \u00d7 \u00f7 min max pow mod; inputs override the sliders.",
  mathknot: "mathematical decorative knots: *Torus p\u00b7q* (2\u00b73 trefoil, 2\u00b75 cinquefoil\u2026) and *Lissajous* (three frequencies, seeded phases). Crossing gap cuts the under strand at every planar self-intersection using the 3-D z-order, producing a true over-under weave; gap 0 draws the unbroken curve. Tube ratio, rotation, sample step.",
  merge: "combines up to several path inputs; later inputs plot later.",
  mesh: "jittered structural grid with selectable diagonals (none, \\\\, /, alternating, random) \u2014 truss look (compare Fabric/Net for cloth).",
  metaballs: "a blob field (sum of r\u00b2/d\u00b2) contoured with marching squares into 1-5 nested iso-bands; segments are stitched into closed organic loops that merge where blobs meet.",
  mirror8: "reflection orbits around a movable centre: left-right, up-down, quad (4), or full 8-way D4 (cardinal + diagonal). Axes shown as guides. Mirrored copies honestly reverse stroke direction.",
  mountains: "fBm heightfield rendered as ridge lines with true hidden-line removal (screen-space horizon buffer). Perspective (rows converge and compress with depth), oblique skew, island edge-fade, optional cross-line mesh.",
  move_scale: "translate + scale (X/Y separable) around content centre, canvas centre, or a custom point.",
  murmuration: "a closed-form starling flock: every bird is a deterministic function of (time, index) \u2014 flock center follows a guide path, the flock breathes (pulse), swirls and stretches along travel. All time terms are sampled on a circle, so t=0 \u2261 t=1: wire Frame's *t* into Time for a seamless loop. Flock paths: Wander / Oval / Figure-8 / Lissajous 2:3 / Trefoil, with a wander-mix for organic drift. Bird shape",
  myco_net: "hyphal growth: queued tips step through noise-steered incremental turns and split into binary branches at a seeded rate; edge and point budgets end strands. Spore count, growth cycles, split rate, wander, internode, spawn radius.",
  net: "netting with selectable mesh: Diamond (fishing net), Square, Triangle, Hexagon (chicken wire, drawn without doubled edges). Whole net sags like it hangs; irregularity jitters the knots; strands are subdivided so they bend smoothly.",
  occlude: "hidden-line removal. Wire closed shapes into the Occluders input to hide the Lines input behind them, or leave it unwired for painter mode where later closed shapes in the set hide earlier paths. Gap grows (+) or shrinks (-) the occlusion region so lines die cleanly before an edge.",
  offset: "parallel copies at a distance, with *Clean corners* cusp removal.",
  origami: "crease-pattern style folded-paper facets.",
  origami_glitch_fold: "mirrors everything on one side of an adjustable fold line back across it, with a distance-proportional crease warp; optional Keep Original for layered folds. Output clamped to the sheet.",
  outline: "encloses each stroke in a closed capsule (offset both sides + semicircle caps); closed paths become two-ring bands. Turns strokes into fillable shapes: Outline \u2192 Hatch Fill = fat filled lines.",
  panelka: "brutalist Soviet panel block: floors \u00d7 sections (stairwells), panel seams every floor/section, windows (some lit with diagonals), balconies (none / alternating columns / all) with railing lines, doors with canopies, roof machine room and antennas, and an optional oblique side face with its own seams and end windows.",
  pencycle: "assigns pens to whole paths in rotation.",
  pendulum: "chained damped oscillator arms (1\u20133). Each arm's pivot rides the previous tip; *Coupling* modulates an arm's frequency by the previous arm's angle (real interaction: 0 = pure epicycles, high = chaos); rotating table; exponential damping. One continuous stroke.",
  phyllo: "sunflower-seed spiral (golden angle); dot size can grow with index.",
  planets: "a chosen solar-system body drawn as line art: Sun (corona spikes + spots), Mercury/Moon (craters), Venus/Jupiter/Saturn/Uranus/Neptune (latitude bands, Jupiter's Great Red Spot, Neptune's dark spot), Earth (continent blobs + polar cap), Mars (craters, bands, ice cap). Rings for Saturn/Uranus, optional shadow terminator for a crescent.",
  potato: "asymmetric blobs (low-frequency harmonics + random squash) with light overlap avoidance; optional \"eyes\" texture as dots or curved arcs.",
  radat: "concentric rings (athletics-track offsets) around a centre. Ring count, spacing, start radius.",
  randlines: "Moln\u00e1r-style random segments: free endpoints or fixed length with angle constraints (any / H+V / diagonals / 45\u00b0 quantized).",
  reactdiff: "Gray-Scott Turing patterns (spots, stripes, mazes) replayed deterministically from seeded spots; contours traced with marching squares. Wire a value into Iterations to grow the pattern. Heavier compute.",
  regmarks: "registration marks in selectable corners (+ optional centre): cross, printer's circle-and-cross, or inward corner-L; adjustable insets. For multi-pen registration and scan alignment.",
  reititys: "legacy in-graph route optimizer (hidden from the palette; routing now lives in the export panel as *Optimize route* + *Preserve direction*).",
  reverse: "flips path direction: all, every 2nd (manual boustrophedon), or random. Because direction is data.",
  ribbon: "a wandering backbone with parallel companion lines (1\u201360). At lines = 1 it is a clean single guide curve \u2014 a good Spine for Ruler or Follow Lines.",
  ruler: "tick scales with a minor/medium/major hierarchy. Linear or logarithmic (slide-rule) spacing; numbers (built-in single-stroke font) or cycling symbols at majors; ticks up/down/both. Optional **Spine input**: the ruler follows any path \u2014 feed a Ribbon or Tracks ring to get curved measuring tape.",
  sand_line_hatch: "broken multi-segment scanlines whose ink probability is noise \u00d7 density, producing grain-gradient fields; runs collapse to 2-point segments and lines alternate direction (serpentine).",
  satunnainen: "a seeded random number in a range; re-rolls per seed, not per frame.",
  scan: "medical & scientific imaging aesthetics, drawn as procedural specimens: *X-ray* (ribcage: vertebra stack, double-line rib arcs, clavicles), *CT slice* (skin/fat rings, organ blobs \u2014 one hatch-filled, vertebra with beam star, R/L markers), *MRI head* (the iconic sagittal: face profile, skull, gyri meanders inside the brain ellipse, cerebellum folds, brainstem), *Ultrasound* (sector beam, noise-gate",
  scatter: "breaks paths into displaced fragments.",
  shaper: "easing curves for t: Linear, Smoothstep, Ease in/out/in-out, Bounce, Reverse, Triangle, with an integer repeat. End-inclusive: t=1 maps to the end of the curve, so a Frame-driven write-on never snaps back on its final frame; use Triangle for seamless loops.",
  simplify: "removes points within a tolerance (Douglas-Peucker-style).",
  skew: "X/Y shear in degrees (italicise Text, axonometry from Grid).",
  skyline: "horizon silhouettes in 1\u20134 receding layers. *Forest*: fBm hills with conifer-spike tops and optional trunk texture; *City*: stepped building skyline with height distribution, antennas and window dashes (some dark). Shares its Horizon Y convention with Water.",
  smooth: "corner-rounding relaxation.",
  solar: "the whole system in one node: pick which planets to include (checkbox list), each on its orbit (tilted ellipse) at a phase angle, with major moons on their own sub-orbits \u2014 orbit paths, moons and moon-orbits each toggle independently. Even or log-ish spacing, view tilt, planet-size multiplier; Saturn/ Uranus get rings. Orbits and planets can go on separate pens.",
  solids: "wireframe 3-D: Sphere (lat/lon rings; *Solid* hides the back hemisphere, *Transparent* shows all), Cube, Tetra/Octa/Icosa/Dodecahedron (edges derived from geometry). Rotate X/Y/Z, perspective 0\u20131, position. Rotations are value-drivable \u2014 the animation star.",
  spiro: "hypo/epitrochoid gear curves: ring/wheel teeth ratio and pen offset.",
  split: "separates paths into multiple outputs by rule (e.g. layer, index).",
  stamp: "repeats a motif (or built-in marks; Line + Perpendicular = railway sleepers) along paths, with per-path variation. Takes a Motif input.",
  starfield: "stars (uniform or noise-clustered, size variation) plus connection modes: none, all pairs within a distance, k-nearest, or *Constellations* (chained 3\u20139-star figures). Separate star and line pens.",
  stencil: "pick ONE closed region from the Regions input (index wraps, so the slider steps next/previous \u2014 or wire Steps to animate the selection) and clip the Content input inside it, with an edge inset. All-regions mode, outline preview, and browse mode when Content is unwired.",
  steps: "quantized step sequencer: t is split into N steps patterned as Ramp up/down, Ping-pong or seeded Random, scaled to min/max.",
  stone: "faceted rocks/boulders: irregular polygon outline with interior facet lines from a highlight point (3-D chunk look) and optional hatch shadow (own pen). Layouts: Scatter, Pile (gravity-stacked), Wall (grid \u2014 dry-stone look). Angularity from smooth pebble to sharp shard.",
  stretch: "monotonic band remap: geometry entering the band stretches uniformly along it and everything beyond shifts by the amount \u2014 no folds, straight smears. Directional or vanishing-point perspective mode; edge falloff shapes; per-path jitter. The pixel-smear effect, done right. Guide overlay.",
  stringpluck: "a plucked string rendered as stacked time frames: modal sum with e^(-d k^2 t) damping, so high harmonics die first and the stack smooths downward, exactly like a real string. Serpentine rows for plotting.",
  superformula: "the Gielis superformula: one equation spanning stars, flowers, polygons and diatoms via m/n1/n2/n3. Rings with twist fill the shape concentrically.",
  svgimport: "load an SVG file's paths onto the canvas (no text/CSS support).",
  switch: "a selector gate: the Select value picks which of the wired path inputs passes through; unwired inputs are skipped and the index wraps. Wire Steps into Select for per-frame scene switching.",
  symmetry: "mirror/radial kaleidoscope repetition.",
  tangle: "melts geometry into wandering tangle inside a zone, anchored at the zone edge (guide overlay).",
  tape_saturation: "parallel sinusoidal signal tracks hard-clipped at a saturation threshold, with low-frequency wow drift and fine flutter noise; clamped to the sheet, serpentine track order. Moir\u00e9-ribbon fields.",
  testcard: "a pen-characterization sheet. Select any of eight tiles (checkbox list) laid out in a grid: *Line weight sweep* (1\\u00D7\\u20136\\u00D7 overdraw to see darkening and registration), *Line spacing* (converging lines to find where they merge / effective pen width), *Hatch density* (four fill densities + crosshatch), *Arcs & circles* (roundness and stepping), *Pen-lift dots* (an 8\\u00D78 grid of tiny cr",
  textpath: "single-stroke text laid along a wired spine (same font as Text): each glyph sits at its arc-length position rotated to the local tangent. Align Start/Center/End, start offset %, baseline offset along the normal, Flip side, Repeat-to-fill with gap, curve sampling. Open and closed spines; falls back to a horizontal line when unwired.",
  tiles: "grid of tiles, each a separate closed path. Shapes: parametric",
  tileshuffle: "the canvas is cut into a grid and tiles are permuted with optional flips/180s (bounds-safe). Cuts at tile borders are exact, so no ink is lost at the seams. Amount selects how many tiles join the shuffle.",
  topolar: "cartesian-to-polar remap: x becomes angle, y becomes radius, bending any horizontal composition into rings, discs or fans. Turns, start angle and inner radius shape the wrap.",
  traceimg: "threshold contours of a loaded raster image (fileImage): 1-6 tonal levels traced as vector contours fitted to the margin box, with invert and a minimum-contour filter for specks.",
  travelsort: "greedy nearest-neighbour reordering of the plot: open paths may be reversed, closed loops are entered at the vertex nearest the pen, and pen groups stay intact. Same geometry, drastically less pen-up travel; place last before export.",
  travelstop: "inserts a pause or pen-change after a set distance of drawing, for wearing/refilling media (chalk, charcoal, dip/fountain pens). Every N mm of drawn length it tags the next path so the G-code lifts and pauses (M0) with your message (\"Advance chalk / refill\"), or treats it as a pen change. Unlike the machine profile's Maintenance pause (which is fixed per machine), this lives in the graph and trave",
  trimext: "shortens or lengthens path ends.",
  truchet: "tiled quarter-circle patterns. *Tiles* mode draws arc tiles (lines/spread/gap per tile); *Loop* mode grows a spanning tree and emits **one single closed line** that fills the canvas \u2014 a maze you can plot without lifting the pen.",
  trunks: "birch trunks only, no branches: two wandering edge lines per trunk. Smoothness (edge waver), lean, upward taper, and *Artifacts*: horizontal bark dashes (some doubled), on their own pen if desired.",
  tvnoise: "analog-TV static: cells randomly filled with square/circle pixels or horizontal *scanline dashes*; size/position jitter and rolling *interference bands* that modulate density row-wise. Budget-capped.",
  tyylita: "applies a Stroke style to existing paths.",
  viiva: "not geometry: produces a *style* (dash patterns etc.) for generators' Style inputs.",
  voronoi: "seeded sites carved into cells by half-plane clipping, with optional Lloyd relaxation (0-3) for even cell sizes. Shared edges are emitted exactly once, so no line is drawn twice. Optional site crosses.",
  warp: "4-corner perspective or full lattice grid deformation.",
  water: "lake/sea surface: ripple rows compressed toward a horizon (perspective), wave + slower swell + noise, and *Choppiness* that breaks lines into glinting dashes via a noise gate.",
  wood: "tree cross-section: growth rings with year-width variation grouped by slow noise, shared angular wobble (rings never cross), eccentric reaction-wood stretch, radial drying cracks, rough bark, pith. *Grain* mode instead renders the split-face cathedral flame arches with vertical checks.",
  worm: "worm or centipede: an inertia-walk spine dressed in flattened cross-hoops with a tapered width profile (round head, pointed tail). *Centipede* adds two-joint leg pairs with alternating gait; optional antennae.",
};

const APP_VERSION = "1.8"; /* single source: shown in the UI header and stamped into G-code */

function toGcode(ps, ctx, prof) {
  const f2 = (v) => Math.round(v * 100) / 100;
  const oX = prof.originX || 0, oY = prof.originY || 0;
  const fx = (x) => x + oX;
  const fy = (y) => (prof.flipY ? ctx.H - y : y) + oY;
  const lines = [];
  lines.push(`; Muusia v${APP_VERSION} — raw G-code`);
  lines.push(`; Machine: ${prof.name || "unnamed"} — work area ${prof.workW} x ${prof.workH} mm`);
  lines.push(`; Canvas ${ctx.W} x ${ctx.H} mm at origin X${oX} Y${oY} — paths ${ps.paths.length}${prof.flipY ? " — Y flipped" : ""}`);
  if (oX < 0 || oY < 0 || oX + ctx.W > prof.workW || oY + ctx.H > prof.workH) lines.push("; WARNING: canvas (with origin) exceeds machine work area!");
  /* piirtoajan arvio */
  {
    let draw = 0, travel = 0, lx = 0, ly = 0;
    for (const pa of ps.paths) {
      if (pa.pts.length < 2) continue;
      travel += Math.hypot(pa.pts[0][0] - lx, pa.pts[0][1] - ly);
      draw += pathLength(pa.pts, pa.closed);
      const lastP = pa.closed ? pa.pts[0] : pa.pts[pa.pts.length - 1];
      lx = lastP[0]; ly = lastP[1];
    }
    const mins = draw / Math.max(1, prof.feedDraw) + travel / Math.max(1, prof.feedTravel);
    lines.push(`; Draw ${(draw / 1000).toFixed(2)} m, travel ${(travel / 1000).toFixed(2)} m — est. ${Math.ceil(mins)} min (+ pen lifts & pauses)`);
  }
  if (prof.rotOn) lines.push(`; Brush rotation: ${prof.rotStepper}, threshold ${prof.rotThresh}°`);
  if (prof.dipOn) lines.push(`; Dip: X${prof.dipX} Y${prof.dipY}, every ${prof.dipEvery} mm`);
  if ((prof.zMode || "bed") === "servo") lines.push(`; Z mode: SERVO "${prof.servoName || "pen"}" — up ${prof.servoUp}° / down ${prof.servoDown}° (bed-Z untouched)`);
  else if (prof.zHopOn) lines.push(`; Z-hop travel lift: ${f2(prof.penDown + prof.zHop)} mm (saves bed-Z time)`);
  if (prof.maintOn) lines.push(`; Maintenance pause every ${prof.maintEvery} mm: "${prof.maintMsg}"`);
  if (ps.paths.some((p) => p.__stop)) lines.push(`; Travel Stop markers present \u2014 place Travel Stop LAST and keep route optimize off for accurate spacing`);
  lines.push(`; Pen settle: down ${prof.penDelayDown}ms / up ${prof.penDelayUp}ms`);
  for (const l of String(prof.startG || "").split("\n")) if (l.trim()) lines.push(l);
  /* nostotaso siirroille: matala z-hop jos paalla, muuten taysi penUp.
     petiplotterille z-hop saastaa valtavasti aikaa kun ei nosteta koko matkaa. */
  const zServo = (prof.zMode || "bed") === "servo";
  const travelZ = () => (prof.zHopOn ? f2(Math.min(prof.penUp, prof.penDown + prof.zHop)) : f2(prof.penUp));
  /* servomoodi (profiili A): kynan nosto servolla, peti-Z jaa rauhaan */
  const servoTo = (ang, note) => {
    lines.push(`SET_SERVO SERVO=${prof.servoName || "pen"} ANGLE=${f2(ang)}${note ? ` ; ${note}` : ""}`);
  };
  const penUpFull = () => {
    if (zServo) servoTo(prof.servoUp, "pen up");
    else lines.push(`G1 Z${f2(prof.penUp)} F${prof.zFeed}`);
    if (prof.penDelayUp > 0) lines.push(`G4 P${Math.round(prof.penDelayUp)} ; settle after lift`);
  };
  const penUpTravel = () => {
    if (zServo) servoTo(prof.servoUp);
    else lines.push(`G1 Z${travelZ()} F${prof.zFeed}`);
    if (prof.penDelayUp > 0) lines.push(`G4 P${Math.round(prof.penDelayUp)} ; settle`);
  };
  const penDownContact = () => {
    if (zServo) servoTo(prof.servoDown, "pen down");
    else lines.push(`G1 Z${f2(prof.penDown)} F${prof.zFeed}`);
    if (prof.penDelayDown > 0) lines.push(`G4 P${Math.round(prof.penDelayDown)} ; settle before draw`);
  };
  if (zServo) servoTo(prof.servoUp, "pen up (servo)");
  else lines.push(`G1 Z${f2(prof.penUp)} F${prof.zFeed} ; pen up (bed-Z)`);

  let rotCur = null;
  const rot = (angDeg, note) => {
    if (!prof.rotOn) return;
    let a = angDeg;
    if (rotCur !== null) {
      while (a - rotCur > 180) a -= 360;
      while (a - rotCur < -180) a += 360;
    }
    rotCur = a;
    lines.push(`MANUAL_STEPPER STEPPER=${prof.rotStepper} MOVE=${f2(a)} SPEED=30 ; ${note}`);
  };
  const dip = () => {
    lines.push("; --- dip ---");
    if (zServo) servoTo(prof.servoUp);
    else lines.push(`G1 Z${prof.penUp} F${prof.zFeed}`);
    lines.push(`G0 X${f2(prof.dipX)} Y${f2(prof.dipY)} F${prof.feedTravel}`);
    if (zServo) servoTo(prof.servoDown, "plunge");
    else lines.push(`G1 Z${f2(prof.dipZ)} F${prof.zFeed} ; plunge`);
    lines.push(`G4 P${Math.round(prof.dipDwell)} ; dwell ms`);
    if (zServo) servoTo(prof.servoUp);
    else lines.push(`G1 Z${prof.penUp} F${prof.zFeed}`);
    lines.push("; --- dip done ---");
  };
  /* maintenance pause: kuluvalle medialle (liitu/hiili). nostaa kynan, valinnaisesti
     ajaa huoltoasemaan, pysayttaa custom-viestilla liidun siirtoa/terotusta varten.
     jos ei parkkia, kone jaa paikalleen -> kohdistus sailyy taydellisesti. */
  const maint = () => {
    lines.push("; --- maintenance pause ---");
    penUpFull();
    if (prof.maintPark) {
      lines.push(`SAVE_GCODE_STATE NAME=maint ; remember position`);
      lines.push(`G0 X${f2(prof.maintX)} Y${f2(prof.maintY)} F${prof.feedTravel}`);
    }
    lines.push(`${prof.pauseCmd || "M0"} ; MAINTENANCE: ${prof.maintMsg || "service tool"}`);
    if (prof.maintPark) lines.push(`RESTORE_GCODE_STATE NAME=maint MOVE=1 ; return to work`);
    lines.push("; --- resume ---");
  };

  const layers = [...new Set(ps.paths.map((p) => p.layer))].sort((a, b) => a - b);
  let first = true;
  let drawn = 0;
  let maintDrawn = 0;
  if (prof.dipOn) dip();

  for (const L of layers) {
    if (!first) {
      penUpFull();
      lines.push(`${prof.pauseCmd || "M0"} ; CHANGE PEN -> ${PENS[L % PENS.length].name}`);
      if (prof.dipOn) { dip(); drawn = 0; }
    } else lines.push(`; Pen: ${PENS[L % PENS.length].name}`);
    first = false;

    for (const path of ps.paths.filter((p) => p.layer === L)) {
      let pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
      if (pts.length < 2) continue;
      pts = pts.map(([x, y]) => [x, fy(y)]);

      if (prof.dipOn && drawn >= prof.dipEvery) { dip(); drawn = 0; }
      if (prof.maintOn && maintDrawn >= prof.maintEvery) { maint(); maintDrawn = 0; }
      /* Travel Stop -node: polkuun merkitty stop -> nosto + tauko/kynanvaihto ennen sita */
      if (path.__stop) {
        penUpFull();
        if (path.__stop.mode === "Pen change") {
          lines.push(`${prof.pauseCmd || "M0"} ; TRAVEL STOP \u2014 PEN CHANGE: ${path.__stop.msg || ""}`);
        } else {
          lines.push(`${prof.pauseCmd || "M0"} ; TRAVEL STOP: ${path.__stop.msg || "service"}`);
        }
      }

      const ang0 = (Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) * 180) / Math.PI;
      lines.push(`G0 X${f2(fx(pts[0][0]))} Y${f2(pts[0][1])} F${prof.feedTravel}`);
      rot(ang0, "align to path start");
      penDownContact();
      let lastAng = ang0;
      for (let i = 1; i < pts.length; i++) {
        if (prof.rotOn && i < pts.length - 1) {
          const a = (Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) * 180) / Math.PI;
          let dA = a - lastAng;
          while (dA > 180) dA -= 360;
          while (dA < -180) dA += 360;
          if (Math.abs(dA) >= prof.rotThresh) {
            lines.push(`G1 X${f2(fx(pts[i][0]))} Y${f2(pts[i][1])} F${prof.feedDraw}`);
            const _seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            drawn += _seg; maintDrawn += _seg;
            rot(a, "direction change");
            lastAng = a;
            continue;
          }
        }
        lines.push(`G1 X${f2(fx(pts[i][0]))} Y${f2(pts[i][1])} F${prof.feedDraw}`);
        drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      }
      penUpTravel();
    }
  }
  penUpFull();
  for (const l of String(prof.endG || "").split("\n")) if (l.trim()) lines.push(l);
  lines.push("; done");
  return lines.join("\n");
}

/* ============================================================
   SVG EXPORT — layerit ryhminä, kynävärit, mm-yksiköt
   ============================================================ */
function toSVG(ps, ctx) {
  const f2 = (v) => Math.round(v * 100) / 100;
  const layers = [...new Set(ps.paths.map((p) => p.layer))].sort((a, b) => a - b);
  const groups = layers.map((L) => {
    const pen = PENS[L % PENS.length];
    const d = ps.paths
      .filter((p) => p.layer === L)
      .map((p) => {
        if (p.pts.length < 2) return "";
        return "M" + p.pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join("L") + (p.closed ? "Z" : "");
      })
      .filter(Boolean)
      .map((dd) => `    <path d="${dd}"/>`)
      .join("\n");
    return `  <g id="pen-${L}-${pen.name.toLowerCase()}" fill="none" stroke="${pen.c}" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">\n${d}\n  </g>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ctx.W}mm" height="${ctx.H}mm" viewBox="0 0 ${ctx.W} ${ctx.H}">`,
    `  <!-- Muusia — ${ps.paths.length} paths, ${ctx.W}x${ctx.H} mm -->`,
    ...groups,
    `</svg>`,
  ].join("\n");
}

/* ============================================================
   REITTISIMULAATTORI — piirtojarjestyksen animaatio
   ============================================================ */
function SimView({ ps, W, H, width, height }) {
  const [pos, setPos] = useState(0);          /* mm ajettua matkaa */
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(60);     /* mm/s */
  const [showTravel, setShowTravel] = useState(true);
  const geo = useMemo(() => {
    let prev = [0, 0];
    let total = 0;
    const items = [];
    for (const pa of ps.paths) {
      const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
      if (pts.length < 2) continue;
      const tLen = Math.hypot(pts[0][0] - prev[0], pts[0][1] - prev[1]);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      }
      items.push({ tFrom: prev, pts, cum, tLen, dLen: cum[cum.length - 1], layer: pa.layer, start: total });
      total += tLen + cum[cum.length - 1];
      prev = pts[pts.length - 1];
    }
    return { items, total: Math.max(1, total) };
  }, [ps]);
  useEffect(() => { setPos(0); setPlay(false); }, [ps]);
  useEffect(() => {
    if (!play) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setPos((p) => {
        const n = p + speed * dt;
        if (n >= geo.total) { setPlay(false); return geo.total; }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, speed, geo.total]);

  const pad = 16;
  const sc = Math.min((width - 2 * pad) / W, (height - 2 * pad) / H);
  const mx = (v) => pad + v * sc, my = (v) => pad + v * sc;
  const els = [];
  let head = null;
  let drawnMM = 0;
  for (let i = 0; i < geo.items.length; i++) {
    const it = geo.items[i];
    const local = pos - it.start;
    if (local <= 0) break;
    const col = PENS[it.layer % PENS.length].c;
    if (local >= it.tLen + it.dLen) {
      /* kokonaan piirretty */
      if (showTravel && it.tLen > 0.01) {
        els.push(<line key={"t" + i} x1={mx(it.tFrom[0])} y1={my(it.tFrom[1])} x2={mx(it.pts[0][0])} y2={my(it.pts[0][1])}
          stroke="#D2483A" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.55} />);
      }
      els.push(<polyline key={"d" + i} points={it.pts.map(([x, y]) => mx(x) + "," + my(y)).join(" ")}
        fill="none" stroke={col} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />);
      drawnMM += it.dLen;
      continue;
    }
    if (local < it.tLen) {
      /* siirtyma kesken */
      const f = it.tLen ? local / it.tLen : 1;
      const hx = it.tFrom[0] + (it.pts[0][0] - it.tFrom[0]) * f;
      const hy = it.tFrom[1] + (it.pts[0][1] - it.tFrom[1]) * f;
      if (showTravel) {
        els.push(<line key={"tp" + i} x1={mx(it.tFrom[0])} y1={my(it.tFrom[1])} x2={mx(hx)} y2={my(hy)}
          stroke="#D2483A" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.55} />);
      }
      head = [hx, hy, true];
    } else {
      /* piirto kesken: binaarihaku kumulatiivisesta */
      if (showTravel && it.tLen > 0.01) {
        els.push(<line key={"t" + i} x1={mx(it.tFrom[0])} y1={my(it.tFrom[1])} x2={mx(it.pts[0][0])} y2={my(it.pts[0][1])}
          stroke="#D2483A" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.55} />);
      }
      const dl = local - it.tLen;
      let lo = 0, hi = it.cum.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (it.cum[mid] <= dl) lo = mid; else hi = mid;
      }
      const segLen = it.cum[hi] - it.cum[lo] || 1;
      const f = (dl - it.cum[lo]) / segLen;
      const hx = it.pts[lo][0] + (it.pts[hi][0] - it.pts[lo][0]) * f;
      const hy = it.pts[lo][1] + (it.pts[hi][1] - it.pts[lo][1]) * f;
      const partial = it.pts.slice(0, lo + 1).concat([[hx, hy]]);
      els.push(<polyline key={"dp" + i} points={partial.map(([x, y]) => mx(x) + "," + my(y)).join(" ")}
        fill="none" stroke={col} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />);
      drawnMM += dl;
      head = [hx, hy, false];
    }
    break;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <svg width={width} height={height} style={{ background: "#F4F1E8", borderRadius: 4, display: "block" }}>
        <rect x={pad} y={pad} width={W * sc} height={H * sc} fill="none" stroke="#D8D2C0" strokeWidth={1} />
        {els}
        {head && <circle cx={mx(head[0])} cy={my(head[1])} r={4} fill={head[2] ? "#D2483A" : "#1B4B9B"} stroke="#fff" strokeWidth={1.5} />}
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: T.dim }}>
        <button onClick={() => setPlay((v) => !v)}
          style={{ background: T.accent, border: "none", color: "#0D1117", borderRadius: 4, fontSize: 11, padding: "4px 14px", cursor: "pointer", fontFamily: mono, fontWeight: 700 }}>
          {play ? "❚❚" : "▶"}
        </button>
        <input type="range" min={0} max={geo.total} step={geo.total / 2000} value={pos}
          onChange={(e) => { setPos(+e.target.value); }}
          style={{ flex: 1, accentColor: T.accent }} />
        <select value={speed} onChange={(e) => setSpeed(+e.target.value)}
          style={{ background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, fontSize: 10, padding: "2px 4px", fontFamily: mono }}>
          {[15, 30, 60, 120, 300, 800].map((s) => <option key={s} value={s}>{s} mm/s</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={showTravel} onChange={(e) => setShowTravel(e.target.checked)} style={{ accentColor: T.accent }} />
          Travel
        </label>
        <div style={{ minWidth: 90, textAlign: "right" }}>{(drawnMM / 1000).toFixed(2)} m</div>
      </div>
    </div>
  );
}

function PathsSVG({ ps, W, H, width, height, arrows = false, pad = 4, guides = null }) {
  const sx = (width - pad * 2) / W, sy = (height - pad * 2) / H;
  const s = Math.min(sx, sy);
  const ox = (width - W * s) / 2, oy = (height - H * s) / 2;
  const els = [];
  (ps.paths || []).forEach((p, i) => {
    if (p.pts.length < 2) return;
    const d = "M" + p.pts.map(([x, y]) => `${(ox + x * s).toFixed(1)},${(oy + y * s).toFixed(1)}`).join("L") + (p.closed ? "Z" : "");
    els.push(
      <path key={i} d={d} fill="none" stroke={PENS[p.layer % PENS.length].c}
        strokeWidth={Math.max(0.7, s * 0.35)} strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />
    );
    if (arrows && p.pts.length > 4) {
      const mid = Math.floor(p.pts.length / 2);
      const a = p.pts[mid - 1], b = p.pts[mid];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const bx = ox + b[0] * s, by = oy + b[1] * s, r = 4;
      els.push(
        <path key={"a" + i}
          d={`M${bx},${by} L${bx - r * Math.cos(ang - 0.45)},${by - r * Math.sin(ang - 0.45)} M${bx},${by} L${bx - r * Math.cos(ang + 0.45)},${by - r * Math.sin(ang + 0.45)}`}
          stroke={PENS[p.layer % PENS.length].c} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      );
    }
  });
  /* apuviivat: nodejen overlay-oppaat (vyohyke, pakopiste, suunta) */
  const G = "#E2574A";
  const gEls = [];
  (guides || []).forEach((g, i) => {
    if (g.kind === "rect") {
      gEls.push(<rect key={"g" + i} x={ox + (g.x) * s} y={oy + (g.y) * s} width={g.w * s} height={g.h * s}
        fill="none" stroke={G} strokeWidth="1.2" strokeDasharray="5 4" opacity="0.85" />);
    } else if (g.kind === "circle") {
      gEls.push(<circle key={"g" + i} cx={ox + g.cx * s} cy={oy + g.cy * s} r={g.r * s}
        fill="none" stroke={G} strokeWidth="1.2" strokeDasharray="5 4" opacity="0.85" />);
    } else if (g.kind === "point") {
      const px = ox + g.x * s, py = oy + g.y * s;
      gEls.push(<g key={"g" + i} stroke={G} strokeWidth="1.2" opacity="0.95">
        <line x1={px - 6} y1={py} x2={px + 6} y2={py} />
        <line x1={px} y1={py - 6} x2={px} y2={py + 6} />
        <circle cx={px} cy={py} r={2.6} fill={G} stroke="none" />
      </g>);
    } else if (g.kind === "poly") {
      const d = "M" + g.pts.map(([x, y]) => `${ox + x * s},${oy + y * s}`).join("L") + "Z";
      gEls.push(<path key={"g" + i} d={d} fill="none" stroke={G} strokeWidth="1.2" strokeDasharray="5 4" opacity="0.85" />);
    } else if (g.kind === "arrow") {
      const x1 = ox + g.x1 * s, y1 = oy + g.y1 * s, x2 = ox + g.x2 * s, y2 = oy + g.y2 * s;
      const ang = Math.atan2(y2 - y1, x2 - x1), r = 7;
      gEls.push(<g key={"g" + i} stroke={G} strokeWidth="1.4" fill="none" opacity="0.95" strokeLinecap="round">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <path d={`M${x2},${y2} L${x2 - r * Math.cos(ang - 0.4)},${y2 - r * Math.sin(ang - 0.4)} M${x2},${y2} L${x2 - r * Math.cos(ang + 0.4)},${y2 - r * Math.sin(ang + 0.4)}`} />
      </g>);
    }
  });
  return (
    <svg width={width} height={height} style={{ display: "block", background: T.paper, borderRadius: 4 }}>
      <rect x={ox} y={oy} width={W * s} height={H * s} fill="none" stroke={T.paperLine} strokeWidth="1" />
      {els}
      {gEls}
    </svg>
  );
}

function OutPreview({ out, W, H, width, arrows }) {
  const v = out ? out[0] : undefined;
  if (v && v.paths) return <PathsSVG ps={v} W={W} H={H} width={width} height={width * (H / W)} arrows={arrows} />;
  if (isStyle(v)) {
    const sample = { paths: [{ pts: Array.from({ length: 80 }, (_, i) => [4 + (i / 79) * 92, 12 + Math.sin(i / 8) * 6]), closed: false, layer: 0 }] };
    const styled = applyStyle(sample, v);
    return <PathsSVG ps={styled} W={100} H={24} width={width} height={Math.max(40, width * 0.24)} />;
  }
  if (out && out.length && out.every((x) => typeof x === "number")) {
    return (
      <div style={{ background: "#12151B", borderRadius: 4, padding: "10px 12px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        {out.map((n, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            {out.length > 1 && <div style={{ fontSize: 8, color: T.dim }}>{i + 1}</div>}
            <div style={{ fontSize: 17, color: T.value, fontVariantNumeric: "tabular-nums" }}>
              {Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <div style={{ background: "#12151B", borderRadius: 4, padding: 12, fontSize: 10, color: T.dim }}>—</div>;
}

/* ============================================================
   PARAMETRI-UI
   ============================================================ */
function NumBox({ value, onChange, width = 52, disabled, min, max }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(typeof value === "number" ? String(Math.round(value * 100) / 100) : String(value)), [value]);
  const commit = () => {
    let v = parseFloat(String(txt).replace(",", "."));
    if (!isNaN(v)) {
      if (typeof min === "number") v = Math.max(min, v);
      if (typeof max === "number") v = Math.min(max, v);
      onChange(v);
      setTxt(String(v));
    } else setTxt(String(value));
  };
  return (
    <input type="text" value={txt} inputMode="decimal" disabled={disabled}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { commit(); e.target.blur(); } }}
      style={{
        width, background: disabled ? "#1A1E27" : T.panel2, color: disabled ? T.value : T.text,
        border: `1px solid ${T.line}`, borderRadius: 3, fontSize: 11, padding: "3px 5px",
        textAlign: "right", fontFamily: "inherit", fontVariantNumeric: "tabular-nums",
      }} />
  );
}

function ParamRow({ def, value, onChange, wired, liveVal, portRef, portProps, onFileText, fileMode, fileLabel, onPromote }) {
  const lbl = { fontSize: 10, color: T.dim, letterSpacing: "0.02em" };
  const dot = portRef ? (
    <div ref={portRef} {...portProps}
      style={{
        position: "absolute", left: -17, top: 4, width: 9, height: 9, borderRadius: "50%",
        background: wired ? T.value : T.bg, border: `2px solid ${T.value}`, cursor: "crosshair", zIndex: 2,
      }} />
  ) : null;
  if (def.type === "slider" || def.type === "number") {
    const shown = wired && typeof liveVal === "number" ? Math.round(liveVal * 100) / 100 : value;
    return (
      <div style={{ marginBottom: 7, position: "relative" }}>
        {dot}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 2, gap: 6 }}>
          <div style={{ ...lbl, flex: 1 }}>
            {def.label}
            {wired && <span style={{ color: T.value, marginLeft: 5 }}>◈</span>}
            {onPromote && (
              <span onClick={onPromote} title="Promote to group face"
                style={{ marginLeft: 6, cursor: "pointer", color: T.dim, fontSize: 11 }}>☆</span>
            )}
          </div>
          <NumBox value={shown} onChange={onChange} disabled={wired} min={def.min} max={def.max} />
        </div>
        <input type="range" min={def.min} max={def.max} step={def.step}
          value={Math.min(def.max, Math.max(def.min, shown))}
          disabled={wired}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: wired ? T.value : T.accent, height: 14, display: "block", opacity: wired ? 0.55 : 1 }} />
      </div>
    );
  }
  const rowS = { display: "flex", alignItems: "center", gap: 6, marginBottom: 6, position: "relative" };
  if (def.type === "select") {
    return (
      <div style={rowS}>
        <div style={{ ...lbl, width: 100, flexShrink: 0 }}>{def.label}</div>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, fontSize: 10, padding: "3px 4px" }}>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (def.type === "multi") {
    const cur = Array.isArray(value) ? value : [];
    const toggle = (o) => onChange(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);
    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ ...lbl, marginBottom: 3 }}>{def.label}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {def.options.map((o) => (
            <label key={o} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.text, cursor: "pointer" }}>
              <input type="checkbox" checked={cur.includes(o)} onChange={() => toggle(o)} style={{ accentColor: T.accent }} />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (def.type === "check") {
    return (
      <div style={rowS}>
        <div style={{ ...lbl, flex: 1 }}>{def.label}</div>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: T.accent }} />
      </div>
    );
  }
  if (def.type === "seed") {
    const shown = wired && typeof liveVal === "number" ? liveVal : value;
    return (
      <div style={rowS}>
        {dot}
        <div style={{ ...lbl, flex: 1 }}>
          {def.label}
          {wired && <span style={{ color: T.value, marginLeft: 5 }}>◈</span>}
        </div>
        <NumBox value={shown} onChange={(v) => onChange(Math.round(v))} width={56} disabled={wired} min={def.min} max={def.max} />
        <button onClick={() => !wired && onChange(Math.floor(Math.random() * 9999))}
          style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 3, fontSize: 11, cursor: wired ? "default" : "pointer", padding: "2px 7px", opacity: wired ? 0.4 : 1 }}>
          ⚄
        </button>
      </div>
    );
  }
  if (def.type === "text") {
    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ ...lbl, marginBottom: 2 }}>{def.label}</div>
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{
            width: "100%", background: T.panel2, color: T.text, border: `1px solid ${T.line}`,
            borderRadius: 3, fontSize: 10, padding: "3px 6px", fontFamily: "inherit",
          }} />
      </div>
    );
  }
  if (def.type === "file") {
    return (
      <div style={{ ...rowS, gap: 8 }}>
        <label style={{
          background: T.panel2, border: `1px solid ${T.accent}55`, color: T.text, borderRadius: 3,
          fontSize: 10, padding: "4px 9px", cursor: "pointer", flexShrink: 0,
        }}>
          {fileLabel || "Choose SVG…"}
          <input type="file" accept={fileMode === "dataurl" ? "image/*" : ".svg,image/svg+xml"} style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f && onFileText) {
                const r = new FileReader();
                r.onload = () => onFileText(String(r.result), f.name);
                if (fileMode === "dataurl") r.readAsDataURL(f);
                else r.readAsText(f);
              }
              e.target.value = "";
            }} />
        </label>
        <div style={{ ...lbl, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: value ? T.text : T.dim }}>
          {value || "no file"}
        </div>
      </div>
    );
  }
  if (def.type === "pen") {
    return (
      <div style={rowS}>
        <div style={{ ...lbl, width: 100, flexShrink: 0 }}>{def.label}</div>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {PENS.map((pen, i) => (
            <div key={i} onClick={() => onChange(i)} title={pen.name}
              style={{
                width: 16, height: 16, borderRadius: "50%", background: pen.c, cursor: "pointer",
                border: value === i ? `2px solid ${T.accent}` : "2px solid transparent",
                boxShadow: value === i ? "0 0 0 1px " + T.accent : "none",
              }} />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

/* ============================================================
   PÄÄSOVELLUS
   ============================================================ */
let NEXT_ID = 300;
const NODE_W = 272;
const PORT_Y0 = 46;
const PORT_DY = 17;
const AREA_W = 3000, AREA_H = 2000;

function defaults(type) {
  const o = {};
  DEFS[type].params.forEach((p) => (o[p.key] = p.def));
  return o;
}
function levelOf(root, stack) {
  let lvl = root;
  for (const gid of stack) {
    const g = lvl.nodes.find((n) => n.id === gid);
    if (!g || !g.data) return lvl;
    lvl = g.data;
  }
  return lvl;
}
function updateAt(level, stack, fn) {
  if (!stack.length) return { ...level, ...fn(level) };
  const [gid, ...rest] = stack;
  return { ...level, nodes: level.nodes.map((n) => (n.id === gid ? { ...n, data: updateAt(n.data, rest, fn) } : n)) };
}

export default function App() {
  const [canvasW, setCanvasW] = useState(300);
  const [canvasH, setCanvasH] = useState(200);
  const DEFAULT_MACHINE = {
    name: "A — Servo Z (multi-tip brush)",
    workW: 330, workH: 240, originX: 0, originY: 0, flipY: false, pauseCmd: "M0",
    startG: "G21 ; mm\nG90 ; absolute\nG28 ; home",
    endG: "G0 X0 Y0",
    zMode: "servo", servoName: "pen", servoUp: 90, servoDown: 35,
    penUp: 3, penDown: 0, feedDraw: 1800, feedTravel: 6000, zFeed: 600,
    zHop: 1.5, zHopOn: true, penDelayDown: 120, penDelayUp: 80,
    rotOn: false, rotStepper: "pen_rotate", rotThresh: 20,
    dipOn: false, dipX: 320, dipY: 20, dipZ: -2, dipEvery: 800, dipDwell: 600,
    maintOn: false, maintEvery: 4000, maintMsg: "Advance chalk / re-sharpen", maintPark: false, maintX: 20, maintY: 20,
  };
  const DEFAULT_MACHINE_B = {
    ...DEFAULT_MACHINE,
    name: "B — Bed Z + rotation",
    zMode: "bed", rotOn: true,
  };
  const [machines, setMachines] = useState([DEFAULT_MACHINE, DEFAULT_MACHINE_B]);
  const [helpFor, setHelpFor] = useState(null); /* node id whose help tooltip is open */
  const [machineIdx, setMachineIdx] = useState(0);
  const prof = machines[Math.min(machineIdx, machines.length - 1)];
  const setProf = (fn) => setMachines((ms) => ms.map((m, i) =>
    i === Math.min(machineIdx, ms.length - 1) ? (typeof fn === "function" ? fn(m) : fn) : m));
  const exportMachine = () => {
    const blob = new Blob([JSON.stringify({ app: "muusia-machine", v: 1, prof }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (prof.name || "machine").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".muusia-machine.json";
    a.click();
  };
  const importMachine = (text) => {
    try {
      const data = JSON.parse(text);
      const p = data.prof || data;
      /* yhdista oletuksiin ettei puutu kenttia -> vanhat profiilit paivittyvat */
      const merged = { ...DEFAULT_MACHINE, ...p };
      setMachines((ms) => [...ms, merged]);
      setMachineIdx(machines.length);
    } catch (e) { alert("Could not read machine profile: " + e.message); }
  };
  const addMachine = () => {
    setMachines((ms) => [...ms, { ...prof, name: (prof.name || "machine") + " copy" }]);
    setMachineIdx(machines.length);
  };
  const deleteMachine = () => {
    if (machines.length < 2) return;
    setMachines((ms) => ms.filter((_, i) => i !== machineIdx));
    setMachineIdx((i) => Math.max(0, i - 1));
  };
  const [projName, setProjName] = useState("patch");
  const [mchOpen, setMchOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [root, setRoot] = useState(() => ({
    nodes: [
      { id: 1, type: "viiva", x: 40, y: 60, params: defaults("viiva") },
      { id: 2, type: "grid", x: 380, y: 40, params: defaults("grid") },
      { id: 3, type: "aaltoilu", x: 730, y: 90, params: defaults("aaltoilu") },
      { id: 4, type: "radat", x: 380, y: 620, params: defaults("radat") },
      { id: 5, type: "mask", x: 1080, y: 260, params: defaults("mask") },
      { id: 6, type: "arvo", x: 40, y: 620, params: defaults("arvo") },
      { id: 7, type: "fan", x: 40, y: 800, params: defaults("fan") },
    ],
    edges: [
      { id: "e1", from: 1, fromPort: 0, to: 2, toPort: 0 },
      { id: "e2", from: 2, fromPort: 0, to: 3, toPort: 0 },
      { id: "e3", from: 3, fromPort: 0, to: 5, toPort: 0 },
      { id: "e4", from: 4, fromPort: 0, to: 5, toPort: 1 },
      { id: "e5", from: 6, fromPort: 0, to: 7, toPort: 0 },
      { id: "e6", from: 7, fromPort: 0, to: 3, toPort: "p:amp" },
    ],
  }));
  const [stack, setStack] = useState([]);
  const [selIds, setSelIds] = useState([5]);
  const [showArrows, setShowArrows] = useState(false);
  const [bigPreview, setBigPreview] = useState(false);
  const [gcode, setGcode] = useState(null);

  const lvl = levelOf(root, stack);
  const primary = selIds.length ? selIds[selIds.length - 1] : null;
  const setLevel = (fn) => setRoot((r) => updateAt(r, stack, fn));
  const setNodesL = (up) => setLevel((l) => ({ nodes: typeof up === "function" ? up(l.nodes) : up }));
  const setEdgesL = (up) => setLevel((l) => ({ edges: typeof up === "function" ? up(l.edges) : up }));

  /* --- animaatio: freimit --- */
  const [frameCount, setFrameCount] = useState(12);
  const [frameIdx, setFrameIdx] = useState(0);
  const [animPlay, setAnimPlay] = useState(false);
  useEffect(() => {
    if (!animPlay) return;
    const iv = setInterval(() => setFrameIdx((i) => (i + 1) % Math.max(1, frameCount)), 170);
    return () => clearInterval(iv);
  }, [animPlay, frameCount]);
  const ctx = useMemo(() => ({ W: canvasW, H: canvasH, frameIdx, frameCount }), [canvasW, canvasH, frameIdx, frameCount]);
  const evalResult = useMemo(() => {
    let level = root, res = evalLevel(root, ctx, null);
    for (const gid of stack) {
      const g = level.nodes.find((n) => n.id === gid);
      if (!g || !g.data) break;
      const gIns = g.data.bindings.map((b, k) => {
        const e = level.edges.find((ed) => ed.to === g.id && ed.toPort === k);
        return e ? (res.out[e.from] || [])[e.fromPort || 0] : undefined;
      });
      level = g.data;
      res = evalLevel(level, ctx, gIns);
    }
    return res;
  }, [root, stack, ctx]);
  const results = evalResult.out;
  const pvals = evalResult.pvals;

  /* --- porttien mitatut sijainnit (johtoja varten) --- */
  const portEls = useRef({});
  const cardEls = useRef({});
  const [portPos, setPortPos] = useState({});
  const lastPosStr = useRef("");
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const regPort = (key) => (el) => { if (el) portEls.current[key] = el; else delete portEls.current[key]; };
  const regCard = (id) => (el) => { if (el) cardEls.current[id] = el; else delete cardEls.current[id]; };
  useEffect(() => {
    const m = {};
    for (const key of Object.keys(portEls.current)) {
      const el = portEls.current[key];
      const id = key.split("|")[0];
      const card = cardEls.current[id];
      if (!card || !el || !el.isConnected) continue;
      const cr = card.getBoundingClientRect(), pr = el.getBoundingClientRect();
      m[key] = Math.round((pr.top - cr.top + pr.height / 2) / zoomRef.current);
    }
    const s = JSON.stringify(m);
    if (s !== lastPosStr.current) { lastPosStr.current = s; setPortPos(m); }
  });
  const portY = (id, portKey, fallbackIdx) => {
    const v = portPos[id + "|" + portKey];
    return v !== undefined ? v : PORT_Y0 + (fallbackIdx || 0) * PORT_DY;
  };

  /* --- valinta --- */
  const selectNode = (id, shift) => {
    setSelIds((cur) => {
      if (shift) return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return cur.includes(id) && cur.length === 1 ? cur : [id];
    });
  };
  useEffect(() => { setSelIds([]); setGcode(null); }, [stack.length]);

  /* --- raahaus + johdotus --- */
  const drag = useRef(null);
  const pending = useRef(null);
  const [pendingWire, setPendingWire] = useState(null);
  const areaRef = useRef(null);

  const areaXY = (e) => {
    const rect = areaRef.current.getBoundingClientRect();
    return [
      (e.clientX - rect.left + areaRef.current.scrollLeft) / zoomRef.current,
      (e.clientY - rect.top + areaRef.current.scrollTop) / zoomRef.current,
    ];
  };
  const onNodeMouseDown = (e, id) => {
    const shift = e.shiftKey;
    const [mx, my] = areaXY(e);
    setSelIds((cur) => {
      const next = shift ? (cur.includes(id) ? cur : [...cur, id]) : cur.includes(id) ? cur : [id];
      const list = next.map((nid) => {
        const n = lvl.nodes.find((q) => q.id === nid);
        return n ? { id: nid, dx: mx - n.x, dy: my - n.y } : null;
      }).filter(Boolean);
      drag.current = { ids: list };
      return next;
    });
    e.preventDefault();
  };
  const onAreaMouseMove = (e) => {
    if (drag.current) {
      const [mx, my] = areaXY(e);
      const map = Object.fromEntries(drag.current.ids.map((d) => [d.id, d]));
      setNodesL((ns) => ns.map((n) => (map[n.id] ? { ...n, x: Math.max(0, mx - map[n.id].dx), y: Math.max(0, my - map[n.id].dy) } : n)));
    } else if (pending.current) {
      const fromNode = lvl.nodes.find((n) => n.id === pending.current.from);
      if (fromNode) {
        const [mx, my] = areaXY(e);
        setPendingWire({
          x1: fromNode.x + NODE_W,
          y1: fromNode.y + portY(fromNode.id, "out:" + (pending.current.fromPort || 0), pending.current.fromPort || 0),
          x2: mx, y2: my, type: pending.current.type,
        });
      }
    }
  };
  const onAreaMouseUp = () => { drag.current = null; pending.current = null; setPendingWire(null); };
  const onAreaClick = (e) => { if (e.target === e.currentTarget || e.target.tagName === "svg") setSelIds([]); };

  const startWire = (e, fromId, fromPort, type) => {
    pending.current = { from: fromId, fromPort, type };
    e.stopPropagation(); e.preventDefault();
  };
  const finishWire = (e, toId, toPort, expectType) => {
    if (pending.current && pending.current.from !== toId && pending.current.type === expectType) {
      const { from, fromPort } = pending.current;
      setEdgesL((es) => [
        ...es.filter((ed) => !(ed.to === toId && ed.toPort === toPort)),
        { id: "e" + NEXT_ID++, from, fromPort, to: toId, toPort },
      ]);
    }
    pending.current = null; setPendingWire(null);
    e.stopPropagation();
  };
  /* tartu kytkettyyn sisääntuloporttiin: irrota johto käteen */
  const detachWire = (e, toId, toPort) => {
    const edge = lvl.edges.find((ed) => ed.to === toId && ed.toPort === toPort);
    if (!edge) return false;
    const src = lvl.nodes.find((n) => n.id === edge.from);
    const t = src ? (defOuts(src)[edge.fromPort || 0] || {}).type : "paths";
    setEdgesL((es) => es.filter((x) => x.id !== edge.id));
    pending.current = { from: edge.from, fromPort: edge.fromPort || 0, type: t };
    e.stopPropagation(); e.preventDefault();
    return true;
  };

  /* --- zoom --- */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const z = zoomRef.current;
      const nz = Math.min(2.2, Math.max(0.3, z * (e.deltaY < 0 ? 1.12 : 0.9)));
      if (nz === z) return;
      const sl = el.scrollLeft, st = el.scrollTop;
      setZoom(nz);
      requestAnimationFrame(() => {
        el.scrollLeft = ((sl + mx) * nz) / z - mx;
        el.scrollTop = ((st + my) * nz) / z - my;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const zoomBtn = (dir) => {
    const z = zoomRef.current;
    setZoom(Math.min(2.2, Math.max(0.3, dir > 0 ? z * 1.2 : z / 1.2)));
  };

  /* --- toiminnot --- */
  const addNode = (type) => {
    const sl = areaRef.current ? areaRef.current.scrollLeft / zoom : 0;
    const st = areaRef.current ? areaRef.current.scrollTop / zoom : 0;
    addNodeAt(type, sl + 80 + (lvl.nodes.length % 4) * 40, st + 80 + (lvl.nodes.length % 5) * 40);
  };
  /* --- aloittelijaesimerkit: rakennetaan ohjelmallisesti defaults()-pohjalta --- */
  const EXAMPLES = [
    {
      name: "1 · Hello Tracks", desc: "Generator \u2192 export. One node is already art.",
      make: () => ({
        nodes: [{ id: 9001, type: "radat", x: 60, y: 60, params: defaults("radat") }],
        edges: [],
      }),
    },
    {
      name: "2 · Modifier chain", desc: "Tracks \u2192 Jitter \u2192 Symmetry: chain modifiers left to right.",
      make: () => ({
        nodes: [
          { id: 9001, type: "radat", x: 40, y: 60, params: defaults("radat") },
          { id: 9002, type: "jitter", x: 320, y: 60, params: defaults("jitter") },
          { id: 9003, type: "symmetry", x: 600, y: 60, params: defaults("symmetry") },
        ],
        edges: [
          { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
          { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
        ],
      }),
    },
    {
      name: "3 · Value wires", desc: "Random drives Grid line count: green ports modulate anything.",
      make: () => {
        const g = defaults("grid");
        return {
          nodes: [
            { id: 9001, type: "satunnainen", x: 40, y: 40, params: defaults("satunnainen") },
            { id: 9002, type: "grid", x: 320, y: 80, params: g },
          ],
          edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: "p:vlines" }],
        };
      },
    },
    {
      name: "4 · Landscape", desc: "Skyline + Water share Horizon Y; Merge combines layers.",
      make: () => {
        const sk = defaults("skyline"), wa = defaults("water");
        sk.horizon = 85; wa.horizon = 85;
        return {
          nodes: [
            { id: 9001, type: "skyline", x: 40, y: 30, params: sk },
            { id: 9002, type: "water", x: 40, y: 320, params: wa },
            { id: 9003, type: "merge", x: 360, y: 160, params: defaults("merge") },
          ],
          edges: [
            { id: "e9101", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
            { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
          ],
        };
      },
    },
    {
      name: "5 · Animation", desc: "Frame spins a solid over a static background. Press \u25B6 in ANIMATE.",
      make: () => {
        const so = defaults("solids"), ma = defaults("matem");
        so.shape = "Icosahedron"; so.size = 90;
        ma.op = "A \u00D7 B"; ma.b = 15;
        return {
          nodes: [
            { id: 9001, type: "frame", x: 30, y: 40, params: defaults("frame") },
            { id: 9002, type: "matem", x: 250, y: 40, params: ma },
            { id: 9003, type: "solids", x: 470, y: 120, params: so },
            { id: 9004, type: "mountains", x: 30, y: 330, params: defaults("mountains") },
            { id: 9005, type: "merge", x: 760, y: 200, params: defaults("merge") },
          ],
          edges: [
            { id: "e9101", from: 9001, fromPort: 1, to: 9002, toPort: 0 },
            { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: "p:ry" },
            { id: "e9103", from: 9004, fromPort: 0, to: 9005, toPort: 0 },
            { id: "e9104", from: 9003, fromPort: 0, to: 9005, toPort: 1 },
          ],
        };
      },
    },
  ];
  const loadExample = (ex) => {
    const data = ex.make();
    NEXT_ID = 9500;
    setStack([]);
    setSelIds([]);
    setRoot({ nodes: data.nodes, edges: data.edges });
    setGcode(null);
    setHelpOpen(false);
  };

  const addNodeAt = (type, x, y) => {
    const id = NEXT_ID++;
    setNodesL((ns) => [...ns, { id, type, x: Math.max(0, x), y: Math.max(0, y), params: defaults(type) }]);
    setSelIds([id]);
  };
  const removeSelected = () => {
    if (!selIds.length) return;
    const del = new Set(selIds);
    setLevel((l) => ({
      nodes: l.nodes.filter((n) => !del.has(n.id)),
      edges: l.edges.filter((e) => !del.has(e.from) && !del.has(e.to)),
    }));
    setSelIds([]);
  };
  const duplicateSelected = () => {
    if (!selIds.length) return;
    const sel = new Set(selIds);
    const idMap = {};
    const copies = lvl.nodes.filter((n) => sel.has(n.id)).map((n) => {
      const nid = NEXT_ID++;
      idMap[n.id] = nid;
      return { ...n, id: nid, x: n.x + 44, y: n.y + 44, params: { ...n.params }, data: n.data ? JSON.parse(JSON.stringify(n.data)) : undefined };
    });
    const copyEdges = lvl.edges
      .filter((e) => sel.has(e.from) && sel.has(e.to))
      .map((e) => ({ id: "e" + NEXT_ID++, from: idMap[e.from], fromPort: e.fromPort || 0, to: idMap[e.to], toPort: e.toPort }));
    setLevel((l) => ({ nodes: [...l.nodes, ...copies], edges: [...l.edges, ...copyEdges] }));
    setSelIds(copies.map((c) => c.id));
  };
  const groupSelected = () => {
    if (selIds.length < 2) return;
    const sel = new Set(selIds);
    const inner = lvl.nodes.filter((n) => sel.has(n.id));
    const innerEdges = lvl.edges.filter((e) => sel.has(e.from) && sel.has(e.to));
    const inEdges = lvl.edges.filter((e) => !sel.has(e.from) && sel.has(e.to));
    const outEdges = lvl.edges.filter((e) => sel.has(e.from) && !sel.has(e.to));
    let outputId;
    if (outEdges.length) outputId = outEdges[0].from;
    else {
      const consumed = new Set(innerEdges.map((e) => e.from));
      const sinks = inner.filter((n) => !consumed.has(n.id));
      outputId = (sinks.length ? sinks[sinks.length - 1] : inner[inner.length - 1]).id;
    }
    const dataIn = inEdges.filter((e) => typeof e.toPort === "number");
    const bindings = dataIn.map((e) => ({ nodeId: e.to, port: e.toPort }));
    const gid = NEXT_ID++;
    const gx = inner.reduce((s, n) => s + n.x, 0) / inner.length;
    const gy = inner.reduce((s, n) => s + n.y, 0) / inner.length;
    const gnode = {
      id: gid, type: "group", x: gx, y: gy, params: {},
      data: { nodes: inner.map((n) => ({ ...n })), edges: innerEdges.map((e) => ({ ...e })), bindings, outputId },
    };
    setLevel((l) => ({
      nodes: [...l.nodes.filter((n) => !sel.has(n.id)), gnode],
      edges: [
        ...l.edges.filter((e) => !sel.has(e.from) && !sel.has(e.to)),
        ...dataIn.map((e, i) => ({ id: "e" + NEXT_ID++, from: e.from, fromPort: e.fromPort || 0, to: gid, toPort: i })),
        ...outEdges.map((e) => ({ id: "e" + NEXT_ID++, from: gid, fromPort: 0, to: e.to, toPort: e.toPort })),
      ],
    }));
    setSelIds([gid]);
  };
  const ungroupSelected = () => {
    const g = lvl.nodes.find((n) => n.id === primary && n.type === "group");
    if (!g) return;
    const idMap = {};
    const base = g.data.nodes[0];
    const restored = g.data.nodes.map((n) => {
      const nid = NEXT_ID++;
      idMap[n.id] = nid;
      return { ...n, id: nid, x: g.x + (n.x - base.x) * 0.6, y: g.y + (n.y - base.y) * 0.6 };
    });
    const restoredEdges = g.data.edges.map((e) => ({ id: "e" + NEXT_ID++, from: idMap[e.from], fromPort: e.fromPort || 0, to: idMap[e.to], toPort: e.toPort }));
    setLevel((l) => {
      const external = [];
      for (const e of l.edges) {
        if (e.to === g.id) {
          const b = g.data.bindings[e.toPort];
          if (b) external.push({ id: "e" + NEXT_ID++, from: e.from, fromPort: e.fromPort || 0, to: idMap[b.nodeId], toPort: b.port });
        } else if (e.from === g.id) {
          external.push({ id: "e" + NEXT_ID++, from: idMap[g.data.outputId], fromPort: 0, to: e.to, toPort: e.toPort });
        } else external.push(e);
      }
      return { nodes: [...l.nodes.filter((n) => n.id !== g.id), ...restored], edges: [...external, ...restoredEdges] };
    });
    setSelIds(restored.map((r) => r.id));
  };
  const enterGroup = (gid) => setStack((s) => [...s, gid]);
  const exitTo = (depth) => setStack((s) => s.slice(0, depth));
  const setAsOutput = (id) => setLevel(() => ({ outputId: id }));
  const toggleCollapse = (id) =>
    setNodesL((ns) => ns.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n)));

  const setParam = (id, key, val) =>
    setNodesL((ns) => ns.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: val } } : n)));

  /* --- z-jarjestys: klikattu node nousee paallimmaiseksi (vain nakyma, ei undo-historiaa) --- */
  const [zOrder, setZOrder] = useState({});
  const zTopRef = useRef(1);
  const raiseNode = (id) => {
    setZOrder((z) => (z[id] === zTopRef.current - 1 && zTopRef.current > 1) ? z : { ...z, [id]: zTopRef.current++ });
  };

  /* --- undo/redo: snapshot-historia koko graafista --- */
  const histRef = useRef({ past: [], future: [], last: 0, applying: false });
  const prevRootRef = useRef(root);
  const [histLens, setHistLens] = useState([0, 0]);
  useEffect(() => {
    const h = histRef.current;
    if (h.applying) { h.applying = false; prevRootRef.current = root; return; }
    if (prevRootRef.current !== root) {
      const now = Date.now();
      /* niputa nopeat perakkaiset muutokset (liukurivedot) yhdeksi askeleeksi */
      if (!(now - h.last < 400 && h.past.length)) {
        h.past.push(prevRootRef.current);
        if (h.past.length > 60) h.past.shift();
      }
      h.last = now;
      h.future = [];
      prevRootRef.current = root;
      setHistLens([h.past.length, 0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);
  const undo = () => {
    const h = histRef.current;
    if (!h.past.length) return;
    const prev = h.past.pop();
    h.future.push(root);
    h.applying = true;
    h.last = 0;
    setRoot(prev);
    setSelIds([]);
    setStack([]);
    setHistLens([h.past.length, h.future.length]);
  };
  const redo = () => {
    const h = histRef.current;
    if (!h.future.length) return;
    const next = h.future.pop();
    h.past.push(root);
    h.applying = true;
    h.last = 0;
    setRoot(next);
    setSelIds([]);
    setStack([]);
    setHistLens([h.past.length, h.future.length]);
  };

  /* --- nappaimisto --- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") { e.preventDefault(); groupSelected(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
      else if (e.key === "Escape") { setBigPreview(false); setSelIds([]); }
      else if (e.key === " ") {
        e.preventDefault();
        setBigPreview((v) => (v ? false : primaryPS.paths.length > 0));
      }
      else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const map = { g: "gen", m: "mod", d: "dec", c: "duo", x: "math", n: null };
        const k = e.key.toLowerCase();
        if (k in map) {
          e.preventDefault();
          setQuickAdd({ cat: map[k], query: "", sel: 0 });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const primaryNode = lvl.nodes.find((n) => n.id === primary);
  const primaryOut = primary != null ? results[primary] : null;
  const primaryPS = primaryOut && primaryOut[0] && primaryOut[0].paths ? primaryOut[0] : EMPTY;
  const stats = totalStats(primaryPS);
  const primaryIsGroup = primaryNode && primaryNode.type === "group";
  const primaryGuides = (() => {
    if (!primaryNode || primaryIsGroup) return null;
    const def = DEFS[primaryNode.type];
    if (!def || !def.overlay) return null;
    const merged = { ...primaryNode.params, ...((pvals && pvals[primaryNode.id]) || {}) };
    try { return def.overlay(merged, ctx); } catch (e) { return null; }
  })();

  const [copied, setCopied] = useState(false);
  const [exportKind, setExportKind] = useState("gcode");
  const gcodeRef = useRef(null);
  const loadRef = useRef(null);
  const [simOn, setSimOn] = useState(false);
  const [quickAdd, setQuickAdd] = useState(null); /* {cat: null|'gen'|..., query, sel} */
  const [helpOpen, setHelpOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({ geometric: true });
  const [flatAZ, setFlatAZ] = useState(false);
  const [routeOpt, setRouteOpt] = useState(true);
  const [preserveDir, setPreserveDir] = useState(true);
  const exportPS = () => (routeOpt ? routeOptimize(primaryPS, preserveDir) : primaryPS);
  const doExport = () => { setGcode(toGcode(exportPS(), ctx, prof)); setExportKind("gcode"); setCopied(false); };
  const doExportSVG = () => { setGcode(toSVG(exportPS(), ctx)); setExportKind("svg"); setCopied(false); };
  /* --- kaikkien freimien vienti: uudelleenevaluointi per freimi --- */
  const exportAllFrames = (kind) => {
    if (!primaryNode) return;
    const n = Math.max(1, frameCount);
    let f = 0;
    const doOne = () => {
      const ctxF = { W: canvasW, H: canvasH, frameIdx: f, frameCount: n };
      let level = root, res = evalLevel(root, ctxF, null);
      for (const gid of stack) {
        const g = level.nodes.find((nd) => nd.id === gid);
        if (!g || !g.data) break;
        const gIns = g.data.bindings.map((b, k) => {
          const e = level.edges.find((ed) => ed.to === g.id && ed.toPort === k);
          return e ? (res.out[e.from] || [])[e.fromPort || 0] : undefined;
        });
        level = g.data;
        res = evalLevel(level, ctxF, gIns);
      }
      const out = res.out[primaryNode.id];
      let ps = out && out[0] && out[0].paths ? out[0] : EMPTY;
      if (routeOpt) ps = routeOptimize(ps, preserveDir);
      const text = kind === "svg" ? toSVG(ps, ctxF) : toGcode(ps, ctxF, prof);
      try {
        const blob = new Blob([text], { type: kind === "svg" ? "image/svg+xml" : "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${projName || "patch"}-f${String(f).padStart(3, "0")}${kind === "svg" ? ".svg" : ".gcode"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      } catch (err) { /* hiekkalaatikko estaa lataukset */ }
      f++;
      if (f < n) setTimeout(doOne, 450);
    };
    doOne();
  };
  const download = () => {
    try {
      const blob = new Blob([gcode], { type: exportKind === "svg" ? "image/svg+xml" : "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (projName || "patch") + (exportKind === "svg" ? ".svg" : ".gcode");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      copyGcode(); // hiekkalaatikko estää lataukset -> kopioi leikepöydälle
    }
  };
  /* --- patchin tallennus / lataus --- */
  const buildPatchJSON = () =>
    JSON.stringify({ app: "muusia", v: 1, name: projName, canvas: { W: canvasW, H: canvasH }, prof, machines, machineIdx, customNodes, root }, null, 1);
  const savePatch = () => {
    const data = buildPatchJSON();
    try {
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (projName || "patch") + ".muusia.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data);
    }
  };
  const loadPatch = (text, silent) => {
    try {
      const data = JSON.parse(text);
      if (!data || data.app !== "muusia" && data.app !== "plotter-patcher" || !data.root) throw new Error("bad file");
      /* rekisteroi custom nodet ennen graafin latausta */
      if (Array.isArray(data.customNodes)) {
        for (const c of data.customNodes) if (c && c.source) registerCustomNode(c.source, true);
      }
      /* palauta NEXT_ID: suurin id koko puusta (myös ryhmien sisältä) */
      let maxId = 100;
      const scan = (lvl) => {
        for (const n of lvl.nodes || []) {
          if (typeof n.id === "number" && n.id > maxId) maxId = n.id;
          if (n.data && n.data.nodes) scan(n.data);
        }
        for (const e of lvl.edges || []) {
          const m = /^e(\d+)$/.exec(e.id || "");
          if (m && +m[1] > maxId) maxId = +m[1];
        }
      };
      scan(data.root);
      NEXT_ID = maxId + 1;
      setStack([]);
      setSelIds([]);
      setRoot(data.root);
      if (data.canvas) { setCanvasW(data.canvas.W || 300); setCanvasH(data.canvas.H || 200); }
      if (Array.isArray(data.machines) && data.machines.length) {
        setMachines(data.machines.map((m) => ({ ...DEFAULT_MACHINE, ...m })));
        setMachineIdx(Math.min(data.machineIdx || 0, data.machines.length - 1));
      } else if (data.prof) {
        setMachines([{ ...DEFAULT_MACHINE, ...data.prof }]);
        setMachineIdx(0);
      }
      if (data.name) setProjName(data.name);
      setGcode(null);
    } catch (err) {
      if (!silent) alert("Could not load patch: " + err.message);
    }
  };
  /* --- oletuspatch: selaimen storage (toimii omalla koneella; previewissa ei saatavilla) --- */
  const DKEY = "plotterpatcher-default";
  const [hasDefault, setHasDefault] = useState(() => {
    try { return !!window.localStorage.getItem(DKEY); } catch (e) { return false; }
  });
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(DKEY);
      if (s) loadPatch(s, true);
    } catch (e) { /* storage ei kaytettavissa -> demo-patch */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setDefaultPatch = () => {
    try {
      window.localStorage.setItem(DKEY, buildPatchJSON());
      setHasDefault(true);
    } catch (e) {
      alert("Default patch needs browser storage — run the app locally (Vite). In this preview it isn't available.");
    }
  };
  const clearDefaultPatch = () => {
    try { window.localStorage.removeItem(DKEY); } catch (e) {}
    setHasDefault(false);
  };
  /* --- custom nodet: maaritelman tuonti ajonaikaisesti --- */
  const [customNodes, setCustomNodes] = useState([]); /* [{key, source}] */
  const nodeLoadRef = useRef(null);
  const registerCustomNode = (code, silent) => {
    try {
      const def = evaluateNodeDef(code);
      DEFS[def.key] = def;
      setCustomNodes((cs) => [...cs.filter((c) => c.key !== def.key), { key: def.key, source: code }]);
      if (!silent) setSelIds([]); /* pakota render -> paletti paivittyy */
      return def.key;
    } catch (err) {
      if (!silent) alert("Node definition error: " + err.message);
      return null;
    }
  };

  const removeCustomNode = (key) => {
    /* estetaan poisto jos instansseja on graafissa (myos ryhmien sisalla) */
    let count = 0;
    const scan = (level) => {
      for (const n of level.nodes || []) {
        if (n.type === key) count++;
        if (n.data && n.data.nodes) scan(n.data);
      }
    };
    scan(root);
    if (count > 0) {
      alert(`Cannot remove: ${count} instance(s) of this node exist in the patch. Delete them first.`);
      return;
    }
    delete DEFS[key];
    setCustomNodes((cs) => cs.filter((c) => c.key !== key));
  };

  /* --- modulit: valinnan vienti / tuonti aliverkkona --- */
  const modLoadRef = useRef(null);
  const exportModule = () => {
    if (!selIds.length) return;
    const sel = new Set(selIds);
    const nodes = lvl.nodes.filter((n) => sel.has(n.id)).map((n) => ({
      ...n, params: { ...n.params }, data: n.data ? JSON.parse(JSON.stringify(n.data)) : undefined,
    }));
    const edges = lvl.edges.filter((e) => sel.has(e.from) && sel.has(e.to)).map((e) => ({ ...e }));
    const data = JSON.stringify({ app: "muusia-module", v: 1, nodes, edges }, null, 1);
    try {
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (projName || "patch") + "-module.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data);
    }
  };
  const importModule = (text) => {
    try {
      const data = JSON.parse(text);
      if (!data || data.app !== "muusia-module" && data.app !== "plotter-patcher-module" || !Array.isArray(data.nodes)) throw new Error("not a module file");
      const idMap = {};
      const sl = areaRef.current ? areaRef.current.scrollLeft / zoom : 0;
      const st = areaRef.current ? areaRef.current.scrollTop / zoom : 0;
      const minX = Math.min(...data.nodes.map((n) => n.x));
      const minY = Math.min(...data.nodes.map((n) => n.y));
      const nodes = data.nodes.map((n) => {
        const nid = NEXT_ID++;
        idMap[n.id] = nid;
        return {
          ...n, id: nid,
          x: n.x - minX + sl + 90, y: n.y - minY + st + 90,
          params: { ...n.params },
          data: n.data ? JSON.parse(JSON.stringify(n.data)) : undefined,
        };
      });
      const edges = (data.edges || [])
        .filter((e) => idMap[e.from] !== undefined && idMap[e.to] !== undefined)
        .map((e) => ({ id: "e" + NEXT_ID++, from: idMap[e.from], fromPort: e.fromPort || 0, to: idMap[e.to], toPort: e.toPort }));
      setLevel((l) => ({ nodes: [...l.nodes, ...nodes], edges: [...l.edges, ...edges] }));
      setSelIds(nodes.map((n) => n.id));
    } catch (err) {
      alert("Could not import module: " + err.message);
    }
  };
  const copyGcode = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(gcode).then(done).catch(() => {
        if (gcodeRef.current) { gcodeRef.current.select(); document.execCommand("copy"); done(); }
      });
    } else if (gcodeRef.current) {
      gcodeRef.current.select();
      document.execCommand("copy");
      done();
    }
  };

  const wireD = (x1, y1, x2, y2) => {
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  };

  const toolBtn = (enabled) => ({
    background: T.panel2, border: `1px solid ${T.line}`, color: enabled ? T.text : T.dim,
    borderRadius: 4, fontSize: 10, padding: "4px 10px", cursor: enabled ? "pointer" : "default",
    fontFamily: mono, opacity: enabled ? 1 : 0.55,
  });
  const profNum = (k, label) => (
    <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <div style={{ fontSize: 10, color: T.dim, width: 110 }}>{label}</div>
      <input type="number" value={prof[k]} onChange={(e) => setProf((pr) => ({ ...pr, [k]: +e.target.value || 0 }))}
        style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text, fontFamily: mono, fontSize: 12, overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap');
        *{box-sizing:border-box} ::-webkit-scrollbar{width:8px;height:8px} ::-webkit-scrollbar-thumb{background:${T.line};border-radius:4px}`}</style>

      {/* ---------- Yläpalkki ---------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${T.line}`, background: T.panel, flexWrap: "wrap" }}>
        <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 15, letterSpacing: "0.02em", marginRight: 6, color: T.text }}>
          MUUSIA
          <span style={{ color: T.dim, fontWeight: 500, fontSize: 11, marginLeft: 8 }}>{"v" + APP_VERSION}</span>
        </div>
        <button style={toolBtn(selIds.length > 0)} onClick={duplicateSelected} title="Cmd/Ctrl+D">Duplicate ({selIds.length})</button>
        <button style={toolBtn(selIds.length >= 2)} onClick={groupSelected} title="Cmd/Ctrl+G">Group</button>
        <button style={toolBtn(!!primaryIsGroup)} onClick={ungroupSelected}>Ungroup</button>
        <button style={toolBtn(!!primaryIsGroup)} onClick={() => primaryIsGroup && enterGroup(primary)}>Open ⤵</button>
        <button style={toolBtn(selIds.length > 0)} onClick={removeSelected} title="Delete">Delete</button>
        <button style={toolBtn(selIds.length > 0)} onClick={() => setSelIds([])} title="Esc">Clear selection</button>
        <div style={{ width: 1, height: 18, background: T.line }} />
        <button style={toolBtn(histLens[0] > 0)} onClick={undo} title="Undo (Cmd/Ctrl+Z)">↶</button>
        <button style={toolBtn(histLens[1] > 0)} onClick={redo} title="Redo (Cmd/Ctrl+Shift+Z)">↷</button>
        <div style={{ width: 1, height: 18, background: T.line }} />
        <input type="text" value={projName} onChange={(e) => setProjName(e.target.value)}
          title="Project name (used for filenames)"
          style={{ width: 110, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 10, fontFamily: mono }} />
        <button style={toolBtn(true)} onClick={savePatch}>Save</button>
        <button style={toolBtn(true)} onClick={() => loadRef.current && loadRef.current.click()}>Load</button>
        <input type="file" ref={loadRef} accept=".json,application/json" style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) {
              const r = new FileReader();
              r.onload = () => loadPatch(String(r.result));
              r.readAsText(f);
            }
            e.target.value = "";
          }} />
        <button style={toolBtn(selIds.length > 0)} onClick={exportModule} title="Export selected nodes as a reusable module">Mod ⇡</button>
        <button style={toolBtn(true)} onClick={() => modLoadRef.current && modLoadRef.current.click()} title="Import module into this patch">Mod ⇣</button>
        <input type="file" ref={modLoadRef} accept=".json,application/json" style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) {
              const r = new FileReader();
              r.onload = () => importModule(String(r.result));
              r.readAsText(f);
            }
            e.target.value = "";
          }} />
        <button style={toolBtn(true)} onClick={() => nodeLoadRef.current && nodeLoadRef.current.click()} title="Import a custom node definition (.js) — see NODE-API doc">Node ⇣</button>
        <input type="file" ref={nodeLoadRef} accept=".js,.txt,.plotternode" style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) {
              const r = new FileReader();
              r.onload = () => {
                const key = registerCustomNode(String(r.result));
                if (key) alert("Node '" + DEFS[key].name + "' added to the palette (" + DEFS[key].cat + ").");
              };
              r.readAsText(f);
            }
            e.target.value = "";
          }} />
        <button onClick={() => setHelpOpen((v) => !v)} title="Help & examples"
          style={{
            background: helpOpen ? T.accent + "33" : T.panel2, border: `1px solid ${T.accent}88`, color: T.text,
            borderRadius: 4, fontSize: 10, padding: "4px 10px", cursor: "pointer", fontFamily: mono, fontWeight: 700,
          }}>? Help</button>
        <button style={toolBtn(true)} onClick={setDefaultPatch} title="Current patch loads on startup">
          {hasDefault ? "Update default" : "Set default"}
        </button>
        {hasDefault && (
          <button style={toolBtn(false)} onClick={clearDefaultPatch} title="Remove startup patch">✕</button>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button style={toolBtn(true)} onClick={() => zoomBtn(-1)}>−</button>
          <div style={{ fontSize: 10, color: T.dim, width: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</div>
          <button style={toolBtn(true)} onClick={() => zoomBtn(1)}>+</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.dim, fontSize: 11 }}>
          Canvas
          <input type="number" value={canvasW} onChange={(e) => setCanvasW(Math.max(10, +e.target.value || 10))}
            style={{ width: 54, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
          ×
          <input type="number" value={canvasH} onChange={(e) => setCanvasH(Math.max(10, +e.target.value || 10))}
            style={{ width: 54, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
          mm
        </div>
      </div>

      {/* ---------- Murupolku ---------- */}
      {stack.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "#221F14", borderBottom: `1px solid ${T.group}44`, fontSize: 10 }}>
          <span onClick={() => exitTo(0)} style={{ color: T.accent, cursor: "pointer" }}>Root</span>
          {stack.map((gid, i) => (
            <React.Fragment key={i}>
              <span style={{ color: T.dim }}>›</span>
              <span onClick={() => exitTo(i + 1)} style={{ color: i === stack.length - 1 ? T.group : T.accent, cursor: "pointer" }}>
                Group {gid}
              </span>
            </React.Fragment>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ color: T.dim }}>Editing group contents · ◎ = set as output · IN ports shown in gold</span>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* ---------- Paletti ---------- */}
        <div style={{ width: 168, borderRight: `1px solid ${T.line}`, background: T.panel, padding: 10, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.08em", flex: 1 }}>ADD NODE</div>
            <label title="List every node alphabetically, ignoring folders" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8.5, color: T.dim, cursor: "pointer" }}>
              <input type="checkbox" checked={flatAZ} onChange={(e) => setFlatAZ(e.target.checked)} style={{ accentColor: T.accent, width: 11, height: 11 }} />
              All nodes
            </label>
          </div>
          {(() => {
            const nodeBtn = (type, d, meta) => (
              <button key={type} onClick={() => addNode(type)}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/node-type", type); e.dataTransfer.effectAllowed = "copy"; }}
                style={{
                  display: "flex", alignItems: "center", width: "100%", textAlign: "left", marginBottom: 4, padding: "5px 8px",
                  background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderLeft: `3px solid ${meta.color}`,
                  borderRadius: 4, cursor: "grab", fontSize: 11, fontFamily: mono,
                }}>
                <span style={{ flex: 1 }}>{d.name}</span>
                {d.custom && (
                  <span title="Remove custom node" onClick={(e) => { e.stopPropagation(); removeCustomNode(type); }}
                    style={{ color: T.dim, fontSize: 12, padding: "0 2px", cursor: "pointer" }}>×</span>
                )}
              </button>
            );
            if (flatAZ) {
              /* A-Z per kategoria: generaattorit aakkosissa, sitten mod, jne. */
              return Object.entries(CATS).map(([cat, meta]) => {
                const items = Object.entries(DEFS).filter(([, d]) => d.cat === cat && !d.hidden)
                  .sort((a, b) => a[1].name.localeCompare(b[1].name));
                if (!items.length) return null;
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: meta.color, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{meta.label}</div>
                    {items.map(([type, d]) => nodeBtn(type, d, meta))}
                  </div>
                );
              });
            }
            return Object.entries(CATS).map(([cat, meta]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: meta.color, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{meta.label}</div>
                {(cat === "gen" || cat === "mod") ? (
                  Object.entries(cat === "gen" ? GEN_GROUPS : MOD_GROUPS).map(([gk, glabel]) => {
                    const items = Object.entries(DEFS).filter(([, d]) => d.cat === cat && d.group === gk && !d.hidden);
                    if (!items.length) return null;
                    const open = !!openGroups[gk];
                    return (
                      <div key={gk} style={{ marginBottom: 4 }}>
                        <div onClick={() => setOpenGroups((s) => ({ ...s, [gk]: !s[gk] }))}
                          style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", padding: "3px 4px", fontSize: 10, color: T.text, userSelect: "none" }}>
                          <span style={{ color: T.dim, fontSize: 8, width: 8 }}>{open ? "\u25BC" : "\u25B6"}</span>
                          <span style={{ flex: 1 }}>{glabel}</span>
                          <span style={{ color: T.dim, fontSize: 8 }}>{items.length}</span>
                        </div>
                        {open && <div style={{ paddingLeft: 4 }}>{items.map(([type, d]) => nodeBtn(type, d, meta))}</div>}
                      </div>
                    );
                  })
                ) : (
                  Object.entries(DEFS).filter(([, d]) => d.cat === cat && !d.hidden).map(([type, d]) => nodeBtn(type, d, meta))
                )}
              </div>
            ));
          })()}
          <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.6, marginTop: 10 }}>
            <span style={{ color: T.accent }}>●</span> paths · <span style={{ color: T.value }}>●</span> value · <span style={{ color: T.style }}>●</span> style<br /><br />
            Detach a wire: grab a connected input port and drag away (drop on empty = delete).<br /><br />
            Shift-click multi-select · Esc clear selection · Cmd/Ctrl+D duplicate · Cmd/Ctrl+G group · Delete remove · Ctrl/Cmd+wheel zoom
          </div>
        </div>

        {/* ---------- Patch-alue ---------- */}
        <div ref={areaRef} onMouseMove={onAreaMouseMove} onMouseUp={onAreaMouseUp} onClick={onAreaClick}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={(e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData("text/node-type");
            if (type && DEFS[type]) {
              const [x, y] = areaXY(e);
              addNodeAt(type, x - NODE_W / 2, y - 14);
            }
          }}
          style={{ flex: 1, overflow: "auto", position: "relative", backgroundColor: T.bg }}>
          <div style={{ width: AREA_W * zoom, height: AREA_H * zoom, position: "relative" }}>
            <div style={{
              width: AREA_W, height: AREA_H, position: "absolute", transformOrigin: "0 0", transform: `scale(${zoom})`,
              background: `radial-gradient(circle, ${T.line} 1px, transparent 1px)`, backgroundSize: "26px 26px",
            }}>
              <svg width={AREA_W} height={AREA_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {lvl.edges.map((e) => {
                  const a = lvl.nodes.find((n) => n.id === e.from), b = lvl.nodes.find((n) => n.id === e.to);
                  if (!a || !b) return null;
                  const outs = defOuts(a);
                  const fp = e.fromPort || 0;
                  if (fp >= outs.length) return null;
                  if (typeof e.toPort === "number" && e.toPort >= defIns(b).length) return null;
                  const tKey = typeof e.toPort === "number" ? "in:" + e.toPort : e.toPort;
                  const col = TYPE_COLOR[outs[fp].type] || T.accent;
                  const d = wireD(
                    a.x + NODE_W, a.y + portY(a.id, "out:" + fp, fp),
                    b.x, b.y + portY(b.id, tKey, typeof e.toPort === "number" ? e.toPort : 0)
                  );
                  return (
                    <g key={e.id}>
                      {/* leveä osumapinta */}
                      <path d={d} fill="none" stroke="transparent" strokeWidth="12"
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onClick={() => setEdgesL((es) => es.filter((x) => x.id !== e.id))} />
                      <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" opacity="0.75" style={{ pointerEvents: "none" }} />
                    </g>
                  );
                })}
                {pendingWire && (
                  <path d={wireD(pendingWire.x1, pendingWire.y1, pendingWire.x2, pendingWire.y2)}
                    fill="none" stroke={TYPE_COLOR[pendingWire.type] || T.accent} strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />
                )}
              </svg>

              {lvl.nodes.map((node) => {
                const def = DEFS[node.type];
                if (!def) return null;
                const isGroup = node.type === "group";
                const meta = isGroup ? { color: T.group } : CATS[def.cat];
                const dataIns = defIns(node);
                const nParams = numericParams(node);
                const outSpec = defOuts(node);
                const outArr = results[node.id] || [];
                const isSel = selIds.includes(node.id);
                const isOut = lvl.outputId === node.id && stack.length > 0;
                const collapsed = !!node.collapsed;
                const wiredParams = new Set(
                  lvl.edges.filter((e) => e.to === node.id && typeof e.toPort === "string").map((e) => e.toPort.slice(2))
                );
                return (
                  <div key={node.id} ref={regCard(node.id)}
                    onMouseDownCapture={() => raiseNode(node.id)}
                    style={{
                      position: "absolute", left: node.x, top: node.y, width: NODE_W,
                      zIndex: zOrder[node.id] || 0,
                      background: T.panel,
                      border: `1px solid ${isSel ? (isGroup ? T.group : T.accent) : isOut ? T.group : T.line}`,
                      borderRadius: 7,
                      boxShadow: isSel ? `0 0 0 1px ${isGroup ? T.group : T.accent}, 0 6px 20px rgba(0,0,0,0.4)` : "0 3px 12px rgba(0,0,0,0.35)",
                      userSelect: "none",
                    }}>
                    {/* Otsikko */}
                    <div onMouseDown={(e) => onNodeMouseDown(e, node.id)}
                      onDoubleClick={() => isGroup && enterGroup(node.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                        borderBottom: collapsed ? "none" : `1px solid ${T.line}`, cursor: "grab",
                        background: T.panel2, borderRadius: collapsed ? 7 : "7px 7px 0 0",
                      }}>
                      <div style={{ width: 8, height: 8, borderRadius: isGroup ? "50%" : 2, background: meta.color, flexShrink: 0 }} />
                      <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 12, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isGroup ? `Group ${node.id} (${node.data.nodes.length})` : def.name}
                        {isOut && <span style={{ color: T.group, marginLeft: 5 }}>OUT</span>}
                      </div>
                      {!isGroup && (
                        <div onClick={(ev) => { ev.stopPropagation(); setHelpFor((h) => h === node.id ? null : node.id); }}
                          onMouseDown={(ev) => ev.stopPropagation()}
                          title={def.desc || NODE_HELP[node.type] || def.name}
                          style={{ cursor: "help", color: helpFor === node.id ? T.accent : T.dim, fontSize: 10, lineHeight: 1, padding: "0 2px", fontWeight: 700, border: `1px solid ${helpFor === node.id ? T.accent : T.line}`, borderRadius: "50%", width: 13, height: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>?</div>
                      )}
                      <div onClick={(ev) => { ev.stopPropagation(); toggleCollapse(node.id); }}
                        title={collapsed ? "Expand" : "Minimize"}
                        style={{ cursor: "pointer", color: T.dim, fontSize: 11, lineHeight: 1, padding: "0 2px" }}>
                        {collapsed ? "▢" : "–"}
                      </div>
                      {stack.length > 0 && !isGroup && (
                        <div onClick={(ev) => { ev.stopPropagation(); setAsOutput(node.id); }}
                          title="Set as group output"
                          style={{ cursor: "pointer", color: isOut ? T.group : T.dim, fontSize: 12, lineHeight: 1 }}>◎</div>
                      )}
                      {isGroup && (
                        <div onClick={(ev) => { ev.stopPropagation(); enterGroup(node.id); }}
                          title="Open group" style={{ cursor: "pointer", color: T.group, fontSize: 11, lineHeight: 1 }}>⤵</div>
                      )}
                      <div onClick={(ev) => { ev.stopPropagation(); setSelIds([node.id]); setTimeout(removeSelected, 0); }}
                        style={{ cursor: "pointer", color: T.dim, fontSize: 12, padding: "0 2px", lineHeight: 1 }}>×</div>
                    {helpFor === node.id && !isGroup && (
                      <div onMouseDown={(ev) => ev.stopPropagation()}
                        style={{ padding: "7px 9px", fontSize: 10, lineHeight: 1.55, color: T.text, background: "#12151B", borderBottom: `1px solid ${T.line}`, whiteSpace: "normal" }}>
                        {def.desc || NODE_HELP[node.type] || "No description yet."}
                      </div>
                    )}
                    </div>

                    {/* Data-sisääntuloportit (pino ylhäällä) */}
                    {dataIns.map((pin, i) => {
                      const bound = lvl.bindings && lvl.bindings.some((b) => b.nodeId === node.id && b.port === i);
                      return (
                        <div key={"in" + i} ref={regPort(node.id + "|in:" + i)}
                          onMouseDown={(e) => detachWire(e, node.id, i)}
                          onMouseUp={(e) => finishWire(e, node.id, i, pin.type)}
                          title={(pin.label || "In " + (i + 1)) + (bound ? " · group input" : "")}
                          style={{
                            position: "absolute", left: -7, top: PORT_Y0 - 6 + i * PORT_DY,
                            width: 13, height: 13, borderRadius: "50%",
                            background: bound ? T.group : T.bg,
                            border: `2.5px solid ${bound ? T.group : TYPE_COLOR[pin.type]}`,
                            cursor: "crosshair", zIndex: 2,
                          }} />
                      );
                    })}
                    {dataIns.length > 0 && (
                      <div style={{ position: "absolute", left: 10, top: PORT_Y0 - 7, fontSize: 7.5, color: T.dim, lineHeight: `${PORT_DY}px`, pointerEvents: "none" }}>
                        {dataIns.map((pin, i) => <div key={i} style={{ height: PORT_DY }}>{pin.label || ""}</div>)}
                      </div>
                    )}
                    {/* Minimoituna: param-portit pinona data-porttien alla */}
                    {collapsed && nParams.map((pd, pi) => (
                      <div key={"pp" + pd.key} ref={regPort(node.id + "|p:" + pd.key)}
                        onMouseDown={(e) => detachWire(e, node.id, "p:" + pd.key)}
                        onMouseUp={(e) => finishWire(e, node.id, "p:" + pd.key, "value")}
                        title={pd.label + " (parameter)"}
                        style={{
                          position: "absolute", left: -5, top: PORT_Y0 - 4 + (dataIns.length + pi) * 13,
                          width: 9, height: 9, borderRadius: "50%",
                          background: wiredParams.has(pd.key) ? T.value : T.bg,
                          border: `2px solid ${T.value}`, cursor: "crosshair", zIndex: 2,
                        }} />
                    ))}
                    {/* Ulostuloportit */}
                    {outSpec.map((pin, oi) => (
                      <div key={"out" + oi} ref={regPort(node.id + "|out:" + oi)}
                        onMouseDown={(e) => startWire(e, node.id, oi, pin.type)}
                        title={pin.label ? "Out " + pin.label : "Out"}
                        style={{
                          position: "absolute", right: -7, top: PORT_Y0 - 6 + oi * PORT_DY,
                          width: 13, height: 13, borderRadius: "50%",
                          background: TYPE_COLOR[pin.type], border: `2.5px solid ${T.bg}`, cursor: "crosshair", zIndex: 2,
                        }} />
                    ))}
                    {outSpec.length > 1 && !collapsed && (
                      <div style={{ position: "absolute", right: 10, top: PORT_Y0 - 7, fontSize: 7.5, color: T.dim, lineHeight: `${PORT_DY}px`, textAlign: "right", pointerEvents: "none" }}>
                        {outSpec.map((pin, i) => <div key={i} style={{ height: PORT_DY }}>{pin.label}</div>)}
                      </div>
                    )}

                    {/* Runko (piilossa jos minimoitu) */}
                    {!collapsed && (
                      <>
                        <div style={{ padding: `${Math.max(8, Math.max(dataIns.length, outSpec.length) * PORT_DY - 24)}px 8px 4px` }}>
                          <OutPreview out={outArr} W={canvasW} H={canvasH} width={NODE_W - 16} />
                        </div>
                        <div style={{ padding: "4px 12px 10px" }}>
                          {isGroup ? (
                            <div>
                              <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.5, marginBottom: (node.promoted || []).length ? 8 : 0 }}>
                                {node.data.nodes.map((n) => (DEFS[n.type] ? DEFS[n.type].name : n.type)).join(" · ")}
                                <br />Double-click / ⤵ opens contents {(node.promoted || []).length ? "· ☆ params below" : "· ☆ a param inside to expose it here"}
                              </div>
                              {(node.promoted || []).map((q) => {
                                const inner = node.data.nodes.find((n) => n.id === q.nodeId);
                                const idef = inner && DEFS[inner.type];
                                const pdef = idef && idef.params.find((pp) => pp.key === q.key);
                                if (!inner || !pdef) return null;
                                return (
                                  <div key={q.nodeId + "|" + q.key} style={{ position: "relative" }}>
                                    <span onClick={(e) => {
                                      e.stopPropagation();
                                      setNodesL((ns) => ns.map((n) => n.id === node.id
                                        ? { ...n, promoted: n.promoted.filter((w) => !(w.nodeId === q.nodeId && w.key === q.key)) }
                                        : n));
                                    }} title="Remove from group face"
                                      style={{ position: "absolute", right: 0, top: 0, cursor: "pointer", color: T.dim, fontSize: 10, zIndex: 3 }}>×</span>
                                    <ParamRow
                                      def={{ ...pdef, label: (idef.name) + " · " + pdef.label }}
                                      value={inner.params[q.key]}
                                      wired={false}
                                      onChange={(v) => setNodesL((ns) => ns.map((n) => n.id === node.id
                                        ? { ...n, data: { ...n.data, nodes: n.data.nodes.map((m) => m.id === q.nodeId ? { ...m, params: { ...m.params, [q.key]: v } } : m) } }
                                        : n))} />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            def.params.map((pd) => {
                              const isNum = pd.type === "slider" || pd.type === "number" || pd.type === "seed";
                              return (
                                <ParamRow key={pd.key} def={pd} value={node.params[pd.key]}
                                  wired={wiredParams.has(pd.key)}
                                  liveVal={pvals[node.id] ? pvals[node.id][pd.key] : undefined}
                                  portRef={isNum ? regPort(node.id + "|p:" + pd.key) : null}
                                  portProps={isNum ? {
                                    onMouseDown: (e) => detachWire(e, node.id, "p:" + pd.key),
                                    onMouseUp: (e) => finishWire(e, node.id, "p:" + pd.key, "value"),
                                  } : null}
                                  fileMode={def.fileImage ? "dataurl" : "text"}
                                  fileLabel={def.fileImage ? "Choose image…" : null}
                                  onPromote={stack.length > 0 ? () => {
                                    const gid = stack[stack.length - 1];
                                    setRoot((r) => updateAt(r, stack.slice(0, -1), (lvl) => ({
                                      ...lvl,
                                      nodes: lvl.nodes.map((n) => n.id === gid
                                        ? { ...n, promoted: [...(n.promoted || []).filter((q) => !(q.nodeId === node.id && q.key === pd.key)), { nodeId: node.id, key: pd.key }] }
                                        : n),
                                    })));
                                  } : null}
                                  onFileText={pd.type === "file" && def.fileImage ? (dataUrl, name) => {
                                    const img = new Image();
                                    img.onload = () => {
                                      const MAX = 160;
                                      const sc = Math.min(1, MAX / Math.max(img.width, img.height));
                                      const w = Math.max(2, Math.round(img.width * sc));
                                      const h = Math.max(2, Math.round(img.height * sc));
                                      const cv = document.createElement("canvas");
                                      cv.width = w; cv.height = h;
                                      const cx2 = cv.getContext("2d");
                                      cx2.drawImage(img, 0, 0, w, h);
                                      const d = cx2.getImageData(0, 0, w, h).data;
                                      const g = new Array(w * h);
                                      for (let i = 0; i < w * h; i++) {
                                        /* tummuus 0..1 (1 = musta), alpha valkoiseksi */
                                        const a = d[i * 4 + 3] / 255;
                                        const lum = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
                                        g[i] = (1 - lum) * a;
                                      }
                                      setNodesL((ns) => ns.map((n) => n.id === node.id
                                        ? { ...n, params: { ...n.params, [pd.key]: name }, data: { ...(n.data || {}), img: { w, h, g } } }
                                        : n));
                                    };
                                    img.onerror = () => {
                                      setNodesL((ns) => ns.map((n) => n.id === node.id
                                        ? { ...n, params: { ...n.params, [pd.key]: "Error: could not decode image" } }
                                        : n));
                                    };
                                    img.src = dataUrl;
                                  } : pd.type === "file" && def.onFile ? (text, name) => {
                                    try {
                                      const parsed = def.onFile(text);
                                      setNodesL((ns) => ns.map((n) => n.id === node.id
                                        ? { ...n, params: { ...n.params, [pd.key]: name }, data: { ...(n.data || {}), svg: parsed } }
                                        : n));
                                    } catch (err) {
                                      setNodesL((ns) => ns.map((n) => n.id === node.id
                                        ? { ...n, params: { ...n.params, [pd.key]: "Error: " + err.message } }
                                        : n));
                                    }
                                  } : null}
                                  onChange={(v) => setParam(node.id, pd.key, v)} />
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                    {collapsed && (
                      <div style={{ height: Math.max(10, (dataIns.length * PORT_DY + nParams.length * 13) - 20) }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---------- Tarkastelupaneeli ---------- */}
        <div style={{ width: 340, borderLeft: `1px solid ${T.line}`, background: T.panel, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                PREVIEW {primaryNode ? `— ${primaryIsGroup ? "Group " + primaryNode.id : DEFS[primaryNode.type].name}` : ""}
                {selIds.length > 1 ? ` · ${selIds.length} selected` : ""}
              </div>
              <div onClick={() => primaryPS.paths.length && setBigPreview(true)}
                title="Enlarge preview"
                style={{ cursor: primaryPS.paths.length ? "pointer" : "default", color: primaryPS.paths.length ? T.accent : T.dim, fontSize: 13, lineHeight: 1, padding: "0 2px" }}>
                ⛶
              </div>
            </div>
            {primaryOut && !primaryPS.paths.length && (isStyle(primaryOut[0]) || typeof primaryOut[0] === "number") ? (
              <OutPreview out={primaryOut} W={canvasW} H={canvasH} width={316} />
            ) : (
              <PathsSVG ps={primaryPS} W={canvasW} H={canvasH} width={316} guides={primaryGuides} height={316 * (canvasH / canvasW)} arrows={showArrows} pad={8} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.dim, cursor: "pointer" }}>
                <input type="checkbox" checked={showArrows} onChange={(e) => setShowArrows(e.target.checked)} style={{ accentColor: T.accent }} />
                Show direction
              </label>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 10, color: T.dim, fontVariantNumeric: "tabular-nums", fontFamily: mono, whiteSpace: "nowrap" }}>
                {String(stats.n).padStart(4, "\u2007")} paths · {String(stats.pts).padStart(6, "\u2007")} pts · {(stats.L / 1000).toFixed(2).padStart(6, "\u2007")} m
              </div>
            </div>
          </div>

          <div style={{ padding: 12, borderBottom: `1px solid ${T.line}` }}>
            <div onClick={() => setMchOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 8 }}>
              <div style={{ padding: "10px 14px 4px", borderTop: `1px solid ${T.line}` }}>
              <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", color: T.dim, marginBottom: 6 }}>
                ANIMATE {"\u2014"} frame {String(frameIdx + 1).padStart(String(frameCount).length, "\u2007")}/{frameCount}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: T.dim }}>Frames</span>
                <input type="number" min={1} max={999} value={frameCount}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(999, Math.round(Number(e.target.value) || 1)));
                    setFrameCount(v);
                    setFrameIdx((idx) => Math.min(idx, v - 1));
                  }}
                  style={{ width: 52, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                <button style={toolBtn(true)} onClick={() => setFrameIdx((idx) => (idx - 1 + frameCount) % frameCount)} title="Previous frame">{"\u25C0"}</button>
                <button style={toolBtn(animPlay)} onClick={() => setAnimPlay((v) => !v)} title="Play preview">{animPlay ? "\u25A0" : "\u25B6"}</button>
                <button style={toolBtn(true)} onClick={() => setFrameIdx((idx) => (idx + 1) % frameCount)} title="Next frame">{"\u25B6\u25B6"}</button>
              </div>
              <input type="range" min={0} max={Math.max(0, frameCount - 1)} step={1} value={frameIdx}
                onChange={(e) => { setAnimPlay(false); setFrameIdx(Number(e.target.value)); }}
                style={{ width: "100%", accentColor: T.accent }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => exportAllFrames("gcode")} disabled={!primaryPS.paths.length}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 4, border: `1px solid ${T.line}`, background: "transparent", color: primaryPS.paths.length ? T.text : T.dim, fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
                  G-code {"\u00D7"} {frameCount}
                </button>
                <button onClick={() => exportAllFrames("svg")} disabled={!primaryPS.paths.length}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 4, border: `1px solid ${T.line}`, background: "transparent", color: primaryPS.paths.length ? T.text : T.dim, fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
                  SVG {"\u00D7"} {frameCount}
                </button>
              </div>
              <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.4, marginTop: 5 }}>
                Add a Frame node (math) and wire its outputs into any parameter. Files download one per frame.
              </div>
            </div>
            <div style={{ fontSize: 10, color: T.text, letterSpacing: "0.08em", flex: 1 }}>
                MACHINE SETUP <span style={{ color: T.dim }}>— {prof.name || "unnamed"}</span>
              </div>
              <div style={{ color: T.dim, fontSize: 10 }}>{mchOpen ? "▾" : "▸"}</div>
            </div>
            {mchOpen && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <select value={machineIdx} onChange={(e) => setMachineIdx(+e.target.value)}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "4px 6px", fontSize: 11, fontFamily: mono }}>
                    {machines.map((m, i) => <option key={i} value={i}>{m.name || `machine ${i + 1}`}</option>)}
                  </select>
                  <button onClick={addMachine} title="Add machine (copies current)"
                    style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 3, fontSize: 12, padding: "3px 9px", cursor: "pointer", fontFamily: mono }}>+</button>
                  <button onClick={deleteMachine} disabled={machines.length < 2} title="Delete machine"
                    style={{ background: T.panel2, border: `1px solid ${T.line}`, color: machines.length < 2 ? T.dim : T.text, borderRadius: 3, fontSize: 12, padding: "3px 9px", cursor: machines.length < 2 ? "default" : "pointer", fontFamily: mono }}>−</button>
                  <label title="Import machine profile (.muusia-machine.json)"
                    style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 3, fontSize: 12, padding: "3px 9px", cursor: "pointer", fontFamily: mono }}>
                    ⇣
                    <input type="file" accept=".json,application/json" style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = () => importMachine(String(r.result)); r.readAsText(f); } e.target.value = ""; }} />
                  </label>
                  <button onClick={exportMachine} title="Export machine profile"
                    style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 3, fontSize: 12, padding: "3px 9px", cursor: "pointer", fontFamily: mono }}>⇡</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Machine name</div>
                  <input type="text" value={prof.name} onChange={(e) => setProf((pr) => ({ ...pr, name: e.target.value }))}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                </div>
                {profNum("workW", "Work area W mm")}
                {profNum("workH", "Work area H mm")}
                {profNum("originX", "Origin X mm (canvas on bed)")}
                {profNum("originY", "Origin Y mm (canvas on bed)")}
                {(() => {
                  /* canvas pedilla: tyoalue + canvasin sijainti origon mukaan */
                  const bw = Math.max(1, prof.workW), bh = Math.max(1, prof.workH);
                  const s = 180 / Math.max(bw, bh);
                  const cw2 = canvasW * s, ch2 = canvasH * s;
                  const ox2 = (prof.originX || 0) * s;
                  const oy2 = prof.flipY ? (bh - (prof.originY || 0) - canvasH) * s : (prof.originY || 0) * s;
                  const fits = (prof.originX || 0) >= 0 && (prof.originY || 0) >= 0
                    && (prof.originX || 0) + canvasW <= bw && (prof.originY || 0) + canvasH <= bh;
                  return (
                    <div style={{ margin: "6px 0 8px" }}>
                      <svg width={bw * s + 2} height={bh * s + 2} style={{ display: "block" }}>
                        <rect x={1} y={1} width={bw * s} height={bh * s} fill={T.panel2} stroke={T.line} strokeWidth="1" />
                        <rect x={1 + ox2} y={1 + oy2} width={cw2} height={ch2}
                          fill={fits ? T.accent + "22" : "#E2574A33"} stroke={fits ? T.accent : "#E2574A"} strokeWidth="1.2" />
                        <circle cx={1 + ox2} cy={1 + oy2 + (prof.flipY ? ch2 : 0)} r="2.5" fill={fits ? T.accent : "#E2574A"} />
                      </svg>
                      <div style={{ fontSize: 9, color: fits ? T.dim : "#E2574A", marginTop: 3 }}>
                        {fits ? `Canvas ${canvasW}\u00D7${canvasH} on ${bw}\u00D7${bh} bed \u00B7 dot = canvas origin` : "\u26A0 Canvas exceeds work area \u2014 adjust origin or size"}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, flex: 1 }}>Flip Y (machine Y up)</div>
                  <input type="checkbox" checked={prof.flipY} onChange={(e) => setProf((pr) => ({ ...pr, flipY: e.target.checked }))} style={{ accentColor: T.accent }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Pause command</div>
                  <input type="text" value={prof.pauseCmd} onChange={(e) => setProf((pr) => ({ ...pr, pauseCmd: e.target.value }))}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                </div>
                <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.05em", margin: "10px 0 4px" }}>Z MODE</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <select value={prof.zMode || "bed"} onChange={(e) => setProf((pr) => ({ ...pr, zMode: e.target.value }))}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 11 }}>
                    <option value="servo">A — Servo lifts the pen</option>
                    <option value="bed">B — Bed Z lifts the pen</option>
                  </select>
                </div>
                <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.05em", margin: "10px 0 4px" }}>Z &amp; SPEEDS</div>
                {(prof.zMode || "bed") === "servo" ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Servo name</div>
                      <input type="text" value={prof.servoName || "pen"} onChange={(e) => setProf((pr) => ({ ...pr, servoName: e.target.value }))}
                        style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                    </div>
                    {[["servoUp", "Up angle °"], ["servoDown", "Down angle °"], ["feedDraw", "Draw F"], ["feedTravel", "Travel F"], ["penDelayDown", "Settle down ms"], ["penDelayUp", "Settle up ms"]].map(([k, l]) => profNum(k, l))}
                    <div style={{ fontSize: 9, color: T.dim, marginBottom: 5 }}>Klipper: SET_SERVO SERVO={prof.servoName || "pen"} ANGLE=… — define [servo {prof.servoName || "pen"}] in printer.cfg. Dip uses the servo too.</div>
                  </>
                ) : (
                  <>
                    {[["penDown", "Contact Z mm"], ["penUp", "Lift Z mm"], ["zHop", "Z-hop travel mm"], ["feedDraw", "Draw F"], ["feedTravel", "Travel F"], ["zFeed", "Z feed F"], ["penDelayDown", "Settle down ms"], ["penDelayUp", "Settle up ms"]].map(([k, l]) => profNum(k, l))}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: T.dim, flex: 1 }}>Z-hop travel lift (bed plotters)</div>
                      <input type="checkbox" checked={prof.zHopOn} onChange={(e) => setProf((pr) => ({ ...pr, zHopOn: e.target.checked }))} style={{ accentColor: T.accent }} />
                    </div>
                  </>
                )}
                <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.05em", margin: "10px 0 4px" }}>START G-CODE</div>
                <textarea value={prof.startG} spellCheck={false}
                  onChange={(e) => setProf((pr) => ({ ...pr, startG: e.target.value }))}
                  style={{ width: "100%", height: 54, background: "#12151B", color: "#9FB3D1", border: `1px solid ${T.line}`, borderRadius: 4, fontFamily: mono, fontSize: 10, padding: 6, resize: "vertical", lineHeight: 1.5 }} />
                <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.05em", margin: "8px 0 4px" }}>END G-CODE</div>
                <textarea value={prof.endG} spellCheck={false}
                  onChange={(e) => setProf((pr) => ({ ...pr, endG: e.target.value }))}
                  style={{ width: "100%", height: 40, background: "#12151B", color: "#9FB3D1", border: `1px solid ${T.line}`, borderRadius: 4, fontFamily: mono, fontSize: 10, padding: 6, resize: "vertical", lineHeight: 1.5 }} />
              </>
            )}
            {mchOpen && (
              <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 6px" }}>
              <input type="checkbox" checked={prof.rotOn} onChange={(e) => setProf((p) => ({ ...p, rotOn: e.target.checked }))} style={{ accentColor: T.accent }} />
              <div style={{ fontSize: 10, color: T.text, letterSpacing: "0.05em" }}>BRUSH ROTATION</div>
            </div>
            {prof.rotOn && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Stepper name</div>
                  <input type="text" value={prof.rotStepper} onChange={(e) => setProf((p) => ({ ...p, rotStepper: e.target.value }))}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                </div>
                {profNum("rotThresh", "Threshold °")}
                <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.4, marginBottom: 4 }}>
                  Direction is read from the paths (direction lives in the data). Rotates before each stroke + whenever direction changes beyond the threshold.
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 6px" }}>
              <input type="checkbox" checked={prof.dipOn} onChange={(e) => setProf((p) => ({ ...p, dipOn: e.target.checked }))} style={{ accentColor: T.accent }} />
              <div style={{ fontSize: 10, color: T.text, letterSpacing: "0.05em" }}>DIP (service point)</div>
            </div>
            {prof.dipOn && (
              <>
                {profNum("dipX", "Dip X mm")}
                {profNum("dipY", "Dip Y mm")}
                {profNum("dipZ", "Dip Z mm")}
                {profNum("dipEvery", "Interval mm (drawn)")}
                {profNum("dipDwell", "Dwell ms")}
                <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.4, marginBottom: 4 }}>
                  Machine coordinates — may be outside the canvas. Dips between paths (never mid-stroke), at start, and after each pen change.
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 6px" }}>
              <input type="checkbox" checked={prof.maintOn} onChange={(e) => setProf((p) => ({ ...p, maintOn: e.target.checked }))} style={{ accentColor: T.accent }} />
              <div style={{ fontSize: 10, color: T.text, letterSpacing: "0.05em" }}>MAINTENANCE PAUSE (wearing media)</div>
            </div>
            {prof.maintOn && (
              <>
                {profNum("maintEvery", "Interval mm (drawn)")}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, width: 110 }}>Pause message</div>
                  <input type="text" value={prof.maintMsg} onChange={(e) => setProf((p) => ({ ...p, maintMsg: e.target.value }))}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 11, fontFamily: mono }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: T.dim, flex: 1 }}>Park during pause (else stay in place)</div>
                  <input type="checkbox" checked={prof.maintPark} onChange={(e) => setProf((p) => ({ ...p, maintPark: e.target.checked }))} style={{ accentColor: T.accent }} />
                </div>
                {prof.maintPark && profNum("maintX", "Park X mm")}
                {prof.maintPark && profNum("maintY", "Park Y mm")}
                <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.4, marginBottom: 4 }}>
                  For chalk, charcoal, soft graphite: lifts the pen and pauses ({prof.pauseCmd || "M0"}) so you can advance or sharpen the media, then resume. Staying in place preserves registration; parking uses SAVE/RESTORE_GCODE_STATE (Klipper) to return exactly.
                </div>
              </>
            )}
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.text, cursor: "pointer" }}>
                <input type="checkbox" checked={routeOpt} onChange={(e) => setRouteOpt(e.target.checked)} style={{ accentColor: T.accent }} />
                Optimize route
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: routeOpt ? T.text : T.dim, cursor: "pointer" }}>
                <input type="checkbox" checked={preserveDir} disabled={!routeOpt} onChange={(e) => setPreserveDir(e.target.checked)} style={{ accentColor: T.accent }} />
                Preserve direction
              </label>
            </div>
            <button onClick={doExport} disabled={!primaryPS.paths.length}
              style={{
                width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 5, border: "none",
                background: primaryPS.paths.length ? T.accent : T.line, color: primaryPS.paths.length ? "#0D1117" : T.dim,
                fontFamily: disp, fontWeight: 700, fontSize: 12, cursor: primaryPS.paths.length ? "pointer" : "default", letterSpacing: "0.03em",
              }}>
              GENERATE G-CODE (selected node)
            </button>
            <button onClick={doExportSVG} disabled={!primaryPS.paths.length}
              style={{
                width: "100%", marginTop: 6, padding: "7px 0", borderRadius: 5,
                border: `1px solid ${primaryPS.paths.length ? T.accent : T.line}`,
                background: "transparent", color: primaryPS.paths.length ? T.accent : T.dim,
                fontFamily: disp, fontWeight: 700, fontSize: 11, cursor: primaryPS.paths.length ? "pointer" : "default", letterSpacing: "0.03em",
              }}>
              EXPORT SVG (laser / vector)
            </button>
          </div>

          {gcode && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 12, minHeight: 200 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.08em", flex: 1 }}>
                  {exportKind === "svg" ? "SVG" : "G-CODE"} · {gcode.split("\n").length} lines
                </div>
                <button onClick={copyGcode}
                  style={{ background: copied ? T.value : T.panel2, border: `1px solid ${T.line}`, color: copied ? "#0D1117" : T.text, borderRadius: 4, fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: mono, marginRight: 6 }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={download}
                  style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 4, fontSize: 10, padding: "3px 10px", cursor: "pointer", fontFamily: mono }}>
                  Download {exportKind === "svg" ? ".svg" : ".gcode"}
                </button>
                <button onClick={() => setGcode(null)}
                  style={{ background: "none", border: "none", color: T.dim, fontSize: 12, cursor: "pointer", marginLeft: 6 }}>×</button>
              </div>
              <textarea readOnly value={gcode} ref={gcodeRef}
                style={{
                  flex: 1, minHeight: 160, background: "#12151B", color: "#9FB3D1", border: `1px solid ${T.line}`,
                  borderRadius: 5, fontFamily: mono, fontSize: 10, padding: 8, resize: "none", lineHeight: 1.5,
                }} />
            </div>
          )}
        </div>
      </div>

      {/* ---------- Help & Examples ---------- */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.55)", zIndex: 96, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 640, maxWidth: "92vw", maxHeight: "84vh", overflowY: "auto", background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.55)", padding: "18px 22px" }}>
            <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 16, marginBottom: 2 }}>MUUSIA — Help</div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 14 }}>Node-graph editor for generative pen-plotter art</div>

            <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: T.accent, margin: "10px 0 4px" }}>EXAMPLES — START HERE</div>
            {EXAMPLES.map((ex, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 5, background: T.panel2, marginBottom: 5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontFamily: mono, color: T.text }}>{ex.name}</div>
                  <div style={{ fontSize: 10, color: T.dim }}>{ex.desc}</div>
                </div>
                <button onClick={() => loadExample(ex)}
                  style={{ padding: "4px 12px", borderRadius: 4, border: `1px solid ${T.accent}66`, background: T.accent + "22", color: T.text, fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
                  Load
                </button>
              </div>
            ))}
            <div style={{ fontSize: 10, color: T.dim, marginBottom: 12 }}>Loading an example replaces the current patch — save yours first (Save button).</div>

            {[
              ["KEYBOARD SHORTCUTS", [
                "G / M / D / C / X \u2014 quick-add search: Generators / Modifiers / Decorators / Combiners / Math \u00B7 N \u2014 all nodes. Type to filter, \u2191\u2193 + Enter places the node.",
                "Space \u2014 toggle large preview (with route simulator).",
                "Cmd/Ctrl+Z \u2014 undo \u00B7 Shift+Cmd/Ctrl+Z \u2014 redo.",
                "Cmd/Ctrl+D \u2014 duplicate selection \u00B7 Cmd/Ctrl+G \u2014 group selection into a subgraph.",
                "Delete / Backspace \u2014 remove selection \u00B7 Esc \u2014 close overlays / clear selection.",
                "Shift+click \u2014 add to selection \u00B7 drag on empty canvas \u2014 rubber-band select \u00B7 double-click a group \u2014 open it.",
              ]],
              ["BASICS", [
                "Drag nodes from the left palette to the canvas, or press G/M/D/C/X/N for quick-add search.",
                "Wire outputs (right side of a node) to inputs (left side). Blue = paths, green = numbers, yellow = stroke style.",
                "Every numeric parameter has a green input port \u2014 wire Value, Random, Math or Frame into it to modulate.",
                "Click a node to select: the right panel shows its live preview and parameters. Space toggles a large preview.",
                "Cmd/Ctrl+Z undo \u00B7 Shift+Cmd+Z redo \u00B7 Delete removes selection \u00B7 Cmd+G groups selection.",
              ]],
              ["EXPORT & MACHINE", [
                "Machine Setup holds work area, origin, Z heights and speeds per machine \u2014 the active machine is used for G-code.",
                "Optimize route reorders paths to minimize pen travel; Preserve direction keeps stroke direction (for brushes).",
                "GENERATE G-CODE exports the selected node's output. EXPORT SVG gives layered vector output for laser/other tools.",
                "Point order = pen direction. It is data: Reverse, routing and brush rotation all respect it.",
              ]],
              ["ANIMATION", [
                "Set frame count in ANIMATE, add a Frame node (Math category), wire its outputs into any parameter.",
                "t ramps 0\u21921 across frames; wave & ping-pong are seamless loops; frame # feeds Seeds for per-paper randomness.",
                "\u25B6 previews the animation live. G-code \u00D7 N downloads one file per frame \u2014 plot each on its own paper, scan, assemble.",
                "Anything not wired to Frame is identical on every frame. Add Reg Marks for scan alignment.",
              ]],
              ["CUSTOM NODES", [
                "Node \u2913 imports a node definition file (.js). See MUUSIA-NODE-API.md \u2014 you can hand that spec to an AI and import the result.",
                "Custom node sources are embedded in saved patches, so patches stay self-contained. Remove custom nodes with \u00D7 in the palette.",
                "Mod \u2913/\u2912 exports/imports a selection as a reusable module (subgraph).",
              ]],
            ].map(([title, items]) => (
              <div key={title}>
                <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: T.accent, margin: "12px 0 4px" }}>{title}</div>
                {items.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: T.text, lineHeight: 1.5, marginBottom: 3 }}>{"\u2022"} {s}</div>
                ))}
              </div>
            ))}
            <div style={{ marginTop: 14, textAlign: "right" }}>
              <button onClick={() => setHelpOpen(false)}
                style={{ padding: "6px 16px", borderRadius: 5, border: `1px solid ${T.line}`, background: T.panel2, color: T.text, fontSize: 11, fontFamily: mono, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Pikahaku (G/M/D/C/X/N) ---------- */}
      {quickAdd && (() => {
        const list = Object.entries(DEFS).filter(([, d]) =>
          !d.hidden &&
          (quickAdd.cat === null || d.cat === quickAdd.cat) &&
          d.name.toLowerCase().includes(quickAdd.query.toLowerCase()));
        const sel = Math.min(quickAdd.sel, Math.max(0, list.length - 1));
        const addSelected = (type) => {
          const cx = areaRef.current ? (areaRef.current.scrollLeft + areaRef.current.clientWidth / 2) / zoom - NODE_W / 2 : 120;
          const cy = areaRef.current ? (areaRef.current.scrollTop + areaRef.current.clientHeight / 2) / zoom - 100 : 120;
          addNodeAt(type, Math.max(0, cx), Math.max(0, cy));
          setQuickAdd(null);
        };
        const catLabel = quickAdd.cat === null ? "All nodes" : (CATS[quickAdd.cat] ? CATS[quickAdd.cat].label : quickAdd.cat);
        return (
          <div onClick={() => setQuickAdd(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(10,12,16,0.5)", zIndex: 95, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "18vh" }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: 320, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px 4px", fontSize: 9, color: T.dim, letterSpacing: "0.1em" }}>{catLabel.toUpperCase()}</div>
              <input autoFocus type="text" value={quickAdd.query} placeholder="Search nodes…"
                onChange={(e) => setQuickAdd((q) => ({ ...q, query: e.target.value, sel: 0 }))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setQuickAdd(null); }
                  else if (e.key === "ArrowDown") { e.preventDefault(); setQuickAdd((q) => ({ ...q, sel: Math.min(list.length - 1, q.sel + 1) })); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setQuickAdd((q) => ({ ...q, sel: Math.max(0, q.sel - 1) })); }
                  else if (e.key === "Enter" && list[sel]) { addSelected(list[sel][0]); }
                }}
                style={{ width: "100%", background: T.panel2, color: T.text, border: "none", borderBottom: `1px solid ${T.line}`, padding: "8px 12px", fontSize: 13, fontFamily: mono, outline: "none", boxSizing: "border-box" }} />
              <div style={{ maxHeight: 300, overflowY: "auto", padding: 6 }}>
                {list.map(([type, d], i) => (
                  <div key={type} onClick={() => addSelected(type)}
                    onMouseEnter={() => setQuickAdd((q) => ({ ...q, sel: i }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4, cursor: "pointer",
                      background: i === sel ? T.accent + "22" : "transparent",
                      border: i === sel ? `1px solid ${T.accent}66` : "1px solid transparent",
                    }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: (CATS[d.cat] || {}).color || T.dim, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: T.text, fontFamily: mono }}>{d.name}</div>
                    <div style={{ fontSize: 9, color: T.dim }}>{(CATS[d.cat] || {}).label || d.cat}</div>
                  </div>
                ))}
                {!list.length && <div style={{ padding: 10, fontSize: 11, color: T.dim }}>No matches</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------- Iso esikatselu (overlay) ---------- */}
      {bigPreview && (
        <div onClick={() => setBigPreview(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(10,12,16,0.88)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12,
          }}>
          <div onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6)", borderRadius: 6 }}>
            {simOn ? (
              <SimView ps={routeOpt ? routeOptimize(primaryPS, preserveDir) : primaryPS} W={canvasW} H={canvasH}
                width={Math.min(window.innerWidth - 100, (window.innerHeight - 190) * (canvasW / canvasH))}
                height={Math.min(window.innerHeight - 190, (window.innerWidth - 100) * (canvasH / canvasW))} />
            ) : (
              <PathsSVG ps={primaryPS} W={canvasW} H={canvasH}
                width={Math.min(window.innerWidth - 100, (window.innerHeight - 140) * (canvasW / canvasH))}
                height={Math.min(window.innerHeight - 140, (window.innerWidth - 100) * (canvasH / canvasW))}
                arrows={showArrows} pad={16} guides={primaryGuides} />
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: T.dim }}>
            <button onClick={() => setSimOn((v) => !v)}
              style={{
                background: simOn ? T.accent : T.panel2, border: `1px solid ${simOn ? T.accent : T.line}`,
                color: simOn ? "#0D1117" : T.text, borderRadius: 4, fontSize: 10, padding: "4px 12px",
                cursor: "pointer", fontFamily: mono, fontWeight: 700,
              }}>
              {simOn ? "◼ Simulate" : "▶ Simulate"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="checkbox" checked={showArrows} onChange={(e) => setShowArrows(e.target.checked)} style={{ accentColor: T.accent }} />
              Show direction
            </label>
            <div style={{ fontVariantNumeric: "tabular-nums", fontFamily: mono, whiteSpace: "nowrap" }}>{String(stats.n).padStart(4, "\u2007")} paths · {(stats.L / 1000).toFixed(2).padStart(6, "\u2007")} m</div>
            <button onClick={() => setBigPreview(false)}
              style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 4, fontSize: 10, padding: "4px 12px", cursor: "pointer", fontFamily: mono }}>
              Close (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
