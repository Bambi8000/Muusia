/* Doc batch for the Kolam node (key kolam).
   Run once from the repo root AFTER the version bump: node tools/era/patch-docs-kolam.mjs
   Anchored replacements; MISS aborts before anything is written; SKIP if already applied.
   Version and counts are read from disk, never hardcoded. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const KEY = "kolam", NAME = "Kolam";
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
const PARA = `**${NAME}** — sikku (kambi) kolam: one or more closed loops winding at 45°
through a grid of dots, built as Gerdes mirror curves. At every midpoint between
two neighbouring dots the line either crosses straight into the next cell or
turns and keeps circling the same dot; on the outer edge of the dot set it
always turns, which gives the teardrop loops around the border dots. Every
ray closes on itself, so the output is a set of closed strands. *Layout*
Interlaced is the classic idukku-pulli chart (*Rows* display rows alternating
*Cols* and Cols−1 dots — 4 × 7 is the 1-3-5-7-5-3-1 diamond), Square is
Cols × Rows, Diamond is |i|+|j| ≤ *Radius*, Wired region puts dots wherever
the wired closed shape covers the lattice at *Pitch* (any silhouette becomes
a kolam); *Rotate 45°* turns the lattice. *Turns %* is the seeded density of
interior turns. *Strands* Free keeps whatever the mirrors give (a plain n × m
grid gives gcd(n, m) loops), Single line merges everything into one unbroken
kolam by toggling turns where two strands meet, Target count aims at N. *Loop
reach* stretches the border loops outward, *Turn size* the interior loops,
*Roundness* rounds the 45° polygon into arcs (0 = angular chart). *Crossings*
Cross draws real X crossings; Under gaps cuts the under strand at every
crossing with a consistent alternating over/under — the knot look — at *Gap
mm*. *Render* Centerline plots the line; Ribbon plots one distance-field
isoline at *Width*/2 around the whole line, so crossings fuse into a single
shape like rice paste on the floor; Contours nests *Contours* isolines
*Contour step* apart; Centerline + ribbon draws both, the ribbon on *Ribbon
pen* (*Field cell* is the SDF resolution). *Dots* draws the dot grid, Row
numbers or Strand numbers write SFONT digits at the dots (*Number size*),
rows counted from the bottom as kolam charts do. *Pen per strand* cycles a
pen per closed loop. Pitch stays exact unless the drawing — loops included —
cannot fit inside *Margin*, when it shrinks. Region input is optional (Wired
region only); Style input is the second pin.

`;
nodes = rep1(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + V + " — Node Reference", "NODES header version");
nodes = rep1(nodes, /^All \d+ built-in nodes\./m, "All " + nTotal + " built-in nodes.", "NODES total count");
nodes = rep1(nodes, /^## Generators \(\d+\)\n\n/m, "## Generators (" + nGen + ")\n\n" + PARA, "NODES Generators count + paragraph");
nodes = rep1(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + nMod + ")", "NODES Modifiers count");

/* ---------------------------------------------------------- TAGS.json */
const VOCAB_BEFORE = new Set(Object.values(tags).flat()).size;
tags[KEY] = ["geometric", "grid", "weave", "decoration", "symmetry"];
const VOCAB_AFTER = new Set(Object.values(tags).flat()).size;
if (VOCAB_AFTER !== VOCAB_BEFORE) MISS("TAGS vocabulary changed " + VOCAB_BEFORE + " -> " + VOCAB_AFTER + " (invented tag)"); else OK("TAGS entry (vocabulary unchanged at " + VOCAB_AFTER + ")");
const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];

/* ---------------------------------------------------------- HANDOFF.md */
const HIST = `- **${V}** new **${NAME}** generator (gen/geometric, \`${KEY}\`): sikku kolam
  as Gerdes mirror curves on a dot lattice. Midpoints stored in doubled
  integer coords; a ray at 45° crosses or reflects at each midpoint (boundary
  edges always reflect → border teardrop loops); state = (midpoint, outgoing
  dir), both orientations marked per traced cycle so each geometric strand is
  found once. Turns % = seeded interior mirrors; Single line / Target count =
  greedy toggling of an edge whose two sides belong to different strands
  (merge, −1) or the same strand (split attempt), retracing after each toggle.
  Layouts Interlaced (idukku pulli, u=i−j / v=i+j rectangle with parity),
  Square, Diamond, Wired region (lattice points inside the wired polygon,
  pitch kept exact). Rendering: control polygon = midpoints with turning
  points pushed outward (Loop reach / Turn size), Chaikin ×0–4 (collinear
  crossings stay exact X); Under gaps cuts only the pass parallel to the
  under direction (the same strand also crosses on top) using the checkerboard
  rule (horizontal-edge crossing: NE/SW over; vertical: NW/SE over) which
  alternates along every strand through turns; Ribbon / Contours = distance
  field over bucketed segments + marching squares (sdfcontours lineage),
  isolines at Width/2 + k·step. SFONT row / strand numbers, dots, pen per
  strand. 121-check validator: gcd law on n × m grids, single line over 192
  layout × seed × turns cases, every pass covered once, exact 90° crossings
  on the raw polygon, one open piece per crossing + two piece ends per
  crossing + alternation derived from the output, isoline distance ± field
  cell, border loop apex, chart-style bottom-up row numbers, wired-region
  containment; mutation-tested (mirrors ignored, reverse orientation, merge
  disabled, non-alternating over/under, double cut, reach, ribbon width,
  fit, row order each trip their own checks).

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
