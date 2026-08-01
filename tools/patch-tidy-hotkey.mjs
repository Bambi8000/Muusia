#!/usr/bin/env node
/* tools/patch-tidy-hotkey.mjs
   Hotkey T = Tidy. Adds the key to the global keydown handler (input fields
   already guarded), the Tidy button tooltip, the shortcuts help, and the
   HANDOFF 2.39 entry. Run from repo root AFTER patch-tidy.mjs:
     node tools/patch-tidy-hotkey.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const APP = "src/App.jsx";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

const EDITS = [
  {
    file: APP,
    label: "keydown: T -> tidyNodes (before quick-add branch)",
    guard: '=== "t") { e.preventDefault(); tidyNodes(); }',
    old: `      else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const map = { g: "gen", m: "mod", d: "dec", c: "duo", x: "math", n: null };`,
    new: `      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); tidyNodes(); }
      else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const map = { g: "gen", m: "mod", d: "dec", c: "duo", x: "math", n: null };`,
  },
  {
    file: APP,
    label: "Tidy button tooltip mentions T",
    guard: 'title="T \u2014 arrange nodes',
    old: `title="Arrange nodes left\u2192right by dataflow \u00b7 2+ selected: tidy only the selection">Tidy</button>`,
    new: `title="T \u2014 arrange nodes left\u2192right by dataflow \u00b7 2+ selected: tidy only the selection">Tidy</button>`,
  },
  {
    file: APP,
    label: "shortcuts help: T line after Space",
    guard: 'T \\u2014 tidy',
    old: `                "Space \\u2014 toggle large preview (with route simulator).",`,
    new: `                "Space \\u2014 toggle large preview (with route simulator).",
                "T \\u2014 tidy: arrange nodes left\\u2192right by dataflow (2+ selected: only the selection).",`,
  },
  {
    file: HANDOFF,
    label: "2.39 entry: hotkey T",
    guard: "hotkey **T**",
    old: `a toolbar **Tidy** button (left\u2192right
  dependency columns by longest-path depth with cycle guard,`,
    new: `a toolbar **Tidy** button (hotkey **T**; left\u2192right
  dependency columns by longest-path depth with cycle guard,`,
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
