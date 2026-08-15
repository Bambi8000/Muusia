/* patch-sheets-docs.mjs — docs batch for the Sheets node release.
 *
 * Run AFTER bake + version bump (reads facts from the repo at run time):
 *   - node counts from src/defs/nodes (ls-based, never from stale docs)
 *   - APP_VERSION from src/App.jsx
 * Edits:
 *   - docs/MUUSIA-NODES.md: Sheets paragraph at the end of Combiners,
 *     title version, total count, Combiners count
 *   - docs/MUUSIA-TAGS.json: "sheets" entry (alphabetical position)
 *   - docs/MUUSIA-HANDOFF.md: version-history entry
 * Anchored, MISS aborts, idempotent.
 *   node tools/era/patch-sheets-docs.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const APP = readFileSync("src/App.jsx", "utf8");
const vm = APP.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found"); process.exit(1); }
const V = vm[1];

/* facts from the repo, never from docs */
const nodeFiles = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
const total = nodeFiles.length;
let duo = 0;
for (const f of nodeFiles) {
  if (/cat:\s*"duo"/.test(readFileSync("src/defs/nodes/" + f, "utf8"))) duo++;
}
if (!nodeFiles.includes("sheets.js")) {
  console.log("MISS  src/defs/nodes/sheets.js not baked yet — run node tools/bake.mjs sheets first");
  process.exit(1);
}
console.log(`facts total=${total} duo=${duo} version=${V}`);

let fail = false;
const apply = (file, edits) => {
  let doc = readFileSync(file, "utf8");
  for (const e of edits) {
    const parts = doc.split(e.anchor);
    if (parts.length !== 2) { console.log(`MISS  ${e.name} (${parts.length - 1} hits)`); fail = true; }
    else console.log(`OK    ${e.name}`);
  }
  if (fail) return null;
  for (const e of edits) {
    const parts = doc.split(e.anchor);
    if (parts.length !== 2) { console.log(`ABORT ${e.name} anchor drift`); fail = true; return null; }
    doc = parts[0] + (e.replace !== undefined ? e.replace : e.anchor + e.insert) + parts[1];
  }
  return doc;
};

/* ---------- MUUSIA-NODES.md ---------- */
const NODES = "docs/MUUSIA-NODES.md";
const nodesDoc0 = readFileSync(NODES, "utf8");
if (nodesDoc0.includes("**Sheets**")) {
  console.log("SKIP  patch-sheets-docs already applied");
  process.exit(0);
}
const titleM = nodesDoc0.match(/# MUUSIA v[\d.]+ \u2014 Node Reference/);
const totalM = nodesDoc0.match(/All \d+ built-in nodes/);
const duoM = nodesDoc0.match(/## Combiners \(\d+\)/);
if (!titleM || !totalM || !duoM) { console.log("MISS  NODES.md header anchors"); process.exit(1); }

const nodesDoc = apply(NODES, [
  { name: "N1 title version", anchor: titleM[0], replace: `# MUUSIA v${V} \u2014 Node Reference` },
  { name: "N2 total count", anchor: totalM[0], replace: `All ${total} built-in nodes` },
  { name: "N3 combiners count", anchor: duoM[0], replace: `## Combiners (${duo})` },
  {
    name: "N4 sheets paragraph",
    anchor: `for add-only modifiers; Distance match tolerates wobble and splits (Hand Drawn)
within the tolerance.`,
    insert: `

**Sheets** \u2014 frame-domain sheet selector for layered plexi/glass pieces:
Merge-shaped inputs, but exactly ONE passes through \u2014 the input whose index
equals the current animation frame. Set ANIMATE Frames = wired inputs and
every frame is one sheet: the scrubber flips through sheets in the editor,
Stack View (S) auto-detects the node and stacks the wired inputs in 3D, and
every per-frame export writes one file per sheet. Select Manual pins one
sheet regardless of the frame. Each sheet keeps its full pen colors; unwired
inputs yield an empty sheet.`,
  },
]);
if (!nodesDoc) process.exit(1);

/* ---------- MUUSIA-TAGS.json ---------- */
const TAGS = "docs/MUUSIA-TAGS.json";
const tagsDoc = apply(TAGS, [
  {
    name: "T1 sheets tags",
    anchor: ` "shaper": [\n  "math"\n ],\n`,
    insert: ` "sheets": [\n  "animation",\n  "combine",\n  "stack"\n ],\n`,
  },
]);
if (!tagsDoc) process.exit(1);

/* ---------- MUUSIA-HANDOFF.md ---------- */
const HANDOFF = "docs/MUUSIA-HANDOFF.md";
const handoffDoc = apply(HANDOFF, [
  {
    name: "H1 version-history entry",
    anchor: "\n## Hard-won pitfalls (keep)",
    replace: `
- **${V}** Sheets node (phase 3 of the layered plexi/glass workflow \u2014 the
  stack pipeline is complete). NEW NODE sheets (duo, Merge-shaped): N paths
  inputs (count 2\u201312), passes through exactly ONE \u2014 the input whose index
  equals ctx.frameIdx (clamped into the pin range) \u2014 so with ANIMATE
  Frames = wired inputs every frame is one sheet; each sheet keeps its full
  pen colors, unlike pens-as-sheets. Select Manual pins one sheet for
  editing without touching ANIMATE; the ANIMATE scrubber flips sheets live
  (frameIdx rides the main eval ctx). Unwired input \u2192 EMPTY. No randomness.
  Tags animation/combine/stack \u2014 "stack" is a NEW vocabulary tag so the
  deep search finds the node at tag weight for "stack" queries; the plural
  "stacks" hits via the NODES.md paragraph at deep weight (word-start
  matching: query must prefix-match the text, not vice versa).
  Stack View auto-detect: tools/era/patch-stack-sheets.mjs injects a
  sheetsCount prop (recursive graph scan incl. groups for type "sheets",
  max distinct wired numeric toPorts \u2014 param wires "p:key" excluded);
  when > 0 the overlay takes its sheet count from the node instead of the
  ANIMATE frame count, labels switch frame\u2192sheet and a hint shows the
  wired-input count. Validator tools/validate-sheets.mjs uses the REAL
  src/defs/helpers.js, auto-switches baked/lab, and covers pin-count
  dynamics, frame/Manual selection, clamping both ways, null-ctx
  tolerance, unwired\u2192EMPTY, multi-pen passthrough without mutation,
  count clamp and determinism. Docs counts in this batch read from
  src/defs/nodes at patch run time, never from stale docs.

## Hard-won pitfalls (keep)`,
  },
]);
if (!handoffDoc) process.exit(1);

writeFileSync(NODES, nodesDoc);
writeFileSync(TAGS, tagsDoc);
writeFileSync(HANDOFF, handoffDoc);
console.log(`DONE  NODES.md (4 edits) + TAGS.json (1) + HANDOFF.md (1) written (version ${V})`);
