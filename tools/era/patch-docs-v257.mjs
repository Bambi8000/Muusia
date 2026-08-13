/* patch-docs-v257.mjs — ONE-SHOT doc batch for v2.57, do not re-run.
 *
 *   D1  docs/MUUSIA-NODES.md title v2.56 -> v2.57
 *   D2  Braille + Numerals paragraphs (gen/textimg, inserted before Slide Rule)
 *   D3  Millimeter Paper + River paragraphs (end of Generators section)
 *   D4  Needle Punch paragraph (end of Modifiers section)
 *   D5  docs/MUUSIA-HANDOFF.md version history: 2.57 entry
 *
 * Node counts are unchanged (all five nodes already exist and are counted).
 * After this: node tools/make-catalog.mjs  (regenerates catalog with the new
 * paragraphs — expect 237 matched, zero WARN) then node tools/validate-catalog.mjs.
 *
 * Run once from repo root: node tools/era/patch-docs-v257.mjs
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

const NODES = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

/* ---------- D1: title version ---------- */
editFile(NODES, "D1 title v2.57",
  "# MUUSIA v2.56 \u2014 Node Reference",
  "# MUUSIA v2.57 \u2014 Node Reference");

/* ---------- D2: Braille + Numerals (textimg cluster, before Slide Rule) ---------- */
editFile(NODES, "D2 Braille + Numerals paragraphs",
  "**Slide Rule**",
`**Braille** \u2014 Grade 1 braille as a grid of dot circles at standard geometry
(2.5 mm dot pitch, 6 mm cell, 10 mm line at Scale 1). Letters a\u2013z plus Nordic
\u00e5/\u00e4/\u00f6; digits get the number sign, capitals the capital sign, punctuation
follows the Finnish table; | starts a new line. *Mirror* flips the whole block
like a stamp (cells reverse AND dot columns swap) for punching from the front
and reading the embossed bumps from the back \u2014 chain into Needle Punch with
*Punch at: Centers* to pierce every dot, or plot the circles directly with a
pen. When the node is selected, an overlay shows each cell's letter above it,
unmirrored and readable; unknown characters are skipped.

**Numerals** \u2014 numbers in sixteen numeral systems from around the world as
plottable strokes. Digit scripts (Western, Eastern Arabic, Persian, Devanagari,
Mongolian, Chinese) render digit by digit; value systems convert the whole
number: Roman (subtractive, N for zero), Maya (base-20 dot-and-bar stacks,
shell zero), Cistercian (one monk-glyph per number 0\u20139999), Babylonian
(base-60 cuneiform wedges), Counting rods (alternating orientation per place),
Kaktovik (I\u00f1upiaq base-20 connected strokes), plus Braille, Dot matrix 5\u00d77,
7-segment and 14-segment displays. *Value* takes several numbers separated by
spaces and *Tokens per line* wraps them into a table \u2014 run a counting table
per system, or stack the same number in every system down the sheet.

`,
  "before");

/* ---------- D3: Millimeter Paper + River (end of Generators) ---------- */
editFile(NODES, "D3 Millimeter Paper + River paragraphs",
  "## Modifiers (69)",
`**Millimeter Paper** \u2014 technical millimeter / graph paper: a grid of Fine-step
lines with every Nth line promoted to Medium and every Nth to Major, each level
on its own pen \u2014 the classic three-weight look from three colors, or plot the
same pen 2\u20133 times for real line weight. *Whole major cells* snaps the grid
down to complete major squares centered inside the margin; Border toggles the
frame. Each line draws once at its highest level and lines serpentine for
faster plotting; set a level's *every* to 0 to disable it, untick Fine lines
for a cm-only grid. Wire a Stroke style for dashed engineering grids, or feed
the output through Wave/Lens for distorted graph-paper art.

**River** \u2014 meander-migration solver: the river centerline's per-point
curvature is measured with an upstream flow-memory lag and every point migrates
toward the outer bank a little each step \u2014 bends grow, wander downstream, and
when a loop folds back on itself the neck is cut and the abandoned arc is left
behind as a closed oxbow lake. All simulated steps stack into one drawing:
*Steps* sets the simulation length, *Draw every* picks the inked intermediate
channels, the final channel and the oxbows draw with their own pens. Migration
is the erosion speed, Flow memory shifts meanders downstream, Channel width is
the neck-cutoff distance, Confinement pulls the river back toward the valley
axis. Wire Steps or Migration from the Frame clock to animate the river
carving itself.

`,
  "before");

/* ---------- D4: Needle Punch (end of Modifiers) ---------- */
editFile(NODES, "D4 Needle Punch paragraph",
  "## Decorators (6)",
`**Needle Punch** (penout) \u2014 converts lines into needle piercings for a needle
mounted in the pen carriage (paper raised on foam): each punch is a zero-length
path whose points carry z = *Depth* mm below the machine profile's pen-down
contact, read by the G-code export. *Punch at* Interval walks each path every
Interval mm (with Offset and *Punch ends*), Intersections punches every line
crossing including self-crossings, Both combines them, Centers punches once at
each path's centroid \u2014 chain Braille or Single Marker into it. *Spacing mod*
varies the interval along the arc (Wave / Noise / Ramp / Jitter, up to \u00b1100 %
swing, floored at 0.1 mm); *Min gap* merges punches so the needle never stabs
the same hole twice. Punches preview as round dots. Bed-Z machines only (servo
mode ignores z), and keep it LAST in the chain \u2014 any modifier after it strips
the z component.

`,
  "before");

/* ---------- D5: HANDOFF history entry ---------- */
editFile(HANDOFF, "D5 HANDOFF 2.57 entry",
  "Hatch+Hatch at 4 deg = shadow bands.",
`

- **2.57** Node catalog + deep search (discovery phase 1 of 3). NEW GENERATED
  MODULE src/defs/catalog.js: tools/make-catalog.mjs parses the per-node
  paragraphs out of docs/MUUSIA-NODES.md (+ optional curated tags from
  docs/MUUSIA-TAGS.json, phase 2 seam) into { key: { t, tags } } \u2014 NODES.md
  is the single source of the search text, so the doc batch now also feeds
  the in-app search. tools/validate-catalog.mjs is a build gate: FAILS when
  the committed catalog differs from a fresh regeneration (stale), on orphan
  keys or malformed tags; WARNS on paragraph-less nodes. Quick-add (G/M/D/C/
  X/N) became a DEEP search via tools/era/patch-catalog-search-v257.mjs:
  scored word-start matching (name/nick 3, tags 2, desc + catalog paragraph
  1, AND per word \u2014 "rib" hits Ribbon, "round" does not hit "background"),
  deep-only hits show a match snippet under the node name, Cmd/Ctrl+K opens
  the all-nodes search. Era validator extracts the search block VERBATIM
  from App.jsx and runs 12 oracles against the real DEFS + catalog. The
  catalog generator immediately exposed doc debt: braille, mm_paper,
  needlepunch, numerals and river had NO NODES.md paragraph \u2014 written in
  this batch. Phases ahead: tag vocabulary + palette chips (2), visual
  thumbnail catalog (3).`,
  "after");

console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
