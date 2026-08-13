/* patch-docs-v259.mjs — ONE-SHOT doc batch for v2.59, do not re-run.
 *
 *   D1  docs/MUUSIA-NODES.md title v2.58 -> v2.59
 *   D2  HANDOFF repo layout: src/catalog-browser.jsx bullet
 *   D3  HANDOFF 2.58 entry wording fix: chips show ALL tags (v258b)
 *   D4  HANDOFF version history: 2.59 entry
 *
 * Run once from repo root: node tools/era/patch-docs-v259.mjs
 */

import fs from "fs";

let ok = 0, miss = 0;

function editFile(file, id, anchor, replacement, mode) {
  let src = fs.readFileSync(file, "utf8");
  const n = src.split(anchor).length - 1;
  if (n !== 1) { console.log("MISS " + id + " (anchor found " + n + "x in " + file + ")"); miss++; return; }
  src = src.replace(anchor,
    mode === "after" ? anchor + replacement :
    mode === "before" ? replacement + anchor : replacement);
  fs.writeFileSync(file, src);
  console.log("OK   " + id);
  ok++;
}

editFile("docs/MUUSIA-NODES.md", "D1 title v2.59",
  "# MUUSIA v2.58 \u2014 Node Reference",
  "# MUUSIA v2.59 \u2014 Node Reference");

editFile("docs/MUUSIA-HANDOFF.md", "D2 repo layout catalog-browser bullet",
  "Wired into App.jsx via tools/era/patch-dro.mjs.",
  `Wired into App.jsx via tools/era/patch-dro.mjs.
- \`src/catalog-browser.jsx\` — the visual node catalog (B / toolbar Catalog):
  every non-hidden node as a live thumbnail (compute with default params on a
  fixed 150\u00d7100 mm thumb canvas; paths inputs get standard fixtures \u2014 first
  input circle+squiggle+rows, later inputs squiggle+rows so duo nodes see two
  different sets; 6000-pt budget per thumb, lazy 3-per-tick chunks, session
  cache). Deep search + category/tag filters + Surprise me; value/style
  outputs and file-input nodes get typed placeholders. Self-contained module
  (DEFS/CATALOG/PENS/theme injected as props), wired via
  tools/era/patch-catalog-browser-v259.mjs.`,
  "replace");

editFile("docs/MUUSIA-HANDOFF.md", "D3 2.58 wording fix (all tags)",
  "quick-add modal (empty query only): top 18 tags with node counts, click",
  "quick-add modal (empty query only): the full tag cloud with node counts\n  (v258b widened it from top-18 \u2014 the rare tags are the inspiring ones), click",
  "replace");

editFile("docs/MUUSIA-HANDOFF.md", "D4 HANDOFF 2.59 entry",
  "visual thumbnail catalog (phase 3).",
`visual thumbnail catalog (phase 3).

- **2.59** Visual node catalog (discovery phase 3 of 3). NEW MODULE
  src/catalog-browser.jsx (dro.jsx pattern: self-contained, everything
  injected as props, wired by an anchored era patch): a full-screen overlay
  \u2014 B key or the toolbar Catalog button \u2014 rendering every non-hidden node
  as a LIVE thumbnail: compute with default params on a fixed 150x100 mm
  thumb ctx, exact engine call signature (ins, params, ctx, node); paths
  inputs get standard fixtures, and the SECOND paths input gets a
  DIFFERENT fixture than the first so duo/region nodes (Container, Wind
  Tunnel, Occlude...) show a real interaction instead of self-erasure.
  Dynamic ins (a function of params, e.g. Merge) are resolved before
  wiring. 6000-pt budget per thumb, lazy 3-per-tick chunked computation
  (the overlay opens instantly), per-session cache keyed by node \u2014 default
  seeds make every thumbnail deterministic. Value outputs render the
  number, style outputs a dash sample, file-input nodes a "needs a file"
  badge; coverage 215/233 live + 9 value + 1 style + 7 file, 0 errors
  (only negspace has no preview \u2014 it needs genuinely overlapping inputs).
  Deep search (same scoring as quick-add), category chips, full tag-cloud
  filter, Surprise me (adds a random node from the current filter), click
  a card = addNode with an Added-flash, browser stays open. Era validator
  extracts fixture+computeThumb VERBATIM from the module and runs it over
  every def: no escaped exceptions, budget held, finite coords, >=85%
  live-thumbnail rate, byte-identical re-runs. Discovery series complete:
  deep search (2.57) + tags (2.58) + visual catalog (2.59).`,
  "after");

console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
