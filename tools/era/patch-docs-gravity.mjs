/* Doc batch for the Gravity node (key gravity) + Mosaic group fix.
   Run once from the repo root AFTER the version bump: node tools/era/patch-docs-gravity.mjs
   Anchored replacements; MISS aborts before anything is written; SKIP if already applied.
   Version and counts are read from disk, never hardcoded. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const KEY = "gravity", NAME = "Gravity";
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
const PARA = `**${NAME}** — a regular grid of stamps lets go from the bottom up: rows
below the *Release* line detach, fall and pile into a heap on the floor of
the margin box while the top of the grid stays intact — the falling-dots
print. *Stamp* is a Dot, Ring, Square, Diamond or Cross, or the wired
**Stamp** paths normalised to a unit box and repeated in every cell (*Stamp
size* × cell; a Lettering glyph, a leaf, anything). *Release* sets how much of
the sheet has let go, *Softness* blurs the line with a hashed term, *Clumps*
adds a noise2 field that frees clusters higher up. Every released element
gets a hashed fall fraction: *Progress* is the share that has already landed,
the rest hang mid-fall skewed toward "just let go"; along the fall *Drift*
moves them sideways with noise, *Spin* rotates them (hashed direction, shows
on non-round stamps), *Size mod* shrinks or grows them, and *Grid jitter*
shakes the intact elements near the line. *Pile* Heap drops the landed
elements in seeded order into a 1-D height field that rolls to the lower
neighbour like sand (*Pile spread* pulls landings toward the middle for a
central mound, *Packing* sets the stacking density), Floor lays them on the
floor line, None lets them fall off the sheet. *Palette* 1–4 pens assigned by
Diagonal (the i + j pattern of the classic print), Rows, Columns or Random —
the colour travels with the element into the heap. Release 0 is the exact
grid; the *Seed* moves only the released elements and the jitter. Guides show
the margin box, the grid and the floor line.

`;
nodes = rep1(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + V + " — Node Reference", "NODES header version");
nodes = rep1(nodes, /^All \d+ built-in nodes\./m, "All " + nTotal + " built-in nodes.", "NODES total count");
nodes = rep1(nodes, /^## Generators \(\d+\)\n\n/m, "## Generators (" + nGen + ")\n\n" + PARA, "NODES Generators count + paragraph");
nodes = rep1(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + nMod + ")", "NODES Modifiers count");

/* ---------------------------------------------------------- TAGS.json */
const VOCAB_BEFORE = new Set(Object.values(tags).flat()).size;
tags[KEY] = ["grid", "dots", "physics", "scatter", "noise"];
const VOCAB_AFTER = new Set(Object.values(tags).flat()).size;
if (VOCAB_AFTER !== VOCAB_BEFORE) MISS("TAGS vocabulary changed " + VOCAB_BEFORE + " -> " + VOCAB_AFTER + " (invented tag)"); else OK("TAGS entry (vocabulary unchanged at " + VOCAB_AFTER + ")");
const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];

/* ---------------------------------------------------------- HANDOFF.md */
const HIST = `- **${V}** new **${NAME}** generator (gen/geometric, \`${KEY}\`, Stamp pin
  optional): grid of stamps releasing from the bottom up. Release score =
  row position + noise2 clump field + hashed softness; released elements get
  a hashed fall fraction (Progress = landed share, the rest skewed toward
  just-released by a 2.2 power), Drift / Spin / Size mod ramp with the
  fraction, Grid jitter shakes intact elements near the line (zero at
  Release 0 so the grid is exact). Heap = seeded landing order into a 1-D
  height field with downhill rolling (sandpile), Pile spread pulls landings
  toward the centre, Packing sets increments; Floor / None alternatives.
  Wired stamps normalised to a unit box; built-in Dot segments sized by
  plotted radius and trimmed under the budget (80 × 80 Ring stays under
  112 k pts). Palette 1–4 with Diagonal / Rows / Columns / Random
  assignment, colour travels with the element. 106-check validator via
  \`_layout\` states and output geometry: exact grid at Release 0, crisp line
  at Softness 0 + Clumps 0, landed share ≈ Progress, drift/spin/size scaling
  with the fall, no same-column overlap and a sandpile slope limit in the
  heap, mound position vs Pile spread, Floor / None counts, stamp
  normalisation, pen assignment incl. landed elements, seed scope; 10
  mutations each trip their own checks. Also fixes Mosaic's palette folder
  (group texture → fillstyle; "texture" was not a MOD_GROUPS key so the node
  was invisible in folder view).

`;
hand = rep1(hand, /\n## Hard-won pitfalls \(keep\)\n/, "\n" + HIST + "## Hard-won pitfalls (keep)\n", "HANDOFF version history entry");
hand = rep1(hand, /\*\*\d+ files\*\* \(\d+ nodes total/, "**" + nFiles + " files** (" + nTotal + " nodes total", "HANDOFF file/node counts");
hand = rep1(hand, /Generators \d+, Modifiers \d+\)\. ESM format:/, "Generators " + nGen + ", Modifiers " + nMod + "). ESM format:", "HANDOFF gen/mod counts");
hand = rep1(hand, /`ls src\/defs\/nodes \| wc -l` \(\d+\)/, "`ls src/defs/nodes | wc -l` (" + nFiles + ")", "HANDOFF ls count");

/* Mosaic folder fix in the HANDOFF text (optional: skip if already fixed) */
if (hand.includes("(mod/texture, `mosaic`")) { hand = hand.replace("(mod/texture, `mosaic`", "(mod/fillstyle, `mosaic`"); OK("HANDOFF mosaic group text -> fillstyle"); } else console.log("SKIP  HANDOFF mosaic group text already fillstyle");

if (miss) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_NODES, nodes);
writeFileSync(F_TAGS, JSON.stringify(sorted, null, 1) + "\n");
writeFileSync(F_HAND, hand);
console.log("DONE  docs written: MUUSIA-NODES.md, MUUSIA-TAGS.json, MUUSIA-HANDOFF.md (v" + V + ", " + nTotal + " nodes)");
