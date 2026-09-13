/* tools/era/patch-docs-v275.mjs — one-shot doc batch for the v2.75 release.

   Adds Ink Relief to the reference and the tag catalogue, and records the
   Potato default change in the handoff history — a silent default change is
   exactly the sort of thing that is impossible to date six months later.

   Every fact is read from disk: version from App.jsx, counts from
   src/defs/nodes. Anchored, idempotent, MISS-aborts before writing anything.

   Run once from the repo root:  node tools/era/patch-docs-v275.mjs           */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const findDoc = (name) => {
  for (const dir of ["docs", ".", "../docs", ".."]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
};
const NODES_MD = findDoc("MUUSIA-NODES.md");
const HANDOFF_MD = findDoc("MUUSIA-HANDOFF.md");
const TAGS_JSON = findDoc("MUUSIA-TAGS.json");
const API_MD = findDoc("MUUSIA-NODE-API.md");
if (!NODES_MD || !HANDOFF_MD || !TAGS_JSON) { console.log("MISS  docs not found"); process.exit(1); }

const APP = readFileSync("src/App.jsx", "utf8");
const vm = APP.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in src/App.jsx"); process.exit(1); }
const VERSION = vm[1];

const NODE_DIR = "src/defs/nodes";
const files = readdirSync(NODE_DIR).filter((f) => f.endsWith(".js"));
const cats = files.map((f) => (readFileSync(join(NODE_DIR, f), "utf8").match(/cat:\s*"([a-z]+)"/) || [])[1]);
const count = (c) => cats.filter((q) => q === c).length;
const C = {
  Generators: count("gen"), Modifiers: count("mod"), Decorators: count("dec"),
  Combiners: count("duo") + 1, Math: count("math"), Routing: 1,
};
const TOTAL = Object.values(C).reduce((a, b) => a + b, 0);
const FILES = files.length;

if (!existsSync(join(NODE_DIR, "ink_relief.js"))) { console.log("MISS  ink_relief is not baked yet"); process.exit(1); }

/* the Potato change must be on disk before the history claims it happened */
const potato = readFileSync(join(NODE_DIR, "potato.js"), "utf8");
const eyesLine = potato.split("\n").filter((l) => l.includes('key: "eyes"'));
if (eyesLine.length !== 1 || !/def:\s*"None"/.test(eyesLine[0])) {
  console.log("MISS  Potato still defaults to eyes — run patch-potato-clean.mjs first");
  process.exit(1);
}
console.log("      version " + VERSION + ", " + FILES + " files, " + TOTAL + " nodes (" +
  Object.entries(C).map(([k, v]) => k + " " + v).join(", ") + ")");

if (readFileSync(NODES_MD, "utf8").includes("**Ink Relief** —")) {
  console.log("SKIP  already applied (Ink Relief is in MUUSIA-NODES.md)");
  process.exit(0);
}

let aborted = false;
const edits = [];
const insertBefore = (label, text, anchor, block) => {
  const parts = text.split(anchor);
  if (parts.length !== 2) { console.log("MISS  " + label + " (" + (parts.length - 1) + " hits, need 1)"); aborted = true; return text; }
  edits.push(label);
  return parts[0] + block + anchor + parts[1];
};
const swap = (label, text, re, make) => {
  const hits = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
  if (!hits || hits.length !== 1) { console.log("MISS  " + label + " (" + (hits ? hits.length : 0) + " hits, need 1)"); aborted = true; return text; }
  edits.push(label);
  return text.replace(re, make);
};

/* ---------- MUUSIA-NODES.md ---------- */
const PARA = `**Ink Relief** — finds the places where the pen inks the same spot over and
over and thins them out, leaving the rest of the drawing alone. Two kinds of
pile-up get detected. *Corners*: nested rings from Offset or Morph Layers all
turn at the same vertex, the pen decelerates to a near stop each time and a
ballpoint leaves a glossy bead — **Round** replaces the corner with a fillet so
the pen never stops, **Fan** pushes the stacked corners outward along the spike
by rank, **Notch** cuts a gap so no ink reaches the corner at all. *Overlaps*:
where a shape pinches, dozens of rings collapse onto the same straight run and
one line gets drawn thirty times — **Spread** offsets each run perpendicular by
rank so a black bar becomes a band of separate lines, **Thin** keeps every Nth
pass and cuts the run out of the others, **Taper** cuts most from the middle of
the stack and nothing from the outermost, hollowing the bar while keeping its
silhouette. Relief scales with how crowded each pile is (*Min passes*, *Full
strength at*), so a stack of thirty gets the full *Amount* and a stack of six
barely any. *Target* Both runs the corner pass first and looks for overlaps in
its result, which is stronger than either alone because the edges feeding a
spike are themselves near-parallel. *Show hotspots* draws each pile on its own
pen — circles for corners, a line along the run for overlaps — which is the
fastest way to check detection before committing a sheet.

`;

let nodesMd = readFileSync(NODES_MD, "utf8");
nodesMd = insertBefore("NODES.md Ink Relief paragraph", nodesMd, "\n## Decorators (", "\n" + PARA.trimEnd() + "\n");
nodesMd = swap("NODES.md title version", nodesMd, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + VERSION + " — Node Reference");
nodesMd = swap("NODES.md total count", nodesMd, /All \d+ built-in nodes\./, "All " + TOTAL + " built-in nodes.");
for (const [name, n] of Object.entries(C)) {
  nodesMd = swap("NODES.md section count: " + name, nodesMd, new RegExp("^## " + name + " \\(\\d+\\)$", "m"), "## " + name + " (" + n + ")");
}

/* ---------- MUUSIA-HANDOFF.md ---------- */
const HISTORY = `- **${VERSION}** **Ink Relief** (mod/deform) baked, from a photograph of a
  plot where the ballpoint had beaded into a glossy bead at every spike and a
  solid black bar down a pinched waist. Two detectors, six reliefs: corners
  (Round, Fan, Notch) and overlapping runs (Spread, Thin, Taper), both gated on
  how many passes crowd the same place and both scaling relief with that count.
  The validator measures ink rather than shape — a node that only moved points
  around would pass a geometry test and still bead — by building a 28-ring
  spike stack and a 26-pass neck and asserting how much path length survives
  inside a small disc: Round 28 %, Fan 11 % at 6 mm, Notch 0 %, Thin 46 %,
  Taper 23 %. Spread needs its own oracle because it does not remove ink at
  all, it widens the band, so that test asserts band width instead: 1.25 mm to
  6.49 mm, monotonic in Amount. Two false positives are tested for explicitly:
  thirty lines crossing at a point are not an overlap, and a shape with no
  pile-up comes through byte-identical. Writing those tests turned up that a
  spike stack genuinely contains overlaps as well, since the edges feeding the
  tip run near-parallel, so Target Both is stronger than either pass alone.
  Also in this release: **Potato** now defaults to clean blobs — Eyes was
  defaulting to "Arcs (eyes)", so every freshly dropped node arrived textured
  (9 paths become 72) — and *Eyes per potato* gained a showIf so it stops
  sitting in the inspector doing nothing. Saved patches write every parameter
  explicitly, so existing work keeps whatever it had; only new nodes change.
  The first attempt at that patch reported a false SKIP, because its guard
  searched the whole file for \`p.eyes !== "None"\` and the compute body already
  contained that string — guards have to test the param line, not the file.
  (tools/validate-ink_relief.mjs, tools/era/patch-potato-clean.mjs,
  tools/era/patch-docs-v275.mjs)
`;

let handoff = readFileSync(HANDOFF_MD, "utf8");
handoff = insertBefore("HANDOFF version history entry", handoff, "\n## Hard-won pitfalls (keep)", HISTORY);
handoff = swap("HANDOFF file count", handoff, /\*\*\d+ files\*\*/, "**" + FILES + " files**");
handoff = swap("HANDOFF total in layout note", handoff, /\(\d+ nodes total with/, "(" + TOTAL + " nodes total with");
handoff = swap("HANDOFF per-category note", handoff, /Generators \d+, Modifiers \d+/, "Generators " + C.Generators + ", Modifiers " + C.Modifiers);
handoff = swap("HANDOFF node count check", handoff, /wc -l` \(\d+\)/, "wc -l` (" + FILES + ")");

/* ---------- MUUSIA-TAGS.json ---------- */
const TAGS = { ink_relief: ["deform", "texture"] };
const tags = JSON.parse(readFileSync(TAGS_JSON, "utf8"));
const vocabBefore = new Set(Object.values(tags).flat());
const invented = Object.values(TAGS).flat().filter((t) => !vocabBefore.has(t));
if (invented.length) { console.log("MISS  tags outside the vocabulary: " + invented.join(", ")); aborted = true; }
if (tags.ink_relief) { console.log("MISS  ink_relief already tagged"); aborted = true; }
for (const [k, v] of Object.entries(TAGS)) tags[k] = v;
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
if (new Set(Object.values(sorted).flat()).size !== vocabBefore.size) { console.log("MISS  tag vocabulary changed size"); aborted = true; }
if (!aborted) edits.push("TAGS.json ink_relief entry (vocabulary still " + vocabBefore.size + " tags)");

/* ---------- NODE-API version stamp ---------- */
let apiOut = null;
if (API_MD) {
  const api = readFileSync(API_MD, "utf8");
  const hits = api.match(/app v[\d.]+/g);
  if (hits && hits.length === 1) { apiOut = api.replace(/app v[\d.]+/, "app v" + VERSION); edits.push("NODE-API version stamp"); }
  else console.log("      NODE-API version stamp not unique, left alone");
}

if (aborted) { console.log("ABORT nothing written"); process.exit(1); }
writeFileSync(NODES_MD, nodesMd);
writeFileSync(HANDOFF_MD, handoff);
writeFileSync(TAGS_JSON, JSON.stringify(sorted, null, 1) + "\n");
if (apiOut) writeFileSync(API_MD, apiOut);
for (const e of edits) console.log("OK    " + e);
console.log("DONE  v" + VERSION + " doc batch, " + TOTAL + " nodes");
