import { readFileSync, writeFileSync, readdirSync } from "node:fs";

let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

const app = readFileSync("src/App.jsx", "utf8");
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in src/App.jsx - ABORT"); process.exit(1); }
const V = vm[1];

const files = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
let gens = 0, mods = 0;
for (const f of files) {
  const s = readFileSync("src/defs/nodes/" + f, "utf8");
  if (s.includes('cat: "gen"')) gens++;
  else if (s.includes('cat: "mod"')) mods++;
}
const nFiles = files.length;
const nTotal = nFiles + 2;
console.log("INFO  version " + V + " (from src/App.jsx), " + nFiles + " node files (" + nTotal + " total), gen " + gens + ", mod " + mods);

const NODES = "docs/MUUSIA-NODES.md";
let nd = readFileSync(NODES, "utf8");
if (nd.includes("**Image Rasterise**")) {
  console.log("SKIP  patch-docs-cmyk-raster already applied (Image Rasterise paragraph found)");
  process.exit(0);
}

const RASTER_PAR = "**Image Rasterise** \u2014 true CMYK halftone separation of a loaded photo: each\nplate plots with its own pen at its own screen angle (the *Angles* select's\nStandard 15/75/0/45 is a one-click reset; Custom frees the four sliders). Dot\nstyles: *Dots* (circles sized by density), *Rings*, *Spiral* (ink-coverage\nspirals) and *Dashes* (a cheap line screen for large sheets). Press-defect\ncontrols \u2014 *Misregistration* (seeded per-plate shift), *Plate skew*, *Dot gain*,\n*Doubling* (slur ghosts) and *Ink noise* \u2014 turn calibration into art. *Black\n(GCR)* sets how much gray moves to the K plate; *Cell* is the raster pitch\n(raise it if the point budget truncates \u2014 plates draw K first so a truncation\neats yellow). Requires the " + V + " rgb image intake; photos loaded by older\nbuilds fall back to a grayscale K-only separation until re-loaded.\n\n";

const CMYK_PAR = "**CMYK Registration** \u2014 prepress furniture as art: thirteen authentic\nregistration and control marks (crosshair target, letterpress bullseye,\nGATF-style star target, Japanese tombo center/corner, Western crop marks, a\nCMYK color bar at real screen angles, slur ladder gauge, flexo eye-mark stack,\nquartered survey target, micro cross, bookbinding collation steps, graduated\nscale cross). Registration-color marks plot once per plate with seeded\n*Misregistration* (+ per-mark *Wobble*) for classic out-of-register ghosting;\nsingle-channel patches stay on their own plate. Mark checkboxes choose the\npopulation for the *Grid/Ring/Border/Scatter* layouts and filter the full\n*Press sheet* imposition arrangement; *Single* draws one mark at the canvas\ncenter chosen by the *Single mark* dropdown (Tombo corner and Crop marks place\nfour oriented corner marks instead).\n\n";

let hits;
hits = nd.match(/# MUUSIA v[\d.]+ \u2014 Node Reference/g);
if (hits && hits.length === 1) { nd = nd.replace(hits[0], "# MUUSIA v" + V + " \u2014 Node Reference"); OK("NODES.md header version -> " + V); }
else MISS("NODES.md header version anchor");

hits = nd.match(/All \d+ built-in nodes/g);
if (hits && hits.length === 1) { nd = nd.replace(hits[0], "All " + nFiles + " built-in nodes"); OK("NODES.md total count -> " + nFiles); }
else MISS("NODES.md total count anchor");

hits = nd.match(/## Generators \(\d+\)/g);
if (hits && hits.length === 1) { nd = nd.replace(hits[0], "## Generators (" + gens + ")"); OK("NODES.md Generators count -> " + gens); }
else MISS("NODES.md Generators count anchor");

hits = nd.match(/## Modifiers \(\d+\)/g);
if (hits && hits.length === 1) { nd = nd.replace(hits[0], "## Modifiers (" + mods + ")"); OK("NODES.md Modifiers count -> " + mods); }
else MISS("NODES.md Modifiers count anchor");

const A1 = "engine seam; the photo travels inside the patch.\n\n";
if (nd.split(A1).length === 2) { nd = nd.replace(A1, A1 + RASTER_PAR); OK("NODES.md Image Rasterise paragraph inserted after Image Underlay"); }
else MISS("NODES.md Image Underlay tail anchor");

const A2 = "auto-shrinks its cells to fit the current canvas.\n\n";
if (nd.split(A2).length === 2) { nd = nd.replace(A2, A2 + CMYK_PAR); OK("NODES.md CMYK Registration paragraph inserted after Test Card"); }
else MISS("NODES.md Test Card tail anchor");

const TAGS = "docs/MUUSIA-TAGS.json";
const tags = JSON.parse(readFileSync(TAGS, "utf8"));
if (!tags.cmyk_registration) { tags.cmyk_registration = ["geometric", "grid", "hatch", "machine", "round", "scientific"]; OK("TAGS.json cmyk_registration tagged"); }
else MISS("TAGS.json cmyk_registration already present");
if (!tags.image_rasterise) { tags.image_rasterise = ["dots", "grid", "halftone", "image", "spiral"]; OK("TAGS.json image_rasterise tagged"); }
else MISS("TAGS.json image_rasterise already present");
const sortedTags = {};
for (const k of Object.keys(tags).sort()) sortedTags[k] = tags[k];

const HANDOFF = "docs/MUUSIA-HANDOFF.md";
let hd = readFileSync(HANDOFF, "utf8");

hits = hd.match(/\*\*\d+ files\*\* \(\d+ nodes total with\n  group \+ reititys; Generators \d+, Modifiers \d+\)/g);
if (hits && hits.length === 1) {
  hd = hd.replace(hits[0], "**" + nFiles + " files** (" + nTotal + " nodes total with\n  group + reititys; Generators " + gens + ", Modifiers " + mods + ")");
  OK("HANDOFF repo-layout counts -> " + nFiles + " files / " + nTotal + " total / gen " + gens + " / mod " + mods);
} else MISS("HANDOFF repo-layout counts anchor");

hits = hd.match(/wc -l` \(\d+\)/g);
if (hits && hits.length === 1) { hd = hd.replace(hits[0], "wc -l` (" + nFiles + ")"); OK("HANDOFF wc -l count -> " + nFiles); }
else MISS("HANDOFF wc -l count anchor");

const HIST = "- **" + V + "** Two prepress nodes + an engine seam. NEW GEN **CMYK\n  Registration** (scientific): thirteen authentic print registration/control\n  marks (crosshair, bullseye, GATF star, Japanese tombo center/corner, crop,\n  color bar at real screen angles C15/M75/Y0/K45, ladder gauge, eye marks,\n  quartered target, micro cross, collation steps, scale cross), registration-\n  color marks drawn once per plate with seeded misregistration + wobble;\n  layouts Grid (default) / Single / Press sheet / Ring / Border / Scatter -\n  mark checkboxes drive the multi layouts, the Single mark dropdown drives\n  Single (no button param type exists; a Standard/Custom select is the reset\n  idiom). NEW GEN **Image Rasterise** (textimg): true CMYK halftone separation\n  of a loaded photo - per-plate screen angles (Angles select: Standard\n  15/75/0/45 = one-click reset, Custom frees the sliders), dot styles\n  Dots/Rings/Spiral/Dashes, GCR black slider, press-defect controls\n  (misregistration, plate skew, dot gain, doubling/slur ghosts, ink noise);\n  plates draw K-first so a budget truncation eats yellow, grayscale-only\n  images (older intake) fall back to a K-only separation. ENGINE\n  tools/era/patch-image-rgb.mjs (applied): the fileImage intake decode loop\n  now also stores img.rgb flattened alpha-over-white - backwards compatible,\n  every fileImage node keeps reading img.g.\n\n";

const A3 = "\n## Hard-won pitfalls (keep)\n";
if (hd.split(A3).length === 2) { hd = hd.replace(A3, "\n" + HIST + "## Hard-won pitfalls (keep)\n"); OK("HANDOFF " + V + " version-history entry inserted"); }
else MISS("HANDOFF history anchor (## Hard-won pitfalls)");

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - NOTHING written");
  process.exit(1);
}
writeFileSync(NODES, nd);
writeFileSync(TAGS, JSON.stringify(sortedTags, null, 1) + "\n");
writeFileSync(HANDOFF, hd);
console.log("DONE  " + ok + " edits written to NODES.md, TAGS.json, HANDOFF.md");
