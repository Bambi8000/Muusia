/* tools/patch-docs-234.mjs — v2.34 documentation batch.
   Anchored string replacement with OK/MISS reporting. Run from repo root:
   node tools/patch-docs-234.mjs
   Patches: docs/MUUSIA-NODES.md, docs/MUUSIA-NODE-API.md,
   docs/MUUSIA-HANDOFF.md, README.md */
import fs from "fs";

let fails = 0;
const patch = (file, edits) => {
  let s = fs.readFileSync(file, "utf8");
  for (const [name, from, to] of edits) {
    if (s.includes(from)) {
      s = s.replace(from, to);
      console.log("OK   " + file + " :: " + name);
    } else {
      console.log("MISS " + file + " :: " + name);
      fails++;
    }
  }
  fs.writeFileSync(file, s);
};

/* ---------------- MUUSIA-NODES.md ---------------- */

const GEN_PARAGRAPHS = `**Diagram** — flow-diagram generator: numbered circle or square nodes joined by
directed orthogonal arrow lines (L/Z routing with node avoidance). Line styles:
thick filled arrows (outline + parallel fill + solid head), thick outline, or a
single line with a V head. Crossings *Under* cuts a clean gap into the lower line
where another passes over; corners Rounded / 45° / 90°. Node and line pens separate.

**Volcano** — a 3-D volcano with hidden-line removal: the flank climbs to a crater
rim, then dips into a bowl. Render as Rows (terrain scanlines), Rings, Spokes, Mesh
or Dots (polar grid of small circles sized by altitude, with grow direction and
seeded size jitter). Tilt is the viewing elevation — low angles hide the crater
floor behind the near rim; Yaw spins the volcano (flutes, rock noise, spokes and
dots turn with it). Steepness, Dip, fBm Roughness and radial Flutes shape the rock.
Animate Tilt or Yaw with the frame clock for a fly-over.

**Nested Circles** — overlapping ring- or ray-filled discs woven into an over/under
illusion. Order: *Weave* interlocks two discs along their center line (the classic
yin-yang poster) and cycles three-plus into a pinwheel; *Weave fill* uses angular
sectors so the central multi-overlap stays filled; *Stack* is painter order.
Background Opaque gives every disc a solid backing (hides what lies beneath even
between its own rings); Transparent overprints complete discs like stacked pen
layers. Gap cuts a white halo around the covering disc. Discs alternate Pen A/B.

**Road Map** — procedural city map. Seeded Voronoi districts each get a street
pattern — grid, organic, radial rings-and-spokes, sparse blocks — built by
recursive block subdivision, so streets meet in T-junctions, kink at discrete
points and trail off into dead ends (Irregularity drives all of it; Raggedness
breaks strokes into the worn dashed look). Three road weights: single-stroke
streets, double-stroke arterials between district centers, triple-stroke motorways
in long straights with wide rounded bends (Motorway bend 0 = dead straight) plus
slip-road Ramps at crossings. River and lakes carve water with shorelines —
streets keep off the banks, motorways bridge over. Fields hatches farm patches
into empty districts, Landmarks stamps filled squares. Pens: roads, water, fields.

**Map Import** — plots a real city from an OpenStreetMap GeoJSON extract
(overpass-turbo.eu → Export → GeoJSON). Roads weight by OSM class (motorway 3
strokes, primary/secondary 2, residential 1), Minor paths gates footways, Water
draws rivers and lake outlines, Buildings their footprints — each family on its
own pen. Fit Contain/Cover (Cover crops exactly at the frame), Rotate, and
Simplify decimates dense OSM vertices in mm. Full guide: docs/MUUSIA-MAP.md.

## Modifiers`;

const MOD_PARAGRAPH = `**Empty Fill** — fills the EMPTY space around the input shapes with a repeating
texture: the doodle trick where stones stay blank and everything between them gets
dense pattern. Closed paths block by area, open paths by proximity (chamfer
distance field). Patterns: Coils (overlapping occluded circles — the slinky look),
Contours (distance ripples hugging every shape, marching-squares chained), Scales,
Hatch, Crosshatch, Waves. Gap keeps a clean clearance ring, Wobble adds hand-drawn
waviness, Angle rotates the texture. Feed it Potato or Pebble blobs for the
classic stone-doodle page.

## Decorators`;

patch("docs/MUUSIA-NODES.md", [
  ["version header",
    "# MUUSIA v2.33 — Node Reference",
    "# MUUSIA v2.34 — Node Reference"],
  ["total count",
    "All 182 built-in nodes.",
    "All 188 built-in nodes."],
  ["generators count",
    "## Generators (94)",
    "## Generators (99)"],
  ["modifiers count + insert 5 generators",
    "## Modifiers (61)",
    GEN_PARAGRAPHS + " (62)"],
  ["insert Empty Fill before Decorators",
    "## Decorators (5)",
    MOD_PARAGRAPH + " (5)"],
]);

/* ---------------- MUUSIA-NODE-API.md ---------------- */

patch("docs/MUUSIA-NODE-API.md", [
  ["onFile storage location corrected + fileLabel/fileAccept documented",
    "| `onFile` | function, optional | `(text) => data` — parse a file for a `type:\"file\"` param; result is stored at `node.data` (see Import SVG pattern). |",
    "| `onFile` | function, optional | `(text) => data` — parse a file for a `type:\"file\"` param. **The result is stored at `node.data.svg`** (the `.svg` key is a historical artifact of Import SVG and applies to every file node — Point Cloud reads its point data from there too); `compute` must read `node && node.data && node.data.svg`. |\n| `fileLabel` | string, optional | Label for the file picker button (default \"Choose SVG…\"). **Definition-level field** — set it next to `key`/`name`, not inside the param descriptor. |\n| `fileAccept` | string, optional | `accept` attribute for the file input, e.g. `\".geojson,.json\"` (default `.svg`). **Definition-level field**; a `fileAccept` placed inside the param descriptor is silently ignored. |"],
]);

/* ---------------- MUUSIA-HANDOFF.md ---------------- */

patch("docs/MUUSIA-HANDOFF.md", [
  ["repo layout node counts",
    "- `src/defs/nodes/*.js` — one file per node, **180 files** (182 nodes total with\n  group + reititys; Generators 88, Modifiers 58).",
    "- `src/defs/nodes/*.js` — one file per node, **186 files** (188 nodes total with\n  group + reititys; Generators 99, Modifiers 62)."],
  ["docs list + MUUSIA-MAP.md",
    "- `docs/` — MUUSIA-HANDOFF.md (this), MUUSIA-NODES.md (every node),\n  MUUSIA-NODE-API.md (custom-node authoring spec, plotternode format).",
    "- `docs/` — MUUSIA-HANDOFF.md (this), MUUSIA-NODES.md (every node),\n  MUUSIA-NODE-API.md (custom-node authoring spec, plotternode format),\n  MUUSIA-MAP.md (OSM map import guide: overpass-turbo workflow, sizing, queries)."],
  ["node count check",
    "- Node count check: `ls src/defs/nodes | wc -l` (180) — the old",
    "- Node count check: `ls src/defs/nodes | wc -l` (186) — the old"],
  ["version history 2.34",
    "  (spatial params must ship overlay guides).",
    `  (spatial params must ship overlay guides).
- **2.34** six new nodes: **Diagram** (flow diagrams: orthogonal arrow routing,
  Under-crossings, filled heads), **Empty Fill** (mod: pattern-fills the empty
  space around shapes via chamfer distance field — Coils/Contours/Scales/Hatch/
  Waves), **Volcano** (3-D crater mountain, float-horizon hidden lines, five
  render styles incl. altitude-sized Dots, Yaw/Tilt fly-over), **Nested Circles**
  (woven over/under ring discs, Weave/Weave fill/Stack + Opaque/Transparent
  background), **Road Map** (Voronoi districts, recursive block-subdivision
  streets, 3-weight road hierarchy, motorways + ramps, river/lakes, fields,
  landmarks), **Map Import** (OSM GeoJSON → weighted plottable city; guide in
  docs/MUUSIA-MAP.md). Engine conventions documented in NODE-API: onFile results
  land at node.data.svg; fileLabel/fileAccept are definition-level fields.
  Shared-geometry hardening: collinear-corner rounding no longer bulges a
  half-circle (cornerize/cornerRound in Diagram + Road Map).`],
]);

/* ---------------- README.md ---------------- */

patch("README.md", [
  ["version header", "# MUUSIA v2.31", "# MUUSIA v2.34"],
  ["node count", "**169 built-in nodes**", "**188 built-in nodes**"],
  ["feature sentence + map import",
    "production layout (Mini Canvas), and a laser-guided magnet jig for paper hold-down.",
    "production layout (Mini Canvas), a laser-guided magnet jig for paper hold-down,\nand real-city map import from OpenStreetMap GeoJSON extracts (docs/MUUSIA-MAP.md)."],
]);

console.log(fails ? `\n${fails} MISSES — fix anchors before committing`
  : "\nALL PATCHES OK");
process.exit(fails ? 1 : 0);
