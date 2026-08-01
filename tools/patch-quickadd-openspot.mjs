#!/usr/bin/env node
/* tools/patch-quickadd-openspot.mjs
   Fix: quick-add (G/M/D/C/X/N + Enter, and clicking a quick-add result)
   called addNodeAt directly at the viewport CENTER - always the same spot,
   bypassing the empty-space placement entirely. Route it through addNode so
   quick-add gets the same clearance-max placement as a palette click.
   Run from repo root:
     node tools/patch-quickadd-openspot.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const APP = "src/App.jsx";

const EDITS = [
  {
    file: APP,
    label: "quick-add addSelected -> addNode (empty-space placement)",
    guard: "empty-space placement, same as palette click",
    old: `        const addSelected = (type) => {
          const cx = areaRef.current ? (areaRef.current.scrollLeft + areaRef.current.clientWidth / 2) / zoom - NODE_W / 2 : 120;
          const cy = areaRef.current ? (areaRef.current.scrollTop + areaRef.current.clientHeight / 2) / zoom - 100 : 120;
          addNodeAt(type, Math.max(0, cx), Math.max(0, cy));
          setQuickAdd(null);
        };`,
    new: `        const addSelected = (type) => {
          addNode(type); /* empty-space placement, same as palette click */
          setQuickAdd(null);
        };`,
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
