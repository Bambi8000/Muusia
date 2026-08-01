#!/usr/bin/env node
/* tools/patch-glyph-loops.mjs
   v2.41 fix: loop glyphs (O 0 D Q 8 B \u00d6 and the dot punctuation) are authored
   in SFONT with the first point repeated at the end, but were emitted as
   closed: false - geometrically a loop, invisible to Pattern Fill, Container,
   Stencil and Occlude. ASCII Art and Text now detect first==last strokes,
   drop the duplicate point and emit closed: true. Plotted ink is identical
   (the pen returned to the start before too). Text on Path and Concrete
   Poetry intentionally NOT touched (glyphs there are clipped/rotated; noted
   in HANDOFF as a known follow-up if fills are ever wanted on them).
   Run from repo root:
     node tools/patch-glyph-loops.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const ASCII = "src/defs/nodes/asciiart.js";
const TEXT = "src/defs/nodes/hersheytext.js";
const APP = "src/App.jsx";
const NODES = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

const LOOPNOTE = "/* loop glyph strokes are authored with the first point repeated at the end: emit as real closed shapes so fills and region nodes see them */";

const EDITS = [
  {
    file: ASCII,
    label: "asciiart: loop strokes -> closed shapes",
    guard: "emit as real closed shapes",
    old: `        for (const st of fs.strokes) {
          if (st.length < 2 || total + st.length > BUDGET) continue;
          paths.push({ pts: st.map(([gx, gy]) => [gx0 + gx, gy0 + gy]), closed: false, layer: L });
          total += st.length;
        }`,
    new: `        for (const st of fs.strokes) {
          if (st.length < 2 || total + st.length > BUDGET) continue;
          const pts = st.map(([gx, gy]) => [gx0 + gx, gy0 + gy]);
          ${LOOPNOTE}
          const loop = pts.length > 3 &&
            Math.abs(pts[0][0] - pts[pts.length - 1][0]) < 1e-6 &&
            Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-6;
          if (loop) pts.pop();
          paths.push({ pts, closed: loop, layer: L });
          total += pts.length;
        }`,
  },
  {
    file: TEXT,
    label: "text: loop strokes -> closed shapes",
    guard: "emit as real closed shapes",
    old: `          for (const stroke of g.s) {
            if (stroke.length < 2) continue;
            paths.push({
              pts: stroke.map(([gx, gy]) => [x + gx * sc, y + gy * sc]),
              closed: false, layer: Math.round(p.layer),
            });
          }`,
    new: `          for (const stroke of g.s) {
            if (stroke.length < 2) continue;
            const pts = stroke.map(([gx, gy]) => [x + gx * sc, y + gy * sc]);
            ${LOOPNOTE}
            const loop = pts.length > 3 &&
              Math.abs(pts[0][0] - pts[pts.length - 1][0]) < 1e-6 &&
              Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-6;
            if (loop) pts.pop();
            paths.push({
              pts, closed: loop, layer: Math.round(p.layer),
            });
          }`,
  },
  {
    file: APP,
    label: "APP_VERSION 2.40 -> 2.41",
    guard: 'APP_VERSION = "2.41"',
    old: 'APP_VERSION = "2.40"',
    new: 'APP_VERSION = "2.41"',
  },
  {
    file: NODES,
    label: "NODES.md header version",
    guard: "v2.41 \u2014 Node Reference",
    old: "# MUUSIA v2.40 \u2014 Node Reference",
    new: "# MUUSIA v2.41 \u2014 Node Reference",
  },
  {
    file: NODES,
    label: "NODES.md: ASCII Art paragraph note",
    guard: "(O 0 D Q 8 \u00d6, dots)",
    old: `Threshold leaves the lightest cells empty. Columns sets resolution; characters
are real pen strokes, so the result plots like any other geometry.`,
    new: `Threshold leaves the lightest cells empty. Columns sets resolution; characters
are real pen strokes, so the result plots like any other geometry \u2014 and loop
letters (O 0 D Q 8 \u00d6, dots) come out as real closed shapes, so Pattern Fill,
Container and the other region nodes see them.`,
  },
  {
    file: HANDOFF,
    label: "2.41 version history entry",
    guard: "- **2.41** glyph-loop fix",
    old: `  remains a built-in, just unlisted. Applied via
  tools/patch-mask-deprecation.mjs.`,
    new: `  remains a built-in, just unlisted. Applied via
  tools/patch-mask-deprecation.mjs.
- **2.41** glyph-loop fix: SFONT authors loop glyphs (O 0 D Q 8 B \u00d6, dot
  punctuation) with the first point repeated at the end, but **ASCII Art**
  and **Text** emitted every stroke closed: false \u2014 a geometric loop the
  region nodes could not see, so Pattern Fill on letters did nothing. Both
  now detect first==last strokes (>3 pts, 1e-6), drop the duplicate point
  and emit closed: true; plotted ink identical, Travel Sort may pick a
  different loop entry vertex. Known follow-up if ever needed: Text on Path
  and Concrete Poetry still emit open glyph strokes (clipped/rotated glyphs
  \u2014 left untouched deliberately). Applied via tools/patch-glyph-loops.mjs.`,
  },
];

let miss = 0;
for (const e of EDITS) {
  let txt;
  try { txt = readFileSync(e.file, "utf8"); }
  catch { console.log("MISS " + e.label + "  [" + e.file + " not found]"); miss++; continue; }
  if (e.guard && txt.includes(e.guard)) { console.log("SKIP " + e.label + "  [already applied]"); continue; }
  const n = txt.split(e.old).length - 1;
  if (n !== 1) { console.log("MISS " + e.label + "  [anchor found " + n + " times]"); miss++; continue; }
  writeFileSync(e.file, txt.replace(e.old, e.new));
  console.log("OK   " + e.label);
}
process.exit(miss ? 1 : 0);
