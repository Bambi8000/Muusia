#!/usr/bin/env node
/* tools/patch-glyph-brp.mjs
   Companion to patch-glyph-loops.mjs (same 2.41 release): B, P and R bowls
   close against the STEM, not against their own start point, so the
   first==last detection cannot see them. Refont the three glyphs in SFONT:
   bowls become authored closed loops (first point repeated), stems separate
   strokes. Ink: P and R identical to before; B redraws the shared mid bar
   once (the two closed bowls' common edge, +6 font units per B).
   Run from repo root:
     node tools/patch-glyph-brp.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const HELPERS = "src/defs/helpers.js";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

const EDITS = [
  {
    file: HELPERS,
    label: "SFONT B: two closed bowls",
    guard: '"B": { w: 9, s: [[[0,0],[6,0]',
    old: `  "B": { w: 9, s: [[[0,10],[0,0],[6,0],[7.5,1.5],[7.5,3.5],[6,5],[0,5]], [[6,5],[7.5,6.5],[7.5,8.5],[6,10],[0,10]]] },`,
    new: `  "B": { w: 9, s: [[[0,0],[6,0],[7.5,1.5],[7.5,3.5],[6,5],[0,5],[0,0]], [[0,5],[6,5],[7.5,6.5],[7.5,8.5],[6,10],[0,10],[0,5]]] },`,
  },
  {
    file: HELPERS,
    label: "SFONT P: closed bowl + stem",
    guard: '"P": { w: 9, s: [[[0,0],[6,0]',
    old: `  "P": { w: 9, s: [[[0,10],[0,0],[6,0],[8,2],[8,3.5],[6,5.5],[0,5.5]]] },`,
    new: `  "P": { w: 9, s: [[[0,0],[6,0],[8,2],[8,3.5],[6,5.5],[0,5.5],[0,0]], [[0,10],[0,5.5]]] },`,
  },
  {
    file: HELPERS,
    label: "SFONT R: closed bowl + stem + leg",
    guard: '"R": { w: 9, s: [[[0,0],[6,0]',
    old: `  "R": { w: 9, s: [[[0,10],[0,0],[6,0],[8,2],[8,3.5],[6,5.5],[0,5.5]], [[4,5.5],[8,10]]] },`,
    new: `  "R": { w: 9, s: [[[0,0],[6,0],[8,2],[8,3.5],[6,5.5],[0,5.5],[0,0]], [[0,10],[0,5.5]], [[4,5.5],[8,10]]] },`,
  },
  {
    file: HANDOFF,
    label: "2.41 entry: BRP refont note",
    guard: "B/P/R refonted",
    old: `and Concrete Poetry still emit open glyph strokes (clipped/rotated glyphs
  \u2014 left untouched deliberately). Applied via tools/patch-glyph-loops.mjs.`,
    new: `and Concrete Poetry still emit open glyph strokes (clipped/rotated glyphs
  \u2014 left untouched deliberately). B/P/R refonted in SFONT (their bowls closed
  against the stem, not their own start, so loop detection could not see
  them): bowls are now authored closed loops + separate stems \u2014 P/R ink
  identical, B redraws the shared mid bar once. 6/9/4/A counters left as-is
  (single spiral strokes, no clean split). Applied via
  tools/patch-glyph-loops.mjs + tools/patch-glyph-brp.mjs.`,
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
