import React, { useState, useRef, useMemo, useEffect } from "react";
import { DEFS_NODES } from "./defs/index.js";
import { PENS_DEFAULT, PENS, savePens, resetPens, mulberry32, hash2, noise2, EMPTY, pathLength, resample, applyStyle, Pin, parseSVG, signedArea, SFONT, fontStrokes, isStyle } from "./defs/helpers.js";

/* ============================================================
   MUUSIA v2.20
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

const mono = "'IBM Plex Mono','SFMono-Regular',Consolas,monospace";
const disp = "'Space Grotesk','Segoe UI',sans-serif";

const TYPE_COLOR = { paths: T.accent, value: T.value, style: T.style };

/* ---------- RNG + noise ---------- */

/* ---------- Path helpers ---------- */
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


/* yksiviivafontin renderointi: palauttaa vedot origossa (y 0..10 -ruudukko skaalattuna) */

const DEFS = {
  ...DEFS_NODES,
  group: {
    name: "Group", cat: "duo", hidden: true,
    ins: (node) => (node && node.data ? node.data.bindings.map((b, i) => Pin(bindingType(node, b), "In " + (i + 1))) : []),
    outs: (node) => [Pin(node && node.data ? groupOutType(node) : "paths")],
    params: [],
    compute() { return EMPTY; },
  

  },
































































































  reititys: {
    name: "Route", cat: "route", hidden: true, ins: [Pin("paths")], outs: [Pin("paths")],
    params: [{ key: "preserve", label: "Preserve direction", type: "check", def: true }],
    compute(ins, p) { return routeOptimize(ins[0] || EMPTY, p.preserve); },
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
  potato: "asymmetric blobs (low-frequency harmonics + random squash); No overlap placement keeps potatoes fully separated (default), Loose allows touching; optional eyes as dots or arcs.",
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
  smooth: "Relax: arc-length moving average (Radius mm) that visibly smooths dense paths, endpoints pinned. Round corners: Chaikin corner-cutting for sparse polylines.",
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

/* --- Minimal ZIP builder (STORE, no compression) so multi-tile export is ONE
   download — browsers block sequential programmatic downloads. --- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function buildZip(files) { /* files: [{name, text}] -> Uint8Array */
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 255, (v >> 8) & 255];
  const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const local = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)
    ]);
    parts.push(local, name, data);
    central.push({ name, data, crc, offset });
    offset += local.length + name.length + data.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const hdr = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(e.crc), ...u32(e.data.length), ...u32(e.data.length), ...u16(e.name.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.offset)
    ]);
    parts.push(hdr, e.name);
    offset += hdr.length + e.name.length;
  }
  const end = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
    ...u32(offset - cdStart), ...u32(cdStart), ...u16(0)
  ]);
  parts.push(end);
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

/* --- Mega canvas slicer: clips mega-space paths into per-sheet tiles.
   mode Overlap: tile regions share a seam-wide strip (cut through it, butt-join).
   mode Gap: a seam-wide strip between regions is skipped (mount with spacing).
   marks: L-shaped crop marks at the corners of each tile's cut rectangle. --- */
function sliceMega(ps, sw, sh, C, R, seam, mode, marks, markPen = 0) {
  const gap = mode === "Gap";
  const strideX = gap ? sw + seam : sw - seam;
  const strideY = gap ? sh + seam : sh - seam;
  const tiles = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const x0 = c * strideX, y0 = r * strideY;
      const clipSeg = (ax, ay, bx, by) => {
        let t0 = 0, t1 = 1;
        const dx = bx - ax, dy = by - ay;
        const P = [-dx, dx, -dy, dy];
        const Q = [ax - x0, x0 + sw - ax, ay - y0, y0 + sh - ay];
        for (let i = 0; i < 4; i++) {
          if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return null; }
          else {
            const rr = Q[i] / P[i];
            if (P[i] < 0) { if (rr > t1) return null; if (rr > t0) t0 = rr; }
            else { if (rr < t0) return null; if (rr < t1) t1 = rr; }
          }
        }
        return [ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1, t1];
      };
      const paths = [];
      for (const pa of ps.paths) {
        const allIn = pa.pts.every(([x, y]) => x >= x0 && x <= x0 + sw && y >= y0 && y <= y0 + sh);
        if (allIn) {
          paths.push({ pts: pa.pts.map(([x, y]) => [x - x0, y - y0]), closed: pa.closed, layer: pa.layer });
          continue;
        }
        const src = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: pa.layer }); run = []; };
        for (let i = 1; i < src.length; i++) {
          const cseg = clipSeg(src[i - 1][0], src[i - 1][1], src[i][0], src[i][1]);
          if (!cseg) { flush(); continue; }
          const A = [cseg[0] - x0, cseg[1] - y0], B = [cseg[2] - x0, cseg[3] - y0];
          if (run.length && Math.hypot(run[run.length - 1][0] - A[0], run[run.length - 1][1] - A[1]) < 1e-6) {
            run.push(B);
          } else {
            flush();
            run = [A, B];
          }
          if (cseg[4] < 1) flush(); /* exited the tile mid-segment */
        }
        flush();
      }
      if (marks) {
        const iL = (!gap && c > 0) ? seam / 2 : 0;
        const iR = (!gap && c < C - 1) ? seam / 2 : 0;
        const iT = (!gap && r > 0) ? seam / 2 : 0;
        const iB = (!gap && r < R - 1) ? seam / 2 : 0;
        const cx0 = iL, cx1 = sw - iR, cy0 = iT, cy1 = sh - iB;
        const MK = 4;
        const LP = Math.max(0, Math.round(markPen));
        const corner = (x, y, dxs, dys) => {
          paths.push({ pts: [[x, y], [x + MK * dxs, y]], closed: false, layer: LP });
          paths.push({ pts: [[x, y], [x, y + MK * dys]], closed: false, layer: LP });
        };
        corner(cx0, cy0, 1, 1); corner(cx1, cy0, -1, 1);
        corner(cx1, cy1, -1, -1); corner(cx0, cy1, 1, -1);
      }
      tiles.push({ paths });
    }
  }
  return tiles;
}

/* ---- Magnet placement: grid cells, exact clearance, chamfer ranking ---- */
function magnetPlacement(ps, sw, sh, opts) {
  const N = Math.max(1, Math.round(opts.magnets || 5));
  const G = Math.max(2, opts.grid || 10);
  const CLR = Math.max(0, opts.clearance || 12);
  const MRG = Math.max(0, opts.magnetMargin || 10);
  const SPC = Math.max(0, opts.minSpacing || 40);
  const cols = Math.floor(sw / G), rows = Math.floor(sh / G);
  if (cols < 1 || rows < 1) return { positions: [], error: "sheet smaller than one grid cell" };
  /* segments */
  const segs = [];
  for (const pa of (ps && ps.paths) || []) {
    const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
    for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
  }
  /* segment buckets for exact near-queries */
  const bs = Math.max(G, CLR) + 1;
  const buckets = new Map();
  segs.forEach((s, i) => {
    const sx0 = Math.min(s[0], s[2]) - CLR, sx1 = Math.max(s[0], s[2]) + CLR;
    const sy0 = Math.min(s[1], s[3]) - CLR, sy1 = Math.max(s[1], s[3]) + CLR;
    for (let by = Math.floor(sy0 / bs); by <= Math.floor(sy1 / bs); by++)
      for (let bx = Math.floor(sx0 / bs); bx <= Math.floor(sx1 / bs); bx++) {
        const k = bx + "," + by;
        let a = buckets.get(k); if (!a) { a = []; buckets.set(k, a); }
        a.push(i);
      }
  });
  const segDist2 = (x, y, s) => {
    const dx = s[2] - s[0], dy = s[3] - s[1];
    const L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const ddx = x - (s[0] + dx * t), ddy = y - (s[1] + dy * t);
    return ddx * ddx + ddy * ddy;
  };
  const clearOf = (x, y) => { /* exact: no segment within CLR */
    const a = buckets.get(Math.floor(x / bs) + "," + Math.floor(y / bs));
    if (!a) return true;
    for (const i of a) if (segDist2(x, y, segs[i]) < CLR * CLR) return false;
    return true;
  };
  /* occupancy raster for chamfer ranking distance */
  const occ = new Uint8Array(cols * rows);
  const mark = (x, y) => {
    const c = Math.floor(x / G), r = Math.floor(y / G);
    if (c >= 0 && c < cols && r >= 0 && r < rows) occ[r * cols + c] = 1;
  };
  for (const s of segs) {
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
    const n = Math.max(1, Math.ceil(len / (G * 0.5)));
    for (let i = 0; i <= n; i++) mark(s[0] + ((s[2] - s[0]) * i) / n, s[1] + ((s[3] - s[1]) * i) / n);
  }
  /* two-pass chamfer distance (grid units, 1 / 1.414) */
  const INF = 1e9;
  const D = new Float32Array(cols * rows).fill(INF);
  for (let i = 0; i < cols * rows; i++) if (occ[i]) D[i] = 0;
  const at = (r, c) => (r < 0 || r >= rows || c < 0 || c >= cols ? INF : D[r * cols + c]);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    D[i] = Math.min(D[i], at(r, c - 1) + 1, at(r - 1, c) + 1, at(r - 1, c - 1) + 1.414, at(r - 1, c + 1) + 1.414);
  }
  for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
    const i = r * cols + c;
    D[i] = Math.min(D[i], at(r, c + 1) + 1, at(r + 1, c) + 1, at(r + 1, c + 1) + 1.414, at(r + 1, c - 1) + 1.414);
  }
  /* candidates: margins + exact clearance */
  const cand = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) * G, y = (r + 0.5) * G;
    if (x < MRG || x > sw - MRG || y < MRG || y > sh - MRG) continue;
    if (!clearOf(x, y)) continue;
    /* empty drawing: rank by distance to sheet edge so magnets spread from center */
    const d = segs.length ? D[r * cols + c] * G : Math.min(x, y, sw - x, sh - y);
    cand.push({ x, y, d, i: r * cols + c });
  }
  if (!cand.length) {
    return { positions: [], error: "not enough safe space — reduce clearance / magnet margin / magnet count" };
  }
  /* greedy: farthest-from-art first, stable tie-break by cell index */
  cand.sort((a, b) => (b.d - a.d) || (a.i - b.i));
  const chosen = [];
  for (const q of cand) {
    if (chosen.length >= N) break;
    let ok = true;
    for (const c of chosen) if (Math.hypot(q.x - c[0], q.y - c[1]) < SPC) { ok = false; break; }
    if (ok) chosen.push([q.x, q.y]);
  }
  const error = chosen.length < N
    ? `only ${chosen.length} of ${N} safe positions found — reduce magnet margin / clearance / spacing or magnet count`
    : null;
  return { positions: chosen, error };
}

/* ---- Jig g-code: pen up, laser on, visit each position, M0 stops ---- */
function jigGcode(positions, prof, sheetW, sheetH, label) {
  const f2 = (v) => Math.round(v * 100) / 100;
  const oX = prof.originX || 0, oY = prof.originY || 0;
  const fx = (x) => x + oX;
  const fy = (y) => (prof.flipY ? sheetH - y : y) + oY;
  const lx = prof.laserOffX || 0, ly = prof.laserOffY || 0;
  const lines = [];
  const warnings = [];
  lines.push(`; Muusia v${APP_VERSION} — MAGNET JIG (no pen-down moves)`);
  lines.push(`; ${label || "sheet"} — ${positions.length} magnet position${positions.length === 1 ? "" : "s"}`);
  lines.push(`; Machine: ${prof.name || "unnamed"} — laser offset X${f2(lx)} Y${f2(ly)} from pen tip`);
  lines.push(`; Workflow: laser points at each magnet spot — drop a magnet, press continue (${prof.pauseCmd || "M0"})`);
  for (const l of String(prof.startG || "").split("\n")) if (l.trim()) lines.push(l);
  if ((prof.zMode || "bed") === "servo") lines.push(`SET_SERVO SERVO=${prof.servoName || "pen"} ANGLE=${f2(prof.servoUp)} ; pen up (stays up)`);
  else lines.push(`G1 Z${f2(prof.penUp)} F${prof.zFeed || 600} ; pen up (stays up)`);
  for (const l of String(prof.laserOnCmd || "").split("\n")) if (l.trim()) lines.push(l);
  positions.forEach(([x, y], k) => {
    const px = x - lx, py = y - ly; /* pen goes to position minus offset */
    const gx = fx(px), gy = fy(py);
    if (gx < 0 || gx > (prof.workW || 1e9) || gy < 0 || gy > (prof.workH || 1e9)) {
      warnings.push(`magnet ${k + 1}: pen target X${f2(gx)} Y${f2(gy)} outside work area`);
      lines.push(`; WARNING: next move outside work area (laser offset pushes pen off-bed)`);
    }
    lines.push(`G1 X${f2(gx)} Y${f2(gy)} F${prof.feedTravel || 6000} ; laser on magnet ${k + 1}/${positions.length} at ${f2(x)},${f2(y)}`);
    lines.push(`${prof.pauseCmd || "M0"} ; MAGNET ${k + 1}/${positions.length}: place magnet at laser dot, then continue`);
  });
  for (const l of String(prof.laserOffCmd || "").split("\n")) if (l.trim()) lines.push(l);
  for (const l of String(prof.endG || "").split("\n")) if (l.trim()) lines.push(l);
  return { text: lines.join("\n") + "\n", warnings };
}

const APP_VERSION = "2.27"; /* single source: shown in the UI header and stamped into G-code */

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
      lines.push(`${prof.pauseCmd || "M0"} ; CHANGE PEN -> ${L % PENS.length}: ${PENS[L % PENS.length].name}`);
      if (prof.dipOn) { dip(); drawn = 0; }
    } else lines.push(`; Pen ${L % PENS.length}: ${PENS[L % PENS.length].name}`);
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

function ZoomBox({ children, width, height }) {
  const [z, setZ] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef(null);
  const onWheel = (e) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const nz = Math.max(1, Math.min(16, z * Math.exp(-e.deltaY * 0.0015)));
    const k = nz / z;
    setZ(nz);
    setTx(nz === 1 ? 0 : mx - (mx - tx) * k);
    setTy(nz === 1 ? 0 : my - (my - ty) * k);
  };
  const onMouseDown = (e) => {
    if (z <= 1) return;
    const t = (e.target.tagName || "").toLowerCase();
    if (t === "circle" || t === "text") return; /* magnet handles keep their own drag */
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onMouseMove = (e) => {
    if (!drag.current) return;
    setTx(drag.current.tx + (e.clientX - drag.current.x));
    setTy(drag.current.ty + (e.clientY - drag.current.y));
  };
  const end = () => { drag.current = null; };
  return (
    <div onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={end} onMouseLeave={end}
      onDoubleClick={() => { setZ(1); setTx(0); setTy(0); }}
      style={{ overflow: "hidden", width, height, cursor: z > 1 ? "grab" : "default", position: "relative" }}>
      <div style={{ transform: "translate(" + tx + "px, " + ty + "px) scale(" + z + ")", transformOrigin: "0 0", width, height }}>
        {children}
      </div>
      {z > 1 && (
        <div style={{ position: "absolute", right: 4, bottom: 4, fontSize: 9, color: T.dim, background: T.panel2 + "cc", padding: "1px 5px", borderRadius: 3, pointerEvents: "none" }}>
          {z.toFixed(1)}x · dblclick reset
        </div>
      )}
    </div>
  );
}
function PathsSVG({ ps, W, H, width, height, arrows = false, pad = 4, guides = null, magnets = null, onMagnets = null, placing = false }) {
  const sx = (width - pad * 2) / W, sy = (height - pad * 2) / H;
  const s = Math.min(sx, sy);
  const ox = (width - W * s) / 2, oy = (height - H * s) / 2;
  const dragRef = useRef(-1);
  const toMM = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = r.width / width; /* CSS transform aware (ZoomBox) */
    return [((e.clientX - r.left) / k - ox) / s, ((e.clientY - r.top) / k - oy) / s];
  };
  const q1 = (v) => Math.round(v * 10) / 10;
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
  /* magneettikerros: suora interaktiivinen overlay (ei guides-kanavaa) */
  const M = "#3FA7FF";
  const mEls = [];
  (magnets || []).forEach(([mx, my], i) => {
    const px = ox + mx * s, py = oy + my * s;
    const rr = Math.max(7, 6 * s);
    mEls.push(
      <g key={"m" + i}
        onPointerDown={onMagnets ? (e) => {
          e.stopPropagation();
          dragRef.current = i;
          const svg = e.currentTarget.ownerSVGElement;
          if (svg && svg.setPointerCapture) try { svg.setPointerCapture(e.pointerId); } catch (err) {}
        } : undefined}
        onDoubleClick={onMagnets ? (e) => { e.stopPropagation(); onMagnets(magnets.filter((_, k) => k !== i)); } : undefined}
        style={{ cursor: onMagnets ? "grab" : "default" }}
        stroke={M} strokeWidth="1.6" opacity="0.95">
        <circle cx={px} cy={py} r={rr} fill="rgba(63,167,255,0.16)" />
        <line x1={px - 4.5} y1={py} x2={px + 4.5} y2={py} />
        <line x1={px} y1={py - 4.5} x2={px} y2={py + 4.5} />
        <text x={px + rr + 3} y={py + 3.5} fontSize="10" fill={M} stroke="none" fontFamily="ui-monospace, monospace">{i + 1}</text>
      </g>
    );
  });
  return (
    <svg width={width} height={height}
      style={{ display: "block", background: T.paper, borderRadius: 4, touchAction: "none", cursor: placing && onMagnets ? "crosshair" : "default" }}
      onPointerDown={placing && onMagnets ? (e) => {
        const [mx, my] = toMM(e);
        if (mx >= 0 && mx <= W && my >= 0 && my <= H) onMagnets([...(magnets || []), [q1(mx), q1(my)]]);
      } : undefined}
      onPointerMove={onMagnets ? (e) => {
        const i = dragRef.current;
        if (i < 0) return;
        const [mx, my] = toMM(e);
        onMagnets(magnets.map((q, k) => k === i ? [q1(Math.min(W, Math.max(0, mx))), q1(Math.min(H, Math.max(0, my)))] : q));
      } : undefined}
      onPointerUp={onMagnets ? () => { dragRef.current = -1; } : undefined}>
      <rect x={ox} y={oy} width={W * s} height={H * s} fill="none" stroke={T.paperLine} strokeWidth="1" />
      {els}
      {gEls}
      {mEls}
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
        <div style={{ display: "flex", gap: 3, flex: 1, flexWrap: "wrap" }}>
          {PENS.map((pen, i) => (
            <div key={i} onClick={() => onChange(i)} title={i + ": " + pen.name}
              style={{
                width: 13, height: 13, borderRadius: "50%", background: pen.c, cursor: "pointer",
                border: value === i ? "2px solid " + T.accent : "2px solid transparent",
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
  /* --- Mega canvas: compose works larger than one sheet; export slices into numbered tiles --- */
  const [megaOn, setMegaOn] = useState(false);
  const [megaC, setMegaC] = useState(2);   /* columns of sheets */
  const [megaR, setMegaR] = useState(2);   /* rows of sheets */
  const [megaSeam, setMegaSeam] = useState(5);
  const [megaMode, setMegaMode] = useState("Overlap"); /* Overlap: sheets repeat the seam strip (cut & butt-join). Gap: seam strip is skipped (mount with spacing). */
  const [megaMarks, setMegaMarks] = useState(true);
  const [megaMarkPen, setMegaMarkPen] = useState(0); /* own pen for marks: pencil / fine liner */
  const [jigN, setJigN] = useState(5);
  const [jigShow, setJigShow] = useState(false); /* auto magnet positions in preview */
  const [jigMode, setJigMode] = useState("Auto"); /* Auto | Manual */
  const [manualMags, setManualMags] = useState([]); /* [[x,y] mm], mega: mega-coords */
  const [jigPlace, setJigPlace] = useState(false); /* click-to-place armed */
  const [jigGrid, setJigGrid] = useState(10);
  const [jigClear, setJigClear] = useState(12);
  const [jigMargin, setJigMargin] = useState(10);
  const [jigSpacing, setJigSpacing] = useState(40);
  const megaW = megaOn ? (megaMode === "Gap" ? megaC * canvasW + (megaC - 1) * megaSeam : megaC * canvasW - (megaC - 1) * megaSeam) : canvasW;
  const megaH = megaOn ? (megaMode === "Gap" ? megaR * canvasH + (megaR - 1) * megaSeam : megaR * canvasH - (megaR - 1) * megaSeam) : canvasH;
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
    laserOn: false, laserOffX: 0, laserOffY: 0, laserOnCmd: "SET_PIN PIN=laser VALUE=1", laserOffCmd: "SET_PIN PIN=laser VALUE=0",
  };
  const DEFAULT_MACHINE_B = {
    ...DEFAULT_MACHINE,
    name: "B — Bed Z + rotation",
    zMode: "bed", rotOn: true,
  };
  const [machines, setMachines] = useState([DEFAULT_MACHINE, DEFAULT_MACHINE_B]);
  const [helpFor, setHelpFor] = useState(null); /* node id whose help tooltip is open */
  const [setupFor, setSetupFor] = useState(null); /* node id in slider-setup mode */
  const [nodeNicks, setNodeNicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("muusia-nicks") || "{}") || {}; } catch (e) { return {}; }
  }); /* per node TYPE, user-level */
  const setNick = (type, nick) => setNodeNicks((m) => {
    const n = { ...m };
    if (nick && nick.trim()) n[type] = nick.trim(); else delete n[type];
    try { localStorage.setItem("muusia-nicks", JSON.stringify(n)); } catch (e) {}
    return n;
  });
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
  const [pensOpen, setPensOpen] = useState(false);
  const [, setPensVer] = useState(0);
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
  const ctx = useMemo(() => ({ W: megaW, H: megaH, frameIdx, frameCount }), [megaW, megaH, frameIdx, frameCount]);
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
  const duplicateIds = (ids) => {
    if (!ids.length) return;
    const sel = new Set(ids);
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
  const duplicateSelected = () => duplicateIds(selIds);
  const duplicateNode = (id) => duplicateIds([id]);
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
  /* --- Pop-out preview window (two-monitor workflow). No portal dependency:
     the drawing is written into the popup as an SVG string (toSVG), which keeps
     the file free of extra dependencies. CSS scales it to the window. --- */
  const [popout, setPopout] = useState(null);      /* Window object or null */
  const openPopout = () => {
    if (popout && !popout.closed) { popout.focus(); return; }
    const w = window.open("", "MuusiaPreview", "width=880,height=1140");
    if (!w) return;
    w.document.title = "Muusia — Preview";
    w.document.head.innerHTML = "<style>body{margin:0;background:#0D1117;display:flex;align-items:flex-start;justify-content:center;overflow:auto;}#muusia-pop{padding:10px;width:100%;flex:0 0 auto;}#muusia-pop svg{width:100%;height:auto;display:block;background:#FCFAF4;border-radius:4px;}</style>";
    w.document.body.innerHTML = '<div id="muusia-pop"></div>';
    let zw = 100;
    let pd = null;
    const sc = () => w.document.scrollingElement || w.document.documentElement;
    w.document.addEventListener("wheel", (e) => {
      e.preventDefault();
      const el2 = w.document.getElementById("muusia-pop");
      if (!el2) return;
      const oldW = el2.offsetWidth;
      zw = Math.max(100, Math.min(1600, zw * Math.exp(-e.deltaY * 0.0015)));
      el2.style.width = zw + "%";
      w.document.body.style.justifyContent = zw > 100.5 ? "flex-start" : "center";
      const k = el2.offsetWidth / oldW; /* layout is sync after the width write */
      sc().scrollLeft = (sc().scrollLeft + e.clientX) * k - e.clientX;
      sc().scrollTop = (sc().scrollTop + e.clientY) * k - e.clientY;
    }, { passive: false });
    w.document.addEventListener("mousedown", (e) => {
      if (zw <= 100.5) return;
      pd = { x: e.clientX, y: e.clientY, sl: sc().scrollLeft, st: sc().scrollTop };
      w.document.body.style.cursor = "grabbing";
      e.preventDefault();
    });
    w.document.addEventListener("mousemove", (e) => {
      if (!pd) return;
      sc().scrollLeft = pd.sl - (e.clientX - pd.x);
      sc().scrollTop = pd.st - (e.clientY - pd.y);
    });
    w.document.addEventListener("mouseup", () => { pd = null; w.document.body.style.cursor = ""; });
    w.document.addEventListener("dblclick", () => {
      zw = 100;
      const el2 = w.document.getElementById("muusia-pop");
      if (el2) el2.style.width = "100%";
      w.document.body.style.justifyContent = "center";
      sc().scrollLeft = 0; sc().scrollTop = 0;
    });
    const poll = setInterval(() => { if (w.closed) { clearInterval(poll); setPopout(null); } }, 800);
    setPopout(w);
  };
  useEffect(() => {
    if (!popout || popout.closed) return;
    const el = popout.document.getElementById("muusia-pop");
    if (el) el.innerHTML = toSVG(primaryPS, { W: megaW, H: megaH });
  }, [popout, primaryPS, megaW, megaH]);
  useEffect(() => () => { if (popout && !popout.closed) popout.close(); }, [popout]);
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
  const megaTiles = () => sliceMega(exportPS(), canvasW, canvasH, megaC, megaR, megaSeam, megaMode, megaMarks, megaMarkPen);
  const autoJigPositions = (() => {
    if (jigMode !== "Auto" || !jigShow || !primaryPS.paths.length) return null;
    const opts = { magnets: jigN, grid: jigGrid, clearance: jigClear, magnetMargin: jigMargin, minSpacing: jigSpacing };
    const gs = [];
    try {
      if (megaOn) {
        const dx = megaMode === "Gap" ? canvasW + megaSeam : canvasW - megaSeam;
        const dy = megaMode === "Gap" ? canvasH + megaSeam : canvasH - megaSeam;
        megaTiles().forEach((t, i) => {
          const rr = Math.floor(i / megaC), cc = i % megaC;
          const r = magnetPlacement(t, canvasW, canvasH, opts);
          for (const q of r.positions) gs.push([cc * dx + q[0], rr * dy + q[1]]);
        });
      } else {
        const r = magnetPlacement(exportPS(), canvasW, canvasH, opts);
        for (const q of r.positions) gs.push([q[0], q[1]]);
      }
    } catch (e) {}
    return gs;
  })();
  const previewMagnets = jigMode === "Manual" ? manualMags : autoJigPositions;
  const megaPreview = (kind) => {
    const tiles = megaTiles();
    const sheetCtx = { W: canvasW, H: canvasH, frameIdx, frameCount };
    const note = `MEGA CANVAS \u2014 previewing tile 1/${tiles.length}. Download saves all ${tiles.length} numbered tiles.`;
    return kind === "svg"
      ? `<!-- ${note} -->\n` + toSVG(tiles[0], sheetCtx)
      : `; ${note}\n` + toGcode(tiles[0], sheetCtx, prof);
  };
  const doExport = () => { setGcode(megaOn ? megaPreview("gcode") : toGcode(exportPS(), ctx, prof)); setExportKind("gcode"); setCopied(false); };
  const doExportSVG = () => { setGcode(megaOn ? megaPreview("svg") : toSVG(exportPS(), ctx)); setExportKind("svg"); setCopied(false); };
  const downloadMega = (kind) => {
    /* browsers block sequential programmatic downloads -> bundle everything in one zip */
    const tiles = megaTiles();
    const sheetCtx = { W: canvasW, H: canvasH, frameIdx, frameCount };
    const files = tiles.map((t, i) => {
      const rr = Math.floor(i / megaC) + 1, cc = (i % megaC) + 1;
      return {
        name: `${projName || "patch"}-tile-${String(i + 1).padStart(2, "0")}-r${rr}c${cc}${kind === "svg" ? ".svg" : ".gcode"}`,
        text: kind === "svg" ? toSVG(t, sheetCtx) : toGcode(t, sheetCtx, prof)
      };
    });
    const blob = new Blob([buildZip(files)], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${projName || "patch"}-tiles-${kind}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const downloadJig = () => {
    const opts = { magnets: jigN, grid: jigGrid, clearance: jigClear, magnetMargin: jigMargin, minSpacing: jigSpacing };
    const notes = [];
    const files = [];
    if (jigMode === "Manual") {
      if (!manualMags.length) { setGcode("; MAGNET JIG: no magnets placed - use + Place magnets in the preview"); setExportKind("gcode"); setCopied(false); return; }
      if (megaOn) {
        const dx = megaMode === "Gap" ? canvasW + megaSeam : canvasW - megaSeam;
        const dy = megaMode === "Gap" ? canvasH + megaSeam : canvasH - megaSeam;
        const perTile = Array.from({ length: megaC * megaR }, () => []);
        for (const [x, y] of manualMags) {
          const cc = Math.max(0, Math.min(megaC - 1, Math.floor(x / dx)));
          const rr = Math.max(0, Math.min(megaR - 1, Math.floor(y / dy)));
          const lx = Math.max(0, Math.min(canvasW, x - cc * dx));
          const ly = Math.max(0, Math.min(canvasH, y - rr * dy));
          perTile[rr * megaC + cc].push([Math.round(lx * 10) / 10, Math.round(ly * 10) / 10]);
        }
        perTile.forEach((pos, i) => {
          if (!pos.length) return;
          const rr = Math.floor(i / megaC) + 1, cc = (i % megaC) + 1;
          const g = jigGcode(pos, prof, canvasW, canvasH, `manual - tile ${i + 1}/${megaC * megaR} r${rr}c${cc}`);
          g.warnings.forEach((w) => notes.push(`tile ${i + 1}: ${w}`));
          files.push({ name: `${projName || "patch"}-tile-${String(i + 1).padStart(2, "0")}-r${rr}c${cc}-jig.gcode`, text: g.text });
        });
      } else {
        const g = jigGcode(manualMags.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]), prof, canvasW, canvasH, "manual - sheet 1/1");
        g.warnings.forEach((w) => notes.push(w));
        files.push({ name: `${projName || "patch"}-jig.gcode`, text: g.text });
      }
      const head0 = notes.length ? notes.map((n) => `; MAGNET JIG: ${n}`).join("\n") + "\n" : "";
      setGcode(head0 + (files[0] ? files[0].text : "") + (files.length > 1 ? `\n; ... ${files.length - 1} more jig file(s) in the zip` : ""));
      setExportKind("gcode"); setCopied(false);
      try {
        if (files.length > 1) {
          const blob = new Blob([buildZip(files)], { type: "application/zip" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${projName || "patch"}-jigs.zip`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        } else if (files.length === 1) {
          const blob = new Blob([files[0].text], { type: "text/plain" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = files[0].name;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }
      } catch (err) {}
      return;
    }
    if (megaOn) {
      const tiles = megaTiles();
      tiles.forEach((t, i) => {
        const rr = Math.floor(i / megaC) + 1, cc = (i % megaC) + 1;
        const r = magnetPlacement(t, canvasW, canvasH, opts);
        if (r.error) notes.push(`tile ${i + 1} r${rr}c${cc}: ${r.error}`);
        if (r.positions.length) {
          const g = jigGcode(r.positions, prof, canvasW, canvasH, `tile ${i + 1}/${tiles.length} r${rr}c${cc}`);
          g.warnings.forEach((w) => notes.push(`tile ${i + 1}: ${w}`));
          files.push({ name: `${projName || "patch"}-tile-${String(i + 1).padStart(2, "0")}-r${rr}c${cc}-jig.gcode`, text: g.text });
        }
      });
    } else {
      const r = magnetPlacement(exportPS(), canvasW, canvasH, opts);
      if (r.error) notes.push(r.error);
      if (r.positions.length) {
        const g = jigGcode(r.positions, prof, canvasW, canvasH, "sheet 1/1");
        g.warnings.forEach((w) => notes.push(w));
        files.push({ name: `${projName || "patch"}-jig.gcode`, text: g.text });
      }
    }
    const head = notes.length ? notes.map((n) => `; MAGNET JIG: ${n}`).join("\n") + "\n" : "";
    if (!files.length) { setGcode(head || "; MAGNET JIG: no positions"); setExportKind("gcode"); setCopied(false); return; }
    setGcode(head + files[0].text + (files.length > 1 ? `\n; ... ${files.length - 1} more jig file(s) in the zip` : ""));
    setExportKind("gcode"); setCopied(false);
    try {
      const single = files.length === 1;
      const blob = single
        ? new Blob([files[0].text], { type: "text/plain" })
        : new Blob([buildZip(files)], { type: "application/zip" });
      const el = document.createElement("a");
      el.href = URL.createObjectURL(blob);
      el.download = single ? files[0].name : `${projName || "patch"}-jigs.zip`;
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
      setTimeout(() => URL.revokeObjectURL(el.href), 2000);
    } catch (err) { /* sandbox may block downloads; preview still shows the jig */ }
  };
  /* --- kaikkien freimien vienti: uudelleenevaluointi per freimi --- */
  const exportAllFrames = (kind) => {
    if (!primaryNode) return;
    const n = Math.max(1, frameCount);
    let f = 0;
    const doOne = () => {
      const ctxF = { W: megaW, H: megaH, frameIdx: f, frameCount: n };
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
    if (megaOn) { downloadMega(exportKind); return; }
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
    JSON.stringify({ app: "muusia", v: 1, name: projName, canvas: { W: canvasW, H: canvasH }, jig: { mode: jigMode, magnets: manualMags }, mega: megaOn ? { C: megaC, R: megaR, seam: megaSeam, mode: megaMode, marks: megaMarks, markPen: megaMarkPen } : null, prof, machines, machineIdx, customNodes, root }, null, 1);
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
      if (data.mega) { setMegaOn(true); setMegaC(data.mega.C || 2); setMegaR(data.mega.R || 2); setMegaSeam(data.mega.seam ?? 5); setMegaMode(data.mega.mode || "Overlap"); setMegaMarks(!!data.mega.marks); setMegaMarkPen(data.mega.markPen || 0); } else { setMegaOn(false); }
      if (Array.isArray(data.machines) && data.machines.length) {
        setMachines(data.machines.map((m) => ({ ...DEFAULT_MACHINE, ...m })));
        setMachineIdx(Math.min(data.machineIdx || 0, data.machines.length - 1));
      } else if (data.prof) {
        setMachines([{ ...DEFAULT_MACHINE, ...data.prof }]);
        setMachineIdx(0);
      }
      if (data.jig) { setJigMode(data.jig.mode === "Manual" ? "Manual" : "Auto"); setManualMags(Array.isArray(data.jig.magnets) ? data.jig.magnets.filter((q) => Array.isArray(q) && q.length === 2) : []); }
      else { setJigMode("Auto"); setManualMags([]); }
      setJigPlace(false);
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
          <select defaultValue="" onChange={(e) => { const v = e.target.value; if (!v) return; const wh = v.split("x"); setCanvasW(Number(wh[0])); setCanvasH(Number(wh[1])); e.target.value = ""; }}
            title="Paper size presets"
            style={{ background: T.panel2, color: T.text, border: "1px solid " + T.line, borderRadius: 3, padding: "2px 4px", fontSize: 10 }}>
            <option value="">Size preset</option>
            <option value="210x148">A5 wide</option>
            <option value="148x210">A5 tall</option>
            <option value="297x210">A4 wide</option>
            <option value="210x297">A4 tall</option>
            <option value="420x297">A3 wide</option>
            <option value="297x420">A3 tall</option>
            <option value="594x420">A2 wide</option>
            <option value="420x594">A2 tall</option>
          </select>
          Canvas
          <NumBox value={canvasW} onChange={(v) => setCanvasW(Math.max(10, v))} min={10} width={56} />
          ×
          <NumBox value={canvasH} onChange={(v) => setCanvasH(Math.max(10, v))} min={10} width={56} />
          mm
        </div>
        <button style={toolBtn(true)} onClick={() => setPensOpen((v) => !v)} title="Edit pen colors (preview / SVG)">Pens</button>
        {pensOpen && (
          <div onClick={() => setPensOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 400 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ position: "absolute", top: 44, right: 352, width: 236, background: T.panel, border: "1px solid " + T.line, borderRadius: 7, padding: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
              <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.08em", marginBottom: 6 }}>PENS — preview / SVG colors</div>
              {PENS.map((pen, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: T.dim, width: 14, textAlign: "right", fontFamily: mono }}>{i}</div>
                  <input type="color" value={pen.c}
                    onChange={(e) => { pen.c = e.target.value; savePens(); setPensVer((v) => v + 1); }}
                    style={{ width: 26, height: 20, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
                  <input type="text" value={pen.name}
                    onChange={(e) => { pen.name = e.target.value.slice(0, 16); savePens(); setPensVer((v) => v + 1); }}
                    style={{ flex: 1, background: T.panel2, color: T.text, border: "1px solid " + T.line, borderRadius: 3, padding: "2px 5px", fontSize: 10, fontFamily: mono }} />
                </div>
              ))}
              <button style={toolBtn(true)} onClick={() => { resetPens(); setPensVer((v) => v + 1); }}>Reset defaults</button>
            </div>
          </div>
        )}
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
                <span style={{ flex: 1 }}>{d.name}{nodeNicks[type] && <span style={{ color: T.accent, marginLeft: 5, fontSize: 10 }}>· {nodeNicks[type]}</span>}</span>
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
                        {isGroup ? `Group ${node.id} (${node.data.nodes.length})` : (nodeNicks[node.type] || def.name)}
                        {isOut && <span style={{ color: T.group, marginLeft: 5 }}>OUT</span>}
                      </div>
                      {!isGroup && (
                        <div onClick={(ev) => { ev.stopPropagation(); setHelpFor((h) => h === node.id ? null : node.id); }}
                          onMouseDown={(ev) => ev.stopPropagation()}
                          title={def.desc || NODE_HELP[node.type] || def.name}
                          style={{ cursor: "help", color: helpFor === node.id ? T.accent : T.dim, fontSize: 10, lineHeight: 1, padding: "0 2px", fontWeight: 700, border: `1px solid ${helpFor === node.id ? T.accent : T.line}`, borderRadius: "50%", width: 13, height: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>?</div>
                      )}
                      {!isGroup && (
                        <div onClick={(ev) => { ev.stopPropagation(); setSetupFor((s) => s === node.id ? null : node.id); }}
                          onMouseDown={(ev) => ev.stopPropagation()}
                          title="Slider setup: set per-node fader ranges"
                          style={{ cursor: "pointer", color: setupFor === node.id ? T.accent : T.dim, fontSize: 11, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>⚙</div>
                      )}
                      <div onClick={(ev) => { ev.stopPropagation(); duplicateNode(node.id); }}
                        onMouseDown={(ev) => ev.stopPropagation()}
                        title="Duplicate this node"
                        style={{ cursor: "pointer", color: T.dim, fontSize: 10, lineHeight: 1, padding: "0 2px", fontWeight: 700, flexShrink: 0 }}>D</div>
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
                          <OutPreview out={outArr} W={megaW} H={megaH} width={NODE_W - 16} />
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
                          ) : setupFor === node.id ? (
                            <div>
                              <div style={{ fontSize: 10, color: T.accent, marginBottom: 6, letterSpacing: "0.04em" }}>NODE SETUP</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                <div style={{ fontSize: 10, color: T.dim, width: 56, flexShrink: 0 }}>Nickname</div>
                                <input type="text" value={nodeNicks[node.type] || ""} placeholder={def.name}
                                  onChange={(e) => setNick(node.type, e.target.value)}
                                  style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, fontSize: 11, padding: "3px 6px", fontFamily: "inherit" }} />
                                {nodeNicks[node.type] && (
                                  <span title="Clear nickname" onClick={() => setNick(node.type, "")}
                                    style={{ cursor: "pointer", color: T.accent, fontSize: 11 }}>↺</span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: T.dim, marginBottom: 6, letterSpacing: "0.04em" }}>Slider max values</div>
                              {def.params.filter((pd) => pd.type === "slider" || pd.type === "number").map((pd) => (
                                <div key={pd.key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                                  <div style={{ fontSize: 10, color: T.dim, flex: 1 }}>{pd.label}</div>
                                  <span style={{ fontSize: 9, color: T.dim }}>max</span>
                                  <NumBox value={(node.pmax && node.pmax[pd.key] != null) ? node.pmax[pd.key] : pd.max}
                                    min={pd.min + (pd.step || 1)}
                                    onChange={(v) => setNodesL((ns) => ns.map((n) => n.id === node.id
                                      ? { ...n, pmax: { ...(n.pmax || {}), [pd.key]: v } } : n))} />
                                  {node.pmax && node.pmax[pd.key] != null && (
                                    <span title={"Reset to " + pd.max}
                                      onClick={() => setNodesL((ns) => ns.map((n) => {
                                        if (n.id !== node.id) return n;
                                        const pm = { ...(n.pmax || {}) }; delete pm[pd.key];
                                        return { ...n, pmax: pm };
                                      }))}
                                      style={{ cursor: "pointer", color: T.accent, fontSize: 11 }}>↺</span>
                                  )}
                                </div>
                              ))}
                              <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>
                                Nickname is yours (saved in this browser, shows in search and headers). Slider ranges are saved with the project. Close with ⚙.
                              </div>
                            </div>
                          ) : (
                            def.params.map((pd) => {
                              const isNum = pd.type === "slider" || pd.type === "number" || pd.type === "seed";
                              const pdE = (node.pmax && node.pmax[pd.key] != null) ? { ...pd, max: node.pmax[pd.key] } : pd;
                              return (
                                <ParamRow key={pd.key} def={pdE} value={node.params[pd.key]}
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
              <div onClick={openPopout}
                title="Pop preview out to its own window (second display)"
                style={{ cursor: "pointer", color: popout ? T.accent : T.dim, fontSize: 12, lineHeight: 1, padding: "0 4px" }}>
                ⧉
              </div>
              <div onClick={() => primaryPS.paths.length && setBigPreview(true)}
                title="Enlarge preview"
                style={{ cursor: primaryPS.paths.length ? "pointer" : "default", color: primaryPS.paths.length ? T.accent : T.dim, fontSize: 13, lineHeight: 1, padding: "0 2px" }}>
                ⛶
              </div>
            </div>
            {primaryOut && !primaryPS.paths.length && (isStyle(primaryOut[0]) || typeof primaryOut[0] === "number") ? (
              <OutPreview out={primaryOut} W={megaW} H={megaH} width={316} />
            ) : (
              <ZoomBox width={316} height={316 * (megaH / megaW)}>
                <PathsSVG ps={primaryPS} W={megaW} H={megaH} width={316} guides={primaryGuides} height={316 * (megaH / megaW)} magnets={previewMagnets} onMagnets={jigMode === "Manual" ? setManualMags : null} placing={jigMode === "Manual" && jigPlace} arrows={showArrows} pad={8} />
              </ZoomBox>
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 6px" }}>
                  <input type="checkbox" checked={!!prof.laserOn} onChange={(e) => setProf((pr) => ({ ...pr, laserOn: e.target.checked }))} style={{ accentColor: T.accent }} />
                  <div style={{ fontSize: 10, color: T.text, letterSpacing: "0.05em" }}>LASER JIG (magnet placement)</div>
                </div>
                {prof.laserOn && (
                  <>
                    {profNum("laserOffX", "Laser offset X mm")}
                    {profNum("laserOffY", "Laser offset Y mm")}
                    {[["laserOnCmd", "Laser ON g-code"], ["laserOffCmd", "Laser OFF g-code"]].map(([k, l]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <div style={{ fontSize: 10, color: T.dim, width: 110 }}>{l}</div>
                        <input type="text" value={prof[k]} onChange={(e) => setProf((pr) => ({ ...pr, [k]: e.target.value }))}
                          style={{ flex: 1, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 6px", fontSize: 10, fontFamily: mono }} />
                      </div>
                    ))}
                    <div style={{ fontSize: 9, color: T.dim, lineHeight: 1.5, marginBottom: 4 }}>
                      Offset = laser dot position relative to the pen tip. The jig moves the pen so the laser lands on each magnet spot.
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

          {/* ---------- Mega canvas ---------- */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.line}` }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: megaOn ? T.text : T.dim, letterSpacing: "0.08em", cursor: "pointer", fontFamily: disp, fontWeight: 700 }}>
              <input type="checkbox" checked={megaOn} onChange={(e) => setMegaOn(e.target.checked)} />
              MEGA CANVAS
              <span style={{ fontWeight: 500, color: T.dim, letterSpacing: 0 }}>multi-sheet work</span>
            </label>
            {megaOn && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7, fontSize: 11, color: T.text }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.dim }}>Sheets</span>
                  <input type="number" value={megaC} min={1} max={6} onChange={(e) => setMegaC(Math.max(1, Math.min(6, Math.round(+e.target.value || 1))))}
                    style={{ width: 40, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  ×
                  <input type="number" value={megaR} min={1} max={8} onChange={(e) => setMegaR(Math.max(1, Math.min(8, Math.round(+e.target.value || 1))))}
                    style={{ width: 40, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  <span style={{ color: T.dim }}>cols × rows</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.dim }}>Seam</span>
                  <input type="number" value={megaSeam} min={0} max={40} step={0.5} onChange={(e) => setMegaSeam(Math.max(0, Math.min(40, +e.target.value || 0)))}
                    style={{ width: 46, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                  mm
                  <select value={megaMode} onChange={(e) => setMegaMode(e.target.value)}
                    style={{ background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }}>
                    <option>Overlap</option>
                    <option>Gap</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: T.dim, flex: 1 }}>
                    <input type="checkbox" checked={megaMarks} onChange={(e) => setMegaMarks(e.target.checked)} />
                    Crop marks
                  </label>
                  {megaMarks && (
                    <select value={megaMarkPen} onChange={(e) => setMegaMarkPen(+e.target.value)}
                      title="Pen for crop marks — e.g. a pencil or fine liner, so marks stay faint or erasable"
                      style={{ background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }}>
                      {PENS.map((pn, i) => <option key={i} value={i}>{i}: {pn.name}</option>)}
                    </select>
                  )}
                </div>
                <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5 }}>
                  Total {megaW} × {megaH} mm · {megaC * megaR} sheets of {canvasW} × {canvasH} mm.
                  {megaMode === "Overlap" ? " Sheets repeat the seam strip — cut through it and butt-join." : " A seam-wide strip is skipped between sheets — mount with spacing."}
                  {" Export previews tile 1; Download saves all numbered tiles."}
                </div>
              </div>
            )}
          </div>

          {/* ---------- Magnet jig (laser) ---------- */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 10, color: T.text, letterSpacing: "0.08em", fontFamily: disp, fontWeight: 700 }}>
              MAGNET JIG <span style={{ fontWeight: 500, color: T.dim, letterSpacing: 0 }}>laser-guided paper hold-down</span>
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7, fontSize: 11, color: T.text }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: T.dim }}>Mode</span>
                <select value={jigMode} onChange={(e) => { setJigMode(e.target.value); setJigPlace(false); }}
                  style={{ background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, fontSize: 11, padding: "3px 5px" }}>
                  <option>Auto</option>
                  <option>Manual</option>
                </select>
                {jigMode === "Manual" && (
                  <>
                    <button onClick={() => setJigPlace((v) => !v)}
                      style={{ background: jigPlace ? T.accent : T.panel2, border: `1px solid ${jigPlace ? T.accent : T.line}`, color: jigPlace ? "#0D1117" : T.text, borderRadius: 4, fontSize: 10, padding: "4px 10px", cursor: "pointer", fontFamily: mono, fontWeight: 700 }}>
                      {jigPlace ? "Placing… click preview" : "+ Place magnets"}
                    </button>
                    <span style={{ color: T.dim, fontVariantNumeric: "tabular-nums" }}>{manualMags.length} set</span>
                    {manualMags.length > 0 && (
                      <button onClick={() => setManualMags([])}
                        style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 4, fontSize: 10, padding: "4px 8px", cursor: "pointer", fontFamily: mono }}>
                        Clear
                      </button>
                    )}
                  </>
                )}
              </div>
              {jigMode === "Manual" && (
                <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5 }}>
                  Click the preview to add a magnet, drag to move, double-click to remove. Coordinates are exact mm{megaOn ? " in mega coordinates - export splits them per sheet" : ""}.
                </div>
              )}
              {jigMode === "Auto" && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: T.dim }}>Magnets</span>
                <input type="number" value={jigN} min={1} max={12} onChange={(e) => setJigN(Math.max(1, Math.min(12, Math.round(+e.target.value || 1))))}
                  style={{ width: 44, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                <span style={{ color: T.dim }}>Grid</span>
                <input type="number" value={jigGrid} min={4} max={30} onChange={(e) => setJigGrid(Math.max(4, Math.min(30, +e.target.value || 10)))}
                  style={{ width: 44, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
              </div>}
              {jigMode === "Auto" && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: T.dim }}>Clear</span>
                <input type="number" value={jigClear} min={0} max={120} onChange={(e) => setJigClear(Math.max(0, Math.min(120, +e.target.value || 0)))}
                  style={{ width: 44, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                <span style={{ color: T.dim }}>Edge</span>
                <input type="number" value={jigMargin} min={0} max={120} onChange={(e) => setJigMargin(Math.max(0, Math.min(120, +e.target.value || 0)))}
                  style={{ width: 44, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                <span style={{ color: T.dim }}>Spread</span>
                <input type="number" value={jigSpacing} min={0} max={120} onChange={(e) => setJigSpacing(Math.max(0, Math.min(120, +e.target.value || 0)))}
                  style={{ width: 44, background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "3px 5px", fontSize: 11, fontFamily: mono }} />
                <span style={{ color: T.dim }}>mm</span>
              </div>}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={downloadJig}
                  style={{ background: T.panel2, border: `1px solid ${T.line}`, color: T.text, borderRadius: 4, fontSize: 10, padding: "5px 10px", cursor: "pointer", fontFamily: mono }}>
                  {megaOn ? `Download ${megaC * megaR} jigs (.zip)` : "Download jig .gcode"}
                </button>
                {jigMode === "Auto" && <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10, color: T.dim }}>
                  <input type="checkbox" checked={jigShow} onChange={(e) => setJigShow(e.target.checked)} style={{ accentColor: T.accent }} />
                  Show magnets in preview
                </label>}
              </div>
              <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5 }}>
                Proposes the safest magnet spots (farthest from pen lines, Clear mm minimum), then drives pen-up + laser to each — drop a magnet, press continue.
                {megaOn ? " One jig per sheet, in sheet-local coordinates; jig files sort next to their tiles when unzipped together." : ""}
                {!prof.laserOn ? " Tip: set the laser offset in machine settings (LASER JIG)." : ""}
              </div>
            </div>
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
                  {megaOn ? `Download ${megaC * megaR} tiles (.zip)` : `Download ${exportKind === "svg" ? ".svg" : ".gcode"}`}
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
        const qq = quickAdd.query.toLowerCase();
        const list = Object.entries(DEFS).filter(([t, d]) =>
          !d.hidden &&
          (quickAdd.cat === null || d.cat === quickAdd.cat) &&
          (d.name.toLowerCase().includes(qq) || (nodeNicks[t] || "").toLowerCase().includes(qq)));
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
                    <div style={{ flex: 1, fontSize: 12, color: T.text, fontFamily: mono }}>
                      {d.name}
                      {nodeNicks[type] && <span style={{ color: T.accent, marginLeft: 6, fontSize: 11 }}>· {nodeNicks[type]}</span>}
                    </div>
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
              <SimView ps={routeOpt ? routeOptimize(primaryPS, preserveDir) : primaryPS} W={megaW} H={megaH}
                width={Math.min(window.innerWidth - 100, (window.innerHeight - 190) * (canvasW / canvasH))}
                height={Math.min(window.innerHeight - 190, (window.innerWidth - 100) * (canvasH / canvasW))} />
            ) : (
              (() => {
                const bw2 = Math.min(window.innerWidth - 100, (window.innerHeight - 140) * (canvasW / canvasH));
                const bh2 = Math.min(window.innerHeight - 140, (window.innerWidth - 100) * (canvasH / canvasW));
                return (
                  <ZoomBox width={bw2} height={bh2}>
                    <PathsSVG ps={primaryPS} W={megaW} H={megaH} width={bw2} height={bh2}
                      arrows={showArrows} pad={16} guides={primaryGuides} magnets={previewMagnets} onMagnets={jigMode === "Manual" ? setManualMags : null} placing={jigMode === "Manual" && jigPlace} />
                  </ZoomBox>
                );
              })()
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
