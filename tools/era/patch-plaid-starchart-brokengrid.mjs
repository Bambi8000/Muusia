/* Era patch: Plaid Grids 3D + Star Chart + Broken Grid release.
   Bumps APP_VERSION, adds all three to docs/MUUSIA-NODES.md (+ counts),
   docs/MUUSIA-TAGS.json and the docs/MUUSIA-HANDOFF.md version history.
   Reads version and counts from the repo at runtime. Idempotent (SKIP),
   MISS on any anchor aborts with nothing written.
   Run from the repo root: node tools/era/patch-plaid-starchart-brokengrid.mjs */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const APP = "src/App.jsx";
const NODES = "docs/MUUSIA-NODES.md";
const TAGS = "docs/MUUSIA-TAGS.json";
const HAND = "docs/MUUSIA-HANDOFF.md";

let fails = 0;
const miss = (m) => { console.log("MISS " + m); fails++; };
const okay = (m) => console.log("OK   " + m);

const app = readFileSync(APP, "utf8");
const nodesMd = readFileSync(NODES, "utf8");
const handMd = readFileSync(HAND, "utf8");
const tagsRaw = readFileSync(TAGS, "utf8");

if (nodesMd.includes("**Plaid Grids 3D** —") && nodesMd.includes("**Star Chart** —") && nodesMd.includes("**Broken Grid** —")) {
  console.log("SKIP already applied");
  process.exit(0);
}

const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { miss("APP_VERSION in " + APP); process.exit(1); }
const cur = vm[1] + "." + vm[2];
const next = vm[1] + "." + (parseInt(vm[2], 10) + 1);
for (const k of ["plaid", "starchart", "broken_grid"]) {
  if (!existsSync("src/defs/nodes/" + k + ".js")) {
    miss("src/defs/nodes/" + k + ".js must exist (bake first)");
  }
}
if (fails) process.exit(1);
const filesN = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js")).length;
const total = filesN + 2;

const rep1 = (src, from, to, label) => {
  const parts = src.split(from);
  if (parts.length !== 2) { miss(label + " (" + (parts.length - 1) + " hits)"); return src; }
  okay(label);
  return parts.join(to);
};

let appOut = rep1(app, 'APP_VERSION = "' + cur + '"', 'APP_VERSION = "' + next + '"', "App.jsx version " + cur + " -> " + next);

let nOut = nodesMd;
nOut = rep1(nOut, "# MUUSIA v" + cur + " — Node Reference", "# MUUSIA v" + next + " — Node Reference", "NODES.md header version");
const allM = nOut.match(/All (\d+) built-in nodes/);
if (!allM) miss("NODES.md 'All N built-in nodes'");
else if (parseInt(allM[1], 10) + 3 !== total) miss("NODES.md count drift: doc says " + allM[1] + " but disk implies " + (total - 3) + " before this patch");
else nOut = rep1(nOut, "All " + allM[1] + " built-in nodes", "All " + total + " built-in nodes", "NODES.md total " + allM[1] + " -> " + total);
const genM = nOut.match(/## Generators \((\d+)\)/);
if (!genM) miss("NODES.md '## Generators (N)'");
else nOut = rep1(nOut, "## Generators (" + genM[1] + ")", "## Generators (" + (parseInt(genM[1], 10) + 3) + ")", "NODES.md Generators " + genM[1] + " -> " + (parseInt(genM[1], 10) + 3));

const plaidDoc = `**Plaid Grids 3D** — overlapping hand-drawn grids as planes in a fully
rotatable 3D world. Each grid gets a seeded character: cell size, band
structure (every line is a bundle of 1..*Bands* parallel strokes, the tartan
look), extent, wobble and dropout. *Arrangement* Stack floats parallel panes
in depth like sheets of glass so orbiting slides them past each other in
parallax, Box aligns planes to the three axis orientations, Random tumbles
them freely; *Depth spread* scatters the panes. *Yaw* and *Pitch* orbit the
camera by hand and *Perspective* bends the view from flat orthographic to a
deep pinhole lens (a true perspective — straight lines stay straight).
*Phase* adds a full 360-degree orbit turn from 0 to 1: wire ANIMATE Steps
into it and the loop closes byte-perfectly, with *Bob* adding a pitch sway
that also loops. Dropout and wobble are hashed per line, never from phase, so
frames never flicker, and the scale is measured over the whole orbit so no
frame ever leaves the sheet. *Pen per grid* cycles pens by plane.

`;
const chartDoc = `**Star Chart** — a coordinate chart drowning in observations, after Roland
Kayn's Galaxis. *System* Polar draws concentric ring bundles (every ring is
1..*Band* close-set lines with seeded spacing jitter), radial spokes, rim
ticks and tangential degree labels, with a clean center *Hole* for a title;
Cartesian rules a banded graph grid with axis numbers instead. *Wear* breaks
the graticule into worn seeded fragments and *Wobble* gives it a drafting
hand. *Hits* scatters up to thousands of dots through a density field:
*Patchiness* clumps them into drifts and voids, *Falloff* pulls them outward
or toward the center, and every dot is a tiny filled polygon between *Dot
min* and *Dot max* (small ones common, big ones rare). *Grid pen* and *Hit
pen* split the layers — graticule in one colour, observations in another.

`;
const brokenDoc = `**Broken Grid** — a grid falling apart by regions, in the early-computer-art
tradition. Every cell edge is its own seeded decision driven by two noise
fields: *Zones* sets the size of the territories, *Contrast* sharpens them
into hard either-or regions, *Density* scales everything and *Mix* couples
the fields — at 0 vertical and horizontal zones live separate lives (columns
of dashes here, rows there), at 1 they agree and the drawing becomes solid
boxes against empty voids. Every drawn edge is a dash: *Gap* shortens it with
per-edge jitter, *Shift* knocks it off the lattice, *Doubles* gives a share a
second parallel stroke and *Wobble* bends them. A built-in guard scans the
lattice for isolated swastika-reading motifs (both chiralities, arm lengths
1–2) and deterministically removes one bend edge from any it finds — motifs
buried inside dense regions do not read and are left alone; the guard is
always on by design.

`;
nOut = rep1(nOut, "**Grid** —", plaidDoc + brokenDoc + "**Grid** —", "NODES.md insert Plaid Grids 3D + Broken Grid before Grid");
nOut = rep1(nOut, "**Lissajous** —", chartDoc + "**Lissajous** —", "NODES.md insert Star Chart before Lissajous");

let tagsOut = tagsRaw;
{
  const t = JSON.parse(tagsRaw);
  const vocab = new Set(Object.values(t).flat());
  const add = {
    plaid: ["3d", "animation", "geometric", "grid"],
    starchart: ["chart", "dots", "scatter", "scientific"],
    broken_grid: ["geometric", "grid", "retro"],
  };
  let changed = false;
  for (const [k, v] of Object.entries(add)) {
    if (t[k]) { console.log("SKIP TAGS.json '" + k + "' already present"); continue; }
    const bad = v.filter((x) => !vocab.has(x));
    if (bad.length) { miss("TAGS.json invented tags for '" + k + "': " + bad.join(",")); continue; }
    t[k] = v;
    changed = true;
    okay("TAGS.json add '" + k + "' [" + v.join(", ") + "]");
  }
  if (changed) {
    const sorted = {};
    for (const k of Object.keys(t).sort()) sorted[k] = t[k];
    const after = new Set(Object.values(sorted).flat());
    if (after.size !== vocab.size) miss("TAGS.json vocabulary size changed");
    tagsOut = JSON.stringify(sorted, null, 1) + "\n";
  }
}

const bullet = `- **${next}** three new generators. **Plaid Grids 3D** (gen/geometric):
  band-line grid planes in a rotatable 3D world, true pinhole perspective,
  Phase = one full camera orbit with a byte-perfect seamless loop, per-line
  hashed dropout so frames never flicker, orbit-scanned fit so the whole
  loop stays on the sheet. **Star Chart** (gen/scientific): Galaxis-style
  polar/cartesian graticule with ring bundles, wear, tangential labels and
  a patchy density field of dot hits on a separate pen. **Broken Grid**
  (gen/geometric): per-edge grid decay with either-or zone territories,
  lattice shifts, dash gaps and doubles — plus an always-on guard that
  detects isolated swastika-reading motifs (both chiralities, arms 1-2,
  with an isolation rule) and breaks them deterministically.

`;
let hOut = rep1(handMd, "\n## Hard-won pitfalls (keep)", "\n" + bullet + "## Hard-won pitfalls (keep)", "HANDOFF version-history bullet " + next);

if (fails > 0) {
  console.log(fails + " MISS - nothing written, aborting");
  process.exit(1);
}
writeFileSync(APP, appOut);
writeFileSync(NODES, nOut);
writeFileSync(TAGS, tagsOut);
writeFileSync(HAND, hOut);
console.log("DONE v" + cur + " -> v" + next + " (registry " + total + " nodes)");
