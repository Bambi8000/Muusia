#!/usr/bin/env node
/* tools/patch-mask-deprecation.mjs
   v2.40: soft-deprecate Mask. hidden: true removes it from the palette and
   quick-add; the definition stays in DEFS, so every old patch loads and runs
   unchanged. The desc and docs point to Container, which supersedes it.
   Run from repo root:
     node tools/patch-mask-deprecation.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const MASK = "src/defs/nodes/mask.js";
const APP = "src/App.jsx";
const NODES = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

const EDITS = [
  {
    file: MASK,
    label: "mask.js: hidden + deprecation desc",
    guard: "hidden: true",
    old: `    name: "Mask", cat: "duo", ins: [Pin("paths", "Target"), Pin("paths", "Mask")], outs: [Pin("paths")],`,
    new: `    name: "Mask", cat: "duo", hidden: true,
    desc: "DEPRECATED since 2.40 \u2014 hidden from the palette; old patches keep working unchanged. Use Container instead: it clips by wired closed shapes too, and adds parametric Rectangle/Circle/Triangle regions with rotation, a grow/shrink Gap and bisection-accurate cuts.",
    ins: [Pin("paths", "Target"), Pin("paths", "Mask")], outs: [Pin("paths")],`,
  },
  {
    file: APP,
    label: "APP_VERSION 2.39 -> 2.40",
    guard: 'APP_VERSION = "2.40"',
    old: 'APP_VERSION = "2.39"',
    new: 'APP_VERSION = "2.40"',
  },
  {
    file: NODES,
    label: "NODES.md header version",
    guard: "v2.40 \u2014 Node Reference",
    old: "# MUUSIA v2.39 \u2014 Node Reference",
    new: "# MUUSIA v2.40 \u2014 Node Reference",
  },
  {
    file: NODES,
    label: "NODES.md: Mask paragraph deprecation note",
    guard: "*(deprecated",
    old: "**Mask** \u2014 clips paths by closed mask shapes (keep inside/outside).",
    new: "**Mask** *(deprecated \u2014 hidden from the palette since 2.40; old patches keep\nworking)* \u2014 clips paths by closed mask shapes (keep inside/outside). Use\n**Container**, which does the same for wired shapes and adds parametric\nregions, rotation, \u00b1Gap and bisection-accurate cuts.",
  },
  {
    file: NODES,
    label: "NODES.md: Container paragraph notes it replaces Mask",
    guard: "Supersedes the deprecated Mask",
    old: `confines every mark of an effect inside a Potato; Container first lets the
wave overshoot the edge.`,
    new: `confines every mark of an effect inside a Potato; Container first lets the
wave overshoot the edge. Supersedes the deprecated Mask.`,
  },
  {
    file: HANDOFF,
    label: "2.40 version history entry",
    guard: "- **2.40** **Mask deprecated**",
    old: `  arranges only the selection). Applied via tools/patch-tidy.mjs.`,
    new: `  arranges only the selection). Applied via tools/patch-tidy.mjs.
- **2.40** **Mask deprecated** (soft): \`hidden: true\` removes it from the
  palette and quick-add, but the def stays in DEFS so every old patch loads
  and runs unchanged \u2014 the v2.21 hard-removal precedent was rejected here
  because Mask is old and common in saved patches. Desc + NODES.md point to
  **Container**, which supersedes it (wired regions + parametric shapes,
  rotation, \u00b1Gap, bisection-accurate cuts). Node counts unchanged: Mask
  remains a built-in, just unlisted. Applied via
  tools/patch-mask-deprecation.mjs.`,
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
