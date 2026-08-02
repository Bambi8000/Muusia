/* ONE-SHOT — do not re-run (anchored patches are not idempotent).
   v2.43 documentation batch: adds six node paragraphs to docs/MUUSIA-NODES.md,
   bumps its counts, and inserts the v2.43 entry into docs/MUUSIA-HANDOFF.md.
   Count anchors assume the v2.42 doc state; NOTE that the HANDOFF repo-layout
   counters (194 files / Gen 106 / Mod 63) already lagged NODES.md (202 / 109 /
   64) before this patch — verify the real number with
   `ls src/defs/nodes | wc -l` after baking and fix by hand if a MISS reports.
   Run from repo root: node tools/era/patch-docs-243.mjs */
import fs from "node:fs";

let ok = 0, miss = 0;
const patch = (file, from, to, label) => {
  const s = fs.readFileSync(file, "utf8");
  if (!s.includes(from)) { console.log("  MISS " + label); miss++; return; }
  fs.writeFileSync(file, s.replace(from, to));
  console.log("  OK   " + label);
  ok++;
};

const NODES = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

/* ---- NODES.md: otsikko + laskurit ---- */
patch(NODES, "# MUUSIA v2.42 — Node Reference", "# MUUSIA v2.43 — Node Reference", "NODES title 2.43");
patch(NODES, "All 202 built-in nodes.", "All 208 built-in nodes.", "NODES total 208");
patch(NODES, "## Generators (109)", "## Generators (114)", "NODES generators 114");
patch(NODES, "## Modifiers (64)", "## Modifiers (65)", "NODES modifiers 65");

/* ---- NODES.md: viisi generaattorikappaletta Generators-osion loppuun ---- */
patch(NODES, "\n## Modifiers (65)", `
**Stipple** — organic adaptive stippling (the Kusama look): image darkness sets each
dot's SIZE and seeded dart-throwing packs dots until they almost touch, so dark areas
become a honeycomb of large concentric-filled cells while light areas thin to sparse
specks. Gap is the constant white web between neighbours, Light spread adds extra
spacing toward white, Wobble deforms circles into organic blobs (inner rings inherit
the shape so fills never cross), Fill pitch matches your pen width for solid blacks.

**Blob Rings** — bold ink blobs with nested rings: each blob is a stadium (spine
segment swept by a radius) so nesting is a true EROSION — rings keep the spine and
shrink the radius, leaving slot-like centers in elongated blobs. All rings of a blob
sample one coherent wobble field (quasi-parallel, hand-sloppy from per-ring center
jitter); Weight vary doubles rings into thick strokes, Solid cores fill blobs black
from halfway in, thin curved Connectors string nearest neighbours, Satellites scatter
small ringed dots in the gaps, Cluster pulls placement toward the canvas center.

**Line Zones** — op-art line compositions in the Vera Molnár tradition: a seeded BSP
splits the canvas into rectangular zones (always the largest, along its long axis),
each filled with a strict vertical or horizontal grating at shared pitch. A share of
zones go Solid (0.45 mm pen-width black) or Dither (checkerboard dashes with seeded
dropouts — the noisy data-column look); Diagonal cuts truncate a corner at 45° so the
line ends form the classic staircase; Frame draws a solid border band, Zone gap a
white gutter, Phase jitter de-syncs neighbouring gratings. Every line is strictly
axis-aligned.

**Type Grating** — typography concealed inside a strict line grating, readable up
close, op-art from a distance. The single-stroke font is thickened into a mask and
shaped by a Glyph style first: Plain, Modular (letterforms quantized onto a module
grid — blocky Atype abstraction), Fragments (a seeded window of each stroke), Outline
(only the edge band disturbs the grating) or Stencil (periodic cuts cleared ACROSS
the thick stroke). The grating reacts with Break / Phase shift (half-pitch square
jogs, one continuous stroke per column) / Density / Dashes / Weight; Invert swaps
figure and ground, Slant shears an italic, text auto-fits the margin box.

**Scribble Type** — the medical alphabet as real pen strokes: the pen traces each
character's skeleton as one continuous stroke while a Scribble mode displaces it —
None (clean trace + hand tremor), Coil (small dense loops advancing ALONG the strokes
like a coiled spring, form readable at any messiness), Sine (perpendicular wave, Loops
= cycles), Seismic (calm baseline + seeded quake bursts), or Glitch orbit
(character-sized loops that swallow the form). The Alphabet select swaps the skeleton:
Latin, Runes (the real 24-rune Elder Futhark with standard Latin transliteration),
Hieroglyphs (invented Egyptian-flavored pictograms), Cuneiform (cuneiform-STYLE
invented wedge signs — real cuneiform is syllabic, no faithful letter map exists),
Alchemy symbols, or Asemic — the Seed generates a whole coherent invented script where
the same letter always maps to the same glyph. Tracking goes negative for piled
scrawl.

## Modifiers (65)`, "NODES 5 generator entries");

/* ---- NODES.md: Shade Modifiers-osion loppuun ---- */
patch(NODES, "\n## Decorators (5)", `
**Shade** — charcoal-style tonal shading for closed shapes driven by a MOVABLE light
(value-drivable X/Y % with an overlay guide): a darkness field is built inside each
shape — edge band × light facing + corner kernels (Concave bias pools ink into
notches) + ambient + body gradient — and rendered as stacked rotated hatch levels, so
tone builds like layered pencil. Directionality 0 is pure ambient occlusion; shapes
nested inside another act as holes; open paths pass through untouched.

## Decorators (5)`, "NODES Shade entry");

/* ---- HANDOFF: laskurit (delta +6 / +5 gen / +1 mod v2.42-tilaan) ---- */
patch(HANDOFF, "**194 files** (196 nodes total with\n  group + reititys; Generators 106, Modifiers 63)",
  "**200 files** (202 nodes total with\n  group + reititys; Generators 111, Modifiers 64)",
  "HANDOFF repo-layout counts (+6, verify vs live repo!)");
patch(HANDOFF, "`ls src/defs/nodes | wc -l` (194)", "`ls src/defs/nodes | wc -l` (200)",
  "HANDOFF count-check (+6, verify vs live repo!)");

/* ---- HANDOFF: v2.43-versiohistoria ---- */
patch(HANDOFF, "  breaks (bit twice this session).\n\n## Hard-won pitfalls",
  `  breaks (bit twice this session).
- **2.43** six nodes, all grown from reference images in one lab session.
  **Stipple** (gen: darkness-adaptive dart-throwing stipple — dot size from
  image darkness, radius-aware packing, Kusama honeycomb in the blacks),
  **Shade** (mod/fillstyle: movable-light tonal shading — chamfer feature
  transform for edge distance + facing, corner kernels with concave bias,
  level-gated cross-hatch; scanline mask + per-ring normal voting took A3
  worst case 1412→392 ms), **Blob Rings** (gen/organic: stadium-erosion
  nested rings, coherent per-blob wobble field so rings stay quasi-parallel),
  **Line Zones** (gen/geometric: BSP zones of strict V/H gratings, solid and
  dither-checker zones, 45° corner cuts proven as exact staircases),
  **Type Grating** (gen/textimg: text concealed in a grating via a glyph
  mask shaped Plain/Modular/Fragments/Outline/Stencil, encoded Break/Phase
  shift/Density/Dashes/Weight; RENAMED from atypegrating while still in the
  lab — key renames are free pre-bake, frozen after), **Scribble Type**
  (gen/textimg: skeleton-tracing pen with five displacement modes
  None/Coil/Sine/Seismic/Glitch-orbit and six alphabets incl. a truthful
  Elder Futhark transliteration and a seed-generated Asemic script).
  Validator lessons: stencil cuts must clear the thickened MASK, not the
  skeleton (a +0.1% ink delta exposed cuts being swallowed by the radius);
  scribble displacement must scale to TEXT size, not glyph size, or every
  alphabet converges to the same tangle (a skeleton-coverage invariant now
  guards the regression); position-invariance (same char at two tx values
  must be a pure translation) tests glyph consistency without duplicating
  glyph tables in the harness; sample hand-tremor noise in the arc-length
  domain, not canvas position, or that invariance breaks.

## Hard-won pitfalls`, "HANDOFF v2.43 entry");

console.log((miss === 0 ? "\nALL " + ok + " PATCHES OK" : "\n" + miss + " MISS / " + (ok + miss)) +
  " — verify node count with: ls src/defs/nodes | wc -l");
if (miss > 0) process.exitCode = 1;
