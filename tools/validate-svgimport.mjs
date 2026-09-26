/* Validator for Import SVG (key svgimport).
   Run from the repo root:  node tools/validate-svgimport.mjs [path/to/file.svg]
   Tests the REAL src/defs/helpers.js parseSVG plus the shipped node.
   parseSVG needs DOMParser; jsdom or linkedom is used when installed, otherwise
   a minimal built-in XML DOM (elements/attributes only, exactly what parseSVG
   reads). Line 2 of the output says which one ran.
   Optional argument: an SVG file to smoke-test through the same pipeline. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/* ---------- DOMParser provider ---------- */
let domName = "builtin-xml";
if (typeof globalThis.DOMParser !== "function") {
  for (const lib of ["jsdom", "linkedom"]) {
    try {
      const m = await import(lib);
      if (lib === "jsdom") { const w = new m.JSDOM("").window; globalThis.DOMParser = w.DOMParser; }
      else globalThis.DOMParser = m.DOMParser;
      domName = lib; break;
    } catch (e) { /* not installed */ }
  }
}
if (typeof globalThis.DOMParser !== "function") {
  class El {
    constructor(tag) { this.tagName = tag; this.attrs = new Map(); this.children = []; }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    querySelector(sel) {
      const s = sel.toLowerCase();
      for (const c of this.children) { if (c.tagName.toLowerCase() === s) return c; const d = c.querySelector(sel); if (d) return d; }
      return null;
    }
  }
  globalThis.DOMParser = class {
    parseFromString(text) {
      const doc = new El("#document");
      const stack = [doc];
      const re = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
      let m, ok = true;
      while ((m = re.exec(text))) {
        if (m[1] !== undefined) { if (stack.length > 1 && stack[stack.length - 1].tagName === m[1]) stack.pop(); else ok = false; }
        else if (m[2] !== undefined) {
          const el = new El(m[2]);
          const ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let a;
          while ((a = ar.exec(m[3] || ""))) el.attrs.set(a[1], a[2] !== undefined ? a[2] : a[3]);
          stack[stack.length - 1].children.push(el);
          if (!m[4]) stack.push(el);
        }
      }
      if (!ok || stack.length !== 1) { const pe = new El("parsererror"); doc.children.unshift(pe); }
      return doc;
    }
  };
}

/* ---------- real helpers + shipped node ---------- */
const H = await import(pathToFileURL(resolve("src/defs/helpers.js")).href);
const KEY = "svgimport";
const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) { def = (await import(pathToFileURL(bakedPath).href)).default; mode = "[baked]"; }
else {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample", "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
}
console.log(mode, def.key, "-", def.name);
console.log("dom  ", domName);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };
const near = (a, b, t = 0.02) => Math.abs(a - b) <= t;

/* ---------- 1. parseSVG on a fixture that mirrors real-world exporter output ---------- */
const FIX = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<rect width="1080" height="1080" fill="#000000"/>
<path d="M 152 70.059 L 201.539 20.519 L 235.48 54.461 L 185.941 104 L 256 104 L 256 152 L 152 152 Z" transform="translate(684 306) scale(0.140625)" fill-rule="evenodd" fill="#00BBF9"/>
  <circle cx="270" cy="720" r="18" fill="#00BBF9"/>
  <circle cx="594" cy="720" r="36" fill="#FEE440"/>
  <path fill="#FEE440" fill-rule="evenodd" d="M 702 378 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0 M 713.86 378 a 6.14 6.14 0 1 1 12.28 0 a 6.14 6.14 0 1 1 -12.28 0"/>
  <g transform="rotate(90 540 540)" stroke="#F15BB5" fill="none">
    <line x1="0" y1="540" x2="1080" y2="540"/>
    <polyline points="10,10 20,30 30,10"/>
    <polygon points="100,100 200,100 150,180"/>
    <ellipse cx="540" cy="100" rx="40" ry="20"/>
    <path d="M10 900 C 20 800, 40 800, 50 900 Q 60 950 70 900 h 20 v -20 z"/>
  </g>
</svg>`;

let svg = null, err = null;
try { svg = H.parseSVG(FIX); } catch (e) { err = e; }
ok(!err, "parseSVG does not throw" + (err ? " (" + err.message + ")" : ""));
if (err) { console.log("\n" + fails + " FAIL - parseSVG unusable, stopping here"); process.exit(1); }

const tags = { rect: 1, tri: 1, c1: 1, c2: 1, arcs: 2, line: 1, pline: 1, pgon: 1, ell: 1, curve: 1 };
const expectPaths = Object.values(tags).reduce((a, b) => a + b, 0);
ok(svg.paths.length === expectPaths, "path count " + svg.paths.length + " (expected " + expectPaths + ": rect, transformed path, 2 circles, 2 arc subpaths, line, polyline, polygon, ellipse, curve path)");
ok(svg.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]))), "all parsed coordinates finite");
ok(svg.paths.every((q) => q.pts.length >= 2), "every parsed path >= 2 points");

/* rect */
const rect = svg.paths[0];
ok(rect.closed && rect.pts.length === 4 && near(rect.pts[2][0], 1080) && near(rect.pts[2][1], 1080), "rect -> 4-pt closed box 0..1080");
ok(svg.colors[rect.colorIdx] === "#000000", "rect color registered as #000000 (idx " + rect.colorIdx + ")");

/* translate+scale transform: first vertex (152, 70.059) -> (684+152*0.140625, 306+70.059*0.140625) */
const tri = svg.paths[1];
ok(tri.closed && near(tri.pts[0][0], 684 + 152 * 0.140625) && near(tri.pts[0][1], 306 + 70.059 * 0.140625),
  "translate(684 306) scale(0.140625) applied: " + tri.pts[0].map((v) => v.toFixed(3)).join(","));
ok(tri.pts.length === 7, "Z-closed path keeps 7 vertices (no duplicate closing point)");

/* circle */
const c1 = svg.paths[2];
const radii = c1.pts.map(([x, y]) => Math.hypot(x - 270, y - 720));
ok(c1.closed && c1.pts.length >= 16 && radii.every((r) => near(r, 18, 0.01)), "circle r=18 -> " + c1.pts.length + " pts all at radius 18");
ok(svg.paths[3].pts.length > c1.pts.length, "bigger circle gets more segments (" + svg.paths[3].pts.length + " > " + c1.pts.length + ")");

/* arcs: two a-commands closing a ring around (720,378) r=18, second subpath r=6.14 */
const a1 = svg.paths[4], a2 = svg.paths[5];
const ar1 = a1.pts.map(([x, y]) => Math.hypot(x - 720, y - 378));
const ar2 = a2.pts.map(([x, y]) => Math.hypot(x - 720, y - 378));
ok(!a1.closed && ar1.every((r) => near(r, 18, 0.05)) && a1.pts.length >= 16, "arc pair (a 18 18 ... 36 0 / -36 0) -> ring at r=18 (" + a1.pts.length + " pts)");
ok(ar2.every((r) => near(r, 6.14, 0.05)), "inner arc pair -> ring at r=6.14 (" + a2.pts.length + " pts)");
const wind = (pts) => H.signedArea(pts);
ok(Math.sign(wind(a1.pts)) !== Math.sign(wind(a2.pts)), "sweep-flag 0 vs 1 give opposite winding (evenodd ring)");

/* group transform rotate(90 540 540) + inherited stroke color */
const line = svg.paths[6];
ok(near(line.pts[0][0], 540) && near(line.pts[0][1], 0) && near(line.pts[1][0], 540) && near(line.pts[1][1], 1080),
  "rotate(90 cx cy) on <g> applied to <line>: " + line.pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" -> "));
ok(svg.colors[line.colorIdx] === "#F15BB5" && [7, 8, 9, 10].every((i) => svg.paths[i].colorIdx === line.colorIdx), "stroke color inherited from <g> to all children");
ok(!svg.paths[7].closed && svg.paths[7].pts.length === 3, "polyline -> open 3 pts");
ok(svg.paths[8].closed && svg.paths[8].pts.length === 3, "polygon -> closed 3 pts");
ok(svg.paths[9].closed && svg.paths[9].pts.length >= 16, "ellipse -> closed " + svg.paths[9].pts.length + " pts");
const cur = svg.paths[10];
ok(cur.closed && cur.pts.length > 12, "C/Q/h/v/z path flattened + closed (" + cur.pts.length + " pts)");

/* colors and bbox */
ok(svg.colors.join(" ") === "#000000 #00BBF9 #FEE440 #F15BB5", "distinct colors in first-seen order: " + svg.colors.join(" "));
ok(near(svg.bbox.x, 0) && near(svg.bbox.y, 0) && near(svg.bbox.w, 1080) && near(svg.bbox.h, 1080), "bbox 0,0 1080x1080");

/* error paths */
let e1 = null; try { H.parseSVG('<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg>'); } catch (e) { e1 = e; }
ok(e1 && /No paths/.test(e1.message), "empty SVG throws 'No paths in SVG'");
let e2 = null; try { H.parseSVG("<html><body></body></html>"); } catch (e) { e2 = e; }
ok(!!e2, "non-SVG document throws (" + (e2 && e2.message) + ")");
ok(JSON.stringify(H.parseSVG(FIX)) === JSON.stringify(svg), "parseSVG deterministic");

/* ---------- 2. the node's compute ---------- */
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const p0 = defaults();
const node = { data: { svg } };
const run = (p, ctx, nd) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, nd === undefined ? node : nd);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bb = (r) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };

ok(def.onFile(FIX).paths.length === expectPaths, "def.onFile routes through parseSVG");
ok(run(p0, undefined, {}) === H.EMPTY && run(p0, undefined, { data: {} }) === H.EMPTY, "missing node.data.svg -> EMPTY (no throw)");

const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "compute deterministic");
ok(r1.paths.length === expectPaths && finiteAll(r1), "compute keeps all " + r1.paths.length + " paths, finite (" + npts(r1) + " pts)");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer < H.PENS.length), "layers are integer pens");
ok(r1.paths.every((q, i) => q.layer === svg.paths[i].colorIdx % H.PENS.length), "'From SVG colors' maps colorIdx -> pen");

/* fit to canvas: square drawing fills the short side minus margin, centered */
for (const [W, Hh] of [[297, 210], [210, 297]]) {
  const b = bb(run(p0, { W, H: Hh }));
  const side = Math.min(W, Hh) - 2 * p0.margin;
  ok(near(b.x1 - b.x0, side, 0.05) && near(b.y1 - b.y0, side, 0.05) && near((b.x0 + b.x1) / 2, W / 2, 0.05) && near((b.y0 + b.y1) / 2, Hh / 2, 0.05),
    "Fit to canvas on " + W + "x" + Hh + ": " + (b.x1 - b.x0).toFixed(2) + " mm square centered, margin " + p0.margin);
}
const bm = bb(run({ ...p0, margin: 30 }));
ok(near(bm.y0, 30, 0.05) && near(bm.y1, 180, 0.05), "margin 30 -> y 30..180");

/* scale % mode */
const ps = { ...p0, fit: "Scale %", scale: 10, margin: 5 };
const bs = bb(run(ps));
ok(near(bs.x0, 5) && near(bs.y0, 5) && near(bs.x1 - bs.x0, 108) && near(bs.y1 - bs.y0, 108), "Scale % 10 -> 108 mm from margin 5");
const bs2 = bb(run({ ...ps, scale: 20 }));
ok(near(bs2.x1 - bs2.x0, 216), "scale 20 -> 216 mm (scale live)");
const bo = bb(run({ ...ps, offx: 12.5, offy: -3 }));
ok(near(bo.x0, 17.5) && near(bo.y0, 2), "offx/offy shift the drawing (live)");

/* directions */
const closedIdx = svg.paths.map((q, i) => (q.closed ? i : -1)).filter((i) => i >= 0);
const rc = run({ ...p0, dirs: "Closed clockwise" });
const rcc = run({ ...p0, dirs: "Closed counter-clockwise" });
ok(closedIdx.every((i) => H.signedArea(rc.paths[i].pts) > 0), "Closed clockwise: all " + closedIdx.length + " closed paths signedArea > 0");
ok(closedIdx.every((i) => H.signedArea(rcc.paths[i].pts) < 0), "Closed counter-clockwise: all closed paths signedArea < 0");
ok(svg.paths.every((q, i) => q.closed || JSON.stringify(rc.paths[i].pts) === JSON.stringify(r1.paths[i].pts)), "open paths untouched by direction rules");
ok(JSON.stringify(rc) !== JSON.stringify(rcc), "dirs param live");

/* single pen */
const rsp = run({ ...p0, colmode: "Single pen", layer: 5 });
ok(rsp.paths.every((q) => q.layer === 5), "Single pen -> every path on pen 5");
ok(run({ ...p0, colmode: "Single pen", layer: 2 }).paths.every((q) => q.layer === 2), "layer param live in Single pen mode");

/* every select option draws */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(r.paths.length === expectPaths && finiteAll(r), pd.key + " '" + opt + "' draws finite paths");
}

/* extremes */
ok(finiteAll(run({ ...p0, margin: 0, offx: -200, offy: 200 })), "margin 0 + extreme offsets finite");
ok(finiteAll(run({ ...p0, fit: "Scale %", scale: 400, margin: 60 })), "Scale % 400 finite");
ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "margin larger than half canvas stays finite (negative fit)");

/* style input passes through applyStyle */
const dashed = def.compute([{ kind: "style", mode: "Dashed", dash: 4, gap: 2, vary: 0, seed: 1, phase: 0 }], p0, { W: 297, H: 210 }, node);
ok(dashed.paths.length > r1.paths.length && finiteAll(dashed), "Style pin (Dashed) applied: " + dashed.paths.length + " dashes");

/* inputs never mutated */
ok(JSON.stringify(svg) === JSON.stringify(H.parseSVG(FIX)), "compute never mutates node.data.svg");

/* ---------- 3. optional: smoke-test a user file ---------- */
const arg = process.argv[2];
if (arg) {
  if (!existsSync(arg)) ok(false, "file not found: " + arg);
  else {
    let us = null, ue = null;
    try { us = H.parseSVG(readFileSync(arg, "utf8")); } catch (e) { ue = e; }
    ok(!ue, "user file parses" + (ue ? " (" + ue.message + ")" : ""));
    if (us) {
      const ur = run(p0, undefined, { data: { svg: us } });
      const ub = bb(ur);
      ok(finiteAll(ur) && ur.paths.length === us.paths.length, "user file: " + us.paths.length + " paths, " + npts(ur) + " pts, " + us.colors.length + " colors " + us.colors.join(" "));
      ok(npts(ur) < 120000, "user file within point budget (" + npts(ur) + ")");
      console.log("INFO  user file bbox " + [us.bbox.x, us.bbox.y, us.bbox.w, us.bbox.h].map((v) => v.toFixed(1)).join(" ") + " -> on A4 wide " +
        [ub.x0, ub.y0, ub.x1, ub.y1].map((v) => v.toFixed(1)).join(" ") + " mm; pens " + [...new Set(ur.paths.map((q) => q.layer))].sort((a, b) => a - b).join(","));
    }
  }
}

console.log(fails ? "\n" + fails + " FAIL" : "\nALL OK");
process.exit(fails ? 1 : 0);
