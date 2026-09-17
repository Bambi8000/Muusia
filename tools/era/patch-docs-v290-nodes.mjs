#!/usr/bin/env node
/* patch-docs-v290-nodes.mjs — documentation batch for Snowflake, Lettering, Cross Stitch, Chip Die and Drape.
 *
 * One-shot, idempotent, anchored. Reads every fact from disk:
 *   version  <- APP_VERSION in src/App.jsx
 *   counts   <- src/defs/nodes (+2 inline DEFs: group, reititys)
 *
 * Edits:
 *   docs/MUUSIA-NODES.md    header version, total count, Generators count,
 *                           five paragraphs at the top of Generators
 *   docs/MUUSIA-TAGS.json   five entries (existing tag vocabulary only)
 *   docs/MUUSIA-HANDOFF.md  version-history entry, counts
 *
 * Reports OK / MISS / SKIP per edit. A MISS aborts before anything is
 * written — a half-applied doc batch is worse than none.
 */

import fs from "node:fs";
import path from "node:path";

let miss = 0;
const ok = (m) => console.log("OK   " + m);
const bad = (m) => { console.log("MISS " + m); miss++; };

/* ---------- resolve paths ---------- */

const findFile = (name) => {
  for (const d of [".", "docs", "../docs", "src"]) {
    const p = path.join(d, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

const P_NODES = findFile("MUUSIA-NODES.md");
const P_TAGS = findFile("MUUSIA-TAGS.json");
const P_HAND = findFile("MUUSIA-HANDOFF.md");
const P_APP = fs.existsSync("src/App.jsx") ? "src/App.jsx" : findFile("App.jsx");
const NODEDIR = "src/defs/nodes";

for (const [n, p] of [["MUUSIA-NODES.md", P_NODES], ["MUUSIA-TAGS.json", P_TAGS],
  ["MUUSIA-HANDOFF.md", P_HAND], ["App.jsx", P_APP]]) {
  if (!p) { console.log("MISS cannot locate " + n + " — run from the repo root"); process.exit(1); }
}
if (!fs.existsSync(NODEDIR)) { console.log("MISS " + NODEDIR + " not found — run from the repo root"); process.exit(1); }
const KEYS = ["snowflake", "lettering", "crossstitch", "chipdie", "drape"];
for (const k of KEYS) {
  if (!fs.existsSync(path.join(NODEDIR, k + ".js"))) {
    console.log("MISS src/defs/nodes/" + k + ".js does not exist — bake the node before documenting it");
    process.exit(1);
  }
}

/* ---------- facts from disk ---------- */

const appSrc = fs.readFileSync(P_APP, "utf8");
const vm = appSrc.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS APP_VERSION not found in " + P_APP); process.exit(1); }
const VERSION = vm[1];

const files = fs.readdirSync(NODEDIR).filter((f) => f.endsWith(".js"));
const genFiles = files.filter((f) =>
  fs.readFileSync(path.join(NODEDIR, f), "utf8").includes('cat: "gen"'));
const N_FILES = files.length;
const N_GEN = genFiles.length;
const N_TOTAL = N_FILES + 2; /* group + reititys are inline in App.jsx */

console.log(`     version ${VERSION}  files ${N_FILES}  gen ${N_GEN}  registry ${N_TOTAL}`);

/* ---------- idempotency ---------- */

let nodesTxt = fs.readFileSync(P_NODES, "utf8");
let handTxt = fs.readFileSync(P_HAND, "utf8");
const tagsRaw = fs.readFileSync(P_TAGS, "utf8");
const tags = JSON.parse(tagsRaw);

if (nodesTxt.includes("**Drape** —") && nodesTxt.includes("**Snowflake** —") && KEYS.every((k) => tags[k]) && handTxt.includes("**" + VERSION + "** five generators")) {
  console.log("SKIP already applied — nothing to do");
  process.exit(0);
}

/* ---------- helpers ---------- */

const swap = (txt, needle, repl, label) => {
  const parts = txt.split(needle);
  if (parts.length === 2) { ok(label); return parts.join(repl); }
  bad(label + " (" + (parts.length - 1) + " hits, need exactly 1)");
  return txt;
};

const swapRe = (txt, re, make, label) => {
  const hits = txt.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
  if (!hits || hits.length !== 1) {
    bad(label + " (" + (hits ? hits.length : 0) + " hits, need exactly 1)");
    return txt;
  }
  ok(label);
  return txt.replace(re, make);
};

/* ---------- content ---------- */

const PARAS = [
`**Drape** — a mesh cloth laid over hidden objects, drawn in 3D with true
hidden-line removal. Seeded spheres, boxes, cones or a mix sit on a table; a
grid sheet is dropped over them and relaxed with *Tension* until it rests on
the tops and sags between them (each pass averages a point with its
neighbours but never lets it sink below an object; a little gravity stops it
floating flat), and *Wrinkles* folds only the raised cloth. Wire your own
objects instead: closed paths on the *Objects* input become flat-topped blocks
with a soft edge, open paths round ridges, and a triangle mesh on the *Mesh*
input (Blob Mesh, or anything Mesh Slice takes) is rasterised from above into
the height field — a wired input replaces the seeded objects. *Yaw*,
*Elevation* (90 = straight down, where the grid is an exact lattice) and
*Perspective* turn the view; a screen-space z-buffer hides the far side of
every bump, and a low view hides more than a high one. *Style*: Wire, Weave
(warp and weft break alternately at every crossing), Contour (height contours
of the draped surface projected in 3D, with the rim and a sparse table grid)
or Hatch (grid lines that survive only away from *Light angle*, plus the
silhouette). *Sheet* Fit is a rectangle in the margins' proportions, Square a
square, Round a disc whose outline does not change with Yaw at all. *Lock
size* scales by the sheet's rotation-invariant bounding circle so turning
never changes the scale; off, the drawing refits the margins at every yaw.`,

`**Chip Die** — a microchip die shot built the way a die is built. A seal ring
and a ring of bond pads (nested squares) frame the edge; inside, the core is
split hierarchically into blocks with routing channels left between them, and
every channel carries a bus of parallel traces whose width shrinks with the
depth of the split. Blocks take a texture from their type — SRAM as
sub-arrays of dense word lines broken by bit-line groups with a decoder strip
between, standard-cell logic as power-rail rows filled with cell edges, metal
stubs and L-shaped routes, analog as interdigitated transistor fingers and a
rectangular spiral inductor, capacitor arrays as a lattice of squares, IO as
nested frames, empty silicon as sparse dummy fill — and *routed* blocks are
the tangle of a 1970s die: thick Manhattan traces walked on a grid so they
never cross, a via square at every end, as centre lines or outlined rods at
*Trace width*. *Style*: Processor repeats one core's floorplan mirrored into
every core slot under a row of L2 arrays and above an IO strip; Memory is
banks of arrays with decoder logic; FPGA a uniform grid of tiles with a
channel on every row and column; Analog a few large mixed-signal blocks (an
inductor is guaranteed); Vintage one routed die with a wide power ring, a few
transistor islands and big pads; Random a seeded floorplan of everything.
*Colour by type* puts each class on its own pen counted up from *Pen* — seal
and pads 0, SRAM +1, logic +2, analog +3, IO +4, buses +5, routing +6, modulo
12 — so a multi-pen plot reads like a false-colour die photograph; *Bond
wires* arc from every pad out past the die edge (the die shrinks to leave them
room). Every segment is axis-aligned. *Die width* and *Aspect* are exact mm,
shrink-only; the *Blocks* output carries the closed block outlines on their
pens for fill nodes.`,

`**Cross Stitch** — lettering for thread on paper. Text is set in a bitmap
sampler font on a stitch grid; every filled cell is one cross stitch, and the
cell's four corners are the holes the needle must pierce. The *Holes* output
carries those holes once each as small circles at *Hole size*, deduplicated
where neighbouring stitches share a corner (five stitches in a row are twelve
holes, not twenty) — chain it into Needle Punch with Punch at: Centers, or
plot the circles and pierce by hand. The *Stitches* output (the second pin,
wire it separately) is the thread guide: an X per cell, a *Half /* or *Half
\\* stitch, a *Backstitch* outline round the letters (every cell edge with a
stitch on one side only), or None — the holes never change with it. *Font*
Sampler 5x7 is the classic, Bold 5x7 thickens it by one cell, Tiny 3x5 is for
small work; all carry A–Z, 0–9, ÄÖÅ and punctuation, and <3 is a heart.
*Pitch* is the physical hole spacing and stays exact unless the block cannot
fit, when it shrinks; the hole radius is capped below half the pitch so holes
never merge. *Letter gap* and *Line gap* are whole cells, *Border* adds a
one-stitch frame at *Border gap*, *Mirror* flips the block for punching from
the back, separate pens for holes and guide.`,

`**Lettering** — heavy plotter capitals with a 3D side. *Font* Bold sweeps the
built-in geometric capitals with a round pen, Block with a square pen, Roman
with a broad nib at *Nib angle* so thickness follows stroke direction as in
calligraphy (a vertical stroke at nib 0 is full *Weight*, a horizontal one a
hairline). Every stroke is stamped into a distance field and the union is
traced as one clean outline, so joints never double up; *Fill* shades the
face from the same field as Outline, *Hatch* (angle and spacing) or *Inline*
(concentric outlines stepping inward). *Depth* extrudes the letters toward
*Depth angle* like sign-painter's block letters: the extruded body is the
field's sliding minimum along the depth vector, the back silhouette is drawn
only where it is not the face outline, and the visible sides are the outline
stretches whose outward normal points along the depth. *Side texture* draws
them as Zigzag (a sawtooth stripe at *Side pitch*), Lines (rules from face to
back), Hatch or a plain Outline; the whole block is one field, so rules stop
where they would run into another letter. *Rotate* turns the block, *Slant*
shears it, *Weight* follows the fitted size. Lines with |, *Align*,
*Tracking*, *Line height*, *Y offset*; the block shrinks to the margins on
both axes, stroke overhang included.`,

`**Snowflake** — snow crystals with true six-fold symmetry: one arm is grown
from the seed and copied round the centre, so every flake is perfectly
symmetric while no two flakes in a sheet match. *Style* Dendrite is a main
arm with mirrored side branches at *Branch angle* and sub-branches to
*Depth*, lengths shrinking toward the tip by *Falloff*; Fern multiplies the
branching into feathers; Stellar keeps few branches and caps every tip with a
hexagonal plate over a large sectored core; Plate is a big hexagon with inner
rings, spokes and sector windows, its corners sprouting short dendrites; Paper
is a child's cut-paper flake — one wedge's jagged profile mirrored round into
a closed silhouette, *Holes* cut-outs mirrored with it, *Wobble* shaking the
scissors. *Arms* sets the symmetry (6 is snow; 3, 4, 5, 8 and 12 are for
art), *Tip* caps each arm with a plate, needle, fan or arrow, *Core* sets the
centre plate, *Width* turns centre lines into closed rods tapering to the
tips, *Rime* dots frost along the arms. *Layout* Rows fills a *Count* x *Rows*
grid with *Jitter*; Scatter drops a flurry of different sizes (*Size vary*)
and turns (*Spin vary*). Fit is shrink-only.`,
];

const NEW_TAGS = {
  snowflake: ["nature", "symmetry", "fractal", "repeat"],
  lettering: ["text", "3d", "fill", "structural"],
  crossstitch: ["text", "dots", "grid", "weave"],
  chipdie: ["machine", "grid", "structural", "texture"],
  drape: ["3d", "mesh", "grid", "weave"],
};

const HIST = `- **${VERSION}** five generators. **Snowflake** (gen/nature): one arm grown from
  the seed and rotated *Arms* times, five styles (Dendrite, Fern, Stellar,
  Plate, Paper), rod outlines, rime, Rows/Scatter; the validator proves the
  symmetry by rotating every point and finding its twin. **Lettering**
  (gen/textimg): Bold/Block/Roman capitals as a stamped distance field —
  clean unions, Outline/Hatch/Inline fills — plus 3D extrusion as the field's
  sliding minimum with Zigzag/Lines/Hatch side textures; the cursive Script
  and Copperplate hands that were prototyped were dropped before baking.
  **Cross Stitch** (gen/textimg): bitmap sampler fonts to deduplicated needle
  holes on the Holes pin for Needle Punch, thread guide (X, half, backstitch)
  on a second pin. **Chip Die** (gen/structural): hierarchical floorplan with
  bus channels, SRAM/logic/analog/cap/IO/routed textures, Processor cores
  mirrored from one template, Vintage routed dies with power ring and bond
  wires, Colour by type across seven pens. **Drape** (gen/structural): mesh
  cloth relaxed over seeded or wired objects (paths or a mesh pin), z-buffer
  hidden lines, Wire/Weave/Contour/Hatch, Fit/Square/Round sheet, Lock size
  by the rotation-invariant bounding circle. A Skull node was prototyped as an
  SDF surface and shelved. All five reuse the shared placement/fit pattern:
  measure after placement, shrink only, never grow.

`;

/* ---------- NODES.md ---------- */

nodesTxt = swapRe(nodesTxt, /^# MUUSIA v[\d.]+ — Node Reference$/m,
  `# MUUSIA v${VERSION} — Node Reference`, "NODES.md header version");

nodesTxt = swapRe(nodesTxt, /^All \d+ built-in nodes\./m,
  `All ${N_TOTAL} built-in nodes.`, "NODES.md total count");

const genHead = nodesTxt.match(/^## Generators \(\d+\)$/m);
if (!genHead) {
  bad("NODES.md Generators heading not found");
} else {
  nodesTxt = swap(nodesTxt, genHead[0] + "\n\n", `## Generators (${N_GEN})\n\n${PARAS.join("\n\n")}\n\n`,
    `NODES.md Generators count -> ${N_GEN} + five paragraphs`);
}

/* section headings must sum to the registry total */
const sections = [...nodesTxt.matchAll(/^## [A-Za-z]+ \((\d+)\)$/gm)].map((m) => Number(m[1]));
const sum = sections.reduce((a, b) => a + b, 0);
if (sections.length < 5) bad(`NODES.md only ${sections.length} section headings found`);
else if (sum !== N_TOTAL) bad(`NODES.md section headings sum to ${sum}, registry is ${N_TOTAL} — fix the section counts by hand`);
else ok(`NODES.md section headings sum to ${sum}`);

/* ---------- TAGS.json ---------- */

const VOCAB = new Set(Object.values(tags).flat());
for (const [k, tl] of Object.entries(NEW_TAGS)) {
  const unknown = tl.filter((t) => !VOCAB.has(t));
  if (unknown.length) bad("TAGS.json unknown tags for " + k + ": " + unknown.join(", "));
  else if (tags[k]) ok("TAGS.json " + k + " entry already present");
  else { tags[k] = tl; ok("TAGS.json " + k + " entry -> " + tl.join(", ")); }
}

const sortedTags = {};
for (const k of Object.keys(tags).sort()) sortedTags[k] = tags[k];
let tagsOut = JSON.stringify(sortedTags, null, 1);
if (tagsRaw.endsWith("\n")) tagsOut += "\n";

if (Object.keys(sortedTags).length !== N_TOTAL) {
  console.log(`     note: TAGS.json has ${Object.keys(sortedTags).length} entries against a registry of ${N_TOTAL} — some node is untagged`);
}

/* ---------- HANDOFF.md ---------- */

handTxt = swapRe(handTxt, /one file per node, \*\*\d+ files\*\*/,
  `one file per node, **${N_FILES} files**`, "HANDOFF repo-layout file count");

handTxt = swapRe(handTxt, /\(\d+ nodes total with/,
  `(${N_TOTAL} nodes total with`, "HANDOFF repo-layout registry count");

handTxt = swapRe(handTxt, /`ls src\/defs\/nodes \| wc -l` \(\d+\)/,
  "`ls src/defs/nodes | wc -l` (" + N_FILES + ")", "HANDOFF node-count check");

handTxt = swap(handTxt, "\n## Hard-won pitfalls (keep)\n", "\n" + HIST + "## Hard-won pitfalls (keep)\n",
  `HANDOFF version history entry ${VERSION}`);

/* ---------- write ---------- */

if (miss) {
  console.log(`\nABORTED — ${miss} MISS, nothing written.`);
  process.exit(1);
}

fs.writeFileSync(P_NODES, nodesTxt);
fs.writeFileSync(P_TAGS, tagsOut);
fs.writeFileSync(P_HAND, handTxt);

console.log(`\nDONE v${VERSION} — ${P_NODES}, ${P_TAGS}, ${P_HAND} updated.`);
