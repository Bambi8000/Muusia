/* patch-morph-docs.mjs — docs batch for the Morph Layers release.
 *
 * Run AFTER bake + version bump (facts from the repo at run time: node
 * counts from src/defs/nodes, APP_VERSION from src/App.jsx). Edits:
 *   - docs/MUUSIA-NODES.md: Morph Layers paragraph at the end of
 *     Combiners, title version, total count, Combiners count
 *   - docs/MUUSIA-TAGS.json: "morphlayers" entry (alphabetical position)
 *   - docs/MUUSIA-HANDOFF.md: version-history entry
 * Anchored, MISS aborts, idempotent.
 *   node tools/era/patch-morph-docs.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const APP = readFileSync("src/App.jsx", "utf8");
const vm = APP.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found"); process.exit(1); }
const V = vm[1];

const nodeFiles = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
const total = nodeFiles.length;
let duo = 0;
for (const f of nodeFiles) {
  if (/cat:\s*"duo"/.test(readFileSync("src/defs/nodes/" + f, "utf8"))) duo++;
}
if (!nodeFiles.includes("morphlayers.js")) {
  console.log("MISS  src/defs/nodes/morphlayers.js not baked yet — run node tools/bake.mjs morphlayers first");
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
if (nodesDoc0.includes("**Morph Layers**")) {
  console.log("SKIP  patch-morph-docs already applied");
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
    name: "N4 morph paragraph",
    anchor: `sheet regardless of the frame. Each sheet keeps its full pen colors; unwired
inputs yield an empty sheet.`,
    insert: `

**Morph Layers** \u2014 in-between generator for layered plexi/glass stacks: wire
the first and last compositions in and the node builds the missing layers by
shape interpolation (Layers 2\u201312). Match picks the correspondence:
*Split & merge* (default) is built for cut/fragmented geometry \u2014 the side
with more paths assigns its fragments to the nearest target shapes, and each
target's perimeter is partitioned into consecutive arcs proportional to the
fragments' lengths, ordered by position along the outline, so glitch cuts
morph smoothly into (and out of) whole shapes while keeping the cut
structure; *Nearest* pairs by centroid and lets unpaired paths be born from /
die into their own centroid (separate-blob scenes); *By order* cycles by
index. Pairs resample to a common point count and closed 1:1 pairs align by
start-index rotation + direction so the lerp does not twist. Output Sheets
is frame-domain like the Sheets node (layer i on frame i, source pens kept,
Stack View auto-detects the Layers count); Output Pens draws every layer at
once with pen (First pen + i) mod 12. Ease Smooth slows both ends.`,
  },
]);
if (!nodesDoc) process.exit(1);

/* ---------- MUUSIA-TAGS.json ---------- */
const TAGS = "docs/MUUSIA-TAGS.json";
const tagsDoc = apply(TAGS, [
  {
    name: "T1 morphlayers tags",
    anchor: ` "mooncraters": [\n  "3d",\n  "mesh",\n  "nature",\n  "round",\n  "terrain",\n  "warp"\n ],\n`,
    insert: ` "morphlayers": [\n  "animation",\n  "combine",\n  "deform",\n  "stack"\n ],\n`,
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
- **${V}** Morph Layers node (the plexi stack family grows). NEW NODE
  morphlayers (duo): inputs first/last, builds the in-between layers by
  shape interpolation \u2014 Layers 2\u201312, Samples (per-path arc-length
  resampling to a COMMON point count via a local resampleN, because the
  resample helper takes a step in mm, not a count \u2014 contract read from
  helpers.js first this time), Ease Linear/Smooth (endpoints stay exact).
  Match modes: Split & merge (DEFAULT, added after the first lab test
  showed nearest-centroid clumping on 3D Glitch cut lines \u2014 the fragment
  side assigns to nearest targets and each target perimeter partitions
  into consecutive arcs proportional to fragment lengths, ordered by
  outline position, works both directions, degenerates to Nearest on
  equal counts, fragment-less targets fall back to birth/death); Nearest
  (centroid pairing + birth/death); By order (modulo index cycling). All
  deterministic, no seed; closed 1:1 pairs align by start-index rotation
  + direction reversal minimizing summed squared distance (kills lerp
  twist); dead paths dropped when the bbox diagonal falls under 0.05 mm.
  Output
  Sheets = frame-domain (layer ctx.frameIdx only, cheap: one layer built
  per eval, source pens kept); Output Pens = all layers at once, pen
  (First pen + i) mod 12. tools/era/patch-stack-morph.mjs extends the
  Stack View sheetsCount walk: a morphlayers node with Output "Sheets"
  drives the sheet count with its Layers param (Pens mode never does).
  Tags animation/combine/deform/stack. Validator
  tools/validate-morphlayers.mjs (real helpers, lab/baked auto-switch,
  paren-wrapped eval): bbox-exact endpoints, midpoint between, closed
  handling, sample-count exactness, frame clamping, null-ctx, pen walk,
  nearest-centroid vs input order, birth/death both directions,
  EMPTY on missing/empty inputs, no mutation, determinism, finiteness,
  Split & merge both directions (fragment count and cut structure kept at
  both ends, arc lengths partition the full perimeter, mid layers free of
  birth/death clumps), By order modulo \u2014 42 checks.

## Hard-won pitfalls (keep)`,
  },
]);
if (!handoffDoc) process.exit(1);

writeFileSync(NODES, nodesDoc);
writeFileSync(TAGS, tagsDoc);
writeFileSync(HANDOFF, handoffDoc);
console.log(`DONE  NODES.md (4 edits) + TAGS.json (1) + HANDOFF.md (1) written (version ${V})`);
