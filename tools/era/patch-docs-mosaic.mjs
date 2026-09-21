/* Doc batch for the Mosaic node (key mosaic).
   Run once from the repo root AFTER the version bump: node tools/era/patch-docs-mosaic.mjs
   Anchored replacements; MISS aborts before anything is written; SKIP if already applied.
   Version and counts are read from disk, never hardcoded. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const KEY = "mosaic", NAME = "Mosaic";
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
const PARA = `**${NAME}** — mosaic tiling of the sheet with an optional figure. Wire closed
shapes into *Shape* and they are laid in **opus vermiculatum** (*Figure style*
Contour rows: tile rows following the outline inward, cut at *Tile* × *Aspect*
and staggered; rows from the outer edge and from holes collide in the middle
into the irregular core tiles of a real mosaic), as a clipped **Grid**, as a
**Fan** of polar rings and sectors about the figure centre, or left blank
(**None**: one outlined tile). The ground is **opus regulatum**, a square grid
snapped so whole rows fill the margin box (*Grid fit*), clipped to a grout
gap around the figure and continuing inside holes; the outermost *Border
rows* take *Outer row pen* and *Inner row pen*. With nothing wired the sheet
still fills with grid and border. Everything comes from one tile-id field: a
fine raster (*Field cell*, 0 = Tile/8) gets a tile id per cell — nearest-
outline distance and arc-length for the figure, grid cell for the ground —
and tiles are the id boundaries. *Render* Tiles draws every tile as a closed
outline shrunk by *Grout*/2 so the grout shows on paper; Seams draws every
boundary once (lightest plot); Both draws both. *Smooth* rounds the raster
boundaries (Chaikin passes), *Min tile* drops slivers, *Irregularity*
jitters cuts, row edges and grid lines with the *Seed* for a hand-cut look.
Pens: Figure, Ground, Outer row, Inner row. Ground None leaves only the
figure.

`;
nodes = rep1(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + V + " — Node Reference", "NODES header version");
nodes = rep1(nodes, /^All \d+ built-in nodes\./m, "All " + nTotal + " built-in nodes.", "NODES total count");
nodes = rep1(nodes, /^## Generators \(\d+\)$/m, "## Generators (" + nGen + ")", "NODES Generators count");
nodes = rep1(nodes, /^## Modifiers \(\d+\)\n\n/m, "## Modifiers (" + nMod + ")\n\n" + PARA, "NODES Modifiers count + paragraph (newest first)");

/* ---------------------------------------------------------- TAGS.json */
const VOCAB_BEFORE = new Set(Object.values(tags).flat()).size;
tags[KEY] = ["fill", "grid", "texture", "decoration", "hatch"];
const VOCAB_AFTER = new Set(Object.values(tags).flat()).size;
if (VOCAB_AFTER !== VOCAB_BEFORE) MISS("TAGS vocabulary changed " + VOCAB_BEFORE + " -> " + VOCAB_AFTER + " (invented tag)"); else OK("TAGS entry (vocabulary unchanged at " + VOCAB_AFTER + ")");
const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];

/* ---------------------------------------------------------- HANDOFF.md */
const HIST = `- **${V}** new **${NAME}** modifier (mod/texture, \`${KEY}\`, Shape pin
  optional): mosaic as a TILE-ID FIELD. Fine raster over the margin box;
  figure mask by scanline parity (holes work); nearest-outline transform by
  8SSEDT-style propagation with exact sample positions (outline resampled at
  cell/2, boundary cells seeded, four corners brute-force seeded, two
  sweeps) giving distance d and arc-length s per cell. Ids: ground grid cell
  (snapped tx/ty so whole rows fit; border ring → pens), figure Contour rows
  (band = ⌊d/T⌋, cut by s scaled with the band perimeter ± 2π k T so inner
  rows keep their pitch, staggered; nearest-side rule yields the collision
  core), Grid, Fan (polar rings/sectors about the outermost container's
  centroid), None; thin grout zone along the outline belongs to no tile.
  Boundaries = edges between differing ids, chained per tile into loops
  (Tiles: Chaikin + Douglas-Peucker + inward bisector shrink by Grout/2,
  sliver fallback Grout/4, Min tile area filter) or chained once between
  junctions (Seams). Irregularity: hashed cut/grid-line jitter and noise2
  band wobble. 93-check validator: one tile per grid cell and border ring
  counts, grid-fit extents, tile areas = (Tile−Grout)², figure tiles inside
  / ground tiles outside the ring by distance, grout gap on both sides, rows
  from both boundaries, rim tile count = perimeter/pitch, no overlapping
  tiles (centroid test), Fan centroids at ring centres, Grid alignment with
  the ground, Seams ≈ half the ink of Tiles and Both = sum, seed scope, raster
  independence of the tile count, off-sheet outline fills the box; 12
  mutations each trip their own checks (no propagation, no grout zone, no
  pitch scaling, double bands, border pens, no shrink, grid fit ignored, fan
  sectors/rings, wobble ignored).

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
