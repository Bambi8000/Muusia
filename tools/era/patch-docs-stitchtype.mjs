/* Doc batch for the Stitch Type node (key stitchtype).
   Run once from the repo root AFTER the version bump: node tools/era/patch-docs-stitchtype.mjs
   Anchored replacements; MISS aborts before anything is written; SKIP if already applied.
   Version and counts are read from disk, never hardcoded. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const KEY = "stitchtype", NAME = "Stitch Type";
let miss = 0;
const OK = (m) => console.log("OK    " + m);
const MISS = (m) => { console.log("MISS  " + m); miss++; };

/* ---- locate files ---- */
const find = (name) => { for (const d of ["docs", "."]) { const f = resolve(d, name); if (existsSync(f)) return f; } return null; };
const F_NODES = find("MUUSIA-NODES.md"), F_TAGS = find("MUUSIA-TAGS.json"), F_HAND = find("MUUSIA-HANDOFF.md"), F_APP = resolve("src/App.jsx");
for (const [n, f] of [["MUUSIA-NODES.md", F_NODES], ["MUUSIA-TAGS.json", F_TAGS], ["MUUSIA-HANDOFF.md", F_HAND], ["src/App.jsx", existsSync(F_APP) ? F_APP : null]]) if (!f) MISS(n + " not found");
if (miss) { console.log("ABORT nothing written"); process.exit(1); }

/* ---- facts from disk ---- */
const app = readFileSync(F_APP, "utf8");
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
const nodeDir = resolve("src/defs/nodes");
const files = readdirSync(nodeDir).filter((f) => f.endsWith(".js"));
if (!files.includes(KEY + ".js")) { console.log("MISS  src/defs/nodes/" + KEY + ".js not baked yet - ABORT"); process.exit(1); }
const catCount = (cat) => files.filter((f) => readFileSync(resolve(nodeDir, f), "utf8").includes('cat: "' + cat + '"')).length;
const nFiles = files.length, nTotal = nFiles + 2;           /* + group + reititys inline in App.jsx */
const nGen = catCount("gen"), nMod = catCount("mod");
console.log("INFO  version " + V + " · " + nFiles + " files · " + nTotal + " nodes · gen " + nGen + " · mod " + nMod);

let nodes = readFileSync(F_NODES, "utf8"), hand = readFileSync(F_HAND, "utf8");
const tags = JSON.parse(readFileSync(F_TAGS, "utf8"));

if (nodes.includes("**" + NAME + "**") && tags[KEY] && hand.includes("**" + NAME + "**")) { console.log("SKIP  already applied"); process.exit(0); }

/* one-hit regex replace */
const rep1 = (src, re, neu, label) => {
  const hits = (src.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
  if (hits !== 1) { MISS(label + " (" + hits + " hits)"); return src; }
  OK(label); return src.replace(re, neu);
};

/* ---------------------------------------------------------- NODES.md */
const PARA = `**${NAME}** — bitmap lettering dressed in layered stitch marks, in the manner
of an 8-bit sampler chart. Text is set in a pixel font (*Font* Bold 5x7,
Sampler 5x7 or Tiny 3x5; A–Z, 0–9, ÄÖÅ, punctuation, | starts a new line) and
every font pixel becomes a *Pixel* × *Pixel* block of stitch cells. Cells are
then classified by distance to the letter boundary, and each class gets its own
mark and pen: **Core** (inside, not touching the outside) carries the fill —
Cross X, Plus +, Diamond, Dots, Hatch / or \\, Rings; **Edge** (the letter's own
boundary ring) a lattice of joined plus marks, an Outline, Boxes, Dots or
Diagonals; **Halo** (the ring of cells just outside the letter, 8-connected)
horizontal or vertical stripes at *Halo stripes / cell*, Dashes, Dots or a
Zigzag; **Aura** (the next *Aura rings* out, 0–3) seeded Dashes, Dots, Ticks or
Crosses at *Aura fill* density, thinning ring by ring. **Pins** are long seeded
bars laid along the halo runs beside the stems (Vertical, Horizontal, Both or
None, density *Pin density*), the pink verticals of the reference chart.
*Preset* Sampler is that reference look (X / lattice / stripes / dashes /
vertical pins); Circuit, Knit and Dotted are ready variants; Custom exposes the
five mark selectors. *Cell mm* is the stitch pitch and stays exact unless the
block — rings included — cannot fit inside *Margin*, when it shrinks (never
grows). *Bridge diagonals* fills a 2×2 block where two font pixels touch only
at a corner, so Sampler and Tiny diagonals (Z, N, K, X) stay edge-connected
instead of falling into corner-touching blocks; Bold is already connected and
ignores it. Collinear marks are merged into single strokes — the X fill and
the lattice plot as long diagonals and rules, not thousands of ticks — and the
*Seed* only moves pins and aura, so the letter itself is stable while the
decoration re-rolls. Five pens by default: Purple core, Blue edge, Red halo,
Magenta pins, Orange aura; guides show the margin box, the letter block and
the outer ring box.

`;
nodes = rep1(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + V + " — Node Reference", "NODES header version");
nodes = rep1(nodes, /^All \d+ built-in nodes\./m, "All " + nTotal + " built-in nodes.", "NODES total count");
nodes = rep1(nodes, /^## Generators \(\d+\)\n\n/m, "## Generators (" + nGen + ")\n\n" + PARA, "NODES Generators count + paragraph");
nodes = rep1(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + nMod + ")", "NODES Modifiers count");

/* ---------------------------------------------------------- TAGS.json */
const VOCAB_BEFORE = new Set(Object.values(tags).flat()).size;
tags[KEY] = ["text", "grid", "weave", "fill", "retro", "decoration"];
const VOCAB_AFTER = new Set(Object.values(tags).flat()).size;
if (VOCAB_AFTER !== VOCAB_BEFORE) MISS("TAGS vocabulary changed " + VOCAB_BEFORE + " -> " + VOCAB_AFTER + " (invented tag)"); else OK("TAGS entry (vocabulary unchanged at " + VOCAB_AFTER + ")");
const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];

/* ---------------------------------------------------------- HANDOFF.md */
const HIST = `- **${V}** new **${NAME}** generator (gen/textimg, \`${KEY}\`): bitmap
  lettering (Bold/Sampler 5x7, Tiny 3x5, Pixel = cells per font pixel) with a
  distance-ring classification of the stitch grid — core / edge (inside),
  halo / aura rings (outside, 8-neighbour dilation) — and one mark family +
  pen per class (X · lattice · stripes · dashes · pink pins = the reference
  sampler chart; Circuit / Knit / Dotted presets; Custom exposes all five
  selectors). Collinear marks merge into runs (diagonals grouped by c−r / c+r,
  lattice by row/column), Bridge diagonals adds a 2×2 block at corner-only
  pixel contacts so thin-font diagonals stay connected, seed scoped to pins +
  aura only. Layout shared via \`this._layout\` (compute + overlay; overlay
  guarded for unbound this). 137-check validator rebuilds the grid through
  \`_layout\` and proves ring geometry, per-pen ring membership by sampling
  stroke interiors, both-diagonal coverage of every core cell, stripe count
  per run, seed scope, shrink-only fit and connectivity; mutation-tested
  (edge classification, halo ring, seedless hash2, bridge, merge, pin
  predicate, fit and 4- vs 8-neighbour rings each trip their own checks).

`;
hand = rep1(hand, /\n## Hard-won pitfalls \(keep\)\n/, "\n" + HIST + "## Hard-won pitfalls (keep)\n", "HANDOFF version history entry");
hand = rep1(hand, /\*\*\d+ files\*\* \(\d+ nodes total/, "**" + nFiles + " files** (" + nTotal + " nodes total", "HANDOFF file/node counts");
hand = rep1(hand, /Generators \d+, Modifiers \d+\)\. ESM format:/, "Generators " + nGen + ", Modifiers " + nMod + "). ESM format:", "HANDOFF gen/mod counts");
hand = rep1(hand, /`ls src\/defs\/nodes \| wc -l` \(\d+\)/, "`ls src/defs/nodes | wc -l` (" + nFiles + ")", "HANDOFF ls count");

if (miss) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_NODES, nodes);
writeFileSync(F_TAGS, JSON.stringify(sorted, null, 1) + "\n");
writeFileSync(F_HAND, hand);
console.log("DONE  docs written: MUUSIA-NODES.md, MUUSIA-TAGS.json, MUUSIA-HANDOFF.md (v" + V + ", " + nTotal + " nodes)");
