#!/usr/bin/env node
// patch-docs-v233-nodes.mjs — v2.33 documentation batch:
// MUUSIA-NODES.md catalog entries for the nine new nodes + counts + title,
// MUUSIA-HANDOFF.md file/node counters + 2.33 changelog entry.
// Anchored string replacement, OK/MISS/SKIP reporting, idempotent.
// Run from repo root: node tools/patch-docs-v233-nodes.mjs
import fs from "fs";

let okCount = 0, missCount = 0;
const patchFile = (file, patches) => {
  let src = fs.readFileSync(file, "utf8");
  for (const [name, anchor, replacement] of patches) {
    if (src.includes(replacement)) { console.log(`SKIP ${file} :: ${name} (already applied)`); continue; }
    if (!src.includes(anchor)) { console.log(`MISS ${file} :: ${name}`); missCount++; continue; }
    src = src.replace(anchor, replacement);
    console.log(`OK   ${file} :: ${name}`);
    okCount++;
  }
  fs.writeFileSync(file, src);
};

const GEN_ENTRIES = `**Parallel Lines** — a dense field of vertical lines rising from the bottom
margin to a terraced height field, with expressive tops. *Grass* flops every tip
in its own random curl; *Shoulder* combs the lines near each terrace edge over a
shared pivot in concentric arcs and hangs them down the face; *Cascade* sweeps
them over the edge into parallel diagonal falls that steepen back to vertical.
Levels quantizes terrace heights (1 = one flat field), Plateau width and Relief
shape the steps, Tail length scales curls/hangs/falls, Messiness and Wobble
loosen it. Pen travel is uniformly bottom → top → over the tail (brush-friendly).

**Perforated Mesh** — a 3D wireframe solid (pole-free cube-sphere, cube or
pyramid) as an organic quad mesh with hidden faces removed. *Mesh flow* warps the
grid with noise so the quads swim; *Mountains* raises 4-octave terrain radially
(continuous across edges); *Holes* punches funnel craters with raised rim lips,
concentric collar rings and converging radials, the center opening cut through.
*Surface* picks Solid (hide back) or Transparent. Adaptive refinement keeps
funnel walls curved. Rot X/Y to spin — wire Frame for a rotating meteor.

**Glyph Halftone** — a designer's halftone: each grid cell renders its darkness
as a glyph — filled dot, donut ring, mini-dot cluster, stripe stack or stacked
chevron (checkboxes). Source is a seeded noise field or an imported image
(PNG/JPG, fitted to the margin box). *Type by Value* assigns glyphs by darkness
band, *Random* picks freely; *Big cells* merges 2×2 giants for scale contrast;
*Pens used* sprays glyphs across pens. Fill pitch is the concentric-fill spacing
— match it to the pen width for solid blacks.

**Pebble** — a rock two ways. *Spiral shells* fills a pebble outline with
continuous spirals winding from the edge into 1–3 eye points — Edge packing
crowds the shells at the boundary, Weave rotates each turn so they cross into a
moiré net; Rot Y spins the drawing, Rot X tilts it flat. *Mesh* renders the same
rock as a 3D wireframe (Surface: Solid or Transparent). Round–Angular morphs
from smooth pebble to faceted chunk in both modes; Facets, Irregular and Detail
shape it. Distinct from Stone (flat facet illustration).

**Organic Rings** — concentric organic rings from mixed strands — solid wavy
lines, beaded dot rings, dashes, doubled lines — around a clean hollow center,
like an agate slice or dot-art mandala. All rings deform in one shared noise
field; *Bundling* clumps them into tight groups, *Merges* peels strands across
to the next ring, *Bulges* plants knot-like eyes that part a band of rings in
both directions (lens pockets), *Halo* scatters a clumpy dot mist dissolving
outward. Pens used cycles ring colors — four metallics on black is the classic.

**Retro Mesh** — 80s diagram wireframes in true perspective. *Hourglass* is the
wormhole double funnel (rings + meridian spokes from a shared throat; Flare,
Throat, Height shape the profile), *Funnel* and *Horn* its single-ended
siblings, *Laser floor* the synthwave grid receding to a vanishing point with
noise Terrain that leaves a flat center corridor and an optional Horizon line.
Perspective runs from near-orthographic to wide-angle; drawn transparent (no
hidden-line removal) like the retro prints. Pair with Solids for a planet disc.

## Modifiers (61)`;

const MOD_ENTRIES = `**Pattern Fill** — shades every closed shape with a drawn texture from a pattern
library: Hatch, Cross-hatch, sketchy Scribble, Stipple, small Circles, Chevron
rows, broken Dashes, Crosses, random Sprinkles — or *Mix*, giving each shape its
own pattern like a swatch sheet. Offset from edge is distance-based (negative
bleeds past the outline and into holes); nested shapes act as holes; *Gradient*
fades ink toward the Light angle per shape; *Vary per shape* rotates and loosens
the pattern; Wobble adds hand tremor; pens spread or inherit. Compare Hatch
Fill: that is the fast plain hatcher, this is the texture library.

**Round Canvas** — crops everything to a round canvas whose rim can be
distorted: *Distort* pushes seeded noise into the outline, *Lobes* sets the
bulge count — clean circle to wobbly blob. Content is clipped at the rim
(*Edge gap* keeps a quiet margin), *Invert* keeps the outside, *Draw edge*
plots the rim on its own pen, offsets move the canvas. Same seed in two
instances = registration across layers.

**Ripple** — water reflection with surface disturbance. Everything above the
Waterline is mirrored below and disturbed by horizontal ripple bands whose
displacement grows with depth — reed stalks wiggle, a boulder's underside gets
the jagged rim. *Breakup* fragments the reflection into dashes with depth,
*Stretch* scales it, *Pen shift* moves reflections to another pen (originals
pass through untouched). *Area* confines the effect to an adjustable Pool
(half-ellipse pond, wobbly rim) or crisp Box under the waterline; region and
waterline show as guide overlays. Pairs with Water for the surface itself.

## Decorators (5)`;

patchFile("docs/MUUSIA-NODES.md", [
  ["title version", "# MUUSIA v2.32 — Node Reference", "# MUUSIA v2.33 — Node Reference"],
  ["total count", "All 173 built-in nodes.", "All 182 built-in nodes."],
  ["generators count", "## Generators (88)", "## Generators (94)"],
  ["generators count + six entries", "## Modifiers (58)", GEN_ENTRIES],
  ["three modifier entries", "## Decorators (5)", MOD_ENTRIES],
]);

patchFile("docs/MUUSIA-HANDOFF.md", [
  ["file/node counts", "**171 files** (173 nodes total", "**180 files** (182 nodes total"],
  ["count check line", "`ls src/defs/nodes | wc -l` (171)", "`ls src/defs/nodes | wc -l` (180)"],
  ["2.33 changelog entry",
   "  custom-node sandbox completed (SFONT/fontStrokes/isStyle/parseSVG);\n  `fileAccept` for file params.",
   "  custom-node sandbox completed (SFONT/fontStrokes/isStyle/parseSVG);\n  `fileAccept` for file params.\n- **2.33** nine new nodes: **Parallel Lines** (terraced line field, Grass/\n  Shoulder/Cascade tops), **Perforated Mesh** (cube-sphere/cube/pyramid quad\n  mesh, funnel craters, mesh flow, Solid/Transparent), **Glyph Halftone**\n  (noise/image → dot/ring/cluster/stripe/chevron grid, 2×2 big cells),\n  **Pattern Fill** (nine-texture shape shading + Mix, gradient light, ± edge\n  offset), **Pebble** (spiral-shell moiré stone + 3D mesh, Round–Angular\n  fader), **Organic Rings** (agate strands, knot bulges, dot halo),\n  **Round Canvas** (distorted circular crop), **Retro Mesh** (perspective\n  hourglass/funnel/horn + laser floor), **Ripple** (water reflection,\n  Full/Pool/Box areas, guide overlays); overlay guideline added to NODE-API\n  (spatial params must ship overlay guides)."],
]);

console.log(`\n${okCount} OK, ${missCount} MISS`);
process.exit(missCount === 0 ? 0 : 1);
