/* Era patch: Belt Drive + Mushroom release.
   Bumps APP_VERSION, adds both nodes to docs/MUUSIA-NODES.md (+ counts),
   docs/MUUSIA-TAGS.json and the docs/MUUSIA-HANDOFF.md version history.
   Reads the version and node counts from the repo at runtime.
   Idempotent: SKIPs if already applied. MISS on any anchor aborts with
   nothing written. Run from the repo root: node tools/era/patch-belt-mushroom.mjs */

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

/* sentinel: already applied? */
if (nodesMd.includes("**Belt Drive** —") && handMd.includes("**Mushroom** (gen/nature)")) {
  console.log("SKIP already applied");
  process.exit(0);
}

/* facts from the repo, never from memory */
const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { miss("APP_VERSION in " + APP); process.exit(1); }
const cur = vm[1] + "." + vm[2];
const next = vm[1] + "." + (parseInt(vm[2], 10) + 1);
if (!existsSync("src/defs/nodes/belt.js") || !existsSync("src/defs/nodes/mushroom.js")) {
  miss("baked nodes src/defs/nodes/{belt,mushroom}.js must exist (bake first)");
  process.exit(1);
}
const filesN = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js")).length;
const total = filesN + 2; /* + inline group/reititys DEFS */

/* replace helper: exactly-once anchored */
const rep1 = (src, from, to, label) => {
  const parts = src.split(from);
  if (parts.length !== 2) { miss(label + " (" + (parts.length - 1) + " hits)"); return src; }
  okay(label);
  return parts.join(to);
};

/* ---- App.jsx: version bump ---- */
let appOut = rep1(app, 'APP_VERSION = "' + cur + '"', 'APP_VERSION = "' + next + '"', "App.jsx version " + cur + " -> " + next);

/* ---- NODES.md: header, counts, two entries ---- */
let nOut = nodesMd;
nOut = rep1(nOut, "# MUUSIA v" + cur + " — Node Reference", "# MUUSIA v" + next + " — Node Reference", "NODES.md header version");
const allM = nOut.match(/All (\d+) built-in nodes/);
if (!allM) miss("NODES.md 'All N built-in nodes'");
else if (parseInt(allM[1], 10) + 2 !== total) miss("NODES.md count drift: doc says " + allM[1] + " but disk implies " + (total - 2) + " before this patch");
else nOut = rep1(nOut, "All " + allM[1] + " built-in nodes", "All " + total + " built-in nodes", "NODES.md total " + allM[1] + " -> " + total);
const genM = nOut.match(/## Generators \((\d+)\)/);
if (!genM) miss("NODES.md '## Generators (N)'");
else nOut = rep1(nOut, "## Generators (" + genM[1] + ")", "## Generators (" + (parseInt(genM[1], 10) + 2) + ")", "NODES.md Generators " + genM[1] + " -> " + (parseInt(genM[1], 10) + 2));

const beltDoc = `**Belt Drive** — a tape threading between pulley circles like film through
rollers, built from exact directed-circle tangents: *Weave* Alternate crosses
the belt between pulleys (the serpentine look), Same side hugs them all one
way, Random mixes per pulley. Pulleys are generated inside the *Margin* or
wired in — every closed path becomes a pulley (centroid + mean radius; Polka
Dots and Circle Pack work directly) — and *Loose pulleys* scatters extras the
belt ignores. *Order* picks the visiting sequence, *Loop* closes the circuit,
an open belt curls *End wrap* degrees around its end pulleys. The tape never
cuts through a pulley: a straight run that would hit one deflects around it
like tape pressing on a roller, and where a wide belt would pinch through
itself at a tight wrap, *Auto idlers* inserts a small guide roller — every
candidate fix is measured and reverted unless it genuinely helps. *Belt
width* 0 is a single line; wider belts render as Edges or Ribbon (outline
plus rail lines at *Fill pitch*, a closed capsule on an open belt). *Gap*
lifts the belt off the pulley edge and a wide belt rides half its width
further out so the inner edge clears by exactly Gap. *Pulley draw* adds
outlines plus Rings or Spiral fills on a seeded *Filled %*. The **Empty**
output carries every unfilled pulley circle as clean closed regions for a
fill node, untouched by Style; Show tape / Show pulleys plot each part alone.

`;
const mushDoc = `**Mushroom** — seven Finnish forest species as true 3D revolution models
drawn from any camera angle: *Yaw* spins, *Pitch* tilts from side profile (0)
to straight overhead (90). Chanterelle and Funnel chanterelle are wavy
funnels with forking decurrent false gills that run down the stem; Black
trumpet a deep ragged horn with sparse wrinkles; Gomphidius a slick cone cap
with thick sparse gills; Bolete a barrel stem with net reticulation and a
contour-arc bun cap (no gills); Fly agaric the classic dome with white warts,
ring and bulbous base; Sheep polypore a lumpy bracket with wobbly contours —
Mix rolls a species per copy. Gills are traced on the actual 3D surface with
arc-length forking (*Gill spacing*) and visibility comes from one
surface-normal test, so funnels show their inner wall and full rim when you
look in and capped species hide their gills from above. *Chaos* is the
organic-disorder master: multi-octave lobed rims, folds that twist with
height, trunk sway, wandering gills with seeded breaks and loose interstitial
dashes. *Count* scatters seeded copies with spin, lean and size jitter —
instant shirt-print sheets — and *Cap texture* Stipple dusts the cap top with
dots for the classic top-view print. The **Mesh** output carries the FIRST
mushroom as a watertight normalized mesh for Mesh Slice.

`;
nOut = rep1(nOut, "**Cycloid Machine** —", beltDoc + "**Cycloid Machine** —", "NODES.md insert Belt Drive before Cycloid Machine");
nOut = rep1(nOut, "**Root Web** —", mushDoc + "**Root Web** —", "NODES.md insert Mushroom before Root Web");

/* ---- TAGS.json ---- */
let tagsOut = tagsRaw;
{
  const t = JSON.parse(tagsRaw);
  const vocabBefore = new Set(Object.values(t).flat());
  const add = {
    belt: ["connect", "geometric", "machine", "scatter"],
    mushroom: ["3d", "mesh", "nature", "organic", "plants"],
  };
  let changed = false;
  for (const [k, v] of Object.entries(add)) {
    if (t[k]) { console.log("SKIP TAGS.json '" + k + "' already present"); continue; }
    const bad = v.filter((x) => !vocabBefore.has(x));
    if (bad.length) { miss("TAGS.json invented tags: " + bad.join(",")); continue; }
    t[k] = v;
    changed = true;
    okay("TAGS.json add '" + k + "' [" + v.join(", ") + "]");
  }
  if (changed) {
    const sorted = {};
    for (const k of Object.keys(t).sort()) sorted[k] = t[k];
    const vocabAfter = new Set(Object.values(sorted).flat());
    if (vocabAfter.size !== vocabBefore.size) miss("TAGS.json vocabulary size changed " + vocabBefore.size + " -> " + vocabAfter.size);
    tagsOut = JSON.stringify(sorted, null, 1) + "\n";
  }
}

/* ---- HANDOFF version history ---- */
const bullet = `- **${next}** **Belt Drive** (gen/machines) + **Mushroom** (gen/nature) baked.
  Belt: directed-circle tangent serpentine, roller-collision deflection,
  measured auto-idler pinch fix (never-worse guarantee), Ribbon rails,
  Empty-regions second output. Mushroom: 7 species as 3D revolution models
  (Yaw/Pitch camera), surface-traced forking decurrent gills, one-normal
  visibility, funnel rims always full closed loops, Chaos disorder layer,
  watertight normalized Mesh output (count-invariant first copy).

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
