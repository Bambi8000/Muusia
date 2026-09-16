#!/usr/bin/env node
/* patch-docs-v290.mjs — documentation batch for the Fish and Whale nodes.
 *
 * One-shot, idempotent, anchored. Reads every fact from disk:
 *   version  <- APP_VERSION in src/App.jsx
 *   counts   <- src/defs/nodes (+2 inline DEFs: group, reititys)
 *
 * Edits:
 *   docs/MUUSIA-NODES.md    header version, total count, Generators count,
 *                           Fish + Whale paragraphs at the top of Generators
 *   docs/MUUSIA-TAGS.json   "fish" and "whale" entries (existing tag vocabulary only)
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
for (const k of ["fish", "whale"]) {
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

if (nodesTxt.includes("**Fish** —") && nodesTxt.includes("**Whale** —") && tags.fish && tags.whale && handTxt.includes("**" + VERSION + "** two new **creatures** generators")) {
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

const PARA_FISH = `**Fish** — line-drawn fish in two hands. *Style* Simple is a child's fish: a
lens body and a triangle tail as one closed path, one big eye (sometimes in the
wrong place), a smile, an o or a line for the mouth, 0–2 triangle fins, a few
U-shaped scales, stripes and bubbles, every stroke shaken by *Wobble %* so it
reads as crayon rather than geometry. Detailed is a naturalist's ink drawing
built by a skeleton walk: a *Species* body profile (Perch, Pike, Roach, Bream,
Burbot, Trout or Generic — Finnish lake fish) with a snout arc whose bluntness
is species-specific, rayed dorsal, anal, pectoral and pelvic fins (the perch's
front dorsal is spiny and tallest at the head), a forked or rounded caudal fin
with rays, gill cover, lateral line, eye with pupil, mouth (*Mouth* Open drops
the lower jaw from its hinge) and species markings — perch bars, pike spots,
trout dots, burbot mottle — plus crescent *Scales* on a staggered grid whose
density follows *Detail %*. Mixed rolls the style, and Species Mixed the
species, per fish from the seed. *Layout* Rows fills a *Count* x *Rows* grid
loosened by *Jitter %*; School scatters a shoal swimming toward *Heading* with
*Turn jitter*; Spine strings fish along a wired path facing its travel
direction, *Spine mount* either On path or offset Left, Right, Both (alternate)
or Both (random) on the Fur convention; unwired, a horizontal line through the
centre. Fit is shrink-only: every fish is measured after placement and reduced
to its cell or the *Margin*, never enlarged, so *Size* stays a size. The
*Bodies* output carries each fish's closed body-and-tail silhouette, identical
to the one in *Lines*, for fill and hatch nodes. Decoration is emitted last,
so a point-budget cut removes scales before it removes fish.`;

const PARA_WHALE = `**Whale** — line-drawn whales in two hands, with an octopus hiding in the
*Species* list. Simple is a child's whale: a fat blob body, heart-shaped
flukes, a fountain *Spout*, one eye, a smile, a belly line and a flipper, every
stroke shaken by *Wobble %*; the Simple octopus is a round head with two eyes,
a smile and 6–8 wiggly arm strokes. Detailed is a naturalist's ink drawing:
a species body profile (Blue, Humpback, Sperm, Orca, Narwhal or Generic) with
the flukes turned to show both lobes — the near one lower and larger, the far
one foreshortened above, a notch between — a species dorsal (tall triangle,
hump, small hook, sperm-whale knuckles, narwhal ridge), a swept flipper
(humpback's a third of the body with a scalloped edge), eye, mouth line (the
sperm whale's runs along the underside of its box head), spout, and *Skin
texture* markings: throat pleats on the baleen whales, humpback tubercles,
sperm-whale wrinkles, blue-whale mottle, orca eye patch, saddle and belly
boundary, the narwhal's tusk with its spiral hatching and back spots. Octopus
swaps the whole plan: a mantle egg and head circle walked as one silhouette,
slit-pupil eyes, a siphon, eight tapered arms fanning from under the head as
closed limbs with suckers along the inner edge, and papillae on the mantle.
Mixed rolls style and species per creature. *Layout*, *Facing*, *Heading*,
*Spine mount*, shrink-only fit and the point-budget order work exactly as in
Fish. *Bodies* carries the closed silhouettes: one per whale, mantle plus each
of the eight arms for an octopus.`;

const HIST = `- **${VERSION}** two new **creatures** generators, siblings of Hands. **Fish**
  (gen/creatures): Simple / Detailed / Mixed styles, seven species body
  profiles by a half-height function \`ped + (1-ped) sin(pi u t^q)^k\` with a
  species snout arc, rayed fins, gill, lateral line, markings and crescent
  scales; Rows / School / Spine layouts, Spine on the Fur Left/Right
  convention; shrink-only fit measured after placement; Lines + Bodies outputs;
  decoration emitted last so a budget cut removes scales before fish.
  121-check validator. **Whale** (gen/creatures): same frame, new drawing
  machine — flukes turned to show both lobes, species dorsals and flippers,
  sperm-whale box head with underslung jaw, orca patches, narwhal tusk — and an
  **Octopus** species (mantle+head as one ray-swept union, eight tapered arms
  with suckers) that Mixed rolls in among the whales in both styles.
  125-check validator. Both nodes reuse one placement block: Rows grid with
  jitter, School rejection-sampled scatter with heading and turn jitter, Spine
  resampled along wired paths with a default centre line when unwired.

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
  nodesTxt = swap(nodesTxt, genHead[0] + "\n\n", `## Generators (${N_GEN})\n\n${PARA_WHALE}\n\n${PARA_FISH}\n\n`,
    `NODES.md Generators count -> ${N_GEN} + Whale and Fish paragraphs`);
}

/* section headings must sum to the registry total */
const sections = [...nodesTxt.matchAll(/^## [A-Za-z]+ \((\d+)\)$/gm)].map((m) => Number(m[1]));
const sum = sections.reduce((a, b) => a + b, 0);
if (sections.length < 5) bad(`NODES.md only ${sections.length} section headings found`);
else if (sum !== N_TOTAL) bad(`NODES.md section headings sum to ${sum}, registry is ${N_TOTAL} — fix the section counts by hand`);
else ok(`NODES.md section headings sum to ${sum}`);

/* ---------- TAGS.json ---------- */

const VOCAB = new Set(Object.values(tags).flat());
const NEW_TAGS = { fish: ["creature", "nature", "water", "repeat"], whale: ["creature", "nature", "water", "organic"] };
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
