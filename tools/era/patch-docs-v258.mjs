/* patch-docs-v258.mjs — ONE-SHOT doc batch for v2.58, do not re-run.
 *
 *   D1  docs/MUUSIA-NODES.md title v2.57 -> v2.58
 *   D2  HANDOFF repo layout: docs/MUUSIA-TAGS.json line
 *   D3  HANDOFF version history: 2.58 entry
 *
 * Run once from repo root: node tools/era/patch-docs-v258.mjs
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

editFile("docs/MUUSIA-NODES.md", "D1 title v2.58",
  "# MUUSIA v2.57 \u2014 Node Reference",
  "# MUUSIA v2.58 \u2014 Node Reference");

editFile("docs/MUUSIA-HANDOFF.md", "D2 repo layout TAGS.json line",
  "MUUSIA-NODES-SRC.md (generated here by `tools/make-src-bundle.mjs`).",
  "MUUSIA-NODES-SRC.md (generated here by `tools/make-src-bundle.mjs`),\n  MUUSIA-TAGS.json (curated node tag vocabulary, ~55 tags; merged into\n  src/defs/catalog.js by make-catalog.mjs \u2014 tag a new node here in the doc\n  batch).",
  "replace");

editFile("docs/MUUSIA-HANDOFF.md", "D3 HANDOFF 2.58 entry",
  "thumbnail catalog (3).",
`

- **2.58** Tag vocabulary + chips (discovery phase 2 of 3). NEW DOC
  docs/MUUSIA-TAGS.json: a curated ~55-tag vocabulary over all 237 nodes
  (avg 3.7 tags/node, every node tagged) \u2014 built as a rule-based pass over
  name + desc + NODES.md paragraph with the palette's cat/group taxonomy as
  base tags, capped at 6 per node preferring rarer (more specific) tags,
  then hand-corrected. make-catalog.mjs merges it into catalog.js (the
  phase-2 seam shipped in 2.57), so tags score at weight 2 in the deep
  search with zero engine changes. patch-tag-chips-v258.mjs adds a
  module-scope CATALOG_TAGS aggregate and a browsable chips row in the
  quick-add modal (empty query only): top 18 tags with node counts, click
  = search that tag. Era validator extracts CATALOG_TAGS + the search
  block verbatim from App.jsx and proves vocabulary size, count sums,
  full node coverage and that every top-18 chip query returns its tagged
  nodes. TAGGING RULE: every new node gets a MUUSIA-TAGS.json entry in
  the doc batch \u2014 validate-tag-chips fails on untagged nodes. Next: the
  visual thumbnail catalog (phase 3).`,
  "after");

console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
