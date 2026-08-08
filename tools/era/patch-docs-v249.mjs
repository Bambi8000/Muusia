/* One-shot era patch: v2.49 documentation batch.
   - MUUSIA-NODES.md: header + counts (217->225, Gen 121->128, Mod 67->68),
     8 new node paragraphs, Origami Glitch Fold paragraph updated for the pivot
   - MUUSIA-HANDOFF.md: 2.49 version-history entry, node-file count 215->223,
     Roadmap gains the built-in Truchet chain-strokes backport idea
   - MUUSIA-NODE-API.md: `fileBinary` definition-field row
   Run once from repo root AFTER the code push:
     node tools/era/patch-docs-v249.mjs
   NOT idempotent beyond the SKIP guard.
   Post-patch sentinels:
     grep -c "2.49" docs/MUUSIA-NODES.md        -> 2
     grep -c "Truchet Multiscale" docs/MUUSIA-NODES.md -> 1
     grep -c "fileBinary" docs/MUUSIA-NODE-API.md      -> 3
     grep -c "\\*\\*2.49\\*\\*" docs/MUUSIA-HANDOFF.md     -> 1 */
import fs from "fs";

const DOCS = "docs/";
let totalOk = 0, totalMiss = 0;
const patchFile = (file, reps) => {
  const path = DOCS + file;
  let src = fs.readFileSync(path, "utf8");
  let ok = 0;
  for (const [name, from, to] of reps) {
    const i = src.indexOf(from);
    if (i < 0) { console.log("MISS  " + file + ": " + name); totalMiss++; continue; }
    if (src.indexOf(from, i + 1) >= 0) { console.log("MISS  " + file + ": " + name + " (anchor not unique)"); totalMiss++; continue; }
    src = src.slice(0, i) + to + src.slice(i + from.length);
    console.log("OK    " + file + ": " + name);
    ok++; totalOk++;
  }
  return { path, src, ok };
};

if (fs.readFileSync(DOCS + "MUUSIA-NODES.md", "utf8").includes("Truchet Multiscale")) {
  console.log("SKIP  docs already patched for v2.49");
  process.exit(0);
}

/* ---------------- MUUSIA-NODES.md ---------------- */
const P_SOUNDLINE = `**Sound Line** — turns sound into pen lines. Import a WAV (PCM or float; mixed
to mono, peak-normalized, frozen into the patch) and draw it as *Wave* (the
signal as one line) or *Envelope* (mirrored min/max outline, the classic
waveform block). Unwired: stacked *Rows* inside the margin — a sound poster.
Wire paths into Anchor and the sound rides them instead, displacing each line
along its normal, the timeline continuing from path to path. *Fit* maps the
clip onto the available length; *Speed mm/s* plays at a fixed rate and *Loop*
repeats a too-short clip (off: the line goes quiet when the sound ends).
Start/Segment slice the clip; Smooth tames noise. Needs the v2.49 fileBinary
engine intake.

`;
const P_TRUCHET_MULTI = `

**Truchet Multiscale** — the Carlson-style multiscale sibling of Truchet:
strands cross cell edges at fixed stations, and the node **chains** them tile
to tile, so the labyrinth comes out as closed loops and border-to-border
strokes instead of thousands of tiny arcs. *Strands* 1–4 parallel lines,
*Tiles* Arcs / Lines (45° chamfers) / Mixed, *Subdivide* + *Sub levels* split
seeded cells into quarter-size tiles (strands break at scale seams — that is
the style), *Pens by depth* inks each scale level separately.`;
const P_CONTOUR = `

**Contour Field** — early-computer-art contour plot: a random height field
sampled on a COARSE grid and contoured with straight-line interpolation, so
the level lines stay hard-cornered and angular — nested angular diamonds
around peaks, tight parallel bundles on slopes. *Cells* sets the coarseness,
*Roughness* blends smooth terrain into independent random spot heights, and
*Edge numbers* stamps each level's index where its line runs off the field,
like hand-annotated 1970 plotter output (collision-avoided, own pen). Pens
cycles levels across the palette.`;
const P_ORGANIC_TRIO = `**Smoke Mesh** — floating smoke veils in 3D: each sheet is a ribbon surface
swept along a noise-wandering spine while the sheet direction rotates (Twist)
and folds back on itself (Folds) — drawn as hundreds of parallel filaments, so
a face-on veil reads pale and an edge-on fold turns into a dark seam, like
long-exposure smoke. Sheets layers 1–4 veils in one camera; Pens spreads a
gradient across the sheet; each filament is one continuous stroke. Rotate with
View yaw/pitch; wire Frame into Yaw to drift the smoke through an animation.

**Orbit Scribble** — the looping-thread tangle: each strand is ONE continuous
stroke that keeps drawing circles while its center wanders inside a rounded
noise cloud and the loop radius breathes — scribbled orbits without lifting
the pen. Built-in *Beads* stamp ink dots (tiny filled spirals) along the
strands on their own pen, and *Core falloff* thins them toward the cloud edge
so the fringe loops run bare.

**Radial Burst** — lines fleeing a center point: squiggly hairs radiate
outward and new hairs are born mid-flight wherever the neighbour gap exceeds
*Hair spacing*, so the coat stays evenly dense from core to rim relative to
the LOCAL blob edge at any *Edge variation*. Waveform: Zigzag, Sine, Square,
Saw, Seismic (quiet stretches broken by bursts) or Straight; *Inner radius*
opens a hole; the pivot is movable. Each hair is one stroke drawn inside out.

**Fingerprint** — fingerprint ridges: evenly spaced rings grow from seeded
centers and MERGE where systems meet — contours of a soft-min distance field,
so the gap between neighbouring lines stays constant everywhere. *Merge* sets
the fusion softness (0 kissing circles, 1 one big swirl), *Wobble* warps the
ridges loose, *Max rings* leaves white pools, and *Line breaks* + *Gap dots*
cut the ridges like a drying pen with ink dots dropped into some breaks.
Heavier than average — lower Centers or raise Ring gap while sketching.

`;
const P_FLASH = `

**Flash Distort** — the lightning-bolt poster cut: slices everything into
parallel strips and slides each strip along its own direction. *Angle* rotates
the whole cut, *Segments* + *Widths* (Uniform/Random/Ramp/Wave) shape the
strips, *Shift pattern* picks Alternate (the classic zigzag), Ramp, Wave,
Random or Walk with *Jitter* on top. Cuts are exact; *Close cut faces* clips
closed shapes into per-strip closed polygons (new edges along the cuts) — feed
those into Hatch Fill for the filled flash-stripe poster. Guides show the cuts.`;

const nodes = patchFile("MUUSIA-NODES.md", [
  ["header version", "# MUUSIA v2.48 — Node Reference", "# MUUSIA v2.49 — Node Reference"],
  ["total count", "All 217 built-in nodes.", "All 225 built-in nodes."],
  ["generator count", "## Generators (121)", "## Generators (128)"],
  ["modifier count", "## Modifiers (67)", "## Modifiers (68)"],
  ["Sound Line before Import SVG",
    "**Import SVG** — load an SVG file's paths onto the canvas (no text/CSS support).",
    P_SOUNDLINE + "**Import SVG** — load an SVG file's paths onto the canvas (no text/CSS support)."],
  ["Truchet Multiscale after Truchet",
    "*Loop* mode grows a spanning tree and emits **one single closed line** that fills the canvas — a maze you can plot without lifting the pen.",
    "*Loop* mode grows a spanning tree and emits **one single closed line** that fills the canvas — a maze you can plot without lifting the pen." + P_TRUCHET_MULTI],
  ["Contour Field after Moon Craters",
    "3D Mesh uses classic silhouette occlusion; 3D Outlines drapes the crater rings over the terrain.",
    "3D Mesh uses classic silhouette occlusion; 3D Outlines drapes the crater rings over the terrain." + P_CONTOUR],
  ["Smoke Mesh / Orbit Scribble / Radial Burst / Fingerprint before Himmeli",
    "**Himmeli** — the traditional Finnish straw mobile in 3D:",
    P_ORGANIC_TRIO + "**Himmeli** — the traditional Finnish straw mobile in 3D:"],
  ["Origami Glitch Fold paragraph: pivot",
    `**Origami Glitch Fold** — mirrors everything on one side of an adjustable fold line
back across it, with a distance-proportional crease warp; optional Keep Original
for layered folds. Output clamped to the sheet.`,
    `**Origami Glitch Fold** — mirrors everything on one side of an adjustable fold line
back across it, with a distance-proportional crease warp; optional Keep Original
for layered folds. The fold pivots around a movable point (Pivot X/Y or the
canvas center) and *Axis Position* slides the line along its normal; dashed
guides show the fold line, pivot and mirrored side. Output clamped to the sheet.`],
  ["Flash Distort after Origami Glitch Fold",
    `guides show the fold line, pivot and mirrored side. Output clamped to the sheet.

**Cellular Mosaic Displace**`,
    `guides show the fold line, pivot and mirrored side. Output clamped to the sheet.` + P_FLASH + `

**Cellular Mosaic Displace**`],
]);

/* ---------------- MUUSIA-HANDOFF.md ---------------- */
const H_249 = `

- **2.49** big batch: one engine seam, one node fix, EIGHT new nodes.
  Engine: **fileBinary** definition flag (tools/era/patch-file-binary.mjs) —
  file params read as dataURL and routed to the existing onFile branch, so
  onFile can base64-decode binary formats; fileAccept now wins over the
  image/* default; sentinel grep -c "fileBinary" src/App.jsx -> 1. Fix:
  **Origami Glitch Fold** gained a movable pivot (Pivot X/Y + Pivot-at-center,
  legacy Axis Position preserved, old patches byte-identical via useCenter
  default) and the previously missing overlay (fold line clipped to the sheet
  + pivot + mirrored-side arrow). New nodes: **Sound Line** (gen/textimg:
  self-contained WAV parser in onFile — RIFF chunk walk, PCM 8/16/24/32 +
  float32/64 + WAVE_FORMAT_EXTENSIBLE, mono mix, peak-normalize, freeze
  ≤16384-sample signal + 2048-bin min/max envelope into node.data; Wave/
  Envelope over margin Rows or wired Anchor paths, Fit / Speed mm/s + Loop,
  Start/Segment, Smooth), **Flash Distort** (mod/deform: canvas-spanning
  rotatable strips with patterned widths + shifts, EXACT boundary
  interpolation — no resample gaps — and Sutherland-Hodgman Close cut faces
  for the filled poster look), **Orbit Scribble** (gen/organic: continuous
  drifting-loop strands in a soft-radially-bounded noise cloud + bead spirals
  with core falloff on their own pen), **Smoke Mesh** (gen/organic: folded
  ribbon-sheet veils as parallel filaments, twist/fold/ripple, auto detail
  shrink under the point budget), **Contour Field** (gen/scientific: coarse-
  grid marching squares with saddle disambiguation, chained level lines,
  SFONT edge numbers with greedy collision avoidance; validator holds a
  vertex-on-grid-edge == exact-level oracle), **Radial Burst** (gen/organic:
  gap-driven ray insertion — hairs born whenever neighbour gap × radius
  exceeds spacing, silhouette-aware so density stays uniform to the LOCAL
  edge; 6 waveforms incl. Seismic and Straight; validator: rim-gap bound +
  no-bald-wedge sector oracle after the level-doubling version tore wedges),
  **Truchet Multiscale** (gen/geometric: sibling of built-in Truchet — cross-
  tile CHAINED strands into closed loops / border strokes, Carlson multiscale
  subdivision, pens by depth; renamed from "truchet" after the built-in key
  collision), **Fingerprint** (gen/organic: soft-min distance-field ridges at
  constant spacing, LSE merge, domain-warp wobble, dashed breaks with ink
  dots; oracles: single-seed exact-gap circles with curvature-aware tolerance
  and ridge-length × gap ≈ area coverage). Lessons: a lab key colliding with
  a built-in is caught at import — check DEFS before naming; scanline crossing
  spacing ≠ perpendicular ridge spacing (gap/|sin θ|), measure coverage as
  length × gap / area; chain walks must START from the border endpoint;
  soft-min k beyond ~2× gap visibly stretches saddle spacing.`;

const handoff = patchFile("MUUSIA-HANDOFF.md", [
  ["2.49 version-history entry",
    "  counts were stale (213 files pre-bake, not 208) — doc counts come from\n  `ls src/defs/nodes | wc -l` + per-cat greps, never from HANDOFF.",
    "  counts were stale (213 files pre-bake, not 208) — doc counts come from\n  `ls src/defs/nodes | wc -l` + per-cat greps, never from HANDOFF." + H_249],
  ["node file count 215 -> 223",
    "`ls src/defs/nodes | wc -l` (215)",
    "`ls src/defs/nodes | wc -l` (223)"],
  ["roadmap: Truchet chain backport",
    "(engine currently swallows compute exceptions silently).",
    "(engine currently swallows compute exceptions silently) · built-in Truchet\n\"Chain strokes\" opt-in backport (def false to keep old patches byte-identical;\nsee Truchet Multiscale)."],
]);

/* ---------------- MUUSIA-NODE-API.md ---------------- */
const api = patchFile("MUUSIA-NODE-API.md", [
  ["fileBinary row after fileAccept",
    '| `fileAccept` | string, optional | `accept` attribute for the file input, e.g. `".geojson,.json"` (default `.svg`). **Definition-level field**; a `fileAccept` placed inside the param descriptor is silently ignored. |',
    '| `fileAccept` | string, optional | `accept` attribute for the file input, e.g. `".geojson,.json"` (default `.svg`). **Definition-level field**; a `fileAccept` placed inside the param descriptor is silently ignored. |\n| `fileBinary` | boolean, optional | Definition-level flag (v2.49). The file is read as a **dataURL** (like `fileImage`) but routed to the normal `onFile` branch, so `onFile` receives the dataURL string and can base64-decode binary formats (see Sound Line\'s WAV parser). Result still lands at `node.data.svg`. Set `fileAccept` too — it now wins over the `image/*` default. |'],
]);

if (totalMiss > 0) {
  console.log("ABORT " + totalMiss + " anchor(s) missed - NOTHING written");
  process.exit(1);
}
fs.writeFileSync(nodes.path, nodes.src);
fs.writeFileSync(handoff.path, handoff.src);
fs.writeFileSync(api.path, api.src);
console.log("WROTE 3 docs (" + totalOk + " replacements)");
